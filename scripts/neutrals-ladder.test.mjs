import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromHex, fromOklch, maxChroma, toHex, toOklch } from "./lib/css-color.mjs";
import { loadTokens, loadRegistry } from "./lib/tokens.mjs";
import {
  buildNeutrals, validateNeutrals, productPairs, neutralsJson, productsCss, accentFor, mergeAuthored, splitRoles,
  CHROMA_LIMIT, RGB_SPREAD_LIMIT, THEMES, THEME_SLOTS,
} from "./lib/neutrals.mjs";

// The neutral ladder (0.29, Lumen): one [L, C] per role per theme, tinted with
// each product's accent hue and baked to literal hex, because Monaco, xterm,
// Electron, spexr's preload and sl-audit read neutrals as hex. These guards
// hold what the generator promises: hex out, near-grey (the ink effect's
// isChromatic must not see a hue), inside sRGB, committed files in step with
// a fresh build, one look per hue, and the contrast floors on every product.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (f) => readFileSync(resolve(KIT, f), "utf8");
const tokens = loadTokens();
const registry = loadRegistry();
const build = buildNeutrals(tokens, registry);
const shipped = JSON.parse(read("neutrals.json"));

const Y = (hex) => { const [r, g, b] = fromHex(hex).lin; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const Yc = (c) => 0.2126 * c.lin[0] + 0.7152 * c.lin[1] + 0.0722 * c.lin[2];
const ratioY = (a, b) => { const [hi, lo] = [a, b].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const ratio = (a, b) => ratioY(Y(a), Y(b));
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const GROUNDS = ["bg-canvas", "bg-surface", "bg-surface-raised", "bg-tile", "bg-sunken"];
const LADDER_ROLES = (theme) => Object.keys(tokens.neutrals.ladder[theme]);

// ── the generator's own guards ──────────────────────────────────────────────

test("the shipped ladder validates: no clipping, no hue, no twin products", () => {
  assert.deepEqual(validateNeutrals(build), []);
});

test("committed neutrals.json is a fresh build", () => {
  const text = read("neutrals.json");
  assert.equal(text, neutralsJson(build));
});

test("committed themes/products.css is a fresh build", () => {
  const text = read("themes/products.css");
  assert.equal(text, productsCss(build));
});

test("every registered product has a block per theme in products.css", () => {
  const css = read("themes/products.css");
  for (const id of Object.keys(registry.products)) for (const theme of THEMES) {
    assert.ok(css.includes(`[data-sl-product="${id}"][data-sl-theme="${theme}"],\n[data-sl-product="${id}"] [data-sl-theme="${theme}"] {`), `${id} ${theme}`);
  }
});

test("the theme files carry the default product's neutrals in hex", () => {
  for (const theme of THEMES) {
    const css = read(`themes/${theme}.css`);
    for (const [role, v] of Object.entries(shipped.products.default[theme])) {
      assert.match(css, new RegExp(`^\\s*--sl-${role}: ${v.replace(/[()]/g, "\\$&")};$`, "m"), `${theme} ${role}`);
    }
  }
});

test("the package exports and ships products.css and neutrals.json", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.exports["./themes/products.css"], "./themes/products.css");
  assert.equal(pkg.exports["./neutrals.json"], "./neutrals.json");
  assert.ok(pkg.files.includes("themes/products.css"), "files: themes/products.css");
  assert.ok(pkg.files.includes("neutrals.json"), "files: neutrals.json");
});

test("high contrast keeps its own literals: no ladder, no product block", () => {
  assert.equal(tokens.neutrals.ladder["high-contrast"], undefined);
  assert.doesNotMatch(read("themes/products.css"), /high-contrast/);
});

// ── hex out, near-grey, in gamut ────────────────────────────────────────────

