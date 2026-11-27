# ChromeOS-Theme für Zorin OS

Ein inoffizielles Theme, das Zorin OS wie ChromeOS aussehen lässt:
Launcher oben links, Shelf unten, ChromeOS-Farben, abgerundete Panels –
installiert mit **einem** Befehl, komplett entfernt mit **einem** weiteren.

Bewusst **ohne** Gemini/Assistant, ohne KI-Funktionen und ohne Lens.
Die Websuche im Launcher nutzt die **Standardsuchmaschine deines
Standardbrowsers**, nicht Google.

> ChromeOS ist eine Marke von Google LLC. Dieses Projekt ist unabhängig und
> steht in keiner Verbindung zu Google.

---

## Vorschau / Referenzen

Die Optik orientiert sich an diesen ChromeOS-Screenshots (im Repo unter
`docs/reference/`):

| Launcher + Shelf | Tray dunkel | Tray hell |
| --- | --- | --- |
| ![Launcher](docs/reference/01-launcher-apps.webp) | ![Dunkel](docs/reference/03-quick-settings-dark.webp) | ![Hell](docs/reference/04-quick-settings-light.webp) |

| Shelf klein | Shelf + Tray breit |
| --- | --- |
| ![Shelf klein](docs/reference/02-browser-shelf-small.webp) | ![Shelf](docs/reference/05-shelf-tray.webp) |

Eigene Hintergründe liegen in `assets/wallpapers/`
(`chromeos-blue.jpg`, `chromeos-iris.jpg`, `chromeos-lake.jpg`).
Ein Screenshot des fertigen Zorin-Desktops kann hier nicht liegen – die
Entwicklungsumgebung ist Windows; nach dem ersten Login gern ergänzen.

---

## Voraussetzungen

- **Zorin OS 18** (GNOME Shell 46) – dafür ist das Theme gebaut.
- Zorin OS 17 / GNOME 43: GTK-Theme und Hintergrund funktionieren, die
  Shell-Extension braucht GNOME **45+**. Das Installationsskript weist darauf hin.
- Weder `sudo` noch zusätzliche Pakete sind nötig. Optional:
  `sudo apt install fonts-roboto` für die ChromeOS-Schrift.

---

## Installation

Ein Befehl – Repo holen und installieren:

```bash
git clone https://github.com/Baanaanek/zorin-chromeos-theme.git ~/zorin-chromeos-theme && bash ~/zorin-chromeos-theme/install.sh
```

Danach **einmal ab- und wieder anmelden** (unter Wayland komplett neu
einloggen). Falls der Launcher danach noch fehlt, in der neuen Sitzung:

```bash
bash ~/zorin-chromeos-theme/install.sh --activate
```

Weitere Schalter:

```bash
bash ~/zorin-chromeos-theme/install.sh --dry-run   # nur zeigen, was passiert
bash ~/zorin-chromeos-theme/install.sh --help
```

Das Skript kopiert alles ins Benutzer-Home, sichert vorher die betroffenen
Einstellungen und deaktiviert Zorins eigene Leisten-Erweiterungen
(`zorin-dash`, `zorin-panel`, `zorin-menu`, `zorin-taskbar`, `dash-to-dock`
u. ä.), damit nichts doppelt erscheint.

### Was installiert wird

| Ziel | Inhalt |
| --- | --- |
| `~/.local/share/themes/ChromeOS/` | GTK-3-Theme + GNOME-Shell-Theme |
| `~/.local/share/gnome-shell/extensions/chromeos-shell@baanaanek.github.io/` | Launcher, Shelf, Websuche |
| `~/.local/bin/chromeos-search-url` | ermittelt die Suchmaschine des Standardbrowsers |
| `~/.local/share/backgrounds/chromeos-wallpaper.jpg` | Standard-Hintergrund |
| `~/.local/state/chromeos-theme/` | Sicherung der alten Einstellungen |

---

## Deinstallation

Ein Befehl – alles wieder weg, inklusive der zuvor gesicherten Einstellungen:

```bash
bash ~/zorin-chromeos-theme/uninstall.sh
```

Auch hier gilt: einmal ab- und wieder anmelden. Danach kann der geklonte
Ordner gelöscht werden. Falls das Repo schon weg ist, reicht es,
`uninstall.sh` erneut aus dem Repo zu kopieren – das Skript braucht keine
weiteren Dateien.

