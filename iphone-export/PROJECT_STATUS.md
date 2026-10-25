# iPhone Export: status

**Updated:** 2026-10-25 (P Mac). Round 5 committed as cda2bac on claude/iphone-texts-export, pushed, macOS CI passed.

## What it is
A Mac app (`mac-app/`, SwiftUI) on top of a Python engine (`iphone_export/`), which also runs from the command line and the double-click `.command` files. It reads a local iPhone backup, or the Mac's own synced copies, and saves texts, calls, voicemail, notes and contacts as HTML, TXT, CSV, vCard and optional PDF. A home-made stand-in for iMazing's export.

## State
- v0.4.0. 28 Python tests and 12 Swift tests pass. The Python tests run on 3.13 and 3.9 (3.9 is what the macOS Command Line Tools ship); the Swift tests ran with Swift 6.1.2 on Linux.
- v0.2 added features copied from iMazing, imessage-exporter, Decipher TextMessage and TouchCopy:
  - search across all messages, a photo gallery, reply quotes, edit history, recovery of Recently Deleted messages;
  - read and delivered times, send effects, app message labels;
  - voicemail with transcripts, contacts export to vCard/CSV, PDF export with page numbers and an export-details footer;
  - date range and contact filters, media conversion, file dates set to the message date, a disk-space check, and a nightly `schedule` (LaunchAgent, optional Wi-Fi).
- Tested against:
  - synthetic plain and encrypted backups built with Apple's real Messages tables;
  - 50 real Messages text blobs and 9 real edited-message plists from imessage-exporter's test data;
  - headless Chromium, which renders the pages and makes the PDFs.
- `sips`, `afconvert`, `idevicebackup2` and `launchctl` are exercised with stand-ins, because they only exist on a Mac.
- v0.3 added:
  - a daily Wi-Fi backup + export (`auto`, scheduled hourly in an evening window, passcode notification, gives up after 15 minutes);
  - dated versions of each backup (APFS clones, 30 days);
  - `Set Up Daily Backup.command`.
- v0.4 added the Mac app:
  - a main window with phone status, Back Up & Export, progress, a passcode banner, Cancel and results;
  - four tabs: Export Options, Dated Versions, Daily Backup, Setup;
  - a menu bar icon and a password dialog;
  - `build-app.sh`, plus the engine's progress events and status summary;
  - a macOS CI build that uploads the app as a download.
- v0.4 since then (2026-10-24, on Colin's P Mac; version string not bumped yet):
  - built, installed and set up: Python environment, libimobiledevice 1.4.0, Full Disk Access, Finder Wi-Fi tick;
  - the monthly text archive (`archive.py`, `cli archive`, app Daily Backup tab), with the app as a login item;
  - messages from deleted conversations (no chat row left) are exported, marked "From a deleted conversation";
  - a failed backup shows the phone's reason (ErrorCode 105 = not enough space) instead of "code 151";
  - the Full Disk Access row no longer shows a tick before the engine has checked.
- **Real data:** the Mac route ran against Colin's real Messages (Messages in iCloud). 49 months, 36,599 messages, 8.8 GB filed into `~/iPhone Export/Messages by month` and copied to Drive (`Historical Files/iPhone Text Messages/Messages by month`), identical file for file. History on the Mac starts March 2023 (one message from May 2019, a few from 2022).
- **Phone backup failed** with ErrorCode 105: about 140 GB free on the Mac, about 370 GB of data on the phone. No real phone backup has been read yet.
- 28 Python tests pass. Swift: 11 of 12; `testEncryptedBackupAsksForPasswordThenUnlocks` fails the same way before and after this session's changes (fixture setup exits 1 on this Mac). Needs `TEST_PYTHON` pointing at a Python with the test dependencies.

## Next
1. **Confirm the login item** after the next login: the menu bar icon is there, no window opened, and on Nov 1 the October folder appears locally and in Drive.
2. **Phone backup space:** free about 250 GB on the Mac, or add a backup-location setting so backups can go to the My Book Duo (HFS+, so no dated versions there). Only needed for calls and voicemail.
3. Spot-check the archive against the phone: a few conversations (replies, edits, reactions, a deleted conversation).
4. Commit this session's changes (uncommitted in `~/Projects/Dukmar-iphone-export`, a worktree of `~/Projects/Dukmar`), bump the version, rebuild, and switch Full Disk Access off and on again.
5. Move to its own private repo, `Dukmar/iphone-export` (Colin decided this 2026-10-24). That waits on Colin creating the empty repo, because Claude's GitHub app can't create one.

## Files
- `iphone_export/sources.py`: finds backups; plain, encrypted and Mac sources
- `iphone_export/messages.py`, `calls.py`, `voicemail.py`, `notes.py`, `contacts.py`: readers
- `iphone_export/decode.py`: iMessage `attributedBody`, edit history and Notes protobuf decoders
- `iphone_export/render.py`: HTML/TXT/CSV/vCard writer, search and gallery pages, print layout
- `iphone_export/pdf.py`: headless Chrome to PDF
- `iphone_export/snapshots.py`: dated APFS-clone versions of each backup
- `iphone_export/schedule.py`: nightly LaunchAgent
- `iphone_export/archive.py`: monthly text archive (month folders, done/copied markers, empty-month list)
- `iphone_export/cli.py`: `list`, `backup`, `export`, `sync`, `auto`, `schedule`, `archive`
- `mac-app/Sources/iPhoneExport/MonthlyArchive.swift`: runs `archive` from the app, login item
- `Export iPhone.command`, `Set Up Daily Backup.command`: double-click launchers
- `iphone_export/events.py`: progress events for the app
- `mac-app/Sources/ExportCore/`: runs the engine, parses events and status (tested)
- `mac-app/Sources/iPhoneExport/`: SwiftUI app
- `mac-app/build-app.sh`: builds and installs `iPhone Export.app`
- `tests/`: fixture builder, real Messages schema, tests
