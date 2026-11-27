#!/usr/bin/env node
// Prueft die Farbtokens der GTK-4-Datei auf Lesbarkeit.
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

if (failures > 0) {
    console.error(`\n${failures} Kontrastproblem(e).`);
    process.exit(1);
}
console.log(`  ok ${TEXT_PAIRS.length + ACCENT_PAIRS.length} Farbpaare in hell und dunkel geprueft`);
