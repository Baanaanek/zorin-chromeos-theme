#!/usr/bin/env node
// Prueft die Farbtokens der GTK-4-Datei und die Farbpaare der dunklen
// Shell-CSS auf Lesbarkeit.
//
// Auf einem echten Bildschirm laesst sich das hier nicht ansehen; damit die
// Farben trotzdem nicht unbemerkt unlesbar werden, rechnet dieses Skript die
// WCAG-Kontraste der Text/Hintergrund-Paare fuer hell und dunkel nach.
//
//   bun tools/check-contrast.mjs        Exit 1 bei zu wenig Kontrast

import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CSS = join(ROOT, 'theme', 'ChromeOS', 'gtk-4.0', 'gtk.css');
const SHELL_CSS = join(ROOT, 'theme', 'ChromeOS', 'gnome-shell', 'gnome-shell.css');
const SHELL_DARK_CSS = join(ROOT, 'theme', 'ChromeOS', 'gnome-shell', 'gnome-shell-dark.css');

// Mindestkontrast nach WCAG 2.1: 4.5 fuer normalen Text, 3.0 fuer grosse
// Schrift und fuer Akzenttexte auf Flaechen.
const TEXT_PAIRS = [
    ['window_fg_color', 'window_bg_color'],
    ['view_fg_color', 'view_bg_color'],
    ['headerbar_fg_color', 'headerbar_bg_color'],
    ['card_fg_color', 'card_bg_color'],
    ['dialog_fg_color', 'dialog_bg_color'],
    ['popover_fg_color', 'popover_bg_color'],
    ['sidebar_fg_color', 'sidebar_bg_color'],
    ['secondary_sidebar_fg_color', 'secondary_sidebar_bg_color'],
    ['destructive_fg_color', 'destructive_bg_color'],
    ['success_fg_color', 'success_bg_color'],
    ['warning_fg_color', 'warning_bg_color'],
    ['error_fg_color', 'error_bg_color'],
];

const ACCENT_PAIRS = [
    ['accent_fg_color', 'accent_bg_color'],
    ['accent_color', 'window_bg_color'],
    ['error_color', 'window_bg_color'],
    ['warning_color', 'window_bg_color'],
    ['success_color', 'window_bg_color'],
];

function toRgb(value) {
    const match = /^#([0-9a-fA-F]{6})$/.exec(value.trim());
    if (!match)
        return null;
    const int = Number.parseInt(match[1], 16);
    return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff];
}

function luminance([r, g, b]) {
    const channel = v => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
}

