/* The Bauhaus pixel art (ui-kit 0.41.0): every piece drawn on the dither
   cell and shaded through the kit's Bayer matrix, written into
   components.css as SVG data URIs between the two markers below. Ported
   from the probe lab/art-bauhaus.html. A mask carries alpha only (the SVG
   default black fill); the colour is painted by the hand rules from role
   vars, so a mask can never carry a theme.

     node scripts/gen-art.mjs           rewrite the generated block
     node scripts/gen-art.mjs --check   exit 1 when the committed block differs */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { bayerAt } from "../packages/ui-kit/dither-core.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(HERE, "../packages/ui-kit/components.css");
export const START = "/* @gen-art:start */";
export const END = "/* @gen-art:end */";

/** The molnar stroke field: one stroke per PITCH × PITCH cell slot. */
export const PITCH = 5;
/** The molnar stroke tile, in slots (it repeats). */
const STROKE_SLOTS = 12;
/** The molnar void's three steps, in cells: the fully erased zone each
 *  step clears from the box's top-left corner. A step serves boxes narrower
 *  than its own zone, so the zone spans the message's whole line: S below
 *  S's width, M from S's width, L from M's width. Multiples of PITCH, so the
 *  void erases whole strokes. A narrow box wraps the message onto more
 *  lines, so the narrower zones are the taller ones. */
export const VOID = { s: { w: 100, h: 50 }, m: { w: 140, h: 45 }, l: { w: 200, h: 40 } };
/** The void image of one step, in cells: the zone plus the reach of its
 *  dithered edge (a quarter of the zone), rounded up to whole slots. */
export const voidImage = ({ w, h }) => ({ w: Math.ceil((w * 1.25) / PITCH) * PITCH, h: Math.ceil((h * 1.25) / PITCH) * PITCH });

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

/** The eyebrow mark: an accent quarter disc (cells 0-3) and a bar (cell 5). */
function mark() {
  const g = grid(6, 4);
  shade(g, quarter(0, 4, 4, 1, -1), 1);
  return shade(g, rect(5, 0, 1, 4), 1);
}

/** The shapes rule: quarter disc, square, triangle every 8 cells, the first
 *  in the accent (cells 0-3), the rest fading out along the strip. */
function shapes() {
  const cols = 96, g = grid(cols, 4);
  for (let k = 0; k * 8 < cols; k++) {
    const x = k * 8, tone = k === 0 ? 1 : 1 - (x / cols) * 0.8;
    const form = [quarter(x, 4, 4, 1, -1), rect(x, 0, 4, 4), tri(x, 0, 4)][k % 3];
    shade(g, form, tone);
  }
  return g;
}

/** The weave: a 2/2 twill, in four bands of 24 cells at stepped tones. The
 *  tile repeats along the rule; the accent paints the first band once. */
function weave() {
  const g = grid(96, 8);
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    if (((i + j) >> 1) % 4 >= 2) continue;
    if ([0.75, 0.45, 0.2, 0.45][Math.floor(i / 24) % 4] > bayerAt(i, j)) g.put(i, j);
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

/** The truchet field: 6 × 6 tiles of 8 cells, each a pair of quarter arcs
 *  on opposite corners, flipped by a hash. The tile repeats. */
function truchet() {
  const T = 8, K = 6, g = grid(T * K, T * K);
  for (let tj = 0; tj < K; tj++) for (let ti = 0; ti < K; ti++) {
    const x0 = ti * T, y0 = tj * T;
    const arcs = hash(ti, tj) > 0.5 ? [[x0, y0], [x0 + T, y0 + T]] : [[x0 + T, y0], [x0, y0 + T]];
    shade(g, (x, y) => rect(x0, y0, T, T)(x, y) && arcs.some(([cx, cy]) => Math.abs(Math.hypot(x - cx, y - cy) - T / 2) < 0.75), 1);
  }
  return g;
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

/** One void step: every slot inside a quarter superellipse on the top-left
 *  corner erased, and past it an edge dithered slot by slot through the
 *  matrix, so no stroke is left inside the zone and none is cut in half. */
function voidStep(zone) {
  const { w, h } = voidImage(zone), g = grid(w, h);
  for (let tj = 0; tj * PITCH < h; tj++) for (let ti = 0; ti * PITCH < w; ti++) {
    const x = (ti + 0.5) * PITCH, y = (tj + 0.5) * PITCH;
    const d = ((x / zone.w) ** 4 + (y / zone.h) ** 4) ** 0.25;
    if (d - 1 >= bayerAt(ti, tj) * 0.25) continue;
    for (let b = 0; b < PITCH; b++) for (let a = 0; a < PITCH; a++) g.put(ti * PITCH + a, tj * PITCH + b);
  }
  return g;
}

/** The empty-state composition: an accent disc (cells 1-20), a square
 *  outline (cells 22-37) and a dithered triangle inside it. */
function empty() {
  const g = grid(40, 24);
  shade(g, circle(11, 12, 10), 1);
  shade(g, (x, y) => rect(22, 4, 16, 16)(x, y) && !rect(23, 5, 14, 14)(x, y), 1);
  return shade(g, tri(24, 6, 12), 0.5);
}

/** The generated block, markers included: one :root rule of mask URIs. */
export function block() {
  const masks = [
    ["mark", mark()], ["shapes", shapes()], ["weave", weave()], ["corner", corner()],
    ["truchet", truchet()], ["molnar", molnar()],
    ["void-s", voidStep(VOID.s)], ["void-m", voidStep(VOID.m)], ["void-l", voidStep(VOID.l)],
    ["empty", empty()],
  ];
  const lines = masks.map(([name, g]) => `  --sl-art-${name}: ${uri(svg(g))};`);
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
