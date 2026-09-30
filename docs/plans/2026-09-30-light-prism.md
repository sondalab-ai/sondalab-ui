# Light Prism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **What this file is:** the task-by-task implementation plan for the light Prism theme. **Audience:** whoever executes it (agent or engineer) and the PR reviewer. **Owner:** marcellobarile. **Companion:** `docs/specs/2026-09-30-light-prism-design.md` is the contract (what and why); this file is only the how and in what order.

**Goal:** Turn the kit's light theme into Prism — cool-white ground, deepened amber, a shared six-hue spectrum on effects, rims and two opt-in ornaments — with dark and high-contrast resolving exactly as on 0.20.1.

**Architecture:** The light theme file defines `--sl-spectrum-0..5` and `--sl-spectrum-ink-0..4`; dark and high-contrast reset them to `initial`. Every consumer reads them as `var(--sl-spectrum-N, <today's value>)`, so the spectrum shows only where the light theme is in force. Properties built from the spectrum (`--slc-rim`, `--slc-haze`, …) become invalid where it is reset and their consumers fall back to `none` / `currentColor`.

**Tech Stack:** plain CSS (custom properties, `color-mix`, relative colour), vanilla ES modules, `node --test`, token generator `scripts/gen-css.mjs`.

**Spec:** `docs/specs/2026-09-30-light-prism-design.md`

## Global Constraints

- Branch `feat/light-prism`, worktree `.claude/worktrees/feat-light-prism`; one PR, one commit per task.
- Never hand-edit `packages/ui-kit/tokens.css` or `themes/*.css`: edit `sondalab.tokens.json`, run `npm run gen:tokens`.
- No colour literal in `effects.css`, `components.css` rules outside the `:root` role block, or any `.js` (existing tests enforce it).
- No `[data-sl-theme]` selector added to `effects.css` or `components.css`.
- Every `var(--sl-spectrum…)` outside the `components.css` role block carries a fallback; every `var(--slc-rim|--slc-haze|--slc-spectral…)` carries a fallback.
- Light values (verbatim from the spec): canvas `#F4F4F8`, surface `#FAFAFC`, raised `#FFFFFF`, ink `19,20,28`, text `#13141C` / `#454857` / `#5F6374`, accent `#9A5300`, depth `#14606C` (unchanged), spectrum `#FF4D6D #FF9F1C #FFD60A #2EC4B6 #3A86FF #8338EC`.
- Contrast floors: muted text, accent as text and white-on-accent ≥ 4.5:1; spectrum-ink ≥ 3:1; viz ≥ 3:1 and pairwise OKLab ≥ 0.08 — on canvas, surface and raised.
- Release: `@sondalab/ui-kit` 0.21.0, `palette-py` bumped in the same PR.
- Validation after every task: `npm test` (all of `scripts/*.test.mjs`) and `npm run audit` green before committing.

## Review Focus

1. **A dark region nested in a light page** (`<section data-sl-theme="dark">` inside a light `<html>`) must show no spectrum — pinned in Task 1 (every non-light theme resets every spectrum property) and Task 2 (fallback guard).
2. **A light region nested in a dark page** must show the spectrum on effects — pinned in Task 2 (effects read the spectrum on the host, not on `:root`). Note in the README that `--slc-rim` / `--slc-haze` / `--slc-spectral-*` are computed on `:root` like every `--slc-*` role, so a nested light island gets spectral effects but no rims — a known limit, not a regression.
3. **Spectral text in forced-colors mode or in dark** must be readable text, never `transparent` — pinned in Task 5.
4. **A primary button, card or wrapped field that is also a glass/aurora host** must show one edge, not rim + effect edge stacked — pinned in Task 4.
5. **A halftone canvas in dark after a theme switch from light** must repaint in its single ink — pinned in Task 3.

---

### Task 1: Tokens — ground, accent, spectrum, chart ramp

**Files:**
- Modify: `sondalab.tokens.json` (`shared.shadow`, `themes.light`, `accent.light.default`, `viz.light`, `shadow.light`, new `spectrum`)
- Modify: `scripts/gen-css.mjs` (emit spectrum)
- Modify: `packages/ui-kit/components.css:25-57` (literal fallbacks in the role block)
- Modify: `packages/ui-kit/agent/accent-registry.json` (default light accent)
- Create: `scripts/fixtures/theme-dark-0.20.1.css`, `scripts/fixtures/theme-high-contrast-0.20.1.css`
- Create: `scripts/theme-isolation.test.mjs`
- Modify: `scripts/palette-contrast.test.mjs`
- Regenerated: `packages/ui-kit/tokens.css`, `packages/ui-kit/themes/*.css`

