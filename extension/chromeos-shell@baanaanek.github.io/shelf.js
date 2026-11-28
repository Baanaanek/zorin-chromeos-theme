// ChromeOS-Shelf: Leiste unten, Launcher-Knopf links, angeheftete und
// laufende Apps, rechts Uhr + Status. Die echten GNOME-Panel-Knoepfe
// (Datum, Schnelleinstellungen) werden in die Shelf umgehaengt, damit
// Kalender und Tray direkt ueber der Leiste erscheinen.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';

import {ContextMenu} from './menu.js';
import {shouldShow} from './appInfo.js';

const SHELF_MARGIN = 8;

// Statusanzeigen, die sonst mit dem ausgeblendeten Panel verschwinden.
// Reihenfolge von links nach rechts; Uhr und Schnelleinstellungen bleiben
// rechts aussen.
const STATUS_ROLES = ['keyboard', 'screenRecording', 'remoteAccess'];

function extensionDirectory() {
    const [path] = GLib.filename_from_uri(import.meta.url);
    return GLib.path_get_dirname(path);
}

function launcherIcon() {
    const file = Gio.File.new_for_path(
        GLib.build_filenamev([extensionDirectory(), 'icons', 'launcher.svg']));
    return new St.Icon({
        gicon: new Gio.FileIcon({file}),
        icon_size: 22,
        style_class: 'chromeos-launcher-icon',
    });
}

export class Shelf {
    constructor(launcher) {
        this._launcher = launcher;
        this._moved = [];
        this._signals = [];
        this._chromeAdded = false;
        this._strutAdded = false;
        this._locked = false;
        this._destroyed = false;
        this._contextMenu = new ContextMenu();
        this._build();
    }

