# iPhone Export: status

**Updated:** 2026-10-24

## What it is
A Python command-line tool, plus a double-click `Export iPhone.command`. It reads a local iPhone backup, or the Mac's own synced copies, and saves texts, calls, voicemail, notes and contacts as HTML, TXT, CSV, vCard and optional PDF. A home-made stand-in for iMazing's export.

## State
- v0.3.0. 23 automated tests pass on Python 3.13 and 3.9 (3.9 is what the macOS Command Line Tools ship).
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
- **Never run on a real iPhone backup yet.**

## Next
1. On the laptop: `git fetch && git switch claude/iphone-texts-export`, then double-click `iphone-export/Export iPhone.command` against the latest Finder backup.
2. Spot-check against the phone: a few conversations (replies, edits, reactions), the call list, voicemail dates and notes.
3. Try `--pdf` on one conversation, then double-click `Set Up Daily Backup.command`.
4. Move to its own private repo, `Dukmar/iphone-export` (Colin decided this 2026-10-24). That waits on Colin creating the empty repo, because Claude's GitHub app can't create one.

## Files
- `iphone_export/sources.py`: finds backups; plain, encrypted and Mac sources
- `iphone_export/messages.py`, `calls.py`, `voicemail.py`, `notes.py`, `contacts.py`: readers
- `iphone_export/decode.py`: iMessage `attributedBody`, edit history and Notes protobuf decoders
- `iphone_export/render.py`: HTML/TXT/CSV/vCard writer, search and gallery pages, print layout
- `iphone_export/pdf.py`: headless Chrome to PDF
- `iphone_export/snapshots.py`: dated APFS-clone versions of each backup
- `iphone_export/schedule.py`: nightly LaunchAgent
- `iphone_export/cli.py`: `list`, `backup`, `export`, `sync`, `auto`, `schedule`
- `Export iPhone.command`, `Set Up Daily Backup.command`: double-click launchers
- `tests/`: fixture builder, real Messages schema, tests
