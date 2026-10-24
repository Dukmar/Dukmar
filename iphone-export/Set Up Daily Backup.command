#!/bin/bash
# One-time setup for the daily Wi-Fi backup + export. Double-click in Finder and follow the prompts.

cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
VENV="$HOME/.iphone-export-venv"
pause() { read -r -n1 -p "$1"; echo; }

echo "== 1/4  Python environment"
if [ ! -x "$VENV/bin/python" ]; then
  if ! /usr/bin/python3 -m venv "$VENV" || ! "$VENV/bin/pip" install --quiet -r requirements.txt; then
    echo "Setup failed. If macOS asked to install the Command Line Tools, finish that and run this again."
    pause "Press any key to close."; exit 1
  fi
fi
echo "ok"

echo "== 2/4  Backup tool (libimobiledevice)"
if ! command -v idevicebackup2 >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installing libimobiledevice with Homebrew..."
    brew install libimobiledevice || { pause "Install failed. Press any key to close."; exit 1; }
  else
    echo "Homebrew isn't installed. Install it from https://brew.sh, then run this again."
    pause "Press any key to close."; exit 1
  fi
fi
echo "ok"

echo "== 3/4  First backup over the cable"
echo "Plug the iPhone into this Mac with a cable and unlock it. Tap 'Trust' if it asks."
until idevice_id -l 2>/dev/null | grep -q .; do sleep 2; done
echo "Found it. While it's plugged in: open Finder, click the iPhone in the sidebar, tick"
echo "'Show this iPhone when on Wi-Fi', and click Apply. That's what lets the daily backup skip the cable."
pause "Press any key once that's ticked..."
echo "Now the first backup. It copies everything, so it can take a while; later ones only copy changes."
echo "The phone will ask for its passcode. If the backup is encrypted, this run also asks for the backup"
echo "password once and saves the unlock key in your Keychain, so the daily run can open it."
"$VENV/bin/python" -m iphone_export sync --convert-media --remember --open || {
  pause "The first backup didn't finish. Fix what it says above and run this again. Press any key to close."
  exit 1
}

echo "== 4/4  Daily schedule"
"$VENV/bin/python" -m iphone_export schedule --wifi --convert-media --window 18:00-23:00
echo
echo "All set. Change the hours any time by running this again, or remove it with:"
echo "  $VENV/bin/python -m iphone_export schedule --off"
pause "Press any key to close."
