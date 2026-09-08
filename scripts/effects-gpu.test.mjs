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
  // thing instead: the fragment's output hue is a mix of the two uniforms fed
  // from --sl-accent-default and --sl-accent-depth, and nothing else.
  assert.match(shader, /mix\(look\.depth\.rgb,\s*look\.accent\.rgb/);
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
