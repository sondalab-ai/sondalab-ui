import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(HERE, p), "utf8");
const html = read("../showcase/index.html");

// The one-var contract (design-language §Decision 2): overriding only
// --sl-accent-default must re-derive hover/active/subtle. This replaces the
// older regression that required the switcher to set *every* step — that was a
// symptom patch. The switcher must now set ONLY the hue; the theme layer holds
// the derivations. If a future edit either (a) makes the switcher pin a step,
// or (b) bakes a step as a bare literal in a theme, one-var silently breaks —
// these tests guard both.
const applyAccent = html.slice(
  html.indexOf("function applyAccent"),
  html.indexOf("}", html.indexOf("store(\"sl-demo-accent\"")),
);

test("switcher sets only the hue (--sl-accent-default)", () => {
  assert.match(applyAccent, /setProperty\(\s*["']--sl-accent-default["']/);
});

for (const step of ["hover", "active", "subtle"]) {
  test(`switcher does NOT pin --sl-accent-${step} (it must re-derive)`, () => {
    assert.doesNotMatch(
      applyAccent,
      new RegExp(`setProperty\\(\\s*["']--sl-accent-${step}["']`),
      `applyAccent must not set --sl-accent-${step}: it re-derives from the hue`,
    );
  });
}

// The derivations live in the theme layer: every step is an expression off
// var(--sl-accent-default), never a bare literal (the leak surface). dark-active
// also emits a fallback literal line before its relative-color line — assert the
// relative line is present, not that the literal is absent.
for (const theme of ["light", "dark", "high-contrast"]) {
  const css = read(`../packages/ui-kit/themes/${theme}.css`);
  for (const step of ["hover", "active", "subtle"]) {
    test(`${theme}: --sl-accent-${step} derives from --sl-accent-default`, () => {
      const decls = css
        .split("\n")
        .filter((l) => l.includes(`--sl-accent-${step}:`));
      assert.ok(decls.length >= 1, `missing --sl-accent-${step} in ${theme}`);
      // At least one declaration must be a color-mix()/oklch() off the accent var.
      assert.ok(
        decls.some((l) => /var\(--sl-accent-default\)/.test(l) &&
          /(color-mix|oklch)\(/.test(l)),
        `--sl-accent-${step} in ${theme} must derive from var(--sl-accent-default)`,
      );
    });
  }
}
