import SwiftUI
import CoreSpotlight

@main
struct EarmarkApp: App {
    @State private var model = AppModel.shared
    @Environment(\.scenePhase) private var scenePhase
    private let activityController = RecordingActivityController()

    init() {
        // Hook up the Live Activity before any intent can start a recording on a cold launch.
        activityController.attach(to: AppModel.shared)
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .task { await model.start() }
                .onOpenURL { url in Task { await model.handle(url: url) } }
                .onContinueUserActivity(CSSearchableItemActionType) { activity in
                    model.selectedID = SpotlightIndexer.recordingID(from: activity)
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { Task { await model.refresh() } }
                }
                .alert("Earmark", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(model.errorMessage ?? "")
                }
        }
    }
}
