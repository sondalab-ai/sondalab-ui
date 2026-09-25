import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// Re-scope R3 (docs/specs/2027-improve-aesthetics.md): the aurora's run and
// busy readings as light with body. The CSS arc is the fallback, so what this
// module refuses matters as much as what it draws.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "live-light.js"), "utf8");
const css = readFileSync(resolve(KIT, "effects.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const comp = readFileSync(resolve(KIT, "components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;

test("live-light.js contains no colour literal: hues come from role variables", () => {
  assert.deepEqual(js.match(COLOUR) || [], []);
  assert.match(js, /roleColour\(el, "--slc-accent"\)/, "the accent is read off the host");
  assert.match(js, /roleColour\(el, "--slfx-depth"\)/, "and its depth companion");
});

test("importing the module has no side effects", async () => {
  await assert.doesNotReject(import(pathToFileURL(resolve(KIT, "live-light.js")).href));
});

test("the CSS arc keeps what the canvas refuses", () => {
  const wanted = js.slice(js.indexOf("function wanted("), js.indexOf("function attach("));
  assert.match(wanted, /\.sl-fx-aurora--linear, \.sl-fx-aurora--rim/, "a linear or rim aurora keeps the CSS reading");
  assert.match(wanted, /--slfx-progress/, "a determinate one keeps its arc: the length IS the value");
  assert.match(wanted, /data-sl-fx="off"/, "the subtree opt-out");
  assert.match(wanted, /"high-contrast"/, "and high contrast");
  const max = Number(/const MAX_LIVE = (\d+);/.exec(js)[1]);
  assert.ok(max > 0 && max <= 12, `a bounded number of WebGL contexts (${max})`);
  assert.match(js, /if \(!gl\) return;/, "no WebGL, no canvas: the arc stays");
});

test("reduced motion draws one still frame and never loops", () => {
  assert.match(js, /requestAnimationFrame\(frame\) : 0;/, "the loop is conditional");
  assert.match(js, /!globalThis\.matchMedia\?\.\(REDUCE\)\.matches/, "on the motion preference");
});

test("the canvas stands the arc down, and both kill switches hide the canvas", () => {
  assert.match(css, /\.sl-fx-aurora\.is-live-lit\[data-sl-fx-live\]::after\s*\{\s*opacity:\s*0;/);
  for (const attr of [':root[data-sl-theme="high-contrast"] .sl-fx-live__canvas', ':is([data-sl-fx="off"], [data-sl-fx="off"] *) .sl-fx-live__canvas']) {
    assert.ok(css.includes(attr), `${attr} must be in the display:none list`);
  }
  assert.match(css, /\.sl-fx-live__canvas\s*\{[^}]*z-index:\s*-1/, "under the label");
});

test("\"run\" lights the CSS arc too, so its fallback is complete", () => {
  assert.match(css, /\[data-sl-fx-live="on"\], \[data-sl-fx-live="busy"\], \[data-sl-fx-live="run"\]\)::after/);
});

test("a live badge breathes only where motion is welcome", () => {
  const guard = comp.indexOf("@media (prefers-reduced-motion: no-preference)");
  const anim = comp.indexOf(".sl-badge--live::before { animation:");
  assert.ok(guard > -1 && anim > guard, "the breath sits inside the reduced-motion guard");
});

// spexr, 0.15.0: a depth companion bound to color-mix() computes to oklab(),
// whose numbers read as bytes gave a near-black light on the paper theme.
test("a role colour is converted to sRGB by painting it, never parsed", () => {
  const fn = js.slice(js.indexOf("function roleColour("), js.indexOf("function compile("));
  assert.match(fn, /getContext\("2d"/, "painted on a 2D canvas");
  assert.match(fn, /getImageData\(0, 0, 1, 1\)/, "and read back as a pixel");
  assert.doesNotMatch(fn, /\.match\(/, "no parsing of the computed string");
});
