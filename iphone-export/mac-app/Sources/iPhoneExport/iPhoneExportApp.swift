import AppKit
import SwiftUI

@main
struct iPhoneExportApp: App {
    @StateObject private var model = AppModel()

    var body: some Scene {
        Window("iPhone Export", id: "main") {
            ContentView()
                .environmentObject(model)
                .frame(minWidth: 640, minHeight: 620)
        }
        .defaultSize(width: 720, height: 760)

        MenuBarExtra {
            MenuBarView()
                .environmentObject(model)
        } label: {
            Image(systemName: model.busy ? "iphone.radiowaves.left.and.right" : "iphone")
        }
    }
}

struct MenuBarView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Text(model.busy ? "\(model.jobTitle): \(model.stage)" : model.phoneSummary)
        Text(model.lastBackupSummary)
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
            openWindow(id: "main")
            NSApp.activate(ignoringOtherApps: true)
        }
        Button("Quit") { NSApp.terminate(nil) }
            .keyboardShortcut("q")
    }
}
