#if os(iOS) || os(watchOS)
import Foundation
import WatchConnectivity

/// Moves Watch recordings to the iPhone, Just Press Record–style.
///
/// `transferFile` is queued by the system and keeps going while either app is suspended,
/// so a recording made on a run is delivered once the iPhone is back in range.
final class WatchSync: NSObject, WCSessionDelegate, @unchecked Sendable {
    static let shared = WatchSync()

    private static let metadataKey = "metadata"

    /// iPhone: a recording arrived from the Watch and was saved to the inbox folder.
    var onInboxChanged: (@MainActor () -> Void)?
    /// Watch: a recording reached the iPhone.
    var onDelivered: (@MainActor (UUID) -> Void)?
    /// Either side: reachability changed.
    var onReachabilityChanged: (@MainActor (Bool) -> Void)?

    var isSupported: Bool { WCSession.isSupported() }

    var isCounterpartReachable: Bool {
        guard WCSession.isSupported() else { return false }
        return WCSession.default.activationState == .activated && WCSession.default.isReachable
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    // MARK: Watch → iPhone

    #if os(watchOS)
    /// Queue a recording for delivery. Safe to call repeatedly; already-queued files aren't duplicated.
    func send(audioAt url: URL, metadata: RecordingMetadata) {
        guard WCSession.isSupported(), let data = try? MetadataIO.encoder.encode(metadata) else { return }
        let alreadyQueued = WCSession.default.outstandingFileTransfers.contains {
            ($0.file.metadata?["id"] as? String) == metadata.id.uuidString
        }
        guard !alreadyQueued else { return }
        WCSession.default.transferFile(url, metadata: [Self.metadataKey: data, "id": metadata.id.uuidString])
    }

    func cancelTransfer(for id: UUID) {
        for transfer in WCSession.default.outstandingFileTransfers where (transfer.file.metadata?["id"] as? String) == id.uuidString {
            transfer.cancel()
        }
    }

    func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
        guard error == nil,
              let idString = fileTransfer.file.metadata?["id"] as? String,
              let id = UUID(uuidString: idString) else { return }
        Task { @MainActor in self.onDelivered?(id) }
    }
    #endif

    // MARK: iPhone side

    #if os(iOS)
    /// Recordings received from the Watch wait here until the library has taken them.
    static var inboxFolder: URL {
        let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("WatchInbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        // The system deletes `file.fileURL` when this method returns, so move it synchronously.
        guard let data = file.metadata?[Self.metadataKey] as? Data,
              let metadata = try? MetadataIO.decoder.decode(RecordingMetadata.self, from: data) else { return }
        let ext = file.fileURL.pathExtension.isEmpty ? "m4a" : file.fileURL.pathExtension
        let audio = Self.inboxFolder.appendingPathComponent(metadata.id.uuidString).appendingPathExtension(ext)
        let sidecar = Self.inboxFolder.appendingPathComponent(metadata.id.uuidString).appendingPathExtension("json")
        do {
            try? FileManager.default.removeItem(at: audio)
            try FileManager.default.moveItem(at: file.fileURL, to: audio)
            try data.write(to: sidecar, options: .atomic)
        } catch {
            return
        }
        Task { @MainActor in self.onInboxChanged?() }
    }

    /// Everything waiting in the inbox, oldest first.
    static func pendingInboxItems() -> [(audio: URL, metadata: RecordingMetadata)] {
        let files = (try? FileManager.default.contentsOfDirectory(at: inboxFolder, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }.compactMap { sidecar in
            guard let data = try? Data(contentsOf: sidecar),
                  let metadata = try? MetadataIO.decoder.decode(RecordingMetadata.self, from: data),
                  let audio = files.first(where: { $0.deletingPathExtension().lastPathComponent == metadata.id.uuidString && $0.pathExtension != "json" })
            else { return nil }
            return (audio, metadata)
        }.sorted { $0.metadata.createdAt < $1.metadata.createdAt }
    }

    static func removeFromInbox(_ id: UUID) {
        let files = (try? FileManager.default.contentsOfDirectory(at: inboxFolder, includingPropertiesForKeys: nil)) ?? []
        for file in files where file.deletingPathExtension().lastPathComponent == id.uuidString {
            try? FileManager.default.removeItem(at: file)
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        // Switching to a different Watch: reactivate for the new one.
        WCSession.default.activate()
    }
    #endif

    // MARK: Common

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        let reachable = session.isReachable
        Task { @MainActor in self.onReachabilityChanged?(reachable) }
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        let reachable = session.isReachable
        Task { @MainActor in self.onReachabilityChanged?(reachable) }
    }
}
#endif
