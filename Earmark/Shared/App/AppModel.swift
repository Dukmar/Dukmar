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
    /// Recordings being encoded and saved after stopping.
    private(set) var savingCount = 0
    /// Set when a stop needs confirming (protection mode "Tap, then confirm" from a menu or shortcut).
    var stopConfirmationPending = false

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
        await recoverInterruptedRecordings()
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
        await recoverInterruptedRecordings()
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

    /// The Action Button, a Shortcut toggle or the Mac hotkey. While recording, it adds a bookmark by default
    /// so a second press can't end a recording by accident.
    func handleShortcutPress() async {
        guard recorder.isActive else { return await startRecording() }
        switch AppSettings.shortcutWhileRecording {
        case .bookmark: addBookmark()
        case .stop: await stopRecording()
        }
    }

    /// A stop that came from a menu command or keyboard shortcut. Honors the stop-protection setting;
    /// on-screen stop buttons use `ProtectedStopButton` and call `stopRecording()` directly.
    func requestStop() async {
        guard recorder.isActive else { return }
        if AppSettings.stopProtection == .tap {
            await stopRecording()
        } else {
            stopConfirmationPending = true
        }
    }

    @discardableResult
    func stopRecording() async -> RecordingItem? {
        stopConfirmationPending = false
        recorder.bufferHandler = nil
        guard let finished = recorder.stop() else { return nil }
        await liveTranscriber.stop()
        let item = await save(finished)
        if let item {
            lastFinishedID = item.id
            processing.enqueue(item.id, front: true)
        }
        return item
    }

    /// Encodes a capture into its final format and moves it into the library. The capture (and its
    /// checkpoint) is deleted only after that succeeds, so a failure here never loses audio.
    private func save(_ finished: Recorder.Finished) async -> RecordingItem? {
        savingCount += 1
        defer { savingCount -= 1 }
        do {
            let encoded: URL
            do {
                encoded = try await AudioFinalizer.encode(finished.audioURL, quality: finished.quality)
            } catch {
                // Couldn't encode: keep the raw capture rather than nothing.
                let copy = FileManager.default.temporaryDirectory.appendingPathComponent(finished.audioURL.lastPathComponent)
                try? FileManager.default.removeItem(at: copy)
                try FileManager.default.copyItem(at: finished.audioURL, to: copy)
                encoded = copy
            }
            let item = try await library.add(audioAt: encoded, metadata: finished.metadata)
            Recorder.removeCapture(finished.audioURL)
            return item
        } catch {
            errorMessage = "Couldn't save the recording yet: \(error.localizedDescription). It's kept safe and will be retried next time Earmark opens."
            return nil
        }
    }

    /// Recordings cut short by a crash, force quit or dead battery are saved on the next launch.
    func recoverInterruptedRecordings() async {
        guard !recorder.isActive else { return }
        let orphans = recorder.orphanedCaptures()
        guard !orphans.isEmpty else { return }
        var recovered = 0
        for orphan in orphans {
            if await save(orphan) != nil { recovered += 1 }
        }
        if recovered > 0 {
            errorMessage = recovered == 1
                ? "Earmark recovered a recording that was interrupted. It's in your library, tagged #recovered."
                : "Earmark recovered \(recovered) recordings that were interrupted. They're in your library, tagged #recovered."
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
        case "stop": await requestStop()
        case "toggle": await handleShortcutPress()
        case "open":
            if let id = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "id" })?.value.flatMap(UUID.init) {
                selectedID = id
            }
        default: break
        }
    }
}
