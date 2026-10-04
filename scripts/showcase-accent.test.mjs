import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromHex } from "./lib/css-color.mjs";

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
// more"): ONE registered fill on both themes, set since ui-kit 0.32 as the
// kit's one role, --slc-accent-fill, on the root -- never a re-binding of
// --slc-accent on the primary. The kit derives the label, the hover and the
// press from it (the kit's one step away from the label, on both themes), and they hold
// 4.5:1 on all three.
const Yl = (c) => 0.2126 * c.lin[0] + 0.7152 * c.lin[1] + 0.0722 * c.lin[2];
const contrast = (a, b) => { const [hi, lo] = [Yl(a), Yl(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const registeredFill = JSON.parse(read("../packages/ui-kit/agent/accent-registry.json")).products.spexr.fill;
const components = read("../packages/ui-kit/components.css");
/** The kit's :root roles on a theme, with spexr's accent and `fill` set as the role. */
const kitEnv = (theme, fill) => {
  const env = new Map();
  for (const f of ["../packages/ui-kit/tokens.css", `../packages/ui-kit/themes/${theme}.css`]) {
    for (const m of read(f).replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  }
  for (const [k, v] of declarations(components, [":root", ...(theme === "light" ? [':root[data-sl-theme="light"]'] : [])])) env.set(k, v);
  env.set("--sl-accent-default", theme === "light" ? "#5b6cff" : "#8b96ff");
  env.set("--slc-accent-fill", fill);
  return env;
};

// screens.css is the stage of showcase/screens.html: it mirrors the same block.
for (const page of ["index.html", "effects.html", "screens.css"]) {
  const src = read(`../showcase/${page}`);
  const block = src.match(/\[data-demo-accent="indigo"\]:not\(\[data-sl-theme="high-contrast"\]\) \{([^}]*)\}/)?.[1] ?? "";
  const decl = (p) => block.match(new RegExp(`${p}:\\s*([^;]+);`))?.[1].trim();

  test(`${page}: the indigo accent fill is the registered fill, set once on the root, on both themes`, () => {
    assert.equal(decl("--slc-accent-fill"), registeredFill.light);
    assert.equal(registeredFill.dark, registeredFill.light, "one fill on both themes");
    assert.deepEqual([...block.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]), ["--slc-accent-fill"], "the one role, nothing derived by hand");
    assert.doesNotMatch(src, /data-demo-accent="indigo"\]:not\(\[data-sl-theme="high-contrast"\]\) \.sl-btn--primary \{/, "no re-binding of the accent on the primary (pre-0.32)");
    assert.doesNotMatch(src, /data-demo-accent="indigo"\]\[data-sl-theme=/, "no per-theme step override");
  });

  test(`${page}: the kit's label reads on the indigo fill, its hover and its press (4.5:1), on both themes`, () => {
    for (const theme of ["light", "dark"]) {
      const env = kitEnv(theme, decl("--slc-accent-fill"));
      const label = evaluate("var(--slc-on-accent-fill)", env);
      assert.equal(contrast(label, fromHex("#ffffff")), 1, `${theme}: the label is white`);
      for (const p of ["--slc-accent-fill", "--slc-accent-fill-hover", "--slc-accent-fill-active"]) {
        const r = contrast(label, evaluate(`var(${p})`, env));
        assert.ok(r >= 4.5, `${theme} ${p} ${r.toFixed(2)}:1`);
      }
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
