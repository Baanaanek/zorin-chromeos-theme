#!/usr/bin/env node
// Lifecycle-Harness: laedt die echten Extension-Quellen gegen gemocktes GNOME
// (St, Clutter, Pango, GLib, Gio, Shell, Main, AppFavorites) und prueft
// enable()/disable() inklusive zweitem Zyklus.
//
//   node tests/extension/lifecycle.mjs [repo]
//   KEEP=1 node tests/extension/lifecycle.mjs   # temporaeres Verzeichnis behalten
//
// Es wird nichts im Repo und nichts im Benutzer-Home veraendert.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(process.argv[2] ?? path.join(HERE, '..', '..'));
const UUID = 'chromeos-shell@baanaanek.github.io';
const SOURCE_EXT = path.join(REPO, 'extension', UUID);
const MOCK_SOURCE = path.join(HERE, 'mock');

if (!fs.existsSync(path.join(SOURCE_EXT, 'extension.js'))) {
    console.error(`Extension-Quellen nicht gefunden: ${SOURCE_EXT}`);
    process.exit(2);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'chromeos-ext-'));
const EXT = path.join(TMP, 'ext');
const MOCKS = path.join(TMP, 'mock');
const HOME = path.join(TMP, 'home');
const DATA_HOME = path.join(HOME, '.local', 'share');

fs.cpSync(SOURCE_EXT, EXT, {recursive: true});
fs.cpSync(MOCK_SOURCE, MOCKS, {recursive: true});
fs.mkdirSync(path.join(DATA_HOME, 'themes', 'ChromeOS', 'gnome-shell'), {recursive: true});
fs.mkdirSync(path.join(DATA_HOME, 'themes', 'ChromeOS', 'gtk-3.0'), {recursive: true});

// Theme-CSS, das theme.js laden soll.
const THEME_CSS = path.join(DATA_HOME, 'themes', 'ChromeOS', 'gnome-shell', 'gnome-shell.css');
fs.writeFileSync(THEME_CSS, '/* Theme-Testdatei */\n.chromeos-shelf { min-height: 56px; }\n');
fs.writeFileSync(path.join(DATA_HOME, 'themes', 'ChromeOS', 'gtk-3.0', 'gtk.css'),
    '.chromeos-test {}\n', {flag: 'w'});

// Suchhelfer, den search.js im Home findet.
const BIN = path.join(HOME, '.local', 'bin');
fs.mkdirSync(BIN, {recursive: true});
fs.writeFileSync(path.join(BIN, 'chromeos-search-url'),
    '#!/bin/sh\n# chromeos-theme testhelfer\n');
fs.chmodSync(path.join(BIN, 'chromeos-search-url'), 0o755);

// Importe der Quellen auf die Mocks umbiegen (Quellen bleiben unveraendert).
const SPECIFIERS = {
    'gi://St': '../mock/St.js',
    'gi://Clutter': '../mock/Clutter.js',
    'gi://Pango': '../mock/Pango.js',
    'gi://GLib': '../mock/GLib.js',
    'gi://Gio': '../mock/Gio.js',
    'gi://Shell': '../mock/Shell.js',
    'resource:///org/gnome/shell/ui/main.js': '../mock/Main.js',
    'resource:///org/gnome/shell/ui/appFavorites.js': '../mock/AppFavorites.js',
    'resource:///org/gnome/shell/ui/popupMenu.js': '../mock/PopupMenu.js',
    'resource:///org/gnome/shell/extensions/extension.js': '../mock/extension.js',
};

for (const file of fs.readdirSync(EXT).filter(name => name.endsWith('.js'))) {
    const full = path.join(EXT, file);
    let source = fs.readFileSync(full, 'utf8');
    for (const [specifier, target] of Object.entries(SPECIFIERS))
        source = source.split(`'${specifier}'`).join(`'${target}'`);
    fs.writeFileSync(full, source);
}

process.env.HARNESS_HOME = HOME;
process.env.HARNESS_DATA_HOME = DATA_HOME;

const url = specifier => pathToFileURL(specifier).href;

