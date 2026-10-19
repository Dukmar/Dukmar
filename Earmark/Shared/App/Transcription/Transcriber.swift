import AVFoundation
import Speech

/// On-device transcription with Apple's SpeechAnalyzer (iOS 26 / macOS 26).
/// The long-form `SpeechTranscriber` model handles hour-long recordings and far-away speakers,
/// runs offline, and gives word timings so the transcript can drive playback.
enum Transcriber {
    enum TranscriberError: LocalizedError {
        case unavailable
        case unsupportedLocale(Locale)

        var errorDescription: String? {
            switch self {
            case .unavailable: return "On-device transcription isn't available on this device."
            case .unsupportedLocale(let locale):
                return "Transcription doesn't support \(locale.localizedString(forIdentifier: locale.identifier) ?? locale.identifier) yet."
            }
        }
    }

    static func makeTranscriber(locale: Locale, live: Bool) async throws -> (SpeechTranscriber, Locale) {
        guard SpeechTranscriber.isAvailable else { throw TranscriberError.unavailable }
        guard let supported = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else {
            throw TranscriberError.unsupportedLocale(locale)
        }
        let transcriber = SpeechTranscriber(
            locale: supported,
            transcriptionOptions: [],
            reportingOptions: live ? [.volatileResults] : [],
            attributeOptions: [.audioTimeRange]
        )
        // The speech model is downloaded and managed by the system; fetch it the first time.
        if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
            try await request.downloadAndInstall()
        }
        return (transcriber, supported)
    }

    /// Transcribes an audio file into timed segments (roughly one per sentence).
    static func transcribe(fileAt url: URL, locale: Locale) async throws -> Transcript {
        let (transcriber, supportedLocale) = try await makeTranscriber(locale: locale, live: false)
        let analyzer = SpeechAnalyzer(modules: [transcriber])
        let audioFile = try AVAudioFile(forReading: url)

        // Start listening for results before feeding audio in.
        let collector = Task { () throws -> [TranscriptSegment] in
            var segments: [TranscriptSegment] = []
            for try await result in transcriber.results where result.isFinal {
                segments.append(contentsOf: segmentsFrom(result.text, fallbackRange: result.range))
            }
            return segments
        }

        do {
            if let lastSample = try await analyzer.analyzeSequence(from: audioFile) {
                try await analyzer.finalizeAndFinish(through: lastSample)
            } else {
                await analyzer.cancelAndFinishNow()
            }
        } catch {
            collector.cancel()
            throw error
        }
        let segments = try await collector.value
        return Transcript(segments: merge(segments), localeIdentifier: supportedLocale.identifier, createdAt: .now)
    }

    /// Splits a result into sentence-sized segments using the per-run audio time ranges.
    static func segmentsFrom(_ text: AttributedString, fallbackRange: CMTimeRange) -> [TranscriptSegment] {
        var segments: [TranscriptSegment] = []
        var current = ""
        var start: Double?
        var end = fallbackRange.start.seconds

        func appendSegment() {
            let clean = current.trimmingCharacters(in: .whitespacesAndNewlines)
            defer { current = ""; start = nil }
            guard !clean.isEmpty else { return }
            let s = start ?? fallbackRange.start.seconds
            segments.append(TranscriptSegment(start: s, end: max(end, s), text: clean))
        }

        for run in text.runs {
            let piece = String(text[run.range].characters)
            if let range = run.audioTimeRange {
                if start == nil { start = range.start.seconds }
                end = range.end.seconds
            }
            current += piece
            let trimmed = piece.trimmingCharacters(in: .whitespaces)
            if let last = trimmed.last, ".?!".contains(last) {
                appendSegment()
            }
        }
        appendSegment()
        return segments
    }

    /// Joins tiny fragments ("Yes.", "OK.") into their neighbours so the transcript reads in paragraphs-ish chunks.
    static func merge(_ segments: [TranscriptSegment], minimumWords: Int = 4) -> [TranscriptSegment] {
        var merged: [TranscriptSegment] = []
        for segment in segments.sorted(by: { $0.start < $1.start }) {
            if var last = merged.last,
               last.text.split(separator: " ").count < minimumWords,
               segment.start - last.end < 1.5 {
                last.text += " " + segment.text
                last.end = segment.end
                merged[merged.count - 1] = last
            } else {
                merged.append(segment)
            }
        }
        return merged
    }
}

