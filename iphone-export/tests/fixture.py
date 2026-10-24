"""Build a small fake iPhone backup (plain or encrypted) that looks like the real thing to the exporter.

Messages tables use Apple's real CREATE TABLE statements (messages_schema.sql). The other databases
carry only the columns the exporter reads. Encrypted backups follow Apple's scheme as implemented by
iphone_backup_decrypt: PBKDF2 passphrase key -> RFC 3394 wrapped class keys -> wrapped per-file keys,
AES-256-CBC with a zero IV.
"""

import gzip
import hashlib
import os
import plistlib
import sqlite3
import struct
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)

ALISON = "+14165551234"
FRIEND = "friend@example.com"
STRANGER = "+19055550000"
LONG_TEXT = "Long message " + "x" * 300  # > 127 bytes forces the 0x81 length form in typedstream


def apple_ns(dt):
    return int((dt - APPLE_EPOCH).total_seconds() * 1e9)


def apple_s(dt):
    return (dt - APPLE_EPOCH).total_seconds()


def when(day, hour, minute=0):
    return datetime(2026, 10, day, hour, minute, tzinfo=timezone.utc)


def typedstream(text):
    """An NSAttributedString blob in the layout Messages writes (see decode.attributed_body_text)."""
    raw = text.encode()
    if len(raw) < 0x80:
        length = bytes([len(raw)])
    else:
        length = b"\x81" + struct.pack("<H", len(raw))
    return (b"\x04\x0bstreamtyped\x81\xe8\x03\x84\x01@\x84\x84\x84\x12NSAttributedString\x00\x84\x84\x08"
            b"NSObject\x00\x85\x92\x84\x84\x84\x08NSString\x01\x94\x84\x01+" + length + raw +
            b"\x86\x84\x02iI\x01\x01\x92\x84\x84\x84\x0cNSDictionary\x00\x94\x84\x01i\x01\x86\x86")


def _pb_varint(n):
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        out.append(b | (0x80 if n else 0))
        if not n:
            return bytes(out)


def _pb_bytes(field, payload):
    return _pb_varint(field << 3 | 2) + _pb_varint(len(payload)) + payload


def note_blob(text):
    note = _pb_bytes(2, text.encode()) + _pb_bytes(5, b"\x08\x05")  # text + one attribute run
    document = _pb_varint(2 << 3) + _pb_varint(0) + _pb_bytes(3, note)
    return gzip.compress(_pb_bytes(2, document))


# --------------------------------------------------------------------------------------------- databases

