# Gummy Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every kit control gives a little under the finger and springs back (the owner's "Quiet" strength), and the kit gains a slider (`sl-slider`) whose thumb grows when grabbed. Shipped as `@sondalab/ui-kit` 0.25.0 and rolled out to every product.

**Architecture:**
- CSS only, in `packages/ui-kit/components.css`, transform-only transitions on `:active`. The press goes down on `--sl-motion-fast`/`--sl-motion-ease` and returns on `--sl-motion-slow`/`--sl-motion-spring`, the existing token.
- There are no keyframes, so nothing plays on page load, and reduced motion stops everything through the zeroed motion tokens.
- The effects layer's `sl-fx-press` sink is aligned to the same squash.

**Tech Stack:** plain CSS (relative colour `oklch(from …)`, `:has()`), `node:test` for guards, headless Chrome for visual checks.

**Spec:** `docs/specs/2026-09-30-gummy-controls-design.md`, approved 2026-09-30. Throwaway probe: `lab/gummy.html` in the main checkout, "Quiet — final" column.

## Global Constraints

- Squash while held: `transform: scale(1.02, 0.968)`, for buttons (every variant), `sl-icon-btn`, `sl-chip`, `sl-segmented__item` and `sl-pagination__item`.
- Down: `var(--sl-motion-fast, 120ms)` + `var(--sl-motion-ease, ease)`. Back: `var(--sl-motion-slow, 360ms)` + `var(--sl-motion-spring, var(--sl-motion-ease, ease))`.
- **No new token.** No `@keyframes`, no `animation` in any new rule, and no literal duration.
- Switch knob held: width `0.75rem → 0.825rem`, rounded ends (`border-radius: 999px`). When checked it grows leftward: `translateX(0.775rem)` instead of `0.85rem`.
- Check/radio box held: `scale(0.96)`.
- Slider thumb:
  - size 1.1rem;
  - fill `oklch(from var(--slc-canvas) max(l, 1 - l) 0 h)`;
  - edge `oklch(from <thumb> calc(l - var(--slc-shade-step) * 3) 0 h)`, plus `--slc-shadow-sm`;
  - hover `scale(1.1)`, grabbed `scale(1.35, 1.22)`.
- Slider track: 4px pill, `color-mix(in srgb, var(--slc-text) 12%, transparent)`. The fill is `--slc-accent`; in Chromium and Safari it is sized by the consumer-written `--sl-slider-value`, and in Firefox it is `::-moz-range-progress`.
- Disabled controls never move.
- Release: `@sondalab/ui-kit` **0.25.0** only. palette-py does not move, because no token changes.
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and use full URLs.

## Review Focus

1. **One engine's pseudo-element in a selector list drops the whole rule in the other engine.** For example, `::-webkit-slider-thumb, ::-moz-range-thumb` in one rule is ignored everywhere, and if it were put into the shared focus-ring list it would kill every focus ring in Firefox. So every `-webkit-`/`-moz-` pseudo sits in a rule of its own. Pinned in Task 3.
2. **Disabled controls must not squash.** Buttons use `:not(:disabled)`. Switch, check and radio hosts are `<label>`s, so they need `:not(:has(:disabled))`. Pinned in Tasks 1 and 2.
3. **An effects host (`sl-fx-press`, glass, liquid) moves exactly like a plain control.** The press sink matches the squash, and a glass pane or lens stays seated during a press. Pinned in Task 1 (value) and Task 4 (visual check on `showcase/effects.html`).
4. **A product that already puts its own `transform` on a kit button loses it while the button is held.** Task 5 greps each product for `transform` on `.sl-btn`, `.sl-chip`, `.sl-icon-btn`, `.sl-segmented__item` and `.sl-pagination__item` before bumping, and lists any hits.
5. **A slider whose consumer never writes `--sl-slider-value`** shows an unfilled track in Chromium and Safari, but still works and is still keyboard-operable. Pinned in Task 3: the track reads `var(--sl-slider-value, 0%)`.

---

### Task 1: Press squash on buttons, icon buttons, chips, segmented and pagination items

