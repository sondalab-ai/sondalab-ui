import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate, toHex } from "./lib/css-color.mjs";
import { parseSheet, el, box, cascaded, customs, px, specificity, splitList } from "./lib/cascade.mjs";

// The controls through a cascade (scripts/lib/cascade.mjs): the kit's
// stylesheets, a consumer's own rules loaded after them, and a mock element
// tree, so a consumer override meets the kit's rules at their real weights
// and a role re-bound on a subtree reaches the control the way a browser
// computes it. Two review findings on 0.32.0 (pull request 70) motivate it:
// a consumer's button padding against the primary's foot, and the fill
// roles computed once on :root.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const KIT_SHEETS = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css", "themes/products.css", "components.css", "effects.css"].map(read);

/** The kit's sheets, then a consumer's, in that order, under the given flags. */
function sheets(consumer = "", flags = {}) {
  const out = [];
  let order = 0;
  for (const css of [...KIT_SHEETS, consumer]) {
    const rules = parseSheet(css, flags, order);
    order += rules.length + 1;
    out.push(...rules);
  }
  return out;
}

// spexr's own button overrides, verbatim (spexr.css, packages/theia-extensions/
// src/browser/style): a 8/16 and 4/12 padding and the small button at 14px.
const SPEXR = `
.sl-btn {
  padding: var(--sl-space-2) var(--sl-space-4);
  border-radius: var(--sl-radius-md);
}
.sl-btn--sm {
  padding: var(--sl-space-1) var(--sl-space-3);
  font-size: var(--sl-text-sm);
}`;

const CONTEXTS = {
  "dark, opaque": { theme: "dark" },
  "light, opaque": { theme: "light" },
  "glass, pane built": { theme: "dark", glass: true, built: true },
  "glass, no script": { theme: "dark", glass: true, built: false },
  "glass, no backdrop-filter": { theme: "dark", glass: true, built: true, flags: { backdrop: false } },
  "high contrast": { theme: "high-contrast", glass: true, built: true },
  'data-sl-fx="off"': { theme: "dark", glass: true, built: true, off: true },
};
const STATES = { rest: [], hover: ["hover"], pressed: ["active", "hover"], "keyboard focus": ["focus-visible"], disabled: ["disabled"] };
const VARIANTS = { primary: ["sl-btn--primary"], "danger primary": ["sl-btn--primary", "sl-btn--danger"], secondary: ["sl-btn--ghost"], plain: [] };

/** A button in a context: html > body > [region] > button. */
function button(ctx, variant, small, states) {
  const html = el({ tag: "html", attrs: { "data-sl-theme": ctx.theme } });
  const body = el({ tag: "body", parent: html });
  const region = ctx.off ? el({ parent: body, attrs: { "data-sl-fx": "off" } }) : body;
  const classes = ["sl-btn", ...VARIANTS[variant], ...(small ? ["sl-btn--sm"] : []), ...(ctx.glass ? ["sl-fx-glass", "sl-fx-glass--pane", "sl-fx-press"] : []), ...(ctx.built ? ["sl-glass"] : [])];
  return el({ tag: "button", classes, states, parent: region });
}

/** The rendered heights of every cell: { [consumer]: { [context]: { [variant size state]: px } } }. */
export function heightTable() {
  const out = {};
  for (const [consumer, css] of [["kit", ""], ["spexr", SPEXR]]) {
    out[consumer] = {};
    for (const [name, ctx] of Object.entries(CONTEXTS)) {
      const rules = sheets(css, ctx.flags);
      out[consumer][name] = {};
      for (const variant of Object.keys(VARIANTS)) for (const small of [false, true]) for (const [state, states] of Object.entries(STATES)) {
        out[consumer][name][`${variant}${small ? " small" : ""}, ${state}`] = box(rules, button(ctx, variant, small, states)).height;
      }
    }
  }
  return out;
}

