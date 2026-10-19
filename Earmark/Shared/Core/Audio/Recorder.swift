import AVFoundation
import Observation

/// Records audio on iPhone, Watch and Mac.
///
/// - iPhone/Mac use `AVAudioEngine`, so the live audio can also feed the live transcriber
///   and "Enhanced voice" (Apple's voice processing: noise and echo reduction) can be switched on.
/// - Watch uses `AVAudioRecorder`, which is the most reliable way to keep recording with the wrist down.
///
/// Audio is written to a temporary folder and handed to the library when the recording stops.
@MainActor
@Observable
final class Recorder {
    enum State: Equatable { case idle, recording, paused }

    enum RecorderError: LocalizedError {
        case microphoneDenied
        case alreadyRecording
        var errorDescription: String? {
            switch self {
            case .microphoneDenied: return "Earmark needs microphone access. You can turn it on in Settings."
            case .alreadyRecording: return "A recording is already in progress."
            }
        }
    }

    /// A finished (or recovered) capture: 16-bit PCM CAF in the in-progress folder, still to be encoded
    /// into `quality`'s final format with `AudioFinalizer`.
    struct Finished: Sendable {
        var audioURL: URL
        var metadata: RecordingMetadata
        var quality: RecordingQuality
    }

    private(set) var state: State = .idle
    private(set) var metadata: RecordingMetadata?
    private(set) var level: Float = 0
    /// Recent levels, newest last, for the scrolling waveform while recording.
    private(set) var levelHistory: [Float] = []
    private(set) var lastError: Error?

    /// Gets every captured buffer (on a background thread). Used for live transcription.
    @ObservationIgnored nonisolated(unsafe) var bufferHandler: (@Sendable (AVAudioPCMBuffer) -> Void)?
    /// Fires on state changes, so Live Activities, the Watch UI and intents can follow along.
    @ObservationIgnored var onStateChange: ((State) -> Void)?

    @ObservationIgnored private var accumulated: TimeInterval = 0
    @ObservationIgnored private var segmentStart: Date?
    @ObservationIgnored private var fileURL: URL?
    @ObservationIgnored private var quality: RecordingQuality = .standard
    @ObservationIgnored private var meterTimer: Timer?
    @ObservationIgnored private var meterTicks = 0
    @ObservationIgnored private var observers: [NSObjectProtocol] = []
    @ObservationIgnored private var resumeAfterInterruption = false

    #if os(watchOS)
    @ObservationIgnored private var recorder: AVAudioRecorder?
    #else
    @ObservationIgnored private let engine = AVAudioEngine()
    @ObservationIgnored private var writer: CaptureWriter?
    #endif

    var isActive: Bool { state != .idle }

    var elapsed: TimeInterval {
        accumulated + (segmentStart.map { Date.now.timeIntervalSince($0) } ?? 0)
    }

    var bookmarks: [Bookmark] { metadata?.bookmarks ?? [] }

    // MARK: - Control

    func start(quality: RecordingQuality = AppSettings.quality,
               enhancedVoice: Bool = UserDefaults.standard.bool(forKey: AppSettings.Key.enhancedVoice)) async throws {
        guard state == .idle else { throw RecorderError.alreadyRecording }
        guard await Self.requestMicrophoneAccess() else { throw RecorderError.microphoneDenied }

        let now = Date.now
        let url = RecordingPaths.inProgressFolder
            .appendingPathComponent(RecordingPaths.baseFileName(for: now))
            .appendingPathExtension(RecordingQuality.captureExtension)
        try? FileManager.default.removeItem(at: url)

        try configureSession()
        #if os(watchOS)
        let recorder = try AVAudioRecorder(url: url, settings: quality.captureSettings)
        recorder.isMeteringEnabled = true
        guard recorder.record() else { throw CocoaError(.fileWriteUnknown) }
        self.recorder = recorder
        #else
        try startEngine(writingTo: url, quality: quality, enhancedVoice: enhancedVoice)
        #endif

        fileURL = url
        self.quality = quality
        metadata = RecordingMetadata(createdAt: now)
        accumulated = 0
        segmentStart = now
        levelHistory = []
        lastError = nil
        startMetering()
        observeInterruptions()
        setState(.recording)
        checkpoint()
    }

    func pause() {
        guard state == .recording else { return }
        #if os(watchOS)
        recorder?.pause()
        #else
        engine.pause()
        #endif
        if let segmentStart { accumulated += Date.now.timeIntervalSince(segmentStart) }
        segmentStart = nil
        level = 0
        setState(.paused)
        checkpoint()
        PauseReminder.schedule()
    }

    func resume() {
        guard state == .paused else { return }
        do {
            try configureSession()
            #if os(watchOS)
            recorder?.record()
            #else
            try engine.start()
            #endif
            segmentStart = .now
            setState(.recording)
            PauseReminder.cancel()
        } catch {
            lastError = error
        }
    }

    func togglePause() {
        state == .recording ? pause() : resume()
    }

