import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, toHex } from "./lib/css-color.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(HERE, p), "utf8");
const html = read("../showcase/index.html");

// The one-var contract (design-language §Decision 2): overriding only
// --sl-accent-default must re-derive hover/active/subtle. This replaces the
// older regression that required the switcher to set *every* step — that was a
// symptom patch. The switcher must now set ONLY the hue; the theme layer holds
// the derivations. If a future edit either (a) makes the switcher pin a step,
// or (b) bakes a step as a bare literal in a theme, one-var silently breaks —
// these tests guard both.
const applyAccent = html.slice(
  html.indexOf("function applyAccent"),
  html.indexOf("}", html.indexOf("store(\"sl-demo-accent\"")),
);

test("switcher sets only the hue (--sl-accent-default)", () => {
  assert.match(applyAccent, /setProperty\(\s*["']--sl-accent-default["']/);
});

for (const step of ["hover", "active", "subtle"]) {
  test(`switcher does NOT pin --sl-accent-${step} (it must re-derive)`, () => {
    assert.doesNotMatch(
      applyAccent,
      new RegExp(`setProperty\\(\\s*["']--sl-accent-${step}["']`),
      `applyAccent must not set --sl-accent-${step}: it re-derives from the hue`,
    );
  });
}

// The derivations live in the theme layer: every step is an expression off
// var(--sl-accent-default), never a bare literal (the leak surface). dark-active
// also emits a fallback literal line before its relative-color line — assert the
// relative line is present, not that the literal is absent.
for (const theme of ["light", "dark", "high-contrast"]) {
  const css = read(`../packages/ui-kit/themes/${theme}.css`);
  for (const step of ["hover", "active", "subtle"]) {
    test(`${theme}: --sl-accent-${step} derives from --sl-accent-default`, () => {
      const decls = css
        .split("\n")
        .filter((l) => l.includes(`--sl-accent-${step}:`));
      assert.ok(decls.length >= 1, `missing --sl-accent-${step} in ${theme}`);
      // At least one declaration must be a color-mix()/oklch() off the accent var.
      assert.ok(
        decls.some((l) => /var\(--sl-accent-default\)/.test(l) &&
          /(color-mix|oklch)\(/.test(l)),
        `--sl-accent-${step} in ${theme} must derive from var(--sl-accent-default)`,
      );
    });
  }
}

// spexr's accent fill on the Indigo swatch (owner, 2026-10-02: "less is
// more"): ONE registered fill on both themes, the kit's one role,
// --slc-accent-fill. Since ui-kit 0.35 the generator writes it into
// themes/products.css under data-sl-product="spexr", so no showcase page
// carries it as a literal: each sets data-sl-product and loads products.css
// (below, and showcase-screens.test.mjs for the stage). The kit derives the
// label, the hover and the press from it (the kit's one step, toward black
// under its white label, on both themes), and they hold 4.5:1 on all three.
const Yl = (c) => 0.2126 * c.lin[0] + 0.7152 * c.lin[1] + 0.0722 * c.lin[2];
const contrast = (a, b) => { const [hi, lo] = [Yl(a), Yl(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const registeredFill = JSON.parse(read("../packages/ui-kit/agent/accent-registry.json")).products.spexr.fill;
const components = read("../packages/ui-kit/components.css");
const products = read("../packages/ui-kit/themes/products.css");
/** The fill products.css gives spexr's theme element on a theme. */
const emittedFill = (theme) => products
  .slice(products.indexOf(`[data-sl-product="spexr"][data-sl-theme="${theme}"]`)).split("}")[0]
  .match(/--slc-accent-fill:\s*([^;]+);/)?.[1];
/** The kit's :root roles on a theme, with spexr's accent and `fill` set as the role. */
const kitEnv = (theme, fill) => {
  const env = new Map();
  for (const f of ["../packages/ui-kit/tokens.css", `../packages/ui-kit/themes/${theme}.css`]) {
    for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--_?sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  }
  for (const [k, v] of declarations(components, [":root", ...(theme === "light" ? [':root[data-sl-theme="light"]'] : [])])) env.set(k, v);
  env.set("--sl-accent-default", theme === "light" ? "#5b6cff" : "#8b96ff");
  env.set("--slc-accent-fill", fill);
  return env;
};

// screens.css is the stage of showcase/screens.html, styled like the other two.
for (const page of ["index.html", "effects.html", "screens.css"]) {
  const src = read(`../showcase/${page}`).replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, "");
  test(`${page}: the indigo accent fill is products.css's, never a literal of the page`, () => {
    assert.doesNotMatch(src, /--slc-accent-fill\s*:\s*#/, "no fill literal");
    assert.doesNotMatch(src, /#4c58e9/i, "no copy of the registered fill");
    assert.doesNotMatch(src, /data-demo-accent="indigo"\]:not\(\[data-sl-theme="high-contrast"\]\) \.sl-btn--primary \{/, "no re-binding of the accent on the primary (pre-0.32)");
    assert.doesNotMatch(src, /data-demo-accent="indigo"\]\[data-sl-theme=/, "no per-theme step override");
  });
}

for (const theme of ["light", "dark"]) {
  test(`${theme}: products.css gives spexr its registered fill, and the kit's label reads on it, its hover and its press (4.5:1)`, () => {
    assert.equal(emittedFill(theme), registeredFill[theme]);
    const env = kitEnv(theme, emittedFill(theme));
    const label = evaluate("var(--slc-on-accent-fill)", env);
    // the kit's pole for the fill, derived: a fill change is one registry line
    assert.equal(toHex(label), toHex(evaluate(`oklch(from ${emittedFill(theme)} var(--_sl-on))`, env)), `${theme}: the label is the fill's pole`);
    for (const p of ["--slc-accent-fill", "--slc-accent-fill-hover", "--slc-accent-fill-active"]) {
      const r = contrast(label, evaluate(`var(${p})`, env));
      assert.ok(r >= 4.5, `${theme} ${p} ${r.toFixed(2)}:1`);
    }
  });
}

// 0.29: neutrals are tinted per product, so a swatch is a registered product,
// not just a hue. The switcher names the product (data-sl-product) and the
// page loads products.css; each swatch's hues are that product's registry
// accents, so the neutrals and the accent always agree.
{
  const registry = JSON.parse(read("../packages/ui-kit/agent/accent-registry.json")).products;
  const accentOf = (id, theme) => registry[id][theme] ?? registry[registry[id].inherits]?.[theme];
  for (const page of ["index", "effects"]) {
    const src = read(`../showcase/${page}.html`);
    test(`${page}.html: the accent switcher sets data-sl-product to the swatch's registered product`, () => {
      assert.match(src, /<link rel="stylesheet" href="\.\.\/packages\/ui-kit\/themes\/products\.css">/);
      const fn = src.slice(src.indexOf("function applyAccent"), src.indexOf("store(\"sl-demo-accent\"", src.indexOf("function applyAccent")));
      assert.match(fn, /setAttribute\("data-sl-product", pair\.product\)/);
      const table = src.match(/var ACCENTS = \{([\s\S]*?)\};/)[1];
      const rows = [...table.matchAll(/(\w+):\s*\{ light: "(#[0-9a-fA-F]{6})", dark: "(#[0-9a-fA-F]{6})", product: "([\w-]+)" \}/g)];
      assert.equal(rows.length, 3, "three swatches, each naming its product");
      for (const [, swatch, light, dark, product] of rows) {
        assert.ok(registry[product], `${swatch}: ${product} is registered`);
        assert.equal(light.toLowerCase(), accentOf(product, "light").toLowerCase(), `${swatch} light`);
        assert.equal(dark.toLowerCase(), accentOf(product, "dark").toLowerCase(), `${swatch} dark`);
      }
    });
  }
}
