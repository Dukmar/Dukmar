import SwiftUI
import AVFoundation

struct WatchHomeView: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        NavigationStack {
            Group {
                if model.recorder.isActive {
                    WatchRecordingView()
                } else {
                    idle
                }
            }
            .alert("Earmark", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(model.errorMessage ?? "")
            }
        }
    }

    private var idle: some View {
        VStack(spacing: 10) {
            Button {
                Task { await model.start() }
            } label: {
                Circle().fill(.red)
                    .overlay(Image(systemName: "mic.fill").font(.title).foregroundStyle(.white))
                    .frame(width: 96, height: 96)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Start recording")

            NavigationLink {
                WatchRecordingsList()
            } label: {
                Label("\(model.recordings.count) on Watch", systemImage: "list.bullet")
                    .font(.footnote)
            }
            .buttonStyle(.bordered)
        }
        .navigationTitle("Earmark")
    }
}

struct WatchRecordingView: View {
    @Environment(WatchModel.self) private var model

    var body: some View {
        VStack(spacing: 6) {
            TimelineView(.periodic(from: .now, by: 0.5)) { _ in
                Text(TimeFormat.timestamp(model.recorder.elapsed))
                    .font(.system(size: 34, weight: .medium, design: .rounded).monospacedDigit())
                    .foregroundStyle(model.recorder.state == .paused ? .secondary : .primary)
            }
            WatchLevels(levels: model.recorder.levelHistory)
                .frame(height: 30)
            HStack {
                Button { model.bookmark() } label: {
                    Image(systemName: "bookmark.fill")
                }
                .tint(.orange)
                .accessibilityLabel("Bookmark")
                Button { model.stop() } label: {
                    Image(systemName: "stop.fill")
                }
                .tint(.red)
                .accessibilityLabel("Stop and save")
                Button { model.recorder.togglePause() } label: {
                    Image(systemName: model.recorder.state == .paused ? "record.circle" : "pause.fill")
                }
                .accessibilityLabel(model.recorder.state == .paused ? "Resume" : "Pause")
            }
            if !model.recorder.bookmarks.isEmpty {
                Text("\(model.recorder.bookmarks.count) bookmark\(model.recorder.bookmarks.count == 1 ? "" : "s")")
                    .font(.caption2).foregroundStyle(.orange)
            }
        }
        .navigationTitle(model.recorder.state == .paused ? "Paused" : "Recording")
    }
}

private struct WatchLevels: View {
    var levels: [Float]
    var body: some View {
        Canvas { context, size in
            let recent = levels.suffix(Int(size.width / 3))
            for (i, level) in recent.enumerated() {
                let h = max(2, CGFloat(level) * size.height)
                context.fill(Path(CGRect(x: CGFloat(i) * 3, y: (size.height - h) / 2, width: 2, height: h)), with: .color(.red))
            }
        }
    }
}

struct WatchRecordingsList: View {
    @Environment(WatchModel.self) private var model
    @State private var player: AVAudioPlayer?
    @State private var playingID: UUID?

    var body: some View {
        List {
            if !model.isPhoneReachable, model.recordings.contains(where: { $0.deliveredAt == nil }) {
                Text("Recordings will move to your iPhone when it's nearby.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            ForEach(model.recordings) { recording in
                Button {
                    toggle(recording)
                } label: {
                    VStack(alignment: .leading) {
                        Text(recording.metadata.createdAt.formatted(date: .abbreviated, time: .shortened))
                        HStack {
                            Text(TimeFormat.timestamp(recording.metadata.duration)).monospacedDigit()
                            Spacer()
                            Image(systemName: recording.deliveredAt == nil ? "arrow.up.circle" : "checkmark.icloud")
                                .foregroundStyle(recording.deliveredAt == nil ? .orange : .green)
                                .accessibilityLabel(recording.deliveredAt == nil ? "Waiting to send" : "Sent")
                            if playingID == recording.id { Image(systemName: "speaker.wave.2.fill") }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
                .swipeActions {
                    Button("Delete", role: .destructive) { model.delete(recording) }
                    if recording.deliveredAt == nil {
                        Button("Send") { model.deliver(recording) }.tint(.blue)
                    }
                }
            }
        }
        .navigationTitle("On Watch")
        .onDisappear { player?.stop() }
    }

    private func toggle(_ recording: WatchModel.LocalRecording) {
        if playingID == recording.id {
            player?.stop()
            playingID = nil
            return
        }
        try? AVAudioSession.sharedInstance().setCategory(.playback)
        player = try? AVAudioPlayer(contentsOf: recording.audioURL)
        player?.play()
        playingID = recording.id
    }
}
