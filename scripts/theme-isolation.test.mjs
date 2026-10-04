import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The light theme owns the spectrum. Every other theme resets it to `initial`
// (the guaranteed-invalid value), so a consumer's var() fallback — today's
// colour — wins there, and a dark island inside a light page inherits nothing.
// Apart from those resets, a non-light theme file is byte-identical to its
// reviewed baseline (scripts/fixtures/theme-*-baseline.css): changing the dark
// or high-contrast theme is a deliberate act that updates the baseline in the
// same commit. Baselines: 0.20.1, plus dark muted text #7C8D95 (0.21.1, AA),
// plus the dark neutral ladder baked from the amber hue (0.29.0, Lumen), plus
// the black casts and the new inset cast (0.31.0, Lumen depth; high contrast
// reuses dark's), plus the accent's hover and press as the kit's step
// (0.32.1, the components.css macros: 0.05 / 0.10 of oklch lightness toward
// black, or toward white where the dark label would read under 5.4:1); high
// contrast took its values for the three
// new neutral roles and its resets in 0.29.0, and is otherwise unchanged
// since 0.20.1.
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(HERE, p), "utf8");
const SPECTRUM = [...Array(6).keys()].map((i) => `--sl-spectrum-${i}`)
  .concat([...Array(5).keys()].map((i) => `--sl-spectrum-ink-${i}`));
const decl = (css, name) => css.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, "m"))?.[1];

test("light declares every spectrum property as a hex", () => {
  const css = read("../packages/ui-kit/themes/light.css");
  for (const n of SPECTRUM) assert.match(decl(css, n) ?? "", /^#[0-9A-Fa-f]{6}$/, n);
});

for (const id of ["dark", "high-contrast"]) {
  test(`${id} resets every spectrum property to initial`, () => {
    const css = read(`../packages/ui-kit/themes/${id}.css`);
    for (const n of SPECTRUM) assert.equal(decl(css, n), "initial", n);
  });
  test(`${id} is otherwise byte-identical to its reviewed baseline`, () => {
    const now = read(`../packages/ui-kit/themes/${id}.css`)
      .split("\n").filter((l) => !/^\s*--sl-spectrum-/.test(l)).join("\n");
    assert.equal(now, read(`fixtures/theme-${id}-baseline.css`));
  });
}

// The same isolation for every other token: high contrast owns or resets
// every --sl-* that light or dark declares. A name it skipped would leak into
// a high-contrast island from the page around it -- the light text cap
// (0.46) would darken its yellow accent text, light code inks would paint on
// black. Resets are `initial`, so a consumer's var() fallback wins there.
test("high-contrast declares or resets every --sl-* that light or dark declares", () => {
  const names = (css) => new Set([...css.matchAll(/^\s*(--sl-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  const hc = names(read("../packages/ui-kit/themes/high-contrast.css"));
  const missing = ["light", "dark"]
    .flatMap((id) => [...names(read(`../packages/ui-kit/themes/${id}.css`))])
    .filter((n, i, all) => all.indexOf(n) === i && !hc.has(n));
  assert.deepEqual(missing, []);
});

test("high contrast gives the new neutral roles real values, not resets", () => {
  const css = read("../packages/ui-kit/themes/high-contrast.css");
  for (const n of ["--sl-bg-tile", "--sl-bg-sunken", "--sl-border-lit"]) assert.match(decl(css, n) ?? "", /^#[0-9a-f]{6}$/i, n);
});
