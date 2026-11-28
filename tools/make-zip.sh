#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Baut zorin-chromeos-theme.zip fuer GitHub-Releases.
#
#   bash tools/make-zip.sh            -> dist/zorin-chromeos-theme.zip
#   bash tools/make-zip.sh /tmp/out   -> /tmp/out/zorin-chromeos-theme.zip
#
# Im Archiv liegt ein Ordner zorin-chromeos-theme/ mit genau den Dateien, die
# zum Installieren und Lesen gebraucht werden - kein .git, keine Tests, keine
# CI-Dateien. Wer kein git hat, laedt das ZIP und ruft install.sh auf.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
OUT_DIR=${1:-$SCRIPT_DIR/dist}
NAME="zorin-chromeos-theme"

PARTS=(install.sh uninstall.sh LICENSE README.md bin cursor data docs extension fonts theme)

cd "$SCRIPT_DIR"
for part in "${PARTS[@]}"; do
    if [ ! -e "$part" ]; then
        printf 'Fehlt im Repo: %s\n' "$part" >&2
        exit 1
    fi
done

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT INT TERM
mkdir -p "$STAGE/$NAME"
cp -a "${PARTS[@]}" "$STAGE/$NAME/"

mkdir -p "$OUT_DIR"
OUT_DIR=$(cd "$OUT_DIR" && pwd)
ZIP="$OUT_DIR/$NAME.zip"
rm -f "$ZIP"

if command -v zip >/dev/null 2>&1; then
    ( cd "$STAGE" && zip -q -r -X "$ZIP" "$NAME" )
elif command -v python3 >/dev/null 2>&1; then
    python3 - "$STAGE" "$ZIP" <<'PY'
import os
import sys
import zipfile

stage, zip_path = sys.argv[1:3]
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as archive:
    for base, dirs, files in os.walk(stage):
        dirs.sort()
        for name in sorted(files):
            path = os.path.join(base, name)
            archive.write(path, os.path.relpath(path, stage))
PY
else
    printf 'Weder zip noch python3 gefunden - bitte eines davon installieren.\n' >&2
    exit 1
fi

printf 'Archiv: %s (%s)\n' "$ZIP" "$(wc -c < "$ZIP") Bytes"
if command -v unzip >/dev/null 2>&1; then
    unzip -l "$ZIP" | tail -2
fi
