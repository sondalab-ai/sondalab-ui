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
  shapeGap,
  weldedMembers,
  filterRegion,
  GOO_CONTRAST,
  GOO_INTERCEPT,
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
  assert.match(effectsJs, /function repaintGooFields\(\)[\s\S]{0,300}handle\.measure\(true\)/,
    "the repaint must ask for a TRUE read: a welded member reports no colour of its own until its paint is handed back");
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
  assert.match(fn, /setAttr\(picture, "x", "0"\)/, "the picture sits at the tile's own origin");
  assert.match(fn, /setAttr\(picture, "y", "0"\)/);
  assert.match(fn, /setAttr\(pattern, "x", String\(shape\.x\)\)/, "the TILE carries the user-space offset");
  assert.match(fn, /preserveAspectRatio", "xMidYMid slice"/, "a letterboxed picture would show the fallback in the bars");
});

test("an image member is measured again once it has decoded", () => {
  // A CSS-sized <img> never changes its box when its bytes arrive, so the
  // ResizeObserver never fires and an undecoded picture would stay a hole.
  assert.match(js, /function awaitImages\(\)/, "there must be a decode gate");
  assert.match(js, /\.decode\(\)\s*\.catch\(/, "a picture that fails to load keeps the fallback fill, it does not throw");
  assert.match(js, /Promise\.all\(pending\)\.then\(\(\) => measure\(true\)\)/, "the gate re-measures, with a true read");
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
  assert.match(js, /setAttr\(face, "fill", isClear\(own\) \? ground : own\)/, "a member's OWN colour is painted as the component painted it, alpha included");
  assert.match(js, /setAttr\(paths\[i \* 2\], "fill", ground\)/, "every member stands on the substance");
});

test("the goo survives a motion preference, and only high contrast refuses it", () => {
  // The goo ANIMATES NOTHING — it is laid out, not played — and the spec's
  // reduced-motion clause is "nothing animates; static material survives". So
  // it is armed BEFORE mount()'s motion guard, on the same reasoning
  // lensRefused() carries: a visitor who asked for less movement did not ask
  // for less material. Its CSS is not gated on data-sl-fx="on" either.
  const effectsJs = readFileSync(resolve(KIT, "effects.js"), "utf8");
  const goo = effectsJs.indexOf("mountGoo(root);");
  const guard = effectsJs.indexOf("if (window.matchMedia(REDUCE).matches && !ignoreReducedMotion) return false;");
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
  assert.match(js, /const onUp = \(\) => \{[\s\S]*?measure\(true\);/, "the release must land the final position");
  assert.match(js, /container\.matches\(":hover"\)/, "and stop only if the pointer actually left");
  for (const ev of ["pointerup", "pointercancel"]) {
    assert.ok(js.includes(`window.addEventListener("${ev}", onUp`), `${ev} must be caught on the window: a drag can end anywhere`);
    assert.ok(js.includes(`window.removeEventListener("${ev}", onUp`), `and released on destroy`);
  }
});

test("shapeGap is the distance between two silhouettes, and zero when they overlap", () => {
  const a = { x: 0, y: 0, w: 40, h: 40 };
  assert.equal(shapeGap(a, { x: 50, y: 0, w: 40, h: 40 }), 10, "side by side");
  assert.equal(shapeGap(a, { x: 0, y: 50, w: 40, h: 40 }), 10, "one above the other");
  assert.equal(shapeGap(a, { x: 30, y: 0, w: 40, h: 40 }), 0, "overlapping is no gap");
  assert.equal(shapeGap(a, { x: 40, y: 40, w: 40, h: 40 }), 0, "touching at a corner");
  // Corner to corner is the diagonal, not either axis alone.
  assert.ok(Math.abs(shapeGap(a, { x: 43, y: 44, w: 10, h: 10 }) - 5) < 1e-9, "3-4-5");
});

test("weldedMembers marks the ones that joined a mass, and only those", () => {
  // A member standing on its own keeps its own border; one that has welded
  // lets the substance carry the edge, because its border would otherwise draw
  // a line straight across the merged shape.
  const sigma = 5;                       // welds across 1.3489 * 5 = 6.74px
  const shapes = [
    { x: 0, y: 0, w: 40, h: 40 },
    { x: 45, y: 0, w: 40, h: 40 },       // 5px away — welded to the first
    { x: 200, y: 0, w: 40, h: 40 },      // alone
  ];
  assert.deepEqual(weldedMembers(shapes, sigma), [true, true, false]);
  assert.deepEqual(weldedMembers([shapes[0]], sigma), [false], "a lone member welds to nothing");
  assert.deepEqual(weldedMembers([], sigma), []);
});

test("weldedMembers uses the same threshold the filter does", () => {
  const shapes = (gap) => [{ x: 0, y: 0, w: 10, h: 10 }, { x: 10 + gap, y: 0, w: 10, h: 10 }];
  const sigma = 5;
  const edge = weldGap(sigma);
  assert.deepEqual(weldedMembers(shapes(edge - 0.01), sigma), [true, true], "just inside the weld");
  assert.deepEqual(weldedMembers(shapes(edge + 0.01), sigma), [false, false], "just outside it");
});

test("a welded member gives up its border, and only by border-image", () => {
  // The liquid's instrument, for the liquid's reason: border-color must stay
  // readable — the author's hover states depend on it, and the substance reads
  // its member's computed paint every frame.
  const rule = css.match(/\.sl-fx-goo__member\.is-goo-welded\s*\{([^}]*)\}/);
  assert.ok(rule, "the welded member must have its own rule");
  assert.match(rule[1], /border-image:/, "the border hides under a border-image");
  assert.doesNotMatch(rule[1], /border-color|border-width|border-style|border-radius|display|opacity/,
    "and nothing else may be taken from the member");
  assert.match(js, /classList\.toggle\("is-goo-welded", welded\[i\]\)/, "the class is per member, per measure");
  assert.match(js, /function unweld\(\)/, "and a torn-down field leaves no trace of it");
  assert.match(js.slice(js.indexOf("destroy()")), /unweld\(\)/, "destroy() must call it");
});

test("an image member's href is written only when it changed", () => {
  // REGRESSION (2026-09-12): paint() runs on every measure(), which while a
  // pointer is in the field is every frame, and re-setting href to the same
  // value restarts the load and the decode in Chrome. A 220x132 PNG decoded
  // per frame froze the renderer for seconds at a time. The JS itself measured
  // 4-10ms, which is what pointed the search at the rendering side rather than
  // at an observer loop (ResizeObserver and MutationObserver callbacks were
  // counted: 0 and 1).
  const fn = js.slice(js.indexOf("function imageFill("), js.indexOf("function paint("));
  assert.match(fn, /setAttr\(picture, "href", img\.currentSrc \|\| img\.src\);/, "href goes through the guard");
  assert.doesNotMatch(fn, /picture\.setAttribute\("href"/, "and is never written directly");
});

test("a welded member hands over its background as well as its border", () => {
  // A member's box is opaque and RECTANGULAR: where two overlap, the one on
  // top covers its neighbour's substance with a hard-cornered rectangle, and
  // the mass reads as boxes stepped over one another rather than as drops
  // merging. Handing the paint to the substance moves that colour boundary
  // inside the filter, where the blur softens it.
  const rule = css.match(/\.sl-fx-goo \.sl-fx-goo__member\.is-goo-welded\s*\{([^}]*)\}/);
  assert.ok(rule, "the rule must be scoped through the container, so it is 0-3-0");
  assert.match(rule[1], /border-image:/, "the border still goes");
  assert.match(rule[1], /background-color:\s*transparent/, "and so does the background");
  assert.doesNotMatch(rule[1], /border-color|border-width|border-radius|display|opacity/,
    "nothing else may be taken from the member");
  assert.doesNotMatch(rule[1], /(?:^|;)\s*color\s*:/, "its text colour is its own");

  // And the colour must survive being handed over: a welded member's computed
  // background-color reads clear from the next frame on, so a naive re-read
  // would fall back to --slfx-goo-fill and turn a coloured chip grey the
  // moment it touched a neighbour.
  // …and the colour must survive being handed over. A welded member reports a
  // clear background-color for as long as the class is on it, so measure()
  // gives every member its paint back BEFORE reading, and re-takes it after.
  // Caching the last colour instead was built first and is subtly wrong: a
  // theme change repaints the field, and the cache hands back the previous
  // theme's colour.
  const body = js.slice(js.indexOf("function measure(restore"), js.indexOf("// The substance is static"));
  const atUnweld = body.indexOf("if (restore) unweld();");
  const atPaint = body.indexOf("paint(fallback, restore);");
  const atToggle = body.indexOf('classList.toggle("is-goo-welded"');
  assert.ok(atUnweld > -1 && atPaint > -1 && atToggle > -1, "measure() must restore, read, then re-take");
  assert.ok(atUnweld < atPaint, "the paint must be handed back before the colours are read");
  assert.ok(atPaint < atToggle, "and taken again only after");
  assert.doesNotMatch(js, /restingFill|WeakMap/, "no cache: a theme change would make it stale");

  // …and NOT on every frame. .sl-btn transitions `background`, so removing and
  // re-adding the class per frame restarted a 120ms transition forever and the
  // button's own hover and leave never arrived.
  const tick = js.slice(js.indexOf("const tick = () =>"), js.indexOf("const start = "));
  assert.match(tick, /\bmeasure\(\);/, "the frame loop must NOT ask for a restore");
  assert.doesNotMatch(tick, /measure\(true\)/);
  assert.match(js, /if \(!restore && el\.classList\.contains\("is-goo-welded"\)\) continue;/,
    "a member that came into the frame welded keeps the face it had when it welded");
});

test("a welded member that is also glass gives up its hairline", () => {
  // border-image reaches the element's own border and nothing else, so the
  // glass pane's ring — which lives on ::after and lights on :hover — went on
  // drawing the outline the border rule exists to remove, and a hovered button
  // in a welded toolbar kept a visible edge.
  const rule = css.match(/\.sl-fx-goo \.sl-fx-glass\.sl-fx-goo__member\.is-goo-welded::after\s*\{([^}]*)\}/);
  assert.ok(rule, "the welded glass member must stand its ring down");
  assert.match(rule[1], /opacity:\s*0/, "the same instrument the liquid's live host uses");
});

