#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# End-to-End-Harness fuer install.sh und uninstall.sh
#
#   bash tests/scripts/run.sh [repo]
#   KEEP=1 bash tests/scripts/run.sh [repo]    # Testverzeichnis behalten
#
# Laeuft gegen das uebergebene Repo (Standard: das Repo, in dem dieses Skript
# liegt) mit einem temporaeren HOME. gsettings, gnome-extensions, gnome-shell,
# fc-match und python3 werden durch aufzeichnende Stubs ersetzt, damit das
# Ergebnis nicht davon abhaengt, ob der Rechner eine GNOME-Sitzung hat.
# Am echten Benutzerkonto wird nichts geaendert.
# ---------------------------------------------------------------------------
set -uo pipefail

HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO=${1:-$(cd -- "$HERE/../.." && pwd)}

UUID='chromeos-shell@baanaanek.github.io'
THEME_NAME='ChromeOS'

TOTAL=0
PASSED=0
FAILS=0

check() {
    local name=$1
    shift
    TOTAL=$((TOTAL + 1))
    if "$@" >/dev/null 2>&1; then
        PASSED=$((PASSED + 1))
        printf '  ok   %s\n' "$name"
    else
        FAILS=$((FAILS + 1))
        printf '  FAIL %s\n' "$name"
    fi
}

exists() { [ -e "$1" ]; }
missing() { [ ! -e "$1" ]; }
is_exec() { [ -x "$1" ]; }
has_text() { [ -f "$1" ] && grep -qF -- "$2" "$1"; }
line_is() { [ -f "$1" ] && grep -qxF -- "$2" "$1"; }
eq() { [ "$1" = "$2" ]; }
no_cr() { [ -f "$1" ] && ! grep -q "$(printf '\r')" "$1"; }

gset() {
    local value
    value=$(awk -F'\t' -v s="$1" -v k="$2" '$1==s && $2==k {print $3; exit}' \
        "$STUB_STATE/gsettings.tsv")
    [ "$value" = "$3" ]
}
gget() { STUB_STATE="$STUB_STATE" PATH="$STUB_PATH" gsettings get "$1" "$2"; }

TMP=$(mktemp -d 2>/dev/null) || {
    echo 'mktemp -d fehlgeschlagen' >&2
    exit 2
}

cleanup() {
    if [ "${KEEP:-0}" = '1' ]; then
        printf '\nTestverzeichnis behalten: %s\n' "$TMP"
    else
        rm -rf "$TMP"
    fi
}
trap cleanup EXIT INT TERM

TEST_HOME="$TMP/home"
STUB_STATE="$TMP/stub-state"
BASE_PATH='/usr/bin:/bin'
STUB_PATH="$HERE/stubs:$BASE_PATH"
OUT="$TMP/stdout.log"
ERR="$TMP/stderr.log"

DATA="$TEST_HOME/.local/share"
THEME_DIR="$DATA/themes/$THEME_NAME"
EXT_DIR="$DATA/gnome-shell/extensions/$UUID"
HELPER="$TEST_HOME/.local/bin/chromeos-search-url"
WALLPAPER="$DATA/backgrounds/chromeos-wallpaper.jpg"
STATE_DIR="$TEST_HOME/.local/state/chromeos-theme"
BACKUP_FILE="$STATE_DIR/settings.tsv"

mkdir -p "$DATA/applications" "$STUB_STATE"
for app in firefox.desktop org.gnome.Nautilus.desktop org.gnome.Settings.desktop \
           org.gnome.TextEditor.desktop org.gnome.Terminal.desktop; do
    : > "$DATA/applications/$app"
done

