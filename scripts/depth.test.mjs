import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromSrgb, substitute, toHex, toOklch, toSrgb, within } from "./lib/css-color.mjs";
import { allowlistForProduct } from "../packages/ui-kit/agent/sl-audit.mjs";

// Lumen depth (ui-kit 0.31): radii, casts, the depth recipes (--slc-depth-*),
// tile selection, the keycap and the tile tabs, measured from the rules
// components.css declares, evaluated over every product's real neutrals.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const raw = read("components.css");
const css = bare(raw);
const TOKENS = bare(read("tokens.css"));
const tokenEnv = (src) => {
  const env = new Map();
  for (const m of bare(src).matchAll(/(--_?sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  return env;
};
const SHARED = tokenEnv(read("tokens.css"));
const NEUTRALS = JSON.parse(read("neutrals.json")).products;
const REGISTRY = JSON.parse(read("agent/accent-registry.json")).products;
const PRODUCTS = Object.keys(NEUTRALS).filter((p) => !NEUTRALS[p].inherits);

/** Flat rules of components.css (outside nested at-rules too): [{ selector, body }]. */
const RULES = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
const rule = (sel) => {
  const r = RULES.find((x) => x.selector === sel);
  assert.ok(r, `no rule ${sel}`);
  return r.body;
};
const decl = (body, prop) => body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1].trim().replace(/\s+/g, " ");
/** Custom-property declarations of the rules whose selector is exactly one of `sels`, whitespace collapsed. */
const vars = (sels) => new Map(declarations(raw, sels).map(([k, v]) => [k, v.replace(/\s+/g, " ")]));

/** The role-vars on :root for one product on one theme, the way a Tier A
 *  page resolves them: shared tokens, the theme file, the product's baked
 *  neutrals and accent, then components.css's :root and the theme's block. */
function rootEnv(theme, product = "default") {
  const env = new Map([...SHARED, ...tokenEnv(read(`themes/${theme}.css`))]);
  if (theme !== "high-contrast") {
    for (const [role, v] of Object.entries(NEUTRALS[product][theme])) env.set(`--sl-${role}`, v);
    const accent = REGISTRY[product][theme];
    env.set("--sl-accent-default", accent);
    if (theme === "dark") env.set("--sl-focus-ring", accent);
  }
  const sels = [":root", ...(theme === "high-contrast" ? [] : []), ...({ light: [':root[data-sl-theme="light"]'], "high-contrast": [':root[data-sl-theme="high-contrast"]'] }[theme] ?? [])];
  for (const [k, v] of declarations(raw, sels)) env.set(k, v);
  return env;
}
/** A child of the inversion band: its own declarations, currentColor bound
 *  to the band's ink, computed over what it inherits from :root (a role the
 *  band does not re-declare keeps the value :root computed). */
const bandDecls = (sels, ink) => sels.flatMap((s) => declarations(raw, [s])).map(([k, v]) => [k, v.replace(/currentColor/g, ink)]);
function bandEnv(theme, product) {
  const env = rootEnv(theme, product);
  return within(env, bandDecls([".sl-invert > *"], toHex(evaluate("var(--slc-canvas)", env))));
}
/** A Tier B page: no theme file and no --sl-* colour token, only the shared
 *  :root layer, components.css, and the product's own colour layer mapping
 *  the README's role-vars (here from its neutrals.json entry) plus the
 *  light-layer numbers. */
function tierBEnv(theme, product) {
  const env = new Map(SHARED);
  for (const [k, v] of declarations(raw, [":root"])) env.set(k, v);
  const n = NEUTRALS[product][theme];
  const map = {
    "--slc-accent": REGISTRY[product][theme], "--slc-canvas": n["bg-canvas"], "--slc-surface": n["bg-surface"], "--slc-raised": n["bg-surface-raised"],
    "--slc-overlay": n["bg-overlay"] ?? "rgba(0,0,0,0.6)", "--slc-text": n["text-primary"], "--slc-text-secondary": n["text-secondary"], "--slc-text-muted": n["text-muted"],
    "--slc-border": n["border-default"], "--slc-border-subtle": n["border-subtle"], "--slc-border-strong": n["border-strong"], "--slc-focus": REGISTRY[product][theme],
  };
  for (const [k, v] of Object.entries(map)) env.set(k, v);
  if (theme === "light") for (const [k, v] of Object.entries({ "--sl-accent-text-lmax": "0.46", "--slc-edge-accent-lmax": "0.59", "--slc-glow": "0.35" })) env.set(k, v);
  for (const t of ["--sl-bg-tile", "--sl-bg-sunken", "--sl-border-lit"]) assert.equal(env.has(t), false, `a Tier B page has no ${t}`);
  return env;
}
/** A child of the inversion band on the high-contrast theme: the band's
 *  declarations, then the high-contrast band remap. */
function hcBandEnv() {
  const env = rootEnv("high-contrast");
  return within(env, bandDecls([".sl-invert > *", ':root[data-sl-theme="high-contrast"] .sl-invert > *'], toHex(evaluate("var(--slc-canvas)", env))));
}
/** The colours of every layer of a box-shadow list, evaluated: "none" is no layer. */
function shadowColours(value, env) {
  const text = substitute(value, env).trim();
  if (text === "none") return [];
  const layers = [];
  let depth = 0, from = 0;
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if ((ch === "," && depth === 0) || i === text.length) { layers.push(text.slice(from, i).trim()); from = i + 1; }
  }
  return layers.map((l) => evaluate(l.replace(/^inset\s+/, "").replace(/^(?:-?[\d.]+(?:px)?\s+)+/, ""), env));
}
const Y = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const over = (top, under) => {
  const t = toSrgb(top), u = toSrgb(under);
  return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha)));
};
const DEPTH = ["tile", "flat", "island", "key", "sunk", "float", "cast"].map((n) => `--slc-depth-${n}`);
const CASES = [
  ...PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => [t, p])),
  ["high-contrast", "default"],
];

// ── radii ───────────────────────────────────────────────────────────────────

test("radii: md 8px, lg 14px, the new pane 10px, sm unchanged", () => {
  for (const [n, v] of [["sm", "6px"], ["md", "8px"], ["lg", "14px"], ["pane", "10px"]]) {
    assert.match(TOKENS, new RegExp(`--sl-radius-${n}:\\s*${v};`), n);
  }
});

