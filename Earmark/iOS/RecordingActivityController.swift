import ActivityKit
import Foundation

/// Keeps the Lock Screen / Dynamic Island Live Activity in step with the recorder.
/// A Live Activity is also what lets iOS keep a recording going while Earmark is in the background.
@MainActor
final class RecordingActivityController {
    private var activity: Activity<RecordingActivityAttributes>?
    private weak var model: AppModel?
    private var bookmarkObservation: Task<Void, Never>?

    func attach(to model: AppModel) {
        self.model = model
        model.onRecorderStateChange = { [weak self] state in self?.update(for: state) }
        // Clean up anything left over from a crash.
        for stale in Activity<RecordingActivityAttributes>.activities {
            Task { await stale.end(nil, dismissalPolicy: .immediate) }
        }
    }

    private func update(for state: Recorder.State) {
        guard let recorder = model?.recorder else { return }
        switch state {
        case .recording, .paused:
            let content = ActivityContent(state: contentState(recorder), staleDate: nil)
            if let activity {
                Task { await activity.update(content) }
            } else if ActivityAuthorizationInfo().areActivitiesEnabled {
                activity = try? Activity.request(attributes: RecordingActivityAttributes(startedAt: .now),
                                                 content: content, pushType: nil)
                watchBookmarks()
            }
        case .idle:
            bookmarkObservation?.cancel()
            if let activity {
                Task { await activity.end(nil, dismissalPolicy: .immediate) }
            }
            activity = nil
        }
    }

    private func contentState(_ recorder: Recorder) -> RecordingActivityAttributes.ContentState {
        RecordingActivityAttributes.ContentState(
            isPaused: recorder.state == .paused,
            effectiveStart: Date.now.addingTimeInterval(-recorder.elapsed),
            pausedElapsed: recorder.elapsed,
            bookmarkCount: recorder.bookmarks.count
        )
    }

    /// Bookmarks can be added from the Live Activity itself; reflect the new count.
    private func watchBookmarks() {
        bookmarkObservation?.cancel()
        bookmarkObservation = Task { [weak self] in
            var lastCount = -1
            while !Task.isCancelled {
                guard let self, let recorder = self.model?.recorder, let activity = self.activity else { return }
                if recorder.bookmarks.count != lastCount {
                    lastCount = recorder.bookmarks.count
                    await activity.update(ActivityContent(state: self.contentState(recorder), staleDate: nil))
                }
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }
}