function parseTokens(source) {
    const tokens = new Map();
    const pattern = /@define-color\s+([A-Za-z0-9_]+)\s+(#[0-9a-fA-F]{6})\s*;/g;
    let match;
    while ((match = pattern.exec(source)) !== null)
        tokens.set(match[1], match[2]);
    return tokens;
}

const css = readFileSync(CSS, 'utf8');
const darkIndex = css.search(/@media\s*\(prefers-color-scheme:\s*dark\)/);
if (darkIndex < 0) {
    console.error('Kein Dunkelblock (@media prefers-color-scheme: dark) gefunden.');
    process.exit(1);
}

const light = parseTokens(css.slice(0, darkIndex));
const dark = parseTokens(css.slice(darkIndex));

let failures = 0;
const fail = message => {
    console.error(`  FAIL ${message}`);
    failures++;
};

if (light.size === 0)
    fail('keine Farbtokens im hellen Teil');

// Beide Modi muessen dieselben Tokens definieren, sonst bleibt im Dunkelmodus
// eine Farbe des anderen Modus stehen.
const missingInDark = [...light.keys()].filter(name => !dark.has(name));
const extraInDark = [...dark.keys()].filter(name => !light.has(name));
if (missingInDark.length > 0)
    fail(`im Dunkelmodus undefiniert: ${missingInDark.join(', ')}`);
if (extraInDark.length > 0)
    fail(`nur im Dunkelmodus definiert: ${extraInDark.join(', ')}`);

function checkPairs(tokens, label, pairs, minimum) {
    for (const [fg, bg] of pairs) {
        const fgValue = tokens.get(fg);
        const bgValue = tokens.get(bg);
        if (!fgValue || !bgValue) {
            fail(`${label}: ${fg} oder ${bg} fehlt`);
            continue;
        }
        const fgRgb = toRgb(fgValue);
        const bgRgb = toRgb(bgValue);
        if (!fgRgb || !bgRgb) {
            fail(`${label}: ${fg}/${bg} ist kein #rrggbb`);
            continue;
        }
        const ratio = contrast(fgRgb, bgRgb);
        if (ratio < minimum)
            fail(`${label}: ${fg} auf ${bg} = ${ratio.toFixed(2)}:1 (min. ${minimum}:1)`);
    }
}

checkPairs(light, 'hell', TEXT_PAIRS, 4.5);
checkPairs(dark, 'dunkel', TEXT_PAIRS, 4.5);
checkPairs(light, 'hell', ACCENT_PAIRS, 3);
checkPairs(dark, 'dunkel', ACCENT_PAIRS, 3);

// ------------------------------------------------------------ Shell (dunkel)
// St kennt keine @media-Abfragen: Der Dunkelmodus ist eine zweite Datei, die
// ueber der hellen liegt. Geprueft werden genau die Paare, die sie setzt -
// Kalender, Popups, Schnelleinstellungen, Benachrichtigungen und Dialoge.

// selector -> property -> Wert (letzte Regel gewinnt).
function parseRules(source) {
    const rules = new Map();
    // Kommentare zuerst entfernen: ein Abschnittskommentar direkt ueber einer
    // Regel wuerde sonst Teil des Selektornamens.
    const pattern = /([^{}]+)\{([^{}]*)\}/g;
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    let match;
    while ((match = pattern.exec(withoutComments)) !== null) {
        const declarations = new Map();
        for (const entry of match[2].split(';')) {
            const colon = entry.indexOf(':');
            if (colon < 0)
                continue;
            declarations.set(entry.slice(0, colon).trim(), entry.slice(colon + 1).trim());
        }
        for (const name of match[1].split(',')) {
            const selector = name.trim();
            const existing = rules.get(selector) ?? new Map();
            for (const [property, value] of declarations)
                existing.set(property, value);
            rules.set(selector, existing);
        }
    }
    return rules;
}

function parseColor(value) {
    if (!value)
        return null;
    const text = value.trim();
    const hex = /^#([0-9a-fA-F]{6})$/.exec(text);
    if (hex) {
        const int = Number.parseInt(hex[1], 16);
        return [(int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff, 1];
    }
    const rgba = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);
    if (rgba)
        return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])];
    return null;
}

function over(color, base) {
    const alpha = color[3] ?? 1;
    return [
        color[0] * alpha + base[0] * (1 - alpha),
        color[1] * alpha + base[1] * (1 - alpha),
        color[2] * alpha + base[2] * (1 - alpha),
        1,
    ];
}

// Zwei Staende: die helle Datei allein und dieselbe Datei mit der dunklen
// darueber, so wie die Shell sie stapelt. Nur so faellt auf, wenn eine Farbe
// in einem Modus fehlt und die des anderen stehen bleibt.
const lightRules = parseRules(readFileSync(SHELL_CSS, 'utf8'));
const darkRules = new Map();
for (const [selector, declarations] of lightRules)
    darkRules.set(selector, new Map(declarations));
for (const [selector, declarations] of parseRules(readFileSync(SHELL_DARK_CSS, 'utf8'))) {
    const existing = darkRules.get(selector) ?? new Map();
    for (const [property, value] of declarations)
        existing.set(property, value);
    darkRules.set(selector, existing);
}

function shellColor(rules, label, selector, property) {
    const declarations = rules.get(selector);
    if (!declarations?.has(property)) {
        fail(`Shell (${label}): ${selector} { ${property} } fehlt`);
        return null;
    }
    const color = parseColor(declarations.get(property));
    if (!color) {
        fail(`Shell (${label}): ${selector} { ${property} } ist keine Farbe: ${declarations.get(property)}`);
        return null;
    }
    return color;
}

