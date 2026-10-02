import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, scope, within, toHex } from "./lib/css-color.mjs";
import { parseSheet, el, cascaded, customs, matches, specificity } from "./lib/cascade.mjs";

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
