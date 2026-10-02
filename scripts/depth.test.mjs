import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromSrgb, toHex, toSrgb } from "./lib/css-color.mjs";
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
  for (const m of bare(src).matchAll(/(--sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
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
/** A child of the inversion band: its declarations, currentColor bound to the band's ink. */
function bandEnv(theme, product) {
  const env = rootEnv(theme, product);
  const ink = toHex(evaluate("var(--slc-canvas)", env));
  for (const [k, v] of declarations(raw, [".sl-invert > *"])) env.set(k, v.replace(/currentColor/g, ink));
  return env;
}
const Y = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const over = (top, under) => {
  const t = toSrgb(top), u = toSrgb(under);
  return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha)));
};
const DEPTH = ["tile", "flat", "island", "key", "sunk", "float"].map((n) => `--slc-depth-${n}`);
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
  assert.equal(root.get("--slc-tile"), "var(--sl-bg-tile, #ffffff)");
  assert.equal(root.get("--slc-sunken"), "var(--sl-bg-sunken, #f9f6f4)");
  assert.equal(root.get("--slc-lit"), "var(--sl-border-lit, rgba(255,255,255,0.9))");
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
});

test("the inversion band re-declares every depth recipe as written, so it reads the band's roles", () => {
  const root = vars([":root"]);
  const band = vars([".sl-invert > *"]);
  for (const n of [...DEPTH, "--slc-seam"]) assert.equal(band.get(n), root.get(n), n);
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
  assert.equal(hc.get("--slc-depth-sunk"), "none");
  assert.equal(hc.get("--slc-depth-float"), "none");
  assert.equal(hc.get("--slc-glow"), "0");
  assert.equal(vars([':root[data-sl-theme="light"]']).get("--slc-glow"), "0.35");
});

test("forced colours turn every depth recipe off, on :root, on a themed root and in the band", () => {
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const r = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => /^\s*:root,/.test(m[1]));
  assert.ok(r, "a forced-colours rule on :root");
  assert.equal(r[1].trim().replace(/\s+/g, " "), ":root, :root[data-sl-theme], .sl-invert > *");
  for (const n of DEPTH) assert.match(r[2], new RegExp(`${n}:\\s*none;`), n);
});

test("every depth recipe resolves on every product and theme, the band included", () => {
  for (const [theme, product] of CASES) {
    for (const env of [rootEnv(theme, product), bandEnv(theme, product)]) {
      for (const n of ["--slc-tile", "--slc-sunken", "--slc-lit", "--slc-seam"]) assert.doesNotThrow(() => evaluate(`var(${n})`, env), `${theme} ${product} ${n}`);
    }
  }
});

// ── tile selection ──────────────────────────────────────────────────────────

// [host, its selected rule, the depth it lifts with, the rule its text colour comes from]
const TILES = [
  ["list row", '.sl-list__row:is([aria-selected="true"], [aria-current])', "tile", ".sl-list__row"],
  ["nav item", ".sl-nav__item[aria-current]", "tile", ".sl-nav__item[aria-current]"],
  ["pagination item", ".sl-pagination__item[aria-current]", "tile", ".sl-pagination__item[aria-current]"],
  ["segmented item", '.sl-segmented__item[aria-selected="true"], .sl-segmented__item[aria-pressed="true"]', "tile", '.sl-segmented__item[aria-selected="true"], .sl-segmented__item[aria-pressed="true"]'],
  ["table row", '.sl-table tbody tr[aria-selected="true"]', "tile", ".sl-table"],
  ["tile tab", '.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]', "flat", '.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]'],
];

