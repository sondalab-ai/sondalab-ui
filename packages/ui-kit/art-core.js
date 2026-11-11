/* @sondalab/ui-kit — art-core.js
   The procedural art: the four posters and the two horizons, each drawn from
   shapes and a seed onto a grid of cells, through the kit's Bayer matrix
   (dither-core.js). Pure maths: no DOM, runs in Node. scripts/gen-art.mjs
   renders seed 0 of each into components.css (the picture a page shows with
   no JavaScript); art.js renders any seed in the browser.

   A picture is `{ cols, rows, cells, palette, ink }`: `cells` holds one
   palette index per cell; index 0 is the print's paper on a poster and the
   clear page on a horizon; `ink` is the index the page's own text colour
   paints (-1 when the picture has none).

   COLOUR: the palettes below are the art's own fixed house colours (owner,
   2026-11-11). They follow no theme and no product; only the ink does. */

import { bayerAt } from "./dither-core.js";

/** The art's cell, in CSS px. The dither hover keeps its own 3px cell. */
export const ART_CELL_PX = 2;
/** The poster frame, in cells: a golden rectangle (126 / 78 = 1.615). */
export const POSTER_COLS = 126, POSTER_ROWS = 78;
/** A horizon's height, in cells (200px), and the rows from its top through
 *  which it dissolves into the page (44 rows, 88px). */
export const HORIZON_ROWS = 100;
const HORIZON_FADE = 44;

