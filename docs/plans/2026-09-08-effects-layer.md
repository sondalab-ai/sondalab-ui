# Sondalab DS Effects Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an opt-in effects layer for `@sondalab/ui-kit` that gives interactive elements material behaviour — glitch, liquid, aurora, glass edge — plus a showcase page demonstrating each family declined per component.

**Architecture:** Two new hand-authored files in the published package (`effects.css`, `effects.js`) sitting above `components.css`, plus a demo page. CSS is the implementation; JavaScript (Tier 1) and WebGPU (Tier 2) are additive tiers keyed off attributes set only after the capability answers. Glass and aurora share one masked `::after` ring whose gradient stops are custom properties swapped by state; the liquid owns `::before`; the glitch lives on a required child element.

**Tech Stack:** Plain CSS (custom properties, `@property`, `conic-gradient`, `mask-composite`, `color-mix`), plain ESM JavaScript with no runtime dependencies, `node --test` for tests, `vgpu` as an `optionalDependency` in Slice 3 only.

**Spec:** `docs/specs/2026-09-08-effects-layer-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No new design tokens.** `sondalab.tokens.json` is not edited. `effects.css` and `effects.js` are hand-authored, never generated.
- **No colour literal anywhere.** Every hue comes from `color-mix()` over `--slc-*`/`--sl-*` role-vars. In JavaScript, hues are read with `getComputedStyle` and re-read on `data-sl-theme` change.
- **Mask colours use the `black` keyword, never `#000`.** `sl-audit`'s `COLOR_RE` matches `#[0-9a-fA-F]{3}\b` and would extract `#000` as a design colour; the `black` keyword is not extracted at all. (`#000` happens to be allowlisted today via high-contrast `--sl-bg-canvas: #000000`, but relying on that is accidental.)
- **Two paint layers per element:** `::before` = liquid sheen, `::after` = edge ring. The glitch uses a child `<span class="sl-fx-glitch" data-text="…">`, never the host's pseudo-elements (spec §Decision 3b).
- **Shape declares a background; state rebinds the stops.** A state temperament of the edge (focus, sweep) never re-declares the ring's `background` — it swaps `--slfx-s0..s3`, which is what keeps glass and aurora one material rather than two decorations. Only rules that change the edge's *shape* paint their own, and there are exactly three: the shared ring, the busy arc, and `--linear`. A fourth is a defect.
- **Replaced controls host nothing.** `<input>`/`<textarea>`/`<select>` get their effects on a `.sl-field__control` wrapper (spec §Decision 3b).
- **Namespace:** `--slfx-*` custom properties, `.sl-fx-*` classes. Never `--sl-fx-*`.
- **Role-var fallback chains.** `effects.css` may be loaded without `components.css`, so every `--slc-*` read carries a `--sl-*` fallback: `var(--slc-accent, var(--sl-accent-default))`.
- **Three kill switches, all hard requirements:** `prefers-reduced-motion: reduce` (no Tier 1, no animations), `[data-sl-theme="high-contrast"]` (all four families off), `data-sl-fx="off"` on any subtree.
- **Aurora never replaces the focus `outline`**, and renders state without being it (`aria-busy`, `role="progressbar"` + `aria-valuenow`).
- **Versioning:** `packages/ui-kit/package.json` only. `packages/palette-py/pyproject.toml` is **not** bumped. Slice 2 sets `0.8.0`; Slice 3 sets `0.8.1`.
- **Test command:** `node --test scripts/*.test.mjs` (npm script: `npm test`). Test files live in `scripts/` and are named `*.test.mjs`.
- **Commit trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XXXN5zPRiFK34fkLMkmpuk
  ```

---

# Slice 1 — Effects layer and demo page

## Task 1: Effects file foundation and the audit gate

Creates `effects.css` with only its namespace block and kill switches, and the two tests that gate every later task. Everything after this task adds rules to a file that is already under audit.

**Files:**
- Create: `packages/ui-kit/effects.css`
- Create: `scripts/effects-audit.test.mjs`
- Create: `scripts/effects-guards.test.mjs`

**Interfaces:**
- Consumes: `auditCss`, `buildAllowlistBasesFromCss` from `packages/ui-kit/agent/sl-audit.mjs`.
- Produces: `packages/ui-kit/effects.css` with a `:root` block defining `--slfx-depth`, `--slfx-sheen`, `--slfx-ring-w`, `--slfx-bloom`, `--slfx-arc`, `--slfx-s0`…`--slfx-s3`, `--slfx-edge-warm`, `--slfx-edge-cool`, `--slfx-edge-dim`, `--slfx-px`, `--slfx-py`, `--slfx-d`. Later tasks add rules to this file and never re-declare these.

- [ ] **Step 1: Write the failing audit test**

Create `scripts/effects-audit.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { auditCss, buildAllowlistBasesFromCss } from "../packages/ui-kit/agent/sl-audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const KIT = resolve(REPO, "packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");

const effects = read("effects.css");
const tokens = JSON.parse(readFileSync(resolve(REPO, "sondalab.tokens.json"), "utf8"));
const registry = JSON.parse(read("agent/accent-registry.json"));
const matrix = JSON.parse(read("agent/substrate-matrix.json"));
const blessed = JSON.parse(read("agent/blessed/default.json"));

// The allowlist is resolved the way the shipped audit resolves it: from the
// generated CSS, so effects.css is held to exactly the consumer-visible values.
const allowlistBases = buildAllowlistBasesFromCss([
  read("tokens.css"),
  read("themes/light.css"),
  read("themes/dark.css"),
  read("themes/high-contrast.css"),
]);

test("effects.css carries no colour literal", () => {
  const r = auditCss({
    css: effects,
    tokens,
    allowlistBases,
    accentEntry: registry.products.default,
    blessed,
    declaredTier: null,
    substrate: "Page",
    matrix,
    file: "effects.css",
  });
  const colour = r.findings.filter((f) => f.rule === "accent-one-hue");
  assert.equal(colour.length, 0, `effects.css must use role-vars only, found: ${JSON.stringify(colour)}`);
});

test("effects.css declares no accent step (it derives, never redefines)", () => {
  const r = auditCss({
    css: effects,
    tokens,
    allowlistBases,
    accentEntry: registry.products.default,
    blessed,
    substrate: "Page",
    matrix,
    file: "effects.css",
  });
  const derivation = r.findings.filter((f) => f.rule === "accent-derivation");
  assert.equal(derivation.length, 0, JSON.stringify(derivation));
});