    _build() {
        this.actor = new St.BoxLayout({
            name: 'chromeosShelf',
            style_class: 'chromeos-shelf',
            reactive: true,
            track_hover: true,
        });

        this._launcherButton = new St.Button({
            style_class: 'chromeos-launcher-button',
            can_focus: true,
            child: launcherIcon(),
        });
        this._launcherButton.connect('clicked', () => this._launcher.toggle());
        this.actor.add_child(this._launcherButton);

        this.actor.add_child(new St.Widget({style_class: 'chromeos-shelf-divider'}));

        this._appsBox = new St.BoxLayout({
            style_class: 'chromeos-shelf-apps',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.actor.add_child(this._appsBox);

        this.actor.add_child(new St.Widget({x_expand: true}));

        this.actor.add_child(new St.Widget({style_class: 'chromeos-shelf-divider'}));

        this._tray = new St.BoxLayout({
            style_class: 'chromeos-shelf-tray',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.actor.add_child(this._tray);

        this._listen(this.actor, 'notify::height', () => this._updateGeometry());

        // Unsichtbarer Strut-Actor. GNOME legt einen Strut nur an, wenn der
        // Actor eine Monitor-Kante beruehrt (layout.js, addChrome); die
        // sichtbare Leiste schwebt aber 8 px ueber dem Rand. Dieser Actor
        // reicht bis zur Unterkante und traegt die 8 px Luft mit, damit
        // maximierte Fenster nicht unter der Shelf liegen.
        this._strutActor = new St.Widget({
            name: 'chromeosShelfStrut',
            reactive: false,
        });
    }

    _listen(object, signal, callback) {
        try {
            this._signals.push([object, object.connect(signal, callback)]);
        } catch (e) {
            console.warn(`[chromeos-shell] Signal ${signal} nicht verfuegbar: ${e}`);
        }
    }

    enable() {
        Main.layoutManager.addChrome(this.actor, {
            affectsInputRegion: true,
            trackFullscreen: true,
        });
        this._chromeAdded = true;
        this._addStrut();

        this._attachTray();
        this._refreshApps();
        this._updateGeometry();

        // Sperrbildschirm: GNOME schiebt beim Sperren den Session-Mode
        // "unlock-dialog" ein (isLocked, screenShield.activate) und meldet
        // das ueber 'updated'. Kein Polling, und der Zustand wird beim
        // Aktivieren einmal uebernommen, falls schon gesperrt ist.
        this._syncLocked(Main.sessionMode?.isLocked === true);
        this._listen(Main.sessionMode, 'updated',
            () => this._syncLocked(Main.sessionMode.isLocked === true));

        this._listen(AppFavorites.getAppFavorites(), 'changed', () => {
            this._refreshApps();
            this._updateGeometry();
        });
        // Startet oder endet eine App, aendert sich die Menge der Knoepfe,
        // nicht nur ihr Laufpunkt.
        this._listen(Shell.AppSystem.get_default(), 'app-state-changed', () => {
            this._refreshApps();
            this._updateGeometry();
        });
        this._listen(Shell.AppSystem.get_default(), 'installed-changed', () => this._refreshApps());
        this._listen(global.display, 'notify::focus-window', () => this._updateRunning());
        this._listen(Main.layoutManager, 'monitors-changed', () => this._updateGeometry());
    }

    destroy() {
        this._destroyed = true;
        this._contextMenu.destroy();
        for (const [object, id] of this._signals) {
            try {
                object.disconnect(id);
            } catch (e) {
                // Objekt ist bereits weg.
            }
        }
        this._signals = [];

        this._restoreTray();
        this._removeStrut();
        try {
            if (this._chromeAdded)
                Main.layoutManager.removeChrome(this.actor);
        } catch (e) {
            console.warn(`[chromeos-shell] Shelf-Chrome nicht entfernbar: ${e}`);
        }
        this._chromeAdded = false;
        this._strutActor?.destroy();
        this._strutActor = null;
        this.actor.destroy();
    }

    setDark(dark) {
        if (dark)
            this.actor.add_style_class_name('chromeos-dark');
        else
            this.actor.remove_style_class_name('chromeos-dark');
    }

    // ------------------------------------------------- Sperrbildschirm
    // Auf dem Sperrbildschirm darf die Shelf nicht sichtbar sein und ihr
    // Strut keinen Platz beanspruchen: sonst bliebe die Workarea verkuerzt
    // und maximierte Fenster starteten unter der gesperrten Leiste.
    _syncLocked(locked) {
        if (!this.actor || this._destroyed || locked === this._locked)
            return;
        this._locked = locked;

        if (locked) {
            this.actor.hide();
            this._removeStrut();
            return;
        }

        this.actor.show();
        this._addStrut();
        this._updateGeometry();
    }

    _addStrut() {
        if (this._strutAdded || !this._strutActor)
            return;
        try {
            Main.layoutManager.addChrome(this._strutActor, {
                affectsStruts: true,
                affectsInputRegion: false,
                trackFullscreen: true,
            });
            this._strutAdded = true;
        } catch (e) {
            console.warn(`[chromeos-shell] Strut nicht einfuegbar: ${e}`);
        }
    }

    _removeStrut() {
        if (!this._strutAdded || !this._strutActor)
            return;
        try {
            Main.layoutManager.removeChrome(this._strutActor);
        } catch (e) {
            console.warn(`[chromeos-shell] Strut nicht entfernbar: ${e}`);
        }
        this._strutAdded = false;
    }

    // ------------------------------------------------------------- Geometrie
    _updateGeometry() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor || this._destroyed)
            return;
        const width = Math.max(320, monitor.width - 2 * SHELF_MARGIN);
        this.actor.set_width(width);
        const [, height] = this.actor.get_preferred_height(width);
        const top = monitor.y + monitor.height - height - SHELF_MARGIN;
        this.actor.set_position(monitor.x + SHELF_MARGIN, top);

        if (this._strutActor) {
            this._strutActor.set_position(monitor.x, top);
            this._strutActor.set_size(monitor.width,
                monitor.y + monitor.height - top);
        }
    }

    // ----------------------------------------------------------------- Apps
    _refreshApps() {
        this._appsBox.destroy_all_children();

        const pinnedIds = new Set();
        let favorites = [];
        try {
            favorites = AppFavorites.getAppFavorites().getFavorites();
        } catch (e) {
            console.warn(`[chromeos-shell] Favoriten nicht lesbar: ${e}`);
        }

        for (const app of favorites) {
            pinnedIds.add(app.get_id());
            this._appsBox.add_child(this._appButton(app, true));
        }

        let running = [];
        try {
            running = Shell.AppSystem.get_default().get_running()
                .filter(app => shouldShow(app) && !pinnedIds.has(app.get_id()))
                .sort((a, b) => a.get_name().localeCompare(b.get_name()));
        } catch (e) {
            console.warn(`[chromeos-shell] laufende Apps nicht lesbar: ${e}`);
        }

        // Wie ChromeOS: duenne Trennlinie zwischen angehefteten und nur
        // laufenden Apps, aber nur wenn beide Gruppen vorhanden sind.
        if (favorites.length > 0 && running.length > 0) {
            this._appsBox.add_child(new St.Widget({
                style_class: 'chromeos-shelf-apps-divider',
                y_align: Clutter.ActorAlign.CENTER,
            }));
        }

        for (const app of running)
            this._appsBox.add_child(this._appButton(app, false));
    }

    _appButton(app, pinned) {
        const button = new St.Button({
            style_class: 'chromeos-shelf-app',
            can_focus: true,
            track_hover: true,
        });
        const box = new St.BoxLayout({
            vertical: true,
            style_class: 'chromeos-shelf-app-box',
        });
        box.add_child(this._icon(app, 30));

        const dot = new St.Widget({
            style_class: 'chromeos-running-dot',
            x_align: Clutter.ActorAlign.CENTER,
            visible: app.get_windows().length > 0,
        });
        box.add_child(dot);
        button.set_child(box);

        button._chromeosDot = dot;
        button._chromeosAppId = app.get_id();

        button.connect('clicked', () => this._activate(app));
        button.connect('button-press-event', (_actor, event) => {
            if (event.get_button() === 3) {
                this._contextMenu.open(app, button, () => {
                    this._refreshApps();
                    this._updateGeometry();
                });
                return Clutter.EVENT_STOP;
            }
            if (event.get_button() === 2) {
                try {
                    app.open_new_window(-1);
                } catch (e) {
                    console.error(`[chromeos-shell] Neues Fenster fehlgeschlagen: ${e}`);
                }
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        if (pinned)
            button.add_style_class_name('chromeos-shelf-app-pinned');
        return button;
    }

    _icon(app, size) {
        try {
            const texture = app.create_icon_texture(size);
            if (texture)
                return texture;
        } catch (e) {
            // Fallback unten
        }
        return new St.Icon({gicon: app.icon, icon_size: size});
    }

    _updateRunning() {
        for (const child of this._appsBox.get_children()) {
            if (!child._chromeosDot)
                continue;
            const app = Shell.AppSystem.get_default().lookup_app(child._chromeosAppId);
            if (app)
                child._chromeosDot.visible = app.get_windows().length > 0;
        }
    }

    _activate(app) {
        try {
            const windows = app.get_windows();
            if (windows.length === 0) {
                app.open_new_window(-1);
                return;
            }
            const active = global.display.focus_window;
            const index = windows.indexOf(active);
            Main.activateWindow(windows[(index + 1) % windows.length]);
        } catch (e) {
            console.error(`[chromeos-shell] App-Aktivierung fehlgeschlagen: ${e}`);
        }
    }

    // ----------------------------------------------------------------- Tray
    // GNOME legt jede Statusanzeige unter ihrer Rolle in
    // Main.panel.statusArea ab; je nach Version ist der Actor das Objekt
    // selbst oder sein .container.
    _statusActor(role) {
        const entry = Main.panel?.statusArea?.[role];
        const actor = entry?.container ?? entry;
        return actor?.get_parent ? actor : null;
    }

    _attachTray() {
        const area = Main.panel?.statusArea;
        if (!area) {
            console.warn('[chromeos-shell] Panel-Statusbereich nicht gefunden.');
            return;
        }

        // Mit dem Panel verschwinden sonst auch die Statusanzeigen, die in
        // der Leiste sitzen: Tastaturbelegung, Aufnahme- und
        // Freigabe-Indikator. Sie wandern mit in den Tray; sichtbar bleibt,
        // was GNOME selbst einblendet (Aufnahme/Freigabe nur bei Bedarf).
        const wanted = [];
        for (const role of STATUS_ROLES) {
            const actor = this._statusActor(role);
            if (actor)
                wanted.push(actor);
            else
                console.warn(`[chromeos-shell] Statusanzeige "${role}" nicht gefunden.`);
        }
        for (const entry of [area.dateMenu, area.quickSettings]) {
            const actor = entry?.container ?? entry;
            if (actor?.get_parent)
                wanted.push(actor);
        }

        // Erst alle Positionen merken, dann entfernen: sonst verschieben
        // sich die Indizes der noch nicht bewegten Geschwister.
        for (const actor of wanted) {
            if (this._moved.some(move => move.actor === actor))
                continue;
            const parent = actor.get_parent();
            const index = parent.get_children().indexOf(actor);
            this._moved.push({actor, parent, index});
        }

        for (const {actor, parent} of this._moved) {
            parent.remove_child(actor);
            this._tray.add_child(actor);
        }

        if (this._moved.length > 0) {
            try {
                Main.panel.hide();
            } catch (e) {
                console.warn(`[chromeos-shell] Panel konnte nicht ausgeblendet werden: ${e}`);
            }
        }
    }

    _restoreTray() {
        // Innerhalb eines Elterncontainers in aufsteigender Indexfolge
        // einsetzen; nur so steht danach jede Anzeige wieder an ihrer Stelle.
        const moves = [...this._moved].sort((a, b) =>
            a.parent === b.parent ? a.index - b.index : 0);
        for (const {actor, parent, index} of moves) {
            const current = actor.get_parent();
            if (current)
                current.remove_child(actor);
            if (parent) {
                const bounded = Math.max(0, Math.min(index, parent.get_children().length));
                parent.insert_child_at_index(actor, bounded);
            }
        }
        this._moved = [];
        try {
            Main.panel?.show();
        } catch (e) {
            // Sitzung wird ohnehin neu gestartet.
        }
    }
}
