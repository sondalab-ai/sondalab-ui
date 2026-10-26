import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromSrgb, toHex, toOklch, toSrgb, within } from "./lib/css-color.mjs";

// Lumen controls (ui-kit 0.32): the primary's foot, the focus halo composed
// with each control's depth, the danger tone and the accent-fill role,
// measured from the rules components.css and effects.css declare, over every
// registered product's real neutrals.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const raw = read("components.css");
const css = bare(raw);
const effects = bare(read("effects.css"));
const tokenEnv = (src) => {
  const env = new Map();
  for (const m of bare(src).matchAll(/(--_?sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  return env;
};
const SHARED = tokenEnv(read("tokens.css"));
const NEUTRALS = JSON.parse(read("neutrals.json")).products;
const REGISTRY = JSON.parse(read("agent/accent-registry.json")).products;
const PRODUCTS = Object.keys(NEUTRALS).filter((p) => !NEUTRALS[p].inherits);

/** Flat rules (nested at-rules descended): [{ selector, body }]. */
const RULES = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
const rule = (sel) => {
  const r = RULES.find((x) => x.selector === sel);
  assert.ok(r, `no rule ${sel}`);
  return r.body;
};
const decl = (body, prop) => body.match(new RegExp(`(?:^|;)\\s*${prop.replace(/[()]/g, "\\$&")}\\s*:\\s*([^;]+)`))?.[1].trim().replace(/\s+/g, " ");

/** :root for one product on one theme, as a Tier A page resolves it. */
function rootEnv(theme, product = "default") {
  const env = new Map([...SHARED, ...tokenEnv(read(`themes/${theme}.css`))]);
  if (theme !== "high-contrast") {
    for (const [role, v] of Object.entries(NEUTRALS[product][theme])) env.set(`--sl-${role}`, v);
    env.set("--sl-accent-default", REGISTRY[product][theme]);
    if (theme === "dark") env.set("--sl-focus-ring", REGISTRY[product][theme]);
  }
  const sels = [":root", ...({ light: [':root[data-sl-theme="light"]'], "high-contrast": [':root[data-sl-theme="high-contrast"]'] }[theme] ?? [])];
  for (const [k, v] of declarations(raw, sels)) env.set(k, v);
  return env;
}
/** A child of the inversion band, currentColor bound to the band's ink,
 *  computed over what it inherits from :root. */
function bandEnv(theme, product) {
  const env = rootEnv(theme, product);
  const ink = toHex(evaluate("var(--slc-canvas)", env));
  return within(env, declarations(raw, [".sl-invert > *"]).map(([k, v]) => [k, v.replace(/currentColor/g, ink)]));
}
/** An element under `env` (a :root map or an element's computed scope) that
 *  matches every selector given: their declarations in that order, computed
 *  on the element, over the values it inherits. */
const own = (env, ...sels) => within(env, sels.flatMap((s) => declarations(raw, [s])));
const Y = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const over = (top, under) => {
  const t = toSrgb(top), u = toSrgb(under);
  return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha)));
};

const CASES = [...PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => [t, p])), ["high-contrast", "default"]];

// ── the foot ────────────────────────────────────────────────────────────────

// The fill set lives on the controls that paint it (0.32, review finding B1).
const FILL_SET = ":where(.sl-btn--primary, .sl-check__box, .sl-radio__box, .sl-switch__track)";
const PRIMARY = [FILL_SET, ".sl-btn--primary"];