test("selection is a tile: the tile fill and a depth recipe, never the accent wash", () => {
  for (const [host, sel, depth] of TILES) {
    const body = rule(sel);
    assert.equal(decl(body, "background(?:-color)?"), "var(--slc-tile)", host);
    assert.equal(decl(body, "box-shadow"), `var(--slc-depth-${depth})`, host);
    assert.doesNotMatch(body, /accent-subtle|edge-pressed|border-left/, `${host} still wears the old accent selection`);
  }
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
  assert.equal(decl(rule(':is(.sl-list__row:is([aria-selected="true"], [aria-current]), .sl-nav__item[aria-current]) > svg'), "color"), "var(--slc-accent-text)");
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
      const meta = decl(rule('.sl-list__row:is([aria-selected="true"], [aria-current]) .sl-list__meta, .sl-nav__item[aria-current] .sl-nav__count'), "color");
      const r = ratio(over(evaluate(meta, env), tile), tile);
      if (r < 4.5) low.push(`${label} meta ${r.toFixed(2)}`);
    }
    assert.deepEqual(low, []);
  });
}

test("forced colours: a selected tile becomes Highlight, a selected table row is bracketed in it", () => {
  const fc = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const fill = [...fc.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[2].includes("background: Highlight") && m[1].includes(".sl-segmented__item"));
  assert.ok(fill);
  for (const s of [".sl-nav__item[aria-current]", '.sl-list__row:is([aria-selected="true"], [aria-current])', '.sl-tabs--tile .sl-tabs__tab[aria-selected="true"]', ".sl-pagination__item[aria-current]"]) {
    assert.ok(fill[1].includes(s), s);
  }
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
  for (const [name, fontSize, padBlock, keyH, rowH] of [
    ["button", 14, px(decl(btn, "padding").split(" ")[0]), px(decl(key, "height")), 32],
    ["small button", 12, px(decl(sm, "padding").split(" ")[0]), px(decl(smKey, "height")), 24],
  ]) {
    assert.equal(decl(btn, "line-height"), "1", "the label's line is its font size");
    const content = Math.max(fontSize, keyH + 2 * margin);
    assert.equal(content + 2 * padBlock + 2, rowH, `${name}: ${content} + 2 x ${padBlock} + 2`);
  }
  assert.equal(decl(key, "height"), "18px");
  assert.equal(decl(smKey, "height"), "16px");
});

/** The colour a primary is filled with and labelled in, for a product: its
 *  registered fill (and a white label) where it has one, as spexr binds. */
function primary(env, product, theme) {
  const fill = theme !== "high-contrast" && REGISTRY[product].fill?.[theme];
  if (fill) { env.set("--slc-accent", fill); env.set("--slc-on-accent", "#ffffff"); }
  return env;
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
    // in a ghost button: the cap's wash over the ghost's wash over the surface
    const ghost = over(evaluate(decl(rule(".sl-btn--ghost"), "background"), env), evaluate("var(--slc-surface)", env));
    const ghostCap = over(evaluate(decl(rule(".sl-btn > .sl-kbd"), "background"), env), ghost);
    const rg = ratio(evaluate(decl(rule(".sl-btn--ghost"), "color"), env), ghostCap);
    if (rg < 4.5) low.push(`ghost key ${rg.toFixed(2)}`);
    // in a primary: the label's own colour on a cap that steps away from it
    const p = primary(rootEnv(theme, product), product, theme);
    const fill = evaluate("var(--slc-accent)", p), label = evaluate("var(--slc-on-accent)", p);
    const cap = evaluate(decl(rule(".sl-btn--primary > .sl-kbd"), "background"), p);
    const rk = ratio(label, cap), rl = ratio(label, fill);
    if (rk < rl) low.push(`primary key ${rk.toFixed(2)} reads weaker than its label ${rl.toFixed(2)}`);
    if (rk < 4.5) low.push(`primary key ${rk.toFixed(2)}`);
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
  assert.doesNotMatch(close, /(^|;)\s*border(-(top|right|bottom|left))?(-(color|width|style))?\s*:/, "a borderless chrome glyph");
  assert.match(rule(".sl-tabs__close:hover"), /background-color:\s*color-mix\(in srgb, var\(--slc-text\) 10%, transparent\)/);
  // the shared focus ring covers the tab, and the outline follows its 6px
  const ring = RULES.find((r) => /outline: var\(--sl-focus-ring-width/.test(r.body));
  assert.ok(ring.selector.includes(".sl-tabs__tab:focus-visible"));
  assert.equal(decl(tab, "border-radius"), "var(--sl-radius-sm, 6px)");
});
