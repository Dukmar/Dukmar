"""Where the data comes from: a local iPhone backup (plain or encrypted), or this Mac's own synced copies.

Every source hands back *copies* of the databases in a private temp folder, so the originals are never
opened for writing and a live Messages database on the Mac isn't locked while we read it.
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import os
import plistlib
import shutil
import sqlite3
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

# (domain, relativePath) of each database inside an iOS backup.
BACKUP_FILES = {
    "sms": ("HomeDomain", "Library/SMS/sms.db"),
    "calls": ("HomeDomain", "Library/CallHistoryDB/CallHistory.storedata"),
    "contacts": ("HomeDomain", "Library/AddressBook/AddressBook.sqlitedb"),
    "notes": ("AppDomainGroup-group.com.apple.notes", "NoteStore.sqlite"),
    "voicemail": ("HomeDomain", "Library/Voicemail/voicemail.db"),
}

HOME = Path.home()
MAC_FILES = {
    "sms": HOME / "Library/Messages/chat.db",
    "calls": HOME / "Library/Application Support/CallHistoryDB/CallHistory.storedata",
    "notes": HOME / "Library/Group Containers/group.com.apple.notes/NoteStore.sqlite",
}
MAC_CONTACTS_ROOT = HOME / "Library/Application Support/AddressBook"

FINDER_BACKUP_ROOT = HOME / "Library/Application Support/MobileSync/Backup"
DEFAULT_TOOL_BACKUP_ROOT = HOME / "iPhone Backups"


def backup_roots():
    roots = [FINDER_BACKUP_ROOT, DEFAULT_TOOL_BACKUP_ROOT]
    if sys.platform == "win32":
        for var, sub in (("APPDATA", r"Apple Computer\MobileSync\Backup"), ("USERPROFILE", r"Apple\MobileSync\Backup")):
            if os.environ.get(var):
                roots.append(Path(os.environ[var]) / sub)
    return roots


class SourceError(Exception):
    pass


class PasswordNeeded(SourceError):
    pass


def _copy_sqlite(src, dest_dir, name):
    """Copy a SQLite file plus any -wal/-shm siblings so uncheckpointed rows come along."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / name
    shutil.copy2(src, dest)
    for suffix in ("-wal", "-shm"):
        side = Path(str(src) + suffix)
        if side.exists():
            shutil.copy2(side, Path(str(dest) + suffix))
    return dest


def ios_attachment_relpath(filename):
    """sms.db stores '~/Library/SMS/Attachments/..' (sometimes '/var/mobile/Library/..'); backups key on 'Library/..'."""
    if not filename:
        return None
    for prefix in ("~/", "/var/mobile/", "/private/var/mobile/"):
        if filename.startswith(prefix):
            return filename[len(prefix):]
    return filename.lstrip("/")


# --------------------------------------------------------------------------------------------- backups

@dataclass
class BackupInfo:
    path: Path
    device_name: str
    ios_version: str
    udid: str
    last_backup: datetime | None
    encrypted: bool

    def describe(self):
        when = self.last_backup.astimezone().strftime("%Y-%m-%d %H:%M") if self.last_backup else "unknown date"
        lock = "encrypted" if self.encrypted else "not encrypted"
        return f"{self.device_name} (iOS {self.ios_version}) - {when} - {lock}\n    {self.path}"


