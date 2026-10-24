import ExportCore
import SwiftUI

// MARK: - Export options

struct OptionsTab: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Form {
            Section("Include") {
                HStack(spacing: 16) {
                    ForEach(ExportOptions.Section.allCases, id: \.self) { section in
                        Toggle(section.title, isOn: Binding(
                            get: { model.options.sections.contains(section) },
                            set: { on in
                                if on { model.options.sections.insert(section) } else { model.options.sections.remove(section) }
                            }))
                    }
                }
            }
            Section("Which messages") {
                OptionalDate(label: "From", date: $model.options.since)
                OptionalDate(label: "To", date: $model.options.until)
                TextField("Only with (names, numbers or emails, comma separated)", text: $model.options.contact)
                TextField("Your name in the export (instead of \"Me\")", text: $model.options.meName)
            }
            Section("Files") {
                Toggle("Copy photos, videos and attachments", isOn: $model.options.attachments)
                Toggle("Convert iPhone photos and voice notes so any browser can open them",
                       isOn: $model.options.convertMedia)
                Toggle("Also make PDFs (for printing or sending)", isOn: $model.options.pdf)
                if model.options.pdf && model.status?.tools.pdfBrowser == nil {
                    Text("PDFs need Google Chrome, Edge or Brave installed.").foregroundStyle(.orange)
                }
                Toggle("Open the export when it's done", isOn: $model.options.openWhenDone)
                LabeledContent("Save to") {
                    HStack {
                        Text(model.options.outputFolder).lineLimit(1).truncationMode(.middle)
                        Button("Choose…") { model.chooseOutputFolder() }
                        Button("Show") { model.revealOutputFolder() }
                    }
                }
            }
            Section {
                Button("Export from this Mac instead (Messages in iCloud, no phone needed)") { model.exportFromMac() }
                    .disabled(model.busy || !model.engineReady)
            }
        }
        .formStyle(.grouped)
    }
}

struct OptionalDate: View {
    let label: String
    @Binding var date: Date?

