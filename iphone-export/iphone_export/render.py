"""Write the export folder: an index page, one HTML + TXT file per conversation, and CSVs."""

from __future__ import annotations

import csv
import hashlib
import html
import json
import re
import shutil
import subprocess
from pathlib import Path

from .timeutil import fmt

CSS = """
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6e6e73;--line:#e5e5ea;--them:#e9e9eb;--them-fg:#1d1d1f;
--imsg:#0a84ff;--sms:#30b94d;--card:#f5f5f7}
@media (prefers-color-scheme:dark){:root{--bg:#000;--fg:#f5f5f7;--muted:#98989d;--line:#2c2c2e;
--them:#26252a;--them-fg:#f5f5f7;--card:#1c1c1e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;z-index:2}
header h1{font-size:18px;margin:0 0 2px}
header p{margin:0;color:var(--muted);font-size:13px}
header input{margin-top:8px;width:100%;max-width:420px;padding:7px 10px;border:1px solid var(--line);
border-radius:8px;background:var(--card);color:var(--fg);font-size:14px}
main{max-width:760px;margin:0 auto;padding:8px 16px 48px}
a{color:var(--imsg)}
.day{text-align:center;color:var(--muted);font-size:12px;margin:18px 0 6px}
.row{display:flex;flex-direction:column;align-items:flex-start;margin:2px 0}
.row.me{align-items:flex-end}
.who{font-size:11px;color:var(--muted);margin:6px 12px 1px}
.b{max-width:75%;padding:7px 12px;border-radius:18px;background:var(--them);color:var(--them-fg);
white-space:pre-wrap;overflow-wrap:anywhere}
.me .b{background:var(--imsg);color:#fff}
.me.sms .b{background:var(--sms)}
.me .b a{color:#fff}
.b img,.b video,.b audio{display:block;max-width:100%;max-height:420px;border-radius:12px;margin:4px 0}
.b .t+.att,.b .att+.t{margin-top:6px}
.meta{font-size:11px;color:var(--muted);margin:1px 12px}
.sys{text-align:center;color:var(--muted);font-size:12px;margin:8px 0}
.unsent{font-style:italic;opacity:.7}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.title{max-width:0;width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:12px 0 20px}
.card{background:var(--card);border-radius:12px;padding:12px 14px;min-height:72px;color:inherit;text-decoration:none}
a.card b{color:var(--imsg)}
a.card:hover{outline:2px solid var(--imsg)}
.card b{display:block;font-size:22px}
.card span{color:var(--muted);font-size:13px}
details{border-bottom:1px solid var(--line);padding:8px 0}
summary{cursor:pointer}
details pre{white-space:pre-wrap;font:inherit;margin:8px 0 0}
h2{font-size:16px;margin:24px 0 6px}
"""

SEARCH_JS = """
<script>
const q=document.getElementById('q');
if(q){q.addEventListener('input',()=>{const t=q.value.toLowerCase();
document.querySelectorAll('[data-s]').forEach(e=>{e.style.display=!t||e.dataset.s.includes(t)?'':'none'})})}
</script>
"""

URL_RE = re.compile(r"(https?://[^\s<]+)")


def _esc(s):
    return html.escape(s or "", quote=True)


def _linkify(escaped):
    return URL_RE.sub(lambda m: f'<a href="{m.group(1)}">{m.group(1)}</a>', escaped)


def _page(title, subtitle, body, search_placeholder=None):
    search = (
        f'<input id="q" type="search" placeholder="{_esc(search_placeholder)}" autocomplete="off">'
        if search_placeholder else ""
    )
    return (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
        f"<title>{_esc(title)}</title><style>{CSS}</style></head><body>"
        f"<header><h1>{_esc(title)}</h1><p>{subtitle}</p>{search}</header>"
        f"<main>{body}</main>{SEARCH_JS if search_placeholder else ''}</body></html>"
    )


def safe_name(name, used):
    base = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name).strip(" .") or "Untitled"
    base = base[:80]
    candidate, n = base, 2
    while candidate.lower() in used:
        candidate, n = f"{base} ({n})", n + 1
    used.add(candidate.lower())
    return candidate