**Files:**
- Create: `scripts/tactile.test.mjs`
- Modify: `packages/ui-kit/components.css`:
  - the `transition` lists of `.sl-btn` (~l.242), `.sl-chip` (~l.178), `.sl-segmented__item` (~l.975), `.sl-icon-btn` (~l.1003) and `.sl-pagination__item` (~l.1036);
  - a new block before `/* ══ HIGH CONTRAST`.
- Modify: `packages/ui-kit/effects.css`, the `.sl-fx-press:active:not(:disabled)` rule (~l.1135).

**Interfaces:**
- Produces:
  - the squash value `scale(1.02, 0.968)`, reused by Task 2's docs and Task 4's catalog prose;
  - the helpers `rules(css)` and `bare(css)` in `scripts/tactile.test.mjs`, reused by Tasks 2 and 3.

- [ ] **Step 1: Write the failing test** — create `scripts/tactile.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Gummy controls (docs/specs/2026-09-30-gummy-controls-design.md): every
// control squashes while held and springs back on release, transform-only,
// on the motion tokens, never on a keyframe.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const components = bare(readFileSync(resolve(KIT, "components.css"), "utf8"));
const effects = bare(readFileSync(resolve(KIT, "effects.css"), "utf8"));
/** Flat rules of a stylesheet: [{ selector, body }]. Nested blocks (@media) are skipped. */
function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
}
const R = rules(components);
const SQUASH = "scale(1.02, 0.968)";
const PRESSABLE = ["sl-btn", "sl-icon-btn", "sl-chip", "sl-segmented__item", "sl-pagination__item"];

test("every pressable control squashes while held, and never when disabled", () => {
  const press = R.find((r) => r.body.includes(`transform: ${SQUASH}`) && r.selector.includes(":active"));
  assert.ok(press, `no :active rule squashes with ${SQUASH}`);
  for (const cls of PRESSABLE) assert.ok(press.selector.includes(`.${cls}`), `${cls} is not in the press rule`);
  assert.match(press.selector, /:not\(:disabled\)/);
  assert.match(press.body, /transition-duration:\s*var\(--sl-motion-fast/);
  assert.match(press.body, /transition-timing-function:\s*var\(--sl-motion-ease/);
});

test("every pressable control springs its transform back on the spring token", () => {
  for (const cls of PRESSABLE) {
    const base = R.find((r) => r.selector === `.${cls}` && /transition/.test(r.body));
    assert.ok(base, `.${cls} has no base transition`);
    assert.match(base.body, /transform var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring, var\(--sl-motion-ease, ease\)\)/, `.${cls}`);
  }
});

test("the effects layer's press sinks exactly like the base squash", () => {
  const sink = rules(effects).find((r) => r.selector === ".sl-fx-press:active:not(:disabled)");
  assert.ok(sink);
  assert.match(sink.body, new RegExp(`transform:\\s*${SQUASH.replace(/[().]/g, "\\$&")}`));
});

test("no gummy rule animates: transitions only, so nothing plays on page load", () => {
  const moving = R.filter((r) => /transform:\s*scale\(/.test(r.body) || /--sl-slider|sl-switch__track::after|__box/.test(r.selector));
  for (const r of moving) assert.doesNotMatch(r.body, /(^|;)\s*animation\s*:/, r.selector);
  // The only keyframes in components.css are the live badge's breath, which predates this work.
  assert.deepEqual([...components.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]), ["sl-badge-live"]);
});

export { rules, bare };
```

- [ ] **Step 2: Run it and check that it fails.** Run `node --test scripts/tactile.test.mjs`. Expected: the first three tests FAIL (no press rule, no transform in the transitions, and the press sink is still `scale(0.965)`); the fourth PASSES.