**Interfaces:**
- Produces: CSS custom properties `--sl-spectrum-0..5`, `--sl-spectrum-ink-0..4` (hex in light; `initial` in dark and high-contrast). Token JSON shape `spectrum: { light: { light: [6 hex], ink: [5 hex] } }`.

- [ ] **Step 1: Freeze the 0.20.1 dark and high-contrast theme files as fixtures**

```bash
cp packages/ui-kit/themes/dark.css scripts/fixtures/theme-dark-0.20.1.css
cp packages/ui-kit/themes/high-contrast.css scripts/fixtures/theme-high-contrast-0.20.1.css
```

- [ ] **Step 2: Write the failing isolation test** — `scripts/theme-isolation.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The light theme owns the spectrum. Every other theme resets it to `initial`
// (the guaranteed-invalid value), so a consumer's var() fallback — today's
// colour — wins there, and a dark island inside a light page inherits nothing.
// Apart from those resets, a non-light theme file is byte-identical to 0.20.1.
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(HERE, p), "utf8");
const SPECTRUM = [...Array(6).keys()].map((i) => `--sl-spectrum-${i}`)
  .concat([...Array(5).keys()].map((i) => `--sl-spectrum-ink-${i}`));
const decl = (css, name) => css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m"))?.[1];

test("light declares every spectrum property as a hex", () => {
  const css = read("../packages/ui-kit/themes/light.css");
  for (const n of SPECTRUM) assert.match(decl(css, n) ?? "", /^#[0-9A-Fa-f]{6}$/, n);
});

for (const id of ["dark", "high-contrast"]) {
  test(`${id} resets every spectrum property to initial`, () => {
    const css = read(`../packages/ui-kit/themes/${id}.css`);
    for (const n of SPECTRUM) assert.equal(decl(css, n), "initial", n);
  });
  test(`${id} is otherwise byte-identical to 0.20.1`, () => {
    const now = read(`../packages/ui-kit/themes/${id}.css`)
      .split("\n").filter((l) => !/^\s*--sl-spectrum-/.test(l)).join("\n");
    assert.equal(now, read(`fixtures/theme-${id}-0.20.1.css`));
  });
}
```

- [ ] **Step 3: Extend `scripts/palette-contrast.test.mjs`** — add a light-only block after the existing theme loop (the dark accent is out of scope):

```js
{
  const t = { ...shared, ...vars("themes/light.css") };
  const INK = [...Array(5).keys()].map((i) => `--sl-spectrum-ink-${i}`);
  for (const bg of ["--sl-bg-canvas", "--sl-bg-surface", "--sl-bg-surface-raised"]) {
    test(`light ${bg}: muted text and the accent read as text (4.5:1)`, () => {
      const bad = ["--sl-text-muted", "--sl-accent-default"]
        .filter((n) => ratio(t[n], t[bg]) < 4.5).map((n) => `${n} ${ratio(t[n], t[bg]).toFixed(2)}`);
      assert.deepEqual(bad, []);
    });
    test(`light ${bg}: spectrum ink is visible at 1px and as display text (3:1)`, () => {
      const bad = INK.filter((n) => !t[n] || ratio(t[n], t[bg]) < 3).map((n) => `${n} ${t[n] && ratio(t[n], t[bg]).toFixed(2)}`);
      assert.deepEqual(bad, []);
    });
  }
  test("light: the label on a primary button reads (4.5:1)", () =>
    assert.ok(ratio(t["--sl-text-on-accent"], t["--sl-accent-default"]) >= 4.5));
}
```

- [ ] **Step 4: Run both tests, confirm they fail**

Run: `node --test scripts/theme-isolation.test.mjs scripts/palette-contrast.test.mjs`
Expected: FAIL — no `--sl-spectrum-*` declarations; muted 3.5, accent 3.8.

- [ ] **Step 5: Edit `sondalab.tokens.json`**

- `themes.light`: `bg-canvas #F4F4F8`, `bg-surface #FAFAFC`, `bg-surface-raised #FFFFFF`, `bg-overlay rgba(19,20,28,0.4)`, borders `rgba(19,20,28,0.09|0.16|0.28)`, `text-primary #13141C`, `text-secondary #454857`, `text-muted #5F6374`. Status keys unchanged.
- `accent.light.default`: `#9A5300` (recipes and depth unchanged).
- `shadow.light` and `shared.shadow`: replace `21,33,31` with `19,20,28`, alphas unchanged. Update `$shadow-note` wording ("tinted with the light ground ink").
- `viz.light`: `["#E0405E", "#2F6FE0", "#0E958A", "#D26A00", "#7A35E0", "#08875F", "#A57C00", "#C93FC4"]`.
- New top-level, after `viz`:

