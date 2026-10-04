import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// L4 entrance for the kit's two overlays (0.27.1): the dialog rises and fades
// as it opens, from @starting-style, and back as it closes where `overlay`
// holds it in the top layer; the tooltip rises as it fades in. Both on the
// motion tokens, which tokens.css zeroes under reduced motion, and by
// transition only: a keyframe would ignore the tokens and play on page load.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const css = bare(readFileSync(resolve(KIT, "components.css"), "utf8"));
const tokens = bare(readFileSync(resolve(KIT, "tokens.css"), "utf8"));
const body = (sel) => {
  const m = css.match(new RegExp(`(?:^|[\\n}])\\s*${sel.replace(/[.[\]()*:]/g, "\\$&")}\\s*\\{([^{}]*)\\}`));
  return m?.[1] ?? "";
};
// Since 0.31 an arrival rides --sl-motion-enter (falling back to the ease).
const ON_TOKENS = /var\(--sl-motion-(mid|slow), \d+ms\) var\(--sl-motion-(ease|spring|enter)/;
const ENTER = /var\(--sl-motion-mid, 220ms\) var\(--sl-motion-enter, var\(--sl-motion-ease, ease\)\)/;

test("the dialog fades and rises on the motion tokens, keeping display and overlay through the fade", () => {
  const d = body(".sl-dialog");
  for (const p of ["opacity", "translate"]) assert.match(d, new RegExp(`${p} ${ON_TOKENS.source}`), p);
  for (const p of ["opacity", "translate"]) assert.match(d, new RegExp(`${p} ${ENTER.source}`), `${p} arrives on the enter curve`);
  for (const p of ["overlay", "display"]) assert.match(d, new RegExp(`${p} var\\(--sl-motion-mid, 220ms\\) allow-discrete`), p);
  assert.doesNotMatch(d, /(^|;)\s*transform\s*:/, "rises on translate, so a product transform composes");
});

test("the dialog and its backdrop open from @starting-style and close back to it", () => {
  const start = [...css.matchAll(/@starting-style\s*\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]).join("\n");
  assert.match(start, /\.sl-dialog\[open\] \{[^}]*opacity:\s*0;[^}]*translate:\s*0 6px/);
  assert.match(start, /\.sl-dialog\[open\]::backdrop \{[^}]*opacity:\s*0/);
  // The way back needs `overlay` to hold the closing dialog in the top layer;
  // without it the fade would play unpositioned, so it is gated on support.
  const gated = css.match(/@supports \(overlay: auto\) \{([\s\S]*?\})\s*\}/)?.[1] ?? "";
  assert.match(gated, /\.sl-dialog:not\(\[open\]\) \{\s*opacity:\s*0;\s*translate:\s*0 6px;\s*\}/);
  assert.match(gated, /\.sl-dialog:not\(\[open\]\)::backdrop \{\s*opacity:\s*0;\s*\}/);
  const ungated = css.replace(/@supports \(overlay: auto\) \{[\s\S]*?\}\s*\}/, "");
  assert.doesNotMatch(ungated, /\.sl-dialog:not\(\[open\]\)/, "no closed state outside the overlay gate");
  const bd = body(".sl-dialog::backdrop");
  assert.match(bd, /background:\s*var\(--slc-overlay\)/, "the scrim colour is unchanged");
  assert.match(bd, new RegExp(`opacity ${ON_TOKENS.source}`));
  for (const p of ["overlay", "display"]) assert.match(bd, new RegExp(`${p} var\\(--sl-motion-mid, 220ms\\) allow-discrete`), p);
});

test("the tooltip rises into place as it fades in, on the motion tokens", () => {
  const t = body(".sl-tooltip::after");
  assert.match(t, /opacity:\s*0;/);
  assert.match(t, /translate:\s*0 4px;/);
  assert.match(t, /transform:\s*translateX\(-50%\)/, "the centring transform is kept");
  for (const p of ["opacity", "translate"]) assert.match(t, new RegExp(`${p} ${ON_TOKENS.source}`), p);
  for (const p of ["opacity", "translate"]) assert.match(t, new RegExp(`${p} ${ENTER.source}`), `${p} arrives on the enter curve`);
  assert.match(body(".sl-tooltip:hover::after,\n.sl-tooltip:focus-visible::after"), /opacity:\s*1;\s*translate:\s*0 0;/);
});

test("reduced motion stills both: the mid token is zeroed and no keyframe was added", () => {
  assert.match(tokens, /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{[^}]*--sl-motion-mid:\s*0ms;/);
  assert.deepEqual([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]), ["sl-badge-live"]);
});

// Two curves (Lumen, 0.31): the ease for every state change, the enter curve
// for what arrives. Both are tokens, so the values are pinned here; the
// durations stay the three speed tokens, which reduced motion zeroes.
test("the two curves are tokens, and reduced motion still zeroes every duration", () => {
  assert.match(tokens, /--sl-motion-ease:\s*cubic-bezier\(0\.25, 1, 0\.5, 1\);/);
  assert.match(tokens, /--sl-motion-enter:\s*cubic-bezier\(0\.22, 1, 0\.36, 1\);/);
  const reduce = tokens.match(/@media \(prefers-reduced-motion: reduce\) \{\s*:root \{([^}]*)\}/)?.[1] ?? "";
  for (const d of ["fast", "mid", "slow"]) assert.match(reduce, new RegExp(`--sl-motion-${d}:\\s*0ms;`), d);
  assert.doesNotMatch(reduce, /--sl-motion-(ease|enter|spring)/, "a curve is not a duration");
  // The backdrop fades on the same curve as its dialog.
  assert.match(body(".sl-dialog::backdrop"), new RegExp(`opacity ${ENTER.source}`));
});

// The toast (0.33) arrives the way the dialog does: a 6px rise and a fade from
// @starting-style on the arrival curve, transitions only. No keyframe (the
// test above pins the one the kit has), so reduced motion stills it.
test("the toast rises into place on the motion tokens, from @starting-style", () => {
  const t = body(".sl-toast");
  for (const p of ["opacity", "translate"]) assert.match(t, new RegExp(`${p} ${ENTER.source}`), `${p} arrives on the enter curve`);
  assert.doesNotMatch(t, /(^|;)\s*(transform|animation)\s*:/, "rises on translate; nothing plays on page load but its own arrival");
  const start = [...css.matchAll(/@starting-style\s*\{([\s\S]*?\})\s*\}/g)].map((m) => m[1]).join("\n");
  assert.match(start, /\.sl-toast \{\s*opacity:\s*0;\s*translate:\s*0 6px;\s*\}/);
});
