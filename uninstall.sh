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
# Wird gesetzt, wenn die Sicherung noch gebraucht wird (Einstellungen liessen
# sich nicht zurueckholen oder eine Datei wurde bewusst stehen gelassen).
KEEP_STATE=0
RESTORE_FAILED=0

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

# install.sh legt einen fremden Ordner gleichen Namens als .bak beiseite.
# Der gehoert dem Benutzer und kommt beim Deinstallieren zurueck.
restore_backup_dir() {
    local backup=$1 target=$2
    [ -e "$backup" ] || return 0
    if [ -e "$target" ] && [ "$DRY_RUN" -eq 0 ]; then
        warn "Sicherung bleibt liegen: $backup (Ziel $target existiert bereits)."
        return 0
    fi
    info "Hole $target aus der Sicherung zurueck"
    run mv "$backup" "$target"
}

# Ohne Komponentenliste (aeltere Installation) wird alles entfernt.
have_component() {
    [ -f "$COMPONENTS_FILE" ] || return 0
    grep -qxF -- "$1" "$COMPONENTS_FILE" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Einstellungen
# ---------------------------------------------------------------------------
# Schluessel, den diese GNOME-Version nicht kennt (z. B. accent-color unter
# GNOME 46): reset scheitert mit "No such key"/"existiert nicht". Das ist kein
# Fehler - es gibt nichts zurueckzuholen. Alles andere ist ein echter Fehlschlag.
reset_key() {
    local schema=$1 key=$2 message
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: gsettings reset %s %s\n' "$schema" "$key"
        return 0
    fi
    message=$(gsettings reset "$schema" "$key" 2>&1) && return 0
    case "$(printf '%s' "$message" | tr 'A-Z' 'a-z')" in
        *'no such key'*|*'does not exist'*|*'not found'*|*'existiert nicht'*|*'nicht vorhanden'*)
            return 0 ;;
    esac
    warn "Nicht zuruecksetzbar: $schema $key"
    RESTORE_FAILED=$((RESTORE_FAILED + 1))
}

restore_key() {
    local schema=$1 key=$2 value=$3
    if [ "$DRY_RUN" -eq 1 ]; then
        printf '      wuerde: gsettings set %s %s %s\n' "$schema" "$key" "$value"
        return 0
    fi
    gsettings set "$schema" "$key" "$value" 2>/dev/null && return 0
    warn "Nicht zuruecksetzbar: $schema $key"
    RESTORE_FAILED=$((RESTORE_FAILED + 1))
}

