#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Baut den mitgelieferten Mauszeiger-Satz (cursor/ChromeOS) aus Vektorformen.
//
//   node tools/build-cursors.mjs            # schreibt cursor/ + Vorschau-PNG
//   node tools/build-cursors.mjs --check    # prueft nur, ob alles da ist
//
// Die Formen sind eigene, einfache Zeichnungen im Stil von ChromeOS
// (weisse Flaeche, dunkle Kontur). Kein Material-Cursor, keine kopierten
// Dateien: alles hier entsteht aus den Polygonen unten und steht unter MIT.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CURSOR_ROOT = path.join(ROOT, 'cursor', 'ChromeOS');
const PREVIEW = path.join(ROOT, 'docs', 'reference', '06-cursors.png');

const PAPER = [255, 255, 255];
const INK = [32, 33, 36];
const SIZES = [24, 48];
const SS = 5; // Supersampling pro Achse

// --------------------------------------------------------------- Geometrie
const poly = (pts, {fill = true, stroke = 1.4} = {}) => ({kind: 'poly', pts, fill, stroke});
const circle = (cx, cy, r, {fill = true, stroke = 1.4} = {}) => ({kind: 'circle', cx, cy, r, fill, stroke});
const line = (pts, width = 1.8) => ({kind: 'line', pts, width});

function pointInPolygon(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside;
    }
    return inside;
}

function segmentDistance(ax, ay, bx, by, x, y) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx;
    const py = ay + t * dy;
    return Math.hypot(x - px, y - py);
}

function polylineDistance(pts, x, y, closed = false) {
    let best = Infinity;
    const last = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < last; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        best = Math.min(best, segmentDistance(ax, ay, bx, by, x, y));
    }
    return best;
}