test("every button renders 32px (24px small) in every context and state, with the kit's padding and with spexr's", () => {
  const wrong = [];
  for (const [consumer, contexts] of Object.entries(heightTable())) {
    for (const [ctx, cells] of Object.entries(contexts)) {
      for (const [cell, h] of Object.entries(cells)) {
        const want = cell.includes(" small,") ? 24 : 32;
        if (Math.abs(h - want) > 1e-9) wrong.push(`${consumer} / ${ctx} / ${cell}: ${h}px`);
      }
    }
  }
  assert.deepEqual(wrong, []);
});

test("the foot: one more pixel of the edge, standing down only on a built glass pane", () => {
  for (const [name, ctx] of Object.entries(CONTEXTS)) {
    const rules = sheets(SPEXR, ctx.flags);
    for (const small of [false, true]) {
      const b = button(ctx, "primary", small, []);
      const env = customs(rules, b);
      const foot = px(env.get("--_sl-foot") ?? "0px", env);
      const want = ctx.built && !ctx.off && ctx.theme !== "high-contrast" && ctx.flags?.backdrop !== false ? 0 : 1;
      assert.equal(foot, want, `${name}${small ? " small" : ""}: foot ${foot}px`);
      const won = cascaded(rules, b);
      assert.match(won.get("background-image").value, /^linear-gradient\(var\(--_sl-foot-color, var\(--_sl-fill-edge\)\)/, name);
      assert.equal(won.get("background-size").value, "100% var(--_sl-foot)", name);
      assert.equal(won.get("background-position").value, "0 100%", `${name}: at rest the foot is at the bottom`);
      // pressed: the foot moves to the top and the key sinks by it
      const pressed = cascaded(rules, button(ctx, "primary", small, ["active"]));
      assert.equal(pressed.get("background-position").value, "0 0", `${name}: pressed, the foot is on top`);
      assert.equal(px(pressed.get("translate").value.split(" ")[1], customs(rules, button(ctx, "primary", small, ["active"]))), want, `${name}: the key sinks by its foot`);
      // the squash (or a glass pane's squash) keeps `transform` to itself
      assert.match(pressed.get("transform")?.value ?? "", /^scale\(/, `${name}: the squash keeps transform`);
    }
  }
});

test("the foot is a background layer: no border width, no padding, no box-shadow of its own", () => {
  const rules = sheets();
  const won = cascaded(rules, button(CONTEXTS["dark, opaque"], "primary", false, []));
  for (const p of ["border-bottom-width", "border-top-width", "padding-bottom", "padding-top"]) assert.equal(won.get(p), undefined, p);
  // a consumer's `background: transparent; border: 0` strips it with the fill
  const stripped = sheets(".x .sl-btn { background: transparent; border: 0; }");
  const parent = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }), classes: ["x"] });
  const w = cascaded(stripped, el({ tag: "a", classes: ["sl-btn", "sl-btn--primary"], parent }));
  assert.equal(w.get("background").value, "transparent");
  assert.ok(w.get("background").spec[1] > w.get("background-image").spec[1] || w.get("background").order > w.get("background-image").order, "the shorthand wins over the foot's layer");
});

// ── the fill set follows the scope it is painted in (review finding B1) ─────

const FILL_HOST = ["sl-btn", "sl-btn--primary"];
/** html[theme] > body > section (the consumer's re-binding) > control. */
function under(theme, sectionAttrs = {}) {
  const html = el({ tag: "html", attrs: { "data-sl-theme": theme } });
  const body = el({ tag: "body", parent: html });
  return el({ tag: "section", parent: body, attrs: sectionAttrs });
}
const hex = (v, env) => toHex(evaluate(v, env));
/** A checked check box, radio box and switch track under `parent`. */
function checked(parent) {
  const box = (input, cls) => el({ tag: "span", classes: [cls], parent, prev: el({ tag: "input", classes: [input], states: ["checked"], parent }) });
  return { check: box("sl-check__input", "sl-check__box"), radio: box("sl-radio__input", "sl-radio__box"), switch: box("sl-switch__input", "sl-switch__track") };
}

// sondalab-site's product pages re-bind the accent on [data-product]
// (src/pages/products/[slug].astro): the hue, its steps and, on light, its label.
const SITE = `
[data-product] {
  --slc-accent: #1d63d8;
  --slc-accent-hover: color-mix(in srgb, var(--slc-accent) 89%, black);
  --slc-accent-active: color-mix(in srgb, var(--slc-accent) 76%, black);
  --slc-on-accent: oklch(from var(--slc-accent) clamp(0.22, (0.61 - l) * 1000, 1) 0 h);
}`;

