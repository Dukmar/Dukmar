import SwiftUI
import WidgetKit

/// Watch face complications and Smart Stack widget. Tapping one opens Earmark and starts recording right away.
@main
struct EarmarkComplications: Widget {
    struct Entry: TimelineEntry { let date: Date }

    struct Provider: TimelineProvider {
        func placeholder(in context: Context) -> Entry { Entry(date: .now) }
        func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) { completion(Entry(date: .now)) }
        func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
            completion(Timeline(entries: [Entry(date: .now)], policy: .never))
        }
    }

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "com.crstudios.earmark.watch.record", provider: Provider()) { _ in
            ComplicationView()
                .widgetURL(URL(string: "earmark://record"))
                .containerBackground(.red.gradient, for: .widget)
        }
        .configurationDisplayName("Record")
        .description("Start recording with one tap.")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
    }
}

private struct ComplicationView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCorner:
            Image(systemName: "mic.fill")
                .font(.title2)
                .widgetLabel("Record")
        case .accessoryInline:
            Label("Record", systemImage: "mic.fill")
        case .accessoryRectangular:
            HStack {
                Image(systemName: "mic.circle.fill").font(.title).foregroundStyle(.red)
                VStack(alignment: .leading) {
                    Text("Earmark").font(.headline)
                    Text("Tap to record").font(.caption)
                }
            }
        default:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "mic.fill").font(.title2)
            }
            .accessibilityLabel("Start recording")
        }
    }
}