- [ ] **Step 3: Implement.** In `components.css`, append the transform to each base transition. Apply each edit exactly once:
  - `.sl-btn`: after `color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);`, change the terminating `;` into `,` and add the line `              transform var(--sl-motion-slow, 360ms) var(--sl-motion-spring, var(--sl-motion-ease, ease));`
  - `.sl-chip`, `.sl-segmented__item`, `.sl-icon-btn` and `.sl-pagination__item`: in each `transition:` list, turn the last entry's `;` into `,` and add `    transform var(--sl-motion-slow, 360ms) var(--sl-motion-spring, var(--sl-motion-ease, ease));`

  Then insert before `/* ══ HIGH CONTRAST ══`:

```css
/* ══ TACTILE — the controls give under the finger ══════════════════════════════
   The owner, 2026-09-30: "a slight bump to the toggle, like if they are
   gummies" — the Quiet strength (docs/specs/2026-09-30-gummy-controls-design.md).
   Held, a control squashes a little and keeps its volume (wider by 2%,
   shorter by 3.2%); let go, it returns on --sl-motion-spring, whose one small
   overshoot IS the bump. Going down is quick and plain; the spring is for
   the way back. Transform-only and transition-only: no keyframe, so nothing
   plays when a page loads with a box already checked, and the motion tokens
   are zeroed under reduced motion, which stops all of it. */
:is(.sl-btn, .sl-icon-btn, .sl-chip, .sl-segmented__item, .sl-pagination__item):active:not(:disabled) {
  transform: scale(1.02, 0.968);
  transition-duration: var(--sl-motion-fast, 120ms);
  transition-timing-function: var(--sl-motion-ease, ease);
}

```

  In `effects.css`, in `.sl-fx-press:active:not(:disabled)`, replace `transform: scale(0.965);` with:

```css
  /* The same squash as components.css's TACTILE block: a control moves the
     same way with or without the effects layer; the light is this file's job. */
  transform: scale(1.02, 0.968);
```

- [ ] **Step 4: Run it and check that it passes.** Run `node --test scripts/tactile.test.mjs`: all PASS. Then run `npm test`: all PASS. The existing "component motion reads the motion tokens" test must stay green.

- [ ] **Step 5: Commit.**

```bash
git add scripts/tactile.test.mjs packages/ui-kit/components.css packages/ui-kit/effects.css
git commit -m "feat(motion): controls squash while held and spring back (Quiet)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 2: Switch knob stretch, and check/radio box press

**Files:**
- Modify:
  - `packages/ui-kit/components.css`: `.sl-switch__track::after` (~l.566) and `.sl-check__box, .sl-radio__box` (~l.491);
  - the TACTILE block from Task 1.
- Test: `scripts/tactile.test.mjs`.

**Interfaces:**
- Consumes: `rules()` and `bare()` from Task 1, which live in the same file.

- [ ] **Step 1: Write the failing tests.** Append to `scripts/tactile.test.mjs`:

```js
test("the switch knob is a pill that stretches toward where it will travel, never when disabled", () => {
  const knob = R.find((r) => r.selector === ".sl-switch__track::after");
  assert.match(knob.body, /border-radius:\s*999px/);
  assert.match(knob.body, /width var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring/);
  const held = R.find((r) => r.selector.includes(".sl-switch:active") && /width:\s*0\.825rem/.test(r.body));
  assert.ok(held, "no held-knob rule");
  assert.match(held.selector, /:not\(:has\(:disabled\)\)/);
  const heldOn = R.find((r) => r.selector.includes(".sl-switch:active") && r.selector.includes(":checked") && /translateX\(0\.775rem\)/.test(r.body));
  assert.ok(heldOn, "a checked knob must grow leftward (translateX 0.775rem)");
  assert.match(heldOn.selector, /:not\(:has\(:disabled\)\)/);
});

