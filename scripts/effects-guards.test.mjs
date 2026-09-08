import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");

// Scan declarations, not prose. A comment that mentions `animation:` is not an
// animation, and this file's comments explain the very rules it asserts — so
// every assertion below reads the comment-stripped source. Stripping cannot
// hide a real declaration, so the guard loses no strength.
const effects = readFileSync(resolve(KIT, "effects.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

test("effects.css disables every family under high-contrast", () => {
  assert.match(effects, /\[data-sl-theme="high-contrast"\]/);
  for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
    const block = effects.slice(effects.indexOf('[data-sl-theme="high-contrast"]'));
    assert.ok(block.includes(cls), `high-contrast kill switch must cover .${cls}`);
  }
});

test("effects.css honours the subtree opt-out", () => {
  assert.match(effects, /\[data-sl-fx="off"\]/);
});

test("every animation sits inside a reduced-motion guard", () => {
  // Collect the character ranges covered by `prefers-reduced-motion: no-preference`
  // blocks, then assert no `animation:` declaration falls outside one.
  const guards = [];
  const re = /@media[^{]*prefers-reduced-motion:\s*no-preference[^{]*\{/g;
  for (const m of effects.matchAll(re)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    do {
      if (effects[i] === "{") depth++;
      else if (effects[i] === "}") depth--;
      i++;
    } while (depth > 0 && i < effects.length);
    guards.push([m.index, i]);
  }
  assert.ok(guards.length > 0, "effects.css must contain a reduced-motion guard");

  for (const m of effects.matchAll(/\banimation:/g)) {
    const inside = guards.some(([a, b]) => m.index > a && m.index < b);
    assert.ok(inside, `animation at index ${m.index} is outside a reduced-motion guard`);
  }
});
