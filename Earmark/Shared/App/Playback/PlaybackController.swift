import AVFoundation
import Observation

/// Plays one recording at a time, with speed control (0.5×–3×) and Voice Memos–style Skip Silence.
@MainActor
@Observable
final class PlaybackController {
    static let rates: [Float] = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]

    private(set) var itemID: UUID?
    private(set) var isPlaying = false
    private(set) var currentTime: TimeInterval = 0
    private(set) var duration: TimeInterval = 0
    private(set) var waveform: Waveform = .empty

    var rate: Float = Float(UserDefaults.standard.double(forKey: AppSettings.Key.playbackRate)) {
        didSet {
            UserDefaults.standard.set(Double(rate), forKey: AppSettings.Key.playbackRate)
            if isPlaying { player.rate = rate }
        }
    }

    var skipSilence: Bool = UserDefaults.standard.bool(forKey: AppSettings.Key.skipSilence) {
        didSet { UserDefaults.standard.set(skipSilence, forKey: AppSettings.Key.skipSilence) }
    }

    @ObservationIgnored private let player = AVPlayer()
    @ObservationIgnored private var timeObserver: Any?
    @ObservationIgnored private var endObserver: NSObjectProtocol?
    @ObservationIgnored private var waveformTask: Task<Void, Never>?

    init() {
        if rate <= 0 { rate = 1 }
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.05, preferredTimescale: 600), queue: .main) { [weak self] time in
            MainActor.assumeIsolated { self?.tick(time.seconds) }
        }
    }

    func load(_ item: RecordingItem) {
        guard item.id != itemID else { return }
        stop()
        itemID = item.id
        duration = item.metadata.duration
        currentTime = 0
        waveform = .empty
        let playerItem = AVPlayerItem(url: item.audioURL)
        playerItem.audioTimePitchAlgorithm = .timeDomain // keeps voices natural at higher speeds
        player.replaceCurrentItem(with: playerItem)

        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = NotificationCenter.default.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: playerItem, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.isPlaying = false
                self?.seek(to: 0)
            }
        }

        waveformTask?.cancel()
        let url = item.audioURL
        waveformTask = Task { [weak self] in
            guard let waveform = try? await WaveformAnalyzer.analyze(url) else { return }
            guard !Task.isCancelled else { return }
            self?.waveform = waveform
            if waveform.duration > 0 { self?.duration = waveform.duration }
        }
    }

    func play() {
        guard player.currentItem != nil else { return }
        activateSession()
        player.playImmediately(atRate: rate)
        isPlaying = true
    }

    func pause() {
        player.pause()
        isPlaying = false
    }

    func togglePlay() { isPlaying ? pause() : play() }

    func stop() {
        pause()
        player.replaceCurrentItem(with: nil)
        itemID = nil
    }

    func seek(to time: TimeInterval) {
        let clamped = max(0, min(time, duration))
        currentTime = clamped
        player.seek(to: CMTime(seconds: clamped, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    func skip(by seconds: TimeInterval) { seek(to: currentTime + seconds) }

    /// Jump to a moment and start playing (tapping a transcript line or bookmark).
    func play(from time: TimeInterval) {
        seek(to: time)
        play()
    }

    private func tick(_ time: TimeInterval) {
        guard time.isFinite else { return }
        currentTime = time
        guard isPlaying, skipSilence else { return }
        if let silence = waveform.silentRanges.first(where: { $0.contains(time) }) {
            seek(to: silence.upperBound)
        }
    }

    private func activateSession() {
        #if os(iOS)
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio)
        try? session.setActive(true)
        #endif
    }
}