/// Live captions while recording. Fed by `Recorder.bufferHandler`.
@MainActor
@Observable
final class LiveTranscriber {
    private(set) var finalizedText = ""
    private(set) var volatileText = ""
    private(set) var isRunning = false

    @ObservationIgnored private var analyzer: SpeechAnalyzer?
    @ObservationIgnored private var inputContinuation: AsyncStream<AnalyzerInput>.Continuation?
    @ObservationIgnored private var resultsTask: Task<Void, Never>?
    @ObservationIgnored private let feeder = BufferFeeder()

    var text: String { (finalizedText + " " + volatileText).trimmingCharacters(in: .whitespaces) }

    func start(locale: Locale) async {
        guard !isRunning else { return }
        do {
            let (transcriber, _) = try await Transcriber.makeTranscriber(locale: locale, live: true)
            let analyzer = SpeechAnalyzer(modules: [transcriber])
            guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber]) else { return }
            let (stream, continuation) = AsyncStream.makeStream(of: AnalyzerInput.self)
            feeder.configure(targetFormat: format, continuation: continuation)
            try await analyzer.start(inputSequence: stream)
            self.analyzer = analyzer
            inputContinuation = continuation
            finalizedText = ""
            volatileText = ""
            isRunning = true

            resultsTask = Task { [weak self] in
                do {
                    for try await result in transcriber.results {
                        let text = String(result.text.characters)
                        guard let self else { return }
                        if result.isFinal {
                            self.finalizedText += (self.finalizedText.isEmpty ? "" : " ") + text.trimmingCharacters(in: .whitespaces)
                            self.volatileText = ""
                        } else {
                            self.volatileText = text
                        }
                    }
                } catch {
                    // Live captions are a nicety; the full transcript is made from the file afterwards.
                }
            }
        } catch {
            isRunning = false
        }
    }

    /// Hand this to `Recorder.bufferHandler`. Safe to call from the audio thread.
    nonisolated func append(_ buffer: AVAudioPCMBuffer) {
        feeder.feed(buffer)
    }

    func stop() async {
        guard isRunning else { return }
        isRunning = false
        feeder.reset()
        inputContinuation?.finish()
        try? await analyzer?.finalizeAndFinishThroughEndOfInput()
        resultsTask?.cancel()
        analyzer = nil
        inputContinuation = nil
    }
}

/// Converts microphone buffers to the analyzer's preferred format on the audio thread.
private final class BufferFeeder: @unchecked Sendable {
    private let lock = NSLock()
    private var converter: AVAudioConverter?
    private var targetFormat: AVAudioFormat?
    private var continuation: AsyncStream<AnalyzerInput>.Continuation?

    func configure(targetFormat: AVAudioFormat, continuation: AsyncStream<AnalyzerInput>.Continuation) {
        lock.lock(); defer { lock.unlock() }
        self.targetFormat = targetFormat
        self.continuation = continuation
        converter = nil
    }

    func reset() {
        lock.lock(); defer { lock.unlock() }
        continuation = nil
        converter = nil
    }

    func feed(_ buffer: AVAudioPCMBuffer) {
        lock.lock(); defer { lock.unlock() }
        guard let continuation, let targetFormat else { return }
        if buffer.format == targetFormat {
            continuation.yield(AnalyzerInput(buffer: buffer))
            return
        }
        if converter == nil || converter?.inputFormat != buffer.format {
            converter = AVAudioConverter(from: buffer.format, to: targetFormat)
            converter?.primeMethod = .none
        }
        guard let converter else { return }
        let ratio = targetFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up))
        guard let output = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity) else { return }
        var consumed = false
        var error: NSError?
        converter.convert(to: output, error: &error) { _, status in
            if consumed {
                status.pointee = .noDataNow
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return buffer
        }
        if error == nil, output.frameLength > 0 {
            continuation.yield(AnalyzerInput(buffer: output))
        }
    }
}
