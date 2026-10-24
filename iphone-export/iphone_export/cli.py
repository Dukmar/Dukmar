"""Command line: list backups, make a backup, export texts / calls / notes."""

from __future__ import annotations

import argparse
import getpass
import json
import os
import queue
import shutil
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from . import __version__, calls, contacts, events, messages, notes, pdf, schedule, snapshots, sources, voicemail
from .render import Exporter

# Not ~/Documents: macOS blocks background jobs (the daily run) from Documents without a prompt they can't show.
DEFAULT_OUT = Path.home() / "iPhone Export"
KEYCHAIN_SERVICE = "iphone-export"
WHAT = ("messages", "calls", "voicemail", "notes", "contacts")


def say(text=""):
    print(text, flush=True)


# --------------------------------------------------------------------------------------------- keychain

def _keychain_get(account):
    if sys.platform != "darwin":
        return None
    r = subprocess.run(["security", "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return bytes.fromhex(r.stdout.strip())
    except ValueError:
        return None


def _keychain_set(account, key):
    r = subprocess.run(["security", "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", account,
                        "-l", "iPhone backup unlock key (iphone-export)", "-w", key.hex()],
                       capture_output=True, text=True)
    return r.returncode == 0


def _keychain_delete(account):
    subprocess.run(["security", "delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account],
                   capture_output=True)


# --------------------------------------------------------------------------------------------- sources

def open_source(args):
    if args.mac:
        return sources.MacSource()
    if getattr(args, "snapshot", None):
        roots = [Path(args.backup_root)] if args.backup_root else sources.backup_roots()
        day = _date(args.snapshot, "--snapshot").date()
        found = snapshots.pick(roots, day)
        if not found:
            raise sources.SourceError(f"No dated backup from {day} or earlier. See them with: list")
        info = found[1]
    elif args.backup:
        info = sources.read_backup_info(args.backup)
    else:
        roots = [Path(args.backup_root)] if args.backup_root else None
        found = sources.find_backups(roots)
        if not found:
            raise sources.SourceError(
                "No iPhone backups found. Make one first:\n"
                "  - Finder: plug in the iPhone, select it in the Finder sidebar, click 'Back Up Now'\n"
                "    (choose 'Back up all of the data on your iPhone to this Mac'), or\n"
                "  - run:  python3 -m iphone_export backup\n"
                "Or read straight from this Mac's synced copies with --mac."
            )
        info = found[0]
    say(f"Using {info.describe()}")
    if not info.encrypted:
        return sources.BackupSource(info.path, info)
    return _open_encrypted(info, args)


def _open_encrypted(info, args):
    if args.forget_password:
        _keychain_delete(info.udid)
    key = None if args.no_keychain else _keychain_get(info.udid)
    if key:
        try:
            say("Unlocking with the key saved in your Keychain...")
            return sources.EncryptedBackupSource(info.path, info, derived_key=key)
        except sources.SourceError:
            say("The saved key no longer works (backup password changed?). Asking for the password instead.")
    password = os.environ.get("IPHONE_BACKUP_PASSWORD")
    if not password:
        if not sys.stdin.isatty():
            events.emit("password_needed", device=info.device_name, udid=info.udid)
            raise sources.PasswordNeeded("This backup is encrypted. Set IPHONE_BACKUP_PASSWORD or run in a terminal.")
        password = getpass.getpass("Backup password (the one set in Finder/iTunes, not your phone passcode): ")
    say("Unlocking the backup (the first unlock takes a while - Apple makes it slow on purpose)...")
    events.stage("unlock", "Unlocking the encrypted backup")
    t = time.time()
    src = sources.EncryptedBackupSource(info.path, info, password=password)
    say(f"  unlocked in {time.time() - t:.0f}s")
    if sys.platform == "darwin" and not args.no_keychain:
        save = args.remember
        if not save and sys.stdin.isatty():
            answer = input("Save the unlock key in your Mac's Keychain so next time skips this wait? [Y/n] ")
            save = answer.strip().lower() in ("", "y", "yes")
        if save and _keychain_set(info.udid, src.derived_key):
            say("  saved (Keychain item 'iphone-export'; remove it any time with --forget-password)")
    return src


# --------------------------------------------------------------------------------------------- commands

def cmd_list(args):
    roots = [Path(args.backup_root)] if args.backup_root else sources.backup_roots()
    found = sources.find_backups(roots)
    if not found:
        say("No backups found in:")
        for r in roots:
            say(f"  {r}")
        return 1
    for b in found:
        say(b.describe())
    snaps = snapshots.all_snapshots(roots)
    if snaps:
        say(f"\nDated versions ({len(snaps)}), newest first. Export one with --snapshot YYYY-MM-DD:")
        for when, info in snaps:
            say(f"  {when:%Y-%m-%d %H:%M}  {info.device_name}")
    return 0


def notify(message, title="iPhone Export"):
    """A macOS notification, so a scheduled run can say it's waiting on the phone."""
    if sys.platform == "darwin":
        def quote(t):  # AppleScript string literal; keep non-ASCII as-is (AppleScript has no \\u escapes)
            return json.dumps(t, ensure_ascii=False)
        script = f"display notification {quote(message)} with title {quote(title)}"
        subprocess.run(["osascript", "-e", script], capture_output=True)


def _run_backup(cmd, passcode_wait):
    """Run idevicebackup2, echoing its output. Since iOS 16.1 the phone asks for its passcode before every
    backup; when that prompt shows up, notify and give up after passcode_wait minutes. Returns the exit
    code, or None if the passcode never came."""
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    try:
        return _watch_backup(proc, passcode_wait)
    except BaseException:
        # Cancelled (the app's Cancel button sends SIGTERM): don't leave idevicebackup2 running on its own.
        proc.terminate()
        try:
            proc.wait(timeout=20)
        except subprocess.TimeoutExpired:
            proc.kill()
        raise


def _watch_backup(proc, passcode_wait):
    lines = queue.Queue()
    reader = threading.Thread(target=lambda: [lines.put(line) for line in proc.stdout] and None, daemon=True)
    reader.start()
    deadline = None
    while True:
        try:
            line = lines.get(timeout=0.5)
        except queue.Empty:
            line = None
        if line is not None:
            print(line, end="", flush=True)
            if deadline is None and "passcode" in line.lower():
                deadline = time.monotonic() + passcode_wait * 60
                events.emit("passcode_wait", minutes=passcode_wait)
                notify("Unlock your iPhone and enter its passcode to start the backup.")
            continue
        if proc.poll() is not None and not reader.is_alive():
            return proc.returncode
        if deadline is not None and time.monotonic() > deadline:
            proc.terminate()
            try:
                proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                proc.kill()
            return None


def cmd_backup(args):
    tool = shutil.which("idevicebackup2")
    if not tool:
        say("idevicebackup2 isn't installed. Either install it once:\n"
            "    brew install libimobiledevice\n"
            "or make the backup in Finder (select the iPhone in the sidebar > Back Up Now), then run export.")
        return 1
    udids = _devices(args.wifi)
    if not udids:
        if args.wifi:
            say("No iPhone found on Wi-Fi. It needs to be on the same network and awake, and set up for Wi-Fi once: "
                "plug it in, select it in Finder, tick 'Show this iPhone when on Wi-Fi', click Apply.")
        else:
            say("No iPhone found. Plug it in with a cable, unlock it, and tap 'Trust This Computer' if asked.")
        return 1
    dest = Path(args.dir).expanduser()
    dest.mkdir(parents=True, exist_ok=True)
    udid = args.udid or udids[0]
    say(f"Backing up {udid} into {dest} (only changes since the last backup are copied).")
    events.stage("backup", "Backing up the iPhone" + (" over Wi-Fi" if args.wifi else ""))
    say("The phone will ask for its passcode (Apple requires it for every backup since iOS 16.1).")
    net = ["-n"] if args.wifi else []
    code = _run_backup([tool, *net, "-u", udid, "backup", str(dest)], args.passcode_wait)
    if code is None:
        say(f"Nobody entered the passcode within {args.passcode_wait} minutes, so the backup was stopped.")
        events.emit("error", message="No passcode was entered on the iPhone, so the backup stopped.", kind="passcode")
        return 3
    if code != 0:
        say(f"idevicebackup2 stopped with code {code}.")
        events.emit("error", message=f"The backup tool stopped with code {code}.", kind="backup")
        return code
    args.backup = str(dest / udid)
    if not args.no_snapshot:
        try:
            snap = snapshots.take(dest / udid)
            gone = snapshots.prune(dest / udid, args.keep_days)
            say(f"Saved a dated version: {snap.name}" + (f" (removed {len(gone)} older than "
                                                         f"{args.keep_days} days)" if gone else ""))
        except snapshots.SnapshotUnsupported as e:
            say(f"No dated version saved: this drive can't make space-saving clones ({e}). "
                "Backups on the Mac's own drive (APFS) can.")
    return 0


def _devices(wifi):
    ids = subprocess.run([shutil.which("idevice_id") or "idevice_id", "-n" if wifi else "-l"],
                         capture_output=True, text=True)
    return [u for u in ids.stdout.split() if u]


def _date(value, flag):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").astimezone()
    except ValueError:
        raise SystemExit(f"{flag} needs a date like 2026-01-31, got {value!r}")


def _metadata(src, generated):
    """Footer line on printed pages, like iMazing's export metadata."""
    info = getattr(src, "info", None)
    if info is not None:
        made = info.last_backup.astimezone().strftime("%Y-%m-%d %H:%M") if info.last_backup else "unknown"
        where = f"{info.device_name} (iOS {info.ios_version}) · backup {made}"
    else:
        where = "Exported from this Mac"
    return f"{where} · exported {generated.strftime('%Y-%m-%d %H:%M')}"


def cmd_export(args):
    only = set(args.only.split(",")) if args.only else set(WHAT)
    unknown = only - set(WHAT)
    if unknown:
        say(f"Unknown --only value(s): {', '.join(sorted(unknown))}. Pick from {', '.join(WHAT)}.")
        return 2
    since, until = _date(args.since, "--since"), _date(args.until, "--until")
    contact_filter = [t for t in (args.contact or "").split(",") if t.strip()]
    out = Path(args.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)

    events.stage("open", "Finding the backup")
    try:
        src = open_source(args)
    except sources.PasswordNeeded as e:
        say(str(e))
        return 4
    except sources.SourceError as e:
        say(str(e))
        events.emit("error", message=str(e), kind="bad_password" if "didn't work" in str(e) else "source")
        return 5 if "didn't work" in str(e) else 1
    started = time.time()
    generated = datetime.now().astimezone()
    problems = []
    try:
        book = contacts.load(src.contacts_dbs())
        if sys.platform == "darwin" and not args.mac:
            try:
                mac = sources.MacSource()
                try:
                    book.merge(contacts.load(mac.contacts_dbs()))
                finally:
                    mac.close()
            except sources.SourceError:
                pass
        say(f"Contacts: {len(book):,} numbers/emails matched to names")

        # Pull every database first so each page's nav bar only links to sections that exist.
        dbs = {key: src.fetch(key) for key, name in (("sms", "messages"), ("calls", "calls"),
                                                       ("voicemail", "voicemail"), ("notes", "notes"))
               if name in only}
        sections = [name for key, name in (("sms", "messages"), ("calls", "calls"), ("voicemail", "voicemail"),
                                           ("notes", "notes")) if dbs.get(key)]
        if "contacts" in only and book.people and not contact_filter:
            sections.append("contacts")
        exporter = Exporter(out, src, attachments=not args.no_attachments,
                            convert_media=args.convert_media or args.pdf, for_pdf=args.pdf,
                            metadata=_metadata(src, generated), ignore_disk=args.ignore_disk_warning)
        exporter.plan(sections)

        convo_index = []
        if "messages" in only:
            if dbs["sms"] is None:
                problems.append("Messages: no messages database in this source.")
            else:
                say("Reading messages...")
                events.stage("messages", "Reading messages")
                convos = messages.load(dbs["sms"], book, since, until, me=args.me_name or "Me",
                                       contact_filter=contact_filter)
                if contact_filter and not convos:
                    problems.append(f"Messages: no conversation matched --contact {args.contact!r}.")
                if not args.no_attachments:
                    total = sum(len(m.attachments) for c in convos for m in c.messages)
                    say(f"Copying {total:,} attachments (already-copied ones are skipped)...")
                try:
                    convo_index = exporter.write_messages(convos)
                except RuntimeError as e:
                    say(str(e))
                    events.emit("error", message=str(e), kind="disk")
                    return 1
                say(f"  {exporter.stats['messages']:,} messages in {exporter.stats['conversations']:,} conversations")
                if exporter.stats.get("recently_deleted"):
                    say(f"  {exporter.stats['recently_deleted']:,} recovered from Recently Deleted (marked in the pages)")
                if exporter.stats.get("attachments_missing"):
                    n = exporter.stats["attachments_missing"]
                    what = "attachment was" if n == 1 else "attachments were"
                    problems.append(f"Messages: {n:,} {what} not in the source "
                                    "(usually older ones the phone offloaded to iCloud).")
        if "calls" in only:
            if dbs["calls"] is None:
                problems.append("Calls: no call history found. iPhone backups only include call history "
                                "when backup encryption is on.")
            else:
                events.stage("calls", "Reading call history")
                found = calls.load(dbs["calls"], book, since, until)
                if contact_filter:
                    found = [c for c in found if _call_matches(c, contact_filter)]
                exporter.write_calls(found)
                say(f"  {exporter.stats['calls']:,} calls")
        if "voicemail" in only and dbs.get("voicemail"):
            events.stage("voicemail", "Saving voicemail")
            items = voicemail.load(dbs["voicemail"], book)
            items = [v for v in items if (since is None or (v.date and v.date >= since))
                     and (until is None or (v.date and v.date < until))]
            exporter.write_voicemail(items, src.fetch_voicemail)
            say(f"  {exporter.stats['voicemails']:,} voicemails")
        if "notes" in only and not contact_filter:
            if dbs["notes"] is None:
                problems.append("Notes: no notes database in this source (notes kept only in iCloud aren't "
                                "always in a phone backup; try --mac).")
            else:
                events.stage("notes", "Saving notes")
                exporter.write_notes(notes.load(dbs["notes"]))
                say(f"  {exporter.stats['notes']:,} notes")
        if "contacts" in sections:
            exporter.write_contacts(book.people)
            say(f"  {exporter.stats['contacts']:,} contacts")
        exporter.write_index(convo_index, src.label, generated, problems)
    finally:
        src.close()

    if args.pdf:
        say(f"Making PDFs of {len(exporter.pages):,} pages...")
        events.stage("pdf", "Making PDFs")
        made = pdf.to_pdf(exporter.pages, out, out / "PDF", log=say)
        say(f"  {made:,} PDFs in {out / 'PDF'}")
    for p in problems:
        say(f"Note: {p}")
    index = out / "index.html"
    say(f"Done in {time.time() - started:.0f}s. Open {index}")
    events.emit("done", index=str(index), stats=exporter.stats, problems=problems)
    if args.open and sys.platform == "darwin":
        subprocess.run(["open", str(index)])
    return 0


def cmd_status(args):
    """Everything the Mac app shows on its main screen, as one JSON object."""
    out = Path(args.out).expanduser()
    roots = [Path(args.backup_root)] if args.backup_root else sources.backup_roots()
    access = "missing"
    try:
        list(sources.FINDER_BACKUP_ROOT.iterdir())
        access = "ok"
    except PermissionError:
        access = "denied"
    except OSError:
        pass
    try:
        found = sources.find_backups(roots)
    except sources.SourceError:
        found = []
    plan = schedule.status() if sys.platform == "darwin" else None
    tool = shutil.which("idevicebackup2")
    devices = {"usb": [], "wifi": []}
    if tool and not args.no_devices:
        devices = {"usb": _devices(False), "wifi": _devices(True)}
    index = out / "index.html"

    def iso(dt):
        return dt.astimezone().isoformat(timespec="seconds") if dt else None

    data = {
        "version": __version__,
        "python": sys.version.split()[0],
        "tools": {"idevicebackup2": tool, "brew": shutil.which("brew"), "pdf_browser": pdf.find_browser()},
        "devices": devices,
        "access": {"finder_backups": access},
        "backups": [{"device": b.device_name, "ios": b.ios_version, "udid": b.udid, "path": str(b.path),
                     "last_backup": iso(b.last_backup), "encrypted": b.encrypted} for b in found],
        "snapshots": [{"date": when.isoformat(timespec="minutes"), "device": info.device_name, "path": str(info.path)}
                      for when, info in snapshots.all_snapshots(roots)],
        "schedule": None if not plan else {
            "hours": sorted(t["Hour"] for t in plan["StartCalendarInterval"]),
            "wifi": "--wifi" in plan["ProgramArguments"],
            "window": plan["ProgramArguments"][plan["ProgramArguments"].index("--window") + 1]
            if "--window" in plan["ProgramArguments"] else None,
        },
        "last_export": {"path": str(index), "modified": iso(datetime.fromtimestamp(index.stat().st_mtime))}
        if index.exists() else None,
        "output": str(out),
    }
    print(json.dumps(data, indent=None if args.compact else 2))
    return 0


def _call_matches(call, terms):
    for term in terms:
        t = term.strip().lower()
        if t and (contacts.normalize(term) == contacts.normalize(call.number) or t in (call.name or "").lower()):
            return True
    return False


def cmd_sync(args):
    code = cmd_backup(args)
    if code != 0:
        return code
    return cmd_export(args)


def _window(text):
    try:
        start, end = (datetime.strptime(t.strip(), "%H:%M").time() for t in text.split("-"))
    except ValueError:
        raise SystemExit(f"--window needs a range like 18:00-23:00, got {text!r}")
    return start, end


def cmd_auto(args):
    """What the scheduled job runs: once a day, back up over Wi-Fi when the phone is around, then export.
    Safe to call every hour; it does nothing once today's backup has worked."""
    dest = Path(args.dir).expanduser()
    dest.mkdir(parents=True, exist_ok=True)
    state = dest / ".last-auto-backup"
    now = datetime.now()
    if not args.force:
        if state.exists() and state.read_text().strip() == now.date().isoformat():
            say(f"{now:%Y-%m-%d %H:%M} already backed up today")
            return 0
        start, end = _window(args.window)
        if not start <= now.time() <= end:
            say(f"{now:%Y-%m-%d %H:%M} outside {args.window}, skipping")  # e.g. launchd catching up after sleep
            return 0
    lock = dest / ".auto-backup.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.close(fd)
    except FileExistsError:
        if time.time() - lock.stat().st_mtime < 3 * 3600:
            say("another run is still going")
            return 0
        lock.touch()  # stale lock from a crashed run
    try:
        if not _devices(args.wifi):
            say(f"{now:%Y-%m-%d %H:%M} iPhone not reachable{' on Wi-Fi' if args.wifi else ''}; will try next hour")
            return 0
        say(f"{now:%Y-%m-%d %H:%M} starting backup")
        code = cmd_backup(args)
        if code == 3:
            notify("iPhone backup skipped: no passcode entered. It will ask again next hour.")
            return code
        if code != 0:
            notify("iPhone backup failed. Details in ~/Library/Logs/iphone-export.log")
            return code
        state.write_text(now.date().isoformat())
        code = cmd_export(args)
        notify("iPhone backed up and exported." if code == 0 else
               "iPhone backed up, but the export failed. Details in ~/Library/Logs/iphone-export.log")
        return code
    finally:
        lock.unlink(missing_ok=True)


def cmd_schedule(args):
    if sys.platform != "darwin":
        say("Scheduling uses macOS LaunchAgents, so it only works on a Mac.")
        return 1
    if args.off:
        say("Daily backup removed." if schedule.remove() else "No daily backup was set up.")
        return 0
    if args.status:
        plan = schedule.status()
        if not plan:
            say("No daily backup is set up.")
        else:
            hours = sorted(t["Hour"] for t in plan["StartCalendarInterval"])
            say(f"Tries hourly at {', '.join(f'{h:02d}:00' for h in hours)} until one backup works each day.")
            say(f"Command: {' '.join(plan['ProgramArguments'][1:])}")
            say(f"Log: {schedule.LOG}")
        return 0
    if not shutil.which("idevicebackup2"):
        say("The daily run backs the phone up with idevicebackup2. Install it first: brew install libimobiledevice")
        return 1
    start, end = _window(args.window)
    hours = list(range(start.hour, end.hour + 1)) if start.hour <= end.hour else \
        list(range(start.hour, 24)) + list(range(0, end.hour + 1))
    extra = ["--window", args.window, "--out", str(Path(args.out).expanduser()),
             "--dir", str(Path(args.dir).expanduser()), "--keep-days", str(args.keep_days)]
    for flag in ("wifi", "no_attachments", "convert_media"):
        if getattr(args, flag):
            extra.append("--" + flag.replace("_", "-"))
    ok, err = schedule.install(hours, extra)
    if not ok:
        say(f"Couldn't register the job with launchd: {err}")
        return 1
    say(f"Done. Every day between {args.window} the Mac tries once an hour to back up the iPhone"
        f"{' over Wi-Fi' if args.wifi else ' (when plugged in)'}, keeps a dated version for {args.keep_days} days, "
        f"and refreshes {args.out}. After one works it waits until tomorrow.")
    say("Each backup needs the phone's passcode (an Apple rule since iOS 16.1); the Mac shows a notification "
        "when the phone is asking.")
    say("Encrypted backup? Run one export by hand first and let it save the unlock key in the Keychain, "
        "or the scheduled export can't open it.")
    say(f"Log: {schedule.LOG}   Stop it with: python3 -m iphone_export schedule --off")
    return 0


def build_parser():
    p = argparse.ArgumentParser(prog="iphone_export",
                                description="Save iPhone texts, calls, voicemail, notes and contacts.")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="command")

    def add_export_options(sp):
        sp.add_argument("--backup", help="path to one backup folder (default: the newest backup found)")
        sp.add_argument("--snapshot", help="export the dated version from this day (or the last one before it)")
        sp.add_argument("--backup-root", help="folder that holds backup folders, if not a standard place")
        sp.add_argument("--mac", action="store_true", help="read this Mac's synced Messages/Notes/calls instead")
        sp.add_argument("--out", default=str(DEFAULT_OUT), help=f"output folder (default: {DEFAULT_OUT})")
        sp.add_argument("--only", help=f"comma list from: {','.join(WHAT)} (default: all)")
        sp.add_argument("--since", help="only items on or after this date, YYYY-MM-DD")
        sp.add_argument("--until", help="only items before this date, YYYY-MM-DD")
        sp.add_argument("--contact", help="only conversations/calls with these people: names, numbers or emails, "
                                          "comma separated")
        sp.add_argument("--me-name", help="your name in exports instead of 'Me'")
        sp.add_argument("--no-attachments", action="store_true", help="skip copying photos/videos/files")
        sp.add_argument("--convert-media", "--convert-heic", dest="convert_media", action="store_true",
                        help="HEIC photos to JPEG and voice notes to M4A so any browser plays them (Mac)")
        sp.add_argument("--pdf", action="store_true", help="also save PDFs of each conversation, calls and voicemail")
        sp.add_argument("--ignore-disk-warning", action="store_true", help="copy attachments even if space looks tight")
        sp.add_argument("--open", action="store_true", help="open the result in the browser when done")
        sp.add_argument("--remember", action="store_true", help="save the backup unlock key in the Keychain")
        sp.add_argument("--no-keychain", action="store_true", help="never read or write the Keychain")
        sp.add_argument("--forget-password", action="store_true", help="delete the saved unlock key first")

    lp = sub.add_parser("list", help="show the iPhone backups on this computer")
    lp.add_argument("--backup-root")

    def add_backup_options(sp):
        sp.add_argument("--dir", default=str(sources.DEFAULT_TOOL_BACKUP_ROOT),
                        help=f"where idevicebackup2 keeps backups (default: {sources.DEFAULT_TOOL_BACKUP_ROOT})")
        sp.add_argument("--udid", help="which device, if more than one is connected")
        sp.add_argument("--wifi", action="store_true", help="back up over Wi-Fi instead of the cable")
        sp.add_argument("--no-snapshot", action="store_true", help="don't keep a dated version of this backup")
        sp.add_argument("--keep-days", type=int, default=30, help="delete dated versions older than this (default 30)")
        sp.add_argument("--passcode-wait", type=float, default=15,
                        help="minutes to wait for the passcode on the phone (default 15)")

    bp = sub.add_parser("backup", help="back up the iPhone with idevicebackup2")
    add_backup_options(bp)
    ep = sub.add_parser("export", help="export from a backup (or --mac)")
    add_export_options(ep)
    sp = sub.add_parser("sync", help="backup, then export that backup")
    add_backup_options(sp)
    add_export_options(sp)
    ap = sub.add_parser("auto", help="what the daily job runs: one backup + export per day, when possible")
    add_backup_options(ap)
    add_export_options(ap)
    ap.add_argument("--window", default="18:00-23:00", help="only try between these times (default 18:00-23:00)")
    ap.add_argument("--force", action="store_true", help="run now even if done today or outside the window")
    stp = sub.add_parser("status", help="JSON summary of backups, phone, schedule and last export (for the app)")
    stp.add_argument("--out", default=str(DEFAULT_OUT))
    stp.add_argument("--backup-root")
    stp.add_argument("--no-devices", action="store_true", help="skip looking for the phone (faster)")
    stp.add_argument("--compact", action="store_true")
    scp = sub.add_parser("schedule", help="back up and export automatically every day (Mac)")
    scp.add_argument("--window", default="18:00-23:00",
                     help="try once an hour between these times until one backup works (default 18:00-23:00)")
    scp.add_argument("--off", action="store_true", help="remove the daily run")
    scp.add_argument("--status", action="store_true", help="show the current daily run")
    scp.add_argument("--out", default=str(DEFAULT_OUT))
    scp.add_argument("--dir", default=str(sources.DEFAULT_TOOL_BACKUP_ROOT))
    scp.add_argument("--keep-days", type=int, default=30)
    scp.add_argument("--wifi", action="store_true", help="back up over Wi-Fi, no cable needed")
    scp.add_argument("--no-attachments", action="store_true")
    scp.add_argument("--convert-media", action="store_true")
    return p


def _stop_on_sigterm(signum, frame):
    raise KeyboardInterrupt("cancelled")


def main(argv=None):
    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGTERM, _stop_on_sigterm)  # cleanup (temp files, child tools) runs on Cancel
    args = build_parser().parse_args(argv)
    commands = {"list": cmd_list, "backup": cmd_backup, "export": cmd_export, "sync": cmd_sync,
                "auto": cmd_auto, "schedule": cmd_schedule, "status": cmd_status}
    if args.command in commands:
        try:
            return commands[args.command](args)
        except KeyboardInterrupt:
            say("Cancelled.")
            events.emit("error", message="Cancelled.", kind="cancelled")
            return 130
    build_parser().print_help()
    return 0
