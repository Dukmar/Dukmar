# Earmark Architecture

## The main idea: the file system is the database

Just Press Record syncs through **iCloud Drive files**, which is why its recordings show up on the Mac
in Finder. Earmark does the same. There's no Core Data / SwiftData store to keep in sync; every
device scans the same folder.

```
iCloud Drive/Earmark/                        (ubiquity container iCloud.com.crstudios.earmark/Documents)
├── Recordings/
│   └── 2026-10-19/
│       ├── 2026-10-19 14.03.22.m4a          the audio, playable anywhere
│       └── 2026-10-19 14.03.22.earmark.json title, transcript, bookmarks, notes, summary, tags…
└── Recently Deleted/                        same layout; purged after 30 days
```

- `RecordingMetadata` (`Shared/Core/Model/Recording.swift`) is the JSON sidecar. Decoding tolerates
  missing fields so older and newer app versions can share a library.
- Audio dropped into the folder from Finder (no sidecar) gets one automatically, with an ID derived
  from its path (`UUID(stableFrom:)`), so two devices don't invent different IDs for the same file.
- Reads and writes use `NSFileCoordinator` (`MetadataIO`) because iCloud may be syncing the same file.
- `RecordingLibrary` watches the container with `NSMetadataQuery` and rescans (with a modification-date
  cache) when another device changes something.
- If iCloud is off or unavailable, the same layout lives in the app's local Documents folder; switching
  moves the files.

## Recording

`Recorder` (`Shared/Core/Audio/Recorder.swift`) is shared by all three apps.

| | iPhone / Mac | Watch |
|---|---|---|
| Engine | `AVAudioEngine` input tap → `AVAudioFile` | `AVAudioRecorder` |
| Why | Live audio can also feed the live transcriber; voice processing ("Enhanced voice") | Most reliable for long background recording |
| Background | `UIBackgroundModes: audio` + Live Activity | `WKBackgroundModes: audio` |

Recordings are written to a temp folder and moved into the library when they stop, so iCloud never
uploads a half-written file. Interruptions (calls, Siri) pause and resume automatically. Bookmarks and
notes are timestamped with the recorder's elapsed time (pauses excluded).

## Watch → iPhone → iCloud

```
Watch records ──► WCSession.transferFile ──► iPhone WatchInbox ──► library (iCloud Drive) ──► Mac sees it
       │                                                                 ▲
       └──(iPhone not reachable)──► CloudKit "InboxRecording" ──────────┘ (iPhone or Mac imports, then deletes)
```

- `transferFile` is queued by the system and survives suspension, like Just Press Record.
- The CloudKit inbox is new: the Watch can't write to iCloud Drive, but it can reach CloudKit over
  Wi-Fi/LTE. Record names are the recording ID, and the library ignores IDs it already has, so a
  recording that arrives both ways only appears once.
- The Watch keeps delivered recordings for a few days (setting), then deletes them.

## Processing

`ProcessingQueue` runs one recording at a time on iPhone and Mac:

1. **Transcribe** with `SpeechAnalyzer` + `SpeechTranscriber` (on-device long-form model, word timings).
   Results are split into sentence-sized `TranscriptSegment`s that drive tap-to-seek and captions.
2. **Insights** with Foundation Models: title, 2–4 sentence summary, action items, tags. Long transcripts
   are summarized in chunks, then combined, to fit the on-device context window.

Anything that shows up without a transcript (Watch recordings, Finder drops, Just Press Record imports)
is picked up automatically. Whichever of your devices sees it first does the work and writes the
result into the sidecar for the others.

## Entry points

| Entry point | Platform | Implementation |
|---|---|---|
| Big record button | iPhone | `RootView.RecordBar` |
| Complication / Smart Stack | Watch | `WatchWidgets` → `earmark://record` |
| Siri, Shortcuts, Action Button | iPhone, Watch, Mac | `RecordingIntents.swift`, `WatchStartRecordingIntent` |
| Control Center button | iPhone | `RecordControl` (ControlWidget) |
| Lock Screen / Home widget | iPhone | `QuickRecordWidget` → `earmark://record` |
| Live Activity buttons | iPhone | `LiveActivityIntent`s (bookmark, pause, stop) |
| Menu bar / ⌃⌥⌘R / ⌘R | Mac | `MenuBarRecorderView`, `GlobalHotKey` |
| Spotlight result | iPhone, Mac | `SpotlightIndexer` |

## Privacy

- Audio, transcripts and summaries stay in the user's iCloud (Drive + private CloudKit database).
- Transcription and summaries run on-device. No third-party services and no analytics.
- Location is only used if "Name recordings by location" is turned on.
