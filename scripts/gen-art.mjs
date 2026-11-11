/* The Bauhaus pixel art (ui-kit 0.41.0, 0.42.0): every piece drawn on the
   dither cell and shaded through the kit's Bayer matrix, written into
   components.css as SVG data URIs between the two markers below. Ported
   from the probe lab/art-bauhaus.html. A mask carries alpha only (the SVG
   default black fill); the colour is painted by the hand rules from role
   vars, so a mask can never carry a theme. The posters (0.44) are the
   exception: an 8-bit colour image and an ink mask each, see POSTERS.

     node scripts/gen-art.mjs           rewrite the generated block
     node scripts/gen-art.mjs --check   exit 1 when the committed block differs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CELL_PX, bayerAt } from "../packages/ui-kit/dither-core.js";
import { png } from "./lib/png.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(HERE, "../packages/ui-kit/components.css");
const SOURCES = resolve(HERE, "art-sources");
export const START = "/* @gen-art:start */";
export const END = "/* @gen-art:end */";

/** The molnar stroke field: one stroke per PITCH × PITCH cell slot. */
export const PITCH = 5;
/** The molnar stroke tile, in slots (it repeats). */
const STROKE_SLOTS = 12;
/** The molnar void's three steps, in cells: the fully erased zone, a
 *  superellipse centred on the box, so strokes surround the message on all
 *  four sides. The container query picks a step by the box's width
 *  (voidThreshold). A narrow box wraps the message onto more lines, so the
 *  narrowest zone is the tallest. */
export const VOID = { s: { w: 70, h: 50 }, m: { w: 95, h: 40 }, l: { w: 120, h: 40 } };
/** The void image of one step, in cells: the zone plus the reach of its
 *  dithered edge (a quarter of the zone), rounded up to an EVEN number of
 *  slots. Centred like the stroke tile (60 cells, 6 slots each side of its
 *  centre), it then starts and ends on a slot boundary, so it erases whole
 *  strokes. */
export const voidImage = ({ w, h }) => ({ w: Math.ceil((w * 1.25) / (2 * PITCH)) * 2 * PITCH, h: Math.ceil((h * 1.25) / (2 * PITCH)) * 2 * PITCH });
/** The box width, in px, from which a step applies: its image plus one
 *  stroke column on each side, so strokes always frame the void. */
export const voidThreshold = (zone) => (voidImage(zone).w + 2 * PITCH) * CELL_PX;
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

/** The eyebrow glyphs, on one 6 × 4 frame: the accent shape fills cells
 *  0-3, cell 4 stays empty and the ink detail sits in cell 5, so the hand
 *  rule's gradient splits them at 4 cells for every glyph. `mark` is the
 *  default; the rest are its modifiers. The ink varies with the shape (a
 *  full bar, a short one, a dot), so no two glyphs read alike at 18 × 12px. */
export const GLYPHS = {
  mark: { accent: quarter(0, 4, 4, 1, -1), ink: rect(5, 0, 1, 4) },
  square: { accent: rect(0, 0, 4, 4), ink: rect(5, 3, 1, 1) },
  tri: { accent: (x, y) => rect(0, 0, 4, 4)(x, y) && x >= y, ink: rect(5, 0, 1, 4) },
  circle: { accent: circle(2, 2, 2), ink: rect(5, 1, 1, 2) },
  half: { accent: (x, y) => circle(2, 2, 2)(x, y % 2), ink: rect(5, 0, 1, 4) },
  stair: { accent: (x, y) => rect(0, 2, 4, 2)(x, y) || rect(2, 0, 2, 2)(x, y), ink: rect(5, 2, 1, 2) },
};

/** One eyebrow glyph's grid, both parts at the mark's full tones. */
export function glyph(name) {
  const g = grid(6, 4), { accent, ink } = GLYPHS[name];
  shade(g, accent, TONES.mark.disc);
  return shade(g, ink, TONES.mark.bar);
}

