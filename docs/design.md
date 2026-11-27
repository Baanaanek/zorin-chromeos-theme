# Design-Notizen

## Aufbau

| Ebene | Datei | Wirkung |
| --- | --- | --- |
| Shell-Theme | `theme/ChromeOS/gnome-shell/gnome-shell.css` | Panel, Popups, Schnelleinstellungen, App-Raster, OSD, Benachrichtigungen |
| Launcher + Shelf | `extension/chromeos-shell@baanaanek.github.io/` | ChromeOS-Launcher (Suchfeld + App-Raster), Shelf unten, Tray rechts, Websuche |
| GTK-Theme | `theme/ChromeOS/gtk-3.0/` | Fenster, Titelleisten, Buttons, Eingabefelder, Menues fuer GTK-3-Apps |
| Hintergruende | `assets/wallpapers/` | Drei eigene Motive (Blau-Verlauf, Iris, Bergsee) |

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
Schrift          "Google Sans", "Roboto", "Cantarell", sans-serif
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
- Die Websuche-Zeile zeigt die erkannte Suchmaschine an und oeffnet sie im
  Standardbrowser.
- Klick auf ein angeheftetes App-Icon startet die App bzw. holt ein
  vorhandenes Fenster nach vorne; Mittelklick oeffnet ein neues Fenster.
- Uhr und Status-Icons rechts in der Shelf sind die echten
  GNOME-Panel-Buttons: Klick oeffnet Kalender bzw. Schnelleinstellungen,
  die dann direkt ueber der Shelf erscheinen.

## Grenzen

- GNOME-Schnelleinstellungen sind kein 1:1-Nachbau des ChromeOS-Trays
  (Kachelraster bleibt GNOME), nur Optik und Position werden angeglichen.
- GNOME-Overview/Arbeitsflaechen bleiben vorhanden (Ctrl+Alt+Up/Down), weil
  Zorin sie fuer Fensterverwaltung und Arbeitsbereiche braucht.
- libadwaita-Apps ignorieren GTK-Themes weitgehend; dort wirkt nur der
  gesetzte Akzent.
