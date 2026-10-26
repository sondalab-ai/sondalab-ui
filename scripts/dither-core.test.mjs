import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const { BAYER, CELL_PX, bayerAt, wipeCovered, wipeFrame, rampFrame } = await import(
  resolve(HERE, "../packages/ui-kit/dither-core.js")
);

const GRIDS = [{ cols: 1, rows: 1 }, { cols: 8, rows: 8 }, { cols: 23, rows: 9 }, { cols: 40, rows: 17 }];
const origins = (g) => [
  { x: 0, y: 0 }, { x: g.cols / 2, y: g.rows / 2 }, { x: g.cols, y: g.rows },
  { x: -10, y: -4 }, { x: g.cols + 30, y: g.rows / 2 },
];
const count = (a) => a.reduce((s, v) => s + v, 0);

test("the cell is 3px", () => assert.equal(CELL_PX, 3));

test("BAYER is 64 distinct values, a permutation of 0..63 once scaled", () => {
  const flat = BAYER.flat();
  assert.equal(BAYER.length, 8);
  assert.ok(BAYER.every((r) => r.length === 8));
  assert.equal(new Set(flat).size, 64);
  const ranks = flat.map((v) => Math.round(v * 64 - 0.5)).sort((a, b) => a - b);
  assert.deepEqual(ranks, Array.from({ length: 64 }, (_, k) => k));
  assert.ok(flat.every((v) => v > 0 && v < 1));
});

test("BAYER is frozen, and bayerAt tiles", () => {
  assert.ok(Object.isFrozen(BAYER) && Object.isFrozen(BAYER[0]));
  assert.equal(bayerAt(3, 5), BAYER[5][3]);
  assert.equal(bayerAt(11, 13), BAYER[5][3]);
  assert.equal(bayerAt(-5, -3), BAYER[5][3]);
});

test("t=0 covers nothing and t=1 covers everything", () => {
  for (const g of GRIDS) for (const o of origins(g)) {
    assert.equal(count(wipeFrame(g, o, 0)), 0);
    assert.equal(count(wipeFrame(g, o, 1)), g.cols * g.rows);
  }
});

test("wipeCovered agrees with wipeFrame", () => {
  const g = { cols: 13, rows: 7 };
  const o = { x: 2.5, y: 3 };
  const f = wipeFrame(g, o, 0.45);
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    assert.equal(wipeCovered(i, j, o, 0.45, g), f[j * g.cols + i] === 1);
  }
});

test("coverage is monotonic non-decreasing in t, cell by cell", () => {
  for (const g of GRIDS) for (const o of origins(g)) {
    let prev = wipeFrame(g, o, 0);
    for (let k = 1; k <= 40; k++) {
      const cur = wipeFrame(g, o, k / 40);
      for (let n = 0; n < cur.length; n++) assert.ok(cur[n] >= prev[n]);
      prev = cur;
    }
  }
});

test("a wider spread still ends at full coverage", () => {
  const g = { cols: 20, rows: 10 };
  assert.equal(count(wipeFrame(g, { x: 0, y: 0 }, 1, 0.2)), 200);
  assert.equal(count(wipeFrame(g, { x: 0, y: 0 }, 0, 1.5)), 0);
});

test("at mid t, cells near the origin are covered more than far cells", () => {
  const g = { cols: 48, rows: 24 };
  const o = { x: 0, y: 12 };
  const f = wipeFrame(g, o, 0.5);
  const rate = (lo, hi) => {
    let on = 0, n = 0;
    for (let j = 0; j < g.rows; j++) for (let i = lo; i < hi; i++) { on += f[j * g.cols + i]; n++; }
    return on / n;
  };
  assert.ok(rate(0, 12) > rate(36, 48));
  assert.ok(rate(0, 12) > 0.9);
  assert.ok(rate(36, 48) < 0.1);
});

test("rampFrame: level 0 is empty, level 1 has coverage rising toward the high end", () => {
  const g = { cols: 64, rows: 16 };
  assert.equal(count(rampFrame(g, 0)), 0);
  const f = rampFrame(g, 1);
  const col = (i) => { let s = 0; for (let j = 0; j < g.rows; j++) s += f[j * g.cols + i]; return s; };
  for (let i = 8; i < g.cols; i += 8) {
    let a = 0, b = 0;
    for (let k = i - 8; k < i; k++) a += col(k);
    for (let k = i; k < Math.min(i + 8, g.cols); k++) b += col(k);
    if (i + 8 <= g.cols) assert.ok(b >= a, `block at ${i}`);
  }
  assert.equal(col(0), 0);
  assert.ok(col(g.cols - 1) > g.rows / 2);
});

test("rampFrame: level 1 matches the lab's i / cols > BAYER, a partial level stops short", () => {
  const g = { cols: 32, rows: 8 };
  const f = rampFrame(g, 1);
  for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) {
    assert.equal(f[j * g.cols + i] === 1, i / g.cols > BAYER[j % 8][i % 8]);
  }
  const half = rampFrame(g, 0.5);
  for (let j = 0; j < g.rows; j++) for (let i = 16; i < g.cols; i++) assert.equal(half[j * g.cols + i], 0);
  assert.ok(count(half) > 0 && count(half) < count(f));
});

test("importing the module has no side effects", async () => {
  const before = Object.keys(globalThis);
  await import(resolve(HERE, "../packages/ui-kit/dither-core.js") + "?again");
  assert.deepEqual(Object.keys(globalThis), before);
});
