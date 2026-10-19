import Foundation
import Observation

/// Transcribes and summarizes recordings one at a time, in the background.
/// Picks up anything that arrives without a transcript: new recordings, Watch recordings,
/// files dropped into iCloud Drive, and imports from Just Press Record.
@MainActor
@Observable
final class ProcessingQueue {
    private(set) var currentID: UUID?
    private(set) var pendingCount = 0

    @ObservationIgnored private let library: RecordingLibrary
    @ObservationIgnored private var worker: Task<Void, Never>?
    @ObservationIgnored private var queue: [UUID] = []
    @ObservationIgnored var onProcessed: ((RecordingItem) -> Void)?

    init(library: RecordingLibrary) {
        self.library = library
    }

    /// Queue everything that still needs work.
    func scan() {
        let defaults = UserDefaults.standard
        let autoTranscribe = defaults.bool(forKey: AppSettings.Key.autoTranscribe)
        let autoInsights = defaults.bool(forKey: AppSettings.Key.autoInsights) && InsightsGenerator.isAvailable
        for item in library.items {
            let m = item.metadata
            let needsTranscript = autoTranscribe && (m.transcriptionState == .pending || m.transcriptionState == .inProgress)
            let needsInsights = autoInsights && m.transcript != nil && m.insights == nil && !(m.transcript?.fullText.isEmpty ?? true)
            if needsTranscript || needsInsights { enqueue(item.id) }
        }
    }

    func enqueue(_ id: UUID, front: Bool = false) {
        guard id != currentID, !queue.contains(id) else { return }
        front ? queue.insert(id, at: 0) : queue.append(id)
        pendingCount = queue.count
        startIfNeeded()
    }

    /// Re-run transcription (for example, after changing the language).
    func retranscribe(_ id: UUID) {
        library.update(id) {
            $0.transcriptionState = .pending
            $0.transcript = nil
            $0.insights = nil
        }
        enqueue(id, front: true)
    }

    func regenerateInsights(_ id: UUID) {
        library.update(id) { $0.insights = nil }
        enqueue(id, front: true)
    }

    private func startIfNeeded() {
        guard worker == nil else { return }
        worker = Task { [weak self] in
            while let self, let next = self.dequeue() {
                await self.process(next)
            }
            self?.worker = nil
            self?.currentID = nil
        }
    }

    private func dequeue() -> UUID? {
        guard !queue.isEmpty else { return nil }
        let id = queue.removeFirst()
        pendingCount = queue.count
        currentID = id
        return id
    }

    private func process(_ id: UUID) async {
        guard var item = library.items.first(where: { $0.id == id }) else { return }

        if item.metadata.transcript == nil, item.metadata.transcriptionState != .skipped {
            guard item.isDownloaded else {
                // Ask iCloud for the audio; the library reloads when it lands and `scan()` re-queues it.
                library.ensureDownloaded(item)
                return
            }
            library.update(id) { $0.transcriptionState = .inProgress }
            do {
                let transcript = try await Transcriber.transcribe(fileAt: item.audioURL, locale: AppSettings.transcriptionLocale)
                item = library.update(id) {
                    $0.transcript = transcript
                    $0.transcriptionState = .done
                    $0.transcriptionError = nil
                } ?? item
            } catch {
                library.update(id) {
                    $0.transcriptionState = .failed
                    $0.transcriptionError = error.localizedDescription
                }
                return
            }
        }

        let wantsInsights = UserDefaults.standard.bool(forKey: AppSettings.Key.autoInsights)
        if wantsInsights, InsightsGenerator.isAvailable, item.metadata.insights == nil,
           let text = item.metadata.transcript?.fullText, text.split(separator: " ").count >= 12 {
            if let generated = try? await InsightsGenerator.generate(for: text) {
                item = library.update(id) {
                    $0.insights = generated.insights
                    // Only fill in a title if the user hasn't given one.
                    if ($0.title ?? "").isEmpty { $0.title = generated.insights.suggestedTitle }
                    for tag in generated.tags where !$0.tags.contains(tag) { $0.tags.append(tag) }
                } ?? item
            }
        }
        onProcessed?(item)
    }
}
