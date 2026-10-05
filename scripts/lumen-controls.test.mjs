import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseSheet, el, box, cascaded, customs, px } from "./lib/cascade.mjs";
import { evaluate, fromOklch, fromSrgb, toHex, toOklch, toSrgb } from "./lib/css-color.mjs";

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

const NEUTRALS = JSON.parse(read("neutrals.json")).products;
const PRODUCTS = Object.keys(NEUTRALS).filter((p) => !NEUTRALS[p].inherits);

/** html[data-sl-theme][data-sl-product] > body > [.sl-invert > div] > element. */
function at(theme = "dark", { band = false, product = null } = {}) {
  const html = el({ tag: "html", attrs: { "data-sl-theme": theme, ...(product ? { "data-sl-product": product } : {}) } });
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

test("a tag is Lumen's: mono 11.5/500 at r6 (it was a 12px pill), 4px by 8px, 22px tall on a 12px line", () => {
  for (const mod of ["", "sl-tag--plain"]) {
    const t = el({ tag: "span", classes: ["sl-tag", ...(mod ? [mod] : [])], parent: at() });
    const s = shape(KIT_RULES, t);
    assert.equal(s.font, 11.5, `${mod}: Lumen's 11.5`);
    assert.equal(value(KIT_RULES, t, "font-weight"), "500");
    assert.match(value(KIT_RULES, t, "font-family"), /^var\(--sl-font-mono/, "an identifier, in the mono");
    assert.equal(value(KIT_RULES, t, "letter-spacing"), "0.02em");
    assert.equal(s.radius, 6);
    assert.deepEqual(s.padding, [4, 8, 4, 8]);
    assert.equal(s.line, 12, "a whole-pixel line under 11.5px type");
    assert.equal(s.height, 22, "the badge's row (Lumen's 19.9), as in 0.35");
  }
});

test("a chip is Lumen's composer chip: mono 12.5/500 at r6 (it was a 12px sans pill), 4px by 8px, 24px tall, a rounded-square dot", () => {
  for (const pressed of ["false", "true"]) {
    const c = el({ tag: "button", classes: ["sl-chip"], attrs: { "aria-pressed": pressed }, parent: el({ classes: ["sl-chips"], parent: at() }) });
    const s = shape(KIT_RULES, c);
    assert.equal(s.font, 12.5, "Lumen's 12.5");
    assert.match(value(KIT_RULES, c, "font-family"), /^var\(--sl-font-mono/);
    assert.equal(value(KIT_RULES, c, "font-weight"), "500");
    assert.equal(value(KIT_RULES, c, "letter-spacing"), "0");
    assert.equal(s.radius, 6);
    assert.deepEqual(s.padding, [4, 8, 4, 8]);
    assert.equal(s.height, 24, `pressed=${pressed}: the small button's row (Lumen's 24.1)`);
    assert.equal(s.height, box(KIT_RULES, button("primary", true)).height, "a chip and a small button share a row");
    const dot = el({ pseudo: "before", parent: c });
    assert.equal(value(KIT_RULES, dot, "border-radius"), "2px", "Lumen's r2 dot");
  }
  // the one control edge, unchanged
  const off = el({ tag: "button", classes: ["sl-chip"], attrs: { "aria-pressed": "false" }, parent: at() });
  assert.equal(value(KIT_RULES, off, "border"), "1px solid var(--slc-edge-control)");
});

// ── keycap ───────────────────────────────────────────────────────────────────

/** Colour t over the opaque colour u (source-over, in sRGB). */
const over = (t, u) => { const a = toSrgb(t), b = toSrgb(u); return fromSrgb(a.map((v, i) => v * t.alpha + b[i] * (1 - t.alpha))); };

test("a keycap is 4px in (Lumen's 5.12 on the grid), ringed in the default line, on the 20px square", () => {
  const k = el({ tag: "kbd", classes: ["sl-kbd"], parent: at() });
  const { padding } = box(KIT_RULES, k);
  assert.deepEqual([padding.top, padding.right, padding.bottom, padding.left], [0, 4, 0, 4]);
  assert.equal(len(KIT_RULES, k, "min-width"), 20);
  assert.equal(len(KIT_RULES, k, "height"), 20);
  assert.equal(value(KIT_RULES, k, "box-shadow"), "var(--slc-depth-key)");
  const html = at().parent;
  assert.match(value(KIT_RULES, html, "--slc-depth-key"), /^0 0 0 1px var\(--slc-border\),/, "the ring is the default line");
});

test("a keycap's base is Lumen's shade on every product: within 0.015 oklch L of black 28% on ink and the ink 12% on paper", () => {
  const LUMEN_INK = fromOklch([0.2, 0.01, 60]);
  const BLACK = fromSrgb([0, 0, 0]);
  const out = [];
  for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
    const env = customs(KIT_RULES, el({ tag: "kbd", classes: ["sl-kbd"], parent: at(theme, { product }) }));
    const surface = evaluate("var(--slc-surface)", env);
    const base = evaluate("var(--_sl-key-base)", env);
    const lumen = theme === "dark" ? over({ ...BLACK, alpha: 0.28 }, surface) : over({ ...LUMEN_INK, alpha: 0.12 }, surface);
    const [L] = toOklch(base), [Lt] = toOklch(lumen), [Ls] = toOklch(surface);
    assert.ok(L < Ls, `${theme} ${product}: the base is in shade`);
    if (Math.abs(L - Lt) > 0.015) out.push(`${theme} ${product}: base L ${L.toFixed(3)}, Lumen ${Lt.toFixed(3)}`);
  }
  assert.deepEqual(out, []);
});

// ── check box ────────────────────────────────────────────────────────────────

const YL = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [YL(a), YL(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
/** A check box in a label on a ground: [box, the ground's colour, env]. */
function checkBox(theme, { product = null, band = false, checked = false } = {}) {
  const parent = at(theme, { product, band });
  const label = el({ tag: "label", classes: ["sl-check"], parent });
  const input = el({ tag: "input", classes: ["sl-check__input"], states: checked ? ["checked"] : [], parent: label });
  return el({ tag: "span", classes: ["sl-check__box"], parent: label, prev: input });
}

test("the check box is Lumen's: r5 on the canvas, and checked it is the fill set as before", () => {
  const b = checkBox("dark");
  assert.equal(value(KIT_RULES, b, "border-radius"), "5px");
  assert.equal(value(KIT_RULES, b, "background"), "var(--slc-canvas)");
  const on = checkBox("dark", { checked: true });
  assert.equal(value(KIT_RULES, on, "background"), "var(--_sl-fill)");
  assert.equal(value(KIT_RULES, on, "border-color"), "var(--_sl-fill-edge)");
  // the radio keeps its round box on the sunken rung
  const radio = el({ tag: "span", classes: ["sl-radio__box"], parent: at() });
  assert.equal(value(KIT_RULES, radio, "border-radius"), "50%");
  assert.equal(value(KIT_RULES, radio, "background"), "var(--slc-sunken)");
});

test("the check box's edge finds it at 3:1 against its canvas well and the ground round it, on every product and theme", () => {
  const out = [];
  for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
    const env = customs(KIT_RULES, checkBox(theme, { product }));
    const edge = evaluate("var(--slc-edge-control)", env);
    for (const ground of ["--slc-canvas", "--slc-surface", "--slc-raised"]) {
      const r = ratio(edge, evaluate(`var(${ground})`, env));
      if (r < 3) out.push(`${theme} ${product}: edge on ${ground} ${r.toFixed(2)}`);
    }
  }
  const hc = customs(KIT_RULES, checkBox("high-contrast"));
  const r = ratio(evaluate("var(--slc-edge-control)", hc), evaluate("var(--slc-canvas)", hc));
  if (r < 3) out.push(`high contrast: ${r.toFixed(2)}`);
  assert.deepEqual(out, []);
});

test("in the inversion band the check box stays on the band's sunken wash, never the band's ink", () => {
  for (const theme of ["light", "dark", "high-contrast"]) {
    const b = checkBox(theme, { band: true });
    assert.equal(value(KIT_RULES, b, "background"), "var(--slc-sunken)", theme);
    // the band's sunken rung is a 4% wash of its ink (currentColor, which
    // the band binds to the page canvas), not a solid of that ink
    const env = customs(KIT_RULES, b);
    const ink = toHex(evaluate("var(--slc-canvas)", env));
    const sunken = value(KIT_RULES, b.parent.parent, "--slc-sunken") ?? value(KIT_RULES, b.parent, "--slc-sunken");
    assert.match(sunken, /currentColor 4%, transparent/, theme);
    const fill = evaluate(sunken.replace(/currentColor/g, ink), env);
    assert.ok(fill.alpha < 0.1, `${theme}: a wash over the band's ground (alpha ${fill.alpha}), not a solid of its ink ${ink}`);
    // checked, the fill set still wins in the band
    assert.equal(value(KIT_RULES, checkBox(theme, { band: true, checked: true }), "background"), "var(--_sl-fill)", theme);
  }
});
