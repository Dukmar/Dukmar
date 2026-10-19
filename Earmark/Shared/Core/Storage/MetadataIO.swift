import Foundation
import CryptoKit

/// Coordinated reads and writes of `.earmark.json` sidecars and audio moves.
/// File coordination matters because iCloud may be syncing the same files at the same time.
enum MetadataIO {
    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    static func read(_ url: URL) throws -> RecordingMetadata {
        var coordinationError: NSError?
        var result: Result<RecordingMetadata, Error> = .failure(CocoaError(.fileReadUnknown))
        NSFileCoordinator().coordinate(readingItemAt: url, options: [], error: &coordinationError) { readURL in
            result = Result { try decoder.decode(RecordingMetadata.self, from: Data(contentsOf: readURL)) }
        }
        if let coordinationError { throw coordinationError }
        return try result.get()
    }

    static func write(_ metadata: RecordingMetadata, to url: URL) throws {
        let data = try encoder.encode(metadata)
        var coordinationError: NSError?
        var writeError: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { writeURL in
            do {
                try FileManager.default.createDirectory(at: writeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try data.write(to: writeURL, options: .atomic)
            } catch {
                writeError = error
            }
        }
        if let coordinationError { throw coordinationError }
        if let writeError { throw writeError }
    }

    /// Moves a file with coordination on both ends, creating the destination folder if needed.
    static func move(_ source: URL, to destination: URL) throws {
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        var coordinationError: NSError?
        var moveError: Error?
        NSFileCoordinator().coordinate(writingItemAt: source, options: .forMoving,
                                       writingItemAt: destination, options: .forReplacing,
                                       error: &coordinationError) { src, dst in
            do {
                try FileManager.default.moveItem(at: src, to: dst)
            } catch {
                moveError = error
            }
        }
        if let coordinationError { throw coordinationError }
        if let moveError { throw moveError }
    }

    static func delete(_ url: URL) throws {
        var coordinationError: NSError?
        var deleteError: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forDeleting, error: &coordinationError) { target in
            do {
                try FileManager.default.removeItem(at: target)
            } catch {
                deleteError = error
            }
        }
        if let coordinationError { throw coordinationError }
        if let deleteError { throw deleteError }
    }
}

extension UUID {
    /// Same input, same UUID, on every device. Used for audio files that arrive without a sidecar
    /// (dropped into the folder in Finder, or imported) so two devices don't invent different IDs.
    init(stableFrom string: String) {
        let digest = Array(SHA256.hash(data: Data(string.utf8)))
        var bytes = Array(digest.prefix(16))
        bytes[6] = (bytes[6] & 0x0F) | 0x50 // version 5-style
        bytes[8] = (bytes[8] & 0x3F) | 0x80 // RFC 4122 variant
        self.init(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
                         bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }
}
