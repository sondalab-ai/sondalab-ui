import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeColor,
  colorBase,
  extractColors,
  buildAllowlistBases,
  detectTier,
  auditCss,
  matchesSelector,
  resolveAccentEntry,
} from "../packages/ui-kit/agent/sl-audit.mjs";

// --- colour normalization (the bug-prone core) ---

test("normalizeColor: 3-digit hex expands and lowercases", () => {
  assert.equal(normalizeColor("#FFF"), "#ffffff");
  assert.equal(normalizeColor("#abc"), "#aabbcc");
});

test("normalizeColor: 6-digit hex passes through lowercased", () => {
  assert.equal(normalizeColor("#FFFFFF"), "#ffffff");
  assert.equal(normalizeColor("#15211F"), "#15211f");
});

test("normalizeColor: 4- and 8-digit hex carry alpha", () => {
  assert.equal(normalizeColor("#FFFA"), "#ffffffaa");
  assert.equal(normalizeColor("#15211F66"), "#15211f66");
});

test("normalizeColor: rgb() with spaces or commas both canonicalize to hex", () => {
  assert.equal(normalizeColor("rgb(255 255 255)"), "#ffffff");
  assert.equal(normalizeColor("rgb(255, 255, 255)"), "#ffffff");
  assert.equal(normalizeColor("rgb(255,255,255)"), "#ffffff");
});

test("normalizeColor: rgba() encodes alpha into the 8-digit form", () => {
  // 0.4 * 255 = 102 = 0x66
  assert.equal(normalizeColor("rgba(21,33,31,0.4)"), "#15211f66");
  // 0.12 * 255 = 30.6 -> 31 = 0x1f
  assert.equal(normalizeColor("rgba(197,122,22,0.12)"), "#c57a161f");
});

test("normalizeColor: rgb( r g b / a ) slash-alpha form", () => {
  assert.equal(normalizeColor("rgb(255 255 255 / 0.5)"), "#ffffff80");
});

test("normalizeColor: non-colours return null", () => {
  assert.equal(normalizeColor("transparent"), null);
  assert.equal(normalizeColor("var(--sl-text-primary)"), null);
  assert.equal(normalizeColor("1.5rem"), null);
});

test("colorBase strips alpha to the opaque rgb", () => {
  assert.equal(colorBase("#15211f66"), "#15211f");
  assert.equal(colorBase("#ffffff"), "#ffffff");
});

// --- extraction ---

test("extractColors finds hex and rgb literals, ignores var()", () => {
  const css = `.a { color: #B56A0C; border: 1px solid var(--x); background: rgba(21,33,31,0.4); }`;
  const found = extractColors(css).map((c) => c.value);
  assert.deepEqual(found, ["#B56A0C", "rgba(21,33,31,0.4)"]);
});

// --- allowlist from tokens ---

test("buildAllowlistBases includes theme, accent, and accent-subtle bases", () => {
  const tokens = {
    themes: { light: { "text-primary": "#15211F" } },
    accent: { light: { default: "#B56A0C", subtle: "rgba(197,122,22,0.12)" } },
  };
  const bases = buildAllowlistBases(tokens);
  assert.ok(bases.has("#15211f"), "theme text base present");
  assert.ok(bases.has("#b56a0c"), "accent default base present");
  assert.ok(bases.has("#c57a16"), "accent subtle base (distinct from default) present");
});

// --- tier detection ---

test("detectTier reads the selector convention", () => {
  assert.equal(detectTier(`[data-sl-theme="dark"] { --x: 1 }`), "A");
  assert.equal(detectTier(`[data-theme="dark"] { --x: 1 }`), "B");
  assert.equal(detectTier(`[data-theme] { --x: 1 }`), "B", "a bare attribute selector is still the Tier B convention");
  // REGRESSION: the name must be followed by a delimiter, not merely begin the
  // attribute. A theme TOGGLE's own hooks are not a theme selector, and
  // matching the prefix reported sondalab-site — which uses data-sl-theme
  // correctly — as a Tier B surface on the strength of its own button markup.
  assert.equal(detectTier(`[data-theme-toggle] { --x: 1 }`), null, "a JS hook is not a theme selector");
  assert.equal(detectTier(`[data-theme-label] { --x: 1 }`), null);
  assert.equal(
    detectTier(`[data-sl-theme="dark"] [data-theme-toggle] { --x: 1 }`), "A",
    "and a Tier A surface keeps its tier even when it carries such a hook",
  );
});

// --- blessed selector matching (over-match guard) ---

test("matchesSelector is delimited: --rule does not match --rule-2 or --ruler", () => {
  assert.ok(matchesSelector("  --rule: color-mix(...)", "--rule"));
  assert.ok(!matchesSelector("  --rule-2: color-mix(...)", "--rule"));
  assert.ok(!matchesSelector("  --ruler: 1px", "--rule"));
});

