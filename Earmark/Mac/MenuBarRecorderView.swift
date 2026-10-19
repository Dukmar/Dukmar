import SwiftUI

/// The menu-bar recorder: one click to record from anywhere on the Mac.
struct MenuBarRecorderView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if model.recorder.isActive {
                recording
            } else {
                Button {
                    Task { await model.startRecording() }
                } label: {
                    Label("Start Recording", systemImage: "record.circle")
                        .frame(maxWidth: .infinity)
                }
                .controlSize(.large)
                .buttonStyle(.borderedProminent)
                .tint(.red)
                Text("Shortcut: ⌃⌥⌘R from any app").font(.caption).foregroundStyle(.secondary)
            }

            Divider()
            Text("Recent").font(.caption).foregroundStyle(.secondary)
            ForEach(model.library.items.prefix(5)) { item in
                Button {
                    model.selectedID = item.id
                    openLibrary()
                } label: {
                    HStack {
                        Image(systemName: item.metadata.source.symbolName).foregroundStyle(.secondary)
                        Text(item.title).lineLimit(1)
                        Spacer()
                        Text(TimeFormat.timestamp(item.metadata.duration)).monospacedDigit().foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)
            }
            Divider()
            HStack {
                Button("Open Earmark") { openLibrary() }
                Spacer()
                Button("Quit") { NSApplication.shared.terminate(nil) }
            }
        }
        .padding()
        .frame(width: 320)
    }

    private var recording: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "record.circle").foregroundStyle(.red)
                    .symbolEffect(.pulse, isActive: model.recorder.state == .recording)
                TimelineView(.periodic(from: .now, by: 0.5)) { _ in
                    Text(TimeFormat.timestamp(model.recorder.elapsed)).font(.title2.monospacedDigit())
                }
                Spacer()
                if !model.recorder.bookmarks.isEmpty {
                    Label("\(model.recorder.bookmarks.count)", systemImage: "bookmark.fill").foregroundStyle(.orange)
                }
            }
            LiveLevelsView(levels: model.recorder.levelHistory).frame(height: 34)
            if !model.liveTranscriber.text.isEmpty {
                Text(model.liveTranscriber.text.suffix(160))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            HStack {
                Button("Bookmark", systemImage: "bookmark") { model.addBookmark() }
                Button(model.recorder.state == .paused ? "Resume" : "Pause",
                       systemImage: model.recorder.state == .paused ? "record.circle" : "pause") { model.recorder.togglePause() }
                Spacer()
                ProtectedStopButton {
                    Task { await model.stopRecording() }
                } label: {
                    Image(systemName: "stop.fill")
                        .foregroundStyle(.white)
                        .frame(width: 30, height: 30)
                        .background(.red, in: Circle())
                }
                .help(AppSettings.stopProtection == .hold ? "Press and hold to stop" : "Stop")
            }
        }
    }

    private func openLibrary() {
        openWindow(id: "library")
        NSApplication.shared.activate()
    }
}
