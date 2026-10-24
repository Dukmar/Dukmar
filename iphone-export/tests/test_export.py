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
    assert not any(t == "" and not r["attachments"] and not r["app"] for t, r in zip(texts, alison))
    loved = next(r for r in alison if r["text"].startswith("Hey! See you"))
    assert "Alison Robey:❤️" in loved["reactions"]
    long_row = next(r for r in alison if r["text"] == fixture.LONG_TEXT)
    assert long_row["reactions"] == ""
    assert loved["date"] == "2026-10-20 10:05:00"  # 14:05 UTC shown in Toronto time
    assert loved["read"] == "2026-10-20 10:07:00" and loved["delivered"] == "2026-10-20 10:05:00"

    # Alison's email address is on her contact card, so that thread merges in too
    reply = next(r for r in alison if r["text"] == "Sounds good")
    assert reply["reply_to"].startswith("Me: Hey! See you at 6")
    edited = next(r for r in alison if r["text"] == "Edited words")
    assert edited["earlier_versions"] == "Edit words v1"
    deleted = next(r for r in alison if r["text"] == "Oops wrong chat")
    assert deleted["recently_deleted"] == "2026-10-23 04:00:00"
    assert next(r for r in alison if r["text"] == "Happy birthday!")["effect"] == "Balloons"
    assert any(r["app"] == "Apple Cash payment" for r in alison)

    group = [r for r in rows if r["conversation"] == "Fantasy League"]
    assert [r["sender"] for r in group] == ["Pat Friend", STRANGER_LABEL, "Pat Friend"]
    assert group[2]["text"] == "Pat Friend named the conversation “Fantasy League”"
    assert "\U0001F525" in group[0]["reactions"]

    html = (out / "Messages" / "Alison Robey.html").read_text()
    assert '<a href="https://example.com/menu">' in html
    assert "This message was unsent" in html and "<summary>Edited</summary>" in html
    assert "Read 10:07 AM" in html and "Sent with Balloons" in html and "Recently deleted" in html
    assert 'class="reply" href="#m-' in html
    assert "gone.mov — not in backup" in html
    copied = sorted(p.name for p in (out / "Messages" / "attachments" / "Alison Robey").iterdir())
    assert len(copied) == 2 and any(n.endswith("IMG_0001.HEIC") for n in copied)
    assert (out / "Messages" / "Alison Robey.txt").read_text().count("\n") > 8

    calls = read_csv(out / "calls.csv")
    assert [c["direction"] for c in calls] == ["Outgoing", "Missed", "Outgoing", "Incoming", "Incoming"]
    assert calls[0]["type"] == "FaceTime Video" and calls[0]["name"] == "Pat Friend"
    assert calls[2]["name"] == "Pizza Place"
    assert calls[3]["name"] == "Alison Robey" and calls[3]["duration_seconds"] == "125"
    assert calls[4]["type"] == "WhatsApp" and calls[4]["name"] == "Old Caller"

    vm = read_csv(out / "voicemail.csv")
    assert [v["name"] for v in vm] == ["Alison Robey", ""]
    assert vm[0]["transcript"] == "Hey it's Alison, call me back" and vm[0]["audio_file"] == "Voicemail/1.amr"
    assert vm[0]["date"] == "2026-10-22 06:00:00" and vm[1]["deleted"] == "yes"
    assert (out / "Voicemail" / "1.amr").exists()

    people = read_csv(out / "contacts.csv")
    alison_card = next(p for p in people if p["name"] == "Alison Robey")
    assert alison_card["phones"] == "Mobile: (416) 555-1234" and alison_card["emails"] == "Home: alison@icloud.com"
    vcf = (out / "contacts.vcf").read_text()
    assert vcf.count("BEGIN:VCARD") == 3 and "TEL;TYPE=MOBILE:(416) 555-1234" in vcf

    search_data = (out / "search-data.js").read_text()
    assert "Draft picks tonight?" in search_data and (out / "search.html").exists()
    photos = (out / "photos.html").read_text()
    assert photos.count('class="tile"') == 1
    for page in ("index.html", "calls.html", "Messages/Alison Robey.html"):
        assert 'href="../voicemail.html"' in (out / page).read_text() or \
            'href="voicemail.html"' in (out / page).read_text(), page

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


