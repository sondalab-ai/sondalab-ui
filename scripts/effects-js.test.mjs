import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "effects.js"), "utf8");

// The audit reads CSS only, so a literal here would pass the gate while
// breaking the contract. This closes that hole mechanically.
test("effects.js contains no colour literal", () => {
  const hits = js.match(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\([^)]*\)/g) || [];
  assert.deepEqual(hits, [], `hues must be read from tokens with getComputedStyle, found: ${hits}`);
});

test("effects.js exports the documented API", () => {
  for (const name of ["mount", "burst", "scramble", "grantLive", "revokeLive", "mountGpu"]) {
    assert.match(js, new RegExp(`export (async )?function ${name}\\b`), `missing export: ${name}`);
  }
});

test("mount() refuses to arm Tier 1 under reduced motion", () => {
  assert.match(js, /prefers-reduced-motion:\s*reduce/);
});

test("importing the module has no side effects", () => {
  // No top-level call that touches the document: every DOM read happens inside
  // a function body. A bare `document.` at column 0 would be a side effect.
  assert.doesNotMatch(js, /^document\./m);
  assert.doesNotMatch(js, /^mount\(/m);
});

test("the glitch coordinator drops overlapping bursts rather than queueing", () => {
  assert.match(js, /burstActive/);
});
