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
  auditEffectsRuntime,
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

// --- check 8: the effect layer's runtime ---
// The omission this covers shipped to production once: sondalab.eu carried every
// glass class and never armed the tier, because no colour check can see a
// missing mount() and nothing else was looking.

const markup = (cls) => ({ file: "page.html", text: `<div class="${cls}">go</div>` });

test("effects-runtime: classes used with no mount() anywhere is an R-violation", () => {
  const out = auditEffectsRuntime([markup("sl-btn sl-fx-glass sl-fx-glass--pane")]);
  assert.equal(out.length, 1);
  assert.equal(out[0].level, "R");
  assert.equal(out[0].rule, "effects-runtime");
  assert.match(out[0].message, /mount\(\)/);
});

test("effects-runtime: a mount() call in ANY scanned file clears it", () => {
  // The call almost never lives in the markup, which is why the check is
  // surface-level rather than per-file.
  const out = auditEffectsRuntime([
    markup("sl-fx-aurora"),
    { file: "main.js", text: 'import { mount } from "@sondalab/ui-kit/effects.js";\nmount();' },
  ]);
  assert.deepEqual(out, []);
});

test("effects-runtime: importing mount without calling it does not count", () => {
  const out = auditEffectsRuntime([
    markup("sl-fx-glass"),
    { file: "main.js", text: 'import { mount, mountGpu } from "@sondalab/ui-kit/effects.js";' },
  ]);
  assert.equal(out.length, 1, "an import wires nothing");
});

test("effects-runtime: mountGpu() alone does not count as armed", () => {
  // mountGpu() returns false unless mount() ran first, so a surface with only
  // the GPU call is exactly as unarmed as one with none.
  const out = auditEffectsRuntime([
    markup("sl-fx-glass"),
    { file: "main.js", text: "await mountGpu();" },
  ]);
  assert.equal(out.length, 1);
});

test("effects-runtime: a stylesheet DEFINING the family never fires", () => {
  // The kit's own effects.css is full of `.sl-fx-glass { … }`. Matching the
  // selector form rather than the attribute form would flag the design system
  // itself — the same shape of error the deferred colour checks exist to avoid.
  const out = auditEffectsRuntime([
    { file: "effects.css", text: ".sl-fx-glass { --slfx-ring-w: 1px; }\n.sl-fx-aurora::after { content: ''; }" },
  ]);
  assert.deepEqual(out, []);
});

test("effects-runtime: one finding for the whole surface, not one per file", () => {
  const out = auditEffectsRuntime([
    { file: "a.html", text: '<b class="sl-fx-glass">a</b>' },
    { file: "b.html", text: '<b class="sl-fx-aurora">b</b>' },
    { file: "c.html", text: '<b class="sl-fx-liquid">c</b>' },
  ]);
  assert.equal(out.length, 1, "the omission is a property of the surface");
  assert.equal(out[0].file, "a.html");
  assert.match(out[0].message, /and 2 more file\(s\)/);
});

test("effects-runtime: JSX className is markup too", () => {
  const out = auditEffectsRuntime([{ file: "Btn.jsx", text: '<b className="sl-fx-glass">x</b>' }]);
  assert.equal(out.length, 1);
});

test("effects-runtime: a declared Tier-0 surface can bless the omission", () => {
  // A host that genuinely cannot run the JS takes Tier 0 — but it declares that,
  // the way every other deviation is declared, rather than passing by silence.
  const out = auditEffectsRuntime([markup("sl-fx-glass")], {
    blessed: { deviations: [{ kind: "effects-runtime", why: "SSR-only email template; no JS runtime" }] },
  });
  assert.deepEqual(out, []);
});

test("effects-runtime: a surface with no effect classes is silent", () => {
  const out = auditEffectsRuntime([markup("sl-btn sl-btn--primary")]);
  assert.deepEqual(out, []);
});

// A comment that names a selector convention is prose, not a selector: found
// on introspect (2026-09-30), where a comment explaining why the product does
// NOT use the kit's theme attribute made the audit report Tier A.
test("detectTier ignores selectors named only in comments", () => {
  assert.equal(detectTier(`/* we do not use [data-sl-theme] here */\n[data-theme="dark"] { --x: 1 }`), "B");
  assert.equal(detectTier(`<!-- not [data-sl-theme] -->\n<style>[data-theme="dark"] { --x: 1 }</style>`), "B");
  assert.equal(detectTier(`/* [data-theme] and [data-sl-theme] */ .x { --x: 1 }`), null);
});

