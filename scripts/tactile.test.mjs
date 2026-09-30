import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Gummy controls (docs/specs/2026-09-30-gummy-controls-design.md): every
// control squashes while held and springs back on release, transform-only,
// on the motion tokens, never on a keyframe.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const components = bare(readFileSync(resolve(KIT, "components.css"), "utf8"));
const effects = bare(readFileSync(resolve(KIT, "effects.css"), "utf8"));
/** Flat rules of a stylesheet: [{ selector, body }]. Nested blocks (@media) are skipped. */
function rules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
}
const R = rules(components);
const SQUASH = "scale(1.02, 0.968)";
const PRESSABLE = ["sl-btn", "sl-icon-btn", "sl-chip", "sl-segmented__item", "sl-pagination__item"];

test("every pressable control squashes while held, and never when disabled", () => {
  const press = R.find((r) => r.body.includes(`transform: ${SQUASH}`) && r.selector.includes(":active"));
  assert.ok(press, `no :active rule squashes with ${SQUASH}`);
  for (const cls of PRESSABLE) assert.ok(press.selector.includes(`.${cls}`), `${cls} is not in the press rule`);
  assert.match(press.selector, /:not\(:disabled\)/);
  assert.match(press.body, /transition-duration:\s*var\(--sl-motion-fast/);
  assert.match(press.body, /transition-timing-function:\s*var\(--sl-motion-ease/);
});

test("every pressable control springs its transform back on the spring token", () => {
  for (const cls of PRESSABLE) {
    const base = R.find((r) => r.selector === `.${cls}` && /transition/.test(r.body));
    assert.ok(base, `.${cls} has no base transition`);
    assert.match(base.body, /transform var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring, var\(--sl-motion-ease, ease\)\)/, `.${cls}`);
  }
});

test("the effects layer's press sinks exactly like the base squash", () => {
  const sink = rules(effects).find((r) => r.selector === ".sl-fx-press:active:not(:disabled)");
  assert.ok(sink);
  assert.match(sink.body, new RegExp(`transform:\\s*${SQUASH.replace(/[().]/g, "\\$&")}`));
});

test("no gummy rule animates: transitions only, so nothing plays on page load", () => {
  const moving = R.filter((r) => /transform:\s*scale\(/.test(r.body) || /--sl-slider|sl-switch__track::after|__box/.test(r.selector));
  for (const r of moving) assert.doesNotMatch(r.body, /(^|;)\s*animation\s*:/, r.selector);
  // The only keyframes in components.css are the live badge's breath, which predates this work.
  assert.deepEqual([...components.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]), ["sl-badge-live"]);
});

export { rules, bare };