const St = (await import(url(path.join(MOCKS, 'St.js')))).default;
const Clutter = (await import(url(path.join(MOCKS, 'Clutter.js')))).default;
const Gio = (await import(url(path.join(MOCKS, 'Gio.js')))).default;
const {lastInterfaceSettings} = await import(url(path.join(MOCKS, 'Gio.js')));
const apps = await import(url(path.join(MOCKS, 'apps.js')));
const Main = await import(url(path.join(MOCKS, 'Main.js')));
const {live, state} = await import(url(path.join(MOCKS, 'state.js')));
const {appSystem} = await import(url(path.join(MOCKS, 'Shell.js')));
const {getAppFavorites} = await import(url(path.join(MOCKS, 'AppFavorites.js')));

globalThis.global = {stage: Main.stage, display: Main.display, get_current_time: () => 4242};

let total = 0;
const failures = [];

function check(name, fn) {
    total++;
    try {
        if (fn() === false)
            throw new Error('Bedingung nicht erfuellt');
        console.log(`  ok   ${name}`);
    } catch (error) {
        failures.push(name);
        console.log(`  FAIL ${name}${error?.message ? ` (${error.message})` : ''}`);
    }
}

// Actor-Objekte sind zyklisch (Kind/Eltern); JSON.stringify wuerde die
// Fehlermeldung verschlucken und nur "cyclic structures" melden.
function describe(value) {
    try {
        return JSON.stringify(value) ?? String(value);
    } catch (e) {
        return String(value);
    }
}

function eq(actual, expected, label = 'Wert') {
    if (actual !== expected)
        throw new Error(`${label}: erwartet ${describe(expected)}, war ${describe(actual)}`);
}

function texts(actor, collected = []) {
    if (typeof actor?._text === 'string' && actor._text.length > 0)
        collected.push(actor._text);
    for (const child of actor?.get_children?.() ?? [])
        texts(child, collected);
    return collected;
}

function isDescendant(ancestor, actor) {
    for (let node = actor?.get_parent?.(); node; node = node.get_parent?.()) {
        if (node === ancestor)
            return true;
    }
    return false;
}

// ------------------------------------------------------------------ Statisch
const metadata = JSON.parse(fs.readFileSync(path.join(SOURCE_EXT, 'metadata.json'), 'utf8'));
const sourceText = fs.readdirSync(SOURCE_EXT)
    .filter(name => name.endsWith('.js'))
    .map(name => fs.readFileSync(path.join(SOURCE_EXT, name), 'utf8'))
    .join('\n');

check('metadata-uuid passt zum Ordnernamen', () => eq(metadata.uuid, path.basename(SOURCE_EXT)));
check('shell-version deckt 45-48 ab', () => {
    for (const version of ['45', '46', '47', '48'])
        if (!metadata['shell-version'].includes(version))
            throw new Error(`Version ${version} fehlt`);
    return true;
});
check('keine Legacy-Importe (imports.*/ExtensionUtils)', () =>
    !/(^|[^A-Za-z])imports\.|ExtensionUtils/.test(sourceText));
check('keine fest verdrahtete Google-Suche', () =>
    !/google\.(com|de)\/search|googleapis/.test(sourceText));
check('Stylesheet enthaelt Shelf und Launcher', () => {
    const css = fs.readFileSync(path.join(SOURCE_EXT, 'stylesheet.css'), 'utf8');
    for (const selector of ['.chromeos-shelf', '.chromeos-launcher'])
        if (!css.includes(selector))
            throw new Error(`${selector} fehlt`);
    return true;
});

// -------------------------------------------------------------------- Enable
const {default: ChromeOSShellExtension} = await import(url(path.join(EXT, 'extension.js')));
const extension = new ChromeOSShellExtension({uuid: UUID, dir: EXT});

check('enable() laeuft ohne Ausnahme', () => {
    extension.enable();
    return true;
});

const launcher = extension._launcher;
const shelf = extension._shelf;

check('Launcher-Actor wird gebaut und bleibt unsichtbar', () => {
    eq(launcher.actor.name, 'chromeosLauncher');
    eq(launcher.actor.visible, false);
    return true;
});
check('Launcher haengt in addTopChrome()', () => {
    eq(Main.layoutManager.topChrome.length, 1);
    eq(Main.layoutManager.topChrome[0], launcher.actor);
    return true;
});
check('Launcher sitzt oben links mit 560x760', () => {
    eq(launcher.actor.width, 560, 'Breite');
    eq(launcher.actor.height, 760, 'Hoehe');
    eq(launcher.actor.x, 12, 'x');
    eq(launcher.actor.y, 12, 'y');
    return true;
});
check('Suchfeld hat ChromeOS-Platzhalter', () =>
    eq(launcher.entry.hint_text, 'Apps und Web durchsuchen'));