def read_backup_info(path):
    path = Path(path)
    if not (path / "Manifest.db").exists() and not (path / "Manifest.plist").exists():
        raise SourceError(f"{path} doesn't look like an iPhone backup (no Manifest.db).")
    info, manifest = {}, {}
    try:
        with open(path / "Info.plist", "rb") as f:
            info = plistlib.load(f)
    except (OSError, plistlib.InvalidFileException):
        pass
    try:
        with open(path / "Manifest.plist", "rb") as f:
            manifest = plistlib.load(f)
    except (OSError, plistlib.InvalidFileException):
        pass
    last = info.get("Last Backup Date")
    if last is None:
        try:
            with open(path / "Status.plist", "rb") as f:
                last = plistlib.load(f).get("Date")
        except (OSError, plistlib.InvalidFileException):
            last = None
    if last is not None and last.tzinfo is None:
        # plistlib returns naive UTC datetimes.
        last = last.replace(tzinfo=timezone.utc)
    lockdown = manifest.get("Lockdown", {})
    return BackupInfo(
        path=path,
        device_name=info.get("Device Name") or lockdown.get("DeviceName") or "iPhone",
        ios_version=info.get("Product Version") or lockdown.get("ProductVersion") or "?",
        udid=info.get("Unique Identifier") or lockdown.get("UniqueDeviceID") or path.name,
        last_backup=last,
        encrypted=bool(manifest.get("IsEncrypted")),
    )


def find_backups(roots=None):
    found = []
    for root in roots or backup_roots():
        root = Path(root)
        try:
            children = list(root.iterdir())
        except PermissionError:
            raise SourceError(
                f"macOS blocked access to {root}.\n"
                "Give your terminal app Full Disk Access: System Settings > Privacy & Security > "
                "Full Disk Access, switch on Terminal (or iTerm), then quit and reopen it."
            )
        except OSError:
            continue
        for child in children:
            if child.is_dir() and (child / "Manifest.db").exists():
                try:
                    found.append(read_backup_info(child))
                except SourceError:
                    pass
    found.sort(key=lambda b: b.last_backup.timestamp() if b.last_backup else 0, reverse=True)
    return found


class BackupSource:
    """A plain (unencrypted) local backup made by Finder, iTunes or idevicebackup2."""

    def __init__(self, path, info=None):
        self.path = Path(path)
        self.info = info or read_backup_info(self.path)
        self.label = f"backup of {self.info.device_name}"
        self.workdir = Path(tempfile.mkdtemp(prefix="iphone-export-"))
        self._manifest = sqlite3.connect(f"file:{self.path / 'Manifest.db'}?mode=ro", uri=True)

    def close(self):
        self._manifest.close()
        shutil.rmtree(self.workdir, ignore_errors=True)

    def _locate(self, domain, relpath):
        row = self._manifest.execute(
            "SELECT fileID FROM Files WHERE domain = ? AND relativePath = ? AND flags = 1 LIMIT 1",
            (domain, relpath),
        ).fetchone()
        file_id = row[0] if row else hashlib.sha1(f"{domain}-{relpath}".encode()).hexdigest()
        for candidate in (self.path / file_id[:2] / file_id, self.path / file_id):  # iOS 10+ layout, then older
            if candidate.exists():
                return candidate
        return None

    def _extract(self, domain, relpath, dest):
        src = self._locate(domain, relpath)
        if src is None:
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        return True

    def fetch(self, key):
        domain, relpath = BACKUP_FILES[key]
        dest = self.workdir / key / Path(relpath).name
        if not self._extract(domain, relpath, dest):
            return None
        for suffix in ("-wal", "-shm"):
            self._extract(domain, relpath + suffix, Path(str(dest) + suffix))
        return dest

    def contacts_dbs(self):
        path = self.fetch("contacts")
        return [(path, "ios")] if path else []

    def fetch_attachment(self, filename, dest):
        relpath = ios_attachment_relpath(filename)
        if relpath is None:
            return False
        return self._extract("MediaDomain", relpath, Path(dest))

    def fetch_voicemail(self, rowid, dest_dir):
        """Copy voicemail <rowid>.amr into dest_dir; return (path or None, transcript text)."""
        from .voicemail import read_transcript
        dest = Path(dest_dir) / f"{rowid}.amr"
        path = dest if dest.exists() or self._extract("HomeDomain", f"Library/Voicemail/{rowid}.amr", dest) else None
        transcript = ""
        tdest = self.workdir / "voicemail" / f"{rowid}.transcript"
        if self._extract("HomeDomain", f"Library/Voicemail/{rowid}.transcript", tdest):
            transcript = read_transcript(tdest)
        return path, transcript


