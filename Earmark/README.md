# Earmark

A one-tap voice recorder for **iPhone, Apple Watch and Mac**, built to replace Just Press Record.
It keeps what makes Just Press Record good (one tap, a Watch complication, plain audio files in
iCloud Drive) and adds the best ideas from other recorders: bookmarks and timestamped notes while
recording, live transcripts, on-device summaries, Skip Silence, and Siri / Action Button / Control
Center support.

Everything runs on your devices. There's no server and no subscription.

- **Why these features:** [docs/RESEARCH.md](docs/RESEARCH.md) compares Just Press Record, Voice Memos, Ferrite, Noted, Otter, Whisper Memos, AudioPen and others.
- **How it works:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Features

**Never lose a recording by accident**
- **Press and hold to stop** (about a second, with a filling ring) on iPhone, Watch and Mac. A quick tap just shows "Hold to stop". You can switch to tap-then-confirm, or a single tap.
- **No Stop button on the Lock Screen / Dynamic Island** unless you turn it on, so a phone in a pocket can't end a recording. Bookmark and Pause stay available.
- **Action Button, Watch double tap and the Mac hotkey bookmark while recording** instead of stopping (configurable). Tapping the Watch complication again never stops a recording.
- **Crash-proof:** audio goes to a crash-safe file while recording, and bookmarks are saved every few seconds. If the app is force-quit, crashes or the battery dies, the recording is repaired and added to your library the next time Earmark opens (tagged `#recovered`).
- Discard asks first, and a recording is never deleted until its final copy is safely saved.
- **"Still paused" reminders** at 2 and 10 minutes, so an accidental pause doesn't quietly lose audio.

**Recording**
- One tap to record: the big red button on iPhone, the complication on Apple Watch, the menu bar or **⌃⌥⌘R** from any app on Mac.
- Start from Siri ("Record with Earmark"), Shortcuts, the iPhone/Watch Ultra **Action Button**, the **Control Center** button or the Lock Screen widget.
- **Live Activity** on the Lock Screen and in the Dynamic Island, with Bookmark / Pause / Stop buttons.
- **Bookmarks** (Ferrite) and **typed notes tied to the moment** (Noted) while recording.
- Pause/resume; recording pauses for phone calls and resumes after.
- Quality presets: Compact AAC, Standard AAC, High AAC stereo, Apple Lossless, WAV.
- **Enhanced voice** (Apple voice processing: noise and echo reduction).
- Optional **location-based names** (Voice Memos).

**Apple Watch**
- Records in the background with the wrist down, with no time limit.
- Recordings move to the iPhone automatically, then get transcribed and put in iCloud (like Just Press Record).
- **New:** if the iPhone isn't around (an LTE Watch on a run), recordings go **straight to iCloud** and show up on the Mac.
- Library tab of "From Apple Watch" recordings on iPhone and Mac.

**Transcripts and summaries**
- On-device transcription with Apple's long-form **SpeechAnalyzer** model, with timestamps.
- **Live transcript** while recording (iPhone and Mac).
- Tap any line of the transcript to jump the audio there; the current line highlights while playing.
- **On-device titles, summaries, action items and tags** with Apple Intelligence (Foundation Models).
- Search titles, transcripts, summaries, notes and tags, in the app and in **Spotlight**.
- Export transcripts as **TXT, Markdown (with summary and notes), SRT or WebVTT**.

**Playback and editing**
- Waveform scrubber with bookmark markers.
- Speed 0.5×–3× and **Skip Silence**.
- Trim, favorites, tags, **Recently Deleted** (30 days).

**Sync and files**
- Recordings are plain audio files in **iCloud Drive › Earmark › Recordings › yyyy-MM-dd**, so you can open them in Finder, Files, Logic, anywhere. Each has a small `.earmark.json` file next to it with the transcript, notes and summary.
- **Import your Just Press Record library** (Settings › Import): keeps original dates and reuses embedded transcripts.
- Drag recordings out of the Mac app into Finder, Mail or Messages.

## Requirements

- Xcode 26 or later
- iOS 26, watchOS 26 and macOS 26 (Tahoe) devices. Summaries need an Apple Intelligence–capable device; everything else works without it.
- An Apple Developer account (iCloud and CloudKit need a signed build).

## Build and run

1. Install [XcodeGen](https://github.com/yonaskolb/XcodeGen) and generate the project:
   ```sh
   brew install xcodegen
   cd Earmark
   xcodegen generate
   open Earmark.xcodeproj
   ```
2. Set your team: select each target › **Signing & Capabilities** › Team (or set `DEVELOPMENT_TEAM` in `project.yml` and regenerate).
3. Create the iCloud container: in **Signing & Capabilities › iCloud**, make sure `iCloud.com.crstudios.earmark` is checked (Xcode creates it on first use).
   - If you change the bundle ID prefix, rename the container everywhere: `project.yml` and `RecordingPaths.containerIdentifier`.
4. Run the **Earmark** scheme on your iPhone (the Watch app installs with it), and the **EarmarkMac** scheme on your Mac.
5. **CloudKit (Watch direct upload):** the first Watch upload creates the `InboxRecording` record type in the Development environment. In the [CloudKit Console](https://icloud.developer.apple.com), mark its `recordName` field as **Queryable**, then deploy the schema to Production before TestFlight/App Store builds.

### First run checklist
- Allow microphone access.
- On iPhone: add the **Earmark Record** control in Control Center, and/or set the Action Button to *Shortcut › Earmark › Start Recording*.
- On Watch: edit your watch face and add the **Earmark** complication.
- On Mac: the waveform icon in the menu bar is the recorder; ⌃⌥⌘R works from any app.
- Settings › **Import from Just Press Record…** and pick `iCloud Drive/Just Press Record`.

## Project layout

```
Earmark/
├── project.yml               XcodeGen spec (5 targets)
├── Shared/
│   ├── Core/                 All platforms: model, file layout, recorder, Watch sync, CloudKit inbox
│   ├── App/                  iPhone + Mac: library, transcription, summaries, playback, shared SwiftUI views
│   └── Intents/              Siri / Shortcuts / Control Center / Live Activity intents
├── iOS/                      iPhone app (record button, recording screen, Live Activity controller)
├── iOSWidgets/               Live Activity, Control Center control, Lock Screen widget
├── Watch/                    Watch app
├── WatchWidgets/             Watch complications
├── Mac/                      Mac app (library window, menu-bar recorder, global hotkey)
├── Resources/Assets.xcassets App icon and accent colour
└── docs/                     Research and architecture notes
```

## Status

This is a complete first version of the source, written without access to a Mac, so it hasn't been
compiled yet. Expect a short round of fixes the first time you build it in Xcode. Device testing is
needed for background recording on the Watch, iCloud sync timing and the Live Activity.

## Roadmap ideas
- Speaker labels (when Apple's speech APIs add diarization).
- Watch: show transcripts synced back from the iPhone.
- iPad layout tuned for split view.
- Folder/project grouping in addition to tags.
- Optional "Send to" automations (email a summary, append to a note).