for (const theme of ["light", "dark"]) {
  test(`${theme}: an accent re-bound on a subtree reaches the primary's hover, press and label, and the tick, dot and knob`, () => {
    const rules = sheets(SITE);
    const section = under(theme, { "data-product": "local-agents" });
    const sec = customs(rules, section);
    const p = customs(rules, el({ tag: "button", classes: FILL_HOST, parent: section }));
    assert.equal(hex("var(--_sl-fill)", p), hex("var(--slc-accent)", sec), "fill");
    assert.equal(hex("var(--_sl-fill-hover)", p), hex("var(--slc-accent-hover)", sec), "hover");
    assert.equal(hex("var(--_sl-fill-active)", p), hex("var(--slc-accent-active)", sec), "press");
    assert.equal(hex("var(--_sl-on-fill)", p), hex("var(--slc-on-accent)", sec), "label");
    // the tick, the dot and the knob are drawn by a pseudo-element of the
    // control, which inherits the control's computed values
    const c = checked(section);
    const css = read("components.css");
    const tick = css.match(/\.sl-check__box::after \{[^}]*border: solid ([^;]+);/)[1];
    const dot = css.match(/\.sl-radio__box::after \{[^}]*background: ([^;]+);/)[1];
    const knob = css.match(/\.sl-switch__input:checked \+ \.sl-switch__track::after \{[^}]*background: ([^;]+);/)[1];
    for (const [name, host, value] of [["tick", c.check, tick], ["dot", c.radio, dot], ["knob", c.switch, knob]]) {
      const env = customs(rules, host);
      assert.equal(hex(value, env), hex("var(--slc-on-accent)", sec), name);
      assert.equal(hex(cascaded(rules, host).get("background").value, env), hex("var(--slc-accent)", sec), `${name}'s fill`);
    }
  });

  test(`${theme}: --slc-accent-fill set below the root fills, labels, steps and edges the controls under it`, () => {
    const rules = sheets("[data-spexr] { --slc-accent-fill: #4c58e9; }");
    const section = under(theme, { "data-spexr": "" });
    const p = customs(rules, el({ tag: "button", classes: FILL_HOST, parent: section }));
    const want = new Map([["--slc-accent-fill", "#4c58e9"], ["--slc-shade-step", "0.075"], ["--slc-edge-accent-lmax", theme === "light" ? "0.59" : "1"]]);
    assert.equal(hex("var(--_sl-fill)", p), "#4c58e9");
    // the kit's step for a white label, toward black: 0.05 / 0.10 darker along the
    // line to black (0.32.1; 89% / 76% toward black until then)
    assert.equal(hex("var(--_sl-fill-hover)", p), hex("oklch(from #4c58e9 calc(l - 0.05) calc(c * (l - 0.05) / l) h)", want));
    assert.equal(hex("var(--_sl-fill-active)", p), hex("oklch(from #4c58e9 calc(l - 0.1) calc(c * (l - 0.1) / l) h)", want));
    assert.equal(hex("var(--_sl-on-fill)", p), "#ffffff");
    assert.equal(hex("var(--_sl-fill-edge)", p), hex("oklch(from #4c58e9 min(calc(l - 0.075), var(--slc-edge-accent-lmax)) c h)", want));
    for (const host of Object.values(checked(section))) {
      const env = customs(rules, host);
      assert.equal(hex("var(--_sl-fill)", env), "#4c58e9");
      assert.equal(hex("var(--_sl-on-fill)", env), "#ffffff");
      assert.equal(hex("var(--_sl-fill-edge)", env), hex("var(--_sl-fill-edge)", p));
    }
  });

  // spexr before its migration (spexr-overrides.css): the accent, its steps,
  // its edge and a white label re-bound on the primary itself.
  test(`${theme}: a product that re-binds the accent on the primary itself keeps its fill, steps, edge and label`, () => {
    const rules = sheets(`:is([data-sl-theme="light"], [data-sl-theme="dark"]) .sl-btn--primary {
      --slc-accent: #4c58e9;
      --slc-accent-hover: color-mix(in srgb, var(--slc-accent) 89%, black);
      --slc-accent-active: color-mix(in srgb, var(--slc-accent) 76%, black);
      --slc-edge-accent: oklch(from var(--slc-accent) calc(l - var(--slc-shade-step, 0.075)) c h);
      --slc-on-accent: #ffffff;
    }`);
    const p = customs(rules, el({ tag: "button", classes: FILL_HOST, parent: under(theme) }));
    const env = new Map([["--slc-accent", "#4c58e9"]]);
    assert.equal(hex("var(--_sl-fill)", p), "#4c58e9");
    assert.equal(hex("var(--_sl-fill-hover)", p), hex("color-mix(in srgb, var(--slc-accent) 89%, black)", env));
    assert.equal(hex("var(--_sl-fill-active)", p), hex("color-mix(in srgb, var(--slc-accent) 76%, black)", env));
    assert.equal(hex("var(--_sl-on-fill)", p), "#ffffff");
    assert.equal(hex("var(--_sl-fill-edge)", p), hex("oklch(from #4c58e9 calc(l - 0.075) c h)", env));
  });
}

