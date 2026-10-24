"""Daily automatic backup + export on a Mac, via a per-user LaunchAgent (like iMazing's scheduled backups).

Nothing runs as root and nothing is installed system-wide: one plist in ~/Library/LaunchAgents and a log in
~/Library/Logs. `schedule --off` removes it.
"""

from __future__ import annotations

import os
import plistlib
import subprocess
import sys
from pathlib import Path

LABEL = "com.crstudios.iphone-export"
PLIST = Path.home() / "Library/LaunchAgents" / f"{LABEL}.plist"
LOG = Path.home() / "Library/Logs/iphone-export.log"


def _launchctl(*args):
    return subprocess.run(["launchctl", *args], capture_output=True, text=True)


def install(hour, minute, extra_args, python=None, workdir=None):
    python = python or sys.executable
    workdir = workdir or str(Path(__file__).resolve().parent.parent)
    plist = {
        "Label": LABEL,
        "ProgramArguments": [python, "-m", "iphone_export", "sync", *extra_args],
        "WorkingDirectory": workdir,
        "StartCalendarInterval": {"Hour": hour, "Minute": minute},
        "StandardOutPath": str(LOG),
        "StandardErrorPath": str(LOG),
        "EnvironmentVariables": {"PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"},
    }
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(PLIST, "wb") as f:
        plistlib.dump(plist, f)
    domain = f"gui/{os.getuid()}"
    _launchctl("bootout", domain, str(PLIST))
    result = _launchctl("bootstrap", domain, str(PLIST))
    return result.returncode == 0, result.stderr.strip()


def remove():
    existed = PLIST.exists()
    if existed:
        _launchctl("bootout", f"gui/{os.getuid()}", str(PLIST))
        PLIST.unlink()
    return existed


def status():
    if not PLIST.exists():
        return None
    with open(PLIST, "rb") as f:
        return plistlib.load(f)
