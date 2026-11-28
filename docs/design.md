# Design-Notizen

## Aufbau

| Ebene | Datei | Wirkung |
| --- | --- | --- |
| Shell-Theme | `theme/ChromeOS/gnome-shell/gnome-shell.css` | Panel, Popups, Schnelleinstellungen, App-Raster, OSD, Benachrichtigungen |
| Shell-Theme dunkel | `theme/ChromeOS/gnome-shell/gnome-shell-dark.css` | Farb-Overlay derselben Selektoren, geladen bei `color-scheme prefer-dark` |
| Launcher + Shelf | `extension/chromeos-shell@baanaanek.github.io/` | ChromeOS-Launcher (Suchfeld + App-Raster), Shelf unten, Tray rechts, Websuche |
| GTK-Theme | `theme/ChromeOS/gtk-3.0/` | Fenster, Titelleisten, Buttons, Eingabefelder, Menues fuer GTK-3-Apps |
| GTK-4/libadwaita | `theme/ChromeOS/gtk-4.0/gtk.css` | Farbtokens und Radien fuer GNOME-46-Apps (Dateien, Einstellungen, Texteditor, Konsole); wird als `~/.config/gtk-4.0/gtk.css` installiert |
| Mauszeiger | `cursor/ChromeOS/` | eigener Xcursor-Satz (52 Namen, 24/48 px), erzeugt aus `tools/build-cursors.mjs` |
| Schriften | `fonts/` | Roboto + Roboto Mono (SIL OFL 1.1), Installation nach `~/.local/share/fonts/ChromeOS` |

Das Shell-Theme wird **von der Extension selbst** geladen
(`theme.js` → `St.Theme.load_stylesheet()`). Dadurch braucht das Theme keine
`user-theme`-Erweiterung und die Deinstallation raeumt alles wieder ab.

St kennt keine `@media (prefers-color-scheme)`-Abfragen. Der Dunkelmodus ist
deshalb eine zweite Datei: `theme.js` laedt immer `gnome-shell.css` und bei
`org.gnome.desktop.interface color-scheme = prefer-dark` zusaetzlich
`gnome-shell-dark.css`. Bei einem Wechsel meldet es beide Dateien ab und
laedt die passende Fassung neu, damit keine Farbe der anderen stehen bleibt.

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
Dunkel Flaeche    #202124   (Popups, Menues, Suchfeld)
Dunkel Karte      #292a2d   (Dialoge, Benachrichtigungen, Untemenues)
Dunkel Text       #e8eaed
Dunkel sekundaer  #9aa0a6
Dunkel Akzent     #8ab4f8   (mit Text #202124 auf der Flaeche)
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
  Websuche. `Esc` schliesst. Pfeil unten fuehrt aus dem Suchfeld ins Raster,
  die Pfeiltasten wandern durch Raster (zeilenweise, 5 Spalten) und Treffer
  (einzeln); Pfeil oben aus der ersten Zeile zurueck ins Suchfeld.
- Rechts im Suchfeld erscheint mit dem ersten Zeichen ein Loesch-Knopf, der
  das Feld leert und wieder das volle App-Raster zeigt.
- Unter dem App-Raster zeigen Seitenpunkte die aktuelle Bildschirmseite an;
  bei einer einzigen Seite und waehrend der Suche bleiben sie verborgen. Die
  Punkte sind Knoepfe: ein Klick springt auf die Seite, der Scrollwert wird
  dabei auf den Scrollbereich begrenzt.
- Die Websuche-Zeile zeigt die erkannte Suchmaschine an und oeffnet sie im
  Standardbrowser.
- Klick auf ein angeheftetes App-Icon startet die App bzw. holt ein
  vorhandenes Fenster nach vorne; Mittelklick oeffnet ein neues Fenster.
- Rechtsklick auf ein Shelf- oder Launcher-Icon oeffnet ein Kontextmenue:
  Neues Fenster (`open_new_window(-1)`, nur wenn `can_open_new_window()`
  nicht widerspricht), An die Shelf anheften bzw. von ihr entfernen, Fenster
  schliessen (nur bei laufenden Fenstern) und App-Info (oeffnet
  `appstream://<app-id>`).
- Zwischen angehefteten und nur laufenden Apps steht ein duenner Trenner wie
  in ChromeOS; ohne laufende Apps entfaellt er.
- Uhr und Status-Icons rechts in der Shelf sind die echten
  GNOME-Panel-Buttons: Klick oeffnet Kalender bzw. Schnelleinstellungen,
  die dann direkt ueber der Shelf erscheinen. Mit dem Panel wandern auch
  Tastaturbelegung, Aufnahme- und Freigabe-Indikator in die Shelf; sie
  waeren sonst mit der ausgeblendeten Leiste verschwunden. Ihre
  Sichtbarkeit steuert weiter GNOME (Aufnahme/Freigabe nur bei Bedarf).

- Der Sperrbildschirm folgt dem echten ChromeOS (1366 x 768): Konto-Bild
  96 px rund und ohne Rahmen, darunter der Name in 18 pt normaler Staerke,
  darunter das Passwortfeld als dunkle Flaeche mit weisser Schrift.
  Benachrichtigungen liegen als dunkle Karten darueber, kritische in Rot.
  Uhr, Datum und Hinweis, Entsperren-Knopf, Kontoliste und Medienzeile sind
  auf denselben Look gezogen; Radius (8 px) und Innenabstand kommen aus dem
  GNOME-Theme. Ueber dem Bild liegt ein dunkler Schleier: GNOME dunkelt nur
  auf 65 % Helligkeit ab, weisse Schrift kaeme auf einem hellen Motiv sonst
  auf 2,5:1. Den Hintergrund liefert GNOME selbst (das eigene Desktop-Bild,
  weichgezeichnet und abgedunkelt); das Theme bringt bewusst kein
  Hintergrundbild mit und laesst die Einstellung unangetastet.