check('Lupe ist das Suchicon', () => eq(launcher._searchIcon.icon_name, 'edit-find-symbolic'));

check('Shelf-Actor wird gebaut', () => {
    eq(shelf.actor.name, 'chromeosShelf');
    return true;
});
check('Shelf und Strut-Actor haengen in addChrome()', () => {
    eq(Main.layoutManager.chrome.length, 2, 'Chrome-Actors');
    const call = Main.layoutManager.calls.find(entry => entry.actor === shelf.actor);
    eq(call.params.affectsInputRegion, true, 'affectsInputRegion');
    eq(call.params.trackFullscreen, true, 'trackFullscreen');
    eq(call.params.affectsStruts, undefined, 'Shelf selbst traegt keinen Strut');
    return true;
});
check('Strut-Actor beruehrt die Unterkante und spannt die Monitorbreite', () => {
    const call = Main.layoutManager.calls.find(entry => entry.actor === shelf._strutActor);
    if (!call)
        throw new Error('kein addChrome-Aufruf fuer den Strut-Actor');
    eq(call.params.affectsStruts, true, 'affectsStruts');
    eq(call.params.affectsInputRegion, false, 'affectsInputRegion');
    eq(shelf._strutActor.x, 0, 'x');
    eq(shelf._strutActor.width, 1920, 'Breite');
    eq(shelf._strutActor.height, 64, 'Hoehe inkl. 8px Luft');
    eq(shelf._strutActor.y + shelf._strutActor.height, 1080, 'Unterkante');
    return true;
});
check('Shelf ist 1904 breit und sitzt 8px ueber dem Rand', () => {
    eq(shelf.actor.width, 1904, 'Breite');
    eq(shelf.actor.x, 8, 'x');
    eq(shelf.actor.y, 1016, 'y');
    return true;
});
check('Shelf zeigt Favoriten und markiert laufende Apps', () => {
    const buttons = shelf._appsBox.get_children();
    eq(buttons.length, 2, 'Shelf-Apps');
    if (!buttons.every(button => button.has_style_class_name('chromeos-shelf-app-pinned')))
        throw new Error('Favoriten sind nicht als angeheftet markiert');
    const terminalButton = buttons.find(button => button._chromeosAppId === 'org.gnome.Terminal');
    const firefoxButton = buttons.find(button => button._chromeosAppId === 'firefox');
    eq(terminalButton._chromeosDot.visible, true, 'Laufpunkt Terminal');
    eq(firefoxButton._chromeosDot.visible, false, 'Laufpunkt Firefox');
    return true;
});
check('app-state-changed baut die Shelf neu auf', () => {
    apps.running.push(apps.files);
    appSystem.emit('app-state-changed');
    const ids = shelf._appsBox.get_children().map(button => button._chromeosAppId);
    if (!ids.includes('org.gnome.Nautilus'))
        throw new Error(`laufende App fehlt: ${ids.join(', ')}`);
    eq(shelf._appsBox.get_children().length, 3, 'Shelf-Apps');
    apps.running.splice(apps.running.indexOf(apps.files), 1);
    appSystem.emit('app-state-changed');
    eq(shelf._appsBox.get_children().length, 2, 'Shelf-Apps nach App-Ende');
    return true;
});
check('Shelf nimmt versteckte laufende Apps nicht auf', () => {
    apps.running.push(apps.hidden);
    appSystem.emit('app-state-changed');
    const ids = shelf._appsBox.get_children().map(button => button._chromeosAppId);
    if (ids.includes('hidden-tool'))
        throw new Error('NoDisplay-App steht in der Shelf');
    apps.running.splice(apps.running.indexOf(apps.hidden), 1);
    appSystem.emit('app-state-changed');
    return true;
});
check('Datum-Knopf liegt in der Shelf', () =>
    eq(Main.panel.dateMenu.container.get_parent(), shelf._tray));
check('Schnelleinstellungen liegen in der Shelf', () =>
    eq(Main.panel.quickSettings.container.get_parent(), shelf._tray));
