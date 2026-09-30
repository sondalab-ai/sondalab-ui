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

test("glass pane presses with the kit squash formula, keeping the swell knob", () => {
  const Reffects = rules(effects);
  const paneBase = Reffects.find((r) => r.selector === ".sl-fx-glass--pane" && /transition/.test(r.body));
  assert.ok(paneBase, ".sl-fx-glass--pane has no transition");
  assert.match(paneBase.body, /transition.*transform.*var\(--sl-motion-spring/, "pane base does not use spring");

  const paneActive = Reffects.find((r) => r.selector === ".sl-fx-glass--pane:active:not(:disabled)");
  assert.ok(paneActive, ".sl-fx-glass--pane:active:not(:disabled) not found");
  assert.match(paneActive.body, /--slfx-pane-k:\s*calc\(\s*\(\s*var\(\s*--slfx-pane-swell\s*,\s*1\.03\s*\)\s*-\s*1\s*\)\s*\/\s*0\.03\s*\)/, "pane active missing k formula");
  assert.match(paneActive.body, /transform:\s*scale\(\s*calc\(\s*1\s*\+\s*0\.02\s*\*\s*var\(\s*--slfx-pane-k\s*\)\s*\)\s*,\s*calc\(\s*1\s*-\s*0\.032\s*\*\s*var\(\s*--slfx-pane-k\s*\)\s*\)\s*\)/, "pane active transform is not the squash formula");
  assert.match(paneActive.body, /transition-duration:\s*var\(--sl-motion-fast/, "pane active not using motion-fast");
  assert.match(paneActive.body, /transition-timing-function:\s*var\(--sl-motion-ease/, "pane active not using motion-ease");
});

test("glass glow mirrors pane press with the kit squash formula", () => {
  const Reffects = rules(effects);
  const glowBase = Reffects.find((r) => r.selector === ".sl-fx-aurora__glow[data-sl-fx-seated]" && /transition/.test(r.body));
  assert.ok(glowBase, "glow base not found");
  assert.match(glowBase.body, /opacity.*var\(--sl-motion-slow/, "glow base missing opacity on motion-slow");
  assert.match(glowBase.body, /transform.*var\(--sl-motion-spring/, "glow base does not use spring for transform");

  const glowActive = Reffects.find((r) => r.selector === ".sl-fx-aurora__glow[data-sl-fx-seated]:has(+ .sl-fx-glass--pane:active:not(:disabled))");
  assert.ok(glowActive, "glow active rule not found");
  assert.match(glowActive.body, /--slfx-pane-k:\s*calc\(\s*\(\s*var\(\s*--slfx-pane-swell\s*,\s*1\.03\s*\)\s*-\s*1\s*\)\s*\/\s*0\.03\s*\)/, "glow active missing k formula");
  assert.match(glowActive.body, /transform:\s*scale\(\s*calc\(\s*1\s*\+\s*0\.02\s*\*\s*var\(\s*--slfx-pane-k\s*\)\s*\)\s*,\s*calc\(\s*1\s*-\s*0\.032\s*\*\s*var\(\s*--slfx-pane-k\s*\)\s*\)\s*\)/, "glow active transform is not the squash formula");
  assert.match(glowActive.body, /transition-duration:\s*var\(--sl-motion-fast/, "glow active not using motion-fast");
});

export { rules, bare };