test("the check and radio box shrinks while held and springs back, never when disabled", () => {
  const box = R.find((r) => r.selector.replace(/\s+/g, " ") === ".sl-check__box, .sl-radio__box");
  assert.match(box.body, /transform var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring/);
  const held = R.find((r) => /scale\(0\.96\)/.test(r.body) && r.selector.includes(":active"));
  assert.ok(held, "no held-box rule");
  assert.match(held.selector, /:not\(:has\(:disabled\)\)/);
  assert.match(held.body, /transition-duration:\s*var\(--sl-motion-fast/);
});
```

- [ ] **Step 2: Run them and check that they fail.** Run `node --test scripts/tactile.test.mjs`. Expected: the two new tests FAIL.

- [ ] **Step 3: Implement.**
  - In `.sl-switch__track::after`, change `border-radius: 50%;` to `border-radius: 999px;`. Change its `transition` to:

```css
  transition:
    transform var(--sl-motion-mid, 220ms) var(--sl-motion-spring, var(--sl-motion-ease, ease)),
    width var(--sl-motion-slow, 360ms) var(--sl-motion-spring, var(--sl-motion-ease, ease)),
    background-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease);
```

  - In `.sl-check__box, .sl-radio__box`, change its `transition` to:

```css
  transition:
    background-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    border-color var(--sl-motion-fast, 120ms) var(--sl-motion-ease, ease),
    transform var(--sl-motion-slow, 360ms) var(--sl-motion-spring, var(--sl-motion-ease, ease));
```

  - Append to the TACTILE block:

```css
/* The switch knob stretches toward the side it will travel to while held —
   rightward from off, leftward from on (it sits at 0.85rem, and grows by
   0.075rem) — then springs across on release, as it always has. */
.sl-switch:active:not(:has(:disabled)) .sl-switch__track::after { width: 0.825rem; }
.sl-switch:active:not(:has(:disabled)) .sl-switch__input:checked + .sl-switch__track::after {
  transform: translateY(-50%) translateX(0.775rem);
}
/* A box shrinks under the finger; the spring-back overshoots a little, which
   is the "pop" a newly checked box gets. */
:is(.sl-check, .sl-radio):active:not(:has(:disabled)) :is(.sl-check__box, .sl-radio__box) {
  transform: scale(0.96);
  transition-duration: var(--sl-motion-fast, 120ms);
  transition-timing-function: var(--sl-motion-ease, ease);
}
```

- [ ] **Step 4: Run them and check that they pass.** Run `node --test scripts/tactile.test.mjs`, then `npm test`: all PASS.

- [ ] **Step 5: Commit.**

```bash
git add scripts/tactile.test.mjs packages/ui-kit/components.css
git commit -m "feat(motion): the switch knob stretches toward its travel; boxes give when pressed

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 3: The slider, `sl-slider`

**Files:**
- Modify:
  - `packages/ui-kit/components.css`: a new block after the `sl-progress` rules (after `.sl-progress--danger .sl-progress__bar`), plus a high-contrast addition;
  - `packages/ui-kit/agent/catalog.json`: a new entry after `progress`;
  - `packages/ui-kit/agent/catalog.md`: a new section after `### Progress`;
  - `scripts/focus-ring.test.mjs`: learns thumb-ring components.
- Test: `scripts/tactile.test.mjs`.

**Interfaces:**
- Consumes: `rules()` from Task 1; the role vars `--slc-canvas`, `--slc-text`, `--slc-accent`, `--slc-shade-step`, `--slc-shadow-sm`, `--slc-focus` and `--slc-border` (all in the components.css role block).
- Produces:
  - the class `sl-slider`;
  - the consumer contract `--sl-slider-value: <percent>`;
  - the component-local `--sl-slider-thumb`.

- [ ] **Step 1: Write the failing tests.** Append to `scripts/tactile.test.mjs`:

```js
test("every engine pseudo-element sits in a rule of its own", () => {
  // A selector list containing a pseudo-element one engine does not know is
  // dropped WHOLE by that engine: a ::-moz- next to a ::-webkit- thumb would
  // style no thumb anywhere.
  for (const r of R) {
    const parts = r.selector.split(",").map((s) => s.trim());
    if (!parts.some((p) => /::-(webkit|moz)-/.test(p))) continue;
    assert.equal(parts.length, 1, `engine pseudo-element shares a selector list: ${r.selector}`);
  }
});

test("the slider thumb grows when hovered and grows and flattens when grabbed, per engine", () => {
  for (const thumb of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
    const base = R.find((r) => r.selector === `.sl-slider${thumb}`);
    assert.ok(base, `no .sl-slider${thumb}`);
    assert.match(base.body, /background:\s*var\(--sl-slider-thumb\)/);
    assert.match(base.body, /transform var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring/);
    const hover = R.find((r) => r.selector === `.sl-slider:hover:not(:disabled)${thumb}`);
    const grab = R.find((r) => r.selector === `.sl-slider:active:not(:disabled)${thumb}`);
    assert.match(hover?.body ?? "", /transform:\s*scale\(1\.1\)/, `${thumb} hover`);
    assert.match(grab?.body ?? "", /transform:\s*scale\(1\.35, 1\.22\)/, `${thumb} grab`);
    // hover must come first: while grabbed, both match, and the later rule wins.
    assert.ok(R.indexOf(hover) < R.indexOf(grab), `${thumb}: the hover rule must precede the grab rule`);
  }
  const host = R.find((r) => r.selector === ".sl-slider");
  assert.match(host.body, /--sl-slider-thumb:\s*oklch\(from var\(--slc-canvas\) max\(l, 1 - l\) 0 h\)/);
});

test("the slider fill reads the consumer's value and survives its absence", () => {
  const track = R.find((r) => r.selector === ".sl-slider::-webkit-slider-runnable-track");
  assert.match(track.body, /var\(--sl-slider-value, 0%\)/);
  assert.ok(R.find((r) => r.selector === ".sl-slider::-moz-range-progress"), "Firefox fills with ::-moz-range-progress");
});

test("the slider's focus ring is on its thumb, in each engine", () => {
  for (const thumb of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
    const ring = R.find((r) => r.selector === `.sl-slider:focus-visible${thumb}`);
    assert.match(ring?.body ?? "", /outline:\s*var\(--sl-focus-ring-width, 2px\) solid var\(--slc-focus\)/, thumb);
  }
});
```

  In `scripts/focus-ring.test.mjs`, replace the body of the `for (const c of index.components.filter((c) => c.interactive))` test with:

```js
    const hit = c.classes.some((cls) => selector.includes(`.${cls}`))
      // A native range input draws its focus on the thumb, in a rule of its
      // own per engine: an engine pseudo-element cannot join the shared list
      // without dropping the whole list in the other engine.
      || c.classes.some((cls) => css.includes(`.${cls}:focus-visible::-webkit-slider-thumb`));
    assert.ok(
      hit,
      `"${c.id}" is marked interactive but none of ${JSON.stringify(c.classes)} ` +
        `appears in the focus-ring selector list:\n${selector}`,
    );
```

- [ ] **Step 2: Run them and check that they fail.** Run `node --test scripts/tactile.test.mjs`. Expected: the slider tests FAIL, and "every engine pseudo-element sits in a rule of its own" PASSES (it is vacuously true until the slider exists).

- [ ] **Step 3: Implement.** In `components.css`, insert after the line `.sl-progress--danger  .sl-progress__bar { background-color: var(--slc-danger); }`:

```css

/* Slider — a styled native range input, so keyboard, screen readers and
   touch are the browser's. The value is written twice, like sl-progress:
   the input's own value, and --sl-slider-value (a percentage) for the fill in
   Chromium/Safari, which have no fill pseudo-element; Firefox fills with
   ::-moz-range-progress. Without --sl-slider-value the track reads unfilled
   and nothing else changes.
     <input class="sl-slider" type="range" style="--sl-slider-value: 40%"
            oninput="this.style.setProperty('--sl-slider-value', this.value + '%')">
   The thumb is the page's light pole — near-white on light, light grey on
   dark, white on high contrast — never the raised surface, which on dark is
   the page's own near-black (owner, 2026-09-30: "hard to see"). Its edge is
   its own fill in shade. Hovered it grows; grabbed it grows and flattens, and
   springs back when let go (owner: "the slider should scale up not only
   squash"). EVERY engine pseudo-element is a rule of its own: an unknown
   pseudo-element drops the whole selector list it sits in. */
.sl-slider {
  --sl-slider-thumb: oklch(from var(--slc-canvas) max(l, 1 - l) 0 h);
  -webkit-appearance: none;
  appearance: none;
  display: block;
  width: 100%;
  height: 1.25rem;
  margin: 0;
  background: transparent;
  cursor: pointer;
}
.sl-slider:disabled { opacity: 0.5; cursor: not-allowed; }
.sl-slider:focus-visible { outline: none; }
.sl-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: var(--sl-radius-pill, 9999px);
  background:
    linear-gradient(var(--slc-accent) 0 0) 0 / var(--sl-slider-value, 0%) 100% no-repeat,
    color-mix(in srgb, var(--slc-text) 12%, transparent);
}
.sl-slider::-moz-range-track {
  height: 4px;
  border-radius: var(--sl-radius-pill, 9999px);
  background: color-mix(in srgb, var(--slc-text) 12%, transparent);
}
.sl-slider::-moz-range-progress {
  height: 4px;
  border-radius: var(--sl-radius-pill, 9999px);
  background: var(--slc-accent);
}
.sl-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 1.1rem;
  height: 1.1rem;
  margin-top: calc((4px - 1.1rem) / 2);
  border-radius: 50%;
  background: var(--sl-slider-thumb);
  border: 1px solid oklch(from var(--sl-slider-thumb) calc(l - var(--slc-shade-step) * 3) 0 h);
  box-shadow: var(--slc-shadow-sm);
  transition: transform var(--sl-motion-slow, 360ms) var(--sl-motion-spring, var(--sl-motion-ease, ease));
}
.sl-slider::-moz-range-thumb {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 50%;
  background: var(--sl-slider-thumb);
  border: 1px solid oklch(from var(--sl-slider-thumb) calc(l - var(--slc-shade-step) * 3) 0 h);
  box-shadow: var(--slc-shadow-sm);
  transition: transform var(--sl-motion-slow, 360ms) var(--sl-motion-spring, var(--sl-motion-ease, ease));
}
.sl-slider:hover:not(:disabled)::-webkit-slider-thumb { transform: scale(1.1); }
.sl-slider:hover:not(:disabled)::-moz-range-thumb { transform: scale(1.1); }
.sl-slider:active:not(:disabled)::-webkit-slider-thumb {
  transform: scale(1.35, 1.22);
  transition-duration: var(--sl-motion-fast, 120ms);
  transition-timing-function: var(--sl-motion-ease, ease);
}
.sl-slider:active:not(:disabled)::-moz-range-thumb {
  transform: scale(1.35, 1.22);
  transition-duration: var(--sl-motion-fast, 120ms);
  transition-timing-function: var(--sl-motion-ease, ease);
}
.sl-slider:focus-visible::-webkit-slider-thumb {
  outline: var(--sl-focus-ring-width, 2px) solid var(--slc-focus);
  outline-offset: var(--sl-focus-ring-offset, 2px);
}
.sl-slider:focus-visible::-moz-range-thumb {
  outline: var(--sl-focus-ring-width, 2px) solid var(--slc-focus);
  outline-offset: var(--sl-focus-ring-offset, 2px);
}
```

  After the existing `:root[data-sl-theme="high-contrast"] .sl-table thead th { … }` line, add:

```css
/* A 12% wash vanishes on black: the slider track gets the theme's line. */
:root[data-sl-theme="high-contrast"] .sl-slider::-webkit-slider-runnable-track { box-shadow: inset 0 0 0 1px var(--slc-border); }
:root[data-sl-theme="high-contrast"] .sl-slider::-moz-range-track { box-shadow: inset 0 0 0 1px var(--slc-border); }
```

  In `catalog.json`, insert after the `progress` entry:

