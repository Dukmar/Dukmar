"""Small decoders for the two binary formats Apple hides text in.

- Messages (iOS 16+) often leaves `message.text` empty and keeps the words in `attributedBody`,
  an NSAttributedString serialised with Apple's old "typedstream" format.
- Notes keeps each note body as a gzipped protobuf in `ZICNOTEDATA.ZDATA`.
"""

import gzip
import plistlib
import zlib

_OBJ_REPLACEMENT = "￼"  # what Notes and Messages put where an inline attachment sits


def attributed_body_text(blob):
    """Pull the plain string out of a typedstream NSAttributedString blob, or return None.

    Layout after the class name: b"NSString" 0x01 0x94 0x84 0x01 b"+" <length> <utf-8 bytes>.
    Length is one byte, or 0x81 + uint16 LE, or 0x82 + uint32 LE (typedstream integer encoding).
    """
    if not blob:
        return None
    blob = bytes(blob)
    start = blob.find(b"NSString")
    if start == -1:
        return None
    plus = blob.find(b"+", start + len(b"NSString"))
    if plus == -1 or plus - start > 16:
        return None
    i = plus + 1
    if i >= len(blob):
        return None
    marker = blob[i]
    if marker == 0x81:
        length, i = int.from_bytes(blob[i + 1:i + 3], "little"), i + 3
    elif marker == 0x82:
        length, i = int.from_bytes(blob[i + 1:i + 5], "little"), i + 5
    else:
        length, i = marker, i + 1
    raw = blob[i:i + length]
    if len(raw) != length:
        # Truncated or misaligned blob: keep what's there, up to typedstream's end-of-object byte.
        raw = raw.split(b"\x86", 1)[0]
    return raw.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------------------------- protobuf

def _varint(buf, i):
    shift = result = 0
    while True:
        if i >= len(buf):
            raise ValueError("truncated varint")
        b = buf[i]
        i += 1
        result |= (b & 0x7F) << shift
        if not b & 0x80:
            return result, i
        shift += 7


def protobuf_fields(buf):
    """Yield (field_number, wire_type, value) for one protobuf message. Length-delimited values are bytes."""
    i = 0
    while i < len(buf):
        key, i = _varint(buf, i)
        field, wire = key >> 3, key & 7
        if wire == 0:
            value, i = _varint(buf, i)
        elif wire == 1:
            value, i = buf[i:i + 8], i + 8
        elif wire == 2:
            length, i = _varint(buf, i)
            value, i = buf[i:i + length], i + length
        elif wire == 5:
            value, i = buf[i:i + 4], i + 4
        else:
            raise ValueError(f"unsupported wire type {wire}")
        yield field, wire, value


def _first(buf, field_number):
    for field, wire, value in protobuf_fields(buf):
        if field == field_number and wire == 2:
            return value
    return None


def note_text(zdata):
    """NoteStoreProto(2: Document(3: Note(2: note_text))). Returns the note's plain text or None."""
    if not zdata:
        return None
    data = bytes(zdata)
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    elif data[:1] == b"\x78":
        data = zlib.decompress(data)
    try:
        document = _first(data, 2)
        note = _first(document, 3) if document is not None else None
        text = _first(note, 2) if note is not None else None
    except ValueError:
        return None
    if text is None:
        return None
    return text.decode("utf-8", errors="replace").replace(_OBJ_REPLACEMENT, "[attachment]")


# --------------------------------------------------------------------------------------------- edit history

def edit_history(summary_info):
    """Earlier versions of an edited iMessage, from message.message_summary_info.

    That column is a binary plist. Its "ec" key maps each message part ("0", "1", ...) to a list of
    versions, oldest first, each {"t": typedstream text, "d": seconds since 2001}.
    Returns [(apple_seconds, text), ...] in order, or [] when there's no history.
    """
    if not summary_info:
        return []
    try:
        info = plistlib.loads(bytes(summary_info))
    except Exception:
        return []
    edits = info.get("ec") if isinstance(info, dict) else None
    if not isinstance(edits, dict):
        return []
    versions = []
    for part in sorted(edits, key=lambda k: int(k) if str(k).isdigit() else 0):
        for event in edits[part] or []:
            if not isinstance(event, dict):
                continue
            text = attributed_body_text(event.get("t"))
            if text is not None:
                versions.append((event.get("d"), text.replace(_OBJ_REPLACEMENT, "").strip()))
    return versions
