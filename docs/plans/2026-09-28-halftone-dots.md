# Halftone Dots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move sondalab-site's dot scenes into `@sondalab/ui-kit` as one pure engine (`halftone-core.js`) shared by a live canvas runtime (`halftone.js`, armed by `mount()`) and a browser export page (`tools/halftone/`) that downloads SVG/PNG marketing assets.

**Architecture:** The engine is pure maths over RGBA bytes and runs in Node and the browser. The runtime owns canvases, observers and the one animation loop, and follows the kit's effect contract (reduced motion, `data-sl-fx-still`, `data-sl-fx="off"`, high contrast, `stop()`). The export page imports the engine by relative path, so there is no build step.

**Tech Stack:** Plain ES modules with JSDoc + hand-written `.d.ts`; `node --test` (`npm test` at the repo root); canvas 2D; no new dependencies.

**Spec:** `docs/specs/2026-09-28-halftone-dots-design.md`

## Global Constraints

- Dots only: no other cell shape (owner, 2026-09-28).
- No new dependency in `packages/ui-kit/package.json`; `vgpu` stays the only (optional) peer.
- No colour literal in any kit module (`halftone-core.js`, `halftone.js`, `colour.js`): colour comes from CSS or from the caller.
- Default engine values are the site's code, not the site's spec: grid 96, floor 0.03, gather 1.1 s, float 0.15 cell, shimmer ±7.5 %, scan period 6 s, radius `0.56 × cell × √L × (0.4 + 0.6e)`.
- Grid from markup is clamped to 16–256; missing or invalid → 96.
- Kit version for this work: **0.19.0**.
- `tools/` is not in the npm package.
- Comments: none by default; module headers and non-obvious *why* only, in the voice of the existing kit files. New exported function: ~4 lines of JSDoc.
- Run everything from the worktree root: `/Users/marcello.barile/src/mine/ai-tools/sondalab-ui/.claude/worktrees/feat-halftone`.

## Review Focus

1. **A non-square picture** (a 16:9 photo dropped on the export page, or a wide image behind `data-sl-src`): expected to be centre-cropped to a square, never squashed. The site's runtime squashes; its crops happened to be square. → `cover()` in Task 1, used in Tasks 4 and 6.
2. **A PNG with transparency** (a logo on a transparent ground): transparent pixels must count as the ground, not as black. Otherwise, with ink on paper (`invert`), a transparent logo prints a solid disc. → alpha compositing in `sampleDots`, Task 1.
3. **A canvas with no width yet** (inside a closed `<details>`, `display: none`, not laid out): nothing is drawn, nothing throws, and it draws when it gets a size. → `draw()` guard + ResizeObserver, Task 4.
4. **An image that fails** (404, decode error, cross-origin without CORS, which taints the canvas so `getImageData` throws): that canvas stays empty and every other scene still draws. → Task 4 test.
5. **A bad `data-sl-grid`** (`"abc"`, `"0"`, `"5000"`): falls back to 96, or is clamped to 16–256; never a 10 000-cell loop per frame. → Task 4 test.

---

### Task 1: The engine — `halftone-core.js`

**Files:**
- Create: `packages/ui-kit/halftone-core.js`
- Create: `packages/ui-kit/halftone-core.d.ts`
- Create: `scripts/halftone-core.test.mjs`
- Modify: `scripts/types-drift.test.mjs:15` (the `MODULES` list)
- Modify: `packages/ui-kit/package.json` (`exports`, `files`)

**Interfaces:**
- Produces:
  - `sampleDots(pixels: ArrayLike<number>, size: number, opts?: { grid?: number; invert?: boolean; seed?: number; floor?: number }): Dot[]`
  - `dotFrame(d: Dot, t: number, width: number, grid: number, motion?: Motion): { x: number; y: number; r: number }`
  - `settledFrame(d: Dot, width: number, grid: number): { x: number; y: number; r: number }`
  - `cover(width: number, height: number): { sx: number; sy: number; s: number }`
  - `Dot = { x, y, L, sx, sy, delay, phase }` (all numbers; `x`, `y`, `sx`, `sy` in unit coordinates of the square)
  - `Motion = { assemble?: number; drift?: number; shimmer?: number; scanPeriod?: number }`

- [ ] **Step 1: Write the failing tests**

Create `scripts/halftone-core.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/halftone-core.test.mjs`
Expected: FAIL: `Cannot find module …/packages/ui-kit/halftone-core.js`.

- [ ] **Step 3: Write the engine**

Create `packages/ui-kit/halftone-core.js`:

```js
/* @sondalab/ui-kit — halftone-core.js
   A picture resampled into a grid of round dots whose size follows the light:
   sondalab-site's dot scenes (src/lib/dot-scene.ts, 2026-09-26), moved into
   the kit so a live canvas (halftone.js) and an exported asset (toSVG) draw
   the same dots. Pure maths over RGBA bytes: no DOM, runs in Node.

   The defaults are the site's code, not the site's spec, which drifted.
   Photos read as dots only when the subject is one iconic outline with
   near-binary contrast, at ≥ 320px with a grid near 130. */

const FLOOR = 0.03;

/** A small seeded PRNG (mulberry32): same seed, same sequence, on every engine. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Samples an RGBA picture (`size` px square) on a `grid`×`grid` lattice. The
 * picture's own 2nd..99th luminance percentile becomes the full range; the
 * outer half of the inscribed circle dissolves. `invert` prints the dark, for
 * ink on a light ground. A transparent pixel counts as ground in either case.
 * `seed` makes the edge, scatter, delays and phases reproducible.
 */
export function sampleDots(px, size, { grid = 96, invert = false, seed, floor = FLOOR } = {}) {
  const rand = seed === undefined ? Math.random : seeded(seed);
  const ground = invert ? 1 : 0;
  const lum0 = (k) => {
    const a = px[k + 3] / 255;
    return (a * (0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2])) / 255 + (1 - a) * ground;
  };
  const lum = invert ? (k) => (1 - lum0(k)) ** 1.8 : lum0;
  const count = size * size;
  const all = new Float64Array(count);
  for (let i = 0; i < count; i++) all[i] = lum(i * 4);
  all.sort();
  const lo = all[Math.floor(count * 0.02)];
  const hi = Math.max(lo + 0.05, all[Math.floor(count * 0.99)]);

  const dots = [];
  const cell = size / grid;
  for (let j = 0; j < grid; j++) {
    for (let i = 0; i < grid; i++) {
      const x = (i + 0.5) / grid;
      const y = (j + 0.5) / grid;
      const edge = Math.hypot(x - 0.5, y - 0.5) / 0.5;
      if (edge >= 1) continue;
      const k = (Math.floor((j + 0.5) * cell) * size + Math.floor((i + 0.5) * cell)) * 4;
      const lin = Math.min(1, Math.max(0, (lum(k) - lo) / (hi - lo)));
      const f = Math.min(1, (1 - edge) / 0.5);
      const fade = f * f * (3 - 2 * f);
      const L = lin * lin * (3 - 2 * lin) * fade;
      if (L < floor || rand() > fade ** 0.6) continue;
      // Scatter inside the circle, uniform by area, so the square never shows.
      const sr = 0.5 * Math.sqrt(rand());
      const sa = rand() * Math.PI * 2;
      dots.push({
        x,
        y,
        L,
        sx: 0.5 + sr * Math.cos(sa),
        sy: 0.5 + sr * Math.sin(sa),
        delay: rand() * 0.35 + Math.hypot(x - 0.5, y - 0.5) * 0.5,
        phase: rand() * Math.PI * 2,
      });
    }
  }
  return dots;
}

/**
 * Where dot `d` is `t` seconds after its scene began to gather, on a
 * `width`-px square with a `grid`-cell lattice: it eases from its scatter to
 * its place, then floats, its light breathing, a scan band crossing every
 * `scanPeriod` seconds. `motion` overrides the site's constants.
 */
export function dotFrame(d, t, width, grid, { assemble = 1.1, drift = 0.15, shimmer = 0.075, scanPeriod = 6 } = {}) {
  const cell = width / grid;
  const k = Math.min(1, Math.max(0, (t - d.delay) / assemble));
  const e = 1 - (1 - k) ** 3;
  const orbit = drift * cell * e;
  const x = (d.sx + (d.x - d.sx) * e) * width + orbit * Math.sin(t * 0.55 + d.phase);
  const y = (d.sy + (d.y - d.sy) * e) * width + orbit * Math.cos(t * 0.43 + d.phase * 1.7);
  const breath = 1 + shimmer * Math.sin(t * 1.6 + d.phase);
  const scan = ((t % scanPeriod) / scanPeriod) * 1.4 - 0.2;
  const band = Math.max(0, 1 - Math.abs(d.y - scan) * 14) * 0.5;
  const L = Math.min(1, d.L * breath + band * d.L);
  return { x, y, r: 0.56 * cell * Math.sqrt(L) * (0.4 + 0.6 * e) };
}

/**
 * The dot at rest: at its place, full size, no float, breath or scan band.
 * What reduced motion shows and what an export prints.
 */
export function settledFrame(d, width, grid) {
  return { x: d.x * width, y: d.y * width, r: 0.56 * (width / grid) * Math.sqrt(d.L) };
}

/**
 * The centred square of a `width`×`height` picture, as drawImage source
 * coordinates: a wide or tall picture is cropped, never squashed.
 */
export function cover(width, height) {
  const s = Math.min(width, height);
  return { sx: (width - s) / 2, sy: (height - s) / 2, s };
}
```

