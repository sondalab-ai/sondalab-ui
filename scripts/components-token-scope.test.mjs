import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const read = (p) => readFileSync(resolve(REPO, p), "utf8");

// A "theme token" is any custom property a theme file declares — the set is
// derived from the generated theme rather than hardcoded, so a new theme
// colour is covered the day it is generated. Type, spacing, radius, motion,
// shadow and z tokens live in tokens.css and stay freely readable.
const themeTokens = new Set(
  [...read("packages/ui-kit/themes/light.css").matchAll(/^\s*(--sl-[a-z0-9-]+)\s*:/gm)]
    .map((m) => m[1]),
);

const css = read("packages/ui-kit/components.css");

// Everything outside the FIRST :root block — that block is the role-var layer,
// and reading theme tokens is precisely its job.
const start = css.indexOf(":root {");
const end = css.indexOf("}", start);
const outside = css.slice(0, start) + css.slice(end + 1);

test("theme-token set was derived, not empty", () => {
  assert.ok(themeTokens.size > 10, `expected a populated theme, got ${themeTokens.size}`);
});

test("no selector outside the :root role-var block reads a theme colour token", () => {
  const found = [
    ...new Set([...outside.matchAll(/--sl-[a-z0-9-]+/g)].map((m) => m[0])),
  ].filter((n) => themeTokens.has(n));
  assert.deepEqual(
    found,
    [],
    `components.css must reach colour through --slc-* role-vars: a theme token ` +
      `resolves only under [data-sl-theme] and is ABSENT in Tier B products. Found: ${found}`,
  );
});
