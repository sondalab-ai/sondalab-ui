import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseSheet } from "./lib/cascade.mjs";

// ui-kit 0.36.4: consecutive fields can be stacked with a gap, and the tile
// tab list scrolls instead of wrapping a tab onto a second row.
const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/ui-kit");
const RULES = parseSheet(readFileSync(resolve(KIT, "components.css"), "utf8"), {}, 0);
const body = (sel) => RULES.filter((r) => r.parts.includes(sel)).flatMap((r) => r.decls.map(([p, v]) => `${p}:${v}`)).join(";");

test(".sl-field-stack lays fields out in a column with a gap", () => {
  const b = body(".sl-field-stack");
  assert.match(b, /flex-direction:\s*column/);
  assert.match(b, /gap:\s*var\(--sl-space-4/);
});

test("the tile tab list scrolls and its tabs never wrap or shrink", () => {
  assert.match(body(".sl-tabs--tile"), /overflow-x:\s*auto/);
  const tab = body(".sl-tabs--tile .sl-tabs__tab");
  assert.match(tab, /flex:\s*none/);
  assert.match(tab, /white-space:\s*nowrap/);
});