```json
"$spectrum-note": "Prism (light theme only). --sl-spectrum-0..5 is light (glow: aurora bloom, press, haze), never text, never the only carrier of a meaning. --sl-spectrum-ink-0..4 is the same wheel darkened to >= 3:1 on the light grounds, for anything seen at 1px or as text (rims, aurora --rim/--linear, glitch, halftone, spectral text). Other themes reset both to `initial` so consumers fall back to their accent-derived colour. Not an accent: it never tracks the product hue and never marks state.",
"spectrum": {
  "light": {
    "light": ["#FF4D6D", "#FF9F1C", "#FFD60A", "#2EC4B6", "#3A86FF", "#8338EC"],
    "ink": ["#D6264A", "#B85A00", "#0B857A", "#2A62D8", "#7A2FE0"]
  }
}
```

- [ ] **Step 6: Emit it from `scripts/gen-css.mjs`** — inside the theme loop's `entries`, after the shadow line:

```js
      // Prism: the spectrum is the light theme's own. Every other theme resets
      // it to `initial`, so a consumer's var() fallback wins there and a nested
      // island of that theme does not inherit the light theme's value.
      ...spectrumDecls(t.spectrum?.[id], t.spectrum?.light),
```

and above `main()`:

```js
/** --sl-spectrum-N / --sl-spectrum-ink-N: the theme's own values, or an
 * `initial` reset for each name the light theme declares when this theme has
 * none. Returns [name, value] declarations. */
function spectrumDecls(own, light) {
  const names = (s) => [
    ...(s?.light ?? []).map((v, i) => [`--sl-spectrum-${i}`, v]),
    ...(s?.ink ?? []).map((v, i) => [`--sl-spectrum-ink-${i}`, v]),
  ];
  return own ? names(own) : names(light).map(([n]) => [n, "initial"]);
}
```

- [ ] **Step 7: Regenerate and update literal fallbacks**

Run: `npm run gen:tokens`
Then in `components.css` role block replace the light literals in fallbacks: `#B56A0C → #9A5300`, `#ECE4D4 → #F4F4F8`, `#F6F1E6 → #FAFAFC`, `#15211F → #13141C`, `#475754 → #454857`, `#6E7B78 → #5F6374`, `21,33,31 → 19,20,28`. In `agent/accent-registry.json` set the default product's `light` to `#9A5300`.

- [ ] **Step 8: Tune until green**

Run: `npm test`
Expected: PASS. If `palette-contrast` flags a spectrum-ink or viz value, darken that one hue in `sondalab.tokens.json` (lower OKLCH lightness, same hue), regenerate, rerun. If `viz` pairwise distance fails, move the closer pair's hue apart. Record any value that moved from the spec's starting point in the commit body.

- [ ] **Step 9: Commit**

```bash
git add sondalab.tokens.json scripts/gen-css.mjs packages/ui-kit scripts/fixtures scripts/theme-isolation.test.mjs scripts/palette-contrast.test.mjs
git commit -m "feat(tokens): light Prism ground, deepened amber, the spectrum and a brighter chart ramp"
```

---

### Task 2: Spectral CSS effects

**Files:**
- Modify: `packages/ui-kit/effects.css` — `:root` roots (~62-66), press light (~1085), aurora host (~1232-1267), `--rim` (~1305-1322), linear aurora (~1700-1710), glitch (~2064-2065, ~2275-2276); glass/effects comment figures re-measured
- Modify: `scripts/effects-guards.test.mjs` (glitch source pins, new fallback guard)
- Modify: `scripts/effects-gamut.test.mjs` only if its light sweep breaks (see Step 5)

**Interfaces:**
- Consumes: `--sl-spectrum-*` (Task 1).
- Produces: `--slfx-light-a`, `--slfx-light-b` on `:root` (read by Task 3).

- [ ] **Step 1: Write the failing guards** — append to `scripts/effects-guards.test.mjs` (it already loads `effects.css` as a comment-stripped string; reuse its reader):

