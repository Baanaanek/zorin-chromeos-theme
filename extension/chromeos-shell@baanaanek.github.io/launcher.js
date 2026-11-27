// ChromeOS-Launcher: schwebendes Panel oben links, Suchzeile mit Lupe,
// App-Raster mit 5 Spalten und Websuche-Zeile.
// Bewusst ohne Assistant/Gemini, ohne Sprach- und Lens-Symbole.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {openWebSearch, getEngineName} from './search.js';

const PANEL_WIDTH = 560;
const PANEL_MAX_HEIGHT = 760;
const PANEL_MARGIN = 8;
const GRID_COLUMNS = 5;
const MAX_RESULTS = 8;

export class Launcher {
    constructor() {
        this._visible = false;
        this._engineName = null;
        this._apps = [];
        this._build();
    }

    // ---------------------------------------------------------------- Aufbau
    _build() {
        this.actor = new St.BoxLayout({
            name: 'chromeosLauncher',
            style_class: 'chromeos-launcher',
            vertical: true,
            reactive: true,
            can_focus: true,
            visible: false,
        });
        this.actor.connect('key-press-event', (_actor, event) => this._onKeyPress(event));

        const searchRow = new St.BoxLayout({
            style_class: 'chromeos-search-row',
            reactive: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._searchIcon = new St.Icon({
            icon_name: 'edit-find-symbolic',
            icon_size: 18,
            style_class: 'chromeos-search-icon',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.entry = new St.Entry({
            style_class: 'chromeos-search-entry',
            can_focus: true,
            x_expand: true,
            hint_text: 'Apps und Web durchsuchen',
        });
        this.entry.clutter_text.connect('text-changed', () => this._refresh());
        this.entry.clutter_text.connect('activate', () => this._activateFirst());

        searchRow.add_child(this._searchIcon);
        searchRow.add_child(this.entry);
        this.actor.add_child(searchRow);

        this.scroll = new St.ScrollView({
            style_class: 'chromeos-launcher-scroll',
            x_expand: true,
            y_expand: true,
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
        });
        this.content = new St.BoxLayout({
            vertical: true,
            style_class: 'chromeos-launcher-content',
            x_expand: true,
        });
        this.scroll.set_child(this.content);
        this.actor.add_child(this.scroll);

        getEngineName(name => {
            if (!name || name === this._engineName)
                return;
            this._engineName = name;
            if (this._visible && this.entry.get_text().trim().length > 0)
                this._refresh();
        });
    }

    enable() {
        this._layout();
        Main.layoutManager.addTopChrome(this.actor, {
            visible: false,
            affectsStruts: false,
            trackFullscreen: false,
        });
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this._layout());
    }

    destroy() {
        if (this._monitorsId) {
            Main.layoutManager.disconnect(this._monitorsId);
            this._monitorsId = 0;
        }
        Main.layoutManager.removeChrome(this.actor);
        this.actor.destroy();
    }

    // ------------------------------------------------------------- Geometrie
    _layout() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const width = Math.min(PANEL_WIDTH, Math.max(320, monitor.width - 2 * PANEL_MARGIN - 8));
        const height = Math.min(PANEL_MAX_HEIGHT, Math.max(360, monitor.height - 2 * PANEL_MARGIN - 48));
        this.actor.set_size(width, height);
        this.actor.set_position(monitor.x + PANEL_MARGIN + 4, monitor.y + PANEL_MARGIN + 4);
    }

    // --------------------------------------------------------------- Anzeige
    toggle() {
        if (this._visible)
            this.hide();
        else
            this.show();
    }

    show() {
        this._visible = true;
        this._layout();
        this.entry.set_text('');
        this._refresh();
        this.actor.show();
        this.actor.grab_key_focus();
        this.entry.grab_key_focus();
    }

    hide() {
        this._visible = false;
        this.entry.set_text('');
        this.actor.hide();
    }

    setDark(dark) {
        if (dark)
            this.actor.add_style_class_name('chromeos-dark');
        else
            this.actor.remove_style_class_name('chromeos-dark');
    }

    // ---------------------------------------------------------------- Inhalte
    _refresh() {
        const query = this.entry.get_text().trim();
        this.content.destroy_all_children();
        if (query.length === 0)
            this._buildBrowse();
        else
            this._buildSearch(query);
        this.scroll.vscroll.adjustment.value = 0;
    }

    _allApps() {
        return Shell.AppSystem.get_default().get_installed()
            .filter(app => app.should_show())
            .sort((a, b) => a.get_name().localeCompare(b.get_name()));
    }

    _buildBrowse() {
        const apps = this._allApps();

        this.content.add_child(this._sectionTitle('Apps'));

        if (apps.length === 0) {
            this.content.add_child(new St.Label({
                text: 'Keine Anwendungen gefunden.',
                style_class: 'chromeos-empty',
            }));
            return;
        }

        const grid = new St.Widget({
            style_class: 'chromeos-app-grid',
            x_expand: true,
            layout_manager: new Clutter.GridLayout({
                column_homogeneous: true,
                column_spacing: 0,
                row_spacing: 0,
            }),
        });
        const layout = grid.layout_manager;
        apps.forEach((app, index) => {
            layout.attach(this._appTile(app),
                index % GRID_COLUMNS, Math.floor(index / GRID_COLUMNS), 1, 1);
        });
        this.content.add_child(grid);
    }

    _buildSearch(query) {
        const needle = query.toLowerCase();
        const matches = this._allApps().filter(app => {
            if (app.get_name().toLowerCase().includes(needle))
                return true;
            const keywords = app.get_keywords();
            return typeof keywords === 'string' && keywords.toLowerCase().includes(needle);
        }).slice(0, MAX_RESULTS);

        if (matches.length > 0) {
            this.content.add_child(this._sectionTitle('Apps'));
            for (const app of matches)
                this.content.add_child(this._appRow(app));
        }

        this.content.add_child(this._sectionTitle('Web'));
        this.content.add_child(this._webSearchRow(query));
    }

    _sectionTitle(text) {
        return new St.Label({text, style_class: 'chromeos-section-title'});
    }

    _appTile(app) {
        const button = new St.Button({
            style_class: 'chromeos-app-tile',
            can_focus: true,
            track_hover: true,
            x_expand: true,
        });
        const box = new St.BoxLayout({vertical: true, x_expand: true});
        const icon = this._appIcon(app, 48, 'chromeos-app-icon');
        icon.x_align = Clutter.ActorAlign.CENTER;
        box.add_child(icon);

        const label = new St.Label({
            text: app.get_name(),
            style_class: 'chromeos-app-name',
            x_align: Clutter.ActorAlign.CENTER,
        });
        label.clutter_text.set_line_wrap(true);
        label.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        label.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        label.clutter_text.set_line_alignment(Pango.Alignment.CENTER);
        box.add_child(label);

        button.set_child(box);
        button.connect('clicked', () => this._launch(app));
        return button;
    }

    _appRow(app) {
        const button = new St.Button({
            style_class: 'chromeos-result',
            can_focus: true,
            track_hover: true,
            x_expand: true,
        });
        const box = new St.BoxLayout({
            style_class: 'chromeos-result-box',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        const icon = this._appIcon(app, 28, 'chromeos-result-icon');
        icon.y_align = Clutter.ActorAlign.CENTER;
        box.add_child(icon);

        const text = new St.BoxLayout({vertical: true, x_expand: true});
        text.add_child(new St.Label({text: app.get_name(), style_class: 'chromeos-result-title'}));
        const description = app.get_description();
        if (description) {
            const subtitle = new St.Label({text: description, style_class: 'chromeos-result-subtitle'});
            subtitle.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
            text.add_child(subtitle);
        }
        box.add_child(text);
        button.set_child(box);
        button.connect('clicked', () => this._launch(app));
        return button;
    }

    _webSearchRow(query) {
        const button = new St.Button({
            style_class: 'chromeos-result chromeos-web-result',
            can_focus: true,
            track_hover: true,
            x_expand: true,
        });
        const box = new St.BoxLayout({
            style_class: 'chromeos-result-box',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const iconBox = new St.Bin({style_class: 'chromeos-web-icon-box'});
        iconBox.set_child(new St.Icon({
            icon_name: 'system-search-symbolic',
            icon_size: 20,
            style_class: 'chromeos-web-icon',
        }));
        box.add_child(iconBox);

        const text = new St.BoxLayout({vertical: true, x_expand: true});
        text.add_child(new St.Label({
            text: `Im Web suchen nach \u201e${query}\u201c`,
            style_class: 'chromeos-result-title',
        }));
        const subtitle = new St.Label({
            text: this._engineName
                ? `Mit ${this._engineName} (Suchmaschine deines Standardbrowsers)`
                : 'Mit der Suchmaschine deines Standardbrowsers',
            style_class: 'chromeos-result-subtitle',
        });
        subtitle.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);
        text.add_child(subtitle);

        box.add_child(text);
        button.set_child(box);
        button.connect('clicked', () => {
            this.hide();
            openWebSearch(query);
        });
        return button;
    }

    _appIcon(app, size, styleClass) {
        try {
            const texture = app.create_icon_texture(size);
            if (texture) {
                texture.add_style_class_name(styleClass);
                return texture;
            }
        } catch (e) {
            // aeltere/neuere Shell-Version ohne create_icon_texture
        }
        return new St.Icon({
            gicon: app.icon,
            icon_size: size,
            style_class: styleClass,
        });
    }

    // --------------------------------------------------------------- Aktionen
    _activateFirst() {
        const query = this.entry.get_text().trim();
        if (query.length === 0)
            return;
        const needle = query.toLowerCase();
        const apps = this._allApps();
        const match = apps.find(app => app.get_name().toLowerCase().startsWith(needle))
            ?? apps.find(app => app.get_name().toLowerCase().includes(needle));
        if (match) {
            this._launch(match);
            return;
        }
        this.hide();
        openWebSearch(query);
    }

    _launch(app) {
        this.hide();
        try {
            const windows = app.get_windows();
            if (windows.length > 0)
                Main.activateWindow(windows[0]);
            else
                app.open_new_window(-1);
        } catch (e) {
            console.error(`[chromeos-shell] App konnte nicht gestartet werden: ${e}`);
        }
    }

    _onKeyPress(event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            this.hide();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
}
