#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ChromeOS-Look fuer Zorin OS  (GNOME Shell 45-48, Zorin OS 18 = GNOME 46)
#
#   ./install.sh              installieren (oder erneut ausfuehren)
#   ./install.sh --activate   nur Theme-Schluessel + Extension aktivieren
#   ./install.sh --dry-run    zeigen, was passieren wuerde
#
# Alles landet im Benutzer-Home, es wird kein sudo gebraucht.
# Vorher gesetzte Einstellungen werden gesichert und von uninstall.sh
# wiederhergestellt. Ohne GNOME-Sitzung (kein gsettings/gnome-shell) werden
# nur die Dateien installiert; es gibt dann keinen Abbruch.
# ---------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

THEME_NAME="ChromeOS"
EXT_UUID="chromeos-shell@baanaanek.github.io"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
THEME_DIR="$DATA_HOME/themes/$THEME_NAME"
EXT_DIR="$DATA_HOME/gnome-shell/extensions/$EXT_UUID"
BIN_DIR="$HOME/.local/bin"
WALL_DIR="$DATA_HOME/backgrounds"
STATE_DIR="$STATE_HOME/chromeos-theme"
BACKUP_FILE="$STATE_DIR/settings.tsv"
DISABLED_FILE="$STATE_DIR/disabled-extensions.txt"
WALLPAPER="$WALL_DIR/chromeos-wallpaper.jpg"

DRY_RUN=0
ACTIVATE_ONLY=0
SKIPPED=""

usage() {
    cat <<'EOF'
ChromeOS-Theme fuer Zorin OS

  ./install.sh              Theme, Extension, Hintergrund installieren
  ./install.sh --activate   nur Einstellungen setzen und Extension aktivieren
                            (nach dem ersten Ab-/Anmelden nuetzlich)
  ./install.sh --dry-run    nur anzeigen, was geaendert wuerde
  ./install.sh --help       diese Hilfe

Deinstallation: ./uninstall.sh
EOF
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --activate) ACTIVATE_ONLY=1 ;;
        -h|--help) usage; exit 0 ;;
        *) printf 'Unbekannte Option: %s\n\n' "$arg"; usage; exit 2 ;;
    esac
done

# --- Ausgabe ---------------------------------------------------------------
if [ -t 1 ]; then
    C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'
    C_RED=$'\033[1;31m'; C_OFF=$'\033[0m'
else
    C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_OFF=''
fi

info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_OFF" "$*"; }
ok()   { printf '%s  ok%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s   !%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }
die()  { printf '%s   x%s %s\n' "$C_RED" "$C_OFF" "$*" >&2; exit 1; }

skip() {
    warn "$*"
    SKIPPED="${SKIPPED}  - $*"$'\n'
}

run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: %s\n' "$*"
        return 0
    fi
    "$@"
}

# --- Voraussetzungen -------------------------------------------------------
[ -f "$SCRIPT_DIR/theme/$THEME_NAME/gnome-shell/gnome-shell.css" ] \
    || die "Theme-Dateien fehlen. Bitte das komplette Repo verwenden (nicht nur install.sh kopieren)."
[ -d "$SCRIPT_DIR/extension/$EXT_UUID" ] \
    || die "Extension-Ordner fehlt: extension/$EXT_UUID"

HAVE_GSETTINGS=0
if command -v gsettings >/dev/null 2>&1; then
    HAVE_GSETTINGS=1
else
    skip "gsettings nicht gefunden (keine GNOME-Sitzung) - Einstellungen werden uebersprungen."
fi

HAVE_GNOME_EXT=0
command -v gnome-extensions >/dev/null 2>&1 && HAVE_GNOME_EXT=1

SHELL_MAJOR=""
if command -v gnome-shell >/dev/null 2>&1; then
    SHELL_MAJOR=$(gnome-shell --version 2>/dev/null | awk '{print $3}' | cut -d. -f1)
    case "$SHELL_MAJOR" in
        ''|*[!0-9]*) SHELL_MAJOR="" ;;
    esac
fi

if [ -z "$SHELL_MAJOR" ]; then
    skip "gnome-shell nicht gefunden - Shell-/GTK-Theme wird kopiert, Extension bleibt inaktiv."
elif [ "$SHELL_MAJOR" -lt 45 ]; then
    skip "GNOME Shell $SHELL_MAJOR erkannt: Die Shell-Extension braucht GNOME 45+ (Zorin OS 18)."
    skip "GTK-Theme, Hintergrund und Suchhelfer werden trotzdem installiert."
fi

if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$STATE_DIR" "$CONFIG_HOME"
    [ -f "$BACKUP_FILE" ] || : > "$BACKUP_FILE"
fi

