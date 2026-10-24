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

**Round 3 (v0.3).** Colin: "Nightly run is good. Over wifi. Dated versions of each back up is also good." iMazing's automatic-backup guide (updated 2026-04-22) says "Since iOS 16.1, Apple has implemented an additional security measure requiring you to enter your device passcode" for every backup. So a 2 a.m. unattended run would stall, and I built it the way iMazing handles it:
- `cli.py` has a new `auto` command, which is what the scheduled job runs. It tries hourly inside a window (default 18:00-23:00), only when the phone is reachable over Wi-Fi, and stops after the first success that day. It uses a lock file so two runs can't overlap.
- `backup` watches idevicebackup2's output for the passcode prompt, shows a Mac notification, and gives up after `--passcode-wait` minutes (default 15).
- `schedule` now takes `--window` instead of `--at` and runs `auto`.
- New `snapshots.py`: after each backup, a dated APFS clone (`cp -c`) goes to `~/iPhone Backups/Snapshots/<UDID>/<date time>/`, pruned after `--keep-days` (default 30, iMazing's default). `list` shows the dated versions and `export --snapshot YYYY-MM-DD` exports one.
- New `Set Up Daily Backup.command`: a one-time double-click setup that installs libimobiledevice, does the Finder Wi-Fi tick, runs the first cable backup (saving the Keychain key) and sets up the schedule.
- Default output moved from `~/Documents/iPhone Export` to `~/iPhone Export`, because macOS blocks background jobs from Documents.
- `Export iPhone.command` now falls back to a Wi-Fi backup when no cable is plugged in, so a manual export over Wi-Fi is one double-click. Checked with stand-in tools for all three cases: cable, Wi-Fi only, and no phone.

**Round 4 (v0.4, the Mac app).** Colin asked "Will this end up being an app on my phone? Easy to use?" I explained that iOS sandboxing means no phone app can read Messages, and offered three options. He picked: "I like the idea of a proper Mac app, so let's do that."
- `mac-app/` is a Swift package.
  - `ExportCore` is plain Foundation. It runs the Python engine, parses its progress, decodes the status summary and builds the arguments for each option.
  - `iPhoneExport` is the SwiftUI app: a main window with phone status, Back Up & Export / Export Latest / Open Last Export, a progress card with a passcode banner and Cancel, and a result card. It has four tabs: Export Options, Dated Versions, Daily Backup, Setup. There's also a menu bar icon and a password dialog for encrypted backups.
- `mac-app/build-app.sh` builds `iPhone Export.app`. It embeds the engine in `Contents/Resources/engine`, makes the icon (`Resources/AppIcon.iconset`, drawn for this) and signs ad hoc. `--install` copies the app to Applications.
- Engine changes for the app:
  - `events.py`: `@@EVENT` JSON progress lines when `IPHONE_EXPORT_EVENTS=1`.
  - A `status` command that prints a JSON summary.
  - New exit codes: 4 = password needed, 5 = wrong password, 130 = cancelled.
  - SIGTERM now stops idevicebackup2 too.
  - `--no-keychain` now also skips the Keychain read.
- `.github/workflows/iphone-export-mac.yml` builds and tests on a macOS 15 runner. It runs the Python tests, the Swift tests, `build-app.sh` and a bundle check, then uploads the zipped app as a download. First run (run 40117972662, 2026-10-24) passed:
  - the SwiftUI app compiled and linked on macOS 15 (arm64);
  - the Swift tests passed 12 of 12 there;
  - `codesign --verify` and `plutil -lint` were clean;
  - the artifact is at https://github.com/Dukmar/Dukmar/actions/runs/40117972662 (download expires after 90 days).

**Verified:**
- 23 tests pass on Python 3.13 and 3.9. They include dated versions (take, prune, pick and export), the passcode give-up with its notification, and `auto` running once a day and skipping when the phone isn't reachable or the time is outside the window. Earlier rounds' tests cover the rest.
- Round 2 checks: They cover plain and encrypted backups, the Mac route, filters, conversion, the disk guard, PDF (real headless Chromium, with "Page 1 of" and the footer read back out of the PDF), the schedule plist, and backup-then-export.
- Edit-history decoding matches all 9 real edited-message samples from imessage-exporter.
- Pages render with no console errors in light and dark mode and fit a 390px-wide screen. Table row heights are uniform, checked with `getBoundingClientRect`.

- Round 4: 28 Python tests (3.13 and 3.9) and 12 Swift tests, compiled with Swift 6.1.2 on Linux. The Swift tests run the real engine from Swift: plain and encrypted backups, the password flow (needed, then wrong, then right), the status summary, Cancel, and a missing executable.

**Not verified:**
- No real iPhone backup, real `chat.db`, real voicemail or real Mac.
- `sips`, `afconvert`, `idevicebackup2`, `idevice_id`, `osascript`, `launchctl` and `cp -c` (APFS clones) were tested only with stand-ins.
- Not verified that idevicebackup2's passcode message contains the word "passcode" on current iOS. The text I matched ("Waiting for passcode to be entered on the device") comes from a Corellium support log. If the Mac never shows the notification, check `~/Library/Logs/iphone-export.log` for the real wording.

## Round 5 (2026-10-24 evening, Colin's P Mac, local session)
Colin: "Build and install my iPhone Export Mac app ... walk me through its Setup tab", then "just getting the text messages onto this computer" and "at the start of each month, the previous month's text messages get filed away into this folder" (the Drive folder `Historical Files/iPhone Text Messages`). He picked the app-at-login option for scheduling.
- Built and installed first try. Setup done: Python environment, libimobiledevice 1.4.0, Full Disk Access, Finder "Show this iPhone when on Wi-Fi" (a Finder "Sync and Replace" prompt about media from Colin's iMac was cancelled; the Wi-Fi setting stuck anyway, `EnableWifiConnections: true`).
- **Phone backup failed: ErrorCode 105**, not enough space (about 140 GB free on the Mac, about 370 GB of data on the phone). Apple's backup can't be partial.
- **Texts come from the Mac instead.** New `archive` command + `archive.py`; the app's Daily Backup tab has a Monthly text archive section and the app registers as a login item (SMAppService), opening menu-bar-only at login.
- **Found and fixed:** the Mac's database keeps messages from deleted conversations with no chat row (596 of 625 in Dec 2024). They were silently skipped; now exported and marked.
- **Don't use launchd for anything that reads Messages.** A LaunchAgent running the app's executable got no Full Disk Access, and macOS switched the app's access off (auth_reason 5) when it ran. The `--engine` launch mode and `archive --schedule` were removed.
- Backfilled 49 months (36,599 messages, 8.8 GB) and copied them to Drive `.../iPhone Text Messages/Messages by month/`; the copy matches file for file. A run from the app returned "Every finished month is already filed."
- Correction to my own earlier claim: the Mac's history starts March 2023, not May 2019. The Drive folder's older `iMessages/` archive covers Oct 2013 to Apr 2015 (iMazing-style PDFs/CSVs made 2015-04-14).
- Nothing committed. Changes are in the worktree `~/Projects/Dukmar-iphone-export` (branch `claude/iphone-texts-export`).

## Open
- **Commit and push** this session's changes, then bump the version. Every rebuild resets Full Disk Access (ad-hoc signature), so rebuild once and re-toggle.
- **Login item:** confirm after the next login that the app is in the menu bar with no window, and on Nov 1 that `2026-10` appears locally and in Drive.
- **Phone backups (calls, voicemail):** free about 250 GB, or add a backup-location setting for the My Book Duo.
- **Swift test** `testEncryptedBackupAsksForPasswordThenUnlocks` fails on this Mac before and after these changes (fixture setup exits 1). Not investigated.
- **Voicemail dates**, **new repo**, **not built** (WhatsApp etc.): unchanged from round 4.

## Needs the laptop
- Everything above: the iPhone, the cable, Finder backups, Full Disk Access for Terminal, the Keychain prompt, and launchd for the nightly run.
- Daily run: Homebrew, the cable for the first backup, the Finder Wi-Fi tickbox, and the passcode on the phone each day.
- Optional: Chrome (or Edge/Brave) for `--pdf`.

## Memory candidates
- iPhone backups leave call history out unless backup encryption is on. Source: Apple support page 108353, published 2026-09-21.
- macOS Command Line Tools ships Python 3.9, so scripts meant to double-click on Colin's Mac should run on 3.9 (no `X | None` annotations without `from __future__ import annotations`, no backslashes inside f-string expressions). Source: this session.
- iLEAPP (github.com/abrignoni/iLEAPP) and imessage-exporter (github.com/ReagentX/imessage-exporter) are good references for iOS database layouts, with real sample data. Source: this session.
- Colin's goal, verbatim: "I want to create an app or process that will quickly download my Texts from my iPhone. In the past, I've used the app iMazing to get things like my call history, my messages, and my notes saved to my laptop." Later: "Yes move it to its own repository.", "I like the idea of a proper Mac app, so let's do that." and "Nightly run is good. Over wifi. Dated versions of each back up is also good." Follow-up: "You can look at other apps that do similar things and take all the best features from them all to create this type of app." Source: Colin, 2026-10-24.
- Since iOS 16.1 every iPhone backup to a computer needs the phone's passcode entered on the phone, scheduled ones included, so any automated backup has to be timed for when Colin has his phone. Source: iMazing's automatic-backup guide (updated 2026-04-22).
- macOS blocks background jobs (LaunchAgents) from ~/Documents, ~/Desktop and ~/Downloads without a consent prompt they can't show; scheduled outputs go elsewhere in the home folder. Source: this session.
- No App Store iPhone app can read Messages, call history or voicemail (iOS sandbox); iPhone export tools are always computer apps that read a backup. Source: this session.
