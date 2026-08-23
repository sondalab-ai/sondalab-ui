#!/usr/bin/env node
// gen-agent-docs — copy the grammar doc into the shipped agent core so the npm
// package is self-contained (npm `files` cannot reach ../../docs). The copy is
// byte-identical to docs/design-language.md; scripts/agent-docs-drift.test.mjs
// asserts they match. Run via `npm run gen:tokens` (or `npm run gen:agent-docs`)
// after editing docs/design-language.md.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SRC = resolve(REPO, "docs/design-language.md");
const DST = resolve(REPO, "packages/ui-kit/agent/design-language.md");

writeFileSync(DST, readFileSync(SRC, "utf8"));
console.log(`gen-agent-docs: ${SRC} -> ${DST}`);
