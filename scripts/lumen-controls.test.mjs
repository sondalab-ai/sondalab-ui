import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseSheet, el, box, cascaded, customs, longhand, px, splitList } from "./lib/cascade.mjs";
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

// ── the control edge in an inversion band (0.36.1) ───────────────────────────

// In a band every control is found by the band's own control edge: the band's
// ink (--slc-canvas, which the band never re-derives) at a share read off the
// ink's lightness, 48% on the light theme's dark band and 53% on the dark and
// high-contrast themes' light bands -- the least that clears 3:1 against the
// band's ground and against the raised wash a secondary paints. Until 0.36.1
// it was the band's strong line, 38% of currentColor: 2.52:1 on the dark
// theme's band, 2.31 against a box's own wash, and less on any control set in
// a lighter ink, because currentColor in a custom property is read where the
// property is used (a chip, in the muted 60%, drew its edge at 23%: 1.67:1).

/** The colour currentColor is on an element: its own `color`, read against
 *  the colour it inherits, or the one it inherits. */
function colourOf(rules, e) {
  const inherited = e.parent ? colourOf(rules, e.parent) : null;
  const d = cascaded(rules, e).get("color");
  return d ? paint(rules, e, d.value, inherited) : inherited;
}
/** A colour expression as an element paints it, currentColor as `current`
 *  (by default the element's own colour). */
function paint(rules, e, expr, current = colourOf(rules, e)) {
  const env = customs(rules, e);
  let text = substitute(expr, env);
  if (/currentcolor/i.test(text)) {
    assert.ok(current, `currentColor with no colour to read: ${expr}`);
    const [r, g, b] = toSrgb(current);
    text = text.replace(/currentcolor/gi, `color(srgb ${r} ${g} ${b} / ${current.alpha})`);
  }
  return evaluate(text, env);
}
const rank = (d) => [d.important ? 1 : 0, ...d.spec, d.order, d.at];
const later = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
/** The colour expression a box's border is drawn in: its border-color or the
 *  colour in its border shorthand, whichever wins. */
function borderOf(rules, e) {
  const won = cascaded(rules, e);
  const long = won.get("border-color"), short = won.get("border");
  if (long && (!short || later(long, short))) return long.value.trim();
  const m = short?.value.trim().match(/^\S+\s+solid\s+(.+)$/);
  assert.ok(m, `a drawn border: ${short?.value}`);
  return m[1];
}
const fillOf = (rules, e) => longhand(cascaded(rules, e), "background-color")?.value.trim() ?? "transparent";

/** The band's children, Tier A (the kit's theme files) or Tier B (a product's
 *  own [data-theme] layer): [name, rules, the band's child]. */
function bands() {
  const out = [];
  for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
    out.push([`${theme} ${product}`, KIT_RULES, at(theme, { band: true, product })]);
    const body = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-theme": theme, "data-product": product } }) });
    out.push([`Tier B ${theme} ${product}`, TIER_B_RULES, el({ parent: el({ classes: ["sl-invert"], parent: body }) })]);
  }
  out.push(["high contrast", KIT_RULES, at("high-contrast", { band: true })]);
  return out;
}
/** Every control that draws the one control edge, built in a band's child. */
const BAND_CONTROLS = {
  check: (p) => choiceBox("check", null, { root: p }),
  radio: (p) => choiceBox("radio", null, { root: p }),
  switch: (p) => { const label = el({ tag: "label", classes: ["sl-switch"], parent: p }); return el({ tag: "span", classes: ["sl-switch__track"], parent: label, prev: el({ tag: "input", classes: ["sl-switch__input"], parent: label }) }); },
  field: (p) => el({ tag: "input", classes: ["sl-field__input"], parent: el({ classes: ["sl-field"], parent: p }) }),
  select: (p) => el({ tag: "select", classes: ["sl-field__input"], parent: el({ tag: "span", classes: ["sl-field__control", "sl-select"], parent: p }) }),
  segmented: (p) => el({ classes: ["sl-segmented"], parent: p }),
  secondary: (p) => el({ tag: "button", classes: ["sl-btn", "sl-btn--ghost"], parent: p }),
  chip: (p) => el({ tag: "button", classes: ["sl-chip"], attrs: { "aria-pressed": "false" }, parent: el({ classes: ["sl-chips"], parent: p }) }),
  "icon button": (p) => el({ tag: "button", classes: ["sl-icon-btn"], parent: p }),
  "button group": (p) => el({ classes: ["sl-btn-group"], parent: p }),
};
/** The band's ground (the page's ink) under a band's child. */
const groundOf = (rules, child) => paint(rules, child.parent, fillOf(rules, child.parent));
/** The edge drawn in a band, as the conservative model reads it: the edge over
 *  the band's ground, against the ground and against the control's own face
 *  (its fill over the ground). A fill painted under the border, as Chrome
 *  paints it, only adds to both. */
