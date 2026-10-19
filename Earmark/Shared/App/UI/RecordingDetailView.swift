import SwiftUI

struct RecordingDetailView: View {
    @Environment(AppModel.self) private var model
    let recordingID: UUID

    enum Pane: String, CaseIterable, Identifiable {
        case transcript = "Transcript"
        case summary = "Summary"
        case notes = "Notes"
        var id: String { rawValue }
    }

    @State private var pane: Pane = .transcript
    @State private var isEditingTitle = false
    @State private var draftTitle = ""
    @State private var newTag = ""
    @State private var showTrim = false
    @State private var showDeleteConfirm = false
    @State private var noteDraft = ""

    private var item: RecordingItem? { model.library.item(withID: recordingID) }
    private var player: PlaybackController { model.player }

    var body: some View {
        if let item {
            content(for: item)
                .onAppear { prepare(item) }
                .onChange(of: item.isDownloaded) { _, _ in prepare(item) }
                .sheet(isPresented: $showTrim) { TrimView(item: item) }
        } else {
            ContentUnavailableView("Recording not found", systemImage: "waveform.slash")
        }
    }

    private func prepare(_ item: RecordingItem) {
        if item.isDownloaded { player.load(item) } else { model.library.ensureDownloaded(item) }
    }

    @ViewBuilder
    private func content(for item: RecordingItem) -> some View {
        let m = item.metadata
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header(item)
                    playerSection(item)
                    Picker("Section", selection: $pane) {
                        ForEach(Pane.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()

                    switch pane {
                    case .transcript: transcriptSection(item, proxy: proxy)
                    case .summary: summarySection(item)
                    case .notes: notesSection(item)
                    }
                }
                .padding()
                .frame(maxWidth: 760, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle(m.displayTitle)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar { toolbar(item) }
        .confirmationDialog("Move this recording to Recently Deleted?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                Task { await model.delete([item.id]) }
            }
        }
    }

    // MARK: Header

    private func header(_ item: RecordingItem) -> some View {
        let m = item.metadata
        return VStack(alignment: .leading, spacing: 6) {
            if isEditingTitle {
                TextField("Title", text: $draftTitle)
                    .font(.title2.bold())
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { commitTitle(item) }
            } else {
                Text(m.displayTitle)
                    .font(.title2.bold())
                    .onTapGesture {
                        draftTitle = m.title ?? ""
                        isEditingTitle = true
                    }
                    .accessibilityHint("Tap to rename")
            }
            HStack(spacing: 10) {
                Label(m.createdAt.formatted(date: .abbreviated, time: .shortened), systemImage: "calendar")
                Label(TimeFormat.duration(m.duration), systemImage: "clock")
                Label(m.source.rawValue, systemImage: m.source.symbolName)
                if let place = m.place?.name { Label(place, systemImage: "mappin") }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            .labelStyle(.titleAndIcon)

            tagEditor(item)
        }
    }

    private func commitTitle(_ item: RecordingItem) {
        let title = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        model.library.update(item.id) { $0.title = title.isEmpty ? nil : title }
        isEditingTitle = false
    }

    private func tagEditor(_ item: RecordingItem) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(item.metadata.tags, id: \.self) { tag in
                    Button {
                        model.library.update(item.id) { $0.tags.removeAll { $0 == tag } }
                    } label: {
                        Label("#\(tag)", systemImage: "xmark")
                            .labelStyle(TrailingIconLabelStyle())
                            .font(.caption)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityLabel("Remove tag \(tag)")
                }
                TextField("Add tag", text: $newTag)
                    .font(.caption)
                    .frame(width: 90)
                    .onSubmit {
                        let tag = newTag.lowercased().trimmingCharacters(in: .whitespaces)
                        if !tag.isEmpty { model.library.update(item.id) { if !$0.tags.contains(tag) { $0.tags.append(tag) } } }
                        newTag = ""
                    }
            }
        }
    }

    // MARK: Player

