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
STATE_DIR="$STATE_HOME/chromeos-theme"
BACKUP_FILE="$STATE_DIR/settings.tsv"
DISABLED_FILE="$STATE_DIR/disabled-extensions.txt"
CURSOR_NAME="$THEME_NAME"
CURSOR_SRC="$SCRIPT_DIR/cursor/$CURSOR_NAME"
ICON_DIR="$DATA_HOME/icons/$CURSOR_NAME"
GTK4_DIR="$CONFIG_HOME/gtk-4.0"
GTK4_FILE="$GTK4_DIR/gtk.css"
GTK4_BACKUP="$STATE_DIR/gtk-4.0-gtk.css.before"
FONT_DIR="$DATA_HOME/fonts/ChromeOS"
FONT_SRC="$SCRIPT_DIR/fonts"
COMPONENTS_FILE="$STATE_DIR/components.txt"
VERSION="1.1.0"

DRY_RUN=0
ACTIVATE_ONLY=0
CHECK_ONLY=0
SKIPPED=""
OPT_CURSOR=1
OPT_GTK4=1
OPT_DING=1
OPT_FONTS=1

usage() {
    cat <<'EOF'
ChromeOS-Theme fuer Zorin OS

  ./install.sh              Theme und Extension installieren
  ./install.sh --activate   nur Einstellungen setzen und Extension aktivieren
                            (nach dem ersten Ab-/Anmelden nuetzlich)
  ./install.sh --check      Ist-Zustand gegen Soll pruefen (Exit 1 bei Abweichung)
  ./install.sh --dry-run    nur anzeigen, was geaendert wuerde
  ./install.sh --version    Version dieses Skripts
  ./install.sh --help       diese Hilfe

Teile weglassen (bleiben dann unangetastet, auch beim Deinstallieren):
  --no-cursor --no-gtk4 --no-ding --no-fonts

Deinstallation: ./uninstall.sh
EOF
}

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        --activate) ACTIVATE_ONLY=1 ;;
        --check) CHECK_ONLY=1 ;;
        --no-cursor) OPT_CURSOR=0 ;;
        --no-gtk4) OPT_GTK4=0 ;;
        --no-ding) OPT_DING=0 ;;
        --no-fonts) OPT_FONTS=0 ;;
        --version) printf 'chromeos-theme %s\n' "$VERSION"; exit 0 ;;
        -h|--help) usage; exit 0 ;;
        *) printf 'Unbekannte Option: %s\n\n' "$arg"; usage; exit 2 ;;
    esac
done

# Das Theme gehoert in das Home des angemeldeten Benutzers. Mit sudo landet es
# in /root und aendert fuer den echten Benutzer nichts.
if [ "$(id -u)" -eq 0 ] && [ -z "${CHROMEOS_THEME_ALLOW_ROOT:-}" ]; then
    printf 'Bitte ohne sudo starten: das Theme gehoert in dein Benutzer-Home.\n' >&2
    exit 1
fi

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
[ -f "$SCRIPT_DIR/theme/$THEME_NAME/gnome-shell/gnome-shell-dark.css" ] \
    || die "Dunkle Shell-CSS fehlt: theme/$THEME_NAME/gnome-shell/gnome-shell-dark.css"
[ -d "$SCRIPT_DIR/extension/$EXT_UUID" ] \
    || die "Extension-Ordner fehlt: extension/$EXT_UUID"
[ -f "$SCRIPT_DIR/theme/$THEME_NAME/gtk-4.0/gtk.css" ] \
    || die "GTK-4-Farbdatei fehlt: theme/$THEME_NAME/gtk-4.0/gtk.css"
[ -d "$CURSOR_SRC/cursors" ] \
    || die "Cursor-Satz fehlt: cursor/$CURSOR_NAME (mit tools/build-cursors.mjs erzeugen)"

HAVE_GSETTINGS=0
if command -v gsettings >/dev/null 2>&1; then
    HAVE_GSETTINGS=1
else
    skip "gsettings nicht gefunden (keine GNOME-Sitzung) - Einstellungen werden uebersprungen."
