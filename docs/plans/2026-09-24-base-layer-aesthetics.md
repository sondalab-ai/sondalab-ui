# Base-layer aesthetics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the base layer of `@sondalab/ui-kit` (tokens + `components.css`) the identity the brand layer already has, and ship it so sondalab-site and spexr adopt it with a version bump.

**Architecture:** Two guard tests land first: one freezes the public surface, one gates the palette's contrast. Then four slices go from the tokens outward: palette → depth and shape → controls → surfaces. Each slice is chosen by the owner from a three-way contact sheet in `lab/`, then rewritten into the kit. One release (`0.11.0`) follows, then the two consumer bumps.

**Tech Stack:** Plain CSS, `sondalab.tokens.json` → `scripts/gen-css.mjs`, `node --test`, `lab/` harness (`_harness.js`, `_serve.py`).

**Spec:** `docs/specs/2026-09-24-base-layer-aesthetics.md`

## Global Constraints

- C-1: no `--sl-*` token and no `.sl-*` class present at `0.10.1` is removed or renamed; additions allowed.
- C-2: every component renders correctly with the `0.10.1` markup in `packages/ui-kit/agent/catalog.md`.
- `packages/palette-py/` and the `terminal` block of `sondalab.tokens.json` are not touched.
- High-contrast theme values are not touched.
- Edit tokens only in `sondalab.tokens.json`, then run `npm run gen:tokens`; commit the generated files with the source.
- Probes live in `lab/`, never imported by `packages/`; rejected probes are deleted.
- Gates after every task: `npm test`, `npm run audit`.

## Review Focus

1. A consumer that *overrides* a token (spexr `spexr-overrides.css`) must keep winning over the new values — the kit must not raise specificity on `:root`/`[data-sl-theme]` blocks. Pinned by: Task 8 step "specificity diff".
2. `--sl-viz-*` moved into theme files must still resolve on a page that sets no `data-sl-theme` (the theme files are selector-scoped). Pinned by: Task 3 step 4, `tokens.css` keeps a dark-ground default.
3. Tinted shadows must not produce a colour literal `sl-audit` rejects. Pinned by: Task 4 gates (`npm run audit`).
4. Reduced motion: new control transitions must read `--sl-motion-*` (which `tokens.css` zeroes). Pinned by: Task 5 test.
5. Focus ring unchanged on every restyled control. Pinned by: existing `scripts/focus-ring.test.mjs`, run in Tasks 5–6.

---

### Task 1: Public-surface freeze

**Files:**
- Create: `scripts/public-surface.test.mjs`
- Create: `scripts/fixtures/public-surface.json` (generated)

**Interfaces:**
- Produces: `UPDATE_PUBLIC_SURFACE=1 node --test scripts/public-surface.test.mjs` regenerates the fixture.

- [ ] **Step 1: Write the test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const FIXTURE = resolve(HERE, "fixtures/public-surface.json");
const FILES = [
  "tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css",
  "components.css", "compositions.css", "glass.css", "effects.css",
];

function surface() {
  const tokens = new Set();
  const classes = new Set();
  for (const f of FILES) {
    const css = readFileSync(resolve(KIT, f), "utf8");
    for (const m of css.matchAll(/(--sl-[a-z0-9-]+)\s*:/g)) tokens.add(m[1]);
    for (const m of css.matchAll(/\.(sl-[a-z0-9_-]+)/g)) classes.add(m[1]);
  }
  return { tokens: [...tokens].sort(), classes: [...classes].sort() };
}

if (process.env.UPDATE_PUBLIC_SURFACE) {
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, JSON.stringify(surface(), null, 2) + "\n");
}

const frozen = JSON.parse(readFileSync(FIXTURE, "utf8"));
const now = surface();