// The rendered heights, with the kit's padding and with a consumer's, in every
// context and state, are measured through the cascade in
// controls-cascade.test.mjs; this checks the foot's own shape.
test("the primary's foot is a background layer of its edge, standing down on a built glass pane and in a group", () => {
  const primary = rule(".sl-btn--primary");
  assert.equal(decl(primary, "--_sl-foot"), "1px");
  assert.equal(decl(primary, "background-image"), "linear-gradient(var(--_sl-foot-color, var(--_sl-fill-edge)), var(--_sl-foot-color, var(--_sl-fill-edge)))");
  assert.equal(decl(primary, "background-size"), "100% var(--_sl-foot)");
  assert.equal(decl(primary, "background-position"), "0 100%");
  assert.equal(decl(primary, "background-repeat"), "no-repeat");
  for (const p of ["border-bottom-width", "border-top-width", "padding-bottom", "padding", "box-shadow"]) assert.equal(decl(primary, p), undefined, `no ${p}: the box is a plain button's`);
  assert.doesNotMatch(css, /\.sl-btn--primary\.sl-btn--sm \{/, "no small-primary padding rule to outrank a consumer's");
  const press = rule(".sl-btn--primary:active:not(:disabled)");
  assert.equal(decl(press, "background-position"), "0 0");
  assert.equal(decl(press, "translate"), "0 var(--_sl-foot)");
  assert.equal(decl(press, "transform"), undefined, "the squash owns transform");
  assert.equal(decl(rule(".sl-btn--primary:focus-visible"), "--_sl-foot-color"), "var(--slc-focus)", "under focus the foot is the ring's, as the border is");
  // the foot must not slide to the top when pressed: only the colour transitions
  assert.match(decl(rule(".sl-btn"), "transition"), /^background-color /);
  assert.equal(decl(rule(".sl-btn-group > .sl-btn"), "--_sl-foot"), "0px");
  const glass = effects.slice(effects.indexOf("@supports (backdrop-filter: blur(1px))"));
  assert.match(glass, /\.sl-btn--primary\.sl-fx-glass:where\(\.sl-glass\):where\(:root:not\(\[data-sl-theme="high-contrast"\]\) \*\):where\(:not\(\[data-sl-fx="off"\], \[data-sl-fx="off"\] \*\)\) \{ --_sl-foot: 0px; \}/, "only a built pane, where backdrop-filter works, stands the foot down");
  assert.doesNotMatch(effects.slice(0, effects.indexOf("@supports (backdrop-filter: blur(1px))")), /--_sl-foot:\s*0px/, "nowhere else");
});

// ── the focus halo ──────────────────────────────────────────────────────────

const FOCUS = RULES.find((r) => /outline: var\(--sl-focus-ring-width/.test(r.body));
const APPLY = RULES.find((r) => r.selector.startsWith(":is(.sl-btn, .sl-icon-btn, .sl-field__input") && /box-shadow:\s*var\(--_sl-depth\)/.test(r.body));
const RESET = RULES.find((r) => r.selector.startsWith(":where(.sl-btn,") && /--_sl-halo\s*:/.test(r.body));
const members = (sel) => sel.replace(/^:(?:is|where)\(/, "").replace(/\)$/, "").split(",").map((s) => s.trim());
/** The colour of the halo: everything from its color-mix() on. */
const haloColour = () => { const v = decl(RESET.body, "--_sl-halo"); return v.slice(v.indexOf("color-mix(")); };

test("the shared focus rule composes the control's depth with the halo, no !important", () => {
  assert.equal(decl(FOCUS.body, "box-shadow"), "var(--_sl-depth, 0 0 transparent), var(--_sl-halo, 0 0 transparent)");
  assert.doesNotMatch(FOCUS.body, /!important/);
  assert.doesNotMatch(css, /--_sl-(?:halo|depth)[^;{}]*!important/, "no private value is forced");
  // the field shows it on any focus: a <select> clicked never matches :focus-visible
  assert.equal(decl(rule(".sl-field__input:focus"), "box-shadow"), "var(--_sl-depth, 0 0 transparent), var(--_sl-halo, 0 0 transparent)");
});

test("the halo is the ring's colour at 22%, glow-width wider than the ring, off where --slc-glow is 0", () => {
  assert.match(read("tokens.css"), /--sl-focus-glow-width:\s*5px;/);
  assert.equal(decl(RESET.body, "--_sl-halo"),
    "0 0 0 calc(var(--sl-focus-ring-offset, 0px) + var(--sl-focus-ring-width, 2px) + var(--sl-focus-glow-width, 5px)) color-mix(in srgb, var(--slc-focus) calc(22% * min(1, var(--slc-glow) * 1000)), transparent)");
  // declared on every member of the shared focus rule, so it resolves on the control
  const declaredOn = new Set(members(RESET.selector));
  for (const sel of FOCUS.selector.split(",").map((s) => s.trim())) {
    const subject = sel.split(/\s*\+\s*/).pop().replace(/:focus-visible$/, "");
    assert.ok(declaredOn.has(subject), `${subject} carries no --_sl-halo`);
  }
  assert.ok(declaredOn.has(".sl-slider"), "the slider thumb inherits it from the input");
  const colour = haloColour();
  for (const [theme, product] of CASES) {
    const env = rootEnv(theme, product);
    const halo = evaluate(colour, env);
    const ring = evaluate("var(--slc-focus)", env);
    if (theme === "high-contrast") { assert.equal(halo.alpha, 0, "off in high contrast"); continue; }
    assert.ok(Math.abs(halo.alpha - 0.22) < 1e-9, `${theme} ${product}: ${halo.alpha}`);
    assert.equal(toHex({ lin: halo.lin, alpha: 1 }), toHex(ring), `${theme} ${product}: the ring's own colour`);
  }
  // forced colours: --slc-glow is 0 there too, so the halo is transparent
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const fcRoot = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /^\s*:root,/.test(m[1]));
  assert.match(fcRoot[2], /--slc-glow:\s*0;/);
  const fcEnv = rootEnv("dark");
  fcEnv.set("--slc-glow", "0");
  assert.equal(evaluate(colour, fcEnv).alpha, 0, "off under forced colours");
});

test("an invalid field and a danger button glow in the danger, as their ring does", () => {
  for (const [theme, product] of CASES) {
    const field = own(rootEnv(theme, product), RESET.selector, '.sl-field__input[aria-invalid="true"]');
    const danger = own(rootEnv(theme, product), RESET.selector, ".sl-btn--danger, .sl-icon-btn--danger");
    const colour = haloColour();
    const want = toHex(evaluate("var(--slc-danger)", rootEnv(theme, product)));
    for (const [name, env] of [["field", field], ["danger button", danger]]) {
      assert.equal(toHex(evaluate("var(--slc-focus)", env)), want, `${theme} ${product} ${name} ring`);
      const halo = evaluate(colour, env);
      if (theme !== "high-contrast") assert.equal(toHex({ lin: halo.lin, alpha: 1 }), want, `${theme} ${product} ${name} halo`);
    }
  }
});

test("no state rule paints a depth-bearing control's box-shadow itself: it writes --_sl-depth", () => {
  // A rule that set box-shadow on one of these at (0,2,0) or more, after the
  // focus rule, would drop the halo whenever that state is focused (a chosen
  // segment, a checked box). Allowed: the painter, the focus rules, and the
  // forced-colours and high-contrast blocks, which never draw a halo.
  const painted = members(APPLY.selector);
  const allowed = new Set([APPLY.selector, FOCUS.selector, ".sl-field__input:focus"]);
  const fcAt = css.lastIndexOf("@media (forced-colors: active)");
  const offenders = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, " ");
    if (!/(?:^|;)\s*box-shadow\s*:/.test(m[2]) || allowed.has(sel) || m.index > fcAt) continue;
    for (const part of sel.split(/,(?![^(]*\))/).map((s) => s.trim())) {
      // the subject is the last compound, read with :has()/:not()/:is() arguments dropped
      const flat = part.replace(/:(?:has|not|is|where)\((?:[^()]|\([^()]*\))*\)/g, "");
      const subject = flat.split(/\s+(?:[>+~]\s+)?/).pop();
      if (/::|^:root|high-contrast/.test(part)) continue;
      if (painted.some((cls) => new RegExp(`${cls.replace(".", "\\.")}(?![\\w-])`).test(subject))) offenders.push(part);
    }
  }
  assert.deepEqual(offenders, []);
  // and the painter comes before the focus rule, one step lighter
  assert.ok(RULES.indexOf(APPLY) < RULES.indexOf(FOCUS));
});

