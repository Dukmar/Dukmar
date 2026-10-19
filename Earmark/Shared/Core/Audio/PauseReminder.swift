import Foundation
import UserNotifications

/// An accidental pause loses audio as surely as an accidental stop. While a recording sits paused,
/// remind the user after 2 and 10 minutes.
enum PauseReminder {
    private static let ids = ["earmark.paused.2", "earmark.paused.10"]

    static func schedule() {
        guard UserDefaults.standard.bool(forKey: AppSettings.Key.pauseReminders) else { return }
        let center = UNUserNotificationCenter.current()
        Task {
            let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
            guard granted else { return }
            for (id, minutes) in zip(ids, [2.0, 10.0]) {
                let content = UNMutableNotificationContent()
                content.title = "Recording is paused"
                content.body = "Earmark has been paused for \(Int(minutes)) minutes. Open it to resume or stop."
                content.sound = .default
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: minutes * 60, repeats: false)
                try? await center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            }
        }
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ids)
    }
}
