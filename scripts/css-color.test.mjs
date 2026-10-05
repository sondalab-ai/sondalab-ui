import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { evaluate, scope, within, toHex } from "./lib/css-color.mjs";
import { parseSheet, el, cascaded, customs, matches, specificity, longhand } from "./lib/cascade.mjs";

// The test evaluator and cascade themselves. The kit's contrast and cascade
// tests are only as true as these: a flat map of declarations once let a role
// computed on :root re-derive on a descendant, which no browser does, and
// that is how a subtree accent losing the primary's hover went unseen.

test("a custom property computes where it is declared: a :root role does not follow a descendant's re-binding", () => {
  const root = new Map([["--a", "#ff0000"], ["--hover", "color-mix(in srgb, var(--a) 60%, black)"]]);
  const child = within(root, [["--a", "#0000ff"]]);
  assert.equal(toHex(evaluate("var(--hover)", child)), "#990000", "inherited as :root computed it");
  const own = within(root, [["--a", "#0000ff"], ["--mine", "color-mix(in srgb, var(--a) 60%, black)"]]);
  assert.equal(toHex(evaluate("var(--mine)", own)), "#000099", "declared on the element, it follows the element's value");
  // a grandchild inherits the child's computed values
  const grand = within(own, [["--b", "var(--mine)"]]);
  assert.equal(toHex(evaluate("var(--b)", grand)), "#000099");
});

test("guaranteed-invalid: `initial` and an unresolved var() without fallback leave the property absent, so a var() takes its fallback", () => {
  const root = scope(null, [["--x", "initial"], ["--y", "var(--nope)"], ["--z", "var(--y, #00ff00)"], ["--w", "var(--x, #ff00ff)"]]);
  assert.equal(root.has("--x"), false);
  assert.equal(root.has("--y"), false);
  assert.equal(toHex(evaluate("var(--z)", root)), "#00ff00");
  assert.equal(toHex(evaluate("var(--w)", root)), "#ff00ff");
  // flat maps follow the same rule through substitute()
  assert.equal(toHex(evaluate("var(--q, #123456)", new Map([["--q", "var(--missing)"]]))), "#123456");
});

test("a color-mix weight is a percentage: literal 0-100%, or a percentage-typed calculation clamped to that range", () => {
  const env = new Map([["--g", "0.5"]]);
  assert.ok(Math.abs(evaluate("color-mix(in srgb, #ff0000 calc(22% * min(1, var(--g) * 1000)), transparent)", env).alpha - 0.22) < 1e-9);
  assert.equal(evaluate("color-mix(in srgb, #ff0000 calc(150%), transparent)", env).alpha, 1, "a calculated weight is clamped");
  for (const bad of ["calc(0.22)", "0.22", "150%", "calc(22% + 1)", "calc(22% * 2%)", "calc(1 / 2%)"]) {
    assert.throws(() => evaluate(`color-mix(in srgb, #ff0000 ${bad}, transparent)`, env), undefined, bad);
  }
});

test("the cascade: specificity, then !important, then order; :where weighs nothing, :is its heaviest argument", () => {
  assert.deepEqual(specificity(":where(.a, .b) .c"), [0, 1, 0]);
  assert.deepEqual(specificity(':is(.a, .b[x="y"]):not(.c)'), [0, 3, 0]);
  assert.deepEqual(specificity(":root[data-x] button"), [0, 2, 1]);
  const rules = parseSheet(`
    .b { color: red; }
    :where(.b) { color: blue; }
    .a.b { color: green; }
    .b { padding: 1px !important; }
    .a.b { padding: 2px; }
    @media (forced-colors: active) { .b { color: black; } }
  `);
  const e = el({ classes: ["a", "b"], parent: el({ tag: "html" }) });
  const won = cascaded(rules, e);
  assert.equal(won.get("color").value, "green");
  assert.equal(won.get("padding").value, "1px", "!important wins over weight");
  assert.equal(cascaded(parseSheet(".b { color: red; } @media (forced-colors: active) { .b { color: black; } }", { forcedColors: true }), e).get("color").value, "black");
});

test("the cascade matches compounds, combinators and state pseudo-classes", () => {
  const html = el({ tag: "html", attrs: { "data-sl-theme": "dark" } });
  const region = el({ parent: el({ tag: "body", parent: html }), attrs: { "data-sl-fx": "off" } });
  const input = el({ tag: "input", classes: ["i"], states: ["checked"], parent: region });
  const box = el({ tag: "span", classes: ["box"], parent: region, prev: input });
  assert.ok(matches(':root[data-sl-theme="dark"] .box', box));
  assert.ok(matches(".i:checked + .box", box));
  assert.ok(!matches(".i:indeterminate + .box", box));
  assert.ok(matches(':is([data-sl-fx="off"], [data-sl-fx="off"] *).box', box));
  assert.ok(matches(".box:where(:root:not([data-sl-theme=\"high-contrast\"]) *)", box));
  assert.ok(!matches(".box:not([data-x], .box)", box));
  assert.ok(!matches(".box::after", box), "a pseudo-element is not the element");
  // custom properties inherit down the tree and compute per element
  const rules = parseSheet(":root { --a: #ff0000; --h: color-mix(in srgb, var(--a) 60%, black); } [data-sl-fx] { --a: #0000ff; }");
  assert.equal(toHex(evaluate("var(--h)", customs(rules, box))), "#990000");
  assert.equal(toHex(evaluate("var(--a)", customs(rules, box))), "#0000ff");
});

