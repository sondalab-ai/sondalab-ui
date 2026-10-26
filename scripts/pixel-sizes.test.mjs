import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Geist Pixel draws one cell per 0.08em, so a size is crisp only when the cell
// is a whole number of CSS px: 12.5px x n (1px, 2px, 3px, 4px cells). Every
// --sl-text-px-* token must sit on that grid; the sources are the generated
// tokens.css and the canonical sondalab.tokens.json.
const HERE = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(HERE, "../packages/ui-kit/tokens.css"), "utf8");
const source = JSON.parse(readFileSync(resolve(HERE, "../sondalab.tokens.json"), "utf8"));
const CELL = 0.08;

const emitted = [...tokensCss.matchAll(/--sl-text-px-(\d+):\s*([\d.]+)px;/g)].map((m) => ({ step: Number(m[1]), px: Number(m[2]) }));

test("--sl-text-px-1..4 are emitted, in px, in step order", () => {
  assert.deepEqual(emitted.map((e) => e.step), [1, 2, 3, 4]);
});

test("every --sl-text-px-* is a multiple of 12.5px, so its pixel cell is a whole px", () => {
  for (const { step, px } of emitted) {
    assert.equal(px % 12.5, 0, `--sl-text-px-${step}: ${px}px is not a multiple of 12.5px`);
    const cell = px * CELL;
    assert.ok(Math.abs(cell - Math.round(cell)) < 1e-9, `--sl-text-px-${step}: cell ${cell}px is not whole`);
    assert.equal(px, step * 12.5, `--sl-text-px-${step} is ${step} cells`);
  }
});

test("the source tokens and tokens.css agree on the pixel sizes", () => {
  const src = Object.entries(source.shared.text).filter(([k]) => k.startsWith("px-"));
  assert.equal(src.length, emitted.length);
  for (const [k, v] of src) assert.equal(v, `${emitted.find((e) => `px-${e.step}` === k).px}px`);
});
