import Foundation

enum TimeFormat {
    /// 75 → "1:15", 3725 → "1:02:05"
    static func timestamp(_ t: TimeInterval) -> String {
        let total = Int(max(0, t).rounded(.down))
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }

    /// Running clock with tenths, for the recording screen.
    static func clock(_ t: TimeInterval) -> String {
        let tenths = Int((t * 10).rounded(.down)) % 10
        return "\(timestamp(t)).\(tenths)"
    }

    static func duration(_ t: TimeInterval) -> String {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = t >= 3600 ? [.hour, .minute] : [.minute, .second]
        formatter.unitsStyle = .abbreviated
        return formatter.string(from: t) ?? timestamp(t)
    }

    static func caption(_ t: TimeInterval, separator: String) -> String {
        let ms = Int((t * 1000).rounded()) % 1000
        let total = Int(t)
        return String(format: "%02d:%02d:%02d%@%03d", total / 3600, (total % 3600) / 60, total % 60, separator, ms)
    }
}