for (const kind of ["tokens", "classes"]) {
  test(`no shipped ${kind} disappears (C-1)`, () => {
    const have = new Set(now[kind]);
    const gone = frozen[kind].filter((n) => !have.has(n));
    assert.deepEqual(gone, [], `removed or renamed ${kind}: ${gone.join(", ")}`);
  });
}
```

- [ ] **Step 2: Generate the fixture on the untouched `0.10.1` sources, run**

Run: `UPDATE_PUBLIC_SURFACE=1 node --test scripts/public-surface.test.mjs && node --test scripts/public-surface.test.mjs`
Expected: PASS; fixture has > 50 tokens and > 90 classes.

- [ ] **Step 3: Prove it bites** — temporarily delete `.sl-kbd` from `components.css`, run, expect FAIL naming `sl-kbd`; restore with `git checkout packages/ui-kit/components.css`.

- [ ] **Step 4: Commit** `test(ui-kit): what 0.10.1 ships cannot quietly disappear`

### Task 2: Palette contrast gate (red until Task 3)

**Files:**
- Create: `scripts/palette-contrast.test.mjs`

- [ ] **Step 1: Write the test** — reads the *generated* CSS so it follows `--sl-viz-*` if it moves into the theme files.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { fromHex, linToOklab } from "./lib/css-color.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const vars = (f) => Object.fromEntries(
  [...readFileSync(resolve(KIT, f), "utf8").matchAll(/(--sl-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)]
    .map((m) => [m[1], m[2]]),
);
const shared = vars("tokens.css");
const Y = (hex) => { const [r, g, b] = fromHex(hex).lin; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };

for (const theme of ["light", "dark"]) {
  const t = { ...shared, ...vars(`themes/${theme}.css`) };
  for (const bg of ["--sl-bg-canvas", "--sl-bg-surface"]) {
    const check = (names, min) => {
      const bad = names.filter((n) => ratio(t[n], t[bg]) < min)
        .map((n) => `${n} ${ratio(t[n], t[bg]).toFixed(2)}`);
      assert.deepEqual(bad, [], `below ${min}:1 on ${theme} ${bg}`);
    };
    test(`${theme} ${bg}: status is readable as text (4.5:1)`, () =>
      check(["success", "warning", "danger", "info"].map((s) => `--sl-status-${s}`), 4.5));
    test(`${theme} ${bg}: code is readable (4.5:1, comment 3:1)`, () => {
      check(["fg", "keyword", "string", "number", "boolean", "function", "tag", "builtin"].map((s) => `--sl-code-${s}`), 4.5);
      check(["--sl-code-comment", "--sl-code-null"], 3);
    });
    test(`${theme} ${bg}: viz marks are visible (3:1)`, () =>
      check([...Array(8).keys()].map((i) => `--sl-viz-${i}`), 3));
  }
  test(`${theme}: viz series are pairwise distinct (OKLab >= 0.08)`, () => {
    const labs = [...Array(8).keys()].map((i) => linToOklab(fromHex(t[`--sl-viz-${i}`]).lin));
    const close = [];
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const d = Math.hypot(...labs[i].map((v, k) => v - labs[j][k]));
      if (d < 0.08) close.push(`viz-${i}/viz-${j} ${d.toFixed(3)}`);
    }
    assert.deepEqual(close, []);
  });
}
```

- [ ] **Step 2: Run, expect FAIL** on every light-theme status/viz/code check (baseline in the spec). Dark passes.
- [ ] **Step 3: Do not commit yet** — it lands with Task 3 so `main` never goes red.

### Task 3: Slice 1 — Palette

**Files:**
- Create: `lab/base-1-palette.html` (deleted after the pick, except as recorded in the slice log)
- Modify: `sondalab.tokens.json` (`themes.light|dark.status-*`, `code.light|dark`, `shared.viz` or new `themes.*.viz`, `$viz-note`), `scripts/gen-css.mjs` (only if viz moves per theme)
- Regenerate: `packages/ui-kit/tokens.css`, `themes/*.css`, agent docs

