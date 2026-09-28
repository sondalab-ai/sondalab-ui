import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The site's dot scenes (sondalab-site src/lib/dot-scene.ts), ported. The
// first nine cases are the site's own; the rest pin what the kit adds.

const HERE = dirname(fileURLToPath(import.meta.url));
const { sampleDots, dotFrame, settledFrame, cover } = await import(resolve(HERE, "../packages/ui-kit/halftone-core.js"));

/** A size×size RGBA image whose grey value at (x, y) is `f(x, y)`, alpha `a(x, y)`. */
function image(size, f, a = () => 255) {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = (y * size + x) * 4;
    px[k] = px[k + 1] = px[k + 2] = f(x, y);
    px[k + 3] = a(x, y);
  }
  return px;
}
const ramp = image(64, (x) => x * 4);

test("a black image draws nothing", () => {
  assert.deepEqual(sampleDots(image(64, () => 0), 64, { grid: 16, seed: 1 }), []);
});

test("a uniform image draws nothing and does not divide by zero", () => {
  assert.equal(sampleDots(image(64, () => 128), 64, { grid: 16, seed: 1 }).length, 0);
});

test("dots stay inside the inscribed circle", () => {
  const dots = sampleDots(ramp, 64, { grid: 16, seed: 1 });
  assert.ok(dots.length > 0);
  for (const d of dots) assert.ok(Math.hypot(d.x - 0.5, d.y - 0.5) < 0.5, `dot at ${d.x},${d.y}`);
});

test("a dark image still spends the whole light range", () => {
  const dark = image(64, (x, y) => Math.round(40 * Math.max(0, 1 - Math.hypot(x - 32, y - 32) / 32)));
  const dots = sampleDots(dark, 64, { grid: 16, seed: 1 });
  assert.ok(Math.max(...dots.map((d) => d.L)) > 0.9);
});

test("a dot starts at its scatter position and settles near its place", () => {
  const [d] = sampleDots(ramp, 64, { grid: 16, seed: 1 });
  const start = dotFrame(d, 0, 160, 16);
  assert.ok(Math.abs(start.x - d.sx * 160) < 1e-9 && Math.abs(start.y - d.sy * 160) < 1e-9);
  const later = dotFrame(d, 20, 160, 16);
  assert.ok(Math.hypot(later.x - d.x * 160, later.y - d.y * 160) <= 0.45 * 10 * Math.SQRT2 + 1e-9);
});

test("a brighter dot is larger", () => {
  const dots = sampleDots(ramp, 64, { grid: 16, seed: 1 });
  const dim = dots.reduce((a, b) => (a.L < b.L ? a : b));
  const lit = dots.reduce((a, b) => (a.L > b.L ? a : b));
  assert.ok(dotFrame(lit, 20, 160, 16).r > dotFrame(dim, 20, 160, 16).r);
});

test("on paper the picture prints its dark: an inverted black image draws, a white one does not", () => {
  assert.ok(sampleDots(image(64, (x) => (x < 32 ? 0 : 40)), 64, { grid: 16, invert: true, seed: 1 }).length > 0);
  assert.deepEqual(sampleDots(image(64, () => 255), 64, { grid: 16, invert: true, seed: 1 }), []);
});

test("the circle dissolves at its edge instead of ending on a line", () => {
  const dots = sampleDots(image(64, (x) => x * 4), 64, { grid: 32, seed: 7 });
  const rim = dots.filter((d) => Math.hypot(d.x - 0.5, d.y - 0.5) / 0.5 > 0.85);
  const core = dots.filter((d) => Math.hypot(d.x - 0.5, d.y - 0.5) / 0.5 < 0.4);
  const mean = (a) => a.reduce((s, d) => s + d.L, 0) / Math.max(1, a.length);
  assert.ok(mean(rim) < 0.3 * mean(core), `rim ${mean(rim).toFixed(3)} vs core ${mean(core).toFixed(3)}`);
});

test("dots scatter inside the circle, so the square never shows while they gather", () => {
  const dots = sampleDots(ramp, 64, { grid: 32 });
  assert.ok(dots.length > 50);
  for (const d of dots) assert.ok(Math.hypot(d.sx - 0.5, d.sy - 0.5) <= 0.5);
});