    var body: some View {
        HStack {
            Toggle(label, isOn: Binding(get: { date != nil }, set: { date = $0 ? (date ?? Date()) : nil }))
            Spacer()
            if date != nil {
                DatePicker("", selection: Binding(get: { date ?? Date() }, set: { date = $0 }),
                           displayedComponents: .date)
                    .labelsHidden()
            } else {
                Text(label == "From" ? "the beginning" : "today").foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Dated versions

struct VersionsTab: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        let snapshots = model.status?.snapshots ?? []
        VStack(alignment: .leading, spacing: 10) {
            Text("A dated copy is kept after each backup this app makes, for \(model.daily.keepDays) days. "
                 + "Export an older one to get back something that has since been deleted from the phone.")
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if snapshots.isEmpty {
                Text("No dated versions yet. They appear after the first Back Up & Export.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, minHeight: 120)
            } else {
                List(snapshots) { snap in
                    HStack {
                        Text(snap.when.map { $0.formatted(date: .abbreviated, time: .shortened) } ?? snap.date)
                            .frame(width: 200, alignment: .leading)
                        Text(snap.device).foregroundStyle(.secondary)
                        Spacer()
                        Button("Export") { model.exportSnapshot(snap) }
                            .disabled(model.busy)
                    }
                    .frame(height: 28)
                }
            }
        }
        .padding(12)
    }
}

// MARK: - Daily backup

struct DailyTab: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Form {
            Section {
                if let plan = model.status?.schedule {
                    Label("On: tries every hour \(plan.window ?? "") \(plan.wifi ? "over Wi-Fi" : "by cable") until one backup works",
                          systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                } else {
                    Label("Off", systemImage: "moon.zzz")
                }
            }
            Section("When") {
                Picker("Start trying at", selection: $model.daily.startHour) {
                    ForEach(0..<24, id: \.self) { Text(String(format: "%02d:00", $0)).tag($0) }
                }
                Picker("Stop trying at", selection: $model.daily.endHour) {
                    ForEach(0..<24, id: \.self) { Text(String(format: "%02d:00", $0)).tag($0) }
                }
                Toggle("Over Wi-Fi (no cable needed)", isOn: $model.daily.wifi)
                Stepper("Keep dated versions for \(model.daily.keepDays) days", value: $model.daily.keepDays, in: 1...365)
            }
            Section {
                Text("Apple asks for the iPhone's passcode before every backup (since iOS 16.1), so pick hours when "
                     + "the phone is usually nearby. The Mac shows a notification when the phone is asking. "
                     + "The Mac needs to be awake and the phone on the same Wi-Fi.")
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack {
                    Button(model.status?.schedule == nil ? "Turn On" : "Save Changes") {
                        model.applyDailyBackup(enabled: true)
                    }
                    .disabled(model.busy || !model.backupToolInstalled)
                    if model.status?.schedule != nil {
                        Button("Turn Off") { model.applyDailyBackup(enabled: false) }
                            .disabled(model.busy)
                    }
                }
                if !model.backupToolInstalled {
                    Text("Install the backup tool on the Setup tab first.").foregroundStyle(.orange)
                }
            }
        }
        .formStyle(.grouped)
        .onAppear { model.loadDailyFromStatus() }
    }
}

// MARK: - Setup

struct SetupTab: View {
    @EnvironmentObject var model: AppModel

    var body: some View {
        Form {
            Section("Checklist") {
                SetupRow(done: model.engineReady, title: "Python environment",
                         detail: model.engineReady ? "Ready" : "Needed once") {
                    if !model.engineReady { Button("Set Up") { model.setUpEngine() }.disabled(model.busy) }
                }
                SetupRow(done: model.backupToolInstalled, title: "Backup tool (libimobiledevice)",
                         detail: model.backupToolInstalled ? "Installed" : "Needed to back up from this app") {
                    if !model.backupToolInstalled {
                        if model.homebrewInstalled {
                            Button("Install") { model.installBackupTool() }.disabled(model.busy)
                        } else {
                            Link("Get Homebrew first", destination: URL(string: "https://brew.sh")!)
                        }
                    }
                }
                SetupRow(done: !model.needsFullDiskAccess, title: "Full Disk Access",
                         detail: model.needsFullDiskAccess
                            ? "macOS is hiding Finder's backups from this app. Switch on iPhone Export in the list, then reopen the app."
                            : "Can read Finder's backups") {
                    if model.needsFullDiskAccess {
                        Button("Open Settings") { model.openFullDiskAccessSettings() }
                    }
                }
                SetupRow(done: model.phone == .wifi || model.status?.schedule?.wifi == true, title: "Wi-Fi backups",
                         detail: "With the iPhone plugged in: select it in Finder, tick \"Show this iPhone when on Wi-Fi\", click Apply.") {
                    EmptyView()
                }
                SetupRow(done: model.status?.tools.pdfBrowser != nil, title: "PDFs (optional)",
                         detail: model.status?.tools.pdfBrowser != nil ? "Chrome found" : "Install Google Chrome to make PDFs") {
                    EmptyView()
                }
            }
            Section("About") {
                LabeledContent("Engine", value: model.status.map { "\($0.version) · Python \($0.python)" } ?? "not running")
                LabeledContent("Backups kept in", value: "~/iPhone Backups (made by this app) and Finder's own")
                if let error = model.statusError {
                    Text(error).foregroundStyle(.red).font(.caption)
                }
            }
        }
        .formStyle(.grouped)
    }
}

struct SetupRow<Accessory: View>: View {
    let done: Bool
    let title: String
    let detail: String
    @ViewBuilder let accessory: () -> Accessory

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(done ? Color.green : Color.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                Text(detail).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            accessory()
        }
        .frame(minHeight: 36)
    }
}
