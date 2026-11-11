/* The Bauhaus pixel art (ui-kit 0.41.0, 0.42.0): every piece drawn on the
   art cell (ART_CELL_PX, 2px since 0.45) and shaded through the kit's Bayer
   matrix, written into
   components.css as SVG data URIs between the two markers below. Ported
   from the probe lab/art-bauhaus.html. A mask carries alpha only (the SVG
   default black fill); the colour is painted by the hand rules from role
   vars, so a mask can never carry a theme. The posters and the horizons
   (0.45) are the exception: colour images in fixed palettes, see POSTERS.

     node scripts/gen-art.mjs           rewrite the generated block
     node scripts/gen-art.mjs --check   exit 1 when the committed block differs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { bayerAt } from "../packages/ui-kit/dither-core.js";
import { ART_CELL_PX, POSTERS, POSTER_COLS, POSTER_ROWS, HORIZONS, HORIZON_ROWS, renderPoster, renderHorizon, renderHorizonStrip } from "../packages/ui-kit/art-core.js";
import { png } from "./lib/png.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(HERE, "../packages/ui-kit/components.css");
export const START = "/* @gen-art:start */";
export const END = "/* @gen-art:end */";

/* The art's cell is ART_CELL_PX, 2px (0.45, owner 2026-11-11, lab/art-2px
   pick B), from art-core.js. Until 0.45 the art shared the dither hover's
   3px cell (CELL_PX). Every piece was drawn again on 1.5 times the cells, so
   it keeps its size in px and its curves and its dither grain are finer. */
export { ART_CELL_PX, POSTERS, POSTER_COLS, POSTER_ROWS, HORIZONS, HORIZON_ROWS };

/** The molnar stroke field: one stroke per PITCH × PITCH cell slot (14px). */
export const PITCH = 7;
/** The molnar stroke tile, in slots (it repeats). */
const STROKE_SLOTS = 12;
/** The molnar void's three steps, in cells: the fully erased zone, a
 *  superellipse centred on the box, so strokes surround the message on all
 *  four sides. The container query picks a step by the box's width
 *  (voidThreshold). A narrow box wraps the message onto more lines, so the
 *  narrowest zone is the tallest. */
export const VOID = { s: { w: 105, h: 75 }, m: { w: 142, h: 60 }, l: { w: 180, h: 60 } };
/** The void image of one step, in cells: the zone plus the reach of its
 *  dithered edge (a quarter of the zone), rounded up to an EVEN number of
 *  slots. Centred like the stroke tile (84 cells, 6 slots each side of its
 *  centre), it then starts and ends on a slot boundary, so it erases whole
 *  strokes. */
export const voidImage = ({ w, h }) => ({ w: Math.ceil((w * 1.25) / (2 * PITCH)) * 2 * PITCH, h: Math.ceil((h * 1.25) / (2 * PITCH)) * 2 * PITCH });
/** The box width, in px, from which a step applies: its image plus one
 *  stroke column on each side, so strokes always frame the void. */
export const voidThreshold = (zone) => (voidImage(zone).w + 2 * PITCH) * ART_CELL_PX;
/** The probe's coverage tones (lab/art-bauhaus.html), which the owner
 *  approved. Pieces that never sit under text keep them at full paint. */
export const TONES = {
  mark: { disc: 1, bar: 1 },
  shapes: 1,
  weave: [0.75, 0.45, 0.2, 0.45],
  empty: { circle: 0.5, square: 1, triangle: 0.25 },
};

const circle = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rect = (x0, y0, w, h) => (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h;
// Quarter disc centred on the corner (cx, cy), opening toward (sx, sy).
const quarter = (cx, cy, r, sx, sy) => (x, y) => (x - cx) * sx >= 0 && (y - cy) * sy >= 0 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
// Right triangle filling the half of a box below its rising diagonal.
const tri = (x0, y0, s) => (x, y) => x >= x0 && x < x0 + s && y < y0 + s && (y - y0) >= s - (x - x0);
const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** A cols × rows grid of cells, 1 where the mask is opaque. */
function grid(cols, rows) {
  const on = new Uint8Array(cols * rows);
  return { cols, rows, on, put: (i, j) => { if (i >= 0 && j >= 0 && i < cols && j < rows) on[j * cols + i] = 1; } };
}

/**
 * Sets every cell whose centre lies inside `inside` and whose tone beats
 * the Bayer threshold. `tone` is 0..1 (1 = solid) or a function of the
 * cell centre, so a shape can fade through the matrix.
 */
function shade(g, inside, tone) {
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    if (!inside(i + 0.5, j + 0.5)) continue;
    const t = typeof tone === "function" ? tone(i + 0.5, j + 0.5) : tone;
    if (t > bayerAt(i, j)) g.put(i, j);
  }
  return g;
}