```json
    {
      "id": "slider",
      "kind": "primitive",
      "interactive": true,
      "classes": [
        "sl-slider"
      ],
      "roleVars": [
        "--slc-canvas",
        "--slc-text",
        "--slc-accent",
        "--slc-shade-step",
        "--slc-shadow-sm",
        "--slc-focus",
        "--slc-border"
      ]
    },
```

  In `catalog.md`, insert after the `### Progress` section (before the next `###`). The ```` ```html ```` fence below is part of the markdown to insert:

````markdown
### Slider — `sl-slider`
A styled native range input: keyboard, screen readers and touch are the browser's. The thumb is the page's light pole (near-white on light, light grey on dark); it grows when hovered, grows and flattens when grabbed, and springs back when let go. Write the value twice: the input's own, and `--sl-slider-value` (a percentage) for the fill — Chromium and Safari have no fill pseudo-element; Firefox fills itself. Substrate: **R** App/IDE, **A** Page.
```html
<input class="sl-slider" type="range" min="0" max="100" value="40" aria-label="Volume"
       style="--sl-slider-value: 40%"
       oninput="this.style.setProperty('--sl-slider-value', this.value + '%')">
```
Consumes: `--slc-canvas`, `--slc-text`, `--slc-accent`, `--slc-shade-step`, `--slc-shadow-sm`, `--slc-focus`, `--slc-border`. Do: give it an accessible name (`aria-label` or a `<label for>`). Don't: use it for a value the user must set exactly — pair it with a number field, or use one instead.
````

- [ ] **Step 4: Run and check that everything passes.** Run `node --test scripts/tactile.test.mjs scripts/focus-ring.test.mjs scripts/catalog-audit.test.mjs`, then `npm test`: all PASS. If `effects-guards` "every wrapper that clips a filling glass pane…" fails on a new clipping class, none is expected, because the slider sets no `overflow`.

- [ ] **Step 5: Commit.**

```bash
git add scripts/tactile.test.mjs scripts/focus-ring.test.mjs packages/ui-kit/components.css packages/ui-kit/agent/catalog.json packages/ui-kit/agent/catalog.md
git commit -m "feat(slider): sl-slider — a native range whose thumb grows when grabbed

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 4: Docs, showcase, version, and the visual check

**Files:**
- Modify:
  - `docs/design-language.md` (§L4 Motion; then regenerate `packages/ui-kit/agent/design-language.md` with `npm run gen:tokens`);
  - `packages/ui-kit/README.md` (the class list and a motion line);
  - `showcase/index.html` (a slider in the "toggle · chips · progress · tooltip" cell);
  - `packages/ui-kit/package.json` (`0.24.2` → `0.25.0`).

- [ ] **Step 1: Update the design language.** In `docs/design-language.md` §L4, after the `**Respect reduced motion.**` bullet, add:

```markdown
- **Controls give under the finger.** Held, a button, chip, segmented or pagination item squashes a little and keeps its volume (`scale(1.02, 0.968)`); a switch knob stretches toward where it will travel; a check or radio box shrinks; a slider thumb grows and flattens. Let go, it returns on `--sl-motion-spring`, whose one small overshoot is the bump (owner, 2026-09-30: "like if they are gummies" — the Quiet strength). Transform-only, transition-only — never a keyframe, which would also play when a page loads with a box already checked — so reduced motion stops it with the rest.
```

  Then run `npm run gen:tokens`. It regenerates the agent copy; `agent-docs-drift` must stay green.

- [ ] **Step 2: Update the README.** In `packages/ui-kit/README.md`, in the line starting `Form controls:`, append `, \`.sl-slider\` (a native range; write \`--sl-slider-value\` for the fill)`. After that line, add:

```markdown

Motion: every control squashes a little while held and springs back when let go (`--sl-motion-spring`), transform-only; reduced motion stops it.
```

- [ ] **Step 3: Add a slider to the showcase.** In `showcase/index.html`, inside the cell whose label is `toggle &middot; chips &middot; progress &middot; tooltip`, after the `sl-progress` div, add:

```html
              <input class="sl-slider" type="range" min="0" max="100" value="40" aria-label="Volume"
                     style="--sl-slider-value: 40%"
                     oninput="this.style.setProperty('--sl-slider-value', this.value + '%')">
```

- [ ] **Step 4: Bump the version and check it is free.** In `packages/ui-kit/package.json`, set `"version": "0.25.0"`. Run `curl -s -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/@sondalab%2Fui-kit/0.25.0`. Expected: `404`.

