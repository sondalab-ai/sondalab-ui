import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { auditCss } from "./sl-audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const AGENT = resolve(REPO, "packages/ui-kit/agent");

const md = readFileSync(resolve(AGENT, "catalog.md"), "utf8");
const index = JSON.parse(readFileSync(resolve(AGENT, "catalog.json"), "utf8"));
const tokens = JSON.parse(readFileSync(resolve(REPO, "sondalab.tokens.json"), "utf8"));
const registry = JSON.parse(readFileSync(resolve(AGENT, "accent-registry.json"), "utf8"));
const matrix = JSON.parse(readFileSync(resolve(AGENT, "substrate-matrix.json"), "utf8"));
const blessed = JSON.parse(readFileSync(resolve(AGENT, "blessed/default.json"), "utf8"));

// Extract every fenced html/css block from the catalog.
function extractFences(text) {
  const blocks = [];
  const re = /```(html|css)\n([\s\S]*?)```/g;
  for (const m of text.matchAll(re)) blocks.push(m[2]);
  return blocks;
}

const fences = extractFences(md);

test("catalog has a healthy number of snippets (extraction not broken)", () => {
  assert.ok(fences.length >= 15, `expected >=15 snippets, got ${fences.length}`);
});

test("every catalog snippet audits clean (no colour literal, tier-agnostic)", () => {
  const css = fences.join("\n");
  const r = auditCss({
    css,
    tokens,
    accentEntry: registry.products.default,
    blessed,
    declaredTier: null, // snippets are markup/CSS fragments, not a full themed surface
    substrate: "Page",
    matrix,
    file: "catalog.md",
  });
  const colour = r.findings.filter((f) => f.rule === "accent-one-hue");
  assert.equal(colour.length, 0, `catalog snippets must use role-vars only, found: ${JSON.stringify(colour)}`);
});

// json <-> md parity: every documented class/component appears in the prose.
for (const c of index.components) {
  test(`catalog.md documents "${c.id}"`, () => {
    if (c.classes.length > 0) {
      for (const cls of c.classes) {
        // a modifier class may appear as its full name or the `--mod` shorthand
        // the catalog uses in variant headings (e.g. `--success`).
        const mod = cls.includes("--") ? "--" + cls.split("--")[1] : null;
        const ok = md.includes(cls) || (mod && md.includes(mod));
        assert.ok(ok, `class "${cls}" (${c.id}) missing from catalog.md`);
      }
    } else {
      // signatures: match on the id words appearing in a heading
      const words = c.id.split("-");
      assert.ok(words.every((w) => new RegExp(w, "i").test(md)), `signature "${c.id}" missing from catalog.md`);
    }
  });
}
