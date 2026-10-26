/* @sondalab/ui-kit — dither-core.js
   The Bayer ordered dither the pixel direction draws with: a wipe that
   spreads from a point (the button hover) and a ramp that thickens along a
   strip (the signal strip). Ported from the lab probe lab/pixel-directions.html
   (BAYER, ditherFx). Pure maths over a grid of cells: no DOM, no colour,
   runs in Node. The caller owns the canvas and the colours. */

/** The kit's pixel unit, in CSS px: one dither cell is CELL_PX × CELL_PX. */
export const CELL_PX = 3;

/** The 8×8 Bayer thresholds, each in (0,1), 64 distinct values, frozen. */
export const BAYER = (() => {
  let m = [[0]];
  for (let n = 1; n < 8; n *= 2) {
    const r = [];
    for (let y = 0; y < 2 * n; y++) {
      r[y] = [];
      for (let x = 0; x < 2 * n; x++) {
        r[y][x] = 4 * m[y % n][x % n] + [[0, 2], [3, 1]][Math.floor(y / n)][Math.floor(x / n)];
      }
    }
    m = r;
  }
  return Object.freeze(m.map((row) => Object.freeze(row.map((v) => (v + 0.5) / 64))));
})();

/**
 * The Bayer threshold at cell (i, j); the matrix tiles, so any integer
 * (including a negative one) is valid. Returns a value in (0,1).
 */
export function bayerAt(i, j) {
  return BAYER[((j % 8) + 8) % 8][((i % 8) + 8) % 8];
}

/**
 * Is cell (i, j) covered by a wipe at time `t`? `grid` is `{cols, rows}`,
 * `origin` is `{x, y}` in cell units (it may lie outside the grid), `t` runs
 * 0..1 and `spread` is how far the dithered edge reaches. t=0 covers no
 * cell, t=1 covers every cell.
 */
export function wipeCovered(i, j, origin, t, grid, spread = 0.7) {
  const maxD = farthest(grid, origin);
  return covered(i, j, origin, t, maxD, spread);
}

/**
 * The whole wipe frame: a `cols * rows` Uint8Array, row-major, 1 where the
 * cell is covered. Callers draw only the covered cells. Same arguments as
 * wipeCovered, without the cell.
 */
export function wipeFrame(grid, origin, t, spread = 0.7) {
  const { cols, rows } = grid;
  const out = new Uint8Array(cols * rows);
  const maxD = farthest(grid, origin);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) out[j * cols + i] = covered(i, j, origin, t, maxD, spread) ? 1 : 0;
  }
  return out;
}

/**
 * The signal-strip ramp: a `cols * rows` Uint8Array, row-major, 1 where the
 * cell is on. `level` (0..1) is how much of the strip is filled: the ramp
 * is stretched over the first `level` of the width and nothing lies beyond
 * it. Inside, density rises from none at the low end to full at the high end.
 * level 1 is the lab's ramp (on when i / cols > BAYER), level 0 is empty.
 */
export function rampFrame(grid, level = 1) {
  const { cols, rows } = grid;
  const out = new Uint8Array(cols * rows);
  if (!(level > 0)) return out;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = i / (cols * level);
      if (u < 1 && u > bayerAt(i, j)) out[j * cols + i] = 1;
    }
  }
  return out;
}

/** Distance from the origin to the farthest corner of the grid, in cells. */
function farthest({ cols, rows }, { x, y }) {
  return Math.hypot(Math.max(x, cols - x), Math.max(y, rows - y));
}

function covered(i, j, origin, t, maxD, spread) {
  const dn = maxD > 0 ? Math.hypot(i + 0.5 - origin.x, j + 0.5 - origin.y) / maxD : 0;
  return dn < t * (1 + spread) - bayerAt(i, j) * spread;
}
