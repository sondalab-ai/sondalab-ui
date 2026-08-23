import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");

// The shipped copy must stay byte-identical to the canonical grammar doc.
// If this fails, run `npm run gen:agent-docs` and commit the regenerated copy.
test("packages/ui-kit/agent/design-language.md matches docs/design-language.md", () => {
  const src = readFileSync(resolve(REPO, "docs/design-language.md"), "utf8");
  const dst = readFileSync(resolve(REPO, "packages/ui-kit/agent/design-language.md"), "utf8");
  assert.equal(dst, src, "agent copy is stale — run `npm run gen:agent-docs`");
});
