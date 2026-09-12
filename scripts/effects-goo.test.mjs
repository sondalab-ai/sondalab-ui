import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

import {
  cornerPx,
  roundedRectPathAt,
  fieldOrigin,
  memberShape,
  weldSigma,
  weldGap,
  weldPlan,
  filterRegion,
} from "../packages/ui-kit/geom.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const MODULE = resolve(KIT, "goo-field.js");
const js = readFileSync(MODULE, "utf8");
const css = readFileSync(resolve(KIT, "effects.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/* ── geometry ─────────────────────────────────────────────────────────────── */

test("cornerPx resolves a radius the way the browser paints it", () => {
  // Carried over from the liquid's own coverage: --sl-radius-pill is 9999px,
  // and a shape traced against that literal lands thousands of pixels away.
  assert.equal(cornerPx("9999px", 40, 40), 20, "a pill on a 40px box paints a circle");
  assert.equal(cornerPx("9999px", 200, 40), 20, "and is bounded by the SHORTER side");
  assert.equal(cornerPx("6px", 200, 40), 6, "a radius that fits is untouched");
  assert.equal(cornerPx("50%", 40, 60), 20, "a percentage is of the shorter side");
  assert.equal(cornerPx("auto", 40, 40), 0, "an unparseable radius is none");
});

test("roundedRectPathAt emits the box at its offset, not at the origin", () => {
  const at = roundedRectPathAt(10, 20, 100, 40, [4, 4, 4, 4]);
  assert.match(at, /^M 14 20 /, "the path starts at x + top-left radius, y");
  assert.ok(at.includes("H 106"), "the top edge runs to x + w - top-right radius");
  assert.ok(at.trimEnd().endsWith("Z"), "the outline closes");

  // A zero-radius box is a plain rectangle at the offset.
  const sharp = roundedRectPathAt(-5, -5, 10, 10, [0, 0, 0, 0]);
  assert.match(sharp, /^M -5 -5 /, "a negative offset is legal — the field paints outside its box");
});

test("roundedRectPathAt clamps radii that would overlap, together", () => {
  // The browser reduces every radius on an over-subscribed box by one shared
  // factor. A per-corner clamp would change the shape, not just its size.
  const path = roundedRectPathAt(0, 0, 100, 20, [20, 20, 20, 20]);
  assert.ok(path.includes("A 10 10"), "four 20px radii on a 20px-tall box scale to 10");
});

test("fieldOrigin is the container's PADDING box, not its border box", () => {
  // An absolutely positioned child with inset: 0 resolves against the padding
  // box, while getBoundingClientRect() returns the border box. Conflating the
  // two shifts every member by the container's border width.
  const origin = fieldOrigin({ left: 100, top: 50 }, 2, 3);
  assert.deepEqual(origin, { x: 102, y: 53 });
  assert.deepEqual(fieldOrigin({ left: 0, top: 0 }, 0, 0), { x: 0, y: 0 });
});

test("memberShape maps a viewport rect into field coordinates and dilates it", () => {
  const shape = memberShape(
    { left: 120, top: 80, width: 60, height: 40 },
    { x: 100, y: 60 },
    [8, 8, 8, 8],
    3,
  );
  assert.equal(shape.x, 17, "left - origin - reach");
  assert.equal(shape.y, 17, "top - origin - reach");
  assert.equal(shape.w, 66, "the silhouette peeks out on both sides");
  assert.equal(shape.h, 46);
  assert.deepEqual(shape.radii, [11, 11, 11, 11], "offsetting a rounded box outward grows its radii by the offset");
});

test("memberShape keeps a pill a pill under dilation", () => {
  // A round icon button is the shape the house gooey was built for; dilation
  // must not turn it into a stadium with flat sides.
  const r = cornerPx("9999px", 40, 40);
  const shape = memberShape({ left: 0, top: 0, width: 40, height: 40 }, { x: 0, y: 0 }, [r, r, r, r], 3);
  assert.equal(shape.radii[0], shape.h / 2, "the dilated radius is still half the dilated side");
});

/* ── the weld ─────────────────────────────────────────────────────────────── */

test("weldSigma and weldGap are inverses around the goo's own threshold", () => {
  // The goo chain is a premultiplied Gaussian blur followed by an alpha slope
  // whose midpoint sits at alpha 0.5. Two opaque silhouettes therefore weld
  // exactly where their blurred alphas sum to 0.5 — at a gap of 2·σ·√2·
  // erfc⁻¹(0.5) ≈ 1.3489·σ. Everything the author binds is expressed in that
  // gap, because a gap is a distance they can measure in their own layout;
  // sigma is not.
  for (const weld of [6, 14, 28, 40]) {
    assert.ok(Math.abs(weldGap(weldSigma(weld)) - weld) < 1e-9, `round trip at ${weld}px`);
  }
  assert.ok(weldSigma(14) > 10 && weldSigma(14) < 11, "a 14px weld is a ~10.4px sigma");
  assert.equal(weldSigma(0), 0, "no weld is no blur");
});

test("weldGap grows with sigma and never goes negative", () => {
  assert.ok(weldGap(10) > weldGap(5));
  assert.equal(weldGap(0), 0);
  assert.equal(weldSigma(-5), 0, "a negative weld is refused, not inverted");
});

test("filterRegion covers every shape plus the blur's own reach", () => {
  const shapes = [
    { x: 0, y: 0, w: 40, h: 40 },
    { x: 100, y: 10, w: 20, h: 20 },
  ];
  const sigma = 10;
  const region = filterRegion(shapes, sigma);
  const pad = 3 * sigma;
  assert.equal(region.x, -pad, "the region starts a full blur reach before the leftmost shape");
  assert.equal(region.y, -pad);
  assert.equal(region.width, 120 + 2 * pad, "and ends a blur reach after the rightmost edge");
  assert.equal(region.height, 40 + 2 * pad);
});

test("filterRegion of nothing is empty rather than infinite", () => {
  const region = filterRegion([], 10);
  assert.equal(region.width, 0);
  assert.equal(region.height, 0);
});

/* ── the module's contract ────────────────────────────────────────────────── */

test("goo-field.js carries no colour literal", () => {
  // sl-audit reads CSS only, so a hex or an oklch() here would pass the gate
  // while breaking the colour contract. Every fill is read from the element's
  // own computed style or from a --slfx-* binding.
  const body = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(body, /#[0-9a-fA-F]{3,8}\b/, "no hex literal");
  assert.doesNotMatch(body, /\b(?:oklch|rgba?|hsla?|color-mix)\s*\(/, "no colour function literal");
});

test("importing goo-field.js does nothing", async () => {
  // The same rule effects.js carries: a surface that never calls the entry
  // point pays nothing for the module existing.
  const before = globalThis.document;
  await import(pathToFileURL(MODULE).href);
  assert.equal(globalThis.document, before, "import must not touch the document");
});

test("goo-field.js exports the documented entry point", async () => {
  const mod = await import(pathToFileURL(MODULE).href);
  assert.equal(typeof mod.gooField, "function");
});

test("the field never filters a member or its content", () => {
  // Decision 2's rule, at container scale: the goo lives on the silhouette
  // layer below the content, and the real DOM rides crisp on top. A CSS
  // filter on a member — or on the container — would filter its text.
  const filtered = /(?:^|;)\s*filter\s*:(?!\s*none\b)/;
  for (const m of css.matchAll(/([^{}]*\.sl-fx-goo[^{}]*)\{([^{}]*)\}/g)) {
    assert.doesNotMatch(m[2], filtered, `rule "${m[1].trim()}" may not filter a goo element`);
  }
});

test("the field is inert to the pointer and does not clip its own blur", () => {
  const rule = css.match(/\.sl-fx-goo__field\s*\{([^}]*)\}/);
  assert.ok(rule, "the field must have its own rule");
  assert.match(rule[1], /pointer-events:\s*none/, "the field must not intercept the pointer");
  assert.match(rule[1], /overflow:\s*visible/, "the goo reaches outside the svg's own box");
});

test("both kill switches hide the field", () => {
  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    const killed = new RegExp(`[^{}]*${attr.replace(/"/g, '"')}[^{}]*\\.sl-fx-goo__field[^{}]*\\{[^{}]*display:\\s*none`);
    assert.match(css.replace(/\s+/g, " "), killed, `[${attr}] must hide the field, the way it hides every other paint layer`);
  }
});

test("a member is marked in the markup, never inferred from the container's children", () => {
  // The same ruling that made --drop a class rather than a measured radius:
  // a geometric or positional heuristic misfires the moment a component
  // re-parametrises itself, and the modifier written in the markup is the
  // contract.
  assert.match(js, /\.sl-fx-goo__member/, "the member selector must be a class");
  assert.doesNotMatch(js, /\.children\b|firstElementChild/, "membership is not 'every child of the container'");
});

test("a theme change repaints every field", () => {
  // REGRESSION (2026-09-12): a field is static once laid out, so nothing else
  // repaints it — a theme switch changes no box, fires no resize and moves no
  // node. Its members' fills went on being the previous theme's, and on the
  // light theme that left a ghost button's dark label on a substance still
  // painted in the dark theme's raised surface: the label vanished. The
  // observer that already watches data-sl-theme for the GPU tier's uniforms is
  // where the repaint belongs.
  const effectsJs = readFileSync(resolve(KIT, "effects.js"), "utf8");
  const at = effectsJs.indexOf("new MutationObserver(repaintGooFields)");
  assert.ok(at > -1, "a theme observer must repaint the goo fields");
  assert.match(
    effectsJs.slice(at, at + 220), /attributeFilter:\s*\[\s*"data-sl-theme"/,
    "and it must key on data-sl-theme",
  );
  assert.match(effectsJs, /function repaintGooFields\(\)[\s\S]{0,200}handle\.measure\(\)/, "the repaint re-reads each field");
});

test("an image member's picture is placed in the tile's space, not in user space", () => {
  // REGRESSION (2026-09-12): the <image> inside a <pattern> is positioned in
  // the TILE's coordinate system, which already starts at the tile's origin.
  // Giving it the pattern's own absolute x/y offset it twice, so every tile
  // showed the wrapped-around part of the picture. The picture still looked
  // present — only its EDGES were wrong, and the edges are the only part a
  // weld blends, so three images sat side by side welding into black.
  const fn = js.slice(js.indexOf("function imageFill("), js.indexOf("function paint("));
  assert.ok(fn.length > 0, "imageFill must exist");
  assert.match(fn, /picture\.setAttribute\("x", "0"\)/, "the picture sits at the tile's own origin");
  assert.match(fn, /picture\.setAttribute\("y", "0"\)/);
  assert.match(fn, /pattern\.setAttribute\("x", String\(shape\.x\)\)/, "the TILE carries the user-space offset");
  assert.match(fn, /preserveAspectRatio", "xMidYMid slice"/, "a letterboxed picture would show the fallback in the bars");
});

test("an image member is measured again once it has decoded", () => {
  // A CSS-sized <img> never changes its box when its bytes arrive, so the
  // ResizeObserver never fires and an undecoded picture would stay a hole.
  assert.match(js, /function awaitImages\(\)/, "there must be a decode gate");
  assert.match(js, /\.decode\(\)\s*\.catch\(/, "a picture that fails to load keeps the fallback fill, it does not throw");
  assert.match(js, /Promise\.all\(pending\)\.then\(\(\) => measure\(\)\)/, "the gate re-measures");
});

test("focus tracks a member's colour as well as the pointer", () => {
  // Same staleness class as the theme bug: a fill that changes with no pointer
  // event leaves the silhouette painted in the resting colour.
  for (const ev of ["pointerenter", "pointerleave", "focusin", "focusout"]) {
    assert.ok(js.includes(`addEventListener("${ev}"`), `the field must listen for ${ev}`);
    assert.ok(js.includes(`removeEventListener("${ev}"`), `and drop ${ev} on destroy`);
  }
});

test("a member's silhouette is opaque, whatever the member's own alpha", () => {
  // The goo's alpha slope maps everything below 0.5 to nothing, so a member
  // whose fill is a tint has to stand on something opaque. Forcing its OWN
  // colour opaque was tried and is worse than the disease: sl-tag is the
  // accent at low alpha, and at full alpha it is no longer a tint but the
  // accent itself — a row of quiet tags rendered as three saturated slabs. So
  // opaque() is for the SUBSTANCE, and the member's face is composited over
  // it at the alpha the component chose.
  const fn = js.slice(js.indexOf("function opaque("), js.indexOf("function radiiOf("));
  assert.ok(fn.length > 0, "opaque() must exist");
  // Exercise the surgery itself: it must handle both shapes a computed alpha
  // takes, and leave an already-opaque colour alone.
  const opaque = new Function(`${fn}; return opaque;`)();
  assert.equal(opaque("rgba(15, 21, 26, 0.3)"), "rgba(15, 21, 26)");
  assert.equal(opaque("color(srgb 0.1 0.2 0.3 / 0.42)"), "color(srgb 0.1 0.2 0.3)");
  assert.equal(opaque("oklch(0.7 0.15 60 / 50%)"), "oklch(0.7 0.15 60)");
  assert.equal(opaque("rgb(15, 21, 26)"), "rgb(15, 21, 26)", "an opaque colour is untouched");
  assert.match(js, /const ground = opaque\(fallback\);/, "the substance under every member is opaque");
  assert.match(js, /isClear\(own\) \? ground : own/, "a member's OWN colour is painted as the component painted it, alpha included");
  assert.match(js, /paths\[i \* 2\]\.setAttribute\("fill", ground\)/, "every member stands on the substance");
});

test("the goo survives a motion preference, and only high contrast refuses it", () => {
  // The goo ANIMATES NOTHING — it is laid out, not played — and the spec's
  // reduced-motion clause is "nothing animates; static material survives". So
  // it is armed BEFORE mount()'s motion guard, on the same reasoning
  // lensRefused() carries: a visitor who asked for less movement did not ask
  // for less material. Its CSS is not gated on data-sl-fx="on" either.
  const effectsJs = readFileSync(resolve(KIT, "effects.js"), "utf8");
  const goo = effectsJs.indexOf("mountGoo(root);");
  const guard = effectsJs.indexOf("if (window.matchMedia(REDUCE).matches) return false;");
  assert.ok(goo > -1 && guard > -1, "mount() must call mountGoo() and still guard on motion");
  assert.ok(goo < guard, "the goo must be armed before the motion guard, not after it");

  const body = effectsJs.slice(effectsJs.indexOf("function mountGoo("), effectsJs.indexOf("function repaintGooFields("));
  assert.match(body, /high-contrast"\) return false/, "high contrast must still refuse it");
  assert.doesNotMatch(body, /REDUCE/, "mountGoo may not consult the motion preference");

  // And nothing in the goo's own CSS may key on the Tier 1 attribute, or the
  // arming above would be undone by the stylesheet.
  for (const m of css.matchAll(/([^{}]*\.sl-fx-goo[^{}]*)\{/g)) {
    assert.doesNotMatch(m[1], /\[data-sl-fx="on"\]/, `goo rule must not require Tier 1: ${m[1].trim()}`);
  }
});

test("weldPlan spends the budget on dilation and caps the blur", () => {
  // Dilation preserves the shape; blur melts it. The whole weld distance used
  // to go into sigma, which put it at 10-16px against a 12px corner radius —
  // "i bordi si deformano male". Sigma is now capped and dilation absorbs the
  // rest, and the weld distance is still honoured exactly.
  const K = 1.3489795;
  for (const [weld, rim, soft] of [[14, 3, 5], [22, 3, 5], [40, 4, 6], [9, 3, 5]]) {
    const { sigma, reach } = weldPlan(weld, rim, soft);
    assert.ok(sigma <= soft + 1e-9, `sigma must respect the cap at weld ${weld}`);
    assert.ok(reach >= rim - 1e-9, `the author's rim is a floor, not a target (weld ${weld})`);
    assert.ok(Math.abs(2 * reach + K * sigma - weld) < 1e-6, `weld ${weld} must be honoured exactly`);
  }
});

test("weldPlan keeps the rim when the weld is smaller than the rim alone", () => {
  // Two members closer together than the rim are already overlapping: there is
  // nothing left for the blur to bridge, and the rim must not shrink below what
  // the author asked for.
  const { sigma, reach } = weldPlan(4, 3, 5);
  assert.equal(sigma, 0, "no budget beyond the rim is no blur");
  assert.equal(reach, 3, "the rim is the floor");
  const none = weldPlan(0, 0, 5);
  assert.deepEqual(none, { sigma: 0, reach: 0 }, "no weld at all is no field");
});

test("a bigger blur cap melts more, and the plan says so", () => {
  const tight = weldPlan(22, 3, 4);
  const loose = weldPlan(22, 3, 12);
  assert.ok(tight.sigma < loose.sigma, "the cap is what bounds the melt");
  assert.ok(tight.reach > loose.reach, "and dilation pays for what the cap refuses");
});

test("the interaction loop re-measures, because a move is the one change nothing reports", () => {
  // ResizeObserver sees a box change SIZE, never change PLACE; a transform, an
  // inset write or a reflow above the field mutates no childList and fires no
  // resize. A loop that only re-read colours left a dragged chip's silhouette
  // behind — and a chip nudged with the arrow keys, which fires no pointer
  // event at all.
  const body = js
    .slice(js.indexOf("const tick = () =>"), js.indexOf("const start = "))
    .replace(/\/\/.*$/gm, "");   // the comment explains what it does NOT do
  assert.match(body, /\bmeasure\(\);/, "the loop must re-derive the geometry");
  assert.doesNotMatch(body, /\bpaint\(/, "and not settle for repainting");
  // Focus starts it too: a keyboard move is a move.
  assert.ok(js.includes('container.addEventListener("focusin", start'), "focus must start the loop");
});

test("a captured drag does not stop the loop when the container sees a pointerleave", () => {
  // REGRESSION (2026-09-12): setPointerCapture retargets boundary events to the
  // captured element, so the container gets a pointerleave the instant a drag
  // begins. The loop stopped there and the silhouette stayed at the position
  // the chip started from while the chip went on moving — the substance
  // visibly detaching from its member, which is the one thing this family
  // claims cannot happen.
  assert.match(js, /if \(e\.target !== container \|\| held\) return;/, "a live drag must survive the container's own pointerleave");
  assert.match(js, /const onBlur = \(\) => \{ if \(!held\) stop\(\); \};/, "nor may losing focus end a drag");
  assert.match(js, /const onUp = \(\) => \{[\s\S]*?measure\(\);/, "the release must land the final position");
  assert.match(js, /container\.matches\(":hover"\)/, "and stop only if the pointer actually left");
  for (const ev of ["pointerup", "pointercancel"]) {
    assert.ok(js.includes(`window.addEventListener("${ev}", onUp`), `${ev} must be caught on the window: a drag can end anywhere`);
    assert.ok(js.includes(`window.removeEventListener("${ev}", onUp`), `and released on destroy`);
  }
});
