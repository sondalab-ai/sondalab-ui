import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// 0.16.0: work the effects did that nobody could see. Each guard pins one
// saving, so a later edit cannot quietly bring the cost back.

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/ui-kit");
const read = (f) => readFileSync(resolve(KIT, f), "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const effectsJs = read("effects.js");
const goo = read("goo-field.js");
const lens = read("glass-lens.js");
const effectsCss = strip(read("effects.css"));
const glassCss = strip(read("glass.css"));

test("the liquid drop rests under a still pointer and writes only changed attributes", () => {
  const loop = effectsJs.slice(effectsJs.indexOf("function integrateLiquid("), effectsJs.indexOf("function ensureLiquidLoop("));
  assert.match(loop, /const resting = target === 1/, "a drop at rest stops the loop");
  assert.match(loop, /getAnimations\(\)\.length/, "unless a colour is still in flight");
  assert.match(effectsJs, /addEventListener\("transitionrun", onLiquidTransition/, "and a new transition wakes it");
  assert.match(effectsJs, /if \(skinParts\.drop\.getAttribute\(name\) !== value\)/, "a filter attribute is written only when it changes");
});

test("a goo field lands a release only for a press it saw", () => {
  const up = goo.slice(goo.indexOf("const onUp = () => {"), goo.indexOf("const onBlur"));
  assert.match(up, /if \(!held\) return;/);
});

test("a lensed host drops its dead blur, and its lens stands down off-screen", () => {
  assert.match(glassCss, /\.sl-glass\.is-lensed > \.sl-glass__backdrop \{\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;/);
  assert.match(effectsCss, /\[data-sl-fx="on"\] \.sl-fx-glass\.is-lensed:not\(\[data-sl-fx-near\]\) \{\s*-webkit-backdrop-filter: none !important;\s*backdrop-filter: none !important;/,
    "!important: the lens chain is written inline");
});

test("lens maps are shared between hosts of the same size, and the cache is bounded", () => {
  assert.match(lens, /cachedMap\(`p\$\{w\}x\$\{h\}`, \(\) => buildMap\(w, h\)\)/);
  assert.match(lens, /cachedMap\(`c\$\{w\}x\$\{h\}x\$\{bulge\}`, \(\) => buildConvexMap\(w, h, bulge\)\)/);
  assert.match(lens, /if \(mapCache\.size >= MAP_CACHE_MAX\) mapCache\.delete/);
  const refresh = lens.slice(lens.indexOf("function refresh()"), lens.indexOf("refresh();\n"));
  assert.equal((refresh.match(/getComputedStyle\(/g) || []).length, 1, "one style read per refresh");
});

test("the curtains breathe on filter, which the compositor can run", () => {
  assert.match(effectsCss, /@keyframes slfx-pillars-breathe \{ from \{ filter: blur\(7px\); \} to \{ filter: blur\(10px\); \} \}/);
});
