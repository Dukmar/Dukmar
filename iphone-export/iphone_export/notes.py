"""Read Apple Notes from NoteStore.sqlite (iOS 9+ and macOS share the format)."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from .decode import note_text
from .timeutil import from_apple


@dataclass
class Note:
    title: str
    folder: str
    created: object
    modified: object
    text: str
    locked: bool


def _first_present(cols, *names):
    for name in names:
        if name in cols:
            return name
    return None


def _filled_column(conn, cols, prefix):
    """Pick the <prefix>N column actually filled in on note rows.

    Newer iOS keeps several same-named columns (ZCREATIONDATE, ZCREATIONDATE1, ZCREATIONDATE3...) and
    only one holds note dates, so "the first one that exists" can come back blank. Approach from iLEAPP.
    """
    candidates = [c for c in cols if c == prefix or (c.startswith(prefix) and c[len(prefix):].isdigit())]
    best, best_count = None, 0
    for col in sorted(candidates, key=lambda c: int(c[len(prefix):] or -1), reverse=True):
        count = conn.execute(
            f"SELECT COUNT(*) FROM ZICCLOUDSYNCINGOBJECT n JOIN ZICNOTEDATA d ON d.ZNOTE = n.Z_PK "
            f"WHERE n.{col} IS NOT NULL"
        ).fetchone()[0]
        if count > best_count:
            best, best_count = col, count
    return best or (candidates[0] if candidates else None)


def load(db_path):
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)")}
        # Column names shift between iOS versions; take whichever exists.
        created = _filled_column(conn, cols, "ZCREATIONDATE")
        modified = _filled_column(conn, cols, "ZMODIFICATIONDATE")
        locked = _first_present(cols, "ZISPASSWORDPROTECTED")
        deleted = _first_present(cols, "ZMARKEDFORDELETION")
        folder_type = _first_present(cols, "ZFOLDERTYPE")

        folders = {}
        if "ZTITLE2" in cols:
            ftype = f", {folder_type}" if folder_type else ", 0"
            for r in conn.execute(f"SELECT Z_PK, ZTITLE2{ftype} FROM ZICCLOUDSYNCINGOBJECT WHERE ZTITLE2 IS NOT NULL"):
                folders[r[0]] = (r[1], r[2])

        sql = (
            "SELECT n.Z_PK, n.ZTITLE1 AS title, n.ZFOLDER AS folder, "
            f"{'n.' + created if created else 'NULL'} AS created, "
            f"{'n.' + modified if modified else 'NULL'} AS modified, "
            f"{'n.' + locked if locked else '0'} AS locked, "
            f"{'n.' + deleted if deleted else '0'} AS deleted, "
            "d.ZDATA AS data "
            "FROM ZICCLOUDSYNCINGOBJECT n JOIN ZICNOTEDATA d ON d.ZNOTE = n.Z_PK "
            "ORDER BY modified DESC"
        )
        notes = []
        for r in conn.execute(sql):
            if r["deleted"]:
                continue
            folder_name, ftype = folders.get(r["folder"], ("Notes", 0))
            if ftype == 1:  # Recently Deleted
                continue
            is_locked = bool(r["locked"])
            text = "" if is_locked else (note_text(r["data"]) or "")
            title = r["title"] or (text.strip().splitlines()[0][:80] if text.strip() else "Untitled")
            notes.append(Note(
                title=title,
                folder=folder_name or "Notes",
                created=from_apple(r["created"]),
                modified=from_apple(r["modified"]),
                text=text,
                locked=is_locked,
            ))
        return notes
    finally:
        conn.close()
