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
        ])
    }

    static var defaults: UserDefaults { .standard }

    static var quality: RecordingQuality {
        RecordingQuality(rawValue: defaults.string(forKey: Key.quality) ?? "") ?? .standard
    }

    /// Empty string means "follow the device language".
    static var transcriptionLocale: Locale {
        let id = defaults.string(forKey: Key.transcriptionLocale) ?? ""
        return id.isEmpty ? .current : Locale(identifier: id)
    }
}