// Eine Oberflaeche, ueber der halbtransparente Flaechen liegen.
const POPUP = shellColor(darkRules, 'dunkel', '.popup-menu-content', 'background-color');
const POPUP_LIGHT = shellColor(lightRules, 'hell', '.popup-menu-content', 'background-color');
// Der Sperrbildschirm zeigt das unscharfe Hintergrundbild; seine Helligkeit
// ist nicht vorhersagbar. Halbtransparente Karten werden deshalb ueber dem
// hellstmoeglichen Untergrund gerechnet, nicht ueber eine Wunschflaeche.
const BRIGHT_WALLPAPER = [255, 255, 255, 1];

// [Bezeichnung, Vordergrund-Selector, Eigenschaft, Hintergrund-Selector,
//  Eigenschaft, Mindestkontrast, Untergrund fuer halbtransparente Flaechen]
const SHELL_PAIRS = [
    ['Popup-Text', '.popup-menu-item', 'color', '.popup-menu-content', 'background-color', 4.5],
    ['Popup-Eintrag aktiv', '.popup-menu-item:checked', 'color', '.popup-menu-item:checked', 'background-color', 4.5],
    ['Kalender-Monat', '.calendar-month-label', 'color', '.popup-menu-content', 'background-color', 4.5],
    ['Kalender-Wochentage', '.calendar-weekday', 'color', '.popup-menu-content', 'background-color', 4.5],
    ['Kalender-Tag', '.calendar-day', 'color', '.popup-menu-content', 'background-color', 4.5],
    ['Kalender-Tag anderen Monats', '.calendar-other-month-day', 'color', '.popup-menu-content', 'background-color', 4.5],
    ['Kalender heute', '.calendar-today', 'color', '.popup-menu-content', 'background-color', 3],
    ['Kalender-Tag gewaehlt', '.calendar-day:selected', 'color', '.calendar-day:selected', 'background-color', 4.5],
    ['Schnelleinstellung', '.quick-toggle', 'color', '.quick-toggle', 'background-color', 4.5],
    ['Schnelleinstellung an', '.quick-toggle:checked', 'color', '.quick-toggle:checked', 'background-color', 4.5],
    ['Schnelleinstellung Untertitel', '.quick-toggle-subtitle', 'color', '.quick-toggle', 'background-color', 4.5],
    ['Benachrichtigungstext', '.message-body', 'color', '.message', 'background-color', 4.5],
    ['Dialogtext', '.modal-dialog', 'color', '.modal-dialog', 'background-color', 4.5],
    ['Dialog-Knopf', '.modal-dialog .modal-dialog-linked-button', 'color', '.modal-dialog', 'background-color', 3],
    ['Dialog-Hauptknopf', '.modal-dialog .modal-dialog-linked-button:last-child', 'color', '.modal-dialog .modal-dialog-linked-button:last-child', 'background-color', 4.5],
    ['Suchfeld', '.search-entry', 'color', '.search-entry', 'background-color', 4.5],
    ['Suchfeld-Symbol', '.search-entry .search-entry-icon', 'color', '.search-entry', 'background-color', 3],
];

