# Handoff: iPhone texts export tool (2026-10-24)

Branch: `claude/iphone-texts-export`. Everything is in `iphone-export/`. The profile `README.md` at the repo root is untouched.

## Done
**Round 1 (v0.1).** Built the tool: `list`, `backup`, `export`, `sync`. It reads plain and encrypted Finder/idevicebackup2 backups, or the Mac directly, and writes texts, calls and notes as HTML, TXT and CSV. There's a double-click launcher.

**Round 2 (v0.2).** Colin asked: "look at other apps that do similar things and take all the best features from them all". I read:
- iMazing's Messages export guide (updated 2026-10-21) and its backup guides;
- the Decipher TextMessage and TouchCopy product pages;
- imessage-exporter's feature docs;
- iLEAPP's voicemail, notes and call-history parsers.

Then I added the features below.

`messages.py`:
- reply quotes;
- edit history from `message_summary_info`;
- recovery of Recently Deleted messages;
- delivered and read times;
- send effects;
- Apple Cash and app message labels;
- `--me-name`;
- `--contact` and `--until` filters;
- merging threads by contact card.

`render.py`:
- `search.html` (search every message, linking into the conversation);
- `photos.html` gallery;
- `voicemail.html`/`.csv`;
- `contacts.html`/`.csv`/`.vcf`;
- a nav bar on every page;
- print layout with the title on top, page numbers and an export-details footer;
- HEIC→JPEG and CAF/AMR→M4A via `sips`/`afconvert`;
- attachment files dated to their message;
- a free-space check.

New modules:
- `voicemail.py`: voicemail.db plus `<ROWID>.amr` and `.transcript`.
- `pdf.py`: headless Chrome PDFs (`--pdf`).
- `schedule.py`: nightly LaunchAgent (`schedule --at 02:30 --wifi`, `--status`, `--off`).

Other changes:
- `backup`/`sync` take `--wifi`.
- `notes.py`: fixed a real bug that iLEAPP documents. On iOS 16+ the note date columns could have come back blank; the tool now picks the column that's actually filled.
- `calls.py`: app calls show "WhatsApp" rather than `net.whatsapp.WhatsApp`.
- `contacts.py`: keeps full cards (labels, phones, emails) for export.
- `Export iPhone.command` now converts media by default.
- README rewritten, including a "where the features came from" table.

**Verified:**
- 18 tests pass on Python 3.13 and 3.9. They cover plain and encrypted backups, the Mac route, filters, conversion, the disk guard, PDF (real headless Chromium, with "Page 1 of" and the footer read back out of the PDF), the schedule plist, and backup-then-export.
- Edit-history decoding matches all 9 real edited-message samples from imessage-exporter.
- Pages render with no console errors in light and dark mode and fit a 390px-wide screen. Table row heights are uniform, checked with `getBoundingClientRect`.

**Not verified:**
- No real iPhone backup, real `chat.db`, real voicemail or real Mac.
- `sips`, `afconvert`, `idevicebackup2` and `launchctl` were tested only with stand-in scripts.

## Open
- **First real run.** Make a Finder backup, double-click `Export iPhone.command`, and spot-check a few conversations, calls, voicemail and notes against the phone.
- **Voicemail dates.** iLEAPP doesn't confirm how voicemail dates are stored, so the tool detects the format. Check that the first export's voicemail dates match the phone.
- **Nightly run.** Do you want it? If so, which time, and Wi-Fi or cable? It's opt-in: `python3 -m iphone_export schedule --at 02:30 --wifi`.
- **Own repo?** `Dukmar/Dukmar` is the GitHub profile repo, so a tool folder there is an odd fit. I didn't create a repo without asking.
- **Encrypted backup?** Is your Finder backup encrypted? It needs to be for call history. The first run asks for the backup password (the one set in Finder, not the phone passcode).
- **iMazing's backups.** I don't know where iMazing keeps its own backups. If yours are there, pass `--backup <folder>`.
- **Not built:**
  - WhatsApp chats (iMazing and TouchCopy do them; it's a separate database and a bigger job);
  - drawing stickers, handwriting and Digital Touch;
  - backup snapshots (iMazing keeps dated versions; idevicebackup2 keeps one).

  Say if any of these matter.

## Needs the laptop
- Everything above: the iPhone, the cable, Finder backups, Full Disk Access for Terminal, the Keychain prompt, and launchd for the nightly run.
- Optional: `brew install libimobiledevice` for `sync` and `schedule`; Chrome (or Edge/Brave) for `--pdf`.

## Memory candidates
- iPhone backups leave call history out unless backup encryption is on. Source: Apple support page 108353, published 2026-09-21.
- macOS Command Line Tools ships Python 3.9, so scripts meant to double-click on Colin's Mac should run on 3.9 (no `X | None` annotations without `from __future__ import annotations`, no backslashes inside f-string expressions). Source: this session.
- iLEAPP (github.com/abrignoni/iLEAPP) and imessage-exporter (github.com/ReagentX/imessage-exporter) are good references for iOS database layouts, with real sample data. Source: this session.
- Colin's goal, verbatim: "I want to create an app or process that will quickly download my Texts from my iPhone. In the past, I've used the app iMazing to get things like my call history, my messages, and my notes saved to my laptop." Follow-up: "You can look at other apps that do similar things and take all the best features from them all to create this type of app." Source: Colin, 2026-10-24.