// --------------------------------------------------------------- Formen
// Alle Koordinaten in einem 24x24-Raster, Ursprung oben links.
const SHAPES = {
    // Pfeil (Standardzeiger), Spitze oben links
    arrow: {
        hotspot: [3.2, 2.2],
        prims: [poly([
            [2.6, 1.6], [2.6, 20.4], [7.4, 15.6], [10.4, 22.6],
            [13.2, 21.3], [10.2, 14.4], [16.6, 13.7],
        ])],
    },
    // Textcursor (I-Beam)
    text: {
        hotspot: [12, 12],
        prims: [poly([
            [8.6, 2.6], [15.4, 2.6], [15.4, 5.0], [13.2, 5.0], [13.2, 19.0],
            [15.4, 19.0], [15.4, 21.4], [8.6, 21.4], [8.6, 19.0], [10.8, 19.0],
            [10.8, 5.0], [8.6, 5.0],
        ], {stroke: 1.2})],
    },
    // Fadenkreuz
    crosshair: {
        hotspot: [12, 12],
        prims: [poly([
            [10.7, 2.0], [13.3, 2.0], [13.3, 10.7], [22.0, 10.7], [22.0, 13.3],
            [13.3, 13.3], [13.3, 22.0], [10.7, 22.0], [10.7, 13.3], [2.0, 13.3],
            [2.0, 10.7], [10.7, 10.7],
        ], {stroke: 1.2})],
    },
    // Sanduhr (beschaeftigt)
    wait: {
        hotspot: [12, 12],
        prims: [poly([
            [6.6, 2.6], [17.4, 2.6], [17.4, 5.4], [13.0, 11.0], [17.4, 18.6],
            [17.4, 21.4], [6.6, 21.4], [6.6, 18.6], [11.0, 11.0], [6.6, 5.4],
        ], {stroke: 1.3})],
    },
    // Verboten (Kreis mit Schraegstrich)
    notallowed: {
        hotspot: [12, 12],
        prims: [
            circle(12, 12, 8.8, {stroke: 1.5}),
            line([[6.2, 6.2], [17.8, 17.8]], 2.0),
        ],
    },
    // Verschieben (vier Pfeile)
    move: {
        hotspot: [12, 12],
        prims: [poly([
            [12, 2.0], [15.4, 5.4], [13.1, 5.4], [13.1, 10.9], [18.6, 10.9],
            [18.6, 13.1], [13.1, 13.1], [13.1, 18.6], [15.4, 18.6], [12, 22.0],
            [8.6, 18.6], [10.9, 18.6], [10.9, 13.1], [5.4, 13.1], [5.4, 10.9],
            [10.9, 10.9], [10.9, 5.4], [8.6, 5.4],
        ], {stroke: 1.3})],
    },
    // Offene Hand (ziehen)
    grab: {
        hotspot: [12, 12],
        prims: [poly([
            [6.6, 21.4], [6.0, 14.2], [6.4, 12.8], [7.4, 13.0], [8.0, 14.2],
            [8.0, 7.0], [8.8, 6.2], [9.6, 7.0], [9.6, 11.6], [10.2, 11.6],
            [10.2, 4.6], [11.0, 3.8], [11.8, 4.6], [11.8, 11.6], [12.4, 11.6],
            [12.4, 5.6], [13.2, 4.8], [14.0, 5.6], [14.0, 11.8], [14.6, 11.8],
            [14.6, 7.6], [15.4, 6.8], [16.2, 7.6], [16.2, 13.4], [17.2, 13.0],
            [17.8, 13.8], [17.6, 16.6], [16.8, 19.4], [15.4, 21.4],
        ], {stroke: 1.3})],
    },
    // Geschlossene Hand (greifen)
    grabbing: {
        hotspot: [12, 12],
        prims: [poly([
            [6.8, 21.4], [6.2, 14.0], [6.8, 13.2], [7.8, 13.6], [8.2, 14.8],
            [8.2, 11.2], [9.0, 10.6], [9.8, 11.2], [9.8, 12.8], [10.4, 12.8],
            [10.4, 10.2], [11.2, 9.6], [12.0, 10.2], [12.0, 12.8], [12.6, 12.8],
            [12.6, 10.8], [13.4, 10.2], [14.2, 10.8], [14.2, 13.0], [15.0, 12.6],
            [15.8, 13.0], [16.2, 14.0], [16.4, 16.8], [15.8, 19.6], [14.6, 21.4],
        ], {stroke: 1.3})],
    },
    // Zeigende Hand (Links)
    hand2: {
        hotspot: [6.0, 2.6],
        prims: [poly([
            [9.4, 3.0], [11.0, 3.0], [11.0, 10.4], [12.6, 10.4], [14.6, 11.4],
            [15.8, 13.2], [16.2, 15.2], [16.2, 19.4], [15.0, 21.6], [9.4, 21.6],
            [7.2, 17.8], [5.8, 14.4], [6.2, 13.2], [7.2, 13.0], [8.2, 13.8],
            [9.0, 15.6], [9.0, 4.0],
        ], {stroke: 1.3})],
    },
    // Lupe mit Plus
    zoomin: {
        hotspot: [9.6, 9.6],
        prims: [
            circle(9.8, 9.8, 6.6, {stroke: 1.5}),
            line([[14.7, 14.7], [20.0, 20.0]], 2.2),
            line([[7.0, 9.8], [12.6, 9.8]], 1.6),
            line([[9.8, 7.0], [9.8, 12.6]], 1.6),
        ],
    },
    // Lupe mit Minus
    zoomout: {
        hotspot: [9.6, 9.6],
        prims: [
            circle(9.8, 9.8, 6.6, {stroke: 1.5}),
            line([[14.7, 14.7], [20.0, 20.0]], 2.2),
            line([[7.0, 9.8], [12.6, 9.8]], 1.6),
        ],
    },
};

// Pfeile fuer Groessenanpassung: eine Form, per Winkel gedreht.
function resizeArrow(angleDeg) {
    const base = [
        [2.0, 12.0], [6.2, 7.4], [6.2, 10.6], [17.8, 10.6], [17.8, 7.4],
        [22.0, 12.0], [17.8, 16.6], [17.8, 13.4], [6.2, 13.4], [6.2, 16.6],
    ];
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
        hotspot: [12, 12],
        prims: [poly(base.map(([x, y]) => {
            const dx = x - 12;
            const dy = y - 12;
            return [12 + dx * cos - dy * sin, 12 + dx * sin + dy * cos];
        }), {stroke: 1.3})],
    };
}

SHAPES.ew = resizeArrow(0);
SHAPES.ns = resizeArrow(90);
SHAPES.nwse = resizeArrow(-45);
SHAPES.nesw = resizeArrow(45);

