# Base Element Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the base UI element set that turns `@sondalab/ui-kit` into a design system a Sondalab product can build a whole surface from — form controls, the signature patterns as shipped classes, navigation and state elements, identity and media — plus the two guard tests that keep it correct.

**Architecture:** All new classes are hand-authored CSS appended to the existing `packages/ui-kit/components.css`, sectioned by its `══ BANNER ══` convention. Colour reaches them only through the `--slc-*` role-vars declared in that file's `:root` block; one role-var is added (`--slc-canvas`). A new `compositions.css` carries the custom-property bindings that today live in prose. No token is added, no generated file changes, no JavaScript is written, and `effects.css` is not edited.

**Tech Stack:** Plain CSS (custom properties, `color-mix()`, `clip-path`, `backdrop-filter`), plain ESM for tests, `node --test`, `sl-audit` for the colour/tier audit.

**Spec:** `docs/specs/2026-09-14-base-element-set.md`

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include these.

- **I1 — Zero new `--sl-*` tokens.** A new token forces regenerating `packages/`, satisfying `check-drift.yml`, and bumping both `packages/ui-kit/package.json` and `packages/palette-py/pyproject.toml` in the same pull request.
- **I2 — Exactly one new `--slc-*` role-var: `--slc-canvas`.** Adding a second requires an explicit ruling recorded in this file's Rulings section.
- **I3 — Tier 0 correctness.** Every element is correct with `components.css` alone: no `effects.css`, no JavaScript.
- **I4 — Colour comes from a role-var, never a literal.** Any data-URI SVG used as a mask carries geometry only; colour arrives as `background: currentColor`.
- **I5 — Structural labels take the mono treatment.** `--sl-font-mono`, `text-transform: uppercase`, letter-spacing in the `0.14em–0.22em` band. Reaches: the segmented item, the breadcrumb, the stat caption and the stat value, the figure caption, the empty state's eyebrow, and the pagination's figures. Does **not** reach the checkbox, radio and switch text labels — those are content, and take `--sl-font-sans`.
- **I6 — Hairline structure.** A single `1px` rule in the line colour. Groups are built with the hairline-grid technique (a `1px` gap over a line-colour background), never with adjacent borders.
- **Release:** bump `packages/ui-kit/package.json` to `0.10.0`. `packages/palette-py/pyproject.toml` is **not** bumped.
- **Every element touches seven places:** `components.css`; the hand-enumerated focus-ring selector list; `agent/catalog.md`; `agent/catalog.json`; `packages/ui-kit/README.md`; `showcase/index.html` §04; and (Slice 5 only) `package.json` `exports`/`files`.
- **Verification after every task:** `node --test scripts/*.test.mjs` green, and `node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/components.css" --product default` clean.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/focus-ring.test.mjs` | create (Task 1) | Asserts every catalog entry marked `"interactive": true` has a class in the focus-ring selector list. |
| `scripts/components-token-scope.test.mjs` | create (Task 1) | Asserts no selector in `components.css` reads a theme colour token outside the `:root` role-var block. |
| `packages/ui-kit/components.css` | modify (Tasks 1–12) | Role-vars, focus ring, and every new class. Grows by four banner sections. |
| `packages/ui-kit/compositions.css` | create (Task 13) | Custom-property bindings for compositions. No paint. |
| `packages/ui-kit/agent/catalog.json` | modify (Tasks 2–13) | Machine index: one entry per element; `interactive` flag; five `signature` entries gain `classes`. |
| `packages/ui-kit/agent/catalog.md` | modify (Tasks 2–13) | Prose entry per element with markup, `Consumes:`, substrate, do/don't. |
| `packages/ui-kit/README.md` | modify (Task 14) | Class lists and the Tier B mapping recipe (`--slc-canvas`). |
| `showcase/index.html` | modify (Tasks 2–13) | §04 gallery cells, correct in all three themes. |
| `packages/ui-kit/package.json` | modify (Tasks 13, 14) | `compositions.css` in `exports`/`files`; version `0.10.0`. |

**Why `components.css` stays one file:** the owner ruled on 2026-09-14 that the patterns ship inside it rather than in a separate `patterns.css`, so a consumer's import list does not grow. It roughly doubles in size; the `══ BANNER ══` sections are what keeps it navigable.

---

## How TDD works in this repo

There is no CSS test runner. The repo's tests are structural: they read the shipped files and assert contracts. That gives a genuine red-green cycle for every element, because `scripts/catalog-audit.test.mjs` already enforces that

- every class named in `catalog.json` is documented in `catalog.md` **outside a heading**, and
- `catalog.json`'s `roleVars` equals the section's `Consumes:` line as a set, **in both directions**.

So the cycle per element is: **add the `catalog.json` entry first** → tests fail → write the `catalog.md` section and the CSS → tests pass. The index is the specification and the CSS is the implementation.

Task 1 is different, and deliberately so: the two new tests are **fences**, not TDD. They pass on the current tree by construction. Their value is that they fail the moment Task 2 onwards forgets a focus ring or reaches for a theme token. This is stated here so a reviewer does not read their green-on-arrival as a broken test.

---

## Task 1: The two guard tests

**Files:**
- Create: `scripts/focus-ring.test.mjs`
- Create: `scripts/components-token-scope.test.mjs`
- Modify: `packages/ui-kit/agent/catalog.json` (add `"interactive": true` to the four already-interactive entries)

**Interfaces:**
- Produces: the `interactive` boolean field on `catalog.json` component entries. Every later task that adds a focusable element sets it.

- [ ] **Step 1: Write the focus-ring fence**

Create `scripts/focus-ring.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const css = readFileSync(resolve(REPO, "packages/ui-kit/components.css"), "utf8");
const index = JSON.parse(
  readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.json"), "utf8"),
);

// The shared focus ring is ONE rule, and its selector list is enumerated by
// hand. A new interactive class that never gets a line here loses the house
// ring and nothing else fails — which is exactly why this test exists.
// Anchored on the declaration rather than on a comment, so re-wording the
// comment above the rule cannot silently empty the list.
function focusRingSelector() {
  const decl = css.indexOf("outline: var(--sl-focus-ring-width");
  assert.notEqual(decl, -1, "components.css has no shared focus-ring rule");
  const open = css.lastIndexOf("{", decl);
  const prevClose = Math.max(css.lastIndexOf("}", open), css.lastIndexOf("*/", open) + 1);
  return css.slice(prevClose + 1, open);
}

const selector = focusRingSelector();

test("the focus-ring rule names at least one selector", () => {
  assert.match(selector, /\.sl-/, `focus-ring selector list looks empty: ${selector}`);
});

for (const c of index.components.filter((c) => c.interactive)) {
  test(`focus ring covers "${c.id}"`, () => {
    const hit = c.classes.some((cls) => selector.includes(`.${cls}`));
    assert.ok(
      hit,
      `"${c.id}" is marked interactive but none of ${JSON.stringify(c.classes)} ` +
        `appears in the focus-ring selector list:\n${selector}`,
    );
  });
}
```

- [ ] **Step 2: Write the token-scope fence**

Create `scripts/components-token-scope.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const read = (p) => readFileSync(resolve(REPO, p), "utf8");

// A "theme token" is any custom property a theme file declares — the set is
// derived from the generated theme rather than hardcoded, so a new theme
// colour is covered the day it is generated. Type, spacing, radius, motion,
// shadow and z tokens live in tokens.css and stay freely readable.
const themeTokens = new Set(
  [...read("packages/ui-kit/themes/light.css").matchAll(/^\s*(--sl-[a-z0-9-]+)\s*:/gm)]
    .map((m) => m[1]),
);

const css = read("packages/ui-kit/components.css");

// Everything outside the FIRST :root block — that block is the role-var layer,
// and reading theme tokens is precisely its job.
const start = css.indexOf(":root {");
const end = css.indexOf("}", start);
const outside = css.slice(0, start) + css.slice(end + 1);

test("theme-token set was derived, not empty", () => {
  assert.ok(themeTokens.size > 10, `expected a populated theme, got ${themeTokens.size}`);
});

test("no selector outside the :root role-var block reads a theme colour token", () => {
  const found = [
    ...new Set([...outside.matchAll(/--sl-[a-z0-9-]+/g)].map((m) => m[0])),
  ].filter((n) => themeTokens.has(n));
  assert.deepEqual(
    found,
    [],
    `components.css must reach colour through --slc-* role-vars: a theme token ` +
      `resolves only under [data-sl-theme] and is ABSENT in Tier B products. Found: ${found}`,
  );
});
```

- [ ] **Step 3: Run both, confirm they pass on the current tree**

Run: `node --test scripts/focus-ring.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS. The focus-ring file reports only the "names at least one selector" test, because no entry carries `interactive` yet.

- [ ] **Step 4: Mark the four already-interactive catalog entries**

In `packages/ui-kit/agent/catalog.json`, add `"interactive": true` to the entries with ids `button`, `link`, `field`, and `tabs`. Place the key directly after `"kind"`. Example for `button`:

```json
    {
      "id": "button",
      "kind": "primitive",
      "interactive": true,
      "classes": [
```

- [ ] **Step 5: Run the focus-ring test to see it now actually checks something**

Run: `node --test scripts/focus-ring.test.mjs`
Expected: PASS, with five tests — the selector-not-empty one plus `button`, `link`, `field`, `tabs`. If any fails, the extraction in Step 1 is wrong; fix it before going further, because every later task depends on this fence.

- [ ] **Step 6: Run the full suite**

Run: `node --test scripts/*.test.mjs`
Expected: 268 + 6 = 274 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add scripts/focus-ring.test.mjs scripts/components-token-scope.test.mjs packages/ui-kit/agent/catalog.json
git commit -m "test: two fences for the work that is about to be done

The focus-ring selector list in components.css is enumerated by hand, so
an interactive class that misses it loses the house ring and nothing
fails. And the signature patterns read theme tokens directly, which is
fine for CSS you copy and wrong for a class we ship, because those
tokens are absent in a Tier B product.

Both pass on arrival. They are here to fail later."
```

---

## Task 2: Checkbox and radio

**Files:**
- Modify: `packages/ui-kit/components.css` (new `FORM CONTROLS` banner section; focus-ring list at ~line 54-63)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html` (§04 gallery)

**Interfaces:**
- Consumes: the `interactive` field from Task 1; the `--slc-*` role-vars already declared in `components.css`.
- Produces: `.sl-check` / `.sl-check__input` / `.sl-check__box` / `.sl-check__label` and `.sl-radio` / `.sl-radio__input` / `.sl-radio__box` / `.sl-radio__label`. Task 3 reuses the host and hidden-input rules by adding `.sl-switch` to their selector lists.

- [ ] **Step 1: Add the catalog.json entries (this is the failing test)**

Insert after the `field` entry in `packages/ui-kit/agent/catalog.json`:

