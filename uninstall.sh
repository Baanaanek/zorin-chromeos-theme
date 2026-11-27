#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Chromebook-Look fuer Zorin OS - vollstaendige Deinstallation
#
#   ./uninstall.sh                 alles entfernen, vorherige Einstellungen zurueck
#   ./uninstall.sh --dry-run       nur anzeigen, was entfernt wuerde
#   ./uninstall.sh --settings-only nur Einstellungen zurueckholen, Dateien bleiben
# ---------------------------------------------------------------------------
set -uo pipefail

THEME_NAME="ChromeOS"
EXT_UUID="chromeos-shell@baanaanek.github.io"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
STATE_HOME="${XDG_STATE_HOME:-$HOME/.local/state}"
THEME_DIR="$DATA_HOME/themes/$THEME_NAME"
ALT_THEME_DIR="$HOME/.themes/$THEME_NAME"
EXT_DIR="$DATA_HOME/gnome-shell/extensions/$EXT_UUID"
HELPER="$HOME/.local/bin/chromeos-search-url"
WALL_DIR="$DATA_HOME/backgrounds"
WALLPAPER="$WALL_DIR/chromeos-wallpaper.png"
WALLPAPER_LEGACY="$WALL_DIR/chromeos-wallpaper.jpg"
ICON_DIR="$DATA_HOME/icons/$THEME_NAME"
FONT_DIR="$DATA_HOME/fonts/$THEME_NAME"
GTK4_DIR="$CONFIG_HOME/gtk-4.0"
GTK4_FILE="$GTK4_DIR/gtk.css"
STATE_DIR="$STATE_HOME/chromeos-theme"
BACKUP_FILE="$STATE_DIR/settings.tsv"
GTK4_BACKUP="$STATE_DIR/gtk-4.0-gtk.css.before"
DISABLED_FILE="$STATE_DIR/disabled-extensions.txt"
COMPONENTS_FILE="$STATE_DIR/components.txt"
CONFIG_DIR="$CONFIG_HOME/chromeos-theme"

DRY_RUN=0
SETTINGS_ONLY=0

HAVE_GSETTINGS=0
command -v gsettings >/dev/null 2>&1 && HAVE_GSETTINGS=1

usage() {
    cat <<'EOF'
ChromeOS-Theme fuer Zorin OS - Deinstallation

  ./uninstall.sh                 Theme, Extension, Helfer, Hintergrund entfernen
                                 und alle zuvor gesicherten Einstellungen zurueck
  ./uninstall.sh --dry-run       nur anzeigen, was entfernt wuerde
  ./uninstall.sh --settings-only nur Einstellungen zurueckholen, Dateien bleiben
  ./uninstall.sh --help          diese Hilfe
EOF
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --settings-only) SETTINGS_ONLY=1 ;;
        -h|--help) usage; exit 0 ;;
        *) printf 'Unbekannte Option: %s\n\n' "$arg"; usage; exit 2 ;;
    esac
done

if [ -t 1 ]; then
    C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'; C_YELLOW=$'\033[1;33m'
    C_RED=$'\033[1;31m'; C_OFF=$'\033[0m'
else
    C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_OFF=''
fi
info() { printf '%s==>%s %s\n' "$C_BLUE" "$C_OFF" "$*"; }
ok()   { printf '%s  ok%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s   !%s %s\n' "$C_YELLOW" "$C_OFF" "$*" >&2; }

run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: %s\n' "$*"
        return 0
    fi
    "$@"
}

remove_path() {
    local path=$1
    if [ -e "$path" ] || [ -L "$path" ]; then
        info "Entferne $path"
        run rm -rf "$path"
    fi
}

