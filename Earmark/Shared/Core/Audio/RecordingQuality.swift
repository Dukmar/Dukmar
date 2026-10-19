import AVFoundation

/// Format presets, Voice Record Pro–style. AAC keeps iCloud usage low; the others are for music or archiving.
enum RecordingQuality: String, CaseIterable, Identifiable, Sendable {
    case compact   // AAC 32 kHz mono, ~48 kbps: about 21 MB per hour
    case standard  // AAC 44.1 kHz mono, ~96 kbps: about 43 MB per hour
    case high      // AAC 48 kHz stereo, ~192 kbps
    case lossless  // Apple Lossless 48 kHz stereo
    case wav       // 16-bit PCM 48 kHz stereo

    var id: String { rawValue }

    var label: String {
        switch self {
        case .compact: return "Compact (AAC, smallest files)"
        case .standard: return "Standard (AAC, voice)"
        case .high: return "High (AAC stereo)"
        case .lossless: return "Lossless (ALAC)"
        case .wav: return "Uncompressed (WAV)"
        }
    }

    var fileExtension: String { self == .wav ? "wav" : "m4a" }

    var sampleRate: Double {
        switch self {
        case .compact: return 32_000
        case .standard: return 44_100
        case .high, .lossless, .wav: return 48_000
        }
    }

    var channels: Int {
        switch self {
        case .compact, .standard: return 1
        case .high, .lossless, .wav: return 2
        }
    }

    /// Settings for `AVAudioFile(forWriting:settings:)` and `AVAudioRecorder`.
    var fileSettings: [String: Any] {
        var settings: [String: Any] = [
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: channels,
        ]
        switch self {
        case .compact, .standard, .high:
            settings[AVFormatIDKey] = kAudioFormatMPEG4AAC
            settings[AVEncoderBitRateKey] = self == .compact ? 48_000 : (self == .standard ? 96_000 : 192_000)
            settings[AVEncoderAudioQualityKey] = AVAudioQuality.high.rawValue
        case .lossless:
            settings[AVFormatIDKey] = kAudioFormatAppleLossless
            settings[AVEncoderBitDepthHintKey] = 16
        case .wav:
            settings[AVFormatIDKey] = kAudioFormatLinearPCM
            settings[AVLinearPCMBitDepthKey] = 16
            settings[AVLinearPCMIsFloatKey] = false
            settings[AVLinearPCMIsBigEndianKey] = false
        }
        return settings
    }
}
