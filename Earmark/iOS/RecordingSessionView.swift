import SwiftUI

/// Shown while recording: big timer, live levels, live transcript, bookmark and timestamped notes.
struct RecordingSessionView: View {
    @Environment(AppModel.self) private var model
    @State private var note = ""
    @State private var bookmarkTick = 0
    @State private var confirmDiscard = false
    @FocusState private var noteFocused: Bool

    private var recorder: Recorder { model.recorder }

    var body: some View {
        VStack(spacing: 20) {
            HStack {
                Label(recorder.state == .paused ? "Paused" : "Recording",
                      systemImage: recorder.state == .paused ? "pause.circle" : "record.circle")
                    .foregroundStyle(recorder.state == .paused ? Color.secondary : Color.red)
                    .font(.headline)
                    .symbolEffect(.pulse, isActive: recorder.state == .recording)
                Spacer()
                Button("Discard", role: .destructive) { confirmDiscard = true }
                    .font(.callout)
                    .confirmationDialog("Delete this recording?", isPresented: $confirmDiscard, titleVisibility: .visible) {
                        Button("Delete Recording", role: .destructive) { Task { await model.discardRecording() } }
                        Button("Keep Recording", role: .cancel) {}
                    } message: {
                        Text("The audio recorded so far will be thrown away.")
                    }
            }

            TimelineView(.periodic(from: .now, by: 0.1)) { _ in
                Text(TimeFormat.clock(recorder.elapsed))
                    .font(.system(size: 56, weight: .light, design: .rounded).monospacedDigit())
                    .contentTransition(.numericText())
            }
            .accessibilityLabel("Elapsed time")

            LiveLevelsView(levels: recorder.levelHistory, color: recorder.state == .paused ? .gray : .red)
                .frame(height: 70)

            liveTranscript

            bookmarksStrip

            HStack {
                TextField("Type a note at this moment…", text: $note)
                    .textFieldStyle(.roundedBorder)
                    .focused($noteFocused)
                    .submitLabel(.done)
                    .onSubmit(addNote)
                Button("Add", action: addNote).disabled(note.isEmpty)
            }

            HStack(spacing: 44) {
                Button {
                    recorder.addBookmark()
                    bookmarkTick += 1
                } label: {
                    Image(systemName: "bookmark.fill").font(.title)
                        .frame(width: 64, height: 64)
                        .background(.orange.opacity(0.18), in: Circle())
                }
                .accessibilityLabel("Bookmark this moment")

                ProtectedStopButton(ringColor: .red) {
                    Task { await model.stopRecording() }
                } label: {
                    RoundedRectangle(cornerRadius: 8).fill(.red).frame(width: 34, height: 34)
                        .frame(width: 84, height: 84)
                        .overlay(Circle().stroke(.primary.opacity(0.3), lineWidth: 4))
                }

                Button {
                    recorder.togglePause()
                } label: {
                    Image(systemName: recorder.state == .paused ? "record.circle" : "pause.fill").font(.title)
                        .frame(width: 64, height: 64)
                        .background(.secondary.opacity(0.18), in: Circle())
                }
                .accessibilityLabel(recorder.state == .paused ? "Resume" : "Pause")
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: bookmarkTick)
        }
        .padding()
        .confirmationDialog("Stop recording?", isPresented: Binding(get: { model.stopConfirmationPending },
                                                                    set: { model.stopConfirmationPending = $0 }),
                            titleVisibility: .visible) {
            Button("Stop and Save", role: .destructive) { Task { await model.stopRecording() } }
            Button("Keep Recording", role: .cancel) {}
        }
        .interactiveDismissDisabled()
        .persistentSystemOverlays(.hidden)
    }

    @ViewBuilder private var liveTranscript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                Group {
                    if model.liveTranscriber.text.isEmpty {
                        Text(model.liveTranscriber.isRunning ? "Listening…" : "The transcript will be ready shortly after you stop.")
                            .foregroundStyle(.secondary)
                    } else {
                        Text("\(model.liveTranscriber.finalizedText) \(Text(model.liveTranscriber.volatileText).foregroundStyle(.secondary))")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .id("end")
            }
            .onChange(of: model.liveTranscriber.text) { _, _ in proxy.scrollTo("end", anchor: .bottom) }
        }
        .frame(maxHeight: .infinity)
        .padding(12)
        .background(.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder private var bookmarksStrip: some View {
        if !recorder.bookmarks.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack {
                    ForEach(recorder.bookmarks) { bookmark in
                        Label("\(TimeFormat.timestamp(bookmark.time)) \(bookmark.note ?? "")",
                              systemImage: bookmark.isNote ? "note.text" : "bookmark.fill")
                            .font(.caption)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(.orange.opacity(0.15), in: Capsule())
                    }
                }
            }
        }
    }

    private func addNote() {
        let text = note.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        recorder.addBookmark(note: text)
        note = ""
        noteFocused = false
    }
}