`bash ~/zorin-chromeos-theme/uninstall.sh --dry-run` zeigt vorher, was
entfernt würde. Entfernt werden: Extension, Theme-Ordner (nur mit
Theme-Markierung), Suchhelfer, Hintergrundbild, Konfiguration und der
Zustandsordner. Zuvor deaktivierte Zorin-Leisten werden wieder aktiviert.

---

## Bedienung

| Aktion | Ergebnis |
| --- | --- |
| Runder Knopf links in der Shelf | Launcher öffnen/schließen |
| **Supertaste** | öffnet den Launcher (statt der GNOME-Übersicht) |
| Tippen im Launcher | filtert Apps |
| **Enter** | startet den ersten Treffer, sonst Websuche |
| **Esc** | Launcher schließen |
| Klick auf App-Kachel | App starten bzw. Fenster nach vorn holen |
| Mittelklick auf Shelf-Icon | neues Fenster |
| Uhr rechts in der Shelf | Kalender |
| Status-Icons rechts | Schnelleinstellungen (erscheinen über der Shelf) |

Arbeitsflächen bleiben über `Ctrl+Alt+↑/↓` erreichbar.

---

## Websuche: Suchmaschine des Standardbrowsers

Der Launcher baut keine eigene Suchmaschine ein. Er ruft
`~/.local/bin/chromeos-search-url` auf. Der Helfer:

1. liest den Standardbrowser über `xdg-settings get default-web-browser`,
2. liest dort die gespeicherte Standardsuchmaschine
   (Firefox: `prefs.js`; Chrome/Brave/Chromium/Edge/Vivaldi: `Preferences`),
3. baut daraus die Such-URL und öffnet sie im Standardbrowser.

Wenn der Browser keine explizit gespeicherte Suchmaschine hat, wird
**DuckDuckGo** verwendet – nie Google als Vorgabe.

Eigene Suchmaschine fest vorgeben:

```bash
mkdir -p ~/.config/chromeos-theme
cat > ~/.config/chromeos-theme/config.json <<'EOF'
{ "search_url": "https://duckduckgo.com/?q={query}" }
EOF
```

Oder temporär:

```bash
CHROMEOS_SEARCH_URL="https://search.brave.com/search?q={query}" \
  ~/.local/bin/chromeos-search-url --open "test"
```

Direkt testen:

```bash
~/.local/bin/chromeos-search-url --engine-name
~/.local/bin/chromeos-search-url --url "zorin os"
```

---

## Was bewusst fehlt

- **Kein Gemini/Assistant** – weder Schaltfläche noch Funktion.
- **Kein Lens**, keine Sprachsuche, keine Mikrofon-/Kamera-Symbole im Suchfeld.
- Keine Google-Dienste: kein Play Store, keine Google-Konten, keine
  „Continue where you left off“-Karten.
- Keine Telemetrie, keine Netzwerkzugriffe außer der Suche, die du selbst
  auslöst.

---

## Anpassen

- **Farben:** `theme/ChromeOS/gtk-3.0/gtk.css` und
  `theme/ChromeOS/gnome-shell/gnome-shell.css` (Akzent ist `#1a73e8`).
  Nach Änderungen neu installieren (`install.sh`) und neu anmelden.
- **Hintergrund:** Einstellungen → Darstellung, oder
  `assets/wallpapers/` tauschen und `install.sh` erneut ausführen.
- **Shelf-Apps:** wie in GNOME über das App-Raster anheften (Rechtsklick →
  „Zu Favoriten hinzufügen“); die Shelf zeigt Favoriten plus laufende Apps.
- **Launcher-Größe:** `PANEL_WIDTH` / `PANEL_MAX_HEIGHT` in
  `extension/chromeos-shell@baanaanek.github.io/launcher.js`.
- **Shelf-Höhe/Radius:** `min-height` und `border-radius` von
  `.chromeos-shelf` in der `stylesheet.css` der Extension.

---

## Aufbau des Repos