Create `packages/ui-kit/halftone-core.d.ts`:

```ts
/** One dot of a halftone, in unit coordinates of the square picture. */
export interface Dot {
  x: number;
  y: number;
  /** Light, 0..1, after the stretch, the S-curve and the edge fade. */
  L: number;
  /** Where it starts before it gathers, inside the circle. */
  sx: number;
  sy: number;
  /** Seconds before it starts moving to its place. */
  delay: number;
  phase: number;
}

export interface SampleOptions {
  /** Cells per side. Default 96. */
  grid?: number;
  /** Print the picture's dark (ink on a light ground). Default false. */
  invert?: boolean;
  /** Seed for reproducible dots. Omitted: Math.random. */
  seed?: number;
  /** Cells below this light draw nothing. Default 0.03. */
  floor?: number;
}

export interface Motion {
  /** Seconds one dot takes to reach its place. Default 1.1. */
  assemble?: number;
  /** Float orbit, in cells. Default 0.15. */
  drift?: number;
  /** Light breath, as a fraction. Default 0.075. */
  shimmer?: number;
  /** Seconds between two scan bands. Default 6. */
  scanPeriod?: number;
}

export interface DotFrame {
  x: number;
  y: number;
  r: number;
}

export declare function sampleDots(pixels: ArrayLike<number>, size: number, options?: SampleOptions): Dot[];
export declare function dotFrame(dot: Dot, t: number, width: number, grid: number, motion?: Motion): DotFrame;
export declare function settledFrame(dot: Dot, width: number, grid: number): DotFrame;
export declare function cover(width: number, height: number): { sx: number; sy: number; s: number };
```

- [ ] **Step 4: Register the module**

In `scripts/types-drift.test.mjs`, line 15:

```js
const MODULES = ["effects", "goo-field", "geom", "glass-text", "halftone-core"];
```

In `packages/ui-kit/package.json`, add to `exports` after `"./geom.js": "./geom.js",`:

```json
    "./halftone-core.js": "./halftone-core.js",
```

and to `files` after `"geom.js",`:

```json
    "halftone-core.js",
```

and after `"geom.d.ts",`:

```json
    "halftone-core.d.ts",
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/halftone-core.test.mjs scripts/types-drift.test.mjs`
Expected: PASS, all tests. If "a seed makes the dots reproducible" fails on `notDeepEqual`, the PRNG is not wired: check `rand` is `seeded(seed)`.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/halftone-core.js packages/ui-kit/halftone-core.d.ts packages/ui-kit/package.json scripts/halftone-core.test.mjs scripts/types-drift.test.mjs
git commit -m "feat(halftone): the dot engine — sampleDots, dotFrame, settledFrame, cover

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: SVG export — `toSVG`

**Files:**
- Modify: `packages/ui-kit/halftone-core.js` (append)
- Modify: `packages/ui-kit/halftone-core.d.ts` (append)
- Test: `scripts/halftone-core.test.mjs` (append)

**Interfaces:**
- Consumes: `settledFrame(d, width, grid)` from Task 1.
- Produces: `toSVG(dots: Dot[], opts: { size: number; grid: number; color?: string; background?: string }): string`. `color` defaults to `"currentColor"`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/halftone-core.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/halftone-core.test.mjs`
Expected: FAIL: `toSVG is not a function`.

- [ ] **Step 3: Implement**

Append to `packages/ui-kit/halftone-core.js`:

```js
const escape = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const round = (v) => Math.round(v * 100) / 100;

/**
 * The settled halftone as an SVG string, `size` px square: one circle per
 * dot, the fill set once (`currentColor` unless given, so an inlined SVG
 * takes the text colour), an optional full-size ground. For print and for
 * marketing assets; the motion is the runtime's, not the file's.
 */
export function toSVG(dots, { size, grid, color = "currentColor", background } = {}) {
  let circles = "";
  for (const d of dots) {
    const f = settledFrame(d, size, grid);
    circles += `<circle cx="${round(f.x)}" cy="${round(f.y)}" r="${round(f.r)}"/>`;
  }
  const ground = background ? `<rect width="${size}" height="${size}" fill="${escape(background)}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${ground}<g fill="${escape(color)}">${circles}</g></svg>`;
}
```

Append to `packages/ui-kit/halftone-core.d.ts`:

```ts
export interface SvgOptions {
  /** Output side, px. */
  size: number;
  /** The grid the dots were sampled on. */
  grid: number;
  /** Dot fill. Default "currentColor". */
  color?: string;
  /** A full-size ground behind the dots. Default none (transparent). */
  background?: string;
}

export declare function toSVG(dots: Dot[], options: SvgOptions): string;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/halftone-core.test.mjs scripts/types-drift.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-kit/halftone-core.js packages/ui-kit/halftone-core.d.ts scripts/halftone-core.test.mjs
git commit -m "feat(halftone): toSVG — the settled halftone as an SVG string

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: One colour reader — `colour.js`

**Files:**
- Create: `packages/ui-kit/colour.js`
- Modify: `packages/ui-kit/live-light.js:127-148` (remove `swatch` + `roleColour`, import instead)
- Modify: `packages/ui-kit/package.json` (`files` only; not an export)
- Modify: `scripts/live-light.test.mjs:86-91` (the "painted, never parsed" test reads `colour.js`)
- Modify: `docs/specs/2026-09-28-halftone-dots-design.md` (the "Shared colour reader" bullet)

**Interfaces:**
- Produces:
  - `toSrgb(doc: Document, css: string): [number, number, number]` (0–1)
  - `roleColour(host: Element, prop: string): [number, number, number]` (0–1; reads `var(prop)` through a probe)

- [ ] **Step 1: Point the existing test at the new home (it now fails)**

In `scripts/live-light.test.mjs`, replace the test at lines 86–91 with:

```js
test("a role colour is converted to sRGB by painting it, never parsed", () => {
  const colour = readFileSync(resolve(KIT, "colour.js"), "utf8");
  const fn = colour.slice(colour.indexOf("export function toSrgb("), colour.indexOf("export function roleColour("));
  assert.match(fn, /getContext\("2d"/, "painted on a 2D canvas");
  assert.match(fn, /getImageData\(0, 0, 1, 1\)/, "and read back as a pixel");
  assert.doesNotMatch(fn, /\.match\(/, "no parsing of the computed string");
  assert.match(js, /import \{ roleColour \} from "\.\/colour\.js";/, "live-light reads colour through it");
});
```

Run: `node --test scripts/live-light.test.mjs`
Expected: FAIL: `ENOENT … colour.js`.

- [ ] **Step 2: Create `packages/ui-kit/colour.js`**

