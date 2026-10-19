import Foundation
import AVFoundation
import Observation

/// The recording library on iPhone and Mac. The file system (iCloud Drive) is the source of truth;
/// this class scans it, watches it for changes made by other devices, and performs edits.
@MainActor
@Observable
final class RecordingLibrary {
    enum StorageKind: Equatable {
        case iCloud
        case local
        case iCloudUnavailable // user wants iCloud but isn't signed in; falls back to local
    }

    private(set) var items: [RecordingItem] = []
    private(set) var deletedItems: [RecordingItem] = []
    private(set) var storage: StorageKind = .local
    private(set) var isLoaded = false
    private(set) var root: URL = RecordingPaths.localRoot

    /// Called whenever new recordings appear (from this device, the Watch, or another device via iCloud).
    @ObservationIgnored var onItemsChanged: (([RecordingItem]) -> Void)?

    @ObservationIgnored private var metadataQuery: NSMetadataQuery?
    @ObservationIgnored private var queryObservers: [NSObjectProtocol] = []
    @ObservationIgnored private var reloadTask: Task<Void, Never>?
    @ObservationIgnored private var cache: [URL: (modified: Date, metadata: RecordingMetadata)] = [:]

    var recordingsRoot: URL { root.appendingPathComponent(RecordingPaths.recordingsFolder, isDirectory: true) }
    var deletedRoot: URL { root.appendingPathComponent(RecordingPaths.deletedFolder, isDirectory: true) }

    func item(withID id: UUID) -> RecordingItem? {
        items.first { $0.id == id } ?? deletedItems.first { $0.id == id }
    }

    // MARK: - Setup

    func prepare() async {
        let wantsICloud = UserDefaults.standard.bool(forKey: AppSettings.Key.useICloud)
        if wantsICloud {
            // `url(forUbiquityContainerIdentifier:)` can block, so resolve it off the main actor.
            let container = await Task.detached(priority: .userInitiated) {
                FileManager.default.url(forUbiquityContainerIdentifier: RecordingPaths.containerIdentifier)
            }.value
            if let container {
                root = container.appendingPathComponent("Documents", isDirectory: true)
                storage = .iCloud
            } else {
                root = RecordingPaths.localRoot
                storage = .iCloudUnavailable
            }
        } else {
            root = RecordingPaths.localRoot
            storage = .local
        }
        try? FileManager.default.createDirectory(at: recordingsRoot, withIntermediateDirectories: true)
        startWatching()
        await reload()
        isLoaded = true
        await purgeDeleted(olderThan: 30)
    }

    /// Switching storage moves every recording to the new location.
    func setUseICloud(_ useICloud: Bool) async throws {
        let oldRoot = root
        UserDefaults.standard.set(useICloud, forKey: AppSettings.Key.useICloud)
        stopWatching()
        await prepare()
        guard oldRoot != root else { return }
        for folder in [RecordingPaths.recordingsFolder, RecordingPaths.deletedFolder] {
            let source = oldRoot.appendingPathComponent(folder, isDirectory: true)
            guard let enumerator = FileManager.default.enumerator(at: source, includingPropertiesForKeys: nil) else { continue }
            let files = enumerator.compactMap { $0 as? URL }.filter { !$0.hasDirectoryPath }
            for file in files {
                let relative = file.path.replacingOccurrences(of: source.path, with: "")
                let destination = root.appendingPathComponent(folder).appendingPathComponent(relative)
                try MetadataIO.move(file, to: destination)
            }
        }
        await reload()
    }

    // MARK: - Watching iCloud for changes

