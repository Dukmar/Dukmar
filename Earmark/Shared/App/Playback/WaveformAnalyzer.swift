import AVFoundation

struct Waveform: Sendable {
    /// Peak levels, 0...1, evenly spaced across the recording.
    var samples: [Float]
    var duration: TimeInterval
    /// Stretches quiet enough and long enough to skip during playback ("Skip Silence").
    var silentRanges: [ClosedRange<TimeInterval>]

    static let empty = Waveform(samples: [], duration: 0, silentRanges: [])
}

enum WaveformAnalyzer {
    /// Reads the file once and produces `bucketCount` peaks plus silent ranges.
    static func analyze(_ url: URL, bucketCount: Int = 600,
                        silenceThreshold: Float = 0.02, minimumSilence: TimeInterval = 1.0) async throws -> Waveform {
        try await Task.detached(priority: .userInitiated) {
            let file = try AVAudioFile(forReading: url)
            let format = file.processingFormat
            let totalFrames = AVAudioFramePosition(file.length)
            guard totalFrames > 0 else { return .empty }
            let duration = Double(totalFrames) / format.sampleRate
            let framesPerBucket = max(1, Int(totalFrames) / bucketCount)
            let chunkFrames: AVAudioFrameCount = 65_536
            guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: chunkFrames) else { return .empty }

            var peaks: [Float] = []
            peaks.reserveCapacity(bucketCount)
            var bucketPeak: Float = 0
            var bucketFill = 0

            // Silence detection works on ~50 ms windows.
            let windowFrames = max(1, Int(format.sampleRate * 0.05))
            var windowPeak: Float = 0
            var windowFill = 0
            var framePosition = 0
            var silenceStart: Int?
            var silentRanges: [ClosedRange<TimeInterval>] = []

            func appendSilence(_ startFrame: Int, _ endFrame: Int) {
                let start = Double(startFrame) / format.sampleRate
                let end = Double(endFrame) / format.sampleRate
                // Leave a little air on both sides so speech isn't clipped.
                if end - start >= minimumSilence {
                    silentRanges.append((start + 0.25)...(end - 0.25))
                }
            }

            while file.framePosition < file.length {
                try Task.checkCancellation()
                try file.read(into: buffer, frameCount: chunkFrames)
                guard let channels = buffer.floatChannelData, buffer.frameLength > 0 else { break }
                let channelCount = Int(format.channelCount)
                for frame in 0..<Int(buffer.frameLength) {
                    var value: Float = 0
                    for channel in 0..<channelCount { value = max(value, abs(channels[channel][frame])) }

                    bucketPeak = max(bucketPeak, value)
                    bucketFill += 1
                    if bucketFill == framesPerBucket {
                        peaks.append(bucketPeak)
                        bucketPeak = 0
                        bucketFill = 0
                    }

                    windowPeak = max(windowPeak, value)
                    windowFill += 1
                    if windowFill == windowFrames {
                        let windowStart = framePosition - windowFrames + 1
                        if windowPeak < silenceThreshold {
                            if silenceStart == nil { silenceStart = windowStart }
                        } else if let start = silenceStart {
                            appendSilence(start, windowStart)
                            silenceStart = nil
                        }
                        windowPeak = 0
                        windowFill = 0
                    }
                    framePosition += 1
                }
            }
            if bucketFill > 0 { peaks.append(bucketPeak) }
            if let start = silenceStart { appendSilence(start, framePosition) }

            // Scale so the loudest part fills the view; speech is often quiet.
            let maxPeak = max(peaks.max() ?? 1, 0.05)
            return Waveform(samples: peaks.map { min(1, $0 / maxPeak) }, duration: duration, silentRanges: silentRanges)
        }.value
    }
}