check('Tray-Reihenfolge: Datum vor Schnelleinstellungen', () => {
    const children = shelf._tray.get_children();
    const date = children.indexOf(Main.panel.dateMenu.container);
    const quick = children.indexOf(Main.panel.quickSettings.container);
    if (date < 0 || quick < 0 || date > quick)
        throw new Error(`Reihenfolge ${date}/${quick}`);
    return true;
});
check('GNOME-Panel ist ausgeblendet', () => eq(Main.panel.visible, false));

// ----------------------------------------- Statusanzeigen in der Shelf
// Ohne Umhaengen verschwinden diese Anzeigen mit dem ausgeblendeten Panel.
const statusIndicators = () => [
    ['Tastaturbelegung', Main.panel.keyboard.container],
    ['Aufnahme', Main.panel.screenRecording.container],
    ['Freigabe', Main.panel.remoteAccess.container],
];

check('Tastaturbelegung liegt sichtbar in der Shelf', () => {
    const actor = Main.panel.keyboard.container;
    eq(actor.get_parent(), shelf._tray, 'Eltern');
    eq(actor.visible, true, 'sichtbar');
    eq(isDescendant(Main.panel.statusArea, actor), false, 'noch im Panel');
    return true;
});
check('Aufnahme-Indikator liegt in der Shelf und folgt GNOME', () => {
    const actor = Main.panel.screenRecording.container;
    eq(actor.get_parent(), shelf._tray, 'Eltern');
    eq(actor.visible, false, 'ohne Aufnahme verborgen');
    actor.show();
    eq(actor.visible, true, 'waehrend der Aufnahme sichtbar');
    actor.hide();
    return true;
});
check('Freigabe-Indikator liegt in der Shelf und folgt GNOME', () => {
    const actor = Main.panel.remoteAccess.container;
    eq(actor.get_parent(), shelf._tray, 'Eltern');
    eq(actor.visible, false, 'ohne Freigabe verborgen');
    actor.show();
    eq(actor.visible, true, 'waehrend der Freigabe sichtbar');
    actor.hide();
    return true;
});
check('Statusanzeigen haengen nicht unter dem ausgeblendeten Panel', () => {
    eq(Main.panel.visible, false, 'Panel sichtbar');
    for (const [label, actor] of statusIndicators()) {
        if (isDescendant(Main.panel.statusArea, actor))
            throw new Error(`${label} haengt noch im Panel`);
        eq(actor.get_parent(), shelf._tray, `${label}-Eltern`);
    }
    return true;
});
check('Tray-Reihenfolge: Statusanzeigen vor Datum und Schnelleinstellungen', () => {
    const children = shelf._tray.get_children();
    const expected = [...statusIndicators().map(([, actor]) => actor),
        Main.panel.dateMenu.container, Main.panel.quickSettings.container];
    eq(children.length, expected.length, 'Tray-Kinder');
    expected.forEach((actor, index) => eq(children[index], actor, `Kind ${index}`));
    return true;
});

// --------------------------------------------------------- Sperrbildschirm
check('Sperrbildschirm-Signal haengt genau einmal am SessionMode', () =>
    eq(Main.sessionMode.openSignals(), 1, 'SessionMode-Signale'));
check('Lock: Shelf unsichtbar, Strut aus dem Chrome entfernt', () => {
    Main.sessionMode.setLocked(true);
    eq(shelf.actor.visible, false, 'Shelf sichtbar');
    eq(Main.layoutManager.chrome.includes(shelf._strutActor), false, 'Strut im Chrome');
    eq(Main.layoutManager.chrome.length, 1, 'Chrome-Actors');
    return true;
});
check('Lock: Geometrieaenderung holt den Strut nicht zurueck', () => {
    shelf._updateGeometry();
    eq(Main.layoutManager.chrome.includes(shelf._strutActor), false, 'Strut im Chrome');
    eq(Main.layoutManager.chrome.length, 1, 'Chrome-Actors');
    return true;
});
check('Unlock: Shelf und Strut in vorheriger Geometrie zurueck', () => {
    const strut = shelf._strutActor;
    Main.sessionMode.setLocked(false);
    eq(shelf.actor.visible, true, 'Shelf sichtbar');
    eq(Main.layoutManager.chrome.length, 2, 'Chrome-Actors');
    eq(Main.layoutManager.chrome.includes(strut), true, 'derselbe Strut-Actor');
    eq(strut.x, 0, 'x');
    eq(strut.width, 1920, 'Breite');
    eq(strut.height, 64, 'Hoehe inkl. 8px Luft');
    eq(strut.y + strut.height, 1080, 'Unterkante');
    eq(shelf.actor.y, 1016, 'Shelf y');
    return true;
});
check('Unlock: wiederholte Session-Updates erzeugen keine Doppel-Actors', () => {
    Main.sessionMode.emit('updated');
    Main.sessionMode.emit('updated');
    eq(Main.layoutManager.chrome.filter(actor => actor === shelf._strutActor).length, 1, 'Strut');
    eq(Main.layoutManager.chrome.length, 2, 'Chrome-Actors');
    return true;
});