test("a recipe that a theme turns off joins the composition as an empty shadow", () => {
  for (const [theme] of [["high-contrast"]]) {
    const env = rootEnv(theme);
    assert.equal(env.get("--slc-depth-sunk"), "0 0 transparent");
  }
  // a field's depth is the sunk recipe, so its focus list never meets `none`
  assert.equal(decl(rule(".sl-field__input"), "--_sl-depth"), "var(--slc-depth-sunk)");
});

// ── the danger tone ─────────────────────────────────────────────────────────

const DANGER_FILLED = ".sl-btn--primary.sl-btn--danger";
const DANGER_NEUTRAL = ".sl-btn--danger:not(.sl-btn--primary), .sl-icon-btn--danger";
const DANGER_HOVER = ".sl-btn--danger:not(.sl-btn--primary):hover:not(:disabled), .sl-icon-btn--danger:hover:not(:disabled)";

test("the danger tone: one fill set on a primary, ink and edge on a neutral, both class names", () => {
  const filled = rule(DANGER_FILLED);
  for (const p of ["--_sl-fill", "--_sl-fill-hover", "--_sl-fill-active", "--_sl-on-fill", "--_sl-fill-edge"]) assert.ok(decl(filled, p), p);
  assert.equal(decl(filled, "--_sl-on-fill"), "var(--slc-on-danger)");
  assert.equal(decl(rule(DANGER_NEUTRAL), "color"), "var(--slc-danger-text, var(--slc-danger))");
  assert.equal(decl(rule(DANGER_NEUTRAL), "border-color"), "var(--slc-danger-text, var(--slc-danger))");
  assert.equal(decl(rule(DANGER_HOVER), "background-color"), "var(--slc-danger)");
  assert.equal(decl(rule(DANGER_HOVER), "color"), "var(--slc-on-danger)");
  assert.equal(decl(rule(".sl-btn--danger, .sl-icon-btn--danger"), "--slc-focus"), "var(--slc-danger-text, var(--slc-danger))");
  // glass keeps the danger edge (effects.css)
  assert.match(effects, /\.sl-btn--danger:not\(\.sl-btn--primary\)\.sl-fx-glass,\s*\.sl-icon-btn--danger\.sl-fx-glass \{ --slfx-control-edge: var\(--slc-danger-text, var\(--slc-danger\)\); \}/);
});