function bandEdge(rules, child, e) {
  const ground = groundOf(rules, child);
  const edge = over(paint(rules, e, borderOf(rules, e)), ground);
  const face = over(paint(rules, e, fillOf(rules, e)), ground);
  return { ground, edge, face, onGround: ratio(edge, ground), onFace: ratio(edge, face) };
}

test("in a band every control's edge reads 3:1 against the band and against its own face, on every product, Tier A and B, and in high contrast", () => {
  const out = [];
  const lows = {};
  for (const [band, rules, child] of bands()) {
    for (const [name, make] of Object.entries(BAND_CONTROLS)) {
      const e = make(child);
      assert.equal(paint(rules, e, borderOf(rules, e)).alpha < 1, true, `${band} ${name}: a share of the band's ink, never a solid`);
      const { onGround, onFace } = bandEdge(rules, child, e);
      const key = band.replace(/^Tier B /, "").split(" ")[0];
      lows[key] = Math.min(lows[key] ?? 99, onGround, onFace);
      if (onGround < 3) out.push(`${band} ${name}: edge on the band ${onGround.toFixed(2)}`);
      if (onFace < 3) out.push(`${band} ${name}: edge on its own face (${fillOf(rules, e)}) ${onFace.toFixed(2)}`);
    }
  }
  assert.deepEqual(out, []);
  // the least that clears 3:1, not more -- IN THIS MODEL ONLY (the edge over
  // the bare band): the tightest control on each band computes under 3.5
  // (0.36.1: 3.13 light, 3.07 dark, 3.36 high contrast). Chrome draws the
  // border over the control's own fill and reads higher (3.4:1 or more in
  // its pixels at DPR 4), so this ceiling is not a rendered figure; a
  // deliberate raise moves it.
  for (const [k, v] of Object.entries(lows)) assert.ok(v < 3.5, `${k}: the band's tightest edge ${v.toFixed(2)}`);
});

test("the band's control edge is its ink at a share, never currentColor, so a control in a lighter ink keeps it (fails on 0.36.0)", () => {
  // currentColor in a custom property is read where it is used: on 0.36.0 a
  // chip (muted, 60%) drew the band's 38% at 23%, an icon button (secondary,
  // 78%) at 30%. Read through each control's own colour, every control in a
  // band draws the same edge as the check box beside it.
  const band = read("components.css").match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  for (const role of ["--slc-edge-control", "--slc-edge-control-hover"]) {
    const v = band.match(new RegExp(`${role}:\\s*([^;]+);`))?.[1] ?? "";
    assert.match(v, /var\(--slc-canvas\)/, `${role}: the band's ink`);
    assert.doesNotMatch(v, /currentColor/i, `${role}: not currentColor`);
  }
  for (const [name, rules, child] of bands()) {
    const box = paint(rules, BAND_CONTROLS.check(child), "var(--slc-edge-control)");
    for (const c of ["chip", "icon button", "secondary"]) {
      const e = BAND_CONTROLS[c](child);
      assert.equal(toHex(paint(rules, e, borderOf(rules, e))), toHex(box), `${name} ${c}`);
      assert.ok(Math.abs(paint(rules, e, borderOf(rules, e)).alpha - box.alpha) < 1e-9, `${name} ${c}: alpha`);
    }
  }
});

test("hovered, a control in a band steps further: above its rest edge, and 3:1 on its hover face", () => {
  const out = [];
  const HOVER = [["secondary", (p) => el({ tag: "button", classes: ["sl-btn", "sl-btn--ghost"], states: ["hover"], parent: p })],
    ["chip", (p) => el({ tag: "button", classes: ["sl-chip"], attrs: { "aria-pressed": "false" }, states: ["hover"], parent: p })],
    ["icon button", (p) => el({ tag: "button", classes: ["sl-icon-btn"], states: ["hover"], parent: p })],
    ["field", (p) => el({ tag: "input", classes: ["sl-field__input"], states: ["hover"], parent: p })]];
  for (const [band, rules, child] of bands()) for (const [name, make] of HOVER) {
    const rest = bandEdge(rules, child, BAND_CONTROLS[name](child)), hov = bandEdge(rules, child, make(child));
    // high contrast draws the secondary and the icon button in its one line
    // whatever their state, in a band as on its page: hovered, the tile says it
    if (band === "high contrast" && ["secondary", "icon button"].includes(name)) {
      if (toHex(hov.edge) !== toHex(rest.edge)) out.push(`${band} ${name}: hover ${toHex(hov.edge)}, rest ${toHex(rest.edge)}`);
    } else if (!(hov.onGround > rest.onGround)) out.push(`${band} ${name}: hover ${hov.onGround.toFixed(2)} not above rest ${rest.onGround.toFixed(2)}`);
    if (Math.min(hov.onGround, hov.onFace) < 3) out.push(`${band} ${name} hovered: ${hov.onGround.toFixed(2)} / ${hov.onFace.toFixed(2)} on its face`);
  }
  assert.deepEqual(out, []);
});

