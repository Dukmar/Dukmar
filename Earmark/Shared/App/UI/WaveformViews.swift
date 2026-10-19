import SwiftUI

/// Static waveform for a recording, with playhead, bookmark ticks and tap/drag to seek.
struct WaveformScrubber: View {
    var waveform: Waveform
    var duration: TimeInterval
    var currentTime: TimeInterval
    var bookmarks: [Bookmark] = []
    var onSeek: (TimeInterval) -> Void

    var body: some View {
        GeometryReader { geo in
            let progress = duration > 0 ? min(1, currentTime / duration) : 0
            ZStack(alignment: .leading) {
                bars(in: geo.size)
                    .foregroundStyle(.secondary.opacity(0.35))
                bars(in: geo.size)
                    .foregroundStyle(Color.accentColor)
                    .mask(alignment: .leading) {
                        Rectangle().frame(width: geo.size.width * progress)
                    }
                ForEach(bookmarks) { bookmark in
                    let x = duration > 0 ? geo.size.width * bookmark.time / duration : 0
                    Image(systemName: bookmark.isNote ? "note.text" : "bookmark.fill")
                        .font(.system(size: 9))
                        .foregroundStyle(.orange)
                        .position(x: x, y: 4)
                }
                Rectangle()
                    .fill(Color.primary)
                    .frame(width: 2)
                    .offset(x: geo.size.width * progress - 1)
            }
            .contentShape(Rectangle())
            .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                let fraction = max(0, min(1, value.location.x / max(geo.size.width, 1)))
                onSeek(fraction * duration)
            })
        }
        .accessibilityElement()
        .accessibilityLabel("Playback position")
        .accessibilityValue("\(TimeFormat.timestamp(currentTime)) of \(TimeFormat.timestamp(duration))")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onSeek(currentTime + 15)
            case .decrement: onSeek(currentTime - 15)
            @unknown default: break
            }
        }
    }

    private func bars(in size: CGSize) -> some View {
        Canvas { context, canvasSize in
            let samples = waveform.samples.isEmpty ? Array(repeating: Float(0.04), count: 120) : waveform.samples
            let barCount = max(1, Int(canvasSize.width / 3))
            let step = Double(samples.count) / Double(barCount)
            for i in 0..<barCount {
                let lower = Int(Double(i) * step)
                let upper = max(lower + 1, Int(Double(i + 1) * step))
                let peak = samples[lower..<min(upper, samples.count)].max() ?? 0
                let height = max(2, CGFloat(peak) * canvasSize.height * 0.9)
                let rect = CGRect(x: CGFloat(i) * 3, y: (canvasSize.height - height) / 2, width: 2, height: height)
                context.fill(Path(roundedRect: rect, cornerRadius: 1), with: .foreground)
            }
        }
        .frame(width: size.width, height: size.height)
    }
}

/// Scrolling live levels while recording.
struct LiveLevelsView: View {
    var levels: [Float]
    var color: Color = .red

    var body: some View {
        Canvas { context, size in
            let barWidth: CGFloat = 3
            let count = Int(size.width / barWidth)
            let recent = levels.suffix(count)
            let startX = size.width - CGFloat(recent.count) * barWidth
            for (offset, level) in recent.enumerated() {
                let height = max(2, CGFloat(level) * size.height)
                let rect = CGRect(x: startX + CGFloat(offset) * barWidth, y: (size.height - height) / 2, width: 2, height: height)
                context.fill(Path(roundedRect: rect, cornerRadius: 1), with: .color(color))
            }
        }
        .accessibilityHidden(true)
    }
}