    /// Flags the current moment. With a note, it becomes a timestamped note (Noted-style "TimeTag").
    @discardableResult
    func addBookmark(note: String? = nil) -> Bookmark? {
        guard isActive else { return nil }
        let bookmark = Bookmark(time: elapsed, note: note)
        metadata?.bookmarks.append(bookmark)
        checkpoint()
        return bookmark
    }

    func updateMetadata(_ change: (inout RecordingMetadata) -> Void) {
        guard metadata != nil else { return }
        change(&metadata!)
        checkpoint()
    }

    @discardableResult
    func stop() -> Finished? {
        guard state != .idle, let fileURL, var metadata else { return nil }
        let duration = elapsed
        #if os(watchOS)
        recorder?.stop()
        recorder = nil
        #else
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        writer?.close()
        writer = nil
        #endif
        meterTimer?.invalidate()
        meterTimer = nil
        observers.forEach(NotificationCenter.default.removeObserver)
        observers = []
        deactivateSession()
        PauseReminder.cancel()

        metadata.duration = duration
        // Keep the final checkpoint until the caller has saved the recording: if the app dies while
        // encoding, recovery still has the bookmarks and notes.
        Self.writeCheckpoint(metadata, quality: quality, for: fileURL)
        self.fileURL = nil
        self.metadata = nil
        accumulated = 0
        segmentStart = nil
        level = 0
        setState(.idle)
        return Finished(audioURL: fileURL, metadata: metadata, quality: quality)
    }

    /// Stop and throw the audio away.
    func discard() {
        if let finished = stop() { Self.removeCapture(finished.audioURL) }
    }

    // MARK: - Crash safety

    private struct Checkpoint: Codable {
        var metadata: RecordingMetadata
        var quality: String
    }

    private func checkpoint() {
        guard let fileURL, var metadata else { return }
        metadata.duration = elapsed
        Self.writeCheckpoint(metadata, quality: quality, for: fileURL)
    }

    nonisolated private static func writeCheckpoint(_ metadata: RecordingMetadata, quality: RecordingQuality, for audioURL: URL) {
        let checkpoint = Checkpoint(metadata: metadata, quality: quality.rawValue)
        guard let data = try? MetadataIO.encoder.encode(checkpoint) else { return }
        try? data.write(to: RecordingPaths.checkpointURL(forCapture: audioURL), options: .atomic)
    }

    /// Delete a capture and its checkpoint once the recording is safely saved (or deliberately discarded).
    nonisolated static func removeCapture(_ audioURL: URL) {
        try? FileManager.default.removeItem(at: audioURL)
        try? FileManager.default.removeItem(at: RecordingPaths.checkpointURL(forCapture: audioURL))
    }

