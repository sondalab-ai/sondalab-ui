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

// ui-kit 0.36.5
import { readFileSync as _read } from "node:fs";
const text = (f) => _read(resolve(KIT, f), "utf8");

test("the goo drift's direction comes from the stamped index, never :nth-child", () => {
  assert.doesNotMatch(text("effects.css"), /sl-fx-goo__member:nth-child/);
  assert.match(text("effects.css"), /animation-direction:\s*var\(--slfx-dir,\s*normal\)/);
  const js = text("goo-field.js");
  assert.match(js, /setProperty\("--slfx-dir"/);
  assert.match(js, /removeProperty\("--slfx-dir"\)/, "and it is cleaned up with --slfx-i");
});

test("the scrolling tile strip keeps block room so its rings are not clipped", () => {
  const b = body(".sl-tabs--tile");
  assert.match(b, /padding-block:\s*4px/);
  assert.match(b, /margin-block:\s*-4px/);
});

test("the catalog's goo example colours members by class, not inline background", () => {
  const md = text("agent/catalog.md");
  const at = md.indexOf("sl-fx-goo--drift");
  assert.ok(at > 0);
  const snippet = md.slice(at, md.indexOf("```", at));
  assert.doesNotMatch(snippet, /sl-fx-goo__member"[^>]*style="[^"]*background/);
});
