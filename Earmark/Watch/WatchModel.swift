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

    func stop() {
        guard let finished = recorder.stop() else { return }
        WKInterfaceDevice.current().play(.stop)
        let destination = RecordingPaths.newAudioURL(in: root, date: finished.metadata.createdAt, fileExtension: finished.audioURL.pathExtension)
        do {
            try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            try FileManager.default.moveItem(at: finished.audioURL, to: destination)
            try MetadataIO.encoder.encode(finished.metadata).write(to: RecordingPaths.metadataURL(forAudio: destination))
        } catch {
            errorMessage = "Couldn't save: \(error.localizedDescription)"
            return
        }
        reload()
        deliver(LocalRecording(audioURL: destination, metadata: finished.metadata))
    }

    func toggle() async {
        if recorder.isActive { stop() } else { await start() }
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