// ------------------------------------------------------------- Launcher-Logik
check('Shelf-Knopf oeffnet den Launcher', () => {
    shelf._launcherButton.emit('clicked');
    eq(launcher.actor.visible, true);
    eq(launcher._visible, true);
    return true;
});
check('zweiter Klick schliesst ihn wieder', () => {
    shelf._launcherButton.emit('clicked');
    eq(launcher.actor.visible, false);
    return true;
});
check('leere Suche zeigt alle sechs sichtbaren Apps im Raster', () => {
    launcher.show();
    const attached = launcher.content.get_children()[1].layout_manager.attached;
    eq(attached.length, apps.visibleApps.length);
    eq(attached[0].column, 0);
    eq(attached[5].row, 1);
    return true;
});
check('Launcher blendet Apps mit should_show() == false aus', () => {
    launcher.show();
    const ids = launcher.content.get_children()[1].layout_manager.attached
        .map(entry => entry.child._chromeosAppId);
    if (ids.includes('hidden-tool'))
        throw new Error('NoDisplay-App steht im Raster');
    eq(ids.length, apps.visibleApps.length, 'sichtbare Apps');
    return true;
});
check('Suche filtert Apps und zeigt Web-Zeile', () => {
    launcher.entry.set_text('term');
    const children = launcher.content.get_children();
    eq(children.length, 4, 'Abschnitte');
    eq(children[0]._text, 'Apps');
    eq(children[2]._text, 'Web');
    if (!texts(children[1]).some(text => text.includes('Terminal')))
        throw new Error('Terminal fehlt im Treffer');
    if (!texts(children[3]).some(text => text.includes('term')))
        throw new Error('Suchbegriff fehlt in der Web-Zeile');
    return true;
});
check('Web-Zeile nennt Standardbrowser und Engine', () => {
    const found = texts(launcher.content.get_children()[3]);
    if (!found.some(text => text.includes('Standardbrowsers')))
        throw new Error('Standardbrowser-Hinweis fehlt');
    if (!found.some(text => text.includes('DuckDuckGo')))
        throw new Error('Engine-Name fehlt');
    return true;
});
// ------------------------------------------------------------- Neue UI-Teile
check('Loesch-Knopf erscheint erst mit Text', () => {
    launcher.show();
    eq(launcher._clearButton.visible, false, 'leeres Feld');
    launcher.entry.set_text('term');
    eq(launcher._clearButton.visible, true, 'mit Text');
    return true;
});
check('Loesch-Knopf leert das Feld und zeigt wieder alle Apps', () => {
    launcher.entry.set_text('term');
    launcher._clearButton.emit('clicked');
    eq(launcher.entry.get_text(), '', 'Feld');
    eq(launcher._clearButton.visible, false, 'Knopf');
    const attached = launcher.content.get_children()[1].layout_manager.attached;
    eq(attached.length, apps.visibleApps.length, 'Raster');
    return true;
});
check('Seitenpunkte bleiben bei einer Seite verborgen', () => {
    launcher.show();
    const adjustment = launcher.scroll.vscroll.adjustment;
    adjustment.upper = 600;
    adjustment.page_size = 500;
    adjustment.emit('changed');
    eq(launcher._dots.visible, false);
    return true;
});
check('Seitenpunkte erscheinen bei mehreren Seiten', () => {
    launcher.show();
    const adjustment = launcher.scroll.vscroll.adjustment;
    adjustment.upper = 2000;
    adjustment.page_size = 500;
    adjustment.value = 0;
    adjustment.emit('changed');
    eq(launcher._dots.visible, true);
    eq(launcher._dots.get_children().length, 4, 'vier Seiten');
    eq(launcher._dots.get_children()[0].has_style_class_name('chromeos-page-dot-active'),
        true, 'erste aktiv');
    return true;
});
check('Seitenpunkte folgen der Scrollposition', () => {
    const adjustment = launcher.scroll.vscroll.adjustment;
    adjustment.value = 1000;
    adjustment.emit('changed');
    const dots = launcher._dots.get_children();
    eq(dots[2].has_style_class_name('chromeos-page-dot-active'), true, 'dritte aktiv');
    eq(dots[0].has_style_class_name('chromeos-page-dot-active'), false, 'erste inaktiv');
    return true;
});
check('Seitenpunkte verschwinden beim Suchen', () => {
    launcher.entry.set_text('term');
    eq(launcher._dots.visible, false);
    return true;
});