test("every radius fallback literal in the kit's CSS equals its token", () => {
  const want = Object.fromEntries([...TOKENS.matchAll(/--sl-radius-(\w+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const stale = [];
  for (const f of ["components.css", "effects.css", "glass.css", "compositions.css"]) {
    for (const m of read(f).matchAll(/var\(--sl-radius-(\w+),\s*([^)]+)\)/g)) {
      if (want[m[1]] !== m[2].trim()) stale.push(`${f}: --sl-radius-${m[1]} falls back to ${m[2]}, the token is ${want[m[1]]}`);
    }
  }
  assert.deepEqual(stale, []);
});

// ── casts ───────────────────────────────────────────────────────────────────

test("casts are black: the pre-0.31 cool ink is gone from the kit and the audit's allowlist", () => {
  for (const f of ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css", "components.css", "effects.css"]) {
    assert.doesNotMatch(bare(read(f)), /28,\s*29,\s*34/, f);
  }
  for (const f of ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"]) {
    for (const [n, v] of tokenEnv(read(f))) {
      if (!n.startsWith("--sl-shadow-")) continue;
      for (const c of v.match(/rgba?\([^)]*\)/g) ?? []) assert.match(c, /^rgba\(0,0,0,0?\.\d+\)$/, `${f} ${n}: ${c}`);
    }
  }
  const cssTexts = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"].map(read);
  for (const product of Object.keys(NEUTRALS)) {
    const bases = allowlistForProduct({ cssTexts, neutrals: { products: NEUTRALS }, product });
    assert.equal(bases.has("#1c1d22"), false, `${product}: #1c1d22 is still allowlisted`);
  }
});

test("a new inset cast, and every theme declares the four", () => {
  for (const theme of ["light", "dark", "high-contrast"]) {
    const t = tokenEnv(read(`themes/${theme}.css`));
    for (const n of ["sm", "md", "lg", "inset"]) assert.ok(t.get(`--sl-shadow-${n}`), `${theme} --sl-shadow-${n}`);
    assert.match(t.get("--sl-shadow-inset"), /^inset /);
  }
});

test("the role-var casts fall back to the light ramp, and the band casts the dark one", () => {
  const light = tokenEnv(read("themes/light.css")), dark = tokenEnv(read("themes/dark.css"));
  const root = vars([":root"]);
  const band = vars([".sl-invert > *"]);
  for (const n of ["sm", "md", "lg", "inset"]) {
    assert.equal(root.get(`--slc-shadow-${n}`), `var(--sl-shadow-${n}, ${light.get(`--sl-shadow-${n}`)})`, `:root ${n}`);
    assert.equal(band.get(`--slc-shadow-${n}`), dark.get(`--sl-shadow-${n}`), `band ${n}`);
  }
});

// ── the depth recipes ─────────────────────────────────────────────────────────

test("the depth recipes are role-vars built from roles, never a literal colour", () => {
  const root = vars([":root"]);
  // Tier B has no --sl-bg-tile / -sunken / --sl-border-lit: the rungs fall
  // back through roles it maps, and the lit line to a hairline that reads on
  // either ground (a white literal made dark Tier B tiles white).
  assert.equal(root.get("--slc-tile"), "var(--sl-bg-tile, var(--slc-raised))");
  assert.equal(root.get("--slc-sunken"), "var(--sl-bg-sunken, var(--slc-surface))");
  assert.equal(root.get("--slc-lit"), "var(--sl-border-lit, color-mix(in srgb, white 8%, transparent))");
  assert.equal(root.get("--slc-seam"), "var(--slc-accent-text)");
  assert.equal(root.get("--slc-glow"), "0.5");
  for (const n of DEPTH) {
    const v = root.get(n);
    assert.ok(v, `${n} is declared on :root`);
    assert.doesNotMatch(v, /#[0-9a-f]{3,8}\b|rgba?\(|oklch\(\s*[\d.]/i, `${n} carries a literal: ${v}`);
  }
  assert.match(root.get("--slc-depth-tile"), /^inset 0 1px 0 var\(--slc-lit\), 0 0 0 1px var\(--slc-border\), var\(--slc-shadow-sm\)$/);
  assert.match(root.get("--slc-depth-key"), /inset 0 -1\.5px 0 var\(--slc-edge-surface\)/, "a key stands on its own fill in shade");
  assert.equal(root.get("--slc-depth-float"), "var(--slc-shadow-lg)");
  // 0.34: Lumen's cast, for an overlay that keeps no border of its own (the
  // palette, the toast): the float with the overlay's ring folded in -- its
  // own fill in shade, as the bordered float draws it -- and lit along the top.
  assert.equal(root.get("--slc-depth-cast"), "inset 0 1px 0 var(--slc-lit), 0 0 0 1px var(--slc-edge-raised), var(--slc-shadow-lg)");
});

test("the inversion band re-declares every depth recipe as written, so it reads the band's roles", () => {
  const root = vars([":root"]);
  const band = vars([".sl-invert > *"]);
  for (const n of DEPTH) assert.equal(band.get(n), root.get(n), n);
  // the seam is floored a step above the band's accent text (0.72 against 0.68)
  assert.equal(band.get("--slc-seam"), "oklch(from var(--slc-accent) min(max(l, 0.72), var(--sl-accent-band-text-lmax, 1)) c h)");
  assert.equal(band.get("--slc-tile"), "color-mix(in srgb, currentColor 16%, transparent)");
  assert.equal(band.get("--slc-sunken"), "color-mix(in srgb, currentColor 4%, transparent)");
  assert.equal(band.get("--slc-lit"), "color-mix(in srgb, white 8%, transparent)");
  // The band's tile sits between its raised wash and its text, as the page's does.
  const pct = (n) => Number(band.get(n).match(/currentColor (\d+)%/)[1]);
  assert.ok(pct("--slc-sunken") < pct("--slc-surface") && pct("--slc-surface") < pct("--slc-raised") && pct("--slc-raised") < pct("--slc-tile"));
});

test("high contrast trades depth for drawn rings: selection in the accent, a key or an island in white", () => {
  const hc = vars([':root[data-sl-theme="high-contrast"]']);
  assert.equal(hc.get("--slc-depth-tile"), "0 0 0 1px var(--slc-accent)");
  assert.equal(hc.get("--slc-depth-flat"), "0 0 0 1px var(--slc-accent)");
  assert.equal(hc.get("--slc-depth-island"), "0 0 0 1px var(--slc-border)");
  assert.equal(hc.get("--slc-depth-key"), "0 0 0 1px var(--slc-border)");
  // off is an empty shadow, never `none`: a recipe joins a box-shadow list
  // (a control's depth plus its focus halo, 0.32), and `none` voids a list
  assert.equal(hc.get("--slc-depth-sunk"), "0 0 transparent");
  assert.equal(hc.get("--slc-depth-float"), "0 0 transparent");
  // the cast's ring is the overlay's only edge (it keeps no border): it is
  // drawn in the theme's line, as an island's is
  assert.equal(hc.get("--slc-depth-cast"), "0 0 0 1px var(--slc-border)");
  assert.equal(hc.get("--slc-glow"), "0");
  assert.equal(vars([':root[data-sl-theme="light"]']).get("--slc-glow"), "0.35");
});

test("high contrast keeps its rings inside the inversion band, where the band re-declares the recipes", () => {
  const band = vars([':root[data-sl-theme="high-contrast"] .sl-invert > *']);
  assert.equal(band.get("--slc-depth-tile"), "0 0 0 1px var(--slc-accent-text)");
  assert.equal(band.get("--slc-depth-flat"), "0 0 0 1px var(--slc-accent-text)");
  assert.equal(band.get("--slc-depth-island"), "0 0 0 1px var(--slc-border)");
  assert.equal(band.get("--slc-depth-key"), "0 0 0 1px var(--slc-border)");
  assert.equal(band.get("--slc-depth-sunk"), "0 0 transparent");
  assert.equal(band.get("--slc-depth-float"), "0 0 transparent");
  assert.equal(band.get("--slc-depth-cast"), "0 0 0 1px var(--slc-border)");
  // the ring finds the tile on the band's ground (3:1, a boundary)
  const env = hcBandEnv();
  const ground = evaluate("var(--slc-text)", rootEnv("high-contrast"));
  const [ring] = shadowColours("var(--slc-depth-tile)", env);
  assert.ok(ratio(over(ring, ground), ground) >= 3, `ring ${ratio(over(ring, ground), ground).toFixed(2)}`);
});

test("forced colours turn every depth recipe off, on :root, on a themed root and in the band", () => {
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const r = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /^\s*:root,/.test(m[1]));
  assert.ok(r, "a forced-colours rule on :root");
  assert.equal(r[1].trim().replace(/\s+/g, " "), ":root, :root[data-sl-theme], .sl-invert > *, :root[data-sl-theme] .sl-invert > *");
  for (const n of DEPTH) assert.match(r[2], new RegExp(`${n}:\\s*0 0 transparent;`), n);
  // and every accent glow with them: the checked glow and the focus halo
  assert.match(r[2], /--slc-glow:\s*0;/);
});

test("no theme turns a depth recipe off with `none`: a recipe joins box-shadow lists", () => {
  for (const [, , body] of [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [null, m[1], m[2]])) {
    for (const m of body.matchAll(/(--slc-depth-[\w-]+)\s*:\s*([^;]+);/g)) assert.notEqual(m[2].trim(), "none", m[1]);
  }
});

test("every depth recipe resolves on every product and theme, the band and Tier B included", () => {
  const envs = [
    ...CASES.flatMap(([theme, product]) => [[`${theme} ${product}`, rootEnv(theme, product)], [`${theme} ${product} band`, bandEnv(theme, product)]]),
    ...PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => [`${t} ${p} Tier B`, tierBEnv(t, p)])),
    ["high-contrast band", hcBandEnv()],
  ];
  for (const [label, env] of envs) {
    for (const n of ["--slc-tile", "--slc-sunken", "--slc-lit", "--slc-seam"]) assert.doesNotThrow(() => evaluate(`var(${n})`, env), `${label} ${n}`);
    // every layer of every recipe is a colour that evaluates
    for (const n of DEPTH) assert.doesNotThrow(() => shadowColours(`var(${n})`, env), `${label} ${n}`);
  }
});

