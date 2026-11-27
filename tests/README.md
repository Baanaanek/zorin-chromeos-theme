# Tests

Zwei Harnesses, die das Repo ohne GNOME-Sitzung und ohne Änderungen am
echten Benutzerkonto prüfen. Beide nehmen optional einen Repo-Pfad als
erstes Argument (Standard: das Repo, in dem sie liegen).

```bash
bash tests/run-all.sh            # beide
bash tests/scripts/run.sh        # nur Install/Uninstall (57 Prüfungen)
bun tests/extension/lifecycle.mjs   # nur Extension (35 Prüfungen)
```

`node` funktioniert für den Lifecycle-Harness genauso wie `bun`.

## `scripts/run.sh` – Installation und Deinstallation

Legt ein temporäres `HOME` an, ersetzt `gsettings`, `gnome-extensions`,
`gnome-shell`, `fc-match` und `python3` durch Stubs aus `scripts/stubs/` und
spielt den kompletten Lebenszyklus durch:

- Probelauf (`--dry-run`): Exit 0, keine Datei, keine Einstellung, keine
  deaktivierte Leiste.
- echter Lauf: Theme, Extension, Suchhelfer und Hintergrund landen am
  dokumentierten Ort, zwölf Einstellungen werden gesetzt, Zorin-Leisten
  deaktiviert, die Extension aktiviert.
- zweiter Lauf: idempotent, die Sicherung bleibt bei zwölf Einträgen.
- `--activate`: setzt nur Einstellungen und lässt die Dateien unverändert.
- `uninstall.sh --dry-run`: entfernt nichts.
- `uninstall.sh`: entfernt alles, stellt alle zwölf gesicherten Werte exakt
  wieder her und reaktiviert die Zorin-Leisten.
- Lauf ohne GNOME-Werkzeuge: Installation und Deinstallation brechen nicht ab.

Der Test gilt als bestanden, wenn `57/57` erscheint. `KEEP=1` behält das
temporäre Verzeichnis und gibt den Pfad aus.

## `extension/lifecycle.mjs` – Extension-Lebenszyklus

Kopiert die Extension in ein temporäres Verzeichnis, biegt dort die
`gi://`- und `resource://`-Importe auf die Mocks in `extension/mock/` um und
lädt `extension.js` als echtes ES-Modul. Geprüft werden unter anderem:

- Launcher: Geometrie, Suchfeld, App-Raster, Filtern, Enter, Escape.
- Shelf: Favoriten, Laufpunkt, Uhr und Schnelleinstellungen im Tray,
  ausgeblendetes GNOME-Panel.
- Theme: Laden der CSS aus `~/.local/share/themes/ChromeOS/`.
- Dunkelmodus über `color-scheme`, Supertaste/Overview.
- `disable()`: Chrome entfernt, Tray exakt zurückgehängt, Panel wieder
  sichtbar, alle Sitzungs-Signale gelöst.
- zweiter `enable()`/`disable()`-Zyklus.

Der Test gilt als bestanden, wenn `35/35` erscheint.

## Grenzen

Die Mocks bilden nur die APIs nach, die die Extension benutzt. Echtes
Rendering, CSS-Optik, die Position von Popups und das Verhalten des echten
GNOME-Shell-Prozesses lassen sich damit nicht prüfen – dafür ist eine
laufende Zorin-OS-Sitzung nötig.