check('Enter startet den ersten Treffer', () => {
    launcher.show();
    launcher.entry.set_text('term');
    const before = state.activated.length;
    launcher.entry.clutter_text.emit('activate');
    eq(state.activated.length, before + 1, 'activateWindow');
    eq(state.activated.at(-1).id, 'terminal-window', 'Fenster');
    eq(launcher.actor.visible, false, 'Launcher zu');
    return true;
});
check('Enter ohne Treffer oeffnet die Websuche', () => {
    launcher.show();
    launcher.entry.set_text('zorin os');
    launcher.entry.clutter_text.emit('activate');
    const last = state.subprocess.at(-1);
    if (!last || last.argv[1] !== '--open' || last.argv[2] !== 'zorin os')
        throw new Error(`Aufruf: ${JSON.stringify(last?.argv)}`);
    eq(launcher.actor.visible, false, 'Launcher zu');
    return true;
});
check('Escape schliesst den Launcher', () => {
    launcher.show();
    const result = launcher.actor.emit('key-press-event', {
        get_key_symbol: () => Clutter.KEY_Escape,
    });
    eq(result, Clutter.EVENT_STOP);
    eq(launcher.actor.visible, false);
    return true;
});

// ---------------------------------------------------------- Kontextmenues
const shelfButton = id =>
    shelf._appsBox.get_children().find(button => button._chromeosAppId === id);
const menuLabels = menu => menu.items
    .map(item => item.label)
    .filter(label => typeof label === 'string');
const launcherTile = id => {
    const grid = launcher.content.get_children()[1];
    return grid.layout_manager.attached
        .map(entry => entry.child)
        .find(child => child._chromeosAppId === id);
};

