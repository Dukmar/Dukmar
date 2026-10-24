import Foundation

/// The choices on the app's main screen, turned into engine command-line arguments.
public struct ExportOptions: Codable, Equatable, Sendable {
    public enum Section: String, Codable, CaseIterable, Sendable {
        case messages, calls, voicemail, notes, contacts

        public var title: String {
            switch self {
            case .messages: return "Messages"
            case .calls: return "Calls"
            case .voicemail: return "Voicemail"
            case .notes: return "Notes"
            case .contacts: return "Contacts"
            }
        }
    }

    public var sections: Set<Section> = Set(Section.allCases)
    public var since: Date?
    public var until: Date?
    public var contact: String = ""
    public var meName: String = ""
    public var attachments: Bool = true
    public var convertMedia: Bool = true
    public var pdf: Bool = false
    public var outputFolder: String = "~/iPhone Export"
    public var openWhenDone: Bool = true

    public init() {}

    static let dayFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    public static func day(_ date: Date) -> String { dayFormat.string(from: date) }

    /// Arguments shared by `export`, `sync` and friends.
    public func exportArguments() -> [String] {
        var args: [String] = ["--out", (outputFolder as NSString).expandingTildeInPath]
        if sections != Set(Section.allCases), !sections.isEmpty {
            args += ["--only", Section.allCases.filter { sections.contains($0) }.map(\.rawValue).joined(separator: ",")]
        }
        if let since { args += ["--since", Self.day(since)] }
        if let until {
            // The engine's --until is exclusive; the app's "to" date is inclusive.
            let next = Calendar.current.date(byAdding: .day, value: 1, to: until) ?? until
            args += ["--until", Self.day(next)]
        }
        let who = contact.trimmingCharacters(in: .whitespaces)
        if !who.isEmpty { args += ["--contact", who] }
        let me = meName.trimmingCharacters(in: .whitespaces)
        if !me.isEmpty { args += ["--me-name", me] }
        if !attachments { args.append("--no-attachments") }
        if convertMedia { args.append("--convert-media") }
        if pdf { args.append("--pdf") }
        return args
    }

    /// Back up the phone first (cable or Wi-Fi), then export.
    public func syncArguments(wifi: Bool) -> [String] {
        ["sync"] + (wifi ? ["--wifi"] : []) + exportArguments()
    }

    /// Export the newest backup already on the Mac.
    public func exportLatestArguments() -> [String] {
        ["export"] + exportArguments()
    }

    /// Export one dated version.
    public func exportSnapshotArguments(day: Date) -> [String] {
        ["export", "--snapshot", Self.day(day)] + exportArguments()
    }

    /// Read straight from this Mac's own Messages / Notes / call history.
    public func exportFromMacArguments() -> [String] {
        ["export", "--mac"] + exportArguments()
    }
}

/// Daily backup settings, turned into `schedule` arguments.
public struct DailyBackup: Equatable, Sendable {
    public var startHour: Int = 18
    public var endHour: Int = 23
    public var wifi: Bool = true
    public var keepDays: Int = 30

    public init() {}

    public var window: String { String(format: "%02d:00-%02d:00", startHour, endHour) }

    public func installArguments(options: ExportOptions) -> [String] {
        var args = ["schedule", "--window", window, "--keep-days", String(keepDays),
                    "--out", (options.outputFolder as NSString).expandingTildeInPath]
        if wifi { args.append("--wifi") }
        if options.convertMedia { args.append("--convert-media") }
        if !options.attachments { args.append("--no-attachments") }
        return args
    }

    public static let removeArguments = ["schedule", "--off"]
}
