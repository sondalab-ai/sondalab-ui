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
// --slc-shade-step and --slc-glow are numbers (how much less bright an edge
// is, how strongly an accent glow shows), not colours. A label on a solid
// fill (--slc-on-*) is picked from that fill, so it stays with it on ink.
const BAND_INDEPENDENT = new Set(["--slc-canvas", "--slc-overlay", "--slc-shade-step", "--slc-glow"]);
const CHROMATIC = /^--slc-(accent|edge-accent|focus|on-(accent|success|warning|danger|info)|success|warning|danger|info|haze|spectral)/;

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
// line back there. Since 0.31 the current page and the keycap are depth
// recipes, not washes: they get theirs as a ring from the depth remap (below).
test("high contrast gives every edgeless wash its border back", () => {
  const hc = [...css.matchAll(/:root\[data-sl-theme="high-contrast"\][^{]*\{[^}]*border[^}]*\}/g)]
    .map((m) => m[0]).join("\n");
  const WASHES = [
    "sl-btn--ghost", "sl-icon-btn", "sl-segmented", "sl-badge", "sl-callout",
    "sl-switch__track", "sl-empty", "sl-table",
  ];
  const missing = WASHES.filter((c) => !new RegExp(`\\.${c}\\b`).test(hc));
  assert.deepEqual(missing, []);
});

// sondalab-site strips its hero button to terminal text with `background:
// transparent; border: 0` — the usual way to un-button a button. A primary
// whose chrome rode box-shadow drew a stray line there after 0.11.
test("the primary button's chrome survives a background + border reset", () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  // The primary's own rules and its states, not a descendant's (the keycap
  // a primary carries is content, with depth of its own).
  const primary = [...bare.matchAll(/\.sl-btn--primary(?:[:.[][^{,\s]*)?\s*\{([^}]*)\}/g)].map((m) => m[1]).join("\n");
  assert.ok(primary.includes("background-color"), "parser found the primary rules");
  assert.doesNotMatch(primary, /box-shadow/);
  // No spectrum image since the rim went (owner, 2026-10-02). The one image
  // is the foot (0.32), a layer of the primary's own edge, which the
  // `background` shorthand of that reset strips with the fill.
  const images = [...primary.matchAll(/background-image:\s*([^;]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(images, ["linear-gradient(var(--_sl-foot-color, var(--_sl-fill-edge)), var(--_sl-foot-color, var(--_sl-fill-edge)))"]);
  // …and on glass the family replaces the primary's two border colours with
  // the one control edge every glass button shares.
  const fx = readFileSync(resolve(REPO, "packages/ui-kit/effects.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const edge = fx.match(/:is\(\.sl-btn, \.sl-icon-btn\)\.sl-fx-glass[^{]*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(edge, /border-color:\s*var\(--slfx-control-edge, var\(--slfx-edge-mid\)\)/);
});

// Reduced motion zeroes --sl-motion-*; a literal duration would escape it. A
// var() fallback is not one (it only applies where the token is absent).
test("component motion reads the motion tokens, never a literal duration", () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/var\([^()]*\)/g, "var()");
  const literal = [...bare.matchAll(/(?:transition|animation)[^;{}]*?\b\d*\.?\d+m?s\b/g)]
    .map((m) => m[0]);
  assert.deepEqual(literal, []);
});

// workbench.css (0.33) is held to the same three rules: it reads colour only
// through role-vars, every neutral role it paints with is one the band
// re-derives, and its motion reads the motion tokens. It adds no role of its
// own, so it re-derives nothing itself.
const workbench = read("packages/ui-kit/workbench.css");
const wbBare = workbench.replace(/\/\*[\s\S]*?\*\//g, "");

test("workbench.css reads no theme colour token", () => {
  const found = [...new Set([...wbBare.matchAll(/--sl-[a-z0-9-]+/g)].map((m) => m[0]))].filter((n) => themeTokens.has(n));
  assert.deepEqual(found, []);
});

test("workbench.css declares no role of its own, and the band re-derives every neutral role it paints with", () => {
  assert.doesNotMatch(wbBare, /(?:^|[;{\s])--slc-[a-z0-9-]+\s*:/, "a new role would need a band, high-contrast and Tier B story of its own");
  const band = outside.match(/\.sl-invert > \*\s*\{[^}]*\}/)[0];
  const remapped = new Set([...band.matchAll(/^\s*(--slc-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]));
  const read = new Set([...wbBare.matchAll(/var\(\s*(--slc-[a-z0-9-]+)/g)].map((m) => m[1]));
  const missing = [...read].filter((n) => !CHROMATIC.test(n) && !BAND_INDEPENDENT.has(n) && !remapped.has(n)).sort();
  assert.ok(remapped.has("--slc-seam"), "the seam is re-derived in the band");
  assert.deepEqual(missing, []);
});

test("workbench motion reads the motion tokens, never a literal duration", () => {
  const flat = wbBare.replace(/var\([^()]*\)/g, "var()");
  assert.deepEqual([...flat.matchAll(/(?:transition|animation)[^;{}]*?\b\d*\.?\d+m?s\b/g)].map((m) => m[0]), []);
  assert.doesNotMatch(wbBare, /@keyframes|animation\s*:/, "the workbench animates nothing: no page-load choreography");
});
