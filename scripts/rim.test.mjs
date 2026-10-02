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
  const consumers = [...css.matchAll(/([^{}]+)\{[^}]*var\(--slc-(?:haze|spectral-ink|spectral-fill)\b[^}]*\}/g)]
    .map((m) => m[1].trim().split("\n").pop().trim());
  for (const sel of consumers) assert.match(sel, /^\.sl-(haze|spectral)\b/, sel);
});

for (const [host, edge] of [
  [".sl-card", /border:\s*1px solid var\(--slc-edge-surface\)/],
  [".sl-field__input", /border:\s*1px solid var\(--slc-edge-control\)/],
  [".sl-btn--primary", /border-color:\s*var\(--slc-edge-accent\)/],
]) {
  test(`${host}: the edge of its context, and no image under it`, () => {
    const r = rule(host);
    assert.match(r, edge);
    assert.doesNotMatch(r, /background-(image|clip|origin)/);
  });
}

test("the primary keeps its lit top line and moves only its fill on hover and press", () => {
  assert.match(rule(".sl-btn--primary"), /border-top-color:\s*color-mix\(in srgb, var\(--slc-accent\) 80%, white\)/);
  for (const state of [":hover:not(:disabled)", ":active:not(:disabled)"]) {
    const r = rule(`.sl-btn--primary${state}`);
    assert.match(r, /background-color:/, state);
    assert.doesNotMatch(r, /--slc-[\w-]+\s*:/, `${state} declares no role`);
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