# --- Helfer ----------------------------------------------------------------
backup_key() {
    local schema=$1 key=$2 value
    [ "$HAVE_GSETTINGS" -eq 1 ] || return 0
    [ "$DRY_RUN" -eq 0 ] || return 0
    if awk -F'\t' -v s="$schema" -v k="$key" '$1==s && $2==k {f=1} END {exit !f}' \
        "$BACKUP_FILE" 2>/dev/null; then
        return 0
    fi
    value=$(gsettings get "$schema" "$key" 2>/dev/null) || return 0
    printf '%s\t%s\t%s\n' "$schema" "$key" "$value" >> "$BACKUP_FILE"
}

set_key() {
    local schema=$1 key=$2 value=$3
    [ "$HAVE_GSETTINGS" -eq 1 ] || return 0
    backup_key "$schema" "$key"
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: gsettings set %s %s %s\n' "$schema" "$key" "$value"
        return 0
    fi
    gsettings set "$schema" "$key" "$value" 2>/dev/null \
        || warn "Schluessel nicht setzbar: $schema $key"
}

desktop_id_exists() {
    local id=$1 dir
    for dir in "$DATA_HOME/applications" "/usr/share/applications" \
               "/var/lib/flatpak/exports/share/applications" \
               "$DATA_HOME/flatpak/exports/share/applications"; do
        [ -f "$dir/$id" ] && return 0
    done
    return 1
}

pick_desktop() {
    local id
    for id in "$@"; do
        desktop_id_exists "$id" && { printf '%s' "$id"; return 0; }
    done
    return 1
}

variant_list() {
    local out='[' first=1 item
    for item in "$@"; do
        [ "$first" -eq 0 ] && out+=', '
        out+="'$item'"
        first=0
    done
    printf '%s]' "$out"
}