// Name im Theme -> Form
const ALIASES = {
    'left_ptr': 'arrow',
    'default': 'arrow',
    'arrow': 'arrow',
    'context-menu': 'arrow',
    'help': 'arrow',
    'text': 'text',
    'xterm': 'text',
    'vertical-text': 'text',
    'crosshair': 'crosshair',
    'cross': 'crosshair',
    'cell': 'crosshair',
    'wait': 'wait',
    'watch': 'wait',
    'progress': 'wait',
    'not-allowed': 'notallowed',
    'forbidden': 'notallowed',
    'no-drop': 'notallowed',
    'move': 'move',
    'fleur': 'move',
    'all-scroll': 'move',
    'dnd-move': 'move',
    'grab': 'grab',
    'openhand': 'grab',
    'hand1': 'grab',
    'grabbing': 'grabbing',
    'closedhand': 'grabbing',
    'dnd-none': 'grabbing',
    'pointer': 'hand2',
    'hand2': 'hand2',
    'hand': 'hand2',
    'zoom-in': 'zoomin',
    'zoom-out': 'zoomout',
    'ew-resize': 'ew',
    'e-resize': 'ew',
    'w-resize': 'ew',
    'col-resize': 'ew',
    'h_double_arrow': 'ew',
    'split_h': 'ew',
    'ns-resize': 'ns',
    'n-resize': 'ns',
    's-resize': 'ns',
    'row-resize': 'ns',
    'v_double_arrow': 'ns',
    'split_v': 'ns',
    'nwse-resize': 'nwse',
    'se-resize': 'nwse',
    'nw-resize': 'nwse',
    'fd_double_arrow': 'nwse',
    'nesw-resize': 'nesw',
    'ne-resize': 'nesw',
    'sw-resize': 'nesw',
    'bd_double_arrow': 'nesw',
};

// --------------------------------------------------------------- Rendern
function renderShape(shape, size) {
    const scale = size / 24;
    const pixels = Buffer.alloc(size * size * 4);
    const total = SS * SS;

    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            let fillHits = 0;
            let inkHits = 0;
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const u = (px + (sx + 0.5) / SS) / scale;
                    const v = (py + (sy + 0.5) / SS) / scale;
                    let inside = false;
                    let inkDistance = Infinity;
                    for (const prim of shape.prims) {
                        if (prim.kind === 'circle') {
                            const d = Math.hypot(u - prim.cx, v - prim.cy);
                            if (prim.fill && d <= prim.r)
                                inside = true;
                            if (prim.stroke)
                                inkDistance = Math.min(inkDistance, Math.abs(d - prim.r) - prim.stroke / 2);
                        } else if (prim.kind === 'poly') {
                            if (prim.fill && pointInPolygon(prim.pts, u, v))
                                inside = true;
                            if (prim.stroke)
                                inkDistance = Math.min(inkDistance,
                                    polylineDistance(prim.pts, u, v, true) - prim.stroke / 2);
                        } else {
                            inkDistance = Math.min(inkDistance,
                                polylineDistance(prim.pts, u, v, false) - prim.width / 2);
                        }
                    }
                    if (inside)
                        fillHits++;
                    if (inkDistance <= 0)
                        inkHits++;
                }
            }

            const fa = fillHits / total;
            const ia = inkHits / total;
            const alpha = ia + fa * (1 - ia);
            const offset = (py * size + px) * 4;
            if (alpha <= 0) {
                pixels[offset] = 0;
                pixels[offset + 1] = 0;
                pixels[offset + 2] = 0;
                pixels[offset + 3] = 0;
                continue;
            }
            for (let channel = 0; channel < 3; channel++) {
                const value = (INK[channel] * ia + PAPER[channel] * fa * (1 - ia)) / alpha;
                pixels[offset + channel] = Math.max(0, Math.min(255, Math.round(value)));
            }
            pixels[offset + 3] = Math.round(alpha * 255);
        }
    }
    return pixels;
}

