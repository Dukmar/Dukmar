#if os(iOS)
import ActivityKit
import Foundation

/// Live Activity shown on the Lock Screen and in the Dynamic Island while recording.
struct RecordingActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var isPaused: Bool
        /// When the clock would read 0:00 if there had been no pauses. Lets the system run the timer.
        var effectiveStart: Date
        /// Elapsed time at the moment of pausing (shown frozen while paused).
        var pausedElapsed: TimeInterval
        var bookmarkCount: Int
        /// Off by default: a Stop button on the Lock Screen is too easy to hit in a pocket.
        var allowsStop: Bool
    }

    var startedAt: Date
}
#endif
