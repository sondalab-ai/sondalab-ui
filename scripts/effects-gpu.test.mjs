import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const GPU = resolve(KIT, "effects-gpu.js");
const gpu = readFileSync(GPU, "utf8");
const shader = readFileSync(resolve(KIT, "effects-shader.js"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(KIT, "package.json"), "utf8"));
const js = readFileSync(resolve(KIT, "effects.js"), "utf8");
const css = readFileSync(resolve(KIT, "glass.css"), "utf8");
const css2 = readFileSync(resolve(KIT, "effects.css"), "utf8");

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;

test("neither the GPU module nor the shader carries a colour literal", () => {
  assert.deepEqual(gpu.match(COLOR_RE) || [], []);
  assert.deepEqual(shader.match(COLOR_RE) || [], []);
});

test("the shader's colour comes from the token uniforms, not from itself", () => {
  // WGSL's way to hardcode a colour is a numeric constructor — `vec3f(.9,.2,.1)`
  // — which no regex can tell apart from geometry. So assert the reachable
  // thing instead: every channel of the light traces back to a uniform fed by
  // a token, and the only thing that decides between the ink and the paper
  // pole is a flag read off the canvas token.
  assert.match(shader, /let cool = mix\(look\.sheen\.rgb, look\.depth\.rgb, paper\);/, "the neutral and the depth pole are both tokens");
  assert.match(shader, /mix\(cool, look\.accent\.rgb,/, "the accent must warm the light");
  assert.match(shader, /let paper = look\.flags\.y;/, "paper vs ink is a uniform, not a literal");
  assert.match(gpu, /look\.flags = \[look\.flags\[0\], isPaper\(tokens\.canvas\)/, "and it is read off the canvas token");
});

// The two guards are executable here, so execute them. Node has a `navigator`
// global without a `gpu` member, which is the first guard's exact condition;
// and `vgpu` is an optional peer dependency that need not be installed, so a
// faked capability drives the dynamic import into the second guard's catch.

test("bootLight returns null when WebGPU is absent", async () => {
  const { bootLight } = await import(pathToFileURL(GPU).href);
  const result = await bootLight({ canvas: {}, state: () => null, tokens: {} });
  assert.equal(result, null, "no WebGPU must leave the page exactly as it is");
});

test("bootLight returns null when the device refuses or vgpu is missing", async () => {
  const { bootLight } = await import(pathToFileURL(GPU).href);
  const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { gpu: {} }, configurable: true });
  try {
    const result = await bootLight({ canvas: {}, state: () => null, tokens: {} });
    assert.equal(result, null, "a refused adapter or a missing vgpu must be absorbed, not thrown");
  } finally {
    if (saved) Object.defineProperty(globalThis, "navigator", saved);
    else delete globalThis.navigator;
  }
});

test("vgpu is an optional peer dependency, never installed by default", () => {
  // optionalDependencies is not opt-in: npm installs those by default, and
  // "optional" only tolerates an install failure. A peer dependency marked
  // optional in peerDependenciesMeta is the shape that actually stays out of
  // a consumer's install unless they ask for it.
  assert.ok(!pkg.dependencies, "the kit stays free of hard runtime dependencies");
  assert.ok(!pkg.optionalDependencies, "vgpu must not be an optionalDependency — npm installs those by default");
  assert.equal(pkg.peerDependencies?.vgpu, "^0.3.1", "vgpu must be declared as a peer dependency");
  assert.equal(pkg.peerDependenciesMeta?.vgpu?.optional, true, "the vgpu peer must be marked optional");
});

