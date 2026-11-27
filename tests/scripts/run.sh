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
WALLPAPER="$DATA/backgrounds/chromeos-wallpaper.png"
FONT_DIR="$DATA/fonts/$THEME_NAME"
STATE_DIR="$TEST_HOME/.local/state/chromeos-theme"
BACKUP_FILE="$STATE_DIR/settings.tsv"
ICON_DIR="$DATA/icons/$THEME_NAME"
GTK4_FILE="$TEST_HOME/.config/gtk-4.0/gtk.css"

mkdir -p "$DATA/applications" "$STUB_STATE" "$TEST_HOME/.config/gtk-4.0"
printf '/* eigene Anpassung */\n' > "$GTK4_FILE"
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
    'org.gnome.desktop.interface' 'enable-hot-corners' 'true' \
    'org.gnome.desktop.interface' 'show-battery-percentage' 'false' \
    'org.gnome.shell.extensions.ding' 'show-home' 'true' \
    'org.gnome.shell.extensions.ding' 'show-trash' 'true' \
    'org.gnome.shell.extensions.ding' 'show-other-volumes' 'true' \
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
    for file in extension.js launcher.js shelf.js theme.js search.js menu.js \
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
        file://*chromeos-wallpaper.png) ;;
        *) return 1 ;;
    esac
    case "$(gget org.gnome.desktop.background picture-uri-dark)" in
        file://*chromeos-wallpaper.png) ;;
        *) return 1 ;;
    esac
    [ "$(gget org.gnome.desktop.background picture-options)" = 'zoom' ]
}

fonts_ok() {
    [ "$(gget org.gnome.desktop.wm.preferences titlebar-font)" = 'Roboto 11' ] &&
        [ "$(gget org.gnome.desktop.interface document-font-name)" = 'Roboto 11' ] &&
        [ "$(gget org.gnome.desktop.interface monospace-font-name)" = 'Roboto Mono 10' ]
}

ding_off() {
    [ "$(gget org.gnome.shell.extensions.ding show-home)" = 'false' ] &&
        [ "$(gget org.gnome.shell.extensions.ding show-trash)" = 'false' ] &&
        [ "$(gget org.gnome.shell.extensions.ding show-other-volumes)" = 'false' ]
}

cursor_ok() {
    [ -s "$ICON_DIR/cursors/left_ptr" ] &&
        [ -s "$ICON_DIR/cursors/hand2" ] &&
        [ -s "$ICON_DIR/cursors/wait" ] &&
        [ -f "$ICON_DIR/.chromeos-theme" ]
}

gtk4_ours() {
    grep -q 'chromeos-theme' "$GTK4_FILE" 2>/dev/null &&
        grep -q 'accent_bg_color #1a73e8' "$GTK4_FILE" 2>/dev/null
}

no_extra_keys() {
    local extra
    extra=$(comm -13 \
        <(awk -F'\t' '!($1 == "org.gnome.shell" && $2 == "enabled-extensions")' \
            "$TMP/seed.tsv" | sort) \
        <(awk -F'\t' '!($1 == "org.gnome.shell" && $2 == "enabled-extensions")' \
            "$STUB_STATE/gsettings.tsv" | sort))
    [ -z "$extra" ]
}

unset_after_uninstall() {
    [ -z "$(gget org.gnome.desktop.interface cursor-theme)" ] &&
        [ -z "$(gget org.gnome.desktop.interface cursor-size)" ] &&
        [ -z "$(gget org.gnome.desktop.wm.preferences titlebar-font)" ]
}

favorites_ok() {
    local value
    value=$(gget org.gnome.shell favorite-apps)
    # Welcher Browser gewinnt, haengt davon ab, welche .desktop-Dateien im
    # System liegen (auf CI-Runnern z. B. Epiphany). Geprueft wird deshalb:
    # irgendein Browser aus der Vorzugsliste plus die Dateien-App.
    case "$value" in
        *org.gnome.Nautilus.desktop*) ;;
        *) return 1 ;;
    esac
    case "$value" in
        *google-chrome.desktop*|*brave-browser.desktop*|*chromium*.desktop*|\
        *firefox.desktop*|*Epiphany.desktop*) return 0 ;;
    esac
    return 1
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
check 'Dry-Run legt keinen Cursor-Satz an' missing "$ICON_DIR"
check 'Dry-Run laesst die GTK-4-Datei des Nutzers stehen' has_text "$GTK4_FILE" 'eigene Anpassung'
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
run_stub install.sh --version >"$OUT" 2>&1
check '--version endet mit 0' eq "$?" 0
check '--version nennt die Version' has_text "$OUT" 'chromeos-theme 1.1.0'
run_stub install.sh --check >"$OUT" 2>"$ERR"
check '--check meldet vor der Installation Abweichungen' eq "$?" 1
check '--check nennt die fehlenden Teile' has_text "$ERR" 'fehlt'
check '--check legt nichts an' missing "$THEME_DIR"
check '--check schreibt keine Einstellungen' missing "$STUB_STATE/gsettings-set.log"