```js
/* @sondalab/ui-kit — colour.js (internal, not an export)
   The kit's one way to turn a CSS colour into sRGB numbers, shared by
   live-light.js and halftone.js. A computed colour is not always sRGB bytes:
   a colour mix or a relative colour serialises in Oklab or as a colour
   function, and reading its numbers as bytes gave black (spexr, 0.15.0). So
   it is painted on a one-pixel 2D canvas, which converts any CSS colour to
   sRGB, and the pixel is read back. One canvas per document. */

const swatches = new WeakMap();

/**
 * Any CSS colour string, as sRGB 0–1, painted and read back. `[0, 0, 0]`
 * where a 2D context is unavailable.
 * @param {Document} doc @param {string} css
 * @returns {[number, number, number]}
 */
export function toSrgb(doc, css) {
  let g = swatches.get(doc);
  if (g === undefined) {
    g = doc.createElement("canvas").getContext("2d", { willReadFrequently: true });
    swatches.set(doc, g);
  }
  if (!g) return [0, 0, 0];
  g.clearRect(0, 0, 1, 1);
  g.fillStyle = css;
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return [r / 255, gr / 255, b / 255];
}

/**
 * A role variable's resolved sRGB, read through a probe element on `host`,
 * so a band or a product override that remaps the role is followed.
 * @param {Element} host @param {string} prop e.g. "--slc-accent"
 * @returns {[number, number, number]}
 */
export function roleColour(host, prop) {
  const doc = host.ownerDocument;
  const probe = doc.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${prop})`;
  host.append(probe);
  const css = getComputedStyle(probe).color;
  probe.remove();
  return toSrgb(doc, css);
}
```

- [ ] **Step 3: Make `live-light.js` use it**

In `packages/ui-kit/live-light.js`, delete the block from `let swatch = null;` through the closing `}` of `function roleColour(host, prop) { … }` (lines 127–148, including its JSDoc), and add as the first line after the header comment (before `const HOSTS = …`):

```js
import { roleColour } from "./colour.js";
```

In `packages/ui-kit/package.json` `files`, after `"live-light.js",` add:

```json
    "colour.js",
```

- [ ] **Step 4: Update the spec's colour bullet**

In `docs/specs/2026-09-28-halftone-dots-design.md`, replace the bullet starting `- **Shared colour reader**:` with:

```md
- **Shared colour reader**: `roleColour` in `live-light.js` (probe element + 1 px canvas) moves to an internal `packages/ui-kit/colour.js`, split in two: `toSrgb(doc, css)` paints any CSS colour string and reads it back; `roleColour(host, prop)` probes a role variable and calls `toSrgb`. `live-light.js` keeps calling `roleColour`; `halftone.js` calls `toSrgb` on the canvas's computed `color`. `colour.js` ships in `files` but is not a public export.
```

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, every test (the kit's full suite, including `live-light.test.mjs` whose fake page gives `getContext("2d")` a `getImageData`).

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/colour.js packages/ui-kit/live-light.js packages/ui-kit/package.json scripts/live-light.test.mjs docs/specs/2026-09-28-halftone-dots-design.md
git commit -m "refactor(effects): one colour reader, shared by live light and the halftone

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The runtime — `halftone.js`

**Files:**
- Create: `packages/ui-kit/halftone.js`
- Create: `packages/ui-kit/halftone.d.ts`
- Create: `scripts/halftone.test.mjs`
- Modify: `scripts/types-drift.test.mjs:15`
- Modify: `packages/ui-kit/package.json` (`exports`, `files`)

**Interfaces:**
- Consumes: `sampleDots`, `dotFrame`, `settledFrame`, `cover` (Task 1); `toSrgb(doc, css)` (Task 3).
- Produces: `halftone(root?: Document | Element): { stop(): void; ready: Promise<void> }`. Markup contract: `canvas[data-sl-halftone]` with `data-sl-src` (required), `data-sl-grid` (optional, 16–256, default 96), `data-sl-seed` (optional integer).

- [ ] **Step 1: Write the failing tests**

Create `scripts/halftone.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// The runtime is judged on when it asks for frames and what it draws, driven
// against a minimal fake page, as live-light.test.mjs does.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "halftone.js"), "utf8");
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const { halftone } = await import(pathToFileURL(resolve(KIT, "halftone.js")).href);

/** A fake page: elements, a rAF queue, a clock, observers the test drives, and
 *  2D contexts that record every arc drawn on a visible canvas. */
function fakePage({ reduce = false, observe = true } = {}) {
  const keys = ["Element", "Image", "MutationObserver", "IntersectionObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "performance", "devicePixelRatio"];
  const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const page = { clock: 1000, queue: [], observers: [], io: [], ro: [], frames: [], listeners: new Map(), offscreen: [], ink: [240, 240, 240] };
  class Element {
    constructor(doc, tag, attrs = {}) {
      Object.assign(this, { ownerDocument: doc, tagName: tag.toUpperCase(), attrs: { ...attrs }, children: [], parent: null, isConnected: true, clientWidth: 200, style: {} });
    }
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
    hasAttribute(n) { return n in this.attrs; }
    setAttribute(n, v) { this.attrs[n] = String(v); }
    removeAttribute(n) { delete this.attrs[n]; }
    append(c) { c.parent = this; this.children.push(c); }
    remove() {}
    matches(sel) { return sel === "canvas[data-sl-halftone]" && this.tagName === "CANVAS" && "data-sl-halftone" in this.attrs; }
    closest(sel) {
      for (let n = this; n; n = n.parent) if (sel === '[data-sl-fx="off"]' && n.attrs["data-sl-fx"] === "off") return n;
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } };
      walk(this);
      return out;
    }
  }
  const doc = {
    visibilityState: "visible",
    createElement(tag) {
      const el = new Element(doc, tag);
      if (tag === "canvas") {
        el.getContext = () => {
          const frame = [];
          return {
            setTransform() {}, clearRect() { if (el.isConnected) { frame.length = 0; } }, beginPath() {}, moveTo() {},
            arc(x, y, r) { frame.push([x, y, r]); },
            fill() { if (el.visible) page.frames.push({ canvas: el, dots: frame.slice() }); },
            fillRect() {}, drawImage(...a) { el.drawn = a; },
            getImageData: (_x, _y, w) => {
              if (w === 1) return { data: [...page.ink, 255] };
              if (el.drawn?.[0]?.src.includes("other-origin")) throw new Error("SecurityError");
              const px = new Uint8ClampedArray(w * w * 4);
              for (let k = 0; k < px.length; k += 4) { px[k] = px[k + 1] = px[k + 2] = ((k / 4) % w) * (255 / w); px[k + 3] = 255; }
              return { data: px };
            },
          };
        };
        page.offscreen.push(el);
      }
      return el;
    },
    addEventListener(type, cb) { page.listeners.set(type, cb); },
    removeEventListener(type, cb) { if (page.listeners.get(type) === cb) page.listeners.delete(type); },
    querySelectorAll(sel) { return doc.body.querySelectorAll(sel); },
  };
  doc.documentElement = new Element(doc, "html");
  doc.body = new Element(doc, "body");
  doc.documentElement.append(doc.body);
  globalThis.Element = Element;
  globalThis.Image = class {
    set src(v) { this._src = v; }
    get src() { return this._src; }
    get naturalWidth() { return 400; }
    get naturalHeight() { return 300; }
    decode() { return this._src.includes("missing") ? Promise.reject(new Error("404")) : Promise.resolve(); }
  };
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; page.observers.push(this); }
    observe(target, opts) { this.target = target; this.opts = opts; }
    disconnect() { this.off = true; }
  };
  if (observe) {
    globalThis.IntersectionObserver = class {
      constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = []; page.io.push(this); }
      observe(t) { this.targets.push(t); }
      unobserve() {}
      disconnect() { this.off = true; }
    };
    globalThis.ResizeObserver = class {
      constructor(cb) { this.cb = cb; this.targets = []; page.ro.push(this); }
      observe(t) { this.targets.push(t); }
      unobserve() {}
      disconnect() { this.off = true; }
    };
  } else {
    delete globalThis.IntersectionObserver;
    delete globalThis.ResizeObserver;
  }
  globalThis.getComputedStyle = () => ({ color: "ink" });
  globalThis.matchMedia = () => ({ matches: reduce });
  let id = 0;
  globalThis.requestAnimationFrame = (cb) => { page.queue.push(cb); return ++id; };
  globalThis.cancelAnimationFrame = () => { page.queue.length = 0; };
  globalThis.devicePixelRatio = 1;
  Object.defineProperty(globalThis, "performance", { value: { now: () => page.clock }, configurable: true, writable: true });
  page.doc = doc;
  page.canvas = (attrs = {}, parent = doc.body) => {
    const c = doc.createElement("canvas");
    Object.assign(c.attrs, { "data-sl-halftone": "", "data-sl-src": "/a.png", ...attrs });
    c.visible = true;
    parent.append(c);
    return c;
  };
  /** Every scene near and seen, as IntersectionObserver would report once scrolled to. */
  page.show = (canvas) => {
    for (const o of page.io) o.cb([{ target: canvas, isIntersecting: true }]);
  };
  page.tick = (ms = 16) => {
    page.clock += ms;
    const q = page.queue.splice(0);
    for (const cb of q) cb(page.clock);
    return q.length;
  };
  page.attr = (name, value) => {
    if (value === null) doc.documentElement.removeAttribute(name);
    else doc.documentElement.setAttribute(name, value);
    for (const o of page.observers) if (o.target === doc.documentElement && !o.off) o.cb([{ type: "attributes", target: doc.documentElement, attributeName: name }]);
  };
  page.restore = () => {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  };
  return page;
}

