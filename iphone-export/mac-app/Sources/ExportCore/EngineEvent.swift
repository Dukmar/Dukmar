import Foundation

/// One line of output from the Python engine. Lines that start with `@@EVENT ` carry JSON
/// (see iphone_export/events.py); everything else is human-readable log text.
public enum EngineEvent: Equatable, Sendable {
    case stage(name: String, message: String)
    case progress(stage: String, done: Int, total: Int)
    case passcodeWait(minutes: Double)
    case passwordNeeded(device: String, udid: String)
    case done(index: String, stats: [String: Int], problems: [String])
    case error(message: String, kind: String)
    case log(String)

    public static let prefix = "@@EVENT "

    public static func parse(_ line: String) -> EngineEvent {
        guard line.hasPrefix(prefix),
              let data = line.dropFirst(prefix.count).data(using: .utf8),
              let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let type = obj["type"] as? String
        else { return .log(line) }

        func str(_ key: String) -> String { obj[key] as? String ?? "" }
        func int(_ key: String) -> Int { (obj[key] as? NSNumber)?.intValue ?? 0 }

        switch type {
        case "stage":
            return .stage(name: str("stage"), message: str("message"))
        case "progress":
            return .progress(stage: str("stage"), done: int("done"), total: int("total"))
        case "passcode_wait":
            return .passcodeWait(minutes: (obj["minutes"] as? NSNumber)?.doubleValue ?? 15)
        case "password_needed":
            return .passwordNeeded(device: str("device"), udid: str("udid"))
        case "done":
            var stats: [String: Int] = [:]
            for (key, value) in obj["stats"] as? [String: Any] ?? [:] {
                if let n = value as? NSNumber { stats[key] = n.intValue }
            }
            return .done(index: str("index"), stats: stats, problems: obj["problems"] as? [String] ?? [])
        case "error":
            return .error(message: str("message"), kind: str("kind"))
        default:
            return .log(line)
        }
    }
}

/// Exit codes the engine uses so the app can react without parsing text.
public enum EngineExit: Int32, Sendable {
    case ok = 0
    case failed = 1
    case badArguments = 2
    case noPasscode = 3
    case passwordNeeded = 4
    case wrongPassword = 5
    case cancelled = 130
}

/// Splits a byte stream into lines, holding back a trailing partial line until it completes.
public struct LineBuffer: Sendable {
    private var pending = Data()

    public init() {}

    public mutating func append(_ data: Data) -> [String] {
        pending.append(data)
        var lines: [String] = []
        while let newline = pending.firstIndex(of: 0x0A) {
            let lineData = pending[pending.startIndex..<newline]
            lines.append(String(decoding: lineData, as: UTF8.self).trimmingCharacters(in: CharacterSet(charactersIn: "\r")))
            pending.removeSubrange(pending.startIndex...newline)
        }
        return lines
    }

    public mutating func flush() -> [String] {
        guard !pending.isEmpty else { return [] }
        defer { pending.removeAll() }
        return [String(decoding: pending, as: UTF8.self)]
    }
}
