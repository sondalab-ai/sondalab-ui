import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");

const registry = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "packages/ui-kit/agent/accent-registry.json"), "utf8"),
);
const doc = readFileSync(resolve(REPO_ROOT, "docs/design-language.md"), "utf8");

// The accent table in design-language.md §Decision 2 lists product rows in bold:
// | **Sondalab default / daos** | ... | **spexr** | ... | **introspect** | ...
// Extract the bolded product names from the table body.
function productsInDocTable() {
  const found = new Set();
  const tableRow = /^\|\s*\*\*([^*]+)\*\*\s*\|/gm;
  for (const m of doc.matchAll(tableRow)) {
    for (const name of m[1].split("/").map((s) => s.trim().toLowerCase())) {
      if (name.includes("default")) found.add("default");
      else found.add(name);
    }
  }
  return found;
}

test("every registry product appears in the design-language.md accent table", () => {
  const docProducts = productsInDocTable();
  for (const p of Object.keys(registry.products)) {
    assert.ok(docProducts.has(p), `registry product "${p}" missing from doc table (found: ${[...docProducts].join(", ")})`);
  }
});

test("every product in the doc accent table has a registry entry", () => {
  const docProducts = productsInDocTable();
  for (const p of docProducts) {
    assert.ok(registry.products[p], `doc product "${p}" missing from accent-registry.json`);
  }
});
