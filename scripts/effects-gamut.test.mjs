import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { declarations, evaluate, fromOklch, toHex, fromHex, toOklch, gamutExcess, maxChroma } from "./lib/css-color.mjs";

// Every hue an effect emits is a derivation over the accent and the depth
// companion, and a derivation that lifts chroma can ask for more than sRGB
// holds at that lightness and hue — teal at L 0.66 holds C 0.114, and the
// vivid tier once asked 0.166 there. Chrome clips such a colour in sRGB, which
// moves its hue and lightness silently. These tests evaluate the real
// declarations of effects.css numerically, over a sweep of accents and depth
// companions on both themes, and hold every emitted colour to three things:
// inside sRGB; lightness and hue as derived; chroma at the gamut's ceiling
// whenever the derivation asked for more, and untouched whenever it did not.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const effects = read("effects.css");

const themeTokens = (css) => {
  const env = new Map();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--sl-[\w-]+)\s*:\s*([^;]+);/g)) env.set(m[1], m[2].trim());
  return env;
};
const THEMES = { light: themeTokens(read("themes/light.css")), dark: themeTokens(read("themes/dark.css")) };

// The cascade of a ghost pane with an aurora, and of a filled one (--rim):
// the parent (where the fits live), then the edge itself.
const GHOST = [":root", ":has(> :is(.sl-fx-glass, .sl-fx-aurora))", ":is(.sl-fx-glass, .sl-fx-aurora)", ".sl-fx-glass", ".sl-fx-glass--pane", ".sl-fx-aurora"];
const RIM = [...GHOST, ".sl-fx-aurora--rim", ".sl-fx-glass--pane.sl-fx-aurora--rim"];
const CASCADES = { ghost: declarations(effects, GHOST), rim: declarations(effects, RIM) };

// What the paint layers consume. --slfx-beam is the arc, the tails and blooms
// are its companions, the edge fringes and the spot are the pane's.
const EMITTED = [
  "--slfx-accent-vivid", "--slfx-depth-vivid", "--slfx-edge-tint", "--slfx-edge-warm", "--slfx-edge-cool",
  "--slfx-spot-warm", "--slfx-beam", "--slfx-beam-tail", "--slfx-bloom-hi", "--slfx-bloom-lo",
];
// A lifted colour and what it was lifted from.
const LIFTS = { "--slfx-bloom-hi": "--slfx-beam", "--slfx-bloom-lo": "--slfx-depth-vivid" };

// The in-gamut bit inside the guard is a clamp with a 1/1000 ramp, so a colour
// can sit up to 0.001 outside in linear light: invisible, and not a clip.
const GAMUT_TOLERANCE = 0.002;
// How close to the ceiling a guarded colour must land: the search's resolution
// is 0.0025 in chroma, against ceilings of 0.1 and above.
const CEILING_SHARE = 0.97;

function env(theme, overrides, cascade) {
  const e = new Map(THEMES[theme]);
  for (const [k, v] of Object.entries(overrides)) e.set(k, v);
  for (const [k, v] of CASCADES[cascade]) e.set(k, v);
  return e;
}
const resolveAll = (e) => Object.fromEntries(EMITTED.map((p) => [p, evaluate(`var(${p})`, e)]));

/** In-gamut accents across the hue wheel, dark to light, each at 90% of the
 *  chroma sRGB holds at that lightness and hue. */
function* sweep() {
  for (let h = 0; h < 360; h += 15) {
    for (const L of [0.35, 0.5, 0.66, 0.8]) {
      const hex = toHex(fromOklch([L, maxChroma(L, h) * 0.9, h]));
      yield { hex, label: `oklch(${L} ~${h}) ${hex}` };
    }
  }
}
function* cases() {
  for (const theme of ["light", "dark"]) {
    for (const cascade of ["ghost", "rim"]) {
      yield { theme, cascade, overrides: {}, label: `${theme}/${cascade} shipped tokens` };
      for (const { hex, label } of sweep()) {
        yield { theme, cascade, overrides: { "--sl-accent-default": hex }, label: `${theme}/${cascade} accent ${label}` };
        yield { theme, cascade, overrides: { "--sl-accent-depth": hex }, label: `${theme}/${cascade} depth ${label}` };
      }
    }
  }
}

