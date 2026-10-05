import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromSrgb, toHex, toSrgb, within } from "./lib/css-color.mjs";

// Page-wide defaults (0.27.1): selected text and the scrollbar thumb, measured
// from the rules components.css actually declares, evaluated over each theme's
// real role-vars — page grounds and the inversion band alike.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const raw = read("components.css");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
const tokenEnv = (src) => {
  const env = new Map();
  for (const m of src.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--_?sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  return env;
};
const SHARED = tokenEnv(read("tokens.css"));
const THEMES = ["light", "dark", "high-contrast"];

/** The role-vars on :root for a theme (high contrast adds its own remap). */
function rootEnv(theme) {
  const env = new Map([...SHARED, ...tokenEnv(read(`themes/${theme}.css`))]);
  const sels = [":root", ...(theme === "high-contrast" ? [':root[data-sl-theme="high-contrast"]'] : [])];
  for (const [k, v] of declarations(raw, sels)) env.set(k, v);
  return env;
}
/** A child of the band: its declarations, with currentColor bound to the
 *  band's ink, computed over what it inherits from :root. */
function bandEnv(theme) {
  const env = rootEnv(theme);
  const ink = toHex(evaluate("var(--slc-canvas)", env));
  return within(env, declarations(raw, [".sl-invert > *"]).map(([k, v]) => [k, v.replace(/currentColor/g, ink)]));
}
const Y = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const over = (top, under) => {
  const t = toSrgb(top), u = toSrgb(under);
  return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha)));
};
/** The declared value of `prop` in the flat rule whose selector is exactly `sel`. */
function declared(sel, prop) {
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].trim() === sel);
  assert.ok(rule, `no rule ${sel}`);
  const m = rule[2].match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
  assert.ok(m, `${sel} declares no ${prop}`);
  return m[1].trim();
}

const SEL_BG = declared("::selection", "background");
const SEL_TEXT = declared("::selection", "color");
const BAND_TEXT = declared(":where(.sl-invert)::selection", "color");
// The label set in the button and the label wrapped in a child of it (a
// <span>, an effect layer): the child matches ::selection itself and would
// otherwise take --slc-text, light on the dark theme's amber.
const PRIMARY_TEXT = declared(":where(.sl-btn--primary)::selection,\n:where(.sl-btn--primary) ::selection", "color");

test("selection is a wash of the accent, not a literal", () => {
  assert.match(SEL_BG, /^color-mix\(in srgb, var\(--slc-accent\) \d+%, transparent\)$/);
});

for (const theme of THEMES) {
  test(`${theme}: selected text reads at 4.5:1 on canvas, surface and raised`, () => {
    const env = rootEnv(theme);
    const low = ["canvas", "surface", "raised"].map((g) => {
      const ground = evaluate(`var(--slc-${g})`, env);
      return [g, ratio(evaluate(SEL_TEXT, env), over(evaluate(SEL_BG, env), ground))];
    }).filter(([, r]) => r < 4.5).map(([g, r]) => `${g} ${r.toFixed(2)}`);
    assert.deepEqual(low, []);
  });

  test(`${theme}: selected text reads at 4.5:1 inside the inversion band, child or direct`, () => {
    const page = rootEnv(theme);
    const bandGround = evaluate("var(--slc-text)", page);
    const child = bandEnv(theme);
    const childRatio = ratio(evaluate(SEL_TEXT, child), over(evaluate(SEL_BG, child), bandGround));
    // Text straight in the band resolves against the band element itself,
    // where the role-vars are still the page's.
    const directRatio = ratio(evaluate(BAND_TEXT, page), over(evaluate(SEL_BG, page), bandGround));
    assert.ok(childRatio >= 4.5, `child ${childRatio.toFixed(2)}`);
    assert.ok(directRatio >= 4.5, `direct ${directRatio.toFixed(2)}`);
  });

  test(`${theme}: a selected primary label reads at 4.5:1 on its fill`, () => {
    const env = rootEnv(theme);
    const fill = over(evaluate(SEL_BG, env), evaluate("var(--slc-accent)", env));
    const r = ratio(evaluate(PRIMARY_TEXT, env), fill);
    assert.ok(r >= 4.5, r.toFixed(2));
  });
}

test("scrollbars: thin, a control-edge thumb, no track, off on high contrast, zero specificity", () => {
  const sel = ':where(:root:not([data-sl-theme="high-contrast"]))';
  assert.equal(declared(sel, "scrollbar-color"), "var(--slc-edge-control) transparent");
  assert.equal(declared(sel, "scrollbar-width"), "thin");
  assert.doesNotMatch(css, /::-webkit-scrollbar/, "the kit leaves WebKit scrollbar pseudo-elements alone");
  // Page scrollbar only: <body> hands `auto` back by inheritance, so products'
  // hand-drawn ::-webkit-scrollbar rules keep working (Chromium ignores them
  // under a non-auto scrollbar-color).
  assert.equal(declared(':where(:root:not([data-sl-theme="high-contrast"]) > body)', "scrollbar-color"), "auto");
});

// The thumb resolves on :root and inherits as a computed colour, so inside a
// band it is still the page's: measured there too. 3:1 is WCAG 1.4.11.
for (const theme of ["light", "dark"]) {
  test(`${theme}: the scrollbar thumb is found at 3:1 on every ground, the band included`, () => {
    const env = rootEnv(theme);
    const thumb = evaluate(declared(':where(:root:not([data-sl-theme="high-contrast"]))', "scrollbar-color").split(" ")[0], env);
    const low = ["canvas", "surface", "raised", "text"].map((g) => [g, ratio(thumb, evaluate(`var(--slc-${g})`, env))])
      .filter(([, r]) => r < 3).map(([g, r]) => `${g === "text" ? "band" : g} ${r.toFixed(2)}`);
    assert.deepEqual(low, []);
  });
}
