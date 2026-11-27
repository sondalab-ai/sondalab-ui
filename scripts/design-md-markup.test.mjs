// DESIGN.md gives a design agent the markup of every shipped component and the
// rule for setting a product's accent. Regression for a scaffold test where an
// agent put .sl-field__control (an effects wrapper) on an input, and a spexr
// page kept the default amber accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDesignMd } from "./gen-design-md.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "packages/ui-kit/agent/DESIGN.md";
const CATALOG_MD = "packages/ui-kit/agent/catalog.md";
const NO_MARKUP = new Set(["fx-halftone", "compositions"]);

const read = (rel) => readFileSync(join(REPO, rel), "utf8");
const catalog = JSON.parse(read("packages/ui-kit/agent/catalog.json")).components;
const doc = buildDesignMd();

/** The html block under `#### \`id\`` in the Markup part, or null. */
function markupOf(text, id) {
  const m = text.match(new RegExp("^#### `" + id.replace(/[-]/g, "\\-") + "`\\n\\n```html\\n([\\s\\S]*?)```", "m"));
  return m ? m[1] : null;
}

test("every catalog component with markup has its example, carrying its first class", () => {
  for (const c of catalog) {
    if (NO_MARKUP.has(c.id)) {
      assert.equal(markupOf(doc, c.id), null, `${c.id} is listed as having no markup`);
      continue;
    }
    const html = markupOf(doc, c.id);
    assert.ok(html, `no markup example for ${c.id}`);
    assert.match(html, new RegExp(`\\b${c.classes[0]}\\b`), `${c.id} example lacks .${c.classes[0]}`);
  }
});

test("the field example puts .sl-field__input on the input", () => {
  const html = markupOf(doc, "field");
  assert.match(html, /<input class="sl-field__input"/);
  assert.doesNotMatch(html, /<input[^>]*sl-field__control/);
});

test("DESIGN.md says a product sets --sl-accent-default on the root, per theme", () => {
  assert.match(doc, /A product sets its accent on the root/);
  assert.match(doc, /sets `--sl-accent-default` on the root to its registry accent, one value per theme/);
  assert.match(doc, /it does not set the accent/);
});

test("the generator throws and writes nothing when a component loses its example", () => {
  const SKIP = new Set(["node_modules", ".git", ".ads"]);
  const dir = mkdtempSync(join(tmpdir(), "design-md-markup-"));
  try {
    for (const e of readdirSync(REPO, { withFileTypes: true })) {
      if (SKIP.has(e.name)) continue;
      if (e.isFile() || ["scripts", "docs", "packages"].includes(e.name)) {
        cpSync(join(REPO, e.name), join(dir, e.name), { recursive: true, filter: (s) => !SKIP.has(basename(s)) });
      }
    }
    const md = readFileSync(join(dir, CATALOG_MD), "utf8");
    const dropped = md.replace(/^### Field[^\n]*\n[\s\S]*?(?=^### )/m, (s) => s.replace(/```html\n[\s\S]*?```\n/g, ""));
    assert.notEqual(dropped, md, "the field example was not found to drop");
    writeFileSync(join(dir, CATALOG_MD), dropped);
    writeFileSync(join(dir, OUT), "SENTINEL\n");
    const run = spawnSync(process.execPath, [join(dir, "scripts/gen-design-md.mjs")], { cwd: dir, encoding: "utf8" });
    assert.notEqual(run.status, 0, "the generator succeeded without the field example");
    assert.match(run.stderr, /no html example for catalog component field/);
    assert.equal(readFileSync(join(dir, OUT), "utf8"), "SENTINEL\n", "DESIGN.md was written");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