```json
    {
      "id": "checkbox",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-check",
        "sl-check__input",
        "sl-check__box",
        "sl-check__label"
      ],
      "roleVars": [
        "--slc-surface",
        "--slc-border-strong",
        "--slc-accent",
        "--slc-on-accent",
        "--slc-text",
        "--slc-focus"
      ]
    },
    {
      "id": "radio",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-radio",
        "sl-radio__input",
        "sl-radio__box",
        "sl-radio__label"
      ],
      "roleVars": [
        "--slc-surface",
        "--slc-border-strong",
        "--slc-accent",
        "--slc-on-accent",
        "--slc-text",
        "--slc-focus"
      ]
    },
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs`
Expected: FAIL. `catalog.md documents "checkbox"` fails with `class "sl-check" (checkbox) is not documented in catalog.md outside a heading`; `focus ring covers "checkbox"` fails because the selector list has no `.sl-check`.

- [ ] **Step 3: Write the catalog.md section**

Insert in `packages/ui-kit/agent/catalog.md`, after the `### Field` section:

````markdown
### Checkbox — `sl-check` (`__input` · `__box` · `__label`)
A `<label>` host, a visually-hidden but focusable `<input>`, a `<span>` that paints the box, and a `<span>` that carries the text. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-check">
  <input class="sl-check__input" type="checkbox">
  <span class="sl-check__box"></span>
  <span class="sl-check__label">Run the audit on save</span>
</label>
```
Consumes: `--slc-surface`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus`. Do: keep the four parts in that order — `__box` is styled by an adjacent-sibling selector, so an element between it and `__input` breaks every checked state. Don't: hide `__input` with `display:none` or `visibility:hidden`; both remove it from the focus order and the control stops being reachable by keyboard.

### Radio — `sl-radio` (`__input` · `__box` · `__label`)
The checkbox's shape with a round box and a dot. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-radio">
  <input class="sl-radio__input" type="radio" name="tier">
  <span class="sl-radio__box"></span>
  <span class="sl-radio__label">Tier A — full theme selector</span>
</label>
```
Consumes: `--slc-surface`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus`. Do: give every radio in a set the same `name`. Don't: use a radio where only one option exists — that is a checkbox.
````

- [ ] **Step 4: Write the CSS**

Append a new banner section to `packages/ui-kit/components.css`, after the `PRIMITIVES` section and before `══ COMPLEX ══`:

```css
/* ══ FORM CONTROLS ═══════════════════════════════════════════════════════════ */

/* Checkbox / radio / switch share one shape: a <label> host, a hidden-but-
   focusable <input>, a <span> that paints the control, a <span> of text.
   The input is NOT styled directly: pseudo-elements on replaced elements are
   undefined per spec and inconsistent across engines, which is the same reason
   effects.css requires an .sl-field__control wrapper. */
.sl-check,
.sl-radio,
.sl-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--sl-space-3, 0.75rem);
  cursor: pointer;
}

/* Hidden from sight, present in the focus order. Never display:none. */
.sl-check__input,
.sl-radio__input,
.sl-switch__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.sl-check__box,
.sl-radio__box {
  position: relative;
  flex: none;
  width: 1rem;
  height: 1rem;
  background: var(--slc-surface);
  border: 1px solid var(--slc-border-strong);
  transition:
    background-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    border-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}
.sl-check__box  { border-radius: var(--sl-radius-sm, 4px); }
.sl-radio__box  { border-radius: 50%; }

.sl-check__input:checked + .sl-check__box,
.sl-radio__input:checked + .sl-radio__box {
  background: var(--slc-accent);
  border-color: var(--slc-accent);
}

/* The tick is a rotated border corner — no asset, no data URI, nothing to
   audit. The radio's dot is a filled circle for the same reason. */
.sl-check__box::after {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 0.3rem;
  height: 0.55rem;
  border: solid var(--slc-on-accent);
  border-width: 0 1.5px 1.5px 0;
  transform: translateY(-1px) rotate(45deg);
  opacity: 0;
}
.sl-radio__box::after {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: var(--slc-on-accent);
  opacity: 0;
}
.sl-check__input:checked + .sl-check__box::after,
.sl-radio__input:checked + .sl-radio__box::after { opacity: 1; }

/* Content, not a structural label (L1): sans, sentence case. */
.sl-check__label,
.sl-radio__label,
.sl-switch__label {
  font-family: var(--sl-font-sans, system-ui, sans-serif);
  font-size: var(--sl-text-sm, 0.875rem);
  line-height: var(--sl-line-normal, 1.5);
  color: var(--slc-text);
}

.sl-check:has(.sl-check__input:disabled),
.sl-radio:has(.sl-radio__input:disabled),
.sl-switch:has(.sl-switch__input:disabled) { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 5: Add the focus-ring lines**

In `packages/ui-kit/components.css`, extend the shared focus-ring selector list (the rule whose body sets `outline: var(--sl-focus-ring-width…)`) so it reads:

```css
.sl-btn:focus-visible,
.sl-link:focus-visible,
.sl-field__input:focus-visible,
.sl-tabs__tab:focus-visible,
.sl-check__input:focus-visible + .sl-check__box,
.sl-radio__input:focus-visible + .sl-radio__box,
[data-sl-tooltip]:focus-visible {
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 7: Run the audit**

Run: `node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/components.css" --product default`
Expected: no `R` findings.

- [ ] **Step 8: Add the showcase cell**

In `showcase/index.html`, inside the §04 `<div class="gallery">`, after the cell labelled `field`:

```html
          <div class="g-cell">
            <span class="g-label">checkbox · radio</span>
            <div class="g-demo" style="flex-direction:column;align-items:flex-start;gap:0.6rem">
              <label class="sl-check">
                <input class="sl-check__input" type="checkbox" checked>
                <span class="sl-check__box"></span>
                <span class="sl-check__label">Run the audit on save</span>
              </label>
              <label class="sl-check">
                <input class="sl-check__input" type="checkbox">
                <span class="sl-check__box"></span>
                <span class="sl-check__label">Fail the build on an R finding</span>
              </label>
              <label class="sl-radio">
                <input class="sl-radio__input" type="radio" name="demo-tier" checked>
                <span class="sl-radio__box"></span>
                <span class="sl-radio__label">Tier A — full theme selector</span>
              </label>
              <label class="sl-radio">
                <input class="sl-radio__input" type="radio" name="demo-tier">
                <span class="sl-radio__box"></span>
                <span class="sl-radio__label">Tier B — value-pinned</span>
              </label>
            </div>
          </div>
```

- [ ] **Step 9: Look at it in all three themes**

Open `showcase/index.html` in a browser, switch theme to light, dark and high-contrast using the switcher in the header. Confirm: the box border is visible on all three grounds, the tick is legible on the accent fill, and keyboard `Tab` gives every control the house focus ring.

- [ ] **Step 10: Run the full suite and commit**

Run: `node --test scripts/*.test.mjs` → expected 0 fail.

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): a checkbox and a radio, in the shape the switch needs too

Four parts, one order: the label hosts, the input stays focusable and
out of sight, a span paints the control, a span carries the text. The
input is never styled directly -- pseudo-elements on replaced elements
are undefined per spec, which is why effects.css already wraps them."
```

---

## Task 3: Switch

**Files:**
- Modify: `packages/ui-kit/components.css` (`FORM CONTROLS` section; focus-ring list)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Consumes: `.sl-switch`, `.sl-switch__input` and `.sl-switch__label` rules already written in Task 2's shared selector lists.
- Produces: `.sl-switch__track`.

- [ ] **Step 1: Add the catalog.json entry**

After the `radio` entry:

```json
    {
      "id": "switch",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-switch",
        "sl-switch__input",
        "sl-switch__track",
        "sl-switch__label"
      ],
      "roleVars": [
        "--slc-surface",
        "--slc-border-strong",
        "--slc-accent",
        "--slc-on-accent",
        "--slc-text",
        "--slc-focus"
      ]
    },
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs`
Expected: FAIL — `class "sl-switch" (switch) is not documented in catalog.md outside a heading`, and the focus ring does not cover `switch`.

- [ ] **Step 3: Write the catalog.md section**

After the `### Radio` section:

````markdown
### Switch — `sl-switch` (`__input` · `__track` · `__label`)
A checkbox that reads as a state rather than a choice: use it where the change takes effect immediately, and a checkbox where it takes effect on submit. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-switch">
  <input class="sl-switch__input" type="checkbox" role="switch">
  <span class="sl-switch__track"></span>
  <span class="sl-switch__label">Tier 2 GPU effects</span>
</label>
```
Consumes: `--slc-surface`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus`. Do: carry `role="switch"` on the input, so the state reaches a screen reader as on/off rather than as checked. Don't: put ON/OFF text inside the track — the knob's position is the state, and a label that repeats it goes stale in translation.
````

- [ ] **Step 4: Write the CSS**

Append to the `FORM CONTROLS` section, after the checkbox/radio rules:

```css
.sl-switch__track {
  position: relative;
  flex: none;
  width: 2.25rem;
  height: 1.25rem;
  background: var(--slc-surface);
  border: 1px solid var(--slc-border-strong);
  border-radius: 999px;
  transition:
    background-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    border-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}
.sl-switch__track::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 2px;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 50%;
  background: var(--slc-border-strong);
  transform: translateY(-50%);
  transition:
    transform var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    background-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}
.sl-switch__input:checked + .sl-switch__track {
  background: var(--slc-accent);
  border-color: var(--slc-accent);
}
.sl-switch__input:checked + .sl-switch__track::after {
  background: var(--slc-on-accent);
  transform: translateY(-50%) translateX(0.9375rem);
}
```

- [ ] **Step 5: Add the focus-ring line**

Add `.sl-switch__input:focus-visible + .sl-switch__track,` to the shared focus-ring selector list, after the radio line.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 7: Add the showcase cell**

After the `checkbox · radio` cell:

```html
          <div class="g-cell">
            <span class="g-label">switch</span>
            <div class="g-demo" style="flex-direction:column;align-items:flex-start;gap:0.6rem">
              <label class="sl-switch">
                <input class="sl-switch__input" type="checkbox" role="switch" checked>
                <span class="sl-switch__track"></span>
                <span class="sl-switch__label">Tier 2 GPU effects</span>
              </label>
              <label class="sl-switch">
                <input class="sl-switch__input" type="checkbox" role="switch">
                <span class="sl-switch__track"></span>
                <span class="sl-switch__label">Reduced motion override</span>
              </label>
            </div>
          </div>
```

- [ ] **Step 8: Check the knob travel**

Open the showcase. The knob must land flush inside the track's right edge, not overhanging it: track `2.25rem` = 36px, border 1px each side, knob `0.875rem` = 14px, left offset 2px. Travel is `36 - 2 - 14 - 2 - 2 = 15px` (`0.9375rem`). If the border-box maths in your browser puts it elsewhere, adjust the `translateX` and record the value here — do not adjust the track width, which is shared with nothing.

- [ ] **Step 9: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): a switch, where the change takes effect at once

