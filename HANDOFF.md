# Handoff: iPhone texts export tool (2026-10-24)

Branch: `claude/iphone-texts-export`. Everything is in the new `iphone-export/` folder. The profile `README.md` at the repo root is untouched.

## Done
- `iphone-export/iphone_export/` is a Python package with four commands:
  - `list` shows the backups on the Mac.
  - `backup` makes one with `idevicebackup2`.
  - `export` reads a backup (plain or encrypted), or reads the Mac directly with `--mac`.
  - `sync` runs backup, then export.
- The export writes `index.html`, one HTML and one TXT file per conversation (bubbles, reactions, edits, unsent, inline attachments), `messages.csv`, `calls.html`/`calls.csv` and `notes.html` plus one TXT per note.
  - SMS and iMessage threads with the same person merge into one conversation.
  - Numbers show as contact names, from the backup's address book plus the Mac's.
  - Encrypted backups can save their unlock key in the macOS Keychain, so later runs skip the slow password step.
  - Re-runs skip attachments already copied.
- `iphone-export/Export iPhone.command` is the double-click launcher. It sets up a private Python environment on first run, then runs `sync` if a phone is plugged in and `idevicebackup2` is installed, else `export` on the newest backup.
- `iphone-export/README.md` covers the three routes, the Full Disk Access step, options and known gaps.
- `iphone-export/tests/` has a fake-backup builder (plain and encrypted) using Apple's real Messages `CREATE TABLE` statements, and 11 tests.
- **Verified:**
  - All 11 tests pass on Python 3.13 and 3.9.
  - Pages rendered in Chromium in light and dark mode: no console errors, no sideways scroll at 390px, uniform row heights checked with `getBoundingClientRect`.
  - The text decoder was checked against 50 real Messages blobs from the imessage-exporter project.
  - Apple's "About encrypted backups" page (support.apple.com/en-ca/108353, published 2026-09-21) confirms call history is only in encrypted backups. The README says so.
- **Not verified:** never run against a real iPhone backup, a real Mac `chat.db`, real Notes or real call history. There's no phone or Mac in the cloud session.

## Open
- First real run. Make a Finder backup, double-click `Export iPhone.command` and spot-check a few conversations, the call list and some notes against the phone.
- Should this live in its own repo? `Dukmar/Dukmar` is the GitHub profile repo, so a tool folder there is an odd fit. I didn't create a repo without asking.
- Is your Finder backup encrypted? It needs to be for call history. If it is, the first run asks for the backup password (the one set in Finder, not the phone passcode).
- Where should iMazing's own backups be searched? I didn't know where iMazing stores them, so the tool only checks Finder's folder and `~/iPhone Backups`. If yours are elsewhere, pass `--backup <folder>`.

## Needs the laptop
- Everything above: the iPhone, the cable, Finder backups, Full Disk Access for Terminal and the Keychain prompt all live on the Mac.
- Optional: `brew install libimobiledevice` for the one-step `sync` route.

## Memory candidates
- iPhone backups leave call history out unless backup encryption is on. Source: Apple support page 108353, published 2026-09-21.
- macOS Command Line Tools ships Python 3.9, so scripts meant to double-click on Colin's Mac should run on 3.9 (no `X | None` annotations without `from __future__ import annotations`, no backslashes inside f-string expressions). Source: this session.
- Colin's goal, verbatim: "I want to create an app or process that will quickly download my Texts from my iPhone. In the past, I've used the app iMazing to get things like my call history, my messages, and my notes saved to my laptop." Source: Colin, 2026-10-24.
