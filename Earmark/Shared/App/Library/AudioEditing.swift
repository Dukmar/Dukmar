import AVFoundation

enum AudioEditing {
    /// Writes `range` of the recording to a new temporary file (AAC, or the original format for WAV).
    static func trim(_ url: URL, to range: ClosedRange<TimeInterval>) async throws -> URL {
        let asset = AVURLAsset(url: url)
        let isWAV = url.pathExtension.lowercased() == "wav"
        let preset = isWAV ? AVAssetExportPresetPassthrough : AVAssetExportPresetAppleM4A
        guard let session = AVAssetExportSession(asset: asset, presetName: preset) else {
            throw CocoaError(.fileWriteUnknown)
        }
        session.timeRange = CMTimeRange(start: CMTime(seconds: range.lowerBound, preferredTimescale: 600),
                                        end: CMTime(seconds: range.upperBound, preferredTimescale: 600))
        let output = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension(url.pathExtension)
        try await session.export(to: output, as: isWAV ? .wav : .m4a)
        return output
    }

    /// Shifts timestamps after a trim and drops anything that was cut.
    static func adjust(_ metadata: inout RecordingMetadata, for range: ClosedRange<TimeInterval>) {
        let offset = range.lowerBound
        metadata.duration = range.upperBound - range.lowerBound
        metadata.bookmarks = metadata.bookmarks
            .filter { range.contains($0.time) }
            .map { var b = $0; b.time -= offset; return b }
        if var transcript = metadata.transcript {
            transcript.segments = transcript.segments
                .filter { $0.end > range.lowerBound && $0.start < range.upperBound }
                .map { var s = $0; s.start = max(0, s.start - offset); s.end = min(metadata.duration, s.end - offset); return s }
            metadata.transcript = transcript
        }
        metadata.insights = nil // summary may mention removed parts
    }
}