Same four parts as the checkbox. The knob's position is the state, so
nothing writes ON or OFF inside the track; role=switch carries it to a
screen reader."
```

---

## Task 4: Select

**Files:**
- Modify: `packages/ui-kit/components.css` (`FORM CONTROLS` section)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Consumes: `.sl-field__control` and `.sl-field__input`, both already in `components.css`.
- Produces: `.sl-select` — a wrapper class that composes onto `.sl-field__control`.

- [ ] **Step 1: Add the catalog.json entry**

After the `switch` entry. Note there is **no** `interactive` flag: the focusable element is the `<select>`, which already carries `.sl-field__input` and is therefore covered by the ring through the `field` entry.

```json
    {
      "id": "select",
      "kind": "primitive",
      "classes": [
        "sl-select"
      ],
      "roleVars": [
        "--slc-text-muted"
      ]
    },
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: FAIL — `class "sl-select" (select) is not documented in catalog.md outside a heading`.

- [ ] **Step 3: Write the catalog.md section**

After the `### Switch` section:

````markdown
### Select — `sl-select`
The chevron a `<select>` cannot draw for itself. Composes onto `sl-field__control`, the wrapper the effects layer already binds to, so a field and a select take an effect the same way. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-field">
  <span class="sl-field__label">Substrate</span>
  <span class="sl-field__control sl-select">
    <select class="sl-field__input">
      <option>App</option>
      <option>IDE</option>
      <option>Page</option>
    </select>
  </span>
</label>
```
Consumes: `--slc-text-muted`. Do: keep `sl-field__input` on the `<select>` itself — the border, the ground and the focus ring all come from there. Don't: reach for a `mask-image` to draw the arrow; a mask on a `<select>` masks its text along with the arrow.
````

- [ ] **Step 4: Write the CSS**

Append to the `FORM CONTROLS` section:

```css
/* The chevron rides the WRAPPER, never the <select>: a mask or a pseudo-element
   on the control itself would take the option text with it. */
.sl-select { position: relative; display: block; }
.sl-select > .sl-field__input {
  appearance: none;
  width: 100%;
  padding-right: var(--sl-space-6, 2rem);
}
.sl-select::after {
  content: "";
  position: absolute;
  top: 50%;
  right: var(--sl-space-4, 1rem);
  width: 0.4rem;
  height: 0.4rem;
  border: solid var(--slc-text-muted);
  border-width: 0 1px 1px 0;
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 6: Add the showcase cell**

```html
          <div class="g-cell">
            <span class="g-label">select</span>
            <div class="g-demo">
              <label class="sl-field" style="min-width:14rem">
                <span class="sl-field__label">Substrate</span>
                <span class="sl-field__control sl-select">
                  <select class="sl-field__input">
                    <option>App</option>
                    <option>IDE</option>
                    <option>Page</option>
                    <option>Term</option>
                  </select>
                </span>
              </label>
            </div>
          </div>
```

- [ ] **Step 7: Check it in all three themes, run the full suite, commit**

Confirm the chevron sits clear of the longest option's text and that clicking it still opens the menu (`pointer-events: none` is what makes that work).

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): the chevron a select cannot draw for itself

