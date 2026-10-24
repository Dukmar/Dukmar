import AppKit
import ExportCore
import Foundation
import ServiceManagement

/// Files each finished month's texts from this Mac's Messages into its own folder (the engine's `archive`
/// command), then copies it on (a Google Drive folder). The app runs this itself rather than a launchd job:
/// a job that starts the app's executable directly doesn't get the app's Full Disk Access, and macOS answered
/// one by switching that access off. So when this is on, the app opens at login and waits in the menu bar.
@MainActor
final class MonthlyArchive: ObservableObject {
    @Published var enabled: Bool {
        didSet {
            UserDefaults.standard.set(enabled, forKey: Keys.enabled)
            updateLoginItem()
            if enabled { runIfDue() }
        }
    }
    @Published var copyTo: String { didSet { UserDefaults.standard.set(copyTo, forKey: Keys.copyTo) } }
    @Published private(set) var running = false
    @Published private(set) var lastResult: String
    @Published private(set) var lastSuccess: Date?
    @Published private(set) var loginItem: SMAppService.Status = .notRegistered

    /// The engine's default, so a month filed from the command line lands in the same place.
    static let destination = "~/iPhone Export/Messages by month"

    private let runner: EngineRunner?
    private var timer: Timer?

    private enum Keys {
        static let enabled = "archiveEnabled"
        static let copyTo = "archiveCopyTo"
        static let lastResult = "archiveLastResult"
        static let lastSuccess = "archiveLastSuccess"
    }

    init(location: EngineLocation?) {
        let defaults = UserDefaults.standard
        runner = location.map { EngineRunner(location: $0) }
        enabled = defaults.bool(forKey: Keys.enabled)
        copyTo = defaults.string(forKey: Keys.copyTo) ?? ""
        lastResult = defaults.string(forKey: Keys.lastResult) ?? ""
        lastSuccess = defaults.object(forKey: Keys.lastSuccess) as? Date
        loginItem = SMAppService.mainApp.status
        if enabled { updateLoginItem() }
        // Check every few hours; a run only happens until one succeeds in the current month.
        timer = Timer.scheduledTimer(withTimeInterval: 3 * 3600, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.runIfDue() }
        }
        // Give a login a minute to settle (Drive mounting, Messages syncing) before the first check.
        DispatchQueue.main.asyncAfter(deadline: .now() + 60) { [weak self] in self?.runIfDue() }
    }

    /// Every finished month is filed once a run has succeeded in the current month.
    var isDue: Bool {
        guard let lastSuccess else { return true }
        return !Calendar.current.isDate(lastSuccess, equalTo: Date(), toGranularity: .month)
    }

    func runIfDue() {
        if enabled && isDue { runNow() }
    }

    func runNow() {
        guard let runner, runner.location.isReady, !running else { return }
        running = true
        var arguments = ["archive", "--dest", (Self.destination as NSString).expandingTildeInPath]
        if !copyTo.isEmpty { arguments += ["--copy-to", copyTo] }
        Task {
            let lines = LineCollector()
            let code = await runner.run(arguments) { event in
                if case .log(let line) = event { lines.append(line) }
            }
            let summary = lines.summary()
            running = false
            lastResult = code == 0 ? summary : "Didn't finish: \(summary)"
            UserDefaults.standard.set(lastResult, forKey: Keys.lastResult)
            if code == 0 {
                lastSuccess = Date()
                UserDefaults.standard.set(lastSuccess, forKey: Keys.lastSuccess)
            }
        }
    }

    func chooseCopyFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.prompt = "Copy Here"
        if panel.runModal() == .OK, let url = panel.url {
            copyTo = url.path
        }
    }

    func revealDestination() {
        let folder = (Self.destination as NSString).expandingTildeInPath
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: folder)
    }

    func openLoginItemsSettings() {
        SMAppService.openSystemSettingsLoginItems()
    }

    private func updateLoginItem() {
        let service = SMAppService.mainApp
        do {
            if enabled && service.status != .enabled {
                try service.register()
            } else if !enabled && service.status == .enabled {
                try service.unregister()
            }
        } catch {
            lastResult = "Couldn't change the login item: \(error.localizedDescription)"
        }
        loginItem = service.status
    }
}

/// Collects the engine's plain output lines from its background thread.
private final class LineCollector: @unchecked Sendable {
    private let lock = NSLock()
    private var lines: [String] = []

    func append(_ line: String) {
        lock.lock()
        lines.append(line)
        lock.unlock()
    }

    /// The engine's closing lines say what happened ("Filed 1 month(s)...", "Couldn't copy...").
    func summary() -> String {
        lock.lock()
        defer { lock.unlock() }
        let closing = lines.filter {
            $0.hasPrefix("Filed") || $0.hasPrefix("Every finished month") || $0.hasPrefix("Copied")
                || $0.hasPrefix("Couldn't") || $0.hasPrefix("Can't") || $0.contains("export stopped")
        }
        return (closing.isEmpty ? Array(lines.suffix(1)) : closing).joined(separator: " ")
    }
}
