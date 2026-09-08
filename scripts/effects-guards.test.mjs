import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");

// Scan declarations, not prose. A comment that mentions `animation:` is not an
// animation, and this file's comments explain the very rules it asserts — so
// every assertion below reads the comment-stripped source. Stripping cannot
// hide a real declaration, so the guard loses no strength.
const effects = readFileSync(resolve(KIT, "effects.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Leaf CSS rules with their own selector, body and source index.
 *  At-rules are descended into rather than reported, so a rule nested in an
 *  @media block yields its real selector and its real position in the file. */
function rules(css) {
  const out = [];
  const parse = (from, to) => {
    let selStart = from;
    let j = from;
    while (j < to) {
      if (css[j] === "}") { selStart = ++j; continue; }
      if (css[j] !== "{") { j++; continue; }
      let depth = 1;
      let k = j + 1;
      while (k < to && depth > 0) {
        if (css[k] === "{") depth++;
        else if (css[k] === "}") depth--;
        k++;
      }
      const body = css.slice(j + 1, k - 1);
      if (body.includes("{")) parse(j + 1, k - 1);
      else out.push({ selector: css.slice(selStart, j).trim().replace(/\s+/g, " "), body, index: selStart });
      selStart = k;
      j = k;
    }
  };
  parse(0, css.length);
  return out;
}

const RULES = rules(effects);
const PAINTS = /background(?:-color|-image)?\s*:/;

// The kill-switch assertions from Task 1 sliced to end-of-file, which stops
// testing anything the moment a later task appends a rule naming one of these
// classes — which is exactly what this task does. Bound them to the selectors
// that actually carry the switch. REPLACE the two Task 1 kill-switch tests
// with these two; do not add them alongside.
const selectorsCarrying = (attr) =>
  (effects.match(new RegExp(`[^{}]*\\[${attr}\\][^{}]*\\{`, "g")) || []).join("\n");

const FAMILIES = ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"];

test("effects.css disables every family under high-contrast", () => {
  const sel = selectorsCarrying('data-sl-theme="high-contrast"');
  for (const cls of FAMILIES) assert.ok(sel.includes(cls), `high-contrast kill switch must cover .${cls}`);
});

test("effects.css honours the subtree opt-out for every family", () => {
  const sel = selectorsCarrying('data-sl-fx="off"');
  for (const cls of FAMILIES) assert.ok(sel.includes(cls), `opt-out must cover .${cls}`);
});

test("the ring is one shared rule, not one per family", () => {
  const ring = effects.match(/:is\(\.sl-fx-glass,\s*\.sl-fx-aurora\)::after\s*\{/g) || [];
  assert.equal(ring.length, 1, "glass and aurora must share exactly one ::after rule");
});

test("the ring grows inward — padding is the width, inset stays at the border box", () => {
  const block = effects.slice(effects.indexOf(":is(.sl-fx-glass, .sl-fx-aurora)::after"));
  assert.match(block.slice(0, 600), /inset:\s*-1px/, "ring inset must stay pinned to the border box");
  assert.match(block.slice(0, 600), /padding:\s*var\(--slfx-ring-w/, "ring width must be padding, so it grows inward");
});

test("--slfx-angle is registered with @property", () => {
  assert.match(effects, /@property\s+--slfx-angle\s*\{[^}]*syntax:\s*"<angle>"/);
});

test("every animation sits inside a reduced-motion guard", () => {
  // Collect the character ranges covered by `prefers-reduced-motion: no-preference`
  // blocks, then assert no `animation:` declaration falls outside one.
  const guards = [];
  const re = /@media[^{]*prefers-reduced-motion:\s*no-preference[^{]*\{/g;
  for (const m of effects.matchAll(re)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    do {
      if (effects[i] === "{") depth++;
      else if (effects[i] === "}") depth--;
      i++;
    } while (depth > 0 && i < effects.length);
    guards.push([m.index, i]);
  }
  assert.ok(guards.length > 0, "effects.css must contain a reduced-motion guard");

  for (const m of effects.matchAll(/\banimation:/g)) {
    const inside = guards.some(([a, b]) => m.index > a && m.index < b);
    assert.ok(inside, `animation at index ${m.index} is outside a reduced-motion guard`);
  }
});

test("only shape re-declares the ring background; states rebind the stops", () => {
  const declaring = RULES
    .filter((r) => /\.sl-fx-(?:glass|aurora)/.test(r.selector) && PAINTS.test(r.body))
    .map((r) => r.selector);
  assert.equal(
    declaring.length, 3,
    `exactly three edge rules may declare a background, got: ${JSON.stringify(declaring)}`,
  );
  assert.ok(declaring.some((s) => s.startsWith(":is(")), "the shared ring must be one");
  assert.ok(declaring.some((s) => s.includes('[data-sl-fx-live="busy"]')), "the busy arc must be one");
  assert.ok(declaring.some((s) => s.includes("sl-fx-aurora--linear")), "the linear segment must be one");
});

test("the busy orbit is inside the reduced-motion guard but the busy ring is not", () => {
  const guardStart = effects.indexOf("@media (prefers-reduced-motion: no-preference)");
  const orbit = effects.indexOf("slfx-orbit 1.1s");
  const ring = RULES.find(
    (r) => /\[data-sl-fx-live="busy"\]/.test(r.selector) && r.selector.endsWith("::after") && PAINTS.test(r.body),
  );
  assert.ok(ring, "the busy ring's painting rule must exist");
  assert.ok(orbit > guardStart, "the orbit animation must sit inside the reduced-motion guard");
  assert.ok(ring.index < guardStart, "the busy ring itself must render regardless of motion preference");
});

test("determinate progress drives arc length, not an animation", () => {
  assert.match(effects, /--slfx-arc:\s*calc\(var\(--slfx-progress\)\s*\*\s*360deg\)/);
});

test("the liquid filter is applied to the sheen layer only, never to a text box", () => {
  // Isolate the RULE that carries the filter, then assert on its own selector.
  // Do NOT slice a text window backwards from the declaration to the previous
  // `}`: that asserts on whatever happens to sit in the window, so it fails on
  // the very same rule written on one line, and would pass on any preceding
  // text that merely contained the substring `::before`. The source is already
  // comment-stripped at read time, so a rule's selector is all that precedes it.
  const carrying = RULES.filter((r) => /filter:\s*url\(#slfx-liquid\)/.test(r.body));
  assert.equal(carrying.length, 1, "exactly one rule may carry the liquid filter");
  assert.match(
    carrying[0].selector, /::before$/,
    `the liquid filter must sit on the ::before sheen, never on the host — got: ${carrying[0].selector}`,
  );
});

test("the glitch never claims the host's paint layers", () => {
  // Its ghosts must be pseudo-elements of .sl-fx-glitch itself (the child span),
  // never of a host that also carries a ring or a sheen.
  assert.match(effects, /\.sl-fx-glitch::before/);
  assert.match(effects, /\.sl-fx-glitch::after/);
  assert.doesNotMatch(effects, /\.sl-fx-glitch\s+\.sl-fx-(glass|aurora|liquid)/);
});