for (const [theme, product] of CASES) {
  test(`${theme} ${product}: the danger tone reads, filled and neutral, on the page and in the band`, () => {
    const low = [];
    // filled: the label on the fill, its hover and its press
    const f = own(rootEnv(theme, product), ...PRIMARY, DANGER_FILLED);
    const label = evaluate("var(--_sl-on-fill)", f);
    for (const p of ["--_sl-fill", "--_sl-fill-hover", "--_sl-fill-active"]) {
      const r = ratio(label, evaluate(`var(${p})`, f));
      if (r < 4.5) low.push(`filled ${p} ${r.toFixed(2)}`);
    }
    // its edge finds it on the page's grounds (a control boundary, 3:1)
    for (const g of ["canvas", "surface", "raised"]) {
      const r = ratio(evaluate("var(--_sl-fill-edge)", f), evaluate(`var(--slc-${g})`, f));
      if (r < 3) low.push(`filled edge on ${g} ${r.toFixed(2)}`);
    }
    // neutral: the ink on its own fill over every ground it can stand on --
    // the page's canvas, a card (surface), a raised surface and a tile; in
    // the band, the bare band and its own card, raised and tile washes --
    // the edge on that ground, and the hover label on the danger fill
    const page = rootEnv(theme, product), band = bandEnv(theme, product);
    const bandGround = evaluate("var(--slc-text)", page);
    for (const [where, env, grounds, fillValue] of [
      ["page", page, Object.fromEntries(["canvas", "surface", "raised", "tile"].map((g) => [g, evaluate(`var(--slc-${g})`, page)])), decl(rule(DANGER_NEUTRAL), "background-color")],
      ["band", band, Object.fromEntries([["band", bandGround], ...["surface", "raised", "tile"].map((g) => [g, over(evaluate(`var(--slc-${g})`, band), bandGround)])]),
        decl(rule(".sl-invert .sl-btn--danger:not(.sl-btn--primary), .sl-invert .sl-icon-btn--danger"), "background-color")],
    ]) {
      const ink = evaluate(decl(rule(DANGER_NEUTRAL), "color"), env);
      // its own fill (currentColor is the ink), composited on the ground
      const fillOf = (ground) => over(evaluate(fillValue.replace(/currentColor/g, toHex(ink)), env), ground);
      for (const [g, ground] of Object.entries(grounds)) {
        const fill = fillOf(ground);
        const r = ratio(over(ink, fill), fill);
        if (r < 4.5) low.push(`${where} ink on ${g} ${r.toFixed(2)}`);
        const re = ratio(over(evaluate(decl(rule(DANGER_NEUTRAL), "border-color"), env), ground), ground);
        if (re < 3) low.push(`${where} edge on ${g} ${re.toFixed(2)}`);
      }
      const hover = evaluate(decl(rule(DANGER_HOVER), "background-color"), env);
      const rh = ratio(evaluate(decl(rule(DANGER_HOVER), "color"), env), hover);
      if (rh < 4.5) low.push(`${where} hover label ${rh.toFixed(2)}`);
    }
    assert.deepEqual(low, []);
  });
}

