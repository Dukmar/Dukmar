import Foundation
import UniformTypeIdentifiers

/// Exports transcripts as plain text, Markdown (with summary, action items and notes), SRT or WebVTT captions.
enum TranscriptExporter {
    enum Format: String, CaseIterable, Identifiable {
        case text, markdown, srt, vtt
        var id: String { rawValue }

        var label: String {
            switch self {
            case .text: return "Plain Text"
            case .markdown: return "Markdown (with summary & notes)"
            case .srt: return "SubRip Captions (.srt)"
            case .vtt: return "WebVTT Captions (.vtt)"
            }
        }

        var fileExtension: String {
            switch self {
            case .text: return "txt"
            case .markdown: return "md"
            case .srt: return "srt"
            case .vtt: return "vtt"
            }
        }
    }

    static func render(_ item: RecordingItem, as format: Format) -> String {
        let m = item.metadata
        let segments = m.transcript?.segments ?? []
        switch format {
        case .text:
            return m.transcript?.fullText ?? ""
        case .markdown:
            var out = "# \(m.displayTitle)\n\n"
            out += "_\(m.createdAt.formatted(date: .long, time: .shortened)) · \(TimeFormat.duration(m.duration))_\n\n"
            if !m.tags.isEmpty { out += m.tags.map { "#\($0)" }.joined(separator: " ") + "\n\n" }
            if let insights = m.insights {
                out += "## Summary\n\n\(insights.summary)\n\n"
                if !insights.actionItems.isEmpty {
                    out += "## Action items\n\n" + insights.actionItems.map { "- [ ] \($0)" }.joined(separator: "\n") + "\n\n"
                }
            }
            if !m.bookmarks.isEmpty {
                out += "## Bookmarks & notes\n\n"
                out += m.bookmarks.map { "- **\(TimeFormat.timestamp($0.time))** \($0.note ?? "Bookmark")" }.joined(separator: "\n") + "\n\n"
            }
            if !segments.isEmpty {
                out += "## Transcript\n\n"
                out += segments.map { "**\(TimeFormat.timestamp($0.start))** \($0.text)" }.joined(separator: "\n\n") + "\n"
            }
            return out
        case .srt:
            return segments.enumerated().map { index, s in
                "\(index + 1)\n\(TimeFormat.caption(s.start, separator: ",")) --> \(TimeFormat.caption(s.end, separator: ","))\n\(s.text)\n"
            }.joined(separator: "\n")
        case .vtt:
            return "WEBVTT\n\n" + segments.map { s in
                "\(TimeFormat.caption(s.start, separator: ".")) --> \(TimeFormat.caption(s.end, separator: "."))\n\(s.text)\n"
            }.joined(separator: "\n")
        }
    }

    /// Writes the export to a temporary file named after the recording, ready for sharing.
    static func file(for item: RecordingItem, as format: Format) throws -> URL {
        let safeName = item.title.components(separatedBy: CharacterSet(charactersIn: "/\\:?%*|\"<>")).joined(separator: "-")
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(safeName)
            .appendingPathExtension(format.fileExtension)
        try render(item, as: format).write(to: url, atomically: true, encoding: .utf8)
        return url
    }
}
