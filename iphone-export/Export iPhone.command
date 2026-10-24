#!/bin/bash
# Double-click in Finder to export iPhone texts, call history and notes.
# If idevicebackup2 is installed and the iPhone is plugged in or on the same Wi-Fi, it backs the phone up
# first; otherwise it uses the newest existing backup (e.g. one made with Finder's "Back Up Now").

cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
VENV="$HOME/.iphone-export-venv"

if [ ! -x "$VENV/bin/python" ]; then
  echo "First run: setting up a private Python environment (one time only)..."
  if ! /usr/bin/python3 -m venv "$VENV" || ! "$VENV/bin/pip" install --quiet -r requirements.txt; then
    echo "Setup failed. If macOS asked to install the Command Line Tools, finish that and run this again."
    read -r -n1 -p "Press any key to close."
    exit 1
  fi
fi

# Fresh backup first if the phone is reachable: cable if plugged in, else Wi-Fi. Otherwise use the newest backup.
if command -v idevicebackup2 >/dev/null 2>&1 && idevice_id -l 2>/dev/null | grep -q .; then
  "$VENV/bin/python" -m iphone_export sync --open --convert-media "$@"
elif command -v idevicebackup2 >/dev/null 2>&1 && idevice_id -n 2>/dev/null | grep -q .; then
  echo "iPhone found on Wi-Fi. Backing up over Wi-Fi; enter the passcode on the phone when it asks."
  "$VENV/bin/python" -m iphone_export sync --wifi --open --convert-media "$@"
else
  "$VENV/bin/python" -m iphone_export export --open --convert-media "$@"
fi

echo
read -r -n1 -p "Press any key to close."