- [ ] **Step 5: Run the full suite.** Run `npm test`. Expected: all PASS, about 548, which is 537 plus the new tactile and catalog tests.

- [ ] **Step 6: Visual check in real browsers (Review Focus 3 and 5).**
  1. Serve the worktree with `python3 lab/_serve.py 8894`.
  2. In Chrome, open `http://localhost:8894/showcase/index.html` and `http://localhost:8894/showcase/effects.html`, in light and in dark (theme from localStorage `sl-demo-theme`).
  3. Press and hold a primary button, a glass ghost button, a chip, a switch, a checkbox and the slider. Confirm:
     - each squashes and springs back;
     - a glass pane and its lens stay seated during the press;
     - the slider thumb is visible in dark;
     - a disabled control (set `disabled` from devtools) does not move.
  4. With `--force-prefers-reduced-motion`, confirm the state still changes and nothing animates.
  5. If a glass or lens host visibly detaches or tears during the press, stop and report it; don't patch around it.

- [ ] **Step 7: Commit.**

```bash
git add docs/design-language.md packages/ui-kit/agent/design-language.md packages/ui-kit/README.md showcase/index.html packages/ui-kit/package.json
git commit -m "docs(motion): 0.25.0 — the controls give under the finger; sl-slider

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

### Task 5: Release, and roll out to the products

**Files:**
- Remote: sondalab-ui PR → merge → npm publish.
- Each product gets its own worktree and PR:
  - spexr: `packages/ui-kit/package.json` and `pnpm-lock.yaml`;
  - introspect: `web/package.json` and `package-lock.json`;
  - sondalab-site: `package.json` and `package-lock.json` (deploys on merge);
  - daos: `docs/daos-landing.html` (the CDN pin `@sondalab/ui-kit@0.24` becomes `@0.25`).

- [ ] **Step 1: Open the PR, wait for checks, merge.**
  1. Push `feat/gummy-motion` and run `gh pr create` with a body summarising Tasks 1–4 and linking the spec.
  2. Wait until checks are registered, run `gh pr checks <n> --watch`, and merge only on a green exit with `gh pr merge <n> --squash --delete-branch`.
  3. Poll until `https://registry.npmjs.org/@sondalab%2Fui-kit/0.25.0` returns 200.

- [ ] **Step 2: Check each product for its own transforms (Review Focus 4).** Run:

```bash
cd /Users/marcello.barile/src/mine/ai-tools
grep -rnE '\.(sl-btn|sl-icon-btn|sl-chip|sl-segmented__item|sl-pagination__item)[^{]*\{[^}]*transform' \
  spexr/packages/theia-extensions/src introspect/web/src sondalab-site/src daos/docs --include='*.css' --include='*.astro' --include='*.html' --include='*.tsx'
```

  List every hit in the product's PR body. If a hit puts a `transform` on the resting state (not `:active`), the kit's press rule replaces it while the control is held. Say so in the PR, and do not "fix" it without asking the owner.

- [ ] **Step 3: Bump each product.** For each product, in its own worktree on branch `chore/kit-025`:
  1. Bump to `^0.25.0` (daos: change the CDN pin to `@0.25`).
  2. Run the product's validation:
     - spexr: `pnpm install --frozen-lockfile`, the theme tests, `pnpm build`; also update `theme/ui-kit-version.test.ts` to "at least 0.25.0";
     - introspect: `npm install`, `npm test`, `npm run build -w web`, and the audit with 0 R;
     - sondalab-site: `npm test`, `npm run build`, `npm run audit`;
     - daos: a headless screenshot, light and dark.
  3. Open the PR.
  4. Merge on green: spexr waits for E2E; the introspect and daos repos have no CI; the site deploys on merge, so watch `deploy.yml` to green.
  5. Remove the worktree.

- [ ] **Step 4: Report to the owner.**
  - Every PR URL.
  - The spexr refresh command: `git pull && pnpm install && pnpm build && pnpm start`.
  - Any Step 2 hits.
  - The visual-check results from Task 4, Step 6.