    private func startWatching() {
        guard storage == .iCloud, metadataQuery == nil else { return }
        let query = NSMetadataQuery()
        query.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]
        query.predicate = NSPredicate(format: "%K LIKE '*'", NSMetadataItemFSNameKey)
        let center = NotificationCenter.default
        queryObservers = [Notification.Name.NSMetadataQueryDidFinishGathering, .NSMetadataQueryDidUpdate].map { name in
            center.addObserver(forName: name, object: query, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.scheduleReload() }
            }
        }
        query.start()
        metadataQuery = query
    }

    private func stopWatching() {
        metadataQuery?.stop()
        queryObservers.forEach(NotificationCenter.default.removeObserver)
        queryObservers = []
        metadataQuery = nil
    }

    /// iCloud sends bursts of updates; coalesce them.
    func scheduleReload() {
        reloadTask?.cancel()
        reloadTask = Task {
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            await reload()
        }
    }

    // MARK: - Scanning

    func reload() async {
        let recordingsRoot = recordingsRoot
        let deletedRoot = deletedRoot
        let cache = cache
        let scanned = await Task.detached(priority: .utility) {
            (Self.scan(recordingsRoot, cache: cache), Self.scan(deletedRoot, cache: cache))
        }.value

        var newCache: [URL: (modified: Date, metadata: RecordingMetadata)] = [:]
        for entry in scanned.0.cacheEntries + scanned.1.cacheEntries { newCache[entry.url] = (entry.modified, entry.metadata) }
        self.cache = newCache

        // Audio without a sidecar gets one now (dropped in via Finder, or written by an older import).
        for item in scanned.0.items + scanned.1.items where !FileManager.default.fileExists(atPath: item.metadataURL.path) {
            var metadata = item.metadata
            if metadata.duration == 0, item.isDownloaded {
                metadata.duration = await Self.duration(of: item.audioURL)
            }
            try? MetadataIO.write(metadata, to: item.metadataURL)
        }

        let previousIDs = Set(items.map(\.id))
        items = scanned.0.items.sorted { $0.metadata.createdAt > $1.metadata.createdAt }
        deletedItems = scanned.1.items.sorted { ($0.metadata.deletedAt ?? .distantPast) > ($1.metadata.deletedAt ?? .distantPast) }
        if Set(items.map(\.id)) != previousIDs || !isLoaded {
            onItemsChanged?(items)
        }
    }

    private struct ScanResult {
        var items: [RecordingItem] = []
        var cacheEntries: [(url: URL, modified: Date, metadata: RecordingMetadata)] = []
    }

    nonisolated private static func scan(_ folder: URL, cache: [URL: (modified: Date, metadata: RecordingMetadata)]) -> ScanResult {
        let keys: [URLResourceKey] = [.contentModificationDateKey, .isDirectoryKey, .ubiquitousItemDownloadingStatusKey]
        guard let enumerator = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: keys) else {
            return ScanResult()
        }
        var result = ScanResult()
        var seenIDs = Set<UUID>()
        for case let url as URL in enumerator {
            // Older iCloud placeholder files look like ".name.m4a.icloud".
            let audioURL: URL
            var downloaded = true
            if url.pathExtension == "icloud", url.lastPathComponent.hasPrefix(".") {
                let realName = String(url.deletingPathExtension().lastPathComponent.dropFirst())
                audioURL = url.deletingLastPathComponent().appendingPathComponent(realName)
                downloaded = false
            } else {
                audioURL = url
            }
            guard RecordingPaths.isAudioFile(audioURL) else { continue }

            let values = try? url.resourceValues(forKeys: Set(keys))
            if let status = values?.ubiquitousItemDownloadingStatus, status != .current, status != .downloaded {
                downloaded = false
            }

            let metadataURL = RecordingPaths.metadataURL(forAudio: audioURL)
            let modified = (try? metadataURL.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate) ?? .distantPast
            var metadata: RecordingMetadata
            if let cached = cache[metadataURL], cached.modified == modified {
                metadata = cached.metadata
            } else if let loaded = try? MetadataIO.read(metadataURL) {
                metadata = loaded
            } else {
                metadata = defaultMetadata(for: audioURL, relativeTo: folder)
            }
            // Two copies of the same recording (an iCloud conflict, or a double Watch delivery): show one.
            guard seenIDs.insert(metadata.id).inserted else { continue }
            result.cacheEntries.append((metadataURL, modified, metadata))
            result.items.append(RecordingItem(audioURL: audioURL, metadata: metadata, isDownloaded: downloaded))
        }
        return result
    }

    nonisolated private static func defaultMetadata(for audioURL: URL, relativeTo folder: URL) -> RecordingMetadata {
        let name = audioURL.deletingPathExtension().lastPathComponent
        let relative = audioURL.path.replacingOccurrences(of: folder.path, with: "")
        let created = RecordingPaths.date(fromFileName: name)
            ?? (try? audioURL.resourceValues(forKeys: [.creationDateKey]).creationDate)
            ?? .now
        var metadata = RecordingMetadata(id: UUID(stableFrom: relative), createdAt: created, source: .imported)
        if RecordingPaths.date(fromFileName: name) == nil { metadata.title = name }
        return metadata
    }

    nonisolated static func duration(of url: URL) async -> TimeInterval {
        let asset = AVURLAsset(url: url)
        guard let duration = try? await asset.load(.duration) else { return 0 }
        return duration.seconds.isFinite ? duration.seconds : 0
    }

    // MARK: - Adding recordings

    /// Moves a finished recording (from this device's recorder, the Watch, or an import) into the library.
    @discardableResult
    func add(audioAt sourceURL: URL, metadata: RecordingMetadata, copy: Bool = false) async throws -> RecordingItem {
        if let existing = item(withID: metadata.id) { return existing } // already delivered
        var metadata = metadata
        if metadata.duration == 0 { metadata.duration = await Self.duration(of: sourceURL) }
        let destination = RecordingPaths.newAudioURL(in: recordingsRoot, date: metadata.createdAt,
                                                     fileExtension: sourceURL.pathExtension.isEmpty ? "m4a" : sourceURL.pathExtension)
        let finalMetadata = metadata
        try await Task.detached(priority: .userInitiated) {
            if copy {
                try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
                try FileManager.default.copyItem(at: sourceURL, to: destination)
            } else {
                try MetadataIO.move(sourceURL, to: destination)
            }
            try MetadataIO.write(finalMetadata, to: RecordingPaths.metadataURL(forAudio: destination))
        }.value
        let item = RecordingItem(audioURL: destination, metadata: finalMetadata)
        items.insert(item, at: items.firstIndex { $0.metadata.createdAt < finalMetadata.createdAt } ?? items.endIndex)
        onItemsChanged?(items)
        return item
    }

    // MARK: - Editing

    @discardableResult
    func update(_ id: UUID, _ change: (inout RecordingMetadata) -> Void) -> RecordingItem? {
        if let index = items.firstIndex(where: { $0.id == id }) {
            change(&items[index].metadata)
            persist(items[index])
            return items[index]
        }
        if let index = deletedItems.firstIndex(where: { $0.id == id }) {
            change(&deletedItems[index].metadata)
            persist(deletedItems[index])
            return deletedItems[index]
        }
        return nil
    }

    private func persist(_ item: RecordingItem) {
        let metadata = item.metadata
        let url = item.metadataURL
        Task.detached(priority: .utility) {
            try? MetadataIO.write(metadata, to: url)
        }
    }

    /// Replace the audio of a recording (after trimming), keeping its identity.
    func replaceAudio(of id: UUID, with newAudio: URL, change: (inout RecordingMetadata) -> Void) async throws {
        guard let item = items.first(where: { $0.id == id }) else { return }
        let target = item.audioURL
        try await Task.detached {
            try MetadataIO.delete(target)
            try MetadataIO.move(newAudio, to: target)
        }.value
        update(id, change)
    }

    var allTags: [String] {
        Array(Set(items.flatMap(\.metadata.tags))).sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    // MARK: - Downloading

    func ensureDownloaded(_ item: RecordingItem) {
        guard !item.isDownloaded else { return }
        try? FileManager.default.startDownloadingUbiquitousItem(at: item.audioURL)
    }

    // MARK: - Deleting (Voice Memos–style "Recently Deleted")

    func moveToRecentlyDeleted(_ ids: Set<UUID>) async {
        let moving = items.filter { ids.contains($0.id) }
        for item in moving {
            var metadata = item.metadata
            metadata.deletedAt = .now
            let relative = item.audioURL.path.replacingOccurrences(of: recordingsRoot.path, with: "")
            let destination = deletedRoot.appendingPathComponent(relative)
            await moveRecording(item, to: destination, metadata: metadata)
        }
        await reload()
    }

    func restore(_ ids: Set<UUID>) async {
        for item in deletedItems where ids.contains(item.id) {
            var metadata = item.metadata
            metadata.deletedAt = nil
            let relative = item.audioURL.path.replacingOccurrences(of: deletedRoot.path, with: "")
            await moveRecording(item, to: recordingsRoot.appendingPathComponent(relative), metadata: metadata)
        }
        await reload()
    }

    func deletePermanently(_ ids: Set<UUID>) async {
        for item in deletedItems where ids.contains(item.id) {
            let audio = item.audioURL, sidecar = item.metadataURL
            await Task.detached {
                try? MetadataIO.delete(audio)
                try? MetadataIO.delete(sidecar)
            }.value
        }
        await reload()
    }

    func purgeDeleted(olderThan days: Int) async {
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: .now) ?? .distantPast
        let expired = deletedItems.filter { ($0.metadata.deletedAt ?? .now) < cutoff }.map(\.id)
        if !expired.isEmpty { await deletePermanently(Set(expired)) }
    }

    private func moveRecording(_ item: RecordingItem, to destination: URL, metadata: RecordingMetadata) async {
        let audio = item.audioURL, sidecar = item.metadataURL
        await Task.detached {
            do {
                try MetadataIO.move(audio, to: destination)
                try MetadataIO.write(metadata, to: RecordingPaths.metadataURL(forAudio: destination))
                try? MetadataIO.delete(sidecar)
            } catch {
                print("Earmark: move failed for \(audio.lastPathComponent): \(error)")
            }
        }.value
    }
}