# --- 3. Echter Lauf --------------------------------------------------------
run_stub install.sh >"$OUT" 2>"$ERR"
check 'Installation endet mit 0' eq "$?" 0
check 'Theme-Ordner existiert' exists "$THEME_DIR"
check 'GTK-3-, GTK-4- und Shell-Theme liegen bereit' \
    bash -c '[ -f "$1/gtk-3.0/gtk.css" ] && [ -f "$1/gtk-4.0/gtk.css" ] && [ -f "$1/gnome-shell/gnome-shell.css" ]' \
    _ "$THEME_DIR"
check 'Theme ist markiert' has_text "$THEME_DIR/.chromeos-theme" 'chromeos-theme'
check 'Extension mit allen Dateien installiert' extension_files_ok
check 'Suchhelfer installiert und ausfuehrbar' bash -c '[ -x "$1" ]' _ "$HELPER"
check 'Hintergrundbild installiert' exists "$WALLPAPER"
check 'Hintergrund ist ein eigenes PNG' \
    bash -c '[ "$(od -An -tx1 -N4 "$1" | tr -d " \n")" = "89504e47" ]' _ "$WALLPAPER"
check 'Sicherung enthaelt 22 Einstellungen' \
    bash -c '[ "$(wc -l < "$1")" -eq 22 ]' _ "$BACKUP_FILE"
check 'installierte Teile festgehalten' bash -c '
    for part in theme extension helper settings wallpaper cursor gtk4 fonts; do
        grep -qxF "$part" "$1" || exit 1
    done' _ "$STATE_DIR/components.txt"
check 'Schrift Roboto liegt im Benutzerordner' bash -c '
    [ -s "$1/Roboto[wdth,wght].ttf" ] && [ -s "$1/RobotoMono[wght].ttf" ] &&
    grep -q "SIL Open Font License" "$1/OFL.txt"' _ "$FONT_DIR"
check 'Schriften sind markiert' has_text "$FONT_DIR/.chromeos-theme" 'chromeos-theme'
check 'gtk-theme ist ChromeOS' gset org.gnome.desktop.interface gtk-theme 'ChromeOS'
check 'color-scheme ist default' gset org.gnome.desktop.interface color-scheme 'default'
check 'accent-color ist blue' gset org.gnome.desktop.interface accent-color 'blue'
check 'Uhr: Datum und Wochentag an, Sekunden aus' clocks_ok
check 'Fensterknoepfe rechts' \
    gset org.gnome.desktop.wm.preferences button-layout ':minimize,maximize,close'
check 'Schrift ist Roboto 11' gset org.gnome.desktop.interface font-name 'Roboto 11'
check 'Hintergrund ist gesetzt' background_ok
check 'Mauszeiger-Satz installiert und markiert' cursor_ok
check 'Cursor-Theme erbt Adwaita' has_text "$ICON_DIR/index.theme" 'Inherits=Adwaita'
check 'cursor-theme ist ChromeOS' gset org.gnome.desktop.interface cursor-theme 'ChromeOS'
check 'cursor-size ist 24' gset org.gnome.desktop.interface cursor-size '24'
check 'Hot Corner ist aus' gset org.gnome.desktop.interface enable-hot-corners 'false'
check 'Fenster-, Dokument- und Monospace-Schrift gesetzt' fonts_ok
check 'Akku-Prozent wird angezeigt' gset org.gnome.desktop.interface show-battery-percentage 'true'
check 'DING zeigt keine Desktop-Symbole' ding_off
check 'GTK-4-Farbdatei installiert (libadwaita)' gtk4_ours
check 'GTK-4-Datei deckt hell und dunkel ab' bash -c '
    grep -q "window_bg_color #f8f9fa" "$1" &&
    grep -q "prefers-color-scheme: dark" "$1"' _ "$GTK4_FILE"
check 'Shelf-Favoriten enthalten Browser und Dateien' favorites_ok
check 'Zorin-Leisten wurden deaktiviert' bash -c '
    grep -qxF "zorin-dash@zorinos.com" "$1" && grep -qxF "zorin-menu@zorinos.com" "$1"' \
    _ "$STUB_STATE/ext-disable.log"
check 'Extension wurde aktiviert' line_is "$STUB_STATE/ext-enabled.txt" "$UUID"
check 'Installation meldet "Fertig."' has_text "$OUT" 'Fertig.'
run_stub install.sh --check >"$OUT" 2>"$ERR"
check '--check ist nach der Installation gruen' eq "$?" 0
check '--check meldet "Alles wie erwartet"' has_text "$OUT" 'Alles wie erwartet'

