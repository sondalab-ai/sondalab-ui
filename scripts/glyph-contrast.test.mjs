import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseSheet, el, cascaded, customs } from "./lib/cascade.mjs";
import { evaluate } from "./lib/css-color.mjs";

// Text glyphs the kit draws as separators or marks (ui-kit 0.36.3). sondalab-site's
// contrast probe measured the breadcrumb's "/" at 3.17:1 (dark) and 2.70:1
// (light), and the lockup's "·" at 1.97:1 (light): muted ink at 60% opacity,
// and the bare accent. Text stays at 4.5:1, so both read as the kit's text roles.
const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const RULES = ["tokens.css", "themes/light.css", "themes/dark.css", "components.css"].flatMap((f, i) => parseSheet(read(f), {}, i * 1e5));

const YL = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [YL(a), YL(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
/** Linear-light blend of `fg` over `bg` at `alpha`. */
const over = (fg, bg, alpha) => ({ lin: fg.lin.map((v, i) => v * alpha + bg.lin[i] * (1 - alpha)), alpha: 1 });

/** The glyph's rendered ink over the page canvas, in `theme`. */
function glyphRatio(theme, classes, parents = []) {
  const html = el({ tag: "html", attrs: { "data-sl-theme": theme } });
  let parent = el({ tag: "body", parent: html });
  for (const c of parents) parent = el({ classes: [c], parent });
  const glyph = el({ tag: "span", classes, parent });
  const won = cascaded(RULES, glyph);
  const env = customs(RULES, glyph);
  const canvas = evaluate("var(--slc-canvas)", env);
  const colour = won.get("color")?.value;
  const opacity = Number(won.get("opacity")?.value ?? 1);
  const ink = evaluate(colour, env);
  return ratio(over(ink, canvas, opacity * ink.alpha), canvas);
}

test("the breadcrumb separator reads 4.5:1 on the canvas in both themes", () => {
  for (const theme of ["light", "dark"]) {
    const r = glyphRatio(theme, ["sl-breadcrumb__sep"], ["sl-breadcrumb"]);
    assert.ok(r >= 4.5, `${theme}: ${r.toFixed(2)}:1`);
  }
});

test("the lockup dot reads 4.5:1 on the canvas in both themes", () => {
  for (const theme of ["light", "dark"]) {
    const r = glyphRatio(theme, ["sl-lockup__dot"], ["sl-lockup"]);
    assert.ok(r >= 4.5, `${theme}: ${r.toFixed(2)}:1`);
  }
});
