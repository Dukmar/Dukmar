#!/bin/bash
# Build "iPhone Export.app" from source. Run on a Mac with Xcode or the Xcode Command Line Tools:
#
#   cd mac-app && ./build-app.sh            # builds dist/iPhone Export.app
#   ./build-app.sh --install                # ...and copies it to /Applications
#
# The app embeds the Python engine (../iphone_export) in Contents/Resources/engine and runs it with the
# private Python environment in ~/.iphone-export-venv, which it creates on first launch.
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="iPhone Export"
BUNDLE_ID="com.crstudios.iphone-export"
VERSION="$(sed -n 's/^__version__ = "\(.*\)"/\1/p' ../iphone_export/__init__.py)"
DIST="dist"
APP="$DIST/$APP_NAME.app"

echo "Building $APP_NAME $VERSION..."
swift build -c release --product iPhoneExport
BIN="$(swift build -c release --product iPhoneExport --show-bin-path)/iPhoneExport"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/engine"
cp "$BIN" "$APP/Contents/MacOS/iPhoneExport"

# The Python engine, without tests or caches.
rsync -a --exclude '__pycache__' ../iphone_export "$APP/Contents/Resources/engine/"
cp ../requirements.txt "$APP/Contents/Resources/engine/"

# App icon (PNG set in Resources/AppIcon.iconset -> .icns).
if [ -d Resources/AppIcon.iconset ]; then
  iconutil -c icns Resources/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"
fi

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>iPhoneExport</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.utilities</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>CR Studios</string>
</dict>
</plist>
PLIST

# Ad-hoc signature so macOS will run it locally. Full Disk Access is tied to this signature, so after a
# rebuild macOS may ask for it again (switch iPhone Export off and on in the Full Disk Access list).
codesign --force --deep --sign - "$APP"

echo "Built: $APP"
if [ "${1:-}" = "--install" ]; then
  rm -rf "/Applications/$APP_NAME.app"
  cp -R "$APP" /Applications/
  echo "Installed: /Applications/$APP_NAME.app"
  open "/Applications/$APP_NAME.app"
fi
