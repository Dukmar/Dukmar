"""Read conversations out of sms.db (iPhone) or chat.db (Mac) - the two share one schema."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field

from . import contacts as contacts_mod
from .decode import attributed_body_text, edit_history
from .timeutil import from_apple, to_apple_seconds

TAPBACKS = {0: "❤️", 1: "\U0001F44D", 2: "\U0001F44E", 3: "\U0001F602", 4: "‼️", 5: "❓"}

EFFECTS = {
    "com.apple.MobileSMS.expressivesend.impact": "Slam",
    "com.apple.MobileSMS.expressivesend.loud": "Loud",
    "com.apple.MobileSMS.expressivesend.gentle": "Gentle",
    "com.apple.MobileSMS.expressivesend.invisibleink": "Invisible Ink",
    "com.apple.messages.effect.CKConfettiEffect": "Confetti",
    "com.apple.messages.effect.CKEchoEffect": "Echo",
    "com.apple.messages.effect.CKFireworksEffect": "Fireworks",
    "com.apple.messages.effect.CKHappyBirthdayEffect": "Balloons",
    "com.apple.messages.effect.CKHeartEffect": "Love",
    "com.apple.messages.effect.CKLasersEffect": "Lasers",
    "com.apple.messages.effect.CKShootingStarEffect": "Shooting Star",
    "com.apple.messages.effect.CKSparklesEffect": "Celebration",
    "com.apple.messages.effect.CKSpotlightEffect": "Spotlight",
}

# Labels for "balloon" messages that carry no text of their own.
APP_MESSAGES = {
    "com.apple.PassbookUIService.PeerPaymentMessagesExtension": "Apple Cash payment",
    "com.apple.Handwriting.HandwritingProvider": "Handwritten message",
    "com.apple.DigitalTouchBalloonProvider": "Digital Touch message",
    "com.apple.messages.MSMessageExtensionBalloonPlugin:0000000000:com.apple.SafetyMonitorApp.SafetyMonitorMessages": "Check In",
    "com.apple.findmy.FindMyMessagesApp": "Find My location",
    "com.apple.mobileslideshow.PhotosMessagesApp": "Photos",
}


@dataclass
class Attachment:
    filename: str | None  # path on the phone, e.g. ~/Library/SMS/Attachments/ab/11/<guid>/IMG_0001.HEIC
    mime: str | None
    name: str
    size: int | None
    exported: str | None = None  # path relative to the Messages folder, once copied

    @property
    def kind(self):
        mime = (self.mime or "").lower()
        name = (self.exported or self.name).lower()
        if mime.startswith("image/") or name.endswith((".heic", ".jpg", ".jpeg", ".png", ".gif", ".webp")):
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
    edits: list = field(default_factory=list)  # [(datetime, text)] oldest first, when the phone kept them
    unsent: bool = False
    deleted_at: object = None  # set for messages sitting in Recently Deleted
    system: bool = False
    reply_to: str | None = None  # guid of the message this replies to
    reply_preview: str = ""
    delivered_at: object = None
    read_at: object = None
    effect: str = ""
    app: str = ""


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


def _col(available, name):
    return f"m.{name}" if name in available else f"NULL AS {name}"


def _target_guid(assoc):
    # "p:0/GUID" (part 0 of a message) or "bp:GUID"
    if not assoc:
        return None
    if "/" in assoc:
        return assoc.split("/", 1)[1]
    if assoc.startswith("bp:"):
        return assoc[3:]
    return assoc


def _app_label(bundle):
    if not bundle or bundle == "com.apple.messages.URLBalloonProvider":
        return ""
    if bundle in APP_MESSAGES:
        return APP_MESSAGES[bundle]
    # Third-party iMessage apps: "com.apple.messages.MSMessageExtensionBalloonPlugin:<team>:<bundle id>"
    return "App message (" + bundle.rsplit(":", 1)[-1].rsplit(".", 1)[-1] + ")"


def _date_filter(column, since, until):
    """SQL for since/until on a column that holds seconds (before iOS 11) or nanoseconds (after)."""
    clauses, params = [], []
    for bound, op in ((since, ">="), (until, "<")):
        if bound is None:
            continue
        secs = to_apple_seconds(bound)
        clauses.append(f"((m.{column} < 1e11 AND m.{column} {op} ?) OR (m.{column} >= 1e11 AND m.{column} {op} ?))")
        params += [secs, secs * 1e9]
    return clauses, params


def matches_filter(convo, terms, contacts):
    """--contact: keep a conversation if any participant matches a name, number or email."""
    for term in terms:
        t = term.strip().lower()
        if not t:
            continue
        key = contacts_mod.normalize(term)
        for p in convo.participants:
            if contacts_mod.normalize(p) == key or t in contacts.label(p).lower() or t in (p or "").lower():
                return True
        if t in convo.title.lower():
            return True
    return False


def load(db_path, contacts=None, since=None, until=None, me="Me", contact_filter=None):
    contacts = contacts or contacts_mod.Contacts()
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        convos = _load(conn, contacts, since, until, me)
    finally:
        conn.close()
    if contact_filter:
        convos = [c for c in convos if matches_filter(c, contact_filter, contacts)]
    return convos


def _load(conn, contacts, since, until, me):
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
        "m.ROWID AS rowid", "m.guid", "m.text", "m.handle_id", "m.service", "m.date", "m.is_from_me",
        *(_col(mc, c) for c in (
            "attributedBody", "associated_message_type", "associated_message_guid", "associated_message_emoji",
            "date_edited", "date_retracted", "date_read", "date_delivered", "item_type", "group_title",
            "group_action_type", "other_handle", "thread_originator_guid", "expressive_send_style_id",
            "balloon_bundle_id", "message_summary_info",
        )),
        "j.chat_id", "j.deleted_at",
    ])
    # Messages in "Recently Deleted" (iOS 16+) move from chat_message_join to chat_recoverable_message_join.
    joins = "SELECT chat_id, message_id, NULL AS deleted_at FROM chat_message_join"
    tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    if "chat_recoverable_message_join" in tables:
        joins += " UNION ALL SELECT chat_id, message_id, delete_date FROM chat_recoverable_message_join"
    clauses, params = _date_filter("date", since, until)
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    rows = conn.execute(
        f"SELECT {select} FROM message m JOIN ({joins}) j ON j.message_id = m.ROWID "
        f"{where} ORDER BY m.date, m.ROWID",
        params,
    ).fetchall()

    def who(handle_id, from_me):
        if from_me:
            return me, None
        h = handles.get(handle_id)
        return contacts.label(h), h

    # Merge chats that are really the same people: iMessage and SMS threads with one person are separate
    # chat rows on the phone, and so are a person's number and email when one contact card holds both.
    convo_for_chat, convos = {}, {}
    for chat_id, chat in chats.items():
        people = members.get(chat_id, []) or [chat["chat_identifier"]]
        name = chat["display_name"]
        key = chat["guid"] if name else "|".join(sorted({contacts.person_for(p) for p in people}))
        if key not in convos:
            title = name or ", ".join(contacts.label(p) for p in people)
            convos[key] = Conversation(key=key, title=title, participants=list(people), is_group=len(people) > 1)
        else:
            for p in people:
                if p not in convos[key].participants:
                    convos[key].participants.append(p)
        convo_for_chat[chat_id] = convos[key]

    by_guid = {}
    reactions = []  # applied after every message is known
    for r in rows:
        convo = convo_for_chat.get(r["chat_id"])
        if convo is None or r["guid"] in by_guid:
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

        edits = [(from_apple(d), t) for d, t in edit_history(r["message_summary_info"])]
        msg = Message(
            guid=r["guid"],
            date=from_apple(r["date"]),
            from_me=bool(r["is_from_me"]),
            sender=sender,
            sender_handle=sender_handle,
            text=text,
            service=r["service"] or "",
            attachments=attachments.get(r["rowid"], []),
            edited=bool(r["date_edited"]) or len(edits) > 1,
            edits=edits if len(edits) > 1 else [],
            unsent=bool(r["date_retracted"]),
            deleted_at=from_apple(r["deleted_at"]) if r["deleted_at"] else None,
            system=system,
            reply_to=r["thread_originator_guid"],
            delivered_at=from_apple(r["date_delivered"]),
            read_at=from_apple(r["date_read"]),
            effect=EFFECTS.get(r["expressive_send_style_id"] or "", ""),
            app=_app_label(r["balloon_bundle_id"]),
        )
        if not (msg.text or msg.attachments or msg.unsent or msg.system or msg.app):
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

    for msg in by_guid.values():
        parent = by_guid.get(msg.reply_to) if msg.reply_to else None
        if parent is not None:
            snippet = parent.text or (parent.attachments[0].name if parent.attachments else "")
            msg.reply_preview = f"{parent.sender}: {snippet[:120]}"
        elif msg.reply_to:
            msg.reply_to = None  # parent isn't in this export (date filter); don't show a dead link

    result = [c for c in convos.values() if c.messages]
    for c in result:
        c.messages.sort(key=lambda m: m.date.timestamp() if m.date else 0)
    result.sort(key=lambda c: c.last_date.timestamp() if c.last_date else 0, reverse=True)
    return result