test("the tier finding points at the real selector, not at a comment", () => {
  const css = `/* unlike [data-sl-theme], … */\n.a { --x: 1 }\n[data-sl-theme="dark"] .b { --x: 1 }`;
  const r = auditCss({ css, tokens: TOKENS, blessed: { tier: "B", deviations: [] }, declaredTier: "B" });
  const tier = r.findings.filter((f) => f.rule === "theme-selector");
  assert.equal(tier.length, 1);
  assert.equal(tier[0].line, 3);
});

// --- a product's registered filled primary (owner, 2026-10-02) ---
// spexr fills its primary with ONE deeper indigo, registered as `fill` in its
// accent-registry entry, and derives hover and active from it. This is the
// exact block handed to spexr-overrides.css: under spexr's real entry and the
// kit's real token CSS it must audit clean, so the registered fill is what
// lets it through, and no step is a literal.
const SPEXR_FILL_CSS = `:is([data-sl-theme="light"], [data-sl-theme="dark"]) .sl-btn--primary {
  --slc-accent: #4c58e9;
  --slc-accent-hover: color-mix(in srgb, var(--slc-accent) 89%, black);
  --slc-accent-active: color-mix(in srgb, var(--slc-accent) 76%, black);
  --slc-edge-accent: oklch(from var(--slc-accent) calc(l - var(--slc-shade-step, 0.075)) c h);
  --slc-on-accent: #ffffff;
}`;

test("spexr's filled primary audits clean under spexr's registry entry", async () => {
  const { readFileSync } = await import("node:fs");
  const kit = new URL("../packages/ui-kit/", import.meta.url);
  const { buildAllowlistBasesFromCss } = await import("../packages/ui-kit/agent/sl-audit.mjs");
  const allowlistBases = buildAllowlistBasesFromCss(
    ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"].map((f) => readFileSync(new URL(f, kit), "utf8")),
  );
  const registry = JSON.parse(readFileSync(new URL("agent/accent-registry.json", kit), "utf8"));
  assert.equal(registry.products.spexr.fill?.light, "#4c58e9", "the fill is registered");
  const r = auditCss({
    css: SPEXR_FILL_CSS,
    allowlistBases,
    accentEntry: resolveAccentEntry(registry, "spexr"),
    declaredTier: "A",
  });
  assert.deepEqual(r.findings, []);
});