test("high contrast: a filled control's edge is the accent, and no accent fill reaches it at any scope", () => {
  const rules = sheets("[data-spexr] { --slc-accent-fill: #4c58e9; }");
  const section = under("high-contrast", { "data-spexr": "" });
  const p = customs(rules, el({ tag: "button", classes: FILL_HOST, parent: section }));
  assert.equal(hex("var(--_sl-fill)", p), "#ffff00");
  assert.equal(hex("var(--_sl-fill-edge)", p), "#ffff00");
  assert.equal(hex("var(--_sl-on-fill)", p), "#000000");
});

// ── the registered fill, generated into products.css (0.35) ─────────────────
// A product with a registered `fill` gets --slc-accent-fill from products.css
// on its theme element, with no rule of its own: spexr deletes its literal.

const REGISTRY = JSON.parse(read("agent/accent-registry.json")).products;
/** html[data-sl-product][data-sl-theme] > body > [island] > control. */
function productPage(product, theme, island = null) {
  const html = el({ tag: "html", attrs: { "data-sl-theme": theme, "data-sl-product": product } });
  const body = el({ tag: "body", parent: html });
  return { html, host: island ? el({ tag: "section", parent: body, attrs: { "data-sl-theme": island } }) : body };
}

for (const theme of ["light", "dark"]) {
  test(`${theme}: spexr's registered fill reaches the primary and the root's roles from products.css alone`, () => {
    const rules = sheets();
    const { html, host } = productPage("spexr", theme);
    const fill = REGISTRY.spexr.fill[theme];
    const p = customs(rules, el({ tag: "button", classes: FILL_HOST, parent: host }));
    assert.equal(hex("var(--_sl-fill)", p), fill);
    assert.equal(hex("var(--_sl-on-fill)", p), "#ffffff");
    // the public roles compute on :root, where the product attribute sits
    const root = customs(rules, html);
    assert.equal(hex("var(--slc-on-accent-fill)", root), "#ffffff");
    assert.equal(hex("var(--slc-accent-fill-hover)", root), hex("var(--_sl-fill-hover)", p));
    for (const box of Object.values(checked(host))) assert.equal(hex("var(--_sl-fill)", customs(rules, box)), fill);
  });

  test(`${theme}: a product with no registered fill keeps the accent as its fill`, () => {
    const rules = sheets();
    for (const product of ["default", "introspect"]) {
      const { host } = productPage(product, theme);
      const p = customs(rules, el({ tag: "button", classes: FILL_HOST, parent: host }));
      assert.equal(p.get("--slc-accent-fill"), undefined, product);
      assert.equal(hex("var(--_sl-fill)", p), hex("var(--slc-accent)", p), product);
    }
  });
}