// Sperrbildschirm: Uhr/Datum, Eingabe, Entsperr-Knopf, Kontoliste,
// Benachrichtigungen mit Medienzeile, Fehlermeldung. Dieselben Paare gelten
// fuer hell und dunkel - eine fehlende dunkle Fassung faellt damit auf.
const LOCK_PAIRS = [
    ['Uhrzeit', '.unlock-dialog-clock .unlock-dialog-clock-time', 'color',
        '.unlock-dialog', 'background-color', 3],
    ['Datum', '.unlock-dialog-clock .unlock-dialog-clock-date', 'color',
        '.unlock-dialog', 'background-color', 4.5],
    ['Hinweis unter der Uhr', '.unlock-dialog-clock .unlock-dialog-clock-hint', 'color',
        '.unlock-dialog', 'background-color', 4.5],
    ['Passwortfeld', '.unlock-dialog .login-dialog-prompt-entry', 'color',
        '.unlock-dialog .login-dialog-prompt-entry', 'background-color', 4.5],
    ['Passwortfeld mit Fokus', '.unlock-dialog .login-dialog-prompt-entry:focus', 'color',
        '.unlock-dialog .login-dialog-prompt-entry:focus', 'background-color', 4.5],
    ['Entsperr-Knopf', '.unlock-dialog .button', 'color',
        '.unlock-dialog .button', 'background-color', 4.5],
    ['Kontoliste', '.unlock-dialog .login-dialog-user-list .login-dialog-user-list-item', 'color',
        '.unlock-dialog .login-dialog-user-list .login-dialog-user-list-item',
        'background-color', 4.5],
    ['Kontoliste gewaehlt',
        '.unlock-dialog .login-dialog-user-list .login-dialog-user-list-item:selected', 'color',
        '.unlock-dialog .login-dialog-user-list .login-dialog-user-list-item:selected',
        'background-color', 4.5],
    ['Benachrichtigung',
        '.unlock-dialog-notifications-container .unlock-dialog-notification-source', 'color',
        '.unlock-dialog-notifications-container .unlock-dialog-notification-source',
        'background-color', 4.5],
    ['Benachrichtigung kritisch',
        '.unlock-dialog-notifications-container .unlock-dialog-notification-source.critical',
        'color',
        '.unlock-dialog-notifications-container .unlock-dialog-notification-source.critical',
        'background-color', 4.5],
    ['Medienzeile', '.unlock-dialog-notifications-container .message-media-control', 'color',
        '.unlock-dialog-notifications-container .message-media-control',
        'background-color', 4.5],
    ['Medienzeile aktiv',
        '.unlock-dialog-notifications-container .message-media-control:hover', 'color',
        '.unlock-dialog-notifications-container .message-media-control:hover',
        'background-color', 4.5],
    ['Anzahl-Anzeige', '.unlock-dialog-notification-count-text', 'color',
        '.unlock-dialog-notification-count-text', 'background-color', 4.5],
    ['Fehlermeldung', '.unlock-dialog .login-dialog-message-warning', 'color',
        '.unlock-dialog', 'background-color', 4.5],
];

// Die uebrigen Oberflaechen, die ChromeOS mitgestaltet: Schnell-
// einstellungen, Benachrichtigungen samt Medienzeile, OSD, Fensterkennung
// und die Screenshot-UI. Auch hier dieselben Paare in beiden Modi.
const UI_PAIRS = [
    ['Schnelleinstellung', '.quick-toggle', 'color', '.quick-toggle', 'background-color', 4.5],
    ['Schnelleinstellung an', '.quick-toggle:checked', 'color',
        '.quick-toggle:checked', 'background-color', 4.5],
    ['Schnelleinstellung Untertitel', '.quick-toggle-subtitle', 'color',
        '.quick-toggle', 'background-color', 4.5],
    ['Schnelleinstellungsmenue', '.quick-toggle-menu', 'color',
        '.quick-toggle-menu', 'background-color', 4.5],
    ['Benachrichtigungstitel', '.message-title', 'color', '.message', 'background-color', 4.5],
    ['Benachrichtigungstext', '.message-body', 'color', '.message', 'background-color', 4.5],
    ['Benachrichtigungsknopf', '.message .message-button', 'color',
        '.message .message-button', 'background-color', 4.5],
    ['Medienzeile', '.message .message-media-control', 'color',
        '.message .message-media-control', 'background-color', 4.5],
    ['Screenshot-Panel', '.screenshot-ui-panel', 'color',
        '.screenshot-ui-panel', 'background-color', 4.5],
    ['Screenshot-Modus aktiv', '.screenshot-ui-type-button:checked', 'color',
        '.screenshot-ui-type-button:checked', 'background-color', 4.5],
    ['Screenshot-Tooltip', '.screenshot-ui-tooltip', 'color',
        '.screenshot-ui-tooltip', 'background-color', 4.5],
];

// Flaechen, die direkt auf dem Bildschirminhalt liegen.
const DESKTOP_PAIRS = [
    ['OSD', '.osd-window', 'color', '.osd-window', 'background-color', 4.5],
    ['Fensterkennung', '.window-caption', 'color', '.window-caption', 'background-color', 4.5],
];

// Fensterumschalter (Alt+Tab) und die uebrigen Shell-Dialoge.
const SWITCHER_PAIRS = [
    ['Fensterumschalter', '.switcher-list .item-box', 'color',
        '.switcher-list', 'background-color', 4.5],
    ['Fensterumschalter Auswahl', '.switcher-list .item-box:selected', 'color',
        '.switcher-list .item-box:selected', 'background-color', 4.5],
];