test("in a band the switch's knob reads 3:1 on its track, and the box stays a wash of the band, never a solid of its ink", () => {
  const out = [];
  for (const [band, rules, child] of bands()) {
    const track = BAND_CONTROLS.switch(child);
    const knob = el({ pseudo: "after", parent: track });
    assert.equal(fillOf(rules, knob), "var(--slc-edge-control)", "the off knob is the control edge");
    const { ground, face } = bandEdge(rules, child, track);
    const k = over(paint(rules, knob, fillOf(rules, knob), colourOf(rules, track)), face);
    if (ratio(k, face) < 3) out.push(`${band}: knob on its track ${ratio(k, face).toFixed(2)}`);
    for (const kind of ["check", "radio"]) {
      const b = BAND_CONTROLS[kind](child);
      assert.equal(fillOf(rules, b), "var(--slc-sunken)", `${band} ${kind}: the band's sunken wash`);
      assert.ok(paint(rules, b, fillOf(rules, b)).alpha < 0.1, `${band} ${kind}: a wash over ${toHex(ground)}`);
    }
  }
  assert.deepEqual(out, []);
});

test("in a band a button group's faces are its members' own, its rules the control edge: members' text 4.5:1, rules 3:1", () => {
  // The group's ground is its rule colour, which its members' opaque surface
  // hides everywhere but the 1px gaps. In a band the surface is a 7% wash,
  // so on 0.36.0 the rule colour showed across every face (member text 4.08:1
  // on the light theme's band, the rules 1.13:1 against the faces). There the
  // group paints no ground, and each member after the first draws the rule
  // to its left as its depth.
  const out = [];
  for (const [band, rules, child] of bands()) {
    const group = BAND_CONTROLS["button group"](child);
    const first = el({ tag: "button", classes: ["sl-btn", "sl-btn--ghost"], parent: group });
    const second = el({ tag: "button", classes: ["sl-btn", "sl-btn--ghost"], parent: group, prev: first });
    const ground = over(paint(rules, group, fillOf(rules, group)), groundOf(rules, child));
    const depth = value(rules, second, "--_sl-depth");
    const m = depth.match(/^-1px 0 0 (.+)$/);
    assert.ok(m, `${band}: the rule is the member's depth, 1px to its left (${depth})`);
    assert.equal(value(rules, first, "--_sl-depth"), "0 0 transparent", `${band}: the first member draws none`);
    const rule = over(paint(rules, second, m[1]), ground);
    for (const member of [first, second]) {
      const face = over(paint(rules, member, fillOf(rules, member)), ground);
      const text = over(colourOf(rules, member), face);
      if (ratio(text, face) < 4.5) out.push(`${band}: member text ${ratio(text, face).toFixed(2)}`);
      if (ratio(rule, face) < 3) out.push(`${band}: rule on a member ${ratio(rule, face).toFixed(2)}`);
    }
  }
  assert.deepEqual(out, []);
  // right to left the gap is on the member's other side (the test cascade
  // does not read :dir(), so the rule is read off the sheet)
  assert.match(read("components.css"), /\.sl-invert \.sl-btn-group > \.sl-btn \+ \.sl-btn:dir\(rtl\) \{ --_sl-depth: 1px 0 0 var\(--slc-edge-control\); \}/);
});

