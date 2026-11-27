#!/usr/bin/env node
// Prueft die gsettings-Schluessel von install.sh gegen data/settings-keys.json.
//
// Der Testaufbau ersetzt gsettings durch einen Stub, der jeden Schluessel
// annimmt. Ein Schluessel, den GNOME 46 gar nicht kennt, wuerde dort also nie
// auffallen. Diese Pruefung macht die Versionsdrift sichtbar: jeder benutzte
// Schluessel braucht einen Eintrag mit Mindestversion, und die Datei darf
// keine Schluessel enthalten, die niemand mehr setzt.
//
//   bun tools/check-settings.mjs        Exit 1 bei Abweichung

import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INSTALL = join(ROOT, 'install.sh');
const MATRIX = join(ROOT, 'data', 'settings-keys.json');
const TARGET_GNOME = 46; // Zorin OS 18

const matrix = JSON.parse(readFileSync(MATRIX, 'utf8'));
const install = readFileSync(INSTALL, 'utf8');

const used = new Map();
for (const line of install.split('\n')) {
    const match = /^\s*set_key\s+(\S+)\s+(\S+)\s+/.exec(line);
    if (!match)
        continue;
    const schema = match[1];
    const key = match[2];
    if (schema.startsWith('$') || key.startsWith('$'))
        continue;
    used.set(`${schema} ${key}`, {schema, key});
}

const declared = new Map();
for (const [schema, keys] of Object.entries(matrix)) {
    if (schema.startsWith('_'))
        continue;
    for (const [key, info] of Object.entries(keys))
        declared.set(`${schema} ${key}`, {schema, key, ...info});
}

let failures = 0;
const fail = message => {
    console.error(`  FAIL ${message}`);
    failures++;
};

for (const [id, {schema, key}] of used) {
    const entry = declared.get(id);
    if (!entry) {
        fail(`${schema} ${key} wird gesetzt, fehlt aber in data/settings-keys.json`);
        continue;
    }
    if (typeof entry.since !== 'number') {
        fail(`${schema} ${key}: Eintrag ohne "since"`);
        continue;
    }
    if (entry.since > TARGET_GNOME)
        console.log(`  hinweis ${schema} ${key} gibt es erst ab GNOME ${entry.since}`);
}

for (const [id, {schema, key}] of declared) {
    if (!used.has(id))
        fail(`${schema} ${key} steht in der Matrix, wird aber nicht mehr gesetzt`);
}

if (failures > 0) {
    console.error(`\n${failures} Problem(e) in der Schluesselmatrix.`);
    process.exit(1);
}
console.log(`  ok ${used.size} Schluessel gegen GNOME ${TARGET_GNOME} geprueft`);