// ── tile selection ──────────────────────────────────────────────────────────

// [host, its selected rule, the depth it lifts with, the rule its text colour comes from]
const TILES = [
  ["list row", '.sl-list__row:is([aria-selected="true"], [aria-current]:not([aria-current="false"]))', "tile", ".sl-list__row"],
  ["nav item", '.sl-nav__item[aria-current]:not([aria-current="false"])', "tile", '.sl-nav__item[aria-current]:not([aria-current="false"])'],
  ["pagination item", '.sl-pagination__item[aria-current]:not([aria-current="false"])', "tile", '.sl-pagination__item[aria-current]:not([aria-current="false"])'],
  ["segmented item", '.sl-segmented__item[aria-selected="true"], .sl-segmented__item[aria-pressed="true"]', "tile", '.sl-segmented__item[aria-selected="true"], .sl-segmented__item[aria-pressed="true"]'],
  ["table row", '.sl-table tbody tr[aria-selected="true"]', "tile", ".sl-table"],
  ["tile tab", '.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]', "flat", '.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]'],
];

// The depth is written into the control's private --_sl-depth (0.32), which
// the kit paints and its focus rule composes with the halo; a table row is
// not focusable, so it paints its tile directly.
const depthOf = (body) => decl(body, "--_sl-depth") ?? decl(body, "box-shadow");
test("selection is a tile: the tile fill and a depth recipe, never the accent wash", () => {
  for (const [host, sel, depth] of TILES) {
    const body = rule(sel);
    assert.equal(decl(body, "background(?:-color)?"), "var(--slc-tile)", host);
    assert.equal(depthOf(body), `var(--slc-depth-${depth})`, host);
    assert.doesNotMatch(body, /accent-subtle|edge-pressed|border-left/, `${host} still wears the old accent selection`);
  }
});

test("a focusable tile writes its depth into --_sl-depth, never box-shadow, so focus keeps its halo", () => {
  for (const [host, sel, depth] of TILES.filter(([h]) => h !== "table row")) {
    const body = rule(sel);
    assert.equal(decl(body, "--_sl-depth"), `var(--slc-depth-${depth})`, host);
    assert.equal(decl(body, "box-shadow"), undefined, `${host} sets box-shadow, which outranks the focus rule`);
  }
  assert.equal(decl(rule('.sl-table tbody tr[aria-selected="true"]'), "box-shadow"), "var(--slc-depth-tile)");
});