restore_settings() {
    if [ "$HAVE_GSETTINGS" -eq 0 ]; then
        warn "gsettings nicht verfuegbar - Einstellungen koennen nicht zurueckgesetzt werden."
        # Die Sicherung ist dann die einzige Kopie der alten Werte: nicht loeschen.
        [ -s "$BACKUP_FILE" ] && KEEP_STATE=1
        return 0
    fi
    [ -f "$BACKUP_FILE" ] || { warn "Keine gesicherten Einstellungen gefunden."; return 0; }
    info "Stelle vorherige Einstellungen wieder her"
    local schema key value
    while IFS=$'\t' read -r schema key value; do
        [ -n "${schema:-}" ] || continue
        if [ "$value" = '__UNSET__' ]; then
            # Vor der Installation nie gesetzt: kein Wert schreiben, nur reset.
            reset_key "$schema" "$key"
            continue
        fi
        restore_key "$schema" "$key" "$value"
    done < "$BACKUP_FILE"
    if [ "$DRY_RUN" -eq 0 ]; then
        if [ "$RESTORE_FAILED" -eq 0 ]; then
            ok "Einstellungen wiederhergestellt"
        else
            warn "$RESTORE_FAILED Einstellung(en) nicht zurueckgesetzt - Sicherung bleibt liegen."
            KEEP_STATE=1
        fi
    fi
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
# Extension aus den GNOME-Listen nehmen - reines Bash, kein python3:
# '['a', 'b']' zerlegen, den Eintrag weglassen, wieder zusammensetzen.
# Beide Listen: ein deaktivierter Eintrag bleibt sonst als Karteileiche in
# dconf stehen, obwohl das Theme weg ist.
# ---------------------------------------------------------------------------
strip_uuid_from_list() {
    local key=$1 current item out='' found=0
    current=$(gsettings get org.gnome.shell "$key" 2>/dev/null) || return 0
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
        printf '      wuerde: gsettings set org.gnome.shell %s [%s]\n' "$key" "$out"
    else
        gsettings set org.gnome.shell "$key" "[$out]" 2>/dev/null \
            || warn "org.gnome.shell $key nicht aenderbar."
    fi
    return 0
}

remove_from_extension_lists() {
    [ "$HAVE_GSETTINGS" -eq 1 ] || return 0
    strip_uuid_from_list enabled-extensions
    strip_uuid_from_list disabled-extensions
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

# Nichts installiert (zweiter Lauf, fremder Rechner): nichts anfassen und
# auch keine Warnungen ueber fehlende Sicherungen produzieren.
nothing_installed() {
    [ ! -e "$THEME_DIR" ] && [ ! -e "$ALT_THEME_DIR" ] && [ ! -e "$EXT_DIR" ] \
        && [ ! -e "$HELPER" ] && [ ! -e "$ICON_DIR" ] && [ ! -e "$FONT_DIR" ] \
        && [ ! -e "$STATE_DIR" ] && [ ! -e "$CONFIG_DIR" ] \
        && ! grep -q 'chromeos-theme' "$GTK4_FILE" 2>/dev/null
}

if nothing_installed; then
    remove_from_extension_lists
    info "Nichts zu entfernen - das Theme ist nicht installiert."
    exit 0
fi

# --- 1. Extension ----------------------------------------------------------
info "Extension deaktivieren"
if command -v gnome-extensions >/dev/null 2>&1; then
    run gnome-extensions disable "$EXT_UUID" 2>/dev/null || true
fi

# Falls die Shell nicht erreichbar war: UUID aus beiden Listen nehmen.
remove_from_extension_lists
if have_component extension; then
    remove_path "$EXT_DIR"
fi

# --- 2. Theme + Helfer -----------------------------------------------------
if have_component theme; then
    if [ -d "$THEME_DIR" ] && [ ! -f "$THEME_DIR/.chromeos-theme" ]; then
        warn "$THEME_DIR gehoert nicht zu diesem Theme - wird nicht geloescht."
    else
        remove_path "$THEME_DIR"
        restore_backup_dir "$THEME_DIR.bak" "$THEME_DIR"
    fi
    # ~/.themes/ChromeOS ist nur bei alten Installationen unseres Themes zu
    # finden; ein eigener Ordner gleichen Namens bleibt unangetastet.
    if [ -d "$ALT_THEME_DIR" ]; then
        if [ -f "$ALT_THEME_DIR/.chromeos-theme" ] \
            || grep -q 'chromeos-theme' "$ALT_THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null; then
            remove_path "$ALT_THEME_DIR"
        else
            warn "$ALT_THEME_DIR gehoert nicht zu diesem Theme - wird nicht geloescht."
        fi
    fi
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
        restore_backup_dir "$ICON_DIR.bak" "$ICON_DIR"
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
            if [ -f "$GTK4_BACKUP" ]; then
                warn "Die vorherige Datei liegt weiterhin in $GTK4_BACKUP."
                KEEP_STATE=1
            fi
        fi
    fi
    if [ "$DRY_RUN" -eq 0 ]; then
        rmdir "$GTK4_DIR" 2>/dev/null || true
    fi
fi

remove_path "$CONFIG_DIR"

# --- 3. Einstellungen zurueck ---------------------------------------------
restore_settings

# --- 4. Kollidierende Extensions wieder aktivieren -------------------------
reenable_conflicts

# --- 5. Zustand loeschen ---------------------------------------------------
if [ "$KEEP_STATE" -eq 1 ]; then
    warn "Sicherung bleibt in $STATE_DIR - sie wird noch gebraucht."
    warn "Spaeter erneut: uninstall.sh --settings-only"
else
    remove_path "$STATE_DIR"
fi
if [ "$DRY_RUN" -eq 0 ] && command -v fc-cache >/dev/null 2>&1; then
    fc-cache -f >/dev/null 2>&1 || true
fi

if [ "$DRY_RUN" -eq 1 ]; then
    HEADLINE="Probelauf beendet - nichts wurde geaendert."
elif [ "$KEEP_STATE" -eq 1 ]; then
    HEADLINE="Dateien entfernt - die Sicherung in $STATE_DIR bleibt erhalten."
else
    HEADLINE="Deinstallation abgeschlossen."
fi

cat <<EOF

$HEADLINE

Bitte einmal ab- und wieder anmelden, damit GNOME Shell ohne das Theme
neu startet. Der Ordner dieses Repos kann danach geloescht werden.
EOF