# --- Ausgangszustand -------------------------------------------------------
printf '%s\t%s\t%s\n' \
    'org.gnome.desktop.interface' 'gtk-theme' "'ZorinBlue-Light'" \
    'org.gnome.desktop.interface' 'color-scheme' "'default'" \
    'org.gnome.desktop.interface' 'accent-color' "'blue'" \
    'org.gnome.desktop.interface' 'clock-show-date' 'false' \
    'org.gnome.desktop.interface' 'clock-show-weekday' 'false' \
    'org.gnome.desktop.interface' 'clock-show-seconds' 'false' \
    'org.gnome.desktop.interface' 'font-name' "'Inter 10'" \
    'org.gnome.desktop.wm.preferences' 'button-layout' "'appmenu:close'" \
    'org.gnome.desktop.background' 'picture-uri' "'file:///usr/share/backgrounds/zorin.jpg'" \
    'org.gnome.desktop.background' 'picture-uri-dark' "'file:///usr/share/backgrounds/zorin.jpg'" \
    'org.gnome.desktop.background' 'picture-options' "'zoom'" \
    'org.gnome.shell' 'favorite-apps' "['firefox.desktop']" \
    'org.gnome.shell' 'enabled-extensions' "['zorin-dash@zorinos.com', 'zorin-menu@zorinos.com']" \
    > "$TMP/seed.tsv"
cp "$TMP/seed.tsv" "$STUB_STATE/gsettings.tsv"

printf '%s\n' "$UUID" 'zorin-dash@zorinos.com' 'zorin-menu@zorinos.com' \
    > "$STUB_STATE/ext-installed.txt"
printf '%s\n' 'zorin-dash@zorinos.com' 'zorin-menu@zorinos.com' \
    > "$STUB_STATE/ext-enabled.txt"

run_stub() {
    local script=$1
    shift
    env -i PATH="$STUB_PATH" HOME="$TEST_HOME" LANG=C.UTF-8 \
        STUB_STATE="$STUB_STATE" bash "$REPO/$script" "$@"
}

run_bare() {
    local script=$1
    shift
    env -i PATH="$BASE_PATH" HOME="$TEST_HOME" LANG=C.UTF-8 \
        bash "$REPO/$script" "$@"
}

settings_restored() {
    local schema key value got
    while IFS=$'\t' read -r schema key value; do
        [ -n "$schema" ] || continue
        if [ "$schema" = 'org.gnome.shell' ] && [ "$key" = 'enabled-extensions' ]; then
            continue
        fi
        got=$(awk -F'\t' -v s="$schema" -v k="$key" \
            '$1==s && $2==k {print $3; exit}' "$STUB_STATE/gsettings.tsv")
        [ "$got" = "$value" ] || return 1
    done < "$TMP/seed.tsv"
}

extension_files_ok() {
    local file
    for file in extension.js launcher.js shelf.js theme.js search.js \
                stylesheet.css metadata.json icons/launcher.svg; do
        [ -f "$EXT_DIR/$file" ] || return 1
    done
}

clocks_ok() {
    [ "$(gget org.gnome.desktop.interface clock-show-date)" = 'true' ] &&
        [ "$(gget org.gnome.desktop.interface clock-show-weekday)" = 'true' ] &&
        [ "$(gget org.gnome.desktop.interface clock-show-seconds)" = 'false' ]
}

background_ok() {
    case "$(gget org.gnome.desktop.background picture-uri)" in
        file://*chromeos-wallpaper.jpg) ;;
        *) return 1 ;;
    esac
    case "$(gget org.gnome.desktop.background picture-uri-dark)" in
        file://*chromeos-wallpaper.jpg) ;;
        *) return 1 ;;
    esac
    [ "$(gget org.gnome.desktop.background picture-options)" = 'zoom' ]
}

favorites_ok() {
    local value
    value=$(gget org.gnome.shell favorite-apps)
    case "$value" in
        *firefox.desktop*) ;;
        *) return 1 ;;
    esac
    case "$value" in
        *org.gnome.Nautilus.desktop*) ;;
        *) return 1 ;;
    esac
}

activate_unchanged() {
    [ "$(cksum "$THEME_DIR/gtk-3.0/gtk.css" | awk '{print $1}')" = "$GTK_SUM_BEFORE" ] &&
        has_text "$OUT" 'Nur aktivieren'
}

printf '\n== Skript-Harness ==\nRepo: %s\n\n' "$REPO"

