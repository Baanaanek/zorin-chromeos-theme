# Design-Notizen

## Aufbau

| Ebene | Datei | Wirkung |
| --- | --- | --- |
| Shell-Theme | `theme/ChromeOS/gnome-shell/gnome-shell.css` | Panel, Popups, Schnelleinstellungen, App-Raster, OSD, Benachrichtigungen |
| Launcher + Shelf | `extension/chromeos-shell@baanaanek.github.io/` | ChromeOS-Launcher (Suchfeld + App-Raster), Shelf unten, Tray rechts, Websuche |
| GTK-Theme | `theme/ChromeOS/gtk-3.0/` | Fenster, Titelleisten, Buttons, Eingabefelder, Menues fuer GTK-3-Apps |
| GTK-4/libadwaita | `theme/ChromeOS/gtk-4.0/gtk.css` | Farbtokens und Radien fuer GNOME-46-Apps (Dateien, Einstellungen, Texteditor, Konsole); wird als `~/.config/gtk-4.0/gtk.css` installiert |
| Mauszeiger | `cursor/ChromeOS/` | eigener Xcursor-Satz (52 Namen, 24/48 px), erzeugt aus `tools/build-cursors.mjs` |
| Hintergruende | `assets/wallpapers/` | Drei eigene Motive (Blau-Verlauf, Iris, See), erzeugt von `tools/build-wallpapers.mjs` |
| Schriften | `fonts/` | Roboto + Roboto Mono (SIL OFL 1.1), Installation nach `~/.local/share/fonts/ChromeOS` |

Das Shell-Theme wird **von der Extension selbst** geladen
(`theme.js` → `St.Theme.load_stylesheet()`). Dadurch braucht das Theme keine
`user-theme`-Erweiterung und die Deinstallation raeumt alles wieder ab.

## Design-Tokens

```
Akzent           #1a73e8   (ChromeOS-Blau)
Akzent dunkel    #1b66c9
Text             #202124
Text sekundaer   #5f6368
Flaeche hell     #f8f9fa
Flaeche Karte    #ffffff
Trennlinien      rgba(60,64,67,0.12)
Shelf            rgba(255,255,255,0.88)
Radius gross     24px (Launcher, Popups)
Radius mittel    16px (Shelf, Kacheln)
Radius klein     8px  (Buttons, Eingaben)
Schrift          "Roboto" (liegt im Repo bei), Monospace "Roboto Mono"
```

## Geometrie

- Shelf: volle Breite minus 8 px je Seite, Hoehe 56 px, 8 px ueber dem
  unteren Rand, Innenabstand 10 px.
- Launcher: 560 px breit, max. 760 px hoch, 8 px vom oberen/linken Rand.
- App-Raster: 5 Spalten, Icons 48 px, Beschriftung zentriert, zwei Zeilen
  mit Ellipse.
- Suchfeld: 18 px Lupe, transparenter Eingabebereich, 1 px Trennlinie
  darunter.

## Verhalten

- Klick auf den runden Knopf links in der Shelf oder `Super` oeffnet den
  Launcher (GNOME-Overview wird dafuer abgefangen).
- Tippen filtert Apps; `Enter` oeffnet den ersten Treffer, sonst die
  Websuche. `Esc` schliesst.
- Rechts im Suchfeld erscheint mit dem ersten Zeichen ein Loesch-Knopf, der
  das Feld leert und wieder das volle App-Raster zeigt.
- Unter dem App-Raster zeigen Seitenpunkte die aktuelle Bildschirmseite an;
  bei einer einzigen Seite und waehrend der Suche bleiben sie verborgen.
- Die Websuche-Zeile zeigt die erkannte Suchmaschine an und oeffnet sie im
  Standardbrowser.
- Klick auf ein angeheftetes App-Icon startet die App bzw. holt ein
  vorhandenes Fenster nach vorne; Mittelklick oeffnet ein neues Fenster.
- Rechtsklick auf ein Shelf- oder Launcher-Icon oeffnet ein Kontextmenue:
  An die Shelf anheften bzw. von ihr entfernen, Fenster schliessen (nur bei
  laufenden Fenstern) und App-Info (oeffnet `appstream://<app-id>`).
- Uhr und Status-Icons rechts in der Shelf sind die echten
  GNOME-Panel-Buttons: Klick oeffnet Kalender bzw. Schnelleinstellungen,
  die dann direkt ueber der Shelf erscheinen.

- Der Sperrbildschirm folgt dem echten ChromeOS (1366 x 768): Konto-Bild
  96 px rund und ohne Rahmen, darunter der Name in 18 pt normaler Staerke,
  darunter das Passwortfeld als dunkle Flaeche mit weisser Schrift.
  Benachrichtigungen liegen als dunkle Karten darueber, kritische in Rot.
  Gesetzt werden nur diese Abweichungen; Uhr, Knoepfe, Radius (8 px),
  Innenabstand und Textfarben kommen aus dem GNOME-Theme. Den Hintergrund
  liefert GNOME selbst (Desktop-Bild, weichgezeichnet und abgedunkelt),
  deshalb braucht der Sperrbildschirm keine eigene Einstellung.
- Nicht nachbaubar, weil GNOME Shell die Aufbauten festlegt: die Knoepfe
  "Shut down"/"Sign out" unten links, Datum/Uhrzeit/Akku unten rechts, das
  Auge-Symbol im Feld, der runde Weiter-Pfeil daneben und der
  Aufklapp-Pfeil am Namen. GNOME zeigt stattdessen die grosse Uhr in der
  Mitte, solange niemand eine Taste drueckt, und einen Kontowechsel-Knopf
  unten rechts.

## Grenzen

- GNOME-Schnelleinstellungen sind kein 1:1-Nachbau des ChromeOS-Trays
  (Kachelraster bleibt GNOME), nur Optik und Position werden angeglichen.
- GNOME-Overview/Arbeitsflaechen bleiben vorhanden (Ctrl+Alt+Up/Down), weil
  Zorin sie fuer Fensterverwaltung und Arbeitsbereiche braucht.
- libadwaita-Apps uebernehmen ueber die Nutzer-CSS Farben, Akzent, Radien
  und Schrift, aber nicht ihr Layout (Sidebars, Karten, Headerbar-Aufbau).
- Icon-Set und Google Sans sind nicht frei lizenzierbar (Roboto liegt bei,
  Zorins Icons bleiben); der GDM-Anmeldebildschirm vor der Anmeldung,
  Plymouth und Systemklaenge braeuchten sudo. Der Sperrbildschirm nach der
  Anmeldung ist gestaltet (Uhr, Konto, Passwortfeld).
