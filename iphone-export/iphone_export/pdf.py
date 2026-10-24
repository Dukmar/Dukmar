"""Turn the export's HTML pages into PDFs with a headless Chrome-family browser.

The pages carry their own print layout (@page margin boxes need Chrome 131+): the conversation name on
top, export details bottom-left, "Page N of M" bottom-right.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

MAC_BROWSERS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
]


def find_browser():
    env = os.environ.get("CHROME_PATH")
    if env and Path(env).exists():
        return env
    for path in MAC_BROWSERS:
        if Path(path).exists():
            return path
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        found = shutil.which(name)
        if found:
            return found
    return None


def to_pdf(pages, out_root, pdf_root, log=print):
    browser = find_browser()
    if browser is None:
        log("PDF: no Chrome, Chromium, Edge or Brave found. Install Chrome, or set CHROME_PATH.")
        return 0
    made = 0
    for page in pages:
        page = Path(page)
        target = Path(pdf_root) / page.relative_to(out_root).with_suffix(".pdf")
        target.parent.mkdir(parents=True, exist_ok=True)
        cmd = [browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--print-to-pdf-no-header",
               "--run-all-compositor-stages-before-draw", "--virtual-time-budget=15000",
               f"--print-to-pdf={target}", page.resolve().as_uri()]
        if hasattr(os, "geteuid") and os.geteuid() == 0:
            cmd.insert(1, "--no-sandbox")  # Chrome won't start as root otherwise (containers; never on a Mac)
        try:
            result = subprocess.run(cmd, capture_output=True, timeout=300)
        except subprocess.TimeoutExpired:
            log(f"PDF: timed out on {page.name}")
            continue
        if result.returncode == 0 and target.exists() and target.stat().st_size:
            made += 1
        else:
            log(f"PDF: couldn't make {target.name}")
    return made