function shapeToXcursor(shape) {
    const images = SIZES.map(size => {
        const pixels = renderShape(shape, size);
        const argb = Buffer.alloc(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            const offset = i * 4;
            const a = pixels[offset + 3];
            const r = pixels[offset];
            const g = pixels[offset + 1];
            const b = pixels[offset + 2];
            argb.writeUInt32LE(((a << 24) | (r << 16) | (g << 8) | b) >>> 0, offset);
        }
        return {
            size,
            width: size,
            height: size,
            xhot: Math.round(shape.hotspot[0] * size / 24),
            yhot: Math.round(shape.hotspot[1] * size / 24),
            pixels: argb,
        };
    });

    const headerSize = 16;
    const tocSize = 12 * images.length;
    let offset = headerSize + tocSize;
    const chunks = [];
    for (const image of images) {
        const chunkHeaderSize = 36;
        const buffer = Buffer.alloc(chunkHeaderSize + image.width * image.height * 4);
        buffer.writeUInt32LE(chunkHeaderSize, 0);
        buffer.writeUInt32LE(0xfffd0002, 4);
        buffer.writeUInt32LE(image.size, 8);
        buffer.writeUInt32LE(1, 12);
        buffer.writeUInt32LE(image.width, 16);
        buffer.writeUInt32LE(image.height, 20);
        buffer.writeUInt32LE(image.xhot, 24);
        buffer.writeUInt32LE(image.yhot, 28);
        buffer.writeUInt32LE(0, 32);
        image.pixels.copy(buffer, chunkHeaderSize);
        chunks.push({size: image.size, offset, buffer});
        offset += buffer.length;
    }

    const header = Buffer.alloc(headerSize);
    header.write('Xcur', 0, 'ascii');
    header.writeUInt32LE(headerSize, 4);
    header.writeUInt32LE(0x00010000, 8);
    header.writeUInt32LE(images.length, 12);

    const toc = Buffer.alloc(tocSize);
    chunks.forEach((chunk, index) => {
        toc.writeUInt32LE(0xfffd0002, index * 12);
        toc.writeUInt32LE(chunk.size, index * 12 + 4);
        toc.writeUInt32LE(chunk.offset, index * 12 + 8);
    });

    return Buffer.concat([header, toc, ...chunks.map(chunk => chunk.buffer)]);
}

// ------------------------------------------------------------ PNG-Vorschau
function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++)
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const name = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, crc]);
}

function writePng(file, width, height, rgba) {
    const stride = width * 4 + 1;
    const raw = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        raw[y * stride] = 0;
        rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    fs.writeFileSync(file, Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(raw, {level: 9})),
        pngChunk('IEND', Buffer.alloc(0)),
    ]));
}

function drawPreview(file) {
    const names = ['arrow', 'text', 'crosshair', 'wait', 'notallowed', 'move',
        'grab', 'grabbing', 'hand2', 'zoomin', 'zoomout', 'ew', 'ns', 'nwse'];
    const cell = 64;
    const columns = 7;
    const rows = Math.ceil(names.length / columns) * 2;
    const width = cell * columns;
    const height = cell * rows;
    const canvas = Buffer.alloc(width * height * 4);

    const backgrounds = [[248, 249, 250], [32, 33, 36]];
    for (let index = 0; index < names.length; index++) {
        const shape = SHAPES[names[index]];
        const size = 48;
        const pixels = renderShape(shape, size);
        for (let variant = 0; variant < 2; variant++) {
            const bg = backgrounds[variant];
            const row = Math.floor(index / columns) + variant * (rows / 2);
            const column = index % columns;
            const originX = column * cell + (cell - size) / 2;
            const originY = row * cell + (cell - size) / 2;
            for (let y = 0; y < cell; y++) {
                for (let x = 0; x < cell; x++) {
                    const target = ((row * cell + y) * width + column * cell + x) * 4;
                    let color = bg;
                    const sx = x - (cell - size) / 2;
                    const sy = y - (cell - size) / 2;
                    if (sx >= 0 && sy >= 0 && sx < size && sy < size) {
                        const offset = (sy * size + sx) * 4;
                        const alpha = pixels[offset + 3] / 255;
                        if (alpha > 0) {
                            color = [0, 1, 2].map(channel =>
                                Math.round(pixels[offset + channel] * alpha + bg[channel] * (1 - alpha)));
                        }
                    }
                    canvas[target] = color[0];
                    canvas[target + 1] = color[1];
                    canvas[target + 2] = color[2];
                    canvas[target + 3] = 255;
                }
            }
            void originX;
            void originY;
        }
    }
    writePng(file, width, height, canvas);
}

