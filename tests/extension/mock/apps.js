// Feste App-Liste fuer die Mocks (deterministisch, ohne echte .desktop-Dateien).

import St from './St.js';
import {state} from './state.js';

export class FakeApp {
    constructor(name, id, description, windows = [], visible = true) {
        this._name = name;
        this._id = id;
        this._description = description;
        this._windows = windows.map(window => ({
            ...window,
            deleted: 0,
            delete(_timestamp) {
                this.deleted++;
                state.closedWindows.push(this.id);
            },
        }));
        this.icon = {name: `${id}-icon`};
        this.opened = 0;
        this._info = {should_show: () => visible};
    }

    should_show() {
        return this._info.should_show();
    }

    get_name() {
        return this._name;
    }

    get_id() {
        return this._id;
    }

    get_description() {
        return this._description;
    }

    get_windows() {
        return this._windows;
    }

    get_app_info() {
        return this._info;
    }

    open_new_window(_workspace) {
        this.opened++;
    }

    create_icon_texture(size) {
        const texture = new St.Icon({icon_size: size, style_class: 'chromeos-icon-texture'});
        texture._appId = this._id;
        return texture;
    }
}

export const terminal = new FakeApp('Terminal', 'org.gnome.Terminal',
    'Befehle ausfuehren', [{id: 'terminal-window'}]);
export const firefox = new FakeApp('Firefox', 'firefox', 'Webbrowser');
export const files = new FakeApp('Files', 'org.gnome.Nautilus', 'Dateien durchsuchen');
export const editor = new FakeApp('Text Editor', 'org.gnome.TextEditor', 'Text schreiben');
export const settings = new FakeApp('Settings', 'org.gnome.Settings', 'Systemeinstellungen');
export const calculator = new FakeApp('Calculator', 'org.gnome.Calculator', 'Rechnen');

// NoDisplay-App: get_installed() liefert sie, angezeigt werden darf sie nicht.
export const hidden = new FakeApp('Hidden Tool', 'hidden-tool',
    'Nicht anzeigen', [], false);

export const installed = [terminal, firefox, files, editor, settings, calculator, hidden];
export const visibleApps = installed.filter(app => app.should_show());
export const running = [terminal];
export const favorites = [firefox, terminal];
