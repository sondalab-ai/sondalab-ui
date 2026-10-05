import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Gummy controls (docs/specs/2026-09-30-gummy-controls-design.md): every
// control squashes while held and springs back on release, on the motion
// tokens, by transition only, never on a keyframe.
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
// 0.36 (Lumen): a text button sinks to 97% instead of squashing; the other
// pressable controls keep the squash.
// 0.36 (Lumen): a text button sinks to 97%, read off the press knob
// --slfx-pane-swell (1.03 by default; 1 stands it down, as a button group
// binds it), so the one binding holds every press path still.
const SINK_BTN = "scale(calc(1 - (var(--slfx-pane-swell, 1.03) - 1)))";
/** The scale SINK_BTN resolves to at a given knob value. */
const sinkAt = (swell) => {
  const e = SINK_BTN.replace("var(--slfx-pane-swell, 1.03)", String(swell)).match(/^scale\(calc\((.*)\)\)$/)[1];
  return Function(`"use strict"; return (${e});`)();
};
const SQUASHERS = ["sl-icon-btn", "sl-chip", "sl-segmented__item", "sl-pagination__item"];
const PRESSABLE = ["sl-btn", ...SQUASHERS];

test("every pressable control but the text button squashes while held, and never when disabled", () => {
  const press = R.find((r) => r.body.includes(`transform: ${SQUASH}`) && r.selector.includes(":active"));
  assert.ok(press, `no :active rule squashes with ${SQUASH}`);
  for (const cls of SQUASHERS) assert.ok(press.selector.includes(`.${cls}`), `${cls} is not in the press rule`);
  assert.doesNotMatch(press.selector, /\.sl-btn\b/, "the text button sinks instead");
  assert.match(press.selector, /:not\(:disabled, \[aria-disabled="true"\]\)/);
  assert.match(press.body, /transition-duration:\s*var\(--sl-motion-fast/);
  assert.match(press.body, /transition-timing-function:\s*var\(--sl-motion-ease/);
});

test("the button's sink reads the press knob: 97% at its default, none at 1", () => {
  assert.ok(Math.abs(sinkAt(1.03) - 0.97) < 1e-12, `default ${sinkAt(1.03)}`);
  assert.equal(sinkAt(1), 1);
});

test("a text button sinks to 97% while held (Lumen), quickly, on the motion tokens, and never when disabled", () => {
  const press = R.find((r) => r.selector === `.sl-btn:active:not(:disabled, [aria-disabled="true"])`);
  assert.ok(press, "no :active rule of the text button's own");
  assert.equal(press.body.match(/transform:\s*([^;]+)/)?.[1].trim(), SINK_BTN);
  assert.match(press.body, /transition-duration:\s*var\(--sl-motion-fast, 120ms\)/);
  assert.match(press.body, /transition-timing-function:\s*var\(--sl-motion-ease, ease\)/);
  // it is the only rule that moves a button: no other :active rule in
  // components.css transforms a .sl-btn (the primary's foot is a translate)
  const others = R.filter((r) => r !== press && /\.sl-btn\b/.test(r.selector) && r.selector.includes(":active") && /(^|;)\s*transform\s*:/.test(r.body));
  assert.deepEqual(others.map((r) => r.selector), []);
});

test("every pressable control springs its transform back on the spring token", () => {
  for (const cls of PRESSABLE) {
    const base = R.find((r) => r.selector === `.${cls}` && /transition/.test(r.body));
    assert.ok(base, `.${cls} has no base transition`);
    assert.match(base.body, /transform var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring, var\(--sl-motion-ease, ease\)\)/, `.${cls}`);
  }
});

test("the effects layer's press moves a control exactly as the base press does", () => {
  const E = rules(effects);
  const sink = E.find((r) => r.selector === ".sl-fx-press:active:not(:disabled, [aria-disabled=\"true\"])");
  assert.ok(sink);
  assert.match(sink.body, new RegExp(`transform:\\s*${SQUASH.replace(/[().]/g, "\\$&")}`));
  // the text button's own, which outranks it: (0,4,0) against (0,3,0)
  const btn = E.find((r) => r.selector === ".sl-btn.sl-fx-press:active:not(:disabled, [aria-disabled=\"true\"])");
  assert.ok(btn, "a pressed .sl-btn.sl-fx-press sinks like a bare button");
  assert.equal(btn.body.match(/transform:\s*([^;]+)/)?.[1].trim(), SINK_BTN);
});

test("no gummy rule animates: transitions only, so nothing plays on page load", () => {
  const moving = R.filter((r) => /transform:\s*scale\(/.test(r.body) || /--sl-slider|sl-switch__track::after|__box/.test(r.selector));
  for (const r of moving) assert.doesNotMatch(r.body, /(^|;)\s*animation\s*:/, r.selector);
  // The only keyframes in components.css are the live badge's breath, which predates this work.
  assert.deepEqual([...components.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]), ["sl-badge-live"]);
});

const CONTROLS = ":is(.sl-icon-btn, .sl-chip, .sl-segmented__item, .sl-pagination__item)";
const OFF = ":not(:disabled, [aria-disabled=\"true\"])";
const K = /--slfx-pane-k:\s*calc\(\s*\(\s*var\(\s*--slfx-pane-swell\s*,\s*1\.03\s*\)\s*-\s*1\s*\)\s*\/\s*0\.03\s*\)/;
const SQUASH_K = /transform:\s*scale\(\s*calc\(\s*1\s*\+\s*0\.02\s*\*\s*var\(\s*--slfx-pane-k\s*\)\s*\)\s*,\s*calc\(\s*1\s*-\s*0\.032\s*\*\s*var\(\s*--slfx-pane-k\s*\)\s*\)\s*\)/;
// the text button's sink with the same knob: 0.97 at k = 1, none at k = 0
const SINK_K = /transform:\s*scale\(\s*calc\(\s*1\s*-\s*0\.03\s*\*\s*var\(\s*--slfx-pane-k\s*\)\s*\)\s*\)/;
const SINK = /transform:\s*scale\(calc\(1 - \(var\(--slfx-pane-swell, 1\.03\) - 1\) \/ 3\)\)/;
const FAST = /transition-duration:\s*var\(--sl-motion-fast, 120ms\)/;
const EASE = /transition-timing-function:\s*var\(--sl-motion-ease, ease\)/;
const BTN_PANE = `.sl-btn.sl-fx-glass--pane:active${OFF}`;

test("glass control panes press with the kit squash formula, keeping the swell knob", () => {
  const Reffects = rules(effects);
  const paneBase = Reffects.find((r) => r.selector === ".sl-fx-glass--pane" && /transition/.test(r.body));
  assert.ok(paneBase, ".sl-fx-glass--pane has no transition");
  assert.match(paneBase.body, /transition[\s\S]*transform[\s\S]*var\(--sl-motion-spring/, "pane base does not use spring");

  const paneActive = Reffects.find((r) => r.selector === `${CONTROLS}.sl-fx-glass--pane:active${OFF}`);
  assert.ok(paneActive, "control-pane press rule not found");
  assert.match(paneActive.body, K, "pane active missing k formula");
  assert.match(paneActive.body, SQUASH_K, "pane active transform is not the squash formula");
  assert.match(paneActive.body, FAST);
  assert.match(paneActive.body, EASE);
});

test("a glass text button sinks to 97% like a bare one, keeping the swell knob", () => {
  const btn = rules(effects).find((r) => r.selector === BTN_PANE);
  assert.ok(btn, "the text button's pane press rule");
  assert.match(btn.body, K);
  assert.match(btn.body, SINK_K);
  assert.match(btn.body, FAST);
  assert.match(btn.body, EASE);
  // k = 1 at the default swell: exactly the bare button's 0.97
  const k = (1.03 - 1) / 0.03;
  assert.ok(Math.abs(1 - 0.03 * k - 0.97) < 1e-12);
});

test("every other glass pane sinks uniformly, on tokens, and stands down with the knob", () => {
  const sink = rules(effects).find((r) => r.selector === `.sl-fx-glass--pane:active${OFF}`);
  assert.ok(sink, "plain pane press rule not found");
  assert.match(sink.body, SINK);
  assert.match(sink.body, FAST);
  assert.match(sink.body, EASE);
  const Reffects = rules(effects);
  for (const sel of [`${CONTROLS}.sl-fx-glass--pane:active${OFF}`, BTN_PANE]) {
    assert.ok(Reffects.indexOf(sink) < Reffects.indexOf(Reffects.find((r) => r.selector === sel)), `${sel} must follow (and outrank) the plain one`);
  }
});

test("glass glow mirrors each pane press variant", () => {
  const Reffects = rules(effects);
  const glowBase = Reffects.find((r) => r.selector === ".sl-fx-aurora__glow[data-sl-fx-seated]" && /transition/.test(r.body));
  assert.ok(glowBase, "glow base not found");
  assert.match(glowBase.body, /opacity.*var\(--sl-motion-slow/, "glow base missing opacity on motion-slow");
  assert.match(glowBase.body, /transform.*var\(--sl-motion-spring/, "glow base does not use spring for transform");

  const glowControl = Reffects.find((r) => r.selector === `.sl-fx-aurora__glow[data-sl-fx-seated]:has(+ ${CONTROLS}.sl-fx-glass--pane:active${OFF})`);
  assert.ok(glowControl, "control glow rule not found");
  assert.match(glowControl.body, K);
  assert.match(glowControl.body, SQUASH_K);
  assert.match(glowControl.body, FAST);
  assert.match(glowControl.body, EASE);

  const glowBtn = Reffects.find((r) => r.selector === `.sl-fx-aurora__glow[data-sl-fx-seated]:has(+ ${BTN_PANE})`);
  assert.ok(glowBtn, "text button glow rule not found");
  assert.match(glowBtn.body, K);
  assert.match(glowBtn.body, SINK_K);
  assert.match(glowBtn.body, FAST);
  assert.match(glowBtn.body, EASE);

  const glowPlain = Reffects.find((r) => r.selector === `.sl-fx-aurora__glow[data-sl-fx-seated]:has(+ .sl-fx-glass--pane:active${OFF})`);
  assert.ok(glowPlain, "plain glow rule not found");
  assert.match(glowPlain.body, SINK);
  assert.match(glowPlain.body, FAST);
  assert.match(glowPlain.body, EASE);
});

test("the pane and glow press rules do not hide inside no-preference: reduced motion must reach them", () => {
  // Their durations are motion tokens, which reduced motion zeroes; inside
  // the block the kit squash would stay as a snap under reduced motion.
  const open = [...effects.matchAll(/@media \(prefers-reduced-motion: no-preference\)\s*\{/g)];
  const spans = open.map((m) => {
    let depth = 1, i = m.index + m[0].length;
    while (depth && i < effects.length) depth += effects[i] === "{" ? 1 : effects[i] === "}" ? -1 : 0, i++;
    return [m.index, i];
  });
  const inside = (needle) => {
    const at = effects.indexOf(needle);
    assert.ok(at > -1, needle);
    return spans.some(([a, b]) => at > a && at < b);
  };
  for (const needle of [
    `.sl-fx-glass--pane:active${OFF} {`,
    `${CONTROLS}.sl-fx-glass--pane:active${OFF} {`,
    `${BTN_PANE} {`,
    ".sl-fx-glass--pane {\n",
    ".sl-fx-aurora__glow[data-sl-fx-seated] {\n  transition:",
    `.sl-fx-aurora__glow[data-sl-fx-seated]:has(+ .sl-fx-glass--pane:active${OFF}) {`,
    `.sl-fx-aurora__glow[data-sl-fx-seated]:has(+ ${BTN_PANE}) {`,
    `.sl-btn.sl-fx-press:active${OFF} {`,
  ]) assert.equal(inside(needle), false, `${needle.trim()} sits inside no-preference`);
  // ...and the base press in components.css sits in no media block at all
  const base = components.indexOf(`.sl-btn:active${OFF} {`);
  assert.ok(base > -1);
  assert.doesNotMatch(components.slice(0, base).split("\n").slice(-3).join("\n"), /@media/);
});

test("the switch knob is a pill that stretches toward where it will travel, never when disabled", () => {
  const knob = R.find((r) => r.selector === ".sl-switch__track::after");
  assert.match(knob.body, /border-radius:\s*999px/);
  assert.match(knob.body, /width var\(--sl-motion-slow, 360ms\) var\(--sl-motion-spring/);
  // 0.32 (Lumen): a 0.85rem knob in a 2.1rem border-box track, seated 2px in
  // on both sides (0.875rem of travel), grows by a tenth while held -- to
  // 0.935rem -- and a checked one grows leftward, its right edge still 2px in.
  assert.match(knob.body, /width:\s*0\.85rem/);
  const track = R.find((r) => r.selector === ".sl-switch__track");
  assert.match(track.body, /box-sizing:\s*border-box/);
  assert.match(track.body, /width:\s*2\.1rem/);
  const on = R.find((r) => r.selector === ".sl-switch__input:checked + .sl-switch__track::after");
  assert.match(on.body, /translateX\(0\.875rem\)/);
  const px = (rem) => rem * 16;
  assert.equal(px(2.1) - 2 - 2 - px(0.85) - px(0.875), 2, "on, the knob sits 2px in from the right as it sits 2px in from the left");
  assert.equal(px(2.1) - 2 - 2 - px(0.935) - px(0.79), 2, "held on, it grows leftward and keeps that 2px");
  const held = R.find((r) => r.selector.includes(".sl-switch:active") && /width:\s*0\.935rem/.test(r.body));
  assert.ok(held, "no held-knob rule");
  assert.match(held.selector, /:not\(:has\(:disabled\)\)/);
  const heldOn = R.find((r) => r.selector.includes(".sl-switch:active") && r.selector.includes(":checked") && /translateX\(0\.79rem\)/.test(r.body));
  assert.ok(heldOn, "a checked knob must grow leftward (translateX 0.79rem)");
  assert.match(heldOn.selector, /:not\(:has\(:disabled\)\)/);
  for (const r of [held, heldOn]) {
    assert.match(r.body, FAST, "a held knob goes down on fast");
    assert.match(r.body, EASE, "a held knob goes down on ease");
  }
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

test("the slider's hover growth only applies where hover exists, so a tap does not leave it grown", () => {
  const at = components.search(/@media \(hover: hover\)\s*\{/);
  assert.ok(at > -1, "no @media (hover: hover) block");
  const block = components.slice(at, components.indexOf("\n}", at));
  for (const thumb of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
    assert.ok(block.includes(`.sl-slider:hover:not(:disabled)${thumb}`), `${thumb} hover is outside @media (hover: hover)`);
  }
  assert.ok(!block.includes(":active"), "the grab must stay outside the hover query");
});

test("the slider thumb stays visible inside an inversion band", () => {
  const r = R.find((x) => x.selector === ".sl-invert .sl-slider");
  assert.ok(r, "no .sl-invert .sl-slider rule");
  assert.match(r.body, /--sl-slider-thumb:\s*var\(--slc-canvas\)/);
});

test("the slider fill is the text-weight accent, never the raw accent", () => {
  const track = R.find((r) => r.selector === ".sl-slider::-webkit-slider-runnable-track");
  const prog = R.find((r) => r.selector === ".sl-slider::-moz-range-progress");
  for (const r of [track, prog]) {
    assert.match(r.body, /var\(--slc-accent-text\)/, r.selector);
    assert.doesNotMatch(r.body, /var\(--slc-accent\)/, r.selector);
  }
});

test("the slider fill reads the consumer's value and survives its absence", () => {
  const track = R.find((r) => r.selector === ".sl-slider::-webkit-slider-runnable-track");
  assert.match(track.body, /var\(--sl-slider-value, 0%\)/);
  assert.ok(R.find((r) => r.selector === ".sl-slider::-moz-range-progress"), "Firefox fills with ::-moz-range-progress");
});

test("the slider's focus ring is a box-shadow on its thumb, in each engine, not an outline", () => {
  for (const thumb of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
    const ring = R.find((r) => r.selector === `.sl-slider:focus-visible${thumb}`);
    assert.ok(ring, thumb);
    // the ring, then the kit's halo (0.32), then the thumb's cast
    assert.match(ring.body, /box-shadow:\s*0 0 0 var\(--sl-focus-ring-offset, 0px\) var\(--slc-canvas\), 0 0 0 calc\(var\(--sl-focus-ring-offset, 0px\) \+ var\(--sl-focus-ring-width, 2px\)\) var\(--slc-focus\), var\(--_sl-halo, 0 0 transparent\), var\(--slc-shadow-sm\)/, thumb);
    assert.doesNotMatch(ring.body, /outline/, thumb);
  }
});

