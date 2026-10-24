import AppKit
import ExportCore
import SwiftUI

@main
struct iPhoneExportApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel()
    @StateObject private var archive = MonthlyArchive(location: EngineLocation.standard())

    var body: some Scene {
        Window("iPhone Export", id: "main") {
            ContentView()
                .environmentObject(model)
                .environmentObject(archive)
                .frame(minWidth: 640, minHeight: 620)
        }
        .defaultSize(width: 720, height: 760)

        MenuBarExtra {
            MenuBarView()
                .environmentObject(model)
                .environmentObject(archive)
        } label: {
            Image(systemName: model.busy ? "iphone.radiowaves.left.and.right" : "iphone")
        }
    }
}

/// Opened at login (for the monthly archive), the app stays out of the way: no window, no Dock icon, just the
/// menu bar. Opened any other way it behaves like a normal app.
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        let event = NSAppleEventManager.shared().currentAppleEvent
        let atLogin = event?.eventID == AEEventID(kAEOpenApplication)
            && event?.paramDescriptor(forKeyword: AEKeyword(keyAEPropData))?.enumCodeValue == OSType(keyAELaunchedAsLogInItem)
        guard atLogin else { return }
        NSApp.setActivationPolicy(.accessory)
        // SwiftUI opens the window just after launch; close it once it exists.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            for window in NSApp.windows where window.identifier?.rawValue == "main" { window.close() }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
}

struct MenuBarView: View {
    @EnvironmentObject var model: AppModel
    @EnvironmentObject var archive: MonthlyArchive
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Text(model.busy ? "\(model.jobTitle): \(model.stage)" : model.phoneSummary)
        Text(model.lastBackupSummary)
        if archive.enabled {
            Text(archive.running ? "Filing last month's texts…"
                 : archive.lastSuccess.map { "Texts filed \(AppModel.relative($0))" } ?? "Texts not filed yet")
        }
        Divider()
        Button("Back Up & Export Now") { model.backUpAndExport() }
            .disabled(!model.canBackUp)
        Button("Export Latest Backup") { model.exportLatest() }
            .disabled(!model.canExportLatest)
        Button("Open Last Export") { model.openLastExport() }
            .disabled(model.status?.lastExport == nil)
        if model.busy {
            Button("Cancel") { model.cancel() }
        }
        Divider()
        Button("Open iPhone Export…") {
            NSApp.setActivationPolicy(.regular)
            openWindow(id: "main")
            NSApp.activate(ignoringOtherApps: true)
        }
        Button("Quit") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }
}
