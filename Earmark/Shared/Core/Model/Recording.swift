import Foundation

/// Where a recording was captured. Drives the "Watch" filter in the library.
enum SourceDevice: String, Codable, CaseIterable, Sendable {
    case iPhone
    case watch
    case mac
    case imported

    static var current: SourceDevice {
        #if os(watchOS)
        return .watch
        #elseif os(macOS)
        return .mac
        #else
        return .iPhone
        #endif
    }

    var symbolName: String {
        switch self {
        case .iPhone: return "iphone"
        case .watch: return "applewatch"
        case .mac: return "laptopcomputer"
        case .imported: return "square.and.arrow.down"
        }
    }
}

/// A moment flagged while recording (Ferrite-style) or a typed note tied to a time (Noted-style).
struct Bookmark: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var time: TimeInterval
    var note: String?

    var isNote: Bool { !(note ?? "").isEmpty }
}

struct TranscriptSegment: Codable, Hashable, Identifiable, Sendable {
    var id = UUID()
    var start: TimeInterval
    var end: TimeInterval
    var text: String
}

struct Transcript: Codable, Hashable, Sendable {
    var segments: [TranscriptSegment]
    var localeIdentifier: String
    var createdAt: Date

    var fullText: String {
        segments.map(\.text).joined(separator: " ")
            .replacingOccurrences(of: "  ", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    func segment(at time: TimeInterval) -> TranscriptSegment? {
        segments.last { $0.start <= time }
    }
}

/// On-device generated insights (Foundation Models).
struct RecordingInsights: Codable, Hashable, Sendable {
    var summary: String
    var actionItems: [String]
    var suggestedTitle: String?
    var createdAt: Date
}

struct RecordingPlace: Codable, Hashable, Sendable {
    var latitude: Double
    var longitude: Double
    var name: String?
}

enum TranscriptionState: String, Codable, Sendable {
    case pending
    case inProgress
    case done
    case failed
    case skipped
}

/// Everything Earmark knows about a recording besides the audio itself.
/// Stored as JSON next to the audio file (`<name>.earmark.json`) so it syncs through iCloud Drive with it.
struct RecordingMetadata: Codable, Hashable, Identifiable, Sendable {
    static let currentVersion = 1

    var version = RecordingMetadata.currentVersion
    var id: UUID
    var title: String?
    var createdAt: Date
    var duration: TimeInterval
    var source: SourceDevice
    var bookmarks: [Bookmark] = []
    var tags: [String] = []
    var isFavorite = false
    var place: RecordingPlace?
    var transcript: Transcript?
    var transcriptionState: TranscriptionState = .pending
    var transcriptionError: String?
    var insights: RecordingInsights?
    var deletedAt: Date?

    init(id: UUID = UUID(), createdAt: Date = .now, duration: TimeInterval = 0, source: SourceDevice = .current) {
        self.id = id
        self.createdAt = createdAt
        self.duration = duration
        self.source = source
    }

    // Tolerate files written by older or newer versions of the app.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decodeIfPresent(Int.self, forKey: .version) ?? 1
        id = try c.decode(UUID.self, forKey: .id)
        title = try c.decodeIfPresent(String.self, forKey: .title)
        createdAt = try c.decode(Date.self, forKey: .createdAt)
        duration = try c.decodeIfPresent(TimeInterval.self, forKey: .duration) ?? 0
        source = (try? c.decodeIfPresent(SourceDevice.self, forKey: .source)) ?? .iPhone
        bookmarks = try c.decodeIfPresent([Bookmark].self, forKey: .bookmarks) ?? []
        tags = try c.decodeIfPresent([String].self, forKey: .tags) ?? []
        isFavorite = try c.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
        place = try c.decodeIfPresent(RecordingPlace.self, forKey: .place)
        transcript = try c.decodeIfPresent(Transcript.self, forKey: .transcript)
        transcriptionState = (try? c.decodeIfPresent(TranscriptionState.self, forKey: .transcriptionState)) ?? .pending
        transcriptionError = try c.decodeIfPresent(String.self, forKey: .transcriptionError)
        insights = try c.decodeIfPresent(RecordingInsights.self, forKey: .insights)
        deletedAt = try c.decodeIfPresent(Date.self, forKey: .deletedAt)
    }

    var displayTitle: String {
        if let title, !title.isEmpty { return title }
        if let name = place?.name { return name }
        return createdAt.formatted(date: .abbreviated, time: .shortened)
    }
}

/// A recording on disk: the audio file plus its metadata.
struct RecordingItem: Identifiable, Hashable, Sendable {
    var audioURL: URL
    var metadata: RecordingMetadata
    /// False while iCloud still has to download the audio to this device.
    var isDownloaded = true

    var id: UUID { metadata.id }
    var title: String { metadata.displayTitle }

    var metadataURL: URL { RecordingPaths.metadataURL(forAudio: audioURL) }

    func matches(_ query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return true }
        let haystacks = [
            metadata.displayTitle,
            audioURL.deletingPathExtension().lastPathComponent,
            metadata.transcript?.fullText ?? "",
            metadata.insights?.summary ?? "",
            metadata.tags.joined(separator: " "),
            metadata.bookmarks.compactMap(\.note).joined(separator: " "),
        ]
        return haystacks.contains { $0.localizedCaseInsensitiveContains(q) }
    }
}