test("halftone.js contains no colour literal: the ink is the canvas's own colour", () => {
  assert.deepEqual(js.match(COLOUR) || [], []);
});

test("importing the module has no side effects", async () => {
  await assert.doesNotReject(import(`${pathToFileURL(resolve(KIT, "halftone.js")).href}?import`));
});

test("nothing is drawn until the scene is seen; then it gathers and keeps moving while near", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  page.tick();
  assert.equal(page.frames.length, 0, "not seen, not drawn");
  page.show(c);
  assert.equal(page.tick(), 1);
  assert.ok(page.frames.at(-1).dots.length > 0, "dots drawn");
  assert.equal(page.queue.length, 1, "the loop asks for the next frame");
});

test("a scene that leaves the viewport stops the loop", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  page.tick();
  for (const o of page.io) o.cb([{ target: c, isIntersecting: false }]);
  page.tick();
  assert.equal(page.queue.length, 0);
});

test("reduced motion: one settled frame and no loop; data-sl-fx-motion=always restores the motion", async (t) => {
  const page = fakePage({ reduce: true });
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32", "data-sl-seed": "3" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  assert.equal(page.tick(), 1);
  assert.equal(page.queue.length, 0, "no loop");
  const settled = page.frames.at(-1).dots;
  assert.ok(settled.length > 0);
  // Every dot sits on the lattice: the settled frame, not a gathering one.
  for (const [x] of settled) assert.ok(Math.abs(((x / 200) * 32) % 1 - 0.5) < 1e-9, `x ${x} off the lattice`);
  page.attr("data-sl-fx-motion", "always");
  page.tick();
  assert.equal(page.queue.length, 1, "the derogation brings the loop back");
});

test("still: the frame that sees the flag is drawn, none after; cleared, it resumes where it froze", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32", "data-sl-seed": "5" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  page.tick(16);
  page.tick(16);
  page.attr("data-sl-fx-still", "");
  page.tick(16);
  assert.equal(page.queue.length, 0, "held: no further frame");
  const frozen = page.frames.at(-1).dots;
  page.clock += 60_000;
  page.attr("data-sl-fx-still", null);
  assert.equal(page.queue.length, 1, "cleared: a frame is asked for");
  page.tick(0);
  assert.deepEqual(page.frames.at(-1).dots, frozen, "resumes at the frozen instant");
  assert.equal(page.queue.length, 1, "and the loop runs again");
});

test('a canvas under data-sl-fx="off" is never armed', async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const off = page.doc.createElement("div");
  off.setAttribute("data-sl-fx", "off");
  page.doc.body.append(off);
  const c = page.canvas({}, off);
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  page.tick();
  assert.equal(page.frames.length, 0);
});

test("a picture that fails, or taints its canvas, leaves the others drawing", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const missing = page.canvas({ "data-sl-src": "/missing.png" });
  const tainted = page.canvas({ "data-sl-src": "https://other-origin.test/a.png" });
  const good = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  for (const c of [missing, tainted, good]) page.show(c);
  page.tick();
  const drawn = new Set(page.frames.map((f) => f.canvas));
  assert.ok(drawn.has(good), "the good one draws");
  assert.ok(!drawn.has(missing), "the missing one does not");
  assert.ok(!drawn.has(tainted), "nor the tainted one");
});

test("a bad grid falls back to 96, a huge one is clamped to 256, a tiny one to 16", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  page.canvas({ "data-sl-grid": "abc" });
  page.canvas({ "data-sl-grid": "5000" });
  page.canvas({ "data-sl-grid": "2" });
  const start = page.offscreen.length;
  const { ready } = halftone(page.doc);
  await ready;
  const sizes = page.offscreen.slice(start).filter((c) => c.drawn).map((c) => c.width).sort((a, b) => a - b);
  assert.deepEqual(sizes, [32, 192, 512]);
});

test("a wide picture is centre-cropped, not squashed", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  page.canvas({ "data-sl-grid": "32" });
  const start = page.offscreen.length;
  const { ready } = halftone(page.doc);
  await ready;
  const off = page.offscreen.slice(start).find((c) => c.drawn);
  // Image is 400×300: source square is x 50..350.
  assert.deepEqual(off.drawn.slice(1), [50, 0, 300, 300, 0, 0, 64, 64]);
});

test("a canvas with no width draws nothing and does not throw; given a size, it draws", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  c.clientWidth = 0;
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  assert.doesNotThrow(() => page.tick());
  assert.equal(page.frames.length, 0);
  for (const o of page.ro) o.cb([{ target: c, contentRect: { width: 180 } }]);
  page.tick();
  assert.ok(page.frames.length > 0);
});

test("canvases added later are armed", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const h = halftone(page.doc);
  await h.ready;
  const late = page.canvas({ "data-sl-grid": "32" });
  const added = page.observers.find((o) => o.opts?.childList);
  added.cb([{ type: "childList", addedNodes: [late], removedNodes: [] }]);
  await new Promise((r) => setTimeout(r, 0));
  page.show(late);
  page.tick();
  assert.ok(page.frames.some((f) => f.canvas === late));
});

test("stop() disconnects every observer, drops the listener and cancels the frame", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const h = halftone(page.doc);
  await h.ready;
  page.show(c);
  page.tick();
  h.stop();
  for (const o of [...page.observers, ...page.io, ...page.ro]) assert.ok(o.off, "an observer is still connected");
  assert.ok(!page.listeners.has("visibilitychange"));
  assert.equal(page.queue.length, 0);
});

test("without IntersectionObserver every scene counts as near and seen (fail open)", async (t) => {
  const page = fakePage({ observe: false });
  t.after(page.restore);
  page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  page.tick();
  assert.ok(page.frames.length > 0);
});