/**
 * The grid as one SVG path in cell units: run-length spans per row,
 * merged down into rectangles where a span repeats on the next row, so a
 * solid shape costs one subpath. Every coordinate is a whole cell.
 */
function svg(g) {
  const open = new Map(); // "x,w" -> { x, y, w, h }
  const done = [];
  for (let j = 0; j <= g.rows; j++) {
    const spans = new Set();
    for (let i = 0; j < g.rows && i < g.cols;) {
      if (!g.on[j * g.cols + i]) { i++; continue; }
      const x = i;
      while (i < g.cols && g.on[j * g.cols + i]) i++;
      spans.add(`${x},${i - x}`);
    }
    for (const [k, r] of open) if (!spans.has(k)) { done.push(r); open.delete(k); }
    for (const k of spans) {
      if (open.has(k)) open.get(k).h++;
      else { const [x, w] = k.split(",").map(Number); open.set(k, { x, y: j, w, h: 1 }); }
    }
  }
  done.sort((a, b) => a.y - b.y || a.x - b.x);
  const d = done.map((r) => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.cols} ${g.rows}" shape-rendering="crispEdges"><path d="${d}"/></svg>`;
}

/** The SVG as a CSS url() value: only the characters CSS or a URL read
 *  specially are escaped, so the payload stays near the raw markup. */
const uri = (markup) => `url('data:image/svg+xml,${markup.replace(/%/g, "%25").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/'/g, "%27")}')`;

/** The eyebrow glyph's frame, in cells: its size, the cells the accent
 *  shape may fill (0 to accent - 1) and the cell its ink starts on. */
export const GLYPH = { cols: 9, rows: 6, accent: 6, ink: 7 };

/** The eyebrow glyphs, on one 9 × 6 frame: the accent shape fills cells
 *  0-5, cell 6 stays empty and the ink detail sits in cells 7-8, so the hand
 *  rule's gradient splits them at 6 cells for every glyph. `mark` is the
 *  default; the rest are its modifiers. The ink varies with the shape (a
 *  full bar, a short one, a dot), so no two glyphs read alike at 18 × 12px. */
export const GLYPHS = {
  mark: { accent: quarter(0, 6, 6, 1, -1), ink: rect(7, 0, 2, 6) },
  square: { accent: rect(0, 0, 6, 6), ink: rect(7, 4, 2, 2) },
  tri: { accent: (x, y) => rect(0, 0, 6, 6)(x, y) && x >= y, ink: rect(7, 0, 2, 6) },
  circle: { accent: circle(3, 3, 3), ink: rect(7, 1, 2, 4) },
  half: { accent: (x, y) => circle(3, 3, 3)(x, y % 3), ink: rect(7, 0, 2, 6) },
  stair: { accent: (x, y) => rect(0, 3, 6, 3)(x, y) || rect(3, 0, 3, 3)(x, y), ink: rect(7, 3, 2, 3) },
};

/** One eyebrow glyph's grid, both parts at the mark's full tones. */
export function glyph(name) {
  const g = grid(GLYPH.cols, GLYPH.rows), { accent, ink } = GLYPHS[name];
  shade(g, accent, TONES.mark.disc);
  return shade(g, ink, TONES.mark.bar);
}

/** The side of one form of the shapes rule, in cells: 18px. At 12px the
 *  owner found the forms too small (2026-11-11). */
export const SHAPE_CELLS = 9;

/** The shapes rule: a quarter disc, a square and a triangle, each whole and
 *  one form's side apart. The first sits in the accent; past the third the
 *  hand rule draws the hairline. Until 0.44 the strip was twelve forms, each
 *  later one dithered thinner, and its tail read as stray pixels. */
export function shapes() {
  const S = SHAPE_CELLS, g = grid(5 * S, S);
  for (const form of [quarter(0, S, S, 1, -1), rect(2 * S, 0, S, S), tri(4 * S, 0, S)]) shade(g, form, TONES.shapes);
  return g;
}

