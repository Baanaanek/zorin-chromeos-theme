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

globalThis.global = {stage: Main.stage, display: Main.display};

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

function eq(actual, expected, label = 'Wert') {
    if (actual !== expected)
        throw new Error(`${label}: erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`);
}

function texts(actor, collected = []) {
    if (typeof actor?._text === 'string' && actor._text.length > 0)
        collected.push(actor._text);
    for (const child of actor?.get_children?.() ?? [])
        texts(child, collected);
    return collected;
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
check('Shelf haengt in addChrome() mit Struts und Fullscreen', () => {
    eq(Main.layoutManager.chrome.length, 1);
    const call = Main.layoutManager.calls.find(entry => entry.actor === shelf.actor);
    eq(call.params.affectsStruts, true, 'affectsStruts');
    eq(call.params.affectsInputRegion, true, 'affectsInputRegion');
    eq(call.params.trackFullscreen, true, 'trackFullscreen');
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
check('leere Suche zeigt alle sechs Apps im Raster', () => {
    launcher.show();
    const attached = launcher.content.get_children()[1].layout_manager.attached;
    eq(attached.length, apps.installed.length);
    eq(attached[0].column, 0);
    eq(attached[5].row, 1);
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
    eq(shelf.actor.get_parent(), null, 'Shelf ohne Eltern');
    return true;
});
check('disable() haengt die Tray-Knoepfe zurueck und zeigt das Panel', () => {
    const area = Main.panel.statusArea;
    eq(area.get_children().length, 3);
    eq(area.get_children()[0], Main.panel.dateMenu.container);
    eq(area.get_children()[1], Main.panel.quickSettings.container);
    eq(area.get_children()[2], Main.panel.network.container);
    eq(Main.panel.visible, true, 'Panel sichtbar');
    return true;
});
check('disable() loest alle Sitzungs-Signale', () => eq(live.handlers, 0));
check('zweiter enable/disable-Zyklus bleibt sauber', () => {
    extension.enable();
    if (live.handlers === 0)
        throw new Error('keine Signale nach erneutem enable()');
    if (Main.layoutManager.chrome.length !== 1 || Main.layoutManager.topChrome.length !== 1)
        throw new Error('Chrome nicht neu aufgebaut');
    extension.disable();
    eq(live.handlers, 0, 'offene Signale');
    eq(Main.layoutManager.chrome.length, 0, 'chrome');
    eq(Main.layoutManager.topChrome.length, 0, 'topChrome');
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