test("a theme flip to dark ink resamples as a print of the picture's dark", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32", "data-sl-seed": "1" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  // The fake picture is a ramp, dark on the left, light on the right; the
  // weight of the dots (their radius) says which side is being printed.
  const centre = (dots) => dots.reduce((s, [x, , r]) => s + x * r, 0) / dots.reduce((s, [, , r]) => s + r, 0);
  page.tick(5000);                               // gathered: dots at their places
  assert.ok(centre(page.frames.at(-1).dots) > 100, "light ink draws the light side");
  page.ink = [20, 20, 20];
  page.attr("data-sl-theme", "light");
  page.tick(16);
  assert.ok(centre(page.frames.at(-1).dots) < 100, "dark ink prints the dark side");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/halftone.test.mjs`
Expected: FAIL: `Cannot find module …/halftone.js`.

- [ ] **Step 3: Write the runtime**

Create `packages/ui-kit/halftone.js`:

```js
/* @sondalab/ui-kit — halftone.js
   The live half of the halftone: every canvas[data-sl-halftone] under a root
   becomes its picture in dots, gathering the first time it is 40% in view,
   then floating. The maths is halftone-core.js, the same an export prints.

     <canvas data-sl-halftone data-sl-src="/art/kinship.png"
             data-sl-grid="130" aria-hidden="true"></canvas>

   COLOUR: the canvas's own inherited `color`, so a scene on an inversion band
   prints in the band's ink. Ink darker than mid-grey prints the picture's
   dark (a halftone on paper); light ink draws its light. A theme change that
   flips the polarity resamples; one that only changes the colour repaints.

   MOTION: one frame loop for every scene, running only while one is within
   200px of the viewport and the page is visible. Under reduced motion each
   scene draws its settled frame, once, when seen, resized or re-themed; the
   picture is content, so it is shown, not refused. mount()'s
   ignoreReducedMotion writes data-sl-fx-motion="always", which brings the
   motion back. data-sl-fx-still on <html> holds every scene where it is and
   resumes it from there, as live-light.js does.

   OFF: a canvas under data-sl-fx="off" is never armed; under high contrast
   effects.css hides it and nothing is drawn. */

import { sampleDots, dotFrame, settledFrame, cover } from "./halftone-core.js";
import { toSrgb } from "./colour.js";

const SEL = "canvas[data-sl-halftone]";
const GRID = 96;
const MIN_GRID = 16;
const MAX_GRID = 256;
const REDUCE = "(prefers-reduced-motion: reduce)";
const STILL = "data-sl-fx-still";
const MOTION = "data-sl-fx-motion";

function gridOf(canvas) {
  const n = Math.round(Number(canvas.getAttribute("data-sl-grid")));
  return n > 0 ? Math.min(MAX_GRID, Math.max(MIN_GRID, n)) : GRID;
}

function seedOf(canvas) {
  const raw = canvas.getAttribute("data-sl-seed");
  return raw === null || !Number.isFinite(Number(raw)) ? undefined : Number(raw);
}

/** Ink darker than mid-grey prints the picture's dark. */
function darkInk([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.5;
}

/** Decode the picture, crop its centred square, keep its bytes at twice the grid. */
async function load(canvas) {
  const doc = canvas.ownerDocument;
  const img = new Image();
  img.src = canvas.getAttribute("data-sl-src");
  await img.decode();
  const grid = gridOf(canvas);
  const size = grid * 2;
  const off = doc.createElement("canvas");
  off.width = off.height = size;
  const g = off.getContext("2d", { willReadFrequently: true });
  const c = cover(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, c.sx, c.sy, c.s, c.s, 0, 0, size, size);
  // Throws on a picture from another origin without CORS: the scene is dropped.
  const px = g.getImageData(0, 0, size, size).data;
  return { canvas, grid, px, seed: seedOf(canvas), dots: [], ink: "", dark: false, t0: null, near: false, width: canvas.clientWidth };
}

/**
 * Brings every `canvas[data-sl-halftone]` under `root` to life and follows
 * canvases added later, theme changes, and the still flag. `ready` settles
 * once the canvases present now have loaded (a failed one is skipped).
 * @param {Document|Element} [root]
 * @returns {{stop(): void, ready: Promise<void>}}
 */
export function halftone(root = document) {
  const doc = root.ownerDocument || root;
  const html = doc.documentElement;
  const scenes = new Map();
  const pending = new Set();
  const reduce = globalThis.matchMedia?.(REDUCE) ?? { matches: false };
  const hasIO = typeof IntersectionObserver === "function";
  let raf = 0;
  let stillAt = null;
  let stopped = false;

  const moving = () => !reduce.matches || html.getAttribute(MOTION) === "always";
  const contrast = () => html.getAttribute("data-sl-theme") === "high-contrast";

  function paint(s) {
    s.ink = getComputedStyle(s.canvas).color;
    const dark = darkInk(toSrgb(doc, s.ink));
    if (dark !== s.dark || s.dots.length === 0) {
      s.dark = dark;
      s.dots = sampleDots(s.px, s.grid * 2, { grid: s.grid, invert: dark, seed: s.seed });
    }
  }

  function draw(s, now) {
    const w = s.width;
    if (!w) return false;
    const dpr = globalThis.devicePixelRatio || 1;
    const side = Math.round(w * dpr);
    if (s.canvas.width !== side) s.canvas.width = s.canvas.height = side;
    const g = s.canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, w);
    if (contrast()) return false;
    const still = !moving();
    const t = (now - s.t0) / 1000;
    g.fillStyle = s.ink;
    g.beginPath();
    for (const d of s.dots) {
      const f = still ? settledFrame(d, w, s.grid) : dotFrame(d, t, w, s.grid);
      if (f.r <= 0) continue;
      g.moveTo(f.x + f.r, f.y);
      g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    }
    g.fill();
    return true;
  }

  function frame(now) {
    raf = 0;
    const hold = html.hasAttribute(STILL);
    // Held: every frame draws the instant it froze at. Released: each scene's
    // origin moves by the pause, so it picks up where it stopped.
    if (hold) stillAt ??= now;
    else if (stillAt !== null) {
      for (const s of scenes.values()) if (s.t0 !== null) s.t0 += now - stillAt;
      stillAt = null;
    }
    let drawn = 0;
    for (const s of scenes.values()) {
      if (!s.canvas.isConnected) { forget(s); continue; }
      if (s.near && s.t0 !== null && draw(s, hold ? stillAt : now)) drawn++;
    }
    if (drawn && moving() && !hold && doc.visibilityState !== "hidden") raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!raf && !stopped) raf = requestAnimationFrame(frame);
  }

  const near = hasIO && new IntersectionObserver((entries) => {
    for (const e of entries) { const s = scenes.get(e.target); if (s) s.near = e.isIntersecting; }
    wake();
  }, { rootMargin: "200px" });
  const seen = hasIO && new IntersectionObserver((entries) => {
    for (const e of entries) {
      const s = scenes.get(e.target);
      if (s && e.isIntersecting && s.t0 === null) s.t0 = performance.now();
    }
    wake();
  }, { threshold: 0.4 });
  const size = typeof ResizeObserver === "function" && new ResizeObserver((entries) => {
    for (const e of entries) { const s = scenes.get(e.target); if (s) s.width = e.contentRect.width; }
    wake();
  });

  function adopt(s) {
    if (stopped) return;
    paint(s);
    scenes.set(s.canvas, s);
    if (hasIO) { near.observe(s.canvas); seen.observe(s.canvas); }
    else { s.near = true; s.t0 = performance.now(); }
    if (size) size.observe(s.canvas);
    wake();
  }

  function forget(s) {
    scenes.delete(s.canvas);
    if (hasIO) { near.unobserve(s.canvas); seen.unobserve(s.canvas); }
    if (size) size.unobserve(s.canvas);
  }

  function scan(n) {
    const found = n.matches?.(SEL) ? [n] : [];
    found.push(...(n.querySelectorAll?.(SEL) ?? []));
    const loads = [];
    for (const c of found) {
      if (scenes.has(c) || pending.has(c) || c.closest('[data-sl-fx="off"]')) continue;
      pending.add(c);
      loads.push(load(c).then(adopt).finally(() => pending.delete(c)));
    }
    return Promise.allSettled(loads);
  }

  const ready = scan(root).then(() => {});

  const added = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) scan(n);
  });
  added.observe(root, { childList: true, subtree: true });

  const theme = new MutationObserver((records) => {
    if (!records.every((r) => r.attributeName === STILL)) for (const s of scenes.values()) paint(s);
    wake();
  });
  theme.observe(html, { attributes: true, attributeFilter: ["data-sl-theme", STILL, MOTION] });

  doc.addEventListener("visibilitychange", wake);

  return {
    ready,
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (hasIO) { near.disconnect(); seen.disconnect(); }
      if (size) size.disconnect();
      added.disconnect();
      theme.disconnect();
      doc.removeEventListener("visibilitychange", wake);
    },
  };
}
```

Create `packages/ui-kit/halftone.d.ts`:

```ts
export interface HalftoneHandle {
  /** Settles once the canvases present at the call have loaded; a failed picture is skipped. */
  ready: Promise<void>;
  /** Cancel the frame and disconnect every observer. Canvases keep their last frame. */
  stop(): void;
}

/**
 * Arm every `canvas[data-sl-halftone]` under `root` (`data-sl-src` required;
 * `data-sl-grid` 16–256, default 96; `data-sl-seed` optional) and follow
 * canvases added later. `mount()` calls this; call it yourself only without `mount()`.
 */