It rides sl-field__control, the wrapper the effects layer already binds
to, so a field and a select take an effect the same way."
```

---

## Task 5: `--slc-canvas`, wrap and prose

**Files:**
- Modify: `packages/ui-kit/components.css` (`:root` role-var block; new `PATTERNS` banner section)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Produces: `--slc-canvas` (the page ground), consumed by Task 6's `.sl-header` and `.sl-invert`. Also `.sl-wrap` and `.sl-prose`, and the conventions `--sl-gutter` and `--sl-measure` that they declare.

- [ ] **Step 1: Add the role-var**

In the `:root` block of `packages/ui-kit/components.css`, in the `/* surfaces + text */` group, add `--slc-canvas` as the first line — the page ground sits below the surface, and the block reads outward-in:

```css
  /* surfaces + text */
  --slc-canvas:        var(--sl-bg-canvas,         #ECE4D4);
  --slc-surface:       var(--sl-bg-surface,        #F6F1E6);
```

- [ ] **Step 2: Extend the header comment that documents the contract**

The `components.css` header explains the role-var fallback chain. Add `--slc-canvas` to the inversion-band note there, which currently says the fix is applied at the band by the consumer — after Task 6 the band ships that fix itself:

```
   ── Inversion-band pitfall ───────────────────────────────────────────────────
   --slc-border defaults to an alpha-over-canvas value. Inside an inversion band
   (a block whose background is the strongest neutral) that alpha sits on the
   wrong ground and the border vanishes. The shipped .sl-invert re-derives it
   from the band's own foreground; a product rolling its own band does the same:
     .invert { --slc-border: color-mix(in srgb, currentColor 22%, transparent); }
   Keeps value-equality, no new token. Any bordered component (card, table,
   field, callout, checkbox, switch) inherits the fix automatically.
```

- [ ] **Step 3: Add the catalog.json entries**

At the end of the `components` array, before the existing `signature` entries:

```json
    {
      "id": "wrap",
      "kind": "signature",
      "classes": [
        "sl-wrap"
      ],
      "roleVars": []
    },
    {
      "id": "prose",
      "kind": "signature",
      "classes": [
        "sl-prose"
      ],
      "roleVars": []
    },
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: FAIL — `class "sl-wrap" (wrap) is not documented in catalog.md outside a heading`, and `section for wrap has no Consumes: line`.

- [ ] **Step 5: Write the catalog.md sections**

In `packages/ui-kit/agent/catalog.md`, change the `## Signature patterns (page-level composition — copy the CSS)` heading to `## Signature patterns (shipped classes)` and replace its intro paragraph with:

```markdown
These were CSS to copy until 0.10.0; they are shipped classes now. They carry the composition motifs from `design-language.md` L2/L3, and like every other component they reach colour through `--slc-*` role-vars — which is why `--slc-canvas` exists.
```

Then add, as the first two entries of that section:

````markdown
### Wrap — `sl-wrap`
The content measure and the fluid gutter, in one class. `--sl-gutter` is a convention, not a token (`design-language.md` §New-token policy), and this class is where the kit declares it. Substrate: **A** App, **R** Page, **N/A** IDE.
```html
<div class="sl-wrap"> … </div>
```
Consumes: nothing — layout only. Do: put it inside a full-bleed section, so the section's background reaches the viewport edge and only the content is inset. Don't: nest one `sl-wrap` in another; the gutters add up.

### Prose — `sl-prose`
Caps running text at the ~63ch measure. `--sl-measure` is a convention, not a token. Substrate: **A** IDE, **R** App/Page.
```html
<div class="sl-prose"> <p>…</p> </div>
```
Consumes: nothing — layout only. Do: put it on the text container, not on a grid cell that also holds a figure. Don't: let prose run full-bleed; L1 caps the measure for a reason.
````

- [ ] **Step 6: Write the CSS**

Append a new banner section at the end of `packages/ui-kit/components.css`:

```css
/* ══ PATTERNS (page-level composition) ═══════════════════════════════════════ */

/* --sl-gutter and --sl-measure are CONVENTIONS, not tokens: they are fluid or
   layout-level, so design-language.md §New-token policy keeps them out of
   tokens.css and asks products to declare them locally with these values.
   Declaring them in-class is exactly that — nothing lands on :root. */
.sl-wrap {
  --sl-gutter: clamp(1.25rem, 5vw, 6rem);
  width: 100%;
  max-width: 78rem;
  margin-inline: auto;
  padding-inline: var(--sl-gutter);
}

.sl-prose {
  --sl-measure: 63ch;
  max-width: var(--sl-measure);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS. The token-scope test is the one that matters here — it proves `--slc-canvas` landed inside the `:root` block and not in a selector.

- [ ] **Step 8: Run the audit and the full suite, then commit**

Run: `node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/components.css" --product default`
Run: `node --test scripts/*.test.mjs`

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md
git commit -m "feat(ui-kit): the page ground gets a role-var, and the measure gets a class

The patterns are about to become shipped classes, and two of them stand
on the canvas -- which the role-var layer never had. Surface is not a
substitute: ECE4D4 against F6F1E6 in light, 070A0D against 0F151A in
dark, and a band's text on the wrong one of those is wrong in every
theme.

--sl-gutter and --sl-measure stay conventions. Declaring them in-class
is what the new-token policy asks for; nothing lands on :root."
```

---

## Task 6: Sticky header and inversion band

**Files:**
- Modify: `packages/ui-kit/components.css` (`PATTERNS` section)
- Modify: `packages/ui-kit/agent/catalog.json` (the `sticky-header` and `inversion-band` entries gain `classes` and lose their `--sl-*` roleVars)
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Consumes: `--slc-canvas` from Task 5.
- Produces: `.sl-header`, `.sl-invert`.

- [ ] **Step 1: Rewrite the two catalog.json entries**

Replace the existing `sticky-header` and `inversion-band` entries — note the `roleVars` change from `--sl-*` theme tokens to `--slc-*` role-vars, which is the whole point of the promotion:

```json
    {
      "id": "sticky-header",
      "kind": "signature",
      "classes": [
        "sl-header"
      ],
      "roleVars": [
        "--slc-canvas",
        "--slc-border-subtle"
      ]
    },
    {
      "id": "inversion-band",
      "kind": "signature",
      "classes": [
        "sl-invert"
      ],
      "roleVars": [
        "--slc-text",
        "--slc-canvas"
      ]
    },
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: FAIL — `class "sl-header" (sticky-header) is not documented in catalog.md outside a heading`, and the `Consumes:` parity test fails for both entries.

- [ ] **Step 3: Rewrite the two catalog.md sections**

Replace the existing `### Sticky translucent header` and `### Inversion band` sections:

````markdown
### Sticky translucent header — `sl-header`
The house header: sticky, translucent over the page ground, a 1px bottom rule. Mono wordmark left, mono meta right. Substrate: **R** App/Page, **N/A** IDE.
```html
<header class="sl-header">
  <div class="sl-wrap"> … </div>
</header>
```
Consumes: `--slc-canvas`, `--slc-border-subtle`. Do: put a `sl-wrap` inside it, so the translucency reaches the viewport edge and only the content is inset. Don't: use an opaque header, or a drop-shadow instead of the 1px rule.

### Inversion band — `sl-invert`
A full-width block flipped to paper-on-ink. It punctuates rhythm and marks the thesis or the primary call to action; at least one per long page is idiomatic. Substrate: **R** Page, **A** App, **N/A** IDE.
```html
<section class="sl-invert">
  <div class="sl-wrap"> … </div>
</section>
```
Consumes: `--slc-text`, `--slc-canvas`.

The class re-derives the border and text role-vars from the band's own foreground **on its children**, so every bordered component placed inside — card, table, field, callout, checkbox, switch — keeps a visible hairline with no work from the author. (This sentence is deliberately on its own line: `scripts/catalog-audit.test.mjs` reads the whole `Consumes:` line and compares every `--slc-*` on it against `catalog.json` as a set, so a role-var named in trailing prose fails parity.)

Do: give it a direct child to hold the content (a `sl-wrap` is the usual one); the re-derivation is a `> *` rule, because a custom property cannot be defined on the same element that reads it. Don't: hand-write an alpha-over-canvas hairline inside the band — that is the bug this class exists to close.
````

- [ ] **Step 4: Write the CSS**

Append to the `PATTERNS` section:

```css
.sl-header {
  position: sticky;
  top: 0;
  z-index: var(--sl-z-overlay, 50);
  background: color-mix(in srgb, var(--slc-canvas) 84%, transparent);
  backdrop-filter: saturate(140%) blur(10px);
  border-bottom: 1px solid var(--slc-border-subtle);
}

.sl-invert {
  background: var(--slc-text);
  color: var(--slc-canvas);
}
/* The re-derivation sits on the CHILDREN, not on the band. A custom property
   whose value references a property declared on the same element is a cycle,
   and CSS makes every property in a cycle invalid at computed-value time — so
   `--slc-text: var(--slc-canvas)` next to `background: var(--slc-text)` would
   silently paint the band its own foreground. Custom properties inherit, so
   one generation is enough to reach the whole subtree. */
.sl-invert > * {
  --slc-text:           var(--slc-canvas);
  --slc-text-secondary: color-mix(in srgb, currentColor 78%, transparent);
  --slc-text-muted:     color-mix(in srgb, currentColor 58%, transparent);
  --slc-border:         color-mix(in srgb, currentColor 22%, transparent);
  --slc-border-subtle:  color-mix(in srgb, currentColor 12%, transparent);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 6: Replace the showcase's bespoke inversion demo**

`showcase/index.html` §04 ends with a hand-rolled inversion band (search for `Inversion band — <b>--slc-border</b> scope-override`). Replace that cell's markup so it uses `.sl-invert`, and put a bordered component inside it to prove the hairline survives:

```html
          <div class="g-cell" style="grid-column:1/-1;padding:0">
            <div class="sl-invert" style="padding:1.4rem">
              <div>
                <span class="sl-eyebrow">Inversion band</span>
                <div class="sl-card" style="margin-top:0.8rem">
                  <h3 class="sl-card__title">The hairline survives</h3>
                  <div class="sl-card__body">
                    <b>.sl-invert</b> re-derives <b>--slc-border</b> from its own
                    foreground on its children, so a bordered component placed
                    inside keeps a visible edge with no work from the author.
                  </div>
                </div>
              </div>
            </div>
          </div>
```

- [ ] **Step 7: Verify the cycle bug is actually absent**

Open the showcase. The band's background must be the strongest neutral (near-black in light theme, near-white in dark), **not** the canvas. If the band paints itself canvas-on-canvas, the `> *` rule has been collapsed onto `.sl-invert` — that is the cycle described in the CSS comment. Confirm in all three themes, and confirm the card inside keeps a visible border.

- [ ] **Step 8: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): the header and the band stop being CSS you copy

Both stand on the page ground, so both needed --slc-canvas before they
could ship. The band carries its own hairline fix now, which was a
footnote three documents repeated and every adopter forgot.

The fix sits on the children on purpose: a custom property that
references one declared on the same element is a cycle, and CSS makes
every property in a cycle invalid -- the band would have painted itself
its own foreground."
```

---

## Task 7: Hairline grid, section index, display anchor

**Files:**
- Modify: `packages/ui-kit/components.css` (`PATTERNS` section)
- Modify: `packages/ui-kit/agent/catalog.json` (three `signature` entries gain `classes`)
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Produces: `.sl-hgrid`, `.sl-section`, `.sl-section__head`, `.sl-section__idx`, `.sl-anchor`.

- [ ] **Step 1: Rewrite the three catalog.json entries**

```json
    {
      "id": "hairline-grid",
      "kind": "signature",
      "classes": [
        "sl-hgrid"
      ],
      "roleVars": [
        "--slc-border-subtle",
        "--slc-surface"
      ]
    },
    {
      "id": "section-index",
      "kind": "signature",
      "classes": [
        "sl-section",
        "sl-section__head",
        "sl-section__idx"
      ],
      "roleVars": [
        "--slc-border-subtle",
        "--slc-text-muted"
      ]
    },
    {
      "id": "oversized-anchor",
      "kind": "signature",
      "classes": [
        "sl-anchor"
      ],
      "roleVars": []
    },
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: FAIL for all three ids.

- [ ] **Step 3: Rewrite the three catalog.md sections**

````markdown
### Hairline grid — `sl-hgrid`
Cards formed by a 1px gap over a line-colour background; cells paint their own surface, producing crisp shared rules instead of doubled borders. This is a signature — prefer it over the bordered-card grid the house style otherwise avoids. Substrate: **R** App/Page, **N/A** IDE.
```html
<div class="sl-hgrid">
  <div>…</div>
  <div>…</div>
  <div>…</div>
</div>
```
Consumes: `--slc-border-subtle`, `--slc-surface`. Do: let the cells be plain elements — the grid paints them. Don't: give a cell its own border; that is the doubling this technique exists to avoid.

### Section with mono index — `sl-section` (`__head` · `__idx`)
A section opens with a mono index beside its heading, separated from the previous section by a 1px top rule. Substrate: **R** Page, **A** App, **N/A** IDE.
```html
<section class="sl-section">
  <div class="sl-section__head">
    <span class="sl-section__idx">03</span>
    <h2>Signature components</h2>
  </div>
</section>
```
Consumes: `--slc-border-subtle`, `--slc-text-muted`. Do: number it only where the content is a real sequence — L5, structure encodes truth. Don't: number four unrelated sections 01–04 because it looks tidy.

### Oversized display anchor — `sl-anchor`
One oversized display heading per screen, sized by a fluid clamp — a documented pattern, not a token, because the size is fluid. Substrate: **R** Page, **A** App where a hero exists, **N/A** IDE.
```html
<h1 class="sl-anchor">Everything measured, nothing asserted.</h1>
```
Consumes: nothing — type only. Do: spend the screen's one oversized element here. Don't: use more than one per screen, and don't reach for the display serif on a numeral — a display-scale numeral is a structural label and stays mono (L1).
````

- [ ] **Step 4: Write the CSS**

Append to the `PATTERNS` section:

```css
/* Cells paint their own surface; the 1px gap over the line colour IS the rule.
   No cell carries a border, so no rule is ever doubled. */
.sl-hgrid {
  display: grid;
  gap: 1px;
  background: var(--slc-border-subtle);
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
}
.sl-hgrid > * {
  background: var(--slc-surface);
  padding: var(--sl-space-5, 1.5rem);
}

.sl-section {
  border-top: 1px solid var(--slc-border-subtle);
  padding-block: var(--sl-space-8, 3rem);
}
.sl-section__head {
  display: flex;
  align-items: baseline;
  gap: var(--sl-space-4, 1rem);
}
.sl-section__idx {
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-xs, 0.75rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--slc-text-muted);
  flex: none;
}

/* Fluid by design: the size is a clamp, which is why it is a pattern and not
   a --sl-text-* token. At most one per screen (L1). */
.sl-anchor {
  font-family: var(--sl-font-display, Georgia, serif);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: var(--sl-line-tight, 1.2);
  text-wrap: balance;
  font-size: clamp(2.7rem, 1.6rem + 5vw, 5.4rem);
  margin: 0;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 6: Add a showcase cell for the grid and the anchor**

```html
          <div class="g-cell" style="grid-column:1/-1">
            <span class="g-label">hairline grid · display anchor</span>
            <div class="sl-anchor" style="font-size:clamp(1.8rem,1.2rem+2vw,3rem);margin-bottom:1rem">
              Everything measured.
            </div>
            <div class="sl-hgrid">
              <div><span class="sl-eyebrow">Cell</span><p style="margin:.4rem 0 0">Paints its own surface.</p></div>
              <div><span class="sl-eyebrow">Cell</span><p style="margin:.4rem 0 0">The gap is the rule.</p></div>
              <div><span class="sl-eyebrow">Cell</span><p style="margin:.4rem 0 0">No border is doubled.</p></div>
            </div>
          </div>
```

- [ ] **Step 7: Confirm the grid's rules are 1px in all three themes**

Open the showcase and zoom to 200%. The rules between cells must stay a single hairline, and must not double at the grid's outer edge (there should be no outer rule at all — the background only shows through the gaps).

- [ ] **Step 8: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): the grid, the section index and the anchor ship as classes

The last three patterns that were CSS to copy. The grid's rule is the
gap, so no cell carries a border and nothing doubles."
```

---

## Task 8: Breadcrumb, button group, segmented control

**Files:**
- Modify: `packages/ui-kit/components.css` (new `NAVIGATION & STATE` banner section; focus-ring list)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Consumes: `.sl-btn` (Task-independent, already shipped).
- Produces: `.sl-breadcrumb` / `__item` / `__sep`, `.sl-btn-group`, `.sl-segmented` / `__item`.

- [ ] **Step 1: Add the catalog.json entries**

```json
    {
      "id": "breadcrumb",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-breadcrumb",
        "sl-breadcrumb__item",
        "sl-breadcrumb__sep"
      ],
      "roleVars": [
        "--slc-text-muted",
        "--slc-text",
        "--slc-accent",
        "--slc-focus"
      ]
    },
    {
      "id": "button-group",
      "kind": "primitive",
      "classes": [
        "sl-btn-group"
      ],
      "roleVars": [
        "--slc-border"
      ]
    },
    {
      "id": "segmented",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-segmented",
        "sl-segmented__item"
      ],
      "roleVars": [
        "--slc-border",
        "--slc-surface",
        "--slc-raised",
        "--slc-text-muted",
        "--slc-text",
        "--slc-focus"
      ]
    },
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs`
Expected: FAIL on documentation for all three, and on focus-ring coverage for `breadcrumb` and `segmented`.

- [ ] **Step 3: Write the catalog.md sections**

Insert a `## Navigation & state` heading after the primitives section, then:

````markdown
### Breadcrumb — `sl-breadcrumb` (`__item` · `__sep`)
The trail to here. Structural navigation labels, so mono uppercase tracked (L1). Substrate: **R** App, **A** IDE/Page.
```html
<nav class="sl-breadcrumb" aria-label="Breadcrumb">
  <a class="sl-breadcrumb__item" href="/">Specs</a>
  <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
  <a class="sl-breadcrumb__item" href="/specs/ds">Design system</a>
  <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
  <span class="sl-breadcrumb__item" aria-current="page">Base element set</span>
</nav>
```
Consumes: `--slc-text-muted`, `--slc-text`, `--slc-accent`, `--slc-focus`. Do: mark the last item `aria-current="page"` and leave it as a `<span>` — the page you are on is not a link. Don't: import an icon for the separator; a glyph is one character and needs no asset.

### Button group — `sl-btn-group`
Joins `sl-btn` children into one control with a shared 1px rule. Built on the hairline-grid technique, so no rule is ever doubled (L2). Substrate: **R** IDE/App, **A** Page.
```html
<div class="sl-btn-group">
  <button class="sl-btn sl-btn--ghost">Audit</button>
  <button class="sl-btn sl-btn--ghost">Migrate</button>
  <button class="sl-btn sl-btn--ghost">Adopt</button>
</div>
```
Consumes: `--slc-border`. Do: use one variant across the group. Don't: mix `--primary` and `--ghost` inside one group — a group is one control, and two fills read as two.

