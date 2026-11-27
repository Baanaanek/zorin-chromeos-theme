// Einstiegspunkt: laedt Shell-Theme, baut Launcher und Shelf.
// Kein Assistant, keine KI-Funktionen, kein Lens.

import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {Launcher} from './launcher.js';
import {Shelf} from './shelf.js';
import {ShellTheme} from './theme.js';

export default class ChromeOSShellExtension extends Extension {
    enable() {
        this._interfaceSettings = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});

        this._theme = new ShellTheme();
        this._theme.enable();

        this._launcher = new Launcher();
        this._shelf = new Shelf(this._launcher);

        try {
            this._shelf.enable();
        } catch (e) {
            console.error(`[chromeos-shell] Shelf konnte nicht aufgebaut werden: ${e}`);
        }
        try {
            this._launcher.enable();
        } catch (e) {
            console.error(`[chromeos-shell] Launcher konnte nicht aufgebaut werden: ${e}`);
        }

        this._colorSchemeId = this._interfaceSettings.connect('changed::color-scheme',
            () => this._syncColorScheme());
        this._syncColorScheme();

        // Supertaste oeffnet den Launcher statt der GNOME-Uebersicht.
        this._overviewId = 0;
        try {
            this._overviewId = Main.overview.connect('showing', () => this._onOverviewShowing());
        } catch (e) {
            console.warn(`[chromeos-shell] Uebersicht nicht abfangbar: ${e}`);
        }
    }

    _syncColorScheme() {
        const dark = this._interfaceSettings.get_string('color-scheme') === 'prefer-dark';
        this._launcher?.setDark(dark);
        this._shelf?.setDark(dark);
    }

    _onOverviewShowing() {
        if (this._handlingOverview)
            return;
        this._handlingOverview = true;
        try {
            Main.overview.hide();
        } catch (e) {
            console.error(`[chromeos-shell] Uebersicht nicht ausblendbar: ${e}`);
        } finally {
            this._handlingOverview = false;
        }
        this._launcher?.toggle();
    }

    disable() {
        if (this._overviewId) {
            Main.overview.disconnect(this._overviewId);
            this._overviewId = 0;
        }
        if (this._colorSchemeId) {
            this._interfaceSettings.disconnect(this._colorSchemeId);
            this._colorSchemeId = 0;
        }

        this._launcher?.destroy();
        this._shelf?.destroy();
        this._theme?.disable();

        this._launcher = null;
        this._shelf = null;
        this._theme = null;
        this._interfaceSettings = null;
    }
}
