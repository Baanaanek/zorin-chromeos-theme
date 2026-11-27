#!/usr/bin/env node
// Erzeugt die Hintergrundmotive des Themes als PNG.
//
// Es sind eigene Verlaeufe (Farbfelder, Lichtkanten, Horizont) – keine Fotos
// und keine Dateien aus ChromeOS. Damit bleibt das Repo frei von fremden
// Bildern und trotzdem mit Hintergruenden ausgestattet.
//
//   bun tools/build-wallpapers.mjs            schreibt assets/wallpapers/*.png
//   bun tools/build-wallpapers.mjs --check    prueft, ob die Dateien exakt
//                                             dem aktuellen Generator
//                                             entsprechen (Exit 1 sonst)

import {deflateSync, inflateSync} from 'node:zlib';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, 'assets', 'wallpapers');
const WIDTH = 2560;
const HEIGHT = 1440;

const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = t => t * t * (3 - 2 * t);

function radial(x, y, cx, cy, radius) {
    const dx = x - cx;
    const dy = y - cy;
    return clamp(1 - Math.sqrt(dx * dx + dy * dy) / radius);
}

// Abstand eines Punktes zu einer Geraden durch (x0,y0) mit Richtung (dx,dy).
function lineDistance(x, y, x0, y0, dx, dy) {
    const length = Math.hypot(dx, dy);
    return Math.abs((x - x0) * dy - (y - y0) * dx) / length;
}

// --- Motive ----------------------------------------------------------------
// Jedes Motiv bekommt normierte Koordinaten (0..1) und liefert RGB 0..255.

const MOTIFS = {
    // Tiefblauer Verlauf mit heller Diagonale – Anlehnung an Chromes Blau,
    // aber als reines Farbfeld, nicht als Bildkopie.
    'chromeos-blue': (x, y) => {
        const base = mix([10, 42, 122], [126, 196, 240], smooth(clamp(x * 0.55 + y * 0.65)));
        const streak = Math.exp(-Math.pow(lineDistance(x, y, 0.05, 0.85, 0.85, -0.5) / 0.055, 2));
        const glow = radial(x, y, 0.86, 0.12, 0.55) * 0.35;
        return mix(base, [236, 246, 255], Math.min(1, streak * 0.85 + glow));
    },

    // Indigo/Violett mit weichem Lichtkern.
    'chromeos-iris': (x, y) => {
        const base = mix([28, 18, 62], [116, 96, 208], smooth(clamp(0.5 + (0.55 - y) * 0.9)));
        const core = Math.pow(radial(x, y, 0.62, 0.34, 0.62), 1.6);
        const halo = Math.pow(radial(x, y, 0.18, 0.82, 0.5), 2) * 0.5;
        return mix(mix(base, [176, 150, 255], core * 0.75), [255, 226, 244], halo);
    },

    // Abstrakter See: Himmel, Lichtsaum am Horizont, Wasserflaeche.
    'chromeos-lake': (x, y, rng) => {
        const horizon = 0.46;
        if (y < horizon) {
            const t = smooth(clamp(y / horizon));
            const sky = mix([168, 214, 244], [242, 250, 255], t);
            const sun = Math.pow(radial(x, y, 0.74, horizon - 0.04, 0.42), 1.4);
            return mix(sky, [255, 244, 222], sun * 0.8);
        }
        const depth = smooth(clamp((y - horizon) / (1 - horizon)));
        const water = mix([26, 126, 168], [9, 62, 96], depth);
        // Spiegelung des Himmels als weiche Baender.
        const band = (Math.sin((y - horizon) * 62 + rng * 0.6) + 1) / 2;
        return mix(water, [186, 224, 246], (1 - depth) * 0.35 * (0.35 + band * 0.65));
    },
};

// 4x4-Bayer-Matrix: verteilt die 8-Bit-Quantisierung, damit grosse Verlaeufe
// keine sichtbaren Ringe bilden, ohne wie Rauschen zu wirken.
const BAYER = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
];

function renderPixels(motif) {
    const size = WIDTH * HEIGHT * 3;
    const out = Buffer.allocUnsafe(size);
    let offset = 0;
    for (let y = 0; y < HEIGHT; y++) {
        const ny = y / (HEIGHT - 1);
        for (let x = 0; x < WIDTH; x++) {
            const nx = x / (WIDTH - 1);
            const rgb = motif(nx, ny);
            // Sehr feines Dithering nur gegen Banding, klein genug, dass der
            // Deflate-Lauf die Datei nicht aufblaeht.
            const dither = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.35;
            for (let c = 0; c < 3; c++)
                out[offset++] = Math.round(clamp((rgb[c] + dither) / 255) * 255);
        }
    }
    return out;
}

// --- PNG -------------------------------------------------------------------

const CRC_TABLE = (() => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c;
    }
    return table;
})();

function crc32(buffer) {
    let c = 0xffffffff;
    for (const byte of buffer)
        c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData), 0);
    return Buffer.concat([length, typeAndData, crc]);
}