check('Rechtsklick auf ein Shelf-Icon oeffnet das Kontextmenue', () => {
    const button = shelfButton('firefox');
    const result = button.emit('button-press-event', {get_button: () => 3});
    eq(result, Clutter.EVENT_STOP, 'Rueckgabe');
    const menu = shelf._contextMenu.menu;
    if (!menu)
        throw new Error('kein Menue geoeffnet');
    const labels = menuLabels(menu);
    if (!labels.includes('Von der Shelf entfernen'))
        throw new Error(`Anheften-Eintrag fehlt: ${labels.join(', ')}`);
    if (!labels.includes('App-Info'))
        throw new Error(`App-Info fehlt: ${labels.join(', ')}`);
    if (labels.includes('Fenster schliessen'))
        throw new Error('Firefox hat keine Fenster, Schliessen darf fehlen');
    return true;
});
check('Kontextmenue haengt an einem PopupMenuManager', () => {
    const menu = shelf._contextMenu.menu;
    if (!menu)
        throw new Error('kein Menue geoeffnet');
    if (!menu._manager)
        throw new Error('kein PopupMenuManager');
    eq(menu._manager.owner, shelfButton('firefox'), 'Owner');
    if (!menu._manager.menus.includes(menu._menu))
        throw new Error('Menue nicht beim Manager registriert');
    eq(menu._menu.yPosition, undefined, 'kein totes viertes Argument');
    return true;
});
check('Menue entfernt den Favoriten und baut die Shelf neu', () => {
    const item = shelf._contextMenu.menu.items
        .find(entry => entry.label === 'Von der Shelf entfernen');
    item.activate();
    eq(apps.favorites.length, 1, 'Favoriten');
    eq(shelf._appsBox.get_children().length, 1, 'Shelf-Apps');
    return true;
});
check('Menue schliesst Fenster ueber window.delete()', () => {
    const button = shelfButton('org.gnome.Terminal');
    button.emit('button-press-event', {get_button: () => 3});
    const labels = menuLabels(shelf._contextMenu.menu);
    if (!labels.includes('Fenster schliessen'))
        throw new Error(`Schliessen fehlt: ${labels.join(', ')}`);
    shelf._contextMenu.menu.items
        .find(entry => entry.label === 'Fenster schliessen')
        .activate();
    eq(state.closedWindows.at(-1), 'terminal-window', 'geschlossenes Fenster');
    return true;
});
check('Menue oeffnet die App-Info ueber appstream://', () => {
    const button = shelfButton('org.gnome.Terminal');
    button.emit('button-press-event', {get_button: () => 3});
    shelf._contextMenu.menu.items
        .find(entry => entry.label === 'App-Info')
        .activate();
    eq(state.appInfoUris.at(-1), 'appstream://org.gnome.Terminal', 'App-Info-URI');
    return true;
});
check('Mittelklick oeffnet weiterhin ein neues Fenster', () => {
    const before = apps.terminal.opened;
    const terminal = shelfButton('org.gnome.Terminal');
    const result = terminal.emit('button-press-event', {get_button: () => 2});
    eq(result, Clutter.EVENT_STOP, 'Rueckgabe');
    eq(apps.terminal.opened, before + 1, 'Mittelklick oeffnet neues Fenster');
    return true;
});
check('Rechtsklick im Launcher oeffnet das Menue mit Anheften', () => {
    launcher.show();
    const tile = launcherTile('org.gnome.Calculator');
    const result = tile.emit('button-press-event', {get_button: () => 3});
    eq(result, Clutter.EVENT_STOP, 'Rueckgabe');
    const labels = menuLabels(launcher._contextMenu.menu);
    if (!labels.includes('An die Shelf anheften'))
        throw new Error(`Anheften fehlt: ${labels.join(', ')}`);
    return true;
});
check('Anheften aus dem Launcher landet in der Shelf', () => {
    launcher._contextMenu.menu.items
        .find(entry => entry.label === 'An die Shelf anheften')
        .activate();
    eq(apps.favorites.length, 2, 'Favoriten');
    eq(shelfButton('org.gnome.Calculator') !== undefined, true, 'Shelf-Icon');
    return true;
});
check('Launcher schliessen raeumt das Menue ab', () => {
    launcher.show();
    launcherTile('org.gnome.Terminal')
        .emit('button-press-event', {get_button: () => 3});
    if (!launcher._contextMenu.menu)
        throw new Error('kein Menue geoeffnet');
    launcher.hide();
    eq(launcher._contextMenu.menu, null, 'offenes Menue');
    return true;
});
check('Favoritenstand fuer die restlichen Pruefungen wiederhergestellt', () => {
    const favorites = getAppFavorites();
    if (favorites.isFavorite('org.gnome.Calculator'))
        favorites.removeFavorite('org.gnome.Calculator');
    if (!favorites.isFavorite('firefox'))
        favorites.addFavorite('firefox');
    eq(favorites.getFavorites().map(app => app.get_id()).sort().join(','),
        'firefox,org.gnome.Terminal', 'Favoriten');
    return true;
});

// -------------------------------------------------------------------- Theme
check('Shell-Theme-CSS aus dem Benutzerdatenordner wird geladen', () => {
    eq(state.themeLoads.length, 1, 'Ladevorgaenge');
    eq(state.themeLoads[0].path, THEME_CSS);
    return true;
});
check('prefer-dark setzt chromeos-dark auf Launcher und Shelf', () => {
    lastInterfaceSettings()._force('color-scheme', 'prefer-dark');
    eq(launcher.actor.has_style_class_name('chromeos-dark'), true, 'Launcher');
    eq(shelf.actor.has_style_class_name('chromeos-dark'), true, 'Shelf');
    return true;
});
check('color-scheme default entfernt die Klasse wieder', () => {
    lastInterfaceSettings()._force('color-scheme', 'default');
    eq(launcher.actor.has_style_class_name('chromeos-dark'), false, 'Launcher');
    eq(shelf.actor.has_style_class_name('chromeos-dark'), false, 'Shelf');
    return true;
});
check('Supertaste/Overview oeffnet den Launcher', () => {
    launcher.hide();
    Main.overview.emit('showing');
    eq(Main.overview.hides, 1, 'overview.hide()');
    eq(launcher.actor.visible, true, 'Launcher sichtbar');
    return true;
});

