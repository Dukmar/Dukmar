import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct EarmarkWidgets: WidgetBundle {
    var body: some Widget {
        RecordingLiveActivity()
        RecordControl()
        QuickRecordWidget()
    }
}

// MARK: - Live Activity (Lock Screen + Dynamic Island)

struct RecordingLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: RecordingActivityAttributes.self) { context in
            HStack(spacing: 14) {
                Image(systemName: context.state.isPaused ? "pause.circle.fill" : "record.circle")
                    .font(.title)
                    .foregroundStyle(context.state.isPaused ? .gray : .red)
                VStack(alignment: .leading) {
                    Text(context.state.isPaused ? "Paused" : "Recording").font(.headline)
                    ElapsedText(state: context.state).font(.title2.monospacedDigit())
                }
                Spacer()
                ActivityButtons(state: context.state)
            }
            .padding()
            .activityBackgroundTint(.black.opacity(0.6))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.isPaused ? "Paused" : "Recording", systemImage: "waveform")
                        .foregroundStyle(context.state.isPaused ? .gray : .red)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedText(state: context.state).monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    ActivityButtons(state: context.state)
                }
            } compactLeading: {
                Image(systemName: context.state.isPaused ? "pause.fill" : "record.circle").foregroundStyle(.red)
            } compactTrailing: {
                ElapsedText(state: context.state).monospacedDigit().frame(maxWidth: 52)
            } minimal: {
                Image(systemName: "record.circle").foregroundStyle(.red)
            }
            .widgetURL(URL(string: "earmark://open"))
        }
    }
}

private struct ElapsedText: View {
    var state: RecordingActivityAttributes.ContentState

    var body: some View {
        if state.isPaused {
            Text(TimeFormat.timestamp(state.pausedElapsed))
        } else {
            Text(timerInterval: state.effectiveStart...Date.distantFuture, countsDown: false)
        }
    }
}

private struct ActivityButtons: View {
    var state: RecordingActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 10) {
            Button(intent: AddBookmarkIntent()) {
                Label(state.bookmarkCount > 0 ? "\(state.bookmarkCount)" : "Mark", systemImage: "bookmark.fill")
            }
            .tint(.orange)
            Button(intent: TogglePauseIntent()) {
                Image(systemName: state.isPaused ? "record.circle" : "pause.fill")
            }
            .accessibilityLabel(state.isPaused ? "Resume" : "Pause")
            if state.allowsStop {
                Button(intent: StopRecordingIntent()) {
                    Image(systemName: "stop.fill")
                }
                .tint(.red)
                .accessibilityLabel("Stop")
            }
        }
        .buttonStyle(.bordered)
        .labelStyle(.titleAndIcon)
    }
}

// MARK: - Control Center / Lock Screen control / Action Button

struct RecordControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.crstudios.earmark.record") {
            ControlWidgetButton(action: StartRecordingIntent()) {
                Label("Record", systemImage: "record.circle")
            }
        }
        .displayName("Earmark Record")
        .description("Start recording with one tap.")
    }
}

// MARK: - Home & Lock Screen widget

struct QuickRecordWidget: Widget {
    struct Entry: TimelineEntry { let date: Date }

    struct Provider: TimelineProvider {
        func placeholder(in context: Context) -> Entry { Entry(date: .now) }
        func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: .now)) }
        func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
            completion(Timeline(entries: [Entry(date: .now)], policy: .never))
        }
    }

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.crstudios.earmark.quickrecord", provider: Provider()) { _ in
            QuickRecordView()
                .widgetURL(URL(string: "earmark://record"))
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Record")
        .description("One tap to start recording.")
        .supportedFamilies([.accessoryCircular, .accessoryInline, .systemSmall])
    }
}

private struct QuickRecordView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryInline:
            Label("Record", systemImage: "record.circle")
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "mic.fill").font(.title2)
            }
            .accessibilityLabel("Start recording")
        default:
            VStack(spacing: 8) {
                Circle().fill(.red).frame(width: 64, height: 64)
                    .overlay(Image(systemName: "mic.fill").foregroundStyle(.white).font(.title))
                Text("Record").font(.headline)
            }
        }
    }
}