/** The side of one form of the shapes rule, in cells: 18px. At 4 cells
 *  (12px) the owner found the forms too small (2026-11-11). */
export const SHAPE_CELLS = 6;

/** The shapes rule: a quarter disc, a square and a triangle, each whole and
 *  one form's side apart. The first sits in the accent; past the third the
 *  hand rule draws the hairline. Until 0.44 the strip was twelve forms, each
 *  later one dithered thinner, and its tail read as stray pixels. */
export function shapes() {
  const S = SHAPE_CELLS, g = grid(5 * S, S);
  for (const form of [quarter(0, S, S, 1, -1), rect(2 * S, 0, S, S), tri(4 * S, 0, S)]) shade(g, form, TONES.shapes);
  return g;
}

/** The weave: a 2/2 twill, in four bands of 24 cells at stepped tones. The
 *  tile repeats along the rule; the accent paints the first band once. */
function weave() {
  const g = grid(96, 8);
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    if (((i + j) >> 1) % 4 >= 2) continue;
    if (TONES.weave[Math.floor(i / 24) % 4] > bayerAt(i, j)) g.put(i, j);
  }
  return g;
}

/** The corner: three nested quarter discs on the top-right corner, fading
 *  to nothing through the matrix as they reach away from it. */
function corner() {
  const N = 34, g = grid(N, N);
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
  truchet: { cells: 48, draw: truchet },
  grid: { cells: 48, draw: bauhausGrid },
  albers: { cells: 32, draw: albers },
  stripes: { cells: 32, draw: stripes },
};

/** The dissolves a field recedes through (0.44): a band that goes from
 *  empty to solid through the matrix, so every cell is on or off and none is
 *  grey. `in` is solid at its far end, `out` at its near end and `down` at
 *  its top; each repeats across on one Bayer period. */
export const DISSOLVE = { in: { cols: 80, rows: 8 }, out: { cols: 80, rows: 8 }, down: { cols: 8, rows: 48 } };

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

/** The truchet: 6 × 6 slots of 8 cells, each a pair of quarter arcs on
 *  opposite corners, flipped by a hash. */
function truchet(g) {
  const T = 8, K = 6;
  for (let tj = 0; tj * T < g.rows; tj++) for (let ti = 0; ti * T < g.cols; ti++) {
    const x0 = ti * T, y0 = tj * T;
    const arcs = hash(ti % K, tj % K) > 0.5 ? [[x0, y0], [x0 + T, y0 + T]] : [[x0 + T, y0], [x0, y0 + T]];
    shade(g, (x, y) => rect(x0, y0, T, T)(x, y) && arcs.some(([cx, cy]) => Math.abs(Math.hypot(x - cx, y - cy) - T / 2) < 0.75), 1);
  }
  return g;
}

/** The Bauhaus grid: 6 × 6 slots of 8 cells, each holding one primitive of
 *  6 cells (a disc, a square, a triangle, a quarter disc, a square outline)
 *  or nothing, and turned a quarter at a time, both picked by a hash. The
 *  1-cell margin round every primitive is the grid's gutter. */
function bauhausGrid(g) {
  const S = 8, K = 6;
  for (let tj = 0; tj * S < g.rows; tj++) for (let ti = 0; ti * S < g.cols; ti++) {
    const x = ti * S, y = tj * S, box = rect(x + 1, y + 1, 6, 6);
    const kind = Math.floor(hash((ti % K) + 11, (tj % K) + 5) * 6), turn = Math.floor(hash((tj % K) + 2, (ti % K) + 9) * 4);
    const [sx, sy] = [[1, 1], [-1, 1], [-1, -1], [1, -1]][turn];
    const form = [
      circle(x + 4, y + 4, 3),
      box,
      (px, py) => box(px, py) && (turn & 1 ? px - x >= py - y : px - x + (py - y) >= S),
      quarter(sx > 0 ? x + 1 : x + 7, sy > 0 ? y + 1 : y + 7, 6, sx, sy),
      (px, py) => box(px, py) && !rect(x + 2, y + 2, 4, 4)(px, py),
      null,
    ][kind];
    if (form) shade(g, form, 1);
  }
  return g;
}

