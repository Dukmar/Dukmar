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

from . import __version__, calls, contacts, messages, notes, sources
from .render import Exporter

DEFAULT_OUT = Path.home() / "Documents" / "iPhone Export"
KEYCHAIN_SERVICE = "iphone-export"
WHAT = ("messages", "calls", "notes")


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
    ids = subprocess.run([shutil.which("idevice_id") or "idevice_id", "-l"], capture_output=True, text=True)
    udids = [u for u in ids.stdout.split() if u]
    if not udids:
        say("No iPhone found. Plug it in with a cable, unlock it, and tap 'Trust This Computer' if asked.")
        return 1
    dest = Path(args.dir).expanduser()
    dest.mkdir(parents=True, exist_ok=True)
    udid = args.udid or udids[0]
    say(f"Backing up {udid} into {dest} (only changes since the last backup are copied).")
    say("If the phone asks for its passcode, enter it - encrypted backups need that on iOS 13 and later.")
    result = subprocess.run([tool, "-u", udid, "backup", str(dest)])
    if result.returncode != 0:
        say(f"idevicebackup2 stopped with code {result.returncode}.")
        return result.returncode
    args.backup = str(dest / udid)
    return 0


def cmd_export(args):
    only = set(args.only.split(",")) if args.only else set(WHAT)
    unknown = only - set(WHAT)
    if unknown:
        say(f"Unknown --only value(s): {', '.join(sorted(unknown))}. Pick from {', '.join(WHAT)}.")
        return 2
    since = datetime.strptime(args.since, "%Y-%m-%d").astimezone() if args.since else None
    out = Path(args.out).expanduser()
    out.mkdir(parents=True, exist_ok=True)

    try:
        src = open_source(args)
    except sources.SourceError as e:
        say(str(e))
        return 1
    started = time.time()
    problems = []
    try:
        book = contacts.load(src.contacts_dbs())
        if sys.platform == "darwin" and not args.mac:
            try:
                mac = sources.MacSource()
                try:
                    for k, v in contacts.load(mac.contacts_dbs()).names.items():
                        book.names.setdefault(k, v)
                finally:
                    mac.close()
            except sources.SourceError:
                pass
        say(f"Contacts: {len(book):,} numbers/emails matched to names")

        exporter = Exporter(out, src, attachments=not args.no_attachments, convert_heic=args.convert_heic)
        convo_index = []
        if "messages" in only:
            db = src.fetch("sms")
            if db is None:
                problems.append("Messages: no messages database in this source.")
            else:
                say("Reading messages...")
                convos = messages.load(db, book, since)
                if not args.no_attachments:
                    total = sum(len(m.attachments) for c in convos for m in c.messages)
                    say(f"Copying {total:,} attachments (already-copied ones are skipped)...")
                convo_index = exporter.write_messages(convos)
                say(f"  {exporter.stats['messages']:,} messages in {exporter.stats['conversations']:,} conversations")
                if exporter.stats.get("attachments_missing"):
                    n = exporter.stats["attachments_missing"]
                    what = "attachment was" if n == 1 else "attachments were"
                    problems.append(f"Messages: {n:,} {what} not in the source "
                                    "(usually older ones the phone offloaded to iCloud).")
        if "calls" in only:
            db = src.fetch("calls")
            if db is None:
                problems.append("Calls: no call history found. iPhone backups only include call history "
                                "when backup encryption is on.")
            else:
                exporter.write_calls(calls.load(db, book, since))
                say(f"  {exporter.stats['calls']:,} calls")
        if "notes" in only:
            db = src.fetch("notes")
            if db is None:
                problems.append("Notes: no notes database in this source (notes kept only in iCloud aren't "
                                "always in a phone backup; try --mac).")
            else:
                exporter.write_notes(notes.load(db))
                say(f"  {exporter.stats['notes']:,} notes")
        exporter.write_index(convo_index, src.label, datetime.now().astimezone(), problems)
    finally:
        src.close()

    for p in problems:
        say(f"Note: {p}")
    index = out / "index.html"
    say(f"Done in {time.time() - started:.0f}s. Open {index}")
    if args.open and sys.platform == "darwin":
        subprocess.run(["open", str(index)])
    return 0


def cmd_sync(args):
    code = cmd_backup(args)
    if code != 0:
        return code
    return cmd_export(args)


def build_parser():
    p = argparse.ArgumentParser(prog="iphone_export", description="Save iPhone texts, call history and notes.")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="command")

    def add_export_options(sp):
        sp.add_argument("--backup", help="path to one backup folder (default: the newest backup found)")
        sp.add_argument("--backup-root", help="folder that holds backup folders, if not a standard place")
        sp.add_argument("--mac", action="store_true", help="read this Mac's synced Messages/Notes/calls instead")
        sp.add_argument("--out", default=str(DEFAULT_OUT), help=f"output folder (default: {DEFAULT_OUT})")
        sp.add_argument("--only", help="comma list: messages,calls,notes (default: all three)")
        sp.add_argument("--since", help="only items on or after this date, YYYY-MM-DD")
        sp.add_argument("--no-attachments", action="store_true", help="skip copying photos/videos/files")
        sp.add_argument("--convert-heic", action="store_true", help="convert HEIC photos to JPEG (Mac, uses sips)")
        sp.add_argument("--open", action="store_true", help="open the result in the browser when done")
        sp.add_argument("--remember", action="store_true", help="save the backup unlock key in the Keychain")
        sp.add_argument("--no-keychain", action="store_true", help="never read or write the Keychain")
        sp.add_argument("--forget-password", action="store_true", help="delete the saved unlock key first")

    lp = sub.add_parser("list", help="show the iPhone backups on this computer")
    lp.add_argument("--backup-root")

    def add_backup_options(sp):
        sp.add_argument("--dir", default=str(sources.DEFAULT_TOOL_BACKUP_ROOT),
                        help=f"where idevicebackup2 keeps backups (default: {sources.DEFAULT_TOOL_BACKUP_ROOT})")
        sp.add_argument("--udid", help="which device, if more than one is plugged in")

    bp = sub.add_parser("backup", help="back up the plugged-in iPhone with idevicebackup2")
    add_backup_options(bp)
    ep = sub.add_parser("export", help="export from a backup (or --mac)")
    add_export_options(ep)
    sp = sub.add_parser("sync", help="backup, then export that backup")
    add_backup_options(sp)
    add_export_options(sp)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "backup":
        return cmd_backup(args)
    if args.command == "export":
        return cmd_export(args)
    if args.command == "sync":
        return cmd_sync(args)
    build_parser().print_help()
    return 0
