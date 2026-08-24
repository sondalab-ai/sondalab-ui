import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  isDerivedAccentValue,
  auditAccentDerivation,
  colorBase,
  normalizeColor,
} from "../packages/ui-kit/agent/sl-audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const UIKIT = resolve(HERE, "../packages/ui-kit");

// --- isDerivedAccentValue ---

test("isDerivedAccentValue: color-mix / oklch / var are derived", () => {
  assert.ok(isDerivedAccentValue("color-mix(in srgb, var(--sl-accent-default) 80%, white)"));
  assert.ok(isDerivedAccentValue("oklch(from var(--sl-accent-default) calc(l * 0.92) calc(c * 0.96) h)"));
  assert.ok(isDerivedAccentValue("var(--sl-accent-default)"));
});

test("isDerivedAccentValue: bare literals are not derived", () => {
  assert.equal(isDerivedAccentValue("#E0942A"), false);
  assert.equal(isDerivedAccentValue("rgba(197,122,22,0.12)"), false);
});

// --- auditAccentDerivation ---

test("a bare-literal accent step with no derivation is a defect", () => {
  const css = `[data-sl-theme="dark"] {\n  --sl-accent-hover: #4858ee;\n}`;
  const f = auditAccentDerivation(css);
  assert.equal(f.length, 1);
  assert.equal(f[0].rule, "accent-derivation");
  assert.match(f[0].message, /--sl-accent-hover/);
});

test("a derived accent step passes", () => {
  const css = `[data-sl-theme="dark"] {\n  --sl-accent-hover: color-mix(in srgb, var(--sl-accent-default) 80%, white);\n}`;
  assert.equal(auditAccentDerivation(css).length, 0);
});

test("a fallback literal followed by its oklch sibling passes (graceful degradation)", () => {
  const css =
    `[data-sl-theme="dark"] {\n` +
    `  --sl-accent-active: #E0942A;\n` +
    `  --sl-accent-active: oklch(from var(--sl-accent-default) calc(l * 0.92) calc(c * 0.96) h);\n` +
    `}`;
  assert.equal(auditAccentDerivation(css).length, 0);
});

test("the fallback exemption is scoped to the same block", () => {
  // literal in one block, an unrelated expression for the same prop in another
  // block must NOT exempt it.
  const css =
    `[data-sl-theme="light"] {\n  --sl-accent-active: #3645d4;\n}\n` +
    `[data-sl-theme="dark"] {\n  --sl-accent-active: oklch(from var(--sl-accent-default) calc(l * 0.8) c h);\n}`;
  const f = auditAccentDerivation(css);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, 2);
});

test("a registered tuned step (in accentBases) is exempt", () => {
  const css = `[data-sl-theme="light"] {\n  --sl-accent-hover: #4858ee;\n}`;
  const accentBases = new Set([colorBase(normalizeColor("#4858ee"))]);
  assert.equal(auditAccentDerivation(css, { accentBases }).length, 0);
});

test("--sl-accent-default itself is never flagged (it is the base, not a step)", () => {
  const css = `[data-sl-theme="dark"] {\n  --sl-accent-default: #8b96ff;\n}`;
  assert.equal(auditAccentDerivation(css).length, 0);
});

// --- DS invariant: the shipped theme layer is fully derived ---

for (const theme of ["light", "dark", "high-contrast"]) {
  test(`themes/${theme}.css: every accent step is derived (0 defects)`, () => {
    const css = readFileSync(resolve(UIKIT, `themes/${theme}.css`), "utf8");
    const findings = auditAccentDerivation(css);
    assert.deepEqual(
      findings,
      [],
      `derivation defects in ${theme}.css:\n${findings.map((f) => `  L${f.line} ${f.message}`).join("\n")}`,
    );
  });
}
