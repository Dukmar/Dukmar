"""Turn phone numbers and emails into contact names, from the iPhone's or the Mac's address book."""

from __future__ import annotations

import re
import sqlite3


def normalize(handle):
    """Key used to match a handle against the address book: lowercase email, or the last 10 phone digits."""
    if not handle:
        return ""
    handle = handle.strip()
    if "@" in handle:
        return handle.lower()
    digits = re.sub(r"\D", "", handle)
    if len(digits) >= 10:
        return digits[-10:]
    return digits or handle.lower()


def _person_name(first, last, org, nickname=None):
    name = " ".join(p for p in (first, last) if p)
    return name or org or nickname or ""


class Contacts:
    def __init__(self):
        self.names = {}

    def add(self, handle, name):
        key = normalize(handle)
        if key and name and key not in self.names:
            self.names[key] = name

    def name_for(self, handle):
        return self.names.get(normalize(handle))

    def label(self, handle):
        """'Alison Robey' if known, else the raw number or email."""
        return self.name_for(handle) or handle or "Unknown"

    def __len__(self):
        return len(self.names)


def load(dbs):
    contacts = Contacts()
    for path, flavor in dbs:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            if flavor == "ios":
                _load_ios(conn, contacts)
            else:
                _load_mac(conn, contacts)
        except sqlite3.DatabaseError:
            pass
        finally:
            conn.close()
    return contacts


def _load_ios(conn, contacts):
    people = {
        rowid: _person_name(first, last, org)
        for rowid, first, last, org in conn.execute("SELECT ROWID, First, Last, Organization FROM ABPerson")
    }
    # property 3 = phone, 4 = email
    for record_id, value in conn.execute(
        "SELECT record_id, value FROM ABMultiValue WHERE property IN (3, 4) AND value IS NOT NULL"
    ):
        contacts.add(value, people.get(record_id))


def _load_mac(conn, contacts):
    people = {
        pk: _person_name(first, last, org, nick)
        for pk, first, last, org, nick in conn.execute(
            "SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION, ZNICKNAME FROM ZABCDRECORD"
        )
    }
    for owner, value in conn.execute("SELECT ZOWNER, ZFULLNUMBER FROM ZABCDPHONENUMBER"):
        contacts.add(value, people.get(owner))
    for owner, value in conn.execute("SELECT ZOWNER, ZADDRESS FROM ZABCDEMAILADDRESS"):
        contacts.add(value, people.get(owner))