// KNOWN GAP (0.36.1): glass owns its host's box-shadow, so a glass member of
// a band group does not paint the rule its depth carries; between two glass
// members only their soft inner lines (the control edge at half strength)
// and the band's ground in the 1px gap say where one ends. Measured 1.98:1
// against the band and 1.69 against a face on the light theme's dark band,
// 1.84 and 1.59 on the dark theme's light band (it was 1.13 against the faces
// on 0.36.0, when the group's ground showed through them). High contrast's
// kill switch gives the depth back, so there the rule paints. This fence holds
// the figures where they are until the gap is closed.
test("in a band a group of glass members keeps only its soft inner lines (a known gap, no weaker than on 0.36.1)", () => {
  const FLOOR = { light: { ground: 1.95, face: 1.65 }, dark: { ground: 1.8, face: 1.55 } };
  const GLASS = ["sl-btn", "sl-btn--ghost", "sl-fx-glass", "sl-fx-glass--pane", "sl-glass"];
  const out = [];
  for (const [band, rules, child] of bands()) {
    if (band.startsWith("Tier B")) continue; // the Tier B cascade here loads no effects.css
    const group = BAND_CONTROLS["button group"](child);
    const first = el({ tag: "button", classes: GLASS, parent: group });
    const second = el({ tag: "button", classes: GLASS, parent: group, prev: first });
    const ground = over(paint(rules, group, fillOf(rules, group)), groundOf(rules, child));
    const face = over(paint(rules, second, fillOf(rules, second)), ground);
    const shadow = cascaded(rules, second).get("box-shadow").value;
    if (band === "high contrast") {
      assert.match(shadow, /^var\(--_sl-depth/, "high contrast: the kill switch gives the depth back");
      const rule = over(paint(rules, second, value(rules, second, "--_sl-depth").match(/^-1px 0 0 (.+)$/)[1]), ground);
      if (ratio(rule, face) < 3) out.push(`${band}: rule on a glass member ${ratio(rule, face).toFixed(2)}`);
      continue;
    }
    assert.doesNotMatch(shadow, /--_sl-depth/, `${band}: glass owns the shadow, so the rule does not paint (the gap)`);
    const soft = over(paint(rules, second, "var(--slfx-control-edge-soft)"), ground);
    const floor = FLOOR[band.split(" ")[0]];
    for (const [g, colour] of [["ground", ground], ["face", face]]) {
      const r = ratio(soft, colour);
      if (r < floor[g]) out.push(`${band}: soft line on the ${g} ${r.toFixed(2)} < ${floor[g]}`);
    }
  }
  assert.deepEqual(out, []);
});

// ── state indicators and boundaries at 3:1 (0.36.2) ──────────────────────────

// Three gaps the 0.36.1 review measured in Chrome 154, each a boundary or a
// state indicator under the owner's 3:1:
//  1. a pressed toggle's edge was its 12% wash in shade, 1.01-1.36:1 on the
//     page and 1.04-1.41 in a band, and nothing about "on" read 3:1 against
//     the toggle at rest (the wash and the ink, 1.0-2.6:1);
//  2. an accent fill in a band: a primary's edge read 1.71:1 on the dark
//     theme's light band (introspect) and 1.07 on high contrast's white one,
//     and a dark fill hovered or pressed sank to 1.58 on the light theme's
//     dark band (local-agents);
//  3. a checked check box, radio or switch in a band, the same fill set:
//     1.07:1 on high contrast's band, 1.71 on the dark theme's (introspect).
// Read with each registered product's own accent: Tier A as the README's
// "Per-product accent" wires it, with products.css (its neutrals and fill);
// Tier B as a [data-theme] layer mapping the accent, its label, its fill, its
// neutrals and the README's light- and dark-layer numbers. The comparison a
// state indicator is held to is the ground beside it and the toggle at rest
// in the same spot; a pressed edge against the rest edge is not one (the
// accent and the neutral edge sit at the same lightness, about 1.0-1.9:1), so
// "on" is carried by a mark rest does not draw: the seam, or the chip's dot.

const REG = JSON.parse(read("agent/accent-registry.json")).products;
const productOf = (id) => (REG[id].inherits ? { ...REG[REG[id].inherits], ...REG[id] } : REG[id]);
const README_TEXT = readFileSync(resolve(KIT, "README.md"), "utf8");
const README_LAYER = Object.fromEntries(["light", "dark"].map((t) => {
  const block = README_TEXT.match(new RegExp(`\`\`\`css\\n:root\\[data-theme="${t}"\\] \\{\\n([\\s\\S]*?)\\}\\n\`\`\``));
  return [t, Object.fromEntries([...block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))];
}));
const STATE_PAGE = "html, body { background-color: var(--slc-canvas); color: var(--slc-text); }";
const STATE_ACCENTS = PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
  const a = productOf(p), steps = a.steps?.[t] ? Object.entries(a.steps[t]).map(([k, v]) => ` --sl-accent-${k}: ${v};`).join("") : "";
  return `:root[data-sl-product="${p}"][data-sl-theme="${t}"] { --sl-accent-default: ${a[t]};${t === "dark" ? ` --sl-focus-ring: ${a[t]};` : ""}${steps} }`;
})).join("\n");
const STATE_TIER_B = PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
  const a = productOf(p), n = NEUTRALS[p][t];
  const map = {
    "--slc-accent": a[t], "--slc-on-accent": "oklch(from var(--slc-accent) var(--_sl-on))", ...(a.fill?.[t] ? { "--slc-accent-fill": a.fill[t] } : {}), "--slc-focus": "var(--slc-accent-text)",
    "--slc-canvas": n["bg-canvas"], "--slc-surface": n["bg-surface"], "--slc-raised": n["bg-surface-raised"], "--slc-text": n["text-primary"],
    "--slc-text-secondary": n["text-secondary"], "--slc-text-muted": n["text-muted"], "--slc-border": n["border-default"], "--slc-border-subtle": n["border-subtle"],
    "--slc-border-strong": n["border-strong"], "--slc-tile": n["bg-tile"], "--slc-sunken": n["bg-sunken"], "--slc-lit": n["border-lit"], ...README_LAYER[t],
  };
  return `:root[data-product="${p}"][data-theme="${t}"] { ${Object.entries(map).map(([k, v]) => `${k}: ${v};`).join(" ")} }`;
})).join("\n");
const stateRules = (texts) => { let o = 0; return texts.flatMap((css) => { const r = parseSheet(css, {}, o); o += r.length + 1; return r; }); };
const STATE_A = stateRules([...["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css", "themes/products.css", "components.css", "workbench.css", "effects.css"].map(read), STATE_ACCENTS, STATE_PAGE]);
const STATE_B = stateRules([...["tokens.css", "components.css", "workbench.css"].map(read), STATE_TIER_B, STATE_PAGE]);
/** Every product, light and dark, Tier A and B, and high contrast. */
const STATE_CONTEXTS = [
  ...PRODUCTS.flatMap((p) => ["light", "dark"].flatMap((t) => [
    { name: `${t} ${p}`, rules: STATE_A, attrs: { "data-sl-theme": t, "data-sl-product": p } },
    { name: `Tier B ${t} ${p}`, rules: STATE_B, attrs: { "data-theme": t, "data-product": p } },
  ])),
  { name: "high contrast", rules: STATE_A, attrs: { "data-sl-theme": "high-contrast" } },
];
/** The parent a control is built in, on the page (body) or in a band (the band's child). */
function mountIn(ctx, band) {
  const body = el({ tag: "body", parent: el({ tag: "html", attrs: ctx.attrs }) });
  return band ? el({ parent: el({ classes: ["sl-invert"], parent: body }) }) : body;
}
/** The opaque ground under a control's parent: the canvas, or the band's own fill. */
const groundIn = (rules, parent, band) => (band ? groundOf(rules, parent) : paint(rules, parent, "var(--slc-canvas)"));
/** The colour of the first layer of a background image that is a seam (a
 *  linear gradient of one colour), or null. */