# --------------------------------------------------------------------------------------------- new features

def test_contact_filter_until_and_me_name(plain_backup, tmp_path):
    out = tmp_path / "out"
    assert run_export(plain_backup, out, "--contact", "Pat", "--until", "2026-10-22", "--me-name", "Colin") == 0
    # Pat is only in the group chat, which starts on Oct 22 (Toronto), so --until drops it...
    assert not list((out / "Messages").glob("*.html"))
    out2 = tmp_path / "out2"
    assert run_export(plain_backup, out2, "--contact", "416-555-1234", "--me-name", "Colin") == 0
    rows = read_csv(out2 / "messages.csv")
    assert {r["conversation"] for r in rows} == {"Alison Robey"}
    assert "Colin" in {r["sender"] for r in rows} and "Me" not in {r["sender"] for r in rows}
    assert [c["name"] for c in read_csv(out2 / "calls.csv")] == ["Alison Robey"]
    assert not (out2 / "notes.html").exists() and not (out2 / "contacts.csv").exists()


def _fake_tool(bin_dir, name, body):
    path = bin_dir / name
    path.write_text("#!/bin/sh\n" + body)
    path.chmod(0o755)


def test_convert_media_and_file_dates(plain_backup, tmp_path, monkeypatch):
    """--convert-media calls the Mac's sips/afconvert; stand-ins here just copy the file."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _fake_tool(bin_dir, "sips", 'eval last=\\${$#}; cp "$4" "$last"\n')          # sips -s format jpeg IN --out OUT
    _fake_tool(bin_dir, "afconvert", 'eval last=\\${$#}; cp "$5" "$last"\n')     # afconvert -f m4af -d aac IN OUT
    monkeypatch.setenv("PATH", f"{bin_dir}:{os.environ['PATH']}")
    out = tmp_path / "out"
    assert run_export(plain_backup, out, "--convert-media") == 0
    files = sorted(p.name for p in (out / "Messages" / "attachments" / "Alison Robey").iterdir())
    assert any(n.endswith("IMG_0001.jpg") for n in files) and any(n.endswith("voice.m4a") for n in files)
    assert not any(n.endswith((".HEIC", ".caf")) for n in files)
    jpg = next((out / "Messages" / "attachments" / "Alison Robey").glob("*.jpg"))
    from datetime import datetime, timezone
    assert jpg.stat().st_mtime == datetime(2026, 10, 21, 9, 0, tzinfo=timezone.utc).timestamp()
    assert (out / "Voicemail" / "1.m4a").exists()
    html = (out / "Messages" / "Alison Robey.html").read_text()
    assert ".jpg\"" in html and "voice.m4a" in html
    # second run finds the converted files and doesn't fetch again
    assert run_export(plain_backup, out, "--convert-media") == 0
    assert not list((out / "Messages" / "attachments" / "Alison Robey").glob("*.HEIC"))


def test_disk_space_guard(plain_backup, tmp_path, monkeypatch, capsys):
    import collections
    from iphone_export import render
    usage = collections.namedtuple("usage", "total used free")
    monkeypatch.setattr(render.shutil, "disk_usage", lambda p: usage(100, 100, 10))
    assert run_export(plain_backup, tmp_path / "out") == 1
    assert "only 0.0 GB is free" in capsys.readouterr().out
    assert run_export(plain_backup, tmp_path / "out", "--ignore-disk-warning") == 0


BROWSER = os.environ.get("CHROME_PATH") or "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"


@pytest.mark.skipif(not Path(BROWSER).exists(), reason="no Chrome/Chromium for PDF test")
def test_pdf_export(plain_backup, tmp_path, monkeypatch):
    pypdf = pytest.importorskip("pypdf")
    monkeypatch.setenv("CHROME_PATH", BROWSER)
    out = tmp_path / "out"
    assert run_export(plain_backup, out, "--pdf", "--only", "messages,calls") == 0
    pdf_path = out / "PDF" / "Messages" / "Alison Robey.pdf"
    assert pdf_path.exists() and (out / "PDF" / "calls.pdf").exists()
    text = " ".join(page.extract_text() for page in pypdf.PdfReader(str(pdf_path)).pages)
    assert "Page 1 of" in text  # page numbers in the margin
    assert "Colin's iPhone" in text and "exported" in text  # export metadata footer
    assert "Hey! See you at 6" in text
    assert "Edit words v1" in text  # edit history printed open


def test_schedule_writes_launch_agent(tmp_path, monkeypatch):
    import plistlib
    from iphone_export import schedule
    calls_made = []
    monkeypatch.setattr(cli.sys, "platform", "darwin")
    monkeypatch.setattr(cli.shutil, "which", lambda name: "/opt/homebrew/bin/" + name)
    monkeypatch.setattr(schedule, "PLIST", tmp_path / "agent.plist")
    monkeypatch.setattr(schedule, "LOG", tmp_path / "export.log")
    monkeypatch.setattr(schedule, "_launchctl",
                        lambda *a: calls_made.append(a) or type("R", (), {"returncode": 0, "stderr": ""})())
    assert cli.main(["schedule", "--at", "03:15", "--wifi", "--out", str(tmp_path / "out")]) == 0
    plan = plistlib.loads((tmp_path / "agent.plist").read_bytes())
    assert plan["StartCalendarInterval"] == {"Hour": 3, "Minute": 15}
    assert plan["ProgramArguments"][1:4] == ["-m", "iphone_export", "sync"]
    assert "--wifi" in plan["ProgramArguments"] and str(tmp_path / "out") in plan["ProgramArguments"]
    assert calls_made[-1][0] == "bootstrap"
    assert cli.main(["schedule", "--off"]) == 0 and not (tmp_path / "agent.plist").exists()
    assert cli.main(["schedule", "--at", "25:00"]) == 2


def test_sync_runs_backup_then_export(plain_backup, tmp_path, monkeypatch):
    """`sync` = idevicebackup2 into --dir/<udid>, then export that backup. Stand-in tools copy the fixture."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    udid = plain_backup.name
    _fake_tool(bin_dir, "idevice_id", f'echo "{udid}"\n')
    _fake_tool(bin_dir, "idevicebackup2", f'printf "%s " "$@" > "{tmp_path}/args"; eval last=\\${{$#}}; '
                                          f'cp -R "{plain_backup}" "$last/"\n')
    monkeypatch.setenv("PATH", f"{bin_dir}:{os.environ['PATH']}")
    out, dest = tmp_path / "out", tmp_path / "backups-here"
    assert cli.main(["sync", "--wifi", "--dir", str(dest), "--out", str(out), "--no-keychain"]) == 0
    assert (tmp_path / "args").read_text().split()[:4] == ["-n", "-u", udid, "backup"]
    assert (out / "index.html").exists() and (dest / udid / "Manifest.db").exists()


EDITED_SAMPLES = SAMPLES.parent / "edited_message"


@pytest.mark.skipif(not EDITED_SAMPLES.is_dir(), reason="real edited-message plists not present")
def test_real_edit_history():
    from iphone_export.decode import edit_history
    history = edit_history((EDITED_SAMPLES / "Edited.plist").read_bytes())
    assert [t for _, t in history] == ["First message", "Edit 1", "Edit 2", "Edited message"]
    assert edit_history((EDITED_SAMPLES / "Deleted.plist").read_bytes()) == []
