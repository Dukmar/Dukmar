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
    assert run_export(encrypted_backup, tmp_path / "out") == 5  # the app shows "wrong password" for this code
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
    assert cli.main(["schedule", "--window", "19:00-22:00", "--wifi", "--out", str(tmp_path / "out")]) == 0
    plan = plistlib.loads((tmp_path / "agent.plist").read_bytes())
    assert plan["StartCalendarInterval"] == [{"Hour": h, "Minute": 0} for h in (19, 20, 21, 22)]
    assert plan["ProgramArguments"][1:4] == ["-m", "iphone_export", "auto"]
    args = plan["ProgramArguments"]
    assert "--wifi" in args and str(tmp_path / "out") in args and args[args.index("--window") + 1] == "19:00-22:00"
    assert calls_made[-1][0] == "bootstrap"
    assert cli.main(["schedule", "--off"]) == 0 and not (tmp_path / "agent.plist").exists()
    with pytest.raises(SystemExit):
        cli.main(["schedule", "--window", "25:00-26:00"])


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


# --------------------------------------------------------------------------------------------- dated versions + daily run

@pytest.fixture
def fake_phone(plain_backup, tmp_path, monkeypatch):
    """Stand-in idevice_id/idevicebackup2 that 'back up' the fixture, and copytree in place of APFS clones."""
    import shutil
    from iphone_export import snapshots
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    udid = plain_backup.name
    _fake_tool(bin_dir, "idevice_id", f'echo "{udid}"\n')
    _fake_tool(bin_dir, "idevicebackup2",
               f'echo run >> "{tmp_path}/runs"; echo "Waiting for passcode to be entered on the device"; '
               f'eval last=\\${{$#}}; rm -rf "$last/{udid}"; cp -R "{plain_backup}" "$last/"; echo "Backup Successful."\n')
    monkeypatch.setenv("PATH", f"{bin_dir}:{os.environ['PATH']}")
    monkeypatch.setattr(snapshots, "clone_tree", lambda src, dst: shutil.copytree(src, dst))
    notes_sent = []
    monkeypatch.setattr(cli, "notify", lambda msg, title="iPhone Export": notes_sent.append(msg))
    return udid, bin_dir, notes_sent


def test_snapshots_take_prune_pick(plain_backup, tmp_path, monkeypatch):
    import shutil
    from datetime import date, datetime
    from iphone_export import snapshots
    monkeypatch.setattr(snapshots, "clone_tree", lambda src, dst: shutil.copytree(src, dst))
    for day in (1, 10, 20, 24):
        snapshots.take(plain_backup, datetime(2026, 10, day, 19, 0))
    root = snapshots.root_for(plain_backup)
    assert sorted(p.name for p in root.iterdir()) == ["2026-10-01 1900", "2026-10-10 1900", "2026-10-20 1900",
                                                      "2026-10-24 1900"]
    gone = snapshots.prune(plain_backup, keep_days=10, now=datetime(2026, 10, 24, 20, 0))
    assert sorted(p.name for p in gone) == ["2026-10-01 1900", "2026-10-10 1900"]
    when, info = snapshots.pick([plain_backup.parent], date(2026, 10, 22))
    assert when == datetime(2026, 10, 20, 19, 0) and info.device_name == "Colin's iPhone"
    assert snapshots.pick([plain_backup.parent], date(2026, 9, 1)) is None
    # nothing is ever pruned down to zero
    assert len(snapshots.prune(plain_backup, keep_days=0, now=datetime(2027, 1, 1))) == 1
    assert len(list(root.iterdir())) == 1


def test_sync_keeps_dated_version_then_export_it(fake_phone, tmp_path, capsys):
    udid, _, notes_sent = fake_phone
    dest, out = tmp_path / "phone-backups", tmp_path / "out"
    assert cli.main(["sync", "--wifi", "--dir", str(dest), "--out", str(out), "--no-keychain"]) == 0
    snaps = list((dest / "Snapshots" / udid).iterdir())
    assert len(snaps) == 1 and (snaps[0] / "Manifest.db").exists()
    assert notes_sent == ["Unlock your iPhone and enter its passcode to start the backup."]
    assert cli.main(["list", "--backup-root", str(dest)]) == 0
    assert "Dated versions (1)" in capsys.readouterr().out
    from datetime import date
    out2 = tmp_path / "out2"
    assert cli.main(["export", "--backup-root", str(dest), "--snapshot", date.today().isoformat(),
                     "--out", str(out2), "--no-keychain", "--only", "messages"]) == 0
    assert (out2 / "messages.csv").exists()
    assert cli.main(["export", "--backup-root", str(dest), "--snapshot", "2001-01-01", "--out", str(out2),
                     "--no-keychain"]) == 1


def test_backup_gives_up_waiting_for_passcode(fake_phone, tmp_path):
    udid, bin_dir, notes_sent = fake_phone
    _fake_tool(bin_dir, "idevicebackup2", 'echo "Waiting for passcode to be entered on the device"; sleep 30\n')
    import time as _time
    started = _time.monotonic()
    code = cli.main(["backup", "--dir", str(tmp_path / "b"), "--passcode-wait", "0.03"])
    assert code == 3 and _time.monotonic() - started < 15
    assert notes_sent == ["Unlock your iPhone and enter its passcode to start the backup."]