function seamOf(rules, e) {
  const won = cascaded(rules, e), long = won.get("background-image"), short = won.get("background");
  // the background shorthand resets the image unless it names one
  const img = long && (!short || later(long, short)) ? long.value.trim() : (short?.value.match(/linear-gradient\(.*\)/)?.[0] ?? "none");
  const first = splitList(img)[0] ?? "";
  const m = first.match(/^linear-gradient\((.+)\)$/);
  if (!m) return null;
  const [a, b] = splitList(m[1]);
  assert.equal(a, b, `a seam is one colour: ${first}`);
  return paint(rules, e, a);
}

/** Every pressed toggle: [name, build(parent, { on, states }), its indicator, page only?]. */
const TOGGLES = [
  ["plain button", (p, o) => el({ tag: "button", classes: ["sl-btn"], attrs: { "aria-pressed": String(o.on) }, states: o.states, parent: p }), "seam"],
  ["secondary", (p, o) => el({ tag: "button", classes: ["sl-btn", "sl-btn--ghost"], attrs: { "aria-pressed": String(o.on) }, states: o.states, parent: p }), "seam"],
  ["small secondary", (p, o) => el({ tag: "button", classes: ["sl-btn", "sl-btn--ghost", "sl-btn--sm"], attrs: { "aria-pressed": String(o.on) }, states: o.states, parent: p }), "seam"],
  ["icon button", (p, o) => el({ tag: "button", classes: ["sl-icon-btn"], attrs: { "aria-pressed": String(o.on) }, states: o.states, parent: p }), "seam"],
  ["title-bar button", (p, o) => el({ tag: "button", classes: ["sl-icon-btn", "sl-titlebar__btn"], attrs: { "aria-pressed": String(o.on) }, states: o.states, parent: el({ classes: ["sl-titlebar__r"], parent: p }) }), "seam", true],
  ["chip", (p, o) => el({ tag: "button", classes: ["sl-chip"], attrs: { "aria-pressed": String(o.on) }, states: o.states, parent: el({ classes: ["sl-chips"], parent: p }) }), "dot"],
];
/** A toggle's indicator colour and the face it is read on, or null. */
function indicatorOf(rules, e, kind) {
  if (kind === "seam") return seamOf(rules, e);
  const dot = el({ pseudo: "before", parent: e });
  const fill = fillOf(rules, dot);
  return fill === "transparent" ? null : paint(rules, dot, fill, colourOf(rules, e));
}

