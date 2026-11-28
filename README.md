# ChromeOS-Theme für Zorin OS

Ein inoffizielles Theme, das Zorin OS wie ChromeOS aussehen lässt:
Launcher oben links, Shelf unten, ChromeOS-Farben, abgerundete Panels,
eigener Mauszeiger, ChromeOS-Palette auch in GTK-4-/libadwaita-Apps und
Rechtsklick-Menüs auf Shelf- und Launcher-Icons – installiert mit **einem**
Befehl, komplett entfernt mit **einem** weiteren.

Bewusst **ohne** Gemini/Assistant, ohne KI-Funktionen und ohne Lens.
Die Websuche im Launcher nutzt die **Standardsuchmaschine deines
Standardbrowsers**, nicht Google.

> ChromeOS ist eine Marke von Google LLC. Dieses Projekt ist unabhängig und
> steht in keiner Verbindung zu Google.

---

## Aussehen

Im Repo liegen **keine fremden Bilder** und **keine Hintergrundbilder**:
keine ChromeOS-Screenshots, keine Google-Grafiken. Alles Bildliche (die
Vorschaubilder des Mauszeigers) ist selbst erzeugt und steht unter derselben
MIT-Lizenz wie das Theme.

| Element | Umsetzung |
| --- | --- |
| Launcher | Panel oben links, 560 px breit, Suchzeile mit Lupe und Lösch-Knopf, App-Raster mit 5 Spalten, klickbare Seitenpunkte unter dem Raster, Tastaturnavigation mit den Pfeiltasten |
| Shelf | 56 px hohe, schwebende Leiste unten: runder Launcher-Knopf links, angeheftete und laufende Apps mit Trenner dazwischen, Uhr und Status rechts |
| Tray | echte GNOME-Knöpfe, in die Shelf umgehängt – Tastaturbelegung, Aufnahme- und Freigabe-Anzeige, Kalender und Schnelleinstellungen sitzen in der Leiste |
| Mauszeiger | eigener Xcursor-Satz, 52 Namen, 24/48 px (`cursor/ChromeOS/`) |
| Sperrbildschirm | Konto-Bild (96 px, rund, ohne Rahmen), Name in Weiß, Passwortfeld als dunkle Kapsel mit weißer Schrift, Benachrichtigungen als dunkle Karten; Hintergrund ist der weichgezeichnete Desktop-Hintergrund |
| Schnelleinstellungen | schwebende Karten mit Akzent beim Einschalten, runde Regler, Umschalter im ChromeOS-Look; Kalender und Benachrichtigungen als Popup darüber |
| Screenshot-UI | Werkzeugleiste (Super+Druck) als schwebende Karte unten, Modus-Knöpfe im Akzent, roter Auslöser beim Aufnehmen, Auswahlrahmen und Fensterwahl im Akzent |
| Apps | Einstellungen und Dateien über die libadwaita-Farbtokens, Zorin-Programme (GTK 3) über ein eigenes Theme inklusive Infoleisten, Werkzeugleisten und Dateiauswahl |
| Schriften | Roboto und Roboto Mono (SIL OFL 1.1) liegen bei und werden mitinstalliert |

Farben, Radien und Geometrie stehen in [`docs/design.md`](docs/design.md).
Ein Screenshot des fertigen Zorin-Desktops kann hier nicht liegen – die
Entwicklungsumgebung ist Windows; nach dem ersten Login gern ergänzen.

### Sperrbildschirm gegen echtes ChromeOS geprüft

Abgeglichen mit einem echten ChromeOS-Sperrbildschirm (1366 × 768):
Konto-Bild, Name, Passwortfeld und Benachrichtigungen sitzen an derselben
Stelle und haben dieselbe Form. GNOME Shell gibt allerdings keinen Rahmen
her für

- die Zeile „Shut down“ / „Sign out“ unten links,
- Datum, Uhrzeit und Akku unten rechts – GNOME zeigt die Uhr groß in der
  Mitte, solange niemand eine Taste drückt,
- das Auge-Symbol im Feld und den runden Weiter-Pfeil daneben,
- den Aufklapp-Pfeil am Namen zum Kontowechsel (GNOME hat dafür einen
  Knopf unten rechts).