def test_auto_runs_once_a_day(fake_phone, tmp_path, capsys):
    udid, bin_dir, notes_sent = fake_phone
    dest, out = tmp_path / "phone-backups", tmp_path / "out"
    base = ["auto", "--wifi", "--dir", str(dest), "--out", str(out), "--no-keychain"]
    assert cli.main(base + ["--window", "00:00-23:59"]) == 0
    assert (out / "index.html").exists() and (dest / ".last-auto-backup").exists()
    assert notes_sent[-1] == "iPhone backed up and exported."
    assert cli.main(base + ["--window", "00:00-23:59"]) == 0  # second call the same day does nothing
    assert (tmp_path / "runs").read_text().count("run") == 1
    assert "already backed up today" in capsys.readouterr().out
    assert not (dest / ".auto-backup.lock").exists()


def test_auto_skips_quietly(fake_phone, tmp_path, capsys):
    udid, bin_dir, notes_sent = fake_phone
    dest = tmp_path / "phone-backups"
    base = ["auto", "--wifi", "--dir", str(dest), "--out", str(tmp_path / "out"), "--no-keychain"]
    from datetime import datetime, timedelta
    later = (datetime.now() + timedelta(hours=2)).strftime("%H:%M")
    if later > datetime.now().strftime("%H:%M"):  # a window that has not started yet today
        assert cli.main(base + ["--window", f"{later}-23:59"]) == 0
        assert "skipping" in capsys.readouterr().out
    _fake_tool(bin_dir, "idevice_id", "true\n")  # phone not on the network
    assert cli.main(base + ["--window", "00:00-23:59"]) == 0
    assert "not reachable on Wi-Fi" in capsys.readouterr().out
    assert not (tmp_path / "runs").exists() and notes_sent == []


# --------------------------------------------------------------------------------------------- Mac app interface

def _events(text):
    import json
    return [json.loads(line[len("@@EVENT "):]) for line in text.splitlines() if line.startswith("@@EVENT ")]


