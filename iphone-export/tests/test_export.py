import csv
import os
import time
from pathlib import Path

import pytest

os.environ["TZ"] = "America/Toronto"
time.tzset()

from iphone_export import cli, sources  # noqa: E402
from iphone_export.decode import attributed_body_text, note_text  # noqa: E402

from . import fixture  # noqa: E402

PASSWORD = "correct horse"


@pytest.fixture
def plain_backup(tmp_path):
    return fixture.build_plain_backup(tmp_path / "backups", tmp_path / "staging")


@pytest.fixture
def encrypted_backup(tmp_path):
    pytest.importorskip("iphone_backup_decrypt")
    return fixture.build_encrypted_backup(tmp_path / "backups", tmp_path / "staging", PASSWORD)


def run_export(backup, out, *extra):
    return cli.main(["export", "--backup", str(backup), "--out", str(out), "--no-keychain", *extra])


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# --------------------------------------------------------------------------------------------- decoders

def test_attributed_body_short_and_long():
    assert attributed_body_text(fixture.typedstream("Hello")) == "Hello"
    assert attributed_body_text(fixture.typedstream(fixture.LONG_TEXT)) == fixture.LONG_TEXT
    assert attributed_body_text(fixture.typedstream("café \U0001F600")) == "café \U0001F600"
    assert attributed_body_text(None) is None
    assert attributed_body_text(b"no class name here") is None


def test_note_text():
    assert note_text(fixture.note_blob("Title\nbody ￼")) == "Title\nbody [attachment]"
    assert note_text(None) is None


SAMPLES = Path(os.environ.get(
    "TYPEDSTREAM_SAMPLES", "/home/user/reagentx/imessage-exporter/imessage-database/test_data/typedstream"))


@pytest.mark.skipif(not SAMPLES.is_dir(), reason="real Messages blobs from imessage-exporter not present")
def test_real_attributed_bodies():
    """Blobs captured from real Messages databases (imessage-exporter's test data)."""
    expected = {
        "AttributedBodyTextOnly": "Noter test",
        "Code": "000123 is your security code. Don't share your code.",
        "URL": "https://github.com/ReagentX/Logria",
        "MultiPart": "￼test 1￼test 2 ￼test 3",
        "WeirdText": "\U0001d58d\U0001d58a\U0001d591\U0001d591\U0001d594 \U0001d59c\U0001d594\U0001d597\U0001d591\U0001d589",
    }
    for name, text in expected.items():
        assert attributed_body_text((SAMPLES / name).read_bytes()) == text, name
    assert len(attributed_body_text((SAMPLES / "LongMessage").read_bytes())) == 2359
    assert attributed_body_text((SAMPLES / "ExtraData").read_bytes()).startswith("This is parsing")


# --------------------------------------------------------------------------------------------- end to end

def check_full_export(out):
    index = (out / "index.html").read_text()
    assert "Alison Robey" in index and "Fantasy League" in index

    # iMessage and SMS threads with Alison merge into one conversation
    convo_files = sorted(p.name for p in (out / "Messages").glob("*.html"))
    assert convo_files == ["Alison Robey.html", "Fantasy League.html"]

    rows = read_csv(out / "messages.csv")
    alison = [r for r in rows if r["conversation"] == "Alison Robey"]
    texts = [r["text"] for r in alison]
    assert texts[0] == "Old SMS text"  # Oct 1 SMS sorts first
    assert fixture.LONG_TEXT in texts  # decoded from attributedBody
    assert "(unsent)" in texts
    # tapbacks become reactions, not messages; the removed like is gone
    assert not any(t == "" and not r["attachments"] for t, r in zip(texts, alison))
    loved = next(r for r in alison if r["text"].startswith("Hey! See you"))
    assert "Alison Robey:❤️" in loved["reactions"]
    long_row = next(r for r in alison if r["text"] == fixture.LONG_TEXT)
    assert long_row["reactions"] == ""
    assert loved["date"] == "2026-10-20 10:05:00"  # 14:05 UTC shown in Toronto time

    group = [r for r in rows if r["conversation"] == "Fantasy League"]
    assert [r["sender"] for r in group] == ["Pat Friend", STRANGER_LABEL, "Pat Friend"]
    assert group[2]["text"] == "Pat Friend named the conversation “Fantasy League”"
    assert "\U0001F525" in group[0]["reactions"]

    html = (out / "Messages" / "Alison Robey.html").read_text()
    assert '<a href="https://example.com/menu">' in html
    assert "This message was unsent" in html and "Edited" in html
    assert "gone.mov — not in backup" in html
    copied = sorted(p.name for p in (out / "Messages" / "attachments" / "Alison Robey").iterdir())
    assert len(copied) == 2 and any(n.endswith("IMG_0001.HEIC") for n in copied)
    assert (out / "Messages" / "Alison Robey.txt").read_text().count("\n") > 8

    calls = read_csv(out / "calls.csv")
    assert [c["direction"] for c in calls] == ["Outgoing", "Missed", "Outgoing", "Incoming", "Incoming"]
    assert calls[0]["type"] == "FaceTime Video" and calls[0]["name"] == "Pat Friend"
    assert calls[2]["name"] == "Pizza Place"
    assert calls[3]["name"] == "Alison Robey" and calls[3]["duration_seconds"] == "125"
    assert calls[4]["type"] == "net.whatsapp.WhatsApp" and calls[4]["name"] == "Old Caller"

    notes_dir = out / "Notes"
    assert sorted(p.relative_to(notes_dir).as_posix() for p in notes_dir.rglob("*.txt")) == [
        "Notes/Bank PINs.txt", "Notes/Grocery list.txt", "Recipes/Chili.txt"]
    assert "Eggs [attachment]" in (notes_dir / "Notes" / "Grocery list.txt").read_text()
    assert "locked with a password" in (notes_dir / "Notes" / "Bank PINs.txt").read_text()
    assert "secret" not in (out / "notes.html").read_text()


