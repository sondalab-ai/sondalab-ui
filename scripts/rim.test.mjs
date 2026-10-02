import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromHex } from "./lib/css-color.mjs";

// No rainbow by default (owner, 2026-10-02: "drop rainbow from fields and
// everything else"). The light theme's spectrum rim -- a 1px gradient painted
// under cards, the primary button and text fields from 0.21 to 0.27 -- is gone.
// A filled control's edge is its accent in shade ("a vibrant colour that goes
// along with the accent"); everything else takes the edge of its context, as
// on the dark theme. The spectrum tokens stay (products may use them) and
// survive only in the opt-in ornaments a consumer adds by name.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const raw = (f) => readFileSync(resolve(KIT, f), "utf8");
const strip = (f) => raw(f).replace(/\/\*[\s\S]*?\*\//g, "");
const css = strip("components.css");
const rule = (sel) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

test("no kit stylesheet paints a spectrum rim any more", () => {
  for (const f of ["components.css", "effects.css", "glass.css", "compositions.css"]) {
    assert.doesNotMatch(strip(f), /--slc-rim/, `${f} still names the rim`);
  }
});

test("components.css reads the spectrum only inside the two opt-in ornaments", () => {
  const owners = [];
  for (const m of css.matchAll(/(--[\w-]+)\s*:([^;]*);/g)) {
    if (/var\(--sl-spectrum-/.test(m[2])) owners.push(m[1]);
  }
  assert.deepEqual([...new Set(owners)].sort(), ["--slc-haze", "--slc-spectral-fill", "--slc-spectral-ink"]);
  // ...and those are consumed only by the classes that are rainbow by name.
  // Every selector in each consuming rule's list, not just its last line.
  const consumers = [...css.matchAll(/([^{}]+)\{[^}]*var\(--slc-(?:haze|spectral-ink|spectral-fill)\b[^}]*\}/g)]
    .flatMap((m) => m[1].split(",").map((s) => s.trim()).filter(Boolean));
  assert.ok(consumers.length > 0, "the opt-in ornaments still read the spectrum");
  for (const sel of consumers) assert.match(sel, /^\.sl-(haze|spectral)\b/, sel);
});

for (const [host, edge] of [
  [".sl-card", /border:\s*1px solid var\(--slc-edge-surface\)/],
  [".sl-field__input", /border:\s*1px solid var\(--slc-edge-control\)/],
  // the primary's edge is its fill set's (0.32, declared on the control):
  // --slc-edge-accent unless a tone swaps the set
  [".sl-btn--primary", /border-color:\s*var\(--_sl-fill-edge\)/],
]) {
  test(`${host}: the edge of its context, and no image under it but the primary's foot`, () => {
    const r = rule(host);
    assert.match(r, edge);
    const images = [...r.matchAll(/background-image:\s*([^;]+)/g)].map((m) => m[1].trim());
    // the one image is the primary's foot, a layer of its own edge (0.32)
    if (host === ".sl-btn--primary") assert.deepEqual(images, ["linear-gradient(var(--_sl-foot-color, var(--_sl-fill-edge)), var(--_sl-foot-color, var(--_sl-fill-edge)))"]);
    else assert.deepEqual(images, []);
    assert.doesNotMatch(r, /background-(clip|origin)/);
  });
}
test("the primary's edge is the fill set's, declared on the control", () => {
  assert.match(rule(":where(.sl-btn--primary, .sl-check__box, .sl-radio__box, .sl-switch__track)"), /--_sl-fill-edge:\s*var\(--slc-edge-accent\);/);
});

// Lumen (0.32, the owner's default): the lit top line goes; the primary
// stands on a foot, one more pixel of its edge along the bottom.
test("the primary stands on a foot, has no lit top line, and moves only its fill and foot on hover and press", () => {
  const r = rule(".sl-btn--primary");
  assert.doesNotMatch(r, /border-top-color/, "no lit top line");
  assert.doesNotMatch(css, /--slc-edge-accent-top/, "the lit line's role is retired");
  assert.match(r, /background-size:\s*100% var\(--_sl-foot\)/);
  assert.match(r, /--_sl-foot:\s*1px/);
  for (const state of [":hover:not(:disabled)", ":active:not(:disabled)"]) {
    const s = rule(`.sl-btn--primary${state}`);
    assert.match(s, /background-color:/, state);
    assert.doesNotMatch(s, /--slc-[\w-]+\s*:/, `${state} declares no role`);
  }
});

test("inside an inversion band spectral text still stands down; there is no rim to reset", () => {
  const band = rule(".sl-invert > *");
  for (const p of ["--slc-spectral-ink", "--slc-spectral-fill"]) assert.match(band, new RegExp(`${p}:\\s*initial`), p);
  assert.doesNotMatch(band, /--slc-rim/);
});

// Contrast of the edges that replaced the rim, on the light theme, for every
// registered accent and spexr's registered fill. A WCAG ratio, the way
// palette-contrast.test.mjs measures it.
const Y = (c) => 0.2126 * c.lin[0] + 0.7152 * c.lin[1] + 0.0722 * c.lin[2];
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const lightEnv = () => {
  const env = new Map();
  for (const f of ["tokens.css", "themes/light.css"]) {
    for (const m of strip(f).matchAll(/(--sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  }
  for (const [k, v] of declarations(raw("components.css"), [":root", ':root[data-sl-theme="light"]'])) env.set(k, v);
  return env;
};
const darkEnv = () => {
  const env = new Map();
  for (const f of ["tokens.css", "themes/dark.css"]) {
    for (const m of strip(f).matchAll(/(--sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  }
  for (const [k, v] of declarations(raw("components.css"), [":root"])) env.set(k, v);
  return env;
};
const registry = JSON.parse(raw("agent/accent-registry.json")).products;
const FILLS = [
  ...Object.entries(registry).filter(([, e]) => e.light).map(([n, e]) => [n, e.light]),
  ["spexr fill", registry.spexr.fill.light],
];

for (const [name, fill] of FILLS) {
  test(`light, ${name} ${fill}: the primary's edge is the fill in shade and finds it better than the fill does`, () => {
    const env = lightEnv();
    env.set("--sl-accent-default", fill);
    const canvas = evaluate("var(--slc-canvas)", env);
    const edge = evaluate("var(--slc-edge-accent)", env);
    const f = fromHex(fill);
    assert.ok(Y(edge) < Y(f), "the edge is darker than its fill");
    assert.ok(ratio(edge, canvas) >= ratio(f, canvas), `edge ${ratio(edge, canvas).toFixed(2)}:1 on the canvas, fill ${ratio(f, canvas).toFixed(2)}:1`);
    // Owner, 2026-10-02: with the rim gone the edge is the primary's boundary,
    // so it holds the 3:1 a control boundary needs (amber was 2.46:1).
    assert.ok(ratio(edge, canvas) >= 3, `edge ${ratio(edge, canvas).toFixed(2)}:1 on the canvas, needs 3:1`);
  });
}

// spexr's registered fill reaches the primary through the one role since 0.32
// (--slc-accent-fill), and the edge follows it: the fill in shade, capped on
// paper, never the accent's edge under a fill of another colour.
test("light: a product's accent fill takes the primary's edge with it", () => {
  const env = lightEnv();
  env.set("--sl-accent-default", registry.spexr.light);
  env.set("--slc-accent-fill", registry.spexr.fill.light);
  const edge = evaluate("var(--slc-edge-accent)", env);
  const want = evaluate(`oklch(from ${registry.spexr.fill.light} min(calc(l - 0.075), 0.59) c h)`, env);
  assert.deepEqual(edge.lin.map((v) => v.toFixed(5)), want.lin.map((v) => v.toFixed(5)));
});

// Regression (review of 0.28.0): the paper cap must not reach ink. On the dark
// theme the primary's edge is the plain step, exactly as in 0.27.
const DARK_FILLS = Object.entries(registry).filter(([, e]) => e.dark).map(([n, e]) => [n, e.dark]);
for (const [name, fill] of DARK_FILLS) {
  test(`dark, ${name} ${fill}: the primary's edge is the 0.27 step, uncapped`, () => {
    const env = darkEnv();
    env.set("--sl-accent-default", fill);
    const edge = evaluate("var(--slc-edge-accent)", env);
    const plain = evaluate(`oklch(from ${fill} calc(l - 0.075) c h)`, env);
    assert.deepEqual(edge.lin.map((v) => v.toFixed(5)), plain.lin.map((v) => v.toFixed(5)));
  });
}

test("light: a card's edge is its surface in shade, visibly apart from it", () => {
  const env = lightEnv();
  const surface = evaluate("var(--slc-surface)", env);
  const edge = evaluate("var(--slc-edge-surface)", env);
  assert.ok(Y(edge) < Y(surface));
  assert.ok(ratio(edge, surface) >= 1.2, `${ratio(edge, surface).toFixed(2)}:1`);
});

test("light: a field's edge is the one control edge, 3:1 on the canvas and the surface", () => {
  const env = lightEnv();
  const edge = evaluate("var(--slc-edge-control)", env);
  for (const g of ["--slc-canvas", "--slc-surface"]) {
    const r = ratio(edge, evaluate(`var(${g})`, env));
    assert.ok(r >= 3, `${g} ${r.toFixed(2)}:1`);
  }
});
