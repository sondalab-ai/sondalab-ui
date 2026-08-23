import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(HERE, "../showcase/index.html"), "utf8");

// Regression: the accent switcher must set the *full* accent family. It once
// set default/hover/subtle but not active, so the primary button's :active
// fell back to the amber --slc-accent-active default on non-amber accents
// (design-language §Decision 2: the product derives hover/active/subtle from
// the hue). Guard every step so a future edit can't drop one silently.
const applyAccent = html.slice(
  html.indexOf("function applyAccent"),
  html.indexOf("}", html.indexOf("store(\"sl-demo-accent\"")),
);

for (const step of ["default", "hover", "active", "subtle"]) {
  test(`accent switcher sets --sl-accent-${step}`, () => {
    assert.match(
      applyAccent,
      new RegExp(`setProperty\\(\\s*["']--sl-accent-${step}["']`),
      `applyAccent must set --sl-accent-${step}`,
    );
  });
}
