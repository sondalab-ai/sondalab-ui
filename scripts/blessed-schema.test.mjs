import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BLESSED_DIR = resolve(HERE, "../packages/ui-kit/agent/blessed");

const files = readdirSync(BLESSED_DIR).filter((f) => f.endsWith(".json"));

// Every blessed file feeds the audit's suppression logic. A malformed entry
// silently blesses nothing — or, with an empty-string selector, could bless
// everything. Enforce the schema so a bad entry fails the test, not the audit.
for (const file of files) {
  const json = JSON.parse(readFileSync(resolve(BLESSED_DIR, file), "utf8"));

  test(`${file}: has substrate and a deviations array`, () => {
    assert.equal(typeof json.substrate, "string");
    assert.ok(Array.isArray(json.deviations));
    assert.ok(!("tier" in json), "tier is sourced from substrate-matrix.json, not blessed files");
  });

  json.deviations.forEach((d, i) => {
    test(`${file}: deviation[${i}] is well-formed`, () => {
      assert.ok(["color", "font"].includes(d.kind), `kind must be color|font, got ${d.kind}`);
      assert.ok(typeof d.why === "string" && d.why.trim().length > 0, "why must be non-empty");

      const selectors = d.selectors || [];
      const values = d.values || [];
      assert.ok(selectors.length + values.length > 0, "must have at least one selector or value");
      for (const s of [...selectors, ...values]) {
        assert.ok(typeof s === "string" && s.trim().length > 0, "no empty selector/value strings");
      }
    });
  });
}