# --- 0. Repo-Zustand -------------------------------------------------------
check 'install.sh vorhanden' exists "$REPO/install.sh"
check 'install.sh ist ausfuehrbar' is_exec "$REPO/install.sh"
check 'uninstall.sh ist ausfuehrbar' is_exec "$REPO/uninstall.sh"
check 'Suchhelfer ist ausfuehrbar' is_exec "$REPO/bin/chromeos-search-url"
check 'install.sh ohne CRLF' no_cr "$REPO/install.sh"
check 'uninstall.sh ohne CRLF' no_cr "$REPO/uninstall.sh"
check 'install.sh startet ueber /usr/bin/env bash' \
    has_text "$REPO/install.sh" '#!/usr/bin/env bash'
check 'Suchhelfer startet ueber /usr/bin/env python3' \
    has_text "$REPO/bin/chromeos-search-url" '#!/usr/bin/env python3'

# --- 1. Probelauf ----------------------------------------------------------
run_stub install.sh --dry-run >"$OUT" 2>"$ERR"
check 'Dry-Run endet mit 0' eq "$?" 0
check 'Dry-Run legt kein Theme an' missing "$THEME_DIR"
check 'Dry-Run legt keine Extension an' missing "$EXT_DIR"
check 'Dry-Run legt keinen Helfer an' missing "$HELPER"
check 'Dry-Run legt kein Hintergrundbild an' missing "$WALLPAPER"
check 'Dry-Run legt keinen Zustandsordner an' missing "$STATE_DIR"
check 'Dry-Run schreibt keine Einstellungen' missing "$STUB_STATE/gsettings-set.log"
check 'Dry-Run deaktiviert keine Zorin-Leiste' missing "$STUB_STATE/ext-disable.log"
check 'Dry-Run meldet "Probelauf beendet"' has_text "$OUT" 'Probelauf beendet'
check 'Dry-Run zeigt geplante Schritte' has_text "$OUT" 'wuerde:'

# --- 2. Kommandozeile ------------------------------------------------------
run_stub install.sh --help >"$OUT" 2>&1
check '--help endet mit 0' eq "$?" 0
check '--help nennt die Deinstallation' has_text "$OUT" 'Deinstallation'
run_stub install.sh --unsinn >"$OUT" 2>&1
check 'unbekannte Option endet mit 2' eq "$?" 2

# --- 3. Echter Lauf --------------------------------------------------------
run_stub install.sh >"$OUT" 2>"$ERR"
check 'Installation endet mit 0' eq "$?" 0
check 'Theme-Ordner existiert' exists "$THEME_DIR"
check 'GTK- und Shell-Theme liegen bereit' \
    bash -c '[ -f "$1/gtk-3.0/gtk.css" ] && [ -f "$1/gnome-shell/gnome-shell.css" ]' \
    _ "$THEME_DIR"
check 'Theme ist markiert' has_text "$THEME_DIR/.chromeos-theme" 'chromeos-theme'
check 'Extension mit allen Dateien installiert' extension_files_ok
check 'Suchhelfer installiert und ausfuehrbar' bash -c '[ -x "$1" ]' _ "$HELPER"
check 'Hintergrundbild installiert' exists "$WALLPAPER"
check 'Sicherung enthaelt zwoelf Einstellungen' \
    bash -c '[ "$(wc -l < "$1")" -eq 12 ]' _ "$BACKUP_FILE"
check 'gtk-theme ist ChromeOS' gset org.gnome.desktop.interface gtk-theme 'ChromeOS'
check 'color-scheme ist default' gset org.gnome.desktop.interface color-scheme 'default'
check 'accent-color ist blue' gset org.gnome.desktop.interface accent-color 'blue'
check 'Uhr: Datum und Wochentag an, Sekunden aus' clocks_ok
check 'Fensterknoepfe rechts' \
    gset org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'
check 'Schrift ist Roboto 11' gset org.gnome.desktop.interface font-name 'Roboto 11'
check 'Hintergrund ist gesetzt' background_ok
check 'Shelf-Favoriten enthalten Browser und Dateien' favorites_ok
check 'Zorin-Leisten wurden deaktiviert' bash -c '
    grep -qxF "zorin-dash@zorinos.com" "$1" && grep -qxF "zorin-menu@zorinos.com" "$1"' \
    _ "$STUB_STATE/ext-disable.log"