// The cascade's silent gaps (0.32.1): each of these used to answer wrongly
// without a word, which a contrast matrix built on the cascade would inherit.
test("the cascade reads an attribute value in single quotes, double quotes or none", () => {
  const html = el({ tag: "html", attrs: { "data-sl-theme": "light" } });
  const section = el({ tag: "section", parent: el({ tag: "body", parent: html }), attrs: { "data-product": "introspect" } });
  assert.ok(matches(":root[data-sl-theme='light'] [data-product]", section), "single quotes");
  assert.ok(matches(':root[data-sl-theme="light"] [data-product]', section), "double quotes");
  assert.ok(matches(":root[data-sl-theme=light] [data-product=introspect]", section), "unquoted");
  assert.ok(!matches(":root[data-sl-theme='dark'] [data-product]", section), "a single-quoted value that differs");
});

test("the cascade honours every attribute operator, and throws on a selector it cannot read", () => {
  const e = el({ attrs: { class: "sl-btn sl-btn--primary", lang: "en-GB", "data-x": "glass-pane" } });
  const yes = ['[data-x^="glass"]', '[data-x$="pane"]', '[data-x*="ss-p"]', '[class~="sl-btn--primary"]', '[lang|="en"]', '[lang|="en-GB"]'];
  const no = ['[data-x^="pane"]', '[data-x$="glass"]', '[data-x*="nope"]', '[class~="sl-btn--"]', '[lang|="e"]', '[lang|="GB"]'];
  for (const s of yes) assert.ok(matches(s, e), s);
  for (const s of no) assert.ok(!matches(s, e), s);
  for (const s of ['[data-x!="glass"]', '[data-x="glass" i]']) assert.throws(() => matches(s, e), /cannot read the attribute selector/, s);
});

test("the cascade: a property repeated in one rule takes its last declaration, unless an earlier one is !important", () => {
  const e = el({ classes: ["a"], parent: el({ tag: "html" }) });
  const won = cascaded(parseSheet(".a { --x: #E0942A; --x: oklch(from red l c h); color: red !important; color: blue; }"), e);
  assert.equal(won.get("--x").value, "oklch(from red l c h)", "the later declaration wins, as a browser's does");
  assert.equal(won.get("color").value, "red", "!important still wins over a later normal one");
  // across rules, source order still decides between equal weights
  assert.equal(cascaded(parseSheet(".a { color: red; color: green; } .a { color: blue; }"), e).get("color").value, "blue");
});

test("the cascade resolves a colour longhand against its shorthand, and refuses a shorthand it cannot read", () => {
  const e = el({ classes: ["a", "b"], parent: el({ tag: "html" }) });
  const rules = parseSheet(".a { background-color: red; } .a.b { background: var(--f); } .c { background: url(x.png) no-repeat, red; }");
  assert.equal(longhand(cascaded(rules, e), "background-color").value, "var(--f)", "the heavier shorthand sets the colour");
  assert.equal(longhand(cascaded(parseSheet(".a.b { background: blue; } .a.b { background-color: red; }"), e), "background-color").value, "red", "a later longhand wins at equal weight");
  const c = el({ classes: ["c"], parent: el({ tag: "html" }) });
  assert.throws(() => longhand(cascaded(rules, c), "background-color"), /cannot read/);
});

// 0.32.1: the accent's steps are a macro -- a custom property holding channel
// expressions, substituted into a relative colour where it is used -- and
// they ease chroma with pow(), so the evaluator reads both as Chrome does.
test("pow() evaluates, and a custom property holding channel expressions is a macro inside a relative colour", () => {
  const env = new Map([["--f", "#4c58e9"], ["--step", "calc(l - 0.05) calc(c * pow(0.5, 2)) h"]]);
  const viaMacro = evaluate("oklch(from var(--f) var(--step))", env);
  const spelled = evaluate("oklch(from #4c58e9 calc(l - 0.05) calc(c * 0.25) h)", new Map());
  assert.ok(viaMacro.lin.every((v, i) => Math.abs(v - spelled.lin[i]) < 1e-12), "the macro's `l` and `c` bind to the colour it is used in, and pow(0.5, 2) is 0.25");
});

// 0.32.1: the step rule reads a fill's WCAG luminance from its own oklch
// channels (--_sl-lum, tokens.css), with cos() and sin() of its hue in
// radians; the evaluator must agree with the colour's real luminance.
test("cos() and sin() evaluate in radians, and the kit's luminance macro is the fill's WCAG luminance", () => {
  assert.ok(Math.abs(evaluate("oklch(calc(cos(0) * 0.5) 0 0)", new Map()).lin[0] - 0.125) < 1e-12);
  assert.ok(Math.abs(evaluate("oklch(calc(sin(3.141592653589793 / 2) * 0.5) 0 0)", new Map()).lin[1] - 0.125) < 1e-12);
  const macro = readFileSync(new URL("../packages/ui-kit/tokens.css", import.meta.url), "utf8").match(/--_sl-lum:\s*([^;]+);/)[1];
  const env = new Map([["--_sl-lum", macro]]);
  for (const hex of ["#FF9F1C", "#4c58e9", "#0e9c84", "#2ee6c0", "#58a6ff", "#fe8263"]) {
    const c = evaluate(hex, env);
    const Y = 0.2126 * c.lin[0] + 0.7152 * c.lin[1] + 0.0722 * c.lin[2];
    // the macro's value, carried out as the lightness of a grey
    const viaMacro = evaluate(`oklch(from ${hex} calc(var(--_sl-lum)) 0 0)`, env);
    assert.ok(Math.abs(Math.cbrt(viaMacro.lin[1]) - Y) < 1e-6, hex);
  }
});