test("a tile's host carries no border, so its lit line sits flush under the ring", () => {
  for (const sel of [".sl-list__row", ".sl-nav__item", ".sl-pagination__item", ".sl-tabs--tile .sl-tabs__tab"]) {
    assert.equal(decl(rule(sel), "border"), "0", sel);
  }
  assert.equal(decl(rule(".sl-segmented__item"), "border"), "none");
  assert.doesNotMatch(rule(".sl-nav__item"), /border-left/, "the 2px accent edge is gone");
  // The list row's lost pixel became padding: a row is the size it was.
  assert.equal(decl(rule(".sl-list__row"), "padding"), "calc(var(--sl-space-2, 0.5rem) + 1px) calc(var(--sl-space-3, 0.75rem) + 1px)");
  assert.equal(decl(rule(".sl-list--dense .sl-list__row"), "padding"), "calc(var(--sl-space-1, 0.25rem) + 1px) calc(var(--sl-space-2, 0.5rem) + 1px)");
});

test("hover never lifts: a flat wash, no depth", () => {
  for (const sel of [".sl-list__row:hover", ".sl-nav__item:hover", ".sl-pagination__item:hover", ".sl-tabs--tile .sl-tabs__tab:hover"]) {
    const body = rule(sel);
    assert.match(body, /background(?:-color)?:\s*color-mix\(in srgb, var\(--slc-text\) 5%, transparent\)/, sel);
    assert.doesNotMatch(body, /box-shadow|border/, sel);
  }
});

test("the accent marks only the icon of a selected row, item or tab", () => {
  assert.equal(decl(rule(':is(.sl-list__row:is([aria-selected="true"], [aria-current]:not([aria-current="false"])), .sl-nav__item[aria-current]:not([aria-current="false"])) > svg'), "color"), "var(--slc-accent-text)");
  assert.equal(decl(rule('.sl-tabs--tile .sl-tabs__tab[aria-selected="true"] > svg'), "color"), "var(--slc-accent-text)");
});

for (const [theme, product] of CASES) {
  test(`${theme} ${product}: text on a selected tile reads at 4.5:1, on the page and in the band`, () => {
    const low = [];
    for (const [label, env, ground] of [["page", rootEnv(theme, product), "var(--slc-surface)"], ["band", bandEnv(theme, product), null]]) {
      const under = ground ? evaluate(ground, env) : evaluate("var(--slc-text)", rootEnv(theme, product));
      const tile = over(evaluate("var(--slc-tile)", env), under);
      for (const [host, , , textSel] of TILES) {
        const ink = decl(rule(textSel), "color");
        const r = ratio(over(evaluate(ink, env), tile), tile);
        if (r < 4.5) low.push(`${label} ${host} ${r.toFixed(2)}`);
      }
      // the meta and count on a selected row or item step up to the secondary ink
      const meta = decl(rule('.sl-list__row:is([aria-selected="true"], [aria-current]:not([aria-current="false"])) .sl-list__meta, .sl-nav__item[aria-current]:not([aria-current="false"]) .sl-nav__count'), "color");
      const r = ratio(over(evaluate(meta, env), tile), tile);
      if (r < 4.5) low.push(`${label} meta ${r.toFixed(2)}`);
    }
    assert.deepEqual(low, []);
  });
}

for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
  test(`Tier B ${theme} ${product}: a tile is a rung of the product's own layer, and its text reads at 4.5:1`, () => {
    const env = tierBEnv(theme, product);
    const tile = over(evaluate("var(--slc-tile)", env), evaluate("var(--slc-surface)", env));
    const low = TILES.map(([host, , , textSel]) => [host, ratio(over(evaluate(decl(rule(textSel), "color"), env), tile), tile)])
      .filter(([, r]) => r < 4.5).map(([h, r]) => `${h} ${r.toFixed(2)}`);
    assert.deepEqual(low, []);
    assert.equal(toHex(evaluate("var(--slc-tile)", env)), toHex(evaluate("var(--slc-raised)", env)), "the tile falls back to the raised rung");
  });
}

test("forced colours: a selected tile becomes Highlight, a selected table row is bracketed in it", () => {
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const fill = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[2].includes("background: Highlight") && m[1].includes(".sl-segmented__item"));
  assert.ok(fill);
  for (const s of ['.sl-nav__item[aria-current]:not([aria-current="false"])', '.sl-list__row:is([aria-selected="true"], [aria-current]:not([aria-current="false"]))', '.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]', '.sl-pagination__item[aria-current]:not([aria-current="false"])']) {
    assert.ok(fill[1].includes(s), s);
  }
  const close = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].includes(".sl-tabs__close") && /HighlightText/.test(m[2]));
  assert.ok(close, "the close glyph takes the selection's text colour");
  assert.match(close[2], /HighlightText !important/);
  // opted out, these hosts no longer get the forced outline colour: it is handed back
  const ring = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /outline-color:\s*CanvasText !important/.test(m[2]));
  for (const s of [".sl-nav__item:focus-visible", ".sl-list__row:focus-visible", ".sl-tabs__tab:focus-visible", ".sl-pagination__item:focus-visible", ".sl-segmented__item:focus-visible"]) assert.ok(ring[1].includes(s), s);
  assert.match(fc, /\.sl-table tbody tr\[aria-selected="true"\] > td,\s*\.sl-table tbody tr:has\(\+ tr\[aria-selected="true"\]\) > td \{ border-bottom-color: Highlight !important; \}/);
});

// ── keycap ───────────────────────────────────────────────────────────────────