// ── the accent fill ─────────────────────────────────────────────────────────

test("unset, the accent fill is the accent and every derived role is the accent's own, exactly", () => {
  for (const [theme, product] of CASES) {
    const env = rootEnv(theme, product);
    // unset: never declared (high contrast declares it `initial`, the same thing)
    assert.ok(!env.has("--slc-accent-fill") || env.get("--slc-accent-fill") === "initial", "the kit leaves the role unset");
    for (const [role, accentRole] of [["--slc-on-accent-fill", "--slc-on-accent"], ["--slc-accent-fill-hover", "--slc-accent-hover"], ["--slc-accent-fill-active", "--slc-accent-active"]]) {
      assert.equal(toHex(evaluate(`var(${role})`, env)), toHex(evaluate(`var(${accentRole})`, env)), `${theme} ${product} ${role}`);
    }
    const p = own(rootEnv(theme, product), ...PRIMARY);
    assert.equal(toHex(evaluate("var(--_sl-fill)", p)), toHex(evaluate("var(--slc-accent)", p)), `${theme} ${product} primary fill`);
  }
});

test("high contrast resets a product's accent fill: the theme owns its accent", () => {
  const env = rootEnv("high-contrast");
  assert.equal(env.get("--slc-accent-fill"), "initial");
  env.set("--sl-accent-default", "#ffff00");
  assert.equal(toHex(evaluate("var(--slc-accent-fill, var(--slc-accent))", env)), "#ffff00");
});

// At rest, hovered and pressed for every product: with a registered fill the
// role derives the steps, unset they are the theme's own accent steps. Both
// step the way the kit's 5.4 rule picks since 0.32.1 (introspect's light hover and press
// read 4.09 / 3.15 under its dark label until then, the theme stepping toward
// black). primary-label.test.mjs measures the same through the cascade, in
// every wiring and context.
for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
  const fill = REGISTRY[product].fill?.[theme];
  test(`${theme} ${product}${fill ? ` (fill ${fill})` : ""}: every labelled accent fill reads at 4.5:1, at rest, hovered and pressed`, () => {
    const env = rootEnv(theme, product);
    if (fill) env.set("--slc-accent-fill", fill);
    const low = [];
    const label = evaluate("var(--slc-on-accent-fill)", env);
    const states = ["var(--slc-accent-fill, var(--slc-accent))", "var(--slc-accent-fill-hover)", "var(--slc-accent-fill-active)"];
    for (const p of states) {
      const r = ratio(label, evaluate(p, env));
      if (r < 4.5) low.push(`${p} ${r.toFixed(2)}`);
    }
    // the primary paints exactly these, and so do the switch and the boxes
    const p = own(new Map(env), ...PRIMARY);
    assert.equal(toHex(evaluate("var(--_sl-fill)", p)), toHex(evaluate("var(--slc-accent-fill, var(--slc-accent))", env)));
    assert.equal(toHex(evaluate("var(--_sl-on-fill)", p)), toHex(label));
    assert.deepEqual(low, []);
  });
}

// spexr registered its fill so its label could be WHITE: white on the bare
// #5b6cff reads 4.17:1. Since 0.32.1 the bare accent takes the dark pole
// instead (4.65:1, the better pole past the 0.59 threshold), so a spexr page
// without its fill still reads; the fill keeps the white label the owner
// chose (5.41:1).
test("spexr's registered fill keeps its light label white over 4.5:1; its bare accent takes the better, dark pole", () => {
  const env = rootEnv("light", "spexr");
  const label = evaluate("var(--slc-on-accent-fill)", env), accent = evaluate("var(--slc-accent)", env);
  assert.ok(toOklch(label)[0] < 0.5, "the bare accent's label is the dark pole");
  assert.ok(ratio(label, accent) > ratio(evaluate("white", env), accent), "and it is the better pole there");
  assert.ok(ratio(label, accent) >= 4.5, ratio(label, accent).toFixed(2));
  env.set("--slc-accent-fill", REGISTRY.spexr.fill.light);
  const white = evaluate("var(--slc-on-accent-fill)", env);
  assert.equal(toHex(white), "#ffffff");
  assert.ok(ratio(white, evaluate("var(--slc-accent-fill)", env)) >= 4.5);
});

