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

test("lens maps are shared by the lenses that show them, and freed by the last", () => {
  assert.match(lens, /acquireMap\(keys\[0\], \(\) => buildMap\(w, h\)\)/);
  assert.match(lens, /acquireMap\(keys\[1\], \(\) => buildConvexMap\(w, h, bulge\)\)/);
  assert.match(lens, /if \(entry && --entry\.refs <= 0\) mapCache\.delete\(key\)/, "the last holder frees it");
  const refresh = lens.slice(lens.indexOf("function refresh()"), lens.indexOf("refresh();\n"));
  assert.ok(refresh.indexOf("acquireMap(keys[1]") < refresh.indexOf("releaseMap(k)"), "new maps are taken before old ones are given back");
  const destroy = lens.slice(lens.indexOf("    destroy() {"));
  assert.match(destroy, /for \(const k of held\) releaseMap\(k\);/, "a destroyed lens gives its maps back");
  assert.equal((refresh.match(/getComputedStyle\(/g) || []).length, 1, "one style read per refresh");
});

test("the curtains move on compositor properties; their blur is fixed", () => {
  // The breathe animated the blur radius of every curtain at once, and the
  // drift a registered offset, both main-thread. The sheets now move by
  // translate, transform, scale and the mask's position only.
  for (const k of ["sway-a", "sway-b", "lean-a", "lean-b", "width"]) {
    const kf = new RegExp(`@keyframes slfx-pillar-${k} \\{[^\\n]*\\}`).exec(effectsCss)?.[0];
    assert.ok(kf, `slfx-pillar-${k} must exist`);
    assert.doesNotMatch(kf, /--slfx|filter|background/, `slfx-pillar-${k} animates no custom property, filter or background`);
  }
  assert.doesNotMatch(effectsCss, /slfx-pillars-breathe|slfx-pillars-drift|--slfx-pillar-x|--slfx-pillar-soft/, "the old single clock is gone");
  assert.match(effectsCss, /filter: blur\(8\.5px\);/);
});

test("mount() creates no canvas: the dither layer waits for the first pointer entry", () => {
  const fnBody = (name) => {
    const at = effectsJs.indexOf(`function ${name}(`);
    assert.ok(at > -1, `missing function: ${name}`);
    let depth = 0;
    let i = effectsJs.indexOf("{", effectsJs.indexOf(")", at));
    const from = i;
    do { depth += effectsJs[i] === "{" ? 1 : effectsJs[i] === "}" ? -1 : 0; i++; } while (depth > 0);
    return effectsJs.slice(from, i);
  };
  const mount = fnBody("mount").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(mount, /createElement\("canvas"\)|ensureDither|sl-fx-dither/, "mount() builds nothing for the dither");
  // The one place a dither canvas is made is ensureDither, and the only caller is the pointer entry.
  assert.match(fnBody("ensureDither"), /createElement\("canvas"\)/);
  assert.match(fnBody("onDitherCross"), /entering \? ensureDither\(host\)/);
  assert.equal((effectsJs.match(/ensureDither\(/g) ?? []).length, 2, "defined once, called once");
});