export declare function halftone(root?: Document | Element): HalftoneHandle;
```

- [ ] **Step 4: Register the module**

In `scripts/types-drift.test.mjs` line 15:

```js
const MODULES = ["effects", "goo-field", "geom", "glass-text", "halftone-core", "halftone"];
```

In `packages/ui-kit/package.json`: `exports` after `"./halftone-core.js": "./halftone-core.js",` add `"./halftone.js": "./halftone.js",`; `files` after `"halftone-core.js",` add `"halftone.js",` and after `"halftone-core.d.ts",` add `"halftone.d.ts",`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/halftone.test.mjs scripts/halftone-core.test.mjs scripts/types-drift.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/halftone.js packages/ui-kit/halftone.d.ts packages/ui-kit/package.json scripts/halftone.test.mjs scripts/types-drift.test.mjs
git commit -m "feat(halftone): the runtime — canvases in dots, gated, still-aware, stoppable

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire into `mount()`, high contrast, docs, 0.19.0

**Files:**
- Modify: `packages/ui-kit/effects.js` (new `armHalftone` beside `armGooFields` ~line 1030; call in `mount()` after `mountGoo(root);` at ~line 1289; the `ignoreReducedMotion` JSDoc at ~line 1263)
- Modify: `packages/ui-kit/effects.css` (high-contrast rule, after the block at ~line 186)
- Modify: `scripts/effects-guards.test.mjs` (append two tests)
- Modify: `packages/ui-kit/README.md` (Effects section; the `ignoreReducedMotion` comment in the code block ~line 94)
- Modify: `packages/ui-kit/agent/catalog.md` (`## Effects`, new `### Halftone` entry)
- Modify: `packages/ui-kit/agent/catalog.json` (new `fx-halftone` entry)
- Modify: `packages/ui-kit/package.json` (`"version": "0.19.0"`)

**Interfaces:**
- Consumes: `halftone(root)` (Task 4).

- [ ] **Step 1: Write the failing guards**

Append to `scripts/effects-guards.test.mjs`:

```js
test("mount() arms the halftone before the reduced-motion guard: the picture is content", () => {
  const body = jsFnBody("mount");
  const arm = body.indexOf("armHalftone(root)");
  const guard = body.indexOf("window.matchMedia(REDUCE)");
  assert.ok(arm > -1, "mount() calls armHalftone(root)");
  assert.ok(arm < guard, "and before the motion guard");
  assert.match(jsFnBody("armHalftone"), /import\("\.\/halftone\.js"\)/, "lazily, like the goo and the live light");
});

test("high contrast hides every halftone canvas", () => {
  assert.match(effects, /:root\[data-sl-theme="high-contrast"\] \[data-sl-halftone\]\s*\{\s*display:\s*none;?\s*\}/);
});
```

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL on both new tests.

- [ ] **Step 2: Wire it**

In `packages/ui-kit/effects.js`, directly after the `armLiveLight` function, add:

```js
/** Every canvas[data-sl-halftone] drawn in dots (halftone.js). Dynamically
 *  imported, like the goo and the live light; it follows canvases added
 *  later and owns its own reduced-motion rule (a settled frame, not nothing).
 *  @param {ParentNode} root
 *  @returns {Promise<void>} */
let halftoneArmed = false;
async function armHalftone(root) {
  if (halftoneArmed) return;
  halftoneArmed = true;
  let halftone;
  try { ({ halftone } = await import("./halftone.js")); } catch { return; }
  halftone(root);
}
```

In `mount()`, directly after `mountGoo(root);`, add:

```js
  // The halftone goes with the goo, on the goo's argument: the picture is
  // content. Under reduced motion it draws its settled frame, not nothing.
  armHalftone(root);
```

In the `mount()` JSDoc, replace the sentence `It arms Tier 1 for a visitor reporting \`prefers-reduced-motion: reduce\` and lets the GLITCH animate for them;` with `It arms Tier 1 for a visitor reporting \`prefers-reduced-motion: reduce\` and lets the GLITCH and the HALFTONE's gather-and-float animate for them;`.

In `packages/ui-kit/effects.css`, after the rule block that starts at the `:root[data-sl-theme="high-contrast"] :is(.sl-fx-glass, …` selector (~line 186) closes, add:

```css
/* A halftone is a picture made of spacing and size: high contrast shows none. */
:root[data-sl-theme="high-contrast"] [data-sl-halftone] { display: none; }
```

Read ≥ 20 lines above the insertion point first and confirm the new rule sits at top level, not inside an `@media` or `@supports` block.

- [ ] **Step 3: Run the guards**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: PASS.

- [ ] **Step 4: Docs**

In `packages/ui-kit/README.md`:
- In the `mount()` code block's comment (~line 94), replace `// GLITCH alone; high contrast still refuses.` with `// GLITCH and the HALFTONE's motion; high contrast still refuses.`
- In `## Effects`, after the `### Goo` entry ends (before the next `###`), add:

````md
### Halftone — `data-sl-halftone` (0.19.0)

A picture drawn in round dots whose size follows its light, inside a circle that dissolves at its edge — sondalab.eu's stance and method vignettes. The dots gather the first time the canvas is 40% in view, then float. The ink is the canvas's own `color`: dark ink prints the picture's dark (a halftone on paper), light ink its light. Armed by `mount()`, or by `halftone(root)` from `@sondalab/ui-kit/halftone.js` without it. Under reduced motion the settled picture is drawn, still; `data-sl-fx-still` holds it; high contrast hides it.

```html
<canvas data-sl-halftone data-sl-src="/art/kinship.png" data-sl-grid="130" aria-hidden="true"
        style="width: 22rem; aspect-ratio: 1"></canvas>
```

`data-sl-grid` is cells per side (16–256, default 96); `data-sl-seed` fixes which edge dots survive and how they scatter. A non-square picture is centre-cropped. **What reads as dots:** one iconic subject with near-binary contrast, drawn at ≥ 320px with a grid near 130; busy photos and dark renders do not. The engine is `@sondalab/ui-kit/halftone-core.js` (`sampleDots`, `dotFrame`, `settledFrame`, `toSVG`, `cover`), and `tools/halftone/` in the repo turns any picture into an SVG or PNG with the same dots.
````

In `packages/ui-kit/agent/catalog.md`, under `## Effects`, after the Goo entry, add:

````md
### Halftone — `data-sl-halftone`
A picture in round dots whose size follows its light, in a circle that dissolves at its edge; gathers when first seen, then floats. Content, not decoration: under reduced motion it is drawn still. Substrate: **R** Page, **A** App.
```html
<canvas data-sl-halftone data-sl-src="/art/subject.png" data-sl-grid="130" aria-hidden="true"
        style="width: 22rem; aspect-ratio: 1; color: var(--slc-text)"></canvas>
```
Consumes: the canvas's inherited `color` (set it with a role-var, e.g. `var(--slc-text)` or `var(--slc-accent)`). Don't: feed it a busy photo or a dark render — only one iconic subject with near-binary contrast reads, at ≥ 320px with a grid near 130. Don't: give it meaning — it is a picture, so a label or caption says what it shows; keep `aria-hidden` when the text beside it already does.
````

In `packages/ui-kit/agent/catalog.json`, add to `components` after the `fx-glitch` entry (`catalog-audit.test.mjs` checks json ↔ md parity; an effect with no class is matched on its id words):

```json
    { "id": "fx-halftone", "kind": "effect", "classes": [], "roleVars": [] },
```

Set `"version": "0.19.0"` in `packages/ui-kit/package.json`.

- [ ] **Step 5: Full suite and audit**

Run in parallel:
- `npm test`
- `npm run audit`

Expected: all tests PASS (including `catalog-audit.test.mjs`, which audits every catalog snippet, the new one included); `npm run audit` reports no violation.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/effects.js packages/ui-kit/effects.css packages/ui-kit/README.md packages/ui-kit/agent/catalog.md packages/ui-kit/agent/catalog.json packages/ui-kit/package.json scripts/effects-guards.test.mjs
git commit -m "feat(effects): 0.19.0 — mount() draws halftone canvases; high contrast hides them

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The export page — `tools/halftone/`

