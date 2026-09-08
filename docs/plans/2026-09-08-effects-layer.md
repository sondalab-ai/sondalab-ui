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
const effects = readFileSync(resolve(KIT, "effects.css"), "utf8");

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
test("busy is the only mode that replaces the ring background", () => {
  const overrides = effects.match(/\.sl-fx-aurora\[data-sl-fx-live[^{]*\{[^}]*background:/g) || [];
  assert.equal(overrides.length, 1, "only the busy arc may re-declare the ring background");
  assert.match(overrides[0], /busy/, "the one background override must be the busy arc");
});

test("the busy orbit is inside the reduced-motion guard but the busy ring is not", () => {
  const guardStart = effects.indexOf("@media (prefers-reduced-motion: no-preference)");
  const orbit = effects.indexOf("slfx-orbit 1.1s");
  const ring = effects.indexOf('.sl-fx-aurora[data-sl-fx-live="busy"]::after');
  assert.ok(orbit > guardStart, "the orbit animation must sit inside the reduced-motion guard");
  assert.ok(ring < guardStart, "the busy ring itself must render regardless of motion preference");
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
   rebinding of the stops. This is the ONE background override in the file; on
   an element that is both glass and busy, busy wins, which is correct: a
   resting edge and a working edge are not the same edge. */
.sl-fx-aurora[data-sl-fx-live="busy"] { --slfx-arc: 65deg; }
.sl-fx-aurora[data-sl-fx-live="busy"]::after {
  opacity: 1;
  background: conic-gradient(from var(--slfx-angle),
    color-mix(in srgb, var(--slc-accent, var(--sl-accent-default)) 92%, transparent) 0deg,
    color-mix(in srgb, var(--slfx-depth) 78%, transparent) calc(var(--slfx-arc) * 0.62),
    transparent var(--slfx-arc),
    transparent 360deg);
}

/* Determinate — the arc length is the value; nothing rotates. The edge of a
   card IS its progress bar: no extra widget, no layout. */
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
  [data-sl-fx="on"] .sl-fx-aurora[data-sl-fx-live="busy"]:not([style*="--slfx-progress"])::after {
    animation: slfx-orbit 1.1s linear infinite;
    will-change: background;
  }
}

/* Under `reduce` the busy arc does not orbit: it renders as a static ring at
   reduced opacity — present, honest that something is happening, not moving.
   aria-busy carries the state, which is why that attribute is a requirement. */
@media (prefers-reduced-motion: reduce) {
  .sl-fx-aurora[data-sl-fx-live="busy"] { --slfx-arc: 360deg; }
  .sl-fx-aurora[data-sl-fx-live="busy"]::after { opacity: 0.55; }
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

```js
test("the liquid filter is applied to the sheen layer only, never to a text box", () => {
  const filtered = effects.match(/[^\n]*filter:\s*url\(#slfx-liquid\)[^\n]*/g) || [];
  assert.equal(filtered.length, 1, "exactly one rule may carry the liquid filter");
  const block = effects.slice(0, effects.indexOf(filtered[0]));
  const selector = block.slice(block.lastIndexOf("}") + 1).trim();
  assert.match(selector, /::before/, "the liquid filter must sit on the ::before sheen, never on the host");
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

- [ ] **Step 1: Write the failing test**

Append to `scripts/effects-guards.test.mjs`:

```js
test("the glitch never claims the host's paint layers", () => {
  // Its ghosts must be pseudo-elements of .sl-fx-glitch itself (the child span),
  // never of a host that also carries a ring or a sheen.
  assert.match(effects, /\.sl-fx-glitch::before/);
  assert.match(effects, /\.sl-fx-glitch::after/);
  assert.doesNotMatch(effects, /\.sl-fx-glitch\s+\.sl-fx-(glass|aurora|liquid)/);
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

`effects.js` touches the DOM, so the test asserts on its source rather than executing it — the repo has no DOM test harness and adding one is out of scope. Create `scripts/effects-js.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "effects.js"), "utf8");

// The audit reads CSS only, so a literal here would pass the gate while
// breaking the contract. This closes that hole mechanically.
test("effects.js contains no colour literal", () => {
  const hits = js.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\([^)]*\)/g) || [];
  assert.deepEqual(hits, [], `hues must be read from tokens with getComputedStyle, found: ${hits}`);
});

test("effects.js exports the documented API", () => {
  for (const name of ["mount", "burst", "scramble", "grantLive", "revokeLive", "mountGpu"]) {
    assert.match(js, new RegExp(`export (async )?function ${name}\\b`), `missing export: ${name}`);
  }
});

test("mount() refuses to arm Tier 1 under reduced motion", () => {
  assert.match(js, /prefers-reduced-motion:\s*reduce/);
});

test("importing the module has no side effects", () => {
  // No top-level call that touches the document: every DOM read happens inside
  // a function body. A bare `document.` at column 0 would be a side effect.
  assert.doesNotMatch(js, /^document\./m);
  assert.doesNotMatch(js, /^mount\(/m);
});

test("the glitch coordinator drops overlapping bursts rather than queueing", () => {
  assert.match(js, /burstActive/);
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

/** The document's live token values, re-read whenever the theme changes. */
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
 * breakage rather than as signal.
 * @param {Element} el an element carrying .sl-fx-glitch
 */
export function burst(el, { burstMin = 200, burstMax = 500 } = {}) {
  if (!armed || burstActive || !el) return;
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

test("the showcase demonstrates all four families", () => {
  for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
    assert.ok(html.includes(cls), `showcase must demonstrate .${cls}`);
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
- **An inversion band containing a glass-edged card**, with the band carrying the remap `components.css` already documents: `.invert { --slc-border: color-mix(in srgb, currentColor 22%, transparent); }`. Without it the edge sits on the wrong ground and vanishes — the effects layer inherits the fix rather than adding a new instance of the pitfall, and the page should prove that.
- **One unexpected composition decision** (house rule): make the declension section an asymmetric two-column split — a narrow sticky mono index of the families on the left, the component gallery on the right — rather than a centred card grid.
- **Real content, not filler** (L5): the copy names actual things — `sl-audit`, `introspect`, `@sondalab/ui-kit 0.8.0` — never lorem or marketing adjectives.
- All page-local colour must resolve to tokens; run the audit in Step 5 before committing.

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

# Slice 3 — WebGPU liquid field

## Task 12: Shader module and the double-guarded boot

**Files:**
- Create: `packages/ui-kit/effects-gpu.js`
- Create: `packages/ui-kit/effects-shader.js`
- Modify: `packages/ui-kit/effects.js` (replace the `mountGpu` stub)
- Create: `scripts/effects-gpu.test.mjs`

**Interfaces:**
- Consumes: `readTokens` behaviour from Task 6 (hues come from `getComputedStyle`, never literals).
- Produces: `bootField({ canvas, rects, tokens }) => Promise<{ stop(): void } | null>` from `effects-gpu.js`, and `SHADER` (a WGSL template string) from `effects-shader.js`.

- [ ] **Step 1: Write the failing test**

Create `scripts/effects-gpu.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const gpu = readFileSync(resolve(KIT, "effects-gpu.js"), "utf8");
const shader = readFileSync(resolve(KIT, "effects-shader.js"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(KIT, "package.json"), "utf8"));

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\([^)]*\)/g;

test("neither the GPU module nor the shader carries a colour literal", () => {
  assert.deepEqual(gpu.match(COLOR_RE) || [], []);
  assert.deepEqual(shader.match(COLOR_RE) || [], []);
});

test("the boot is double-guarded — capability AND a try/catch around init", () => {
  assert.match(gpu, /'gpu' in navigator|"gpu" in navigator/);
  assert.match(gpu, /try\s*\{[\s\S]*await import\("vgpu"\)[\s\S]*\}\s*catch/);
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
  if (!("gpu" in navigator) || !navigator.gpu) return null;
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
test("the showcase reports which tier actually resolved", () => {
  assert.match(html, /mountGpu\(\)/);
  assert.match(html, /TIER 2/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test scripts/effects-showcase.test.mjs`
Expected: FAIL — `mountGpu()` not found in the page.

- [ ] **Step 3: Extend the showcase boot script**

```html
<script type="module">
  import { mount, mountGpu } from "../packages/ui-kit/effects.js";
  const report = document.getElementById("tier-report");
  const tier1 = mount();
  report.textContent = tier1 ? "TIER 1 — BEHAVIOUR" : "TIER 0 — MATERIAL";
  if (tier1 && await mountGpu()) report.textContent = "TIER 2 — FIELD";
</script>
```

- [ ] **Step 4: Bump the ui-kit version**

Set `"version": "0.8.1"` in `packages/ui-kit/package.json`. Patch, not minor: `mountGpu` was already published in 0.8.0 as a documented no-op, so the API surface is unchanged — only its behaviour became real. `packages/palette-py/pyproject.toml` is still untouched.

- [ ] **Step 5: Confirm the version is free and nothing drifted**

Run:
```bash
curl -o /dev/null -s -w "%{http_code}\n" https://registry.npmjs.org/@sondalab%2Fui-kit/0.8.1
npm run gen:tokens && git diff --exit-code -- packages/
```
Expected: `404`, then exit 0 with no diff.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add showcase/effects.html packages/ui-kit/package.json scripts/effects-showcase.test.mjs
git commit -m "feat(showcase): report the resolved effect tier; release 0.8.1"
```