def make_sms_db(path):
    conn = sqlite3.connect(path)
    conn.executescript((HERE / "messages_schema.sql").read_text())
    conn.executemany("INSERT INTO handle (ROWID, id, service) VALUES (?, ?, ?)", [
        (1, ALISON, "iMessage"), (2, ALISON, "SMS"), (3, FRIEND, "iMessage"), (4, STRANGER, "iMessage"),
    ])
    conn.executemany("INSERT INTO chat (ROWID, guid, chat_identifier, service_name, display_name) VALUES (?,?,?,?,?)", [
        (1, "iMessage;-;" + ALISON, ALISON, "iMessage", ""),
        (2, "SMS;-;" + ALISON, ALISON, "SMS", ""),
        (3, "iMessage;+;chat123", "chat123", "iMessage", "Fantasy League"),
    ])
    conn.executemany("INSERT INTO chat_handle_join (chat_id, handle_id) VALUES (?, ?)",
                     [(1, 1), (2, 2), (3, 3), (3, 4)])

    rows = [
        # rowid, guid, text, attributedBody, handle, service, date, from_me, assoc_type, assoc_guid, extras
        (1, "G1", "Hi from Alison", None, 1, "iMessage", when(20, 14), 0, 0, None, {}),
        (2, "G2", "Hey! See you at 6 https://example.com/menu", None, 1, "iMessage", when(20, 14, 5), 1, 0, None, {}),
        (3, "G3", None, typedstream(LONG_TEXT), 1, "iMessage", when(20, 15), 0, 0, None, {}),
        (4, "G4", None, None, 1, "iMessage", when(20, 15, 1), 0, 2000, "p:0/G2", {}),            # Alison loves G2
        (5, "G5", None, None, 0, "iMessage", when(20, 15, 2), 1, 2001, "p:0/G3", {}),            # I like G3
        (6, "G6", None, None, 0, "iMessage", when(20, 15, 3), 1, 3001, "p:0/G3", {}),            # ...then remove it
        (7, "G7", "￼", None, 1, "iMessage", when(21, 9), 0, 0, None, {}),                    # photo
        (8, "G8", "Old SMS text", None, 2, "SMS", when(1, 8), 0, 0, None, {}),                    # SMS thread
        (9, "G9", "Edited words", None, 0, "iMessage", when(21, 10), 1, 0, None, {"date_edited": 1}),
        (10, "G10", "", None, 0, "iMessage", when(21, 11), 1, 0, None, {"date_retracted": 1}),     # unsent
        (11, "G11", "Draft picks tonight?", None, 3, "iMessage", when(22, 19), 0, 0, None, {}),
        (12, "G12", "In", None, 4, "iMessage", when(22, 19, 1), 0, 0, None, {}),
        (13, "G13", None, None, 3, "iMessage", when(22, 19, 2), 0, 0, None,
         {"item_type": 2, "group_title": "Fantasy League"}),
        (14, "G14", None, None, 4, "iMessage", when(22, 19, 3), 0, 2006, "p:0/G11",
         {"associated_message_emoji": "\U0001F525"}),
        (15, "G15", "Two files", None, 1, "iMessage", when(21, 9, 30), 0, 0, None, {}),
    ]
    for rowid, guid, text, body, handle, service, dt, me, atype, aguid, extras in rows:
        cols = {"ROWID": rowid, "guid": guid, "text": text, "attributedBody": body, "handle_id": handle,
                "service": service, "date": apple_ns(dt), "is_from_me": me,
                "associated_message_type": atype, "associated_message_guid": aguid, **extras}
        conn.execute(f"INSERT INTO message ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                     list(cols.values()))
    chat_of = {1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 1, 10: 1, 11: 3, 12: 3, 13: 3, 14: 3, 15: 1}
    conn.executemany("INSERT INTO chat_message_join (chat_id, message_id, message_date) VALUES (?, ?, 0)",
                     [(c, m) for m, c in chat_of.items()])
    conn.executemany(
        "INSERT INTO attachment (ROWID, guid, original_guid, filename, mime_type, transfer_name, total_bytes) "
        "VALUES (?,?,?,?,?,?,?)", [
            (1, "A1", "A1", "~/Library/SMS/Attachments/ab/11/A1/IMG_0001.HEIC", "image/heic", "Colin's IMG_0001.HEIC", 12),
            (2, "A2", "A2", "~/Library/SMS/Attachments/cd/22/A2/voice.caf", "audio/x-caf", "voice.caf", 9),
            (3, "A3", "A3", "~/Library/SMS/Attachments/ef/33/A3/gone.mov", "video/quicktime", "gone.mov", 99),
        ])
    conn.executemany("INSERT INTO message_attachment_join (message_id, attachment_id) VALUES (?, ?)",
                     [(7, 1), (15, 2), (15, 3)])
    conn.commit()
    conn.close()


def make_contacts_db(path):
    conn = sqlite3.connect(path)
    conn.executescript("""
        CREATE TABLE ABPerson (ROWID INTEGER PRIMARY KEY, First TEXT, Last TEXT, Organization TEXT);
        CREATE TABLE ABMultiValue (UID INTEGER PRIMARY KEY, record_id INTEGER, property INTEGER, label INTEGER, value TEXT);
        INSERT INTO ABPerson VALUES (1, 'Alison', 'Robey', NULL), (2, 'Pat', 'Friend', NULL), (3, NULL, NULL, 'Pizza Place');
        INSERT INTO ABMultiValue VALUES (1, 1, 3, 1, '(416) 555-1234'), (2, 2, 4, 1, 'Friend@Example.com'),
                                        (3, 3, 3, 1, '905-555-7777');
    """)
    conn.commit()
    conn.close()


def make_calls_db(path):
    conn = sqlite3.connect(path)
    conn.execute("""CREATE TABLE ZCALLRECORD (Z_PK INTEGER PRIMARY KEY, ZANSWERED INTEGER, ZCALLTYPE INTEGER,
        ZORIGINATED INTEGER, ZDATE TIMESTAMP, ZDURATION FLOAT, ZADDRESS BLOB, ZNAME VARCHAR,
        ZSERVICE_PROVIDER VARCHAR, ZLOCATION VARCHAR)""")
    conn.executemany("INSERT INTO ZCALLRECORD VALUES (?,?,?,?,?,?,?,?,?,?)", [
        (1, 1, 1, 0, apple_s(when(20, 12)), 125.4, ALISON.encode(), None, "com.apple.Telephony", "Toronto, ON"),
        (2, 0, 1, 1, apple_s(when(21, 12)), 0.0, "9055557777", None, "com.apple.Telephony", ""),
        (3, 0, 1, 0, apple_s(when(22, 12)), 0.0, STRANGER, None, "com.apple.Telephony", ""),
        (4, 1, 8, 1, apple_s(when(23, 20)), 600.0, FRIEND, None, "com.apple.FaceTime", ""),
        (5, 1, 1, 0, apple_s(datetime(2025, 1, 5, tzinfo=timezone.utc)), 30.0, "+16475550101", "Old Caller",
         "net.whatsapp.WhatsApp", ""),
    ])
    conn.commit()
    conn.close()


def make_notes_db(path):
    conn = sqlite3.connect(path)
    conn.executescript("""
        CREATE TABLE ZICCLOUDSYNCINGOBJECT (Z_PK INTEGER PRIMARY KEY, ZTITLE1 VARCHAR, ZTITLE2 VARCHAR,
            ZFOLDER INTEGER, ZFOLDERTYPE INTEGER, ZCREATIONDATE1 TIMESTAMP, ZCREATIONDATE3 TIMESTAMP,
            ZMODIFICATIONDATE1 TIMESTAMP, ZISPASSWORDPROTECTED INTEGER, ZMARKEDFORDELETION INTEGER,
            ZNOTEDATA INTEGER);
        CREATE TABLE ZICNOTEDATA (Z_PK INTEGER PRIMARY KEY, ZNOTE INTEGER, ZDATA BLOB);
    """)
    folders = [(100, "Notes", 0), (101, "Recipes", 0), (102, "Recently Deleted", 1)]
    for pk, title, ftype in folders:
        conn.execute("INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, ZTITLE2, ZFOLDERTYPE) VALUES (?, ?, ?)", (pk, title, ftype))
    notes = [
        (1, "Grocery list", 100, "Grocery list\nMilk\nEggs ￼", 0, 0),
        (2, "Chili", 101, "Chili\n2 cans beans", 0, 0),
        (3, "Bank PINs", 100, "secret", 1, 0),
        (4, "Trashed", 102, "gone", 0, 0),
        (5, "Marked deleted", 100, "gone too", 0, 1),
    ]
    for pk, title, folder, text, locked, deleted in notes:
        conn.execute(
            "INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, ZTITLE1, ZFOLDER, ZCREATIONDATE3, ZMODIFICATIONDATE1, "
            "ZISPASSWORDPROTECTED, ZMARKEDFORDELETION, ZNOTEDATA) VALUES (?,?,?,?,?,?,?,?)",
            (pk, title, folder, apple_s(when(1, 9)), apple_s(when(pk + 1, 9)), locked, deleted, pk + 10))
        conn.execute("INSERT INTO ZICNOTEDATA VALUES (?, ?, ?)", (pk + 10, pk, note_blob(text)))
    conn.commit()
    conn.close()


# --------------------------------------------------------------------------------------------- packaging

def _contents(staging):
    """(domain, relativePath, bytes) for every file the fake phone holds."""
    staging.mkdir(parents=True, exist_ok=True)
    make_sms_db(staging / "sms.db")
    make_contacts_db(staging / "AddressBook.sqlitedb")
    make_calls_db(staging / "CallHistory.storedata")
    make_notes_db(staging / "NoteStore.sqlite")
    return [
        ("HomeDomain", "Library/SMS/sms.db", (staging / "sms.db").read_bytes()),
        ("HomeDomain", "Library/AddressBook/AddressBook.sqlitedb", (staging / "AddressBook.sqlitedb").read_bytes()),
        ("HomeDomain", "Library/CallHistoryDB/CallHistory.storedata", (staging / "CallHistory.storedata").read_bytes()),
        ("AppDomainGroup-group.com.apple.notes", "NoteStore.sqlite", (staging / "NoteStore.sqlite").read_bytes()),
        ("MediaDomain", "Library/SMS/Attachments/ab/11/A1/IMG_0001.HEIC", b"fake heic!!!"),
        ("MediaDomain", "Library/SMS/Attachments/cd/22/A2/voice.caf", b"fake caf!"),
        # gone.mov deliberately absent: attachments offloaded to iCloud aren't in backups
    ]


def _write_plists(backup, encrypted, extra_manifest=None):
    info = {"Device Name": "Colin's iPhone", "Product Version": "18.6", "Unique Identifier": backup.name,
            "Last Backup Date": datetime(2026, 10, 24, 15, 0)}
    manifest = {"IsEncrypted": encrypted, "Version": "10.0", "Lockdown": {"ProductVersion": "18.6"}}
    manifest.update(extra_manifest or {})
    with open(backup / "Info.plist", "wb") as f:
        plistlib.dump(info, f)
    with open(backup / "Manifest.plist", "wb") as f:
        plistlib.dump(manifest, f, fmt=plistlib.FMT_BINARY)
    with open(backup / "Status.plist", "wb") as f:
        plistlib.dump({"IsFullBackup": False, "Date": datetime(2026, 10, 24, 15, 0)}, f)


def _manifest_db(path, rows):
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE Files (fileID TEXT PRIMARY KEY, domain TEXT, relativePath TEXT, flags INTEGER, file BLOB)")
    conn.executemany("INSERT INTO Files VALUES (?, ?, ?, ?, ?)", rows)
    conn.commit()
    conn.close()


def _file_id(domain, relpath):
    return hashlib.sha1(f"{domain}-{relpath}".encode()).hexdigest()


def _file_plist(size, wrapped_key=None, protection_class=3):
    top = {"$class": plistlib.UID(3), "Size": size, "ProtectionClass": protection_class,
           "LastModified": 1792000000, "Birth": 1792000000, "Mode": 0o100644}
    objects = ["$null", top]
    if wrapped_key is not None:
        top["EncryptionKey"] = plistlib.UID(2)
        objects.append({"NS.data": struct.pack("<l", protection_class) + wrapped_key, "$class": plistlib.UID(4)})
    else:
        objects.append({"$classname": "MBFile"})
    objects += [{"$classname": "MBFile", "$classes": ["MBFile", "NSObject"]},
                {"$classname": "NSMutableData", "$classes": ["NSMutableData", "NSData", "NSObject"]}]
    return plistlib.dumps({"$archiver": "NSKeyedArchiver", "$version": 100000,
                           "$top": {"root": plistlib.UID(1)}, "$objects": objects}, fmt=plistlib.FMT_BINARY)


def build_plain_backup(root, staging):
    backup = Path(root) / "00008110-000A1B2C3D4E5F6A"
    backup.mkdir(parents=True)
    rows = []
    for domain, relpath, data in _contents(Path(staging)):
        fid = _file_id(domain, relpath)
        (backup / fid[:2]).mkdir(exist_ok=True)
        (backup / fid[:2] / fid).write_bytes(data)
        rows.append((fid, domain, relpath, 1, _file_plist(len(data))))
    _manifest_db(backup / "Manifest.db", rows)
    _write_plists(backup, encrypted=False)
    return backup


def _pad(data):
    n = 16 - len(data) % 16
    return data + bytes([n]) * n


def _tlv(tag, value):
    if isinstance(value, int):
        value = struct.pack(">L", value)
    return tag + struct.pack(">L", len(value)) + value


def build_encrypted_backup(root, staging, password):
    from Crypto.Cipher import AES
    from Crypto.Protocol.KDF import PBKDF2
    from Crypto.Hash import SHA1, SHA256

    backup = Path(root) / "00008110-000ENCRYPTED0001"
    backup.mkdir(parents=True)
    dpsl, salt, dpic, iters = os.urandom(20), os.urandom(20), 10, 10
    round1 = PBKDF2(password.encode(), dpsl, 32, dpic, hmac_hash_module=SHA256)
    passphrase_key = PBKDF2(round1, salt, 32, iters, hmac_hash_module=SHA1)

    class_keys = {c: os.urandom(32) for c in (1, 2, 3, 4)}
    keybag = (_tlv(b"VERS", 3) + _tlv(b"TYPE", 1) + _tlv(b"UUID", os.urandom(16)) + _tlv(b"HMCK", os.urandom(40))
              + _tlv(b"WRAP", 0) + _tlv(b"SALT", salt) + _tlv(b"ITER", iters) + _tlv(b"DPWT", 1)
              + _tlv(b"DPIC", dpic) + _tlv(b"DPSL", dpsl))
    for c, key in class_keys.items():
        keybag += (_tlv(b"UUID", os.urandom(16)) + _tlv(b"CLAS", c) + _tlv(b"WRAP", 2) + _tlv(b"KTYP", 0)
                   + _tlv(b"WPKY", AES.new(passphrase_key, AES.MODE_KW).seal(key)))

    def encrypt(key, data):
        return AES.new(key, AES.MODE_CBC, iv=b"\x00" * 16).encrypt(_pad(data))

    rows = []
    for domain, relpath, data in _contents(Path(staging)):
        fid = _file_id(domain, relpath)
        file_key = os.urandom(32)
        wrapped = AES.new(class_keys[3], AES.MODE_KW).seal(file_key)
        (backup / fid[:2]).mkdir(exist_ok=True)
        (backup / fid[:2] / fid).write_bytes(encrypt(file_key, data))
        rows.append((fid, domain, relpath, 1, _file_plist(len(data), wrapped, 3)))
    plain_manifest = Path(staging) / "Manifest.plain.db"
    _manifest_db(plain_manifest, rows)
    manifest_key = os.urandom(32)
    (backup / "Manifest.db").write_bytes(encrypt(manifest_key, plain_manifest.read_bytes()))
    wrapped_manifest_key = struct.pack("<l", 4) + AES.new(class_keys[4], AES.MODE_KW).seal(manifest_key)
    _write_plists(backup, encrypted=True,
                  extra_manifest={"BackupKeyBag": keybag, "ManifestKey": wrapped_manifest_key})
    return backup