test("every colour an effect emits stays inside sRGB, for every hue, on both themes", () => {
  const failures = [];
  for (const c of cases()) {
    const out = resolveAll(env(c.theme, c.overrides, c.cascade));
    for (const [prop, col] of Object.entries(out)) {
      const excess = gamutExcess(col);
      if (excess > GAMUT_TOLERANCE) failures.push(`${c.label}: ${prop} is ${excess.toFixed(3)} outside sRGB (oklch ${toOklch(col).map((v) => v.toFixed(3)).join(" ")})`);
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} emitted colours clip (first shown)`);
});

test("the vivid tier keeps its lightness and hue and pays chroma only to the gamut's ceiling", () => {
  // The tier's own rule, read from the stylesheet: a floor on lightness, the
  // lift paid in chroma. What it asks for is compared with what sRGB holds.
  const failures = [];
  for (const c of cases()) {
    const e = env(c.theme, c.overrides, c.cascade);
    const floor = parseFloat(e.get("--slfx-vivid-l"));
    const k = parseFloat(e.get("--slfx-vivid-k"));
    for (const [prop, token] of [["--slfx-accent-vivid", "--slc-accent"], ["--slfx-depth-vivid", "--slfx-depth"]]) {
      const src = toOklch(evaluate(token === "--slc-accent" ? "var(--slc-accent, var(--sl-accent-default))" : `var(${token})`, e));
      const want = [Math.max(src[0], floor), src[1] + Math.max(0, floor - src[0]) * k, src[2]];
      const ceiling = maxChroma(want[0], want[2]);
      const got = toOklch(evaluate(`var(${prop})`, e));
      const label = `${c.label}: ${prop} wants ${want.map((v) => v.toFixed(3)).join(" ")} (ceiling ${ceiling.toFixed(3)}), got ${got.map((v) => v.toFixed(3)).join(" ")}`;
      if (Math.abs(got[0] - want[0]) > 1e-3) failures.push(`${label}: lightness moved`);
      if (want[1] > 1e-3 && Math.abs(((got[2] - want[2] + 540) % 360) - 180) > 0.5) failures.push(`${label}: hue moved`);
      if (want[1] <= ceiling) {
        if (Math.abs(got[1] - want[1]) > 0.002 * Math.max(1, want[1] / 0.1)) failures.push(`${label}: an in-gamut colour was altered`);
      } else if (got[1] < ceiling * CEILING_SHARE) {
        failures.push(`${label}: chroma dropped below the ceiling`);
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} vivid-tier colours off (first shown)`);
});

test("a lifted colour is never paler than its source unless the gamut forbids it", () => {
  const failures = [];
  for (const c of cases()) {
    const out = resolveAll(env(c.theme, c.overrides, c.cascade));
    for (const [prop, from] of Object.entries(LIFTS)) {
      const got = toOklch(out[prop]);
      const src = toOklch(out[from]);
      const ceiling = maxChroma(got[0], got[2]);
      if (got[1] < Math.min(src[1], ceiling) * CEILING_SHARE) {
        failures.push(`${c.label}: ${prop} C ${got[1].toFixed(3)} at L ${got[0].toFixed(3)} (ceiling ${ceiling.toFixed(3)}) is paler than ${from} C ${src[1].toFixed(3)}`);
      }
    }
  }
  assert.deepEqual(failures.slice(0, 12), [], `${failures.length} lifts pale (first shown)`);
});

test("the evaluator agrees with Chrome on the colours it is trusted with", () => {
  // Computed values read in Chrome 152 on the showcase (paper), against which
  // the evaluator's conversions are held — so a failure above is the
  // stylesheet's, not the arithmetic's.
  const e = env("light", {}, "ghost");
  const depthVivid = evaluate("oklch(from #14606C max(l, 0.66) calc(c + max(0, 0.66 - l) * 0.45) h)", e);
  const lch = toOklch(depthVivid);
  assert.ok(Math.abs(lch[0] - 0.66) < 1e-4 && Math.abs(lch[1] - 0.165852) < 2e-4 && Math.abs(lch[2] - 210.866) < 0.05, `depth vivid ${lch}`);
  const lin = evaluate("color(from oklch(0.66 0.166 210.863) srgb-linear r g b)", e).lin;
  assert.ok(Math.abs(lin[0] - -0.114765) < 5e-4 && Math.abs(lin[1] - 0.404554) < 5e-4 && Math.abs(lin[2] - 0.596482) < 5e-4, `linear ${lin}`);
  const sel = toOklch(evaluate("oklch(from color-mix(in oklch, oklch(0.6 0.2 100 / 1), oklch(0.6 0.05 100 / 0.001)) l c h / 1)", e));
  assert.ok(Math.abs(sel[1] - 0.19985) < 1e-4, `select ${sel}`);
  assert.equal(toHex(fromHex("#B56A0C")), "#b56a0c");
});
