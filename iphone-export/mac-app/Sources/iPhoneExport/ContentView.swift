import ExportCore
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var model: AppModel
    @State private var tab = Tab.options

    enum Tab: Hashable { case options, versions, daily, setup }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if !model.engineReady {
                FirstRunCard()
            } else {
                PhoneCard()
                ActionButtons()
                if model.busy {
                    ProgressCard()
                } else if let result = model.result {
                    ResultCard(result: result)
                }
            }
            TabView(selection: $tab) {
                OptionsTab().tabItem { Text("Export Options") }.tag(Tab.options)
                VersionsTab().tabItem { Text("Dated Versions") }.tag(Tab.versions)
                DailyTab().tabItem { Text("Daily Backup") }.tag(Tab.daily)
                SetupTab().tabItem { Text("Setup") }.tag(Tab.setup)
            }
        }
        .padding(20)
        .sheet(item: $model.passwordPrompt) { prompt in
            PasswordSheet(prompt: prompt)
        }
        .onAppear {
            if model.engineReady && (!model.backupToolInstalled || model.needsFullDiskAccess) { tab = .setup }
        }
    }
}

// MARK: - Top of the window

struct FirstRunCard: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 10) {
                Text("One-time setup").font(.headline)
                Text("iPhone Export needs a private Python environment to do its work. This takes about a minute "
                     + "and only happens once. If macOS offers to install the Command Line Tools, say yes.")
                    .fixedSize(horizontal: false, vertical: true)
                if model.location == nil {
                    Text("The export engine is missing from the app. Rebuild it with build-app.sh.")
                        .foregroundStyle(.red)
                } else if model.busy {
                    ProgressCard()
                } else {
                    Button("Set Up") { model.setUpEngine() }
                        .keyboardShortcut(.defaultAction)
                }
                if let result = model.result, !result.ok { ResultCard(result: result) }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(6)
        }
    }
}

struct PhoneCard: View {
    @EnvironmentObject var model: AppModel

    var icon: String {
        switch model.phone {
        case .cable: return "cable.connector"
        case .wifi: return "wifi"
        case .none: return "iphone.slash"
        }
    }

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .frame(width: 44, height: 44)
                .foregroundStyle(model.phone == .none ? Color.secondary : Color.accentColor)
            VStack(alignment: .leading, spacing: 3) {
                Text(model.phoneSummary).font(.title3.weight(.semibold))
                Text(model.lastBackupSummary).foregroundStyle(.secondary)
                if let export = model.lastExportSummary {
                    Text(export).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Button {
                Task { await model.refresh() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .help("Check again for the iPhone")
        }
    }
}

struct ActionButtons: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        HStack(spacing: 10) {
            Button {
                model.backUpAndExport()
            } label: {
                Label("Back Up & Export", systemImage: "arrow.down.doc")
                    .frame(minWidth: 170)
            }
            .controlSize(.large)
            .keyboardShortcut(.defaultAction)
            .disabled(!model.canBackUp)
            .help(model.canBackUp ? "Back up the iPhone now (\(model.phone == .wifi ? "Wi-Fi" : "cable")), then export"
                                  : "Connect the iPhone by cable or Wi-Fi first")

            Button("Export Latest Backup") { model.exportLatest() }
                .controlSize(.large)
                .disabled(!model.canExportLatest)

            Spacer()

            Button("Open Last Export") { model.openLastExport() }
                .controlSize(.large)
                .disabled(model.busy || model.status?.lastExport == nil)
        }
    }
}

struct ProgressCard: View {
    @EnvironmentObject var model: AppModel
    @State private var showLog = false

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(model.jobTitle).font(.headline)
                    Spacer()
                    Button("Cancel") { model.cancel() }
                }
                if model.waitingForPasscode {
                    Label("Unlock your iPhone and enter its passcode. Apple asks for it before every backup.",
                          systemImage: "lock.iphone")
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
                }
                Text(model.stage).foregroundStyle(.secondary)
                if let progress = model.progress {
                    ProgressView(value: progress)
                } else {
                    ProgressView().progressViewStyle(.linear)
                }
                DisclosureGroup("Details", isExpanded: $showLog) {
                    LogView(lines: model.log)
                }
            }
            .padding(6)
        }
    }
}

struct ResultCard: View {
    @EnvironmentObject var model: AppModel
    let result: AppModel.JobResult

    var body: some View {
        GroupBox {
            VStack(alignment: .leading, spacing: 6) {
                Label(result.title, systemImage: result.ok ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(.headline)
                    .foregroundStyle(result.ok ? Color.green : Color.orange)
                if !result.detail.isEmpty {
                    Text(result.detail).fixedSize(horizontal: false, vertical: true)
                }
                ForEach(result.problems, id: \.self) { problem in
                    Text("• " + problem).foregroundStyle(.secondary).font(.callout)
                }
                if result.index != nil {
                    Button("Open Export") { model.openLastExport() }
                }
                if !result.ok && !model.log.isEmpty {
                    DisclosureGroup("Details") { LogView(lines: model.log) }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(6)
        }
    }
}

struct LogView: View {
    let lines: [String]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                Text(lines.suffix(400).joined(separator: "\n"))
                    .font(.system(.caption, design: .monospaced))
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .id("end")
            }
            .frame(height: 140)
            .onChange(of: lines.count) { _ in proxy.scrollTo("end", anchor: .bottom) }
        }
    }
}

// MARK: - Password

struct PasswordSheet: View {
    @EnvironmentObject var model: AppModel
    let prompt: AppModel.PasswordPrompt
    @State private var password = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Backup password").font(.headline)
            Text("\(prompt.device)'s backup is encrypted. Enter the password you chose when you turned on "
                 + "\"Encrypt local backup\" in Finder. It isn't the phone's passcode.")
                .fixedSize(horizontal: false, vertical: true)
            if prompt.wrongPassword {
                Text("That password didn't work. Try again.").foregroundStyle(.red)
            }
            SecureField("Backup password", text: $password)
                .onSubmit(submit)
            Text("The unlock key is saved in your Keychain, so you won't be asked again.")
                .font(.caption).foregroundStyle(.secondary)
            HStack {
                Spacer()
                Button("Cancel") { model.passwordPrompt = nil }
                    .keyboardShortcut(.cancelAction)
                Button("Unlock", action: submit)
                    .keyboardShortcut(.defaultAction)
                    .disabled(password.isEmpty)
            }
        }
        .padding(20)
        .frame(width: 420)
    }

    func submit() {
        guard !password.isEmpty else { return }
        model.submitPassword(password, for: prompt)
    }
}