/** The Albers tones, ground first: the nested squares step through the
 *  matrix toward a solid core. */
const ALBERS = [0, 0.25, 0.5, 1];

/** Homage to the Square: four nested squares on a 32-cell tile, each 8
 *  cells narrower than the last, centred across and set low (6 cells above,
 *  2 below, Albers' 3:1), at the ALBERS tones. The ground's margins make an
 *  even 8-cell gutter between repeats. */
function albers(g) {
  const N = 32;
  return shade(g, () => true, (x, y) => {
    const u = x % N, v = y % N;
    let k = 0;
    for (let s = 1; s < ALBERS.length; s++) if (u >= 4 * s && u < N - 4 * s && v >= 6 * s && v < N - 2 * s) k = s;
    return ALBERS[k];
  });
}

/** The stripes: a 45° band every 32 diagonal cells, its tone falling from
 *  solid to its faintest step in 8 steps of 2 cells through the matrix, then 16 cells
 *  of ground. */
function stripes(g) {
  const N = 32;
  return shade(g, () => true, (x, y) => {
    const d = (Math.floor(x) + Math.floor(y)) % N;
    return d < 16 ? 1 - Math.floor(d / 2) / 8 : 0;
  });
}

/** The molnar strokes: one 3-cell stroke per slot, one of four directions,
 *  a few slots left empty. The tile repeats; its slots meet the void's. */
