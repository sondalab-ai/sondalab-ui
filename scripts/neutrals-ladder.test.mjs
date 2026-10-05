import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromHex, fromOklch, maxChroma, toHex, toOklch } from "./lib/css-color.mjs";
import { parseSheet, el, customs } from "./lib/cascade.mjs";
import { loadTokens, loadRegistry } from "./lib/tokens.mjs";
import {
  buildNeutrals, validateNeutrals, productPairs, neutralsJson, productsCss, accentFor, mergeAuthored, splitRoles,
  bakeCode, fillFor, CHROMA_LIMIT, RGB_SPREAD_LIMIT, THEMES, THEME_SLOTS, CODE_SLOTS, GLINT_MIRROR,
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
        for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--_?sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
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
        for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--_?sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
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
  // 0.17 mirrors to L 1.0, where no chroma is left; 0.20 (0.35) mirrors to 0.97.
  const errors = withLadder((n) => { n.ladder.light["text-primary"] = [0.17, 0.01]; });
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

// ── Lumen parity: colour (0.35) ─────────────────────────────────────────────
// The light ink moves to the Lumen target's L 0.20, the syntax palette ships
// in neutrals.json for hex-only consumers (spexr's Monaco theme), and a
// product's registered fill is generated into products.css and neutrals.json,
// so a fill change is one registry line and a regeneration.

const REPO = resolve(HERE, "..");
const LUMEN = resolve(REPO, "lab/directions-2/dir-lumen.css");
/** The Lumen target's declarations per theme (html[data-dir=lumen][data-sl-theme=t] blocks). */
const lumenTheme = (theme) => {
  const css = readFileSync(LUMEN, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map();
  for (const m of css.matchAll(new RegExp(`html\\[data-dir="lumen"\\]\\[data-sl-theme="${theme}"\\]\\s*\\{([^}]*)\\}`, "g"))) {
    for (const d of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(d[1], d[2].trim());
  }
  return out;
};

test("light primary text is the Lumen ink, oklch L 0.20, on every product", () => {
  assert.deepEqual(tokens.neutrals.ladder.light["text-primary"], [0.2, 0.01]);
  for (const [id, p] of Object.entries(shipped.products)) {
    const [L] = toOklch(fromHex(p.light["text-primary"]));
    assert.ok(Math.abs(L - 0.2) < 0.003, `${id} ${p.light["text-primary"]} is L ${L.toFixed(4)}`);
  }
  // spexr #1b1d22 and the default #201c18 until 0.35 (L 0.23)
  assert.equal(shipped.products.spexr.light["text-primary"], "#14161b");
  assert.equal(shipped.products.default.light["text-primary"], "#191511");
});

test("every neutral rung and hairline the Lumen target declares is the ladder's", (t) => {
  if (!existsSync(LUMEN)) return t.skip("the lab reference is gone");
  const bad = [];
  for (const theme of THEMES) {
    const lumen = lumenTheme(theme);
    for (const [prop, v] of lumen) {
      const m = v.match(/^oklch\(from var\(--sl-accent-default\) ([\d.]+) ([\d.]+) h\)$/);
      if (!m || !prop.startsWith("--sl-")) continue;
      const role = prop.slice(5);
      const want = [Number(m[1]), Number(m[2])];
      if (JSON.stringify(tokens.neutrals.ladder[theme][role]) !== JSON.stringify(want)) bad.push(`${theme} ${role}: ladder ${JSON.stringify(tokens.neutrals.ladder[theme][role])}, Lumen ${JSON.stringify(want)}`);
    }
    // --lu-hair is the island's hairline (border-subtle), --lu-hair-2 a ring
    // and a rule (border-default); the kit keeps its own product-tinted ink.
    const alpha = (name) => Number(lumen.get(name)?.match(/\/\s*([\d.]+)\)$/)?.[1]);
    if (tokens.neutrals.border[theme].subtle !== alpha("--lu-hair")) bad.push(`${theme} border-subtle ${tokens.neutrals.border[theme].subtle}, Lumen ${alpha("--lu-hair")}`);
    if (tokens.neutrals.border[theme].default !== alpha("--lu-hair-2")) bad.push(`${theme} border-default ${tokens.neutrals.border[theme].default}, Lumen ${alpha("--lu-hair-2")}`);
  }
  assert.deepEqual(bad, []);
});

test("the glass glint's mirror is one number in the generator and in the four CSS expressions, and the paper glint stays at L 0.97", () => {
  const found = ["effects.css", "glass.css"].flatMap((f) => [...read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/max\(l, ([\d.]+) - l\)/g)].map((m) => [f, Number(m[1])]));
  assert.deepEqual(found.map(([f]) => f), ["effects.css", "effects.css", "effects.css", "glass.css"], "the veil, the glint, the press light and glass.css's pole");
  for (const [f, k] of found) assert.equal(k, GLINT_MIRROR, f);
  // 1.2 - 0.23 until 0.35; the same light on paper with the darker ink
  assert.ok(Math.abs((GLINT_MIRROR - tokens.neutrals.ladder.light["text-primary"][0]) - 0.97) < 1e-9);
});

const CODE_HUES = ["keyword", "string", "number", "boolean", "function", "tag", "builtin"];
test("neutrals.json carries the whole syntax palette per product and theme: the rungs tinted, the hues fixed and equal to the theme files", () => {
  const decl = (css, name) => css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m"))?.[1];
  for (const theme of THEMES) {
    const css = read(`themes/${theme}.css`);
    for (const [id, p] of Object.entries(shipped.products)) {
      const roles = Object.keys(p[theme]).filter((k) => k.startsWith("code-")).map((k) => k.slice(5));
      assert.deepEqual([...roles].sort(), [...CODE_SLOTS].sort(), `${id} ${theme}`);
      for (const role of CODE_SLOTS) assert.match(p[theme][`code-${role}`], /^#[0-9a-f]{6}$/, `${id} ${theme} code-${role}`);
      for (const role of CODE_HUES) assert.equal(p[theme][`code-${role}`], decl(css, `--sl-code-${role}`), `${id} ${theme} code-${role}`);
      assert.equal(p[theme]["code-boolean"], p[theme]["code-number"], "boolean reads as number");
      assert.equal(p[theme]["code-tag"], p[theme]["code-keyword"], "tag reads as keyword");
    }
  }
  // the rungs are the product's: spexr's light code-fg is not the default's
  assert.notEqual(shipped.products.spexr.light["code-fg"], shipped.products.default.light["code-fg"]);
});

test("products.css sets each registered fill on its product's theme blocks, and no fill anywhere else", () => {
  const css = read("themes/products.css");
  for (const id of Object.keys(registry.products)) for (const theme of THEMES) {
    const sel = `[data-sl-product="${id}"][data-sl-theme="${theme}"],\n[data-sl-product="${id}"] [data-sl-theme="${theme}"] {`;
    const at = css.indexOf(sel);
    assert.ok(at >= 0, `${id} ${theme}`);
    const body = css.slice(at + sel.length, css.indexOf("}", at));
    assert.equal(body.match(/--slc-accent-fill:\s*([^;]+);/)?.[1], fillFor(registry, id)?.[theme], `${id} ${theme}`);
  }
  const registered = Object.keys(registry.products).flatMap((id) => Object.keys(fillFor(registry, id) ?? {}));
  assert.ok(registered.length > 0, "the registry has a fill to emit");
  assert.equal((css.match(/--slc-accent-fill:/g) ?? []).length, registered.length, "one declaration per registered fill");
  assert.doesNotMatch(css, /high-contrast/);
});

test("neutrals.json exports the registered fill beside the accent, and no fill key where there is none", () => {
  for (const [id, p] of Object.entries(shipped.products)) {
    const want = fillFor(registry, id);
    if (want) assert.deepEqual(p.fill, want, id);
    else assert.equal("fill" in p, false, id);
  }
  assert.deepEqual(shipped.products.spexr.fill, registry.products.spexr.fill);
});

/** A primary on a product page (html[data-sl-product][data-sl-theme] > body >
 *  button) through the kit's own sheets, with `products` as products.css:
 *  its fill set as the control derives it (components.css) and the root's
 *  public roles, as evaluated colours. */
function fillSet(products, id, theme) {
  const rules = [];
  let order = 0;
  for (const css of [read("tokens.css"), read("themes/light.css"), read("themes/dark.css"), read("themes/high-contrast.css"), products, read("components.css")]) {
    const r = parseSheet(css, {}, order);
    order += r.length + 1;
    rules.push(...r);
  }
  const html = el({ tag: "html", attrs: { "data-sl-theme": theme, "data-sl-product": id } });
  const p = customs(rules, el({ tag: "button", classes: ["sl-btn", "sl-btn--primary"], parent: el({ tag: "body", parent: html }) }));
  const r = customs(rules, html);
  const v = (n, env) => evaluate(`var(${n})`, env);
  return {
    control: { fill: v("--_sl-fill", p), label: v("--_sl-on-fill", p), hover: v("--_sl-fill-hover", p), press: v("--_sl-fill-active", p) },
    root: { fill: v("--slc-accent-fill", r), label: v("--slc-on-accent-fill", r), hover: v("--slc-accent-fill-hover", r), press: v("--slc-accent-fill-active", r) },
  };
}
/** Every reading of the label under 4.5:1 on its fill, hovered and pressed. */
const labelMisses = (set, where) => Object.entries(set).flatMap(([scope, s]) => ["fill", "hover", "press"]
  .map((k) => [k, ratioY(Yc(s.label), Yc(s[k]))]).filter(([, r]) => r < 4.5).map(([k, r]) => `${where} ${scope} ${k} ${r.toFixed(2)}`));

test("every registered fill reaches the primary and the root's roles from products.css, and its label reads at rest, hovered and pressed (4.5:1)", () => {
  const css = read("themes/products.css");
  const bad = [];
  for (const id of Object.keys(registry.products)) for (const [theme, want] of Object.entries(fillFor(registry, id) ?? {})) {
    const set = fillSet(css, id, theme);
    for (const scope of ["control", "root"]) assert.equal(toHex(set[scope].fill), want.toLowerCase(), `${id} ${theme} ${scope}`);
    bad.push(...labelMisses(set, `${id} ${theme}`));
  }
  assert.deepEqual(bad, []);
});

test("a dark-fill change is one registry line: the regenerated products.css carries it and the kit's own chain labels it at 4.5:1", () => {
  const reg = structuredClone(registry);
  reg.products.spexr.fill.dark = "#8b96ff";
  const b = buildNeutrals(tokens, reg);
  assert.deepEqual(validateNeutrals(b), []);
  const css = productsCss(b);
  const block = (theme) => css.slice(css.indexOf(`[data-sl-product="spexr"][data-sl-theme="${theme}"]`)).split("}")[0];
  assert.match(block("dark"), /--slc-accent-fill: #8b96ff;/);
  assert.match(block("light"), new RegExp(`--slc-accent-fill: ${registry.products.spexr.fill.light};`));
  assert.deepEqual(JSON.parse(neutralsJson(b)).products.spexr.fill, { light: registry.products.spexr.fill.light, dark: "#8b96ff" });
  // through components.css: the control's fill set and the root's roles
  const dark = fillSet(css, "spexr", "dark");
  for (const scope of ["control", "root"]) assert.equal(toHex(dark[scope].fill), "#8b96ff", scope);
  assert.ok(toOklch(dark.control.label)[0] < 0.5, "a light fill takes the dark pole");
  assert.deepEqual(labelMisses(dark, "spexr dark"), []);
  assert.deepEqual(labelMisses(fillSet(css, "spexr", "light"), "spexr light"), []);
});

test("guard: a registered fill that is not a 6-digit hex fails the build", () => {
  const reg = structuredClone(registry);
  reg.products.spexr.fill.dark = "indigo";
  assert.throws(() => buildNeutrals(tokens, reg), /"spexr" fill\.dark indigo is not a 6-digit hex/);
  const inheriting = { products: { ...registry.products, fork: { inherits: "spexr" } } };
  assert.deepEqual(fillFor(inheriting, "fork"), registry.products.spexr.fill, "a product inheriting spexr takes its fill");
});

test("guard: a code triple outside sRGB keeps its lightness and hue and gives up chroma, never clipped", () => {
  const baked = bakeCode({ light: { keyword: [0.47, 0.3, 240] }, dark: {} });
  const [L, C, h] = toOklch(fromHex(baked.light.keyword));
  assert.equal(baked.reduced.length, 1);
  assert.ok(Math.abs(L - 0.47) < 0.004 && Math.abs(h - 240) < 1.5, `${baked.light.keyword} L ${L} h ${h}`);
  assert.ok(C < 0.3 && Math.abs(C - maxChroma(0.47, 240)) < 0.004, `${C}`);
  assert.notEqual(baked.light.keyword, toHex(fromOklch([0.47, 0.3, 240])), "not the per-channel clip");
});

test("guard: a code role name outside the palette fails the build, so a typo ships no new token", () => {
  assert.throws(() => bakeCode({ light: { keywrd: [0.48, 0.17, 285] }, dark: {} }), /code\.light: "keywrd" is not a code role/);
  assert.throws(() => bakeCode({ light: {}, dark: {}, alias: { bool: "number" } }), /code\.alias: "bool" is not a code role/);
  assert.throws(() => bakeCode({ light: {}, dark: {}, alias: { boolean: "numbr" } }), /code\.alias\.boolean: "numbr" is not a code role/);
  assert.throws(() => bakeCode({ ligth: {}, dark: {} }), /code\.ligth: not a theme or "alias"/);
  const t = structuredClone(tokens);
  t.code.dark.keywrd = t.code.dark.keyword;
  assert.throws(() => buildNeutrals(t, registry), /"keywrd" is not a code role/);
});

test("guard: a malformed code role, an alias with no target and a role the ladder owns fail the build", () => {
  assert.throws(() => bakeCode({ light: { keyword: [0.5, 0.1] }, dark: {} }), /code\.light\.keyword/);
  assert.throws(() => bakeCode({ light: { keyword: "#12345" }, dark: {} }), /not a 6-digit hex/);
  assert.throws(() => bakeCode({ light: {}, dark: {}, alias: { boolean: "number" } }), /code\.alias\.boolean: light has no number/);
  const t = structuredClone(tokens);
  t.code.light.fg = [0.3, 0, 0];
  assert.throws(() => buildNeutrals(t, registry), /the neutral ladder owns code-fg/);
});