check 'Extension wurde aktiviert' line_is "$STUB_STATE/ext-enabled.txt" "$UUID"
check 'Installation meldet "Fertig."' has_text "$OUT" 'Fertig.'

# --- 4. Zweiter Lauf (idempotent) -----------------------------------------
run_stub install.sh >"$OUT" 2>"$ERR"
check 'zweiter Lauf endet mit 0' eq "$?" 0
check 'Sicherung bleibt bei zwoelf Eintraegen' \
    bash -c '[ "$(wc -l < "$1")" -eq 12 ]' _ "$BACKUP_FILE"
check 'kein Theme-Backup und keine Dopplung' \
    bash -c '[ -d "$1" ] && [ ! -e "$1.bak" ]' _ "$THEME_DIR"

# --- 5. --activate ---------------------------------------------------------
GTK_SUM_BEFORE=$(cksum "$THEME_DIR/gtk-3.0/gtk.css" | awk '{print $1}')
run_stub install.sh --activate >"$OUT" 2>"$ERR"
check '--activate endet mit 0' eq "$?" 0
check '--activate laesst die Dateien unveraendert' activate_unchanged

# --- 6. Deinstallation als Probelauf --------------------------------------
run_stub uninstall.sh --dry-run >"$OUT" 2>"$ERR"
check 'Uninstall-Dry-Run endet mit 0' eq "$?" 0
check 'Uninstall-Dry-Run entfernt nichts' \
    bash -c '[ -d "$1" ] && [ -d "$2" ] && [ -x "$3" ]' _ "$THEME_DIR" "$EXT_DIR" "$HELPER"

# --- 7. Echte Deinstallation ----------------------------------------------
run_stub uninstall.sh >"$OUT" 2>"$ERR"
check 'Deinstallation endet mit 0' eq "$?" 0
check 'Theme-Ordner entfernt' missing "$THEME_DIR"
check 'Extension, Helfer und Hintergrund entfernt' \
    bash -c '[ ! -e "$1" ] && [ ! -e "$2" ] && [ ! -e "$3" ]' \
    _ "$EXT_DIR" "$HELPER" "$WALLPAPER"
check 'Zustandsordner entfernt' missing "$STATE_DIR"
check 'alle zwoelf Einstellungen exakt wiederhergestellt' settings_restored
check 'Zorin-Leisten wieder aktiv, UUID aus der Liste' bash -c '
    grep -qxF "zorin-dash@zorinos.com" "$1" &&
    grep -qxF "zorin-menu@zorinos.com" "$1" &&
    ! gsettings get org.gnome.shell enabled-extensions | grep -qF "$2"' \
    _ "$STUB_STATE/ext-enabled.txt" "$UUID"

# --- 8. Lauf ohne GNOME-Werkzeuge -----------------------------------------
run_bare install.sh >"$OUT" 2>"$ERR"
check 'Installation ohne GNOME endet mit 0' eq "$?" 0
check 'Dateien werden auch ohne GNOME installiert' \
    bash -c '[ -f "$1/gnome-shell/gnome-shell.css" ] && [ -d "$2" ] && [ -x "$3" ]' \
    _ "$THEME_DIR" "$EXT_DIR" "$HELPER"
run_bare uninstall.sh >"$OUT" 2>"$ERR"
check 'Deinstallation ohne GNOME endet mit 0' eq "$?" 0
check 'ohne GNOME wird trotzdem vollstaendig aufgeraeumt' \
    bash -c '[ ! -e "$1" ] && [ ! -e "$2" ] && [ ! -e "$3" ]' \
    _ "$THEME_DIR" "$EXT_DIR" "$HELPER"

# --- Ergebnis --------------------------------------------------------------
printf '\n%s/%s Pruefungen bestanden\n' "$PASSED" "$TOTAL"
if [ "$FAILS" -gt 0 ]; then
    printf '%s fehlgeschlagen\n' "$FAILS"
    printf '\n--- stderr des letzten Laufs ---\n'
    cat "$ERR" 2>/dev/null
    exit 1
fi
exit 0