```
install.sh                     Installation (ein Befehl)
uninstall.sh                   vollständige Deinstallation
bin/chromeos-search-url        Standardsuchmaschine des Standardbrowsers
theme/ChromeOS/gtk-3.0/        GTK-3-Theme (hell + dunkel)
theme/ChromeOS/gnome-shell/    Shell-Theme (Panels, Popups, App-Raster)
extension/chromeos-shell@…/    Launcher, Shelf, Websuche
assets/wallpapers/             drei eigene Hintergrundmotive
docs/reference/                ChromeOS-Referenzscreenshots
docs/design.md                 Design-Tokens, Geometrie, Entscheidungen
```

Das Shell-Theme wird von der Extension selbst geladen. Dadurch ist keine
`user-theme`-Erweiterung nötig und die Deinstallation bleibt vollständig.

---

## Bekannte Grenzen

- Die GNOME-Schnelleinstellungen bleiben funktional GNOME (Kachelraster);
  Farbe, Radien und Position werden angeglichen, ein 1:1-Nachbau des
  ChromeOS-Trays ist es nicht.
- libadwaita-Apps (z. B. GNOME Einstellungen, Dateien) ignorieren GTK-Themes
  weitgehend; dort wirkt im Wesentlichen der gesetzte blaue Akzent.
- Auf GNOME 43/44 (Zorin OS 17) wird die Shell-Extension nicht geladen.

---

## Geprüft / nicht geprüft

Was konkret nachweisbar geprüft wurde (27.11.2026):

- **Skripte end-to-end**, in einer POSIX-Bash mit Coreutils, temporärem `HOME`
  und aufzeichnenden Stubs für `gsettings`, `gnome-extensions` und
  `gnome-shell` – 36 Prüfungen, alle grün:
  `--dry-run` ändert nichts; der echte Lauf installiert Theme, Extension,
  Helfer und Wallpaper und setzt die Einstellungen; ein zweiter Lauf ist
  idempotent (Sicherung unverändert, keine doppelten Einträge);
  `uninstall.sh` entfernt alle diese Dateien und Ordner, stellt alle zwölf
  gesicherten `gsettings`-Werte exakt wieder her und reaktiviert die zuvor
  deaktivierte Zorin-Leiste.
- **Lauf ohne GNOME**: ohne `gsettings`, `gnome-shell` und
  `gnome-extensions` brechen beide Skripte nicht ab, kopieren die Dateien,
  überspringen die Einstellungen und räumen beim Deinstallieren vollständig
  auf.
- **Extension-Lebenszyklus** mit den echten Extension-Dateien gegen ein
  gemocktes GNOME (St, Clutter, Main, Shell) – 22 Prüfungen, alle grün:
  `enable()` baut Launcher und Shelf, hängt Datum und Schnelleinstellungen
  um und blendet die Top-Leiste aus; `disable()` entfernt beide
  Chrome-Actors, setzt die Tray-Buttons an ihre ursprüngliche Position
  zurück, zeigt die Leiste wieder und schließt alle Signale – auch im
  zweiten enable/disable-Zyklus.
- **API-Matrix** gegen die Quellen von GNOME Shell 45.0, 46.0, 47.0 und
  48.0 sowie Mutter 46: alle genutzten APIs existieren in diesen Versionen
  (`St.PolicyType`, `addChrome`/`addTopChrome`, `Main.panel.statusArea`,
  `PanelMenu.Button.container`, `AppFavorites`, `Shell.App.create_icon_texture`,
  Overview-Signal `showing`, `Gio.Subprocess.new`, `St.Theme.load_stylesheet`,
  `import.meta.url`); entfernte APIs (`Shell.App.should_show()`,
  `get_keywords()`) und Legacy-Importe (`imports.*`, `ExtensionUtils`) kommen
  nicht mehr vor.

Nicht beweisbar ohne laufende GNOME-Sitzung: das tatsächliche Rendering von
Shell-Theme und CSS, die Position von Popups über der Shelf, das Verhalten
des echten Shell-Prozesses beim Umhängen der Tray-Buttons und die Optik
insgesamt. Auf diesem Rechner ließ sich kein Linux starten (WSL2 nicht
startbar, weil Virtualisierung im BIOS deaktiviert ist; kein Docker/Podman),
daher lief kein echter `gnome-shell`-Prozess. Bitte Abweichungen als Issue
melden.

---

## Lizenz

MIT – siehe [LICENSE](LICENSE). Die Referenzscreenshots in
`docs/reference/` dienen nur der Dokumentation des Looks.
