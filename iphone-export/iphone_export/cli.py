"""Command line: list backups, make a backup, export texts / calls / notes."""

from __future__ import annotations

import argparse
import getpass
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from . import __version__, calls, contacts, messages, notes, pdf, schedule, sources, voicemail
from .render import Exporter

DEFAULT_OUT = Path.home() / "Documents" / "iPhone Export"
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
    if args.backup:
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
    key = _keychain_get(info.udid)
    if key:
        try:
            say("Unlocking with the key saved in your Keychain...")
            return sources.EncryptedBackupSource(info.path, info, derived_key=key)
        except sources.SourceError:
            say("The saved key no longer works (backup password changed?). Asking for the password instead.")
    password = os.environ.get("IPHONE_BACKUP_PASSWORD")
    if not password:
        if not sys.stdin.isatty():
            raise sources.PasswordNeeded("This backup is encrypted. Set IPHONE_BACKUP_PASSWORD or run in a terminal.")
        password = getpass.getpass("Backup password (the one set in Finder/iTunes, not your phone passcode): ")
    say("Unlocking the backup (the first unlock takes a while - Apple makes it slow on purpose)...")
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
    roots = [Path(args.backup_root)] if args.backup_root else None
    found = sources.find_backups(roots)
    if not found:
        say("No backups found in:")
        for r in roots or sources.backup_roots():
            say(f"  {r}")
        return 1
    for b in found:
        say(b.describe())
    return 0


def cmd_backup(args):
    tool = shutil.which("idevicebackup2")
    if not tool:
        say("idevicebackup2 isn't installed. Either install it once:\n"
            "    brew install libimobiledevice\n"
            "or make the backup in Finder (select the iPhone in the sidebar > Back Up Now), then run export.")
        return 1
    net = ["-n"] if args.wifi else []
    ids = subprocess.run([shutil.which("idevice_id") or "idevice_id", "-n" if args.wifi else "-l"],
                         capture_output=True, text=True)
    udids = [u for u in ids.stdout.split() if u]
    if not udids:
        if args.wifi:
            say("No iPhone found on Wi-Fi. It needs to be on the same network, unlocked, and set to sync over "
                "Wi-Fi once in Finder ('Show this iPhone when on Wi-Fi').")
        else:
            say("No iPhone found. Plug it in with a cable, unlock it, and tap 'Trust This Computer' if asked.")
        return 1
    dest = Path(args.dir).expanduser()
    dest.mkdir(parents=True, exist_ok=True)
    udid = args.udid or udids[0]
    say(f"Backing up {udid} into {dest} (only changes since the last backup are copied).")
    say("If the phone asks for its passcode, enter it - encrypted backups need that on iOS 13 and later.")
    result = subprocess.run([tool, *net, "-u", udid, "backup", str(dest)])
    if result.returncode != 0:
        say(f"idevicebackup2 stopped with code {result.returncode}.")
        return result.returncode
    args.backup = str(dest / udid)
    return 0


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

    try:
        src = open_source(args)
    except sources.SourceError as e:
        say(str(e))
        return 1
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
                found = calls.load(dbs["calls"], book, since, until)
                if contact_filter:
                    found = [c for c in found if _call_matches(c, contact_filter)]
                exporter.write_calls(found)
                say(f"  {exporter.stats['calls']:,} calls")
        if "voicemail" in only and dbs.get("voicemail"):
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
        made = pdf.to_pdf(exporter.pages, out, out / "PDF", log=say)
        say(f"  {made:,} PDFs in {out / 'PDF'}")
    for p in problems:
        say(f"Note: {p}")
    index = out / "index.html"
    say(f"Done in {time.time() - started:.0f}s. Open {index}")
    if args.open and sys.platform == "darwin":
        subprocess.run(["open", str(index)])
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


def cmd_schedule(args):
    if sys.platform != "darwin":
        say("Scheduling uses macOS LaunchAgents, so it only works on a Mac.")
        return 1
    if args.off:
        say("Daily export removed." if schedule.remove() else "No daily export was set up.")
        return 0
    if args.status:
        plan = schedule.status()
        if not plan:
            say("No daily export is set up.")
        else:
            t = plan["StartCalendarInterval"]
            say(f"Runs daily at {t['Hour']:02d}:{t['Minute']:02d}: {' '.join(plan['ProgramArguments'][1:])}")
            say(f"Log: {schedule.LOG}")
        return 0
    if not shutil.which("idevicebackup2"):
        say("The daily run backs the phone up with idevicebackup2. Install it first: brew install libimobiledevice")
        return 1
    try:
        hour, minute = (int(x) for x in args.at.split(":"))
        assert 0 <= hour < 24 and 0 <= minute < 60
    except (ValueError, AssertionError):
        say(f"--at needs a time like 02:30, got {args.at!r}")
        return 2
    extra = ["--out", str(Path(args.out).expanduser()), "--dir", str(Path(args.dir).expanduser())]
    if args.wifi:
        extra.append("--wifi")
    if args.no_attachments:
        extra.append("--no-attachments")
    if args.convert_media:
        extra.append("--convert-media")
    ok, err = schedule.install(hour, minute, extra)
    if not ok:
        say(f"Couldn't register the job with launchd: {err}")
        return 1
    say(f"Done. Every day at {hour:02d}:{minute:02d} the Mac backs up the iPhone"
        f"{' over Wi-Fi' if args.wifi else ' (if plugged in)'} and refreshes {args.out}.")
    say("Encrypted backup? Run one export by hand first and let it save the unlock key in the Keychain, "
        "or the scheduled run can't open the backup.")
    say(f"Log: {schedule.LOG}   Stop it with: python3 -m iphone_export schedule --off")
    return 0


def build_parser():
    p = argparse.ArgumentParser(prog="iphone_export",
                                description="Save iPhone texts, calls, voicemail, notes and contacts.")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="command")

    def add_export_options(sp):
        sp.add_argument("--backup", help="path to one backup folder (default: the newest backup found)")
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

    bp = sub.add_parser("backup", help="back up the iPhone with idevicebackup2")
    add_backup_options(bp)
    ep = sub.add_parser("export", help="export from a backup (or --mac)")
    add_export_options(ep)
    sp = sub.add_parser("sync", help="backup, then export that backup")
    add_backup_options(sp)
    add_export_options(sp)
    scp = sub.add_parser("schedule", help="run sync automatically every day (Mac)")
    scp.add_argument("--at", default="02:30", help="time of day, HH:MM (default 02:30)")
    scp.add_argument("--off", action="store_true", help="remove the daily run")
    scp.add_argument("--status", action="store_true", help="show the current daily run")
    scp.add_argument("--out", default=str(DEFAULT_OUT))
    scp.add_argument("--dir", default=str(sources.DEFAULT_TOOL_BACKUP_ROOT))
    scp.add_argument("--wifi", action="store_true", help="back up over Wi-Fi, no cable needed")
    scp.add_argument("--no-attachments", action="store_true")
    scp.add_argument("--convert-media", action="store_true")
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    commands = {"list": cmd_list, "backup": cmd_backup, "export": cmd_export, "sync": cmd_sync,
                "schedule": cmd_schedule}
    if args.command in commands:
        return commands[args.command](args)
    build_parser().print_help()
    return 0
