import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseSheet, el, box, cascaded, customs, px } from "./lib/cascade.mjs";
import { evaluate, fromOklch, fromSrgb, substitute, toHex, toOklch, toSrgb } from "./lib/css-color.mjs";

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

/** The [x, y] scale an element's winning `transform` resolves to (1, 1 when
 *  it has none), its var()s read where the element computes them. */
function scaleOf(rules, e) {
  const t = value(rules, e, "transform");
  if (!t || t === "none") return [1, 1];
  const text = substitute(t, customs(rules, e)).trim();
  const m = text.match(/^scale\((.*)\)$/);
  assert.ok(m, `a scale: ${text}`);
  const args = []; let d = 0, f = 0;
  for (let i = 0; i <= m[1].length; i++) { const ch = m[1][i]; if (ch === "(") d++; else if (ch === ")") d--; else if ((ch === "," && d === 0) || i === m[1].length) { args.push(m[1].slice(f, i).trim()); f = i + 1; } }
  const num = (x) => Function(`"use strict"; return (${x.replace(/\bcalc\(/g, "(")});`)();
  const [sx, sy = sx] = args.map(num);
  return [sx, sy];
}
const WITH_COMPOSITIONS = sheets(read("compositions.css"));

test("held, a standalone button sinks to 97% on every press path: bare, sl-fx-press and a glass pane", () => {
  for (const [name, rules] of [["kit + effects", KIT_RULES], ["kit + effects + compositions", WITH_COMPOSITIONS]]) {
    for (const extra of [[], ["sl-fx-press"], ["sl-fx-glass", "sl-fx-glass--pane", "sl-glass"]]) {
      for (const variant of Object.keys(VARIANTS)) {
        const b = el({ tag: "button", classes: ["sl-btn", ...VARIANTS[variant], ...extra], states: ["active", "hover"], parent: at() });
        const [sx, sy] = scaleOf(rules, b);
        assert.ok(Math.abs(sx - 0.97) < 1e-9 && Math.abs(sy - 0.97) < 1e-9, `${name} / ${variant} ${extra.join(" ")}: ${sx}, ${sy}`);
      }
    }
  }
});