### Segmented control — `sl-segmented` (`__item`)
A small set of mutually exclusive views. Mono uppercase items (L1). Substrate: **R** IDE/App, **A** Page.
```html
<div class="sl-segmented" role="tablist">
  <button class="sl-segmented__item" role="tab" aria-selected="true">Light</button>
  <button class="sl-segmented__item" role="tab" aria-selected="false">Dark</button>
  <button class="sl-segmented__item" role="tab" aria-selected="false">Contrast</button>
</div>
```
Consumes: `--slc-border`, `--slc-surface`, `--slc-raised`, `--slc-text-muted`, `--slc-text`, `--slc-focus`. Do: drive the selected state with `aria-selected` — the CSS reads it, so the accessible state and the visible state cannot drift apart. Don't: use it for more than about four options; that is a `select`.
````

- [ ] **Step 4: Write the CSS**

Append a new banner section to `packages/ui-kit/components.css`:

```css
/* ══ NAVIGATION & STATE ══════════════════════════════════════════════════════ */

.sl-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sl-space-2, 0.5rem);
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-xs, 0.75rem);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.sl-breadcrumb__item {
  color: var(--slc-text-muted);
  text-decoration: none;
  transition: color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}
a.sl-breadcrumb__item:hover { color: var(--slc-accent); }
.sl-breadcrumb__item[aria-current] { color: var(--slc-text); }
.sl-breadcrumb__sep { color: var(--slc-text-muted); opacity: 0.6; }

/* The hairline technique again: a 1px gap over the line colour is the rule
   between buttons, so no button carries a border on the joining edge and
   nothing doubles. */
.sl-btn-group {
  display: inline-flex;
  gap: 1px;
  background: var(--slc-border);
  border: 1px solid var(--slc-border);
  border-radius: var(--sl-radius-md, 6px);
  overflow: hidden;
}
.sl-btn-group > .sl-btn { border-radius: 0; border: none; }

.sl-segmented {
  display: inline-flex;
  gap: 1px;
  padding: 2px;
  background: var(--slc-surface);
  border: 1px solid var(--slc-border);
  border-radius: var(--sl-radius-md, 6px);
}
.sl-segmented__item {
  appearance: none;
  border: none;
  cursor: pointer;
  background: transparent;
  color: var(--slc-text-muted);
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-xs, 0.75rem);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: var(--sl-space-2, 0.5rem) var(--sl-space-4, 1rem);
  border-radius: var(--sl-radius-sm, 4px);
  transition:
    background-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}
.sl-segmented__item:hover { color: var(--slc-text); }
/* The CSS reads aria-selected, so the accessible state and the visible one
   cannot drift apart. */
.sl-segmented__item[aria-selected="true"] {
  background: var(--slc-raised);
  color: var(--slc-text);
}
```

- [ ] **Step 5: Add the focus-ring lines**

Add to the shared focus-ring selector list:

```css
.sl-segmented__item:focus-visible,
.sl-breadcrumb__item:focus-visible,
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 7: Add the showcase cell**

```html
          <div class="g-cell">
            <span class="g-label">breadcrumb · button group · segmented</span>
            <div class="g-demo" style="flex-direction:column;align-items:flex-start;gap:0.8rem">
              <nav class="sl-breadcrumb" aria-label="Breadcrumb">
                <a class="sl-breadcrumb__item" href="#">Specs</a>
                <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
                <a class="sl-breadcrumb__item" href="#">Design system</a>
                <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
                <span class="sl-breadcrumb__item" aria-current="page">Base element set</span>
              </nav>
              <div class="sl-btn-group">
                <button class="sl-btn sl-btn--ghost">Audit</button>
                <button class="sl-btn sl-btn--ghost">Migrate</button>
                <button class="sl-btn sl-btn--ghost">Adopt</button>
              </div>
              <div class="sl-segmented" role="tablist">
                <button class="sl-segmented__item" role="tab" aria-selected="true">Light</button>
                <button class="sl-segmented__item" role="tab" aria-selected="false">Dark</button>
                <button class="sl-segmented__item" role="tab" aria-selected="false">Contrast</button>
              </div>
            </div>
          </div>
```

- [ ] **Step 8: Check the joins**

Open the showcase and zoom to 200%. The rules inside the button group must be a single hairline, the same weight as the group's outer border. If a join reads as two pixels, a `.sl-btn` border survived the `border: none` — check that the `.sl-btn-group > .sl-btn` rule is after the `.sl-btn` rules in source order.

- [ ] **Step 9: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): a trail, a joined group, and a segmented control

All three are hairline structures: the group and the control are built
from a 1px gap over the line colour, so no rule is ever doubled. The
segmented item reads aria-selected, which keeps the visible state and
the accessible one from drifting apart."
```

---

## Task 9: Icon button and pagination

**Files:**
- Modify: `packages/ui-kit/components.css` (`NAVIGATION & STATE` section; focus-ring list)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Produces: `.sl-icon-btn`, `.sl-icon-btn--round`, `.sl-pagination`, `.sl-pagination__item`.

- [ ] **Step 1: Add the catalog.json entries**

```json
    {
      "id": "icon-button",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-icon-btn",
        "sl-icon-btn--round"
      ],
      "roleVars": [
        "--slc-border",
        "--slc-text",
        "--slc-accent",
        "--slc-focus"
      ]
    },
    {
      "id": "pagination",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-pagination",
        "sl-pagination__item"
      ],
      "roleVars": [
        "--slc-border",
        "--slc-text-muted",
        "--slc-text",
        "--slc-accent",
        "--slc-accent-subtle",
        "--slc-focus"
      ]
    },
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs`
Expected: FAIL on both.

- [ ] **Step 3: Write the catalog.md sections**

````markdown
### Icon button — `sl-icon-btn` (`--round`)
A square icon-only control. The kit ships no icon set: supply your own `<svg>` and let it inherit `currentColor`. Substrate: **R** IDE/App, **A** Page.
```html
<button class="sl-icon-btn" aria-label="Re-run the audit">
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 2v4M8 2 5 5M8 2l3 3" fill="none" stroke="currentColor" stroke-width="1.4"/>
  </svg>
</button>
<button class="sl-icon-btn sl-icon-btn--round sl-fx-liquid sl-fx-liquid--drop" aria-label="Add a product">
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.4"/>
  </svg>
</button>
```
Consumes: `--slc-border`, `--slc-text`, `--slc-accent`, `--slc-focus`. Do: give it an `aria-label` — an icon-only control has no accessible name otherwise. `--round` is the round silhouette the liquid's `--drop` is allowed on, and it is the **only** element in the kit that is: the author still writes `sl-fx-liquid sl-fx-liquid--drop`, because L6 makes the modifier in the markup the contract and forbids anything from measuring a radius to decide. Don't: use `--round` on a text button; the deformation belongs to a round silhouette.

### Pagination — `sl-pagination` (`__item`)
Numbered navigation across pages of results. Mono tabular figures (L1). Substrate: **R** App, **A** Page, **N/A** IDE.
```html
<nav class="sl-pagination" aria-label="Pagination">
  <a class="sl-pagination__item" href="?p=1">1</a>
  <a class="sl-pagination__item" href="?p=2" aria-current="page">2</a>
  <a class="sl-pagination__item" href="?p=3">3</a>
</nav>
```
Consumes: `--slc-border`, `--slc-text-muted`, `--slc-text`, `--slc-accent`, `--slc-accent-subtle`, `--slc-focus`. Do: mark the current page `aria-current="page"`. Don't: render a page count you have not measured — L5, structure encodes truth.
````

- [ ] **Step 4: Write the CSS**

Append to the `NAVIGATION & STATE` section:

```css
.sl-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  cursor: pointer;
  color: var(--slc-text);
  background: transparent;
  border: 1px solid var(--slc-border);
  border-radius: var(--sl-radius-md, 6px);
  transition:
    color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    border-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}
.sl-icon-btn:hover:not(:disabled) {
  color: var(--slc-accent);
  border-color: var(--slc-accent);
}
.sl-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
/* The round silhouette the liquid's --drop is allowed on. It does NOT apply
   the effect: L6 makes the modifier written in the markup the contract, and
   forbids anything from measuring a radius to decide. */
.sl-icon-btn--round { border-radius: 50%; }

.sl-pagination {
  display: flex;
  align-items: center;
  gap: var(--sl-space-1, 0.25rem);
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-xs, 0.75rem);
  font-variant-numeric: tabular-nums;
}
.sl-pagination__item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 var(--sl-space-2, 0.5rem);
  color: var(--slc-text-muted);
  text-decoration: none;
  border: 1px solid transparent;
  border-radius: var(--sl-radius-sm, 4px);
  transition:
    color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    border-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
}
.sl-pagination__item:hover { color: var(--slc-text); border-color: var(--slc-border); }
.sl-pagination__item[aria-current] {
  color: var(--slc-accent);
  background: var(--slc-accent-subtle);
  border-color: var(--slc-accent-subtle);
}
```

- [ ] **Step 5: Add the focus-ring lines**

```css
.sl-icon-btn:focus-visible,
.sl-pagination__item:focus-visible,
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/focus-ring.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 7: Add the showcase cell**

```html
          <div class="g-cell">
            <span class="g-label">icon button · pagination</span>
            <div class="g-demo" style="flex-direction:column;align-items:flex-start;gap:0.8rem">
              <div style="display:flex;gap:0.5rem">
                <button class="sl-icon-btn" aria-label="Re-run the audit">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3" fill="none" stroke="currentColor" stroke-width="1.3"/>
                  </svg>
                </button>
                <button class="sl-icon-btn sl-icon-btn--round" aria-label="Add a product">
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.4"/>
                  </svg>
                </button>
                <button class="sl-icon-btn" aria-label="Unavailable" disabled>
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.4"/>
                  </svg>
                </button>
              </div>
              <nav class="sl-pagination" aria-label="Pagination">
                <a class="sl-pagination__item" href="#">1</a>
                <a class="sl-pagination__item" href="#" aria-current="page">2</a>
                <a class="sl-pagination__item" href="#">3</a>
                <a class="sl-pagination__item" href="#">4</a>
              </nav>
            </div>
          </div>
```

- [ ] **Step 8: Record the pagination truncation ruling**

The spec left open whether `.sl-pagination` needs an ellipsis item. **Ruling: it does not, in this pass.** A truncated range is a product decision (how many neighbours to show, whether to jump), and an `__ellipsis` class that renders a `…` adds a class for one character the caller can write as a `<span class="sl-pagination__item" aria-hidden="true">…</span>`. Record this in the Rulings section at the bottom of this file.

- [ ] **Step 9: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md docs/plans/2026-09-14-base-element-set.md showcase/index.html
git commit -m "feat(ui-kit): an icon button and a pagination

--round is the one round silhouette in the kit, which is what the
liquid's --drop needs -- and it still does not apply it: L6 makes the
modifier in the markup the contract and forbids measuring a radius to
decide."
```

---

## Task 10: Empty state, skeleton, stat