**Files:**
- Create: `tools/halftone/index.html`
- Create: `tools/README.md`

**Interfaces:**
- Consumes: `sampleDots`, `dotFrame`, `settledFrame`, `cover`, `toSVG` from `../../packages/ui-kit/halftone-core.js`; `roleColour` from `../../packages/ui-kit/colour.js` (internal to the kit, reachable here because the page runs from the repo); the kit's `tokens.css`, `components.css`, `fonts.css`, `themes/*.css`.

- [ ] **Step 1: Write the page**

Create `tools/halftone/index.html`:

```html
<!doctype html>
<html lang="en" data-sl-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Halftone — Sondalab</title>
<link rel="stylesheet" href="../../packages/ui-kit/fonts.css">
<link rel="stylesheet" href="../../packages/ui-kit/tokens.css">
<link rel="stylesheet" href="../../packages/ui-kit/themes/dark.css">
<link rel="stylesheet" href="../../packages/ui-kit/themes/light.css">
<link rel="stylesheet" href="../../packages/ui-kit/components.css">
<style>
  body { margin: 0; background: var(--slc-canvas); color: var(--slc-text); font-family: var(--sl-font-sans); }
  .ht { display: grid; grid-template-columns: minmax(18rem, 26rem) 1fr; min-height: 100vh; }
  .ht__side { padding: 3rem 2.5rem; border-right: 1px solid var(--slc-border-subtle); display: flex; flex-direction: column; gap: 1.5rem; }
  .ht__title { font-family: var(--sl-font-display); font-size: clamp(3.5rem, 7vw, 6rem); line-height: .9; letter-spacing: -.03em; margin: 0; }
  .ht__stage { display: grid; place-items: center; padding: 3rem; position: relative; }
  .ht__stage canvas { width: min(70vh, 100%); aspect-ratio: 1; }
  .ht__drop { position: absolute; inset: 1.5rem; border: 1px dashed var(--slc-border-strong); display: none; place-items: center; }
  .ht.is-over .ht__drop { display: grid; }
  .ht__row { display: flex; gap: .75rem; flex-wrap: wrap; }
  .ht__note { font-size: var(--sl-text-sm); color: var(--slc-text-muted); margin: 0; }
  .ht__side label { display: flex; flex-direction: column; gap: .35rem; }
  @media (max-width: 52rem) { .ht { grid-template-columns: 1fr; } .ht__side { border-right: 0; border-bottom: 1px solid var(--slc-border-subtle); } }
</style>
</head>
<body>
<main class="ht">
  <aside class="ht__side">
    <p class="sl-eyebrow">Tools · @sondalab/ui-kit</p>
    <h1 class="ht__title">Half&shy;tone</h1>
    <label class="sl-field"><span class="sl-field__label">Picture</span>
      <input class="sl-field__input" id="file" type="file" accept="image/*"></label>
    <label class="sl-field"><span class="sl-field__label">Grid — <output id="gridOut">130</output> cells</span>
      <input id="grid" type="range" min="48" max="200" value="130"></label>
    <label class="sl-field"><span class="sl-field__label">Ink</span>
      <select class="sl-select" id="ink">
        <option value="paper">Light dots on the dark ground</option>
        <option value="ink">Ink dots on paper</option>
        <option value="accent">Accent dots on the dark ground</option>
      </select></label>
    <label class="sl-field"><span class="sl-field__label">Invert</span>
      <select class="sl-select" id="invert">
        <option value="auto">Auto — from the ink</option>
        <option value="on">Print the dark</option>
        <option value="off">Print the light</option>
      </select></label>
    <label class="sl-check"><input class="sl-check__input" id="ground" type="checkbox"><span class="sl-check__box"></span><span class="sl-check__label">Include the ground in exports</span></label>
    <label class="sl-field"><span class="sl-field__label">Export size, px</span>
      <input class="sl-field__input" id="size" type="number" min="256" max="8192" step="64" value="2048"></label>
    <div class="ht__row">
      <label class="sl-field" style="flex:1"><span class="sl-field__label">Seed</span>
        <input class="sl-field__input" id="seed" type="number" value="1"></label>
      <button class="sl-btn sl-btn--ghost" id="reroll" type="button" style="align-self:end">Reroll</button>
    </div>
    <label class="sl-check"><input class="sl-check__input" id="settled" type="checkbox"><span class="sl-check__box"></span><span class="sl-check__label">Show the exported frame</span></label>
    <div class="ht__row">
      <button class="sl-btn sl-btn--primary" id="svg" type="button" disabled>Download SVG</button>
      <button class="sl-btn sl-btn--ghost" id="png" type="button" disabled>Download PNG</button>
    </div>
    <p class="ht__note">Reads as dots only when the subject is one iconic outline with near-binary contrast, at ≥ 320px with a grid near 130. Busy photos and dark renders do not. A non-square picture is centre-cropped.</p>
  </aside>
  <section class="ht__stage" id="stage">
    <canvas id="view" aria-label="Preview"></canvas>
    <div class="ht__drop">Drop a picture</div>
  </section>
</main>
<script type="module">
import { sampleDots, dotFrame, settledFrame, cover, toSVG } from "../../packages/ui-kit/halftone-core.js";
import { roleColour } from "../../packages/ui-kit/colour.js";

const $ = (id) => document.getElementById(id);
const view = $("view");
const state = { img: null, name: "halftone", px: null, grid: 130, dots: [], t0: 0, pal: null };
const THEMES = { paper: ["dark", "--slc-text"], ink: ["light", "--slc-text"], accent: ["dark", "--slc-accent"] };
const hex = (rgb) => "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

/** The chosen ink and ground as #rrggbb, read off the kit's role variables:
 *  a computed colour can serialise as oklab() or color(), which design tools
 *  do not reliably read, so every exported fill is plain sRGB hex. */
function palette() {
  const [theme, role] = THEMES[$("ink").value];
  document.documentElement.setAttribute("data-sl-theme", theme);
  const root = document.body;
  return { ink: hex(roleColour(root, role)), ground: hex(roleColour(root, "--slc-canvas")), theme };
}

function invert(pal) {
  const v = $("invert").value;
  return v === "auto" ? pal.theme === "light" : v === "on";
}

function resample() {
  if (!state.img) return;
  state.grid = Number($("grid").value);
  const size = state.grid * 2;
  const off = Object.assign(document.createElement("canvas"), { width: size, height: size });
  const g = off.getContext("2d", { willReadFrequently: true });
  const c = cover(state.img.naturalWidth, state.img.naturalHeight);
  g.drawImage(state.img, c.sx, c.sy, c.s, c.s, 0, 0, size, size);
  state.px = g.getImageData(0, 0, size, size).data;
  state.dots = sampleDots(state.px, size, { grid: state.grid, invert: invert(state.pal), seed: Number($("seed").value) });
  state.t0 = performance.now();
  $("svg").disabled = $("png").disabled = false;
}

/** Draw the dots on a 2D context `w` px square: the live frame, or the settled one. */
function paint(g, w, t, settled, pal, withGround) {
  g.clearRect(0, 0, w, w);
  if (withGround) { g.fillStyle = pal.ground; g.fillRect(0, 0, w, w); }
  g.fillStyle = pal.ink;
  g.beginPath();
  for (const d of state.dots) {
    const f = settled ? settledFrame(d, w, state.grid) : dotFrame(d, t, w, state.grid);
    if (f.r <= 0) continue;
    g.moveTo(f.x + f.r, f.y);
    g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  }
  g.fill();
}

function frame(now) {
  const w = view.clientWidth;
  const dpr = devicePixelRatio || 1;
  if (view.width !== Math.round(w * dpr)) view.width = view.height = Math.round(w * dpr);
  const g = view.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  paint(g, w, (now - state.t0) / 1000, $("settled").checked, state.pal, false);
  requestAnimationFrame(frame);
}

function download(blob, ext) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${state.name}-g${state.grid}-s${$("seed").value}.${ext}` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function open(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  state.img = img;
  state.name = file.name.replace(/\.[^.]+$/, "") || "halftone";
  resample();
}