test("held, a member of a button group does not move on any press path, so the 1px rules between its keys stay 1px", () => {
  // A member sunk to 97% pulls its edges in from the group's 1px rules (the
  // group's own ground, through its 1px gap): measured in Chrome with the
  // middle of three pressed, the rules opened to about 2.7px. The group
  // binds the press knob, in components.css itself, so it holds with or
  // without compositions.css and with effects.css loaded after it.
  for (const [name, rules] of [["kit + effects", KIT_RULES], ["kit + effects + compositions", WITH_COMPOSITIONS]]) {
    const group = el({ classes: ["sl-btn-group"], parent: at() });
    for (const extra of [[], ["sl-fx-press"], ["sl-fx-glass", "sl-fx-glass--pane", "sl-glass"]]) {
      for (const variant of ["plain", "secondary", "primary"]) {
        const b = el({ tag: "button", classes: ["sl-btn", ...VARIANTS[variant], ...extra], states: ["active", "hover"], parent: group });
        assert.deepEqual(scaleOf(rules, b), [1, 1], `${name} / ${variant} ${extra.join(" ")}`);
      }
    }
  }
  // the knob is bound on the group in components.css, not only in compositions.css
  const kitOnly = (() => { let o = 0; return ["tokens.css", "components.css"].map(read).flatMap((css) => { const r = parseSheet(css, {}, o); o += r.length + 1; return r; }); })();
  const member = el({ tag: "button", classes: ["sl-btn"], states: ["active"], parent: el({ classes: ["sl-btn-group"], parent: at() }) });
  assert.deepEqual(scaleOf(kitOnly, member), [1, 1], "components.css alone");
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
/** A check or radio box in its label: html > body > [band >] label > input + box. */
function choiceBox(kind, theme, { product = null, band = false, checked = false, root = null } = {}) {
  const parent = root ?? at(theme, { product, band });
  const label = el({ tag: "label", classes: [`sl-${kind}`], parent });
  const input = el({ tag: "input", classes: [`sl-${kind}__input`], states: checked ? ["checked"] : [], parent: label });
  return el({ tag: "span", classes: [`sl-${kind}__box`], parent: label, prev: input });
}
const checkBox = (theme, o = {}) => choiceBox("check", theme, o);

test("the check box is Lumen's r5 on the canvas, and checked it is the fill set as before", () => {
  const b = checkBox("dark");
  assert.equal(value(KIT_RULES, b, "border-radius"), "5px");
  assert.equal(value(KIT_RULES, b, "background"), "var(--slc-canvas)");
  const on = checkBox("dark", { checked: true });
  assert.equal(value(KIT_RULES, on, "background"), "var(--_sl-fill)");
  assert.equal(value(KIT_RULES, on, "border-color"), "var(--_sl-fill-edge)");
  const radio = choiceBox("radio", "dark");
  assert.equal(value(KIT_RULES, radio, "border-radius"), "50%", "the radio keeps its round box");
});

test("a check box and a radio are the same well: the canvas on the page, the band's sunken wash in a band, the fill set when checked", () => {
  for (const theme of ["light", "dark", "high-contrast"]) for (const band of [false, true]) {
    const want = band ? "var(--slc-sunken)" : "var(--slc-canvas)";
    const [c, r] = ["check", "radio"].map((k) => choiceBox(k, theme, { band }));
    assert.equal(value(KIT_RULES, c, "background"), want, `${theme}${band ? " band" : ""}: check`);
    assert.equal(value(KIT_RULES, r, "background"), want, `${theme}${band ? " band" : ""}: radio`);
    if (!band) assert.equal(toHex(evaluate(want, customs(KIT_RULES, c))), toHex(evaluate(want, customs(KIT_RULES, r))), `${theme}: one colour`);
    for (const k of ["check", "radio"]) {
      assert.equal(value(KIT_RULES, choiceBox(k, theme, { band, checked: true }), "background"), "var(--_sl-fill)", `${theme}${band ? " band" : ""}: a checked ${k} is the fill set`);
    }
  }
  // the field and the switch track keep the sunken rung
  assert.equal(value(KIT_RULES, el({ tag: "input", classes: ["sl-field__input"], parent: at() }), "background"), "var(--slc-sunken)");
  assert.equal(value(KIT_RULES, el({ tag: "span", classes: ["sl-switch__track"], parent: at() }), "background"), "var(--slc-sunken)");
});

/** A Tier B page: no theme file; its own [data-theme] layer maps the role-vars from the product's neutrals. */
const TIER_B_RULES = (() => {
  const map = PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
    const n = NEUTRALS[p][t];
    const roles = { "--slc-canvas": n["bg-canvas"], "--slc-surface": n["bg-surface"], "--slc-raised": n["bg-surface-raised"], "--slc-text": n["text-primary"],
      "--slc-text-secondary": n["text-secondary"], "--slc-text-muted": n["text-muted"], "--slc-border": n["border-default"], "--slc-border-subtle": n["border-subtle"], "--slc-border-strong": n["border-strong"] };
    return `:root[data-product="${p}"][data-theme="${t}"] { ${Object.entries(roles).map(([k, v]) => `${k}: ${v};`).join(" ")} }`;
  })).join("\n");
  let o = 0;
  return ["tokens.css", "components.css"].map(read).concat(map).flatMap((css) => { const r = parseSheet(css, {}, o); o += r.length + 1; return r; });
})();

