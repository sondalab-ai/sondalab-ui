import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Consumers reach the kit only through --sl-* custom properties and .sl-*
// class names, so "adopt a release by bumping the dependency" holds exactly as
// long as nothing in that surface disappears. Additions pass. Regenerate the
// fixture deliberately with UPDATE_PUBLIC_SURFACE=1.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const FIXTURE = resolve(HERE, "fixtures/public-surface.json");
const FILES = [
  "tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css",
  "components.css", "workbench.css", "compositions.css", "glass.css", "effects.css",
];

function surface() {
  const tokens = new Set();
  const classes = new Set();
  for (const f of FILES) {
    const css = readFileSync(resolve(KIT, f), "utf8");
    for (const m of css.matchAll(/(--sl-[a-z0-9-]+)\s*:/g)) tokens.add(m[1]);
    for (const m of css.matchAll(/\.(sl-[a-z0-9_-]+)/g)) classes.add(m[1]);
  }
  return { tokens: [...tokens].sort(), classes: [...classes].sort() };
}

if (process.env.UPDATE_PUBLIC_SURFACE) {
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, JSON.stringify(surface(), null, 2) + "\n");
}

const frozen = JSON.parse(readFileSync(FIXTURE, "utf8"));
const now = surface();

for (const kind of ["tokens", "classes"]) {
  test(`no shipped ${kind} disappears (C-1)`, () => {
    const have = new Set(now[kind]);
    const gone = frozen[kind].filter((n) => !have.has(n));
    assert.deepEqual(gone, [], `removed or renamed ${kind}: ${gone.join(", ")}`);
  });
}
