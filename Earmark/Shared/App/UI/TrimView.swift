import SwiftUI

struct TrimView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var item: RecordingItem

    @State private var start: TimeInterval = 0
    @State private var end: TimeInterval = 0
    @State private var isSaving = false

    private var duration: TimeInterval { max(model.player.duration, item.metadata.duration) }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                ZStack {
                    WaveformScrubber(waveform: model.player.waveform, duration: duration,
                                     currentTime: model.player.currentTime) { model.player.seek(to: $0) }
                    GeometryReader { geo in
                        let width = geo.size.width
                        Rectangle().fill(.black.opacity(0.45))
                            .frame(width: duration > 0 ? width * start / duration : 0)
                        Rectangle().fill(.black.opacity(0.45))
                            .frame(width: duration > 0 ? width * (duration - end) / duration : 0)
                            .offset(x: duration > 0 ? width * end / duration : width)
                    }
                    .allowsHitTesting(false)
                }
                .frame(height: 80)

                LabeledContent("Start", value: TimeFormat.clock(start))
                Slider(value: $start, in: 0...max(duration, 0.1)) { Text("Start") }
                    .onChange(of: start) { _, value in if value > end - 0.5 { start = max(0, end - 0.5) } }
                LabeledContent("End", value: TimeFormat.clock(end))
                Slider(value: $end, in: 0...max(duration, 0.1)) { Text("End") }
                    .onChange(of: end) { _, value in if value < start + 0.5 { end = min(duration, start + 0.5) } }

                HStack {
                    Button("Play Selection", systemImage: "play.fill") { model.player.play(from: start) }
                    Spacer()
                    Text("New length \(TimeFormat.timestamp(end - start))").foregroundStyle(.secondary)
                }
                Text("Bookmarks and transcript lines in the removed parts are dropped. This can't be undone.")
                    .font(.footnote).foregroundStyle(.secondary)
                Spacer()
            }
            .padding()
            .navigationTitle("Trim")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Trim") {
                        isSaving = true
                        Task {
                            await model.trim(item.id, to: start...end)
                            dismiss()
                        }
                    }
                    .disabled(isSaving || (start <= 0.05 && end >= duration - 0.05))
                }
            }
            .onAppear { end = duration }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 420)
        #endif
    }
}
