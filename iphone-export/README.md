# iPhone Export

Saves iPhone texts (iMessage, SMS and RCS, with photos and attachments), call history, voicemail, Apple Notes and contacts to a folder on the Mac. It's a home-made stand-in for iMazing's exports: same source data, no licence, and it can back the phone up over Wi-Fi every evening and keep a month of dated versions.

> **Status (2026-10-24):** version 0.3. Tested against a synthetic backup and against real Messages data blobs. It has **not** been run on a real iPhone backup yet. The first real run is the real test.

## What you get

In `~/iPhone Export/` by default. It isn't in Documents, because macOS blocks background jobs like the daily run from writing there.

| File | What's in it |
| --- | --- |
| `index.html` | every conversation, newest first, plus totals and a menu to the pages below |
| `Messages/<name>.html` | one page per person or group, as chat bubbles |
| `Messages/<name>.txt` | the same conversation as plain text |
| `search.html` | one search box across every message, with each hit linking to its spot in the conversation |
| `photos.html` | every photo and video from Messages in one grid, newest first |
| `calls.html` | call history: phone, FaceTime and app calls such as WhatsApp |
| `voicemail.html` | voicemails with playable audio and Apple's transcript |
| `notes.html`, `Notes/<folder>/<title>.txt` | every note as plain text |
| `contacts.html`, `contacts.vcf` | the address book, as a list and as a file Contacts can import |
| `messages.csv`, `calls.csv`, `voicemail.csv`, `contacts.csv` | the same data as spreadsheets for Excel or Numbers |
| `PDF/` | with `--pdf`: print-ready PDFs of each conversation, the call list and voicemail |

The conversation pages show:

- reactions, with who reacted;
- replies, with a quote of the message being answered (click it to jump there);
- edits, with every earlier version listed under "Edited";
- unsent messages, and messages sitting in **Recently Deleted**, which are recovered and outlined in orange;
- "Read 10:07 AM" on your own messages;
- send effects ("Sent with Balloons") and Apple Cash or app messages.

Your iMessage and SMS threads with the same person merge into one conversation. So do a person's number and email when they're on the same contact card.

## Where the features came from

I looked at what the paid and open-source tools do and copied the useful parts:

| Feature | Seen in |
| --- | --- |
| PDF with the chat name on top, page numbers, and the device and export date in the footer | iMazing ("Add export metadata in footer"), Decipher TextMessage |
| Search across all messages; date range; filter by person | iMazing |
| Show replies with the original message; show recently deleted messages | iMazing display options |
| CSV with delivered and read dates | iMazing |
| Edit history, read receipts, send effects, app messages | imessage-exporter |
| Converting photos and voice notes for any browser; attachments dated to their message | imessage-exporter |
| Free-space check before copying attachments | imessage-exporter |
| Merging threads by contact card | imessage-exporter |
| Voicemail with audio and transcript | TouchCopy, Decipher TextMessage, iMazing (layout from iLEAPP) |
| Contacts to vCard and CSV | iMazing |
| Daily automatic backup over Wi-Fi, with a notification when the phone wants its passcode | iMazing |
| Dated versions of each backup, kept for a month | iMazing ("snapshots") |
| Photo gallery across all conversations | iMazing's "Only show attachments" view |

Sources: iMazing's Messages export guide (updated 2026-10-21) and backup guides, the Decipher TextMessage and TouchCopy product pages, imessage-exporter's `docs/features.md`, and iLEAPP's voicemail and notes parsers.

## How it gets the data

An iPhone doesn't hand its databases to a Mac directly. Every tool in the table above reads a **local backup** of the phone: a folder of files plus an index (`Manifest.db`). This tool finds the backup, pulls out the Messages, Contacts, Call History, Voicemail and Notes databases, and turns them into readable files. It only ever reads. It never writes to the phone or the backup.

There are four ways to run it, from least to most setup.

### 1. Use a Finder backup (no installs)

1. Plug in the iPhone, open Finder, click the phone in the sidebar.
2. Choose **Back up all of the data on your iPhone to this Mac**. Tick **Encrypt local backup** if you want call history: Apple leaves call history, passwords and Health data out of unencrypted backups. Click **Back Up Now**. After the first backup, later ones only copy what changed.
3. Double-click **`Export iPhone.command`**.

It picks the newest backup on the Mac. For an encrypted backup it asks for the backup password once and offers to keep the unlock key in your Keychain. Unlocking with the password takes a while (Apple slows it down on purpose); the saved key unlocks in a second.

### 2. One step, cable plugged in (installs `libimobiledevice`)

```bash
brew install libimobiledevice
python3 -m iphone_export sync --open
```

`sync` backs the phone up with `idevicebackup2` into `~/iPhone Backups/`, then exports. The double-click launcher does this automatically when it sees the tool and a plugged-in phone. Unlock the phone and tap **Trust** the first time. Encrypted backups also ask for the phone's passcode on the phone itself.

This keeps its own backup, separate from Finder's. A full backup is as big as the phone's used storage, so if you also keep Finder backups you'll have two copies. Pick one route and stick with it.

### 3. Every evening over Wi-Fi, by itself

Double-click **`Set Up Daily Backup.command`** once. It:

1. installs `libimobiledevice` with Homebrew if it's missing;
2. asks you to plug the phone in and tick Finder's **Show this iPhone when on Wi-Fi** (what lets later backups skip the cable);
3. makes the first backup over the cable, which stores the backup's unlock key in the Keychain if it's encrypted;
4. sets up the daily run.