test("effects.css uses the black keyword for masks, never a hex literal", () => {
  assert.doesNotMatch(effects, /mask[^;]*#[0-9a-fA-F]{3,8}/, "mask colours must be the `black` keyword");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test scripts/effects-audit.test.mjs`
Expected: FAIL — `ENOENT` on `packages/ui-kit/effects.css`.

- [ ] **Step 3: Write the guards test**

Create `scripts/effects-guards.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");

// Scan declarations, not prose. A comment that mentions `animation:` is not an
// animation, and this file's comments explain the very rules it asserts — so
// every assertion below reads the comment-stripped source. Stripping cannot
// hide a real declaration, so the guard loses no strength.
const effects = readFileSync(resolve(KIT, "effects.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

test("effects.css disables every family under high-contrast", () => {
  assert.match(effects, /\[data-sl-theme="high-contrast"\]/);
  for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
    const block = effects.slice(effects.indexOf('[data-sl-theme="high-contrast"]'));
    assert.ok(block.includes(cls), `high-contrast kill switch must cover .${cls}`);
  }
});

test("effects.css honours the subtree opt-out", () => {
  assert.match(effects, /\[data-sl-fx="off"\]/);
});

test("every animation sits inside a reduced-motion guard", () => {
  // Collect the character ranges covered by `prefers-reduced-motion: no-preference`
  // blocks, then assert no `animation:` declaration falls outside one.
  const guards = [];
  const re = /@media[^{]*prefers-reduced-motion:\s*no-preference[^{]*\{/g;
  for (const m of effects.matchAll(re)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    do {
      if (effects[i] === "{") depth++;
      else if (effects[i] === "}") depth--;
      i++;
    } while (depth > 0 && i < effects.length);
    guards.push([m.index, i]);
  }
  assert.ok(guards.length > 0, "effects.css must contain a reduced-motion guard");

  for (const m of effects.matchAll(/\banimation:/g)) {
    const inside = guards.some(([a, b]) => m.index > a && m.index < b);
    assert.ok(inside, `animation at index ${m.index} is outside a reduced-motion guard`);
  }
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL — `ENOENT` on `effects.css`.

- [ ] **Step 5: Create `packages/ui-kit/effects.css` with the namespace and kill switches**

```css
/* @sondalab/ui-kit — effects.css
   Hand-authored (NOT generated). Opt-in effects layer above components.css.
   Contract: docs/specs/2026-09-08-effects-layer-design.md

   ── What this layer is ──────────────────────────────────────────────────────
   Four families, each carrying one meaning (spec §Decision 1):
     glitch  — something re-resolved      liquid — you are recognised
     aurora  — attention lives here       glass  — this is a physical surface
   An effect that means nothing is switched off. Classes are ADDITIVE: they
   compose onto components.css classes and never replace them.

   ── Paint layers (spec §Decision 3b) ────────────────────────────────────────
   Every element has exactly two: ::before is the liquid sheen, ::after is the
   edge ring shared by glass and aurora. The glitch therefore lives on a child
   <span class="sl-fx-glitch" data-text="…">, never on the host. Replaced form
   controls render no pseudo-element at all — wrap them in .sl-field__control.

   ── Colour contract ─────────────────────────────────────────────────────────
   No literal, ever. Every hue is a color-mix() over a role-var. Role-vars carry
   a --sl-* fallback so this file also works imported without components.css.
   Mask colours use the `black` keyword: `#000` would be extracted by sl-audit
   as a design colour. */

:root {
  /* colour roles */
  --slfx-depth: var(--sl-accent-depth, var(--slc-accent, var(--sl-accent-default)));
  --slfx-sheen: var(--slc-text, var(--sl-text-primary));
  --slfx-edge-warm: color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 24%, var(--slc-border-strong, var(--sl-border-strong)));
  --slfx-edge-cool: color-mix(in srgb, var(--slfx-depth) 24%, var(--slc-border-strong, var(--sl-border-strong)));
  --slfx-edge-dim: var(--slc-border-subtle, var(--sl-border-subtle));

  /* edge geometry — the ring grows INWARD so it never meets the focus outline */
  --slfx-ring-w: 1px;
  --slfx-bloom: 0px;
  --slfx-arc: 65deg;

  /* ring gradient stops — rebound per state; transparent means "no ring" */
  --slfx-s0: transparent;
  --slfx-s1: transparent;
  --slfx-s2: transparent;
  --slfx-s3: transparent;

  /* liquid pointer state — written by effects.js inside one shared rAF */
  --slfx-px: 50%;
  --slfx-py: 50%;
  --slfx-d: 0;
}

/* ══ KILL SWITCHES ═══════════════════════════════════════════════════════════
   Three, all hard requirements (spec §Decision 4). They are declared before the
   families so a reader meets the exits before the entrances. */

/* 1 — high contrast: the palette is a legibility contract, not a canvas. */
:root[data-sl-theme="high-contrast"] .sl-fx-glass::after,
:root[data-sl-theme="high-contrast"] .sl-fx-aurora::after,
:root[data-sl-theme="high-contrast"] .sl-fx-liquid::before,
:root[data-sl-theme="high-contrast"] .sl-fx-glitch::before,
:root[data-sl-theme="high-contrast"] .sl-fx-glitch::after {
  display: none;
}
:root[data-sl-theme="high-contrast"] .sl-fx-glass,
:root[data-sl-theme="high-contrast"] .sl-fx-aurora {
  box-shadow: none;
}

/* 2 — subtree opt-out: a dense data region inside an expressive page. */
[data-sl-fx="off"] .sl-fx-glass::after,
[data-sl-fx="off"] .sl-fx-aurora::after,
[data-sl-fx="off"] .sl-fx-liquid::before,
[data-sl-fx="off"] .sl-fx-glitch::before,
[data-sl-fx="off"] .sl-fx-glitch::after {
  display: none;
}

/* 3 — reduced motion is not a rule here but a structural one: every `animation:`
   declaration in this file sits inside a `prefers-reduced-motion: no-preference`
   block, and effects.js never sets data-sl-fx="on" under `reduce`. Static
   material (the glass edge, a resting ring) survives, because it is not motion.
   scripts/effects-guards.test.mjs enforces the placement mechanically. */
```

- [ ] **Step 6: Append the reduced-motion guard block**

The guards test requires at least one `prefers-reduced-motion: no-preference` block to exist, because every later task appends its animations into it. Append to `effects.css`:

```css
@media (prefers-reduced-motion: no-preference) {
  /* Every animated rule in this file lives here. Filled by Task 3 (aurora
     sweep/orbit), Task 4 (liquid settle) and Task 5 (glitch channels). */
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `node --test scripts/effects-audit.test.mjs scripts/effects-guards.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-kit/effects.css scripts/effects-audit.test.mjs scripts/effects-guards.test.mjs
git commit -m "feat(ui-kit): effects.css foundation — namespace, kill switches, audit gate"
```

---

## Task 2: The shared edge ring — glass (Tier 0)

The one mechanism glass and aurora both use. Delivered here in its resting temperament only; Task 3 adds the attention temperaments.

**Files:**
- Modify: `packages/ui-kit/effects.css` (append)
- Modify: `scripts/effects-guards.test.mjs` (append tests)

**Interfaces:**
- Consumes: the `:root` block from Task 1 — `--slfx-ring-w`, `--slfx-s0`…`--slfx-s3`, `--slfx-edge-warm`/`-cool`/`-dim`, `--slfx-sheen`.
- Produces: the selector `:is(.sl-fx-glass, .sl-fx-aurora)::after` (the ring) and the registered property `--slfx-angle`. Task 3 rebinds `--slfx-s0`…`--slfx-s3` and animates `--slfx-angle`; it never re-declares the ring.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/effects-guards.test.mjs`:

```js
// The kill-switch assertions from Task 1 sliced to end-of-file, which stops
// testing anything the moment a later task appends a rule naming one of these
// classes — which is exactly what this task does. Bound them to the selectors
// that actually carry the switch. REPLACE the two Task 1 kill-switch tests
// with these two; do not add them alongside.
const selectorsCarrying = (attr) =>
  (effects.match(new RegExp(`[^{}]*\\[${attr}\\][^{}]*\\{`, "g")) || []).join("\n");

const FAMILIES = ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"];

test("effects.css disables every family under high-contrast", () => {
  const sel = selectorsCarrying('data-sl-theme="high-contrast"');
  for (const cls of FAMILIES) assert.ok(sel.includes(cls), `high-contrast kill switch must cover .${cls}`);
});

test("effects.css honours the subtree opt-out for every family", () => {
  const sel = selectorsCarrying('data-sl-fx="off"');
  for (const cls of FAMILIES) assert.ok(sel.includes(cls), `opt-out must cover .${cls}`);
});

test("the ring is one shared rule, not one per family", () => {
  const ring = effects.match(/:is\(\.sl-fx-glass,\s*\.sl-fx-aurora\)::after\s*\{/g) || [];
  assert.equal(ring.length, 1, "glass and aurora must share exactly one ::after rule");
});

test("the ring grows inward — padding is the width, inset stays at the border box", () => {
  const block = effects.slice(effects.indexOf(":is(.sl-fx-glass, .sl-fx-aurora)::after"));
  assert.match(block.slice(0, 600), /inset:\s*-1px/, "ring inset must stay pinned to the border box");
  assert.match(block.slice(0, 600), /padding:\s*var\(--slfx-ring-w/, "ring width must be padding, so it grows inward");
});

test("--slfx-angle is registered with @property", () => {
  assert.match(effects, /@property\s+--slfx-angle\s*\{[^}]*syntax:\s*"<angle>"/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL — 3 failures, the ring rule does not exist.

- [ ] **Step 3: Append the ring and the glass temperament to `effects.css`**

Insert **before** the `@media (prefers-reduced-motion: no-preference)` block:

```css
/* ══ EDGE — glass and aurora are two temperaments of ONE ring ════════════════
   The ring occupies exactly the border band: for an absolutely positioned child
   `inset: 0` resolves against the PADDING box, so `inset: -1px` lands on a 1px
   border — and 1px outside the box when the element has none (a filled button,
   the only case where the ring is external). Width is `padding`, so it grows
   INWARD: growing outward would walk into the focus outline at
   `outline-offset: 2px`, which the aurora must never occupy.
   Do not "correct" the negative inset to a positive one. */

@property --slfx-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 210deg;
}

:is(.sl-fx-glass, .sl-fx-aurora) { position: relative; }

:is(.sl-fx-glass, .sl-fx-aurora)::after {
  content: "";
  position: absolute;
  inset: -1px;
  padding: var(--slfx-ring-w);
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background: conic-gradient(from var(--slfx-angle),
    var(--slfx-s0) 0deg,
    var(--slfx-s1) 95deg,
    var(--slfx-s2) 185deg,
    var(--slfx-s3) 290deg,
    var(--slfx-s0) 360deg);
  /* `black` not `#000`: sl-audit extracts 3-digit hex as a design colour. */
  mask: linear-gradient(black 0 0) content-box, linear-gradient(black 0 0);
  -webkit-mask-composite: xor;   /* Safari below 15.4 */
  mask-composite: exclude;
  transition: opacity var(--sl-motion-mid, 220ms) var(--sl-motion-ease, ease);
}

/* Glass — the resting temperament. Two light angles caught on the edge, plus a
   single inner highlight. The stops are neutral-dominant with a whisper of the
   accent and its depth companion, so the edge reads as material, not as accent. */
.sl-fx-glass {
  --slfx-s0: var(--slfx-edge-warm);
  --slfx-s1: var(--slfx-edge-dim);
  --slfx-s2: var(--slfx-edge-cool);
  --slfx-s3: var(--slfx-edge-dim);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--slfx-sheen) 7%, transparent);
}
.sl-fx-glass::after { opacity: 1; }

/* Container-scale edges. Width is emphasis, not separation — HANDOFF check 4
   classes an emphasis edge as a blessed category, so this is not an L2 breach. */
.sl-fx-glass--wide,
.sl-fx-aurora--wide { --slfx-ring-w: 3px; --slfx-bloom: 22px; }
.sl-fx-glass--field,
.sl-fx-aurora--field { --slfx-ring-w: 2px; --slfx-bloom: 0px; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/effects-audit.test.mjs scripts/effects-guards.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-kit/effects.css scripts/effects-guards.test.mjs
git commit -m "feat(ui-kit): shared edge ring + the glass temperament"
```

---

## Task 3: Aurora — the three attention modes

**Files:**
- Modify: `packages/ui-kit/effects.css` (append; fill the reduced-motion block)
- Modify: `scripts/effects-guards.test.mjs` (append tests)

**Interfaces:**
- Consumes: the ring rule and `--slfx-angle` from Task 2.
- Produces: the attribute contract `data-sl-fx-live="on" | "busy"` and the custom property `--slfx-progress` (unitless `0`–`1`). `effects.js` (Task 6) grants and revokes `data-sl-fx-live="on"`; it never touches `"busy"`, which the consumer sets alongside `aria-busy`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/effects-guards.test.mjs`:

```js
test("only shape re-declares the ring background; states rebind the stops", () => {
  // The invariant: a STATE temperament never gets its own background — it swaps
  // --slfx-s0..s3 on the shared ring, which is what keeps glass and aurora one
  // material. Only rules that change the edge's SHAPE declare their own, and
  // there are exactly three: the shared ring itself, the busy arc, and the
  // linear segment. Scanning by selector shape (the earlier form of this test)
  // silently skipped any override whose selector did not match the guessed
  // pattern; this scans every edge rule in the file.
  const rules = effects.match(/[^{}]*\.sl-fx-(?:glass|aurora)[^{}]*\{[^}]*\}/g) || [];
  const declaring = rules
    // Longhands too: an earlier form of this guard matched only the shorthand,
    // which is a narrower net than "any rule that paints a background".
    .filter((r) => /\{[^}]*background(?:-color|-image)?\s*:/.test(r))
    .map((r) => r.slice(0, r.indexOf("{")).trim().replace(/\s+/g, " "));
  assert.equal(
    declaring.length, 3,
    `exactly three edge rules may declare a background, got: ${JSON.stringify(declaring)}`,
  );
  assert.ok(declaring.some((s) => s.startsWith(":is(")), "the shared ring must be one");
  assert.ok(declaring.some((s) => s.includes('[data-sl-fx-live="busy"]')), "the busy arc must be one");
  assert.ok(declaring.some((s) => s.includes("sl-fx-aurora--linear")), "the linear segment must be one");
});

test("the busy orbit is inside the reduced-motion guard but the busy ring is not", () => {
  const guardStart = effects.indexOf("@media (prefers-reduced-motion: no-preference)");
  const orbit = effects.indexOf("slfx-orbit 1.1s");
  // Anchor on the rule that PAINTS the busy ring — the one whose body declares a
  // background — not on any rule that merely shares a selector prefix. A plain
  // indexOf on the selector text resolves to the `--slfx-arc` property-setting
  // rule that sits just above it, and would pass on a file where the painting
  // rule had been moved inside the guard. Matching the body keeps the assertion
  // true to its own name while tolerating future `:not()` modifiers.
  const rule = /[^{}]*\[data-sl-fx-live="busy"\][^{}]*::after[^{}]*\{[^}]*background(?:-color|-image)?\s*:[^}]*\}/.exec(effects);
  assert.ok(rule, "the busy ring's painting rule must exist");
  assert.ok(orbit > guardStart, "the orbit animation must sit inside the reduced-motion guard");
  assert.ok(rule.index < guardStart, "the busy ring itself must render regardless of motion preference");
});

test("determinate progress drives arc length, not an animation", () => {
  assert.match(effects, /--slfx-arc:\s*calc\(var\(--slfx-progress\)\s*\*\s*360deg\)/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL — 3 failures.

- [ ] **Step 3: Append the aurora modes**

Insert **before** the `@media (prefers-reduced-motion: no-preference)` block:

```css
/* ══ AURORA — attention lives here ═══════════════════════════════════════════
   Three readings of the one ring, separated by the FRACTION OF THE PERIMETER
   that is lit — not by colour and not by speed, which is why they stay legible
   side by side.
     static (~60%)  :focus-visible / :focus-within — this element has focus
     sweep  (~60%)  [data-sl-fx-live="on"]         — ambient liveness, capped at
                                                     one per document
     busy   (~18%)  [data-sl-fx-live="busy"]       — a real operation runs here
     determinate    busy + --slfx-progress          — the arc LENGTH is the value

   The aurora renders state; it never IS the state. A busy element carries
   aria-busy="true"; a determinate one role="progressbar" + aria-valuenow. That
   is what keeps reduced-motion and high-contrast visitors fully informed. */

.sl-fx-aurora:is(:focus-visible, :focus-within, [data-sl-fx-live="on"]) {
  --slfx-s0: transparent;
  --slfx-s1: color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 90%, transparent);
  --slfx-s2: color-mix(in srgb, var(--slfx-depth) 90%, transparent);
  --slfx-s3: transparent;
  box-shadow: inset 0 0 var(--slfx-bloom) color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 18%, transparent);
}
.sl-fx-aurora:is(:focus-visible, :focus-within, [data-sl-fx-live="on"])::after { opacity: 1; }

/* Busy — a short travelling marker, so a different GEOMETRY rather than a
   rebinding of the stops. Declaring its own background is what separates a
   SHAPE from a STATE: states swap --slfx-s0..s3 on the shared ring, and only
   the three shape rules (the ring, this arc, and --linear below) paint their
   own. On an element that is both glass and busy, busy wins, which is correct:
   a resting edge and a working edge are not the same edge.

   --linear is excluded because the two shapes are incompatible: a conic arc
   painted into a 2px horizontal strip renders as a smear. A linear aurora has
   no busy mode — report work on a ring aurora, not on an underline. */
.sl-fx-aurora[data-sl-fx-live="busy"] { --slfx-arc: 65deg; }
.sl-fx-aurora[data-sl-fx-live="busy"]:not(.sl-fx-aurora--linear)::after {
  opacity: 1;
  background: conic-gradient(from var(--slfx-angle),
    color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 92%, transparent) 0deg,
    color-mix(in srgb, var(--slfx-depth) 78%, transparent) calc(var(--slfx-arc) * 0.62),
    transparent var(--slfx-arc),
    transparent 360deg);
}

/* Determinate — the arc length is the value; nothing rotates. The edge of a
   card IS its progress bar: no extra widget, no layout.
   CONSUMER CONTRACT: --slfx-progress must be set INLINE on the element (an
   inline style is what [style*="--slfx-progress"] detects). Setting it from a
   stylesheet rule leaves the element in indeterminate mode — self-consistent,
   but not what the author asked for. element.style.setProperty() and a
   framework `style` prop both satisfy this. */
.sl-fx-aurora[data-sl-fx-live="busy"][style*="--slfx-progress"] {
  --slfx-arc: calc(var(--slfx-progress) * 360deg);
}

/* Linear aurora — where the edge is not a ring. The active tab's 2px underline,
   a link's underline, an inversion band's top rule: the same two hues swept
   along a segment instead of a perimeter. */
.sl-fx-aurora--linear::after {
  inset: auto 0 0 0;
  height: var(--slfx-ring-w);
  padding: 0;
  mask: none;
  background: linear-gradient(90deg,
    transparent 0%,
    color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 90%, transparent) 38%,
    color-mix(in srgb, var(--slfx-depth) 90%, transparent) 62%,
    transparent 100%);
}
```

- [ ] **Step 4: Fill the reduced-motion block**

Replace the placeholder `@media (prefers-reduced-motion: no-preference) { … }` from Task 1 with:

```css
@media (prefers-reduced-motion: no-preference) {
  /* Sweep: 210deg → 570deg rather than 0 → 360, so the rotation is continuous
     instead of snapping back through the resting angle. */
  @keyframes slfx-sweep { to { --slfx-angle: 570deg; } }
  @keyframes slfx-orbit { to { --slfx-angle: 570deg; } }

  [data-sl-fx="on"] .sl-fx-aurora[data-sl-fx-live="on"]::after {
    animation: slfx-sweep 3.2s linear infinite;
    will-change: background;
  }
  /* Determinate never orbits — its arc length carries the value. */
  [data-sl-fx="on"] .sl-fx-aurora[data-sl-fx-live="busy"]:not([style*="--slfx-progress"]):not(.sl-fx-aurora--linear)::after {
    animation: slfx-orbit 1.1s linear infinite;
    will-change: background;
  }
}

/* Under `reduce` the busy arc does not orbit: it renders as a static ring at
   reduced opacity — present, honest that something is happening, not moving.
   aria-busy carries the state, which is why that attribute is a requirement. */
@media (prefers-reduced-motion: reduce) {
  .sl-fx-aurora[data-sl-fx-live="busy"]:not(.sl-fx-aurora--linear) { --slfx-arc: 360deg; }
  .sl-fx-aurora[data-sl-fx-live="busy"]:not(.sl-fx-aurora--linear)::after { opacity: 0.55; }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test scripts/effects-audit.test.mjs scripts/effects-guards.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/effects.css scripts/effects-guards.test.mjs
git commit -m "feat(ui-kit): aurora — static, sweep, busy and determinate modes"
```

---

## Task 4: Liquid — pointer sheen and radius morph

**Files:**
- Modify: `packages/ui-kit/effects.css` (append)
- Modify: `scripts/effects-guards.test.mjs` (append one test)

**Interfaces:**
- Consumes: `--slfx-px`, `--slfx-py`, `--slfx-d`, `--slfx-sheen` from Task 1.
- Produces: the contract `effects.js` writes in Task 6 — `--slfx-px`/`--slfx-py` as percentages, `--slfx-d` as a unitless `0`–`1`, and `--slfx-c0`…`--slfx-c3` as per-corner bulge pixels. Also the filter id `slfx-liquid`, which `effects.js` injects.

- [ ] **Step 1: Write the failing test**

Append to `scripts/effects-guards.test.mjs`:

First, add a brace-aware rule extractor near the top of `scripts/effects-guards.test.mjs`, just below the comment-stripped `effects` constant, and **retrofit every rule-scanning assertion in the file to use it** — the three-shape background test and the busy ring/orbit ordering test from Task 3 as well as the new filter test. A flat `/[^{}]*\{[^}]*\}/g` cannot see nesting: inside `@media (...) { .sel { … } }` it consumes the prelude and the inner rule's opening brace together and reports the media prelude as a selector. That is the fourth assertion in this file to test something adjacent to what it names, so it gets fixed as a class rather than as an instance.

```js
/** Leaf CSS rules with their own selector, body and source index.
 *  At-rules are descended into rather than reported, so a rule nested in an
 *  @media block yields its real selector and its real position in the file. */
function rules(css) {
  const out = [];
  const parse = (from, to) => {
    let selStart = from;
    let j = from;
    while (j < to) {
      if (css[j] === "}") { selStart = ++j; continue; }
      if (css[j] !== "{") { j++; continue; }
      let depth = 1;
      let k = j + 1;
      while (k < to && depth > 0) {
        if (css[k] === "{") depth++;
        else if (css[k] === "}") depth--;
        k++;
      }
      const body = css.slice(j + 1, k - 1);
      if (body.includes("{")) parse(j + 1, k - 1);
      else out.push({ selector: css.slice(selStart, j).trim().replace(/\s+/g, " "), body, index: selStart });
      selStart = k;
      j = k;
    }
  };
  parse(0, css.length);
  return out;
}

const RULES = rules(effects);
const PAINTS = /background(?:-color|-image)?\s*:/;
```

Retrofit the two Task 3 assertions to read from `RULES`:

```js
test("only shape re-declares the ring background; states rebind the stops", () => {
  const declaring = RULES
    .filter((r) => /\.sl-fx-(?:glass|aurora)/.test(r.selector) && PAINTS.test(r.body))
    .map((r) => r.selector);
  assert.equal(
    declaring.length, 3,
    `exactly three edge rules may declare a background, got: ${JSON.stringify(declaring)}`,
  );
  assert.ok(declaring.some((s) => s.startsWith(":is(")), "the shared ring must be one");
  assert.ok(declaring.some((s) => s.includes('[data-sl-fx-live="busy"]')), "the busy arc must be one");
  assert.ok(declaring.some((s) => s.includes("sl-fx-aurora--linear")), "the linear segment must be one");
});

test("the busy orbit is inside the reduced-motion guard but the busy ring is not", () => {
  const guardStart = effects.indexOf("@media (prefers-reduced-motion: no-preference)");
  const orbit = effects.indexOf("slfx-orbit 1.1s");
  const ring = RULES.find(
    (r) => /\[data-sl-fx-live="busy"\]/.test(r.selector) && r.selector.endsWith("::after") && PAINTS.test(r.body),
  );
  assert.ok(ring, "the busy ring's painting rule must exist");
  assert.ok(orbit > guardStart, "the orbit animation must sit inside the reduced-motion guard");
  assert.ok(ring.index < guardStart, "the busy ring itself must render regardless of motion preference");
});
```

Then the new filter test:

```js
test("the liquid filter is applied to the sheen layer only, never to a text box", () => {
  // Isolate the RULE that carries the filter, then assert on its own selector.
  // Do NOT slice a text window backwards from the declaration to the previous
  // `}`: that asserts on whatever happens to sit in the window, so it fails on
  // the very same rule written on one line, and would pass on any preceding
  // text that merely contained the substring `::before`. The source is already
  // comment-stripped at read time, so a rule's selector is all that precedes it.
  const carrying = RULES.filter((r) => /filter:\s*url\(#slfx-liquid\)/.test(r.body));
  assert.equal(carrying.length, 1, "exactly one rule may carry the liquid filter");
  assert.match(
    carrying[0].selector, /::before$/,
    `the liquid filter must sit on the ::before sheen, never on the host — got: ${carrying[0].selector}`,
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL — "exactly one rule may carry the liquid filter", found 0.

- [ ] **Step 3: Append the liquid family**

Insert **before** the `@media (prefers-reduced-motion: no-preference)` block:

```css
/* ══ LIQUID — you are recognised ═════════════════════════════════════════════
   Two composed parts, both non-destructive:
     1. a specular sheen on ::before, centred on the pointer and scaled by
        engagement, warped by an SVG turbulence filter under Tier 1;
     2. a per-corner radius morph, so the box softens towards the pointer.

   NON-DESTRUCTIVENESS IS A CONTRACT: the filter is applied to the sheen
   pseudo-element ONLY, never to a box containing text. An SVG filter disables
   subpixel antialiasing across its whole subtree, so filtering the host would
   visibly degrade every label in the interface. Text geometry never moves —
   only light does. */

.sl-fx-liquid {
  --slfx-c0: 0px; --slfx-c1: 0px; --slfx-c2: 0px; --slfx-c3: 0px;
  position: relative;
  border-radius:
    calc(var(--sl-radius-md, 6px) + var(--slfx-c0))
    calc(var(--sl-radius-md, 6px) + var(--slfx-c1))
    calc(var(--sl-radius-md, 6px) + var(--slfx-c2))
    calc(var(--sl-radius-md, 6px) + var(--slfx-c3));
  transition: border-radius var(--sl-motion-mid, 220ms) var(--sl-motion-ease, ease);
}

.sl-fx-liquid::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(9rem 9rem at var(--slfx-px) var(--slfx-py),
    color-mix(in srgb, var(--slfx-sheen) calc(var(--slfx-d) * 34%), transparent) 0%,
    transparent 68%);
  transition: background var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}

/* Tier 1 only: effects.js injects <filter id="slfx-liquid"> on mount(). Without
   it the sheen is a clean gradient, which is the correct Tier 0 reading. */
[data-sl-fx="on"] .sl-fx-liquid::before { filter: url(#slfx-liquid); }

/* Reduced amplitude for containers — a card is not a button. */
.sl-fx-liquid--calm { --slfx-d: 0; }
[data-sl-fx="on"] .sl-fx-liquid--calm::before { filter: none; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/effects-audit.test.mjs scripts/effects-guards.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-kit/effects.css scripts/effects-guards.test.mjs
git commit -m "feat(ui-kit): liquid — pointer sheen on ::before, per-corner radius morph"
```

---

## Task 5: Glitch — two ghost channels on a child element

Generalised from `sondalab-site/src/lib/glitch.ts` and `src/styles/site.css:240-340`. Read those before starting; the amplitude and clip-path values below are carried over deliberately, because they were tuned by eye.

**Files:**
- Modify: `packages/ui-kit/effects.css` (append; add to the reduced-motion block)
- Modify: `scripts/effects-guards.test.mjs` (append one test)

**Interfaces:**
- Consumes: nothing from earlier tasks except the kill switches.
- Produces: the markup contract `<span class="sl-fx-glitch" data-text="…">`, the burst class `is-glitching`, and the per-burst inline properties `effects.js` sets in Task 6 — `--slfx-gda`, `--slfx-gdb`, `--slfx-gdj` (durations), `--slfx-gpha`, `--slfx-gphb` (negative phase delays), `--slfx-gmul` (amplitude multiplier), `--slfx-sx` (per-shard offset).
- Also produces two **markup-level** properties that `effects.js` does NOT set: each `.sl-fx-glitch__shard` carries `--slfx-i` (its 0-based band index) and `--slfx-n` (the band count) as inline styles authored by the consumer. The shard `clip-path` divides by them; a shard missing them has an invalid `clip-path` and silently does not render. Task 7's showcase and Task 10's catalog snippet must both emit them.

- [ ] **Step 1: Write the failing test**

Append to `scripts/effects-guards.test.mjs`:

```js
test("the glitch ghosts are real rules on the child span", () => {
  // Assert on real rules, never on substrings: Task 1's kill switches already
  // contain the literal text `.sl-fx-glitch::before`, so a substring match here
  // would pass on a file where this task's rules had never been written at all.
  const ghost = RULES.find(
    (r) => /\.sl-fx-glitch::before/.test(r.selector) && /content:\s*attr\(data-text\)/.test(r.body),
  );
  assert.ok(ghost, "the ghost channels must declare content: attr(data-text)");
  assert.match(ghost.selector, /\.sl-fx-glitch::after/, "both channels share one rule");
  assert.match(ghost.body, /mix-blend-mode:\s*screen/, "the channels must blend where they overlap");

  const channels = RULES.filter((r) => /^\.sl-fx-glitch\.is-glitching::(before|after)$/.test(r.selector));
  assert.equal(channels.length, 2, "both ghost channels must be coloured");
});

test("the glitch never claims the host's paint layers", () => {
  // ::before is the liquid sheen and ::after is the edge ring, so a glitch that
  // nested an edge or sheen class under itself would be competing for a layer
  // it does not own.
  const nested = RULES
    .filter((r) => /\.sl-fx-glitch\s+\.sl-fx-(glass|aurora|liquid)/.test(r.selector))
    .map((r) => r.selector);
  assert.deepEqual(nested, [], "the glitch must not nest an edge or sheen class");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL — `.sl-fx-glitch::before` not found.

- [ ] **Step 3: Append the glitch family**

Insert **before** the `@media (prefers-reduced-motion: no-preference)` block:

```css
/* ══ GLITCH — something re-resolved ══════════════════════════════════════════
   Short staccato RGB pulses in a finite burst. Two ghost channels off the brand
   pair (accent + its depth companion), blended with mix-blend-mode: screen so
   they mix where they overlap. JS owns TIMING (finite, randomised, capped); CSS
   owns the look and loops while `is-glitching` is present.

   The element needs data-text set to its own text, for the ghost copies. It is
   a CHILD of the component, never the component itself (spec §Decision 3b) —
   that keeps ::before/::after free for the ring and the sheen on the host.

   Unlike the sondalab-site original this respects prefers-reduced-motion. The
   site's opt-out is a site-level blessed deviation; l4-reduced-motion is R on
   IDE/App/Page and the kit ships to all of them. */

.sl-fx-glitch {
  position: relative;
  display: inline-block;
  --slfx-gx: 2px;
}
.sl-fx-glitch::before,
.sl-fx-glitch::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  white-space: inherit;
  mix-blend-mode: screen;
}
.sl-fx-glitch.is-glitching::before { color: var(--slc-accent, var(--sl-accent-default)); }
.sl-fx-glitch.is-glitching::after  { color: var(--slfx-depth); }

/* Shatter variant — during a burst the text breaks into horizontal bands that
   jump sideways. Bands are stacked copies clipped to one strip each; JS sets a
   random --slfx-sx per band per burst. The intact copy hides while they show. */
.sl-fx-glitch__text { position: relative; z-index: 1; }
.sl-fx-glitch__shards { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
/* MARKUP CONTRACT: each shard carries --slfx-i (this band's index, 0-based) and
   --slfx-n (how many bands) as inline styles, authored by the consumer — the
   clip-path below divides by them. effects.js sets only --slfx-sx, the per-burst
   sideways offset. A shard without them has an invalid clip-path and does not
   render, which is a silent failure, so emit them on every shard:
     <span class="sl-fx-glitch__shard" style="--slfx-i:0; --slfx-n:5">…</span> */
.sl-fx-glitch__shard {
  position: absolute;
  inset: 0;
  white-space: nowrap;
  opacity: 0;
  clip-path: inset(
    calc(var(--slfx-i) / var(--slfx-n) * 100%) 0
    calc((var(--slfx-n) - 1 - var(--slfx-i)) / var(--slfx-n) * 100%) 0);
}
.sl-fx-glitch--shatter.is-glitching .sl-fx-glitch__text { opacity: 0; }
.sl-fx-glitch--shatter.is-glitching .sl-fx-glitch__shard { opacity: 1; }
```

- [ ] **Step 4: Add the glitch animations to the reduced-motion block**

Inside the existing `@media (prefers-reduced-motion: no-preference)` block, append:

```css
  /* Base jitter on the real text plus a third colour halo via text-shadow. */
  @keyframes slfx-glitch-jit {
    0%   { transform: translate(0, 0); text-shadow: none; }
    50%  {
      transform: translate(calc(-0.4 * var(--slfx-gx) * var(--slfx-gmul, 1)), 0);
      text-shadow:
        calc(0.8 * var(--slfx-gx) * var(--slfx-gmul, 1)) 0 color-mix(in srgb, var(--slc-accent-hover, var(--sl-accent-hover)) 55%, transparent),
        calc(-0.8 * var(--slfx-gx) * var(--slfx-gmul, 1)) 0 color-mix(in srgb, var(--slfx-depth) 40%, transparent);
    }
    100% { transform: translate(calc(0.4 * var(--slfx-gx) * var(--slfx-gmul, 1)), 0); text-shadow: none; }
  }
  /* Accent ghost — slices flicker, opacity pulses so it strobes. */
  @keyframes slfx-glitch-a {
    0%   { opacity: 0.22; transform: translate(calc(-1 * var(--slfx-gx) * var(--slfx-gmul, 1)), 0);      clip-path: inset(0 0 68% 0); }
    50%  { opacity: 0.4;  transform: translate(calc(-1.7 * var(--slfx-gx) * var(--slfx-gmul, 1)), 1px);  clip-path: inset(55% 0 12% 0); }
    100% { opacity: 0.28; transform: translate(calc(-0.6 * var(--slfx-gx) * var(--slfx-gmul, 1)), 0);    clip-path: inset(28% 0 42% 0); }
  }
  /* Depth ghost — offset phase so the two channels cross and blend. */
  @keyframes slfx-glitch-b {
    0%   { opacity: 0.38; transform: translate(calc(var(--slfx-gx) * var(--slfx-gmul, 1)), 0);           clip-path: inset(52% 0 18% 0); }
    50%  { opacity: 0.2;  transform: translate(calc(1.7 * var(--slfx-gx) * var(--slfx-gmul, 1)), -1px);  clip-path: inset(8% 0 60% 0); }
    100% { opacity: 0.34; transform: translate(calc(0.6 * var(--slfx-gx) * var(--slfx-gmul, 1)), 0);     clip-path: inset(30% 0 40% 0); }
  }
  @keyframes slfx-shatter {
    0%   { transform: translateX(0); }
    50%  { transform: translateX(calc(var(--slfx-sx, 0px) * var(--slfx-gmul, 1))); }
    100% { transform: translateX(0); }
  }

  [data-sl-fx="on"] .sl-fx-glitch.is-glitching {
    animation: slfx-glitch-jit var(--slfx-gdj, 0.16s) steps(2) infinite;
  }
  [data-sl-fx="on"] .sl-fx-glitch.is-glitching::before {
    animation: slfx-glitch-a var(--slfx-gda, 0.16s) steps(2) infinite;
    animation-delay: var(--slfx-gpha, 0s);
  }
  [data-sl-fx="on"] .sl-fx-glitch.is-glitching::after {
    animation: slfx-glitch-b var(--slfx-gdb, 0.16s) steps(2) infinite;
    animation-delay: var(--slfx-gphb, 0s);
  }
  [data-sl-fx="on"] .sl-fx-glitch--shatter.is-glitching .sl-fx-glitch__shard {
    animation: slfx-shatter var(--slfx-gda, 0.16s) steps(2) infinite;
    animation-delay: calc(var(--slfx-i) * -0.028s);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test scripts/effects-audit.test.mjs scripts/effects-guards.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/effects.css scripts/effects-guards.test.mjs
git commit -m "feat(ui-kit): glitch — two ghost channels on a child, reduced-motion respected"
```

---

## Task 6: `effects.js` — Tier 1 driver and coordinator

**Files:**
- Create: `packages/ui-kit/effects.js`
- Create: `scripts/effects-js.test.mjs`

**Interfaces:**
- Consumes: the CSS contracts from Tasks 3–5 (`data-sl-fx-live`, `--slfx-px/py/d`, `--slfx-c0..c3`, `is-glitching`, `--slfx-gd*`/`--slfx-gph*`/`--slfx-gmul`/`--slfx-sx`, the filter id `slfx-liquid`).
- Produces:
  - `mount(root = document) => boolean` — arms Tier 1 (sets `data-sl-fx="on"` on `document.documentElement`, injects the SVG filter defs, wires the delegated pointer listener). Returns `false` and does nothing under `prefers-reduced-motion: reduce` or high-contrast.
  - `burst(el, { burstMin = 200, burstMax = 500 } = {}) => void`
  - `scramble(el, { duration = 520, tick = 45 } = {}) => void`
  - `grantLive(el) => void` / `revokeLive(el) => void` — the ambient-aurora coordinator.
  - `mountGpu() => Promise<boolean>` — documented no-op returning `false` until Slice 3.

- [ ] **Step 1: Write the failing test**

`effects.js` touches the DOM, so the test asserts on its source rather than executing it — the repo has no DOM test harness and adding one is out of scope. Create `scripts/effects-js.test.mjs`. Three of these tests execute the module rather than inspecting its source — Node has no `document` and no `window`, so a top-level DOM access throws on import, and the coordinator's state machine is testable with plain objects. Only what genuinely needs a browser stays a source assertion, and those are written to be order-sensitive rather than presence-sensitive:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = resolve(HERE, "../packages/ui-kit/effects.js");
const js = readFileSync(MODULE, "utf8");
const load = () => import(pathToFileURL(MODULE).href);

/** The body of a top-level exported function, so an assertion can be about
 *  ORDER inside it rather than about a string existing somewhere in the file. */
function fnBody(name) {
  const start = js.search(new RegExp(`export (?:async )?function ${name}\\b`));
  assert.ok(start > -1, `missing export: ${name}`);
  // Step over the parameter list first. A destructured default such as
  // `{ burstMin = 200 }` puts a brace before the body, so the first `{` after
  // the function name is not the body's.
  let i = js.indexOf("(", start);
  let depth = 0;
  do {
    if (js[i] === "(") depth++;
    else if (js[i] === ")") depth--;
    i++;
  } while (depth > 0 && i < js.length);
  const open = js.indexOf("{", i);
  depth = 0;
  i = open;
  do {
    if (js[i] === "{") depth++;
    else if (js[i] === "}") depth--;
    i++;
  } while (depth > 0 && i < js.length);
  return js.slice(open + 1, i - 1);
}

// The audit reads CSS only, so a literal here would pass the gate while
// breaking the contract. Cover every CSS colour function, not just rgb() —
// `color-mix(` is deliberately not matched, since it takes role-vars.
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;

test("effects.js contains no colour literal", () => {
  const hits = js.match(COLOUR) || [];
  assert.deepEqual(hits, [], `hues must be read from tokens with getComputedStyle, found: ${hits}`);
});

test("effects.js exports the documented API", () => {
  for (const name of ["mount", "burst", "scramble", "grantLive", "revokeLive", "mountGpu"]) {
    assert.match(js, new RegExp(`export (async )?function ${name}\\b`), `missing export: ${name}`);
  }
});

test("importing the module has no side effects", async () => {
  // Node has no `document` and no `window`, so ANY top-level DOM access throws
  // a ReferenceError here. Executing the module beats guessing at its shape:
  // a regex for `^document\.` missed indented and `window.`-prefixed access.
  await assert.doesNotReject(load);
});

/** The single statement a guard opens: from its text to its first `;`.
 *  Bounding to the statement matters — mount()'s two guards sit three lines
 *  apart, and a window spanning both accepted either one's `return false` as
 *  evidence for the other, so gutting one guard alone went undetected. */
function guardStatement(body, needle) {
  const at = body.indexOf(needle);
  assert.ok(at > -1, `guard not found: ${needle}`);
  return body.slice(at, body.indexOf(";", at) + 1);
}

test("mount() refuses to arm Tier 1 under reduced motion", () => {
  const body = fnBody("mount");
  const guard = body.indexOf("matchMedia(REDUCE).matches");
  const arm = body.indexOf('setAttribute("data-sl-fx", "on")');
  assert.ok(guard > -1, "mount() must consult the reduced-motion query");
  assert.ok(arm > -1, "mount() must arm Tier 1 by setting data-sl-fx");
  assert.ok(guard < arm, "the reduced-motion guard must precede arming, not follow it");
  assert.match(
    guardStatement(body, "matchMedia(REDUCE).matches"), /return false/,
    "the reduced-motion guard must return, not merely branch",
  );
});

test("mount() refuses to arm Tier 1 under high contrast", () => {
  const body = fnBody("mount");
  const guard = body.indexOf('"high-contrast"');
  const arm = body.indexOf('setAttribute("data-sl-fx", "on")');
  assert.ok(guard > -1, "mount() must consult the theme");
  assert.ok(guard < arm, "the high-contrast guard must precede arming");
  assert.match(
    guardStatement(body, '"high-contrast"'), /return false/,
    "the high-contrast guard must return, not merely branch",
  );
});

test("burst drops an overlapping burst rather than queueing it", () => {
  const body = fnBody("burst");
  assert.match(
    body, /if\s*\([^)]*burstActive[^)]*\)\s*return;/,
    "an in-flight burst must cause an early return",
  );
  assert.doesNotMatch(
    body, /setTimeout\([^)]*\bburst\s*\(/,
    "a dropped burst must not be re-scheduled — a queue reads as breakage, not as signal",
  );
});

test("burst refuses a detached element", () => {
  assert.match(
    fnBody("burst"), /isConnected/,
    "a burst on a detached node leaves a timer mutating something nothing can see",
  );
});

test("burst does nothing before mount() has armed Tier 1", async () => {
  const { burst } = await load();
  const el = {
    isConnected: true,
    classList: { add: () => assert.fail("burst must not fire before mount() arms Tier 1") },
    style: { setProperty() {} },
    querySelectorAll: () => [],
  };
  burst(el);
});

test("the ambient aurora is granted to one element at a time", async () => {
  const { grantLive, revokeLive } = await load();
  const make = () => {
    const attrs = {};
    return {
      attrs,
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
    };
  };
  const first = make();
  const second = make();
  grantLive(first);
  assert.equal(first.attrs["data-sl-fx-live"], "on");
  grantLive(second);
  assert.equal(first.attrs["data-sl-fx-live"], undefined, "the previous holder falls back to its resting ring");
  assert.equal(second.attrs["data-sl-fx-live"], "on");
  revokeLive(second);
  assert.equal(second.attrs["data-sl-fx-live"], undefined);
});

test("the coordinator never touches the busy value", () => {
  // Busy auroras are the consumer's and are exempt from the budget: they are
  // bound to real work, and several can legitimately run at once.
  assert.doesNotMatch(fnBody("grantLive"), /busy/);
  assert.doesNotMatch(fnBody("revokeLive"), /busy/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/effects-js.test.mjs`
Expected: FAIL — `ENOENT` on `packages/ui-kit/effects.js`.

- [ ] **Step 3: Create `packages/ui-kit/effects.js`**

```js
/* @sondalab/ui-kit — effects.js
   Hand-authored Tier 1 driver for effects.css.
   Contract: docs/specs/2026-09-08-effects-layer-design.md

   Importing this module does nothing. mount() is explicit, which is what makes
   the IDE opt-in possible: a Theia surface that never calls it pays nothing.

   COLOUR: sl-audit reads CSS only, so a literal in this file would pass the gate
   while breaking the design-system contract. Every hue is read from a token with
   getComputedStyle and re-read on theme change. scripts/effects-js.test.mjs
   enforces the absence of literals. */

const REDUCE = "(prefers-reduced-motion: reduce)";
const CAP_MS = 1500;                      // hard ceiling on any single burst
const rand = (a, b) => a + Math.random() * (b - a);

/* ── coordinator state (spec §Decision 5) ─────────────────────────────────────
   One ambient aurora and one glitch burst at a time. Busy auroras are exempt:
   they are bound to real work and several can legitimately run at once. */
let liveEl = null;
let burstActive = false;
let armed = false;

/** The document's live token values, re-read whenever the theme changes.
 *  Nothing in Tier 1 reads these — the CSS owns every colour it paints. They
 *  exist for the GPU tier, whose shader needs real values as uniforms and
 *  cannot resolve a custom property. Kept here so there is exactly one place
 *  that reads a hue from the token layer, and one observer keeping it live. */
const tokens = { accent: "", depth: "", text: "", canvas: "" };

function readTokens(root = document.documentElement) {
  const cs = getComputedStyle(root);
  tokens.accent = cs.getPropertyValue("--sl-accent-default").trim();
  tokens.depth = cs.getPropertyValue("--sl-accent-depth").trim();
  tokens.text = cs.getPropertyValue("--sl-text-primary").trim();
  tokens.canvas = cs.getPropertyValue("--sl-bg-canvas").trim();
}

/** The turbulence filter the liquid sheen references. Injected once. */
function injectFilterDefs() {
  if (document.getElementById("slfx-defs")) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = "slfx-defs";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.innerHTML = `
    <filter id="slfx-liquid" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="7" result="n">
        <animate attributeName="baseFrequency" dur="9s" repeatCount="indefinite"
                 values="0.012 0.028; 0.019 0.017; 0.012 0.028" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" />
    </filter>`;
  document.body.appendChild(svg);
}

/* ── liquid: one delegated listener, one shared rAF ──────────────────────────
   Pointer coordinates are written as custom properties on the hovered element
   only. Elements outside the viewport never receive a write. */
let pending = null;
let rafId = 0;

function flush() {
  rafId = 0;
  if (!pending) return;
  const { el, x, y, w, h } = pending;
  pending = null;
  el.style.setProperty("--slfx-px", `${((x / w) * 100).toFixed(1)}%`);
  el.style.setProperty("--slfx-py", `${((y / h) * 100).toFixed(1)}%`);
  el.style.setProperty("--slfx-d", "1");
  // Per-corner bulge: the near corners soften, the far ones stay crisp. The
  // box never grows — only its radii change, so nothing reflows around it.
  const corners = [[0, 0], [w, 0], [w, h], [0, h]];
  corners.forEach(([cx, cy], i) => {
    const d = Math.hypot(x - cx, y - cy) / Math.hypot(w, h);
    el.style.setProperty(`--slfx-c${i}`, `${(10 * (1 - d)).toFixed(1)}px`);
  });
}

function onPointerMove(ev) {
  const el = ev.target instanceof Element ? ev.target.closest(".sl-fx-liquid") : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  pending = { el, x: ev.clientX - r.left, y: ev.clientY - r.top, w: r.width, h: r.height };
  if (!rafId) rafId = requestAnimationFrame(flush);
}

function onPointerLeave(ev) {
  const el = ev.target instanceof Element ? ev.target.closest(".sl-fx-liquid") : null;
  if (!el) return;
  el.style.setProperty("--slfx-d", "0");
  for (let i = 0; i < 4; i++) el.style.setProperty(`--slfx-c${i}`, "0px");
}

/* ── glitch ──────────────────────────────────────────────────────────────────
   Re-roll the two ghost channels for this burst: each gets its own pulse
   duration and a negative phase delay (so they start mid-cycle and drift
   apart), plus a shared amplitude multiplier. */
function randomizeGhosts(el) {
  const dur = () => `${(0.11 + Math.random() * 0.12).toFixed(3)}s`;
  const phase = () => `-${(Math.random() * 0.22).toFixed(3)}s`;
  el.style.setProperty("--slfx-gda", dur());
  el.style.setProperty("--slfx-gdb", dur());
  el.style.setProperty("--slfx-gdj", dur());
  el.style.setProperty("--slfx-gpha", phase());
  el.style.setProperty("--slfx-gphb", phase());
  el.style.setProperty("--slfx-gmul", (0.75 + Math.random() * 0.7).toFixed(2));
  for (const s of el.querySelectorAll(".sl-fx-glitch__shard")) {
    const px = (5 + Math.random() * 13) * (Math.random() < 0.5 ? -1 : 1);
    s.style.setProperty("--slfx-sx", `${px.toFixed(1)}px`);
  }
}

/* ── public API ──────────────────────────────────────────────────────────────*/

/**
 * Arm Tier 1: pointer-driven liquid, finite glitch bursts, animated aurora.
 * Refuses under reduced motion and under high contrast — Tier 0 is the default
 * state and stays correct on its own.
 * @param {Document|Element} root
 * @returns {boolean} whether Tier 1 was armed
 */
export function mount(root = document) {
  if (armed) return true;
  if (typeof window === "undefined") return false;
  if (window.matchMedia(REDUCE).matches) return false;
  const html = document.documentElement;
  if (html.getAttribute("data-sl-theme") === "high-contrast") return false;

  readTokens(html);
  new MutationObserver(() => readTokens(html)).observe(html, {
    attributes: true,
    attributeFilter: ["data-sl-theme"],
  });

  injectFilterDefs();
  // One delegated listener for the whole subtree, not one per element.
  root.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("pointerleave", onPointerLeave, { capture: true, passive: true });

  html.setAttribute("data-sl-fx", "on");
  armed = true;
  return true;
}

/**
 * One finite glitch burst of randomised length. A burst requested while another
 * runs is dropped, not queued: a queue produces a stutter train, which reads as
 * breakage rather than as signal. A detached element is refused.
 * @param {Element} el an element carrying .sl-fx-glitch, still in the document
 */
export function burst(el, { burstMin = 200, burstMax = 500 } = {}) {
  // isConnected: a caller may take the element out of the document between the
  // event and the burst, and a timer toggling a class on a detached node would
  // otherwise run for nothing. The guard is carried over from the prior art,
  // where it exists because of a real defect.
  if (!armed || burstActive || !el?.isConnected) return;
  burstActive = true;
  randomizeGhosts(el);
  el.classList.add("is-glitching");
  setTimeout(() => {
    el.classList.remove("is-glitching");
    burstActive = false;
  }, Math.min(CAP_MS, rand(burstMin, burstMax)));
}

/**
 * Decode-scramble a short label: cycle random glyphs and lock the real
 * characters in left to right, terminal-readout style. Distinct from the ghost
 * glitch, and safe under reduced motion because it is a text change, not motion.
 * Reads its target from data-num so repeats stay correct.
 * @param {HTMLElement} el
 */
export function scramble(el, { duration = 520, tick = 45 } = {}) {
  if (!el || el.dataset.scrambling === "1") return;
  const final = el.dataset.num ?? el.textContent ?? "";
  const n = final.length;
  const glyphs = "0123456789#/\\<>";
  el.dataset.scrambling = "1";
  const start = performance.now();
  const iv = setInterval(() => {
    const t = performance.now() - start;
    if (t >= duration) {
      clearInterval(iv);
      el.textContent = final;
      delete el.dataset.scrambling;
      return;
    }
    const locked = Math.floor((t / duration) * n);
    let out = "";
    for (let i = 0; i < n; i++) out += i < locked ? final[i] : glyphs[(Math.random() * glyphs.length) | 0];
    el.textContent = out;
  }, tick);
}

/**
 * Grant the one ambient aurora. Most recent request wins; the previous element
 * falls back to its resting ring. Busy auroras do not go through here — they are
 * bound to real work and are exempt from the cap.
 * @param {Element} el
 */
export function grantLive(el) {
  if (liveEl && liveEl !== el) liveEl.removeAttribute("data-sl-fx-live");
  liveEl = el;
  el.setAttribute("data-sl-fx-live", "on");
}

/** Revoke the ambient aurora from `el` if it currently holds it. */
export function revokeLive(el) {
  if (liveEl !== el) return;
  el.removeAttribute("data-sl-fx-live");
  liveEl = null;
}

/**
 * Tier 2 — the WebGPU liquid field. A documented no-op until Slice 3 lands, so
 * consumers can call it today and get the honest answer rather than a crash.
 * @returns {Promise<boolean>} whether the GPU tier came up
 */
export async function mountGpu() {
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/effects-js.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/effects.js scripts/effects-js.test.mjs
git commit -m "feat(ui-kit): effects.js — Tier 1 driver, budget coordinator, no-op GPU stub"
```

---

## Task 7: Showcase page and package exports

**Files:**
- Create: `showcase/effects.html`
- Modify: `packages/ui-kit/package.json` (`exports`, `files`)
- Create: `scripts/effects-showcase.test.mjs`

**Interfaces:**
- Consumes: every class from Tasks 2–5 and the API from Task 6.
- Produces: nothing later tasks depend on. `showcase/index.html` is untouched, so `scripts/showcase-accent.test.mjs` is unaffected.

- [ ] **Step 1: Write the failing test**

Create `scripts/effects-showcase.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const html = readFileSync(resolve(REPO, "showcase/effects.html"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(REPO, "packages/ui-kit/package.json"), "utf8"));

test("the package exports and ships the effects layer", () => {
  assert.equal(pkg.exports["./effects.css"], "./effects.css");
  assert.equal(pkg.exports["./effects.js"], "./effects.js");
  assert.ok(pkg.files.includes("effects.css"));
  assert.ok(pkg.files.includes("effects.js"));
});

test("the showcase applies all four families to real elements", () => {
  // Assert the class is APPLIED, not merely mentioned. The page's own captions
  // name these classes as documentation text, so a bare substring match passes
  // on a page where every class attribute had been deleted.
  for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
    assert.match(
      html, new RegExp(`class="[^"]*\\b${cls}\\b`),
      `showcase must apply .${cls} to an element, not just name it in prose`,
    );
  }
});

test("every busy aurora in the showcase carries its ARIA", () => {
  // The aurora renders state; it never is the state.
  const busy = html.match(/data-sl-fx-live="busy"[^>]*/g) || [];
  assert.ok(busy.length > 0, "the showcase must demonstrate the busy mode");
  for (const tag of busy) {
    assert.ok(
      /aria-busy="true"|role="progressbar"/.test(tag),
      `busy aurora without ARIA: ${tag}`,
    );
  }
});

test("the glitch is a child span, never the component itself", () => {
  assert.doesNotMatch(html, /class="[^"]*sl-btn[^"]*sl-fx-glitch/);
  assert.match(html, /<span class="sl-fx-glitch" data-text=/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL — `ENOENT` on `showcase/effects.html`.

- [ ] **Step 3: Add the package entries**

In `packages/ui-kit/package.json`, add to `exports` immediately after `"./components.css"`:

```json
    "./effects.css": "./effects.css",
    "./effects.js": "./effects.js",
```

and to `files` immediately after `"components.css"`:

```json
    "effects.css",
    "effects.js",
```

- [ ] **Step 4: Create `showcase/effects.html`**

Model the page shell on `showcase/index.html` (same font links, same sticky header, same theme/accent switcher, same section-index structure) and add the effects stylesheet plus the driver. Requirements the test enforces, and the composition requirements the design language imposes:

- Head: the same five stylesheet links as `showcase/index.html`, **plus** `<link rel="stylesheet" href="../packages/ui-kit/effects.css">`, loaded after `components.css`.
- Boot, at the end of `<body>`:
  ```html
  <script type="module">
    import { mount, burst, scramble, grantLive } from "../packages/ui-kit/effects.js";
    const tier1 = mount();
    document.getElementById("tier-report").textContent = tier1 ? "TIER 1 — BEHAVIOUR" : "TIER 0 — MATERIAL";
  </script>
  ```
- A mono structural label reporting the live state, so the page documents itself rather than asserting a look:
  ```html
  <p class="sl-eyebrow" id="tier-report">TIER 0 — MATERIAL</p>
  ```
- One section per family (`01 GLITCH`, `02 LIQUID`, `03 AURORA`, `04 GLASS`), each opening with a mono `sec-idx` beside its heading and separated by a 1px top rule — the house section pattern from `showcase/index.html`.
- A fifth section, `05 DECLENSION`, holding every common component with its effects applied per the spec's declension table: buttons (primary + ghost), card, field, tabs, badge, tag, dialog, table, link, kbd, callout, eyebrow, inversion band.
- The busy aurora demonstrated three ways, each with its ARIA:
  ```html
  <article class="sl-card sl-fx-glass sl-fx-glass--wide sl-fx-aurora sl-fx-aurora--wide"
           data-sl-fx-live="busy" aria-busy="true">…</article>
  <article class="sl-card sl-fx-glass sl-fx-glass--wide sl-fx-aurora sl-fx-aurora--wide"
           data-sl-fx-live="busy" role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100"
           style="--slfx-progress: .62">…</article>
  <button class="sl-btn sl-btn--primary sl-fx-aurora" data-sl-fx-live="busy" aria-busy="true">…</button>
  ```
- The shatter variant demonstrated with its markup contract intact — every shard carrying `--slfx-i` and `--slfx-n` inline, since the `clip-path` divides by them and a shard without them silently does not render:
  ```html
  <span class="sl-fx-glitch sl-fx-glitch--shatter" data-text="No signal">
    <span class="sl-fx-glitch__text">No signal</span>
    <span class="sl-fx-glitch__shards" aria-hidden="true">
      <span class="sl-fx-glitch__shard" style="--slfx-i:0; --slfx-n:5">No signal</span>
      <!-- …one per band, i = 0…n-1 -->
    </span>
  </span>
  ```
- The glitch always as a child span:
  ```html
  <button class="sl-btn sl-btn--primary sl-fx-liquid sl-fx-aurora">
    <span class="sl-fx-glitch" data-text="Delete branch">Delete branch</span>
  </button>
  ```
- The field wrapped, because a replaced control hosts no paint layer:
  ```html
  <label class="sl-field">
    <span class="sl-field__label">Product</span>
    <span class="sl-field__control sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field">
      <input class="sl-field__input" type="text" placeholder="introspect">
    </span>
  </label>
  ```
  with the page-local rule `.sl-field__control { display: block; position: relative; }`.
- A `data-sl-fx="off"` region demonstrating the subtree opt-out, labelled as such.
- **An inversion band containing a glass-edged card**, carrying the remap for **all three** border roles — `--slc-border`, `--slc-border-strong` and `--slc-border-subtle` — since the edge reads the latter two. Without it the edge sits on the wrong ground and vanishes. The band's own aurora uses `sl-fx-aurora--linear sl-fx-aurora--top`, because a band's structural rule is its top edge.
- **One unexpected composition decision** (house rule): make the declension section an asymmetric two-column split — a narrow sticky mono index of the families on the left, the component gallery on the right — rather than a centred card grid.
- **Real content, not filler** (L5): the copy names actual things — `sl-audit`, `introspect`, `@sondalab/ui-kit 0.8.0` — never lorem or marketing adjectives.
- All page-local colour must resolve to tokens; run the audit in Step 5 before committing.

- [ ] **Step 4b: Fix the two `effects.css` defects this page exposes**

Building the page surfaced two defects in earlier tasks' CSS. Both are real, both are invisible without a rendered page, and both would ship as broken reference behaviour. Fix them here, in `packages/ui-kit/effects.css`.

**(a) The edge variables cannot re-derive inside an inversion band.** `--slfx-edge-warm`, `--slfx-edge-cool` and `--slfx-edge-dim` are declared once at `:root`. A custom property's `var()` references are substituted using the *declaring* element's cascaded values, so an `.invert` ancestor that remaps `--slc-border-strong` cannot change a value already substituted at `:root` — the glass edge keeps its canvas-oriented alpha and vanishes on ink. Move the three declarations off `:root` and onto the edge selector, where they resolve against the element's own inherited values:

```css
/* Declared on the edge itself, not on :root. A custom property's var()
   references resolve using the declaring element's cascaded values, so a
   :root declaration can never pick up an .invert ancestor's remap — the edge
   would keep its canvas-oriented alpha and vanish on ink. */
:is(.sl-fx-glass, .sl-fx-aurora) {
  --slfx-edge-warm: color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 24%, var(--slc-border-strong, var(--sl-border-strong)));
  --slfx-edge-cool: color-mix(in srgb, var(--slfx-depth) 24%, var(--slc-border-strong, var(--sl-border-strong)));
  --slfx-edge-dim: var(--slc-border-subtle, var(--sl-border-subtle));
  position: relative;
}
```

Delete those three lines from the `:root` block and merge the declaration into the existing `:is(.sl-fx-glass, .sl-fx-aurora) { position: relative; }` rule as shown. Then extend the inversion-band note: a band must remap **all three** border roles, not only `--slc-border`, or the edge still sits on the wrong ground:

```css
/* .invert { --slc-border: …; --slc-border-strong: …; --slc-border-subtle: …; } */
```

**(b) The linear aurora is bottom-anchored, but the inversion band's rule is its top edge.** `.sl-fx-aurora--linear::after` hardcodes `inset: auto 0 0 0`. The active tab's underline and a link's underline are bottom edges, but the inversion band's structural rule is on top. Add a top anchor rather than changing the default:

```css
/* The band's structural rule is its top edge; a tab's and a link's are their
   bottom. The default stays bottom because two of the three want it. */
.sl-fx-aurora--linear.sl-fx-aurora--top::after { inset: 0 0 auto 0; }
```

Use `sl-fx-aurora--linear sl-fx-aurora--top` on the inversion band in the page.

- [ ] **Step 4c: Fix the dialog demo's cascade collision**

`<dialog>` carries `position: absolute` from the UA stylesheet, so the demo neutralises it with an inline `style`. But an inline style beats any stylesheet rule, so it also beats `:is(.sl-fx-glass, .sl-fx-aurora) { position: relative }` — the ring's `::after` then finds no positioned ancestor at the dialog and resolves its containing block up to the section, rendering as a box the size of the whole section instead of a rim.

Move every dialog override out of the `style` attribute and into the page-local `<style>` block, so the effects rule can win:

```css
/* <dialog> is position:absolute in the UA stylesheet; neutralise it here, not
   in a style attribute — an inline style would also beat the effects layer's
   `position: relative` and detach the ring from the dialog. */
dialog.sl-dialog[open] { position: relative; margin: 0; max-width: none; width: auto; }
```

- [ ] **Step 4d: Keep the tier label honest across a theme switch**

`mount()` refuses under high contrast, but the accent/theme switcher does not re-run it, so switching to high-contrast after load leaves the label claiming Tier 1 while the CSS kill switch has disabled every family. Recompute the label whenever the theme changes, reporting Tier 0 under high contrast.

- [ ] **Step 5: Audit the new page**

Run: `node packages/ui-kit/agent/sl-audit.mjs --surface "showcase/effects.html" --product default`
Expected: no `R`-level findings. If a page-local literal is flagged, replace it with a `var(--sl-*)` reference — do **not** add it to `blessed/default.json` without a reason recorded there.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Open the page and check it by eye**

Run: `python3 -m http.server 8080` from the repo root, open `http://localhost:8080/showcase/effects.html`.

Check, in all three themes via the switcher:
1. The tier label reports `TIER 1 — BEHAVIOUR`.
2. Hovering a primary button moves the sheen and softens the near corners; the text does not blur or shift.
3. Focusing any control by keyboard shows both the `outline` **and** the aurora ring — the outline is not replaced.
4. The busy card's arc orbits; the determinate card's arc is static at ~62% and does not rotate.
5. In high-contrast, all four families are gone and the page is still fully legible.
6. With the OS set to reduce motion, the tier label reports `TIER 0 — MATERIAL`, the busy card shows a static dimmed ring, and nothing animates.
7. Inside the `data-sl-fx="off"` region nothing reacts.

- [ ] **Step 8: Commit**

```bash
git add showcase/effects.html packages/ui-kit/package.json scripts/effects-showcase.test.mjs
git commit -m "feat(showcase): effects demo page; export the effects layer from the package"
```

---

# Slice 2 — Promotion into the design-system contract

## Task 8: `design-language.md` L6 and the regenerated agent copy

**Files:**
- Modify: `docs/design-language.md`
- Modify (generated): `packages/ui-kit/agent/design-language.md`

**Interfaces:**
- Consumes: the delivered behaviour from Slice 1.
- Produces: the L6 rule names (`l6-glass`, `l6-aurora`, `l6-liquid`, `l6-glitch`, `l6-effect-budget`) that Task 9 encodes in `substrate-matrix.json`. The names must match exactly.

- [ ] **Step 1: Add the L6 section to `docs/design-language.md`**

Insert a new `### L6 — Effects & material` section immediately after `### L5 — Editorial voice (copy)` and before `## Per-substrate compliance matrix`. Write it as grammar (invariants), not as implementation — the implementation contract stays in the spec. It must state:

- The four families and the one meaning each carries; an effect that means nothing is switched off (this is L5 applied to motion).
- Effects spend their budget on light and material, never on weight, radius or added chrome.
- The aurora inhabits an existing edge and never adds a concentric ring; it widens inward only; it never replaces the focus `outline`.
- The aurora renders state and never is the state: `aria-busy` / `role="progressbar"` are required for the busy and determinate modes.
- The effect budget: one ambient aurora and one glitch burst per document; busy auroras are exempt because they are bound to real work.
- The three kill switches.
- A pointer to `docs/specs/2026-09-08-effects-layer-design.md` for the implementation and to `packages/ui-kit/effects.css` for the values.

- [ ] **Step 2: Add the matrix rows to the doc's compliance table**

In the `## Per-substrate compliance matrix` table, append five rows:

```
| L6 glass edge | N/A | A | R | N/A |
| L6 aurora | N/A | A | R | N/A |
| L6 liquid | N/A | A | A | N/A |
| L6 glitch | N/A | A | A | N/A |
| L6 effect budget | N/A | R | R | N/A |
```

Add a sentence under the table recording the IDE opt-in: effects are `N/A` on IDE by default because the host chrome is fixed, `effects.css` is a separate import so declining it is free, and an IDE surface that deliberately imports it is then held to the App column.

- [ ] **Step 3: Regenerate the agent copy**

Run: `npm run gen:tokens`

- [ ] **Step 4: Verify the drift test passes**

Run: `node --test scripts/agent-docs-drift.test.mjs`
Expected: PASS — `agent/design-language.md` is byte-identical to `docs/design-language.md`.

- [ ] **Step 5: Verify nothing else regenerated**

Run: `git status --short`
Expected: only `docs/design-language.md` and `packages/ui-kit/agent/design-language.md` are modified. If `tokens.css`, `themes/*.css` or the Python palette changed, stop — something edited `sondalab.tokens.json`, which this work must not do.

- [ ] **Step 6: Commit**

```bash
git add docs/design-language.md packages/ui-kit/agent/design-language.md
git commit -m "docs(design-language): L6 — effects & material, with per-substrate levels"
```

---

## Task 9: Compliance matrix rows

**Files:**
- Modify: `packages/ui-kit/agent/substrate-matrix.json`

**Interfaces:**
- Consumes: the rule names from Task 8.
- Produces: the `rules` entries `sl-audit` reads via `levelFor()`.

- [ ] **Step 1: Add the rows**

In the `rules` object, after `"l5-voice"`, add:

```json
    "l6-glass":         { "IDE": "N/A", "App": "A", "Page": "R", "Term": "N/A" },
    "l6-aurora":        { "IDE": "N/A", "App": "A", "Page": "R", "Term": "N/A" },
    "l6-liquid":        { "IDE": "N/A", "App": "A", "Page": "A", "Term": "N/A" },
    "l6-glitch":        { "IDE": "N/A", "App": "A", "Page": "A", "Term": "N/A" },
    "l6-effect-budget": { "IDE": "N/A", "App": "R", "Page": "R", "Term": "N/A" }
```

Note: `"l5-voice"` currently has no trailing comma. Add one when appending.

- [ ] **Step 2: Verify the JSON parses and the levels match the doc**

Run: `node -e "const m=require('./packages/ui-kit/agent/substrate-matrix.json'); console.log(Object.keys(m.rules).filter(k=>k.startsWith('l6')))"`
Expected: `[ 'l6-glass', 'l6-aurora', 'l6-liquid', 'l6-glitch', 'l6-effect-budget' ]`

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui-kit/agent/substrate-matrix.json
git commit -m "feat(agent): L6 effect rules in the compliance matrix"
```

---

## Task 10: Catalog entries

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `packages/ui-kit/agent/catalog.json`

**Interfaces:**
- Consumes: the classes from Tasks 2–5.
- Produces: catalog entries `scripts/catalog-audit.test.mjs` validates — every `id` needs its classes present in the prose, and every fenced `html`/`css` block must audit clean (no colour literal).

- [ ] **Step 1: Add the four entries to `catalog.json`**

After the last `"kind": "primitive"` entry (`dialog`) and before the signature block, add:

```json
    { "id": "fx-glass",  "kind": "effect", "classes": ["sl-fx-glass", "sl-fx-glass--wide", "sl-fx-glass--field"], "roleVars": ["--slc-border-strong", "--slc-border-subtle", "--slc-accent"] },
    { "id": "fx-aurora", "kind": "effect", "classes": ["sl-fx-aurora", "sl-fx-aurora--wide", "sl-fx-aurora--field", "sl-fx-aurora--linear"], "roleVars": ["--slc-accent"] },
    { "id": "fx-liquid", "kind": "effect", "classes": ["sl-fx-liquid", "sl-fx-liquid--calm"], "roleVars": ["--slc-text"] },
    { "id": "fx-glitch", "kind": "effect", "classes": ["sl-fx-glitch", "sl-fx-glitch--shatter", "sl-fx-glitch__text", "sl-fx-glitch__shards", "sl-fx-glitch__shard"], "roleVars": ["--slc-accent"] },
```

- [ ] **Step 2: Add a `## Effects` section to `catalog.md`**

Place it after `## Primitives` and before `## Signature patterns`. Each entry follows the existing shape — heading, one-line purpose, substrate levels, a fenced `html` snippet, `Consumes:` and a `Do/Don't`. **Every snippet must be colour-literal free**, which is automatic if it uses only classes.

Required snippets:

````markdown
### Glass edge — `sl-fx-glass` (`--wide` · `--field`)
A 1px edge painted with a conic gradient so it catches light at two angles. Width is emphasis, not separation. Substrate: **R** Page, **A** App.
```html
<article class="sl-card sl-fx-glass sl-fx-glass--wide">…</article>
```
Consumes: `--slc-border-strong`, `--slc-border-subtle`, `--slc-accent`. Don't: thicken it to replace a separator — a separator is always 1px.

### Aurora — `sl-fx-aurora` (`--wide` · `--field` · `--linear`)
Attention lives here. Inhabits the element's own edge; never a second concentric ring, never a replacement for the focus outline. Substrate: **R** Page, **A** App.
```html
<button class="sl-btn sl-btn--ghost sl-fx-aurora">Run audit</button>
<article class="sl-card sl-fx-aurora sl-fx-aurora--wide" data-sl-fx-live="busy" aria-busy="true">…</article>
<article class="sl-card sl-fx-aurora sl-fx-aurora--wide" data-sl-fx-live="busy"
         role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100"
         style="--slfx-progress: .62">…</article>
```
Consumes: `--slc-accent`. Do: pair every busy aurora with `aria-busy`, and every determinate one with `role="progressbar"` + `aria-valuenow` — the aurora renders state, it never is the state. Don't: grant more than one ambient `data-sl-fx-live="on"` per document.

### Liquid — `sl-fx-liquid` (`--calm`)
The element acknowledges the pointer: a specular sheen follows it and the near corners soften. Non-destructive — text never moves. Substrate: **A** App/Page.
```html
<button class="sl-btn sl-btn--primary sl-fx-liquid">Save changes</button>
```
Consumes: `--slc-text`. Don't: put it on a text input — a field that deforms while being typed into trades legibility for spectacle.

### Glitch — `sl-fx-glitch` (`--shatter`)
Something re-resolved. A finite burst, fired from JavaScript on a discrete event. Always a child span, never the component itself. Substrate: **A** App/Page.
```html
<button class="sl-btn sl-btn--primary">
  <span class="sl-fx-glitch" data-text="Delete branch">Delete branch</span>
</button>
```
Consumes: `--slc-accent`. Do: set `data-text` to the element's own text. Don't: run it ambiently on a control — ambient glitch is the wordmark's alone.
````

- [ ] **Step 3: Run the catalog test**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: PASS — every new `id` documented, every snippet clean.

- [ ] **Step 4: Commit**

```bash
git add packages/ui-kit/agent/catalog.md packages/ui-kit/agent/catalog.json
git commit -m "feat(agent): catalog entries for the four effect families"
```

---

## Task 11: HANDOFF judgement notes and the 0.8.0 release

**Files:**
- Modify: `packages/ui-kit/agent/HANDOFF.md`
- Modify: `packages/ui-kit/package.json` (`version`)

**Interfaces:**
- Consumes: everything above.
- Produces: the released `@sondalab/ui-kit@0.8.0`.

- [ ] **Step 1: Add an effects section to `HANDOFF.md`**

Append to `## Structural / judgement rules the script never sees`:

> **Effects (L6) — entirely judgement.** `sl-audit` can verify that `effects.css` uses no colour literal, and `scripts/effects-js.test.mjs` closes the same hole for the driver. It cannot verify any of what actually matters:
> - **the right family for the right meaning** — a glitch on a passive container, or a liquid on something that is not interactive, is decoration, and Decision 1 forbids it;
> - **the budget** — more than one ambient `data-sl-fx-live="on"` per document, or four families stacked on one component;
> - **the focus ring** — an aurora that replaced the `outline` instead of sitting inside the border band;
> - **the ARIA** — a `busy` or determinate aurora without `aria-busy` / `role="progressbar"`, which leaves reduced-motion and high-contrast visitors with no state at all;
> - **the paint-layer budget** — a glitch put on the component instead of on a child span, which silently drops the ring or the sheen.
>
> Judge these by reading the surface against `design-language.md` L6 and `docs/specs/2026-09-08-effects-layer-design.md`.

- [ ] **Step 2: Bump the ui-kit version only**

In `packages/ui-kit/package.json`, set `"version": "0.8.0"`.

**Do not touch `packages/palette-py/pyproject.toml`.** No token changed, so the Python palette has nothing to republish, and bumping it would push an empty release whose values are pinned by smartctx's contract test in `claude-loadout`.

- [ ] **Step 3: Confirm the version is not already live**

Run: `curl -o /dev/null -s -w "%{http_code}\n" https://registry.npmjs.org/@sondalab%2Fui-kit/0.8.0`
Expected: `404`.

- [ ] **Step 4: Confirm no generated output drifted**

Run: `npm run gen:tokens && git diff --exit-code -- packages/`
Expected: exit 0, no diff. This is exactly what `check-drift.yml` runs.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/agent/HANDOFF.md packages/ui-kit/package.json
git commit -m "feat(ui-kit): effects layer judgement notes; release 0.8.0"
```

---

## Task 11b: Make the effects layer reachable from the agent workflows

Added during execution. Slice 2 shipped the catalog entries, the matrix rows and the judgement notes, but nothing an agent actually *starts* from mentions effects — so an agent following the author workflow literally would never learn the section exists, which defeats the slice's stated purpose. Three of the five edits also correct claims that are simply inaccurate.

**Files:**
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `packages/ui-kit/agent/README.md`
- Modify: `packages/ui-kit/agent/workflows/author.md`
- Modify: `.claude/agents/sl-ds-auditor.md`

**Interfaces:**
- Consumes: everything Slice 2 shipped.
- Produces: nothing later tasks depend on. No version bump — `0.8.0` is not yet published, and these are documentation edits inside the already-bumped `agent/` directory.

- [ ] **Step 1: Correct the glitch entry's `Consumes:` list**

`packages/ui-kit/agent/catalog.md` — the glitch entry lists only `--slc-accent`, but `effects.css`'s `slfx-glitch-jit` keyframe also reads `--slc-accent-hover`. A Tier B consumer mapping role-vars from that list would leave one ghost channel unmapped to its own brand colour. Add `--slc-accent-hover`.

- [ ] **Step 2: Say that the glitch needs the driver**

Still in the glitch entry: every other family in the section renders something from CSS alone, and the glitch is the one that renders nothing at all until `effects.js` is mounted and something calls `burst()`. Add that to its `Do:` line, naming `mount()` and `burst()`.

- [ ] **Step 3: Name effects in the agent README**

`packages/ui-kit/agent/README.md` describes the catalog as "primitives + signature patterns". Add effects, and say they are a separate opt-in import (`effects.css`, plus `effects.js` for Tier 1) rather than part of `components.css`.

- [ ] **Step 4: Name effects in the author workflow**

`packages/ui-kit/agent/workflows/author.md` tells an agent to prefer the ready primitives and reach for the signature patterns. Add one step: after the surface is composed and compliant, effects are the optional layer, each family carrying one meaning, subject to the budget — and point at `design-language.md` L6 and the catalog's `## Effects` section.

- [ ] **Step 5: Add L6 to the judgement auditor's checklist**

`.claude/agents/sl-ds-auditor.md` enumerates L1/L2/L3/L5 in its judgement checklist and omits L6 entirely. Since `sl-audit.mjs` deliberately does not check effects — `HANDOFF.md` says so — the judgement agent is the *only* thing that can, and today it does not know to look. Add L6, scoped to what `HANDOFF.md` already lists: the right family for the meaning, the effect budget, the focus ring, the ARIA, the paint-layer budget.

- [ ] **Step 6: Run the suite and the drift check**

```bash
npm test
npm run gen:tokens && git diff --exit-code -- packages/
```
Expected: all pass, no drift. `scripts/catalog-audit.test.mjs` covers the catalog edit.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-kit/agent/catalog.md packages/ui-kit/agent/README.md packages/ui-kit/agent/workflows/author.md .claude/agents/sl-ds-auditor.md
git commit -m "docs(agent): make the effects layer reachable from the author workflow"
```

---

# Slice 3 — WebGPU liquid field

## Task 12: Shader module and the double-guarded boot

**Files:**
- Create: `packages/ui-kit/effects-gpu.js`
- Create: `packages/ui-kit/effects-shader.js`
- Create: `scripts/effects-gpu.test.mjs`

`packages/ui-kit/effects.js` is **not** touched here. Its `mountGpu` stub stays a no-op returning `false` until Task 13 wires it, which is what keeps this task's boot provable in isolation.

**Interfaces:**
- Consumes: `readTokens` behaviour from Task 6 (hues come from `getComputedStyle`, never literals).
- Produces: `bootField({ canvas, rects, tokens }) => Promise<{ stop(): void } | null>` from `effects-gpu.js`, and `SHADER` (a WGSL template string) from `effects-shader.js`.

- [ ] **Step 1: Write the failing test**

Create `scripts/effects-gpu.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const GPU = resolve(KIT, "effects-gpu.js");
const gpu = readFileSync(GPU, "utf8");
const shader = readFileSync(resolve(KIT, "effects-shader.js"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(KIT, "package.json"), "utf8"));

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;

test("neither the GPU module nor the shader carries a colour literal", () => {
  assert.deepEqual(gpu.match(COLOR_RE) || [], []);
  assert.deepEqual(shader.match(COLOR_RE) || [], []);
});

test("the shader's colour comes from the token uniforms, not from itself", () => {
  // WGSL's way to hardcode a colour is a numeric constructor — `vec3f(.9,.2,.1)`
  // — which no regex can tell apart from geometry. So assert the reachable
  // thing instead: the fragment's output hue is a mix of the two uniforms fed
  // from --sl-accent-default and --sl-accent-depth, and nothing else.
  assert.match(shader, /mix\(look\.depth\.rgb,\s*look\.accent\.rgb/);
});

// The two guards are executable here, so execute them. Node has a `navigator`
// global without a `gpu` member, which is the first guard's exact condition;
// and `vgpu` is an optionalDependency that need not be installed, so a faked
// capability drives the dynamic import into the second guard's catch.

test("bootField returns null when WebGPU is absent", async () => {
  const { bootField } = await import(pathToFileURL(GPU).href);
  const result = await bootField({ canvas: {}, rects: () => [], tokens: {} });
  assert.equal(result, null, "no WebGPU must leave the page exactly as it is");
});

test("bootField returns null when the device refuses or vgpu is missing", async () => {
  const { bootField } = await import(pathToFileURL(GPU).href);
  const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { gpu: {} }, configurable: true });
  try {
    const result = await bootField({ canvas: {}, rects: () => [], tokens: {} });
    assert.equal(result, null, "a refused adapter or a missing vgpu must be absorbed, not thrown");
  } finally {
    if (saved) Object.defineProperty(globalThis, "navigator", saved);
    else delete globalThis.navigator;
  }
});

test("vgpu is optional, never a hard dependency", () => {
  assert.ok(pkg.optionalDependencies?.vgpu, "vgpu must be an optionalDependency");
  assert.ok(!pkg.dependencies, "the kit stays free of hard runtime dependencies");
});

test("the shader ships as an inline template string, not through a loader", () => {
  assert.match(shader, /export const SHADER = `/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/effects-gpu.test.mjs`
Expected: FAIL — `ENOENT` on `effects-gpu.js`.

- [ ] **Step 3: Create `packages/ui-kit/effects-shader.js`**

```js
/* @sondalab/ui-kit — effects-shader.js
   The WGSL for the liquid field, as an inline template string. No bundler
   plugin: @vgpu/wgsl has a Vite loader, but a template string keeps every
   consumer's build config untouched — the same call sondalab-site made.

   Every colour arrives as a uniform read from a design token. Nothing is
   hardcoded here; scripts/effects-gpu.test.mjs enforces that. */

export const SHADER = `
// Fragment stage only. vgpu.effect() supplies the full-screen vertex stage —
// the same arrangement sondalab-site's CRT surface uses. If a future vgpu drops
// that, this module grows an @vertex entry point; nothing else changes.
// (No backticks in this comment: it lives inside a template literal.)
struct Look {
  accent   : vec4f,
  depth    : vec4f,
  time     : f32,
  rectCount: f32,
  _pad     : vec2f,
};
@group(0) @binding(0) var<uniform> look : Look;
// x, y, w, h in normalised device space, one per registered element (cap 8)
@group(0) @binding(1) var<uniform> rects : array<vec4f, 8>;
// pointer position and velocity, normalised
@group(0) @binding(2) var<uniform> pointer : vec4f;

fn field(p: vec2f, t: f32) -> f32 {
  let d = distance(p, pointer.xy);
  let wake = exp(-d * 6.0) * (0.6 + 0.4 * length(pointer.zw));
  let ripple = sin(d * 34.0 - t * 3.4) * exp(-d * 4.5);
  return clamp(wake + ripple * 0.35, 0.0, 1.0);
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  var inside = 0.0;
  for (var i = 0u; i < u32(look.rectCount); i = i + 1u) {
    let r = rects[i];
    let hit = step(r.x, uv.x) * step(uv.x, r.x + r.z)
            * step(r.y, uv.y) * step(uv.y, r.y + r.w);
    inside = max(inside, hit);
  }
  if (inside < 0.5) { return vec4f(0.0); }
  let a = field(uv, look.time);
  let hue = mix(look.depth.rgb, look.accent.rgb, a);
  return vec4f(hue * a, a * 0.42);
}
`;
```

- [ ] **Step 4: Create `packages/ui-kit/effects-gpu.js`**

```js
/* @sondalab/ui-kit — effects-gpu.js
   Tier 2: the WebGPU liquid field. What justifies the GPU here and nowhere else
   is INERTIA — the field keeps moving after the pointer leaves, and the sheen is
   advected rather than repositioned per frame. Glitch, aurora and glass are at
   full quality in CSS and have no GPU tier at all.

   The fallback is the default state: this module is dynamically imported, and if
   anything at all refuses, the page stays exactly on Tier 1. navigator.gpu alone
   is not enough — the adapter can refuse and the device can be lost — so the
   boot is guarded twice, the way sondalab-site/src/lib/crt-surface.ts does it. */

import { SHADER } from "./effects-shader.js";

const MAX_RECTS = 8;

/**
 * Bring the field up, or leave the page exactly as it is.
 * @param {{canvas: HTMLCanvasElement, rects: () => DOMRect[], tokens: {accent: string, depth: string}}} opts
 * @returns {Promise<{stop(): void}|null>} null when the GPU path is unavailable
 */
export async function bootField({ canvas, rects, tokens }) {
  // `typeof navigator` first: a consumer server-rendering its page has no
  // navigator at all, and a bare `in` check would throw there rather than
  // degrade. This is also what makes the guard executable in a test.
  if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) return null;
  let gpu;
  try {
    gpu = await (await import("vgpu")).init();
  } catch {
    return null;
  }
  // The device answered. Task 13 replaces this whole function body with the
  // real field; until then the boot is proven and the page stays on Tier 1,
  // because returning null is what mountGpu() reads as "unavailable".
  void [canvas, rects, tokens, SHADER, MAX_RECTS];
  return null;
}
```

- [ ] **Step 5: Add `vgpu` as an optional dependency**

In `packages/ui-kit/package.json`, add a top-level block after `"files"`:

```json
  "optionalDependencies": {
    "vgpu": "^0.3.1"
  }
```

Add `"effects-gpu.js"` and `"effects-shader.js"` to both `exports` and `files`.

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test scripts/effects-gpu.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-kit/effects-gpu.js packages/ui-kit/effects-shader.js packages/ui-kit/package.json scripts/effects-gpu.test.mjs
git commit -m "feat(ui-kit): WebGPU liquid field — shader module and double-guarded boot"
```

---

## Task 13: Field rendering and element registration

**Files:**
- Modify: `packages/ui-kit/effects-gpu.js`
- Modify: `packages/ui-kit/effects.js` (replace the `mountGpu` stub)

**Interfaces:**
- Consumes: `bootField` from Task 12.
- Produces: `mountGpu() => Promise<boolean>` in `effects.js`, now real. Sets `data-sl-fx-gpu="on"` on `document.documentElement` only after the first frame is on screen.

- [ ] **Step 0: Read the working reference first**

Read `sondalab-site/src/lib/crt-surface.ts` in full before writing a line. It is the only working `vgpu` integration in the estate, and the exact call signatures below (`init`, `surface`, `effect`, `frameLoop`) must be confirmed against it — `vgpu` is at `0.3.x` and its API is not stable enough to write from memory. Its `function rgb(value)` is the colour conversion this task reuses verbatim: it deliberately does **not** linearise, because the shader writes gamma-encoded output and the surround has to be passed in the same space.

- [ ] **Step 1: Replace `bootField` in `effects-gpu.js` with the full implementation**

```js
/** Parse a computed CSS colour into a gamma-encoded rgb triple.
 *  Carried over from sondalab-site/src/lib/crt-surface.ts: the shader writes
 *  already-gamma-encoded output, so the surround is passed in the same space
 *  rather than linearised. The input always comes from getComputedStyle. */
function rgb(value) {
  let h = (value || "").trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Bring the field up, or leave the page exactly as it is.
 * @param {{canvas: HTMLCanvasElement, rects: () => DOMRect[], tokens: {accent: string, depth: string}}} opts
 * @returns {Promise<{stop(): void}|null>} null when the GPU path is unavailable
 */
export async function bootField({ canvas, rects, tokens }) {
  // Guard once on capability. navigator.gpu can exist and still refuse.
  if (!("gpu" in navigator) || !navigator.gpu) return null;

  let vgpu;
  let gpu;
  try {
    vgpu = await import("vgpu");
    gpu = await vgpu.init();
  } catch {
    // Guard twice: the adapter refused, the module failed to resolve (it is an
    // optionalDependency and may simply not be installed), or the device was
    // lost during creation. The page stays on Tier 1 with no visual break.
    return null;
  }

  const dpr = Math.min(devicePixelRatio || 1, 2);
  const look = new Float32Array(12);   // accent vec4, depth vec4, time, rectCount, pad2
  const rectData = new Float32Array(MAX_RECTS * 4);
  const pointerData = new Float32Array(4);

  const surface = vgpu.surface({ gpu, canvas });
  const pass = vgpu.effect({ gpu, shader: SHADER, uniforms: { look, rects: rectData, pointer: pointerData } });

  function applyTokens() {
    const [ar, ag, ab] = rgb(tokens.accent);
    const [dr, dg, db] = rgb(tokens.depth);
    look.set([ar, ag, ab, 1, dr, dg, db, 1], 0);
  }
  applyTokens();

  function resize() {
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    surface.configure();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(document.documentElement);

  // Pointer state is normalised to the viewport; zw carries velocity, which is
  // what gives the field its inertia — the whole reason this tier exists.
  let px = 0.5, py = 0.5, vx = 0, vy = 0;
  function onMove(ev) {
    const nx = ev.clientX / innerWidth;
    const ny = ev.clientY / innerHeight;
    vx = nx - px;
    vy = ny - py;
    px = nx;
    py = ny;
  }
  addEventListener("pointermove", onMove, { passive: true });

  let running = true;
  const start = performance.now();

  const stopLoop = vgpu.frameLoop(() => {
    if (!running) return false;

    // Upload the visible liquid rects, normalised, capped. Elements scrolled
    // out contribute nothing — the shader early-outs on anything not inside one.
    const list = rects().slice(0, MAX_RECTS);
    rectData.fill(0);
    list.forEach((r, i) => {
      rectData[i * 4 + 0] = r.left / innerWidth;
      rectData[i * 4 + 1] = r.top / innerHeight;
      rectData[i * 4 + 2] = r.width / innerWidth;
      rectData[i * 4 + 3] = r.height / innerHeight;
    });

    look[8] = (performance.now() - start) / 1000;
    look[9] = list.length;

    // Velocity decays so the wake keeps moving after the pointer stops.
    vx *= 0.92;
    vy *= 0.92;
    pointerData.set([px, py, vx, vy], 0);

    pass.draw(surface);
    return true;
  });

  function stop() {
    if (!running) return;
    running = false;
    stopLoop?.();
    ro.disconnect();
    removeEventListener("pointermove", onMove);
    canvas.remove();
    document.documentElement.removeAttribute("data-sl-fx-gpu");
  }

  // A lost device must degrade to Tier 1, never freeze on a dead frame.
  gpu.device?.lost?.then(stop);

  // Re-read the hues on theme change, the same contract effects.js honours.
  const themeObserver = new MutationObserver(applyTokens);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-sl-theme"],
  });

  return { stop };
}
```

**If a `vgpu` call signature above does not match `crt-surface.ts`, follow `crt-surface.ts`** — it is the shape that is known to work against the installed version. Keep the structure (guard twice, uniforms, one loop, resize observer, device-lost → `stop`, theme observer) whatever the call names turn out to be.

- [ ] **Step 2: Replace the `mountGpu` stub in `effects.js`**

```js
/**
 * Tier 2 — the WebGPU liquid field. Additive: everything already works without
 * it, and it is only attached once the device has actually answered.
 * @returns {Promise<boolean>} whether the GPU tier came up
 */
export async function mountGpu() {
  if (!armed) return false;
  const { bootField } = await import("./effects-gpu.js");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // Below --sl-z-overlay so the sticky translucent header stays above the field.
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;mix-blend-mode:plus-lighter";
  document.body.appendChild(canvas);

  const visible = () =>
    [...document.querySelectorAll(".sl-fx-liquid")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.bottom > 0 && r.top < innerHeight)
      .slice(0, 8);

  const handle = await bootField({ canvas, rects: visible, tokens });
  if (!handle) {
    canvas.remove();
    return false;
  }
  document.documentElement.setAttribute("data-sl-fx-gpu", "on");
  return true;
}
```

- [ ] **Step 2b: Fixes from review**

Six corrections, four of them load-bearing. Apply all of them to `packages/ui-kit/effects-gpu.js` and `packages/ui-kit/effects.js`.

**(a) The inertia signal is two orders of magnitude too small.** `vx = nx - px` is a per-*event* delta in viewport-normalised units: a fast 1000 px/s drag across a 1440 px viewport at ~120 Hz coalesced events gives ≈0.006, which the shader spends as `0.4 * length(pointer.zw)` against a constant `0.6` — under half a percent of amplitude. It is also event-rate dependent, so a higher-frequency pointer reports a *smaller* speed for the same physical motion. Since inertia is the sole justification for this tier existing, this would fail the tier's own eye-check. Convert to a per-second velocity:

```js
let px = 0.5, py = 0.5, vx = 0, vy = 0;
let lastMove = 0;
function onMove(ev) {
  const now = ev.timeStamp || performance.now();
  // Per-second, not per-event: a higher-frequency pointer must not report a
  // smaller speed for the same physical motion. The floor guards a zero dt
  // when two events share a timestamp.
  const dt = Math.max((now - lastMove) / 1000, 1 / 240);
  lastMove = now;
  const nx = ev.clientX / innerWidth;
  const ny = ev.clientY / innerHeight;
  vx = (nx - px) / dt;
  vy = (ny - py) / dt;
  // Cap the flick at 1.0 so the shader's `0.6 + 0.4 * length(pointer.zw)` tops
  // out at exactly 1.0, which is the band its comment claims. A zero-size
  // viewport makes the deltas non-finite; zero the velocity rather than
  // letting a NaN reach a uniform.
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) { vx = 0; vy = 0; }
  else if (speed > 1) { vx /= speed; vy /= speed; }
  px = nx;
  py = ny;
}
```

The per-frame `vx *= 0.92` decay stays as it is — that is what carries the wake after the pointer stops.

**(b) `data-sl-fx-gpu="on"` can be left set on a dead field.** The attribute's lifecycle is split across two modules: `mountGpu` sets it, `stop()` clears it. If the device is lost during boot, `stop()` runs as a microtask before `mountGpu`'s continuation, so the attribute gets set *after* the teardown that was meant to prevent it — on a page with no canvas, with `running` already false so nothing clears it again. The CSS then suppresses the Tier 1 sheen permanently with no field to replace it: exactly the visual break the fallback contract forbids, and unrecoverable.

Move ownership entirely into `bootField`: set the attribute there, immediately after the first synchronous frame, and let `stop()` clear it. `mountGpu` then only reports what happened:

```js
// in bootField, after the pre-loop frame. Gated on `running` because gpu.onError
// is registered before this line: if an error were ever delivered synchronously
// rather than asynchronously, stop() would already have run and this would set
// the attribute on a dead field with nothing left to clear it. Track that it was
// set, so a failed boot's stop() cannot strip a live field's attribute.
let attributeSet = false;
if (running) {
  document.documentElement.setAttribute("data-sl-fx-gpu", "on");
  attributeSet = true;
}
// ...and in stop(), clear it only if this handle set it:
//   if (attributeSet && typeof document !== "undefined") {
//     document.documentElement.removeAttribute("data-sl-fx-gpu");
//   }

// in effects.js:
const handle = await bootField({ canvas, rects: visible, tokens });
if (!handle) { canvas.remove(); return false; }
return true;
```

**(c) No async-error listener.** WebGPU validation and WGSL compilation errors are delivered asynchronously and never throw out of `effect()` or `frame()`. A shader defect would leave a live handle, the attribute set, the CSS sheen switched off and nothing painted — silently. Since nothing in this repo can compile the shader, this is the failure most likely to actually occur. Register before the first frame, after `stop` is defined:

```js
gpu.onError?.((err) => {
  // Validation and compilation errors never throw out of effect() or frame().
  // Without this a shader defect is a blank field with no path back to Tier 1.
  console.error("[sondalab] GPU effects tier stopped:", err);
  stop();
});
```

**(d) The frame loop measures every liquid element on the page, every frame.** `visible()` runs a full-document `querySelectorAll` and then `getBoundingClientRect()` on every match — N forced synchronous layouts per frame, sixty times a second, to then discard most of them. Keep the set of on-screen elements with an `IntersectionObserver`, refresh the observed set from a `MutationObserver`, and measure only what is actually visible:

```js
/** On-screen liquid elements, kept by observation rather than by measuring
 *  everything each frame. getBoundingClientRect forces layout, so a
 *  full-document sweep costs one forced reflow per element per frame.
 *
 *  The live set is NEVER cleared wholesale. An IntersectionObserver redelivers
 *  asynchronously, so disconnecting and re-observing on every mutation batch
 *  would empty the set ahead of the redelivery and blank the field for a frame
 *  every time anything on the page changed. Instead: observe only what is not
 *  observed yet, and drop elements that left the document as they are read. */
function trackLiquid() {
  const onScreen = new Set();
  const observed = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target);
  });
  const scan = () => {
    for (const el of document.querySelectorAll(".sl-fx-liquid")) {
      if (observed.has(el)) continue;
      observed.add(el);
      io.observe(el);
    }
  };
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });
  return {
    rects: () => {
      const out = [];
      for (const el of onScreen) {
        if (!el.isConnected) { onScreen.delete(el); continue; }
        out.push(el.getBoundingClientRect());
        if (out.length === MAX_RECTS) break;
      }
      return out;
    },
    stop: () => { io.disconnect(); mo.disconnect(); },
  };
}
```

`mountGpu` builds this and passes `tracker.rects`; `bootField`'s `stop()` calls `tracker.stop`. Wire the tracker's teardown through the handle so nothing is left observing.

**(e) Ordering and teardown hygiene.** Four small corrections in the same file:
- Declare `themeObserver` before `stop()` closes over it — today it is safe only because `.then()` defers to a microtask, one reordering away from a TDZ `ReferenceError` on the device-lost path.
- Separate `loop.stop()` and `gpu.dispose()` into their own `try` blocks: if the first throws, the device is never destroyed.
- Remove the `pointermove` listener in the boot `catch`, so a failure after it is attached does not leak an inert closure.
- Guard `await import("./effects-gpu.js")` in `mountGpu` with a `try`/`catch` returning `false`. It is the one path in this tier that can reject at a caller rather than degrade.

**(f) Two constants.** Export `MAX_RECTS` from `effects-gpu.js` and use it in `effects.js` rather than a bare `8` — the packer does not bound the index to the declared array length, so a future bump in one file and not the others writes past the buffer. And replace the `[0, 0, 0, 1]` uniform placeholder with `[0, 0, 0, 0]`: it is overwritten before any GPU call, but an opaque-black colour value in a file that bans colour literals is a bad look in a contract package.

- [ ] **Step 3: Add the Tier 2 CSS switch to `effects.css`**

Append, inside the existing `@media (prefers-reduced-motion: no-preference)` block:

```css
  /* Tier 2 owns the sheen: the CSS gradient stands down so the two do not
     double up. The radius morph stays — it is geometry, not light. */
  [data-sl-fx-gpu="on"] .sl-fx-liquid::before { background: none; filter: none; }
```

- [ ] **Step 4: Verify the tests still pass**

Run: `npm test`
Expected: PASS. `scripts/effects-js.test.mjs` still finds no colour literal in `effects.js`.

- [ ] **Step 5: Check the field by eye**

Serve the showcase and open `showcase/effects.html` with `mountGpu()` called from the boot script. Verify:
1. In a WebGPU-capable browser the tier label reports Tier 2 and the sheen has inertia — it keeps moving briefly after the pointer leaves.
2. Forcing `navigator.gpu = undefined` in the console before load leaves the page on Tier 1 with no visual break.
3. The sticky header renders above the canvas.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-kit/effects-gpu.js packages/ui-kit/effects.js packages/ui-kit/effects.css
git commit -m "feat(ui-kit): render the liquid field and attach it behind mountGpu()"
```

---

## Task 14: Showcase tier report and the 0.8.1 release

**Files:**
- Modify: `showcase/effects.html`
- Modify: `packages/ui-kit/package.json` (`version`)
- Modify: `scripts/effects-showcase.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `scripts/effects-showcase.test.mjs`:

```js
/** The body of a top-level function in the page's boot script, so an assertion
 *  can be about where a claim LIVES rather than whether a string exists. */
function fnBody(name) {
  const start = html.search(new RegExp(`function ${name}\\b`));
  assert.ok(start > -1, `missing function: ${name}`);
  const open = html.indexOf("{", start);
  let depth = 0;
  let i = open;
  do {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") depth--;
    i++;
  } while (depth > 0 && i < html.length);
  return html.slice(open + 1, i - 1);
}

test("the showcase reports which tier actually resolved", () => {
  assert.match(html, /mountGpu\(\)/, "the page must attempt the GPU tier");

  // The Tier 2 claim must be derived from the attribute bootField owns, in the
  // same function that reads it. A bare substring check would pass on a page
  // that hardcoded the label, or set it from mountGpu()'s return value — which
  // is the one thing the design forbids, because the field can tear itself down
  // after resolving, on a lost device or an async validation error.
  const label = fnBody("updateTierLabel");
  assert.match(label, /data-sl-fx-gpu/, "the label must read the attribute, not the return value");
  assert.match(label, /TIER 2/, "the Tier 2 claim must live where the attribute is read");

  // And the observer must actually watch that attribute, or a torn-down field
  // leaves the label frozen on TIER 2 until an unrelated theme toggle.
  assert.match(
    html, /attributeFilter:\s*\[[^\]]*data-sl-fx-gpu/,
    "the MutationObserver must watch data-sl-fx-gpu, not only data-sl-theme",
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL — `mountGpu()` not found in the page.

- [ ] **Step 3: Extend the showcase boot script**

**EXTEND it; do not replace it.** By now that script also imports `burst`, `scramble` and `grantLive` to drive the page's demos, and carries an `updateTierLabel()` recomputed from live state through a `MutationObserver` on `data-sl-theme` — added because `mount()` refuses under high contrast but the theme switcher never re-runs it, so the label went stale. A wholesale replacement would silently delete both.

Two changes only:

1. Add `mountGpu` to the existing import list.
2. After the existing `mount()` call and its label update, attempt the GPU tier and let the label reflect it:

```js
// Tier 2 is additive: everything above already works without it, and the label
// reports what actually resolved rather than what was attempted. Not awaited at
// the top level — that would hold the demo wiring below until the GPU handshake
// settles, leaving the page's controls inert for as long as it takes.
mountGpu().then((ok) => ok && updateTierLabel());
```

**Do not use a top-level `await` for this.** The rest of the module — `grantLive`, the burst and scramble handlers, every demo the page exists to show — would not run until the GPU handshake settles, so a visitor loading the page during that window finds the controls simply inert. Write it as `mountGpu().then((ok) => ok && updateTierLabel());` and place it after the demo wiring.

**Add `"data-sl-fx-gpu"` to the existing `MutationObserver`'s `attributeFilter`.** Without it the observer watches only `data-sl-theme`, and a field that tears itself down after `mountGpu()` resolved — a lost device, an async validation error — leaves the label frozen on `TIER 2 — FIELD` with no path back short of an unrelated theme toggle. That is exactly the case that makes the attribute the truth rather than the return value, so not observing it defeats the reason for reading it.

`updateTierLabel()` must learn about Tier 2 — read `data-sl-fx-gpu` from the root, the same way it already reads `data-sl-fx` and `data-sl-theme`, and report `TIER 2 — FIELD` when it is `"on"`. That keeps one function as the single place the page decides what to claim, which is what stops the label and the reality drifting apart again. Do not set the label directly from the `mountGpu()` result: `bootField` owns the attribute and can tear itself down after returning, so the attribute is the truth and the return value is only the trigger to re-read it.

- [ ] **Step 4: Bump the ui-kit version**

Set `"version": "0.8.1"` in `packages/ui-kit/package.json`. Patch, not minor: `mountGpu` was already published in 0.8.0 as a documented no-op, so the API surface is unchanged — only its behaviour became real. `packages/palette-py/pyproject.toml` is still untouched.

- [ ] **Step 5: Confirm the version is free and nothing drifted**

Run:
```bash
curl -o /dev/null -s -w "%{http_code}\n" https://registry.npmjs.org/@sondalab%2Fui-kit/0.8.1
npm run gen:tokens && git status --short -- packages/
```
Expected: `404`, then a single modified path — `packages/ui-kit/package.json`, carrying the version bump and nothing else. `git diff --exit-code` cannot be used here: Step 4's bump is deliberately uncommitted at this point, so a clean exit is impossible by construction. What is being checked is that no *generated* file drifted, not that the tree is untouched.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add showcase/effects.html packages/ui-kit/package.json scripts/effects-showcase.test.mjs
git commit -m "feat(showcase): report the resolved effect tier; release 0.8.1"
```


---

# Final-review fixes

Three blocking findings from the whole-branch review, which opened the page in a real browser and turned cascade inferences into observed facts. All three are properties of the *rendered* cascade, which is why fifteen task-scoped reviews missed them, and each sits where two tasks' outputs meet.

## Task 15: Close the three blocking findings

**Files:**
- Modify: `packages/ui-kit/effects.css`
- Modify: `packages/ui-kit/effects.js`
- Modify: `packages/ui-kit/package.json`
- Modify: `docs/specs/2026-09-08-effects-layer-design.md`
- Modify: `scripts/effects-guards.test.mjs`

- [ ] **Step 1: Write the kill-switch completeness test**

The existing switch test asserts the four class *names* appear inside a selector carrying the attribute. It passed while three families escaped both switches — the eleventh assertion in this plan to match something adjacent to what it names. Invert the quantifier, reusing the `rules()` parser already in the file:

```js
// Every property an effect can put on a HOST element, as opposed to on a paint
// layer. A kill switch that only hides ::before/::after leaves these running.
const HOST_EFFECT = /(?:^|;)\s*(?:animation|box-shadow|border-radius|opacity)\s*:/;

test("both kill switches neutralise host-level effects, not only paint layers", () => {
  const targets = RULES.filter(
    (r) => /\.sl-fx-/.test(r.selector) && !/::(before|after)/.test(r.selector) && HOST_EFFECT.test(r.body),
  );
  assert.ok(targets.length > 0, "the parser must find the host-level rules");

  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    const killed = RULES.filter((r) => r.selector.includes(attr) && HOST_EFFECT.test(r.body));
    assert.ok(killed.length > 0, `no rule neutralises a host-level effect under [${attr}]`);
    const covered = killed.map((r) => r.selector).join(" ");
    for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
      assert.ok(covered.includes(cls), `[${attr}] must neutralise host-level .${cls}, not just its pseudo-elements`);
    }
  }
});

test("the opt-out disables the element carrying it, not only its descendants", () => {
  // `[data-sl-fx="off"] .sl-fx-glass` is descendant-only: putting the attribute
  // ON an effect element did nothing at all. design-language.md L6 and the spec
  // both say "that element and its subtree".
  const selectors = RULES.map((r) => r.selector).join("\n");
  assert.match(
    selectors, /:is\(\[data-sl-fx="off"\],\s*\[data-sl-fx="off"\] \*\)/,
    'the opt-out must match [data-sl-fx="off"] itself as well as its subtree',
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test scripts/effects-guards.test.mjs`
Expected: FAIL — the host-level effects are not neutralised, and the opt-out is descendant-only.

- [ ] **Step 3: Rewrite the two kill switches**

Replace the existing high-contrast and opt-out blocks in `effects.css`. The neutralising declarations need `!important` because `effects.js` writes `--slfx-c0..c3` and `--slfx-d` as inline styles, which otherwise win over any stylesheet rule:

```css
/* 1 & 2 — high contrast and the subtree opt-out neutralise the HOST as well as
   its paint layers. The glitch animates its host and its shards, the liquid
   morphs the host's border-radius, and the glass paints an inset highlight on
   the host — a switch over ::before/::after alone left three of the four
   families running. `!important` is load-bearing here: effects.js writes the
   pointer and bulge properties as inline styles, which beat a plain rule.
   The opt-out matches the element carrying it AND its subtree: the attribute
   on an effect element must disable that element, which descendant-only
   selectors never did. */
:root[data-sl-theme="high-contrast"] :is(.sl-fx-glass, .sl-fx-aurora, .sl-fx-liquid, .sl-fx-glitch, .sl-fx-glitch__text, .sl-fx-glitch__shards, .sl-fx-glitch__shard),
:is([data-sl-fx="off"], [data-sl-fx="off"] *) {
  animation: none !important;
  box-shadow: none !important;
  --slfx-c0: 0px !important;
  --slfx-c1: 0px !important;
  --slfx-c2: 0px !important;
  --slfx-c3: 0px !important;
  --slfx-d: 0 !important;
  --slfx-bloom: 0px !important;
}

/* The shatter variant replaces the label with jumping bands, so restoring the
   text is part of switching it off, not a separate concern. */
:root[data-sl-theme="high-contrast"] .sl-fx-glitch__text,
:is([data-sl-fx="off"], [data-sl-fx="off"] *) .sl-fx-glitch__text,
.sl-fx-glitch__text:is([data-sl-fx="off"], [data-sl-fx="off"] *) { opacity: 1 !important; }

:root[data-sl-theme="high-contrast"] .sl-fx-glitch__shard,
:is([data-sl-fx="off"], [data-sl-fx="off"] *) .sl-fx-glitch__shard { opacity: 0 !important; }

/* Paint layers. */
:root[data-sl-theme="high-contrast"] :is(.sl-fx-glass, .sl-fx-aurora)::after,
:root[data-sl-theme="high-contrast"] .sl-fx-liquid::before,
:root[data-sl-theme="high-contrast"] .sl-fx-glitch::before,
:root[data-sl-theme="high-contrast"] .sl-fx-glitch::after,
:is([data-sl-fx="off"], [data-sl-fx="off"] *) :is(.sl-fx-glass, .sl-fx-aurora)::after,
:is([data-sl-fx="off"], [data-sl-fx="off"] *) .sl-fx-liquid::before,
:is([data-sl-fx="off"], [data-sl-fx="off"] *) .sl-fx-glitch::before,
:is([data-sl-fx="off"], [data-sl-fx="off"] *) .sl-fx-glitch::after,
:is(.sl-fx-glass, .sl-fx-aurora):is([data-sl-fx="off"], [data-sl-fx="off"] *)::after,
.sl-fx-liquid:is([data-sl-fx="off"], [data-sl-fx="off"] *)::before,
.sl-fx-glitch:is([data-sl-fx="off"], [data-sl-fx="off"] *)::before,
.sl-fx-glitch:is([data-sl-fx="off"], [data-sl-fx="off"] *)::after {
  display: none !important;
}
```

- [ ] **Step 4: Close the JS half of the same hole**

`burst()` checks only `armed`, and `mount()` evaluates its guards once at load and never re-arms. So the showcase's own *Simulate signal loss* button fires a burst under high contrast. Re-read the live state at call time in `effects.js`:

```js
/** The conditions under which no effect may run, re-read at call time rather
 *  than sampled at mount: a visitor can switch theme, or turn on reduced
 *  motion, long after the page loaded. */
function suppressed() {
  if (typeof document === "undefined") return true;
  if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") return true;
  return window.matchMedia(REDUCE).matches;
}
```

Use it in `burst()` — `if (!armed || burstActive || suppressed() || !el?.isConnected) return;` — and in `scramble()`, which likewise runs regardless today.

- [ ] **Step 5: Stop a determinate aurora reading as complete under reduced motion**

`effects.css`'s `@media (prefers-reduced-motion: reduce)` block sets `--slfx-arc: 360deg` at the same specificity as the determinate rule and later in the file, so a card at `aria-valuenow="62"` renders a full ring. That is misinformation rather than absent information, and a determinate arc has no animation to suppress. Add the exclusion the orbit rule already carries:

```css
.sl-fx-aurora[data-sl-fx-live="busy"]:not(.sl-fx-aurora--linear):not([style*="--slfx-progress"]) { --slfx-arc: 360deg; }
```

- [ ] **Step 6: Correct the dependency posture**

npm installs `optionalDependencies` by default — "optional" means a *failure* to install is tolerated, not that installation is deferred. So every consumer of a CSS token package currently pulls a pre-1.0 WebGPU library. In `packages/ui-kit/package.json`, replace the `optionalDependencies` block with:

```json
  "peerDependencies": {
    "vgpu": "^0.3.1"
  },
  "peerDependenciesMeta": {
    "vgpu": { "optional": true }
  }
```

`mountGpu()`'s existing try/catch needs no change — a missing peer is exactly the case its catch already absorbs. Update `scripts/effects-gpu.test.mjs` to assert the new shape: no `dependencies`, no `optionalDependencies`, and `peerDependenciesMeta.vgpu.optional === true`.

Then correct the spec, which currently states something false — `docs/specs/2026-09-08-effects-layer-design.md`, the GPU-tier section: `vgpu` is declared an optional **peer** dependency, so a consumer who never calls `mountGpu()` installs nothing extra and a missing peer cannot break `npm install`.

- [ ] **Step 7: Verify**

```bash
node --test scripts/effects-guards.test.mjs scripts/effects-gpu.test.mjs
npm test
npm run gen:tokens && git status --short -- packages/
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default
```
Expected: all green, no generated drift, no `R` findings. No version bump — `0.8.1` is unpublished, so these fixes ride with it.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-kit/effects.css packages/ui-kit/effects.js packages/ui-kit/package.json docs/specs/2026-09-08-effects-layer-design.md scripts/effects-guards.test.mjs scripts/effects-gpu.test.mjs
git commit -m "fix(ui-kit): kill switches must reach the host; determinate arc under reduced motion; peer-dep posture"
```


## Task 15b: The reduced-motion guard conflict, and the field ring

Two items. The first is a conflict the fix wave correctly refused to resolve on its own; the second is the only defect in this plan found by looking at the rendered page rather than at source.

- [ ] **Step 1: Narrow the reduced-motion guard so it governs starts, not stops**

The guard asserts every `animation:` declaration sits inside `@media (prefers-reduced-motion: no-preference)`. The new kill switches declare `animation: none !important` outside it, and must — a kill switch applies regardless of motion preference, and a visitor in high contrast is not necessarily a visitor who asked for less motion. Two correct requirements, colliding on a regex.

The guard's intent is that no effect *starts* animating outside the block. `animation: none` is the opposite of starting one. Narrow the match in `scripts/effects-guards.test.mjs`:

```js
  // `animation: none` is exempt: it STOPS animation, which is what the kill
  // switches do, and they must apply regardless of motion preference. The rule
  // this guard exists for is that nothing may START animating outside the
  // block — so match a declaration that names an animation, not one that
  // removes it.
  for (const m of effects.matchAll(/\banimation:\s*(?!none\b)/g)) {
```

Leave the assertion and its message unchanged.

- [ ] **Step 2: Ship the `.sl-field__control` rule, and make the control fill it**

Found by opening the page: the field's glass and aurora ring is roughly twice the width of the input it marks. The wrapper fills its grid cell while the `<input>` keeps its intrinsic width, so the ring hugs the wrapper and the field floats inside it with a visible seam. The spec calls this wrapper "a new markup convention introduced by this layer (a bare `display: block; position: relative` wrapper)" but `effects.css` never shipped the rule — only the showcase had a page-local one, and `display: block` alone would not have fixed it either.

Add to `effects.css`, beside the paint-layer comment that already names the wrapper:

```css
/* Replaced form controls render no pseudo-element at all, so a field's effects
   bind to this wrapper instead. The control must FILL it: a wrapper that is a
   block while its input keeps an intrinsic width leaves the ring marking a box
   wider than the field, which is what shipped before anyone looked at it. */
.sl-field__control { display: block; position: relative; }
.sl-field__control > :is(input, textarea, select) { box-sizing: border-box; width: 100%; }
```

Then delete the now-redundant page-local `.sl-field__control` rule from `showcase/effects.html`, so the page demonstrates the shipped rule rather than masking its absence.

- [ ] **Step 3: Verify**

```bash
node --test scripts/effects-guards.test.mjs
npm test
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default
node packages/ui-kit/agent/sl-audit.mjs --surface "showcase/effects.html" --product default
npm run gen:tokens && git status --short -- packages/
```
Expected: 133/133, no `R` findings, no generated drift.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(ui-kit): guard animation starts not stops; ship the field-control wrapper"
```


---

# Redesign — the liquid deforms, the aurora blooms

The branch owner looked at the shipped page and rejected the visual result as too tame. The diagnosis is a constraint I invented and then enforced through fifteen reviews: L6 said effects "spend their budget on light and material, never on weight, radius or added chrome", which translated the original request — *a button that looks solid and becomes liquid under the mouse* — into "light moves, geometry does not". That was never the ask.

## Task 16: Give the liquid mass and the aurora light

**Files:**
- Modify: `packages/ui-kit/effects.css`
- Modify: `packages/ui-kit/effects.js`
- Modify: `docs/design-language.md` (then regenerate)
- Modify: `docs/specs/2026-09-08-effects-layer-design.md`
- Modify: `showcase/effects.html` (copy that describes the old mechanism)

**The load-bearing constraint, from the owner:** the deformation must **not** rewrite `border-radius`. The radius stays whatever the component declares, so a surface can re-parametrise its own geometry later without touching the effect. The shape deforms through a **filter over the declared radius**, never by replacing the value. This also deletes a defect the final review found: the current code hardcodes `--sl-radius-md` as the base, so a 10px card was forced to 6px the moment liquid was added.

- [ ] **Step 1: Delete the radius rewrite**

Remove the `border-radius: calc(...)` block and the `--slfx-c0..c3` properties from `.sl-fx-liquid` in `effects.css`, and remove the per-corner bulge writes from `flush()` in `effects.js`. Nothing replaces them: the radius is the component's business again.

- [ ] **Step 2: Make the skin the deformable silhouette**

The layer that paints the silhouette has to be the filtered one, so under Tier 1 the skin carries the surface and the host goes transparent. `border-radius: inherit` is what keeps the radius parametrisable — whatever the component declares flows straight through.

```css
.sl-fx-liquid { position: relative; }

.sl-fx-liquid::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image: radial-gradient(9rem 9rem at var(--slfx-px) var(--slfx-py),
    color-mix(in srgb, var(--slfx-sheen) calc(var(--slfx-d) * 34%), transparent) 0%,
    transparent 68%);
}

/* Tier 1: the skin takes over the surface so the filter has a silhouette to
   deform. --slfx-ground is the host's own computed background, captured by
   effects.js at mount — not a value this layer invents. The host keeps its
   text, which is never filtered. */
[data-sl-fx="on"] .sl-fx-liquid {
  background-color: transparent;
  border-color: transparent;
}
[data-sl-fx="on"] .sl-fx-liquid::before {
  background-color: var(--slfx-ground);
  filter: url(#slfx-liquid);
}
/* An element that is also glass or aurora must wobble with its own edge, or a
   crisp ring sits around a deforming fill and the whole thing reads as broken. */
[data-sl-fx="on"] .sl-fx-liquid:is(.sl-fx-glass, .sl-fx-aurora)::after {
  filter: url(#slfx-liquid);
}
```

- [ ] **Step 3: Capture the ground, and spring the deformation**

In `effects.js`:

```js
/** The host's own background, captured once so the skin can take it over.
 *  Read, never invented — this file declares no colour. */
function captureGround(el) {
  if (el.style.getPropertyValue("--slfx-ground")) return;
  el.style.setProperty("--slfx-ground", getComputedStyle(el).backgroundColor);
}
```

Replace the eased transition with a spring integrated in the shared frame loop. A `transition` has no mass, and mass is the whole point:

```js
// Critically underdamped: the shape overshoots and settles rather than easing
// to a stop. Stiffness and damping are tuned so a flick reads as elastic and a
// slow drag as viscous — the same spring, different input.
const K = 170;
const DAMP = 14;
let amp = 0, ampV = 0, target = 0;
let lagX = 50, lagY = 50;   // the shape trails the pointer; that trail IS the mass
let prevT = 0;

function integrate(now) {
  const dt = Math.min((now - prevT) / 1000 || 0, 1 / 30);
  prevT = now;
  const a = K * (target - amp) - DAMP * ampV;
  ampV += a * dt;
  amp += ampV * dt;
  // The centre chases the pointer with its own lag, so the deformation arrives
  // after the cursor rather than under it.
  lagX += (pointerX - lagX) * Math.min(dt * 9, 1);
  lagY += (pointerY - lagY) * Math.min(dt * 9, 1);
}
```

Each frame, write `--slfx-px`/`--slfx-py` from the lagged centre and `--slfx-d` from `amp`, and drive the filter itself — `feDisplacementMap`'s `scale` is an SVG attribute, not a CSS property, so it is set directly:

```js
displacement.setAttribute("scale", (amp * 26).toFixed(2));
```

Keep the loop running while `amp` or `ampV` is non-negligible, so the overshoot actually plays out after the pointer leaves; stop it when both settle, so an idle page costs nothing.

- [ ] **Step 4: Make the filter read as surface tension**

The current filter is turbulence plus displacement, which ripples. Add the gooey pass — a blur followed by an alpha contrast stretch — which is what makes an edge read as a liquid meniscus rather than a wobbling rectangle. Still on the skin only; the host's text is never inside a filtered subtree.

```xml
<filter id="slfx-liquid" x="-30%" y="-30%" width="160%" height="160%">
  <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" seed="7" result="n">
    <animate attributeName="baseFrequency" dur="11s" repeatCount="indefinite"
             values="0.008 0.014; 0.013 0.009; 0.008 0.014" />
  </feTurbulence>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G" result="d" />
  <feGaussianBlur in="d" stdDeviation="6" result="b" />
  <feColorMatrix in="b" type="matrix" result="goo"
    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
  <feComposite in="d" in2="goo" operator="atop" />
</filter>
```

`scale` starts at `0` so a resting element is undeformed; Step 3 drives it.

- [ ] **Step 5: Give the aurora a bloom that follows the arc**

The ring is a masked conic, so `drop-shadow` — which follows the alpha shape, unlike `box-shadow` — gives a halo that tracks the lit arc. Two stacked shadows for a soft falloff. The crisp core stays: it is the focus affordance and must not blur.

```css
.sl-fx-aurora:is(:focus-visible, :focus-within, [data-sl-fx-live="on"], [data-sl-fx-live="busy"])::after {
  filter:
    drop-shadow(0 0 4px color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 55%, transparent))
    drop-shadow(0 0 14px color-mix(in srgb, var(--slfx-depth) 38%, transparent));
}
```

Widen the lit arc and soften its stops in the four-stop binding, so the sweep reads as light rather than as a painted band — move the accent and depth stops apart and let them fade to transparent over a longer span rather than at a hard edge.

Both filters are raster passes, so they are declared in the active states only, never at rest. Add a one-line comment saying so, since it is a deliberate cost decision.

- [ ] **Step 6: Correct the grammar that forbade this**

In `docs/design-language.md`, the L6 bullet currently reads that effects spend their budget "on light and material, never on weight, radius or added chrome". That sentence is what produced the tame result, and the final review had already noted it contradicts the shipped liquid. Replace it with the rule that actually holds:

> **Effects spend their budget on light and shape; never on weight.** A structural separator stays `1px` whatever an effect is doing to it. Shape and light are theirs to move — the liquid deforms an element's silhouette, the aurora blooms past its edge — but always as a *filter over what the component declares*, never by rewriting a declared value. An effect that replaced an element's `border-radius` would freeze its geometry at whatever the effect assumed; deforming the rendered result leaves the surface free to re-parametrise its own radius without touching the effect.

Regenerate with `npm run gen:tokens` and update the matching passage in the spec's liquid section.

- [ ] **Step 7: Update the showcase copy**

The page describes the old mechanism in prose — "the four corners nearest the pointer soften by up to 10px", "the box never grows". Replace with what it now does. Keep the editorial voice: name the mechanism, not an adjective.

- [ ] **Step 8: Verify**

```bash
npm test
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default
node packages/ui-kit/agent/sl-audit.mjs --surface "showcase/effects.html" --product default
npm run gen:tokens && git status --short -- packages/
```
Expected: green, no `R` findings, and only `agent/design-language.md` regenerated. Note the guards test asserts every `animation:` outside a reduced-motion block — the SVG `<animate>` element is not a CSS declaration and is not matched; if it somehow is, report rather than work around.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(ui-kit): the liquid deforms its silhouette, the aurora blooms"
```


---

# The metal edge — shader as the primary path

The owner's reference is `metal-fx` on libraries.dev: *"Real-time liquid metal for buttons, icons, text and badges — a wandering halo, reflections on neighbours, a cursor that bends the ring. v2 on Paper Shaders."* Its API is `useMetalBend(ref)` with the comment `// cursor-driven liquid dent`.

That is a **material simulation** — a shaded metal ring with environment reflection and chromatic dispersion — not a gradient border. No amount of tuning turns a `1px` conic hairline into it. The gap is a category, not a value.

**The planning error, recorded because it explains the whole branch:** the original request said "usiamo libreria webgpu dove necessario". The spec answered that glitch, aurora and glass "are already at full quality in CSS and have no GPU tier", and scoped WebGPU to an optional Tier 2 on the liquid alone. That was decided at the second message of the project and every subsequent review enforced it faithfully. It was wrong: the look asked for *is* the shader look.

## Task 17: A shaded metal edge in WGSL, driving glass and aurora

**Files:**
- Modify: `packages/ui-kit/effects-shader.js` (the material)
- Modify: `packages/ui-kit/effects-gpu.js` (per-element geometry, radius, pointer bend)
- Modify: `packages/ui-kit/effects.css` (stand the CSS ring down under Tier 2)
- Modify: `docs/specs/2026-09-08-effects-layer-design.md`, `docs/design-language.md`
- Modify: `showcase/effects.html`

**What survives untouched:** the double-guarded boot, the three tiers, both kill switches, the token-read plumbing, the ARIA discipline, the coordinator budget, `trackLiquid`, the whole test suite. This changes *what the shader draws* and *that it drives the edge* rather than a background field. The infrastructure was built right; it was pointed at the wrong target.

- [ ] **Step 1: Give the shader per-element geometry, including the radius**

Today rects are `vec4f(x, y, w, h)`. The edge needs the element's corner radius too — and reading it rather than assuming it is what honours the owner's constraint that the radius stay parametrisable. `effects-gpu.js` reads `getComputedStyle(el).borderTopLeftRadius` alongside the rect, and packs a second uniform array:

```wgsl
@group(0) @binding(1) var<uniform> rects  : array<vec4f, 8>;  // x, y, w, h  (normalised)
@group(0) @binding(3) var<uniform> params : array<vec4f, 8>;  // radius, bend, _, _
```

The shader draws the edge the component declared. A surface that re-parametrises its radius gets a metal edge that follows, with no change here.

- [ ] **Step 2: Write the material**

A signed distance field gives the edge; its gradient gives a surface normal; the normal drives reflection and specular. That is the whole trick — a 2.5D torus over a rounded rectangle.

```wgsl
fn sdRoundBox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

// The cursor bends the ring: the field is pulled toward the pointer, so the
// edge dents rather than the element moving. Falloff is exponential, so the
// dent is local and the rest of the ring stays where the component put it.
fn bend(d: f32, p: vec2f, strength: f32) -> f32 {
  let pull = exp(-distance(p, pointer.xy) * 7.0) * strength;
  return d + pull * 0.02;
}
```

Shade the band `abs(d) < halfWidth` as metal:

- **normal** — `normalize(vec3f(dFdx(d), dFdy(d), h))`, so the band reads as a rounded torus rather than a flat stroke;
- **environment** — a cheap procedural gradient sampled by the normal, **tinted with `look.accent` and `look.depth`**. This is the reason for writing our own rather than adopting the reference's: neutral chrome knows nothing about a per-product accent, and the design system's whole thesis is that products share a grammar and differ by hue. The metal must be *this product's* metal;
- **specular** — a tight power lobe from a fixed light direction, so there is one bright highlight that travels as the geometry turns;
- **chromatic dispersion** — sample the environment three times at slightly offset normals, one per channel. That is what produces the coloured fringing at the edges, and it is the single detail that most separates "metal" from "grey gradient";
- **wandering halo** — one broad bright arc whose angular position advances slowly with `look.time`, independent of the pointer. The reference calls it wandering because it is not tied to interaction.

- [ ] **Step 2b: Under Tier 2, the skin stops taking the surface**

Task 16 had to make the skin paint the host's background, because a CSS filter can only deform the layer it is applied to. That forced three compromises it documented honestly: the host's `:hover`/`:active` background changes became invisible (the skin holds a captured literal and cannot track live state), a bordered control without glass lost its edge, and `--slfx-ground` had to be recaptured on every theme change.

**All three disappear here.** The shader draws a band *on* the element's boundary, thick enough to cover the fill's own edge — which is exactly how the reference works: the button keeps its own fill and the metal ring surrounds it. So under Tier 2 the host keeps its background and its border, and the skin reverts to being only the sheen:

```css
/* Tier 2 draws the edge, so the skin no longer has to impersonate the surface.
   The host keeps its own background and border, which is what gives :hover and
   :active back their visible effect and what makes --slfx-ground unnecessary. */
[data-sl-fx-gpu="on"] .sl-fx-liquid {
  background-color: revert-layer;
  border-color: revert-layer;
}
[data-sl-fx-gpu="on"] .sl-fx-liquid::before { background-color: transparent; }
```

Verify `revert-layer` behaves here; if the cascade makes it unreliable, drop the Tier 1 override to a class that `effects.js` adds only when Tier 2 has not come up, rather than fighting it with specificity. Say in the report which you used and why.

- [ ] **Step 3: Stand the CSS ring down under Tier 2**

The CSS ring becomes what it should always have been — the fallback. Same mechanism as the sheen already uses:

```css
/* Tier 2 owns the edge. The CSS ring is the fallback, not the intended result:
   a conic hairline is what a browser without WebGPU gets, and it stays correct
   on its own. The focus outline is untouched by any of this. */
[data-sl-fx-gpu="on"] :is(.sl-fx-glass, .sl-fx-aurora)::after { opacity: 0; }
```

**Do not remove the CSS ring.** It is the Tier 0/1 answer and it must stay correct — that is the fallback contract, and it is the only thing a reduced-motion or high-contrast visitor sees.

- [ ] **Step 4: Bind the two temperaments to the material**

Glass and aurora already share one ring with two temperaments. Keep exactly that, now in the shader: glass is the resting metal — reflective, low-key, no halo; aurora is the same metal lit — the halo brightens, the accent tint saturates, and under `busy` the halo stops wandering and becomes the travelling arc that reports work. One material, four readings, the same semantics the design language already fixed.

Pass the per-element state in `params.z` as a mode, so the shader branches once per rect rather than the JavaScript maintaining two element registries.

- [ ] **Step 5: Reduced motion and high contrast**

Both kill switches must reach Tier 2, and today's neither know about it. Under `prefers-reduced-motion: reduce` the halo does not wander and the bend does not spring — the metal renders, still, which is honest: it is material, not motion. Under high contrast `mountGpu()` must refuse outright, the same way `mount()` does. Add that guard and a test for it.

- [ ] **Step 6: Tune it against the rendered page**

Serve the showcase and open it. The constants in Steps 1–2 are a starting point and nothing more; the deliverable is how it looks. Adjust band width, specular exponent, dispersion offset, halo speed and bend strength against what you see, and record what you changed and why. A report that does not name the numbers you moved has not done this step.

- [ ] **Step 7: Correct the grammar, again**

`docs/design-language.md` L6 and the spec both assert that glitch, aurora and glass are at full quality in CSS and need no GPU tier. That sentence is the origin of this rework. Replace it with what is now true: the edge families render as a shaded material where a GPU is available, and degrade to a conic hairline where it is not — the CSS path is a genuine fallback, not the target. Regenerate with `npm run gen:tokens`.

- [ ] **Step 8: Verify, then commit**

```bash
npm test
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/effects.css" --product default
npm run gen:tokens && git status --short -- packages/
```
No colour literal may enter `effects-shader.js`: every hue arrives as a uniform read from a token. The existing test enforces it and must keep passing.

## Task 18: The rescue — rebuild against the reference

**Status: done (this branch).** Written after the fact as the record of what replaced Tasks 16–17's approach and why; the owner had rejected three rounds, and the fourth was given authority to demolish.

**Root cause, restated from the outside.** Two decisions at the second message set the direction for sixteen tasks: "glitch, aurora and glass are already at full quality in CSS", and "effects spend their budget on light and material, never on weight, radius or added chrome" (which forbade the shape deformation the owner asked for in the first message). Task 17 corrected the first by moving *everything* to a shader; that over-corrected — the reference's own aurora is CSS and its liquid is an SVG filter, and only its chrome environment needs WebGL. The result was a heavy bezel and a marbled cloud where the reference has a hairline and a beam.

**What was measured on the reference before any code was touched** (libraries.dev, `metal-examples-v2` and the beam's computed styles, not its marketing copy):
- Metal: 2D canvas hairline ≈ border width, filled from a WebGL seven-stop plasma; a soft halo as blurred SVG strokes that wanders; the *element* bent through `feDisplacementMap` fed a per-frame quarter-resolution map; reflections on neighbours.
- Border beam: pure CSS — `@property` angle at 1.96 s/turn, a conic arc masked to a 1 px ring, radial colour blobs, a blurred copy for glow, hue-rotate ±30°, every layer at 0.24–0.42 opacity, colour wash confined to 28 px inside the edge.

**What changed.**
- `effects-shader.js` — rewritten. Draws the glass family only: a chrome hairline (`max(border, 1px)/2 + 0.3` half-width) filled from a moving environment through a five-stop palette (`dark · pastel accent · bright · pastel depth · dark`, k = 64, gamma 1.3), a directional key and a darker outer half as multipliers, a fixed-size wandering halo (ray/box intersection places it, so a card and a button get the same halo), a cursor reflection, and the liquid's Gaussian dent on the distance field (`dentAt`) about the *lagged* centre effects.js reports. Poles around the ground: ink → ground lifted 20% toward the bright neutral / bright neutral; paper → 0.60 luma grey / 0.985 luma white with the ground's hue.
- `effects-gpu.js` — tracks `.sl-fx-glass` only; reads `border-top-width` beside the radius; skips elements whose aurora is lit (the canvas sits above the DOM and would paint over the arc); new `dent` uniform; pointer velocity and the wake are gone.
- `effects.js` — the liquid filters the **host**: `feImage` → `feDisplacementMap`, `color-interpolation-filters="sRGB"` on every primitive (verified: with it only on `<filter>`, Chrome decodes the map's 128 as 0.22 and slides the element), the map re-rasterised per frame at 0.25 res over the element's region (a static map translated with `feImage` x/y was tried first: Chrome read the covered area as a constant offset). σ = clamp(0.42·short side, 12, 30), depth = 0.30σ (×0.4 calm); spring k = 170, damping 14. `--slfx-ground`, the skin takeover and the ::before sheen are gone. `liquidState()` feeds the chrome.
- `effects.css` — the aurora is the border-beam recipe at every tier: the arc on `::after` (depth tails, accent, sheen core) with a three-stage `drop-shadow` bloom and ±16° hue drift; an 8 px-blurred wash on `::before` masked to `--slfx-wash`; the chrome stands down under `[data-sl-fx-gpu="on"]` for glass at rest only, and the aurora rules come after it so they win at equal specificity. Kill switches gain `filter: none !important`.
- Tests: guards test rewritten for the host-level filter and the four painting rules; GPU test asserts the palette is fed from the token uniforms.
- Spec and L6 rewritten around "who draws what, and with which technology"; catalog and HANDOFF updated.

**Rulings recorded.** (1) The CSS-first sentence and the no-weight constraint are both retired; the reference outranks them. (2) "Shader look" is a look, not a technology — the aurora stays CSS; a GPU aurora would be built only if the reference had one. (3) Filtering text is allowed while the pointer shapes the element; greyscale antialiasing is what every Sondalab surface already sets, and it is what the reference does. (4) An element whose aurora is lit hands its edge to the light; the chrome stands down there rather than compete.

**Still short of the reference, honestly:** reflections on neighbours and the inner reflection are not built; a long straight edge reads calmer than the reference's circle; the busy arc on a filled accent button is faint by construction.

**Round 2 (coordinator's two findings).** (1) The busy arc on a filled button was invisible for a mechanical reason, not a tonal one: `sl-btn` carries a `1px` *transparent* border that its fill paints under, so a ring pinned to the border band sits on the fill — the declension's "outside the box" was never true. `sl-fx-aurora--rim` steps the ring one border-width out (`inset: calc(-1px - var(--slfx-ring-w))`, inside the 2px the outline leaves free), at 2px (1px of the depth companion against the page was tried and rejected as below notice), beam rebound to the depth companion, no inner wash, and full opacity while busy even when `:disabled` (scoped out of both kill switches). (2) Reflections on neighbours built: every effect element is registered as a surface; a pixel inside one within 14px of another's chrome edge receives that chrome's environment, fading 12px into the neighbour at ≤0.34 alpha. Judged before building: perceptible on adjacent keycaps and pills, faint on a filled button, absent across a wider gap — kept because it is cheap and honest, recorded as modest.

**Round 3 (whole-branch review).** Contract: `sl-field__control` added to the field entry and made mandatory in the Glass and Aurora entries with wrapper snippets; `--wide`/`--field`/`--calm` and the badge/callout modifiers now explained in section bodies; the parity test no longer accepts a class named only in a heading, and now checks `catalog.json` `roleVars` against each section's `Consumes:` line (which caught `fx-glitch` missing `--slc-accent-hover` and the callout's "etc."). `packages/ui-kit/README.md` gains an Effects section and stops claiming "no runtime JS". Code: `integrateLiquid` drops `target` when the live host leaves the document (no perpetual rAF running `toDataURL`); `trackEdges` `io.unobserve()`s a removed element; new test asserts every `array<vec4f, N>` and every `Nu` sentinel in the shader equals `MAX_RECTS`; three stale comments corrected (the GPU import path, the "inversion band uses the ground token" claim, the showcase's `--slfx-edge-warm/cool/dim`). Judged on the page: the determinate arc under `reduce` is exempt from the 0.55 dimming — at 0.55 the end of the arc, which carries the value, loses its crispness.

## Task 19: The owner's six notes — bloom out of the box, the swell, soft light

Visual tuning round on `feat/effects-layer`, done against the showcase beside https://libraries.dev/ (its `metal-examples-v2` and beam component sources read via curl, since the site blocks page scripting). Rulings:

- **The glow was truncated by the ring's own mask, not by an ancestor.** Enumerated first: none of the showcase's 29 effect elements had a clipping ancestor (the only flagged one was the dialog's `isolation`). CSS applies `filter` before `mask`, and the ring mask is clipped to `::after`'s border box, so the three `drop-shadow`s never left the 1px band; `mask-clip: no-clip` parses in Chrome and changes nothing. The bloom moved to `::before`, whose box is the element's plus `--slfx-glow` (22px), with the falloff shaped by its own mask stops (blur `--slfx-soft` 14px only softens the arc along its length). **Contract change:** a container must not clip an effect element — recorded in the spec (§Paint layers), `design-language.md` L6 and `agent/catalog.md`.
- **The liquid pulled inward by sign, not by bias.** Map mean measured on the rendered raster: 128.03 / 128.18 whole, 128.05 / 128.59 in the box (neutral 128 → 0.502, a 0.02px bias at scale 10). The reference encodes `127.5 − Z·255/scale` with `Z` pointing away from the cursor: an outward swell. Ours had the opposite sign. Flipped in `renderDentMap` (`128 − 127·v·g`) and in the shader's `dentAt` (`−(v·g·depth)`); amplitude reduced separately: `DENT_SIGMA_K` 0.42→0.36, `DENT_SIGMA_MAX` 30→24, `DENT_DEPTH_K` 0.30→0.22 (a 40px button: σ 16.8/5.0px → 14.4/3.2px; the reference's hover peak ≈ 3.4px).
- **Bloom colours are lifted toward white** (`oklch(from … calc(l + (1 − l) × 0.55) calc(c × 1.25) h)`): unlifted, the dark depth companion at half alpha was a grey smear on paper. Composited normally, not screened (screen vanishes into white). `--rim`: beam lifted a quarter, core 40% sheen (was 86%), bloom depth-only at 78/60%, no inner wash.
- **Soft light:** lit states transition over `--sl-motion-slow` (opacity + background on `::after`, opacity + filter on `::before`; 0ms under reduced motion via tokens.css). The GPU cursor reflection's presence eases with a 160ms time constant instead of flipping 0/1.

Suite 153/153, `sl-audit` 0 R / 0 A on `effects.css` and the showcase, agent docs regenerated. Kill switches re-verified on the page: HC (no canvas, every `::before`/`::after` `display: none`, Tier 0), `data-sl-fx="off"` region (no ring, no bloom), reduced motion by structure (guards test; motion tokens 0ms). Light theme is still the weaker: the rim's core reads as a dark streak under a pale haze on cream.

## Task 20: The liquid as a skin, the paper beam, and the ring that follows

**Status: done (this branch).** The owner's three notes on the liquid, verbatim: the text must not be distorted; the element borders must not go pixelated during the distortion; it must read as a **very light gooey**, not a lens. And on the light theme: "su light gli effetti di luci perdono molto, sia sui bordi che su aurora. Propongo di usare colori vividi invece di toni scuri."

**Measured on the reference before the rewrite** (https://libraries.dev/gooey, page source read via curl — the site blocks scripting): the gooey entry's filter is `blur={6} contrast={18}` — an `feGaussianBlur` then an `feColorMatrix` alpha slope — applied to a **silhouette layer below the content**, one plain shape per item, "your real DOM rides crisp on top"; the metal entry's v2 default is `applyTo: "ring"` — the bend is a vector outline, the content and glow stay rigid. Neither filters the UI. Task 18's ruling (3) — "filtering text is allowed while the pointer shapes the element" — was therefore wrong on reference grounds as well as on the owner's, and is retired for good: **the text is never filtered.**

**Root cause of all three liquid complaints:** they are properties of filtering pixels. `feDisplacementMap` on the host refracts the glyphs (the distortion), re-rasterises the element at the filter's resolution (the pixelated border at device-pixel-ratio 2 — the map was rendered at a quarter resolution), and reads as a lens because a displacement *is* a lens. No tuning of the map could have fixed any of the three.

**What changed.**
- `effects.js` — the liquid is a shape, not a filter. One shared `<svg class="sl-fx-liquid__skin">` parented into the live element at `z-index: -2` (above the host's own background and border, below its content): the host's rounded box (radii read from computed style, CSS's overlap clamp reproduced) plus a drop of `clamp(0.35 × short side, 10, 16)` px at the outline point nearest the lagged pointer, protruding `amp × 0.24 × r × exp(−½ (d / 1.5 r)²)` (≈ 3.4 px on a 40 px button); goo filter σ 4 / alpha slope 18 about 0.5 (the reference's σ 6 and 0.42 midpoint would over-weld a few-pixel swell and dilate the edge by a fraction of a pixel, which pops on hover); the crisp box redrawn unfiltered on top so the goo can only *add*; a second filter floods the merged alpha with the host's computed `background-color` and a border-wide band in its computed `border-top-color`, re-read every frame so hover and active stay the host's. The displacement map, its canvas and the per-frame `toDataURL` are gone.
- `effects.css` — the host gets a transparent `border-image` while live (hides its border under the skin's band **without** touching `border-color`); the glass hairline fades while the element is live under Tier 1; the skin is in both kill switches. `border-radius` is never written.
- `effects-shader.js` / `effects-gpu.js` — `dentAt` (the Gaussian displacement, whose field no longer existed anywhere) replaced by `smin(box, circle, GOO_BLEND = 1.5 σ)` about the same lagged centre; `params.z/w` now carry the neck width and the drop radius (0 while the drop is inside the box), the `dent` uniform is `drop`. Ring and skin are one silhouette by construction; the `smin` fillet and the goo's blur-then-threshold neck are not the same curve, but agree to within a pixel at these sizes.
- **Light theme — the vivid tier** (`effects.css`, on `:is(.sl-fx-glass, .sl-fx-aurora)`). Diagnosis: on paper the accent and the depth companion are dark by construction (L 0.60 and L 0.45 / C 0.07), and a dark line on cream is pigment; lifting toward white (what `--rim` did) gives a pale haze under a dark streak. A bright edge on a bright page has to take its contrast from **saturation**. So every hue an effect emits is floored at oklch L 0.66 and pays 0.45 chroma per unit of lift — `oklch(from var(--tok) max(l, 0.66) calc(c + max(0, 0.66 − l) × 0.45) h)` — which puts the paper depth companion at L 0.66 / C 0.17, inside the `--sl-status-*` tier on paper (L 0.58–0.67, C 0.14–0.22). The neutral glint (hairline bright stop, arc core) is `max(l, 1.2 − l)` of the sheen: the sheen where it is the light pole, its lightness mirrored where it is the dark one. Ink tokens already sit above the floor and pass through (largest change: depth chroma +0.002). No `[data-sl-theme]` branch — an inversion band's remapped tokens follow the same rule. Verified as computed values in Chrome on both themes (probing a custom property through a real `color:` — a value that comes back as the text colour is `inherit` from an invalid `var()`, which on the first probe was a stale cached stylesheet, not the syntax).
- Tests — the guards test's liquid-filter assertion (which encoded the displacement mechanism) replaced by four: nothing under a liquid selector is filtered and no rule references an SVG filter; the skin is below the content, pointer-transparent, unclipped, hidden by both kill switches; one host-level live rule, `border-image` only; no effect rule sets `border-radius` beyond `inherit`; `border-image` joins the host-level properties both kill switches must neutralise. `effects-js`: no filter or border write on any element, no displacement primitive, one skin that leaves its host before entering the next. `effects-gpu`: the union is `smin` about the reported centre and the displacement geometry is gone. Suite 159/159; `sl-audit` 0 R / 0 A on `effects.css` and the showcase.

**Verified on the page** (Chrome, showcase at 1× on a dpr-1 display, and at `zoom: 2` on the root — which rasterises the SVG filter at two device pixels per CSS pixel and stands in for dpr 2): the band stays crisp at both scales, no pixelation, no corner seam; the swell is a ~3 px bump with a soft neck; the label does not move; the filled button swells in its hover colour; one skin in the document at any time. Commit `bfa0ec6` (the blurred-child bloom) looked at for the first time: §03, both cards, top-left corners, dark and light — a Gaussian falloff, no box edge, no seam. Light theme after the change: busy and sweep tails cyan instead of a dark-teal streak, the `--rim` ring a lit cyan with a cyan bloom, the CSS hairline a light glint with an amber fleck instead of a dark grey line. Tier 2 with the new shader: the chrome hairline follows the skin's bump on the ghost button.

**Open.** (1) The arc's paper core is the glint at 86% — near-white, which on cream fades toward the page at the arc's centre; kept, because the reference has no light preset for the beam and the `--rim` variant (core 40%) already stays coloured; for the owner to judge. (2) Safari's support for `max()`/`calc()` with channel keywords inside relative colour syntax is not verified here; if a channel expression fails to parse there the whole beam falls to `transparent`, which would want a guard. (3) The showcase's accent switch pins `--sl-accent-default` to the ink amber on both themes, so the light-theme accent the kit actually ships (`#B56A0C`, L 0.60) was verified by arithmetic, not by eye.

## Task 21: The gooey on round buttons alone; every text button becomes a glass pane

**Status: done (this branch).** The owner, after seeing the gooey: *"il gooey effect mi sa che non funziona poi cosi' tanto bene su bottoni a meno che non siano tondi. applichiamolo dunque solo a bottoni tondi con singola icona. per gli altri bottoni invece cambiamo strada, a prescindere che siano primary o meno, simuliamo che siano fatti di vetro e l'interazione del mouse vira verso giochi di luce, traslucenza, distorsione/rifrazione."*

**Measured on the reference before any code was touched** (https://libraries.dev/ — the five entries are Beam, Orbs, Gooey, Metal, Image; none is titled "glass", and the owner's vocabulary maps onto `metal-fx` v2, read from its published sources at https://github.com/Jakubantalik/Libraries.dev, `packages/metal-fx/src`):
- **The bend** (`useMetalBend.ts`, `engine/bend/config.ts`): `applyTo: 'ring'` by default — the deformation is a vector outline and "button content and glow stay rigid"; the `all` path (`feDisplacementMap` on the whole root) is "kept for comparison" and its own comment says quality degrades with amplitude. Defaults: strength 0.74, reach 36 px, blob σ 13 / liquid blob σ 10, `maxDisp` 9 px, fade 200 ms in / 350 ms out, spring 260 / 13.
- **The cursor light** (`engine/cursor/light.ts`): reach 56 px, fade 200 ms; the "spill" — a glint on the page under the pointer — has radius 48 px, peak 0.55, `1 → 0.35 at 45% → 0`, tinted with the ring's colour at the outline point nearest the cursor.
- **Light mode** (`styles.ts`): the glow SVG is composited with `mix-blend-mode: multiply` at opacity 0.27 under `saturate(5.355) brightness(0.78)`; the circle variant's dark hairline is suppressed in light mode. On a light ground the reference darkens and saturates its light; it does not add white.
- **Dispersion** (`engine/presets.ts`): v2 is Paper Shaders' `liquidMetal`, whose stripe endpoints are hardcoded near-white / near-black; the presets differ only by tint, and "the R/B channel split is the only knob that produces colour separation in this shader" — `shiftRed`/`shiftBlue` 0.3 base, 0.75 in the chromatic preset.
- **Inner shadow** (`engine/rim.ts`): white 90%, offset 1 px, blur 0.5 — a hairline of light along the top inside edge of the band, "what a light from above does to a torus".

**What changed.**
- `effects.js` — the liquid matches `.sl-fx-liquid:is(.sl-fx-liquid--drop, .sl-fx-liquid--calm)` and nothing else; a bare `.sl-fx-liquid` is inert. No radius is measured: the modifier is the contract. A child's `pointerleave` (the icon inside a round button, the glitch span inside a text one) no longer releases the host — the delegated capture-phase listener fires for every child, and the liquid dipped to zero on each. New: the pane driver — writes `--slfx-px`/`--slfx-py` (pointer in the padding box), `--slfx-ptr` (the pointer's bearing as an unwrapped conic angle, minus the hot stop's 20°) and `--slfx-lit` (eased, τ 80 ms in / 140 ms out, a self-stopping loop) onto the one lit pane, and nothing else, ever; removes them when dark.
- `effects.css` — `.sl-fx-glass--pane`: the body on `::before` at `z-index: -1` (top glint 40%, bottom shade 20%, 1 px inner rim 10%, a 9% wash), the spot as two radials whose colours carry the theme in their alpha (`--slfx-spot-cool`: the glint, alpha from the sheen's lightness; `--slfx-spot-warm`: the accent's hue at the vivid tier, alpha from a 30/70 oklab mix of accent and sheen), and the lit edge: a conic with the hot stop at 20° between a depth-vivid fringe and an accent-vivid fringe, `--slfx-angle` rebound from `--slfx-ptr` with a `--sl-motion-fast` transition. `--slfx-shade` joins `--slfx-glint` as the neutral pair's dark pole. A `--rim` pane takes the cool spot always (its ground is the fill) and the resting glass conic stands down on a `--rim` (the `::after` there is 2 px outside the fill; a chrome bezel was never the design). `::before` of glass joins both kill switches.
- `effects-shader.js` / `effects-gpu.js` — `kinds.y` flags a pane; its cursor reflection reaches 48 px (`PANE_REACH`, the reference's spill radius) at gain 0.95 and disperses: red and blue sample the environment at `±DISPERSE (0.45 rad) × cursor presence`, so the split is zero away from the pointer and confined to the hairline branch.
- `showcase/effects.html` — a round icon-only button did not exist; §02 now has two (ghost with glass + `--drop` + aurora, primary with `--drop` + `--rim`), page-styled `.round` (square `.sl-btn`, `--sl-radius-pill`) because `components.css` has no icon-button class and this work does not touch it. Every `.sl-btn` on the page is a `--pane` or a `--drop`; §04's first cell shows a ghost and a primary pane side by side.
- Tests — guards: six painting rules, named; the pane's body below the label, unfiltered, hidden by both kill switches; the lit edge yields to the aurora and stays off a `--rim`. effects-js: the gate, no radius measured, a child's leave releases nothing, the pane writes only `--slfx-*`. effects-gpu: `kinds.y`, dispersion scaled by the cursor and confined to the hairline. showcase: every `.sl-btn` is a pane or a `--drop` with an `aria-label`. Suite 166/166; `sl-audit` 0 R / 0 A on `effects.css` and the showcase; generated docs regenerated without drift.
- Docs — spec Decision 2 (glass gains `--pane`, liquid gains the gate, two new "why" paragraphs), Decision 3b (`::before` is the pane's body), the declension (primary and ghost lose the liquid and gain `--pane`; a round icon-only row), the Glass and Liquid contracts, the testing table, known gaps (no refraction of the backdrop); L6; catalog (`--pane`, `--drop`, snippets); README; HANDOFF.

**Rulings.** (1) The gooey is gated by a class, never by a measured radius; containers keep `--calm` untouched. (2) Glass, not a fifth family: `--pane` is the glass family's pointer-reactive mode, and the paint-layer budget holds — body on `::before`, edge on `::after`, glitch on a child. (3) Refraction lives on the edge band: dispersion at Tier 1 (accent/depth fringes on the conic) and Tier 2 (per-channel environment split in the cursor reflection), plus the Fresnel pair on the body; the label is never filtered, and nothing bends the page behind a button — a canvas has no backdrop, and a `backdrop-filter` is either invisible on 1 px or the lens the owner refused. (4) A filled pane is marked by `--rim`, the marker the aurora already requires on a fill; it is how the pane knows its ground is the fill (spot always the white glint; edge on `::before`'s rim at Tiers 0/1, chrome on the fill's outer pixel at Tier 2).

**Verified on the page** (Chrome, dpr 1, viewport 2711 px wide; the MCP window is not focused, and Chrome starves `requestAnimationFrame` there — the eased `--slfx-lit` was seen at 0.694 and 0.870 mid-ramp and at 1.000 after a screenshot forced frames, so the easing is verified by value, not by eye):
- Dark, Tier 2: the pane at rest reads as a slab (glint line at the top, rim inside the border, shade at the bottom) on both the ghost and the primary; lit, `--slfx-lit: 1.000`, the spot's stops resolve (`color-mix` with a `calc()` percentage parses in Chrome — the resting stops come back as alpha 0).
- Dark, Tier 1 (canvas removed by hand): the lit ring's computed conic is `from -88.3deg, teal fringe 0°, glint 20°, amber fringe 40°, lo …` — the hot stop faces the pointer; at the top-left corner it shows as a warm-cool glint on the border.
- Light, Tier 2 and Tier 1: the ghost's cool spot resolves to alpha 0 and the warm one to `oklch(0.66 0.14 77 / 0.69)` with the showcase's pinned ink amber (would be 1.0 with the shipped paper amber; the 30/70 mix that followed puts it at 0.97 even with the pinned one); the primary's spot is the glint (0.964) and its warm spot transparent. At rest on paper the glint line and the inner rim are invisible against cream by arithmetic (L 0.96 on L 0.95) and the pane reads through its bottom shade and its border; lit, the ghost shows a warm tint under the pointer. `--slfx-edge-cool` on paper resolves out of gamut (`color(srgb -0.12 0.70 0.80)`): the vivid teal at L 0.66 / C 0.24 sits past the sRGB edge and Chrome clips it — inherited from `d0b903f`, not introduced here.
- The round buttons: the skin parents into "Send" (drop r 14 on a `9999px` radius resolved against the box) and into "Add"; a text pane lights (`is-glass-lit`) and takes no skin.
- At `zoom: 2` on the root (the dpr-2 proxy — which cannot verify the pointer-driven parts, since the element's own lengths are scaled while `clientX` is not): the body's 1 px lines stay crisp on both buttons.

**Open, for the owner.** (1) Whether a warm amber spot under the pointer reads as "glass" on paper, or as a stain — the arithmetic says white is invisible there and the reference multiplies and saturates its light in light mode, but nobody has looked at it who is not me. (2) The paper glint line and inner rim are invisible at rest on a ghost pane; the pane reads through shade and border there. If the owner wants the top edge to show on paper, it has to be a *dark* line (the reference suppresses its light-mode hairline outright) — not done, because it inverts the light-from-above reading. (3) The `--rim` coupling: a filled pane without an aurora would get the sheen-gated spot (warm on paper, invisible on an amber fill). A dedicated "filled" marker for the layer would be cleaner than borrowing the aurora's; deferred. (4) Under `prefers-reduced-motion` the pane is its body alone: `mount()` refuses, so no pointer is ever written and neither the spot nor the lit edge appears — coherent with the liquid, and not a gap; noted so nobody looks for the spot there. (5) The dispersion at Tier 2 is verified by reading the shader and by the chrome rendering without a validation error, not by eye at a scale where a 0.45 rad channel split on a 1 px ring is distinguishable in a downscaled screenshot.