/** The weave: a 2/2 twill of 3-cell threads, in four bands of 36 cells at
 *  stepped tones. The tile repeats along the rule; the accent paints the
 *  first band once. */
function weave() {
  const g = grid(144, 12);
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    if (Math.floor((i + j) / 3) % 4 >= 2) continue;
    if (TONES.weave[Math.floor(i / 36) % 4] > bayerAt(i, j)) g.put(i, j);
  }
  return g;
}

/** The corner: three nested quarter discs on the top-right corner, fading
 *  to nothing through the matrix as they reach away from it. */
function corner() {
  const N = 51, g = grid(N, N);
  for (const [r, t] of [[N, 0.55], [N * 0.66, 0.85], [N * 0.33, 1]]) {
    shade(g, quarter(N, 0, r, -1, 1), (x, y) => t * Math.max(0, 1 - Math.hypot(N - x, y) / N) * 1.6);
  }
  return g;
}

/** The fields: tiles that repeat behind a section, one tone each. Every
 *  field draws on a grid of any extent from absolute cell coordinates, its
 *  hash seeded by the slot's place in the tile, so a shape that crossed the
 *  tile's edge would show in a wider draw and fail the seam test. `cells` is
 *  the tile's side, a multiple of the 8-cell Bayer period, so the matrix
 *  repeats with it. */
export const FIELDS = {
  truchet: { cells: 72, draw: truchet },
  grid: { cells: 72, draw: bauhausGrid },
  albers: { cells: 48, draw: albers },
  stripes: { cells: 48, draw: stripes },
};

/** The dissolves a field recedes through (0.44): a band that goes from
 *  empty to solid through the matrix, so every cell is on or off and none is
 *  grey. `in` is solid at its far end, `out` at its near end and `down` at
 *  its top; each repeats across on one Bayer period. */
export const DISSOLVE = { in: { cols: 120, rows: 8 }, out: { cols: 120, rows: 8 }, down: { cols: 8, rows: 72 } };

/** One dissolve's grid. The tone is the squared distance from the empty
 *  end, so the first third stays almost clear for the copy, and it passes 1
 *  just before the solid end. */
export function dissolve(name) {
  const { cols, rows } = DISSOLVE[name];
  const along = { in: (x) => x / cols, out: (x) => 1 - x / cols, down: (x, y) => 1 - y / rows }[name];
  return shade(grid(cols, rows), () => true, (x, y) => along(x, y) ** 2 * 1.05);
}

/** One field drawn on cols × rows cells: its tile by default. */
export const field = (name, cols = FIELDS[name].cells, rows = cols) => FIELDS[name].draw(grid(cols, rows));

/** The truchet: 6 × 6 slots of 12 cells, each a pair of quarter arcs on
 *  opposite corners, flipped by a hash. An arc is 2 cells wide. */
function truchet(g) {
  const T = 12, K = 6;
  for (let tj = 0; tj * T < g.rows; tj++) for (let ti = 0; ti * T < g.cols; ti++) {
    const x0 = ti * T, y0 = tj * T;
    const arcs = hash(ti % K, tj % K) > 0.5 ? [[x0, y0], [x0 + T, y0 + T]] : [[x0 + T, y0], [x0, y0 + T]];
    shade(g, (x, y) => rect(x0, y0, T, T)(x, y) && arcs.some(([cx, cy]) => Math.abs(Math.hypot(x - cx, y - cy) - T / 2) < 1.05), 1);
  }
  return g;
}

/** The Bauhaus grid: 6 × 6 slots of 12 cells, each holding one primitive of
 *  10 cells (a disc, a square, a triangle, a quarter disc, a square outline
 *  2 cells wide) or nothing, and turned a quarter at a time, both picked by
 *  a hash. The 1-cell margin round every primitive is the grid's gutter. */
