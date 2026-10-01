import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// isChromatic decides whether ink shimmers in a control's own colour or falls
// back to the accent. The first reader split on every run of digits, so a
// colour-space name (display-p3, xyz-d65, rec2020) leaked its digits into the
// channels, lab()/lch() were read as RGB bytes, an exponent split in two and
// `none` dropped a channel (review, 2026-10-01). Each case below is a
// notation a browser really serialises.

const HERE = dirname(fileURLToPath(import.meta.url));
const { isChromatic } = await import(resolve(HERE, "../packages/ui-kit/colour.js"));

const cases = [
  ["rgb grey", "rgb(128, 128, 128)", false],
  ["rgb near-black ink", "rgb(20, 22, 30)", false],
  ["rgb colour", "rgb(220, 60, 40)", true],
  ["rgba colour, alpha ignored", "rgba(0, 120, 255, 0.5)", true],
  ["rgba grey, alpha not read as a channel", "rgba(200, 200, 200, 0.06)", false],
  ["color(srgb) grey", "color(srgb 0.5 0.5 0.5)", false],
  ["color(srgb) colour", "color(srgb 0.9 0.3 0.1 / 0.8)", true],
  ["color(display-p3) grey: the 3 of p3 is no channel", "color(display-p3 0.5 0.5 0.5)", false],
  ["color(rec2020) grey: nor the 2020", "color(rec2020 0.4 0.4 0.4)", false],
  ["color(display-p3) colour", "color(display-p3 0.2 0.5 0.9)", true],
  ["color(xyz-d65) white is not read as RGB", "color(xyz-d65 0.95 1 1.09)", false],
  ["oklch chroma 0", "oklch(0.6 0 120)", false],
  ["oklch chroma 0.1", "oklch(0.6 0.1 30)", true],
  ["oklch chroma none", "oklch(0.6 none 30)", false],
  ["oklch hue none keeps the chroma", "oklch(0.6 0.15 none)", true],
  ["oklab neutral", "oklab(0.5 0 0)", false],
  ["oklab colour", "oklab(0.6 0.1 -0.05)", true],
  ["lab(50 0 0) is grey on the 0-125 scale", "lab(50 0 0)", false],
  ["lab colour", "lab(50 40 -20)", true],
  ["lch grey", "lch(60 2 90)", false],
  ["lch colour on the 0-150 scale", "lch(60 30 90)", true],
  ["exponent notation is one number", "oklab(0.5 1e-7 -2.5e-8)", false],
  ["exponent notation, coloured", "color(srgb 9e-1 1.5E-1 1e-1)", true],
  ["a keyword is not read", "transparent", false],
  ["an unknown notation is not read", "hsl(0 100% 50%)", false],
  ["an empty string", "", false],
];

for (const [name, css, want] of cases) {
  test(`isChromatic: ${name}`, () => {
    assert.equal(isChromatic(css), want, css);
  });
}
