// Kontextmenue fuer Shelf-Icons und Launcher-Eintraege (Rechtsklick):
// Anheften/Entfernen, Fenster schliessen, App-Info.
// Linksklick und Mittelklick bleiben beim jeweiligen Aufrufer.

import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

function openAppInfo(app) {
    const id = String(app.get_id() ?? '').replace(/\.desktop$/, '');
    if (!id)
        return;
    try {
        // Standardroute der Shell: App-Info ueber die AppStream-ID oeffnen.
        Gio.AppInfo.launch_default_for_uri(`appstream://${id}`, null);
    } catch (e) {
        console.warn(`[chromeos-shell] App-Info nicht verfuegbar: ${e}`);
    }
}

export class AppMenu {
    constructor(app, sourceActor, onChanged) {
        this._app = app;
        this._onChanged = onChanged;
        // In GNOME 45+ ist PopupMenu selbst ein St.Widget (kein .actor mehr);
        // der Konstruktor kennt nur (sourceActor, arrowAlignment, arrowSide).
        this._menu = new PopupMenu.PopupMenu(sourceActor, 0.0, St.Side.BOTTOM);
        this._menu.add_style_class_name('chromeos-app-menu');

        // Ohne Manager bleibt das Menue bei Klick daneben und Escape offen:
        // genau dafuer haengt GNOME jedes PopupMenu an einen.
        this._manager = new PopupMenu.PopupMenuManager(sourceActor);
        this._manager.addMenu(this._menu);

        Main.uiGroup.add_child(this._menu);
        this._menu.hide();
        this._build();
    }

    get items() {
        return this._menu.items ?? [];
    }

    _build() {
        const favorites = AppFavorites.getAppFavorites();
        const id = this._app.get_id();
        const pinned = favorites.isFavorite(id);

        this._menu.addAction(pinned ? 'Von der Shelf entfernen' : 'An die Shelf anheften', () => {
            try {
                if (pinned)
                    favorites.removeFavorite(id);
                else
                    favorites.addFavorite(id);
            } catch (e) {
                console.error(`[chromeos-shell] Favorit nicht aenderbar: ${e}`);
            }
            this._notify();
        });

        let windows = [];
        try {
            windows = this._app.get_windows();
        } catch (e) {
            console.warn(`[chromeos-shell] Fenster nicht lesbar: ${e}`);
        }
        if (windows.length > 0) {
            this._menu.addAction(windows.length === 1 ? 'Fenster schliessen' : 'Alle Fenster schliessen', () => {
                for (const window of windows) {
                    try {
                        window.delete(global.get_current_time());
                    } catch (e) {
                        console.warn(`[chromeos-shell] Fenster nicht schliessbar: ${e}`);
                    }
                }
                this._notify();
            });
        }

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addAction('App-Info', () => openAppInfo(this._app));
    }

    _notify() {
        try {
            this._menu.close();
        } catch (e) {
            // Menue war schon zu.
        }
        this._onChanged?.();
    }

    open() {
        this._menu.open();
    }

    close() {
        try {
            this._menu.close();
        } catch (e) {
            // Menue war schon zu.
        }
    }

    destroy() {
        try {
            this._manager?.destroy?.();
        } catch (e) {
            // Manager war schon weg.
        }
        this._manager = null;
        try {
            this._menu?.destroy();
        } catch (e) {
            // Menue war schon weg.
        }
        this._menu = null;
    }
}

// Haelt hoechstens ein offenes Menue; jedes neue schliesst das alte.
export class ContextMenu {
    constructor() {
        this._menu = null;
    }

    get menu() {
        return this._menu;
    }

    open(app, sourceActor, onChanged) {
        this.close();
        this._menu = new AppMenu(app, sourceActor, onChanged);
        this._menu.open();
        return this._menu;
    }

    close() {
        if (this._menu) {
            this._menu.destroy();
            this._menu = null;
        }
    }

    destroy() {
        this.close();
    }
}