test("a pressed toggle is found by the one control edge at 3:1, against its ground and its own wash, pressed and hovered, on the page and in a band (fails on 0.36.1)", () => {
  const out = [];
  for (const ctx of STATE_CONTEXTS) for (const band of [false, true]) for (const [name, make, , pageOnly] of TOGGLES) {
    if (band && pageOnly) continue; // the title bar is a workbench's frame, never in a band
    const parent = mountIn(ctx, band);
    const ground = groundIn(ctx.rules, parent, band);
    for (const states of [[], ["hover"]]) {
      const e = make(parent, { on: true, states });
      const edge = over(paint(ctx.rules, e, borderOf(ctx.rules, e)), ground);
      const face = over(paint(ctx.rules, e, fillOf(ctx.rules, e)), ground);
      const where = `${ctx.name} ${band ? "band" : "page"} ${name}${states.length ? " hovered" : ""}`;
      if (ratio(edge, ground) < 3) out.push(`${where}: edge on the ground ${ratio(edge, ground).toFixed(2)}`);
      if (ratio(edge, face) < 3) out.push(`${where}: edge on its wash ${ratio(edge, face).toFixed(2)}`);
    }
  }
  assert.deepEqual(out, []);
  // the role: the one control edge, the accent's where high contrast draws selection in it
  const html = el({ tag: "html", attrs: { "data-sl-theme": "dark" } });
  assert.equal(cascaded(STATE_A, html).get("--slc-edge-pressed").value, "var(--slc-edge-control)");
  assert.equal(cascaded(STATE_A, el({ parent: el({ classes: ["sl-invert"], parent: el({ tag: "body", parent: html }) }) })).get("--slc-edge-pressed").value, "var(--slc-edge-control)", "the band's own control edge");
  assert.equal(cascaded(STATE_A, el({ tag: "html", attrs: { "data-sl-theme": "high-contrast" } })).get("--slc-edge-pressed").value, "var(--slc-accent)");
});

