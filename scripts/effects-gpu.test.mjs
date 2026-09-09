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

test("exactly one canvas exists, and it is moved rather than multiplied", () => {
  // A WebGPU device plus surface per pointer entry is far heavier than moving
  // an element, and a leaked context per host would exhaust them. One canvas
  // is created at boot and re-parented, the same single-instance discipline
  // the liquid's skin has — so the device, the surface and the pipeline are
  // built once and never per element.
  // One canvas in the DOM, not one canvas in the file: the refraction map is
  // drawn on a second, offscreen canvas that is never parented anywhere.
  assert.equal(
    (js.match(/className = "sl-fx-glass__lit"/g) || []).length, 1,
    "exactly one element is ever made the light canvas",
  );
  assert.doesNotMatch(js, /appendChild\(cv\)|body\.appendChild\(canvas\)/, "no canvas but the light one enters the document");
  assert.doesNotMatch(gpu, /createElement/, "the GPU module creates no element of its own");
  const release = js.slice(js.indexOf("function setPaneLive("), js.indexOf("function onPanePointer("));
  assert.match(release, /lightCanvas\?\.remove\(\);/, "leaving a host must detach the canvas");
  assert.match(release, /if \(lightCanvas\) el\.appendChild\(lightCanvas\);/, "entering one must attach it");
  // Tier 2 rides the pane's self-stopping loop, so an idle page runs no frames.
  assert.doesNotMatch(gpu, /frameLoop/, "the GPU module must not run a loop of its own");
  assert.match(js, /paneGeom\.lit = paneLit;\s*light\?\.draw\(\);/, "one GPU frame per pane tick");
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
  assert.doesNotMatch(shader, /textureSample|textureLoad/, "the shader reads no texture, so it reads no backdrop");
  // band is the only thing that turns the separation on, and it is zero away
  // from the edge — so a pixel in the middle of the pane gets one sample.
  assert.match(shader, /let band = 1\.0 - smoothstep\(0\.0, hw, abs\(d\)\);/);
});