test("the check and radio edge finds the box at 3:1 on canvas, surface, raised and tile, on every product, on Tier B and in high contrast", () => {
  const out = [];
  const check = (name, env, grounds) => {
    const edge = evaluate("var(--slc-edge-control)", env);
    for (const [g, colour] of Object.entries(grounds)) {
      const r = ratio(edge, colour);
      if (r < 3) out.push(`${name}: edge on ${g} ${r.toFixed(2)}`);
    }
  };
  const GROUNDS = ["--slc-canvas", "--slc-surface", "--slc-raised", "--slc-tile"];
  for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
    // Tier A, on the page (the canvas is also the box's own well)
    const env = customs(KIT_RULES, checkBox(theme, { product }));
    check(`${theme} ${product}`, env, Object.fromEntries(GROUNDS.map((g) => [g, evaluate(`var(${g})`, env)])));
    // Tier B: the product's own [data-theme] layer, no theme file
    const root = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-theme": theme, "data-product": product } }) });
    const tb = choiceBox("check", theme, { root });
    assert.equal(value(TIER_B_RULES, tb, "background"), "var(--slc-canvas)");
    const benv = customs(TIER_B_RULES, tb);
    check(`Tier B ${theme} ${product}`, benv, Object.fromEntries(GROUNDS.map((g) => [g, evaluate(`var(${g})`, benv)])));
  }
  const hc = customs(KIT_RULES, checkBox("high-contrast"));
  check("high contrast", hc, { "--slc-canvas": evaluate("var(--slc-canvas)", hc), "--slc-surface": evaluate("var(--slc-surface)", hc) });
  assert.deepEqual(out, []);
});

// KNOWN GAP, NOT K10's (it is the same on 0.35.0): in an inversion band every
// control's edge is the band's strong line, 38% of the band's ink
// (.sl-invert > * { --slc-edge-control: var(--slc-border-strong) }), and that
// reads under 3:1 there -- 2.52 against the dark theme's light band, 2.86
// against a box's own wash on the light theme's dark band. 0.36 changes
// neither the box's edge nor its well in the band, so this fence holds the
// box to the band's one control edge, to a wash (never a solid of the band's
// ink) and to its 0.35 figures; raising the band's control edge is a change
// to every control in a band, left to the owner.
test("in a band a check or radio box is a wash in the band's one control edge, no weaker than on 0.35 (a known kit-wide gap under 3:1)", () => {
  const FLOOR = { light: { ground: 3.0, wash: 2.85 }, dark: { ground: 2.5, wash: 2.3 } };
  const out = [];
  for (const kind of ["check", "radio"]) for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
    const b = choiceBox(kind, theme, { product, band: true });
    const child = b.parent.parent;
    assert.equal(value(KIT_RULES, b, "border"), "1px solid var(--slc-edge-control)", "the one control edge");
    assert.equal(value(KIT_RULES, child, "--slc-edge-control"), "var(--slc-border-strong)", "the band's control edge, as for every control there");
    const env = customs(KIT_RULES, b);
    const ground = evaluate("var(--slc-text)", customs(KIT_RULES, child.parent));
    const ink = toHex(evaluate("var(--slc-canvas)", env));
    const sunken = value(KIT_RULES, child, "--slc-sunken");
    assert.match(sunken, /currentColor 4%, transparent/);
    const wash = evaluate(sunken.replace(/currentColor/g, ink), env);
    assert.ok(wash.alpha < 0.1, `${kind} ${theme} ${product}: a wash over the band's ground, never a solid of its ink ${ink}`);
    const edge = over(evaluate(value(KIT_RULES, child, "--slc-border-strong").replace(/currentColor/g, ink), env), ground);
    for (const [g, colour] of [["ground", ground], ["wash", over(wash, ground)]]) {
      const r = ratio(edge, colour);
      if (r < FLOOR[theme][g]) out.push(`${kind} ${theme} ${product} band: edge on the ${g} ${r.toFixed(2)} < ${FLOOR[theme][g]}`);
    }
  }
  assert.deepEqual(out, []);
});
