import Foundation
import Observation

/// One per app (iPhone, Mac). Owns the library, recorder and background work, and is what
/// Siri / Shortcuts / Control Center / the menu bar talk to.
@MainActor
@Observable
final class AppModel {
    static let shared = AppModel()

    let library: RecordingLibrary
    let processing: ProcessingQueue
    let recorder = Recorder()
    let liveTranscriber = LiveTranscriber()
    let player = PlaybackController()
    @ObservationIgnored let locationTagger = LocationTagger()

    /// The recording shown in the detail view (set by taps, Spotlight, deep links).
    var selectedID: UUID?
    /// Shown as an alert.
    var errorMessage: String?
    /// The recording that just finished, briefly highlighted in the list.
    private(set) var lastFinishedID: UUID?
    private(set) var isWatchReachable = false

    /// iPhone hooks this up to the Live Activity.
    @ObservationIgnored var onRecorderStateChange: ((Recorder.State) -> Void)?

    @ObservationIgnored private var started = false

    private init() {
        AppSettings.register()
        let library = RecordingLibrary()
        self.library = library
        processing = ProcessingQueue(library: library)
    }

    func start() async {
        guard !started else { return }
        started = true

        recorder.onStateChange = { [weak self] state in self?.onRecorderStateChange?(state) }
        library.onItemsChanged = { [weak self] items in
            self?.processing.scan()
            SpotlightIndexer.index(items)
        }
        processing.onProcessed = { item in SpotlightIndexer.index([item]) }

        #if os(iOS)
        WatchSync.shared.onInboxChanged = { [weak self] in Task { await self?.drainWatchInbox() } }
        WatchSync.shared.onReachabilityChanged = { [weak self] reachable in self?.isWatchReachable = reachable }
        WatchSync.shared.activate()
        #endif

        await library.prepare()
        #if os(iOS)
        await drainWatchInbox()
        #endif
        await drainCloudInbox()
        processing.scan()
    }

    /// Call when the app comes to the foreground.
    func refresh() async {
        guard library.isLoaded else { return }
        library.scheduleReload()
        #if os(iOS)
        await drainWatchInbox()
        #endif
        await drainCloudInbox()
    }

    // MARK: - Recording

    func startRecording() async {
        guard !recorder.isActive else { return }
        player.pause()
        do {
            if UserDefaults.standard.bool(forKey: AppSettings.Key.liveTranscription) {
                let live = liveTranscriber
                recorder.bufferHandler = { buffer in live.append(buffer) }
            } else {
                recorder.bufferHandler = nil
            }
            try await recorder.start()
            if recorder.bufferHandler != nil {
                Task { await liveTranscriber.start(locale: AppSettings.transcriptionLocale) }
            }
            // Look up the place in the background; it's attached when the recording stops.
            if locationTagger.isEnabled {
                Task {
                    if let place = await locationTagger.currentPlace() {
                        recorder.updateMetadata { $0.place = place }
                    }
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func toggleRecording() async {
        if recorder.isActive { await stopRecording() } else { await startRecording() }
    }

    @discardableResult
    func stopRecording() async -> RecordingItem? {
        recorder.bufferHandler = nil
        guard let finished = recorder.stop() else { return nil }
        await liveTranscriber.stop()
        do {
            let item = try await library.add(audioAt: finished.audioURL, metadata: finished.metadata)
            lastFinishedID = item.id
            processing.enqueue(item.id, front: true)
            return item
        } catch {
            errorMessage = "Couldn't save the recording: \(error.localizedDescription)"
            return nil
        }
    }

    func addBookmark(note: String? = nil) {
        recorder.addBookmark(note: note)
    }

    // MARK: - Library actions

    func delete(_ ids: Set<UUID>) async {
        if let selectedID, ids.contains(selectedID) {
            player.stop()
            self.selectedID = nil
        }
        await library.moveToRecentlyDeleted(ids)
        SpotlightIndexer.remove(Array(ids))
    }

    func trim(_ id: UUID, to range: ClosedRange<TimeInterval>) async {
        guard let item = library.item(withID: id) else { return }
        do {
            player.stop()
            let trimmed = try await AudioEditing.trim(item.audioURL, to: range)
            try await library.replaceAudio(of: id, with: trimmed) { AudioEditing.adjust(&$0, for: range) }
            if let updated = library.item(withID: id) { player.load(updated) }
        } catch {
            errorMessage = "Trim failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Inboxes

    #if os(iOS)
    func drainWatchInbox() async {
        guard library.isLoaded else { return }
        for pending in WatchSync.pendingInboxItems() {
            do {
                try await library.add(audioAt: pending.audio, metadata: pending.metadata)
                WatchSync.removeFromInbox(pending.metadata.id)
            } catch {
                // Leave it in the inbox and try again next launch.
            }
        }
    }
    #endif

    func drainCloudInbox() async {
        guard library.isLoaded, await CloudInbox.isAvailable() else { return }
        guard let downloads = try? await CloudInbox.fetchPending() else { return }
        for download in downloads {
            do {
                try await library.add(audioAt: download.audioURL, metadata: download.metadata)
                await CloudInbox.remove(download.recordID)
            } catch {
                continue
            }
        }
    }

    // MARK: - Deep links

    /// `earmark://record`, `earmark://stop`, `earmark://open?id=<uuid>`
    func handle(url: URL) async {
        guard url.scheme == "earmark" else { return }
        switch url.host {
        case "record": await startRecording()
        case "stop": await stopRecording()
        case "toggle": await toggleRecording()
        case "open":
            if let id = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "id" })?.value.flatMap(UUID.init) {
                selectedID = id
            }
        default: break
        }
    }
}
