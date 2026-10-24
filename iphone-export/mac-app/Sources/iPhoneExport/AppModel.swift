import AppKit
import ExportCore
import Foundation

/// Everything the window and the menu bar show, and every action they can take.
/// The real work happens in the Python engine; this class starts it and turns its events into UI state.
@MainActor
final class AppModel: ObservableObject {
    // What the engine last reported about backups, phone, schedule and the last export.
    @Published var status: EngineStatus?
    @Published var statusError: String?

    // A job in progress.
    @Published var busy = false
    @Published var jobTitle = ""
    @Published var stage = ""
    @Published var progress: Double?  // nil = spinning, 0...1 = bar
    @Published var waitingForPasscode = false
    @Published var log: [String] = []

    // The end of the last job.
    @Published var result: JobResult?

    // Encrypted backup password prompt.
    @Published var passwordPrompt: PasswordPrompt?

    @Published var options: ExportOptions { didSet { saveOptions() } }
    @Published var daily = DailyBackup()

    let location: EngineLocation?
    private let runner: EngineRunner?
    private var refreshTimer: Timer?

    struct JobResult: Equatable {
        var ok: Bool
        var title: String
        var detail: String
        var index: String?
        var stats: [String: Int] = [:]
        var problems: [String] = []
    }

    struct PasswordPrompt: Identifiable, Equatable {
        var id = UUID()
        var device: String
        var wrongPassword: Bool
        var arguments: [String]
        var title: String
    }