function bauhausGrid(g) {
  const S = 12, K = 6;
  for (let tj = 0; tj * S < g.rows; tj++) for (let ti = 0; ti * S < g.cols; ti++) {
    const x = ti * S, y = tj * S, box = rect(x + 1, y + 1, 10, 10);
    const kind = Math.floor(hash((ti % K) + 11, (tj % K) + 5) * 6), turn = Math.floor(hash((tj % K) + 2, (ti % K) + 9) * 4);
    const [sx, sy] = [[1, 1], [-1, 1], [-1, -1], [1, -1]][turn];
    const form = [
      circle(x + 6, y + 6, 5),
      box,
      (px, py) => box(px, py) && (turn & 1 ? px - x >= py - y : px - x + (py - y) >= S),
      quarter(sx > 0 ? x + 1 : x + 11, sy > 0 ? y + 1 : y + 11, 10, sx, sy),
      (px, py) => box(px, py) && !rect(x + 3, y + 3, 6, 6)(px, py),
      null,
    ][kind];
    if (form) shade(g, form, 1);
  }
  return g;
}

/** The Albers tones, ground first: the nested squares step through the
 *  matrix toward a solid core. */
const ALBERS = [0, 0.25, 0.5, 1];

/** Homage to the Square: four nested squares on a 48-cell tile, each 12
 *  cells narrower than the last, centred across and set low (9 cells above,
 *  3 below, Albers' 3:1), at the ALBERS tones. The ground's margins make an
 *  even 12-cell gutter between repeats. */
function albers(g) {
  const N = 48;
  return shade(g, () => true, (x, y) => {
    const u = x % N, v = y % N;
    let k = 0;
    for (let s = 1; s < ALBERS.length; s++) if (u >= 6 * s && u < N - 6 * s && v >= 9 * s && v < N - 3 * s) k = s;
    return ALBERS[k];
  });
}

/** The stripes: a 45° band every 48 diagonal cells, its tone falling from
 *  solid to its faintest step in 8 steps of 3 cells through the matrix, then
 *  24 cells of ground. */
function stripes(g) {
  const N = 48;
  return shade(g, () => true, (x, y) => {
    const d = (Math.floor(x) + Math.floor(y)) % N;
    return d < 24 ? 1 - Math.floor(d / 3) / 8 : 0;
  });
}

/** The molnar strokes: one 5-cell stroke per slot, 1 cell wide, one of four
 *  directions, a few slots left empty. The tile repeats; its slots meet the
 *  void's. */
function molnar() {
  const n = STROKE_SLOTS, g = grid(n * PITCH, n * PITCH);
  const DIRS = [(k) => [k, 2], (k) => [2, k], (k) => [k, k], (k) => [4 - k, k]];
  for (let tj = 0; tj < n; tj++) for (let ti = 0; ti < n; ti++) {
    if (hash(ti, tj) < 0.08) continue;
    const dir = DIRS[Math.floor(hash(tj + 7, ti + 3) * 4)];
    for (let k = 0; k < 5; k++) { const [a, b] = dir(k); g.put(ti * PITCH + 1 + a, tj * PITCH + 1 + b); }
  }
  return g;
}

/** One void step: every slot inside a superellipse centred on the image
 *  erased, and past it an edge dithered slot by slot through the matrix,
 *  so no stroke is left inside the zone and none is cut in half. */
function voidStep(zone) {
  const { w, h } = voidImage(zone), g = grid(w, h);
  for (let tj = 0; tj * PITCH < h; tj++) for (let ti = 0; ti * PITCH < w; ti++) {
    const x = (ti + 0.5) * PITCH - w / 2, y = (tj + 0.5) * PITCH - h / 2;
    const d = (Math.abs((2 * x) / zone.w) ** 3 + Math.abs((2 * y) / zone.h) ** 3) ** (1 / 3);
    if (d - 1 >= bayerAt(ti, tj) * 0.25) continue;
    for (let b = 0; b < PITCH; b++) for (let a = 0; a < PITCH; a++) g.put(ti * PITCH + a, tj * PITCH + b);
  }
  return g;
}

/** The empty-state composition: an accent disc (cells 2-31), a square
 *  outline 2 cells wide (cells 33-56) and a dithered triangle inside it. */
function empty() {
  const g = grid(60, 36);
  shade(g, circle(17, 18, 15), TONES.empty.circle);
  shade(g, (x, y) => rect(33, 6, 24, 24)(x, y) && !rect(35, 8, 20, 20)(x, y), TONES.empty.square);
  return shade(g, tri(36, 9, 18), TONES.empty.triangle);
}