fi

HAVE_GNOME_EXT=0
command -v gnome-extensions >/dev/null 2>&1 && HAVE_GNOME_EXT=1

HAVE_DCONF=0
command -v dconf >/dev/null 2>&1 && HAVE_DCONF=1

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

if [ "$DRY_RUN" -eq 0 ] && [ "$CHECK_ONLY" -eq 0 ]; then
    mkdir -p "$STATE_DIR" "$CONFIG_HOME"
    [ -f "$BACKUP_FILE" ] || : > "$BACKUP_FILE"
fi

# --- Helfer ----------------------------------------------------------------
# dconf-Pfad eines Schemas: org.gnome.desktop.interface -> /org/gnome/desktop/interface/
dconf_path() {
    printf '/%s/' "${1//./\/}"
}

backup_key() {
    local schema=$1 key=$2 value state
    [ "$HAVE_GSETTINGS" -eq 1 ] || return 0
    [ "$DRY_RUN" -eq 0 ] || return 0
    if awk -F'\t' -v s="$schema" -v k="$key" '$1==s && $2==k {f=1} END {exit !f}' \
        "$BACKUP_FILE" 2>/dev/null; then
        return 0
    fi
    value=$(gsettings get "$schema" "$key" 2>/dev/null) || value=""
    state=$value
    if [ -z "$value" ]; then
        # Schluessel existiert in dieser GNOME-Version nicht.
        state='__UNSET__'
    elif [ "$HAVE_DCONF" -eq 1 ] \
        && [ -z "$(dconf read "$(dconf_path "$schema")$key" 2>/dev/null)" ]; then
        # Nie explizit gesetzt: uninstall.sh setzt den Schluessel per reset zurueck.
        state='__UNSET__'
    fi
    printf '%s\t%s\t%s\n' "$schema" "$key" "$state" >> "$BACKUP_FILE"
}

