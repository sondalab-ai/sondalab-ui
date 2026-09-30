import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Prism's two opt-in ornaments. Each paints nothing — or plain text — where a
// theme resets the spectrum, and spectral text is never left transparent.
const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(HERE, "../packages/ui-kit/components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (sel) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

test("haze sits behind the content and paints nothing without the spectrum", () => {
  const r = rule(".sl-haze::before");
  assert.match(r, /background:\s*var\(--slc-haze,\s*none\)/);
  assert.match(r, /z-index:\s*-1/);
  assert.match(r, /pointer-events:\s*none/);
  assert.match(rule(".sl-haze"), /isolation:\s*isolate/);
});

test("spectral text falls back to readable text, never transparent", () => {
  const r = rule(".sl-spectral");
  assert.match(r, /-webkit-text-fill-color:\s*var\(--slc-spectral-fill,\s*currentColor\)/);
  assert.match(r, /background-image:\s*var\(--slc-spectral-ink,\s*none\)/);
  assert.doesNotMatch(r, /(^|;)\s*color:\s*transparent/);
});

test("spectral text is plain text under forced colours", () => {
  assert.match(css, /@media\s*\(forced-colors:\s*active\)\s*\{[^@]*\.sl-spectral\s*\{[^}]*-webkit-text-fill-color:\s*currentColor/);
});

test("the fill switch is transparent only where the spectrum exists", () => {
  assert.match(css, /--slc-spectral-fill:\s*color-mix\(in srgb,\s*var\(--sl-spectrum-ink-0\)\s*0%,\s*transparent\)/);
});

test("haze stays inside its section's box, so it never widens the page", () => {
  const inset = rule(".sl-haze::before").match(/inset:\s*([^;]+)/)?.[1] ?? "";
  assert.ok(inset, "haze declares its inset");
  assert.doesNotMatch(inset, /-/, `inset ${inset} reaches outside the section`);
});