const hash = (i, j) => { let h = (i * 374761393 + j * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/* ── shapes: a predicate over a cell's centre, with the box it can fill ── */
const ALL = [-Infinity, -Infinity, Infinity, Infinity];
const shape = (f, box = ALL) => { f.box = box; return f; };
const boxOf = (f) => f.box ?? ALL;
const disc = (cx, cy, r) => shape((x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, [cx - r, cy - r, cx + r, cy + r]);
const ring = (cx, cy, r, w) => shape((x, y) => { const d = Math.hypot(x - cx, y - cy); return d <= r && d > r - w; }, [cx - r, cy - r, cx + r, cy + r]);
const rect = (x0, y0, w, h) => shape((x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h, [x0, y0, x0 + w, y0 + h]);
const and = (...f) => shape((x, y) => f.every((p) => p(x, y)), f.map(boxOf).reduce((a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]));
const or = (...f) => shape((x, y) => f.some((p) => p(x, y)), f.map(boxOf).reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]));
/** A disc whose radius breathes with the angle: a pebble, not a circle. */
const blob = (cx, cy, r, s = 0, a = 0.09, b = 0.05) => shape((x, y) => {
  const t = Math.atan2(y - cy, x - cx);
  return Math.hypot(x - cx, y - cy) <= r * (1 + a * Math.sin(2 * t + s) + b * Math.sin(3 * t + 2.1 * s));
}, [cx - r * (1 + a + b), cy - r * (1 + a + b), cx + r * (1 + a + b), cy + r * (1 + a + b)]);
/** A dome: everything under a parabola with its top at (cx, top), down to `bottom`. */
const hill = (cx, top, w, drop, bottom) => { const half = w * Math.sqrt(Math.max(0, bottom - top) / drop); return shape((x, y) => y >= top + ((x - cx) / w) ** 2 * drop, [cx - half, top, cx + half, bottom]); };
/** A ring on an ellipse turned by `phi`; `half` keeps its near (+1) or far (-1) side. */
const orbit = (cx, cy, a, b, phi, w, half = 0) => {
  const c = Math.cos(phi), s = Math.sin(phi);
  return shape((x, y) => {
    const u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c;
    if (half && v * half < 0) return false;
    return Math.abs(Math.hypot(u / a, v / b) - 1) * Math.min(a, b) < (w / 2) * (1 + 0.2 * Math.abs(u / a));
  }, [cx - a * (1 + (0.6 * w) / Math.min(a, b)) - 1, cy - a * (1 + (0.6 * w) / Math.min(a, b)) - 1, cx + a * (1 + (0.6 * w) / Math.min(a, b)) + 1, cy + a * (1 + (0.6 * w) / Math.min(a, b)) + 1]);
};
/** A leaf: two arcs that meet in a point at each end, turned by `phi`. */
const leaf = (cx, cy, len, wid, phi) => {
  const c = Math.cos(phi), s = Math.sin(phi);
  return shape((x, y) => { const u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c; return Math.abs(u) <= len && Math.abs(v) <= wid * (1 - (u / len) ** 2); }, [cx - len - wid, cy - len - wid, cx + len + wid, cy + len + wid]);
};
const stemX = (x0, y0, sway, period, y) => x0 + sway * Math.sin((y0 - y) / period);
/** A stem: a band 2 cells wide that sways as it climbs from (x0, y0) to y1. */
const stem = (x0, y0, y1, sway, period) => shape((x, y) => y <= y0 && y >= y1 && Math.abs(x - stemX(x0, y0, sway, period, y)) <= 1, [x0 - Math.abs(sway) - 1, y1, x0 + Math.abs(sway) + 1, y0]);
/** A soft cloud: three discs on a flat base. */
const cloud = (cx, cy, k) => and(or(disc(cx, cy, 4 * k), disc(cx + 5 * k, cy - 1.5 * k, 5 * k), disc(cx + 11 * k, cy, 4 * k), rect(cx - 2 * k, cy, 15 * k, 3 * k)), shape((x, y) => y < cy + 3 * k));
/** A four-point sparkle, 5 cells across. */
const sparkle = (x, y) => or(rect(x - 2.5, y - 0.5, 5, 1), rect(x - 0.5, y - 2.5, 1, 5));

/**
 * A grid of palette indices and its `put(colour, inside, tone, over)`: sets
 * every cell whose centre is inside the shape and whose tone (0..1, or a
 * function of the centre) beats the Bayer threshold. A later form stands in
 * front; `over` maps the index under it to the one the two inks make together.
 * A shape's box only saves work: with `clip` false every cell is tested, and
 * the picture must be the same (scripts/art.test.mjs).
 */
function sheet(cols, rows, clip = true) {
  const cells = new Uint8Array(cols * rows);
  const put = (c, inside, tone = 1, over = null) => {
    const b = clip ? boxOf(inside) : ALL;
    const i0 = Math.max(0, Math.floor(b[0])), i1 = Math.min(cols, Math.ceil(b[2])), j0 = Math.max(0, Math.floor(b[1])), j1 = Math.min(rows, Math.ceil(b[3]));
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const x = i + 0.5, y = j + 0.5;
      if (!inside(x, y)) continue;
      const t = typeof tone === "function" ? tone(x, y) : tone;
      if (t <= bayerAt(i, j)) continue;
      const k = j * cols + i, under = cells[k];
      cells[k] = over && over[under] !== undefined ? over[under] : c;
    }
  };
  return { cells, put };
}

/** A seeded generator (mulberry32): the same seed gives the same numbers on
 *  every machine. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** What a scene varies by: `pick(lo, hi, canon)` is `canon` at seed 0 and a
 *  seeded value in lo..hi otherwise; `h` is the cell hash, moved by the seed. */
function vary(seed) {
  const r = rng(seed);
  return { pick: (lo, hi, canon) => (seed ? lo + (hi - lo) * r() : canon), h: (i, j) => hash(i + seed * 131, j + seed * 71) };
}

/** A plant: a swaying stem in `ink`, leaves in pairs, a bud in `bud`. */
function plant(put, x0, y0, y1, sway, period, bud, ink) {
  put(ink, stem(x0, y0, y1, sway, period));
  for (let y = y0 - 7; y > y1 + 4; y -= 8) {
    const x = stemX(x0, y0, sway, period, y);
    for (const side of [-1, 1]) put(ink, leaf(x + side * 4.9, y - 2.8, 5.2, 2.1, side * -0.58));
  }
  put(bud, disc(stemX(x0, y0, sway, period, y1), y1 - 2, 3.4));
}

/** The sea under a horizon line: flat, deepening through the matrix. */
const sea = (put, W, H, HZ, flat, deep) => { put(flat, rect(0, HZ, W, H - HZ)); put(deep, rect(0, HZ, W, H - HZ), (x, y) => 0.75 * ((y - HZ) / (H - HZ)) ** 1.6); };
/** Short wavelets on the sea, on rows a hash spaces, away from `keep`. */
const wavelets = (put, c, W, H, HZ, v, keep) => put(c, shape((x, y) => {
  const r = Math.floor((y - HZ - 4) / 4), at = HZ + 4 + r * 4 + Math.floor(v.h(r, 5) * 3);
  if (r < 0 || Math.floor(y) !== at || keep(x)) return false;
  const u = x + v.h(r, 9) * 11, slot = Math.floor(u / 9);
  return v.h(slot, r + 17) > 0.45 && u - slot * 9 < 2 + 5 * v.h(slot, r + 31);
}, [0, HZ + 4, W, H]), (x, y) => 1 - (y - HZ) / (H - HZ) * 0.7);

/** The posters: a print on its own paper, `palette[0]`. */
export const POSTERS = {
  dawn: {
    //         paper      pink       yellow     sun        sea        mint       ink        deep sea
    palette: ["#FBEBD8", "#FF8FA3", "#FFD166", "#FF5A36", "#4F52D9", "#5FE0BD", "#1E1B3A", "#3A3CB8"],
    draw(put, W, H, v) {
      const HZ = 50, sx = v.pick(36, 58, 44), f1 = v.pick(0, 6.28, 0.6), f2 = v.pick(0, 6.28, 2), f3 = v.pick(0, 6.28, 3.4);
      const d = (x, y) => Math.hypot(x - sx, y - HZ), sky = rect(0, 0, W, HZ);
      put(1, sky, (x, y) => 0.85 * Math.max(0, 1 - (d(x, y) - 26) / 56) ** 1.3);
      put(2, sky, (x, y) => 1.05 * Math.max(0, 1 - (d(x, y) - 24) / 20));
      put(0, cloud(v.pick(74, 96, 84), v.pick(10, 20, 15), 1));
      put(0, cloud(v.pick(6, 20, 12), v.pick(20, 28, 24), 0.7));
      const far = (x) => (9 + 8 * Math.sin(x / 13 + f1) + 4 * Math.sin(x / 5.1 + f2)) * Math.min(1, Math.max(0, (x - 66) / 16));
      const near = (x) => (5 + 5 * Math.sin(x / 9 + f3) + 2 * Math.sin(x / 3.7)) * Math.min(1, Math.max(0, (x - 86) / 12));
      const range = and(sky, shape((x, y) => y >= HZ - far(x)));
      put(5, range);
      put(6, range, (x) => 0.32 * Math.max(0, Math.cos(x / 13 + f1)));
      put(7, and(sky, shape((x, y) => y >= HZ - near(x))));
      put(3, and(disc(sx, HZ, 24), sky));
      sea(put, W, H, HZ, 4, 7);
      const path = (half, k) => shape((x, y) => Math.floor((y - HZ) / 2) % 2 === 1 && Math.abs(x - sx - 2.5 * Math.sin(y * 0.55)) < half - (y - HZ) * k, [0, HZ + 2, W, H]);
      put(3, path(25, 0.78), (x, y) => 1.15 - (y - HZ) / 30);
      put(2, path(9, 0.3), (x, y) => 0.7 - (y - HZ) / 26);
      wavelets(put, 1, W, H, HZ, v, (x) => Math.abs(x - sx) < 30);
    },
  },
  overprint: {
    //         paper      magenta    blue       violet     yellow     orange     ink        green
    palette: ["#EAE4FF", "#FF3D8B", "#2D7FF9", "#5B2DD6", "#FFC93C", "#FF7A2F", "#1E1B3A", "#2FB36B"],
    draw(put, W, H, v) {
      const mx = v.pick(40, 52, 46), my = v.pick(36, 44, 40), mr = v.pick(24, 29, 27);
      const bx = v.pick(72, 84, 78), by = v.pick(38, 46, 43), br = v.pick(23, 28, 26);
      put(1, blob(mx, my, mr, v.pick(0, 6.28, 0.4)));
      put(2, blob(bx, by, br, v.pick(0, 6.28, 2.2)), (x) => 1.2 - Math.max(0, (x - bx) / (br + 1)) ** 1.5, { 1: 3 });
      put(4, blob(v.pick(26, 38, 31), v.pick(16, 24, 20), v.pick(12, 16, 14.5), v.pick(0, 6.28, 1.3), 0.12, 0.07), 1, { 1: 5 });
      put(4, blob(bx + 20, by - 27, 6.5, 4, 0.14, 0.08), 1, { 2: 7 });
      put(1, blob(bx + 30, by + 21, 4.2, 0.8, 0.12, 0.06));
      // spores drift off the blue where it dissolves: 2 × 2 dots, thinning
      const x0 = bx + br - 4;
      put(2, shape((x, y) => {
        const u = x - x0, gx = Math.floor(u / 4), gy = Math.floor(y / 4);
        if (u < 0 || u - gx * 4 >= 2 || y - gy * 4 >= 2) return false;
        return v.h(gx, gy) < 0.62 * Math.max(0, 1 - u / 26) * Math.max(0, 1 - Math.abs(y - by) / (br + 2));
      }, [x0, by - br - 2, W, by + br + 2]));
    },
  },
  hills: {
    //         paper      coral      yellow     pink       blue       ink        mint
    palette: ["#DDF5EA", "#FF6B5E", "#FFC93C", "#FF9EC4", "#3D6BFF", "#1E1B3A", "#58D6A8"],
    draw(put, W, H, v) {
      const ux = v.pick(72, 96, 84), uy = v.pick(22, 32, 27);
      put(3, ring(ux, uy, 23, 1.2));
      put(3, disc(ux, uy, 16));
      put(2, disc(ux, uy, 16), (x, y) => 0.9 - Math.hypot(x - ux + 6, y - uy + 6) / 17);
      const dome = (c, cx, top, w, drop, lit) => { const f = hill(cx, top, w, drop, H); put(c, f); put(5, and(f, shape((x) => x > cx + lit)), (x) => Math.min(0.45, ((x - cx - lit) / w) * 0.5)); };
      dome(4, v.pick(92, 108, 100), v.pick(30, 40, 34), 34, 34, 4);
      dome(2, v.pick(52, 68, 60), v.pick(42, 50, 46), 30, 26, 4);
      dome(6, v.pick(104, 120, 112), v.pick(58, 66, 62), 30, 16, 2);
      const fx = v.pick(8, 24, 16), ft = v.pick(36, 46, 40), on = (x) => ft + ((x - fx) / 40) ** 2 * 36;
      dome(1, fx, ft, 40, 36, 6);
      plant(put, fx + 6, on(fx + 6) + 4, v.pick(12, 20, 14), 2.2, 7, 2, 5);
      plant(put, fx + 22, on(fx + 22) + 2, v.pick(24, 32, 27), -1.8, 6, 3, 5);
    },
  },
  orbit: {
    //         paper      lilac      coral      yellow     mint       pink       deep
    palette: ["#17153B", "#B8A9FF", "#FF6B5E", "#FFD166", "#58E6B5", "#FF8FC7", "#2A2670"],
    draw(put, W, H, v) {
      const px = v.pick(46, 72, 54), py = v.pick(36, 44, 40), phi = v.pick(-0.45, -0.15, -0.32), c = Math.cos(phi), s = Math.sin(phi);
      const on = (a, b, t) => [px + a * Math.cos(t) * c - b * Math.sin(t) * s, py + a * Math.cos(t) * s + b * Math.sin(t) * c];
      const all = rect(0, 0, W, H);
      put(6, all, (x, y) => 0.55 * Math.max(0, 1 - Math.hypot((x - 92) / 46, (y - 18) / 26)));
      put(6, all, (x, y) => 0.4 * Math.max(0, 1 - Math.hypot((x - 14) / 30, (y - 66) / 22)));
      put(1, and(all, shape((x, y) => v.h(Math.floor(x), Math.floor(y)) > 0.988 && (x - px) ** 2 + (y - py) ** 2 > 1600)));
      put(3, and(all, shape((x, y) => v.h(Math.floor(x) + 91, Math.floor(y) + 17) > 0.997)));
      for (const [x, y] of [[80, 9], [16, 14], [112, 58]]) put(1, sparkle(x, y));
      const rings = (half) => { put(1, orbit(px, py, 46, 15, phi, 1.5, half)); put(1, orbit(px, py, 31, 9.5, phi, 1.5, half)); };
      rings(-1);
      put(2, blob(px, py, 13, 1, 0.03, 0.02));
      put(3, disc(px, py, 13), (x, y) => 1.1 - Math.hypot(x - px + 6, y - py + 6) / 14);
      put(6, disc(px, py, 13.2), (x, y) => 0.75 * Math.max(0, (Math.hypot(x - px + 7, y - py + 7) - 15) / 8));
      rings(1);
      const mx = v.pick(96, 112, 105), my = v.pick(11, 18, 14);
      put(4, disc(mx, my, 8));
      put(0, and(disc(mx, my, 8), disc(mx + 4.5, my + 4, 8)), 0.62);
      put(5, disc(...on(46, 15, v.pick(2.4, 3, 2.75)), 4.2));
      put(3, disc(...on(31, 9.5, v.pick(-0.5, 0.2, -0.2)), 2.2));
    },
  },
};

/** The horizons: a scene at a section's foot. Index 0 is the clear page, so
 *  the page is the scene's sky; `ink` is painted from the page's text colour. */
export const HORIZONS = {
  hills: {
    //         (page)  coral      yellow     pink       blue       shade      mint       (ink) bud        bud
    palette: [null, "#FF6B5E", "#FFC93C", "#FF9EC4", "#3D6BFF", "#1E1B3A", "#58D6A8", null, "#FFC93C", "#FF9EC4"],
    ink: 7,
    /** The buds: colours the dissolve leaves whole, as it leaves the ink. */
    whole: [8, 9],
    draw(put, W, H, v) {
      const cols = [4, 2, 6, 1, 3], list = [];
      for (let k = 0, x = 0; x < W; k++) {
        const w = 34 + 26 * v.h(k, 3);
        list.push({ cx: x, top: H - 22 - 40 * v.h(k, 7), w, c: cols[k % cols.length], k });
        x += w * (0.55 + 0.5 * v.h(k, 11));
      }
      list.sort((a, b) => a.top - b.top);
      // every hill is drawn a tile to each side too, so the scene repeats with no seam
      for (const h of list) for (const dx of [-W, 0, W]) {
        const cx = h.cx + dx, f = hill(cx, h.top, h.w, 34, H);
        put(h.c, f);
        put(5, and(f, shape((x) => x > cx + 3)), (x) => Math.min(0.45, ((x - cx - 3) / h.w) * 0.55));
        if (v.h(h.k, 19) > 0.62) plant(put, cx - 4, h.top + 5, h.top - 17 - 9 * v.h(h.k, 23), 2.2, 7, h.c === 2 ? 9 : 8, 7);
      }
    },
  },
  dawn: {
    //         (page)  pink       yellow     sun        sea        mint       shade      deep sea
    palette: [null, "#FF8FA3", "#FFD166", "#FF5A36", "#4F52D9", "#5FE0BD", "#1E1B3A", "#3A3CB8"],
    ink: -1,
    draw(put, W, H, v) {
      const HZ = H - 30, sx = W * v.pick(0.3, 0.7, 0.62), f1 = v.pick(0, 6.28, 0.6), f2 = v.pick(0, 6.28, 2.6);
      const d = (x, y) => Math.hypot(x - sx, y - HZ), sky = rect(0, 0, W, HZ), edge = (x) => Math.min(1, x / 40, (W - x) / 40);
      put(1, and(sky, disc(sx, HZ, 94)), (x, y) => 0.8 * Math.max(0, 1 - (d(x, y) - 30) / 62) ** 1.4);
      put(2, and(sky, disc(sx, HZ, 52)), (x, y) => 1.05 * Math.max(0, 1 - (d(x, y) - 28) / 22));
      const far = (x) => (10 + 9 * Math.sin(x / 15 + f1) + 5 * Math.sin(x / 6.1 + 2)) * Math.min(1, Math.max(0, (sx - 46 - x) / 30)) * edge(x);
      const near = (x) => (8 + 7 * Math.sin(x / 12 + f2) + 3 * Math.sin(x / 4.7)) * Math.min(1, Math.max(0, (x - sx - 44) / 26)) * edge(x);
      const range = and(sky, shape((x, y) => y >= HZ - far(x)));
      put(5, range);
      put(6, range, (x) => 0.32 * Math.max(0, Math.cos(x / 15 + f1)));
      put(7, and(sky, shape((x, y) => y >= HZ - near(x))));
      put(3, and(disc(sx, HZ, 28), sky));
      sea(put, W, H, HZ, 4, 7);
      put(3, shape((x, y) => Math.floor((y - HZ) / 2) % 2 === 1 && Math.abs(x - sx - 2.5 * Math.sin(y * 0.55)) < 29 - (y - HZ) * 0.9, [0, HZ + 2, W, H]), (x, y) => 1.15 - (y - HZ) / 30);
      wavelets(put, 1, W, H, HZ, v, (x) => Math.abs(x - sx) < 34 || edge(x) < 1);
    },
    /** The scene with nothing on it: what continues past the picture's sides. */
    strip(put, W, H) { sea(put, W, H, H - 30, 4, 7); },
  },
};

/**
 * A seed from an attribute value: a whole number is itself, any other text
 * is hashed to one, and nothing (null, empty) is 0, the canonical picture.
 * @param {string|number|null|undefined} value @returns {number} a uint32
 */
export function seedOf(value) {
  if (value === null || value === undefined) return 0;
  const text = String(value).trim();
  if (text === "") return 0;
  if (/^\d+$/.test(text)) return Number(text) >>> 0;
  let h = 2166136261;
  for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 16777619);
  return (h >>> 0) || 1;
}

