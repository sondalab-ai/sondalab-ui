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
  assert.match(js, /if \(draw\(now\) && moving\(\)\) rafId = requestAnimationFrame\(frame\);/, "the loop is conditional");
  assert.match(js, /matchMedia\?\.\(REDUCE\)/, "on the motion preference");
});

// 0.16.0: on the showcase the loop spent 1.45 ms a frame drawing three
// canvases that were all off-screen.
test("only near hosts are drawn, and the loop stops when none are", () => {
  const draw = js.slice(js.indexOf("function draw("), js.indexOf("function frame("));
  assert.match(draw, /if \(!it\.near\) continue;/, "an off-screen host is skipped");
  assert.match(js, /new IntersectionObserver\([\s\S]*?rootMargin: NEAR_MARGIN/, "nearness comes from an observer");
  assert.match(js, /near: true,/, "and fails open: a host is near until told otherwise");
  assert.match(js, /nearIO\?\.unobserve\(el\)/, "a detached host is unobserved");
});

test("a frame reads no layout and looks nothing up", () => {
  const draw = js.slice(js.indexOf("function draw("), js.indexOf("function frame("));
  assert.doesNotMatch(draw, /getBoundingClientRect|getComputedStyle|getUniformLocation|matchMedia/);
  assert.match(js, /new ResizeObserver\(/, "the box is read when it resizes");
});

test("a host removed from the DOM releases its context without waiting for a frame", () => {
  const watch = js.slice(js.indexOf("const watch = new MutationObserver"), js.indexOf("watch.observe("));
  assert.match(watch, /removedNodes/);
  assert.match(watch, /if \(!el\.isConnected\) detach\(el\)/);
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

// spexr, 0.15.1: the run light still carried 18% alpha (46/255) 6px out, where the
// canvas ended, so it stopped on a hard rectangle around the card.
test("the canvas reaches as far as PAD says, and the light is gone by its edge", () => {
  const pad = Number(/const PAD = (\d+);/.exec(js)[1]);
  const rule = /\.sl-fx-live__canvas\s*\{([^}]*)\}/.exec(css)[1];
  assert.match(rule, new RegExp(`inset:\\s*-${pad}px`), "the CSS inset is -PAD");
  assert.match(rule, new RegExp(`width:\\s*calc\\(100% \\+ ${pad * 2}px\\)`), "the width adds PAD on both sides");
  assert.match(rule, new RegExp(`height:\\s*calc\\(100% \\+ ${pad * 2}px\\)`), "and so does the height");
  const run = js.slice(js.indexOf("const FS_RUN"), js.indexOf("const FS_BUSY"));
  assert.match(run, /\(1\.-smoothstep\([^,]+,uPad,d\)\)/, "the outer light fades to zero at uPad");
  // The bleed alone (exp(-d/3)*.5) must be negligible at PAD, so the fade is a
  // soft shoulder rather than the thing hiding a cut.
  assert.ok(0.5 * Math.exp(-pad / 3) < 0.005, `bleed at PAD=${pad} is below 0.5%`);
});
