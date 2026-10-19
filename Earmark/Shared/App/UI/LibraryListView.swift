import SwiftUI

enum LibraryFilter: Hashable {
    case all
    case favorites
    case watch
    case tag(String)

    var title: String {
        switch self {
        case .all: return "All Recordings"
        case .favorites: return "Favorites"
        case .watch: return "From Apple Watch"
        case .tag(let tag): return "#\(tag)"
        }
    }

    func includes(_ item: RecordingItem) -> Bool {
        switch self {
        case .all: return true
        case .favorites: return item.metadata.isFavorite
        case .watch: return item.metadata.source == .watch
        case .tag(let tag): return item.metadata.tags.contains(tag)
        }
    }
}

/// The recording list, grouped by day, with transcript search. Used on iPhone and Mac.
struct LibraryListView: View {
    @Environment(AppModel.self) private var model
    var filter: LibraryFilter
    @Binding var selection: UUID?
    @State private var searchText = ""

    private var visibleItems: [RecordingItem] {
        model.library.items.filter { filter.includes($0) && $0.matches(searchText) }
    }

    private var groupedByDay: [(day: Date, items: [RecordingItem])] {
        let groups = Dictionary(grouping: visibleItems) { Calendar.current.startOfDay(for: $0.metadata.createdAt) }
        return groups.keys.sorted(by: >).map { ($0, groups[$0]!) }
    }

    var body: some View {
        List(selection: $selection) {
            if model.library.storage == .iCloudUnavailable {
                Label("iCloud is unavailable, so recordings are only being saved on this device. Sign in to iCloud to sync.",
                      systemImage: "icloud.slash")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            ForEach(groupedByDay, id: \.day) { group in
                Section(dayTitle(group.day)) {
                    ForEach(group.items) { item in
                        row(for: item)
                        .tag(item.id)
                        .swipeActions(edge: .trailing) {
                            Button(role: .destructive) {
                                Task { await model.delete([item.id]) }
                            } label: { Label("Delete", systemImage: "trash") }
                        }
                        .swipeActions(edge: .leading) {
                            Button {
                                model.library.update(item.id) { $0.isFavorite.toggle() }
                            } label: {
                                Label("Favorite", systemImage: item.metadata.isFavorite ? "star.slash" : "star")
                            }
                            .tint(.yellow)
                        }
                        .contextMenu {
                            Button("Favorite", systemImage: "star") { model.library.update(item.id) { $0.isFavorite.toggle() } }
                            ShareLink(item: item.audioURL) { Label("Share Audio", systemImage: "square.and.arrow.up") }
                            Divider()
                            Button("Delete", systemImage: "trash", role: .destructive) { Task { await model.delete([item.id]) } }
                        }
                    }
                }
            }
        }
        .overlay {
            if !model.library.isLoaded {
                ProgressView()
            } else if visibleItems.isEmpty {
                if searchText.isEmpty {
                    ContentUnavailableView("No Recordings", systemImage: "waveform",
                                           description: Text(emptyMessage))
                } else {
                    ContentUnavailableView.search(text: searchText)
                }
            }
        }
        .searchable(text: $searchText, prompt: "Search titles and transcripts")
        .navigationTitle(filter.title)
        .refreshable { await model.refresh() }
    }

    @ViewBuilder
    private func row(for item: RecordingItem) -> some View {
        let row = RecordingRow(item: item, isProcessing: model.processing.currentID == item.id, searchText: searchText)
        #if os(macOS)
        // On the Mac the list selection drives the detail column; rows can be dragged out to Finder or Mail.
        row.onDrag { NSItemProvider(contentsOf: item.audioURL) ?? NSItemProvider() }
        #else
        NavigationLink(value: item.id) { row }
        #endif
    }

    private var emptyMessage: String {
        switch filter {
        case .watch: return "Recordings you make on Apple Watch appear here once they reach your iPhone."
        case .favorites: return "Star a recording to keep it here."
        default: return "Tap the record button to start."
        }
    }

    private func dayTitle(_ day: Date) -> String {
        if Calendar.current.isDateInToday(day) { return "Today" }
        if Calendar.current.isDateInYesterday(day) { return "Yesterday" }
        return day.formatted(date: .complete, time: .omitted)
    }
}

struct RecentlyDeletedView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List {
            Section {
                ForEach(model.library.deletedItems) { item in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(item.title).font(.headline)
                            Text(daysLeft(item)).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Recover") { Task { await model.library.restore([item.id]) } }
                            .buttonStyle(.bordered)
                    }
                    .swipeActions {
                        Button("Delete", role: .destructive) { Task { await model.library.deletePermanently([item.id]) } }
                    }
                }
            } footer: {
                Text("Recordings are permanently deleted after 30 days.")
            }
        }
        .overlay {
            if model.library.deletedItems.isEmpty {
                ContentUnavailableView("Nothing Here", systemImage: "trash")
            }
        }
        .navigationTitle("Recently Deleted")
        .toolbar {
            if !model.library.deletedItems.isEmpty {
                Button("Delete All", role: .destructive) {
                    Task { await model.library.deletePermanently(Set(model.library.deletedItems.map(\.id))) }
                }
            }
        }
    }

    private func daysLeft(_ item: RecordingItem) -> String {
        guard let deleted = item.metadata.deletedAt else { return "" }
        let days = 30 - (Calendar.current.dateComponents([.day], from: deleted, to: .now).day ?? 0)
        return days <= 1 ? "Deletes tomorrow" : "\(days) days left"
    }
}
