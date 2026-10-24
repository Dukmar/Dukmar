"""Write the export folder: index, conversations (HTML + TXT), search, photos, calls, voicemail, notes,
contacts, and CSVs. Every page is self-contained and prints cleanly (header, page numbers, export details).
"""

from __future__ import annotations

import csv
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from . import events
from .timeutil import fmt

CSS = """
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6e6e73;--line:#e5e5ea;--them:#e9e9eb;--them-fg:#1d1d1f;
--imsg:#0a84ff;--sms:#30b94d;--card:#f5f5f7;--warn:#b25000;--mark:#ffe58a}
@media (prefers-color-scheme:dark){:root{--bg:#000;--fg:#f5f5f7;--muted:#98989d;--line:#2c2c2e;
--them:#26252a;--them-fg:#f5f5f7;--card:#1c1c1e;--warn:#ff9f0a;--mark:#6b5800}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;z-index:2}
header h1{font-size:18px;margin:0 0 2px}
header p{margin:0;color:var(--muted);font-size:13px}
header nav{margin-top:4px;font-size:13px}
header nav a{margin-right:12px}
header input{margin-top:8px;width:100%;max-width:420px;padding:7px 10px;border:1px solid var(--line);
border-radius:8px;background:var(--card);color:var(--fg);font-size:14px}
main{max-width:760px;margin:0 auto;padding:8px 16px 48px}
main.wide{max-width:1100px}
a{color:var(--imsg)}
mark{background:var(--mark);color:inherit}
.day{text-align:center;color:var(--muted);font-size:12px;margin:18px 0 6px}
.row{display:flex;flex-direction:column;align-items:flex-start;margin:2px 0;scroll-margin-top:120px}
.row.me{align-items:flex-end}
.row:target .b{outline:3px solid var(--mark)}
.who{font-size:11px;color:var(--muted);margin:6px 12px 1px}
.b{max-width:75%;padding:7px 12px;border-radius:18px;background:var(--them);color:var(--them-fg);
white-space:pre-wrap;overflow-wrap:anywhere}
.me .b{background:var(--imsg);color:#fff}
.me.sms .b{background:var(--sms)}
.me .b a{color:#fff}
.b img,.b video,.b audio{display:block;max-width:100%;max-height:420px;border-radius:12px;margin:4px 0}
.b .t+.att,.b .att+.t,.b .att+.att{margin-top:6px}
.b .app{font-style:italic;opacity:.85}
.reply{display:block;font-size:12px;color:var(--muted);margin:4px 12px 2px;max-width:70%;
white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none;border-left:2px solid var(--line);padding-left:6px}
.meta{font-size:11px;color:var(--muted);margin:1px 12px}
.meta details{display:inline;border:0;padding:0}
.meta summary{display:inline;list-style:none;text-decoration:underline dotted}
.meta summary::-webkit-details-marker{display:none}
.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
td.aud div{height:64px}
td.aud audio{width:240px;max-width:100%;height:40px;display:block}
.meta details ol{margin:4px 0;padding-left:18px;text-align:left}
.deleted .b{border:2px dashed var(--warn)}
.tag{color:var(--warn);font-weight:600}
.sys{text-align:center;color:var(--muted);font-size:12px;margin:8px 0}
.unsent{font-style:italic;opacity:.7}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600}
td small{color:var(--muted)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.clip{max-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
td.title{width:60%}
td.two{min-width:220px}
td.two div{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:2.8em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0 20px}
.card{background:var(--card);border-radius:12px;padding:12px 14px;min-height:72px;color:inherit;text-decoration:none}
a.card b{color:var(--imsg)}
a.card:hover{outline:2px solid var(--imsg)}
.card b{display:block;font-size:22px}
.card span{color:var(--muted);font-size:13px}
details{border-bottom:1px solid var(--line);padding:8px 0}
summary{cursor:pointer}
details pre{white-space:pre-wrap;font:inherit;margin:8px 0 0}
h2{font-size:16px;margin:24px 0 6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.tile{display:block;color:inherit;text-decoration:none;background:var(--card);border-radius:10px;overflow:hidden}
.tile .pic{display:flex;align-items:center;justify-content:center;height:150px;overflow:hidden;font-size:12px;
color:var(--muted);text-align:center;padding:0}
.tile .pic img,.tile .pic video{width:100%;height:150px;object-fit:cover;display:block}
.tile .cap{font-size:11px;padding:4px 6px;height:34px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tile .cap small{display:block;color:var(--muted)}
.hit{display:block;padding:8px 0;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;min-height:58px}
.hit small{color:var(--muted);display:block}
.hit span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media print{
  header{position:static;border:0;padding:0 0 8px}
  header input,header nav,.noprint{display:none}
  body{background:#fff;color:#000}
  .b,.tag,mark{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .row,.sys,tr,.hit{break-inside:avoid}
  .day{break-after:avoid}
  main{max-width:none;padding:0}
  a{color:inherit}
}
"""

