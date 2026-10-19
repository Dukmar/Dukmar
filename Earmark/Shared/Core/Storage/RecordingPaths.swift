import Foundation

/// File layout, shared by every platform:
///
///     <root>/Recordings/2026-10-19/2026-10-19 14.03.22.m4a
///     <root>/Recordings/2026-10-19/2026-10-19 14.03.22.earmark.json
///     <root>/Recently Deleted/...
///
/// On iPhone and Mac `<root>` is the app's iCloud Drive folder ("Earmark" in Finder / Files),
/// so the audio files are visible and usable outside the app, just like Just Press Record.
enum RecordingPaths {
    static let containerIdentifier = "iCloud.com.crstudios.earmark"
    static let recordingsFolder = "Recordings"
    static let deletedFolder = "Recently Deleted"
    static let metadataSuffix = ".earmark.json"
    static let audioExtensions: Set<String> = ["m4a", "caf", "wav", "aiff", "aif", "mp3"]

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private static let fileFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH.mm.ss"
        return f
    }()

    static func dayFolderName(for date: Date) -> String { dayFormatter.string(from: date) }

    static func baseFileName(for date: Date) -> String { fileFormatter.string(from: date) }

    static func date(fromFileName name: String) -> Date? {
        fileFormatter.date(from: String(name.prefix(19)))
    }

    static func metadataURL(forAudio audioURL: URL) -> URL {
        audioURL.deletingPathExtension().appendingPathExtension("earmark.json")
    }

    static func isMetadataFile(_ url: URL) -> Bool {
        url.lastPathComponent.hasSuffix(metadataSuffix)
    }

    static func isAudioFile(_ url: URL) -> Bool {
        audioExtensions.contains(url.pathExtension.lowercased())
    }

    /// A new, unused audio URL inside `recordingsRoot` for a recording that starts at `date`.
    static func newAudioURL(in recordingsRoot: URL, date: Date, fileExtension: String) -> URL {
        let folder = recordingsRoot.appendingPathComponent(dayFolderName(for: date), isDirectory: true)
        let base = baseFileName(for: date)
        var candidate = folder.appendingPathComponent(base).appendingPathExtension(fileExtension)
        var counter = 2
        while FileManager.default.fileExists(atPath: candidate.path) {
            candidate = folder.appendingPathComponent("\(base) \(counter)").appendingPathExtension(fileExtension)
            counter += 1
        }
        return candidate
    }

    /// Local (non-iCloud) Documents folder. Used on the Watch, and on iPhone/Mac when iCloud is off.
    static var localRoot: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    /// In-progress recordings. Recording to a local file and moving it into iCloud when done avoids iCloud
    /// uploading a file that is still being written. It's in Application Support rather than tmp so the system
    /// never purges it: anything left here after a crash is recovered on the next launch.
    static var inProgressFolder: URL {
        var url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("InProgress", isDirectory: true)
        if !FileManager.default.fileExists(atPath: url.path) {
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? url.setResourceValues(values)
        }
        return url
    }

    /// Bookmarks, notes and timing saved every few seconds while recording, for crash recovery.
    static func checkpointURL(forCapture audioURL: URL) -> URL {
        audioURL.deletingPathExtension().appendingPathExtension("checkpoint.json")
    }
}
