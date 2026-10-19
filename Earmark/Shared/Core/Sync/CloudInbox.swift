import Foundation
import CloudKit

/// A drop box in the user's private iCloud database.
///
/// The Watch can't write to iCloud Drive, so when the iPhone is out of reach (a run with an LTE Watch,
/// or the phone is off) it uploads finished recordings here. Whichever iPhone or Mac opens Earmark next
/// moves them into the iCloud Drive library and deletes them from the inbox.
///
/// CloudKit schema (created automatically in the Development environment the first time a Watch uploads;
/// deploy it to Production in the CloudKit Console before shipping):
///   Record type `InboxRecording`: `metadata` (Bytes), `audio` (Asset), `fileExtension` (String)
///   Mark `recordName` as Queryable.
enum CloudInbox {
    static let recordType = "InboxRecording"

    static var database: CKDatabase {
        CKContainer(identifier: RecordingPaths.containerIdentifier).privateCloudDatabase
    }

    static func isAvailable() async -> Bool {
        (try? await CKContainer(identifier: RecordingPaths.containerIdentifier).accountStatus()) == .available
    }

    /// Watch: upload one recording. The record name is the recording ID, so retries can't create duplicates.
    static func upload(audioAt url: URL, metadata: RecordingMetadata) async throws {
        let record = CKRecord(recordType: recordType, recordID: CKRecord.ID(recordName: metadata.id.uuidString))
        record["metadata"] = try MetadataIO.encoder.encode(metadata) as NSData
        record["audio"] = CKAsset(fileURL: url)
        record["fileExtension"] = url.pathExtension as NSString
        let (results, _) = try await database.modifyRecords(saving: [record], deleting: [], savePolicy: .allKeys)
        if case .failure(let error) = results[record.recordID] { throw error }
    }

    #if !os(watchOS)
    struct Download {
        var recordID: CKRecord.ID
        var audioURL: URL
        var metadata: RecordingMetadata
    }

    /// iPhone/Mac: fetch everything waiting, copied to temporary files that the caller then imports.
    static func fetchPending() async throws -> [Download] {
        let query = CKQuery(recordType: recordType, predicate: NSPredicate(value: true))
        var downloads: [Download] = []
        var cursor: CKQueryOperation.Cursor?
        repeat {
            let page: (matchResults: [(CKRecord.ID, Result<CKRecord, Error>)], queryCursor: CKQueryOperation.Cursor?)
            if let cursor {
                page = try await database.records(continuingMatchFrom: cursor)
            } else {
                page = try await database.records(matching: query)
            }
            for (_, result) in page.matchResults {
                guard let record = try? result.get(),
                      let data = record["metadata"] as? Data,
                      let metadata = try? MetadataIO.decoder.decode(RecordingMetadata.self, from: data),
                      let asset = record["audio"] as? CKAsset,
                      let assetURL = asset.fileURL else { continue }
                let ext = (record["fileExtension"] as? String) ?? "m4a"
                // CloudKit's asset cache can be purged at any time; take a copy.
                let copy = FileManager.default.temporaryDirectory
                    .appendingPathComponent(metadata.id.uuidString).appendingPathExtension(ext)
                try? FileManager.default.removeItem(at: copy)
                try FileManager.default.copyItem(at: assetURL, to: copy)
                downloads.append(Download(recordID: record.recordID, audioURL: copy, metadata: metadata))
            }
            cursor = page.queryCursor
        } while cursor != nil
        return downloads
    }

    static func remove(_ recordID: CKRecord.ID) async {
        _ = try? await database.deleteRecord(withID: recordID)
    }
    #endif
}