test("every labelled accent fill reads the fill set on the control: primary, checked check, radio and switch", () => {
  const set = rule(FILL_SET);
  assert.equal(decl(set, "--_sl-fill"), "var(--slc-accent-fill, var(--slc-accent))");
  assert.equal(decl(set, "--_sl-fill-hover"), "var(--_sl-accent-fill-hover, var(--slc-accent-hover))");
  assert.equal(decl(set, "--_sl-fill-active"), "var(--_sl-accent-fill-active, var(--slc-accent-active))");
  assert.equal(decl(set, "--_sl-on-fill"), "var(--_sl-on-accent-fill, var(--slc-on-accent))");
  assert.equal(decl(set, "--_sl-fill-edge"), "var(--slc-edge-accent)");
  assert.match(decl(set, "--slc-edge-accent"), /^oklch\(from var\(--slc-accent-fill, var\(--slc-accent\)\) /);
  for (const sel of [".sl-check__input:checked + .sl-check__box, .sl-radio__input:checked + .sl-radio__box", ".sl-check__input:indeterminate + .sl-check__box", ".sl-switch__input:checked + .sl-switch__track"]) {
    assert.equal(decl(rule(sel), "background"), "var(--_sl-fill)", sel);
    assert.equal(decl(rule(sel), "border-color"), "var(--_sl-fill-edge)", sel);
    assert.match(decl(rule(sel), "--_sl-depth"), /^inset 0 -1\.5px 0 var\(--_sl-fill-edge\), 0 0 1\dpx -2px color-mix\(in srgb, var\(--_sl-fill\) calc\(var\(--slc-glow\) \* 1[12]0%\), transparent\)$/, sel);
  }
  assert.equal(decl(rule(".sl-switch__input:checked + .sl-switch__track::after"), "background"), "var(--_sl-on-fill)");
  assert.match(rule(".sl-check__box::after"), /border:\s*solid var\(--_sl-on-fill\)/);
  assert.equal(decl(rule(".sl-radio__box::after"), "background"), "var(--_sl-on-fill)");
  // the public roles stay on :root for a fill a product draws itself (a count badge)
  const root = css.match(/:root \{([^}]*)\}/)[1];
  for (const r of ["--slc-on-accent-fill", "--slc-accent-fill-hover", "--slc-accent-fill-active", "--slc-edge-accent"]) assert.ok(decl(root, r), r);
});

// ── the depth of the neutral controls ───────────────────────────────────────

test("secondary raised, icon button clear in its edge, fields and tracks sunken, boxes on the canvas", () => {
  const ghost = rule(".sl-btn--ghost");
  assert.equal(decl(ghost, "background"), "var(--slc-raised)");
  assert.equal(decl(ghost, "border-color"), "var(--slc-edge-button)", "owner exception 2026-10-26: a text button rests on the translucent hairline");
  assert.equal(decl(ghost, "--_sl-depth"), "inset 0 1px 0 var(--slc-lit), var(--slc-shadow-sm)");
  assert.equal(decl(rule(".sl-btn--ghost:hover:not(:disabled)"), "background"), "var(--slc-tile)");
  assert.equal(decl(rule(".sl-btn--ghost:hover:not(:disabled)"), "border-color"), "var(--slc-edge-control-hover)");
  const icon = rule(".sl-icon-btn");
  assert.equal(decl(icon, "background"), "transparent");
  assert.equal(decl(icon, "border"), "1px solid var(--slc-edge-control)", "the one control edge, icon buttons included");
  assert.equal(decl(rule(".sl-icon-btn:hover:not(:disabled)"), "background"), "var(--slc-surface)");
  for (const sel of [".sl-field__input", ".sl-switch__track", ".sl-segmented"]) {
    assert.equal(decl(rule(sel), "background"), "var(--slc-sunken)", sel);
  }
  // 0.36 (Lumen): the check and radio boxes are wells on the canvas, and on
  // the band's sunken wash inside an inversion band (lumen-controls.test.mjs)
  assert.equal(decl(rule(".sl-check__box, .sl-radio__box"), "background"), "var(--slc-canvas)");
  assert.equal(decl(rule(".sl-segmented"), "box-shadow"), "var(--slc-depth-sunk)");
  assert.equal(decl(rule(".sl-segmented"), "border"), "1px solid var(--slc-edge-control)");
  assert.equal(decl(rule(".sl-switch__track"), "--_sl-depth"), "var(--slc-depth-sunk)");
  // a hovered border joins the ring under focus (no band inside the ring)
  assert.match(css, /\.sl-btn--ghost:hover:not\(:disabled\):focus-visible,\s*\.sl-icon-btn:hover:not\(:disabled\):focus-visible,/);
  assert.equal(decl(rule(".sl-field__input:hover:not(:disabled, :focus)"), "border-color"), "var(--slc-edge-control-hover)");
});

