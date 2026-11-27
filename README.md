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
- Getestet wurde die Logik auf einem Windows-Rechner (Skripte, Suchhelfer,
  Syntax). Ein Lauf im echten GNOME/Zorin-Desktop steht noch aus – bitte
  Abweichungen als Issue melden.

---

## Lizenz

MIT – siehe [LICENSE](LICENSE). Die Referenzscreenshots in
`docs/reference/` dienen nur der Dokumentation des Looks.