# --- 4. Zweiter Lauf (idempotent) -----------------------------------------
run_stub install.sh >"$OUT" 2>"$ERR"
check 'zweiter Lauf endet mit 0' eq "$?" 0
check 'Sicherung bleibt bei 22 Eintraegen' \
    bash -c '[ "$(wc -l < "$1")" -eq 22 ]' _ "$BACKUP_FILE"
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
check 'Uninstall-Dry-Run laesst Cursor und GTK-4 stehen' \
    bash -c '[ -s "$1/cursors/left_ptr" ] && grep -q chromeos-theme "$2"' \
    _ "$ICON_DIR" "$GTK4_FILE"

# --- 7. Echte Deinstallation ----------------------------------------------
run_stub uninstall.sh >"$OUT" 2>"$ERR"
check 'Deinstallation endet mit 0' eq "$?" 0
check 'Theme-Ordner entfernt' missing "$THEME_DIR"
check 'Extension, Helfer und Hintergrund entfernt' \
    bash -c '[ ! -e "$1" ] && [ ! -e "$2" ] && [ ! -e "$3" ]' \
    _ "$EXT_DIR" "$HELPER" "$WALLPAPER"
check 'Zustandsordner entfernt' missing "$STATE_DIR"
check 'Mauszeiger-Satz entfernt' missing "$ICON_DIR"
check 'Schriften entfernt' missing "$FONT_DIR"
check 'alle 22 Einstellungen exakt wiederhergestellt' settings_restored
check 'vorher nie gesetzte Keys bleiben ungesetzt' unset_after_uninstall
check 'keine zusaetzlichen Keys in der Datenbank' no_extra_keys
check 'GTK-4-Datei des Nutzers unveraendert zurueck' has_text "$GTK4_FILE" 'eigene Anpassung'
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
check 'Cursor und GTK-4 werden auch ohne GNOME installiert' \
    bash -c '[ -s "$1/cursors/left_ptr" ] && grep -q chromeos-theme "$2"' \
    _ "$ICON_DIR" "$GTK4_FILE"
run_bare uninstall.sh >"$OUT" 2>"$ERR"
check 'Deinstallation ohne GNOME endet mit 0' eq "$?" 0
check 'ohne GNOME wird trotzdem vollstaendig aufgeraeumt' \
    bash -c '[ ! -e "$1" ] && [ ! -e "$2" ] && [ ! -e "$3" ]' \
    _ "$THEME_DIR" "$EXT_DIR" "$HELPER"
check 'ohne GNOME kommt auch die GTK-4-Datei zurueck' has_text "$GTK4_FILE" 'eigene Anpassung'

# --- 9. Teilinstallation, --settings-only, zweite Deinstallation -----------
run_stub install.sh --no-cursor --no-gtk4 >"$OUT" 2>"$ERR"
check 'Teilinstallation endet mit 0' eq "$?" 0
check '--no-cursor laesst den Mauszeiger weg' missing "$ICON_DIR"
check '--no-gtk4 laesst die GTK-4-Datei des Nutzers stehen' \
    has_text "$GTK4_FILE" 'eigene Anpassung'
check 'Teilinstallation haelt nur ihre Teile fest' bash -c '
    grep -qxF theme "$1" && grep -qxF fonts "$1" && ! grep -qxF cursor "$1"' \
    _ "$STATE_DIR/components.txt"

run_stub uninstall.sh --settings-only >"$OUT" 2>"$ERR"
check '--settings-only endet mit 0' eq "$?" 0
check '--settings-only laesst die Dateien stehen' \
    bash -c '[ -f "$1/gnome-shell/gnome-shell.css" ] && [ -d "$2" ]' _ "$THEME_DIR" "$EXT_DIR"
check '--settings-only holt die Einstellungen zurueck' settings_restored
check '--settings-only behaelt den Zustandsordner' exists "$STATE_DIR"

run_stub uninstall.sh >"$OUT" 2>"$ERR"
check 'zweite Deinstallation endet mit 0' eq "$?" 0
check 'zweite Deinstallation entfernt den Rest' \
    bash -c '[ ! -e "$1" ] && [ ! -e "$2" ] && [ ! -e "$3" ]' \
    _ "$THEME_DIR" "$FONT_DIR" "$WALLPAPER"
check 'nie installierter Cursor bleibt unberuehrt' missing "$ICON_DIR"
check 'GTK-4-Datei des Nutzers bleibt beim zweiten Lauf heil' \
    has_text "$GTK4_FILE" 'eigene Anpassung'

# --- Ergebnis --------------------------------------------------------------
printf '\n%s/%s Pruefungen bestanden\n' "$PASSED" "$TOTAL"
if [ "$FAILS" -gt 0 ]; then
    printf '%s fehlgeschlagen\n' "$FAILS"
    printf '\n--- stderr des letzten Laufs ---\n'
    cat "$ERR" 2>/dev/null
    exit 1
fi
exit 0
