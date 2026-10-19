import SwiftUI
import Speech
import UniformTypeIdentifiers

struct SettingsView: View {
    @Environment(AppModel.self) private var model

    @AppStorage(AppSettings.Key.useICloud) private var useICloud = true
    @AppStorage(AppSettings.Key.quality) private var quality = RecordingQuality.standard.rawValue
    @AppStorage(AppSettings.Key.enhancedVoice) private var enhancedVoice = false
    @AppStorage(AppSettings.Key.autoTranscribe) private var autoTranscribe = true
    @AppStorage(AppSettings.Key.liveTranscription) private var liveTranscription = true
    @AppStorage(AppSettings.Key.autoInsights) private var autoInsights = true
    @AppStorage(AppSettings.Key.tagLocation) private var tagLocation = false
    @AppStorage(AppSettings.Key.transcriptionLocale) private var transcriptionLocale = ""
    @AppStorage(AppSettings.Key.stopProtection) private var stopProtection = StopProtection.hold.rawValue
    @AppStorage(AppSettings.Key.lockScreenStop) private var lockScreenStop = false
    @AppStorage(AppSettings.Key.shortcutWhileRecording) private var shortcutWhileRecording = ShortcutWhileRecording.bookmark.rawValue
    @AppStorage(AppSettings.Key.pauseReminders) private var pauseReminders = true
    #if os(macOS)
    @AppStorage(AppSettings.Key.macHotKeyEnabled) private var hotKeyEnabled = true
    #endif

    @State private var locales: [Locale] = []
    @State private var showImporter = false
    @State private var importProgress: (done: Int, total: Int)?
    @State private var importResult: String?
    @State private var isMovingStorage = false

    var body: some View {
        Form {
            Section {
                Toggle("Store in iCloud Drive", isOn: Binding(get: { useICloud }, set: { newValue in
                    isMovingStorage = true
                    Task {
                        do { try await model.library.setUseICloud(newValue) } catch { model.errorMessage = error.localizedDescription }
                        useICloud = newValue
                        isMovingStorage = false
                    }
                }))
                .disabled(isMovingStorage)
                Text(storageDescription).font(.footnote).foregroundStyle(.secondary)
            } header: { Text("Storage & Sync") }

            Section("Recording") {
                Picker("Quality", selection: $quality) {
                    ForEach(RecordingQuality.allCases) { Text($0.label).tag($0.rawValue) }
                }
                Toggle("Enhanced voice (noise & echo reduction)", isOn: $enhancedVoice)
                Toggle("Name recordings by location", isOn: $tagLocation)
                    .onChange(of: tagLocation) { _, on in if on { model.locationTagger.requestPermissionIfNeeded() } }
                #if os(macOS)
                Toggle("Global shortcut ⌃⌥⌘R starts/stops recording", isOn: $hotKeyEnabled)
                #endif
            }

            Section {
                Picker("To stop a recording", selection: $stopProtection) {
                    ForEach(StopProtection.allCases) { Text($0.label).tag($0.rawValue) }
                }
                Picker(shortcutLabel, selection: $shortcutWhileRecording) {
                    ForEach(ShortcutWhileRecording.allCases) { Text($0.label).tag($0.rawValue) }
                }
                #if os(iOS)
                Toggle("Stop button on Lock Screen", isOn: $lockScreenStop)
                #endif
                Toggle("Remind me if a recording stays paused", isOn: $pauseReminders)
            } header: {
                Text("Accidental Stop Protection")
            } footer: {
                Text("Earmark also saves recordings that are cut short by a crash, force quit or dead battery, and adds them to your library next time it opens.")
            }

            Section {
                Toggle("Transcribe automatically", isOn: $autoTranscribe)
                Toggle("Live transcript while recording", isOn: $liveTranscription)
                Picker("Language", selection: $transcriptionLocale) {
                    Text("Same as device").tag("")
                    ForEach(locales, id: \.identifier) { locale in
                        Text(Locale.current.localizedString(forIdentifier: locale.identifier) ?? locale.identifier)
                            .tag(locale.identifier)
                    }
                }
                Toggle("Titles, summaries & action items", isOn: $autoInsights)
                    .disabled(!InsightsGenerator.isAvailable)
            } header: {
                Text("Transcription & Intelligence")
            } footer: {
                Text(InsightsGenerator.isAvailable
                     ? "Everything runs on this device. Audio and transcripts never leave your iCloud."
                     : "Summaries need Apple Intelligence. Transcription runs on this device.")
            }

            Section {
                Button("Import from Just Press Record…") { showImporter = true }
                if let importProgress {
                    ProgressView(value: Double(importProgress.done), total: Double(max(importProgress.total, 1))) {
                        Text("Importing \(importProgress.done) of \(importProgress.total)")
                    }
                }
                if let importResult { Text(importResult).font(.footnote) }
            } header: {
                Text("Import")
            } footer: {
                Text("Choose the “Just Press Record” folder in iCloud Drive. Recordings are copied with their original dates; transcripts are reused when the file has one, and made fresh otherwise.")
            }

            Section {
                NavigationLink("Recently Deleted") { RecentlyDeletedView() }
                LabeledContent("Recordings", value: "\(model.library.items.count)")
                LabeledContent("Total length", value: TimeFormat.duration(model.library.items.reduce(0) { $0 + $1.metadata.duration }))
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Settings")
        .task {
            locales = await SpeechTranscriber.supportedLocales.sorted { $0.identifier < $1.identifier }
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.folder]) { result in
            guard case .success(let folder) = result else { return }
            Task { await runImport(folder) }
        }
    }

    private var shortcutLabel: String {
        #if os(macOS)
        return "⌃⌥⌘R while recording"
        #else
        return "Action Button while recording"
        #endif
    }

    private var storageDescription: String {
        switch model.library.storage {
        case .iCloud: return "Recordings are saved to iCloud Drive › Earmark, so they're on your iPhone, Mac and in Finder automatically."
        case .local: return "Recordings stay on this device only."
        case .iCloudUnavailable: return "You're not signed in to iCloud, so recordings are saved on this device for now."
        }
    }

    private func runImport(_ folder: URL) async {
        importResult = nil
        let summary = await JustPressRecordImporter.importFolder(folder, into: model.library) { done, total in
            importProgress = (done, total)
        }
        importProgress = nil
        importResult = "Imported \(summary.imported) recordings (\(summary.transcriptsFound) with transcripts). Skipped \(summary.skipped)."
        model.processing.scan()
    }
}