function molnar() {
  const n = STROKE_SLOTS, g = grid(n * PITCH, n * PITCH);
  const DIRS = [[[0, 1], [1, 1], [2, 1]], [[1, 0], [1, 1], [1, 2]], [[0, 0], [1, 1], [2, 2]], [[2, 0], [1, 1], [0, 2]]];
  for (let tj = 0; tj < n; tj++) for (let ti = 0; ti < n; ti++) {
    if (hash(ti, tj) < 0.08) continue;
    for (const [a, b] of DIRS[Math.floor(hash(tj + 7, ti + 3) * 4)]) g.put(ti * PITCH + 1 + a, tj * PITCH + 1 + b);
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

/** The empty-state composition: an accent disc (cells 1-20), a square
 *  outline (cells 22-37) and a dithered triangle inside it. */
function empty() {
  const g = grid(40, 24);
  shade(g, circle(11, 12, 10), TONES.empty.circle);
  shade(g, (x, y) => rect(22, 4, 16, 16)(x, y) && !rect(23, 5, 14, 14)(x, y), TONES.empty.square);
  return shade(g, tri(24, 6, 12), TONES.empty.triangle);
}

/* ── THE POSTERS (0.44, owner 2026-11-11) ────────────────────────────────
   Four paintings by Wassily Kandinsky from his Bauhaus years, each made a
   mark that blends into the page: the painting's own ground is transparent,
   so the page shows through, and the edges dissolve, so the piece has no
   frame. A form keeps its colour, which is why a poster is the art's
   exception to two rules: its cell is 2px at the design size (126 cells
   across 252px), and its colours are a fixed house palette. Every cell is
   still on or off.

   The pipeline, per poster:
     1. the vendored source (scripts/art-sources/<source>.bmp), already
        cropped to the frame and reduced to one pixel per cell;
     2. the ground: the median colour of a border three cells deep. A cell
        is part of a form by its distance from that colour in OKLab; a
        narrow band at a form's rim dithers, the rest is solid;
     3. the dissolve: nothing on the frame's border, everything 16 cells in
        (12 from the top and the bottom), through the Bayer matrix;
     4. the colour: a cell's colour is graded, then it takes ONE palette
        entry. The two entries that best bracket it are found in OKLab, and
        the matrix picks between them;
     5. two outputs. The colour cells are an indexed PNG with a transparent
        ground, from scripts/lib/png.mjs (the same bytes on every machine).
        The cells of the darkest entry are not in it: they are a mask the
        page's own text colour paints, so a black line is dark on a light
        ground and light on a dark one. */

/** The poster frame, in cells: a golden rectangle (126 / 78 = 1.615). */
export const POSTER_COLS = 126, POSTER_ROWS = 78;

/** The house palette of every poster: a cream, pastels, vivid inks. */
export const PRINT_PALETTE = ["#FBEBD8", "#FFFFFF", "#FFC9A8", "#FF8FA3", "#FF5A36", "#FFC93C", "#9FE3C4", "#58E6B5", "#BFD4FF", "#B8A9FF", "#3D6BFF", "#2743B8"];
/** What a dark cell is matched against. It is never painted: the cells
 *  that land on it are the ink mask. POSTER_INK is their cell value. */
const DARK = "#1E1B3A";
export const POSTER_INK = PRINT_PALETTE.length;

/** The posters: the vendored source of each and the painting it is. `cut`
 *  is how far from the ground a cell must be to count as a form, as a share
 *  of the painting's own range; a painting with a soft coloured ground
 *  needs a higher one, or it keeps a haze. */
export const POSTERS = {
  composition: { source: "comp8", title: "Composition 8", year: 1923, cut: 0.1 },
  circles: { source: "circles", title: "Several Circles", year: 1926, cut: 0.1 },
  primary: { source: "yrb", title: "Yellow-Red-Blue", year: 1925, cut: 0.36 },
  orbit: { source: "incircle", title: "Circles in a Circle", year: 1923, cut: 0.1 },
};

const rgbOf = (hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16));
const toLinear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** sRGB bytes as OKLab, where a distance is close to a seen difference. */
function oklab([r, g, b]) {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/** A vendored source: a 24-bit BMP of the frame's size, as RGB rows from
 *  the top. A BMP stores its rows bottom-up, padded to 4 bytes, in BGR. */
function source(name) {
  const file = readFileSync(resolve(SOURCES, `${name}.bmp`)), at = file.readUInt32LE(10), w = file.readInt32LE(18), h = file.readInt32LE(22);
  if (w !== POSTER_COLS || h !== POSTER_ROWS || file.readUInt16LE(28) !== 24) throw new Error(`gen-art: ${name}.bmp is not ${POSTER_COLS} × ${POSTER_ROWS} at 24 bits`);
  const row = Math.ceil((w * 3) / 4) * 4, rgb = new Uint8Array(w * h * 3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) for (let c = 0; c < 3; c++) rgb[(j * w + i) * 3 + c] = file[at + (h - 1 - j) * row + i * 3 + 2 - c];
  return rgb;
}

const GRADE = { contrast: 1.15, chroma: 1.4 };
/** How deep the dissolve is, in cells, from the sides and from the top and
 *  the bottom; and the share of a painting's cells taken as its range. */
const DISSOLVE_IN = { x: 16, y: 12 }, RANGE = 0.97, RIM = 0.14;
const cellsOf = new Map();

/**
 * One poster as a value per cell: -1 where the page shows, 0..11 a palette
 * entry, POSTER_INK where the page's text colour paints. See the pipeline
 * above.
 * @param {string} name a key of POSTERS @returns {Int8Array}
 */
export function posterCells(name) {
  if (cellsOf.has(name)) return cellsOf.get(name);
  const src = source(POSTERS[name].source), n = POSTER_COLS * POSTER_ROWS;
  const lab = Array.from({ length: n }, (_, k) => oklab([src[k * 3], src[k * 3 + 1], src[k * 3 + 2]]));
  const border = lab.filter((_, k) => { const i = k % POSTER_COLS, j = Math.floor(k / POSTER_COLS); return i < 3 || j < 3 || i >= POSTER_COLS - 3 || j >= POSTER_ROWS - 3; });
  const ground = [0, 1, 2].map((c) => border.map((v) => v[c]).sort((a, b) => a - b)[border.length >> 1]);
  const far = lab.map((v) => Math.hypot(v[0] - ground[0], v[1] - ground[1], v[2] - ground[2]));
  const range = far.slice().sort((a, b) => a - b)[Math.floor(n * RANGE)];
  const pal = [...PRINT_PALETTE, DARK].map(rgbOf).map(oklab), out = new Int8Array(n).fill(-1);
  for (let j = 0; j < POSTER_ROWS; j++) for (let i = 0; i < POSTER_COLS; i++) {
    const k = j * POSTER_COLS + i;
    const form = Math.min(1, Math.max(0, (far[k] / range - POSTERS[name].cut) / RIM));
    const fade = Math.min(1, Math.min(i, POSTER_COLS - 1 - i) / DISSOLVE_IN.x, Math.min(j, POSTER_ROWS - 1 - j) / DISSOLVE_IN.y);
    if (form * fade ** 0.8 <= bayerAt(i, j)) continue;
    const grey = 0.299 * src[k * 3] + 0.587 * src[k * 3 + 1] + 0.114 * src[k * 3 + 2];
    const c = oklab([0, 1, 2].map((ch) => Math.min(255, Math.max(0, (grey + (src[k * 3 + ch] - grey) * GRADE.chroma - 128) * GRADE.contrast + 128))));
    // Among all pairs of entries, the one whose segment passes nearest the
    // cell; a long segment pays a little, so two near colours are preferred.
    let best = null;
    for (let a = 0; a < pal.length; a++) for (let b = a; b < pal.length; b++) {
      const A = pal[a], d = [pal[b][0] - A[0], pal[b][1] - A[1], pal[b][2] - A[2]], len = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
      const t = len ? Math.min(1, Math.max(0, ((c[0] - A[0]) * d[0] + (c[1] - A[1]) * d[1] + (c[2] - A[2]) * d[2]) / len)) : 0;
      const miss = (c[0] - A[0] - t * d[0]) ** 2 + (c[1] - A[1] - t * d[1]) ** 2 + (c[2] - A[2] - t * d[2]) ** 2 + len * 0.08;
      if (!best || miss < best.miss) best = { miss, a, b, t };
    }
    out[k] = best.t > bayerAt(i, j) ? best.b : best.a;
  }
  cellsOf.set(name, out);
  return out;
}

/** One poster's colour cells as an indexed PNG: entry 0 is the transparent
 *  ground, then the house palette. An ink cell is transparent here. */
export function posterPng(name) {
  const cells = posterCells(name);
  return png(Uint8Array.from(cells, (v) => (v < 0 || v === POSTER_INK ? 0 : v + 1)), [[0, 0, 0], ...PRINT_PALETTE.map(rgbOf)], POSTER_COLS, POSTER_ROWS, true);
}

/** One poster's ink cells as a mask for the page's text colour: a 1-bit
 *  PNG, opaque where the ink is. As an SVG path its scattered cells cost
 *  about 7 KB a poster; as an image, a few hundred bytes. */
export function posterInkPng(name) {
  return png(Uint8Array.from(posterCells(name), (v) => (v === POSTER_INK ? 1 : 0)), [[0, 0, 0], [0, 0, 0]], POSTER_COLS, POSTER_ROWS, true);
}

/** The generated block, markers included: one :root rule of mask URIs,
 *  and each poster as a PNG data URI with the mask of its ink. */
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
  for (const k of Object.keys(POSTERS)) {
    lines.push(`  --sl-art-poster-${k}: url('data:image/png;base64,${Buffer.from(posterPng(k)).toString("base64")}');`);
    lines.push(`  --sl-art-poster-${k}-ink: url('data:image/png;base64,${Buffer.from(posterInkPng(k)).toString("base64")}');`);
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