**Files:**
- Modify: `packages/ui-kit/components.css` (`NAVIGATION & STATE` section)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Consumes: `.sl-eyebrow` (already shipped) — the empty state composes it rather than restyling a label.
- Produces: `.sl-empty` / `__title` / `__body`, `.sl-skeleton`, `.sl-stat` / `__value` / `__label`.

- [ ] **Step 1: Add the catalog.json entries**

```json
    {
      "id": "empty-state",
      "kind": "primitive",
      "classes": [
        "sl-empty",
        "sl-empty__title",
        "sl-empty__body"
      ],
      "roleVars": [
        "--slc-border",
        "--slc-text",
        "--slc-text-secondary"
      ]
    },
    {
      "id": "skeleton",
      "kind": "primitive",
      "classes": [
        "sl-skeleton"
      ],
      "roleVars": [
        "--slc-text"
      ]
    },
    {
      "id": "stat",
      "kind": "primitive",
      "classes": [
        "sl-stat",
        "sl-stat__value",
        "sl-stat__label"
      ],
      "roleVars": [
        "--slc-text",
        "--slc-text-muted"
      ]
    },
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: FAIL on all three ids.

- [ ] **Step 3: Write the catalog.md sections**

````markdown
### Empty state — `sl-empty` (`__title` · `__body`)
What a surface shows where its content would be. Composes `sl-eyebrow` above the title. Substrate: **R** App, **A** IDE/Page.
```html
<div class="sl-empty">
  <span class="sl-eyebrow">No findings</span>
  <p class="sl-empty__title">The audit found nothing to report.</p>
  <p class="sl-empty__body">4 surfaces read, 0 R-violations, 0 blessed deviations.</p>
</div>
```
Consumes: `--slc-border`, `--slc-text`, `--slc-text-secondary`. Do: say what is absent and what was actually measured — L5 prefers a real figure to an adjective. Don't: write "Nothing here yet!"; the exclamation mark is the marketing voice this house does not use.

### Skeleton — `sl-skeleton`
A placeholder block for content that has not arrived. **Static** — it does not shimmer. Substrate: **R** App, **A** IDE/Page.
```html
<div class="sl-skeleton" style="height: 1rem; width: 60%"></div>
```
Consumes: `--slc-text`. Do: size it to the content it stands in for, and give the block `aria-hidden="true"` with the real loading state carried by the container's `aria-busy`. Don't: animate it. A shimmer is ambient motion that means nothing, and L6 switches off an effect that means nothing — the same rule that forbids an ambient glitch on a control. Where a surface genuinely needs to say *work is running*, that is the aurora's `busy` reading, bound to `aria-busy`.

### Stat — `sl-stat` (`__value` · `__label`)
A single measured figure with its caption. Substrate: **R** App/Page, **N/A** IDE.
```html
<div class="sl-stat">
  <span class="sl-stat__value">268</span>
  <span class="sl-stat__label">Tests green</span>
</div>
```
Consumes: `--slc-text`, `--slc-text-muted`. Do: keep the value in the mono face whatever its size — a display-scale numeral is a structural label and stays mono (L1; owner's ruling, 2026-09-13, after Fraunces at `opsz` 144 was tried and rejected). Don't: set a stat you have not measured.
````

- [ ] **Step 4: Write the CSS**

Append to the `NAVIGATION & STATE` section:

```css
.sl-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sl-space-2, 0.5rem);
  padding: var(--sl-space-6, 2rem) var(--sl-space-5, 1.5rem);
  border: 1px dashed var(--slc-border);
  border-radius: var(--sl-radius-md, 6px);
}
.sl-empty__title {
  margin: 0;
  font-family: var(--sl-font-sans, system-ui, sans-serif);
  font-size: var(--sl-text-md, 1rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--slc-text);
}
.sl-empty__body {
  margin: 0;
  font-family: var(--sl-font-sans, system-ui, sans-serif);
  font-size: var(--sl-text-sm, 0.875rem);
  line-height: var(--sl-line-normal, 1.5);
  color: var(--slc-text-secondary);
}

/* STATIC. A shimmer is ambient motion that means nothing, and L6 switches off
   an effect that means nothing. Where a surface needs to say work is running,
   that is the aurora's busy reading, bound to aria-busy. */
.sl-skeleton {
  background: color-mix(in srgb, var(--slc-text) 8%, transparent);
  border-radius: var(--sl-radius-sm, 4px);
}

.sl-stat {
  display: flex;
  flex-direction: column;
  gap: var(--sl-space-1, 0.25rem);
}
/* Mono at every size: a display-scale numeral is a structural label (L1). */
.sl-stat__value {
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-2xl, 2rem);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  color: var(--slc-text);
}
.sl-stat__label {
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-xs, 0.75rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--slc-text-muted);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 6: Add the showcase cell**

```html
          <div class="g-cell">
            <span class="g-label">empty state · skeleton · stat</span>
            <div class="g-demo" style="flex-direction:column;align-items:stretch;gap:0.9rem">
              <div class="sl-empty">
                <span class="sl-eyebrow">No findings</span>
                <p class="sl-empty__title">The audit found nothing to report.</p>
                <p class="sl-empty__body">4 surfaces read, 0 R-violations, 0 blessed deviations.</p>
              </div>
              <div aria-busy="true" style="display:flex;flex-direction:column;gap:0.4rem">
                <div class="sl-skeleton" style="height:0.75rem;width:40%" aria-hidden="true"></div>
                <div class="sl-skeleton" style="height:0.75rem;width:75%" aria-hidden="true"></div>
                <div class="sl-skeleton" style="height:0.75rem;width:60%" aria-hidden="true"></div>
              </div>
              <div style="display:flex;gap:2rem">
                <div class="sl-stat">
                  <span class="sl-stat__value">268</span>
                  <span class="sl-stat__label">Tests green</span>
                </div>
                <div class="sl-stat">
                  <span class="sl-stat__value">0</span>
                  <span class="sl-stat__label">R findings</span>
                </div>
              </div>
            </div>
          </div>
```

- [ ] **Step 7: Confirm the skeleton reads on all three grounds**

`color-mix(--slc-text 8%)` is a tint of the foreground, so it inverts with the theme automatically. Open the showcase in light, dark and high-contrast and confirm the blocks are visible but quieter than the text beside them. If they vanish in high-contrast, raise the percentage — do not switch to a border.

- [ ] **Step 8: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): an empty state, a static skeleton, and a stat in mono

The skeleton does not shimmer: ambient motion that means nothing is
switched off (L6). The stat's value keeps the mono face at display size
-- a display-scale numeral is a structural label, not a folio."
```

---

## Task 11: Wordmark, lockup, monogram

**Files:**
- Modify: `packages/ui-kit/components.css` (new `IDENTITY & MEDIA` banner section)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Produces: `.sl-wordmark` / `__dot`, `.sl-lockup` / `__dot`, `.sl-monogram`.

**Before starting:** read `packages/ui-kit/assets/sondalab-wordmark.svg`, `sondalab-lockup.svg` and `sondalab-avatar-ink.svg`. Those assets are the published identity. Where the CSS you write and the asset disagree, **the asset is right** and the CSS is the defect.

- [ ] **Step 1: Add the catalog.json entries**

```json
    {
      "id": "wordmark",
      "kind": "signature",
      "classes": [
        "sl-wordmark",
        "sl-wordmark__dot"
      ],
      "roleVars": [
        "--slc-text",
        "--slc-accent"
      ]
    },
    {
      "id": "lockup",
      "kind": "signature",
      "classes": [
        "sl-lockup",
        "sl-lockup__dot"
      ],
      "roleVars": [
        "--slc-text",
        "--slc-accent"
      ]
    },
    {
      "id": "monogram",
      "kind": "signature",
      "classes": [
        "sl-monogram"
      ],
      "roleVars": [
        "--slc-text",
        "--slc-accent",
        "--slc-surface"
      ]
    },
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: FAIL on all three ids.

- [ ] **Step 3: Write the catalog.md sections**

Insert a `## Identity & media` heading, then:

````markdown
### Wordmark — `sl-wordmark` (`__dot`)
The official logo. The brand is typographic; there is no pictorial mark. `sondalab.` in the display face at weight 500, tracked `-0.05em`, the trailing period in the accent. Substrate: **R** App/Page, **A** IDE.
```html
<span class="sl-wordmark">sondalab<span class="sl-wordmark__dot">.</span></span>
```
Consumes: `--slc-text`, `--slc-accent`. Source of truth: `packages/ui-kit/assets/sondalab-wordmark.svg`. Do: let it inherit its size from context — it is type, so it scales with `font-size`. Don't: re-letter it, re-space it, or set the period in the text colour; the accent period is the mark.

### Compact lockup — `sl-lockup` (`__dot`)
The wordmark where the wordmark is too wide: headers, tight chrome. `sonda·lab` in the mono face, uppercase, tracked `0.2em`, the middle dot in the accent. Substrate: **R** IDE/App/Page.
```html
<span class="sl-lockup">sonda<span class="sl-lockup__dot">·</span>lab</span>
```
Consumes: `--slc-text`, `--slc-accent`. Source of truth: `packages/ui-kit/assets/sondalab-lockup.svg`. Do: use this one in a `sl-header`. Don't: mix the two marks on one surface.

### Monogram — `sl-monogram`
Where even the lockup is too wide to read: a social avatar, a square tile. `s.` in the display cut, the letter in the text colour and the period in the accent, on a full-bleed square of the surface. Substrate: **R** IDE/App/Page.
```html
<span class="sl-monogram" role="img" aria-label="Sondalab">s.</span>
```
Consumes: `--slc-text`, `--slc-accent`, `--slc-surface`. Rendered assets: `packages/ui-kit/assets/sondalab-avatar-{ink,paper}.{svg,png}`. Three corrections are fixed in `design-language.md` L3 and are transcribed here, not re-derived: the mark is sized to the inscribed crop circle (~60% of the canvas wide) rather than the square; the accent period is scaled +35% around its own centre so it survives a 32px render; and it is pushed +0.06em off the letter, because the wordmark's tight tracking is drawn for a period at its natural size. Do: give it `role="img"` and a label — `s.` read aloud is not the brand. Don't: re-tune the three corrections per surface; they are what makes the small end legible.
````

- [ ] **Step 4: Write the CSS**

Append a new banner section:

```css
/* ══ IDENTITY & MEDIA ════════════════════════════════════════════════════════ */

/* The brand is typographic — there is no pictorial mark. These three classes
   must render identically to packages/ui-kit/assets/sondalab-*.svg; where they
   disagree, the asset is right and the CSS is the defect. */
.sl-wordmark {
  font-family: var(--sl-font-display, Georgia, serif);
  font-weight: 500;
  letter-spacing: -0.05em;
  color: var(--slc-text);
}
.sl-wordmark__dot { color: var(--slc-accent); }

.sl-lockup {
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-xs, 0.75rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--slc-text);
}
.sl-lockup__dot { color: var(--slc-accent); }

/* Three corrections, all for the small end of the scale (design-language L3):
   the mark is sized to the INSCRIBED CROP CIRCLE (~60% of the canvas wide),
   not the square; the accent period is scaled +35% around its own centre so it
   survives a 32px render; and it is pushed +0.06em off the letter, because the
   wordmark's tight tracking is drawn for a period at its natural size. */
.sl-monogram {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  width: 3rem;
  background: var(--slc-surface);
  font-family: var(--sl-font-display, Georgia, serif);
  font-weight: 500;
  font-size: 60%;
  letter-spacing: -0.05em;
  line-height: 1;
  color: var(--slc-text);
}
.sl-monogram::after {
  content: ".";
  color: var(--slc-accent);
  font-size: 1.35em;
  margin-left: 0.06em;
  line-height: 0;
}
```

