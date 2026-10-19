import Foundation
import Testing

@Suite("Core model and file layout")
struct EarmarkCoreTests {
    @Test func metadataRoundTripsThroughJSON() throws {
        var metadata = RecordingMetadata(createdAt: Date(timeIntervalSince1970: 1_760_000_000), duration: 75, source: .watch)
        metadata.title = "Team sync"
        metadata.bookmarks = [Bookmark(time: 12, note: "Budget"), Bookmark(time: 40)]
        metadata.tags = ["work"]
        metadata.transcript = Transcript(segments: [TranscriptSegment(start: 0, end: 4, text: "Hello there.")],
                                         localeIdentifier: "en_US", createdAt: .now)

        let data = try MetadataIO.encoder.encode(metadata)
        let decoded = try MetadataIO.decoder.decode(RecordingMetadata.self, from: data)
        #expect(decoded.id == metadata.id)
        #expect(decoded.title == "Team sync")
        #expect(decoded.source == .watch)
        #expect(decoded.bookmarks.count == 2)
        #expect(decoded.transcript?.fullText == "Hello there.")
    }

    @Test func decodingToleratesMissingFields() throws {
        let json = #"{"id":"6F9619FF-8B86-D011-B42D-00C04FC964FF","createdAt":"2026-10-19T14:03:22Z"}"#
        let decoded = try MetadataIO.decoder.decode(RecordingMetadata.self, from: Data(json.utf8))
        #expect(decoded.bookmarks.isEmpty)
        #expect(decoded.transcriptionState == .pending)
        #expect(decoded.duration == 0)
    }

    @Test func stableUUIDsMatchAcrossCalls() {
        #expect(UUID(stableFrom: "/2026-10-19/a.m4a") == UUID(stableFrom: "/2026-10-19/a.m4a"))
        #expect(UUID(stableFrom: "/2026-10-19/a.m4a") != UUID(stableFrom: "/2026-10-19/b.m4a"))
    }

    @Test func fileNamesEncodeTheRecordingDate() throws {
        let date = try #require(RecordingPaths.date(fromFileName: "2026-10-19 14.03.22"))
        #expect(RecordingPaths.baseFileName(for: date) == "2026-10-19 14.03.22")
        #expect(RecordingPaths.dayFolderName(for: date) == "2026-10-19")
    }

    @Test func sidecarSitsNextToAudio() {
        let audio = URL(fileURLWithPath: "/tmp/Recordings/2026-10-19/2026-10-19 14.03.22.m4a")
        let sidecar = RecordingPaths.metadataURL(forAudio: audio)
        #expect(sidecar.lastPathComponent == "2026-10-19 14.03.22.earmark.json")
        #expect(RecordingPaths.isMetadataFile(sidecar))
        #expect(!RecordingPaths.isAudioFile(sidecar))
        #expect(RecordingPaths.isAudioFile(audio))
    }

    @Test func searchMatchesTranscriptAndNotes() {
        var metadata = RecordingMetadata()
        metadata.transcript = Transcript(segments: [TranscriptSegment(start: 0, end: 3, text: "Call the plumber tomorrow")],
                                         localeIdentifier: "en_US", createdAt: .now)
        metadata.bookmarks = [Bookmark(time: 2, note: "invoice")]
        let item = RecordingItem(audioURL: URL(fileURLWithPath: "/tmp/x.m4a"), metadata: metadata)
        #expect(item.matches("plumber"))
        #expect(item.matches("INVOICE"))
        #expect(!item.matches("electrician"))
        #expect(item.matches(""))
    }

    @Test func captionsUseCorrectTimestampFormat() {
        #expect(TimeFormat.caption(3725.5, separator: ",") == "01:02:05,500")
        #expect(TimeFormat.timestamp(75) == "1:15")
        #expect(TimeFormat.timestamp(3725) == "1:02:05")
    }

    @Test func srtExportNumbersSegments() {
        var metadata = RecordingMetadata()
        metadata.transcript = Transcript(segments: [
            TranscriptSegment(start: 0, end: 2.5, text: "First line."),
            TranscriptSegment(start: 2.5, end: 5, text: "Second line."),
        ], localeIdentifier: "en_US", createdAt: .now)
        let item = RecordingItem(audioURL: URL(fileURLWithPath: "/tmp/x.m4a"), metadata: metadata)
        let srt = TranscriptExporter.render(item, as: .srt)
        #expect(srt.hasPrefix("1\n00:00:00,000 --> 00:00:02,500\nFirst line."))
        #expect(srt.contains("2\n00:00:02,500 --> 00:00:05,000\nSecond line."))
    }
}
