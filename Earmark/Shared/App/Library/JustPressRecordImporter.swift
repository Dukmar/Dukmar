import AVFoundation

/// Brings an existing Just Press Record library into Earmark.
///
/// Just Press Record keeps recordings in `iCloud Drive/Just Press Record/<yyyy-MM-dd>/<HH-mm-ss>.m4a`
/// and embeds the transcript in the audio file's metadata. The user picks that folder (or any folder
/// of audio files); recordings are copied, so the originals stay where they are.
@MainActor
enum JustPressRecordImporter {
    struct Summary {
        var imported = 0
        var skipped = 0
        var transcriptsFound = 0
    }

    static func importFolder(_ folder: URL, into library: RecordingLibrary,
                             progress: @escaping (Int, Int) -> Void) async -> Summary {
        let accessing = folder.startAccessingSecurityScopedResource()
        defer { if accessing { folder.stopAccessingSecurityScopedResource() } }

        let files = await Task.detached { audioFiles(in: folder) }.value
        var summary = Summary()
        for (index, file) in files.enumerated() {
            progress(index, files.count)
            let relative = file.path.replacingOccurrences(of: folder.path, with: "")
            // Same file, same ID: importing twice doesn't duplicate anything.
            let id = UUID(stableFrom: "jpr:" + relative)
            guard library.item(withID: id) == nil else {
                summary.skipped += 1
                continue
            }
            var metadata = RecordingMetadata(id: id, createdAt: recordingDate(for: file), source: .imported)
            if let transcript = await embeddedTranscript(in: file), !transcript.isEmpty {
                metadata.transcript = Transcript(segments: [TranscriptSegment(start: 0, end: 0, text: transcript)],
                                                 localeIdentifier: Locale.current.identifier, createdAt: .now)
                metadata.transcriptionState = .done
                summary.transcriptsFound += 1
            }
            do {
                // Coordinated read makes iCloud download the file if it's only in the cloud.
                let local = try coordinatedCopy(of: file)
                try await library.add(audioAt: local, metadata: metadata)
                summary.imported += 1
            } catch {
                summary.skipped += 1
            }
        }
        progress(files.count, files.count)
        return summary
    }

    nonisolated private static func audioFiles(in folder: URL) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: [.isRegularFileKey]) else { return [] }
        return enumerator.compactMap { $0 as? URL }
            .filter { RecordingPaths.isAudioFile($0) }
            .sorted { $0.path < $1.path }
    }

    /// `2024-05-02/09-41-07.m4a` → that date and time. Falls back to the file's creation date.
    private static func recordingDate(for file: URL) -> Date {
        let day = file.deletingLastPathComponent().lastPathComponent
        let time = file.deletingPathExtension().lastPathComponent
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for pattern in ["yyyy-MM-dd HH-mm-ss", "yyyy-MM-dd HH.mm.ss", "yyyy-MM-dd HH:mm:ss"] {
            formatter.dateFormat = pattern
            if let date = formatter.date(from: "\(day) \(time.prefix(8))") { return date }
        }
        return (try? file.resourceValues(forKeys: [.creationDateKey]).creationDate) ?? .now
    }

    /// Looks for a transcript in the usual text metadata slots (lyrics, comments, description).
    private static func embeddedTranscript(in file: URL) async -> String? {
        let asset = AVURLAsset(url: file)
        guard let items = try? await asset.load(.metadata) else { return nil }
        let wanted: [AVMetadataIdentifier] = [.iTunesMetadataLyrics, .id3MetadataUnsynchronizedLyric,
                                              .commonIdentifierDescription, .iTunesMetadataUserComment,
                                              .quickTimeMetadataComment, .quickTimeMetadataDescription]
        for identifier in wanted {
            if let item = items.first(where: { $0.identifier == identifier }),
               let text = try? await item.load(.stringValue),
               !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return text.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return nil
    }

    private static func coordinatedCopy(of file: URL) throws -> URL {
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString).appendingPathExtension(file.pathExtension)
        var coordinationError: NSError?
        var copyError: Error?
        NSFileCoordinator().coordinate(readingItemAt: file, options: .withoutChanges, error: &coordinationError) { url in
            do { try FileManager.default.copyItem(at: url, to: destination) } catch { copyError = error }
        }
        if let coordinationError { throw coordinationError }
        if let copyError { throw copyError }
        return destination
    }
}