### Sperrbildschirm: Abdeckung in beiden Modi

`gnome-shell.css` gestaltet den Sperrbildschirm vollstaendig: Schleier,
Uhr/Datum/Hinweis, Passwortfeld samt Fokus, Entsperren-Knopf samt Hover und
Fokus, Kontoliste samt Hover, Auswahl und angemeldetem Konto,
Benachrichtigungs- und Medienkarten samt kritischer Farbe, Fehlermeldung bei
falscher PIN. `gnome-shell-dark.css` setzt dieselben Regeln dichter und mit
fester Schriftfarbe.

| Bereich in `gnome-shell.css` | hell | im Dunkelmodus |
| --- | --- | --- |
| Schleier `.unlock-dialog` | `rgba(32,33,36,0.80)` | `rgba(20,21,23,0.86)` |
| `.unlock-dialog-clock-time` / `-date` / `-hint` | `#ffffff` / `#e8eaed` | gleich, festgeschrieben |
| `.unlock-dialog .login-dialog-prompt-entry` (+`:focus`) | `rgba(60,64,67,0.78)` bzw. `0.90`, Text `#ffffff` | `0.93` bzw. `0.97`, Text `#e8eaed` |
| `.unlock-dialog .button` (+`:hover`, `:focus`) | `#1a73e8` + `#ffffff` | `#8ab4f8` + `#202124` |
| `.login-dialog-user-list-item` (+`:hover`, `:focus`, `:selected`, `:logged-in`) | Karte `rgba(60,64,67,0.78)`, Auswahl `#1a73e8` | Karte `rgba(60,64,67,0.93)`, Auswahl `#8ab4f8` |
| `.unlock-dialog-notification-source` / `.critical` | `rgba(32,33,36,0.78)` / `rgba(179,38,30,0.92)` | `rgba(32,33,36,0.92)` / `rgba(155,28,22,0.92)` |
| `.message-media-control` (+`:hover`) | `rgba(60,64,67,0.78)`, aktiv `#1a73e8` | `0.93`, aktiv `#8ab4f8` |
| `.login-dialog-message-warning` | `#f2b8b5` | `#f2b8b5` |

Alle Sperrbildschirm-Flaechen sind halbtransparent und liegen ueber dem
weichgezeichneten Hintergrundbild; `tools/check-contrast.mjs` rechnet sie
deshalb ueber `#ffffff` (hellstmoegliches Motiv) statt ueber eine angenommene
Flaeche und prueft dieselben 14 Paare je einmal in hell und dunkel. Vorher
lagen die hellen Werte bei 3,6–3,8:1; jetzt sind beide Modi dicht und die
Textfarbe ist festgeschrieben.

### Apps und die uebrigen Shell-Flaechen

- **Einstellungen und Dateien** (GTK 4/libadwaita) nehmen ihre Farben aus
  `gtk-4.0/gtk.css`: Fenster, Ansicht, Kopfleiste, Karten, Popover, Dialoge,
  Seitenleisten, Akzent- und Statusfarben. Beide Programme folgen damit dem
  Theme, ohne dass ein Widget einzeln nachgebaut wird.
- **Zorin-Programme** (Zorin Appearance, Zorin Connect) und Dateidialoge sind
  GTK 3 und nutzen `gtk-3.0/gtk.css` bzw. `gtk-dark.css`: Kopfleisten,
  Buttons, Eingaben, Listen, Seitenleisten, Schalter, Tabs, Popover und
  Scrollbars, dazu Infoleisten (info/warning/error), Werkzeugleisten und die
  Auswahl in Baumansichten und Pfadleisten.
- **Schnelleinstellungen**: Karten mit 20 px Radius, Akzent beim Einschalten,
  Untertitel in `#5f6368` (dunkel `#9aa0a6`), runde Regler und Umschalter.
- **Benachrichtigungen**: Karten wie Popups, Aktionsknoepfe als blaue Pillen,
  die Medienzeile als dieselbe Pille.
- **OSD und Fensterkennung** liegen in beiden Modi dunkel wie in ChromeOS,
  weil sie ueber beliebigem Bildinhalt stehen.
- **Screenshot-UI**: Werkzeugleiste als schwebende Karte (hell `#f8f9fa`,
  dunkel `#292a2d`), Modus- und Geraeteknoepfe, Ausloeser mit Ring,
  Auswahlrahmen und Fenster-/Bildschirmwahl im Akzent, Tooltip als dunkle
  Kapsel.
- **Fensterumschalter** (Alt+Tab, Alt+^): dieselbe Karte, Vorschaubilder mit
  1 px Rand, Auswahl als blaue Flaeche (dunkel `#8ab4f8`), Pfeile an Apps mit
  mehreren Fenstern, Zyklus-Rahmen (Alt+Esc) im Akzent.
- **Shell-Dialoge**: Abmelden/Ausschalten mit Akku-Warnung, Ausfuehren
  (Alt+F2), Passphrase und Polkit, Audiogeraetewahl, Zugriffsfreigabe. Sie
  liegen auf `.modal-dialog`; Warnungen `#9a5300` (dunkel `#fdd663`), Fehler
  `#c5221f` (dunkel `#f28b82`).
- **GTK-3-Menues**: Menueleiste klassischer Programme, Popover-Menues
  (`modelbutton`) mit Akzent-Auswahl, Trennlinien und Combobox-Knoepfe.

`tools/check-contrast.mjs` prueft 13 Oberflaechen- und 8 Umschalter-/
Dialog-Paare je einmal in hell und dunkel; `tests/scripts/run.sh` prueft,
dass die Regeln im Repo und im installierten Theme liegen.

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