# Ohne Komponentenliste (aeltere Installation) wird alles entfernt.
have_component() {
    [ -f "$COMPONENTS_FILE" ] || return 0
    grep -qxF -- "$1" "$COMPONENTS_FILE" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Einstellungen
# ---------------------------------------------------------------------------
restore_settings() {
    if [ "$HAVE_GSETTINGS" -eq 0 ]; then
        warn "gsettings nicht verfuegbar - Einstellungen koennen nicht zurueckgesetzt werden."
        return 0
    fi
    [ -f "$BACKUP_FILE" ] || { warn "Keine gesicherten Einstellungen gefunden."; return 0; }
    info "Stelle vorherige Einstellungen wieder her"
    local schema key value
    while IFS=$'\t' read -r schema key value; do
        [ -n "${schema:-}" ] || continue
        if [ "$value" = '__UNSET__' ]; then
            # Vor der Installation nie gesetzt: kein Wert schreiben, nur reset.
            if [ "$DRY_RUN" -eq 1 ]; then
                printf '      wuerde: gsettings reset %s %s\n' "$schema" "$key"
                continue
            fi
            gsettings reset "$schema" "$key" 2>/dev/null \
                || warn "Nicht zuruecksetzbar: $schema $key"
            continue
        fi
        if [ "$DRY_RUN" -eq 1 ]; then
            printf '      wuerde: gsettings set %s %s %s\n' "$schema" "$key" "$value"
            continue
        fi
        gsettings set "$schema" "$key" "$value" 2>/dev/null \
            || warn "Nicht zuruecksetzbar: $schema $key"
    done < "$BACKUP_FILE"
    [ "$DRY_RUN" -eq 0 ] && ok "Einstellungen wiederhergestellt"
    return 0
}

reenable_conflicts() {
    [ -f "$DISABLED_FILE" ] || return 0
    command -v gnome-extensions >/dev/null 2>&1 || return 0
    info "Reaktiviere zuvor deaktivierte Leisten"
    local uuid
    while read -r uuid; do
        [ -n "${uuid:-}" ] || continue
        run gnome-extensions enable "$uuid" 2>/dev/null || warn "Nicht reaktivierbar: $uuid"
    done < "$DISABLED_FILE"
    return 0
}

# ---------------------------------------------------------------------------
# Extension aus der Aktivierungsliste nehmen - reines Bash, kein python3:
# '['a', 'b']' zerlegen, den Eintrag weglassen, wieder zusammensetzen.
# ---------------------------------------------------------------------------
remove_from_enabled_list() {
    [ "$HAVE_GSETTINGS" -eq 1 ] || return 0
    local current item out='' found=0
    current=$(gsettings get org.gnome.shell enabled-extensions 2>/dev/null) || return 0
    case "$current" in
        *"$EXT_UUID"*) ;;
        *) return 0 ;;
    esac
    current=${current#@as }
    current=${current#[}
    current=${current%]}
    local IFS=,
    for item in $current; do
        item=${item# }
        item=${item% }
        item=${item#\'}
        item=${item%\'}
        [ -z "$item" ] && continue
        [ "$item" = "$EXT_UUID" ] && { found=1; continue; }
        out+="${out:+, }'$item'"
    done
    [ "$found" -eq 1 ] || return 0
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: gsettings set org.gnome.shell enabled-extensions [%s]\n' "$out"
    else
        gsettings set org.gnome.shell enabled-extensions "[$out]" 2>/dev/null \
            || warn "enabled-extensions nicht aenderbar."
    fi
    return 0
}

# ---------------------------------------------------------------------------
# Ablauf
# ---------------------------------------------------------------------------
if [ "$SETTINGS_ONLY" -eq 1 ]; then
    info "Nur Einstellungen zurueckholen (Dateien bleiben liegen)"
    restore_settings
    reenable_conflicts
    [ "$DRY_RUN" -eq 0 ] && ok "Fertig - Dateien mit ./uninstall.sh entfernen"
    exit 0
fi

# --- 1. Extension ----------------------------------------------------------
info "Extension deaktivieren"
if command -v gnome-extensions >/dev/null 2>&1; then
    run gnome-extensions disable "$EXT_UUID" 2>/dev/null || true
fi

# Falls die Shell nicht erreichbar war: UUID aus der Aktivierungsliste nehmen.
remove_from_enabled_list
if have_component extension; then
    remove_path "$EXT_DIR"
fi

# --- 2. Theme + Helfer -----------------------------------------------------
if have_component theme; then
    if [ -d "$THEME_DIR" ] && [ ! -f "$THEME_DIR/.chromeos-theme" ]; then
        warn "$THEME_DIR gehoert nicht zu diesem Theme - wird nicht geloescht."
    else
        remove_path "$THEME_DIR"
    fi
    remove_path "$ALT_THEME_DIR"
fi

if have_component helper; then
    if [ -f "$HELPER" ] && grep -q "chromeos-theme" "$HELPER" 2>/dev/null; then
        remove_path "$HELPER"
    elif [ -f "$HELPER" ]; then
        warn "$HELPER stammt nicht von diesem Theme - bleibt erhalten."
    fi
fi

# --- 2b. Mauszeiger, Schriften, GTK-4 --------------------------------------
if have_component cursor; then
    if [ -d "$ICON_DIR" ] && [ ! -f "$ICON_DIR/.chromeos-theme" ]; then
        warn "$ICON_DIR gehoert nicht zu diesem Theme - wird nicht geloescht."
    else
        remove_path "$ICON_DIR"
    fi
fi

if have_component fonts; then
    if [ -d "$FONT_DIR" ] && [ ! -f "$FONT_DIR/.chromeos-theme" ]; then
        warn "$FONT_DIR gehoert nicht zu diesem Theme - wird nicht geloescht."
    else
        remove_path "$FONT_DIR"
    fi
fi

if have_component gtk4; then
    if [ -f "$GTK4_FILE" ]; then
        if grep -q 'chromeos-theme' "$GTK4_FILE" 2>/dev/null; then
            remove_path "$GTK4_FILE"
            if [ -f "$GTK4_BACKUP" ]; then
                info "Stelle vorherige GTK-4-Datei wieder her"
                run mv "$GTK4_BACKUP" "$GTK4_FILE"
            fi
        else
            warn "$GTK4_FILE stammt nicht von diesem Theme - bleibt erhalten."
        fi
    fi
    if [ "$DRY_RUN" -eq 0 ]; then
        rmdir "$GTK4_DIR" 2>/dev/null || true
    fi
fi

if have_component wallpaper; then
    remove_path "$WALLPAPER"
    # Aeltere Installationen haben noch ein JPG.
    remove_path "$WALLPAPER_LEGACY"
fi

remove_path "$CONFIG_DIR"

# --- 3. Einstellungen zurueck ---------------------------------------------
restore_settings

# --- 4. Kollidierende Extensions wieder aktivieren -------------------------
reenable_conflicts

# --- 5. Zustand loeschen ---------------------------------------------------
remove_path "$STATE_DIR"
if [ "$DRY_RUN" -eq 0 ] && command -v fc-cache >/dev/null 2>&1; then
    fc-cache -f >/dev/null 2>&1 || true
fi

cat <<EOF

$( [ "$DRY_RUN" -eq 1 ] && echo "Probelauf beendet - nichts wurde geaendert." || echo "Deinstallation abgeschlossen." )

Bitte einmal ab- und wieder anmelden, damit GNOME Shell ohne das Theme
neu startet. Der Ordner dieses Repos kann danach geloescht werden.
EOF