have_schema() {
    [ "$HAVE_GSETTINGS" -eq 1 ] || return 1
    gsettings list-schemas 2>/dev/null | grep -qxF -- "$1"
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
    info "Mauszeiger nach $ICON_DIR"
    if [ "$OPT_CURSOR" -eq 1 ]; then
        if [ -d "$ICON_DIR" ]; then
            if [ -f "$ICON_DIR/.chromeos-theme" ]; then
                run rm -rf "$ICON_DIR"
            else
                warn "Vorhandener Mauszeiger-Satz ohne Markierung - wird gesichert: $ICON_DIR.bak"
                run mv "$ICON_DIR" "$ICON_DIR.bak"
            fi
        fi
        run mkdir -p "$ICON_DIR"
        run cp -a "$SCRIPT_DIR/cursor/$CURSOR_NAME/." "$ICON_DIR/"
        if [ "$DRY_RUN" -eq 0 ]; then
            printf 'chromeos-theme\n' > "$ICON_DIR/.chromeos-theme"
        fi
    else
        skip "Mauszeiger uebersprungen (--no-cursor)."
    fi

    if [ "$OPT_FONTS" -eq 1 ]; then
        info "Schrift Roboto nach $FONT_DIR (SIL OFL 1.1, liegt im Repo)"
        run mkdir -p "$FONT_DIR"
        run cp -a "$FONT_SRC/." "$FONT_DIR/"
        if [ "$DRY_RUN" -eq 0 ]; then
            printf 'chromeos-theme\n' > "$FONT_DIR/.chromeos-theme"
        fi
        if [ "$DRY_RUN" -eq 0 ] && command -v fc-cache >/dev/null 2>&1; then
            fc-cache -f "$FONT_DIR" >/dev/null 2>&1 || warn "fc-cache lief nicht durch - Schrift greift nach dem naechsten Anmelden."
        fi
    else
        skip "Schriften uebersprungen (--no-fonts)."
    fi

    info "GTK-4-Farben nach $GTK4_FILE (libadwaita ignoriert gtk-theme)"
    if [ "$OPT_GTK4" -eq 1 ]; then
        run mkdir -p "$GTK4_DIR"
        if [ -f "$GTK4_FILE" ] && ! grep -q 'chromeos-theme' "$GTK4_FILE" 2>/dev/null; then
            info "Vorhandene GTK-4-Datei wird gesichert"
            run cp -a "$GTK4_FILE" "$GTK4_BACKUP"
        fi
        run cp -a "$SCRIPT_DIR/theme/$THEME_NAME/gtk-4.0/gtk.css" "$GTK4_FILE"
    else
        skip "GTK-4-Farben uebersprungen (--no-gtk4)."
    fi
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

    # ChromeOS-Schrift: Roboto ist frei verfuegbar. Fehlt sie, greift fontconfig
    # auf eine metrisch aehnliche Schrift zurueck; die Keys werden trotzdem gesetzt.
    local font_match=""
    command -v fc-match >/dev/null 2>&1 && font_match=$(fc-match "Roboto" 2>/dev/null)
    if ! printf '%s' "$font_match" | grep -qi roboto; then
        warn "Roboto nicht installiert - der Look nutzt die Fallback-Schrift (optional: sudo apt install fonts-roboto)."
    fi
    set_key org.gnome.desktop.interface font-name "Roboto 11"
    set_key org.gnome.desktop.wm.preferences titlebar-font "Roboto 11"
    set_key org.gnome.desktop.interface document-font-name "Roboto 11"
    set_key org.gnome.desktop.interface monospace-font-name "Roboto Mono 10"

    if [ "$OPT_CURSOR" -eq 1 ]; then
        set_key org.gnome.desktop.interface cursor-theme "$CURSOR_NAME"
        set_key org.gnome.desktop.interface cursor-size "24"
    else
        skip "Mauszeiger-Einstellungen uebersprungen (--no-cursor)."
    fi

    # Der GNOME-Hot-Corner (oben links) existiert in ChromeOS nicht.
    set_key org.gnome.desktop.interface enable-hot-corners "false"

    # Akku-Prozent neben dem Symbol zeigt ChromeOS dauerhaft an.
    set_key org.gnome.desktop.interface show-battery-percentage "true"

    # ChromeOS hat keinen Desktop: DING zeigt keine Symbole mehr.
    if [ "$OPT_DING" -eq 0 ]; then
        skip "Desktop-Symbole unveraendert (--no-ding)."
    elif have_schema org.gnome.shell.extensions.ding; then
        set_key org.gnome.shell.extensions.ding show-home "false"
        set_key org.gnome.shell.extensions.ding show-trash "false"
        set_key org.gnome.shell.extensions.ding show-other-volumes "false"
    else
        skip "Desktop-Icons-Erweiterung (DING) nicht gefunden - Desktop-Symbole bleiben unveraendert."
    fi

    set_key org.gnome.desktop.wm.preferences button-layout ":minimize,maximize,close"

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

# --- 4. Pruefmodus (--check) -----------------------------------------------
CHECK_FAILED=0

unquote() {
    local value=$1
    value=${value#\'}
    value=${value%\'}
    printf '%s' "$value"
}

expect_value() {
    local label=$1 actual=$2 want=$3
    # gsettings liefert Zeichenketten in Anfuehrungszeichen, je nach Quelle
    # auch ohne - fuer den Vergleich zaehlt der Wert.
    if [ "$(unquote "$actual")" = "$(unquote "$want")" ]; then
        ok "$label = $actual"
    else
        printf '%s   x%s %s: erwartet %s, ist %s\n' \
            "$C_RED" "$C_OFF" "$label" "$want" "${actual:-<leer>}" >&2
        CHECK_FAILED=$((CHECK_FAILED + 1))
    fi
}

expect_file() {
    local label=$1 path=$2
    if [ -f "$path" ]; then
        ok "$label"
    else
        printf '%s   x%s %s fehlt: %s\n' "$C_RED" "$C_OFF" "$label" "$path" >&2
        CHECK_FAILED=$((CHECK_FAILED + 1))
    fi
}

query_key() {
    gsettings get "$1" "$2" 2>/dev/null
}

check_state() {
    info "Pruefe Dateien"
    expect_file "Shell-Theme" "$THEME_DIR/gnome-shell/gnome-shell.css"
    expect_file "Shell-Theme dunkel" "$THEME_DIR/gnome-shell/gnome-shell-dark.css"
    expect_file "Theme-Markierung" "$THEME_DIR/.chromeos-theme"
    expect_file "Extension" "$EXT_DIR/metadata.json"

    # Faengt eine alte Theme-Kopie ohne Sperrbildschirm-Regeln ab.
    if grep -q 'user-widget.vertical' "$THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null \
        && grep -q 'login-dialog-prompt-entry' "$THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null; then
        ok "Sperrbildschirm-CSS"
    else
        printf '%s   x%s Sperrbildschirm-CSS fehlt im Shell-Theme\n' "$C_RED" "$C_OFF" >&2
        CHECK_FAILED=$((CHECK_FAILED + 1))
    fi

    # Faengt eine dunkle Fassung ab, die Popups, Kalender oder Dialoge vergisst.
    local dark_css="$THEME_DIR/gnome-shell/gnome-shell-dark.css"
    if grep -q '\.popup-menu-content' "$dark_css" 2>/dev/null \
        && grep -q '\.calendar-day' "$dark_css" 2>/dev/null \
        && grep -q '\.unlock-dialog' "$dark_css" 2>/dev/null \
        && grep -q '\.modal-dialog' "$dark_css" 2>/dev/null; then
        ok "Dunkle Shell-CSS"
    else
        printf '%s   x%s Dunkle Shell-CSS deckt Popups, Kalender, Sperrbildschirm oder Dialoge nicht ab\n' \
            "$C_RED" "$C_OFF" >&2
        CHECK_FAILED=$((CHECK_FAILED + 1))
    fi

    # Faengt eine Fassung ab, die Schnelleinstellungen, Benachrichtigungen
    # oder die Screenshot-UI vergisst - die sieht sonst nach GNOME aus.
    if grep -q '\.quick-toggle' "$THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null \
        && grep -q '\.message .message-media-control' "$THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null \
        && grep -q '\.screenshot-ui-panel' "$THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null \
        && grep -q '\.switcher-list' "$THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null \
        && grep -q '\.run-dialog' "$THEME_DIR/gnome-shell/gnome-shell.css" 2>/dev/null \
        && grep -q '\.screenshot-ui-panel' "$dark_css" 2>/dev/null \
        && grep -q '\.switcher-list' "$dark_css" 2>/dev/null \
        && grep -q '\.osd-window' "$dark_css" 2>/dev/null; then
        ok "Oberflaechen-CSS (Schnelleinstellungen, Benachrichtigungen, Screenshot-UI)"
    else
        printf '%s   x%s Shell-Theme deckt Schnelleinstellungen, Benachrichtigungen oder die Screenshot-UI nicht ab\n' \
            "$C_RED" "$C_OFF" >&2
        CHECK_FAILED=$((CHECK_FAILED + 1))
    fi

    # Zorin-Programme (Zorin Appearance, Zorin Connect) und Dateidialoge
    # sind GTK 3: ohne Infoleisten und Werkzeugleisten bleibt dort Adwaita.
    if grep -q '^infobar' "$THEME_DIR/gtk-3.0/gtk.css" 2>/dev/null \
        && grep -q '^toolbar' "$THEME_DIR/gtk-3.0/gtk.css" 2>/dev/null \
        && grep -q '^infobar' "$THEME_DIR/gtk-3.0/gtk-dark.css" 2>/dev/null; then
        ok "GTK-3-Widgets (Infoleisten, Werkzeugleisten)"
    else
        printf '%s   x%s GTK-3-Theme gestaltet Infoleisten oder Werkzeugleisten nicht\n' \
            "$C_RED" "$C_OFF" >&2
        CHECK_FAILED=$((CHECK_FAILED + 1))
    fi

    if [ -x "$BIN_DIR/chromeos-search-url" ]; then
        ok "Suchhelfer"
    else
        printf '%s   x%s Suchhelfer fehlt oder ist nicht ausfuehrbar: %s\n' \
            "$C_RED" "$C_OFF" "$BIN_DIR/chromeos-search-url" >&2
        CHECK_FAILED=$((CHECK_FAILED + 1))
    fi

    if [ "$OPT_CURSOR" -eq 1 ]; then
        expect_file "Mauszeiger-Markierung" "$ICON_DIR/.chromeos-theme"
        local count=0
        if [ -d "$ICON_DIR/cursors" ]; then
            count=$(find "$ICON_DIR/cursors" -maxdepth 1 -type f 2>/dev/null | wc -l)
        fi
        if [ "$count" -ge 52 ]; then
            ok "Mauszeiger-Dateien: $count"
        else
            printf '%s   x%s Mauszeiger: %s statt mindestens 52 Dateien\n' \
                "$C_RED" "$C_OFF" "$count" >&2
            CHECK_FAILED=$((CHECK_FAILED + 1))
        fi
    fi

    if [ "$OPT_FONTS" -eq 1 ]; then
        expect_file "Schrift Roboto" "$FONT_DIR/Roboto[wdth,wght].ttf"
        expect_file "Schrift Roboto Mono" "$FONT_DIR/RobotoMono[wght].ttf"
        if command -v fc-match >/dev/null 2>&1; then
            case "$(fc-match 'Roboto' 2>/dev/null)" in
                *Roboto*) ok "fontconfig kennt Roboto" ;;
                *) warn "fontconfig zeigt noch nicht auf Roboto - nach dem naechsten Anmelden erneut pruefen." ;;
            esac
        fi
    fi

    if [ "$OPT_GTK4" -eq 1 ]; then
        if [ -f "$GTK4_FILE" ] && grep -q 'chromeos-theme' "$GTK4_FILE" 2>/dev/null; then
            ok "GTK-4-Farbdatei"
        else
            printf '%s   x%s GTK-4-Farbdatei fehlt: %s\n' "$C_RED" "$C_OFF" "$GTK4_FILE" >&2
            CHECK_FAILED=$((CHECK_FAILED + 1))
        fi
    fi

    if [ "$HAVE_GSETTINGS" -eq 0 ]; then
        warn "Kein gsettings gefunden - Einstellungen werden nicht geprueft."
    else
        info "Pruefe Einstellungen"
        expect_value "gtk-theme" "$(query_key org.gnome.desktop.interface gtk-theme)" "'$THEME_NAME'"
        expect_value "color-scheme" "$(query_key org.gnome.desktop.interface color-scheme)" "'default'"
        expect_value "enable-hot-corners" "$(query_key org.gnome.desktop.interface enable-hot-corners)" "false"
        expect_value "show-battery-percentage" "$(query_key org.gnome.desktop.interface show-battery-percentage)" "true"
        expect_value "font-name" "$(query_key org.gnome.desktop.interface font-name)" "'Roboto 11'"
        expect_value "titlebar-font" "$(query_key org.gnome.desktop.wm.preferences titlebar-font)" "'Roboto 11'"
        expect_value "document-font-name" "$(query_key org.gnome.desktop.interface document-font-name)" "'Roboto 11'"
        expect_value "monospace-font-name" "$(query_key org.gnome.desktop.interface monospace-font-name)" "'Roboto Mono 10'"
        expect_value "button-layout" "$(query_key org.gnome.desktop.wm.preferences button-layout)" "':minimize,maximize,close'"
        if [ "$OPT_CURSOR" -eq 1 ]; then
            expect_value "cursor-theme" "$(query_key org.gnome.desktop.interface cursor-theme)" "'$CURSOR_NAME'"
            expect_value "cursor-size" "$(query_key org.gnome.desktop.interface cursor-size)" "24"
        fi
        if [ "$OPT_DING" -eq 1 ] && have_schema org.gnome.shell.extensions.ding; then
            expect_value "DING show-home" "$(query_key org.gnome.shell.extensions.ding show-home)" "false"
            expect_value "DING show-trash" "$(query_key org.gnome.shell.extensions.ding show-trash)" "false"
            expect_value "DING show-other-volumes" "$(query_key org.gnome.shell.extensions.ding show-other-volumes)" "false"
        fi
    fi

    if [ "$HAVE_GNOME_EXT" -eq 1 ] && [ -n "$SHELL_MAJOR" ]; then
        if gnome-extensions list --enabled 2>/dev/null | grep -qxF "$EXT_UUID"; then
            ok "Extension aktiviert"
        else
            warn "Extension ist nicht aktiv - nach dem Anmelden: ./install.sh --activate"
        fi
    fi

    if [ "$CHECK_FAILED" -gt 0 ]; then
        printf '\n%d Abweichung(en). Abhilfe: %s/install.sh\n' "$CHECK_FAILED" "$SCRIPT_DIR" >&2
        return 1
    fi
    printf '\nAlles wie erwartet.\n'
    return 0
}

# Haelt fest, welche Teile installiert wurden, damit uninstall.sh nur die
# wieder entfernt. Wird ergaenzt, nicht ueberschrieben: ein spaeterer Lauf mit
# --no-cursor soll einen frueher installierten Mauszeiger nicht vergessen.
record_components() {
    [ "$DRY_RUN" -eq 0 ] || return 0
    mkdir -p "$STATE_DIR"
    local component
    for component in theme extension helper settings; do
        grep -qxF "$component" "$COMPONENTS_FILE" 2>/dev/null \
            || printf '%s\n' "$component" >> "$COMPONENTS_FILE"
    done
    [ "$OPT_CURSOR" -eq 1 ] && { grep -qxF cursor "$COMPONENTS_FILE" 2>/dev/null || printf 'cursor\n' >> "$COMPONENTS_FILE"; }
    [ "$OPT_GTK4" -eq 1 ] && { grep -qxF gtk4 "$COMPONENTS_FILE" 2>/dev/null || printf 'gtk4\n' >> "$COMPONENTS_FILE"; }
    [ "$OPT_FONTS" -eq 1 ] && { grep -qxF fonts "$COMPONENTS_FILE" 2>/dev/null || printf 'fonts\n' >> "$COMPONENTS_FILE"; }
    return 0
}

# Abbruch mittendrin: die Dateien bleiben liegen (uninstall.sh raeumt sie),
# aber die schon gesetzten Einstellungen kommen zurueck.
on_abort() {
    trap - INT TERM
    warn "Abgebrochen - gesicherte Einstellungen werden zurueckgeholt."
    if [ "$DRY_RUN" -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
        bash "$SCRIPT_DIR/uninstall.sh" --settings-only >/dev/null 2>&1 \
            || warn "Bitte manuell aufraeumen: $SCRIPT_DIR/uninstall.sh"
    fi
    printf 'Dateien und Reste entfernen: %s/uninstall.sh\n' "$SCRIPT_DIR"
    exit 130
}

# --- Ablauf ----------------------------------------------------------------
if [ "$CHECK_ONLY" -eq 1 ]; then
    check_state
    exit $?
fi

if [ "$ACTIVATE_ONLY" -eq 0 ]; then
    record_components
    trap on_abort INT TERM
    install_files
    apply_settings
    disable_conflicts
    trap - INT TERM
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
  * Super+L                                   -> Chromebook-Sperrbildschirm
    (Uhr, Konto-Kreis, Passwortfeld; Hintergrund wie der Desktop)
  * Rechtsklick auf ein Shelf- oder Launcher-Icon -> Anheften, Schliessen, App-Info
  * Websuche nutzt die Suchmaschine des Standardbrowsers
    (Override: $CONFIG_HOME/chromeos-theme/config.json)

Theme-Schalter GTK: Einstellungen > Darstellung > ChromeOS
Deinstallieren: $SCRIPT_DIR/uninstall.sh
EOF
