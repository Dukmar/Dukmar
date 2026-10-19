import AppIntents
import Foundation

// Compiled into the iPhone app, the iPhone widget extension and the Mac app.
// Intents only *do* anything in the app process. In the widget extension (WIDGET_EXTENSION) they exist
// so Control Center and Live Activity buttons can reference them; the system runs them in the app.

#if os(iOS)
typealias EarmarkLiveActivityIntent = LiveActivityIntent
typealias EarmarkRecordingIntent = AudioRecordingIntent
#else
typealias EarmarkLiveActivityIntent = AppIntent
typealias EarmarkRecordingIntent = AppIntent
#endif

struct StartRecordingIntent: EarmarkRecordingIntent {
    static let title: LocalizedStringResource = "Start Recording"
    static let description = IntentDescription("Starts a new Earmark recording right away.")
    /// Opening the app is the reliable way to get the microphone from Siri, the Action Button or Control Center.
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await AppModel.shared.startRecording()
        #endif
        return .result()
    }
}

struct ToggleRecordingIntent: EarmarkRecordingIntent {
    static let title: LocalizedStringResource = "Record or Bookmark"
    static let description = IntentDescription("Starts a recording. While recording, adds a bookmark (or stops, if you chose that in Settings). Made for the Action Button.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await AppModel.shared.handleShortcutPress()
        #endif
        return .result()
    }
}

struct StopRecordingIntent: EarmarkLiveActivityIntent {
    static let title: LocalizedStringResource = "Stop Recording"
    static let description = IntentDescription("Stops and saves the current recording.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        #if !WIDGET_EXTENSION
        if let item = await AppModel.shared.stopRecording() {
            return .result(dialog: "Saved \(TimeFormat.duration(item.metadata.duration)) recording.")
        }
        #endif
        return .result(dialog: "Nothing is recording.")
    }
}

struct TogglePauseIntent: EarmarkLiveActivityIntent {
    static let title: LocalizedStringResource = "Pause or Resume Recording"

    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await MainActor.run { AppModel.shared.recorder.togglePause() }
        #endif
        return .result()
    }
}

struct AddBookmarkIntent: EarmarkLiveActivityIntent {
    static let title: LocalizedStringResource = "Bookmark This Moment"
    static let description = IntentDescription("Flags the current moment in the recording, optionally with a note.")

    @Parameter(title: "Note", requestValueDialog: "What's the note?")
    var note: String?

    init() {}
    init(note: String?) { self.note = note }

    func perform() async throws -> some IntentResult {
        #if !WIDGET_EXTENSION
        await MainActor.run { AppModel.shared.addBookmark(note: note) }
        #endif
        return .result()
    }
}

#if !WIDGET_EXTENSION
struct EarmarkShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: StartRecordingIntent(),
                    phrases: ["Start recording in \(.applicationName)", "Record with \(.applicationName)", "New \(.applicationName) recording"],
                    shortTitle: "Record", systemImageName: "record.circle")
        AppShortcut(intent: StopRecordingIntent(),
                    phrases: ["Stop \(.applicationName) recording", "Stop recording in \(.applicationName)"],
                    shortTitle: "Stop", systemImageName: "stop.circle")
        AppShortcut(intent: AddBookmarkIntent(),
                    phrases: ["Bookmark this in \(.applicationName)", "Mark this in \(.applicationName)"],
                    shortTitle: "Bookmark", systemImageName: "bookmark")
        AppShortcut(intent: ToggleRecordingIntent(),
                    phrases: ["Toggle \(.applicationName) recording"],
                    shortTitle: "Record or Bookmark", systemImageName: "record.circle.fill")
    }
}
#endif