test("a pressed toggle says so with a mark rest does not draw, at 3:1 against its wash and against the toggle at rest: the seam, or the chip's dot (fails on 0.36.1)", () => {
  const out = [];
  for (const ctx of STATE_CONTEXTS) for (const band of [false, true]) for (const [name, make, kind, pageOnly] of TOGGLES) {
    if (band && pageOnly) continue;
    const parent = mountIn(ctx, band);
    const ground = groundIn(ctx.rules, parent, band);
    const rest = make(parent, { on: false, states: [] });
    const restFace = over(paint(ctx.rules, rest, fillOf(ctx.rules, rest)), ground);
    if (indicatorOf(ctx.rules, rest, kind)) out.push(`${ctx.name} ${name}: rest draws the ${kind} too`);
    for (const states of [[], ["hover"]]) {
      const e = make(parent, { on: true, states });
      const where = `${ctx.name} ${band ? "band" : "page"} ${name}${states.length ? " hovered" : ""}`;
      const mark = indicatorOf(ctx.rules, e, kind);
      if (!mark) { out.push(`${where}: no ${kind}`); continue; }
      const face = over(paint(ctx.rules, e, fillOf(ctx.rules, e)), ground);
      const ink = over(mark, face);
      if (ratio(ink, face) < 3) out.push(`${where}: ${kind} on its wash ${ratio(ink, face).toFixed(2)}`);
      if (ratio(over(mark, restFace), restFace) < 3) out.push(`${where}: ${kind} against the toggle at rest ${ratio(over(mark, restFace), restFace).toFixed(2)}`);
    }
  }
  assert.deepEqual(out, []);
  // the seam is the segment's: a 2px line, 40% wide, 3px above the bottom edge (1px on a small button)
  const pressed = (cls) => el({ tag: "button", classes: cls, attrs: { "aria-pressed": "true" }, parent: at() });
  const geometry = (cls) => { const e = pressed(cls), env = customs(STATE_A, e), won = cascaded(STATE_A, e);
    return ["background-size", "background-position"].map((p) => substitute(won.get(p).value, env)); };
  assert.deepEqual(geometry(["sl-btn", "sl-btn--ghost"]), ["40% 2px, auto", "50% calc(100% - 3px), 0 0"]);
  assert.deepEqual(geometry(["sl-icon-btn"]), ["40% 2px, auto", "50% calc(100% - 3px), 0 0"]);
  assert.deepEqual(geometry(["sl-btn", "sl-btn--ghost", "sl-btn--sm"]), ["40% 2px, auto", "50% calc(100% - 1px), 0 0"]);
  assert.equal(cascaded(STATE_A, pressed(["sl-btn", "sl-btn--primary"])).get("background-image").value, "linear-gradient(var(--_sl-foot-color, var(--_sl-fill-edge)), var(--_sl-foot-color, var(--_sl-fill-edge)))", "a primary never toggles: its foot, no seam");
  // a built glass pane paints its tint over the host's background: its specular layer draws the seam again, from the same values
  for (const cls of [["sl-btn", "sl-btn--ghost"], ["sl-icon-btn"], ["sl-btn", "sl-btn--sm"]]) {
    const host = pressed([...cls, "sl-fx-glass", "sl-fx-glass--pane", "sl-glass"]);
    const spec = el({ tag: "span", classes: ["sl-glass__specular"], parent: host });
    const bg = substitute(cascaded(STATE_A, spec).get("background").value, customs(STATE_A, spec));
    assert.equal(bg, `linear-gradient(${substitute("var(--slc-seam)", customs(STATE_A, spec))}, ${substitute("var(--slc-seam)", customs(STATE_A, spec))}) no-repeat ${geometry(cls)[1].split(", ")[0]} / 40% 2px`, cls.join(" "));
  }
  // ...on the page only: in a band the glass tint is the page's canvas, a known gap the seam cannot cure
  const inBand = el({ tag: "button", classes: ["sl-btn", "sl-btn--ghost", "sl-fx-glass", "sl-fx-glass--pane", "sl-glass"], attrs: { "aria-pressed": "true" }, parent: at("dark", { band: true }) });
  assert.equal(cascaded(STATE_A, el({ tag: "span", classes: ["sl-glass__specular"], parent: inBand })).get("background"), undefined, "no seam on the specular in a band");
});

/** A checked control in its label: [the painted box or track, its knob or mark, the same control unchecked]. */
const CHECKED = {
  check: (p, checked) => choiceBox("check", null, { root: p, checked }),
  mixed: (p) => { const label = el({ tag: "label", classes: ["sl-check"], parent: p }); return el({ tag: "span", classes: ["sl-check__box"], parent: label, prev: el({ tag: "input", classes: ["sl-check__input"], states: ["indeterminate"], parent: label }) }); },
  radio: (p, checked) => choiceBox("radio", null, { root: p, checked }),
  switch: (p, checked) => { const label = el({ tag: "label", classes: ["sl-switch"], parent: p }); return el({ tag: "span", classes: ["sl-switch__track"], parent: label, prev: el({ tag: "input", classes: ["sl-switch__input"], states: checked ? ["checked"] : [], parent: label }) }); },
};

test("in a band a primary is found by its edge at 3:1 at rest, hovered and pressed, plain or danger, and its label holds 4.5:1 on its fill (fails on 0.36.1)", () => {
  const out = [];
  for (const ctx of STATE_CONTEXTS) {
    const parent = mountIn(ctx, true);
    const ground = groundIn(ctx.rules, parent, true);
    for (const tone of [[], ["sl-btn--danger"]]) for (const size of [[], ["sl-btn--sm"]]) for (const states of [[], ["hover"], ["active", "hover"]]) {
      const b = el({ tag: "button", classes: ["sl-btn", "sl-btn--primary", ...tone, ...size], states, parent });
      const where = `${ctx.name} ${tone.length ? "danger " : ""}primary${size.length ? " small" : ""} ${states[0] ?? "rest"}`;
      const edge = over(paint(ctx.rules, b, borderOf(ctx.rules, b)), ground);
      const fill = over(paint(ctx.rules, b, fillOf(ctx.rules, b)), ground);
      if (ratio(edge, ground) < 3) out.push(`${where}: edge on the band ${ratio(edge, ground).toFixed(2)}`);
      if (ratio(over(colourOf(ctx.rules, b), fill), fill) < 4.5) out.push(`${where}: label ${ratio(over(colourOf(ctx.rules, b), fill), fill).toFixed(2)}`);
    }
  }
  assert.deepEqual(out, []);
  // the page keeps its own edge: the fill in shade, capped on paper
  for (const ctx of STATE_CONTEXTS) {
    const b = el({ tag: "button", classes: ["sl-btn", "sl-btn--primary"], parent: mountIn(ctx, false) });
    assert.equal(cascaded(ctx.rules, b).get("--_sl-fill-edge").value, "var(--slc-edge-accent)", `${ctx.name}: the page is untouched`);
  }
});

