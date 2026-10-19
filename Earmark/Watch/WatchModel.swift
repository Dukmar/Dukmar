import Foundation
import Observation
import WatchKit

/// Watch side: record, keep a local copy, deliver to the iPhone (or straight to iCloud), clean up.
@MainActor
@Observable
final class WatchModel {
    static let shared = WatchModel()

    struct LocalRecording: Identifiable, Hashable {
        var audioURL: URL
        var metadata: RecordingMetadata
        var deliveredAt: Date?
        var id: UUID { metadata.id }
    }

    let recorder = Recorder()
    private(set) var recordings: [LocalRecording] = []
    private(set) var isPhoneReachable = false
    private(set) var isSaving = false
    var errorMessage: String?

    private var delivered: [String: Date] {
        get { (UserDefaults.standard.dictionary(forKey: "delivered") as? [String: Date]) ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: "delivered") }
    }

    private var root: URL { RecordingPaths.localRoot.appendingPathComponent(RecordingPaths.recordingsFolder, isDirectory: true) }

    private init() {
        AppSettings.register()
        WatchSync.shared.onDelivered = { [weak self] id in self?.markDelivered(id) }
        WatchSync.shared.onReachabilityChanged = { [weak self] reachable in
            self?.isPhoneReachable = reachable
            if reachable { self?.deliverPending() }
        }
        WatchSync.shared.activate()
        reload()
        cleanUpDelivered()
        Task { await recoverInterruptedRecordings() }
    }

    // MARK: Recording

    func start() async {
        guard !recorder.isActive else { return }
        do {
            try await recorder.start(quality: .standard, enhancedVoice: false)
            WKInterfaceDevice.current().play(.start)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func stop() async {
        guard let finished = recorder.stop() else { return }
        WKInterfaceDevice.current().play(.stop)
        await save(finished)
    }

    /// Encode to AAC (small enough to send quickly), keep a local copy, and queue delivery.
    /// The raw capture is only deleted once the encoded copy is safely stored.
    private func save(_ finished: Recorder.Finished) async {
        isSaving = true
        defer { isSaving = false }
        let encoded = (try? await AudioFinalizer.encode(finished.audioURL, quality: finished.quality)) ?? finished.audioURL
        let destination = RecordingPaths.newAudioURL(in: root, date: finished.metadata.createdAt, fileExtension: encoded.pathExtension)
        do {
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            if encoded == finished.audioURL {
                try FileManager.default.copyItem(at: encoded, to: destination)
            } else {
                try FileManager.default.moveItem(at: encoded, to: destination)
            }
            try MetadataIO.encoder.encode(finished.metadata).write(to: RecordingPaths.metadataURL(forAudio: destination))
            Recorder.removeCapture(finished.audioURL)
        } catch {
            errorMessage = "Couldn't save yet: \(error.localizedDescription). It will be retried."
            return
        }
        reload()
        deliver(LocalRecording(audioURL: destination, metadata: finished.metadata))
    }

    private func recoverInterruptedRecordings() async {
        guard !recorder.isActive else { return }
        let orphans = recorder.orphanedCaptures()
        for orphan in orphans { await save(orphan) }
        if !orphans.isEmpty {
            errorMessage = "Recovered \(orphans.count) interrupted recording\(orphans.count == 1 ? "" : "s")."
        }
    }

    /// Action Button / double tap / Shortcut: start, or (while recording) bookmark unless set to stop.
    func handleShortcutPress() async {
        guard recorder.isActive else { return await start() }
        switch AppSettings.shortcutWhileRecording {
        case .bookmark: bookmark()
        case .stop: await stop()
        }
    }

    func bookmark() {
        recorder.addBookmark()
        WKInterfaceDevice.current().play(.click)
    }

    // MARK: Delivery

    func deliver(_ recording: LocalRecording) {
        guard recording.deliveredAt == nil else { return }
        // Always queue for the iPhone; the system delivers it whenever the phone is around.
        WatchSync.shared.send(audioAt: recording.audioURL, metadata: recording.metadata)
        // If the phone isn't reachable right now, also try iCloud directly (Wi-Fi / LTE).
        if !WatchSync.shared.isCounterpartReachable,
           UserDefaults.standard.bool(forKey: AppSettings.Key.watchDirectUpload) {
            Task {
                guard await CloudInbox.isAvailable() else { return }
                do {
                    try await CloudInbox.upload(audioAt: recording.audioURL, metadata: recording.metadata)
                    WatchSync.shared.cancelTransfer(for: recording.id)
                    markDelivered(recording.id)
                } catch {
                    // The WatchConnectivity transfer is still queued, so nothing is lost.
                }
            }
        }
    }

    func deliverPending() {
        recordings.filter { $0.deliveredAt == nil }.forEach(deliver)
    }

    private func markDelivered(_ id: UUID) {
        var map = delivered
        map[id.uuidString] = .now
        delivered = map
        reload()
    }

    func delete(_ recording: LocalRecording) {
        WatchSync.shared.cancelTransfer(for: recording.id)
        try? FileManager.default.removeItem(at: recording.audioURL)
        try? FileManager.default.removeItem(at: RecordingPaths.metadataURL(forAudio: recording.audioURL))
        reload()
    }

    // MARK: Storage

    func reload() {
        let delivered = delivered
        let files = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil)?
            .compactMap { $0 as? URL }.filter(RecordingPaths.isAudioFile) ?? []
        recordings = files.compactMap { url in
            guard let data = try? Data(contentsOf: RecordingPaths.metadataURL(forAudio: url)),
                  let metadata = try? MetadataIO.decoder.decode(RecordingMetadata.self, from: data) else { return nil }
            return LocalRecording(audioURL: url, metadata: metadata, deliveredAt: delivered[metadata.id.uuidString])
        }
        .sorted { $0.metadata.createdAt > $1.metadata.createdAt }
    }

    /// Watch storage is small: delivered recordings are removed after the number of days in settings.
    private func cleanUpDelivered() {
        let days = UserDefaults.standard.integer(forKey: AppSettings.Key.watchKeepDays)
        let cutoff = Calendar.current.date(byAdding: .day, value: -max(days, 1), to: .now) ?? .now
        for recording in recordings where (recording.deliveredAt ?? .distantFuture) < cutoff {
            try? FileManager.default.removeItem(at: recording.audioURL)
            try? FileManager.default.removeItem(at: RecordingPaths.metadataURL(forAudio: recording.audioURL))
        }
        reload()
    }
}
