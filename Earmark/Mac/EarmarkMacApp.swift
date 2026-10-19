import SwiftUI
import CoreSpotlight

@main
struct EarmarkMacApp: App {
    @State private var model = AppModel.shared
    private let hotKey = GlobalHotKey()

    var body: some Scene {
        Window("Earmark", id: "library") {
            MacRootView()
                .environment(model)
                .frame(minWidth: 820, minHeight: 520)
                .task {
                    await model.start()
                    hotKey.onPress = { Task { await AppModel.shared.handleShortcutPress() } }
                    hotKey.setEnabled(UserDefaults.standard.bool(forKey: AppSettings.Key.macHotKeyEnabled))
                }
                .onOpenURL { url in Task { await model.handle(url: url) } }
                .onContinueUserActivity(CSSearchableItemActionType) { activity in
                    model.selectedID = SpotlightIndexer.recordingID(from: activity)
                }
                .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
                    Task { await model.refresh() }
                }
                .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)) { _ in
                    hotKey.setEnabled(UserDefaults.standard.bool(forKey: AppSettings.Key.macHotKeyEnabled))
                }
                .alert("Earmark", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
                    Button("OK", role: .cancel) {}
                } message: {
                    Text(model.errorMessage ?? "")
                }
        }
        .commands {
            CommandMenu("Recording") {
                Button(model.recorder.isActive ? "Stop Recording…" : "Start Recording") {
                    Task { model.recorder.isActive ? await model.requestStop() : await model.startRecording() }
                }
                .keyboardShortcut("r", modifiers: .command)
                Button(model.recorder.state == .paused ? "Resume" : "Pause") { model.recorder.togglePause() }
                    .keyboardShortcut("p", modifiers: [.command, .shift])
                    .disabled(!model.recorder.isActive)
                Button("Bookmark This Moment") { model.addBookmark() }
                    .keyboardShortcut("b", modifiers: .command)
                    .disabled(!model.recorder.isActive)
            }
        }

        MenuBarExtra {
            MenuBarRecorderView()
                .environment(model)
        } label: {
            Image(systemName: model.recorder.isActive ? "record.circle.fill" : "waveform")
        }
        .menuBarExtraStyle(.window)

        Settings {
            NavigationStack { SettingsView() }
                .environment(model)
                .frame(width: 520, height: 620)
        }
    }
}

struct MacRootView: View {
    @Environment(AppModel.self) private var model
    @State private var filter: LibraryFilter? = .all

    var body: some View {
        @Bindable var model = model
        NavigationSplitView {
            List(selection: $filter) {
                Section {
                    Label("All Recordings", systemImage: "waveform").tag(LibraryFilter.all)
                    Label("Favorites", systemImage: "star").tag(LibraryFilter.favorites)
                    Label("From Apple Watch", systemImage: "applewatch").tag(LibraryFilter.watch)
                }
                if !model.library.allTags.isEmpty {
                    Section("Tags") {
                        ForEach(model.library.allTags, id: \.self) { tag in
                            Label(tag, systemImage: "number").tag(LibraryFilter.tag(tag))
                        }
                    }
                }
                Section {
                    NavigationLink { RecentlyDeletedView() } label: { Label("Recently Deleted", systemImage: "trash") }
                }
            }
            .navigationSplitViewColumnWidth(min: 180, ideal: 200)
        } content: {
            LibraryListView(filter: filter ?? .all, selection: $model.selectedID)
                .navigationSplitViewColumnWidth(min: 280, ideal: 340)
                .toolbar {
                    ToolbarItem {
                        Button {
                            Task { model.recorder.isActive ? await model.requestStop() : await model.startRecording() }
                        } label: {
                            Label(model.recorder.isActive ? "Stop" : "Record",
                                  systemImage: model.recorder.isActive ? "stop.circle.fill" : "record.circle")
                        }
                        .tint(.red)
                        .help("Start or stop recording (⌘R)")
                    }
                    ToolbarItem {
                        SettingsLink { Label("Settings", systemImage: "gearshape") }
                    }
                }
        } detail: {
            detail
        }
    }

    @ViewBuilder private var detail: some View {
        if model.recorder.isActive {
            MacRecordingPanel()
        } else if let id = model.selectedID {
            RecordingDetailView(recordingID: id).id(id)
        } else {
            ContentUnavailableView("Select a Recording", systemImage: "waveform",
                                   description: Text("Press ⌘R to record, or ⌃⌥⌘R from any app."))
        }
    }
}

/// Detail pane while recording from the Mac window.
struct MacRecordingPanel: View {
    @Environment(AppModel.self) private var model
    @State private var note = ""

    var body: some View {
        VStack(spacing: 18) {
            TimelineView(.periodic(from: .now, by: 0.1)) { _ in
                Text(TimeFormat.clock(model.recorder.elapsed))
                    .font(.system(size: 54, weight: .light, design: .rounded).monospacedDigit())
            }
            LiveLevelsView(levels: model.recorder.levelHistory).frame(height: 60)
            ScrollView {
                Text(model.liveTranscriber.text.isEmpty ? "Listening…" : model.liveTranscriber.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .foregroundStyle(model.liveTranscriber.text.isEmpty ? .secondary : .primary)
            }
            .padding()
            .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
            HStack {
                TextField("Note at this moment", text: $note)
                    .onSubmit {
                        model.addBookmark(note: note)
                        note = ""
                    }
                Button("Bookmark") { model.addBookmark() }
                Button(model.recorder.state == .paused ? "Resume" : "Pause") { model.recorder.togglePause() }
                ProtectedStopButton {
                    Task { await model.stopRecording() }
                } label: {
                    Image(systemName: "stop.fill")
                        .foregroundStyle(.white)
                        .frame(width: 36, height: 36)
                        .background(.red, in: Circle())
                }
                .help(AppSettings.stopProtection == .hold ? "Press and hold to stop" : "Stop")
            }
        }
        .padding(24)
    }
}