/**
 * One poster, POSTER_COLS × POSTER_ROWS. Seed 0 is the picture components.css
 * ships; another seed moves the scene's parts and may mirror it.
 * @param {string} name a key of POSTERS @param {number} [seed]
 * @param {boolean} [clip] false tests every cell of every shape: slower, the same picture
 */
export function renderPoster(name, seed = 0, clip = true) {
  // The first draw decides the mirror: a change in the order of the draws
  // changes every seeded poster a site already shows.
  const scene = POSTERS[name], v = vary(seed >>> 0), mirror = v.pick(0, 1, 0) >= 0.5;
  const { cells, put } = sheet(POSTER_COLS, POSTER_ROWS, clip);
  scene.draw(put, POSTER_COLS, POSTER_ROWS, v);
  if (mirror) for (let j = 0; j < POSTER_ROWS; j++) cells.subarray(j * POSTER_COLS, (j + 1) * POSTER_COLS).reverse();
  return { cols: POSTER_COLS, rows: POSTER_ROWS, cells, palette: scene.palette, ink: -1 };
}

/**
 * One horizon, `cols` × HORIZON_ROWS, dissolving into the page over its top
 * rows. Its left edge continues its right one, so it can repeat.
 * @param {string} name a key of HORIZONS @param {number} cols @param {number} [seed]
 * @param {boolean} [clip] false tests every cell of every shape: slower, the same picture
 */