After that, every evening between 18:00 and 23:00 the Mac tries once an hour to back up the iPhone over Wi-Fi and refresh the export. Once one works, it waits until the next day.

**Your part each day:** since iOS 16.1, Apple makes the phone ask for its passcode before *every* backup, automatic ones included. iMazing has the same limit. When the phone asks, the Mac shows a notification; enter the passcode on the phone. If nobody does within 15 minutes, the run stops and tries again the next hour. A 2 a.m. run would sit waiting all night, so the window is set for the evening, when the phone is usually nearby.

Other things to know:

- The phone has to be awake and on the same Wi-Fi. If the Mac is asleep through the window, nothing runs that day.
- To change the hours: `schedule --wifi --window 19:00-22:00`. `schedule --status` shows the plan and `schedule --off` removes it. The log is at `~/Library/Logs/iphone-export.log`.
- Run it from the folder it will live in. The daily job remembers this folder's location, so move the folder and you'll need to run the setup again.

### Dated versions

After each backup made by this tool (`backup`, `sync` or the daily run), a dated copy is kept in `~/iPhone Backups/Snapshots/<phone id>/<date time>/` for 30 days (`--keep-days` changes that). On the Mac's own drive these are APFS clones: a copy only takes space for what changed since, so a month of them costs about one backup plus a month of changes. A drive that can't clone (some external drives) gets no dated versions rather than a full copy every day.

```bash
python3 -m iphone_export list                                  # backups and dated versions
python3 -m iphone_export export --snapshot 2026-10-01 --out ~/Desktop/October-1
```

`--snapshot` picks the last version taken on or before that day, which helps when something has since been deleted from the phone.

### 4. Straight from this Mac (no phone, no backup)

If **Messages in iCloud** is on and the Mac's Messages app is signed in, the Mac already has the conversations, and Notes and iPhone call relay keep copies too:

```bash
python3 -m iphone_export export --mac --open
```

This is the fastest route, but it only has what has synced to the Mac, and it has no voicemail.

## One-time Mac permission

macOS hides both the backups and the Messages database from apps by default. The first time, give your terminal access: **System Settings > Privacy & Security > Full Disk Access**, switch on **Terminal** (or iTerm), then quit and reopen it. The tool says so if this is the problem.

## Options

| Option | What it does |
| --- | --- |
| `--since 2026-01-01`, `--until 2026-07-01` | only messages, calls and voicemail in that range |
| `--contact "Alison,416-555-1234"` | only conversations and calls with those people (names, numbers or emails) |
| `--only messages,calls` | any of `messages,calls,voicemail,notes,contacts` |
| `--pdf` | also make PDFs (needs Chrome, Edge, Brave or Chromium installed) |
| `--convert-media` | HEIC photos to JPEG and voice notes to M4A, so Chrome can show them (the launcher does this by default) |
| `--me-name Colin` | your name in place of "Me" |
| `--no-attachments` | skip copying photos and videos (much faster on a big phone) |
| `--out ~/Desktop/Texts` | different output folder |
| `--snapshot 2026-10-01` | export a dated version instead of the latest backup |
| `--backup /path/to/backup` | a specific backup folder, e.g. one on a USB drive |
| `--ignore-disk-warning` | copy attachments even when free space looks tight |
| `--forget-password` | delete the saved unlock key from the Keychain |
| `list` | show every backup and dated version found |

Re-running into the same folder rewrites the pages and skips attachments it already copied, so the second run is quick. Copied photos and voice notes carry the date of their message, so Finder and Photos sort them correctly.

## Setup for encrypted backups

Plain backups and `--mac` need nothing beyond the Python that comes with the Mac's Command Line Tools. Encrypted backups need one library:

```bash
python3 -m pip install -r requirements.txt
```

The double-click launcher handles this itself by building a private environment in `~/.iphone-export-venv` on first run.

## Known gaps

- **Attachments offloaded to iCloud** (older photos the phone no longer keeps locally) aren't in any backup. They show as "not in backup".
- **Notes** come out as plain text. Formatting, tables, checklist ticks and pictures inside notes are dropped (pictures show as `[attachment]`). Locked notes are listed but not opened.
- **Stickers, handwriting, Digital Touch drawings and link preview images** aren't drawn. The text, links and a label come through.
- **Voicemail audio** is Apple's `.amr` unless `--convert-media` turns it into `.m4a`. iLEAPP doesn't confirm the time format voicemail dates are stored in, so the tool detects it. Check the first real export's voicemail dates against the phone.
- **iCloud backups** can't be read; this needs a backup on the Mac.

## Tests

```bash
python3 -m pip install pytest pycryptodome pypdf iphone_backup_decrypt==0.11.2
python3 -m pytest
```

The tests build a fake backup (plain and encrypted) using Apple's real Messages table layout, export it, and check every output, including the Mac route, PDFs, scheduling, dated versions, the passcode wait and the once-a-day logic. Media conversion and `idevicebackup2` are exercised with stand-in scripts, because those tools only exist on a Mac. Text and edit-history decoding are checked against blobs from real Messages databases when the [imessage-exporter](https://github.com/ReagentX/imessage-exporter) test data is on disk (set `TYPEDSTREAM_SAMPLES` to its `imessage-database/test_data/typedstream` folder).

## Credits

Encrypted-backup decryption is [iphone_backup_decrypt](https://github.com/jsharkey13/iphone_backup_decrypt) by James Sharkey (MIT). Database layouts were checked against [imessage-exporter](https://github.com/ReagentX/imessage-exporter) and [iLEAPP](https://github.com/abrignoni/iLEAPP); no code from either is included.
