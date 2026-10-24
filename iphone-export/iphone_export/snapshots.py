"""Dated versions of each backup (iMazing calls them snapshots).

idevicebackup2 keeps one backup per phone and updates it in place. After each good backup, this clones
it to <backup dir>/Snapshots/<UDID>/<YYYY-MM-DD HHMM>/. On a Mac's APFS drive the clone is copy-on-write
(`cp -c`): a snapshot costs almost nothing until files change, so a month of them takes roughly the space
of one backup plus a month of changes. Drives that can't clone (some external drives) get no snapshots
rather than a full copy every day.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

from . import sources

STAMP = "%Y-%m-%d %H%M"


class SnapshotUnsupported(Exception):
    pass


def clone_tree(src, dst):
    if sys.platform == "darwin":
        cmd = ["cp", "-c", "-R", str(src), str(dst)]
    else:
        cmd = ["cp", "-R", "--reflink=always", str(src), str(dst)]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        shutil.rmtree(dst, ignore_errors=True)
        raise SnapshotUnsupported(result.stderr.strip() or "this drive can't make copy-on-write clones")


def root_for(backup_dir):
    """Snapshots live beside the live backups: <dir>/Snapshots/<UDID>/."""
    backup_dir = Path(backup_dir)
    return backup_dir.parent / "Snapshots" / backup_dir.name


def take(backup_dir, when=None):
    when = when or datetime.now()
    target = root_for(backup_dir) / when.strftime(STAMP)
    if target.exists():
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    clone_tree(backup_dir, target)
    return target


def _dated(folder):
    try:
        return datetime.strptime(folder.name, STAMP)
    except ValueError:
        return None


def prune(backup_dir, keep_days, now=None):
    """Delete snapshots older than keep_days. Never deletes the newest one."""
    now = now or datetime.now()
    snaps = sorted((d for d in root_for(backup_dir).glob("*") if d.is_dir() and _dated(d)), key=_dated)
    removed = []
    for snap in snaps[:-1]:
        if now - _dated(snap) > timedelta(days=keep_days):
            shutil.rmtree(snap, ignore_errors=True)
            removed.append(snap)
    return removed


def all_snapshots(backup_roots):
    """[(datetime, BackupInfo)] for every snapshot under the given backup folders, newest first."""
    found = []
    for root in backup_roots:
        for snap in Path(root).glob("Snapshots/*/*"):
            when = _dated(snap)
            if when and (snap / "Manifest.db").exists():
                try:
                    found.append((when, sources.read_backup_info(snap)))
                except sources.SourceError:
                    pass
    found.sort(key=lambda s: s[0], reverse=True)
    return found


def pick(backup_roots, day):
    """The last snapshot taken on or before `day` (a date)."""
    for when, info in all_snapshots(backup_roots):
        if when.date() <= day:
            return when, info
    return None
