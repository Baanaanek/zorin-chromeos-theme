# Tests

Zwei Harnesses, die das Repo ohne GNOME-Sitzung und ohne Änderungen am
echten Benutzerkonto prüfen. Beide nehmen optional einen Repo-Pfad als
erstes Argument (Standard: das Repo, in dem sie liegen).

```bash
bash tests/run-all.sh                # beide Harnesses
bash tests/scripts/run.sh            # nur Install/Uninstall (106 Prüfungen)
bun tests/extension/lifecycle.mjs    # nur Extension (75 Prüfungen)
```

Dazu die Prüfungen ohne GNOME-Bezug, die auch die CI ausführt:

```bash
bun tools/build-cursors.mjs --check
bun tools/check-contrast.mjs
bun tools/check-settings.mjs
```

`node` funktioniert für die JS-Werkzeuge genauso wie `bun`.

## `scripts/run.sh` – Installation und Deinstallation

Legt ein temporäres `HOME` an, ersetzt `gsettings`, `dconf`,
`gnome-extensions`, `gnome-shell`, `fc-match` und `python3` durch Stubs aus
`scripts/stubs/` und spielt den kompletten Lebenszyklus durch:

- Probelauf (`--dry-run`): Exit 0, keine Datei, keine Einstellung, keine
  deaktivierte Leiste, die vorhandene GTK-4-Datei bleibt unangetastet.
- `--version` und `--help`, unbekannte Option endet mit 2.
- `--check` vor der Installation: Exit 1, nennt die fehlenden Teile, legt
  nichts an und schreibt keine Einstellung.
- Sperrbildschirm: das Repo-Theme und die installierte Kopie enthalten die
  Regeln für Konto-Bild, Name, Passwortfeld und Benachrichtigungen
  (`--check` meldet eine alte Kopie ohne diese Regeln als Abweichung).
- echter Lauf: Theme, Extension, Mauszeiger-Satz, Schriften, GTK-4-Farbdatei
  und Suchhelfer landen am dokumentierten Ort, 19 Einstellungen werden gesetzt
  (inkl. `cursor-theme`, `cursor-size`, `show-battery-percentage`, drei
  Schrift- und drei DING-Keys), Zorin-Leisten deaktiviert, die Extension
  aktiviert. Die installierten Teile stehen in `components.txt`.
- `--check` nach der Installation: Exit 0 und „Alles wie erwartet“.
- zweiter Lauf: idempotent, die Sicherung bleibt bei 22 Einträgen.
- `--activate`: setzt nur Einstellungen und lässt die Dateien unverändert.
- `uninstall.sh --dry-run`: entfernt nichts.
- `uninstall.sh`: entfernt alles, stellt alle 19 gesicherten Werte exakt
  wieder her, resettet Keys, die vorher nie gesetzt waren (der `dconf`-Stub
  macht den Unterschied zwischen „nie gesetzt“ und „auf Standard gesetzt“
  sichtbar), spielt eine vorher eigene `~/.config/gtk-4.0/gtk.css` zurück und
  reaktiviert die Zorin-Leisten.
- Teilinstallation (`--no-cursor --no-gtk4`): der Mauszeiger bleibt weg, die
  eigene GTK-4-Datei unangetastet, `components.txt` nennt nur die
  installierten Teile.
- `uninstall.sh --settings-only`: holt die Einstellungen zurück, lässt
  Dateien und Zustandsordner stehen.
- zweite Deinstallation: räumt den Rest, lässt den nie installierten Cursor
  und die GTK-4-Datei des Nutzers unberührt.
- Lauf ohne GNOME-Werkzeuge: Installation und Deinstallation brechen nicht ab
  und räumen auch Cursor und GTK-4-Datei vollständig auf.

Der Test gilt als bestanden, wenn `110/110` erscheint. `KEEP=1` behält das
temporäre Verzeichnis und gibt den Pfad aus.

## `extension/lifecycle.mjs` – Extension-Lebenszyklus

Kopiert die Extension in ein temporäres Verzeichnis, biegt dort die
`gi://`- und `resource://`-Importe auf die Mocks in `extension/mock/` um und
lädt `extension.js` als echtes ES-Modul. Geprüft werden unter anderem:

- Launcher: Geometrie, Suchfeld, App-Raster, Filtern, Enter, Escape.
- Lösch-Knopf: erscheint erst mit Text, leert das Feld und zeigt wieder alle
  Apps.
- Seitenpunkte: verborgen bei einer Seite und beim Suchen, sichtbar ab zwei
  Seiten, aktive Marke folgt der Scrollposition, Klick springt auf die Seite.
- Tastaturnavigation: Pfeil unten aus dem Suchfeld ins Raster, Pfeile durch
  Raster und Treffer, Pfeil oben zurück ins Suchfeld; ein fokussiertes
  App-Symbol wird in den sichtbaren Bereich gescrollt und die Seitenpunkte
  wandern auf die neue Seite mit.
- Shelf-Trenner zwischen angehefteten und laufenden Apps, „Neues Fenster“ im
  Kontextmenü (ruft `open_new_window(-1)`).
- Shelf: Favoriten, Laufpunkt, Tastaturbelegung, Aufnahme- und
  Freigabe-Indikator, Uhr und Schnelleinstellungen im Tray, ausgeblendetes
  GNOME-Panel, eigener Strut-Actor bis zur Bildschirmkante.
- Sperrbildschirm über `Main.sessionMode` (isLocked/`updated`): Shelf
  unsichtbar und Strut aus dem Chrome entfernt, Geometrieänderungen holen ihn
  nicht zurück, nach dem Entsperren dieselbe Geometrie und Actor-Anzahl,
  wiederholte Updates erzeugen keine Doppel-Actors.
- Kontextmenüs: Rechtsklick auf Shelf- und Launcher-Icons, Anheften und
  Entfernen, Fenster schließen über `window.delete()`, App-Info über
  `appstream://`, Mittelklick weiterhin neues Fenster, Aufräumen beim
  Schließen des Launchers und bei `disable()`.
- Theme: Laden der CSS aus `~/.local/share/themes/ChromeOS/`; bei
  `prefer-dark` wird `gnome-shell-dark.css` zusätzlich geladen, bei `default`
  wieder abgemeldet (vorher die helle Fassung abgemeldet, kein Stapel).
  Die dunkle Datei deckt Popups, Kalender, Schnelleinstellungen, Dialoge,
  OSD, Benachrichtigungen mit Medienzeile, die Screenshot-UI und den
  Sperrbildschirm ab (Uhr/Datum/Hinweis, Passwortfeld mit Fokus,
  Entsperr-Knopf, Kontoliste, Benachrichtigungs- und Medienkarten,
  Fehlermeldung).
- Streckenprüfungen auf Repo-Ebene: das Shell-Theme gestaltet
  Schnelleinstellungen, Benachrichtigungen und Screenshot-UI, die dunkle
  Fassung zusätzlich OSD und Medienzeile; die GTK-3-Themes decken
  Infoleisten, Werkzeugleisten und die Dateiauswahl ab (Zorin-Programme).
- Dunkelmodus über `color-scheme`, Supertaste/Overview.
- `disable()`: Chrome entfernt, Tray exakt zurückgehängt, Panel wieder
  sichtbar, alle Sitzungs-Signale gelöst.
- zweiter `enable()`/`disable()`-Zyklus.

Der Test gilt als bestanden, wenn `75/75` erscheint.

## Grenzen

Die Mocks bilden nur die APIs nach, die die Extension benutzt. Echtes
Rendering, CSS-Optik, die Position von Popups, das Auflösen der
libadwaita-Farbtokens und das Verhalten des echten GNOME-Shell-Prozesses
lassen sich damit nicht prüfen – dafür ist eine laufende Zorin-OS-Sitzung
nötig. Die Xcursor-Prüfung kontrolliert nur die Dateistruktur, nicht, wie der
Zeiger auf dem Desktop wirkt. `check-contrast.mjs` und `build-cursors.mjs --check` ersetzen keine
Sichtprüfung, sie schließen nur die häufigsten Fehler aus.