// Rohe Scanlines mit Filterbyte je Zeile - die Grundlage fuer Vergleich und
// Kodierung. Der Deflate-Lauf unterscheidet sich je nach zlib-Version, die
// Pixel nicht.
function rawScanlines(pixels) {
    const stride = WIDTH * 3;
    const raw = Buffer.allocUnsafe(HEIGHT * (stride + 1));
    for (let y = 0; y < HEIGHT; y++) {
        raw[y * (stride + 1)] = 0;
        pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    return raw;
}

function encodePng(pixels) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(WIDTH, 0);
    header.writeUInt32BE(HEIGHT, 4);
    header[8] = 8;   // 8 Bit je Kanal
    header[9] = 2;   // Truecolor RGB
    header[10] = 0;  // Deflate
    header[11] = 0;  // Standardfilter
    header[12] = 0;  // nicht interlaced

    const raw = rawScanlines(pixels);

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', deflateSync(raw, {level: 9})),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function buildPng(name) {
    return encodePng(renderPixels(MOTIFS[name]));
}

// --- Pruefung --------------------------------------------------------------

function readPngInfo(buffer) {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!buffer.subarray(0, 8).equals(signature))
        return {ok: false, reason: 'keine PNG-Signatur'};
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const depth = buffer[24];
    const colorType = buffer[25];
    if (depth !== 8 || colorType !== 2)
        return {ok: false, reason: `Bit-Tiefe/Farbtyp ${depth}/${colorType}`};

    const idat = [];
    let offset = 8;
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
        const data = buffer.subarray(offset + 8, offset + 8 + length);
        const expected = buffer.readUInt32BE(offset + 8 + length);
        if (crc32(buffer.subarray(offset + 4, offset + 8 + length)) !== expected)
            return {ok: false, reason: `CRC kaputt in ${type}`};
        if (type === 'IDAT')
            idat.push(Buffer.from(data));
        if (type === 'IEND')
            break;
        offset += 12 + length;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const expectedRaw = HEIGHT * (WIDTH * 3 + 1);
    if (raw.length !== expectedRaw)
        return {ok: false, reason: `Pixeldaten ${raw.length} statt ${expectedRaw} Byte`};
    // Pixel fuer den Vergleich mit dem Generator mitgeben.
    const pixels = Buffer.allocUnsafe(WIDTH * HEIGHT * 3);
    for (let y = 0; y < HEIGHT; y++) {
        const from = y * (WIDTH * 3 + 1) + 1;
        raw.copy(pixels, y * WIDTH * 3, from, from + WIDTH * 3);
    }
    let nonEmpty = 0;
    for (let i = 0; i < raw.length; i += 997) {
        if (raw[i] > 0)
            nonEmpty++;
    }
    if (nonEmpty === 0)
        return {ok: false, reason: 'Bild ist komplett schwarz'};
    return {ok: true, width, height, pixels};
}

function check() {
    let failures = 0;
    for (const name of Object.keys(MOTIFS)) {
        const path = join(OUT_DIR, `${name}.png`);
        if (!existsSync(path)) {
            console.error(`fehlt: ${path}`);
            failures++;
            continue;
        }
        const actual = readFileSync(path);
        const info = readPngInfo(actual);
        if (!info.ok) {
            console.error(`${name}.png: ${info.reason}`);
            failures++;
            continue;
        }
        if (info.width !== WIDTH || info.height !== HEIGHT) {
            console.error(`${name}.png: ${info.width}x${info.height} statt ${WIDTH}x${HEIGHT}`);
            failures++;
            continue;
        }
        // Pixelvergleich statt Bytevergleich: zlib komprimiert je nach
        // Laufzeit unterschiedlich, die Motive bleiben gleich. Eine Toleranz
        // von 2 Stufen faengt Gleitkomma-Unterschiede zwischen Plattformen ab.
        const expected = renderPixels(MOTIFS[name]);
        let maxDiff = 0;
        let sumDiff = 0;
        for (let i = 0; i < expected.length; i++) {
            const diff = Math.abs(expected[i] - info.pixels[i]);
            if (diff > maxDiff)
                maxDiff = diff;
            sumDiff += diff;
        }
        if (maxDiff > 2) {
            console.error(`${name}.png: weicht vom Generator ab (max. ${maxDiff} Stufen, Mittel ${(sumDiff / expected.length).toFixed(2)})`);
            failures++;
            continue;
        }
        console.log(`  ok ${name}.png (${info.width}x${info.height}, ${actual.length} Byte)`);
    }
    // Keine fremden Bilddateien im Ordner: dort liegen nur noch eigene PNGs.
    if (existsSync(OUT_DIR)) {
        for (const entry of readdirSync(OUT_DIR)) {
            if (entry.startsWith('.'))
                continue;
            if (!entry.endsWith('.png') || !MOTIFS[entry.slice(0, -4)]) {
                console.error(`fremde Datei in assets/wallpapers: ${entry}`);
                failures++;
            }
        }
    }
    return failures;
}

function write() {
    mkdirSync(OUT_DIR, {recursive: true});
    for (const name of Object.keys(MOTIFS)) {
        const buffer = buildPng(name);
        writeFileSync(join(OUT_DIR, `${name}.png`), buffer);
        console.log(`  ${name}.png (${WIDTH}x${HEIGHT}, ${(buffer.length / 1024).toFixed(0)} KiB)`);
    }
    return 0;
}

const failures = process.argv.includes('--check') ? check() : write();
if (failures > 0) {
    console.error(`${failures} Problem(e).`);
    process.exit(1);
}