Das sind feste Aufbauten von GNOME Shell, keine Farben; per CSS lassen sie
sich nicht erzeugen. Gleich bleiben Schrift (Roboto), Farben, Formen und
der weichgezeichnete Hintergrund.

---

## Voraussetzungen

- **Zorin OS 18** (GNOME Shell 46) – dafür ist das Theme gebaut.
- Zorin OS 17 / GNOME 43: GTK-Theme und Hintergrund funktionieren, die
  Shell-Extension braucht GNOME **45+**. Das Installationsskript weist darauf hin.
- Weder `sudo` noch zusätzliche Pakete sind nötig – Roboto und Roboto Mono
  liegen im Repo und werden mitinstalliert.

---

## Installation

Ein Befehl – Repo holen und installieren:

```bash
git clone https://github.com/Baanaanek/zorin-chromeos-theme.git ~/zorin-chromeos-theme && bash ~/zorin-chromeos-theme/install.sh
```

Die drei Skripte sind im Repo als ausführbar markiert, deshalb funktioniert
nach dem Klonen genauso gut:

```bash
cd ~/zorin-chromeos-theme && ./install.sh
```

Danach **einmal ab- und wieder anmelden** (unter Wayland komplett neu
einloggen). Falls der Launcher danach noch fehlt, in der neuen Sitzung:

```bash
bash ~/zorin-chromeos-theme/install.sh --activate
```

Weitere Schalter:

```bash
bash ~/zorin-chromeos-theme/install.sh --dry-run   # nur zeigen, was passiert
bash ~/zorin-chromeos-theme/install.sh --check     # Ist-Zustand prüfen (Exit 1 bei Abweichung)
bash ~/zorin-chromeos-theme/install.sh --version
bash ~/zorin-chromeos-theme/install.sh --help
```

Teile weglassen – sie bleiben dann unangetastet, auch beim Deinstallieren:

```bash
bash ~/zorin-chromeos-theme/install.sh --no-cursor --no-gtk4 --no-ding --no-fonts
```

Das Skript verweigert den Start unter `sudo`: das Theme gehört ins
Benutzer-Home. Bricht die Installation ab (Strg+C, Platte voll), holt der
Abbruch-Handler die bereits gesetzten Einstellungen zurück; die Dateien
räumt `uninstall.sh`.

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
| `~/.local/share/fonts/ChromeOS/` | Roboto + Roboto Mono (SIL OFL 1.1) |
| `~/.local/share/icons/ChromeOS/` | eigener Mauszeiger-Satz (52 Namen, 24/48 px) |
| `~/.config/gtk-4.0/gtk.css` | ChromeOS-Farben für GTK 4/libadwaita (eine vorhandene Datei wird vorher gesichert) |
| `~/.local/state/chromeos-theme/` | Sicherung der alten Einstellungen und der GTK-4-Datei |

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
entfernt würde. Entfernt werden nur die Teile, die tatsächlich
installiert wurden (festgehalten in `~/.local/state/chromeos-theme/components.txt`):
Extension, Theme-Ordner (nur mit Theme-Markierung), Mauszeiger-Satz,
Schriften, GTK-4-Farbdatei, Suchhelfer, Konfiguration und
der Zustandsordner.

Nur die Einstellungen zurückholen, ohne Dateien anzufassen:

```bash
bash ~/zorin-chromeos-theme/uninstall.sh --settings-only
``` Zuvor deaktivierte
Zorin-Leisten werden wieder aktiviert, alle gesetzten `gsettings`-Werte
kommen exakt zurück – Schlüssel, die vorher nie gesetzt waren, werden per
`gsettings reset` wieder auf ihren Standard gebracht, und eine vorher
eigene `~/.config/gtk-4.0/gtk.css` wird zurückgespielt.

---

## Bedienung

