"""Machine-readable progress for the Mac app.

With IPHONE_EXPORT_EVENTS=1 in the environment, the CLI prints extra lines of the form
    @@EVENT {"type": "stage", "stage": "messages", "message": "Reading messages"}
alongside its normal output. The app reads these to drive its progress bar; people never see them.
"""

from __future__ import annotations

import json
import os
import sys

PREFIX = "@@EVENT "


def enabled():
    return os.environ.get("IPHONE_EXPORT_EVENTS") == "1"


def emit(type_, **data):
    if not enabled():
        return
    data["type"] = type_
    sys.stdout.write(PREFIX + json.dumps(data, ensure_ascii=False, default=str) + "\n")
    sys.stdout.flush()


def stage(name, message):
    emit("stage", stage=name, message=message)


def progress(name, done, total):
    emit("progress", stage=name, done=done, total=total)
