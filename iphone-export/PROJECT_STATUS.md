# iPhone Export: status

**Updated:** 2026-10-24

## What it is
A Python command-line tool (plus a double-click `Export iPhone.command`) that reads a local iPhone backup, or the Mac's own synced copies, and saves texts, call history and notes as HTML, TXT and CSV. A home-made stand-in for iMazing's export.

## State
- v0.1.0 built in a cloud session. 11 automated tests pass on Python 3.13 and 3.9 (3.9 is what macOS Command Line Tools ships).
- Tested against synthetic plain and encrypted backups built with Apple's real Messages table layout, and against 50 real Messages text blobs from imessage-exporter's test data (49 decode fully; the 50th is a deliberately truncated sample and decodes partially, as expected).
- **Never run on a real iPhone backup yet.** First real run is the next step.

## Next
1. On the laptop: `git fetch && git switch claude/iphone-texts-export`, then run route 1 in the README against the latest Finder backup.
2. Compare a few conversations and the call list against the phone.
3. Decide whether the tool moves out of the `Dukmar` profile repo into its own repo.

## Files
- `iphone_export/sources.py`: finds backups; plain, encrypted and Mac sources
- `iphone_export/messages.py`, `calls.py`, `notes.py`, `contacts.py`: readers
- `iphone_export/decode.py`: iMessage `attributedBody` and Notes protobuf decoders
- `iphone_export/render.py`: HTML/TXT/CSV writer
- `iphone_export/cli.py`: `list`, `backup`, `export`, `sync`
- `tests/`: fixture builder, real Messages schema, tests