test("matchesSelector matches a compound class selector", () => {
  assert.ok(matchesSelector(".artifact .ok { color: #62d094 }", ".artifact .ok"));
  assert.ok(!matchesSelector(".okay { color: red }", ".ok"));
});

test("matchesSelector never matches an empty selector", () => {
  assert.ok(!matchesSelector("anything at all", ""));
  assert.ok(!matchesSelector("anything at all", "   "));
});

test("an empty-string blessed selector does not suppress everything", () => {
  const css = `.x { color: #3aa0ff; }`;
  const r = auditCss({
    css,
    tokens: { themes: { light: {} }, accent: { light: {} } },
    accentEntry: {},
    blessed: { deviations: [{ kind: "color", selectors: [""], why: "malformed" }] },
    declaredTier: "B",
  });
  assert.equal(r.findings.filter((f) => f.rule === "accent-one-hue").length, 1);
});

// --- accent inherits resolution ---

test("resolveAccentEntry follows a chained inherit transitively", () => {
  const reg = {
    products: {
      default: { light: "#B56A0C", dark: "#F5A83C" },
      daos: { inherits: "default" },
      sub: { inherits: "daos" },
    },
  };
  assert.equal(resolveAccentEntry(reg, "sub").light, "#B56A0C");
});

test("resolveAccentEntry throws on a circular inherit instead of degrading", () => {
  const reg = { products: { a: { inherits: "b" }, b: { inherits: "a" } } };
  assert.throws(() => resolveAccentEntry(reg, "a"), /circular/);
});

// --- integration: value-equality + blessed suppression + tier ---

const TOKENS = {
  themes: { light: { "text-primary": "#15211F", "bg-canvas": "#ECE4D4" } },
  accent: { light: { default: "#B56A0C" } },
};

test("auditCss flags a free-floating colour as an R-violation", () => {
  const css = `[data-theme="light"] .x { color: #3aa0ff; }`;
  const r = auditCss({
    css,
    tokens: TOKENS,
    accentEntry: {},
    blessed: { tier: "B", deviations: [] },
    declaredTier: "B",
  });
  const colorFindings = r.findings.filter((f) => f.rule === "accent-one-hue");
  assert.equal(colorFindings.length, 1);
  assert.match(colorFindings[0].message, /#3aa0ff/);
});

test("auditCss suppresses a colour under a blessed selector", () => {
  const css = `.artifact .ok { color: #62d094; }`;
  const r = auditCss({
    css,
    tokens: TOKENS,
    accentEntry: {},
    blessed: {
      tier: "B",
      deviations: [{ kind: "color", selectors: [".artifact .ok"], value: "on-ink green", why: "x" }],
    },
    declaredTier: "B",
  });
  assert.equal(r.findings.filter((f) => f.rule === "accent-one-hue").length, 0);
});

test("auditCss suppresses a colour blessed by exact value (demo data, no selector)", () => {
  const css = `var ACCENTS = { indigo: { d: "#8b96ff" } };`;
  const r = auditCss({
    css,
    tokens: TOKENS,
    accentEntry: {},
    blessed: { deviations: [{ kind: "color", values: ["#8b96ff"], why: "swatch demo" }] },
    declaredTier: "B",
  });
  assert.equal(r.findings.filter((f) => f.rule === "accent-one-hue").length, 0);
});

test("value-blessing is exact — a near-miss colour is still flagged", () => {
  const css = `.x { color: #8b96fe; }`;
  const r = auditCss({
    css,
    tokens: TOKENS,
    accentEntry: {},
    blessed: { deviations: [{ kind: "color", values: ["#8b96ff"], why: "swatch demo" }] },
    declaredTier: "B",
  });
  assert.equal(r.findings.filter((f) => f.rule === "accent-one-hue").length, 1);
});

test("auditCss flags a tier mismatch", () => {
  const css = `[data-sl-theme="light"] { --x: 1 }`;
  const r = auditCss({
    css,
    tokens: TOKENS,
    accentEntry: {},
    blessed: { tier: "B", deviations: [] },
    declaredTier: "B",
  });
  assert.equal(r.findings.filter((f) => f.rule === "theme-selector").length, 1);
});

test("auditCss accepts an in-token colour", () => {
  const css = `[data-theme="light"] .x { color: #15211F; background: #ECE4D4; }`;
  const r = auditCss({
    css,
    tokens: TOKENS,
    accentEntry: {},
    blessed: { tier: "B", deviations: [] },
    declaredTier: "B",
  });
  assert.equal(r.findings.filter((f) => f.rule === "accent-one-hue").length, 0);
});