- [ ] **Step 1: Contact sheet** — three directions (spec §Slice 1), each rendered as: 4 status badges, a 12-line code sample, an 8-series bar strip, on both grounds, with each colour's contrast ratio printed under it.
- [ ] **Step 2: STOP — owner picks.** Record in the spec slice log.
- [ ] **Step 3: Promote** the pick into `sondalab.tokens.json`; `npm run gen:tokens`.
- [ ] **Step 4: If viz moved per theme** — emit `--sl-viz-*` in each theme block in `gen-css.mjs` and keep the dark values in `tokens.css :root` as the no-theme default (Review Focus 2). High-contrast gets the dark values.
- [ ] **Step 5: Run** `node --test scripts/palette-contrast.test.mjs scripts/public-surface.test.mjs` → PASS; then `npm test && npm run audit` → PASS.
- [ ] **Step 6: Render** showcase Component library + a status/viz strip, dark and light, before/after.
- [ ] **Step 7: Commit** test + tokens + generated files + spec log together.

### Task 4: Slice 2 — Depth and shape

**Files:** `lab/base-2-depth.html`; `sondalab.tokens.json` (`shared.shadow`, `shared.radius`, `shared.text` additions `3xl`, `display`; theme `border-*`); shadows that need the ground hue move to theme blocks under the same names (C-1).

- [ ] **Step 1: Contact sheet** — three directions over one card, one raised menu, one dialog, and the type ladder, on both grounds.
- [ ] **Step 2: STOP — owner picks.**
- [ ] **Step 3: Promote; `npm run gen:tokens`.**
- [ ] **Step 4: Gates** `npm test && npm run audit` (Review Focus 3).
- [ ] **Step 5: Render before/after; commit.**

### Task 5: Slice 3 — Controls

**Files:** `lab/base-3-controls.html`; `packages/ui-kit/components.css` (control selectors listed in spec §Slice 3); `packages/ui-kit/agent/catalog.md` only if prose describing the look changes.

- [ ] **Step 1: Contact sheet** — three directions, each showing every control at rest / hover / active / disabled / focus, both grounds. Probe markup is copied verbatim from `catalog.md` (C-2).
- [ ] **Step 2: STOP — owner picks.**
- [ ] **Step 3: Promote** into `components.css`; every `transition` reads `var(--sl-motion-*)`.
- [ ] **Step 4: Test** — add to `scripts/components-token-scope.test.mjs`: no `transition`/`animation` duration literal in `components.css` (Review Focus 4):

```js
test("control motion reads the motion tokens (reduced-motion zeroes them)", () => {
  const literal = [...css.matchAll(/(transition|animation)[^;]*\b\d+m?s\b/g)].map((m) => m[0]);
  assert.deepEqual(literal, []);
});
```

- [ ] **Step 5: Gates** `npm test && npm run audit` (includes `focus-ring.test.mjs`).
- [ ] **Step 6: Render before/after; commit.**

### Task 6: Slice 4 — Surfaces and labels

**Files:** `lab/base-4-surfaces.html`; `packages/ui-kit/components.css` (selectors in spec §Slice 4).

- [ ] Steps as Task 5 (sheet → STOP → promote → gates → render → commit), over card, callout, dialog, badge, tag, empty, stat, table, tooltip, kbd, code.

### Task 7: Release 0.11.0

- [ ] **Step 1:** Delete remaining `lab/base-*` probes; slice log complete in the spec.
- [ ] **Step 2:** Bump `packages/ui-kit/package.json` to `0.11.0`; `npm test && npm run audit`.
- [ ] **Step 3:** Showcase rendered in dark, light, high-contrast → owner sign-off (A-5).
- [ ] **Step 4:** Push branch, open PR (full URL in the report). Merge publishes to npm (A-3).

### Task 8: Consumers

- [ ] **sondalab-site:** worktree; `@sondalab/ui-kit` → `^0.11.0`; `npm install && npm run build`; render every page before/after in both themes; PR.
- [ ] **spexr:** worktree; `packages/ui-kit/package.json` → `^0.11.0`; install, build, typecheck; **specificity diff** — list every selector in `spexr-overrides.css` that sets a token this release changed, confirm the override still wins (Review Focus 1); render the IDE shell both themes; PR.
- [ ] Any change beyond the version line recorded in the spec (A-4).
