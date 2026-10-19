import AVFoundation

/// Turns a PCM capture into the final file (AAC / Apple Lossless .m4a, or .wav).
/// Uses AVAudioFile only, so it works the same on iPhone, Watch and Mac.
enum AudioFinalizer {
    /// Encodes `capture` into a new temporary file in `quality`'s format. The capture is left in place;
    /// delete it (with `Recorder.removeCapture`) only after the result is safely stored.
    static func encode(_ capture: URL, quality: RecordingQuality) async throws -> URL {
        try await Task.detached(priority: .userInitiated) {
            CAFRepair.repairIfNeeded(capture)
            let input = try AVAudioFile(forReading: capture)
            let output = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(quality.fileExtension)
            var settings = quality.fileSettings
            // Keep the capture's real rate and channel count (a Bluetooth mic may differ from the preset).
            settings[AVSampleRateKey] = input.fileFormat.sampleRate
            settings[AVNumberOfChannelsKey] = input.fileFormat.channelCount
            let writer = try AVAudioFile(forWriting: output, settings: settings,
                                         commonFormat: input.processingFormat.commonFormat,
                                         interleaved: input.processingFormat.isInterleaved)
            guard let buffer = AVAudioPCMBuffer(pcmFormat: input.processingFormat, frameCapacity: 32_768) else {
                throw CocoaError(.fileReadUnknown)
            }
            while input.framePosition < input.length {
                try Task.checkCancellation()
                try input.read(into: buffer)
                if buffer.frameLength == 0 { break }
                try writer.write(from: buffer)
            }
            writer.close()
            return output
        }.value
    }
}

/// If the app dies mid-recording, the CAF header may still hold an old length for the audio data.
/// CAF allows the final `data` chunk to say "runs to end of file" (size -1), so patching that makes
/// every byte that reached the disk playable again.
enum CAFRepair {
    private static let knownChunks: Set<String> = ["desc", "chan", "info", "kuki", "pakt", "free", "uuid", "mark",
                                                   "regn", "strg", "ovvw", "peak", "umid", "lrdc", "midi", "edct", "inst"]

    static func repairIfNeeded(_ url: URL) {
        guard url.pathExtension.lowercased() == "caf",
              let handle = try? FileHandle(forUpdating: url) else { return }
        defer { try? handle.close() }
        guard let fileSize = try? handle.seekToEnd(), fileSize > 8 else { return }

        var offset: UInt64 = 8 // after 'caff' + version + flags
        while offset + 12 <= fileSize {
            try? handle.seek(toOffset: offset)
            guard let header = try? handle.read(upToCount: 12), header.count == 12 else { return }
            let type = String(decoding: header.prefix(4), as: UTF8.self)
            let size = header.dropFirst(4).reduce(UInt64(0)) { $0 << 8 | UInt64($1) }
            let bodyStart = offset + 12

            if type == "data" {
                if size == UInt64.max { return } // already "to end of file"
                let end = bodyStart + size
                var stale = end > fileSize
                if !stale, end < fileSize {
                    // Something follows; it must be a real chunk, otherwise the size is out of date.
                    try? handle.seek(toOffset: end)
                    let next = (try? handle.read(upToCount: 4)).map { String(decoding: $0, as: UTF8.self) } ?? ""
                    stale = !knownChunks.contains(next)
                }
                if stale {
                    try? handle.seek(toOffset: offset + 4)
                    try? handle.write(contentsOf: Data(repeating: 0xFF, count: 8))
                }
                return
            }
            guard size != UInt64.max else { return }
            offset = bodyStart + size
        }
    }
}