| Aktion | Ergebnis |
| --- | --- |
| Runder Knopf links in der Shelf | Launcher öffnen/schließen |
| **Supertaste** | öffnet den Launcher (statt der GNOME-Übersicht) |
| Tippen im Launcher | filtert Apps |
| **Enter** | startet den ersten Treffer, sonst Websuche |
| **↑ / ↓ / ← / →** | Tastaturnavigation im App-Raster und in den Treffern; ↑ aus der ersten Zeile zurück ins Suchfeld |
| **Esc** | Launcher schließen |
| Klick auf einen Seitenpunkt | springt auf diese Seite des App-Rasters |
| Klick auf App-Kachel | App starten bzw. Fenster nach vorn holen |
| Mittelklick auf Shelf-Icon | neues Fenster |
| Uhr rechts in der Shelf | Kalender |
| Status-Icons rechts | Schnelleinstellungen (erscheinen über der Shelf) |
| Rechtsklick auf Shelf-/Launcher-Icon | Menü: Neues Fenster, An Shelf anheften bzw. entfernen, Fenster schließen, App-Info |
| Sperren (`Super+L`) | Chromebook-Sperrbildschirm mit Uhr, Konto und Passwortfeld |

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

## Mauszeiger

ChromeOS' Original-Cursor ist Googles Material-Cursor und nicht frei
lizenzierbar. Deshalb liegt im Repo ein **eigener** Satz bei:
`cursor/ChromeOS/` mit 52 Cursor-Namen (Pfeil, Text, Fadenkreuz, Sanduhr,
Verboten, Verschieben, offene/geschlossene/zeigende Hand, Lupe mit Plus und
Minus, alle Größenanpassungs-Pfeile), gezeichnet als Vektorformen und als
Xcursor-Dateien in 24 und 48 px. Der Satz steht unter derselben MIT-Lizenz
wie das Repo; er ist keine Kopie fremder Cursor-Dateien.

Erzeugen bzw. prüfen:

```bash
bun tools/build-cursors.mjs          # schreibt cursor/ChromeOS/ + Vorschau-PNG
bun tools/build-cursors.mjs --check  # prüft Header, Größen, Hotspots, Pixel
```

`install.sh` kopiert den Satz nach `~/.local/share/icons/ChromeOS/` und setzt
`cursor-theme ChromeOS` sowie `cursor-size 24`. Fehlende Einzelnamen erbt der
Satz von Adwaita (`Inherits=Adwaita` in `index.theme`).

---

## GTK-4-Apps (libadwaita)

Dateien, Einstellungen, Texteditor und Konsole zeichnen mit libadwaita und
ignorieren `gtk-theme` bewusst. Deshalb legt `install.sh` zusätzlich
`theme/ChromeOS/gtk-4.0/gtk.css` als `~/.config/gtk-4.0/gtk.css` ab – GTK
lädt diese Datei beim Start mit Benutzerpriorität über dem App-Stylesheet.
Sie überschreibt die libadwaita-Farbtokens (`accent_bg_color`,
`window_bg_color`, `headerbar_bg_color`, `card_bg_color`, `view_bg_color`,
`sidebar_bg_color`, `popover_bg_color`, `borders`, …) für hell und über
`@media (prefers-color-scheme: dark)` auch für dunkel, und setzt Radien für
Fenster, Headerbars, Buttons, Karten, Popovers und Scrollbars.

Dadurch folgen diese Apps dem ChromeOS-Blau und den Flächenfarben. Ihr
Layout (Sidebars, Karten, Headerbar-Aufbau) bleibt libadwaita – das ist eine
Grenze des Toolkits, keine offene Baustelle.

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
  Die dunkle Shell-Fassung derselben Selektoren steht in
  `theme/ChromeOS/gnome-shell/gnome-shell-dark.css`; sie wird nur bei
  `color-scheme prefer-dark` zusätzlich geladen. Nach Änderungen neu
  installieren (`install.sh`) und neu anmelden.
- **Hintergrund:** das Theme bringt bewusst keins mit und lässt die
  Einstellung unangetastet. Bild über Einstellungen → Darstellung wählen
  oder direkt `gsettings set org.gnome.desktop.background picture-uri …`.
- **Shelf-Apps:** über das Rechtsklick-Menü der Shelf oder des Launchers
  anheften/entfernen; die Shelf zeigt Favoriten plus laufende Apps und trennt
  beide Gruppen mit einer dünnen Linie.
- **Mauszeiger:** Formen und Farben in `tools/build-cursors.mjs` ändern und
  mit `bun tools/build-cursors.mjs` neu erzeugen.
- **GTK-4-Farben:** `theme/ChromeOS/gtk-4.0/gtk.css` (dieselben Tokens wie
  das Shell-Theme); danach `install.sh` erneut ausführen und neu anmelden.