    init() {
        location = EngineLocation.standard()
        runner = location.map { EngineRunner(location: $0) }
        if let data = UserDefaults.standard.data(forKey: "exportOptions"),
           let saved = try? JSONDecoder().decode(ExportOptions.self, from: data) {
            options = saved
        } else {
            options = ExportOptions()
        }
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 20, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.refresh() }
        }
        Task { await refresh() }
    }

    private func saveOptions() {
        if let data = try? JSONEncoder().encode(options) {
            UserDefaults.standard.set(data, forKey: "exportOptions")
        }
    }

    // MARK: - Readiness

    var engineReady: Bool { location?.isReady ?? false }
    var backupToolInstalled: Bool { status?.tools.idevicebackup2 != nil }
    var phone: PhoneConnection { status?.phoneConnection ?? .none }
    var needsFullDiskAccess: Bool { status?.access.finderBackups == "denied" }
    var canBackUp: Bool { engineReady && backupToolInstalled && phone != .none && !busy }
    var canExportLatest: Bool { engineReady && !(status?.backups.isEmpty ?? true) && !busy }

    var phoneSummary: String {
        switch phone {
        case .cable: return "iPhone connected by cable"
        case .wifi: return "iPhone found on Wi-Fi"
        case .none: return backupToolInstalled ? "iPhone not found" : "Backup tool not installed"
        }
    }

    var lastBackupSummary: String {
        guard let backup = status?.newestBackup else { return "No backups on this Mac yet" }
        let when = EngineStatus.date(backup.lastBackup).map { Self.relative($0) } ?? "unknown date"
        return "Last backup \(when) · \(backup.device)\(backup.encrypted ? " · encrypted" : "")"
    }

    var lastExportSummary: String? {
        guard let export = status?.lastExport, let date = EngineStatus.date(export.modified) else { return nil }
        return "Last export \(Self.relative(date))"
    }

    static func relative(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .full
        return f.localizedString(for: date, relativeTo: Date())
    }

    // MARK: - Status

    func refresh() async {
        guard let runner, engineReady else { return }
        do {
            status = try await runner.status(outputFolder: options.outputFolder, lookForPhone: !busy)
            statusError = nil
        } catch {
            statusError = "Couldn't read the backup status. \(error)"
        }
    }

    // MARK: - Jobs

    func backUpAndExport() {
        start("Back up & export", options.syncArguments(wifi: phone == .wifi))
    }

    func exportLatest() {
        start("Export latest backup", options.exportLatestArguments())
    }

    func exportFromMac() {
        start("Export from this Mac", options.exportFromMacArguments())
    }

    func exportSnapshot(_ snapshot: EngineStatus.Snapshot) {
        guard let when = snapshot.when else { return }
        start("Export version from \(snapshot.date.prefix(10))", options.exportSnapshotArguments(day: when))
    }

    func cancel() {
        runner?.cancel()
        stage = "Stopping…"
    }

    func submitPassword(_ password: String, for prompt: PasswordPrompt) {
        passwordPrompt = nil
        // --remember keeps the unlock key in the Keychain so this is asked once.
        start(prompt.title, prompt.arguments + ["--remember"], password: password)
    }

    private func start(_ title: String, _ arguments: [String], password: String? = nil) {
        guard let runner, !busy else { return }
        busy = true
        jobTitle = title
        stage = "Starting…"
        progress = nil
        waitingForPasscode = false
        log = []
        result = nil
        Task {
            let code = await runner.run(arguments, password: password) { event in
                DispatchQueue.main.async { self.handle(event) }
            }
            // Let queued events land before reading the result.
            await Task.yield()
            DispatchQueue.main.async { self.finish(title: title, arguments: arguments, code: code) }
        }
    }

    private func handle(_ event: EngineEvent) {
        switch event {
        case .stage(_, let message):
            stage = message
            progress = nil
            if waitingForPasscode && !message.lowercased().contains("backing up") { waitingForPasscode = false }
        case .progress(_, let done, let total):
            progress = total > 0 ? Double(done) / Double(total) : nil
            stage = "Copying attachments (\(done.formatted()) of \(total.formatted()))"
        case .passcodeWait:
            waitingForPasscode = true
        case .passwordNeeded(let device, _):
            stage = "\(device)'s backup is encrypted"
        case .done(let index, let stats, let problems):
            result = JobResult(ok: true, title: "Done", detail: Self.describe(stats), index: index,
                               stats: stats, problems: problems)
        case .error(let message, let kind):
            result = JobResult(ok: false, title: kind == "cancelled" ? "Cancelled" : "Stopped", detail: message)
        case .log(let line):
            if line.lowercased().contains("receiving files") || line.contains("Backup Successful") {
                waitingForPasscode = false
            }
            log.append(line)
            if log.count > 4000 { log.removeFirst(log.count - 4000) }
        }
    }

    private func finish(title: String, arguments: [String], code: Int32) {
        busy = false
        waitingForPasscode = false
        progress = nil
        switch EngineExit(rawValue: code) {
        case .passwordNeeded?:
            passwordPrompt = PasswordPrompt(device: status?.newestBackup?.device ?? "iPhone", wrongPassword: false,
                                            arguments: arguments, title: title)
            result = nil
        case .wrongPassword?:
            passwordPrompt = PasswordPrompt(device: status?.newestBackup?.device ?? "iPhone", wrongPassword: true,
                                            arguments: arguments.filter { $0 != "--remember" }, title: title)
            result = nil
        case .ok?:
            if result == nil {
                result = JobResult(ok: true, title: "Done", detail: "Finished.")
            }
            if options.openWhenDone, let index = result?.index {
                NSWorkspace.shared.open(URL(fileURLWithPath: index))
            }
        default:
            if result == nil || result?.ok == true {
                let last = log.last(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) ?? "Something went wrong."
                let cancelled = code == EngineExit.cancelled.rawValue || code == 15 || code == 9
                result = JobResult(ok: false, title: cancelled ? "Cancelled" : "Stopped", detail: cancelled ? "" : last)
            }
        }
        stage = ""
        Task { await refresh() }
    }

    static func describe(_ stats: [String: Int]) -> String {
        let order: [(String, String)] = [("messages", "messages"), ("conversations", "conversations"),
                                         ("photos", "photos & videos"), ("calls", "calls"),
                                         ("voicemails", "voicemails"), ("notes", "notes"), ("contacts", "contacts")]
        return order.compactMap { key, label in
            guard let n = stats[key], n > 0 else { return nil }
            return "\(n.formatted()) \(label)"
        }.joined(separator: " · ")
    }

    // MARK: - Setup

    func setUpEngine() {
        guard let location, let runner, !busy else { return }
        busy = true
        jobTitle = "Setting up"
        stage = "Creating a private Python environment (one time)…"
        log = []
        result = nil
        Task {
            var ok = true
            for (tool, args) in location.setupCommands {
                let code = await runner.runCommand(tool, args) { line in
                    DispatchQueue.main.async { self.log.append(line) }
                }
                if code != 0 { ok = false; break }
            }
            busy = false
            stage = ""
            result = ok ? JobResult(ok: true, title: "Ready", detail: "Setup finished.")
                        : JobResult(ok: false, title: "Setup failed",
                                    detail: "If macOS asked to install the Command Line Tools, finish that and try again.")
            await refresh()
        }
    }

    func installBackupTool() {
        guard let runner, !busy, let brew = status?.tools.brew ?? ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]
            .first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else { return }
        busy = true
        jobTitle = "Installing the backup tool"
        stage = "brew install libimobiledevice…"
        log = []
        result = nil
        Task {
            let code = await runner.runCommand(URL(fileURLWithPath: brew), ["install", "libimobiledevice"]) { line in
                DispatchQueue.main.async { self.log.append(line) }
            }
            busy = false
            stage = ""
            result = code == 0 ? JobResult(ok: true, title: "Installed", detail: "The backup tool is ready.")
                               : JobResult(ok: false, title: "Install failed", detail: log.last ?? "")
            await refresh()
        }
    }

    var homebrewInstalled: Bool {
        status?.tools.brew != nil || ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]
            .contains { FileManager.default.isExecutableFile(atPath: $0) }
    }

    func openFullDiskAccessSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles") {
            NSWorkspace.shared.open(url)
        }
    }

    // MARK: - Daily backup

    func applyDailyBackup(enabled: Bool) {
        guard let runner, !busy else { return }
        let args = enabled ? daily.installArguments(options: options) : DailyBackup.removeArguments
        busy = true
        jobTitle = enabled ? "Turning on daily backup" : "Turning off daily backup"
        stage = ""
        log = []
        result = nil
        Task {
            let code = await runner.run(args) { event in
                if case .log(let line) = event { DispatchQueue.main.async { self.log.append(line) } }
            }
            busy = false
            result = JobResult(ok: code == 0, title: code == 0 ? "Saved" : "Couldn't change the schedule",
                               detail: log.first ?? "")
            await refresh()
        }
    }

    func loadDailyFromStatus() {
        guard let plan = status?.schedule else { return }
        if let first = plan.hours.first, let last = plan.hours.last {
            daily.startHour = first
            daily.endHour = last
        }
        daily.wifi = plan.wifi
    }

    // MARK: - Files

    func openLastExport() {
        guard let path = result?.index ?? status?.lastExport?.path else { return }
        NSWorkspace.shared.open(URL(fileURLWithPath: path))
    }

    func revealOutputFolder() {
        let folder = (options.outputFolder as NSString).expandingTildeInPath
        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: folder)
    }

    func chooseOutputFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.prompt = "Use This Folder"
        if panel.runModal() == .OK, let url = panel.url {
            options.outputFolder = url.path
        }
    }
}