**Note on the markup:** the `.` in the example markup above is decorative to the eye but is drawn by `::after` here, so the class expects the letter alone. Write the markup as `<span class="sl-monogram" role="img" aria-label="Sondalab">s</span>` and update the `catalog.md` snippet in Step 3 to match before committing — the snippet and the CSS must agree, or the first adopter gets two periods.

- [ ] **Step 5: Reconcile the snippet with the CSS**

Change the monogram snippet in `catalog.md` to:

```html
<span class="sl-monogram" role="img" aria-label="Sondalab">s</span>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 7: Compare against the published assets**

Open `packages/ui-kit/assets/sondalab-wordmark.svg` and the showcase side by side at the same rendered size. The letterforms, the tracking and the period's position must match. Then shrink the monogram to 32px and confirm the period is still legible — that is what the +35% correction is for. **If the CSS and the asset disagree, change the CSS.**

- [ ] **Step 8: Add the showcase cell**

```html
          <div class="g-cell">
            <span class="g-label">wordmark · lockup · monogram</span>
            <div class="g-demo" style="flex-direction:column;align-items:flex-start;gap:0.9rem">
              <span class="sl-wordmark" style="font-size:2rem">sondalab<span class="sl-wordmark__dot">.</span></span>
              <span class="sl-lockup">sonda<span class="sl-lockup__dot">·</span>lab</span>
              <div style="display:flex;align-items:center;gap:0.8rem">
                <span class="sl-monogram" role="img" aria-label="Sondalab">s</span>
                <span class="sl-monogram" role="img" aria-label="Sondalab" style="width:2rem">s</span>
              </div>
            </div>
          </div>
```

- [ ] **Step 9: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md showcase/index.html
git commit -m "feat(ui-kit): the mark, the lockup and the monogram as classes

They existed as SVG assets and as bespoke CSS inside the showcase. The
assets stay the source of truth: where these classes and the published
SVG disagree, the SVG is right.

The monogram's three corrections are transcribed from L3, not
re-derived -- inscribed crop circle, period at +35%, offset +0.06em."
```

---

## Task 12: Figure and avatar

**Files:**
- Modify: `packages/ui-kit/components.css` (`IDENTITY & MEDIA` section)
- Modify: `packages/ui-kit/agent/catalog.json`
- Modify: `packages/ui-kit/agent/catalog.md`
- Modify: `showcase/index.html`

**Interfaces:**
- Consumes: `.sl-monogram` from Task 11 — the avatar's fallback is the monogram, not a second mark.
- Produces: `.sl-figure` / `__media` / `__caption`, `.sl-avatar` / `--sm` / `--lg`.

- [ ] **Step 1: Add the catalog.json entries**

```json
    {
      "id": "figure",
      "kind": "primitive",
      "classes": [
        "sl-figure",
        "sl-figure__media",
        "sl-figure__caption"
      ],
      "roleVars": [
        "--slc-border",
        "--slc-surface",
        "--slc-text-muted"
      ]
    },
    {
      "id": "avatar",
      "kind": "primitive",
      "classes": [
        "sl-avatar",
        "sl-avatar--sm",
        "sl-avatar--lg"
      ],
      "roleVars": [
        "--slc-surface",
        "--slc-border"
      ]
    },
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/catalog-audit.test.mjs`
Expected: FAIL on both ids.

- [ ] **Step 3: Write the catalog.md sections**

````markdown
### Figure — `sl-figure` (`__media` · `__caption`)
An image in a hairline frame with a mono caption. The house way to put a picture in a page without it reading as a blog post. Substrate: **R** Page, **A** App, **N/A** IDE.
```html
<figure class="sl-figure">
  <div class="sl-figure__media" style="aspect-ratio: 16 / 9">
    <img src="/contact-1k.jpg" alt="Glass pane, GPU tier, dark theme">
  </div>
  <figcaption class="sl-figure__caption">Contact 1k — the GPU glass pane</figcaption>
</figure>
```
Consumes: `--slc-border`, `--slc-surface`, `--slc-text-muted`. Do: declare the `aspect-ratio` on `__media` yourself — the class sets none, because the right ratio is a property of the image and not of the design system. Don't: let the caption run to sentence case in the sans face; a caption is a structural label (L1).

### Avatar — `sl-avatar` (`--sm` · `--lg`)
A person or a product, as a square tile. Falls back to `sl-monogram` when there is no image. Substrate: **R** IDE/App, **A** Page.
```html
<span class="sl-avatar"><img src="/avatar.png" alt=""></span>
<span class="sl-avatar sl-avatar--sm"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
```
Consumes: `--slc-surface`, `--slc-border`. Do: use the monogram as the fallback rather than initials in a circle — the monogram is the mark, and it already carries the three small-size corrections. Don't: give a decorative avatar alt text; `alt=""` is correct when the name is beside it.
````

- [ ] **Step 4: Write the CSS**

Append to the `IDENTITY & MEDIA` section:

```css
.sl-figure { margin: 0; }
/* No aspect-ratio default: the right ratio is a property of the image, not of
   the design system. The author declares it on this element. */
.sl-figure__media {
  overflow: hidden;
  background: var(--slc-surface);
  border: 1px solid var(--slc-border);
  border-radius: var(--sl-radius-md, 6px);
}
.sl-figure__media > img,
.sl-figure__media > video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sl-figure__caption {
  margin-top: var(--sl-space-2, 0.5rem);
  font-family: var(--sl-font-mono, ui-monospace, monospace);
  font-size: var(--sl-text-xs, 0.75rem);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--slc-text-muted);
}

.sl-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 2.5rem;
  aspect-ratio: 1;
  background: var(--slc-surface);
  border: 1px solid var(--slc-border);
  border-radius: var(--sl-radius-md, 6px);
}
.sl-avatar > img { width: 100%; height: 100%; object-fit: cover; }
/* The fallback IS the monogram — it already carries the small-size
   corrections, so it sheds its own tile and fills this one. */
.sl-avatar > .sl-monogram { width: 100%; background: transparent; }
.sl-avatar--sm { width: 1.75rem; }
.sl-avatar--lg { width: 4rem; }
```

- [ ] **Step 5: Record the figure aspect-ratio ruling**

The spec left this open. **Ruling: `.sl-figure__media` declares no default `aspect-ratio`.** A default would be wrong for most images and would silently crop them; the caller declares it inline, as the catalog snippet shows. Record it in the Rulings section at the bottom of this file.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test scripts/catalog-audit.test.mjs scripts/components-token-scope.test.mjs`
Expected: PASS.

- [ ] **Step 7: Add the showcase cell**

Reuse an image the repo already ships so the cell is real content, not filler (L5, real-content blocks):

```html
          <div class="g-cell">
            <span class="g-label">figure · avatar</span>
            <div class="g-demo" style="flex-direction:column;align-items:flex-start;gap:0.9rem">
              <figure class="sl-figure" style="max-width:18rem">
                <div class="sl-figure__media" style="aspect-ratio:16/9">
                  <img src="../docs/slices/1-buttons/promoted-showcase-dark.png" alt="The button slice, dark theme">
                </div>
                <figcaption class="sl-figure__caption">Slice 1 — promoted showcase, dark</figcaption>
              </figure>
              <div style="display:flex;align-items:center;gap:0.6rem">
                <span class="sl-avatar sl-avatar--sm"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
                <span class="sl-avatar"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
                <span class="sl-avatar sl-avatar--lg"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
              </div>
            </div>
          </div>
```

- [ ] **Step 8: Confirm the monogram scales inside all three avatar sizes**

The monogram sizes its letter at `60%` of its own font-size and the avatar does not set one, so the letter inherits from context. Check all three sizes render a centred, proportionate `s.` — if the small one looks oversized, give `.sl-avatar > .sl-monogram` a `font-size: 100%` and set the face size on `.sl-avatar` per modifier. Record whichever you do.

- [ ] **Step 9: Run the full suite and commit**

```bash
git add packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md docs/plans/2026-09-14-base-element-set.md showcase/index.html
git commit -m "feat(ui-kit): a framed figure and an avatar that falls back to the mark

__media declares no aspect-ratio: the right one is a property of the
image, and a default would silently crop most of them.

The avatar's fallback is the monogram rather than initials -- it is the
mark, and it already carries the three small-size corrections."
```

---

## Task 13: `compositions.css`

**Files:**
- Create: `packages/ui-kit/compositions.css`
- Modify: `packages/ui-kit/package.json` (`exports`, `files`)
- Modify: `packages/ui-kit/agent/catalog.md` (canonical effect strings)
- Modify: `packages/ui-kit/agent/catalog.json`

**Interfaces:**
- Consumes: `.sl-invert` from Task 6; the `--slfx-*` knob names documented in `packages/ui-kit/README.md` §Effects.
- Produces: `packages/ui-kit/compositions.css` and the `@sondalab/ui-kit/compositions.css` export.

**Why this file holds bindings and not alias classes:** plain CSS cannot alias a class. Making `.sl-fx-glass` also match a composed form needs `:is()` on all 58 of its selector lines, and `:is()` takes the specificity of its most specific argument — silently raising every glass rule from (0,1,0) to (0,2,0) across a released layer. A JavaScript pass that stamps the classes instead dies on the first React or Theia re-render that touches `className`. And the per-component binding **already exists** in `effects.css:574-587` and `:788-815`. What a product lacks is knowledge of what to type, which is documentation — so this task ships the bindings that genuinely have nowhere else to live, and puts the canonical strings in the catalog.

- [ ] **Step 1: Write the file**

Create `packages/ui-kit/compositions.css`:

```css
/* @sondalab/ui-kit — compositions.css
   Hand-authored (NOT generated). Opt-in, imported AFTER effects.css.

   What this file is: the custom-property bindings a composition needs, which
   have no other home. It contains NO paint and no new class. Without
   effects.css it is inert — nothing else reads these properties.

   What it is deliberately NOT: alias classes for the effect declension. Plain
   CSS cannot alias a class; the :is() route would raise every glass rule from
   (0,1,0) to (0,2,0) across a released layer, and a JavaScript pass that stamps
   classes is dropped by the first React or Theia re-render. The declension
   itself already lives in effects.css, per component. The canonical class
   string per component is documented in agent/catalog.md. */

/* Inside an inversion band --slc-text IS the band's ground, so a glass-text
   host lit by it would be lit by its own background. The band's foreground is
   the light there. All three are read with var(--name, default) at the point of
   use in effects.css, so binding them here reaches every descendant. */