test("in a band a checked check box, radio or switch is found by its edge at 3:1, its tick, dot or knob reads 3:1 on the fill, and its fill or that mark reads 3:1 where the unchecked control is (fails on 0.36.1)", () => {
  const out = [];
  for (const ctx of STATE_CONTEXTS) {
    const parent = mountIn(ctx, true);
    const ground = groundIn(ctx.rules, parent, true);
    for (const [name, make] of Object.entries(CHECKED)) {
      const on = make(parent, true), off = (name === "mixed" ? CHECKED.check : make)(parent, false);
      const where = `${ctx.name} ${name}`;
      const edge = over(paint(ctx.rules, on, borderOf(ctx.rules, on)), ground);
      const fill = over(paint(ctx.rules, on, fillOf(ctx.rules, on)), ground);
      const offFace = over(paint(ctx.rules, off, fillOf(ctx.rules, off)), ground);
      const mark = over(paint(ctx.rules, on, "var(--_sl-on-fill)"), fill);
      if (ratio(edge, ground) < 3) out.push(`${where}: edge on the band ${ratio(edge, ground).toFixed(2)}`);
      // and against the unchecked box's own face beside it (its sunken wash, or
      // the track's): 3.02 on the dark theme's light band (introspect), thin
      if (ratio(edge, offFace) < 3) out.push(`${where}: edge against the unchecked face ${ratio(edge, offFace).toFixed(2)}`);
      if (ratio(mark, fill) < 3) out.push(`${where}: mark on the fill ${ratio(mark, fill).toFixed(2)}`);
      // checked against unchecked: on the light theme's dark band the fill
      // says it (a dark tick on amber is near the band's dark well there); on
      // the light bands, as on paper, the tick, dot or knob does
      const byFill = ratio(fill, offFace), byMark = ratio(over(paint(ctx.rules, on, "var(--_sl-on-fill)"), offFace), offFace);
      if (Math.max(byFill, byMark) < 3) out.push(`${where}: against the unchecked control, fill ${byFill.toFixed(2)}, mark ${byMark.toFixed(2)}`);
    }
    // the mark the test reads is the one painted
    const sw = CHECKED.switch(parent, true);
    assert.equal(fillOf(ctx.rules, el({ pseudo: "after", parent: sw })), "var(--_sl-on-fill)", `${ctx.name}: the knob is the fill's label`);
  }
  assert.deepEqual(out, []);
});

test("the band's fill edge is written on the fill, held to the mid-tones with no theme branch, never currentColor", () => {
  const band = read("components.css").replace(/\/\*[\s\S]*?\*\//g, "").match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  const macro = band.match(/--_sl-band-edge:\s*([^;]+);/)?.[1] ?? "";
  assert.match(macro, /^min\(max\(calc\(l - var\(--slc-shade-step\)\), 0\.55\), 0\.59\) /, "the fill one shade step down, floored at 0.55, capped at 0.59");
  assert.doesNotMatch(macro, /currentColor|data-sl-theme|--sl-accent-band-text-lmax/i);
  // plain calc(): pow() is Chrome 120, a version above the relative-colour floor (Chrome 119)
  assert.doesNotMatch(macro, /\bpow\(|\bsqrt\(/, "no pow() or sqrt() in the band's edge");
  assert.match(band, /--slc-edge-accent:\s*oklch\(from var\(--slc-accent-fill, var\(--slc-accent\)\) var\(--_sl-band-edge\)\);/, "the public role, re-derived for the band");
  assert.match(read("components.css"), /\.sl-invert :is\(\.sl-btn--primary, \.sl-check__box, \.sl-radio__box, \.sl-switch__track\),\n\.sl-invert \.sl-btn--primary:is\(:hover, :active\):not\(:disabled\) \{\n  --_sl-fill-edge: oklch\(from var\(--_sl-fill\) var\(--_sl-band-edge\)\);\n\}/);
});