# Reiner Bash-URI: keine python3-Abhaengigkeit.
file_uri() {
    local path=$1
    path=${path//%/%25}
    path=${path// /%20}
    path=${path//#/%23}
    path=${path//\?/%3F}
    printf 'file://%s' "$path"
}

# --- 1. Dateien ------------------------------------------------------------
install_files() {
    info "Theme nach $THEME_DIR"
    if [ -d "$THEME_DIR" ]; then
        if [ -f "$THEME_DIR/.chromeos-theme" ]; then
            run rm -rf "$THEME_DIR"
        else
            warn "Vorhandenes Theme ohne Markierung - wird gesichert: $THEME_DIR.bak"
            run mv "$THEME_DIR" "$THEME_DIR.bak"
        fi
    fi
    run mkdir -p "$(dirname "$THEME_DIR")"
    run cp -a "$SCRIPT_DIR/theme/$THEME_NAME" "$THEME_DIR"
    if [ "$DRY_RUN" -eq 0 ]; then
        printf 'chromeos-theme\n' > "$THEME_DIR/.chromeos-theme"
    fi

    info "Extension nach $EXT_DIR"
    run mkdir -p "$EXT_DIR"
    run cp -a "$SCRIPT_DIR/extension/$EXT_UUID/." "$EXT_DIR/"

    info "Suchhelfer nach $BIN_DIR/chromeos-search-url"
    run mkdir -p "$BIN_DIR"
    run cp -a "$SCRIPT_DIR/bin/chromeos-search-url" "$BIN_DIR/chromeos-search-url"
    run chmod 755 "$BIN_DIR/chromeos-search-url"
    case ":$PATH:" in
        *":$BIN_DIR:"*) ;;
        *) warn "$BIN_DIR ist nicht im PATH - der Launcher nutzt den absoluten Pfad trotzdem." ;;
    esac

    info "Hintergrundbild nach $WALLPAPER"
    run mkdir -p "$WALL_DIR"
    run cp -a "$SCRIPT_DIR/assets/wallpapers/chromeos-blue.jpg" "$WALLPAPER"
}

# --- 2. Einstellungen ------------------------------------------------------
apply_settings() {
    if [ "$HAVE_GSETTINGS" -eq 0 ]; then
        return 0
    fi

    info "Einstellungen setzen"
    set_key org.gnome.desktop.interface gtk-theme "ChromeOS"
    set_key org.gnome.desktop.interface color-scheme "default"
    set_key org.gnome.desktop.interface accent-color "blue"   # GNOME 47+
    set_key org.gnome.desktop.interface clock-show-date "true"
    set_key org.gnome.desktop.interface clock-show-weekday "true"
    set_key org.gnome.desktop.interface clock-show-seconds "false"

    local font_match=""
    command -v fc-match >/dev/null 2>&1 && font_match=$(fc-match "Roboto" 2>/dev/null)
    if printf '%s' "$font_match" | grep -qi roboto; then
        set_key org.gnome.desktop.interface font-name "Roboto 11"
    else
        warn "Roboto nicht installiert - Systemschrift bleibt (optional: sudo apt install fonts-roboto)."
    fi

    set_key org.gnome.desktop.wm.preferences button-layout ":minimize,maximize,close"

    if [ "$DRY_RUN" -eq 0 ] && [ -f "$WALLPAPER" ]; then
        set_key org.gnome.desktop.background picture-uri "$(file_uri "$WALLPAPER")"
        set_key org.gnome.desktop.background picture-uri-dark "$(file_uri "$WALLPAPER")"
        set_key org.gnome.desktop.background picture-options "zoom"
    fi

    local favorites=() id
    id=$(pick_desktop google-chrome.desktop brave-browser.desktop chromium.desktop \
                      chromium-browser.desktop firefox.desktop \
                      org.gnome.Epiphany.desktop) && favorites+=("$id")
    id=$(pick_desktop org.gnome.Nautilus.desktop nautilus.desktop org.gnome.Files.desktop) \
        && favorites+=("$id")
    id=$(pick_desktop org.gnome.Settings.desktop gnome-control-center.desktop) \
        && favorites+=("$id")
    id=$(pick_desktop org.gnome.TextEditor.desktop org.gnome.gedit.desktop) \
        && favorites+=("$id")
    id=$(pick_desktop org.gnome.Terminal.desktop org.gnome.Console.desktop) \
        && favorites+=("$id")

    if [ "${#favorites[@]}" -gt 0 ]; then
        set_key org.gnome.shell favorite-apps "$(variant_list "${favorites[@]}")"
    else
        warn "Keine bekannten Apps fuer die Shelf gefunden - Favoriten bleiben unveraendert."
    fi
}

# --- 3. Extension ----------------------------------------------------------
EXT_CONFLICT_REGEX='zorin-(dash|panel|menu|taskbar)|dash-to-dock|dash-to-panel|ubuntu-dock|arcmenu'

extension_available() {
    [ "$HAVE_GNOME_EXT" -eq 1 ] || return 1
    local installed
    # Erst einsammeln, dann vergleichen: `... | grep -q` wuerde unter
    # `set -o pipefail` durch SIGPIPE (141) faelschlich fehlschlagen.
    installed=$(gnome-extensions list 2>/dev/null) || return 1
    printf '%s\n' "$installed" | grep -qxF "$EXT_UUID"
}

disable_conflicts() {
    [ "$HAVE_GNOME_EXT" -eq 1 ] || return 0
    local uuid
    for uuid in $(gnome-extensions list --enabled 2>/dev/null); do
        [ "$uuid" = "$EXT_UUID" ] && continue
        printf '%s\n' "$uuid" | grep -qiE "$EXT_CONFLICT_REGEX" || continue

        info "Deaktiviere kollidierende Leiste: $uuid"
        if [ "$DRY_RUN" -eq 1 ]; then
            printf '      wuerde: gnome-extensions disable %s\n' "$uuid"
        elif gnome-extensions disable "$uuid" 2>/dev/null; then
            grep -qxF "$uuid" "$DISABLED_FILE" 2>/dev/null || printf '%s\n' "$uuid" >> "$DISABLED_FILE"
            ok "$uuid deaktiviert"
        else
            warn "$uuid liess sich nicht deaktivieren"
        fi
    done
}

activate_extension() {
    if [ -n "$SHELL_MAJOR" ] && [ "$SHELL_MAJOR" -lt 45 ]; then
        return 0
    fi
    if [ "$HAVE_GNOME_EXT" -eq 0 ]; then
        skip "gnome-extensions nicht gefunden - Extension wurde kopiert, aber nicht aktiviert."
        return 0
    fi
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: gnome-extensions enable %s\n' "$EXT_UUID"
        return 0
    fi
    if extension_available; then
        if gnome-extensions enable "$EXT_UUID" 2>/dev/null; then
            ok "Extension $EXT_UUID aktiviert"
        else
            skip "Aktivierung erst nach dem Ab- und Anmelden moeglich (danach: ./install.sh --activate)."
        fi
    else
        skip "Extension ist in dieser Sitzung noch unbekannt (nach dem Anmelden: ./install.sh --activate)."
    fi
}

# --- Ablauf ----------------------------------------------------------------
if [ "$ACTIVATE_ONLY" -eq 0 ]; then
    install_files
    apply_settings
    disable_conflicts
else
    info "Nur aktivieren (Dateien bleiben unveraendert)"
    apply_settings
fi

activate_extension

printf '\n'
if [ "$DRY_RUN" -eq 1 ]; then
    echo "Probelauf beendet - nichts wurde geaendert."
else
    echo "Fertig."
fi
[ -n "$SKIPPED" ] && printf '\nUebersprungen:\n%s' "$SKIPPED"

cat <<EOF

Naechster Schritt: abmelden und wieder anmelden (Wayland: komplett neu einloggen),
damit GNOME Shell das Theme und die Extension laedt.

Danach:
  * runder Knopf links unten oder Supertaste  -> ChromeOS-Launcher
  * Tippen im Launcher                        -> Apps filtern, Enter oeffnet
  * Uhr / Status rechts unten                 -> Kalender / Schnelleinstellungen
  * Websuche nutzt die Suchmaschine des Standardbrowsers
    (Override: $CONFIG_HOME/chromeos-theme/config.json)

Theme-Schalter GTK: Einstellungen > Darstellung > ChromeOS
Deinstallieren: $SCRIPT_DIR/uninstall.sh
EOF