test("the shader ships as an inline template string, not through a loader", () => {
  assert.match(shader, /export const SHADER = `/);
});

test("the light is confined to the element it is drawn in", () => {
  // The owner's ruling on this tier: nothing may leave the element's box. The
  // old field drew from a canvas above the whole page and haloed everything it
  // tracked. Now one silhouette is both the shape and the mask — the same SDF
  // that curves the corners zeroes the alpha outside them — so there is no
  // clip to escape and no container to be truncated by.
  assert.match(shader, /let inside = 1\.0 - smoothstep\(-1\.0, 0\.0, d\);/, "the silhouette must be the mask");
  assert.match(shader, /if \(inside <= 0\.001\) \{ return vec4f\(0\.0\); \}/, "outside it, nothing is written");
  assert.doesNotMatch(shader, /array<vec4f/, "the per-page element arrays must be gone");
  assert.doesNotMatch(gpu, /document\.body\.appendChild/, "the canvas is never parented to the page");
  assert.doesNotMatch(gpu, /position:\s*(?:absolute|fixed)/, "the GPU module writes no page-level geometry");
  // The host is a backdrop root, so only a CHILD composites over the blur.
  assert.match(js, /el\.appendChild\(lightCanvas\)/, "the canvas is a child of the lit host");
});

test("one shared canvas is moved; only a pane with a backdrop gets its own", () => {
  // A WebGPU device plus surface per pointer entry is far heavier than moving
  // an element, so the pointer light still rides ONE canvas, re-parented as it
  // goes — the same single-instance discipline the liquid's skin has, with the
  // device, the surface and the pipeline built once.
  //
  // The exception, added 2026-09-11: a pane that declares a backdrop has a
  // MATERIAL — the bend, the Fresnel rim, the glare — which exists whether or
  // not a pointer is on it, and a canvas that visits one element at a time
  // cannot hold thirty of those at rest. Such a pane gets a canvas of its own,
  // painted once and repainted only when its box or the theme moves. A pane
  // with nothing declared still gets none: the shader leaves its canvas empty,
  // so a surface there would cost a swapchain to paint nothing.
  assert.equal(
    (js.match(/className = "sl-fx-glass__lit"/g) || []).length, 1,
    "effects.js makes exactly one shared light canvas",
  );
  assert.doesNotMatch(js, /body\.appendChild\(canvas\)/, "the light canvas is never parented to the page");
  assert.equal(
    (gpu.match(/createElement\(/g) || []).length, 1,
    "the GPU module creates elements in one place only — track()",
  );
  assert.match(gpu, /cv\.className = "sl-fx-glass__lit";/,
    "a pane's own canvas is the same kind of element as the shared one");
  assert.match(gpu, /if \(!anchor \|\| tex === blankTex\) return false;/,
    "track refuses a pane with no backdrop to bend");
  const release = js.slice(js.indexOf("function setPaneLive("), js.indexOf("function onPanePointer("));
  assert.match(release, /if \(lightCanvas\?\.parentElement === paneEl\) lightCanvas\.remove\(\);/,
    "leaving a host must detach the shared canvas, and only if it held it");
  assert.match(release, /if \(lightCanvas && !ownsLight\.has\(el\)\) el\.appendChild\(lightCanvas\);/,
    "a pane that owns a canvas is never handed the shared one as well");
  // Tier 2 rides the pane's self-stopping loop, so an idle page runs no frames.
  assert.doesNotMatch(gpu, /frameLoop/, "the GPU module must not run a loop of its own");
  assert.match(js, /paneGeom\.lit = paneLit;\s*light\?\.draw\(\);/, "one GPU frame per pane tick");
  // The material is static: nothing may repaint a tracked pane per frame.
  const draw = gpu.slice(gpu.indexOf("function draw() {"));
  assert.doesNotMatch(draw.slice(0, draw.indexOf("\n    }")), /repaint\(\)/,
    "the pointer frame must not sweep every tracked pane");
});

test("a pane at rest keeps its material and loses its light", () => {
  // AC-33 asks an element at rest to carry no LIGHT. A refraction is not
  // light — it is what the glass is made of — so presence gates the pointer
  // terms and not the glass branch. A pane with nothing declared has no
  // material either, and still returns nothing at all.
  assert.match(shader, /if \(presence <= 0\.001 && has < 0\.5\) \{ return vec4f\(0\.0\); \}/,
    "presence alone no longer kills the frame; it kills it only with no backdrop");
  assert.match(shader, /let lit = \(surface \+ specular \+ rim\) \* inside \* presence \* breath;/,
    "every light term is scaled by presence, so at rest they contribute nothing");
  // And the rest paint puts the pointer outside the pane, so even the pool's
  // Gaussian tail cannot reach in.
  assert.match(js, /x: -r\.width,\s*\n\s*y: -r\.height,\s*\n\s*lit: 0,/,
    "the rest geometry parks the pointer outside the box");
});

test("refraction lives on the edge band, and samples no backdrop", () => {
  // The owner's refraction: the three channels leave the glass at slightly
  // different angles, so each samples the pool of light from a slightly
  // different place. Scaled by the edge band, so the middle of a pane bends
  // nothing. Nothing samples the page — the host carries backdrop-filter and
  // is therefore a backdrop root, so this canvas cannot read what is behind
  // it even in principle, and a lens over the label was refused outright.
  assert.match(shader, /let sep = DISPERSE \* band;/, "the separation is scaled by the edge band");
  assert.match(shader, /let lr = pool\(p \+ grad \* sep, reach\);/, "red samples one side of the normal");
  assert.match(shader, /let lb = pool\(p - grad \* sep, reach\);/, "blue samples the other");
  assert.match(shader, /let lg = pool\(p, reach\);/, "green stays on the surface");
  // It used to read: "the shader reads no texture, so it reads no backdrop".
  // That encoded the old ruling — a canvas cannot read the DOM beneath it — and
  // the ruling was superseded on 2026-09-11 by the declared backdrop: a surface
  // names what lies behind a region with --slfx-backdrop and the pane bends
  // THAT. The document is still never read, which is the part worth asserting.
  const samples = [...shader.matchAll(/textureSample\w*\(\s*(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(samples)], ["backTex"],
    `the only texture is the declared backdrop, got ${JSON.stringify([...new Set(samples)])}`);
  // And it is sampled UNCONDITIONALLY, then mixed by the flag — the opposite of
  // where this started. Sampling from inside `if (look.glass.w > 0.5)` cost a
  // day: vgpu's reflection is usage-based, so a binding reached only from a
  // branch is not in the pipeline at all and effect() throws "Binding
  // 'backSampler' does not exist in 'effect'" before a pixel is ever drawn.
  // textureSample in non-uniform control flow is also undefined in WGSL, which
  // is why the sampling has to sit above the uv-dependent early returns too.
  const fs = shader.slice(shader.indexOf("fn fs("));
  const firstSample = fs.indexOf("textureSample");
  const firstUvReturn = fs.indexOf("if (inside <= 0.001)");
  assert.ok(firstSample > 0 && firstUvReturn > 0, "both landmarks are present");
  assert.ok(firstSample < firstUvReturn,
    "the backdrop is sampled before any return that depends on uv");
  assert.equal(/if \([^)]*glass\.w[^)]*\)\s*\{[^}]*textureSample/s.test(fs), false,
    "no textureSample sits inside the backdrop flag's branch");

  // band is the only thing that turns the separation on, and it is zero away
  // from the edge — so a pixel in the middle of the pane gets one sample.
  assert.match(shader, /let band = 1\.0 - smoothstep\(0\.0, hw, abs\(d\)\);/);
});

test("the tint has one home, and the GPU only perturbs what CSS paints", () => {
  // The gap to the references was never refraction — liqui-glass's own
  // __refract layer changes 45 pixels of 114 704 and does not displace the
  // backdrop at all, measured in this repo on 2026-09-11. What it does have is
  // a tint that is DARK and near the page's ink (glass-studio ships a fully
  // transparent one), and a variant rule that overrides the tint rather than
  // painting over the glass. One knob mixing straight to the accent gave a
  // slab of coloured plastic, which is what the owner was seeing.
  // ONE material, and it is CSS's. The shader tinted too until 2026-09-11,
  // which meant two knobs for one quantity: a primary rendered grey with its
  // accent tint fully computed in a layer the shader painted over.
  assert.doesNotMatch(shader, /mix\(glass, look\.ground\.rgb/, "the shader does not tint the material");
  assert.doesNotMatch(shader, /mix\(glass, look\.accent\.rgb/, "nor does it paint the variant's accent");
  // The densities live in glass.css and are SOLVED, not chosen: lab/_profile.py
  // reads the reference capture and ours down the pane's padding band, and
  // these are the values that put the two within ~2 luminance of each other.
  assert.match(css, /--slg-tint-a, 18%/, "the tint density lives in glass.css");
  // The specular's own alphas are gone with it: a linear white wash from the
  // top edge down is the glossy button of 2004, whatever a profile says.
  assert.doesNotMatch(css, /--slg-spec-a/, "no gloss band survives");
  assert.match(css, /--slg-accent-a, 0%/, "and so does the variant's accent share");
  // A LENS STANDS THE GROUND TINT DOWN, NOT AWAY (2026-09-12). It went to zero,
  // and on paper a ghost pane over a dark region then left the theme's dark ink
  // on a dark backdrop: measured off the showcase's telemetry substrate, 2.84:1
  // where WCAG AA asks 4.5. A lensed PRIMARY was fine at 5.98 because its
  // accent share survives the lens; a ghost has no share, so it had nothing at
  // all between the page and its label. The floor reads 5.35 on paper and
  // 10.69 on ink. It is a legibility figure, so it may move, but not to zero:
  // a surface that wants the bare window back sets --slg-tint-lens itself and
  // owns the contrast.
  const lensed = css.match(/\.sl-glass\.is-lensed \.sl-glass__tint \{[^}]*\}/);
  assert.ok(lensed, "the lensed tint rule must exist");
  assert.doesNotMatch(lensed[0], /--slg-tint-a:\s*0%/, "a lensed pane may not drop its ground tint to zero");
  assert.match(lensed[0], /--slg-tint-lens/, "the floor is one named property a surface can rebind");
  // An earlier version of this test asserted the opposite — that nothing may
  // tint toward the canvas, because a light theme would turn into a white
  // frost. That rule was invented here, not read off a card: liqui-glass's own
  // LIGHT tint is a white wash at 0.48. What separates it from the
  // od-glassmorphism negative reference is density and the frost beneath it,
  // and those are what the gates below measure.
  // What the GPU layer emits is the DIFFERENCE the bend makes, so a pane whose
  // backdrop is flat behind it emits nothing and the CSS material shows through.
  assert.match(shader, /let delta = glass - straight\.rgb;/, "the output is a perturbation");
  assert.match(shader, /let straight = textureSample\(backTex, backSampler, base\);/,
    "which needs the unbent sample as well");
});

test("the rim is top-weighted, not a ring round the perimeter", () => {
  // liqui-glass's rim is an inset shadow on the TOP edge plus a weaker 1px
  // side pair and nothing along the bottom: light arriving from above. The
  // same Fresnel term applied evenly reads as a border, which is what this
  // did before.
  assert.match(shader, /let up = clamp\(-grad\.y, 0\.0, 1\.0\);/,
    "up is where the outward normal points at the sky");
  assert.match(shader, /let facing_up = mix\(1\.0, up, clamp\(look\.tone\.y, 0\.0, 1\.0\)\);/,
    "the weighting is a parameter, so a uniform ring is still reachable");
  assert.match(shader, /let fres = pow\(1\.0 - t, 3\.0\) \* clamp\(look\.glass\.z \/ 100\.0, 0\.0, 1\.0\) \* facing_up;/,
    "the Fresnel term carries the weighting");
});

const lensSrc = readFileSync(resolve(KIT, "glass-lens.js"), "utf8");

test("the lens filters the element itself, never a panel over it", () => {
  // The whole point of the shape: backdrop-filter reaches only what is BEHIND
  // an element, so filtering the element leaves its own label untouched and
  // AC-25 holds by construction. The reference implementation puts the filter
  // on a panel it creates and drags; a panel over a button refracts the
  // button's label along with the backdrop, and re-parenting that panel makes
  // it jump on the first pointer move, because its drag code mixes viewport
  // coordinates with offset-parent ones.
  assert.match(lensSrc, /el\.style\.backdropFilter =/, "the filter goes on the element");
  // Read the CODE, not the prose: this file explains at length why it does not
  // take the reference's panel, and an earlier version of this assertion failed
  // on the word "drag" inside that explanation.
  const code = lensSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\.container\b/, "no panel of our own is ever created");
  assert.doesNotMatch(code, /addEventListener\(\s*["'](?:mouse|pointer)/,
    "and no drag comes with it");
});

test("the displacement map is a data URI, and the numbers are not re-derived", () => {
  // feImage href="#id" is silently ignored in Chrome; only the inline form
  // displaces, which is why an earlier attempt rendered nothing at all.
  assert.match(lensSrc, /feImage\.setAttribute\("href", href\)/, "the map is inlined");
  assert.match(lensSrc, /canvas\.toDataURL\(\)/, "built on a canvas, handed over as a data URI");
  // A hand rewrite of the same idea applied but never displaced. These three
  // are the parts that were got wrong, so they are pinned.
  assert.match(lensSrc, /maxScale \*= 0\.5;/, "his normalisation");
  // The cap itself is what this pins, not the expression that feeds it. Since
  // 2026-09-12 the number may also come from the element, as --slg-lens-reach,
  // because how hard a surface bends is a property of that surface: the aurora's
  // hosts raise it to 18px, where the light behind the pane is visibly gathered
  // and parted, and a plain pane keeps the material's own 6. What must not come
  // back is an UNCAPPED scale, which grows with the box and turned a wide card
  // into a wave.
  assert.match(lensSrc, /const capped = Math\.min\(scale, cap\);/,
    "the bend is capped in pixels: a card must not bend six times harder than a button for being wider");
  assert.match(lensSrc, /const asking = Number\.isFinite\(asked\) \? asked : reach;/,
    "the element's own figure where it declares one, the argument otherwise");
  assert.match(lensSrc, /const cap = Math\.min\(asking, Math\.min\(w, h\) \/ 6\);/,
    "and the box caps it too, so a few pixels stay few relative to the pane");
  assert.match(lensSrc, /getComputedStyle\(el\)\.getPropertyValue\("--slg-lens-reach"\)/,
    "the cap is readable from the element, and re-read whenever the box changes");
  assert.ok(
    lensSrc.indexOf('getPropertyValue("--slg-lens-reach")') < lensSrc.indexOf("const capped ="),
    "read the property before capping with it, not after",
  );
  assert.match(lensSrc, /dispG\.setAttribute\("scale", String\(capped\)\)/,
    "scale derived from the measured maximum displacement, then capped");
  // The prism: three displacements of the same map at different scales, in the
  // ratio of glass-studio's IOR triple, added back together. One displacement
  // moves every colour the same distance, which is a lens with no glass in it.
  // Red bends least, blue most — glass-studio's IOR triple is still the model.
  // What changed on 2026-09-12 is that the SEPARATION is a pixel budget rather
  // than a fraction of the bend: the bend is capped for looks, so a fraction of
  // it grew with the cap, and at the aurora's 18px cap the split reached 13px,
  // which on a line of text behind a pane reads as a broken render and was
  // reported as one. The cap decides how far light bends, not how far apart its
  // colours land.
  // 0.24 is the 4.3px separation the prism was fitted at on lab/1t and lab/1v,
  // back when the cap was 6 and the split was a fraction of it. The first
  // version of this line used 0.12 and quietly halved the prism.
  // The 0.24 is the budget; where the number comes from is the surface's, so
  // the assertion is about the arithmetic and the default, not the spelling.
  assert.match(lensSrc, /\* 0\.24;/, "the split is a pixel budget, at the fitted fringe");
  assert.match(lensSrc, /Number\.isFinite\(askedSplit\) \? askedSplit : disperse/,
    "and a surface may ask for a wider prism, with the fitted figure as the fallback");
  assert.match(lensSrc, /getPropertyValue\("--slg-lens-disperse"\)/, "through CSS, like --slg-lens-reach");
  assert.match(lensSrc, /capped - split \/ 2/, "red bends less");
  assert.match(lensSrc, /capped \+ split \/ 2/, "blue bends more");
  assert.doesNotMatch(lensSrc, /0\.02 \* disperse/, "and it no longer scales with the cap");
  assert.match(lensSrc, /operator", "arithmetic"/, "and the channels are added, not blended");
  assert.match(lensSrc, /roundedRectSDF\(ix, iy, 0\.3, 0\.2, 0\.6\)/, "his SDF, his numbers");
});

// 2026-09-12: the BOX caps the bend too, at a sixth of its shorter side. The
// aurora's hosts ask for 18px, which is a tenth of a card's height and most of
// a button's: at the latter the filter sampled outside its own region and the
// pane rendered a flat grey slab, with a wider button shredding the text behind
// it. An earlier attempt at this removed the lens from small panes instead —
// that was a design decision, taken without being asked, and reverted.
test("the box caps the bend, and the lens stays bound whatever the size", () => {
  assert.match(lensSrc, /Math\.min\(asking, Math\.min\(w, h\) \/ 6\)/, "a sixth of the shorter side");
  assert.doesNotMatch(lensSrc, /tooSmall/, "no size refuses the lens outright");
});

// A backdrop-filter inside a Backdrop Root gets an EMPTY backdrop, and a glass
// host is one — `isolation: isolate` alone is enough, and that isolation is
// what keeps the material under the host's label, so it cannot be given up.
// Isolated by subtraction on the showcase's dialog: the button stayed grey at
// displacement 0, at cap 5, with the region grown 24px a side, at 44px tall,
// and with the ancestor's own lens removed; it rendered only when the ancestor
// dropped its lens AND its isolation together. So the inner lens refuses.
test("a lens refuses inside a glass ancestor, where it could only paint grey", () => {
  assert.match(
    lensSrc, /el\.parentElement\?\.closest\("\.sl-glass, \.sl-fx-glass"\)/,
    "an ancestor glass host is checked, and the element itself is not (it is one)",
  );
  // Before anything is built: a refusal that has already appended an <svg> or
  // marked the element leaks both.
  assert.ok(
    lensSrc.indexOf('closest(".sl-glass') < lensSrc.indexOf("const svg ="),
    "and it refuses before it builds anything",
  );
});

test("the lens costs nothing per frame, and refuses where it cannot work", () => {
  // An element and its backdrop scroll together, so nothing new passes behind
  // it and there is nothing to recompute. The map is rebuilt only when the box
  // changes size.
  assert.doesNotMatch(lensSrc, /requestAnimationFrame|setInterval/, "no loop of any kind");
  assert.match(lensSrc, /if \(key === last\) return;/, "a rebuild is skipped unless the box changed");
  assert.match(lensSrc, /CSS\.supports\("backdrop-filter", "url\(#x\)"\)/,
    "feature-detected, so Safari falls through to the CSS material");
  assert.match(lensSrc, /Copyright \(c\) 2025 Shu Ding/, "MIT attribution travels with the code");
});

test("high contrast takes the lens away, and reduced motion does not", () => {
  // Two different refusals, and conflating them would be wrong in both
  // directions. High contrast exists so what is behind a surface does not
  // interfere with what is on it, and a lens deforming the text behind a
  // button is exactly that. Reduced motion is about movement: a lens does not
  // animate, does not redraw on scroll and is a static property of a surface,
  // so a visitor who asked for less movement has not asked for less material.
  assert.match(js, /function lensRefused\(\)/, "the lens has its own condition");
  assert.match(js, /data-sl-theme"\) === "high-contrast"/, "which is high contrast");
  const body = js.slice(js.indexOf("function lensRefused()"), js.indexOf("function armLenses"));
  assert.doesNotMatch(body, /REDUCE|reduced-motion/, "and is not the shared suppressed() test");
  assert.match(js, /if \(lensRefused\(\)\) return;/, "arming refuses under it");
  // A kill switch that reads its condition once is not a kill switch: a visitor
  // can switch theme long after mount ran. Verified live on the showcase --
  // 28 lenses, 0 under high contrast, 28 again on the way back.
  assert.match(js, /attributeFilter: \["data-sl-theme"\]/, "and it follows the theme");
  assert.match(js, /function dropLenses\(\)/, "with a way to take them all back");
});

test("the pane's hover has mass, and does not invalidate the lens", () => {
  // The owner: a button should swell slightly under the pointer with a light
  // bounce, and settle back the same way. It is a TRANSFORM: no layout, and --
  // the part that matters -- the border box does not change, so the lens's
  // displacement map stays valid. Animating width or padding would rebuild a
  // canvas every frame.
  assert.match(css2, /\.sl-fx-glass--pane:hover:not\(:disabled\),/);
  assert.match(css2, /transform: scale\(var\(--slfx-pane-swell, 1\.03\)\);/,
    "three percent: seen, without the row around it moving");
  assert.match(css2, /cubic-bezier\(0\.34, 1\.12, 0\.36, 1\)/,
    "the bounce is a gentle overshooting curve, not a keyframe that would restart on a re-entry");
  assert.match(css2, /transition: transform 420ms cubic-bezier\(0\.22, 0\.61, 0\.28, 1\)/,
    "and the way out is slower still, with no overshoot at all");
  assert.match(css2, /\.sl-fx-glass--pane:active:not\(:disabled\) \{[\s\S]{0,400}?transform: scale\(calc\(1 - \(var\(--slfx-pane-swell, 1\.03\) - 1\) \/ 3\)\);/,
    "a press goes the other way, and without the overshoot");
  const guard = css2.slice(0, css2.indexOf("transform: scale(var(--slfx-pane-swell"));
  assert.ok(guard.lastIndexOf("@media (prefers-reduced-motion: no-preference)") >
            guard.lastIndexOf("@media (prefers-reduced-motion: reduce)"),
    "and all of it sits inside the no-preference guard");
});

test("the swell is a knob, so a wrapper that scales the pane can stand it down", () => {
  // Measured on sondalab-site: the hover swell was moved onto a wrapper that
  // holds the pane AND its seated glow, so both grow about one centre -- and
  // the kit's own scale then COMPOSED with the wrapper's instead of agreeing
  // with it. 1.03 x 1.03 = 1.0609 put the curtains 34.1px wider than the card
  // they are clipped to. The site's only recourse was `transform: none
  // !important` on a kit internal, which is the signal that the kit was
  // missing a knob.
  //
  // The knob has to be READ WITH A FALLBACK and never DECLARED on the pane or
  // the glow: a custom property set on the wrapper inherits to both, but a
  // declaration on either would shadow it and be unreachable from there. This
  // is the same pitfall an inversion band sets for a colour var.
  assert.ok(!/\.sl-fx-glass--pane[^{]*\{[^}]*--slfx-pane-swell:/.test(css2),
    "no default is declared on the pane, or a wrapper could not reach it");
  assert.ok(!/\.sl-fx-aurora__glow[^{]*\{[^}]*--slfx-pane-swell:/.test(css2),
    "nor on the glow, for the same reason");
  const uses = css2.match(/var\(--slfx-pane-swell, 1\.03\)/g) ?? [];
  assert.equal(uses.length, 4,
    "all four states read it: the pane's swell and press, and the glow's mirror of each");
  // 1.03 -> 0.99 and 1 -> 1: one declaration governs both states, so standing
  // the swell down cannot leave a press behind.
  const press = (swell) => 1 - (swell - 1) / 3;
  assert.ok(Math.abs(press(1.03) - 0.99) < 1e-12, "the press is the swell's third, the other way");
  assert.equal(press(1), 1, "and a cancelled swell cancels the press with it");
});

test("the lens's frost is animatable, so glass can breathe", () => {
  // The owner: disperse 60 but with a VARIABLE blur, everything very dynamic.
  // A literal in the backdrop-filter chain cannot be animated from CSS; a
  // var() with the literal as its fallback can, once @property registers it so
  // a keyframe interpolates instead of snapping. Measured on lab/1v: the
  // computed chain reads blur(1.7px) half-way through a 0.2px..3.2px keyframe.
  assert.match(lensSrc, /blur\(var\(--slg-lens-blur, \$\{blur\}px\)\)/, "blur is a var with the number as fallback");
  assert.match(lensSrc, /saturate\(var\(--slg-lens-sat, \$\{saturate\}\)\)/, "and so is saturation");
  assert.match(css, /@property --slg-lens-blur \{ syntax: "<length>"; inherits: true;/, "registered, inheriting");
  assert.match(css, /@property --slg-lens-sat\s+\{ syntax: "<number>"; inherits: true;/);
});