test("the keycap: Geist Mono 500, at least 20px square, radius 5, the key depth, raised to surface", () => {
  const k = rule(".sl-kbd");
  for (const [p, v] of [["min-width", "20px"], ["height", "20px"], ["border-radius", "5px"], ["font-weight", "500"], ["box-sizing", "border-box"], ["box-shadow", "var(--slc-depth-key)"],
    ["background-color", "var(--slc-raised)"], ["background-image", "linear-gradient(var(--slc-raised), var(--slc-surface))"], ["border", "0"]]) {
    assert.equal(decl(k, p), v, p);
  }
  assert.match(decl(k, "font-family"), /^var\(--sl-font-mono/);
  // the glass family names the fill the component ships
  assert.match(read("effects.css"), /\.sl-kbd\.sl-fx-glass \{ --slfx-fill: var\(--slc-raised\); \}/);
  // forced colours drop its ring and flatten its fill: a drawn edge comes back,
  // inside its border-box height
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  assert.match(fc, /\n\s*\.sl-kbd \{ border: 1px solid CanvasText !important; \}/);
  // high contrast rings it through the depth remap; a border there would make it 22px
  const hcBorders = RULES.filter((r) => r.selector.startsWith(':root[data-sl-theme="high-contrast"]') && /border/.test(r.body)).map((r) => r.selector).join(" ");
  assert.doesNotMatch(hcBorders, /\.sl-kbd/);
});

test("a key inside a button keeps the 32px and 24px rows", () => {
  const px = (v) => (v.endsWith("rem") ? parseFloat(v) * 16 : parseFloat(v));
  const btn = rule(".sl-btn"), sm = rule(".sl-btn--sm");
  const key = rule(".sl-btn > .sl-kbd"), smKey = rule(".sl-btn--sm > .sl-kbd");
  const margin = px(decl(key, "margin-block"));
  assert.ok(margin < 0, "the cap gives back its height");
  // the label's font size, read from the rule and resolved through its token
  const size = (body) => px(substitute(decl(body, "font-size"), SHARED));
  for (const [name, fontSize, padBlock, keyH, rowH] of [
    ["button", size(btn), px(decl(btn, "padding").split(" ")[0]), px(decl(key, "height")), 32],
    ["small button", size(sm), px(decl(sm, "padding").split(" ")[0]), px(decl(smKey, "height")), 24],
  ]) {
    assert.equal(decl(btn, "line-height"), "1", "the label's line is its font size");
    const content = Math.max(fontSize, keyH + 2 * margin);
    assert.equal(content + 2 * padBlock + 2, rowH, `${name}: ${content} + 2 x ${padBlock} + 2`);
  }
  assert.equal(decl(key, "height"), "18px");
  assert.equal(decl(smKey, "height"), "16px");
});

/** A primary's own declarations over a product's root: its registered fill
 *  set as the one role (--slc-accent-fill, 0.32) where it has one, as spexr
 *  sets it, and the danger tone's fill set when `danger` is asked for. The
 *  fill it paints is then var(--_sl-fill), its label var(--_sl-on-fill). */
function primary(env, product, theme, { danger = false, fill = true } = {}) {
  const registered = fill && theme !== "high-contrast" && REGISTRY[product].fill?.[theme];
  if (registered) env.set("--slc-accent-fill", registered);
  const sels = [":where(.sl-btn--primary, .sl-check__box, .sl-radio__box, .sl-switch__track)", ".sl-btn--primary", ...(danger ? [".sl-btn--primary.sl-btn--danger"] : [])];
  return within(env, sels.flatMap((s) => declarations(raw, [s])));
}

for (const [theme, product] of CASES) {
  test(`${theme} ${product}: a key's text reads at 4.5:1 on its cap, standalone and in a button`, () => {
    const low = [];
    const env = rootEnv(theme, product);
    for (const g of ["--slc-raised", "--slc-surface"]) {
      const cap = evaluate(`var(${g})`, env);
      const r = ratio(evaluate(decl(rule(".sl-kbd"), "color"), env), cap);
      if (r < 4.5) low.push(`kbd on ${g} ${r.toFixed(2)}`);
    }
    // in a neutral button -- plain, ghost, a pressed toggle -- on the page and
    // in the band: the label's own colour on the cap, over the button's fill,
    // over its ground; never weaker than the label on the fill
    const PRESSED = '.sl-btn:not(.sl-btn--primary)[aria-pressed="true"], .sl-icon-btn[aria-pressed="true"]';
    for (const [where, e, ground] of [["page", env, evaluate("var(--slc-surface)", env)], ["band", bandEnv(theme, product), evaluate("var(--slc-text)", env)]]) {
      for (const [name, fillOf, inkOf] of [
        ["plain", () => "transparent", () => decl(rule(".sl-btn"), "color")],
        ["ghost", () => decl(rule(".sl-btn--ghost"), "background"), () => decl(rule(".sl-btn--ghost"), "color")],
        ["pressed toggle", () => decl(rule(PRESSED), "background-color"), () => decl(rule(PRESSED), "color")],
      ]) {
        const fill = over(evaluate(fillOf(), e), ground);
        const label = over(evaluate(inkOf(), e), fill);
        const cap = over(evaluate(decl(rule(".sl-btn > .sl-kbd"), "background"), e), fill);
        const rc = ratio(label, cap), rf = ratio(label, fill);
        if (rc < 4.5) low.push(`${where} ${name} key ${rc.toFixed(2)}`);
        if (rc + 1e-9 < rf) low.push(`${where} ${name} key ${rc.toFixed(2)} reads weaker than its label on the button ${rf.toFixed(2)}`);
      }
    }
    // in a primary: the label's own colour on a cap that steps away from it
    for (const danger of [false, true]) {
      const p = primary(rootEnv(theme, product), product, theme, { danger });
      const fill = evaluate("var(--_sl-fill)", p), label = evaluate("var(--_sl-on-fill)", p);
      const cap = evaluate(decl(rule(".sl-btn--primary > .sl-kbd"), "background"), p);
      const rk = ratio(label, cap), rl = ratio(label, fill);
      const name = danger ? "danger primary" : "primary";
      if (rk < rl) low.push(`${name} key ${rk.toFixed(2)} reads weaker than its label ${rl.toFixed(2)}`);
      if (rk < 4.5) low.push(`${name} key ${rk.toFixed(2)}`);
    }
    assert.deepEqual(low, []);
  });
}

// ── tile tabs ────────────────────────────────────────────────────────────────

test("tile tabs: no rule under the strip, no underline, a flat tile, the dot and the close glyph", () => {
  assert.equal(decl(rule(".sl-tabs--tile"), "border-bottom"), "0");
  const tab = rule(".sl-tabs--tile .sl-tabs__tab");
  assert.equal(decl(tab, "border"), "0", "no underline");
  assert.equal(decl(tab, "margin"), "0");
  assert.equal(decl(tab, "height"), "1.75rem");
  assert.equal(decl(rule(".sl-tabs__dot"), "border-radius"), "50%");
  assert.equal(decl(rule('.sl-tabs__tab[aria-selected="true"] .sl-tabs__dot'), "background"), "var(--slc-accent-text)");
  const close = rule(".sl-tabs__close");
  // a borderless chrome glyph, as a span or as a button (whose chrome it resets)
  assert.equal(decl(close, "border"), "0");
  assert.doesNotMatch(close.replace(/(^|;)\s*border:\s*0\s*;/, ";"), /(^|;)\s*border(-(top|right|bottom|left))?(-(color|width|style))?\s*:/, "no edge of any kind");
  assert.equal(decl(close, "appearance"), "none");
  // the wrapper pattern: the item carries the tile, the tab inside it none
  assert.equal(decl(rule('.sl-tabs--tile .sl-tabs__item:has(> .sl-tabs__tab[aria-selected="true"])'), "box-shadow"), "var(--slc-depth-flat)");
  assert.equal(decl(rule(".sl-tabs--tile .sl-tabs__item > .sl-tabs__tab, .sl-tabs--tile .sl-tabs__item > .sl-tabs__tab:hover"), "--_sl-depth"), "0 0 transparent");
  assert.match(rule(".sl-tabs__close:hover"), /background-color:\s*color-mix\(in srgb, var\(--slc-text\) 10%, transparent\)/);
  // the shared focus ring covers the tab, and the outline follows its 6px
  const ring = RULES.find((r) => /outline: var\(--sl-focus-ring-width/.test(r.body));
  assert.ok(ring.selector.includes(".sl-tabs__tab:focus-visible"));
  // Lumen's tab (0.34): r7, 13px at 500, 11.2px in, and hover lifts the ink
  // to the secondary, not the primary (the active tab keeps the primary)
  assert.equal(decl(tab, "border-radius"), "7px");
  assert.equal(decl(tab, "font-size"), "0.8125rem");
  assert.equal(decl(tab, "padding"), "0 0.7rem");
  assert.equal(decl(rule(".sl-tabs__tab"), "font-weight"), "500");
  assert.match(rule(".sl-tabs--tile .sl-tabs__tab:hover"), /(?:^|;)\s*color:\s*var\(--slc-text-secondary\)/);
  assert.equal(decl(rule(".sl-tabs--tile .sl-tabs__item"), "border-radius"), "7px", "the wrapper is the same tile");
  // the focus rule rounds square hosts to 6px; the tile tab keeps its own 7,
  // because its rule comes later at the same weight
  const at = (sel) => css.indexOf(`${sel} {`);
  assert.ok(at(".sl-tabs--tile .sl-tabs__tab") > css.indexOf(".sl-tabs__tab:focus-visible,\n.sl-breadcrumb__item:focus-visible"), "the tile tab's radius outranks the soft ring's");
});

// ── the keycap in a glass primary ──────────────────────────────────────────

// On a mounted glass pane (effects.css) the primary's label is re-picked from
// the composited pane -- the resting accent at 90% over the canvas -- not from
// the opaque accent. A cap that stepped away from the OPAQUE accent's label
// put a dark cap under the pane's dark label on the light theme's indigo
// (3.22:1). The cap the cascade gives there must read against THAT label and
// stand apart from the pane. Every product's accent, and its registered fill
// where it has one, on both themes.
const EFFECTS = bare(read("effects.css"));
const PANE_HOST = '.sl-btn--primary.sl-fx-glass--pane:where(.sl-glass):where(:root:not([data-sl-theme="high-contrast"]) *):where(:not([data-sl-fx="off"], [data-sl-fx="off"] *))';
const FX_RULES = [...EFFECTS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
const fxRule = (sel) => FX_RULES.find((r) => r.selector === sel)?.body;
// The pane as it composites is written once, on the glass primary
// (--_slfx-pane, 0.32.1), with the lightness where the two poles meet on it.
const GLASS_PRIMARY = FX_RULES.find((r) => r.selector === ".sl-btn--primary.sl-fx-glass" && /--_slfx-pane\s*:/.test(r.body))?.body ?? "";
const GLASS_DECLS = [...GLASS_PRIMARY.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim().replace(/\s+/g, " ")]);
const PANE = "var(--_slfx-pane)";

test("the glass primary's label is the composite-picked pole the cap test reads", () => {
  assert.equal(decl(GLASS_PRIMARY, "--_slfx-pane"), "color-mix(in oklab, var(--_sl-fill, var(--slc-accent)) 90%, var(--slc-canvas))");
  assert.equal(decl(fxRule(PANE_HOST) ?? "", "color"), "oklch(from var(--_slfx-pane) clamp(var(--_sl-pole-dark), (var(--_sl-pole-l) - l) * 1000, 0.985) 0 h)");
});

for (const product of PRODUCTS) for (const theme of ["light", "dark"]) {
  // the accent, the product's registered accent fill (set as the role), the danger
  const fills = [["accent", { fill: false }], ...(REGISTRY[product].fill?.[theme] ? [["accent fill", {}]] : []), ["danger", { danger: true }]];
  test(`${theme} ${product}: a keycap in a glass primary reads against the pane's own label and stands apart from the pane`, () => {
    const low = [];
    for (const [accent, opts] of fills) {
      const env = within(primary(rootEnv(theme, product), product, theme, opts), GLASS_DECLS);
      // the cascade: the glass rule where effects.css has one, else the kit's cap
      const glassCap = fxRule(`${PANE_HOST} > .sl-kbd`);
      const capDecls = glassCap ? new Map([...glassCap.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)].map((m) => [m[1], m[2].trim()])) : new Map();
      const capEnv = within(env, capDecls);
      const capValue = glassCap ? decl(glassCap, "background") : decl(rule(".sl-btn--primary > .sl-kbd"), "background");
      const label = evaluate(decl(fxRule(PANE_HOST), "color"), env);
      const pane = evaluate(PANE, env), cap = evaluate(capValue, capEnv);
      const r = ratio(label, cap);
      if (r < 4.5) low.push(`${accent}: the cap's glyph ${r.toFixed(2)}`);
      if (r < ratio(label, pane)) low.push(`${accent}: the cap ${r.toFixed(2)} reads weaker than the label on the pane ${ratio(label, pane).toFixed(2)}`);
      const dL = Math.abs(toOklch(cap)[0] - toOklch(pane)[0]);
      if (dL < 0.06) low.push(`${accent}: the cap is ${dL.toFixed(3)} from the pane in lightness`);
    }
    assert.deepEqual(low, []);
  });
}

// High contrast rings every keycap in a drawn line; the in-button cap
// replaces the key depth with its own base line, so it is ringed there in the
// label's own colour (white on a neutral button, black on the yellow primary).
test("high contrast rings the in-button key in its label's colour", () => {
  const hc = rule(':root[data-sl-theme="high-contrast"] .sl-btn > .sl-kbd');
  assert.equal(decl(hc, "box-shadow"), "inset 0 0 0 1px currentColor");
});

// The effects kill (effects.css: high contrast and data-sl-fx="off") takes a
// host's box-shadow with !important. A tile is drawn in box-shadow, and in
// high contrast its ring is a current page's or a chosen segment's only
// marker: a tile host that also wears an effect class keeps its depth.
/** Specificity [a, b, c] of one complex selector (:where is 0, :is/:not/:has take their most specific argument). */
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
/** Top-level comma split of a selector list. */
const selectorParts = (list) => { const out = []; let d = 0, f = 0; for (let i = 0; i <= list.length; i++) { const ch = list[i]; if (ch === "(" || ch === "[") d++; else if (ch === ")" || ch === "]") d--; else if ((ch === "," && d === 0) || i === list.length) { out.push(list.slice(f, i).trim()); f = i + 1; } } return out; };

test("specificity(): :where counts nothing, :is takes its strongest argument", () => {
  assert.deepEqual(specificity(':root[data-sl-theme="high-contrast"] :is(.a, .b)'), [0, 3, 0]);
  assert.deepEqual(specificity(':is([x="off"], [x="off"] *):is(.a, .b)'), [0, 2, 0]);
  assert.deepEqual(specificity(".a:where(.b, .c) > .d"), [0, 2, 0]);
  assert.deepEqual(specificity(".sl-table tbody tr"), [0, 1, 2]);
});

const FX_HOSTS = [".sl-fx-glass", ".sl-fx-press", ".sl-fx-aurora", ".sl-fx-liquid", ".sl-fx-glitch"];
test("a selected tile that wears an effect keeps its tile through the effects kill, in high contrast and where effects are off", () => {
  const kill = FX_RULES.find((r) => /box-shadow:\s*none !important/.test(r.body) && r.selector.startsWith(':root[data-sl-theme="high-contrast"] :is(.sl-fx-glass'));
  assert.ok(kill, "the kill rule");
  const killSpec = selectorParts(kill.selector).map(specificity);
  const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  const at = FX_RULES.indexOf(kill);
  for (const [depth, hosts] of [
    ["tile", ['.sl-pagination__item[aria-current]:not([aria-current="false"])', '.sl-segmented__item:is([aria-selected="true"], [aria-pressed="true"])', '.sl-nav__item[aria-current]:not([aria-current="false"])', '.sl-list__row:is([aria-selected="true"], [aria-current]:not([aria-current="false"]))']],
    ["flat", ['.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]']],
  ]) {
    const keep = FX_RULES.find((r, i) => i > at && new RegExp(`box-shadow:\\s*var\\(--slc-depth-${depth}\\) !important`).test(r.body));
    assert.ok(keep, `a rule after the kill re-applies --slc-depth-${depth}`);
    const parts = selectorParts(keep.selector);
    const hcPart = parts.find((s) => s.startsWith(':root[data-sl-theme="high-contrast"]'));
    const offPart = parts.find((s) => s.startsWith(':is([data-sl-fx="off"], [data-sl-fx="off"] *)'));
    assert.ok(hcPart && offPart, `${depth}: both the high-contrast and the opt-out kill are answered`);
    for (const part of [hcPart, offPart]) {
      for (const h of hosts) assert.ok(part.includes(h), `${depth}: ${h} in ${part}`);
      for (const fx of FX_HOSTS) assert.ok(part.includes(fx), `${depth}: ${fx} in ${part}`);
    }
    assert.ok(cmp(specificity(hcPart), killSpec[0]) > 0, `high contrast: ${specificity(hcPart)} must outrank ${killSpec[0]}`);
    assert.ok(cmp(specificity(offPart), killSpec[1]) > 0, `opt-out: ${specificity(offPart)} must outrank ${killSpec[1]}`);
  }
});

// ── the seam: the state cue of every selected or current tile (0.33) ─────────

// The tile is depth, not a state cue: its fill and its ring against its ground
// measure 1.00-1.42:1. The nav item carried a seam since 0.31 (owner,
// 2026-10-02); since 0.33 every selected or current tile does, from one rule:
// the accent while its container holds the focus, the muted ink while it does
// not. Its contrast in every context is workbench.test.mjs's (the cascade);
// this holds the rule's shape.
const SEAM_HOSTS = [
  '.sl-nav__item[aria-current]:not([aria-current="false"])',
  '.sl-activitybar__item:is([aria-current]:not([aria-current="false"]), [aria-selected="true"])',
  '.sl-tree__row[aria-selected="true"]',
  '.sl-palette__row[aria-selected="true"]',
  '.sl-list__row:is([aria-selected="true"], [aria-current]:not([aria-current="false"]))',
  '.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]',
  '.sl-segmented__item:is([aria-selected="true"], [aria-pressed="true"])',
  '.sl-pagination__item[aria-current]:not([aria-current="false"])',
];
const SEAM = RULES.find((r) => /background-image:\s*linear-gradient\(var\(--_sl-seam-ink\)/.test(r.body));

test("one rule draws the seam on every selected or current tile, as a layer of its background", () => {
  assert.ok(SEAM, "the shared seam rule");
  assert.deepEqual(selectorParts(SEAM.selector), SEAM_HOSTS, "a comma list, so each state keeps its own weight");
  for (const [p, v] of [["background-image", "linear-gradient(var(--_sl-seam-ink), var(--_sl-seam-ink)), var(--_sl-layer)"], ["background-repeat", "no-repeat, var(--_sl-layer-repeat)"],
    ["background-size", "var(--_sl-seam-size), var(--_sl-layer-size)"], ["background-position", "var(--_sl-seam-position), var(--_sl-layer-position)"]]) {
    assert.equal(decl(SEAM.body, p), v, p);
  }
  // the ink: the accent while the container holds the focus, the muted ink while it does not
  const ink = vars([":where(.sl-nav__item, .sl-activitybar__item, .sl-tree__row, .sl-palette__row, .sl-list__row, .sl-tabs__tab, .sl-tabs__item, .sl-segmented__item, .sl-pagination__item)"]);
  assert.equal(ink.get("--_sl-seam-ink"), "color-mix(in srgb, var(--slc-seam) calc(var(--_sl-seam-focus, var(--sl-seam-focus, 0)) * 100%), var(--slc-text-muted))");
  assert.equal(ink.get("--_sl-seam-size"), "2px 50%", "a row: half its height");
  assert.equal(ink.get("--_sl-seam-position"), "3px 50%", "3px inside its leading edge");
  const row = vars([":where(.sl-tabs__tab, .sl-tabs__item, .sl-segmented__item, .sl-pagination__item)"]);
  assert.equal(row.get("--_sl-seam-size"), "40% 2px", "a tab, a segment, a page: a short line");
  assert.equal(row.get("--_sl-seam-position"), "50% calc(100% - 3px)", "3px above its bottom edge");
  // mirrored right to left on the leading-edge hosts
  assert.equal(vars([":where(.sl-nav__item, .sl-activitybar__item, .sl-tree__row, .sl-palette__row, .sl-list__row):dir(rtl)"]).get("--_sl-seam-position"), "calc(100% - 3px) 50%");
  assert.equal(vars([":where(.sl-nav, .sl-activitybar, .sl-tree, .sl-tabs__list, .sl-list, .sl-segmented, .sl-pagination):focus-within"]).get("--_sl-seam-focus"), "1");
  assert.equal(vars([":where(.sl-palette)"]).get("--_sl-seam-focus"), "1", "a palette always holds the focus");
  // it arrives with the state and never animates: no host transitions an image
  for (const sel of [".sl-nav__item", ".sl-list__row", ".sl-segmented__item", ".sl-pagination__item", ".sl-tabs--tile .sl-tabs__tab"]) {
    assert.doesNotMatch(decl(rule(sel), "transition") ?? "", /background-image|background-position|background-size|(^|,\s*)background\s/, sel);
  }
  // the hosts' own state rules set a fill, never the shorthand that would wipe the layer
  for (const sel of ['.sl-nav__item[aria-current]:not([aria-current="false"])', '.sl-pagination__item[aria-current]:not([aria-current="false"])', '.sl-segmented__item[aria-selected="true"], .sl-segmented__item[aria-pressed="true"]']) {
    assert.equal(decl(rule(sel), "background-color"), "var(--slc-tile)", sel);
    assert.equal(decl(rule(sel), "background"), undefined, sel);
  }
  // the wrapper tab draws the one seam, the tab inside it none
  assert.equal(decl(rule('.sl-tabs--tile .sl-tabs__item > .sl-tabs__tab[aria-selected="true"]'), "background-image"), "none");
  // forced colours: the Highlight fill is a shorthand, which resets the seam with the rest
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const fill = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].includes(NAV) && /Highlight/.test(m[2]));
  assert.match(fill[2], /(^|;)\s*background:\s*Highlight !important/);
});
const NAV = '.sl-nav__item[aria-current]:not([aria-current="false"])';