// --- each product's generated neutrals (0.29) ---
// Neutrals are tinted with each product's accent hue and baked to hex
// (neutrals.json). A product's own grounds are tokens on that product and
// free-floating colours on any other; the default product's stay allowed for
// everyone, because they ship in the theme files.
{
  const { readFileSync } = await import("node:fs");
  const { productNeutralBases, allowlistForProduct, buildAllowlistBasesFromCss } = await import("../packages/ui-kit/agent/sl-audit.mjs");
  const kit = new URL("../packages/ui-kit/", import.meta.url);
  const cssTexts = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"]
    .map((f) => readFileSync(new URL(f, kit), "utf8"));
  const neutrals = JSON.parse(readFileSync(new URL("neutrals.json", kit), "utf8"));
  const registry = JSON.parse(readFileSync(new URL("agent/accent-registry.json", kit), "utf8"));
  const audit = (css, product) => auditCss({
    css,
    allowlistBases: allowlistForProduct({ cssTexts, neutrals, product }),
    accentEntry: resolveAccentEntry(registry, product),
    declaredTier: "A",
  }).findings.filter((f) => f.rule === "accent-one-hue");

  const spexrCanvas = neutrals.products.spexr.light["bg-canvas"];
  const spexrText = neutrals.products.spexr.dark["text-primary"];

  test("neutrals: the fixture values are product-only (not in the default theme CSS)", () => {
    const shipped = buildAllowlistBasesFromCss(cssTexts);
    assert.ok(!shipped.has(spexrCanvas), `${spexrCanvas} must not already be a default token`);
    assert.ok(!shipped.has(spexrText), `${spexrText} must not already be a default token`);
  });

  test("neutrals: a product's own generated ground audits clean on that product", () => {
    assert.deepEqual(audit(`[data-sl-theme="light"] .x { background: ${spexrCanvas}; color: ${spexrText}; }`, "spexr"), []);
  });

  test("neutrals: another product's ground is free-floating (R)", () => {
    const f = audit(`[data-sl-theme="light"] .x { background: ${spexrCanvas}; }`, "introspect");
    assert.equal(f.length, 1);
    assert.equal(f[0].level, "R");
  });

  test("neutrals: a generated border (rgba of the product's ink) is allowed by its base", () => {
    assert.deepEqual(audit(`.x { border-color: ${neutrals.products.spexr.dark["border-default"]}; }`, "spexr"), []);
  });

  test("neutrals: the default product's grounds stay allowed for every product", () => {
    const d = neutrals.products.default;
    for (const product of Object.keys(registry.products)) {
      assert.deepEqual(audit(`.x { background: ${d.light["bg-canvas"]}; color: ${d.dark["text-muted"]}; }`, product), [], product);
    }
  });

  test("neutrals: an inheriting product gets its parent's neutrals", () => {
    const own = productNeutralBases({ products: { a: { light: { "bg-canvas": "#123456" } }, b: { inherits: "a" } } }, "b");
    assert.ok(own.has("#123456"));
    assert.deepEqual([...productNeutralBases(neutrals, "daos")].sort(), [...productNeutralBases(neutrals, "default")].sort());
  });

  test("neutrals: an unknown product or a missing neutrals.json adds nothing", () => {
    assert.equal(productNeutralBases(neutrals, "nope").size, 0);
    assert.equal(productNeutralBases(null, "spexr").size, 0);
  });

  test("neutrals: a circular inherit throws instead of degrading", () => {
    assert.throws(() => productNeutralBases({ products: { a: { inherits: "b" }, b: { inherits: "a" } } }, "a"), /circular/);
  });
}

// --- the bin runs however it is reached (0.33.1) ---
// npm's node_modules/.bin/sl-audit is a symlink to this file, and pnpm's shim
// calls node on a path through a linked package directory; either way
// process.argv[1] is not the module's real path. Until 0.33.1 the main-module
// guard compared the two unresolved, so through either the audit printed
// nothing and exited 0, and a consumer gating on it passed silently.
{
  const { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { after } = await import("node:test");

  const kitDir = fileURLToPath(new URL("../packages/ui-kit", import.meta.url));
  const script = join(kitDir, "agent", "sl-audit.mjs");
  const literal = "#3aa0ff";
  const tmp = mkdtempSync(join(tmpdir(), "sl-audit-bin-"));
  after(() => rmSync(tmp, { recursive: true, force: true }));
  writeFileSync(join(tmp, "fixture.css"), `.x { color: ${literal}; }\n`);

  const binDir = join(tmp, "node_modules", ".bin");
  mkdirSync(binDir, { recursive: true });
  symlinkSync(script, join(binDir, "sl-audit"));
  mkdirSync(join(tmp, "node_modules", "@sondalab"));
  symlinkSync(kitDir, join(tmp, "node_modules", "@sondalab", "ui-kit"), "dir");

  const run = (entry) =>
    spawnSync(process.execPath, [entry, "--surface", "fixture.css", "--product", "default", "--fail-on", "R"], {
      cwd: tmp,
      encoding: "utf8",
    });

  for (const [how, entry] of [
    ["directly", script],
    ["through a symlink to the file (npm's .bin)", join(binDir, "sl-audit")],
    ["through a linked package directory (pnpm)", join(tmp, "node_modules", "@sondalab", "ui-kit", "agent", "sl-audit.mjs")],
  ]) {
    test(`the bin reports an R finding and exits 1 when run ${how}`, () => {
      const r = run(entry);
      const out = `status ${r.status}\n--- stdout\n${r.stdout}\n--- stderr\n${r.stderr}`;
      assert.match(r.stdout, /R-violation \([1-9]\d*\)/, out);
      assert.match(r.stdout, new RegExp(`fixture\\.css:1 .*${literal}`), out);
      assert.equal(r.status, 1, out);
    });
  }
}
