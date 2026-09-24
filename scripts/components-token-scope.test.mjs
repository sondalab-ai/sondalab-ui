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

// The inversion band flips the ground: a role-var it fails to re-derive keeps
// its on-canvas value and paints ink on ink. The set below is derived from what
// components.css actually reads, so a component introducing a new neutral role
// is covered the day it ships.
//
// Two neutrals are deliberately NOT remapped and are excluded by name rather
// than by omission, so the exclusion is a claim and not a hole:
//   --slc-canvas  — IS the band's foreground; remapping it would be the cycle
//                   the rule's own comment describes.
//   --slc-overlay — a scrim over the whole page, not over the band.
// Chromatic roles (accent, focus, status, on-accent) stay themselves on ink:
// design-language.md Decision 2 — a product has one accent, whatever the ground.
const BAND_INDEPENDENT = new Set(["--slc-canvas", "--slc-overlay"]);
const CHROMATIC = /^--slc-(accent|focus|on-accent|success|warning|danger|info)/;

test("the inversion band re-derives every neutral role its subtree paints with", () => {
  const readOutside = new Set(
    [...outside.matchAll(/var\(\s*(--slc-[a-z0-9-]+)/g)].map((m) => m[1]),
  );
  const band = outside.match(/\.sl-invert > \*\s*\{[^}]*\}/);
  assert.ok(band, ".sl-invert > * must exist — it is where the re-derivation lives");
  const remapped = new Set(
    [...band[0].matchAll(/^\s*(--slc-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
  );

  const missing = [...readOutside]
    .filter((n) => !CHROMATIC.test(n) && !BAND_INDEPENDENT.has(n) && !remapped.has(n))
    .sort();
  assert.deepEqual(
    missing,
    [],
    `.sl-invert > * must re-derive these off currentColor, or they paint the ` +
      `band's own ink on the band: ${missing}`,
  );
});

// A wash with no edge vanishes on high contrast's black, a theme that exists to
// draw every edge. Each component shipped as an edgeless wash must get its
// line back there.
test("high contrast gives every edgeless wash its border back", () => {
  const hc = [...css.matchAll(/:root\[data-sl-theme="high-contrast"\][^{]*\{[^}]*border[^}]*\}/g)]
    .map((m) => m[0]).join("\n");
  const WASHES = [
    "sl-btn--ghost", "sl-icon-btn", "sl-segmented", "sl-badge", "sl-callout",
    "sl-switch__track", "sl-pagination__item", "sl-kbd", "sl-empty", "sl-table",
  ];
  const missing = WASHES.filter((c) => !new RegExp(`\\.${c}\\b`).test(hc));
  assert.deepEqual(missing, []);
});

// Reduced motion zeroes --sl-motion-*; a literal duration would escape it. A
// var() fallback is not one (it only applies where the token is absent).
test("component motion reads the motion tokens, never a literal duration", () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/var\([^()]*\)/g, "var()");
  const literal = [...bare.matchAll(/(?:transition|animation)[^;{}]*?\b\d*\.?\d+m?s\b/g)]
    .map((m) => m[0]);
  assert.deepEqual(literal, []);
});
