"""Monthly text archive: each finished month's messages filed in a folder of its own (2026-10/, 2026-11/...).

With Messages in iCloud on, deleting a text on the phone deletes it from the Mac too (after 30 days in
Recently Deleted), so the Mac's copy is only a backup if something files it away first. This does that from
the Mac's synced Messages database: no phone, cable or backup needed.

A month is exported once, into <dest>/YYYY-MM, and marked done. Optionally each done month is then copied
somewhere else (a Google Drive folder) and marked copied, so a copy that fails is retried on the next run.
The scheduled job runs daily and does nothing once every finished month is filed, so a Mac that was off on
the 1st catches up the next time it runs.
"""

from __future__ import annotations

import csv
import json
import sqlite3
import subprocess
from datetime import date
from pathlib import Path

from . import timeutil

DONE_MARK = ".archived.json"
COPIED_MARK = ".copied"
EMPTY_LIST = ".empty-months.json"  # finished months with no messages: remembered, but no folder for them
MESSAGES_DB = Path.home() / "Library/Messages/chat.db"


def parse_month(value):
    """'2026-10' -> (2026, 10)."""
    try:
        year, month = (int(part) for part in value.split("-"))
        date(year, month, 1)
    except (ValueError, AttributeError):
        raise SystemExit(f"A month looks like 2026-10, got {value!r}")
    return year, month


def next_month(year, month):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def month_name(year, month):
    return f"{year:04d}-{month:02d}"


def bounds(year, month):
    """--since and --until for one month (until is exclusive)."""
    return f"{year:04d}-{month:02d}-01", "{:04d}-{:02d}-01".format(*next_month(year, month))


def finished_months(first, today):
    """Every month from `first` (year, month) up to, not including, the month `today` is in."""
    months, current = [], first
    while current < (today.year, today.month):
        months.append(current)
        current = next_month(*current)
    return months


def first_message_month(db=MESSAGES_DB):
    """The month of the oldest message in this Mac's Messages database, or None if it can't be read."""
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        try:
            (value,) = con.execute("SELECT min(date) FROM message WHERE date > 0").fetchone()
        finally:
            con.close()
    except sqlite3.Error:
        return None
    first = timeutil.from_apple(value)
    return (first.year, first.month) if first else None


def is_done(folder):
    return (folder / DONE_MARK).exists()


def empty_months(dest):
    try:
        return set(json.loads((dest / EMPTY_LIST).read_text()))
    except (OSError, ValueError):
        return set()


def add_empty_month(dest, name):
    (dest / EMPTY_LIST).write_text(json.dumps(sorted(empty_months(dest) | {name}), indent=2))


def mark_done(folder, info):
    (folder / DONE_MARK).write_text(json.dumps(info, indent=2))


def message_count(folder):
    """Messages in a month's export, from its messages.csv (0 if the month had none)."""
    path = folder / "messages.csv"
    if not path.exists():
        return 0
    with open(path, newline="", encoding="utf-8-sig") as f:
        return sum(1 for _ in csv.DictReader(f))


def needs_copy(folder, target_root):
    return is_done(folder) and not ((folder / COPIED_MARK).exists() and (target_root / folder.name).exists())


def copy_month(folder, target_root):
    """Copy one finished month into target_root/<YYYY-MM>. rsync resumes a copy that stopped part way.
    Returns (ok, error text)."""
    target_root.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(["rsync", "-a", "--exclude", DONE_MARK, "--exclude", COPIED_MARK,
                             f"{folder}/", f"{target_root / folder.name}/"], capture_output=True, text=True)
    if result.returncode != 0:
        return False, (result.stderr.strip() or f"rsync stopped with code {result.returncode}")
    (folder / COPIED_MARK).touch()
    return True, ""