    @ViewBuilder
    private func playerSection(_ item: RecordingItem) -> some View {
        if !item.isDownloaded {
            HStack {
                ProgressView()
                Text("Downloading from iCloud…").foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, minHeight: 80)
        } else {
            VStack(spacing: 10) {
                WaveformScrubber(waveform: player.waveform, duration: max(player.duration, item.metadata.duration),
                                 currentTime: player.currentTime, bookmarks: item.metadata.bookmarks) { player.seek(to: $0) }
                    .frame(height: 64)
                HStack {
                    Text(TimeFormat.timestamp(player.currentTime))
                    Spacer()
                    Text("-" + TimeFormat.timestamp(max(0, player.duration - player.currentTime)))
                }
                .font(.caption.monospacedDigit())
                .foregroundStyle(.secondary)

                HStack(spacing: 28) {
                    Menu {
                        Picker("Speed", selection: Binding(get: { model.player.rate }, set: { model.player.rate = $0 })) {
                            ForEach(PlaybackController.rates, id: \.self) { Text(rateLabel($0)).tag($0) }
                        }
                    } label: {
                        Text(rateLabel(player.rate)).font(.callout.monospacedDigit().bold())
                    }
                    .accessibilityLabel("Playback speed")

                    Button { player.skip(by: -15) } label: { Image(systemName: "gobackward.15") }
                        .accessibilityLabel("Back 15 seconds")
                    Button { player.togglePlay() } label: {
                        Image(systemName: player.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                            .font(.system(size: 52))
                    }
                    .keyboardShortcut(.space, modifiers: [])
                    .accessibilityLabel(player.isPlaying ? "Pause" : "Play")
                    Button { player.skip(by: 15) } label: { Image(systemName: "goforward.15") }
                        .accessibilityLabel("Forward 15 seconds")

                    Toggle(isOn: Binding(get: { model.player.skipSilence }, set: { model.player.skipSilence = $0 })) {
                        Image(systemName: "waveform.badge.minus")
                    }
                    .toggleStyle(.button)
                    .accessibilityLabel("Skip silence")
                    .help("Skip silence")
                }
                .font(.title2)
                .buttonStyle(.plain)
            }
        }
    }

    private func rateLabel(_ rate: Float) -> String {
        rate == rate.rounded() ? "\(Int(rate))×" : String(format: "%g×", rate)
    }

    // MARK: Transcript

    @ViewBuilder
    private func transcriptSection(_ item: RecordingItem, proxy: ScrollViewProxy) -> some View {
        let m = item.metadata
        if let transcript = m.transcript, !transcript.segments.isEmpty {
            let current = player.itemID == item.id ? transcript.segment(at: player.currentTime)?.id : nil
            LazyVStack(alignment: .leading, spacing: 10) {
                ForEach(transcript.segments) { segment in
                    Button {
                        player.play(from: segment.start)
                    } label: {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(TimeFormat.timestamp(segment.start))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                                .frame(width: 52, alignment: .trailing)
                            Text(segment.text)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .multilineTextAlignment(.leading)
                        }
                        .padding(6)
                        .background(segment.id == current ? Color.accentColor.opacity(0.15) : .clear,
                                    in: RoundedRectangle(cornerRadius: 8))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .id(segment.id)
                }
            }
            .textSelection(.enabled)
            .onChange(of: current) { _, id in
                guard player.isPlaying, let id else { return }
                withAnimation { proxy.scrollTo(id, anchor: .center) }
            }
        } else {
            transcriptPlaceholder(item)
        }
    }

    @ViewBuilder
    private func transcriptPlaceholder(_ item: RecordingItem) -> some View {
        let m = item.metadata
        VStack(spacing: 12) {
            switch m.transcriptionState {
            case .inProgress:
                ProgressView("Transcribing on this device…")
            case .failed:
                Label(m.transcriptionError ?? "Transcription failed.", systemImage: "exclamationmark.triangle")
                    .foregroundStyle(.secondary)
                Button("Try Again") { model.processing.retranscribe(item.id) }
            default:
                if model.processing.currentID == item.id {
                    ProgressView("Transcribing on this device…")
                } else {
                    Text("No transcript yet.").foregroundStyle(.secondary)
                    Button("Transcribe Now") { model.processing.retranscribe(item.id) }
                        .buttonStyle(.borderedProminent)
                }
            }
        }
        .frame(maxWidth: .infinity, minHeight: 120)
    }

    // MARK: Summary

    @ViewBuilder
    private func summarySection(_ item: RecordingItem) -> some View {
        if let insights = item.metadata.insights {
            VStack(alignment: .leading, spacing: 14) {
                Text(insights.summary)
                    .textSelection(.enabled)
                if !insights.actionItems.isEmpty {
                    Text("Action items").font(.headline)
                    ForEach(insights.actionItems, id: \.self) { action in
                        Label(action, systemImage: "circle")
                    }
                }
                HStack {
                    if let title = insights.suggestedTitle, title != item.metadata.title {
                        Button("Use “\(title)” as title") { model.library.update(item.id) { $0.title = title } }
                    }
                    Spacer()
                    Button("Regenerate") { model.processing.regenerateInsights(item.id) }
                }
                .font(.callout)
                Text("Generated on this device with Apple Intelligence.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        } else if !InsightsGenerator.isAvailable {
            ContentUnavailableView("Summaries need Apple Intelligence",
                                   systemImage: "sparkles",
                                   description: Text("Turn on Apple Intelligence in Settings to get on-device titles, summaries and action items."))
        } else if item.metadata.transcript == nil {
            Text("A summary appears after the recording is transcribed.").foregroundStyle(.secondary)
        } else {
            VStack(spacing: 10) {
                if model.processing.currentID == item.id { ProgressView("Summarizing…") }
                Button("Summarize") { model.processing.regenerateInsights(item.id) }
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, minHeight: 120)
        }
    }

    // MARK: Notes & bookmarks

    private func notesSection(_ item: RecordingItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                TextField("Add a note at \(TimeFormat.timestamp(player.currentTime))", text: $noteDraft)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { addNote(item) }
                Button("Add") { addNote(item) }.disabled(noteDraft.isEmpty)
            }
            if item.metadata.bookmarks.isEmpty {
                Text("Bookmarks and notes you add while recording show up here. Tap one to jump to that moment.")
                    .font(.callout).foregroundStyle(.secondary)
            }
            ForEach(item.metadata.bookmarks.sorted { $0.time < $1.time }) { bookmark in
                HStack {
                    Button {
                        player.play(from: max(0, bookmark.time - 2))
                    } label: {
                        HStack(alignment: .firstTextBaseline) {
                            Image(systemName: bookmark.isNote ? "note.text" : "bookmark.fill").foregroundStyle(.orange)
                            Text(TimeFormat.timestamp(bookmark.time)).font(.callout.monospacedDigit())
                            Text(bookmark.note ?? "Bookmark").frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .buttonStyle(.plain)
                    Button(role: .destructive) {
                        model.library.update(item.id) { $0.bookmarks.removeAll { $0.id == bookmark.id } }
                    } label: { Image(systemName: "trash") }
                        .buttonStyle(.borderless)
                        .accessibilityLabel("Delete bookmark")
                }
            }
        }
    }

    private func addNote(_ item: RecordingItem) {
        let note = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty else { return }
        let time = player.currentTime
        model.library.update(item.id) { $0.bookmarks.append(Bookmark(time: time, note: note)) }
        noteDraft = ""
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private func toolbar(_ item: RecordingItem) -> some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button {
                model.library.update(item.id) { $0.isFavorite.toggle() }
            } label: {
                Image(systemName: item.metadata.isFavorite ? "star.fill" : "star")
            }
            .accessibilityLabel(item.metadata.isFavorite ? "Unfavorite" : "Favorite")

            ShareMenu(item: item)

            Menu {
                Button("Trim…", systemImage: "scissors") { showTrim = true }
                    .disabled(!item.isDownloaded)
                Button("Transcribe Again", systemImage: "text.badge.checkmark") { model.processing.retranscribe(item.id) }
                Button("Regenerate Summary", systemImage: "sparkles") { model.processing.regenerateInsights(item.id) }
                    .disabled(item.metadata.transcript == nil || !InsightsGenerator.isAvailable)
                Divider()
                Button("Delete", systemImage: "trash", role: .destructive) { showDeleteConfirm = true }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            .accessibilityLabel("More")
        }
    }
}

/// Share the audio, or the transcript in any export format.
struct ShareMenu: View {
    var item: RecordingItem

    var body: some View {
        Menu {
            ShareLink(item: item.audioURL) { Label("Audio", systemImage: "waveform") }
            if item.metadata.transcript != nil {
                ForEach(TranscriptExporter.Format.allCases) { format in
                    if let url = try? TranscriptExporter.file(for: item, as: format) {
                        ShareLink(item: url) { Label(format.label, systemImage: "doc.text") }
                    }
                }
            }
        } label: {
            Image(systemName: "square.and.arrow.up")
        }
        .accessibilityLabel("Share")
    }
}

struct TrailingIconLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 4) {
            configuration.title
            configuration.icon.imageScale(.small)
        }
    }
}
