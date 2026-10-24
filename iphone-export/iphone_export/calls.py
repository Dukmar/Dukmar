"""Read call history (phone, FaceTime and app calls) from CallHistory.storedata."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from .timeutil import from_apple, to_apple_seconds


@dataclass
class Call:
    date: object
    direction: str  # Incoming, Outgoing, Missed
    kind: str  # Phone, FaceTime Audio, FaceTime Video, or the app's bundle id
    number: str
    name: str
    duration: int  # seconds
    location: str


def _text(value):
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value or ""


def _kind(provider, call_type):
    provider = provider or ""
    if provider == "com.apple.FaceTime" or call_type in (8, 16):
        return "FaceTime Video" if call_type == 8 else "FaceTime Audio"
    if provider in ("", "com.apple.Telephony"):
        return "Phone"
    # Third-party apps report their bundle id, e.g. net.whatsapp.WhatsApp -> WhatsApp
    return provider.rsplit(".", 1)[-1]


def load(db_path, contacts=None, since=None, until=None):
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(ZCALLRECORD)")}

        def c(name):
            return name if name in cols else f"NULL AS {name}"

        sql = (
            f"SELECT ZDATE, ZDURATION, ZORIGINATED, ZANSWERED, {c('ZCALLTYPE')}, {c('ZSERVICE_PROVIDER')}, "
            f"ZADDRESS, {c('ZNAME')}, {c('ZLOCATION')} FROM ZCALLRECORD"
        )
        clauses, params = [], []
        if since is not None:
            clauses.append("ZDATE >= ?")
            params.append(to_apple_seconds(since))
        if until is not None:
            clauses.append("ZDATE < ?")
            params.append(to_apple_seconds(until))
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY ZDATE DESC"
        calls = []
        for r in conn.execute(sql, params):
            number = _text(r["ZADDRESS"])
            if r["ZORIGINATED"]:
                direction = "Outgoing"
            elif r["ZANSWERED"]:
                direction = "Incoming"
            else:
                direction = "Missed"
            name = (contacts.name_for(number) if contacts else None) or _text(r["ZNAME"])
            calls.append(Call(
                date=from_apple(r["ZDATE"]),
                direction=direction,
                kind=_kind(r["ZSERVICE_PROVIDER"], r["ZCALLTYPE"]),
                number=number,
                name=name,
                duration=int(round(r["ZDURATION"] or 0)),
                location=_text(r["ZLOCATION"]),
            ))
        return calls
    finally:
        conn.close()