SEARCH_JS = """
<script>
const q=document.getElementById('q');
if(q){q.addEventListener('input',()=>{const t=q.value.toLowerCase();
document.querySelectorAll('[data-s]').forEach(e=>{e.style.display=!t||e.dataset.s.includes(t)?'':'none'})})}
</script>
"""

URL_RE = re.compile(r"(https?://[^\s<]+)")
NAV = (("index.html", "Conversations"), ("search.html", "Search all"), ("photos.html", "Photos"),
       ("calls.html", "Calls"), ("voicemail.html", "Voicemail"), ("notes.html", "Notes"),
       ("contacts.html", "Contacts"))


def _esc(s):
    return html.escape(s or "", quote=True)


def _css_string(s):
    return '"' + (s or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'


def _linkify(escaped):
    return URL_RE.sub(lambda m: f'<a href="{m.group(1)}">{m.group(1)}</a>', escaped)


def anchor(guid):
    return "m-" + hashlib.sha1((guid or "").encode()).hexdigest()[:10]


def _time(dt):
    return dt.strftime("%-I:%M %p") if dt else ""


def safe_name(name, used):
    base = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name).strip(" .") or "Untitled"
    base = base[:80]
    candidate, n = base, 2
    while candidate.lower() in used:
        candidate, n = f"{base} ({n})", n + 1
    used.add(candidate.lower())
    return candidate