// ------------------------------------------------------------------ Ablauf
// Liest eine Xcursor-Datei zurueck und prueft Header, TOC und Bildkoepfe.
function validateXcursor(file) {
    const data = fs.readFileSync(file);
    if (data.length < 16 || data.toString('ascii', 0, 4) !== 'Xcur')
        throw new Error(`${file}: kein Xcursor-Header`);
    if (data.readUInt32LE(4) !== 16)
        throw new Error(`${file}: unerwartete Headergroesse`);
    if (data.readUInt32LE(8) !== 0x00010000)
        throw new Error(`${file}: unerwartete Version`);
    const ntoc = data.readUInt32LE(12);
    if (ntoc !== SIZES.length)
        throw new Error(`${file}: ${ntoc} Bilder statt ${SIZES.length}`);
    const seen = [];
    for (let index = 0; index < ntoc; index++) {
        const base = 16 + index * 12;
        const type = data.readUInt32LE(base);
        const subtype = data.readUInt32LE(base + 4);
        const offset = data.readUInt32LE(base + 8);
        if (type !== 0xfffd0002)
            throw new Error(`${file}: falscher Chunk-Typ`);
        if (!SIZES.includes(subtype))
            throw new Error(`${file}: unerwartete Groesse ${subtype}`);
        if (offset + 36 > data.length)
            throw new Error(`${file}: Chunk ausserhalb der Datei`);
        const headerSize = data.readUInt32LE(offset);
        const width = data.readUInt32LE(offset + 16);
        const height = data.readUInt32LE(offset + 20);
        const xhot = data.readUInt32LE(offset + 24);
        const yhot = data.readUInt32LE(offset + 28);
        if (headerSize !== 36 || width !== subtype || height !== subtype)
            throw new Error(`${file}: Bildkopf passt nicht (${width}x${height})`);
        if (xhot >= width || yhot >= height)
            throw new Error(`${file}: Hotspot ausserhalb (${xhot},${yhot})`);
        if (offset + headerSize + width * height * 4 > data.length)
            throw new Error(`${file}: Pixeldaten unvollstaendig`);
        let opaque = 0;
        for (let pixel = 0; pixel < width * height; pixel++) {
            const argb = data.readUInt32LE(offset + headerSize + pixel * 4);
            if ((argb >>> 24) > 200)
                opaque++;
        }
        if (opaque < width * height * 0.02)
            throw new Error(`${file}: Bild wirkt leer`);
        seen.push(subtype);
    }
    return seen;
}

if (process.argv.includes('--check')) {
    let missing = 0;
    for (const name of Object.keys(ALIASES)) {
        const file = path.join(CURSOR_ROOT, 'cursors', name);
        if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
            console.error(`fehlt: ${file}`);
            missing++;
            continue;
        }
        try {
            validateXcursor(file);
        } catch (error) {
            console.error(error.message);
            missing++;
        }
    }
    for (const extra of ['index.theme', 'cursor.theme']) {
        if (!fs.existsSync(path.join(CURSOR_ROOT, extra))) {
            console.error(`fehlt: ${extra}`);
            missing++;
        }
    }
    console.log(missing === 0
        ? `Cursor-Satz vollstaendig und lesbar (${Object.keys(ALIASES).length} Namen, Groessen ${SIZES.join('/')}).`
        : `${missing} Dateien fehlerhaft.`);
    process.exit(missing === 0 ? 0 : 1);
}

fs.mkdirSync(path.join(CURSOR_ROOT, 'cursors'), {recursive: true});
for (const [name, shapeName] of Object.entries(ALIASES)) {
    const shape = SHAPES[shapeName];
    if (!shape)
        throw new Error(`Unbekannte Form: ${shapeName} (${name})`);
    fs.writeFileSync(path.join(CURSOR_ROOT, 'cursors', name), shapeToXcursor(shape));
}

fs.writeFileSync(path.join(CURSOR_ROOT, 'index.theme'), `[Icon Theme]
Name=ChromeOS
Comment=Eigener ChromeOS-artiger Mauszeiger (MIT, Teil des chromeos-theme)
Inherits=Adwaita

[Icon Theme]
Example=left_ptr
`);

fs.writeFileSync(path.join(CURSOR_ROOT, 'cursor.theme'), `[Icon Theme]
Name=ChromeOS
Inherits=Adwaita
`);

fs.mkdirSync(path.dirname(PREVIEW), {recursive: true});
drawPreview(PREVIEW);

console.log(`Cursor-Satz geschrieben: ${Object.keys(ALIASES).length} Namen, Groessen ${SIZES.join('/')}.`);
console.log(`Vorschau: ${path.relative(ROOT, PREVIEW)}`);