test("a seed makes the dots reproducible, and a different seed changes them", () => {
  const a = sampleDots(ramp, 64, { grid: 32, seed: 42 });
  assert.deepEqual(sampleDots(ramp, 64, { grid: 32, seed: 42 }), a);
  assert.notDeepEqual(sampleDots(ramp, 64, { grid: 32, seed: 43 }), a);
});

test("a transparent pixel is ground, not black: a transparent picture prints nothing either way", () => {
  const clear = image(64, () => 0, () => 0);
  assert.deepEqual(sampleDots(clear, 64, { grid: 16, seed: 1 }), []);
  assert.deepEqual(sampleDots(clear, 64, { grid: 16, invert: true, seed: 1 }), []);
});

test("a transparent logo on paper prints the logo, not a disc", () => {
  // Black mark in the centre, transparent around it.
  const inside = (x, y) => Math.hypot(x - 32, y - 32) < 10;
  const logo = image(64, () => 0, (x, y) => (inside(x, y) ? 255 : 0));
  const dots = sampleDots(logo, 64, { grid: 32, invert: true, seed: 1 });
  assert.ok(dots.length > 0);
  for (const d of dots) assert.ok(Math.hypot(d.x * 64 - 32, d.y * 64 - 32) < 12, `stray dot at ${d.x},${d.y}`);
});

test("the settled frame is the dot at its place, at full size", () => {
  const [d] = sampleDots(ramp, 64, { grid: 16, seed: 1 });
  const f = settledFrame(d, 160, 16);
  assert.equal(f.x, d.x * 160);
  assert.equal(f.y, d.y * 160);
  assert.ok(Math.abs(f.r - 0.56 * 10 * Math.sqrt(d.L)) < 1e-12);
});

test("the motion constants are options whose defaults are the site's", () => {
  const [d] = sampleDots(ramp, 64, { grid: 16, seed: 1 });
  assert.deepEqual(dotFrame(d, 3, 160, 16), dotFrame(d, 3, 160, 16, { assemble: 1.1, drift: 0.15, shimmer: 0.075, scanPeriod: 6 }));
  const calm = dotFrame(d, 30, 160, 16, { drift: 0 });
  assert.ok(Math.abs(calm.x - d.x * 160) < 1e-9 && Math.abs(calm.y - d.y * 160) < 1e-9);
});

test("cover crops the centred square of any picture", () => {
  assert.deepEqual(cover(1600, 900), { sx: 350, sy: 0, s: 900 });
  assert.deepEqual(cover(900, 1600), { sx: 0, sy: 350, s: 900 });
  assert.deepEqual(cover(512, 512), { sx: 0, sy: 0, s: 512 });
});

const { toSVG } = await import(resolve(HERE, "../packages/ui-kit/halftone-core.js"));

test("toSVG: one circle per dot, the fill set once, at the dots' places", () => {
  const dots = sampleDots(ramp, 64, { grid: 16, seed: 1 });
  const svg = toSVG(dots, { size: 320, grid: 16, color: "var(--ink)" });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 320 320" width="320" height="320">/);
  assert.ok(svg.endsWith("</svg>"));
  assert.equal(svg.match(/<circle /g).length, dots.length);
  assert.equal(svg.match(/fill=/g).length, 1);
  const first = /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"\/>/.exec(svg);
  assert.equal(Number(first[1]), Math.round(dots[0].x * 320 * 100) / 100);
  assert.equal(Number(first[2]), Math.round(dots[0].y * 320 * 100) / 100);
});

test("toSVG: currentColor by default, an optional ground, and attribute values escaped", () => {
  const dots = sampleDots(ramp, 64, { grid: 16, seed: 1 });
  assert.match(toSVG(dots, { size: 100, grid: 16 }), /<g fill="currentColor">/);
  const svg = toSVG(dots, { size: 100, grid: 16, color: 'a"<b', background: "paper&ink" });
  assert.match(svg, /<rect width="100" height="100" fill="paper&amp;ink"\/><g fill="a&quot;&lt;b">/);
});

test("toSVG: same picture, grid and seed give the same bytes", () => {
  const one = toSVG(sampleDots(ramp, 64, { grid: 32, seed: 9 }), { size: 400, grid: 32 });
  const two = toSVG(sampleDots(ramp, 64, { grid: 32, seed: 9 }), { size: 400, grid: 32 });
  assert.equal(one, two);
});