def test_progress_events_for_the_app(plain_backup, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("IPHONE_EXPORT_EVENTS", "1")
    out = tmp_path / "out"
    assert run_export(plain_backup, out) == 0
    evs = _events(capsys.readouterr().out)
    stages = [e["stage"] for e in evs if e["type"] == "stage"]
    assert stages == ["open", "messages", "attachments", "calls", "voicemail", "notes"]
    progress = [e for e in evs if e["type"] == "progress"]
    assert progress[-1] == {"type": "progress", "stage": "attachments", "done": 3, "total": 3}
    done = evs[-1]
    assert done["type"] == "done" and done["index"] == str(out / "index.html")
    assert done["stats"]["messages"] == 15 and done["problems"]


def test_no_events_without_the_switch(plain_backup, tmp_path, capsys):
    assert run_export(plain_backup, tmp_path / "out") == 0
    assert "@@EVENT" not in capsys.readouterr().out


def test_encrypted_without_password_asks_the_app(encrypted_backup, tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("IPHONE_EXPORT_EVENTS", "1")
    monkeypatch.delenv("IPHONE_BACKUP_PASSWORD", raising=False)
    monkeypatch.setattr("sys.stdin", open(os.devnull))  # not a terminal, like the app
    assert run_export(encrypted_backup, tmp_path / "out") == 4
    evs = _events(capsys.readouterr().out)
    assert {"type": "password_needed", "device": "Colin's iPhone", "udid": encrypted_backup.name} in evs
    monkeypatch.setenv("IPHONE_BACKUP_PASSWORD", "nope")
    assert run_export(encrypted_backup, tmp_path / "out") == 5
    assert any(e.get("kind") == "bad_password" for e in _events(capsys.readouterr().out))


def test_status_json(plain_backup, tmp_path, capsys):
    import json
    out = tmp_path / "out"
    assert run_export(plain_backup, out, "--only", "messages") == 0
    capsys.readouterr()
    assert cli.main(["status", "--backup-root", str(plain_backup.parent), "--out", str(out), "--no-devices"]) == 0
    data = json.loads(capsys.readouterr().out)
    assert data["backups"][0]["device"] == "Colin's iPhone" and data["backups"][0]["encrypted"] is False
    assert data["last_export"]["path"] == str(out / "index.html")
    assert data["devices"] == {"usb": [], "wifi": []} and data["snapshots"] == []
    assert data["access"]["finder_backups"] in ("ok", "missing", "denied")
    assert set(data["tools"]) == {"idevicebackup2", "brew", "pdf_browser"}


def test_cancel_stops_the_backup_tool_too(tmp_path):
    """The app's Cancel sends SIGTERM to the engine; idevicebackup2 must not keep running on its own."""
    import signal
    import subprocess
    import sys
    import time as _time
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    _fake_tool(bin_dir, "idevice_id", 'echo "PHONE1"\n')
    _fake_tool(bin_dir, "idevicebackup2", f'echo $$ > "{tmp_path}/child.pid"; echo "Receiving files"; exec sleep 60\n')
    env = dict(os.environ, PATH=f"{bin_dir}:{os.environ['PATH']}")
    proc = subprocess.Popen([sys.executable, "-m", "iphone_export", "backup", "--dir", str(tmp_path / "b")],
                            cwd=str(Path(__file__).parent.parent), env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    pid_file = tmp_path / "child.pid"
    for _ in range(100):
        if pid_file.exists() and pid_file.read_text().strip():
            break
        _time.sleep(0.1)
    child = int(pid_file.read_text())
    proc.send_signal(signal.SIGTERM)
    assert proc.wait(timeout=30) == 130  # the app shows "Cancelled" for this code
    assert b"Cancelled." in proc.stdout.read()
    _time.sleep(0.5)
    with pytest.raises(ProcessLookupError):
        os.kill(child, 0)


# --------------------------------------------------------------------------------------------- monthly archive

def test_archive_months():
    from datetime import date
    from iphone_export import archive

    assert archive.finished_months((2025, 11), date(2026, 2, 1)) == [(2025, 11), (2025, 12), (2026, 1)]
    assert archive.finished_months((2026, 2), date(2026, 2, 28)) == []
    assert archive.bounds(2025, 12) == ("2025-12-01", "2026-01-01")
    assert archive.parse_month("2019-05") == (2019, 5)
    with pytest.raises(SystemExit):
        archive.parse_month("May 2019")


def test_archive_files_each_month_once_and_copies(tmp_path, monkeypatch):
    """Every finished month gets its own folder, a done month is never redone, and the copy is retried."""
    from datetime import datetime as real_datetime
    from iphone_export import archive

    staging = tmp_path / "staging"
    staging.mkdir()
    fixture.make_sms_db(staging / "chat.db")
    monkeypatch.setattr(sources.sys, "platform", "darwin")
    monkeypatch.setattr(sources, "MAC_FILES", {"sms": staging / "chat.db"})
    monkeypatch.setattr(sources, "MAC_CONTACTS_ROOT", tmp_path / "no-address-book")
    monkeypatch.setattr(archive, "MESSAGES_DB", staging / "chat.db")
    monkeypatch.setattr(cli, "notify", lambda *a, **k: None)
    monkeypatch.setenv("HOME", str(tmp_path / "home"))

    class December(real_datetime):
        @classmethod
        def now(cls, tz=None):
            return real_datetime(2026, 12, 3, 9, 0).astimezone(tz)
    monkeypatch.setattr(cli, "datetime", December)

    dest, drive = tmp_path / "months", tmp_path / "drive"
    real_copy = archive.copy_month
    monkeypatch.setattr(archive, "copy_month", lambda folder, target: (False, "Operation not permitted"))
    assert cli.main(["archive", "--dest", str(dest), "--copy-to", str(drive), "--from", "2026-10"]) == 1
    # December isn't over, and November had no messages so it gets no folder.
    assert sorted(p.name for p in dest.iterdir() if not p.name.startswith(".")) == ["2026-10"]
    assert archive.empty_months(dest) == {"2026-11"}
    assert archive.message_count(dest / "2026-10") == len(read_csv(dest / "2026-10" / "messages.csv")) > 0
    assert not drive.exists()

    # Next run: nothing re-exported, and the failed copy goes through.
    monkeypatch.setattr(archive, "copy_month", real_copy)
    (dest / "2026-10" / "marker.txt").write_text("kept")
    assert cli.main(["archive", "--dest", str(dest), "--copy-to", str(drive), "--from", "2026-10"]) == 0
    assert (dest / "2026-10" / "marker.txt").exists()
    assert (drive / "2026-10" / "messages.csv").exists() and not (drive / "2026-11").exists()
    assert not (drive / "2026-10" / archive.DONE_MARK).exists()


def test_messages_from_deleted_conversations_are_kept(tmp_path):
    """A deleted conversation's messages can outlive its chat rows; they're filed under the person, marked."""
    import sqlite3
    from iphone_export import messages

    db = tmp_path / "chat.db"
    fixture.make_sms_db(db)
    conn = sqlite3.connect(db)
    before = conn.execute("SELECT count(*) FROM chat_message_join").fetchone()[0]
    (rowid, handle) = conn.execute("SELECT m.ROWID, h.id FROM message m JOIN handle h ON h.ROWID = m.handle_id "
                                   "WHERE m.is_from_me = 0 AND m.text != '' ORDER BY m.ROWID LIMIT 1").fetchone()
    conn.execute("DELETE FROM chat_message_join WHERE message_id = ?", (rowid,))
    conn.commit()
    conn.close()
    assert before > 0

    convos = messages.load(db)
    kept = [m for c in convos for m in c.messages if m.orphaned]
    assert len(kept) == 1 and kept[0].sender_handle == handle
    assert all(not m.orphaned for c in convos for m in c.messages if m is not kept[0])