```js
test("every spectrum read in effects.css falls back to today's colour", () => {
  const bare = [...CSS.matchAll(/var\(\s*(--sl-spectrum-[a-z0-9-]+)\s*\)/g)].map((m) => m[1]);
  assert.deepEqual(bare, [], "a spectrum var() without a fallback paints nothing in dark");
});

test("Prism reaches the aurora, the press light, glitch and the live light", () => {
  for (const [prop, stop] of [
    ["--slfx-beam", "--sl-spectrum-4"], ["--slfx-beam-b", "--sl-spectrum-0"],
    ["--slfx-beam-c", "--sl-spectrum-2"], ["--slfx-beam-tail", "--sl-spectrum-5"],
    ["--slfx-bloom-hi", "--sl-spectrum-0"], ["--slfx-bloom-lo", "--sl-spectrum-4"],
    ["--slfx-press-light", "--sl-spectrum-1"],
    ["--slfx-light-a", "--sl-spectrum-0"], ["--slfx-light-b", "--sl-spectrum-4"],
  ]) {
    assert.match(CSS, new RegExp(`${prop}:[^;]*var\\(${stop},`), `${prop} reads ${stop}`);
  }
  assert.match(CSS, /\.is-glitching::before\s*\{[^}]*var\(--sl-spectrum-ink-0,/);
  assert.match(CSS, /\.is-glitching::after\s*\{[^}]*var\(--sl-spectrum-ink-3,/);
});
```

(If the file's CSS string is named differently, use that name; the guard must run on comment-stripped CSS.) Update the existing glitch test near lines 543-556 so it accepts `var(--sl-spectrum-ink-0, var(--slc-accent, …))` / `var(--sl-spectrum-ink-3, var(--slfx-depth))`: the old roles must still appear as the fallback.

- [ ] **Step 2: Run, confirm failure**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL on the two new tests.

- [ ] **Step 3: Implement** — each is a wrap of today's expression:

```css
/* :root, next to --slfx-depth */
--slfx-light-a: var(--sl-spectrum-0, var(--slc-accent, var(--sl-accent-default)));
--slfx-light-b: var(--sl-spectrum-4, var(--slfx-depth));

/* press */
--slfx-press-light: color-mix(in oklab, oklch(from var(--slfx-sheen) max(l, 1.2 - l) c h) 82%, var(--sl-spectrum-1, var(--slc-accent, var(--sl-accent-default))));

/* .sl-fx-aurora */
--slfx-beam: var(--sl-spectrum-4, var(--slfx-accent-vivid));
--slfx-beam-b: var(--sl-spectrum-0, oklch(from var(--slfx-accent-vivid) l c calc(h + 180)));
--slfx-beam-c: var(--sl-spectrum-2, oklch(from var(--slfx-accent-vivid) l c calc(h + 150)));
--slfx-beam-tail: color-mix(in srgb, var(--sl-spectrum-5, var(--slfx-depth-vivid)) 75%, transparent);
--slfx-bloom-hi: color-mix(in srgb, var(--sl-spectrum-0, var(--slfx-accent-bloom)) 44%, transparent);
--slfx-bloom-lo: color-mix(in srgb, var(--sl-spectrum-4, var(--slfx-depth-bloom)) 33%, transparent);

/* --rim block */
--slfx-beam: var(--sl-spectrum-ink-3, var(--slfx-rim-beam));
--slfx-bloom-hi: color-mix(in srgb, var(--sl-spectrum-3, var(--slfx-depth-bloom)) 44%, transparent);
--slfx-bloom-lo: color-mix(in srgb, var(--sl-spectrum-5, var(--slfx-depth-bloom)) 33%, transparent);

/* linear (not busy): the three stops */
color-mix(in srgb, var(--sl-spectrum-ink-0, var(--slfx-depth)) 80%, transparent) 30%,
color-mix(in srgb, var(--slfx-sheen) 70%, var(--sl-spectrum-ink-2, var(--slc-accent, var(--sl-accent-default)))) 50%,
color-mix(in srgb, var(--sl-spectrum-ink-4, var(--slfx-depth)) 80%, transparent) 70%,

/* glitch */
.sl-fx-glitch.is-glitching::before { color: var(--sl-spectrum-ink-0, var(--slc-accent, var(--sl-accent-default))); }
.sl-fx-glitch.is-glitching::after  { color: var(--sl-spectrum-ink-3, var(--slfx-depth)); }
/* jitter keyframe shadows: accent-hover → spectrum-ink-0, depth → spectrum-ink-3, each with the old role as fallback */
```

Busy variants (aurora busy pillars band ~1602, linear busy ~1749) are **not** touched. Update the comment above `--slfx-beam-b` (it says the companions are the accent's complement and split) with one line: "On light, the spectrum replaces the trio (Prism, 2026-09-30)."

- [ ] **Step 4: Re-measure the comment figures on the new ground** — the contrast numbers quoted in comments at `effects.css` ghost label (~652-659), primary 72% share (~915-933), `glass.css` tint 34% (~178-193). Compute each with the ratio helper from `scripts/palette-contrast.test.mjs` against `#F4F4F8` / `#FAFAFC`; replace the numbers. If one falls below the floor it states, raise that alpha until it clears and note the change in the commit body.

- [ ] **Step 5: Run the whole suite**

Run: `npm test && npm run audit`
Expected: PASS. If `effects-gamut.test.mjs` fails on light for `--slfx-beam*` or blooms, the failing assertion is about derived chroma of the vivid tier — the spectrum is a token, not a derivation, so exclude the spectral properties from the light sweep's derivation checks (keep in-sRGB) and say why in a comment.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/effects.css packages/ui-kit/glass.css scripts/effects-guards.test.mjs scripts/effects-gamut.test.mjs
git commit -m "feat(effects): on light the aurora, press light and glitch take the spectrum"
```

---

### Task 3: Spectral JavaScript effects — live light and halftone

**Files:**
- Modify: `packages/ui-kit/live-light.js:173, :305`
- Modify: `packages/ui-kit/halftone.js` (`paint`, `draw`), `packages/ui-kit/halftone.d.ts` (doc comment)
- Modify: `scripts/live-light.test.mjs:19-22`, `scripts/halftone.test.mjs`

**Interfaces:**
- Consumes: `--slfx-light-a`, `--slfx-light-b` (Task 2); `--sl-spectrum-ink-0..4` (Task 1).
- Produces: attribute `data-sl-ink="mono"` on a halftone canvas.

- [ ] **Step 1: Failing tests**

`scripts/live-light.test.mjs` — replace the two `assert.match` lines:

```js
  assert.match(js, /roleColour\(el, mode === "run" \? "--slfx-light-a" : "--slc-accent"\)/, "run takes the light, busy the accent");
  assert.match(js, /roleColour\(el, mode === "run" \? "--slfx-light-b" : "--slfx-depth"\)/, "and its second body");
```

`scripts/halftone.test.mjs` — follow the file's existing fake-page helper (`page.canvas(...)`); add three tests: (1) with `--sl-spectrum-ink-0..4` resolvable on the canvas, `draw` sets `fillStyle` to a gradient object (the fake 2D context records `createLinearGradient` calls and five `addColorStop`s); (2) with `data-sl-ink="mono"` the fill is the computed `color` string; (3) after the spectrum is removed (theme switch to dark: the fake style returns `""` for the custom properties) and the observer fires, the next draw uses the `color` string.

- [ ] **Step 2: Run, confirm failure**

Run: `node --test scripts/live-light.test.mjs scripts/halftone.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement**

`live-light.js` — at both read sites (attach uses the local `mode`; the theme observer uses `it.mode`):

```js
a: roleColour(el, mode === "run" ? "--slfx-light-a" : "--slc-accent"),
b: roleColour(el, mode === "run" ? "--slfx-light-b" : "--slfx-depth"),
```

`halftone.js`:

```js
const INK_STOPS = 5;

/** The light theme's spectrum ink as read on the canvas, or null where the
 * theme resets it (dark, high-contrast) or the author asked for one ink. */
function spectrumOf(canvas) {
  if (canvas.getAttribute("data-sl-ink") === "mono") return null;
  const cs = getComputedStyle(canvas);
  const stops = [];
  for (let i = 0; i < INK_STOPS; i++) {
    const v = cs.getPropertyValue(`--sl-spectrum-ink-${i}`).trim();
    if (!v) return null;
    stops.push(v);
  }
  return stops;
}
```

In `paint(s)` add `s.spectrum = spectrumOf(s.canvas);`. In `draw`, replace `g.fillStyle = s.ink;` with:

```js
    if (s.spectrum) {
      const grad = g.createLinearGradient(0, 0, w, w);
      s.spectrum.forEach((c, i) => grad.addColorStop(i / (s.spectrum.length - 1), c));
      g.fillStyle = grad;
    } else {
      g.fillStyle = s.ink;
    }
```

`paint` already re-runs on theme change (the observer at ~213-222); confirm by reading it, and if it only re-runs when the ink's darkness flips, call `spectrumOf` unconditionally on every theme mutation. Add `data-sl-ink="mono"` to the attribute list in `halftone.d.ts`'s doc comment and in the header comment of `halftone.js`.

- [ ] **Step 4: Run**

Run: `npm test`
Expected: PASS (including `types-drift`, `effects-js`'s no-colour-literal check).

- [ ] **Step 5: Commit**

```bash
git add packages/ui-kit/live-light.js packages/ui-kit/halftone.js packages/ui-kit/halftone.d.ts scripts/live-light.test.mjs scripts/halftone.test.mjs
git commit -m "feat(effects): the run light and halftone dots take the spectrum on light"
```

---

### Task 4: Rainbow rims on cards, the primary button and wrapped fields

**Files:**
- Modify: `packages/ui-kit/components.css` (role block; new rim rules after the card rules)
- Modify: `scripts/components-token-scope.test.mjs:57` (chromatic exemption)
- Create: `scripts/rim.test.mjs`

**Interfaces:**
- Consumes: `--sl-spectrum-ink-0..4`.
- Produces: role property `--slc-rim` (author can set `--slc-rim: none` per element).

- [ ] **Step 1: Failing test** — `scripts/rim.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(HERE, "../packages/ui-kit/components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const role = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));

test("the rim is built from the spectrum ink in the role block", () => {
  assert.match(role, /--slc-rim:\s*linear-gradient\([^;]*var\(--sl-spectrum-ink-0\)[^;]*var\(--sl-spectrum-ink-4\)/);
});

test("the rim paints nothing where the spectrum is reset", () => {
  const uses = [...css.matchAll(/var\(--slc-rim\b([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(uses.length > 0);
  for (const u of uses) assert.match(u, /^,\s*none$/, `var(--slc-rim${u}) needs the none fallback`);
});

test("the rim lives on a pseudo-element of the three hosts and never on an effect host", () => {
  const rule = css.match(/([^{}]*)\{[^}]*var\(--slc-rim,\s*none\)/)?.[1] ?? "";
  for (const host of [".sl-card", ".sl-btn--primary", ".sl-field__control"]) assert.ok(rule.includes(host), host);
  assert.match(rule, /::before/);
  assert.match(rule, /:not\(\.sl-fx-glass,\s*\.sl-fx-aurora\)/);
});

test("the rim leaves the host's own border and background alone", () => {
  const block = css.match(/[^{}]*::before[^{}]*\{[^}]*var\(--slc-rim,\s*none\)[^}]*\}/)?.[0] ?? "";
  assert.doesNotMatch(block.slice(block.indexOf("{")), /(^|;)\s*border(-color)?\s*:/);
});
```

- [ ] **Step 2: Run, confirm failure**

Run: `node --test scripts/rim.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement** — role block, after `--slc-focus`:

```css
  /* Prism (light): a 1px spectrum hairline over the host's own border. Built
     from theme tokens, so where a theme resets the spectrum this property is
     invalid and every var(--slc-rim, none) paints nothing. */
  --slc-rim: linear-gradient(120deg, var(--sl-spectrum-ink-0), var(--sl-spectrum-ink-1), var(--sl-spectrum-ink-2), var(--sl-spectrum-ink-3), var(--sl-spectrum-ink-4));
```

After the card rules:

```css
/* Rim — the spectrum as a hairline on the three surfaces that carry an edge.
   A ring on ::before, masked to 1px, over the host's border: the host's own
   border, fill and state cues are untouched, so a theme without the spectrum
   paints exactly what it did. An effect host keeps its effect's edge. The
   field's ring needs the .sl-field__control wrapper: an <input> has no
   pseudo-elements. */
:is(.sl-card, .sl-btn--primary, .sl-field__control):not(.sl-fx-glass, .sl-fx-aurora) { position: relative; }
:is(.sl-card, .sl-btn--primary, .sl-field__control):not(.sl-fx-glass, .sl-fx-aurora)::before {
  content: "";
  position: absolute;
  inset: -1px;
  padding: 1px;
  border-radius: inherit;
  background: var(--slc-rim, none);
  mask: linear-gradient(black 0 0) content-box exclude, linear-gradient(black 0 0);
  pointer-events: none;
}
.sl-field__control:not(.sl-fx-glass, .sl-fx-aurora)::before { inset: 0; border-radius: var(--sl-radius-md, 10px); }
```

Before writing, confirm `components.css` gives none of the three hosts a `::before` today (`grep -n "::before" packages/ui-kit/components.css`); `.sl-select` uses `::after`, which this does not touch. In `scripts/components-token-scope.test.mjs` extend `CHROMATIC` to `/^--slc-(accent|focus|on-accent|success|warning|danger|info|rim|haze|spectral)/` — the spectrum is chromatic and, per the spec, stays itself inside the ink band.

- [ ] **Step 4: Run**

Run: `npm test && npm run audit`
Expected: PASS. `npm run audit` must not flag the mask's `black` (the existing mask rule already requires the `black` keyword).

- [ ] **Step 5: Look at it** — headless capture of `showcase/index.html` in light and dark (the capture routine in Task 7 Step 1), crop a card, the primary button and a wrapped field. Light: a rainbow hairline, radius intact. Dark: `python3 lab/_pixdiff.py` against the Task-7 baseline crop reports 0 differing pixels.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/components.css scripts/rim.test.mjs scripts/components-token-scope.test.mjs
git commit -m "feat(components): on light, cards, primary buttons and fields wear a spectrum hairline"
```

---

### Task 5: Opt-in haze and spectral text

**Files:**
- Modify: `packages/ui-kit/components.css` (role block; new section after `sl-anchor`)
- Modify: `packages/ui-kit/agent/catalog.md`, `packages/ui-kit/agent/catalog.json`
- Create: `scripts/prism-ornaments.test.mjs`

**Interfaces:**
- Produces: classes `sl-haze`, `sl-spectral`; role properties `--slc-haze`, `--slc-spectral-ink`, `--slc-spectral-fill`.

- [ ] **Step 1: Failing test** — `scripts/prism-ornaments.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(HERE, "../packages/ui-kit/components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (sel) => css.match(new RegExp(`${sel.replace(/[.:]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

test("haze sits behind the content and paints nothing without the spectrum", () => {
  const r = rule(".sl-haze::before");
  assert.match(r, /background:\s*var\(--slc-haze,\s*none\)/);
  assert.match(r, /z-index:\s*-1/);
  assert.match(r, /pointer-events:\s*none/);
  assert.match(rule(".sl-haze"), /isolation:\s*isolate/);
});

test("spectral text falls back to readable text, never transparent", () => {
  const r = rule(".sl-spectral");
  assert.match(r, /-webkit-text-fill-color:\s*var\(--slc-spectral-fill,\s*currentColor\)/);
  assert.match(r, /background-image:\s*var\(--slc-spectral-ink,\s*none\)/);
  assert.doesNotMatch(r, /(^|;)\s*color:\s*transparent/);
});

test("spectral text is plain text under forced colours", () => {
  assert.match(css, /@media\s*\(forced-colors:\s*active\)\s*\{[^@]*\.sl-spectral\s*\{[^}]*-webkit-text-fill-color:\s*currentColor/);
});

test("the fill switch is transparent only where the spectrum exists", () => {
  assert.match(css, /--slc-spectral-fill:\s*color-mix\(in srgb,\s*var\(--sl-spectrum-ink-0\)\s*0%,\s*transparent\)/);
});
```

- [ ] **Step 2: Run, confirm failure** — `node --test scripts/prism-ornaments.test.mjs` → FAIL.

- [ ] **Step 3: Implement** — role block, after `--slc-rim`:

```css
  --slc-haze:
    radial-gradient(closest-side at 28% 42%, color-mix(in srgb, var(--sl-spectrum-0) 30%, transparent), transparent),
    radial-gradient(closest-side at 70% 30%, color-mix(in srgb, var(--sl-spectrum-4) 26%, transparent), transparent),
    radial-gradient(closest-side at 58% 76%, color-mix(in srgb, var(--sl-spectrum-2) 32%, transparent), transparent);
  --slc-spectral-ink: linear-gradient(90deg, var(--sl-spectrum-ink-0), var(--sl-spectrum-ink-1), var(--sl-spectrum-ink-2), var(--sl-spectrum-ink-3), var(--sl-spectrum-ink-4));
  /* transparent where the spectrum exists, invalid (so the consumer's
     currentColor fallback wins) where a theme resets it */
  --slc-spectral-fill: color-mix(in srgb, var(--sl-spectrum-ink-0) 0%, transparent);
```

After `.sl-anchor`:

```css
/* Haze — a soft field of the spectrum behind a section (Prism, light only).
   One per screen at most. Static: it is light, not motion. */
.sl-haze { position: relative; isolation: isolate; }
.sl-haze::before {
  content: "";
  position: absolute;
  inset: -10% -5% 0 25%;
  z-index: -1;
  background: var(--slc-haze, none);
  filter: blur(12px);
  pointer-events: none;
}

/* Spectral — a word or phrase of a display heading in the spectrum ink.
   Display sizes only: the ink clears 3:1, the large-text floor, not 4.5. */
.sl-spectral {
  background-image: var(--slc-spectral-ink, none);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: var(--slc-spectral-fill, currentColor);
}
@media (forced-colors: active) {
  .sl-spectral { background-image: none; -webkit-text-fill-color: currentColor; }
}
```

- [ ] **Step 4: Catalogue** — `catalog.md`, in "Signature patterns" after the oversized display anchor, two sections in the file's own format:

````markdown
### Haze — `sl-haze`
A soft field of the spectrum behind a section: the light theme's colour as atmosphere. Substrate: **A** Page/App, **N/A** IDE.
```html
<section class="sl-haze"> … </section>
```
Consumes: `--slc-haze`. Paints nothing in dark and high-contrast. Do: one per screen, behind a hero. Don't: put it behind body text you need read at a glance, or stack two.

### Spectral text — `sl-spectral`
A word or phrase of a display heading painted in the spectrum ink. Substrate: **A** Page/App, **N/A** IDE.
```html
<h1 class="sl-anchor">Everything measured, <span class="sl-spectral">nothing asserted.</span></h1>
```
Consumes: `--slc-spectral-ink`, `--slc-spectral-fill`. Plain text in dark, high-contrast and forced colours. Do: display sizes only (`sl-anchor`, `h1`, `h2`). Don't: body text — the ink clears 3:1, not 4.5.
````

`catalog.json`: two entries, `{"id":"haze","kind":"pattern","classes":["sl-haze"],"roleVars":["--slc-haze"]}` and `{"id":"spectral-text","kind":"pattern","classes":["sl-spectral"],"roleVars":["--slc-spectral-ink","--slc-spectral-fill"]}` — match the `kind` value the neighbouring signature patterns use.

- [ ] **Step 5: Run** — `npm test && npm run audit` → PASS (`catalog-audit` checks the new sections exist and their snippets audit clean).

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.md packages/ui-kit/agent/catalog.json scripts/prism-ornaments.test.mjs
git commit -m "feat(components): sl-haze and sl-spectral, the light theme's two ornaments"
```

---

### Task 6: Design language, README, release

**Files:**
- Modify: `docs/design-language.md`; regenerate `packages/ui-kit/agent/design-language.md` (`npm run gen:agent-docs`)
- Modify: `packages/ui-kit/README.md`
- Modify: `packages/ui-kit/package.json` (0.21.0), `packages/palette-py/pyproject.toml` (0.2.1)
- Regenerate: `scripts/fixtures/public-surface.json` (`UPDATE_PUBLIC_SURFACE=1 node --test scripts/public-surface.test.mjs`)
- Modify: `docs/specs/2026-09-30-light-prism-design.md` front matter `status: draft → accepted`

- [ ] **Step 1: design-language.md amendments** (spec §Design-language amendments), each as prose in the section it amends:
  - Decision 2, after the "Rule:" paragraph: a paragraph "**The spectrum is not an accent.**" — shared, light-theme only, identical in every product, never marks state or meaning; state stays the accent's.
  - Decision 2 table: default light accent `#B56A0C` → `#9A5300`.
  - Decision 3: a third bullet `--sl-spectrum-*` / `--sl-spectrum-ink-*` with the light/ink split; fix line ~54 ("viz is theme-independent" → per theme).
  - Effects bullets (~138-139): one sentence each — glass stays neutral; on light the aurora's arc, bloom, `--rim` and `--linear` are the spectrum, busy stays the accent.
  - Light ground: "paper" in the light theme is cool white `#F4F4F8`.
  - New-token policy: "The spectrum was promoted on the owner's call (2026-09-30), not on the ≥2-products rule."
- [ ] **Step 2:** `npm run gen:agent-docs`.
- [ ] **Step 3: README** — a "Light theme: Prism (0.21)" subsection: what changes, `--slc-rim: none` to drop a rim, `data-sl-ink="mono"` for halftone, bare inputs get no rim, nested light islands get spectral effects but no rims, Tier-B products copy the eleven `--sl-spectrum-*` values to opt in.
- [ ] **Step 4: Versions** — `package.json` → `0.21.0`; `pyproject.toml` → `0.2.1`; regenerate the public-surface fixture.
- [ ] **Step 5: Run** — `npm test && npm run audit` → PASS.
- [ ] **Step 6: Commit**

```bash
git add docs packages/ui-kit/agent/design-language.md packages/ui-kit/README.md packages/ui-kit/package.json packages/palette-py/pyproject.toml scripts/fixtures/public-surface.json
git commit -m "docs(design-language): the spectrum is not an accent; ui-kit 0.21.0"
```

---

### Task 7: Visual verification (runs its Step 1 before Task 1)

**Files:** none committed; captures in the session scratchpad.

- [ ] **Step 1 (before Task 1): Baseline captures** — for `showcase/index.html` and `showcase/effects.html`, in `dark`, `high-contrast` and `light`: set the theme with a tiny wrapper page or `?theme=` handling if the showcase has one (read its theme switch at `showcase/effects.html:920`), then

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1400,4000 --screenshot=$SCRATCH/before-<page>-<theme>.png "file://$PWD/showcase/<page>.html"
```

Take one control capture (same page and theme twice) and diff it with `python3 lab/_pixdiff.py` → 0 pixels, proving the pipeline is stable. If animated effects make the control non-zero, add `data-sl-fx-still` to `<html>` in the wrapper.

- [ ] **Step 2 (after Task 6): After captures** — same commands, `after-*`.
- [ ] **Step 3: Dark and high-contrast must match** — `python3 lab/_pixdiff.py before-<page>-dark.png after-<page>-dark.png` → 0 differing pixels, and the same for high-contrast. Any non-zero result is a defect: find which property changed before continuing.
- [ ] **Step 4: Light** — view before/after side by side; attach both to the PR body.
- [ ] **Step 5: Open the PR** — title `feat: 0.21.0 — light Prism: a playful, colourful light theme`; body: what changed, the dark-unchanged proof (pixdiff output), before/after light captures, consumer impact table from the spec (daos and introspect fail `sl-audit` until migrated), and follow-ups: bump site and spexr; migrate daos and introspect.