STRANGER_LABEL = fixture.STRANGER


def test_plain_backup_export(plain_backup, tmp_path):
    out = tmp_path / "out"
    assert run_export(plain_backup, out) == 0
    check_full_export(out)


def test_rerun_skips_copied_attachments(plain_backup, tmp_path):
    out = tmp_path / "out"
    assert run_export(plain_backup, out) == 0
    att = next((out / "Messages" / "attachments" / "Alison Robey").glob("*HEIC"))
    stamp = att.stat().st_mtime_ns
    assert run_export(plain_backup, out) == 0
    assert att.stat().st_mtime_ns == stamp


def test_encrypted_backup_export(encrypted_backup, tmp_path, monkeypatch):
    monkeypatch.setenv("IPHONE_BACKUP_PASSWORD", PASSWORD)
    out = tmp_path / "out"
    assert run_export(encrypted_backup, out) == 0
    check_full_export(out)


def test_encrypted_wrong_password(encrypted_backup, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("IPHONE_BACKUP_PASSWORD", "nope")
    assert run_export(encrypted_backup, tmp_path / "out") == 1
    assert "password didn't work" in capsys.readouterr().out


def test_since_and_only(plain_backup, tmp_path):
    out = tmp_path / "out"
    assert run_export(plain_backup, out, "--since", "2026-10-21", "--only", "messages,calls",
                      "--no-attachments") == 0
    rows = read_csv(out / "messages.csv")
    assert rows and all(r["date"] >= "2026-10-21" for r in rows)
    assert "Old SMS text" not in {r["text"] for r in rows}
    assert len(read_csv(out / "calls.csv")) == 3
    assert not (out / "notes.html").exists()
    assert not (out / "Messages" / "attachments").exists()


def test_list_and_latest(plain_backup, tmp_path, capsys):
    root = plain_backup.parent
    assert cli.main(["list", "--backup-root", str(root)]) == 0
    assert "Colin's iPhone (iOS 18.6)" in capsys.readouterr().out
    out = tmp_path / "out"
    assert cli.main(["export", "--backup-root", str(root), "--out", str(out), "--no-keychain"]) == 0
    assert (out / "index.html").exists()


def test_attachment_path_mapping():
    assert sources.ios_attachment_relpath("~/Library/SMS/Attachments/a/b.jpg") == "Library/SMS/Attachments/a/b.jpg"
    assert sources.ios_attachment_relpath("/var/mobile/Library/SMS/x.jpg") == "Library/SMS/x.jpg"
    assert sources.ios_attachment_relpath(None) is None


def test_mac_source(tmp_path, monkeypatch):
    """--mac reads chat.db / NoteStore / CallHistory from the Mac's own folders, plus the Mac address book."""
    import sqlite3
    from iphone_export import contacts as contacts_mod

    staging = tmp_path / "staging"
    staging.mkdir()
    fixture.make_sms_db(staging / "chat.db")
    fixture.make_calls_db(staging / "CallHistory.storedata")
    fixture.make_notes_db(staging / "NoteStore.sqlite")
    book_root = tmp_path / "AddressBook"
    (book_root / "Sources" / "ABC").mkdir(parents=True)
    conn = sqlite3.connect(book_root / "Sources" / "ABC" / "AddressBook-v22.abcddb")
    conn.executescript("""
        CREATE TABLE ZABCDRECORD (Z_PK INTEGER PRIMARY KEY, ZFIRSTNAME, ZLASTNAME, ZORGANIZATION, ZNICKNAME);
        CREATE TABLE ZABCDPHONENUMBER (Z_PK INTEGER PRIMARY KEY, ZOWNER INTEGER, ZFULLNUMBER);
        CREATE TABLE ZABCDEMAILADDRESS (Z_PK INTEGER PRIMARY KEY, ZOWNER INTEGER, ZADDRESS);
        INSERT INTO ZABCDRECORD VALUES (1, 'Alison', 'R.', NULL, NULL);
        INSERT INTO ZABCDPHONENUMBER VALUES (1, 1, '+1 416-555-1234');
    """)
    conn.commit()
    conn.close()
    attach = tmp_path / "home" / "Library" / "SMS" / "Attachments" / "ab" / "11" / "A1"
    attach.mkdir(parents=True)
    (attach / "IMG_0001.HEIC").write_bytes(b"heic")

    monkeypatch.setattr(sources.sys, "platform", "darwin")
    monkeypatch.setattr(sources, "MAC_FILES", {"sms": staging / "chat.db", "calls": staging / "CallHistory.storedata",
                                               "notes": staging / "NoteStore.sqlite"})
    monkeypatch.setattr(sources, "MAC_CONTACTS_ROOT", book_root)
    monkeypatch.setenv("HOME", str(tmp_path / "home"))

    src = sources.MacSource()
    try:
        book = contacts_mod.load(src.contacts_dbs())
        assert book.name_for("+14165551234") == "Alison R."
    finally:
        src.close()

    out = tmp_path / "out"
    assert cli.main(["export", "--mac", "--out", str(out), "--no-keychain"]) == 0
    assert (out / "Messages" / "Alison R.html").exists()
    copied = list((out / "Messages" / "attachments" / "Alison R").iterdir())
    assert len(copied) == 1
    assert len(read_csv(out / "calls.csv")) == 5
