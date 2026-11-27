# Referenzbilder (ChromeOS)

Diese Bilder sind die Arbeitsgrundlage fuer das Theme. Sie stammen vom
Projektinhaber (Screenshots von ChromeOS-Desktops) und werden hier nur als
Design-Referenz mitgefuehrt, nicht als Teil des Themes installiert.

| Datei | Zeigt |
| --- | --- |
| `01-launcher-apps.webp` | Launcher links oben: Suchfeld mit Lupe, App-Raster mit 5 Spalten, Shelf unten mit runden Ecken, Tray rechts (Datum, Uhrzeit, WLAN, Akku), runder Launcher-Knopf ganz links. |
| `02-browser-shelf-small.webp` | Shelf in klein (schwebende Leiste), Browserfenster mit heller Titelleiste, Tray-Popup unten rechts. |
| `03-quick-settings-dark.webp` | Schnelleinstellungen als dunkles, stark gerundetes Panel mit Kacheln (WLAN, Bluetooth, Nachtlicht), Lautstaerke-Slider, Fusszeile mit Datum/Akku. |
| `04-quick-settings-light.webp` | Wie oben, helle Variante: 3x2-Kachelraster, runde Icons, Datum links unten. |
| `05-shelf-tray.webp` | Shelf ueber volle Breite: Launcher links, angeheftete Apps, Geraete-Icons, dann Tray mit Datum/Uhrzeit/Akku; rechts ein Panel mit "Pinned files". |
| `06-cursors.png` | Kein ChromeOS-Screenshot, sondern die Vorschau des mitgelieferten eigenen Mauszeiger-Satzes (hell/dunkel), erzeugt von `tools/build-cursors.mjs`. |

## Was daraus ins Theme uebersetzt wurde

- **Farben:** Akzent `#1a73e8`, Text `#202124` / `#5f6368`, Oberflaechen
  `#f8f9fa` / `#ffffff`, Shelf-Weiss mit ~88 % Deckkraft.
- **Radien:** Launcher 24 px, Shelf 16 px, Popups 20–24 px, Kacheln 16 px.
- **Shelf:** 56 px hoch, schwebend mit 8 px Abstand zum Bildschirmrand,
  Launcher-Knopf links, angeheftete + laufende Apps, Tray rechts mit
  Uhrzeit/Datum und Status-Icons.
- **Launcher:** 560 px breit, oben links, Suchzeile mit Lupe, darunter
  App-Raster mit 5 Spalten; Suchtreffer als Listeneintraege.

## Bewusste Abweichungen

- Kein Gemini-/Assistant-Knopf, keine Mikrofon- und Lens-Icons im Suchfeld
  (ausdrueckliche Vorgabe).
- Keine Google-Dienste im Funktionsumfang: kein Play Store, keine
  "Continue where you left off"-Karten, keine Google-Konto-Integration.
- Die Websuche nutzt die Standardsuchmaschine des Standardbrowsers
  (siehe `bin/chromeos-search-url`), nicht Google.
- GNOME-Schnelleinstellungen bleiben funktional GNOME (Kachel-Layout), werden
  aber im ChromeOS-Stil umgefaerbt und abgerundet.
