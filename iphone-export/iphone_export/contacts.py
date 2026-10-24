"""Address book: names for phone numbers/emails, and a full contact list for export.

Reads the iPhone's AddressBook.sqlitedb or the Mac's AddressBook-v22.abcddb.
"""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass, field


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


def _clean_label(label):
    # Apple stores built-in labels as "_$!<Mobile>!$_"
    if not label:
        return ""
    m = re.fullmatch(r"_\$!<(.+)>!\$_", label)
    return m.group(1) if m else label


@dataclass
class Person:
    key: str
    first: str = ""
    last: str = ""
    organization: str = ""
    nickname: str = ""
    phones: list = field(default_factory=list)  # (label, number)
    emails: list = field(default_factory=list)  # (label, address)

    @property
    def name(self):
        return _person_name(self.first, self.last, self.organization, self.nickname) or "No name"


class Contacts:
    def __init__(self):
        self.names = {}
        self.person_ids = {}
        self.people = []

    def add(self, handle, name, person_id=None):
        key = normalize(handle)
        if key and name and key not in self.names:
            self.names[key] = name
            if person_id:
                self.person_ids[key] = person_id

    def name_for(self, handle):
        return self.names.get(normalize(handle))

    def person_for(self, handle):
        """A stable id for the contact card behind this handle, so one person's number and email merge."""
        key = normalize(handle)
        return self.person_ids.get(key) or key

    def label(self, handle):
        """'Alison Robey' if known, else the raw number or email."""
        return self.name_for(handle) or handle or "Unknown"

    def merge(self, other):
        for k, v in other.names.items():
            if k not in self.names:
                self.names[k] = v
                if k in other.person_ids:
                    self.person_ids[k] = other.person_ids[k]

    def __len__(self):
        return len(self.names)


def load(dbs):
    contacts = Contacts()
    for n, (path, flavor) in enumerate(dbs):
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            people = _load_ios(conn, n) if flavor == "ios" else _load_mac(conn, n)
        except sqlite3.DatabaseError:
            people = []
        finally:
            conn.close()
        for p in people:
            contacts.people.append(p)
            for _, number in p.phones:
                contacts.add(number, p.name if p.name != "No name" else None, p.key)
            for _, address in p.emails:
                contacts.add(address, p.name if p.name != "No name" else None, p.key)
    contacts.people.sort(key=lambda p: (p.last or p.first or p.organization or "~").lower())
    return contacts


def _load_ios(conn, n):
    people = {}
    for rowid, first, last, org, nick in conn.execute(
        "SELECT ROWID, First, Last, Organization, "
        + ("Nickname" if _has(conn, "ABPerson", "Nickname") else "NULL") + " FROM ABPerson"
    ):
        people[rowid] = Person(f"ios{n}:{rowid}", first or "", last or "", org or "", nick or "")
    labels = {}
    if _has(conn, "ABMultiValueLabel", "value"):
        labels = {r[0]: r[1] for r in conn.execute("SELECT ROWID, value FROM ABMultiValueLabel")}
    # property 3 = phone, 4 = email
    for record_id, prop, label, value in conn.execute(
        "SELECT record_id, property, label, value FROM ABMultiValue WHERE property IN (3, 4) AND value IS NOT NULL"
    ):
        p = people.get(record_id)
        if p is None:
            continue
        (p.phones if prop == 3 else p.emails).append((_clean_label(labels.get(label)), value))
    return list(people.values())


def _load_mac(conn, n):
    people = {}
    for pk, first, last, org, nick in conn.execute(
        "SELECT Z_PK, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION, ZNICKNAME FROM ZABCDRECORD"
    ):
        people[pk] = Person(f"mac{n}:{pk}", first or "", last or "", org or "", nick or "")
    phone_label = "ZLABEL" if _has(conn, "ZABCDPHONENUMBER", "ZLABEL") else "NULL"
    for owner, label, value in conn.execute(f"SELECT ZOWNER, {phone_label}, ZFULLNUMBER FROM ZABCDPHONENUMBER"):
        if owner in people and value:
            people[owner].phones.append((_clean_label(label), value))
    email_label = "ZLABEL" if _has(conn, "ZABCDEMAILADDRESS", "ZLABEL") else "NULL"
    for owner, label, value in conn.execute(f"SELECT ZOWNER, {email_label}, ZADDRESS FROM ZABCDEMAILADDRESS"):
        if owner in people and value:
            people[owner].emails.append((_clean_label(label), value))
    # The Mac keeps groups and other record types in ZABCDRECORD; keep only cards with a name or a number.
    return [p for p in people.values() if p.phones or p.emails or p.first or p.last or p.organization]


def _has(conn, table, column):
    return column in {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
