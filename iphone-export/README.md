# iPhone Export

Saves iPhone texts (iMessage and SMS, with photos and attachments), call history and Apple Notes to a folder on the Mac. It's a home-made stand-in for the iMazing exports: same source data, no licence.

What you get, in `~/Documents/iPhone Export/` by default:

- `index.html`: every conversation, newest first, with a search box
- `Messages/<name>.html`: one page per person or group, in chat bubbles with dates, reactions, edits, unsent markers and attachments inline
- `Messages/<name>.txt`: the same conversation as plain text
- `messages.csv`: every message in one spreadsheet
- `calls.html` and `calls.csv`: call history, covering phone, FaceTime and app calls (WhatsApp etc.)
- `notes.html` plus `Notes/<folder>/<title>.txt`: every note as plain text

Phone numbers show as contact names when the address book has them.

> **Status (2026-10-24):** built and tested against a synthetic backup and against real Messages text blobs. It has **not** been run on a real iPhone backup yet. The first real run is the real test.

## How it gets the data

An iPhone doesn't hand its databases to a Mac directly. Everything (iMazing included) reads a **local backup** of the phone: a folder of files plus an index (`Manifest.db`). This tool finds the backup, pulls out four databases (Messages, Contacts, Call History, Notes) and turns them into readable files. It only ever reads; it never writes to the phone or the backup.

There are three ways to run it, from least to most setup.

### 1. Use a Finder backup (no installs)

1. Plug in the iPhone, open Finder, click the phone in the sidebar.
2. Choose **Back up all of the data on your iPhone to this Mac**. Tick **Encrypt local backup** if you want call history (Apple leaves call history, passwords and Health data out of unencrypted backups). Click **Back Up Now**. After the first backup, later ones only copy what changed, so they're much quicker.
3. Double-click **`Export iPhone.command`**, or run:

   ```bash
   cd iphone-export
   python3 -m iphone_export export --open
   ```

It picks the newest backup on the Mac. If the backup is encrypted it asks for the backup password once and offers to keep the unlock key in your Keychain. Unlocking with the password takes a while (Apple slows it down on purpose); the saved key unlocks in a second.

### 2. One step, cable plugged in (installs `libimobiledevice`)

```bash
brew install libimobiledevice
python3 -m iphone_export sync --open
```

`sync` backs the phone up with `idevicebackup2` into `~/iPhone Backups/`, then exports. The double-click launcher does this automatically when it sees the tool and a plugged-in phone. Unlock the phone and tap **Trust** the first time. Encrypted backups also ask for the phone's passcode on the phone itself.

This keeps its own backup, separate from Finder's. A full backup is as big as the phone's used storage, so if you also keep Finder backups you'll have two copies. Pick one route and stick with it.

### 3. Straight from this Mac (no phone, no backup)

If **Messages in iCloud** is on and the Mac's Messages app is signed in, the Mac already has the conversations, and Notes and iPhone call relay keep copies too:

```bash
python3 -m iphone_export export --mac --open
```

This is the fastest route, but it only has what has synced to the Mac.

## One-time Mac permission

macOS hides both the backups and the Messages database from apps by default. The first time, give your terminal access: **System Settings > Privacy & Security > Full Disk Access**, switch on **Terminal** (or iTerm), then quit and reopen it. The tool says so if this is the problem.

## Options

| Option | What it does |
| --- | --- |
| `--since 2026-01-01` | only messages and calls on or after that date |
| `--only messages` | any of `messages,calls,notes` |
| `--no-attachments` | skip copying photos and videos (much faster on a big phone) |
| `--convert-heic` | turn iPhone HEIC photos into JPEGs so Chrome can show them (Safari shows HEIC as is) |
| `--out ~/Desktop/Texts` | different output folder |
| `--backup /path/to/backup` | a specific backup folder, e.g. one iMazing or a USB drive holds |
| `--forget-password` | delete the saved unlock key from the Keychain |
| `list` | show every backup found and its date |

Re-running into the same folder rewrites the pages and skips attachments it already copied, so the second run is quick.

## Setup for the encrypted-backup support

Plain backups and `--mac` need nothing beyond the Python that comes with the Mac's Command Line Tools. Encrypted backups need one library:

```bash
python3 -m pip install -r requirements.txt
```

The double-click launcher handles this itself by building a private environment in `~/.iphone-export-venv` on first run.

## Known gaps

- **Attachments offloaded to iCloud** (older photos the phone no longer keeps locally) aren't in any backup. They show as "not in backup".
- **Notes** come out as plain text. Formatting, tables, checklist ticks and pictures inside notes are dropped (pictures show as `[attachment]`). Locked notes are listed but not opened.
- **Message effects, stickers, polls and link previews** aren't drawn. The text and links come through.
- **iCloud backups** can't be read; this needs a backup on the Mac.

## Tests

```bash
python3 -m pip install pytest pycryptodome iphone_backup_decrypt==0.11.2
python3 -m pytest
```

The tests build a fake backup (plain and encrypted) using Apple's real Messages table layout, export it, and check the output, including the Mac route. Text decoding is checked against message blobs from real Messages databases when the [imessage-exporter](https://github.com/ReagentX/imessage-exporter) test data is on disk (set `TYPEDSTREAM_SAMPLES` to its `imessage-database/test_data/typedstream` folder).

## Credits

Encrypted-backup decryption is [iphone_backup_decrypt](https://github.com/jsharkey13/iphone_backup_decrypt) by James Sharkey (MIT).