- **Sperrbildschirm:** Abschnitt „Sperrbildschirm“ in
  `theme/ChromeOS/gnome-shell/gnome-shell.css` (Uhr, Konto-Kreis,
  Passwortfeld, Hinweise, Benachrichtigungskarten). Sein Hintergrund ist der
  Desktop-Hintergrund, den GNOME selbst weichzeichnet und abdunkelt.
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
theme/ChromeOS/gnome-shell/    Shell-Theme hell + dunkel (Popups, Kalender, Dialoge)
extension/chromeos-shell@…/    Launcher, Shelf, Websuche
theme/ChromeOS/gtk-4.0/        GTK-4/libadwaita-Farben (Nutzer-CSS)
cursor/ChromeOS/               eigener Mauszeiger-Satz (Xcursor, MIT)
tools/build-cursors.mjs        erzeugt und prüft den Mauszeiger-Satz
fonts/                         Roboto + Roboto Mono (SIL OFL 1.1) + Lizenztext
data/settings-keys.json        gsettings-Schluessel je GNOME-Version
docs/reference/                Design-Referenz (reiner Text, keine Bilder)
tools/check-contrast.mjs       WCAG-Kontrast der GTK-4- und Shell-Farbtokens
tools/check-settings.mjs       Schluessel gegen data/settings-keys.json
.github/workflows/tests.yml    CI: beide Harnesses + Asset-Pruefungen
docs/design.md                 Design-Tokens, Geometrie, Entscheidungen
tests/run-all.sh               beide Test-Harnesses
tests/scripts/                 Install/Uninstall-Harness + Stubs
tests/extension/               Lifecycle-Harness + GNOME-Mocks
```

Das Shell-Theme wird von der Extension selbst geladen. Dadurch ist keine
`user-theme`-Erweiterung nötig und die Deinstallation bleibt vollständig.

---

## Tests

Beide Harnesses liegen im Repo und laufen gegen einen frischen Klon, ohne
GNOME-Sitzung und ohne das echte Benutzerkonto zu verändern:

```bash
cd ~/zorin-chromeos-theme && bash tests/run-all.sh
```

| Harness | Prüfungen | Inhalt |
| --- | --- | --- |
| `tests/scripts/run.sh` | 106 | Probelauf, `--version`, `--check` vor und nach der Installation (auch ohne dunkle Shell-CSS), echter Lauf, zweiter Lauf, `--activate`, Teilinstallation mit `--no-cursor`/`--no-gtk4`, `--settings-only`, Deinstallation, Wiederherstellung aller 19 Einstellungen inkl. „vorher nie gesetzt“, Cursor, Schriften, GTK-4-Datei, dunkle Shell-CSS, Lauf ohne GNOME-Werkzeuge |
| `tests/extension/lifecycle.mjs` | 75 | `enable()`/`disable()` gegen gemocktes GNOME: Launcher, Shelf, Strut, Sperrbildschirm (Shelf und Strut aus dem Chrome, danach unveränderte Geometrie), laufende Apps, `should_show()`, Tray inklusive Tastaturbelegung, Aufnahme- und Freigabe-Indikator, Suche, Lösch-Knopf, klickbare Seitenpunkte, Tastaturnavigation samt Scrollen zum Fokus, Trenner in der Shelf, „Neues Fenster“ im Menü, Kontextmenüs, Theme, dunkle Shell-CSS, Dunkelmodus, Signal-Aufräumen, zweiter Zyklus |

Dazu zwei Prüfungen ohne GNOME-Bezug:

| Werkzeug | Inhalt |
| --- | --- |
| `tools/check-contrast.mjs` | 17 Text-/Akzentpaare der GTK-4-Tokens erfüllen WCAG AA in hell und dunkel; beide Modi definieren dieselben Tokens |
| `tools/check-settings.mjs` | jeder `set_key`-Aufruf steht in `data/settings-keys.json` und die Matrix enthält keinen ungenutzten Schlüssel |

Details und Voraussetzungen: [tests/README.md](tests/README.md).

## Bekannte Grenzen

Diese Punkte sind bewusst nicht gelöst: Sie brauchen entweder Rechte, die
das Theme nicht anfordert, oder Material, das nicht frei lizenzierbar ist.

- **Icon-Set:** ChromeOS zeichnet mit Googles Material-Icons. Ein
  vollständiges, frei lizenzierbares 1:1-Set gibt es nicht; Zorins Icons
  bleiben. Das ist die sichtbarste verbleibende Abweichung.
- **Google Sans:** proprietär. Beigelegt ist Roboto (SIL OFL 1.1), das
  ChromeOS ebenfalls verwendet; Google Sans selbst nicht.
- **Material-Mauszeiger:** Googles Original ist nicht frei lizenzierbar.
  Beigelegt ist ein eigener, aus Vektorformen erzeugter Satz (MIT), der die
  Formensprache aufnimmt, aber keine Kopie ist.
- **Anmeldebildschirm vor der Anmeldung (GDM), Boot-Splash (Plymouth),
  Systemklänge:** liegen unter `/etc` bzw. `/usr/share` und bräuchten
  `sudo`. Der Sperrbildschirm *nach* der Anmeldung ist dagegen gestaltet
  (siehe „Aussehen“). Das Theme bleibt bei „ein Befehl, kein sudo,
  vollständig rückholbar“.
- **libadwaita-Struktur:** GTK-4-Apps übernehmen Farben, Akzent, Radien und
  Schrift; ihr Layout (Sidebars, Karten, Headerbar-Aufbau) bleibt libadwaita.
- **GNOME-Schnelleinstellungen** bleiben funktional GNOME (Kachelraster);
  Farbe, Radien und Position werden angeglichen.
- **Dunkelmodus:** Die Installation setzt `color-scheme default` (hell) wie
  ChromeOS. Wer umschaltet, bekommt die dunkle Palette aus derselben
  GTK-4-Datei; Shelf und Launcher folgen über `chromeos-dark`, und die
  Extension tauscht die Shell-CSS gegen `gnome-shell-dark.css`, sodass auch
  Kalender, Tray-Popups, Schnelleinstellungen, Benachrichtigungen, Dialoge
  und der Sperrbildschirm dunkel sind (Passwortfeld und Benachrichtigungs-
  karten bekommen dichtere Flaechen, weil sie ueber dem Hintergrundbild
  liegen). St (die CSS-Engine der Shell) kennt keine `@media`-Abfragen –
  deshalb zwei Dateien statt eines Dunkelblocks.
- **Zorin OS 17 / GNOME 43:** GTK-Theme und Hintergrund funktionieren, die
  Shell-Extension braucht GNOME 45+.

---

## Geprüft / nicht geprüft

Geprüft wurde im Arbeitsbaum und gegen einen frischen Klon, Stand `main`:

- **Zeilenenden/Modus im Klon**: `git ls-files --eol` meldet für
  `install.sh`, `uninstall.sh` und `bin/chromeos-search-url`
  `i/lf w/lf`; kein CRLF, kein BOM, Modus `100755`. Erzwungen wird das
  repo-weit durch `.gitattributes` (`* text=auto eol=lf`), damit auch ein
  Windows-Checkout mit `core.autocrlf=true` LF liefert.
- **Shebang**: `./install.sh --dry-run` startet im Klon direkt über
  `#!/usr/bin/env bash`, endet mit Exit 0 und schreibt nichts.