// ------------------------------------------------------------------- Disable
check('disable() entfernt Launcher und Shelf aus dem Chrome', () => {
    extension.disable();
    eq(Main.layoutManager.topChrome.length, 0, 'topChrome');
    eq(Main.layoutManager.chrome.length, 0, 'chrome');
    eq(shelf._strutActor, null, 'Strut-Actor');
    eq(shelf.actor.get_parent(), null, 'Shelf ohne Eltern');
    eq(shelf._contextMenu.menu, null, 'offenes Kontextmenue');
    eq(launcher._contextMenu.menu, null, 'offenes Launcher-Menue');
    return true;
});
check('disable() haengt Tray-Knoepfe und Statusanzeigen zurueck', () => {
    const area = Main.panel.statusArea;
    eq(area.get_children().length, 6, 'Statusbereich');
    eq(area.get_children()[0], Main.panel.dateMenu.container, 'Datum');
    eq(area.get_children()[1], Main.panel.quickSettings.container, 'Schnelleinstellungen');
    eq(area.get_children()[2], Main.panel.network.container, 'Netzwerk');
    eq(area.get_children()[3], Main.panel.keyboard.container, 'Tastaturbelegung');
    eq(area.get_children()[4], Main.panel.screenRecording.container, 'Aufnahme');
    eq(area.get_children()[5], Main.panel.remoteAccess.container, 'Freigabe');
    eq(Main.panel.visible, true, 'Panel sichtbar');
    return true;
});
check('disable() loest alle Sitzungs-Signale', () => {
    eq(live.handlers, 0);
    eq(Main.sessionMode.openSignals(), 0, 'SessionMode-Signale');
    return true;
});
check('zweiter enable/disable-Zyklus bleibt sauber', () => {
    extension.enable();
    if (live.handlers === 0)
        throw new Error('keine Signale nach erneutem enable()');
    if (Main.layoutManager.chrome.length !== 2 || Main.layoutManager.topChrome.length !== 1)
        throw new Error('Chrome nicht neu aufgebaut');
    eq(Main.sessionMode.openSignals(), 1, 'SessionMode-Signale nach erneutem enable()');
    extension.disable();
    eq(live.handlers, 0, 'offene Signale');
    eq(Main.layoutManager.chrome.length, 0, 'chrome');
    eq(Main.layoutManager.topChrome.length, 0, 'topChrome');
    return true;
});
check('zweiter Zyklus haengt die Statusanzeigen wieder an ihren Platz', () => {
    // Nach dem zweiten disable() darf _moved nichts mehr offen haben: sonst
    // landen die Anzeigen beim dritten Lauf doppelt oder gar nicht im Panel.
    eq(shelf._moved.length, 0, 'offene Umhaengungen');
    const area = Main.panel.statusArea;
    eq(area.get_children().length, 6, 'Statusbereich');
    eq(area.get_children()[3], Main.panel.keyboard.container, 'Tastaturbelegung');
    eq(area.get_children()[4], Main.panel.screenRecording.container, 'Aufnahme');
    eq(area.get_children()[5], Main.panel.remoteAccess.container, 'Freigabe');
    return true;
});

// ------------------------------------------------------------------- Ergebnis
const open = appSystem.openSignals();
if (open > 0) {
    failures.push(`AppSystem hat ${open} offene Signale`);
    total++;
}

if (process.env.KEEP !== '1')
    fs.rmSync(TMP, {recursive: true, force: true});

console.log(`\n${total - failures.length}/${total} Pruefungen bestanden`);
if (failures.length > 0) {
    console.log('Fehlgeschlagen:');
    for (const name of failures)
        console.log(`  - ${name}`);
    process.exit(1);
}
