import CoreLocation
import MapKit

/// Optional Voice Memos–style naming: recordings made at "Sheridan College – Trafalgar" get that name
/// until a better title comes along. Asks for "When In Use" permission only after the setting is turned on.
@MainActor
final class LocationTagger {
    private let manager = CLLocationManager()

    var isEnabled: Bool { UserDefaults.standard.bool(forKey: AppSettings.Key.tagLocation) }

    func requestPermissionIfNeeded() {
        if manager.authorizationStatus == .notDetermined { manager.requestWhenInUseAuthorization() }
    }

    /// A place for "now", or nil if disabled, not permitted, or it takes too long.
    func currentPlace() async -> RecordingPlace? {
        guard isEnabled else { return nil }
        let status = manager.authorizationStatus
        guard status == .authorizedWhenInUse || status == .authorizedAlways else { return nil }

        let location: CLLocation? = await withTaskGroup(of: CLLocation?.self) { group in
            group.addTask {
                do {
                    for try await update in CLLocationUpdate.liveUpdates() {
                        if let location = update.location, location.horizontalAccuracy < 200 { return location }
                    }
                } catch {}
                return nil
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(8))
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
        guard let location else { return nil }

        var place = RecordingPlace(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude)
        if let request = MKReverseGeocodingRequest(location: location) {
            let items = try? await request.mapItems
            if let item = items?.first {
                place.name = item.name ?? item.address?.shortAddress
            }
        }
        return place
    }
}
