import Foundation
import XCTest
@testable import ExportCore

final class EventTests: XCTestCase {
    func testParsesEveryEventType() {
        XCTAssertEqual(EngineEvent.parse(#"@@EVENT {"type": "stage", "stage": "messages", "message": "Reading messages"}"#),
                       .stage(name: "messages", message: "Reading messages"))
        XCTAssertEqual(EngineEvent.parse(#"@@EVENT {"type": "progress", "stage": "attachments", "done": 25, "total": 300}"#),
                       .progress(stage: "attachments", done: 25, total: 300))
        XCTAssertEqual(EngineEvent.parse(#"@@EVENT {"type": "passcode_wait", "minutes": 15}"#), .passcodeWait(minutes: 15))
        XCTAssertEqual(EngineEvent.parse(#"@@EVENT {"type": "password_needed", "device": "Colin's iPhone", "udid": "abc"}"#),
                       .passwordNeeded(device: "Colin's iPhone", udid: "abc"))
        XCTAssertEqual(EngineEvent.parse(#"@@EVENT {"type": "done", "index": "/x/index.html", "stats": {"messages": 15, "calls": 5}, "problems": ["one"]}"#),
                       .done(index: "/x/index.html", stats: ["messages": 15, "calls": 5], problems: ["one"]))
        XCTAssertEqual(EngineEvent.parse(#"@@EVENT {"type": "error", "message": "nope", "kind": "disk"}"#),
                       .error(message: "nope", kind: "disk"))
    }

    func testOtherLinesAreLogText() {
        XCTAssertEqual(EngineEvent.parse("Contacts: 3 numbers"), .log("Contacts: 3 numbers"))
        XCTAssertEqual(EngineEvent.parse("@@EVENT not json"), .log("@@EVENT not json"))
        XCTAssertEqual(EngineEvent.parse(#"@@EVENT {"type": "future_thing"}"#), .log(#"@@EVENT {"type": "future_thing"}"#))
    }

    func testLineBufferHoldsPartialLinesAndSplitCharacters() {
        var buffer = LineBuffer()
        XCTAssertEqual(buffer.append(Data("one\ntw".utf8)), ["one"])
        let heart = Array("\u{2764}\n".utf8)  // multi-byte character split across reads
        XCTAssertEqual(buffer.append(Data("o ".utf8) + Data(heart[0..<1])), [])
        XCTAssertEqual(buffer.append(Data(heart[1...])), ["two \u{2764}"])
        XCTAssertEqual(buffer.append(Data("crlf\r\nend".utf8)), ["crlf"])
        XCTAssertEqual(buffer.flush(), ["end"])
        XCTAssertEqual(buffer.flush(), [])
    }
}

final class OptionTests: XCTestCase {
    func day(_ text: String) -> Date { ExportOptions.dayFormat.date(from: text)! }

    func testDefaultsExportEverythingWithMediaConversion() {
        let o = ExportOptions()
        let args = o.exportLatestArguments()
        XCTAssertEqual(args.first, "export")
        XCTAssertFalse(args.contains("--only"))
        XCTAssertTrue(args.contains("--convert-media"))
        XCTAssertFalse(args.contains("--pdf"))
        XCTAssertTrue(args[args.firstIndex(of: "--out")! + 1].hasSuffix("/iPhone Export"))
    }

    func testChoicesBecomeArguments() {
        var o = ExportOptions()
        o.sections = [.messages, .calls]
        o.since = day("2026-10-01")
        o.until = day("2026-10-31")
        o.contact = " Alison "
        o.meName = "Colin"
        o.attachments = false
        o.convertMedia = false
        o.pdf = true
        o.outputFolder = "/tmp/out"
        XCTAssertEqual(o.syncArguments(wifi: true), [
            "sync", "--wifi", "--out", "/tmp/out", "--only", "messages,calls", "--since", "2026-10-01",
            "--until", "2026-11-01", "--contact", "Alison", "--me-name", "Colin", "--no-attachments", "--pdf",
        ])
        XCTAssertEqual(Array(o.exportSnapshotArguments(day: day("2026-10-05")).prefix(3)),
                       ["export", "--snapshot", "2026-10-05"])
        XCTAssertEqual(Array(o.exportFromMacArguments().prefix(2)), ["export", "--mac"])
    }

    func testDailyBackupArguments() {
        var d = DailyBackup()
        d.startHour = 19
        d.endHour = 22
        var o = ExportOptions()
        o.outputFolder = "/tmp/out"
        XCTAssertEqual(d.installArguments(options: o), [
            "schedule", "--window", "19:00-22:00", "--keep-days", "30", "--out", "/tmp/out", "--wifi", "--convert-media",
        ])
        XCTAssertEqual(DailyBackup.removeArguments, ["schedule", "--off"])
    }

    func testEnvironmentAddsHomebrewAndEvents() {
        let env = EngineRunner.environment(base: ["PATH": "/usr/bin", "IPHONE_BACKUP_PASSWORD": "old"], password: nil)
        XCTAssertEqual(env["PATH"], "/opt/homebrew/bin:/usr/local/bin:/usr/bin")
        XCTAssertEqual(env["IPHONE_EXPORT_EVENTS"], "1")
        XCTAssertNil(env["IPHONE_BACKUP_PASSWORD"])
        XCTAssertEqual(EngineRunner.environment(base: [:], password: "pw")["IPHONE_BACKUP_PASSWORD"], "pw")
    }
}

/// Swift driving the real Python engine against the fake backups from iphone-export/tests/fixture.py.
final class EngineIntegrationTests: XCTestCase {
    static let engineDir = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()

    var work: URL!
    var location: EngineLocation!

    override func setUpWithError() throws {
        // TEST_PYTHON: a python3 with the test dependencies (CI sets it); else the system one.
        let candidates = [ProcessInfo.processInfo.environment["TEST_PYTHON"], "/usr/bin/python3", "/usr/local/bin/python3"]
        let python = candidates.compactMap { $0 }.first { FileManager.default.isExecutableFile(atPath: $0) }
        try XCTSkipIf(python == nil, "no python3")
        work = FileManager.default.temporaryDirectory.appendingPathComponent("export-core-\(UUID().uuidString)")
        // A stand-in "venv" whose python is the system one (which has the test dependencies installed).
        let venvBin = work.appendingPathComponent("venv/bin")
        try FileManager.default.createDirectory(at: venvBin, withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(atPath: venvBin.appendingPathComponent("python").path,
                                                   withDestinationPath: python!)
        location = EngineLocation(engineDirectory: Self.engineDir, venv: work.appendingPathComponent("venv"))
    }

    override func tearDownWithError() throws {
        if let work { try? FileManager.default.removeItem(at: work) }
    }

    func makeBackup(encrypted: Bool) async throws -> URL {
        let runner = EngineRunner(location: location)
        let call = encrypted
            ? "fixture.build_encrypted_backup(r'\(work.path)/backups', r'\(work.path)/staging', 'correct horse')"
            : "fixture.build_plain_backup(r'\(work.path)/backups', r'\(work.path)/staging')"
        let code = await runner.runCommand(location.python, ["-c", "from tests import fixture; print(\(call))"]) { _ in }
        XCTAssertEqual(code, 0)
        let backups = try FileManager.default.contentsOfDirectory(atPath: work.appendingPathComponent("backups").path)
        return work.appendingPathComponent("backups").appendingPathComponent(backups[0])
    }

    func collect(_ runner: EngineRunner, _ args: [String], password: String? = nil) async -> (Int32, [EngineEvent]) {
        let box = EventsBox()
        let code = await runner.run(args, password: password) { box.append($0) }
        return (code, box.events)
    }

    func testExportStreamsStagesProgressAndDone() async throws {
        let backup = try await makeBackup(encrypted: false)
        var options = ExportOptions()
        options.outputFolder = work.appendingPathComponent("out").path
        let runner = EngineRunner(location: location)
        let (code, events) = await collect(runner, ["export", "--backup", backup.path, "--no-keychain"]
                                           + options.exportArguments().filter { $0 != "--convert-media" })
        XCTAssertEqual(code, 0, "\(events)")
        let stages = events.compactMap { if case let .stage(name, _) = $0 { return name } else { return nil } }
        XCTAssertEqual(stages, ["open", "messages", "attachments", "calls", "voicemail", "notes"])
        XCTAssertTrue(events.contains(.progress(stage: "attachments", done: 3, total: 3)))
        guard case let .done(index, stats, _)? = events.last else { return XCTFail("no done event: \(events)") }
        XCTAssertEqual(index, options.outputFolder + "/index.html")
        XCTAssertEqual(stats["messages"], 15)
        XCTAssertTrue(events.contains { if case .log(let l) = $0 { return l.contains("Contacts:") } else { return false } })

        let status = try await runner.status(outputFolder: options.outputFolder, lookForPhone: false)
        XCTAssertEqual(status.lastExport?.path, index)
        XCTAssertNotNil(EngineStatus.date(status.lastExport?.modified))
        XCTAssertEqual(status.phoneConnection, .none)
    }

    func testEncryptedBackupAsksForPasswordThenUnlocks() async throws {
        let backup = try await makeBackup(encrypted: true)
        let out = work.appendingPathComponent("out").path
        let runner = EngineRunner(location: location)
        let args = ["export", "--backup", backup.path, "--no-keychain", "--out", out, "--only", "messages"]

        let (first, events) = await collect(runner, args)
        XCTAssertEqual(first, EngineExit.passwordNeeded.rawValue)
        XCTAssertTrue(events.contains(.passwordNeeded(device: "Colin's iPhone", udid: backup.lastPathComponent)))

        let (wrong, _) = await collect(runner, args, password: "nope")
        XCTAssertEqual(wrong, EngineExit.wrongPassword.rawValue)

        let (right, done) = await collect(runner, args, password: "correct horse")
        XCTAssertEqual(right, 0)
        XCTAssertTrue(done.contains(.stage(name: "unlock", message: "Unlocking the encrypted backup")))
    }

    func testStatusDecodesRealOutput() async throws {
        let backup = try await makeBackup(encrypted: false)
        let runner = EngineRunner(location: location)
        let collected = EventsBox()
        let code = await runner.run(["status", "--compact", "--no-devices", "--backup-root",
                                     backup.deletingLastPathComponent().path, "--out", work.path]) { collected.append($0) }
        XCTAssertEqual(code, 0)
        guard case let .log(json)? = collected.events.first(where: { if case .log(let l) = $0 { return l.hasPrefix("{") } else { return false } })
        else { return XCTFail("no JSON") }
        let status = try EngineStatus.decode(Data(json.utf8))
        XCTAssertEqual(status.backups.first?.device, "Colin's iPhone")
        XCTAssertEqual(status.backups.first?.encrypted, false)
        XCTAssertNotNil(EngineStatus.date(status.backups.first?.lastBackup))
        XCTAssertNil(status.lastExport)
        XCTAssertNil(status.schedule)
    }

    func testCancelStopsALongRun() async throws {
        let runner = EngineRunner(location: location)
        let started = Date()
        Task.detached {
            try? await Task.sleep(nanoseconds: 500_000_000)
            runner.cancel()
        }
        let code = await runner.runCommand(URL(fileURLWithPath: "/bin/sleep"), ["30"]) { _ in }
        XCTAssertNotEqual(code, 0)
        XCTAssertLessThan(Date().timeIntervalSince(started), 10)
    }

    func testMissingExecutableReportsInsteadOfCrashing() async {
        let runner = EngineRunner(location: location)
        let lines = LinesBox()
        let code = await runner.runCommand(URL(fileURLWithPath: "/nonexistent/tool"), []) { lines.append($0) }
        XCTAssertEqual(code, -1)
        XCTAssertTrue(lines.lines.first?.contains("Couldn't start") ?? false)
    }
}

final class EventsBox: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [EngineEvent] = []
    func append(_ e: EngineEvent) { lock.lock(); storage.append(e); lock.unlock() }
    var events: [EngineEvent] { lock.lock(); defer { lock.unlock() }; return storage }
}
