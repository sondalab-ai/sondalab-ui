import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseSheet, el, box, cascaded, customs, px } from "./lib/cascade.mjs";

// Lumen parity, the controls (ui-kit 0.36, slice K10): the button, the badge,
// the tag, the chip, the keycap and the check box move to the Lumen IDE
// demo's shape (lab/directions-2/dir-lumen.css, rendered at 1440x900), with
// every spacing value on the kit's 4px grid (owner, 2026-10-05) and parity
// "within a pixel or two". Read through the test cascade
// (scripts/lib/cascade.mjs) over the kit's real sheets, and with spexr's own
// button overrides loaded after them.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const SHEETS = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css", "themes/products.css", "components.css", "effects.css"].map(read);

// spexr's own button overrides, verbatim (as in controls-cascade.test.mjs).
const SPEXR = `
.sl-btn {
  padding: var(--sl-space-2) var(--sl-space-4);
  border-radius: var(--sl-radius-md);
}
.sl-btn--sm {
  padding: var(--sl-space-1) var(--sl-space-3);
  font-size: var(--sl-text-sm);
}`;

/** The kit's sheets, then a consumer's. */
function sheets(consumer = "") {
  const out = [];
  let order = 0;
  for (const css of [...SHEETS, consumer]) {
    const r = parseSheet(css, {}, order);
    order += r.length + 1;
    out.push(...r);
  }
  return out;
}
const KIT_RULES = sheets();
const SPEXR_RULES = sheets(SPEXR);

/** html[data-sl-theme] > body > [.sl-invert > div] > element. */
function at(theme = "dark", { band = false } = {}) {
  const html = el({ tag: "html", attrs: { "data-sl-theme": theme } });
  const body = el({ tag: "body", parent: html });
  if (!band) return body;
  return el({ parent: el({ classes: ["sl-invert"], parent: body }) });
}
const value = (rules, e, prop) => cascaded(rules, e).get(prop)?.value;
const len = (rules, e, prop) => px(value(rules, e, prop), customs(rules, e));
const onGrid = (n) => Math.abs(n / 4 - Math.round(n / 4)) < 1e-9;

// ── buttons ──────────────────────────────────────────────────────────────────

const VARIANTS = { plain: [], primary: ["sl-btn--primary"], secondary: ["sl-btn--ghost"] };
const button = (variant, small, parent = at()) =>
  el({ tag: "button", classes: ["sl-btn", ...VARIANTS[variant], ...(small ? ["sl-btn--sm"] : [])], parent });

test("a button is Lumen's: 13.5px type (12.5 small) on a 14px line, 8px between its parts", () => {
  for (const variant of Object.keys(VARIANTS)) {
    const b = button(variant, false), s = button(variant, true);
    assert.equal(len(KIT_RULES, b, "font-size"), 13.5, `${variant}: Lumen's 13.5`);
    assert.equal(len(KIT_RULES, s, "font-size"), 12.5, `${variant} small: Lumen's 12.5`);
    for (const e of [b, s]) {
      assert.equal(box(KIT_RULES, e).line, 14, `${variant}: a 14px line whatever the size`);
      assert.equal(len(KIT_RULES, e, "gap"), 8, `${variant}: Lumen's 8px gap`);
    }
  }
});

test("a button's padding is Lumen's on the 4px grid: 12px in (its 13.6), 8 in when small (its 9.6)", () => {
  for (const variant of Object.keys(VARIANTS)) {
    for (const [small, block, inline] of [[false, 8, 12], [true, 4, 8]]) {
      const { padding } = box(KIT_RULES, button(variant, small));
      assert.deepEqual([padding.top, padding.right, padding.bottom, padding.left], [block, inline, block, inline], `${variant}${small ? " small" : ""}`);
      for (const v of Object.values(padding)) assert.ok(onGrid(v), `${v}px on the grid`);
    }
  }
});

