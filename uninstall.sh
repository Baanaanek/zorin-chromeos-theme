#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Chromebook-Look fuer Zorin OS - vollstaendige Deinstallation
#
#   ./uninstall.sh            alles entfernen, vorherige Einstellungen zurueck
#   ./uninstall.sh --dry-run  nur anzeigen, was passieren wuerde
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
WALLPAPER="$WALL_DIR/chromeos-wallpaper.jpg"
STATE_DIR="$STATE_HOME/chromeos-theme"
BACKUP_FILE="$STATE_DIR/settings.tsv"
DISABLED_FILE="$STATE_DIR/disabled-extensions.txt"
CONFIG_DIR="$CONFIG_HOME/chromeos-theme"

DRY_RUN=0

HAVE_GSETTINGS=0
command -v gsettings >/dev/null 2>&1 && HAVE_GSETTINGS=1

usage() {
    cat <<'EOF'
ChromeOS-Theme fuer Zorin OS - Deinstallation

  ./uninstall.sh            Theme, Extension, Helfer, Hintergrund entfernen
                            und alle zuvor gesicherten Einstellungen zurueckholen
  ./uninstall.sh --dry-run  nur anzeigen, was entfernt wuerde
  ./uninstall.sh --help     diese Hilfe
EOF
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
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

# --- 1. Extension ----------------------------------------------------------
info "Extension deaktivieren"
if command -v gnome-extensions >/dev/null 2>&1; then
    run gnome-extensions disable "$EXT_UUID" 2>/dev/null || true
fi

# Falls die Shell nicht erreichbar war: UUID aus der Aktivierungsliste nehmen.
remove_from_enabled_list() {
    [ "$HAVE_GSETTINGS" -eq 1 ] || return 0
    local current updated
    current=$(gsettings get org.gnome.shell enabled-extensions 2>/dev/null) || return 0
    case "$current" in
        *"$EXT_UUID"*) ;;
        *) return 0 ;;
    esac
    command -v python3 >/dev/null 2>&1 || return 0
    updated=$(python3 - "$current" "$EXT_UUID" <<'PY'
import ast, sys
value, target = sys.argv[1], sys.argv[2]
try:
    items = ast.literal_eval(value)
except Exception:
    sys.exit(1)
print("[" + ", ".join("'" + i + "'" for i in items if i != target) + "]")
PY
) || return 0
    [ -n "$updated" ] || return 0
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: gsettings set org.gnome.shell enabled-extensions %s\n' "$updated"
    else
        gsettings set org.gnome.shell enabled-extensions "$updated" 2>/dev/null || true
    fi
}

remove_from_enabled_list
remove_path "$EXT_DIR"

# --- 2. Theme + Helfer -----------------------------------------------------
if [ -d "$THEME_DIR" ] && [ ! -f "$THEME_DIR/.chromeos-theme" ]; then
    warn "$THEME_DIR gehoert nicht zu diesem Theme - wird nicht geloescht."
else
    remove_path "$THEME_DIR"
fi
remove_path "$ALT_THEME_DIR"

if [ -f "$HELPER" ] && grep -q "chromeos-theme" "$HELPER" 2>/dev/null; then
    remove_path "$HELPER"
elif [ -f "$HELPER" ]; then
    warn "$HELPER stammt nicht von diesem Theme - bleibt erhalten."
fi

remove_path "$WALLPAPER"
remove_path "$CONFIG_DIR"

# --- 3. Einstellungen zurueck ---------------------------------------------
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
        if [ "$DRY_RUN" -eq 1 ]; then
            printf '      wuerde: gsettings set %s %s %s\n' "$schema" "$key" "$value"
            continue
        fi
        gsettings set "$schema" "$key" "$value" 2>/dev/null \
            || warn "Nicht zuruecksetzbar: $schema $key"
    done < "$BACKUP_FILE"
    [ "$DRY_RUN" -eq 0 ] && ok "Einstellungen wiederhergestellt"
}

restore_settings

# --- 4. Kollidierende Extensions wieder aktivieren -------------------------
if [ -f "$DISABLED_FILE" ] && command -v gnome-extensions >/dev/null 2>&1; then
    info "Reaktiviere zuvor deaktivierte Leisten"
    while read -r uuid; do
        [ -n "${uuid:-}" ] || continue
        run gnome-extensions enable "$uuid" 2>/dev/null || warn "Nicht reaktivierbar: $uuid"
    done < "$DISABLED_FILE"
fi

# --- 5. Zustand loeschen ---------------------------------------------------
remove_path "$STATE_DIR"

cat <<EOF

$( [ "$DRY_RUN" -eq 1 ] && echo "Probelauf beendet - nichts wurde geaendert." || echo "Deinstallation abgeschlossen." )

Bitte einmal ab- und wieder anmelden, damit GNOME Shell ohne das Theme
neu startet. Der Ordner dieses Repos kann danach geloescht werden.
EOF