- **Mauszeiger-Satz** über `bun tools/build-cursors.mjs --check`: alle 52
  Namen vorhanden, jede Xcursor-Datei mit gültigem Header, zwei Bildern
  (24/48 px), passenden Hotspots und nicht-leeren Pixeldaten.
- **Skripte end-to-end** über `tests/scripts/run.sh` – 106 Prüfungen, alle
  grün: Dry-Run ohne Änderung; `--check` meldet vor der Installation
  Abweichungen (Exit 1) und danach „Alles wie erwartet“ (Exit 0); echter Lauf
  installiert Theme, Extension, Mauszeiger, Schriften, GTK-4-Farbdatei und
  Helfer; zweiter Lauf idempotent; Teilinstallation mit
  `--no-cursor --no-gtk4` lässt genau diese Teile unangetastet und hält sie
  in `components.txt` fest; `--settings-only` holt nur die Einstellungen
  zurück; `uninstall.sh` entfernt alles, stellt alle 19 gesicherten
  `gsettings`-Werte exakt wieder her, resettet vorher nie gesetzte Schlüssel
  (`cursor-theme`, `cursor-size`, `titlebar-font`) und reaktiviert die zuvor
  deaktivierten Zorin-Leisten. Zusätzlich: Lauf ohne GNOME-Werkzeuge bricht
  nicht ab und räumt vollständig auf, inklusive der Nutzer-GTK-4-Datei.
  Beide Läufe prüfen zusätzlich, dass das Shell-Theme die Regeln für den
  Sperrbildschirm enthält.