    /// Captures left behind by a crash, force quit or dead battery. Excludes the one being recorded right now.
    func orphanedCaptures(excluding inFlight: Set<String> = []) -> [Finished] {
        let folder = RecordingPaths.inProgressFolder
        let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey])) ?? []
        var orphans: [Finished] = []
        let skip = inFlight.union([fileURL?.standardizedFileURL.path].compactMap { $0 })
        for file in files where RecordingPaths.isAudioFile(file) && !skip.contains(file.standardizedFileURL.path) {
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard size > 4096 else { Self.removeCapture(file); continue } // nothing usable was recorded
            let checkpointURL = RecordingPaths.checkpointURL(forCapture: file)
            let saved = (try? Data(contentsOf: checkpointURL)).flatMap { try? MetadataIO.decoder.decode(Checkpoint.self, from: $0) }
            var metadata = saved?.metadata
                ?? RecordingMetadata(createdAt: RecordingPaths.date(fromFileName: file.deletingPathExtension().lastPathComponent) ?? .now)
            if !metadata.tags.contains("recovered") { metadata.tags.append("recovered") }
            metadata.duration = 0 // measured again from the repaired file
            let quality = saved.flatMap { RecordingQuality(rawValue: $0.quality) } ?? AppSettings.quality
            orphans.append(Finished(audioURL: file, metadata: metadata, quality: quality))
        }
        // Checkpoints whose audio is already gone.
        for file in files where file.lastPathComponent.hasSuffix(".checkpoint.json") {
            let audio = file.deletingPathExtension().deletingPathExtension().appendingPathExtension(RecordingQuality.captureExtension)
            if !FileManager.default.fileExists(atPath: audio.path) { try? FileManager.default.removeItem(at: file) }
        }
        return orphans
    }

    private func setState(_ newState: State) {
        state = newState
        onStateChange?(newState)
    }

    // MARK: - Session

    private static func requestMicrophoneAccess() async -> Bool {
        #if os(macOS)
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .audio)
        default: return false
        }
        #else
        switch AVAudioApplication.shared.recordPermission {
        case .granted: return true
        case .undetermined: return await AVAudioApplication.requestRecordPermission()
        default: return false
        }
        #endif
    }

    private func configureSession() throws {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
        try session.setActive(true)
        #elseif os(watchOS)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .default)
        try session.setActive(true)
        #endif
    }

    private func deactivateSession() {
        #if !os(macOS)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        #endif
    }

    private func observeInterruptions() {
        #if !os(macOS)
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            let options = (note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt).map(AVAudioSession.InterruptionOptions.init)
            MainActor.assumeIsolated {
                guard let self else { return }
                switch type {
                case .began:
                    // A phone call or Siri took the mic. Pause, and pick up again afterwards.
                    self.resumeAfterInterruption = self.state == .recording
                    self.pause()
                case .ended:
                    if self.resumeAfterInterruption, options?.contains(.shouldResume) ?? true { self.resume() }
                    self.resumeAfterInterruption = false
                @unknown default:
                    break
                }
            }
        })
        #endif
        #if !os(watchOS)
        // Plugging in / unplugging a mic changes the input format; restart capture on the new route.
        observers.append(NotificationCenter.default.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.restartEngineAfterRouteChange() }
        })
        #endif
    }

    // MARK: - Metering

    private func startMetering() {
        meterTimer?.invalidate()
        meterTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.sampleLevel() }
        }
    }

    private func sampleLevel() {
        guard state == .recording else { return }
        meterTicks += 1
        if meterTicks % 200 == 0 { checkpoint() } // every 10 seconds
        #if os(watchOS)
        guard let recorder else { return }
        recorder.updateMeters()
        let db = recorder.averagePower(forChannel: 0)
        level = Self.normalize(db: db)
        #else
        level = writer?.currentLevel ?? 0
        #endif
        levelHistory.append(level)
        if levelHistory.count > 300 { levelHistory.removeFirst(levelHistory.count - 300) }
    }

    nonisolated static func normalize(db: Float) -> Float {
        guard db.isFinite else { return 0 }
        let floor: Float = -55
        return max(0, min(1, (db - floor) / -floor))
    }

    // MARK: - Engine (iPhone, Mac)

    #if !os(watchOS)
    private func startEngine(writingTo url: URL, quality: RecordingQuality, enhancedVoice: Bool) throws {
        let input = engine.inputNode
        if input.isVoiceProcessingEnabled != enhancedVoice {
            try? input.setVoiceProcessingEnabled(enhancedVoice)
        }
        let inputFormat = input.outputFormat(forBus: 0)
        let writer = try CaptureWriter(url: url, settings: quality.captureSettings, inputFormat: inputFormat)
        writer.bufferHandler = { [weak self] buffer in self?.bufferHandler?(buffer) }
        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { buffer, _ in
            writer.write(buffer)
        }
        engine.prepare()
        try engine.start()
        self.writer = writer
    }

    private func restartEngineAfterRouteChange() {
        guard state == .recording, let writer else { return }
        let input = engine.inputNode
        input.removeTap(onBus: 0)
        let format = input.outputFormat(forBus: 0)
        writer.updateInputFormat(format)
        input.installTap(onBus: 0, bufferSize: 4096, format: format) { buffer, _ in
            writer.write(buffer)
        }
        do { try engine.start() } catch { lastError = error; pause() }
    }
    #endif
}

#if !os(watchOS)
/// Converts tapped microphone buffers to the file's format and writes them. Runs on the audio thread.
final class CaptureWriter: @unchecked Sendable {
    private let lock = NSLock()
    private var file: AVAudioFile?
    private var converter: AVAudioConverter?
    private let processingFormat: AVAudioFormat
    private var _level: Float = 0
    var bufferHandler: (@Sendable (AVAudioPCMBuffer) -> Void)?

    init(url: URL, settings: [String: Any], inputFormat: AVAudioFormat) throws {
        let file = try AVAudioFile(forWriting: url, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
        self.file = file
        processingFormat = file.processingFormat
        updateInputFormat(inputFormat)
    }

    var currentLevel: Float {
        lock.lock(); defer { lock.unlock() }
        return _level
    }

    func updateInputFormat(_ format: AVAudioFormat) {
        lock.lock(); defer { lock.unlock() }
        converter = format == processingFormat ? nil : AVAudioConverter(from: format, to: processingFormat)
    }

    func write(_ buffer: AVAudioPCMBuffer) {
        bufferHandler?(buffer)
        lock.lock(); defer { lock.unlock() }
        _level = Self.rmsLevel(buffer)
        guard let file else { return }
        guard let converter else {
            try? file.write(from: buffer)
            return
        }
        let ratio = processingFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1024
        guard let output = AVAudioPCMBuffer(pcmFormat: processingFormat, frameCapacity: capacity) else { return }
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
        if error == nil, output.frameLength > 0 { try? file.write(from: output) }
    }

    func close() {
        lock.lock(); defer { lock.unlock() }
        file?.close()
        file = nil
    }

    private static func rmsLevel(_ buffer: AVAudioPCMBuffer) -> Float {
        guard let data = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        var sum: Float = 0
        let count = Int(buffer.frameLength)
        for i in 0..<count { sum += data[i] * data[i] }
        let rms = (sum / Float(count)).squareRoot()
        return Recorder.normalize(db: 20 * log10(max(rms, 0.000_001)))
    }
}
#endif
