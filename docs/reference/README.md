# Design-Referenz

Hier standen frueher Screenshots echter ChromeOS-Desktops. Sie sind aus dem
Repo entfernt: Sie zeigen fremde Konten und Google-Apps und sind nicht frei
lizenzierbar. Ein oeffentliches Repo sollte sie nicht mitfuehren.

Was aus ihnen uebersetzt wurde, steht hier als Text – nachpruefbar in
`theme/ChromeOS/gnome-shell/gnome-shell.css`, `extension/*/stylesheet.css`
und `theme/ChromeOS/gtk-4.0/gtk.css`.

## Farben

- Akzent `#1a73e8` (ChromeOS-Blau), Akzent dunkel `#8ab4f8`.
- Text `#202124`, sekundaer `#5f6368`, auf dunklen Flaechen `#e8eaed` und
  `#9aa0a6`.
- Flaechen: `#f8f9fa` (Fenster), `#ffffff` (Karten, Popups), `#f1f3f4`
  (Titel- und Seitenleisten), dunkel `#202124` / `#292a2d`.
- Shelf: Weiss mit 90 % Deckkraft, dunkel `#292a2d` mit 92 %.
- Trennlinien `rgba(60,64,67,0.12)`, Schatten `rgba(60,64,67,0.24)`.

## Radien und Geometrie

- Launcher 24 px, Shelf 16 px, Popups 20–24 px, Kacheln 16 px, Buttons 8 px,
  Suchfeld-Pille und Laufpunkt 999 px.
- Shelf 56 px hoch, schwebend mit 8 px Abstand zum Bildschirmrand.
- Launcher 560 px breit, max. 760 px hoch, 12 px vom oberen/linken Rand.
- App-Raster: 5 Spalten, Icons 48 px, Beschriftung zweizeilig mit Ellipse.
- Suchzeile: Lupe links, Loesch-Knopf rechts (erscheint mit Text), 1 px
  Trennlinie darunter.
- Seitenpunkte unter dem App-Raster: 6 px Punkt, aktive Seite im Akzentblau.

## Elemente

- Launcher-Knopf als runder Knopf ganz links in der Shelf.
- Angeheftete Apps, danach laufende Apps mit 4 px Laufpunkt darunter.
- Tray rechts: Tastaturbelegung, Aufnahme-/Freigabe-Anzeige, Datum/Uhrzeit,
  dann Schnelleinstellungen; Klick oeffnet Kalender bzw. Schnelleinstellungen
  direkt ueber der Shelf.
- Rechtsklick auf ein Icon: Anheften/Entfernen, Fenster schliessen,
  App-Info.

## Bewusste Abweichungen

- Kein Gemini-/Assistant-Knopf, keine Mikrofon- und Lens-Icons im Suchfeld
  (ausdrueckliche Vorgabe).
- Keine Google-Dienste im Funktionsumfang: kein Play Store, keine
  „Continue where you left off“-Karten, keine Google-Konto-Integration.
- Die Websuche nutzt die Standardsuchmaschine des Standardbrowsers
  (siehe `bin/chromeos-search-url`), nicht Google.
- GNOME-Schnelleinstellungen bleiben funktional GNOME (Kachel-Layout), werden
  aber im ChromeOS-Stil umgefaerbt und abgerundet.