- **Extension-Lebenszyklus** über `tests/extension/lifecycle.mjs` mit den
  echten Quellen gegen ein gemocktes GNOME (St, Clutter, Main, Shell,
  PopupMenu) – 75 Prüfungen, alle grün, inklusive Lösch-Knopf im Suchfeld,
  Seitenpunkten unter dem App-Raster, Fokus-Scroll der Tastaturnavigation
  und zweitem
  enable/disable-Zyklus: `enable()` baut Launcher und Shelf, hängt
  Tastaturbelegung, Aufnahme- und Freigabe-Indikator sowie Datum und
  Schnelleinstellungen um, blendet die Top-Leiste aus; Rechtsklick öffnet
  Anheften/Entfernen, Fenster schließen und App-Info; `disable()` entfernt
  beide Chrome-Actors, schließt offene Menüs, setzt die Tray-Buttons an ihre
  alte Position zurück, zeigt die Leiste wieder und schließt alle Signale.
- **API-Matrix** gegen die Quellen von GNOME Shell 45.0, 46.0, 47.0 und
  48.0 sowie Mutter 46: alle genutzten APIs existieren; entfernte APIs
  (`Shell.App.should_show()`, `get_keywords()`) und Legacy-Importe
  (`imports.*`, `ExtensionUtils`) kommen nicht vor.
- **Ohne GNOME prüfbar:** `bun tools/check-contrast.mjs` (17 GTK-Farbpaare
  erfüllen WCAG AA in hell
  und dunkel, beide Modi definieren dieselben Tokens; dazu 17 Paare der
  dunklen Shell-CSS für Popups, Kalender, Schnelleinstellungen und Dialoge
  sowie 14 Sperrbildschirm-Paare – Uhr/Datum, Eingabe mit Fokus, Entsperr-Knopf,
  Kontoliste, Benachrichtigung mit Medienzeile, Fehlermeldung – sowie 13
  Oberflaechen-Paare fuer Schnelleinstellungen, Benachrichtigungen, OSD,
  Fensterkennung und Screenshot-UI, jeweils in hell und dunkel;
  halbtransparente Flaechen ueber dem
  Hintergrund gerechnet)
  und
  `bun tools/check-settings.mjs` (jeder gesetzte Schlüssel steht mit
  Mindestversion in `data/settings-keys.json`). Der Kontrastlauf hat dabei
  zwei echte Fehler gefunden: im Dunkelmodus fehlten die Tokens für
  Destructive/Success/Warning/Error, und Weiß auf `#1e8e3e` lag mit 4,21:1
  unter AA – beides ist korrigiert.

Nicht beweisbar ohne laufende GNOME-Sitzung: das tatsächliche Rendering von
Shell-Theme und CSS, die Position von Popups und Kontextmenüs über der
Shelf, wie libadwaita die GTK-4-Farbtokens tatsächlich auflöst, wie der
Mauszeiger auf dem Desktop aussieht, das Verhalten des echten
Shell-Prozesses beim Umhängen der Tray-Buttons und die Optik insgesamt. Auf diesem Rechner ließ sich kein Linux starten: WSL ist
installiert, aber ohne Distribution, und WSL2 startet nicht, weil die
Virtualisierung im BIOS deaktiviert ist (kein Docker/Podman). Die Skripte
liefen in einer POSIX-Bash (Git Bash) mit GNU-Coreutils, nicht auf einem
Linux-Kernel. Bitte Abweichungen als Issue melden.

---

## Lizenz

MIT – siehe [LICENSE](LICENSE). Die mitgelieferten Schriften Roboto und
Roboto Mono stehen unter der SIL Open Font License 1.1; der Lizenztext liegt
in `fonts/OFL.txt`. Im Repo liegen keine fremden Bilder.
