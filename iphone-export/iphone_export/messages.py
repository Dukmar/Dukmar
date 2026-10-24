"""Read conversations out of sms.db (iPhone) or chat.db (Mac) - the two share one schema."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field

from . import contacts as contacts_mod
from .decode import attributed_body_text
from .timeutil import from_apple, to_apple_seconds

TAPBACKS = {0: "❤️", 1: "\U0001F44D", 2: "\U0001F44E", 3: "\U0001F602", 4: "‼️", 5: "❓"}


@dataclass
class Attachment:
    filename: str | None  # path on the phone, e.g. ~/Library/SMS/Attachments/ab/11/<guid>/IMG_0001.HEIC
    mime: str | None
    name: str
    size: int | None
    exported: str | None = None  # path relative to the export folder, once copied

    @property
    def kind(self):
        mime = (self.mime or "").lower()
        name = self.name.lower()
        if mime.startswith("image/") or name.endswith((".heic", ".jpg", ".jpeg", ".png", ".gif")):
            return "image"
        if mime.startswith("video/") or name.endswith((".mov", ".mp4", ".m4v")):
            return "video"
        if mime.startswith("audio/") or name.endswith((".caf", ".m4a", ".amr", ".mp3")):
            return "audio"
        return "file"


@dataclass
class Message:
    guid: str
    date: object
    from_me: bool
    sender: str  # display label: "Me", a contact name, or the raw handle
    sender_handle: str | None
    text: str
    service: str
    attachments: list = field(default_factory=list)
    reactions: dict = field(default_factory=dict)  # sender label -> emoji
    edited: bool = False
    unsent: bool = False
    system: bool = False
    reply_to: str | None = None


@dataclass
class Conversation:
    key: str
    title: str
    participants: list  # raw handles
    is_group: bool
    services: set = field(default_factory=set)
    messages: list = field(default_factory=list)

    @property
    def last_date(self):
        return self.messages[-1].date if self.messages else None


def _columns(conn, table):
    return {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}


def _col(available, name, alias=None):
    return f"m.{name}" if name in available else f"NULL AS {alias or name}"


def _target_guid(assoc):
    # "p:0/GUID" (part 0 of a message) or "bp:GUID"
    if not assoc:
        return None
    if "/" in assoc:
        return assoc.split("/", 1)[1]
    if assoc.startswith("bp:"):
        return assoc[3:]
    return assoc


def load(db_path, contacts=None, since=None):
    contacts = contacts or contacts_mod.Contacts()
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        return _load(conn, contacts, since)
    finally:
        conn.close()


def _load(conn, contacts, since):
    handles = {r["ROWID"]: r["id"] for r in conn.execute("SELECT ROWID, id FROM handle")}

    chat_cols = _columns(conn, "chat")
    chats = {}
    for r in conn.execute(
        "SELECT ROWID, guid, chat_identifier, "
        + ("display_name" if "display_name" in chat_cols else "NULL AS display_name")
        + ", service_name FROM chat"
    ):
        chats[r["ROWID"]] = dict(r)
    members = {}
    for r in conn.execute("SELECT chat_id, handle_id FROM chat_handle_join"):
        if r["handle_id"] in handles:
            members.setdefault(r["chat_id"], []).append(handles[r["handle_id"]])

    attachments = {}
    for r in conn.execute(
        "SELECT maj.message_id, a.filename, a.mime_type, a.transfer_name, a.total_bytes "
        "FROM message_attachment_join maj JOIN attachment a ON a.ROWID = maj.attachment_id "
        "ORDER BY maj.message_id, a.ROWID"
    ):
        name = r["transfer_name"] or (r["filename"] or "attachment").rsplit("/", 1)[-1]
        attachments.setdefault(r["message_id"], []).append(
            Attachment(r["filename"], r["mime_type"], name, r["total_bytes"])
        )

    mc = _columns(conn, "message")
    select = ", ".join([
        "m.ROWID AS rowid", "m.guid", "m.text", _col(mc, "attributedBody"), "m.handle_id", "m.service",
        "m.date", "m.is_from_me", _col(mc, "associated_message_type"), _col(mc, "associated_message_guid"),
        _col(mc, "associated_message_emoji"), _col(mc, "date_edited"), _col(mc, "date_retracted"),
        _col(mc, "item_type"), _col(mc, "group_title"), _col(mc, "group_action_type"),
        _col(mc, "other_handle"), _col(mc, "thread_originator_guid"), "cmj.chat_id",
    ])
    where, params = "", ()
    if since is not None:
        secs = to_apple_seconds(since)
        # date is seconds before iOS 11 and nanoseconds after; accept either.
        where, params = "WHERE (m.date >= ? AND m.date < 1e11) OR m.date >= ?", (secs, secs * 1e9)
    rows = conn.execute(
        f"SELECT {select} FROM message m JOIN chat_message_join cmj ON cmj.message_id = m.ROWID "
        f"{where} ORDER BY m.date, m.ROWID",
        params,
    ).fetchall()

    def who(handle_id, from_me):
        if from_me:
            return "Me", None
        h = handles.get(handle_id)
        return contacts.label(h), h

    # Merge chats that are really the same people (iMessage and SMS threads with one person
    # are separate chat rows on the phone).
    convo_for_chat, convos = {}, {}
    for chat_id, chat in chats.items():
        people = members.get(chat_id, []) or [chat["chat_identifier"]]
        name = chat["display_name"]
        key = chat["guid"] if name else "|".join(sorted({contacts_mod.normalize(p) for p in people}))
        if key not in convos:
            title = name or ", ".join(contacts.label(p) for p in people)
            convos[key] = Conversation(key=key, title=title, participants=people, is_group=len(people) > 1)
        convo_for_chat[chat_id] = convos[key]

    by_guid = {}
    reactions = []  # applied after every message is known
    for r in rows:
        convo = convo_for_chat.get(r["chat_id"])
        if convo is None:
            continue
        assoc_type = r["associated_message_type"] or 0
        sender, sender_handle = who(r["handle_id"], r["is_from_me"])
        if 2000 <= assoc_type <= 2006 or 3000 <= assoc_type <= 3006:
            emoji = r["associated_message_emoji"] or TAPBACKS.get(assoc_type % 1000, "•")
            reactions.append((_target_guid(r["associated_message_guid"]), sender, emoji, assoc_type >= 3000))
            continue

        text = r["text"]
        if not text:
            text = attributed_body_text(r["attributedBody"]) or ""
        text = text.replace("￼", "").strip()

        system = False
        item_type = r["item_type"] or 0
        if item_type == 1:
            other = contacts.label(handles.get(r["other_handle"])) if r["other_handle"] else "someone"
            verb = "removed" if r["group_action_type"] == 1 else "added"
            text, system = f"{sender} {verb} {other}", True
        elif item_type == 2 and r["group_title"]:
            text, system = f"{sender} named the conversation “{r['group_title']}”", True
        elif item_type == 3:
            text, system = f"{sender} left the conversation", True
        elif item_type != 0:
            continue  # other bookkeeping rows (location sharing, group photo, etc.)

        msg = Message(
            guid=r["guid"],
            date=from_apple(r["date"]),
            from_me=bool(r["is_from_me"]),
            sender=sender,
            sender_handle=sender_handle,
            text=text,
            service=r["service"] or "",
            attachments=attachments.get(r["rowid"], []),
            edited=bool(r["date_edited"]),
            unsent=bool(r["date_retracted"]),
            system=system,
            reply_to=r["thread_originator_guid"],
        )
        if not (msg.text or msg.attachments or msg.unsent or msg.system):
            continue
        convo.messages.append(msg)
        convo.services.add(msg.service)
        by_guid[msg.guid] = msg

    for target, sender, emoji, removed in reactions:
        msg = by_guid.get(target)
        if msg is None:
            continue
        if removed:
            msg.reactions.pop(sender, None)
        else:
            msg.reactions[sender] = emoji

    result = [c for c in convos.values() if c.messages]
    for c in result:
        c.messages.sort(key=lambda m: m.date.timestamp() if m.date else 0)
    result.sort(key=lambda c: c.last_date.timestamp() if c.last_date else 0, reverse=True)
    return result
