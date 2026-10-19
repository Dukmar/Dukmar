import SwiftUI

/// Library on top, a big record button at the bottom: one tap and it's recording (Just Press Record's best idea).
struct RootView: View {
    @Environment(AppModel.self) private var model
    @State private var filter: LibraryFilter = .all
    @State private var path: [UUID] = []

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $path) {
            LibraryListView(filter: filter, selection: $model.selectedID)
                .navigationDestination(for: UUID.self) { id in
                    RecordingDetailView(recordingID: id)
                }
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) { filterMenu }
                    ToolbarItem(placement: .topBarTrailing) {
                        NavigationLink { SettingsView() } label: { Image(systemName: "gearshape") }
                            .accessibilityLabel("Settings")
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    RecordBar()
                }
        }
        .fullScreenCover(isPresented: Binding(get: { model.recorder.isActive }, set: { _ in })) {
            RecordingSessionView()
                .environment(model)
        }
        // Spotlight, deep links and "open" from a notification land here.
        .onChange(of: model.selectedID) { _, id in
            guard let id, path.last != id else { return }
            path = [id]
        }
        .onChange(of: path) { _, newPath in
            if newPath.isEmpty { model.selectedID = nil }
        }
    }

    private var filterMenu: some View {
        Menu {
            Picker("Show", selection: $filter) {
                Label("All Recordings", systemImage: "waveform").tag(LibraryFilter.all)
                Label("Favorites", systemImage: "star").tag(LibraryFilter.favorites)
                Label("From Apple Watch", systemImage: "applewatch").tag(LibraryFilter.watch)
            }
            if !model.library.allTags.isEmpty {
                Picker("Tags", selection: $filter) {
                    ForEach(model.library.allTags, id: \.self) { Text("#\($0)").tag(LibraryFilter.tag($0)) }
                }
            }
            Divider()
            NavigationLink { RecentlyDeletedView() } label: { Label("Recently Deleted", systemImage: "trash") }
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle")
        }
        .accessibilityLabel("Filter")
    }
}

struct RecordBar: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(spacing: 6) {
            if model.processing.pendingCount > 0 || model.processing.currentID != nil {
                Text("Transcribing \(model.processing.pendingCount + 1) recording\(model.processing.pendingCount == 0 ? "" : "s")…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Button {
                Task { await model.startRecording() }
            } label: {
                ZStack {
                    Circle().fill(.red).frame(width: 76, height: 76)
                    Circle().stroke(.white.opacity(0.9), lineWidth: 4).frame(width: 86, height: 86)
                }
                .shadow(radius: 6, y: 2)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Start recording")
            .sensoryFeedback(.impact, trigger: model.recorder.isActive)
        }
        .padding(.top, 10)
        .frame(maxWidth: .infinity)
        .background(.bar)
    }
}