test("a theme island inside a spexr page takes that theme's registered fill", () => {
  const rules = sheets();
  const { host } = productPage("spexr", "light", "dark");
  assert.equal(hex("var(--_sl-fill)", customs(rules, el({ tag: "button", classes: FILL_HOST, parent: host }))), REGISTRY.spexr.fill.dark);
});

test("high contrast: products.css brings no fill, and spexr's primary is the theme's yellow", () => {
  const rules = sheets();
  const { html, host } = productPage("spexr", "high-contrast");
  assert.equal(customs(rules, html).get("--slc-accent-fill"), undefined);
  const p = customs(rules, el({ tag: "button", classes: FILL_HOST, parent: host }));
  assert.equal(hex("var(--_sl-fill)", p), "#ffff00");
  assert.equal(hex("var(--_sl-on-fill)", p), "#000000");
});

// ── the effects kill switches keep a control's depth and halo (finding S1) ──

test("an opt-out region and high contrast keep a glass control's own depth, and its halo where the theme draws one", () => {
  const rules = sheets(SPEXR);
  const halo = (env) => { const v = env.get("--_sl-halo"); return evaluate(v.slice(v.indexOf("color-mix(")), env).alpha; };
  for (const [name, ctx, wantHalo] of [['data-sl-fx="off" (dark)', CONTEXTS['data-sl-fx="off"'], 0.22], ["high contrast", CONTEXTS["high contrast"], 0]]) {
    // the secondary key at rest: its lit line and cast, through the kill
    const ghost = button(ctx, "secondary", false, []);
    const g = cascaded(rules, ghost).get("box-shadow");
    assert.equal(g.value, "var(--_sl-depth, 0 0 transparent)", `${name}: the ghost's depth comes back`);
    assert.ok(g.important, name);
    const depth = customs(rules, ghost).get("--_sl-depth");
    if (ctx.theme === "high-contrast") assert.equal(depth, "0 0 transparent", `${name}: high contrast draws the edge instead`);
    else assert.match(depth, /^inset 0 1px 0 rgba\([^)]*\), 0 1px 2px /, `${name}: lit line and cast`);
    // keyboard focus: the depth and the halo, at the theme's strength
    for (const variant of ["primary", "secondary", "plain"]) {
      const b = button(ctx, variant, false, ["focus-visible"]);
      const won = cascaded(rules, b).get("box-shadow");
      assert.equal(won.value, "var(--_sl-depth, 0 0 transparent), var(--_sl-halo, 0 0 transparent)", `${name} ${variant}`);
      assert.ok(won.important, `${name} ${variant}: outranks the kill`);
      assert.ok(Math.abs(halo(customs(rules, b)) - wantHalo) < 1e-9, `${name} ${variant}: halo ${halo(customs(rules, b))}`);
    }
  }
});

// ── the weights the README quotes (0.32.1) ──────────────────────────────────

// The README's 0.32.0 switch note told a consumer resizing the switch which
// weights its held-state rules carry, and gave the checked twin as (0,5,1);
// it is (0,6,1) (spexr measured it). Every `selector`, weighing (a,b,c) pair
// the README quotes for a rule is computed here from the rule components.css
// ships, so the prose cannot drift from the cascade again.
test("every rule weight the README quotes is the weight of the rule components.css ships", () => {
  const readme = readFileSync(resolve(KIT, "README.md"), "utf8");
  const css = read("components.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const shipped = new Set([...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => splitList(m[1].trim().replace(/\s+/g, " "))));
  const quoted = [...readme.matchAll(/`([^`]+)`, weighing \((\d),(\d),(\d)\)/g)].map((m) => [m[1], m.slice(2, 5).map(Number)]);
  assert.ok(quoted.length >= 2, "the switch note quotes both held-state rules");
  for (const [sel, weight] of quoted) {
    assert.ok(shipped.has(sel), `components.css ships no rule ${sel}`);
    assert.deepEqual(specificity(sel), weight, sel);
  }
  // the two the switch note is about, by name
  const held = quoted.filter(([sel]) => sel.startsWith(".sl-switch:active:not(:has(:disabled))"));
  assert.deepEqual(held.map(([, w]) => w), [[0, 4, 1], [0, 6, 1]]);
});
