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

test("the switch knob is a pill that stretches toward where it will travel, never when disabled", () => {
  const knob = R.find((r) => r.selector === ".sl-switch__track::after");
  assert.match(knob.body, /border-radius:\s*999px/);
  assert.match(knob.body, /width var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring/);
  const held = R.find((r) => r.selector.includes(".sl-switch:active") && /width:\s*0\.825rem/.test(r.body));
  assert.ok(held, "no held-knob rule");
  assert.match(held.selector, /:not\(:has\(:disabled\)\)/);
  const heldOn = R.find((r) => r.selector.includes(".sl-switch:active") && r.selector.includes(":checked") && /translateX\(0\.775rem\)/.test(r.body));
  assert.ok(heldOn, "a checked knob must grow leftward (translateX 0.775rem)");
  assert.match(heldOn.selector, /:not\(:has\(:disabled\)\)/);
});

test("the check and radio box shrinks while held and springs back, never when disabled", () => {
  const box = R.find((r) => r.selector.replace(/\s+/g, " ") === ".sl-check__box, .sl-radio__box");
  assert.match(box.body, /transform var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring/);
  const held = R.find((r) => /scale\(0\.96\)/.test(r.body) && r.selector.includes(":active"));
  assert.ok(held, "no held-box rule");
  assert.match(held.selector, /:not\(:has\(:disabled\)\)/);
  assert.match(held.body, /transition-duration:\s*var\(--sl-motion-fast/);
});

test("every engine pseudo-element sits in a rule of its own", () => {
  // A selector list containing a pseudo-element one engine does not know is
  // dropped WHOLE by that engine: a ::-moz- next to a ::-webkit- thumb would
  // style no thumb anywhere.
  for (const r of R) {
    const parts = r.selector.split(",").map((s) => s.trim());
    if (!parts.some((p) => /::-(webkit|moz)-/.test(p))) continue;
    assert.equal(parts.length, 1, `engine pseudo-element shares a selector list: ${r.selector}`);
  }
});

test("the slider thumb grows when hovered and grows and flattens when grabbed, per engine", () => {
  for (const thumb of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
    const base = R.find((r) => r.selector === `.sl-slider${thumb}`);
    assert.ok(base, `no .sl-slider${thumb}`);
    assert.match(base.body, /background:\s*var\(--sl-slider-thumb\)/);
    assert.match(base.body, /transform var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring/);
    const hover = R.find((r) => r.selector === `.sl-slider:hover:not(:disabled)${thumb}`);
    const grab = R.find((r) => r.selector === `.sl-slider:active:not(:disabled)${thumb}`);
    assert.match(hover?.body ?? "", /transform:\s*scale\(1\.1\)/, `${thumb} hover`);
    assert.match(grab?.body ?? "", /transform:\s*scale\(1\.35, 1\.22\)/, `${thumb} grab`);
    // hover must come first: while grabbed, both match, and the later rule wins.
    assert.ok(R.indexOf(hover) < R.indexOf(grab), `${thumb}: the hover rule must precede the grab rule`);
  }
  const host = R.find((r) => r.selector === ".sl-slider");
  assert.match(host.body, /--sl-slider-thumb:\s*oklch\(from var\(--slc-canvas\) max\(l, 1 - l\) 0 h\)/);
});

test("the slider fill reads the consumer's value and survives its absence", () => {
  const track = R.find((r) => r.selector === ".sl-slider::-webkit-slider-runnable-track");
  assert.match(track.body, /var\(--sl-slider-value, 0%\)/);
  assert.ok(R.find((r) => r.selector === ".sl-slider::-moz-range-progress"), "Firefox fills with ::-moz-range-progress");
});

test("the slider's focus ring is on its thumb, in each engine", () => {
  for (const thumb of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
    const ring = R.find((r) => r.selector === `.sl-slider:focus-visible${thumb}`);
    assert.match(ring?.body ?? "", /outline:\s*var\(--sl-focus-ring-width, 2px\) solid var\(--slc-focus\)/, thumb);
  }
});

export { rules, bare };