$("file").addEventListener("change", (e) => open(e.target.files[0]));
$("grid").addEventListener("input", () => { $("gridOut").value = $("grid").value; resample(); });
$("ink").addEventListener("change", () => { state.pal = palette(); resample(); });
for (const id of ["invert", "seed"]) $(id).addEventListener("change", resample);
$("reroll").addEventListener("click", () => { $("seed").value = Math.floor(Math.random() * 1e6); resample(); });
$("svg").addEventListener("click", () => {
  const pal = state.pal;
  const size = Number($("size").value);
  download(new Blob([toSVG(state.dots, { size, grid: state.grid, color: pal.ink, background: $("ground").checked ? pal.ground : undefined })], { type: "image/svg+xml" }), "svg");
});
$("png").addEventListener("click", () => {
  const size = Number($("size").value);
  const out = Object.assign(document.createElement("canvas"), { width: size, height: size });
  paint(out.getContext("2d"), size, 0, true, state.pal, $("ground").checked);
  out.toBlob((b) => download(b, "png"), "image/png");
});
const stage = $("stage");
stage.addEventListener("dragover", (e) => { e.preventDefault(); document.querySelector(".ht").classList.add("is-over"); });
stage.addEventListener("dragleave", () => document.querySelector(".ht").classList.remove("is-over"));
stage.addEventListener("drop", (e) => { e.preventDefault(); document.querySelector(".ht").classList.remove("is-over"); open(e.dataTransfer.files[0]); });
state.pal = palette();
requestAnimationFrame(frame);
</script>
</body>
</html>
```

Create `tools/README.md`:

```md
# tools/

Pages that make assets with the kit, for marketing and for other projects. Not demos (`showcase/`), not probes (`lab/`), and not shipped in the npm package: each imports the kit from `../../packages/ui-kit/` so it always runs the working tree.

Serve the repo root over http (ES modules do not load from `file://`):

    python3 lab/_serve.py        # then http://localhost:8891/tools/halftone/

- `halftone/` — any picture as a halftone of round dots, the same engine as `data-sl-halftone`. Downloads SVG (vector, for print) and PNG at the chosen size; the seed makes an export reproducible.
```

- [ ] **Step 2: Check the token names the page uses exist**

Run: `grep -ohE -- "--slc-(canvas|text|text-muted|accent|border-subtle|border-strong):|--sl-font-(sans|display):|--sl-text-sm:" packages/ui-kit/tokens.css packages/ui-kit/components.css packages/ui-kit/themes/dark.css packages/ui-kit/themes/light.css | sort -u`
Expected: every name used in the page's `<style>` and `THEMES` appears. Replace any that does not with the kit's actual name for that role before going on.

- [ ] **Step 3: Verify in the browser**

Run: `python3 lab/_serve.py` (background), open `http://localhost:8891/tools/halftone/`. Load a high-contrast single-subject PNG (e.g. `packages/ui-kit/assets/sondalab-avatar-ink.png`). Check, with screenshots:
- the preview gathers then floats; "Show the exported frame" freezes it at rest;
- each ink option changes the ground and dot colour, and "Ink dots on paper" prints the dark;
- Download SVG: open the file, it renders the settled frame; download twice with the same seed and `cmp` the two files: identical; `grep -oE 'fill="[^"]+"' <file>.svg` shows only `#rrggbb` values (ink, and ground when included);
- Download PNG at 2048: the file is 2048×2048 (`sips -g pixelWidth -g pixelHeight <file>`);
- a 16:9 picture is centre-cropped, not squashed;
- at 390px viewport width the layout stacks with no horizontal scroll.

- [ ] **Step 4: Commit**

```bash
git add tools/
git commit -m "feat(tools): halftone export page — any picture as the kit's dots, to SVG or PNG

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Browser check of the runtime, then PR

**Files:**
- Create (not committed; `lab/*.html` is git-ignored): `lab/halftone-runtime.html`

- [ ] **Step 1: A probe page**

Copy `lab/_template.html` to `lab/halftone-runtime.html`, and in its body put two canvases (one in an `.sl-invert` band), import `mount` from `../packages/ui-kit/effects.js` and call `mount()`:

```html
<canvas data-sl-halftone data-sl-src="../packages/ui-kit/assets/sondalab-avatar-ink.png" data-sl-grid="130" aria-hidden="true" style="width:22rem;aspect-ratio:1"></canvas>
<section class="sl-invert" style="padding:2rem">
  <canvas data-sl-halftone data-sl-src="../packages/ui-kit/assets/sondalab-avatar-ink.png" data-sl-grid="96" aria-hidden="true" style="width:18rem;aspect-ratio:1"></canvas>
</section>
<script type="module">import { mount } from "../packages/ui-kit/effects.js"; mount();</script>
```

- [ ] **Step 2: Verify**

With `lab/_serve.py` running, open `http://localhost:8891/lab/halftone-runtime.html`. Check and screenshot: dots gather on scroll-in; switching `data-sl-theme` between dark and light flips polarity (ink on paper prints the dark); `document.documentElement.setAttribute("data-sl-fx-still","")` freezes, removing it resumes; `high-contrast` hides both; with DevTools "Emulate prefers-reduced-motion: reduce", the picture is drawn at rest. Read the console: no errors.

- [ ] **Step 3: Full validation, in parallel**

- `npm test`
- `npm run audit`
- `git diff main --stat` (only the files named in this plan)

- [ ] **Step 4: Ask the owner, then push and open the PR**

Ask the owner before pushing. On a yes:

```bash
git push -u origin feat/halftone
gh pr create --title "feat(effects): 0.19.0 — the site's dot scenes are a kit primitive, and any picture exports in dots" --body "…"
```

The body states: what moved from the site and what did not (CRT scenes), the runtime's contract (reduced motion draws the settled frame; still; off; high contrast), the export page's location and how to run it, the test counts from Step 3, and the screenshots from Task 6 Step 3 and Task 7 Step 2. It ends with the attribution line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Publishing to npm is done by `publish-ui-kit.yml` on merge; confirm with the owner before merging.

---

### Task 8: sondalab-site migration (separate repo, after 0.19.0 is on npm)

**Files (in `/Users/marcello.barile/src/mine/ai-tools/sondalab-site`, on a new branch in its own worktree):**
- Modify: `package.json` (`@sondalab/ui-kit` → `^0.19.0`)
- Modify: `src/components/Method.astro:51,206` and `src/components/Thesis.astro:46,180`
- Delete: `src/lib/dot-scene.ts`, `src/lib/dot-scene-runtime.ts`, `scripts/dot-scene.test.mjs`

- [ ] **Step 1: Baseline screenshots before the change**

On the site's `main`, screenshot the Method and Thesis sections at 1440 and 390 px, dark and light, 5 s after scroll-in. This is a visual comparison, not a pixel diff: the site's edge dither and scatter come from `Math.random` on every load, before and after.

- [ ] **Step 2: Swap the markup**

Method.astro:51:

```astro
<canvas class="mscene" data-sl-halftone data-sl-src={p.scene.src} aria-hidden="true"></canvas>
```

Thesis.astro:46:

```astro
<canvas class="sscene" data-sl-halftone data-sl-grid="130" data-sl-src={p.scene.src} aria-hidden="true"></canvas>
```

Delete the `<script>` blocks at Method.astro:~206 and Thesis.astro:~180 that import and call `mountDotScenes`: `mount()` in `src/layouts/Base.astro` already runs on every page and now arms these canvases. Delete `src/lib/dot-scene.ts`, `src/lib/dot-scene-runtime.ts`, `scripts/dot-scene.test.mjs`. Remove the site's own high-contrast hide rule at Method.astro:~203: the kit's `effects.css` rule covers it.

- [ ] **Step 3: Validate**

Run the site's lint, typecheck, tests and build in parallel (its `package.json` scripts). Then `grep -rn "dot-scene\|data-dot-scene\|mountDotScenes" src scripts` → no match.

- [ ] **Step 4: Compare**

Same screenshots as Step 1. Expected: same composition, density, colour and motion; only the random edge dither differs. Any other difference is explained in the PR or fixed.

- [ ] **Step 5: Commit, push, PR**

One commit per logical change (bump; markup swap and deletions), then a PR in sondalab-site with before/after screenshots. Ends with the attribution line.