class EncryptedBackupSource(BackupSource):
    """An encrypted backup. Needs the backup password (or the key derived from it, which unlocks far faster)."""

    def __init__(self, path, info=None, password=None, derived_key=None):
        try:
            from iphone_backup_decrypt import EncryptedBackup
        except ImportError:
            raise SourceError(
                "This backup is encrypted. Install the decryption library first:\n"
                "    python3 -m pip install iphone_backup_decrypt"
            )
        if password is None and derived_key is None:
            raise PasswordNeeded("This backup is encrypted and needs its password.")
        self.path = Path(path)
        self.info = info or read_backup_info(self.path)
        self.label = f"encrypted backup of {self.info.device_name}"
        self._backup = EncryptedBackup(
            backup_directory=str(self.path), passphrase=password, passphrase_key=derived_key
        )
        try:
            self._backup.test_decryption()
        except Exception as e:
            name = type(e).__name__
            if name == "IncorrectPassphraseError":
                raise SourceError("That backup password didn't work.") from e
            raise SourceError(f"Couldn't unlock the backup: {e}") from e
        self.workdir = Path(tempfile.mkdtemp(prefix="iphone-export-"))

    @property
    def derived_key(self):
        return self._backup.keybag.passphrase_key

    def close(self):
        # Removes the library's decrypted copy of Manifest.db; clear its handles so __del__ doesn't retry.
        self._backup._cleanup()
        self._backup._temp_manifest_db_conn = None
        self._backup._temporary_folder = None
        shutil.rmtree(self.workdir, ignore_errors=True)

    def _extract(self, domain, relpath, dest):
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            # The library prints an INFO line per file when sizes differ (routine for databases); keep the terminal quiet.
            with contextlib.redirect_stdout(io.StringIO()):
                self._backup.extract_file(relative_path=relpath, domain_like=domain, output_filename=str(dest))
        except FileNotFoundError:
            return False
        except (ValueError, TypeError):
            # Zero-length files have no encryption key; treat as absent.
            return False
        return True


# --------------------------------------------------------------------------------------------- this Mac

class MacSource:
    """Read the copies macOS keeps when Messages in iCloud, Notes and iPhone call relay are on."""

    label = "this Mac"

    def __init__(self):
        if sys.platform != "darwin":
            raise SourceError("--mac only works on a Mac.")
        self.workdir = Path(tempfile.mkdtemp(prefix="iphone-export-"))

    def close(self):
        shutil.rmtree(self.workdir, ignore_errors=True)

    def _copy(self, src, key):
        try:
            return _copy_sqlite(src, self.workdir / key, src.name)
        except FileNotFoundError:
            return None
        except PermissionError:
            raise SourceError(
                f"macOS blocked access to {src}.\n"
                "Give your terminal app Full Disk Access: System Settings > Privacy & Security > "
                "Full Disk Access, switch on Terminal (or iTerm), then quit and reopen it."
            )

    def fetch(self, key):
        if key not in MAC_FILES:
            return None  # voicemail and the iPhone's own address book only exist in phone backups
        return self._copy(MAC_FILES[key], key)

    def contacts_dbs(self):
        dbs = []
        candidates = [MAC_CONTACTS_ROOT / "AddressBook-v22.abcddb"]
        candidates += sorted((MAC_CONTACTS_ROOT / "Sources").glob("*/AddressBook-v22.abcddb"))
        for i, path in enumerate(candidates):
            if path.exists():
                copied = self._copy(path, f"contacts{i}")
                if copied:
                    dbs.append((copied, "mac"))
        return dbs

    def fetch_attachment(self, filename, dest):
        if not filename:
            return False
        src = Path(os.path.expanduser(filename))
        if not src.exists():
            return False
        Path(dest).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        return True