test("the seam takes no pseudo-element: an effect family owns its host's ::before", () => {
  // every effect family that paints a host's ::before ...
  for (const fx of [".sl-fx-glass", ".sl-fx-press", ".sl-fx-glitch"]) {
    assert.ok(FX_RULES.some((r) => new RegExp(`${fx.replace(".", "\\.")}[^,{]*::before`).test(r.selector)), `${fx} paints ::before`);
  }
  // ... so components.css draws nothing on a seam host's pseudo-elements
  assert.deepEqual(RULES.filter((r) => /\.sl-(nav__item|list__row|segmented__item|pagination__item|tabs__tab|tabs__item)[^,{]*::(before|after)/.test(r.selector)).map((r) => r.selector), []);
});

// The workbench (workbench.css, 0.33) spends the same recipes and adds none:
// a tree row and a palette result are tiles, the current activity item and
// an unfocused tree selection flat tiles, a pane and a terminal block
// islands, the palette (like a dialog and a toast) a float.
test("the workbench's selections and surfaces are the kit's depth recipes", () => {
  const WB = [...bare(read("workbench.css")).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
  const wb = (sel) => { const r = WB.find((x) => x.selector === sel); assert.ok(r, `no rule ${sel}`); return r.body; };
  for (const [sel, depth] of [
    ['.sl-tree:focus-within .sl-tree__row[aria-selected="true"]', "tile"],
    ['.sl-tree__row[aria-selected="true"]', "flat"],
    ['.sl-activitybar__item:is([aria-current]:not([aria-current="false"]), [aria-selected="true"])', "flat"],
    ['.sl-palette__row[aria-selected="true"]', "tile"],
    [".sl-pane", "island"], [".sl-term-block", "island"], [".sl-palette", "cast"],
  ]) {
    assert.equal(depthOf(wb(sel)), `var(--slc-depth-${depth})`, sel);
  }
  for (const sel of ['.sl-tree__row[aria-selected="true"]', '.sl-palette__row[aria-selected="true"]']) {
    assert.match(wb(sel), /background-color:\s*var\(--slc-tile\)/, sel);
  }
  // the current view rests on the surface rung, as Lumen renders it (0.34):
  // the bar sits on the canvas, and its flat tile is the rung above it
  assert.match(wb('.sl-activitybar__item:is([aria-current]:not([aria-current="false"]), [aria-selected="true"])'), /background-color:\s*var\(--slc-surface\)/);
  assert.match(decl(wb(".sl-pane[data-lit]"), "box-shadow"), /^var\(--slc-depth-island\), /, "the lit pane is an island and its glow");
  // every host of a recipe carries no border, so the lit line sits flush under the ring
  for (const sel of [".sl-pane", ".sl-term-block", ".sl-tree__row", ".sl-activitybar__item"]) assert.equal(decl(wb(sel), "border"), "0", sel);
  assert.equal(decl(rule(".sl-toast"), "box-shadow"), "var(--slc-depth-cast)");
});
