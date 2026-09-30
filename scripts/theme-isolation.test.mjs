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
// same commit. Baselines: 0.20.1, plus dark muted text #7C8D95 (0.21.1, AA).
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