test("the small button is r7 (Lumen's), the button keeps r8, and a group squares its members", () => {
  assert.equal(value(KIT_RULES, button("plain", true), "border-radius"), "7px");
  assert.equal(value(KIT_RULES, button("primary", true), "border-radius"), "7px");
  assert.equal(value(KIT_RULES, button("plain", false), "border-radius"), "var(--sl-radius-md, 8px)");
  const group = el({ classes: ["sl-btn-group"], parent: at() });
  assert.equal(value(KIT_RULES, button("secondary", true, group), "border-radius"), "0");
});

test("rows hold at 32 and 24 with Lumen's type, with the kit's padding and with spexr's (its small button at 14px)", () => {
  for (const [who, rules] of [["kit", KIT_RULES], ["spexr", SPEXR_RULES]]) {
    for (const variant of Object.keys(VARIANTS)) {
      assert.equal(box(rules, button(variant, false)).height, 32, `${who} ${variant}`);
      assert.equal(box(rules, button(variant, true)).height, 24, `${who} ${variant} small`);
    }
  }
  // spexr's small button keeps its own 14px type, on the same line
  assert.equal(len(SPEXR_RULES, button("plain", true), "font-size"), 14);
});

test("the in-button key gives back what it adds to the 14px line, and sits 4px into the end padding", () => {
  const b = button("primary", false);
  const key = el({ tag: "kbd", classes: ["sl-kbd"], parent: b });
  const smKey = el({ tag: "kbd", classes: ["sl-kbd"], parent: button("primary", true) });
  for (const [k, h] of [[key, 18], [smKey, 16]]) {
    assert.equal(len(KIT_RULES, k, "height"), h);
    assert.ok(h + 2 * len(KIT_RULES, k, "margin-block") <= 14, `a ${h}px cap fits the line`);
    assert.equal(len(KIT_RULES, k, "margin-inline-end"), -4, "Lumen's -4.8 on the grid");
  }
});

test("a small glass button keeps r7: glass.css's host radius reads the knob the small button binds", () => {
  // glass.css draws the slab at var(--slg-radius, var(--sl-radius-md)) on the
  // host, at the same weight as .sl-btn--sm and loaded after it: unbound, the
  // small glass button went back to r8
  const rules = sheets(read("glass.css"));
  const host = el({ tag: "button", classes: ["sl-btn", "sl-btn--sm", "sl-fx-glass", "sl-fx-glass--pane", "sl-glass"], parent: at() });
  assert.equal(px(value(rules, host, "border-radius"), customs(rules, host)), 7);
  const big = el({ tag: "button", classes: ["sl-btn", "sl-fx-glass", "sl-fx-glass--pane", "sl-glass"], parent: at() });
  assert.equal(px(value(rules, big, "border-radius"), customs(rules, big)), 8);
});

// ── badge, tag, chip: r6, 8px in, on the grid, whole-pixel rows ───────────────

/** The rendered shape of an inline mark: [height, radius px, padding t/r/b/l]. */
function shape(rules, e) {
  const b = box(rules, e);
  const env = customs(rules, e);
  return { height: b.height, radius: px(value(rules, e, "border-radius"), env), padding: [b.padding.top, b.padding.right, b.padding.bottom, b.padding.left], font: b.fontSize, line: b.line };
}

test("a badge is Lumen's shape: r6 (it was a pill), 4px by 8px on the grid (its 3.2 by 8 and 7.2), 22px tall as before", () => {
  for (const tone of ["", "sl-badge--success", "sl-badge--warning", "sl-badge--danger", "sl-badge--info", "sl-badge--live"]) {
    const s = shape(KIT_RULES, el({ tag: "span", classes: ["sl-badge", ...(tone ? [tone] : [])], parent: at() }));
    assert.equal(s.radius, 6, tone);
    assert.deepEqual(s.padding, [4, 8, 4, 8], tone);
    assert.equal(s.height, 22, `${tone}: a whole-pixel row, the 0.35 height (Lumen's 20.4)`);
    assert.equal(s.font, 12, "Lumen's 12px");
  }
  const b = el({ tag: "span", classes: ["sl-badge"], parent: at() });
  assert.match(value(KIT_RULES, b, "font-family"), /^var\(--sl-font-sans/, "status words in the sans");
});
