import Foundation

/// UserDefaults keys and defaults. Views read these with `@AppStorage(AppSettings.Key.x)`.
enum AppSettings {
    enum Key {
        static let useICloud = "useICloud"
        static let quality = "recordingQuality"
        static let enhancedVoice = "enhancedVoice"
        static let autoTranscribe = "autoTranscribe"
        static let liveTranscription = "liveTranscription"
        static let autoInsights = "autoInsights"
        static let tagLocation = "tagLocation"
        static let transcriptionLocale = "transcriptionLocale"
        static let playbackRate = "playbackRate"
        static let skipSilence = "skipSilence"
        static let watchDirectUpload = "watchDirectUpload"
        static let watchKeepDays = "watchKeepDays"
        static let macHotKeyEnabled = "macHotKeyEnabled"
        static let stopProtection = "stopProtection"
        static let lockScreenStop = "lockScreenStop"
        static let shortcutWhileRecording = "shortcutWhileRecording"
        static let pauseReminders = "pauseReminders"
    }

    static func register() {
        UserDefaults.standard.register(defaults: [
            Key.useICloud: true,
            Key.quality: RecordingQuality.standard.rawValue,
            Key.enhancedVoice: false,
            Key.autoTranscribe: true,
            Key.liveTranscription: true,
            Key.autoInsights: true,
            Key.tagLocation: false,
            Key.transcriptionLocale: "",
            Key.playbackRate: 1.0,
            Key.skipSilence: false,
            Key.watchDirectUpload: true,
            Key.watchKeepDays: 7,
            Key.macHotKeyEnabled: true,
            Key.stopProtection: StopProtection.hold.rawValue,
            Key.lockScreenStop: false,
            Key.shortcutWhileRecording: ShortcutWhileRecording.bookmark.rawValue,
            Key.pauseReminders: true,
        ])
    }

    static var defaults: UserDefaults { .standard }

    static var quality: RecordingQuality {
        RecordingQuality(rawValue: defaults.string(forKey: Key.quality) ?? "") ?? .standard
    }

    static var stopProtection: StopProtection {
        StopProtection(rawValue: defaults.string(forKey: Key.stopProtection) ?? "") ?? .hold
    }

    static var shortcutWhileRecording: ShortcutWhileRecording {
        ShortcutWhileRecording(rawValue: defaults.string(forKey: Key.shortcutWhileRecording) ?? "") ?? .bookmark
    }

    /// Empty string means "follow the device language".
    static var transcriptionLocale: Locale {
        let id = defaults.string(forKey: Key.transcriptionLocale) ?? ""
        return id.isEmpty ? .current : Locale(identifier: id)
    }
}

/// How deliberate stopping a recording has to be. Accidental stops are the most common way to lose audio
/// with a one-tap recorder, so the default is press-and-hold.
enum StopProtection: String, CaseIterable, Identifiable, Sendable {
    case hold
    case confirm
    case tap

    var id: String { rawValue }

    var label: String {
        switch self {
        case .hold: return "Press and hold (safest)"
        case .confirm: return "Tap, then confirm"
        case .tap: return "Single tap"
        }
    }
}

/// What the Action Button, a Shortcut toggle, Watch double tap or the Mac hotkey do while already recording.
enum ShortcutWhileRecording: String, CaseIterable, Identifiable, Sendable {
    case bookmark
    case stop

    var id: String { rawValue }

    var label: String {
        switch self {
        case .bookmark: return "Add a bookmark"
        case .stop: return "Stop recording"
        }
    }
}
