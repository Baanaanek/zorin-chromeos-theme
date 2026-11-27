// Laedt das Shell-Theme aus ~/.local/share/themes/ChromeOS/gnome-shell/.
// So braucht das Theme keine user-theme-Erweiterung.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

function candidatePaths() {
    return [
        GLib.build_filenamev([GLib.get_user_data_dir(), 'themes', 'ChromeOS',
                              'gnome-shell', 'gnome-shell.css']),
        GLib.build_filenamev([GLib.get_home_dir(), '.themes', 'ChromeOS',
                              'gnome-shell', 'gnome-shell.css']),
        '/usr/share/themes/ChromeOS/gnome-shell/gnome-shell.css',
    ];
}

export class ShellTheme {
    constructor() {
        this._file = null;
        this._theme = null;
    }

    enable() {
        const path = candidatePaths().find(p => GLib.file_test(p, GLib.FileTest.IS_REGULAR));
        if (!path) {
            console.warn('[chromeos-shell] Shell-Theme-CSS nicht gefunden - Optik bleibt GNOME-Standard.');
            return;
        }
        try {
            this._theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            this._file = Gio.File.new_for_path(path);
            this._theme.load_stylesheet(this._file);
        } catch (e) {
            console.error(`[chromeos-shell] Shell-Theme nicht ladbar: ${e}`);
            this._file = null;
            this._theme = null;
        }
    }

    disable() {
        if (this._theme && this._file) {
            try {
                this._theme.unload_stylesheet(this._file);
            } catch (e) {
                // Theme wurde zwischenzeitlich neu geladen.
            }
        }
        this._file = null;
        this._theme = null;
    }
}