const DIALOG_PAIRS = [
    ['Dialog-Fensterliste',
        '.dialog-list .dialog-list-item .dialog-list-item-description', 'color',
        '.modal-dialog', 'background-color', 4.5],
    ['Abmelde-Warnung', '.end-session-dialog .end-session-dialog-battery-warning',
        'color', '.modal-dialog', 'background-color', 4.5],
    ['Ausfuehren-Beschreibung', '.run-dialog .run-dialog-description', 'color',
        '.modal-dialog', 'background-color', 4.5],
    ['Passphrase-Fehler', '.prompt-dialog-error-label', 'color',
        '.modal-dialog', 'background-color', 4.5],
    ['Polkit-Root', '.polkit-dialog-user-layout .polkit-dialog-user-root-label',
        'color', '.modal-dialog', 'background-color', 4.5],
    ['Audiogeraet aktiv', '.audio-selection-device:active', 'color',
        '.audio-selection-device:active', 'background-color', 4.5],
];

// [Bezeichnung, Vordergrund-Selector, Eigenschaft, Hintergrund-Selector,
//  Eigenschaft, Mindestkontrast, Untergrund fuer halbtransparente Flaechen]
function checkShellPairs(rules, label, pairs, defaultBackdrop) {
    for (const [name, fgSelector, fgProperty, bgSelector, bgProperty, minimum,
        backdrop = defaultBackdrop] of pairs) {
        const fg = shellColor(rules, label, fgSelector, fgProperty);
        const bg = shellColor(rules, label, bgSelector, bgProperty);
        if (!fg || !bg)
            continue;
        const background = bg[3] < 1 ? over(bg, backdrop) : bg;
        const foreground = fg[3] < 1 ? over(fg, background) : fg;
        const ratio = contrast(foreground, background);
        if (ratio < minimum)
            fail(`Shell (${label}): ${name} = ${ratio.toFixed(2)}:1 (min. ${minimum}:1)`);
    }
}

if (POPUP)
    checkShellPairs(darkRules, 'dunkel', SHELL_PAIRS, POPUP);

checkShellPairs(lightRules, 'hell', LOCK_PAIRS, BRIGHT_WALLPAPER);
checkShellPairs(darkRules, 'dunkel', LOCK_PAIRS, BRIGHT_WALLPAPER);
// Schnelleinstellungen, Benachrichtigungen und Screenshot-Panel liegen auf
// der Popup-Flaeche des jeweiligen Modus; OSD und Fensterkennung liegen auf
// einem beliebigen Bild, dort gilt der hellstmoegliche Untergrund.
if (POPUP_LIGHT) {
    checkShellPairs(lightRules, 'hell', UI_PAIRS, POPUP_LIGHT);
    checkShellPairs(lightRules, 'hell', DESKTOP_PAIRS, BRIGHT_WALLPAPER);
    checkShellPairs(lightRules, 'hell', SWITCHER_PAIRS, POPUP_LIGHT);
    checkShellPairs(lightRules, 'hell', DIALOG_PAIRS, POPUP_LIGHT);
}
if (POPUP) {
    checkShellPairs(darkRules, 'dunkel', UI_PAIRS, POPUP);
    checkShellPairs(darkRules, 'dunkel', DESKTOP_PAIRS, BRIGHT_WALLPAPER);
    checkShellPairs(darkRules, 'dunkel', SWITCHER_PAIRS, POPUP);
    checkShellPairs(darkRules, 'dunkel', DIALOG_PAIRS, POPUP);
}

if (failures > 0) {
    console.error(`\n${failures} Kontrastproblem(e).`);
    process.exit(1);
}
console.log(`  ok ${TEXT_PAIRS.length + ACCENT_PAIRS.length} Farbpaare in hell und dunkel geprueft`);
console.log(`  ok ${SHELL_PAIRS.length} Shell-Farbpaare im Dunkelmodus geprueft`);
console.log(`  ok ${LOCK_PAIRS.length} Sperrbildschirm-Paare in hell und dunkel geprueft`);
console.log(`  ok ${UI_PAIRS.length + DESKTOP_PAIRS.length} Oberflaechen-Paare in hell und dunkel geprueft`);
console.log(`  ok ${SWITCHER_PAIRS.length + DIALOG_PAIRS.length} Umschalter- und Dialog-Paare in hell und dunkel geprueft`);