test("the loop writes no attribute it would not change", () => {
  // Setting an attribute inside an SVG filter marks the filter dirty and the
  // browser re-rasterises the whole region — 0.1 to 0.6 megapixels of Gaussian
  // blur at device-pixel-ratio 2, measured across the showcase. The loop
  // re-derives every value each frame because a member may have moved, but on
  // a resting hover none of them differ. The JavaScript was never the cost:
  // measure() is 0.138 ms per call on a three-member field.
  assert.match(js, /function setAttr\(el, name, value\) \{\s*if \(el\.getAttribute\(name\) !== value\) el\.setAttribute\(name, value\);/,
    "the guard must compare before writing");

  // Nothing inside measure() or paint() may write directly.
  const hot = js.slice(js.indexOf("function paint("), js.indexOf("// The substance is static"));
  assert.doesNotMatch(hot, /\.setAttribute\(/, "every per-frame write goes through setAttr");

  // The one-time build may: it runs once, on an element not yet in a filter.
  const build = js.slice(js.indexOf("const svg = document.createElementNS"), js.indexOf("function setAttr") + 1 || js.length);
  assert.ok(js.includes('svg.setAttribute("aria-hidden", "true")'), "the field is still hidden from the accessibility tree");
});

test("a form control or a link is refused a field, whatever it is marked with", () => {
  // The owner's ruling (2026-09-12). A control paints its own chrome through
  // layers this family does not own — a glass pane's hairline lives on ::after
  // and in the children glass.css injects — so a welded button went on drawing
  // the outline the substance was meant to replace, while a welded div beside
  // it lost its edge entirely. The two did not look alike, and the control was
  // always the one that looked wrong. Remove the case, not the symptom.
  assert.match(js, /const EXCLUDED = "button, input, select, textarea, a\[href\]";/,
    "the exclusion list is the contract");
  assert.match(js, /\.filter\(\(el\) => !el\.matches\(EXCLUDED\)\)/, "and it filters membership");

  // Every place that walks the members must go through the same filter, or a
  // refused element would still be observed, or still be left with a class.
  const walks = [...js.matchAll(/querySelectorAll\(MEMBERS\)/g)];
  assert.equal(walks.length, 1, `MEMBERS may be queried in exactly one place, got ${walks.length}`);
  assert.match(js.slice(js.indexOf("function collect()")), /querySelectorAll\(MEMBERS\)/, "…and that place is collect()");
  for (const site of ["members = collect();", "for (const el of collect()) el.classList.remove", "for (const el of collect()) ro.observe"]) {
    assert.ok(js.includes(site), `must go through collect(): ${site}`);
  }
});

test("the showcase puts no form control inside a goo field", () => {
  const html = readFileSync(resolve(HERE, "../showcase/effects.html"), "utf8");
  // A member that is a control is inert, so one in the showcase would be a
  // silent no-op the page still claims as a demonstration. The one deliberate
  // exception is the cell that exists to SHOW the refusal, and it says so.
  const members = [...html.matchAll(/<(\w+)([^>]*\bclass="[^"]*\bsl-fx-goo__member\b[^"]*"[^>]*)>/g)];
  assert.ok(members.length >= 8, "the showcase must still demonstrate the family");
  const controls = members.filter(([, tag]) => ["button", "input", "select", "textarea", "a"].includes(tag));
  assert.deepEqual(controls.map((m) => m[1].trim()), [], "a control member is inert, so one here would be a silent no-op the page still claims as a demonstration");
});

test("both families share one goo chain, and the weld constant is derived from it", () => {
  // The liquid's skin and the field weld silhouettes with the same slope, and
  // WELD_K is what that slope implies. Keeping the pair in two files let one
  // be changed without the other, which would leave the weld distance an
  // author binds meaning something else. This asserts the tie: the slope's
  // midpoint must land on alpha 0.5, because 1.3489795 is derived from it.
  assert.equal((0.5 - GOO_INTERCEPT) / GOO_CONTRAST, 0.5, "the slope's midpoint is the level set the weld is measured against");

  const effectsJs = readFileSync(resolve(KIT, "effects.js"), "utf8");
  for (const [file, src] of [["effects.js", effectsJs], ["goo-field.js", js]]) {
    assert.doesNotMatch(src, /^const GOO_(?:CONTRAST|INTERCEPT)\s*=/m, `${file} must import the chain, not redeclare it`);
    assert.match(src, /GOO_CONTRAST[\s\S]{0,400}from "\.\/geom\.js"|from "\.\/geom\.js"[\s\S]{0,400}GOO_CONTRAST/,
      `${file} must take it from geom.js`);
  }
  // …and the geometry with it: one clamp, not two.
  assert.doesNotMatch(effectsJs, /^function cornerPx\(|^function roundedRectPath\(/m,
    "effects.js must not keep its own copy of the radius clamp or the box path");
});

/* ── the drift ────────────────────────────────────────────────────────────── */

/** The balanced block that follows `at`, braces included. */
function blockAt(src, at) {
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error("unbalanced block");
}

test("the filter region follows a member that has moved, so the drift needs no headroom", () => {
  // The whole argument for adding nothing to filterRegion(): measure() rebuilds
  // every shape from the live boxes each frame, so a translated member arrives
  // here already translated. If the region were computed once and padded, a
  // member drifting past its own edge would have its substance cut off along a
  // straight line — the defect §Decision 3b exists to prevent.
  const at = { x: 0, y: 0, w: 100, h: 40 };
  const moved = { ...at, x: at.x + 6, y: at.y - 6 };
  const a = filterRegion([at], 4);
  const b = filterRegion([moved], 4);
  assert.equal(b.x - a.x, 6, "the region tracks the member sideways");
  assert.equal(b.y - a.y, -6, "and vertically");
  assert.equal(b.width, a.width, "without growing");
  assert.equal(b.height, a.height, "in either axis");
});

test("the drift's amplitude is declared, and sized against the weld", () => {
  const drift = css.match(/--slfx-goo-drift:\s*([\d.]+)px/);
  const weld = css.match(/--slfx-goo-weld:\s*([\d.]+)px/);
  assert.ok(drift, "--slfx-goo-drift must have a default, like every other binding this family takes");
  assert.ok(Number(drift[1]) > 0, "a zero amplitude is a drift that does not drift");
  // What the drift is FOR is carrying a pair across the weld distance: the gap
  // between two members swings by twice the amplitude over a cycle, so half
  // the weld is the figure that makes a laid-out neck thin and part.
  assert.ok(2 * Number(drift[1]) <= Number(weld[1]),
    "an amplitude past half the weld makes members read as loose rather than suspended");
});

test("the drift is refused for a motion preference, with no derogation", () => {
  const at = css.search(/\.sl-fx-goo--drift\s+\.sl-fx-goo__member\s*\{/);
  assert.ok(at > 0, "the drift must exist");

  // The rule has to sit INSIDE a no-preference query. Walk out from the rule
  // to the nearest enclosing @media and check it is that one.
  const before = css.slice(0, at);
  const guard = before.lastIndexOf("@media");
  assert.ok(guard > 0, "the drift must be guarded");
  assert.match(css.slice(guard, css.indexOf("{", guard)), /prefers-reduced-motion:\s*no-preference/,
    "a plain no-preference query, so a visitor who asked for less movement gets the static field");
  assert.ok(blockAt(css, guard).includes(".sl-fx-goo--drift"), "and the rule must actually be inside it");

  // NOT the glitch's pattern. That one lets [data-sl-fx-motion="always"] carry
  // an animation through a reduce preference, which exists for a consumer
  // whose glitch is brand. A drifting decoration is not brand, and reaching it
  // would silently widen a derogation its consumer documented as narrow.
  const reduceBlocks = [...css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g)];
  for (const m of reduceBlocks) {
    assert.ok(!blockAt(css, m.index).includes("sl-fx-goo--drift"),
      "the drift must not be listed in a reduce block, which is where the motion derogation applies");
  }
});

test("the drift composes with a transform instead of replacing one", () => {
  const frames = css.match(/@keyframes\s+slfx-goo-drift\s*\{[\s\S]*?\n\}/);
  assert.ok(frames, "the drift's keyframes must exist");
  assert.match(frames[0], /translate:/, "the drift animates the `translate` property");
  assert.doesNotMatch(frames[0], /transform:/,
    "a member may be a liquid host or a pane, and both put a scale on `transform` under the pointer");
});

test("each drifting member gets its own period, not only its own phase", () => {
  const rule = blockAt(css, css.search(/\.sl-fx-goo--drift\s+\.sl-fx-goo__member\s*\{/));
  assert.match(rule, /animation:[^;]*var\(--slfx-i/, "the duration varies with the member's index");
  assert.match(rule, /animation-delay:[^;]*var\(--slfx-i/, "and so does the phase");
  // A shared period with staggered delays walks the same ellipse in formation,
  // which reads as a carousel rather than as suspension.
});

test("both kill switches stop the drift without stripping the member's own chrome", () => {
  const at = css.search(/\.sl-fx-goo__member\s*\{\s*animation:\s*none\s*!important/);
  assert.ok(at > 0, "a rule must reach the member, where the drift lives");
  const selector = css.slice(css.lastIndexOf("}", at) + 1, css.indexOf("{", at));
  assert.match(selector, /high-contrast/, "high contrast stops it");
  assert.match(selector, /data-sl-fx="off"/, "and so does the subtree opt-out");

  // The member is an ordinary card or wrapper. Adding it to the list that also
  // strips box-shadow and filter would take away the elevation the component
  // painted for itself, which is not an effect this layer owns.
  const blanket = css.match(/[^}]*\.sl-fx-goo__field[^{]*\{[^}]*box-shadow:\s*none[^}]*\}/);
  assert.ok(blanket, "the blanket kill rule must still exist");
  assert.ok(!blanket[0].slice(0, blanket[0].indexOf("{")).includes(".sl-fx-goo__member"),
    "the member must not be in it");
});

test("the drift loop carries its own motion refusal, because mountGoo() runs before mount()'s", () => {
  // mountGoo() is deliberately ahead of the guard: the goo animates nothing and
  // refusing it for a motion preference takes away material, not movement. The
  // drift is the exception, so the refusal has to be here. Without it the loop
  // runs forever re-deriving boxes a suppressed animation never moves — a
  // forced layout per frame, invisible, and so not caught by looking.
  const drifts = js.match(/const drifts\s*=[\s\S]{0,200}?;/);
  assert.ok(drifts, "the field must decide once whether it drifts");
  assert.match(drifts[0], /container\.matches\(DRIFT\)/, "the class asks for it");
  assert.match(drifts[0], /matchMedia\(REDUCE\)/, "and the preference can refuse it");
});

test("a field on stage does not stop, and the viewport gate fails open", () => {
  assert.match(js, /const stop\s*=\s*\(\)\s*=>\s*\{\s*if\s*\(!onStage\)\s*halt\(\);?\s*\}/,
    "every reason to stop — a pointer leaving, a drag ending, focus moving — stops nothing while the field is on screen");

  // Marked on stage BEFORE the observer is asked. An IntersectionObserver that
  // never delivers an entry leaves the field drifting rather than frozen, which
  // is the cheaper way to be wrong; the automation tab this layer was debugged
  // in is exactly that environment.
  const arm = js.slice(js.indexOf("let io = null;"));
  const marked = arm.indexOf("onStage = true");
  const observed = arm.indexOf("new IntersectionObserver");
  assert.ok(marked > -1 && observed > marked, "the stage is taken to be occupied before the observer is asked");
  assert.match(js, /io\?\.disconnect\(\)/, "and the observer is torn down with the field");
});

test("the member's index is written by the field, and only where it is read", () => {
  // :nth-child counts against a member's own parent, while collect() sweeps the
  // whole subtree — so one consumer wrapping two members in a layout div would
  // put every member in the same phase bucket and the field would march.
  assert.match(js, /if \(drifts\) for \(let i = 0; i < members\.length; i\+\+\) stampIndex\(members\[i\], i\);/,
    "a field that does not drift is not written to at all");
  assert.match(js, /el\.style\.getPropertyValue\("--slfx-i"\) !== v/,
    "and an unchanged index is not rewritten, like every other write in this file");
  assert.match(js, /el\.style\.removeProperty\("--slfx-i"\)/,
    "a field that is torn down leaves no trace on an element it did not create");
});
