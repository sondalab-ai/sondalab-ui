import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate, fromSrgb, gamutExcess, toOklch } from "./lib/css-color.mjs";

// The hover and press step stays inside sRGB for EVERY colour, not only the
// registered fills (ui-kit 0.32.1). The step runs along the line to the pole
// it moves toward: darkening dims in linear light (exact), lightening eases
// chroma by (1 - step / (1 - l))^1.5, the smallest exponent that keeps the
// sRGB cube in gamut (1.4 leaves ~1e-3 out on the cube's surface). The
// macros are read from the generated tokens.css and each direction is forced
// through --_sl-lighter, so both are tried on every sample: the cube's
// surface (where the most chromatic colour of each hue and lightness lies)
// on a grid, plus a seeded random sample of the surface and the interior.
const HERE = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(resolve(HERE, "../packages/ui-kit/tokens.css"), "utf8");
const macro = (n) => tokens.match(new RegExp(`${n}:\\s*([^;]+);`))[1];

/** mulberry32: a small seeded generator, so the sample is the same every run. */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function samples() {
  const out = [];
  const N = 32;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) for (const f of [0, 1]) {
    const a = i / N, b = j / N;
    out.push([f, a, b], [a, f, b], [a, b, f]);
  }
  const r = rng(321);
  for (let k = 0; k < 4000; k++) {
    const p = [r(), r(), r()];
    if (k % 2 === 0) p[k % 3] = r() < 0.5 ? 0 : 1; // half on the surface
    out.push(p);
  }
  return out;
}

test("the hover and press step stays inside sRGB for every colour, lightened or darkened", () => {
  const env = new Map(["--_sl-step-hover", "--_sl-step-press"].map((n) => [n, macro(n)]));
  const out = [];
  for (const [r, g, b] of samples()) {
    const from = `color(srgb ${r} ${g} ${b})`;
    if (gamutExcess(fromSrgb([r, g, b])) > 0) continue;
    for (const lighter of ["1", "0"]) {
      env.set("--_sl-lighter", lighter);
      for (const step of ["hover", "press"]) {
        const e = gamutExcess(evaluate(`oklch(from ${from} var(--_sl-step-${step}))`, env));
        // 1e-6 of linear light is a millionth of a channel: float noise in
        // the OKLab round trip (pure red dims to -2e-8), never a colour a
        // browser would clip. The exponent the test guards fails it by 1e-3.
        if (e > 1e-6) out.push(`${from} ${lighter === "1" ? "lighter" : "darker"} ${step}: ${e.toExponential(2)}`);
      }
    }
  }
  assert.deepEqual(out.slice(0, 10), []);
});

// The accent fill's edge inside an inversion band (ui-kit 0.36.2): the fill
// held to the mid-tones, oklch L 0.55-0.59, its chroma in proportion toward
// black and eased toward white as the step above eases it. Read off the
// band's own block in components.css, at the kit's shade step.
test("the band's fill edge stays inside sRGB for every colour, at oklch L 0.55-0.59", () => {
  const css = readFileSync(resolve(HERE, "../packages/ui-kit/components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const band = css.match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  const macro = band.match(/--_sl-band-edge:\s*([^;]+);/);
  assert.ok(macro, "the band declares its fill-edge macro, --_sl-band-edge");
  const env = new Map([["--_sl-band-edge", macro[1]], ["--slc-shade-step", css.match(/--slc-shade-step:\s*([^;]+);/)[1]]]);
  const out = [];
  for (const [r, g, b] of samples()) {
    const from = `color(srgb ${r} ${g} ${b})`;
    if (gamutExcess(fromSrgb([r, g, b])) > 0) continue;
    const edge = evaluate(`oklch(from ${from} var(--_sl-band-edge))`, env);
    const e = gamutExcess(edge), [L] = toOklch(edge);
    if (e > 1e-6) out.push(`${from}: out of sRGB by ${e.toExponential(2)}`);
    if (L < 0.55 - 1e-6 || L > 0.59 + 1e-6) out.push(`${from}: L ${L.toFixed(4)}`);
  }
  assert.deepEqual(out.slice(0, 10), []);
});
