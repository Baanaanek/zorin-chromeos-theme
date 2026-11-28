// Laedt das Shell-Theme aus ~/.local/share/themes/ChromeOS/gnome-shell/.
// So braucht das Theme keine user-theme-Erweiterung.
//
// St (die CSS-Engine der Shell) kennt keine @media-Abfragen, deshalb gibt es
// eine zweite Datei fuer den Dunkelmodus. Sie wird zusaetzlich geladen und
// ueberschreibt die hellen Regeln; geladen wird passend zu
// org.gnome.desktop.interface color-scheme.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

const BASE_NAME = 'gnome-shell.css';
const DARK_NAME = 'gnome-shell-dark.css';

function candidatePaths(name) {
    return [
        GLib.build_filenamev([GLib.get_user_data_dir(), 'themes', 'ChromeOS',
                              'gnome-shell', name]),
        GLib.build_filenamev([GLib.get_home_dir(), '.themes', 'ChromeOS',
                              'gnome-shell', name]),
        GLib.build_filenamev(['/usr/share/themes/ChromeOS', 'gnome-shell', name]),
    ];
}

export class ShellTheme {
    constructor() {
        this._theme = null;
        this._files = [];
        this._settings = null;
        this._signal = 0;
    }

    enable() {
        try {
            this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        } catch (e) {
            console.error(`[chromeos-shell] Theme-Kontext nicht verfuegbar: ${e}`);
            this._theme = null;
            return;
        }

        try {
            this._settings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
            this._signal = this._settings.connect('changed::color-scheme',
                () => this._reload());
        } catch (e) {
            // Ohne Einstellungen bleibt es bei der hellen Fassung.
            this._settings = null;
        }

        this._reload();
    }

    _dark() {
        try {
            return this._settings?.get_string('color-scheme') === 'prefer-dark';
        } catch (e) {
            return false;
        }
    }

    _find(name) {
        return candidatePaths(name).find(p => GLib.file_test(p, GLib.FileTest.IS_REGULAR));
    }

    _load(path) {
        const file = Gio.File.new_for_path(path);
        if (!this._theme.load_stylesheet(file)) {
            console.error(`[chromeos-shell] Shell-Theme wurde abgelehnt (CSS-Fehler): ${path}`);
            return;
        }
        this._files.push(file);
    }

    // Bei einem Wechsel von color-scheme haengt die Shell die alten Dateien
    // ab und laedt die passende Fassung neu; sonst bliebe die zuletzt
    // geladene Farbe stehen.
    _reload() {
        if (!this._theme)
            return;
        for (const file of this._files) {
            try {
                this._theme.unload_stylesheet(file);
            } catch (e) {
                // Theme wurde zwischenzeitlich neu geladen.
            }
        }
        this._files = [];

        const base = this._find(BASE_NAME);
        if (!base) {
            console.warn('[chromeos-shell] Shell-Theme-CSS nicht gefunden - Optik bleibt GNOME-Standard.');
            return;
        }
        this._load(base);

        if (!this._dark())
            return;
        const dark = this._find(DARK_NAME);
        if (!dark) {
            console.warn('[chromeos-shell] Dunkle Shell-CSS fehlt - Popups und Dialoge bleiben hell.');
            return;
        }
        this._load(dark);
    }

    disable() {
        if (this._signal) {
            try {
                this._settings.disconnect(this._signal);
            } catch (e) {
                // Einstellungen sind bereits weg.
            }
            this._signal = 0;
        }
        for (const file of this._files) {
            try {
                this._theme?.unload_stylesheet(file);
            } catch (e) {
                // Theme wurde zwischenzeitlich neu geladen.
            }
        }
        this._files = [];
        this._settings = null;
        this._theme = null;
    }
}