class Exporter:
    def __init__(self, out_dir, source, attachments=True, convert_media=False, for_pdf=False,
                 metadata="", ignore_disk=False, log=print):
        self.out = Path(out_dir)
        self.source = source
        self.attachments = attachments
        self.sips = convert_media and shutil.which("sips")
        self.afconvert = convert_media and shutil.which("afconvert")
        self.for_pdf = for_pdf
        self.metadata = metadata
        self.ignore_disk = ignore_disk
        self.log = log
        self.stats = {}
        self.pages = []  # html files that make sense as PDFs
        self.present = set()  # which sections exist, for the nav bar; cli fills it before writing

    def plan(self, sections):
        pages = {"messages": ["search.html"] + (["photos.html"] if self.attachments else []),
                 "calls": ["calls.html"], "voicemail": ["voicemail.html"], "notes": ["notes.html"],
                 "contacts": ["contacts.html"]}
        for s in sections:
            self.present.update(pages.get(s, []))

    # ------------------------------------------------------------------ page shell

    def _page(self, title, subtitle, body, search_placeholder=None, depth=0, wide=False):
        search = (
            f'<input id="q" type="search" placeholder="{_esc(search_placeholder)}" autocomplete="off">'
            if search_placeholder else ""
        )
        up = "../" * depth
        main_open = '<main class="wide">' if wide else "<main>"
        nav = " ".join(f'<a href="{up}{href}">{label}</a>' for href, label in NAV
                       if href == "index.html" or href in self.present)
        # Printed/PDF pages get the title on top and page numbers + export details at the bottom (iMazing-style).
        font = "font-family:-apple-system,Helvetica,Arial,sans-serif;"
        page_css = (
            "@page{size:Letter;margin:16mm 12mm 18mm;"
            f"@top-center{{content:{_css_string(title)};{font}font-size:9pt;color:#666}}"
            f"@bottom-left{{content:{_css_string(self.metadata)};{font}font-size:7.5pt;color:#666}}"
            '@bottom-right{content:"Page " counter(page) " of " counter(pages);' + font + 'font-size:8pt;color:#666}}'
        )
        return (
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            f"<title>{_esc(title)}</title><style>{CSS}{page_css}</style></head><body>"
            f"<header><h1>{_esc(title)}</h1><p>{subtitle}</p><nav>{nav}</nav>{search}</header>"
            f"{main_open}{body}</main>"
            f"{SEARCH_JS if search_placeholder else ''}</body></html>"
        )

    def _write(self, rel, text, pdf=False):
        path = self.out / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        if pdf:
            self.pages.append(path)
        return path

    # ------------------------------------------------------------------ attachments

    def _convert(self, path):
        """HEIC -> JPEG and CAF/AMR -> M4A with the Mac's own tools, so any browser can show them."""
        suffix = path.suffix.lower()
        if self.sips and suffix == ".heic":
            target, cmd = path.with_suffix(".jpg"), [self.sips, "-s", "format", "jpeg", str(path), "--out"]
        elif self.afconvert and suffix in (".caf", ".amr"):
            target, cmd = path.with_suffix(".m4a"), [self.afconvert, "-f", "m4af", "-d", "aac", str(path)]
        else:
            return path
        if subprocess.run(cmd + [str(target)], capture_output=True).returncode == 0 and target.exists():
            path.unlink()
            return target
        return path

    def _converted_name(self, dest):
        suffix = dest.suffix.lower()
        if self.sips and suffix == ".heic":
            return dest.with_suffix(".jpg")
        if self.afconvert and suffix in (".caf", ".amr"):
            return dest.with_suffix(".m4a")
        return dest

    def _copy_attachment(self, att, folder, when):
        if not att.filename:
            return None
        tag = hashlib.sha1(att.filename.encode()).hexdigest()[:8]
        dest = folder / f"{tag}_{safe_name(att.name, set())}"
        final = self._converted_name(dest)
        if final.exists() and final.stat().st_size:
            return final
        if not (dest.exists() and dest.stat().st_size):
            if not self.source.fetch_attachment(att.filename, dest):
                return None
        dest = self._convert(dest)
        if when is not None:
            # Date the file by the message, so Finder and Photos sort it where it belongs.
            ts = when.timestamp()
            os.utime(dest, (ts, ts))
        return dest

    def _check_disk(self, conversations):
        need = sum(a.size or 0 for c in conversations for m in c.messages for a in m.attachments)
        free = shutil.disk_usage(self.out).free
        if need > free * 0.95 and not self.ignore_disk:
            raise RuntimeError(
                f"Attachments need about {need / 1e9:.1f} GB but only {free / 1e9:.1f} GB is free on that drive. "
                "Free some space, use --no-attachments, --out to another drive, or --ignore-disk-warning.")

    # ------------------------------------------------------------------ messages

    def write_messages(self, conversations):
        msg_dir = self.out / "Messages"
        msg_dir.mkdir(parents=True, exist_ok=True)
        if self.attachments:
            self._check_disk(conversations)
        used, rows, index, search, gallery = set(), [], [], [], []
        copied = missing = 0
        total = sum(len(m.attachments) for c in conversations for m in c.messages) if self.attachments else 0
        if total:
            events.stage("attachments", f"Copying {total:,} attachments")
        for ci, convo in enumerate(conversations):
            name = safe_name(convo.title, used)
            att_dir = msg_dir / "attachments" / name
            for m in convo.messages:
                for a in m.attachments:
                    if not self.attachments:
                        continue
                    path = self._copy_attachment(a, att_dir, m.date)
                    if path:
                        a.exported = path.relative_to(msg_dir).as_posix()
                        copied += 1
                        if a.kind in ("image", "video"):
                            gallery.append((m.date, convo.title, name, a, anchor(m.guid)))
                    else:
                        missing += 1
                    if (copied + missing) % 25 == 0 or copied + missing == total:
                        events.progress("attachments", copied + missing, total)
            self._write(f"Messages/{name}.html", self._conversation_html(convo), pdf=True)
            self._write(f"Messages/{name}.txt", self._conversation_txt(convo))
            index.append((convo, name))
            for m in convo.messages:
                rows.append([
                    convo.title, fmt(m.date, True), m.sender, m.sender_handle or "", "yes" if m.from_me else "",
                    m.service, "(unsent)" if m.unsent else m.text, "; ".join(a.name for a in m.attachments),
                    " ".join(f"{k}:{v}" for k, v in m.reactions.items()),
                    fmt(m.delivered_at, True), fmt(m.read_at, True),
                    " | ".join(t for _, t in m.edits[:-1]), m.reply_preview, m.effect, m.app,
                    fmt(m.deleted_at, True),
                ])
                body = m.text or m.app or " ".join(a.name for a in m.attachments)
                if body and not m.unsent:
                    search.append([ci, fmt(m.date), m.sender, body, anchor(m.guid)])
        with open(self.out / "messages.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["conversation", "date", "sender", "sender_handle", "from_me", "service", "text",
                        "attachments", "reactions", "delivered", "read", "earlier_versions", "reply_to",
                        "effect", "app", "recently_deleted"])
            w.writerows(rows)
        self._write_search(index, search)
        self._write_gallery(gallery)
        self.stats.update(conversations=len(conversations), messages=len(rows), attachments_copied=copied,
                          attachments_missing=missing, photos=len(gallery),
                          recently_deleted=sum(1 for c in conversations for m in c.messages if m.deleted_at))
        return index

    def _conversation_html(self, convo):
        parts, last_day = [], None
        for m in convo.messages:
            day = m.date.strftime("%A, %B %-d, %Y") if m.date else "Unknown date"
            if day != last_day:
                parts.append(f'<div class="day">{_esc(day)}</div>')
                last_day = day
            search = _esc(f"{m.sender} {m.text}".lower())
            aid = anchor(m.guid)
            if m.system:
                parts.append(f'<div class="sys" id="{aid}" data-s="{search}">{_esc(m.text)} \u00b7 {fmt(m.date)}</div>')
                continue
            cls = "row me" if m.from_me else "row"
            if m.service.upper() in ("SMS", "RCS", "MMS"):
                cls += " sms"
            if m.deleted_at:
                cls += " deleted"
            inner = []
            if m.unsent:
                inner.append('<span class="unsent">This message was unsent</span>')
            else:
                if m.text:
                    inner.append(f'<div class="t">{_linkify(_esc(m.text))}</div>')
                elif m.app:
                    inner.append(f'<div class="t app">{_esc(m.app)}</div>')
                for a in m.attachments:
                    inner.append(f'<div class="att">{self._attachment_html(a)}</div>')
            head = ""
            if m.reply_to:
                head += (f'<a class="reply" href="#{anchor(m.reply_to)}" title="{_esc(m.reply_preview)}">'
                         f'\u21aa {_esc(m.reply_preview)}</a>')
            if convo.is_group and not m.from_me:
                head += f'<div class="who" title="{_esc(m.sender_handle)}">{_esc(m.sender)}</div>'
            meta = [f'<span title="{fmt(m.date, True)}">{_time(m.date)}</span>']
            if m.from_me and m.read_at:
                meta.append(f'Read {_time(m.read_at)}')
            elif m.from_me and m.delivered_at:
                meta.append("Delivered")
            if m.effect:
                meta.append(f"Sent with {_esc(m.effect)}")
            if m.edits and not m.unsent:
                versions = "".join(f"<li>{_esc(t)} <small>{fmt(d)}</small></li>" for d, t in m.edits)
                is_open = " open" if self.for_pdf else ""  # PDFs can't be clicked, so show every version
                meta.append(f"<details{is_open}><summary>Edited</summary><ol>{versions}</ol></details>")
            elif m.edited and not m.unsent:
                meta.append("Edited")
            if m.reactions:
                meta.append(" ".join(f"{v} {_esc(k)}" for k, v in m.reactions.items()))
            if m.deleted_at:
                meta.append(f'<span class="tag">Recently deleted {fmt(m.deleted_at)}</span>')
            meta_html = " \u00b7 ".join(meta)
            parts.append(
                f'<div class="{cls}" id="{aid}" data-s="{search}">{head}<div class="b">{"".join(inner)}</div>'
                f'<div class="meta">{meta_html}</div></div>'
            )
        first, last = convo.messages[0].date, convo.messages[-1].date
        people = ", ".join(_esc(p) for p in convo.participants)
        subtitle = f"{len(convo.messages):,} messages \u00b7 {fmt(first)} to {fmt(last)} \u00b7 {people}"
        return self._page(convo.title, subtitle, "".join(parts), "Search this conversation", depth=1)

    def _attachment_html(self, a):
        if not a.exported:
            return f'<div class="meta">[{_esc(a.name)} \u2014 not in backup]</div>'
        href = _esc(a.exported)
        lazy = "" if self.for_pdf else ' loading="lazy"'
        if a.kind == "image":
            # Chrome and Firefox can't show HEIC; fall back to a link (Safari shows it, or use --convert-media).
            label = json.dumps("\U0001F5BC " + a.name)
            fallback = f"this.replaceWith(Object.assign(document.createElement('span'),{{textContent:{label}}}))"
            return (f'<a href="{href}"><img src="{href}" alt="{_esc(a.name)}"{lazy} '
                    f'onerror="{_esc(fallback)}"></a>')
        if a.kind == "video":
            return f'<video src="{href}" controls preload="{"metadata" if self.for_pdf else "none"}"></video>'
        if a.kind == "audio":
            return f'<audio src="{href}" controls preload="none"></audio><a href="{href}">{_esc(a.name)}</a>'
        return f'<a href="{href}">\U0001F4CE {_esc(a.name)}</a>'

    def _conversation_txt(self, convo):
        lines = [convo.title, ", ".join(convo.participants), ""]
        for m in convo.messages:
            body = "(unsent)" if m.unsent else (m.text or m.app)
            extras = [f"[attachment: {a.name}]" for a in m.attachments]
            if m.reply_preview:
                extras.insert(0, f"(replying to {m.reply_preview})")
            if m.edits and not m.unsent:
                extras.append("(edited; earlier: " + " / ".join(t for _, t in m.edits[:-1]) + ")")
            elif m.edited and not m.unsent:
                extras.append("(edited)")
            if m.effect:
                extras.append(f"(sent with {m.effect})")
            if m.reactions:
                extras.append("(" + ", ".join(f"{k} {v}" for k, v in m.reactions.items()) + ")")
            if m.deleted_at:
                extras.append(f"(recently deleted {fmt(m.deleted_at)})")
            sender = "--" if m.system else m.sender
            lines.append(f"[{fmt(m.date)}] {sender}: {' '.join(p for p in [body] + extras if p)}")
        return "\n".join(lines) + "\n"

    # ------------------------------------------------------------------ search all + photos

    def _write_search(self, index, search):
        convos = [[c.title, "Messages/" + name + ".html"] for c, name in index]
        data = "window.CONVOS=" + json.dumps(convos, ensure_ascii=False) + ";\nwindow.MSGS=" + \
            json.dumps(search, ensure_ascii=False, separators=(",", ":")) + ";\n"
        self._write("search-data.js", data)
        body = """<p class="meta noprint" id="count">Type at least two characters.</p><div id="hits"></div>
<script src="search-data.js"></script>
<script>
const q=document.getElementById('q'),hits=document.getElementById('hits'),count=document.getElementById('count');
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function run(){const t=q.value.trim().toLowerCase();hits.innerHTML='';
 if(t.length<2){count.textContent='Type at least two characters.';return}
 let n=0,out=[];for(const [c,d,s,x,id] of MSGS){const i=x.toLowerCase().indexOf(t);
  if(i<0&&!s.toLowerCase().includes(t))continue;n++;if(out.length>=300)continue;
  const lo=Math.max(0,i-40),snip=i<0?x.slice(0,120):(lo?'\\u2026':'')+esc(x.slice(lo,i))+'<mark>'+esc(x.slice(i,i+t.length))+'</mark>'+esc(x.slice(i+t.length,i+t.length+120));
  out.push('<a class="hit" href="'+esc(CONVOS[c][1])+'#'+id+'"><small>'+esc(CONVOS[c][0])+' \\u00b7 '+esc(d)+' \\u00b7 '+esc(s)+'</small><span>'+(i<0?esc(snip):snip)+'</span></a>')}
 out.reverse();hits.innerHTML=out.join('');count.textContent=n.toLocaleString()+' match'+(n==1?'':'es')+(n>300?' (showing 300)':'')}
q.addEventListener('input',run);
const p=new URLSearchParams(location.search).get('q');if(p){q.value=p;run()}
</script>"""
        page = self._page("Search all messages", f"{len(search):,} messages across {len(index):,} conversations",
                          body, None)
        page = page.replace("</nav>", '</nav><input id="q" type="search" placeholder="Search every message" '
                                      'autocomplete="off" autofocus>', 1)
        self._write("search.html", page)

    def _write_gallery(self, gallery):
        if not self.attachments:
            return
        gallery.sort(key=lambda g: g[0].timestamp() if g[0] else 0, reverse=True)
        tiles = []
        lazy = "" if self.for_pdf else ' loading="lazy"'
        for when, title, name, a, aid in gallery:
            src = _esc("Messages/" + a.exported)
            if a.kind == "video":
                pic = f'<video src="{src}" preload="metadata" muted></video>'
            else:
                label = json.dumps(a.name)
                fallback = f"this.replaceWith(Object.assign(document.createElement('span'),{{textContent:{label}}}))"
                pic = f'<img src="{src}" alt="{_esc(a.name)}"{lazy} onerror="{_esc(fallback)}">'
            href = _esc(f"Messages/{name}.html#{aid}")
            tiles.append(
                f'<a class="tile" href="{href}" data-s="{_esc(title.lower())}"><div class="pic">{pic}</div>'
                f'<div class="cap">{_esc(title)}<small>{fmt(when)}</small></div></a>')
        self._write("photos.html", self._page(
            "Photos & videos", f"{len(gallery):,} from Messages, newest first",
            f'<div class="grid">{"".join(tiles)}</div>' if tiles else "<p>No photos or videos were in the source.</p>",
            "Filter by conversation", wide=True))

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
        body = ('<div class="tw"><table><thead><tr><th>When</th><th>Who</th><th>Direction</th><th>Type</th>'
                '<th class="n">Length</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>")
        self._write("calls.html", self._page("Call history", f"{len(calls):,} calls", body, "Search calls"), pdf=True)
        self.stats["calls"] = len(calls)

    # ------------------------------------------------------------------ voicemail

    def write_voicemail(self, items, fetch_audio):
        """fetch_audio(rowid, dest_dir) -> (path or None, transcript)"""
        vm_dir = self.out / "Voicemail"
        rows, csv_rows = [], []
        for v in items:
            path, v.transcript = fetch_audio(v.rowid, vm_dir)
            if path:
                path = self._convert(path)
                if v.date is not None:
                    os.utime(path, (v.date.timestamp(), v.date.timestamp()))
                v.audio = path.relative_to(self.out).as_posix()
            mins, secs = divmod(v.duration, 60)
            who = v.name or v.number or "Unknown"
            audio = (f'<audio src="{_esc(v.audio)}" controls preload="none"></audio>'
                     f'<small><a href="{_esc(v.audio)}">{_esc(Path(v.audio).name)}</a></small>'
                     if v.audio else "<small>audio not in backup</small>")
            deleted = '<small class="tag">deleted</small>' if v.deleted else "<small>&nbsp;</small>"
            search = _esc(f"{v.name} {v.number} {v.transcript}".lower())
            rows.append(
                f'<tr data-s="{search}"><td>{fmt(v.date)}<br>{deleted}</td><td>{_esc(who)}<br>'
                f'<small>{_esc(v.number) if v.name else "&nbsp;"}</small></td><td class="n">{mins}:{secs:02d}</td>'
                f'<td class="two"><div title="{_esc(v.transcript)}">{_esc(v.transcript) or "&nbsp;"}</div></td>'
                f'<td class="aud"><div>{audio}</div></td></tr>')
            csv_rows.append([fmt(v.date, True), v.name, v.number, v.duration, v.transcript, v.audio or "",
                             "yes" if v.deleted else ""])
        with open(self.out / "voicemail.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["date", "name", "number", "duration_seconds", "transcript", "audio_file", "deleted"])
            w.writerows(csv_rows)
        body = ('<div class="tw"><table><thead><tr><th>When</th><th>From</th><th class="n">Length</th>'
                "<th>Transcript</th><th>Audio</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table></div>")
        self._write("voicemail.html", self._page("Voicemail", f"{len(items):,} voicemails", body,
                                                 "Search voicemail", wide=True), pdf=True)
        self.stats["voicemails"] = len(items)

    # ------------------------------------------------------------------ notes

    def write_notes(self, notes):
        notes_dir = self.out / "Notes"
        notes_dir.mkdir(parents=True, exist_ok=True)
        used_by_folder, items = {}, []
        for n in notes:
            folder = safe_name(n.folder, set())
            name = safe_name(n.title, used_by_folder.setdefault(folder, set()))
            body = "(This note is locked with a password and can't be exported.)" if n.locked else n.text
            self._write(f"Notes/{folder}/{name}.txt",
                        f"{n.title}\nCreated: {fmt(n.created)}\nModified: {fmt(n.modified)}\n\n{body}\n")
            search = _esc(f"{n.title} {n.folder} {n.text}".lower())
            items.append(
                f'<details data-s="{search}"><summary><b>{_esc(n.title)}</b> '
                f'<span class="meta">{_esc(n.folder)} \u00b7 {fmt(n.modified)}</span></summary>'
                f"<pre>{_linkify(_esc(body))}</pre></details>"
            )
        self._write("notes.html", self._page("Notes", f"{len(notes):,} notes", "".join(items), "Search notes"))
        self.stats["notes"] = len(notes)

    # ------------------------------------------------------------------ contacts

    def write_contacts(self, people):
        with open(self.out / "contacts.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f)
            w.writerow(["name", "first", "last", "organization", "phones", "emails"])
            for p in people:
                w.writerow([p.name, p.first, p.last, p.organization,
                            "; ".join(f"{lab + ': ' if lab else ''}{v}" for lab, v in p.phones),
                            "; ".join(f"{lab + ': ' if lab else ''}{v}" for lab, v in p.emails)])
        cards = []
        for p in people:
            def vesc(s):
                return (s or "").replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n")
            lines = ["BEGIN:VCARD", "VERSION:3.0", f"N:{vesc(p.last)};{vesc(p.first)};;;", f"FN:{vesc(p.name)}"]
            if p.organization:
                lines.append(f"ORG:{vesc(p.organization)}")
            for lab, v in p.phones:
                lines.append(f"TEL;TYPE={vesc(lab.upper() or 'VOICE')}:{v}")
            for lab, v in p.emails:
                lines.append(f"EMAIL;TYPE={vesc(lab.upper() or 'INTERNET')}:{v}")
            lines.append("END:VCARD")
            cards.append("\r\n".join(lines))
        (self.out / "contacts.vcf").write_text("\r\n".join(cards) + "\r\n", encoding="utf-8")
        rows = []
        for p in people:
            phones = ", ".join(v for _, v in p.phones)
            emails = ", ".join(v for _, v in p.emails)
            search = _esc(f"{p.name} {phones} {emails}".lower())
            rows.append(f'<tr data-s="{search}"><td class="clip">{_esc(p.name)}</td>'
                        f'<td class="clip" title="{_esc(phones)}">{_esc(phones)}</td>'
                        f'<td class="clip" title="{_esc(emails)}">{_esc(emails)}</td></tr>')
        body = ('<p class="meta noprint">Also saved as <a href="contacts.vcf">contacts.vcf</a> (opens in Contacts) '
                'and <a href="contacts.csv">contacts.csv</a>.</p><table><thead><tr><th>Name</th><th>Phone</th>'
                '<th>Email</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table>")
        self._write("contacts.html", self._page("Contacts", f"{len(people):,} contacts", body, "Search contacts"))
        self.stats["contacts"] = len(people)

    # ------------------------------------------------------------------ index

    def write_index(self, convo_index, source_label, generated, problems):
        cards = []
        for key, label, href in (("messages", "messages", "search.html"), ("conversations", "conversations", None),
                                 ("photos", "photos & videos", "photos.html"), ("calls", "calls", "calls.html"),
                                 ("voicemails", "voicemails", "voicemail.html"), ("notes", "notes", "notes.html"),
                                 ("contacts", "contacts", "contacts.html"),
                                 ("recently_deleted", "recently deleted", None)):
            if self.stats.get(key) or (key in self.stats and key in ("messages", "calls", "notes")):
                inner = f"<b>{self.stats[key]:,}</b><span>{label}</span>"
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
                    f'<tr data-s="{search}"><td class="clip title"><a href="{href}" title="{_esc(convo.title)}">'
                    f'{_esc(convo.title)}</a></td>'
                    f'<td class="n">{len(convo.messages):,}</td><td>{fmt(convo.last_date)}</td></tr>'
                )
            body.append("</tbody></table>")
        subtitle = f"From {_esc(source_label)} \u00b7 exported {fmt(generated)}"
        self._write("index.html", self._page("iPhone export", subtitle, "".join(body), "Find a conversation"))
