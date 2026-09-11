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
  assert.match(css, /--slg-tint-a, 14%/, "the tint density lives in glass.css");
  assert.match(css, /--slg-accent-a, 0%/, "and so does the variant's accent share");
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
