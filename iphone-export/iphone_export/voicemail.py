"""Read visual voicemail: Library/Voicemail/voicemail.db plus <ROWID>.amr audio and <ROWID>.transcript.

Layout per iLEAPP's voicemail parser. iLEAPP leaves the epoch of `date` unconfirmed, so it's detected:
Unix seconds for any date after 2008 are above 1.2e9, while seconds-since-2001 stay below that until 2039.
"""

from __future__ import annotations

import plistlib
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

from .timeutil import from_apple


@dataclass
class Voicemail:
    rowid: int
    date: object
    number: str
    name: str
    duration: int
    transcript: str = ""
    audio: str | None = None  # exported path, relative to the export folder
    deleted: bool = False


def _when(value):
    if not value:
        return None
    value = float(value)
    if value > 1.2e9:
        return datetime.fromtimestamp(value, tz=timezone.utc).astimezone()
    return from_apple(value)


def read_transcript(path):
    try:
        with open(path, "rb") as f:
            data = plistlib.load(f)
    except Exception:
        return ""
    return (data.get("transcriptionString") or "").strip() if isinstance(data, dict) else ""


def load(db_path, contacts=None):
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(voicemail)")}
        callback = "callback_num" if "callback_num" in cols else "NULL AS callback_num"
        trashed = "trashed_date" if "trashed_date" in cols else "0 AS trashed_date"
        items = []
        for r in conn.execute(f"SELECT ROWID, date, sender, {callback}, duration, {trashed} FROM voicemail "
                              "ORDER BY date DESC"):
            number = r["sender"] or r["callback_num"] or ""
            items.append(Voicemail(
                rowid=r["ROWID"],
                date=_when(r["date"]),
                number=number,
                name=(contacts.name_for(number) if contacts else None) or "",
                duration=int(r["duration"] or 0),
                deleted=bool(r["trashed_date"]),
            ))
        return items
    finally:
        conn.close()