.sl-invert {
  --slfx-text-light:  var(--slc-canvas);
  --slfx-text-core-a: 46%;
  --slfx-text-halo-a: 26%;
}

/* A pane inside an element that scales composes two scales, and the pane's
   seated light spills past its edge. Shipped wrappers that scale their
   contents stand the inner swell down. */
.sl-avatar,
.sl-figure__media { --slfx-pane-swell: 1; }
```

- [ ] **Step 2: Add the export and the files entry**

In `packages/ui-kit/package.json`, add to `exports` immediately after the `"./components.css"` line:

```json
    "./compositions.css": "./compositions.css",
```

and to `files`, immediately after `"components.css"`:

```json
    "compositions.css",
```

- [ ] **Step 3: Run the module-shipping test**

Run: `node --test scripts/types-drift.test.mjs`
Expected: PASS — `every declared module is shipped and resolvable` must still hold with the new entry.

- [ ] **Step 4: Audit the new file**

Run: `node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/compositions.css" --product default`
Expected: no `R` findings. The file declares only custom properties whose values are role-vars and percentages, so there is nothing to flag.

- [ ] **Step 5: Add the canonical effect strings to catalog.md**

In `packages/ui-kit/agent/catalog.md`, add to the `## Effects` section intro:

```markdown
**Canonical strings.** The declension below is already bound per component inside `effects.css` — a product importing it does not re-derive which family goes where. What it needs is the string to write. These are the canonical ones; `compositions.css` (opt-in, imported after `effects.css`) carries the bindings that have no other home.

| Component | Canonical string |
|---|---|
| Text button, any variant | `sl-btn sl-btn--primary sl-fx-glass sl-fx-glass--pane` |
| Field / select wrapper | `sl-field__control sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field` |
| Selected tab | `sl-tabs__tab sl-fx-aurora sl-fx-aurora--linear` |
| Round icon button | `sl-icon-btn sl-icon-btn--round sl-fx-liquid sl-fx-liquid--drop` |

Four families are **not** in that table, and must not be applied by rote: **goo** needs a declared container and a weld gap, both properties of a layout the author owns; **glitch** is fired from JavaScript on a real event; the **ambient, busy and determinate aurora** readings are budget-limited and bound to an ARIA contract (`aria-busy`, `role="progressbar"` with `aria-valuenow`) — the aurora renders state, it never *is* the state.
```

- [ ] **Step 6: Add the compositions entry to catalog.json**

```json
    {
      "id": "compositions",
      "kind": "effect",
      "classes": [],
      "roleVars": []
    },
```

`classes: []` makes it a signature-style entry, matched by its id word appearing in `catalog.md` — which Step 5 satisfies.

- [ ] **Step 7: Run the full suite**

Run: `node --test scripts/*.test.mjs`
Expected: 0 fail. `scripts/catalog-audit.test.mjs` re-checks every snippet in the file, including the new table's strings.

- [ ] **Step 8: Commit**

```bash
git add packages/ui-kit/compositions.css packages/ui-kit/package.json packages/ui-kit/agent/catalog.md packages/ui-kit/agent/catalog.json
git commit -m "feat(ui-kit): the bindings a composition needs, and the strings to type

Not alias classes: plain CSS cannot alias a class, the :is() route
would raise every glass rule a specificity step across a released
layer, and a JS pass that stamps classes dies on the first React
re-render. The declension already lives in effects.css per component --
what was missing was knowing what to write, so the canonical strings go
in the catalog and the homeless bindings go here."
```

---

## Task 14: README, version, and the final sweep

**Files:**
- Modify: `packages/ui-kit/README.md`
- Modify: `packages/ui-kit/package.json` (version)
- Modify: `README.md` (repo root — the design-principles section)

**Interfaces:**
- Consumes: everything from Tasks 1–13.

- [ ] **Step 1: Add `--slc-canvas` to the Tier B mapping recipe**

In `packages/ui-kit/README.md`, in the `:root { … }` block under "Colour contract — role-vars", add as the first line of the surfaces group:

```css
  --slc-canvas:         var(--your-canvas);        /* the page ground, below surface */
```

- [ ] **Step 2: Update the component lists**

Replace the "Components (`components.css`)" prose with:

```markdown
## Components (`components.css`)

Primitives: `.sl-eyebrow`, `.sl-tag` (`--plain`), `.sl-btn` (`--primary` / `--ghost` / `--sm`), `.sl-card` (`__title` / `__body`), `.sl-badge` (`--success` / `--warning` / `--danger` / `--info`), `.sl-field` (`__label` / `__input` / `__control`), `.sl-kbd`, `.sl-code`, `.sl-link`, `.sl-rule` (`--labeled`).

Form controls: `.sl-check`, `.sl-radio`, `.sl-switch` (each `__input` / `__box`-or-`__track` / `__label`), `.sl-select` (a wrapper on `.sl-field__control`).

Navigation & state: `.sl-breadcrumb` (`__item` / `__sep`), `.sl-btn-group`, `.sl-segmented` (`__item`), `.sl-icon-btn` (`--round`), `.sl-pagination` (`__item`), `.sl-empty` (`__title` / `__body`), `.sl-skeleton`, `.sl-stat` (`__value` / `__label`).

Identity & media: `.sl-wordmark` (`__dot`), `.sl-lockup` (`__dot`), `.sl-monogram`, `.sl-figure` (`__media` / `__caption`), `.sl-avatar` (`--sm` / `--lg`).

Patterns (page-level composition, shipped since 0.10.0): `.sl-wrap`, `.sl-prose`, `.sl-header`, `.sl-invert`, `.sl-hgrid`, `.sl-section` (`__head` / `__idx`), `.sl-anchor`.

Complex (composed shells — no behaviour JS; the consumer wires interaction): `.sl-callout` (`--success`/`--warning`/`--danger`/`--info`), `.sl-table` (`--numeric`; wrap in an `overflow-x:auto` container), `.sl-dialog` (visual shell for the native `<dialog>` — drive with `.showModal()`/`.close()`), `.sl-tabs` (`__list`/`__tab` — supply your own ARIA + panel switching), `.sl-tooltip` (CSS-only via `data-sl-tooltip`).
```

- [ ] **Step 3: Document `compositions.css` in the README's import block**

Add after the `components.css` line in the opening `@import` example:

```css
@import "@sondalab/ui-kit/compositions.css"; /* optional, AFTER effects.css — bindings only */
```

and add one paragraph under the Effects section:

```markdown
**Compositions.** `compositions.css` is an optional stylesheet carrying the custom-property bindings a composition needs — the inversion band's light, and the pane-swell stand-down on wrappers that scale their contents. It contains no paint and no new class, and is inert without `effects.css`. The canonical class string per component lives in `agent/catalog.md` § Effects.
```

- [ ] **Step 4: Update the inversion-band note**

The README's "Inversion bands" paragraph tells the consumer to write the `--slc-border` re-derivation themselves. Replace it with:

```markdown
**Inversion bands.** `.sl-invert` ships the fix: inside a band whose background is the strongest neutral, `--slc-border`'s alpha-over-canvas value sits on the wrong ground and the hairline disappears, so the class re-derives `--slc-border`, `--slc-border-subtle` and the three text role-vars from the band's own foreground, on its children. Any bordered component placed inside — card, table, field, callout, checkbox, switch — keeps a visible edge with no work from you. A product rolling its own band does the same thing by hand:

```css
.invert > * { --slc-border: color-mix(in srgb, currentColor 22%, transparent); }
```
```

- [ ] **Step 5: Bump the version**

In `packages/ui-kit/package.json`, set `"version": "0.10.0"`.

Confirm `packages/palette-py/pyproject.toml` is **unchanged**: run `git diff --stat main -- packages/palette-py` and expect empty output. The dual-bump rule in `AGENTS.md` binds changes to `sondalab.tokens.json`; this branch changes none.

- [ ] **Step 6: Confirm the version is not already live**

Run: `curl -sS -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/@sondalab%2Fui-kit/0.10.0`
Expected: `404`.

- [ ] **Step 7: Confirm no generated file drifted**

Run: `npm run gen:tokens && git status --porcelain`
Expected: no changes to `packages/ui-kit/tokens.css`, `packages/ui-kit/themes/*.css`, `packages/palette-py/sondalab_palette/__init__.py`, or `packages/ui-kit/agent/design-language.md`. If `agent/design-language.md` changed, a task edited `docs/design-language.md` — commit both together or revert the doc edit.

- [ ] **Step 8: Run everything**

```bash
node --test scripts/*.test.mjs
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/components.css" --product default
node packages/ui-kit/agent/sl-audit.mjs --surface "packages/ui-kit/compositions.css" --product default
```

Expected: 0 test failures; no `R` findings from either audit.

- [ ] **Step 9: Walk the acceptance criteria**

Open `docs/specs/2026-09-14-base-element-set.md` § Acceptance criteria and check all nine by hand. Criterion 7 (three themes) and criterion 8 (Tier 0: every element correct with `components.css` alone) are the two nothing automated covers — for criterion 8, open the showcase with the `effects.css` and `effects.js` tags commented out and confirm nothing is missing or broken.

- [ ] **Step 10: Commit**

```bash
git add packages/ui-kit/README.md packages/ui-kit/package.json README.md
git commit -m "docs(ui-kit): the kit is a design system now, and says so — 0.10.0

Form controls, the patterns as shipped classes, navigation and state,
identity and media. One role-var added (--slc-canvas), no token added,
palette-py untouched: the dual-bump rule binds changes to the token
source, and this branch changes none."
```

---

## Rulings

Decisions made during implementation that the spec left open or that a reviewer would otherwise re-litigate. Append here as they are made; the task that makes each one says so in its steps.

- *(Task 9)* **Pagination has no ellipsis class.** A truncated range is a product decision — how many neighbours to show, whether to offer a jump — and a class for one character is not worth the API. The caller writes `<span class="sl-pagination__item" aria-hidden="true">…</span>`.
- *(Task 12)* **`.sl-figure__media` declares no default `aspect-ratio`.** A default would be wrong for most images and would silently crop them. The caller declares it, as the catalog snippet shows.

## Self-review notes

Checked against the spec on 2026-09-14:

- **Spec coverage.** Every element in the spec's four element-set tables has a task: Slice 1 → Tasks 2-4, Slice 2 → Tasks 5-7, Slice 3 → Tasks 8-10, Slice 4 → Tasks 11-12, Slice 5 → Task 13. Both new tests from the spec's Testing section → Task 1. Release → Task 14. The two open questions → resolved in Tasks 9 and 12, recorded under Rulings.
- **Type consistency.** Class names were cross-checked between `catalog.json` entries, `catalog.md` snippets, the CSS, and the showcase markup in every task. `.sl-check__box` / `.sl-radio__box` / `.sl-switch__track` are the three different third-part names, and each task's focus-ring line uses the right one.
- **Known follow-up, not in this plan.** `.sl-tooltip` is shipped in `components.css` but has no `catalog.json` entry — a pre-existing gap, unrelated to this work. Worth a separate change so the catalog is complete.
