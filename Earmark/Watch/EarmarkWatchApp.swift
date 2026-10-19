import SwiftUI
import AppIntents

@main
struct EarmarkWatchApp: App {
    @State private var model = WatchModel.shared

    var body: some Scene {
        WindowGroup {
            WatchHomeView()
                .environment(model)
                // Tapping the complication opens earmark://record and starts recording immediately.
                .onOpenURL { url in
                    guard url.scheme == "earmark" else { return }
                    if url.host == "record" { Task { await model.start() } }
                }
        }
    }
}

// MARK: - Siri, Shortcuts and the Apple Watch Ultra Action Button

struct WatchStartRecordingIntent: AppIntent {
    static let title: LocalizedStringResource = "Start Recording"
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        await WatchModel.shared.start()
        return .result()
    }
}

struct WatchToggleRecordingIntent: AppIntent {
    static let title: LocalizedStringResource = "Record or Bookmark"
    static let description = IntentDescription("Starts a recording. While recording, adds a bookmark instead of stopping.")
    static let openAppWhenRun = true

    func perform() async throws -> some IntentResult {
        await WatchModel.shared.handleShortcutPress()
        return .result()
    }
}

struct WatchShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: WatchStartRecordingIntent(),
                    phrases: ["Start recording in \(.applicationName)", "Record with \(.applicationName)"],
                    shortTitle: "Record", systemImageName: "record.circle")
        AppShortcut(intent: WatchToggleRecordingIntent(),
                    phrases: ["Toggle \(.applicationName) recording"],
                    shortTitle: "Record or Bookmark", systemImageName: "record.circle.fill")
    }
}
