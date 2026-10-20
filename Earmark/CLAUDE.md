# Earmark – notes for Claude sessions

Colin's replacement for **Just Press Record**: a one-tap voice recorder for iPhone, Apple Watch and Mac.
Read `README.md` (features, build steps, **Status**), `docs/ARCHITECTURE.md` and `docs/RESEARCH.md` first.

## State
- Written in a cloud session without Xcode: **never compiled** until a local session does it. Check README › Status for progress.
- Work on branch `claude/earmark-recorder-app` of `Dukmar/Dukmar` (the app lives in `Earmark/`; the repo root is Colin's GitHub profile README).

## Build
- XcodeGen: `cd Earmark && xcodegen generate` (the `.xcodeproj`, Info.plists and entitlements are generated and gitignored; edit `project.yml`, not the generated files).
- Targets: `Earmark` (iOS 26), `EarmarkWidgets`, `EarmarkWatch` (watchOS 26), `EarmarkWatchWidgets`, `EarmarkMac` (macOS 26), `EarmarkCoreTests` (Swift Testing, macOS).
- Swift 5 language mode. iCloud container `iCloud.com.crstudios.earmark` must match `RecordingPaths.containerIdentifier`.
- Source sharing: `Shared/Core` = all platforms, `Shared/App` = iPhone + Mac, `Shared/Intents` = iPhone app + widget (`WIDGET_EXTENSION` flag) + Mac.

## Non-negotiables (Colin asked for these)
- **No accidental stops.**
  - Stopping goes through `ProtectedStopButton`, which is hold-to-stop by default.
  - Stops from menus and deep links go through `AppModel.requestStop()`.
  - While recording, shortcuts and the Action Button add a bookmark (`handleShortcutPress()`).
  - No Lock Screen stop button unless the setting is on.
- **Never lose audio.**
  - Capture goes to PCM CAF in Application Support/InProgress, with checkpoints.
  - Interrupted captures are recovered on launch (`orphanedCaptures`, `CAFRepair`).
  - A capture is deleted only after the encoded file is in the library.
- **Files stay Finder-visible**, like Just Press Record:
  - Audio goes in `iCloud Drive/Earmark/Recordings/<yyyy-MM-dd>/`.
  - Each recording has a `.earmark.json` sidecar beside it.
  - There's no database.
- **Everything stays on-device:** transcription (SpeechAnalyzer), summaries (Foundation Models), and no third-party services.

## Colin
- Professor at Sheridan College; also ships iOS/watchOS apps under CR Studios (bundle prefix `com.crstudios`).
- Explain device and Xcode steps plainly; he follows along in the Claude app.
