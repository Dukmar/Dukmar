import CoreSpotlight
import UniformTypeIdentifiers

/// Makes recordings (titles, summaries and full transcripts) searchable from system Spotlight.
enum SpotlightIndexer {
    static let domain = "com.crstudios.earmark.recordings"

    static func index(_ items: [RecordingItem]) {
        let searchable = items.map { item -> CSSearchableItem in
            let m = item.metadata
            let attributes = CSSearchableItemAttributeSet(contentType: .audio)
            attributes.title = m.displayTitle
            attributes.contentDescription = m.insights?.summary ?? m.transcript.map { String($0.fullText.prefix(300)) }
            attributes.textContent = m.transcript?.fullText
            attributes.keywords = m.tags
            attributes.duration = NSNumber(value: m.duration)
            attributes.contentCreationDate = m.createdAt
            attributes.namedLocation = m.place?.name
            return CSSearchableItem(uniqueIdentifier: item.id.uuidString, domainIdentifier: domain, attributeSet: attributes)
        }
        CSSearchableIndex.default().indexSearchableItems(searchable) { _ in }
    }

    static func remove(_ ids: [UUID]) {
        CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: ids.map(\.uuidString)) { _ in }
    }

    static func reindexAll(_ items: [RecordingItem]) {
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [domain]) { _ in
            index(items)
        }
    }

    /// The recording ID from a Spotlight tap (`NSUserActivity` of type `CSSearchableItemActionType`).
    static func recordingID(from activity: NSUserActivity) -> UUID? {
        guard activity.activityType == CSSearchableItemActionType,
              let id = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String else { return nil }
        return UUID(uuidString: id)
    }
}