for (const [id, p] of Object.entries(shipped.products)) {
  for (const theme of THEMES) {
    test(`${id} ${theme}: every ladder role is a 6-digit hex the ink effect reads as grey`, () => {
      const bad = [];
      for (const role of LADDER_ROLES(theme)) {
        const hex = p[theme][role];
        if (!/^#[0-9a-f]{6}$/.test(hex)) { bad.push(`${role} ${hex} is not hex`); continue; }
        const C = toOklch(fromHex(hex))[1];
        const spread = Math.max(...rgbOf(hex)) - Math.min(...rgbOf(hex));
        if (C >= CHROMA_LIMIT) bad.push(`${role} ${hex} chroma ${C.toFixed(4)}`);
        if (spread > RGB_SPREAD_LIMIT) bad.push(`${role} ${hex} rgb spread ${spread}`);
      }
      assert.deepEqual(bad, []);
    });
    test(`${id} ${theme}: borders (and the light overlay) are the product's own ink, the lit edge is white`, () => {
      const [r, g, b] = rgbOf(p[theme]["text-primary"]);
      for (const [k, a] of Object.entries(tokens.neutrals.border[theme])) {
        assert.equal(p[theme][`border-${k}`], `rgba(${r},${g},${b},${a})`, k);
      }
      // The light overlay is cast in the product's ink, so the old cool ink
      // (28,29,34) leaks into no product's allowlist through it; dark's
      // overlay stays a black literal in the theme file.
      if (theme === "light") assert.equal(p.light["bg-overlay"], `rgba(${r},${g},${b},${tokens.neutrals.overlay.light})`);
      else assert.equal(p.dark["bg-overlay"], undefined);
      assert.equal(p[theme]["border-lit"], `rgba(255,255,255,${tokens.neutrals["border-lit"][theme]})`);
      assert.equal(p[theme]["code-null"], p[theme]["code-comment"], "null reads as comment");
    });
  }
}

// ── one look per hue ────────────────────────────────────────────────────────

test("the hue source: default from the token accent, others from the registry, inherits followed", () => {
  for (const theme of THEMES) {
    assert.equal(accentFor(tokens, registry, "default", theme), tokens.accent[theme].default);
    assert.equal(accentFor(tokens, registry, "daos", theme), tokens.accent[theme].default);
    assert.equal(accentFor(tokens, registry, "spexr", theme), registry.products.spexr[theme]);
  }
});

for (const theme of THEMES) {
  test(`${theme}: products with different hues bake different neutrals; a shared hue bakes the same`, () => {
    for (const { a, b, sameHue, identical } of productPairs(build, theme)) {
      assert.equal(identical, sameHue, `${a} / ${b}: same hue ${sameHue}, identical ${identical}`);
    }
  });
}

// ── contrast floors, on every product ───────────────────────────────────────

for (const [id, p] of Object.entries(shipped.products)) {
  if (p.inherits) continue;
  for (const theme of THEMES) {
    const n = p[theme];
    test(`${id} ${theme}: text and code read on every ground (text 4.5:1, comment 3:1)`, () => {
      const bad = [];
      for (const g of GROUNDS) {
        for (const role of ["text-primary", "text-secondary", "text-muted", "code-fg"]) {
          const r = ratio(n[role], n[g]);
          if (r < 4.5) bad.push(`${role} on ${g} ${r.toFixed(2)}`);
        }
        const r = ratio(n["code-comment"], n[g]);
        if (r < 3) bad.push(`code-comment on ${g} ${r.toFixed(2)}`);
      }
      assert.deepEqual(bad, []);
    });

    // The one control edge (components.css) steps from the surface toward
    // contrast; it must find a control on the canvas and the surface (WCAG
    // 1.4.11), with margin: the Lumen canvas left five steps at 3.02:1.
    test(`${id} ${theme}: the one control edge clears 3:1 with margin on canvas and surface`, () => {
      const env = new Map();
      for (const f of ["tokens.css", `themes/${theme}.css`]) {
        for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
      }
      for (const [role, v] of Object.entries(n)) env.set(`--sl-${role}`, v);
      // :root only: the step count reads the surface, never the theme
      // attribute, so a Tier B layer on its own [data-theme] gets it too.
      for (const [k, v] of declarations(read("components.css"), [":root"])) env.set(k, v);
      const edge = Yc(evaluate("var(--slc-edge-control)", env));
      const bad = ["bg-canvas", "bg-surface"].map((g) => [g, ratioY(edge, Y(n[g]))])
        .filter(([, r]) => r < 3.2).map(([g, r]) => `${g} ${r.toFixed(2)}`);
      assert.deepEqual(bad, []);
    });
  }
}

// The filled primary is found by its fill in shade, capped on paper
// (--slc-edge-accent-lmax). Every registered light accent and spexr's fill
// keeps 3.3:1 on its own product's canvas, read both as CSS Color 4 gamut
// mapping would paint it and as Chrome paints it (each channel clipped).
for (const [id, p] of Object.entries(shipped.products)) {
  if (p.inherits) continue;
  const fills = [registry.products[id].light, registry.products[id].fill?.light].filter(Boolean);
  for (const fill of fills) {
    test(`${id} light ${fill}: the primary's edge finds it on the product's canvas (3.3:1)`, () => {
      const env = new Map();
      for (const f of ["tokens.css", "themes/light.css"]) {
        for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
      }
      for (const [role, v] of Object.entries(p.light)) env.set(`--sl-${role}`, v);
      for (const [k, v] of declarations(read("components.css"), [":root", ':root[data-sl-theme="light"]'])) env.set(k, v);
      env.set("--sl-accent-default", fill);
      const [L, C, h] = toOklch(evaluate("var(--slc-edge-accent)", env));
      const readings = [toHex(fromOklch([L, Math.min(C, maxChroma(L, h)), h])), toHex(fromOklch([L, C, h]))];
      const bad = readings.map((e) => [e, ratio(e, p.light["bg-canvas"])]).filter(([, r]) => r < 3.3).map(([e, r]) => `${e} ${r.toFixed(2)}`);
      assert.deepEqual(bad, []);
    });
  }
}

// ── the guards catch what they claim to ─────────────────────────────────────
// Synthetic ladders, so each guard is seen failing on the input it exists for.

const withLadder = (edit) => {
  const t = structuredClone(tokens);
  edit(t.neutrals);
  return validateNeutrals(buildNeutrals(t, registry));
};

test("guard: a ladder chroma at the isChromatic threshold fails the build", () => {
  const errors = withLadder((n) => { n.ladder.dark["bg-tile"] = [0.255, 0.05]; });
  assert.ok(errors.some((e) => /ladder dark bg-tile: chroma 0.05/.test(e)), errors.join("\n"));
});

test("guard: a role outside sRGB fails the build", () => {
  const errors = withLadder((n) => { n.ladder.light["bg-surface"] = [0.999, 0.03]; });
  assert.ok(errors.some((e) => /light bg-surface: outside sRGB/.test(e)), errors.join("\n"));
});

test("guard: paper ink too dark for its glass glint fails the build", () => {
  const errors = withLadder((n) => { n.ladder.light["text-primary"] = [0.2, 0.01]; });
  assert.ok(errors.some((e) => /light text-primary: its glass glint/.test(e)), errors.join("\n"));
});

test("guard: two hues baking the same neutrals fail the build", () => {
  const errors = withLadder((n) => {
    for (const theme of THEMES) for (const role of Object.keys(n.ladder[theme])) n.ladder[theme][role] = [n.ladder[theme][role][0], 0];
  });
  assert.ok(errors.some((e) => /spexr and local-agents have different accent hues but identical neutrals/.test(e)), errors.join("\n"));
});

test("guard: a hand-written theme entry for a generated role fails the build", () => {
  const generated = splitRoles(build.products.default.light).theme;
  assert.throws(() => mergeAuthored(generated, { ...tokens.themes.light, "bg-overlay": "rgba(28,29,34,0.4)" }, THEME_SLOTS, "themes.light"),
    /themes\.light: bg-overlay generated by the neutral ladder and also written by hand/);
  assert.doesNotThrow(() => mergeAuthored(generated, tokens.themes.light, THEME_SLOTS, "themes.light"));
});

test("a grey accent gets untinted neutrals, not hue 0's pink", () => {
  const reg = { products: { ...registry.products, grey: { light: "#808080", dark: "#8a8a8a" }, slate: { light: "#6b6b6b", dark: "#999999" } } };
  const b = buildNeutrals(tokens, reg);
  for (const theme of THEMES) {
    assert.equal(b.products.grey.hue[theme], null);
    for (const role of LADDER_ROLES(theme)) {
      const [r, g, bl] = rgbOf(b.products.grey[theme][role]);
      assert.ok(r === g && g === bl, `${theme} ${role} ${b.products.grey[theme][role]} is not a pure grey`);
    }
  }
  // Two grey products share "no hue": the same neutrals are expected, not an error.
  assert.deepEqual(validateNeutrals(b), []);
  assert.equal(JSON.parse(neutralsJson(b)).products.grey.hue.light, null);
});

test("guard: a registry cycle or a dangling inherit fails the build", () => {
  const cyc = { products: { ...registry.products, a: { inherits: "b" }, b: { inherits: "a" } } };
  assert.throws(() => buildNeutrals(tokens, cyc), /circular/);
  const dangling = { products: { ...registry.products, c: { inherits: "nope" } } };
  assert.throws(() => buildNeutrals(tokens, dangling), /unknown product/);
});
