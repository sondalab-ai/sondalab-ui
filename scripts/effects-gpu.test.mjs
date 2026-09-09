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

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;

test("neither the GPU module nor the shader carries a colour literal", () => {
  assert.deepEqual(gpu.match(COLOR_RE) || [], []);
  assert.deepEqual(shader.match(COLOR_RE) || [], []);
});

test("the shader's colour comes from the token uniforms, not from itself", () => {
  // WGSL's way to hardcode a colour is a numeric constructor — `vec3f(.9,.2,.1)`
  // — which no regex can tell apart from geometry. So assert the reachable
  // thing instead: the chrome's palette takes its coloured stops from the two
  // uniforms fed by --sl-accent-default and --sl-accent-depth, and its poles
  // from the two neutral tokens, and nothing else.
  assert.match(shader, /mix\(hi,\s*look\.accent\.rgb/, "the accent must reach the palette");
  assert.match(shader, /mix\(hi,\s*look\.depth\.rgb/, "the depth companion must reach the palette");
  assert.match(shader, /fn brightToken\(\)[\s\S]*look\.sheen\.rgb[\s\S]*look\.ground\.rgb/, "the poles come from the neutral tokens");
});

// The two guards are executable here, so execute them. Node has a `navigator`
// global without a `gpu` member, which is the first guard's exact condition;
// and `vgpu` is an optional peer dependency that need not be installed, so a
// faked capability drives the dynamic import into the second guard's catch.

test("bootField returns null when WebGPU is absent", async () => {
  const { bootField } = await import(pathToFileURL(GPU).href);
  const result = await bootField({ canvas: {}, rects: () => [], tokens: {} });
  assert.equal(result, null, "no WebGPU must leave the page exactly as it is");
});

test("bootField returns null when the device refuses or vgpu is missing", async () => {
  const { bootField } = await import(pathToFileURL(GPU).href);
  const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { gpu: {} }, configurable: true });
  try {
    const result = await bootField({ canvas: {}, rects: () => [], tokens: {} });
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

test("the chrome welds the liquid's drop onto the box, the way the skin does", () => {
  // The skin (effects.js) is the host's rounded box plus a circle at the
  // pointer, merged by a goo filter. The chrome must describe the same
  // silhouette — a smooth union of the same two shapes about the same point —
  // or the ring and the skin diverge. The Gaussian displacement the old
  // filter used has no counterpart any more and must not survive here.
  assert.doesNotMatch(shader, /dentAt|displacement/i, "the displacement-era geometry must be gone");
  assert.match(shader, /fn smin\(a: f32, b: f32, k: f32\)/, "the union must be a smooth minimum");
  assert.match(shader, /fn edgeAt\(i: u32, p: vec2f\)[\s\S]*?smin\(box, blob, /, "edgeAt must weld the box and the drop");
  assert.match(shader, /length\(p - drop\.xy \* look\.res\) - r/, "the drop is a circle about the reported centre");
  // The packer feeds the drop's radius and the neck width, and moves the
  // centre only while a drop is live.
  assert.match(gpu, /q\[2\] = e\.blend \|\| 0;\s*q\[3\] = e\.dropR \|\| 0;/, "params.z is the blend, params.w the drop radius");
  assert.match(gpu, /if \(q\[3\] !== 0\) \{\s*drop\[0\] = e\.dropX/, "the centre follows the live drop");
});

test("every WGSL array length and sentinel agrees with MAX_RECTS", async () => {
  // The packer does not bound the index: a bump of MAX_RECTS in one file and
  // not the others writes past a declared array, or turns the shader's
  // "no element" sentinel into a valid index. Extract the shader and check
  // every `array<vec4f, N>` and every `Nu` sentinel against the constant.
  const { MAX_RECTS } = await import(pathToFileURL(GPU).href);
  const { SHADER } = await import(pathToFileURL(resolve(KIT, "effects-shader.js")).href);
  const arrays = [...SHADER.matchAll(/array<vec4f,\s*(\d+)>/g)].map((m) => Number(m[1]));
  assert.ok(arrays.length >= 3, "the shader must declare its per-element arrays");
  for (const n of arrays) assert.equal(n, MAX_RECTS, `array length ${n} != MAX_RECTS`);
  const sentinels = [...SHADER.matchAll(/=\s*(\d+)u;/g)].map((m) => Number(m[1])).filter((n) => n > 1);
  assert.ok(sentinels.length >= 2, "the shader's no-element sentinels must be present");
  for (const n of sentinels) assert.equal(n, MAX_RECTS, `sentinel ${n} != MAX_RECTS`);
  assert.equal(SHADER.match(/rectCount/g).length > 0, true);
});