/* ── THE POSTERS AND THE HORIZONS (0.45, owner 2026-11-11) ───────────────
   Procedural pictures: packages/ui-kit/art-core.js draws each from shapes
   and a seed, and art.js draws any seed in the browser. What is written
   here is seed 0 of each, the picture a page shows with no JavaScript, as
   an indexed PNG from scripts/lib/png.mjs (the same bytes on every machine).
   A poster is a print on its own paper. A horizon has no paper: its clear
   cells are transparent, and its ink cells are a second image, a mask the
   page's own text colour paints. Until 0.45 the posters were four paintings
   by Kandinsky read from vendored bitmaps; the owner preferred the drawn
   prints. */

/** The width, in cells, of each horizon's static picture. The hills repeat
 *  as a tile (a whole number of Bayer periods); the dawn is one picture, and
 *  its strip continues the sea past its sides. */
export const HORIZON_TILE = { hills: 400, dawn: 480 };

const rgbOf = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const paletteOf = (picture) => picture.palette.map((hex) => (hex ? rgbOf(hex) : [0, 0, 0]));
/** A horizon picture's colour cells as a PNG: entry 0 and the ink are clear. */
const clearPng = (picture) => png(Uint8Array.from(picture.cells, (v) => (v === picture.ink ? 0 : v)), paletteOf(picture), picture.cols, picture.rows, true);

/** One poster, seed 0, as an indexed PNG of the frame. */
export function posterPng(name) {
  const picture = renderPoster(name);
  return png(picture.cells, paletteOf(picture), picture.cols, picture.rows);
}

/** One horizon's static picture, seed 0, as an indexed PNG with a clear ground. */
export const horizonPng = (name) => clearPng(renderHorizon(name, HORIZON_TILE[name]));

/** The ink of a horizon's static picture as a 1-bit mask, or null when the
 *  scene has no ink. */
export function horizonInkPng(name) {
  const picture = renderHorizon(name, HORIZON_TILE[name]);
  return picture.ink < 0 ? null : png(Uint8Array.from(picture.cells, (v) => (v === picture.ink ? 1 : 0)), [[0, 0, 0], [0, 0, 0]], picture.cols, picture.rows, true);
}

/** The strip a horizon continues with past its picture's sides, or null. */
export function horizonStripPng(name) {
  const picture = renderHorizonStrip(name);
  return picture && clearPng(picture);
}

/** The generated block, markers included: one :root rule of mask URIs,
 *  and each poster and horizon as PNG data URIs. */
export function block() {
  const masks = [
    ...Object.keys(GLYPHS).map((k) => [k === "mark" ? "mark" : `mark-${k}`, glyph(k)]),
    ["shapes", shapes()], ["weave", weave()], ["corner", corner()],
    ...Object.keys(FIELDS).map((k) => [k === "truchet" ? "truchet" : `field-${k}`, field(k)]),
    ...Object.keys(DISSOLVE).map((k) => [`dissolve-${k}`, dissolve(k)]),
    ["molnar", molnar()],
    ["void-s", voidStep(VOID.s)], ["void-m", voidStep(VOID.m)], ["void-l", voidStep(VOID.l)],
    ["empty", empty()],
  ];
  const lines = masks.map(([name, g]) => `  --sl-art-${name}: ${uri(svg(g))};`);
  const image = (name, bytes) => { if (bytes) lines.push(`  --sl-art-${name}: url('data:image/png;base64,${Buffer.from(bytes).toString("base64")}');`); };
  for (const k of Object.keys(POSTERS)) image(`poster-${k}`, posterPng(k));
  for (const k of Object.keys(HORIZONS)) {
    image(`horizon-${k}`, horizonPng(k));
    image(`horizon-${k}-ink`, horizonInkPng(k));
    image(`horizon-${k}-strip`, horizonStripPng(k));
  }
  return `${START}\n/* GENERATED by scripts/gen-art.mjs from dither-core.js -- do not edit. Run \`npm run gen:art\`. */\n:root {\n${lines.join("\n")}\n}\n${END}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const css = readFileSync(CSS_PATH, "utf8");
  const a = css.indexOf(START), b = css.indexOf(END);
  if (a < 0 || b < a) { console.error(`gen-art: ${START} … ${END} not found in components.css`); process.exit(1); }
  const next = css.slice(0, a) + block() + css.slice(b + END.length);
  if (process.argv.includes("--check")) {
    if (next !== css) { console.error("gen-art: components.css is stale. Run `npm run gen:art`."); process.exit(1); }
  } else if (next !== css) writeFileSync(CSS_PATH, next);
}
