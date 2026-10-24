import Foundation

/// Where the Python engine and its private Python live.
public struct EngineLocation: Sendable {
    /// Folder that contains the `iphone_export` package and requirements.txt.
    public var engineDirectory: URL
    /// The private environment the app (and the double-click launchers) share.
    public var venv: URL
    public var systemPython: URL

    public init(engineDirectory: URL,
                venv: URL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".iphone-export-venv"),
                systemPython: URL = URL(fileURLWithPath: "/usr/bin/python3")) {
        self.engineDirectory = engineDirectory
        self.venv = venv
        self.systemPython = systemPython
    }

    public var python: URL { venv.appendingPathComponent("bin/python") }
    public var isReady: Bool { FileManager.default.isExecutableFile(atPath: python.path) }

    /// The app bundle keeps the engine in Contents/Resources/engine. When run from source (swift run),
    /// look upward from the working directory for the repo's iphone_export folder instead.
    public static func standard(bundle: Bundle = .main) -> EngineLocation? {
        if let override = ProcessInfo.processInfo.environment["IPHONE_EXPORT_ENGINE_DIR"] {
            return EngineLocation(engineDirectory: URL(fileURLWithPath: override))
        }
        if let resources = bundle.resourceURL?.appendingPathComponent("engine"),
           FileManager.default.fileExists(atPath: resources.appendingPathComponent("iphone_export").path) {
            return EngineLocation(engineDirectory: resources)
        }
        var dir = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        for _ in 0..<4 {
            if FileManager.default.fileExists(atPath: dir.appendingPathComponent("iphone_export/cli.py").path) {
                return EngineLocation(engineDirectory: dir)
            }
            dir.deleteLastPathComponent()
        }
        return nil
    }

    /// Commands that create the private Python environment (first launch only).
    public var setupCommands: [(URL, [String])] {
        [
            (systemPython, ["-m", "venv", venv.path]),
            (venv.appendingPathComponent("bin/pip"),
             ["install", "--quiet", "-r", engineDirectory.appendingPathComponent("requirements.txt").path]),
        ]
    }
}

/// Runs `python -m iphone_export ...` and streams its output as EngineEvents.
public final class EngineRunner: @unchecked Sendable {
    public let location: EngineLocation
    private let lock = NSLock()
    private var current: Process?

    public init(location: EngineLocation) {
        self.location = location
    }

    /// Homebrew's folders aren't on an app's PATH; idevicebackup2 lives there.
    public static func environment(base: [String: String] = ProcessInfo.processInfo.environment,
                                   password: String? = nil) -> [String: String] {
        var env = base
        let path = env["PATH"] ?? "/usr/bin:/bin:/usr/sbin:/sbin"
        env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:" + path
        env["IPHONE_EXPORT_EVENTS"] = "1"
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        if let password { env["IPHONE_BACKUP_PASSWORD"] = password } else { env.removeValue(forKey: "IPHONE_BACKUP_PASSWORD") }
        return env
    }

    /// Run the engine with `arguments`; `onEvent` is called on a background thread for every output line.
    @discardableResult
    public func run(_ arguments: [String], password: String? = nil,
                    python: URL? = nil,
                    onEvent: @escaping @Sendable (EngineEvent) -> Void) async -> Int32 {
        await Self.execute(executable: python ?? location.python, arguments: ["-m", "iphone_export"] + arguments,
                           directory: location.engineDirectory,
                           environment: Self.environment(password: password),
                           register: { [weak self] p in self?.setCurrent(p) }) { line in
            onEvent(EngineEvent.parse(line))
        }
    }

    /// Run any command (used for first-launch setup and `brew install`), streaming plain lines.
    @discardableResult
    public func runCommand(_ executable: URL, _ arguments: [String],
                           onLine: @escaping @Sendable (String) -> Void) async -> Int32 {
        await Self.execute(executable: executable, arguments: arguments, directory: location.engineDirectory,
                           environment: Self.environment(), register: { [weak self] p in self?.setCurrent(p) },
                           onLine: onLine)
    }

    /// The engine's `status` JSON.
    public func status(outputFolder: String, lookForPhone: Bool = true) async throws -> EngineStatus {
        let collected = LinesBox()
        var args = ["status", "--compact", "--out", (outputFolder as NSString).expandingTildeInPath]
        if !lookForPhone { args.append("--no-devices") }
        let code = await Self.execute(executable: location.python, arguments: ["-m", "iphone_export"] + args,
                                      directory: location.engineDirectory, environment: Self.environment(),
                                      register: { _ in }) { collected.append($0) }
        let json = collected.lines.first { $0.hasPrefix("{") } ?? ""
        guard code == 0, let data = json.data(using: .utf8) else {
            throw EngineError.statusFailed(collected.lines.joined(separator: "\n"))
        }
        return try EngineStatus.decode(data)
    }

    /// Stop whatever is running (the Cancel button): ask nicely, then force it after 3 seconds.
    public func cancel() {
        lock.lock()
        let p = current
        lock.unlock()
        guard let p, p.isRunning else { return }
        p.terminate()
        let pid = p.processIdentifier
        DispatchQueue.global().asyncAfter(deadline: .now() + 3) {
            if p.isRunning { kill(pid, SIGKILL) }
        }
    }

    private func setCurrent(_ p: Process?) {
        lock.lock()
        current = p
        lock.unlock()
    }

    static func execute(executable: URL, arguments: [String], directory: URL, environment: [String: String],
                        register: @escaping @Sendable (Process?) -> Void,
                        onLine: @escaping @Sendable (String) -> Void) async -> Int32 {
        await withCheckedContinuation { (continuation: CheckedContinuation<Int32, Never>) in
            let process = Process()
            process.executableURL = executable
            process.arguments = arguments
            process.currentDirectoryURL = directory
            process.environment = environment
            let pipe = Pipe()
            process.standardOutput = pipe
            process.standardError = pipe
            process.standardInput = FileHandle.nullDevice
            do {
                try process.run()
            } catch {
                onLine("Couldn't start \(executable.path): \(error.localizedDescription)")
                continuation.resume(returning: -1)
                return
            }
            register(process)
            // Read on a background thread until EOF, then wait for the exit code.
            Thread.detachNewThread {
                let handle = pipe.fileHandleForReading
                var buffer = LineBuffer()
                while true {
                    let data = handle.availableData
                    if data.isEmpty { break }
                    for line in buffer.append(data) { onLine(line) }
                }
                for line in buffer.flush() { onLine(line) }
                process.waitUntilExit()
                register(nil)
                continuation.resume(returning: process.terminationStatus)
            }
        }
    }
}

public enum EngineError: Error, Equatable {
    case statusFailed(String)
}

/// Thread-safe line collector.
final class LinesBox: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String] = []
    func append(_ line: String) { lock.lock(); storage.append(line); lock.unlock() }
    var lines: [String] { lock.lock(); defer { lock.unlock() }; return storage }
}