export function renderHorizon(name, cols, seed = 0, clip = true) {
  const scene = HORIZONS[name], { cells, put } = sheet(cols, HORIZON_ROWS, clip);
  scene.draw(put, cols, HORIZON_ROWS, vary(seed >>> 0));
  // The dissolve: the colour thins toward the top through the matrix. A plant
  // on a hilltop (the ink and its bud) stays whole, or it would read as
  // stray cells.
  const whole = new Set([scene.ink, ...(scene.whole ?? [])]);
  for (let j = 0; j < HORIZON_FADE; j++) for (let i = 0; i < cols; i++) {
    if (!whole.has(cells[j * cols + i]) && 1.05 - ((j + 0.5) / HORIZON_FADE) ** 1.6 > bayerAt(i, j)) cells[j * cols + i] = 0;
  }
  return { cols, rows: HORIZON_ROWS, cells, palette: scene.palette, ink: scene.ink };
}

/**
 * The plain strip a horizon continues with past its picture's sides, 8 cells
 * wide (one Bayer period), or null when the scene repeats as a whole.
 * @param {string} name a key of HORIZONS
 */
export function renderHorizonStrip(name) {
  const scene = HORIZONS[name];
  if (!scene.strip) return null;
  const { cells, put } = sheet(8, HORIZON_ROWS);
  scene.strip(put, 8, HORIZON_ROWS);
  return { cols: 8, rows: HORIZON_ROWS, cells, palette: scene.palette, ink: -1 };
}

/**
 * A picture as RGBA bytes, one pixel per cell. `layer` "colour" paints the
 * palette (clear and ink cells transparent); "ink" paints the ink cells
 * opaque black, for a mask.
 * @param {{cols:number, rows:number, cells:Uint8Array, palette:(string|null)[], ink:number}} picture
 * @param {"colour"|"ink"} [layer] @returns {Uint8ClampedArray}
 */
export function toRgba(picture, layer = "colour") {
  const { cells, palette, ink } = picture, out = new Uint8ClampedArray(cells.length * 4);
  const rgb = palette.map((h) => (h ? [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)) : null));
  for (let k = 0; k < cells.length; k++) {
    const c = cells[k];
    if (layer === "ink") { if (c === ink) out[k * 4 + 3] = 255; continue; }
    if (c === ink || !rgb[c]) continue;
    out.set(rgb[c], k * 4);
    out[k * 4 + 3] = 255;
  }
  return out;
}