// ── no band inside the focus ring ───────────────────────────────────────────

/** Specificity [a, b, c] of one complex selector (:where is 0; :is, :not and
 *  :has take their most specific argument). Same rules as depth.test.mjs. */
function specificity(sel) {
  const split = (t) => { const out = []; let d = 0, f = 0; for (let i = 0; i <= t.length; i++) { const ch = t[i]; if (ch === "(" || ch === "[") d++; else if (ch === ")" || ch === "]") d--; else if ((ch === "," && d === 0) || i === t.length) { out.push(t.slice(f, i).trim()); f = i + 1; } } return out; };
  const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  let a = 0, b = 0, c = 0, i = 0;
  const word = () => { while (i < sel.length && /[\w-]/.test(sel[i])) i++; };
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === "#") { a++; i++; word(); }
    else if (ch === ".") { b++; i++; word(); }
    else if (ch === "[") { b++; i = sel.indexOf("]", i) + 1; }
    else if (ch === ":" && sel[i + 1] === ":") { c++; i += 2; word(); }
    else if (ch === ":") {
      i++; const start = i; word(); const name = sel.slice(start, i);
      if (sel[i] === "(") {
        let d = 1, j = i + 1; while (d) { if (sel[j] === "(") d++; else if (sel[j] === ")") d--; j++; }
        const inner = sel.slice(i + 1, j - 1); i = j;
        if (name === "where") continue;
        if (["is", "not", "has"].includes(name)) { const best = split(inner).map(specificity).sort(cmp).pop(); a += best[0]; b += best[1]; c += best[2]; continue; }
      }
      b++;
    }
    else if (/[a-zA-Z]/.test(ch)) { c++; word(); }
    else i++;
  }
  return [a, b, c];
}
const cmpSpec = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
const topSplit = (list) => { const out = []; let d = 0, f = 0; for (let i = 0; i <= list.length; i++) { const ch = list[i]; if (ch === "(" || ch === "[") d++; else if (ch === ")" || ch === "]") d--; else if ((ch === "," && d === 0) || i === list.length) { out.push(list.slice(f, i).trim()); f = i + 1; } } return out.filter(Boolean); };
/** The base classes the last compound of a selector lands on (an :is() list
 *  fans out; a --modifier is its block's element). */
function subjects(part) {
  let d = 0, last = 0;
  for (let i = 0; i < part.length; i++) { const ch = part[i]; if (ch === "(" || ch === "[") d++; else if (ch === ")" || ch === "]") d--; else if (d === 0 && /[\s>+~]/.test(ch)) last = i + 1; }
  const compound = part.slice(last);
  const members = compound.startsWith(":is(") ? topSplit(compound.slice(4, compound.lastIndexOf(")"))) : [compound];
  return members.map((m) => m.replace(/:(?:not|is|where|has)\((?:[^()]|\([^()]*\))*\)/g, "").match(/\.([\w-]+)/)?.[1]?.split("--")[0]).filter(Boolean).map((cls) => `.${cls}`);
}

