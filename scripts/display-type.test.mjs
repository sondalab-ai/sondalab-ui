import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Display type is set solid (owner, 2026-10-02): the oversized anchor's line
// height is 1.0, not the heading token's 1.2 (--sl-line-tight), which in-flow
// headings keep. The effects showcase's own anchor plays the same role.
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(HERE, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const body = (css, sel) => css.match(new RegExp(`(?:^|\\n)\\s*${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

test(".sl-anchor is set solid", () => {
  assert.match(body(read("../packages/ui-kit/components.css"), ".sl-anchor"), /line-height:\s*1;/);
});

test("the effects showcase's display anchor is set solid too; its in-flow headings keep the token", () => {
  const html = read("../showcase/effects.html");
  assert.match(body(html, ".anchor"), /line-height:\s*1;/);
  assert.match(body(html, "h1, h2, h3"), /line-height:\s*var\(--sl-line-tight\)/);
});