class Exporter:
    def __init__(self, out_dir, source, attachments=True, convert_heic=False, log=print):
        self.out = Path(out_dir)
        self.source = source
        self.attachments = attachments
        self.convert_heic = convert_heic and shutil.which("sips") is not None
        self.log = log
        self.stats = {}

    # ------------------------------------------------------------------ messages

    def _copy_attachment(self, att, folder):
        if not att.filename:
            return None
        tag = hashlib.sha1(att.filename.encode()).hexdigest()[:8]
        dest = folder / f"{tag}_{safe_name(att.name, set())}"
        if self.convert_heic and dest.suffix.lower() == ".heic":
            jpg = dest.with_suffix(".jpg")
            if jpg.exists() and jpg.stat().st_size:
                return jpg
        if not (dest.exists() and dest.stat().st_size):
            if not self.source.fetch_attachment(att.filename, dest):
                return None
        if self.convert_heic and dest.suffix.lower() == ".heic":
            jpg = dest.with_suffix(".jpg")
            done = subprocess.run(["sips", "-s", "format", "jpeg", str(dest), "--out", str(jpg)],
                                  capture_output=True).returncode == 0
            if done:
                dest.unlink()
                return jpg
        return dest

    def write_messages(self, conversations):
        msg_dir = self.out / "Messages"
        msg_dir.mkdir(parents=True, exist_ok=True)
        used, rows, index = set(), [], []
        copied = missing = 0
        for convo in conversations:
            name = safe_name(convo.title, used)
            att_dir = msg_dir / "attachments" / name
            if self.attachments:
                for m in convo.messages:
                    for a in m.attachments:
                        path = self._copy_attachment(a, att_dir)
                        if path:
                            a.exported = path.relative_to(msg_dir).as_posix()
                            copied += 1
                        else:
                            missing += 1
            (msg_dir / f"{name}.html").write_text(self._conversation_html(convo), encoding="utf-8")
            (msg_dir / f"{name}.txt").write_text(self._conversation_txt(convo), encoding="utf-8")
            index.append((convo, name))
            for m in convo.messages:
                rows.append([
                    convo.title, fmt(m.date, True), m.sender, m.sender_handle or "", "yes" if m.from_me else "",
                    m.service, "(unsent)" if m.unsent else m.text, "; ".join(a.name for a in m.attachments),
                    " ".join(f"{k}:{v}" for k, v in m.reactions.items()),
                ])
        with open(self.out / "messages.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["conversation", "date", "sender", "sender_handle", "from_me", "service", "text",
                        "attachments", "reactions"])
            w.writerows(rows)
        self.stats["conversations"] = len(conversations)
        self.stats["messages"] = len(rows)
        self.stats["attachments_copied"] = copied
        self.stats["attachments_missing"] = missing
        return index

    def _conversation_html(self, convo):
        parts, last_day = [], None
        for m in convo.messages:
            day = m.date.strftime("%A, %B %-d, %Y") if m.date else "Unknown date"
            if day != last_day:
                parts.append(f'<div class="day">{_esc(day)}</div>')
                last_day = day
            search = _esc(f"{m.sender} {m.text}".lower())
            if m.system:
                parts.append(f'<div class="sys" data-s="{search}">{_esc(m.text)} · {fmt(m.date)}</div>')
                continue
            cls = "row me" if m.from_me else "row"
            if m.service.upper() in ("SMS", "RCS", "MMS"):
                cls += " sms"
            inner = []
            if m.unsent:
                inner.append('<span class="unsent">This message was unsent</span>')
            elif m.text:
                inner.append(f'<div class="t">{_linkify(_esc(m.text))}</div>')
            for a in m.attachments:
                inner.append(f'<div class="att">{self._attachment_html(a)}</div>')
            who = f'<div class="who">{_esc(m.sender)}</div>' if convo.is_group and not m.from_me else ""
            meta = [m.date.strftime("%-I:%M %p") if m.date else ""]
            if m.edited and not m.unsent:
                meta.append("Edited")
            if m.reactions:
                meta.append(" ".join(f"{v} {_esc(k)}" for k, v in m.reactions.items()))
            parts.append(
                f'<div class="{cls}" data-s="{search}">{who}<div class="b">{"".join(inner)}</div>'
                f'<div class="meta">{" · ".join(meta)}</div></div>'
            )
        first, last = convo.messages[0].date, convo.messages[-1].date
        people = ", ".join(_esc(p) for p in convo.participants)
        subtitle = f"{len(convo.messages):,} messages · {fmt(first)} to {fmt(last)} · {people}"
        return _page(convo.title, subtitle, "".join(parts), "Search this conversation")

    def _attachment_html(self, a):
        if not a.exported:
            return f'<div class="meta">[{_esc(a.name)} — not in backup]</div>'
        href = _esc(a.exported)
        if a.kind == "image" or href.lower().endswith(".jpg"):
            # Chrome and Firefox can't show HEIC; fall back to a link (Safari shows it, or use --convert-heic).
            label = json.dumps("\U0001F5BC " + a.name)
            fallback = f"this.replaceWith(Object.assign(document.createElement('span'),{{textContent:{label}}}))"
            return (f'<a href="{href}"><img src="{href}" alt="{_esc(a.name)}" loading="lazy" '
                    f'onerror="{_esc(fallback)}"></a>')
        if a.kind == "video":
            return f'<video src="{href}" controls preload="none"></video>'
        if a.kind == "audio":
            return f'<audio src="{href}" controls preload="none"></audio>'
        return f'<a href="{href}">\U0001F4CE {_esc(a.name)}</a>'

    def _conversation_txt(self, convo):
        lines = [convo.title, ", ".join(convo.participants), ""]
        for m in convo.messages:
            body = "(unsent)" if m.unsent else m.text
            extras = [f"[attachment: {a.name}]" for a in m.attachments]
            if m.edited and not m.unsent:
                extras.append("(edited)")
            if m.reactions:
                extras.append("(" + ", ".join(f"{k} {v}" for k, v in m.reactions.items()) + ")")
            sender = "--" if m.system else m.sender
            lines.append(f"[{fmt(m.date)}] {sender}: {' '.join(p for p in [body] + extras if p)}")
        return "\n".join(lines) + "\n"

    # ------------------------------------------------------------------ calls

    def write_calls(self, calls):
        with open(self.out / "calls.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["date", "direction", "type", "name", "number", "duration_seconds", "location"])
            for c in calls:
                w.writerow([fmt(c.date, True), c.direction, c.kind, c.name, c.number, c.duration, c.location])
        rows = []
        for c in calls:
            mins, secs = divmod(c.duration, 60)
            dur = f"{mins}:{secs:02d}" if c.duration else ""
            search = _esc(f"{c.name} {c.number} {c.direction} {c.kind}".lower())
            rows.append(
                f'<tr data-s="{search}"><td>{fmt(c.date)}</td><td>{_esc(c.name or c.number)}'
                f'<br><small>{_esc(c.number) if c.name else "&nbsp;"}</small></td>'
                f"<td>{_esc(c.direction)}</td><td>{_esc(c.kind)}</td><td class=\"n\">{dur}</td></tr>"
            )
        body = ("<table><thead><tr><th>When</th><th>Who</th><th>Direction</th><th>Type</th>"
                "<th>Length</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table>")
        (self.out / "calls.html").write_text(
            _page("Call history", f"{len(calls):,} calls", body, "Search calls"), encoding="utf-8")
        self.stats["calls"] = len(calls)

    # ------------------------------------------------------------------ notes

    def write_notes(self, notes):
        notes_dir = self.out / "Notes"
        notes_dir.mkdir(parents=True, exist_ok=True)
        used_by_folder, items = {}, []
        for n in notes:
            folder = safe_name(n.folder, set())
            name = safe_name(n.title, used_by_folder.setdefault(folder, set()))
            path = notes_dir / folder / f"{name}.txt"
            path.parent.mkdir(parents=True, exist_ok=True)
            body = "(This note is locked with a password and can't be exported.)" if n.locked else n.text
            path.write_text(f"{n.title}\nCreated: {fmt(n.created)}\nModified: {fmt(n.modified)}\n\n{body}\n",
                            encoding="utf-8")
            search = _esc(f"{n.title} {n.folder} {n.text}".lower())
            items.append(
                f'<details data-s="{search}"><summary><b>{_esc(n.title)}</b> '
                f'<span class="meta">{_esc(n.folder)} · {fmt(n.modified)}</span></summary>'
                f"<pre>{_linkify(_esc(body))}</pre></details>"
            )
        (self.out / "notes.html").write_text(
            _page("Notes", f"{len(notes):,} notes", "".join(items), "Search notes"), encoding="utf-8")
        self.stats["notes"] = len(notes)

    # ------------------------------------------------------------------ index

    def write_index(self, convo_index, source_label, generated, problems):
        cards = []
        for key, label, href in (("messages", "messages", None), ("conversations", "conversations", None),
                                 ("calls", "calls", "calls.html"), ("notes", "notes", "notes.html")):
            if key in self.stats:
                value = f"{self.stats[key]:,}"
                inner = f"<b>{value}</b><span>{label}</span>"
                cards.append(f'<a class="card" href="{href}">{inner}</a>' if href else f'<div class="card">{inner}</div>')
        body = [f'<div class="cards">{"".join(cards)}</div>']
        if problems:
            body.append("<h2>Heads-up</h2><ul>" + "".join(f"<li>{_esc(p)}</li>" for p in problems) + "</ul>")
        if convo_index:
            body.append("<h2>Conversations</h2><table><thead><tr><th>Conversation</th><th class=\"n\">Messages</th>"
                        "<th>Last message</th></tr></thead><tbody>")
            for convo, name in convo_index:
                search = _esc(f"{convo.title} {' '.join(convo.participants)}".lower())
                href = _esc("Messages/" + name + ".html")
                body.append(
                    f'<tr data-s="{search}"><td class="title"><a href="{href}" title="{_esc(convo.title)}">{_esc(convo.title)}</a></td>'
                    f'<td class="n">{len(convo.messages):,}</td><td>{fmt(convo.last_date)}</td></tr>'
                )
            body.append("</tbody></table>")
        subtitle = f"From {_esc(source_label)} · exported {fmt(generated)}"
        (self.out / "index.html").write_text(
            _page("iPhone export", subtitle, "".join(body), "Find a conversation"), encoding="utf-8")
