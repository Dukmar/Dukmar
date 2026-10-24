import Foundation

/// What `python3 -m iphone_export status` reports: backups, phone, schedule, last export.
public struct EngineStatus: Codable, Equatable, Sendable {
    public struct Tools: Codable, Equatable, Sendable {
        public var idevicebackup2: String?
        public var brew: String?
        public var pdfBrowser: String?
    }

    public struct Devices: Codable, Equatable, Sendable {
        public var usb: [String]
        public var wifi: [String]
    }

    public struct Access: Codable, Equatable, Sendable {
        /// "ok", "denied" (needs Full Disk Access) or "missing" (no Finder backups folder yet)
        public var finderBackups: String
    }

    public struct Backup: Codable, Equatable, Sendable, Identifiable {
        public var device: String
        public var ios: String
        public var udid: String
        public var path: String
        public var lastBackup: String?
        public var encrypted: Bool
        public var id: String { path }
    }

    public struct Snapshot: Codable, Equatable, Sendable, Identifiable {
        public var date: String
        public var device: String
        public var path: String
        public var id: String { path }

        /// "2026-10-24T19:00" -> Date
        public var when: Date? { EngineStatus.parseDate(date) }
    }

    public struct Schedule: Codable, Equatable, Sendable {
        public var hours: [Int]
        public var wifi: Bool
        public var window: String?
    }

    public struct LastExport: Codable, Equatable, Sendable {
        public var path: String
        public var modified: String?
    }

    public var version: String
    public var python: String
    public var tools: Tools
    public var devices: Devices
    public var access: Access
    public var backups: [Backup]
    public var snapshots: [Snapshot]
    public var schedule: Schedule?
    public var lastExport: LastExport?
    public var output: String

    public static func decode(_ data: Data) throws -> EngineStatus {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(EngineStatus.self, from: data)
    }

    public var phoneConnection: PhoneConnection {
        if !devices.usb.isEmpty { return .cable }
        if !devices.wifi.isEmpty { return .wifi }
        return .none
    }

    public var newestBackup: Backup? { backups.first }

    static func parseDate(_ text: String?) -> Date? {
        guard let text else { return nil }
        let withZone = ISO8601DateFormatter()
        if let d = withZone.date(from: text) { return d }
        let local = DateFormatter()
        local.locale = Locale(identifier: "en_US_POSIX")
        for format in ["yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd'T'HH:mm"] {
            local.dateFormat = format
            if let d = local.date(from: text) { return d }
        }
        return nil
    }

    public static func date(_ text: String?) -> Date? { parseDate(text) }
}

public enum PhoneConnection: String, Sendable {
    case cable, wifi, none
}
