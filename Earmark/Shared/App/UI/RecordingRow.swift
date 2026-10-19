import SwiftUI

struct RecordingRow: View {
    var item: RecordingItem
    var isProcessing = false
    var searchText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                if item.metadata.isFavorite {
                    Image(systemName: "star.fill").foregroundStyle(.yellow).font(.caption)
                }
                Text(item.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text(TimeFormat.timestamp(item.metadata.duration))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 6) {
                Image(systemName: item.metadata.source.symbolName)
                Text(item.metadata.createdAt.formatted(date: .omitted, time: .shortened))
                if !item.metadata.bookmarks.isEmpty {
                    Label("\(item.metadata.bookmarks.count)", systemImage: "bookmark")
                }
                if !item.isDownloaded {
                    Image(systemName: "icloud.and.arrow.down")
                }
                statusBadge
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            if let snippet {
                Text(snippet)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder private var statusBadge: some View {
        if isProcessing {
            ProgressView().controlSize(.mini)
            Text("Transcribing")
        } else if item.metadata.transcriptionState == .failed {
            Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
        }
    }

    /// When searching, show where the match is; otherwise the summary or the start of the transcript.
    private var snippet: String? {
        let m = item.metadata
        let text = m.transcript?.fullText ?? ""
        if !searchText.isEmpty, let range = text.range(of: searchText, options: .caseInsensitive) {
            let start = text.index(range.lowerBound, offsetBy: -40, limitedBy: text.startIndex) ?? text.startIndex
            let end = text.index(range.upperBound, offsetBy: 80, limitedBy: text.endIndex) ?? text.endIndex
            return (start == text.startIndex ? "" : "…") + String(text[start..<end]) + (end == text.endIndex ? "" : "…")
        }
        if let summary = m.insights?.summary { return summary }
        return text.isEmpty ? nil : text
    }
}
