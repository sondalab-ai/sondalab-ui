import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const gpu = readFileSync(resolve(KIT, "effects-gpu.js"), "utf8");
const shader = readFileSync(resolve(KIT, "effects-shader.js"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(KIT, "package.json"), "utf8"));

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\([^)]*\)/g;

test("neither the GPU module nor the shader carries a colour literal", () => {
  assert.deepEqual(gpu.match(COLOR_RE) || [], []);
  assert.deepEqual(shader.match(COLOR_RE) || [], []);
});

test("the boot is double-guarded — capability AND a try/catch around init", () => {
  assert.match(gpu, /'gpu' in navigator|"gpu" in navigator/);
  assert.match(gpu, /try\s*\{[\s\S]*await import\("vgpu"\)[\s\S]*\}\s*catch/);
});

test("vgpu is optional, never a hard dependency", () => {
  assert.ok(pkg.optionalDependencies?.vgpu, "vgpu must be an optionalDependency");
  assert.ok(!pkg.dependencies, "the kit stays free of hard runtime dependencies");
});

test("the shader ships as an inline template string, not through a loader", () => {
  assert.match(shader, /export const SHADER = `/);
});