test("no state rule leaves its own border inside the focus ring: each one that outranks the shared rule joins it", () => {
  // The shared rule hands the border to the ring. A state rule that sets a
  // border colour on the same control and outranks it (a checked box, a
  // pressed chip, high contrast's drawn edge) left another colour inside the
  // ring -- a band (owner, 2026-10-01) -- unless a :focus-visible rule of its
  // own, at least as heavy and later, hands the border back. A state that
  // re-binds --slc-focus to its own border colour joins by construction.
  const all = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m, index) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2], index, at: m.index }));
  const fcAt = css.lastIndexOf("@media (forced-colors: active)");
  const focusIndex = all.findIndex((r) => r.selector === FOCUS.selector);
  const focusOf = new Map();
  for (const part of topSplit(FOCUS.selector)) for (const s of subjects(part)) focusOf.set(s, specificity(part));
  const rebinds = all.flatMap((r) => { const v = decl(r.body, "--slc-focus"); return v ? topSplit(r.selector).map((p) => [p, v]) : []; });
  const joins = all.filter((r) => decl(r.body, "border-color") === "var(--slc-focus)").flatMap((r) => topSplit(r.selector).filter((p) => p.includes(":focus-visible")).map((p) => ({ part: p, index: r.index, spec: specificity(p) })));
  // the states a part asserts (negations dropped: a disabled control takes no focus)
  const tokens = (p) => (p.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "").match(/\[[^\]]+\]|:(?!is\(|where\(|has\(|focus-visible)[a-z-]+/g) ?? []);
  const bands = [];
  for (const r of all) {
    const value = decl(r.body, "border-color");
    if (!value || r.at > fcAt || value === "var(--slc-focus)") continue;
    for (const part of topSplit(r.selector)) {
      if (part.includes(":focus-visible") || /:not\([^)]*:focus/.test(part)) continue;
      const spec = specificity(part);
      for (const s of subjects(part)) {
        const f = focusOf.get(s);
        if (!f || cmpSpec(spec, f) < 0 || (cmpSpec(spec, f) === 0 && r.index < focusIndex)) continue;
        if (rebinds.some(([p, v]) => part.startsWith(p) && v === value)) continue;
        const joined = joins.some((j) => subjects(j.part).includes(s) && (cmpSpec(j.spec, spec) > 0 || (cmpSpec(j.spec, spec) === 0 && j.index > r.index)) && tokens(part).every((t) => j.part.includes(t)));
        if (!joined) bands.push(`${part} (${s})`);
      }
    }
  }
  assert.deepEqual(bands, []);
});

test("forced colours: the halo is off on every control whatever --slc-glow a product's light layer sets", () => {
  // A Tier B light layer sets --slc-glow: 0.35 on :root[data-theme="light"]
  // (0,2,0), which outweighs the forced-colours :root reset; so the halo is
  // also reset on the controls themselves, on the same member list.
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const off = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /--_sl-halo\s*:\s*0 0 transparent/.test(m[2]));
  assert.ok(off, "no forced-colours halo reset");
  assert.deepEqual(members(off[1].trim().replace(/\s+/g, " ")).sort(), members(RESET.selector).sort());
  // it is the later of the two zero-weight declarations, so it wins
  assert.ok(css.lastIndexOf(off[1].trim().slice(0, 20)) > css.indexOf(RESET.selector.slice(0, 20)));
});

// The workbench's two focusable rows (workbench.css, 0.33) join every shared
// list: the ring, the private depth and halo, the painter, and both
// forced-colours resets. A row missing from one loses its halo, paints no
// tile under focus, or keeps a page-colour halo or outline on Highlight.
test("the workbench's focusable pieces are members of every shared focus list", () => {
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const fcHalo = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /--_sl-halo\s*:\s*0 0 transparent/.test(m[2]));
  const fcRing = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /outline-color:\s*CanvasText !important/.test(m[2]));
  // 0.34: a status item that is a button, and the title bar's command field
  for (const cls of [".sl-activitybar__item", ".sl-tree__row", ".sl-statusbar__item", ".sl-titlebar__cmd"]) {
    assert.ok(members(RESET.selector).includes(cls), `${cls}: --_sl-depth / --_sl-halo`);
    assert.ok(members(APPLY.selector).includes(cls), `${cls}: the depth painter`);
    assert.ok(FOCUS.selector.split(",").map((s) => s.trim()).includes(`${cls}:focus-visible`), `${cls}: the shared ring`);
    assert.ok(members(fcHalo[1].trim().replace(/\s+/g, " ")).includes(cls), `${cls}: no halo under forced colours`);
    assert.ok(fcRing[1].includes(`${cls}:focus-visible`), `${cls}: the outline handed back under forced colours`);
  }
  // and the workbench's own rules write their depth into --_sl-depth, never box-shadow
  const wb = bare(read("workbench.css"));
  for (const m of wb.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // a pseudo-element on one (the count badge) is no control: its own shadow is its ring
    if (/\.sl-(activitybar__item|tree__row|statusbar__item|titlebar__cmd)/.test(m[1]) && !/forced-colors|::(before|after)/.test(m[1])) assert.doesNotMatch(m[2], /(?:^|;)\s*box-shadow\s*:/, m[1].trim());
  }
});
