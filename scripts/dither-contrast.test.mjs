import { test } from "node:test";
import assert from "node:assert/strict";
import { REGISTRY, THEMES, WIRINGS, ratio, tree, rulesFor } from "./lib/primary-matrix.mjs";
import { customs } from "./lib/cascade.mjs";
import { evaluate, toHex } from "./lib/css-color.mjs";

// The hover dither (effects.css, DITHER; pixel direction D) fills a control
// with --slfx-dither-fill and flips the label to --slfx-dither-on once the
// wipe has covered half of it. The label is the kit's one label rule read off
// the fill, so it has to hold 4.5:1 on that fill for every registered accent,
// on both themes, in every wiring a product reaches the kit by. Each cell is
// read through the cascade (scripts/lib/primary-matrix.mjs), so a token, a
// theme or a product rule that moves the fill or the label moves the test.

const VARIANTS = {
  primary: ["sl-btn", "sl-btn--primary"],
  secondary: ["sl-btn"],
  ghost: ["sl-btn", "sl-btn--ghost"],
  "icon button": ["sl-icon-btn"],
  "round icon button": ["sl-icon-btn", "sl-icon-btn--round"],
  "danger ghost": ["sl-btn", "sl-btn--ghost", "sl-btn--danger"],
  "danger icon button": ["sl-icon-btn", "sl-icon-btn--danger"],
  "danger primary": ["sl-btn", "sl-btn--primary", "sl-btn--danger"],
};

/** The fill and the label of one control, as the cascade computes them. */
function cell(wiring, id, theme, classes) {
  const w = rulesFor(wiring, id);
  const { control } = tree(w, theme, "opaque", classes, []);
  const env = customs(w.rules, control);
  return { fill: evaluate("var(--slfx-dither-fill)", env), on: evaluate("var(--slfx-dither-on)", env) };
}

for (const wiring of Object.keys(WIRINGS)) for (const id of Object.keys(REGISTRY)) for (const theme of THEMES) {
  test(`${wiring} / ${id} / ${theme}: the dithered label reads 4.5:1 on the fill, on every variant`, () => {
    const low = [];
    for (const [name, classes] of Object.entries(VARIANTS)) {
      const { fill, on } = cell(wiring, id, theme, classes);
      const r = ratio(on, fill);
      if (r < 4.5) low.push(`${name}: ${r.toFixed(2)} (${toHex(on)} on ${toHex(fill)})`);
    }
    assert.deepEqual(low, []);
  });
}

test("the primary fills with the inverse neutral and every other control with the accent", () => {
  for (const theme of THEMES) {
    const w = rulesFor("tier A", "default");
    const read = (classes) => {
      const { control } = tree(w, theme, "opaque", classes, []);
      const env = customs(w.rules, control);
      return { fill: toHex(evaluate("var(--slfx-dither-fill)", env)), text: toHex(evaluate("var(--slc-text)", env)), accent: toHex(evaluate("var(--slc-accent-fill, var(--slc-accent))", env)), danger: toHex(evaluate("var(--slc-danger)", env)) };
    };
    assert.equal(read(VARIANTS.primary).fill, read(VARIANTS.primary).text, `${theme}: primary`);
    for (const v of ["secondary", "ghost", "icon button", "round icon button"]) assert.equal(read(VARIANTS[v]).fill, read(VARIANTS[v]).accent, `${theme}: ${v}`);
    for (const v of ["danger ghost", "danger icon button"]) assert.equal(read(VARIANTS[v]).fill, read(VARIANTS[v]).danger, `${theme}: ${v}`);
  }
});
