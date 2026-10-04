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
const effectsJs = readFileSync(resolve(KIT, "effects.js"), "utf8");

/** The body of a top-level function in effects.js, comments stripped so an
 *  assertion about ORDER inside it cannot be satisfied by a string that
 *  merely appears in prose explaining the order, rather than by the code. */
function jsFnBody(name) {
  const start = effectsJs.search(new RegExp(`function ${name}\\b`));
  assert.ok(start > -1, `missing function: ${name}`);
  const open = effectsJs.indexOf("{", effectsJs.indexOf("(", start));
  let depth = 0;
  let i = open;
  do {
    if (effectsJs[i] === "{") depth++;
    else if (effectsJs[i] === "}") depth--;
    i++;
  } while (depth > 0 && i < effectsJs.length);
  return effectsJs.slice(open + 1, i - 1)
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

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

// Every property an effect can put on a HOST element, as opposed to on a paint
// layer. A kill switch that only hides ::before/::after leaves these running.
const HOST_EFFECT = /(?:^|;)\s*(?:animation|box-shadow|border-radius|border-image|opacity|filter)\s*:/;

test("both kill switches neutralise host-level effects, not only paint layers", () => {
  const targets = RULES.filter(
    (r) => /\.sl-fx-/.test(r.selector) && !/::(before|after)/.test(r.selector) && HOST_EFFECT.test(r.body),
  );
  assert.ok(targets.length > 0, "the parser must find the host-level rules");

  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    const killed = RULES.filter((r) => r.selector.includes(attr) && HOST_EFFECT.test(r.body));
    assert.ok(killed.length > 0, `no rule neutralises a host-level effect under [${attr}]`);
    const covered = killed.map((r) => r.selector).join(" ");
    for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-goo", "sl-fx-glitch"]) {
      assert.ok(covered.includes(cls), `[${attr}] must neutralise host-level .${cls}, not just its pseudo-elements`);
    }
  }
});

// Regression: GLASS TEXT hides its own ink behind `color: transparent` and
// stands an SVG mask in for it, and neither kill switch named
// `.sl-fx-glass--text` — so switching a glass-text host off left the mask cut
// into the text and the colour still transparent, which is invisible, not
// "off". A kill switch that stops short of the family's own text-hiding trick
// is not a kill switch.
test("both kill switches give a glass-text host its colour back and lose its mask", () => {
  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    const targets = RULES.filter((r) => r.selector.includes(attr) && r.selector.includes(".sl-fx-glass--text"));
    assert.ok(targets.length > 0, `[${attr}] must reach .sl-fx-glass--text`);

    const body = targets.map((r) => r.body).join(";");
    const color = body.match(/(?:^|;)\s*color\s*:\s*([^;]+)/)?.[1]?.trim();
    assert.ok(color && color !== "transparent", `[${attr}] must give .sl-fx-glass--text a colour back, not leave it transparent`);
    assert.match(
      body, /(?:^|;)\s*(?:-webkit-)?mask-image\s*:\s*none/,
      `[${attr}] must remove the mask from .sl-fx-glass--text`,
    );
  }
});

test("the opt-out disables the element carrying it, not only its descendants", () => {
  // `[data-sl-fx="off"] .sl-fx-glass` is descendant-only: putting the attribute
  // ON an effect element did nothing at all. design-language.md L6 and the spec
  // both say "that element and its subtree".
  const selectors = RULES.map((r) => r.selector).join("\n");
  assert.match(
    selectors, /:is\(\[data-sl-fx="off"\],\s*\[data-sl-fx="off"\] \*\)/,
    'the opt-out must match [data-sl-fx="off"] itself as well as its subtree',
  );
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

// The control edge (0.20): a sharp 1px line on the border and a softer 1px
// line inside it. Spexr's launcher showed the regression this guards: a field's
// arc sat one pixel OUTSIDE the input's border and read as one bold 2px line.
test("a field's ring sits on the input's border, 1px wide", () => {
  assert.doesNotMatch(effects, /\.sl-fx-(?:glass|aurora)--field[^{]*\{[^}]*--slfx-ring-w:\s*2px/,
    "a field must not widen the ring to 2px");
  assert.match(effects,
    /\.sl-field__control:is\(\.sl-fx-glass, \.sl-fx-aurora\):is\(\.sl-fx-glass--field, \.sl-fx-aurora--field\)::after\s*\{\s*inset:\s*0;/,
    "a field's ::after must sit at inset 0, on the input's border");
  // Same specificity as the spec-lit geometry rule, so it must come after it.
  assert.ok(
    effects.indexOf(".sl-field__control:is(.sl-fx-glass, .sl-fx-aurora):is(.sl-fx-glass--field")
      > effects.indexOf(".sl-fx-glass.is-spec-lit:not(:focus-visible, :focus-within, [data-sl-fx-live])::after"),
    "the field placement must follow the spec-lit geometry rule",
  );
});

test("every glass control carries the two-line edge, with or without mount()", () => {
  const rule = effects.match(/:is\(\.sl-btn, \.sl-icon-btn\)\.sl-fx-glass(:[^{]*)\{([^}]*)\}/);
  assert.ok(rule, "buttons: the control edge rule exists");
  assert.doesNotMatch(rule[1], /\.sl-glass\b/, "buttons: the edge must not wait for mount()'s .sl-glass");
  assert.match(rule[2], /border-color:\s*var\(--slfx-control-edge, var\(--slfx-edge-mid\)\)/, "buttons: sharp line on the border, the fill in shade");
  assert.match(rule[2], /box-shadow:\s*inset 0 0 0 1px var\(--slfx-control-edge-soft, var\(--slfx-edge-soft\)\)/, "buttons: soft line on the host");
  assert.match(rule[2], /--slg-rim-hi:\s*transparent/, "buttons: flat like a field, no __shine rim");
  assert.match(rule[2], /--slg-rim-lo:\s*transparent/, "buttons: flat like a field, no __shine rim");
  const input = [...effects.matchAll(/\.sl-field__control:is\(\.sl-fx-glass--field, \.sl-fx-aurora--field\)[^{]*\.sl-field__input(:[^{]*)?\s*\{([^}]*)\}/g)]
    .map((m) => (m[1] ?? "") + m[2]).join("\n");
  assert.match(input, /inset 0 0 0 1px color-mix\(in oklab, var\(--slc-edge-control, var\(--slfx-edge-soft\)\) 50%, transparent\)/, "fields: soft line on the input");
  assert.match(input, /:not\(:focus\)\s*border-color:\s*var\(--slc-edge-control, var\(--slfx-edge-mid\)\)/, "fields: sharp line, focus keeps the accent");
  assert.match(input, /:focus\s*box-shadow:[^;]*var\(--_sl-halo, 0 0 transparent\)/, "fields: focus keeps the kit's halo (0.32), which this rule outranks");
  assert.match(input, /:focus\s*(?:\/\*[\s\S]*?\*\/\s*)?box-shadow:\s*inset 0 0 0 1px color-mix\(in oklab, var\(--slc-focus\) 50%, transparent\)/, "fields: on focus the soft line follows the ring's border, no band inside the ring");
});

// Glass owns a control's depth (0.32): the buttons' edge rule replaces the
// box-shadow the kit paints from --_sl-depth and stands the primary's foot
// down, and appends the kit's halo under keyboard focus; a glass field gives
// its well up, an aurora field keeps it.
test("glass owns a control's depth: the foot and the well stand down, the halo is appended", () => {
  const edge = effects.match(/:is\(\.sl-btn, \.sl-icon-btn\)\.sl-fx-glass:where\(:root:not\(\[data-sl-theme="high-contrast"\]\) \*\):where\(:not\(\[data-sl-fx="off"\], \[data-sl-fx="off"\] \*\)\) \{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(edge, /--_sl-foot/, "the foot stands down only where the pane is built (below), not on every glass edge");
  assert.match(effects, /@supports \(backdrop-filter: blur\(1px\)\) \{[\s\S]*\.sl-btn--primary\.sl-fx-glass:where\(\.sl-glass\)[^{]*\{ --_sl-foot: 0px; \}/, "a built pane stands the foot down");
  assert.match(edge, /box-shadow:\s*inset 0 0 0 1px var\(--slfx-control-edge-soft, var\(--slfx-edge-soft\)\);/, "the glass edge replaces the control's depth");
  const focus = effects.match(/:is\(\.sl-btn, \.sl-icon-btn\)\.sl-fx-glass\.sl-fx-glass:focus-visible \{([^}]*)\}/)?.[1] ?? "";
  assert.match(focus, /box-shadow:\s*inset 0 0 0 1px var\(--slfx-control-edge-soft, var\(--slfx-edge-soft\)\), var\(--_sl-halo, 0 0 transparent\)/);
  // The halo needs no !important to compose. The one place it carries one is
  // the kill switches' restore, which must outrank their own !important.
  const forced = [...effects.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /--_sl-(?:halo|depth)[^;]*!important/.test(m[2]));
  for (const m of forced) {
    for (const part of m[1].split(/,(?![^(]*\))/).map((s) => s.trim())) {
      assert.match(part, /^(?::root\[data-sl-theme="high-contrast"\]|:is\(\[data-sl-fx="off"\], \[data-sl-fx="off"\] \*\))/, `an !important halo or depth outside the kill switches' restore: ${part}`);
    }
  }
  assert.match(effects, /\.sl-field__control\.sl-fx-glass--field:where\([^{]*\.sl-field__input \{\s*--_sl-depth:\s*0 0 transparent;\s*\}/, "a glass field gives up its well");
  assert.match(effects, /\.sl-field__input \{\s*box-shadow: inset 0 0 0 1px color-mix\(in oklab, var\(--slc-edge-control, var\(--slfx-edge-soft\)\) 50%, transparent\), var\(--_sl-depth, 0 0 transparent\);/, "an aurora field keeps its well under the soft line");
});

// Regression, 2026-10-01: the soft inner line was a SOLID colour half a shade
// step lighter than the edge. Once a hover fill darkened past it, it read as a
// pale ring between the border and the fill -- a gap. Translucent, it composites
// over whatever fill is painted and so always lands between edge and fill.
test("the soft inner line is the edge at half strength, never a solid lighter colour", () => {
  assert.match(effects, /--slfx-control-edge-soft:\s*color-mix\(in oklab, var\(--slfx-control-edge\) 50%, transparent\);/);
  assert.doesNotMatch(effects, /--slfx-control-edge-soft:\s*oklch\(/, "the soft line may not be a solid shifted colour");
});

// Regression, 2026-10-01: a glass control filling a bordered frame stacked its
// own edge inside the frame's line -- line, dark band, fill. The frame yields.
test("a frame that a control fills gives up its own border", () => {
  const comp = readFileSync(resolve(KIT, "compositions.css"), "utf8");
  assert.match(comp, /\.sl-figure__media:has\(> :is\(\.sl-btn, \.sl-icon-btn\)\)\s*\{\s*border-width:\s*0;\s*\}/);
});

test("--slfx-angle is registered with @property", () => {
  assert.match(effects, /@property\s+--slfx-angle\s*\{[^}]*syntax:\s*"<angle>"/);
});

// Regression, 2026-09-12 (lab/1w): --slfx-glow is a calc() of two lengths, and
// an unregistered custom property computes to its calc() TEXT. effects.js reads
// it with parseFloat to size the seated glow, got NaN, and seated every glow at
// its host's box plus one pixel — the bloom band then had no room to exist.
test("--slfx-glow is registered as a <length>, so effects.js can read it in px", () => {
  assert.match(effects, /@property\s+--slfx-glow\s*\{[^}]*syntax:\s*"<length>"/);
});

// 2026-09-12: loading is an aurora that runs the element's whole border, and
// the curtains stand down while it does. Two lights in one pane are two claims
// about what the element is doing, and the only thing keeping them apart is
// that the loading light's condition and the curtains' exclusion are the SAME
// condition. Pin them to each other: a divergence shows as both lights at once,
// or as a loading element with none, and neither renders in a test.
test("the loading light and the curtains' stand-down are one condition", () => {
  const BUSY = ':has(+ .sl-fx-aurora[data-sl-fx-live="busy"]:not([style*="--slfx-progress"]))';
  const busy = RULES.filter((r) => r.selector.includes(BUSY) && !r.selector.includes(":not(" + BUSY));

  // The band is MOVED onto the border, not re-declared there: it is the base
  // bloom, and a copy of it would be a second thing to keep in step.
  const moves = busy.filter((r) => /--slfx-bloom-inset\s*:/.test(r.body));
  assert.equal(moves.length, 1, `one rule moves the band onto the border, got ${moves.length}`);
  assert.match(moves[0].body, /--slfx-bloom-inset:\s*1px/, "the band goes back onto the element's own border");

  // And NOTHING here paints a second light. A fringe of filaments hanging off
  // the band was built five ways so the lens would have something to bend, and
  // was removed the same day — the note in effects.css carries the geometries
  // and their numbers. A second light coming back needs its own ruling, not a
  // quiet re-entry through this rule.
  for (const r of busy) {
    assert.doesNotMatch(r.body, /background(?:-image)?\s*:/, `${r.selector} paints a second light while loading`);
  }

  // The band travels, and the animation that turns it stays inside the
  // reduced-motion guard (the sweep test above covers where).
  const turns = busy.filter((r) => /animation:/.test(r.body));
  assert.ok(turns.length >= 1, "the band has to travel, or it is not loading");
  const turning = turns.map((r) => r.selector).join(",");
  assert.ok(turning.includes("::before"), "and it is the band's own pseudo-element that turns");

  // Anything else cut from --slfx-angle has to join that selector. A light cut
  // from an angle nothing turns sits wherever the property's initial value
  // points — 210deg, the bottom-left corner — which is exactly where the
  // filaments parked themselves on the day they were added.
  for (const r of RULES) {
    if (!r.selector.includes(BUSY) || !/var\(--slfx-angle\)/.test(r.body)) continue;
    const cut = r.selector.match(/::(?:before|after)/)?.[0];
    if (cut) assert.ok(turning.includes(cut), `the loading light on ${cut} must travel with the rest`);
  }

  // Determinate keeps its arc: its length IS the value, and a light running the
  // border says nothing about how far along the work is.
  assert.ok(BUSY.includes("--slfx-progress"), "determinate is excluded by the progress property");
});
// Regression, 2026-09-12: the glow's clip is written from --slfx-glow, which is
// the spread seatGlow() gives a NORMAL glow. A --pillars glow is seated with no
// spread — its box is the host's own — so the same inset eats it from every
// side; on a 40px button 32.5px of inset left nothing at all. Every mode whose
// seat differs has to be out of the clip's selector.
test("the glow's clip excludes every mode that is not seated with the spread", () => {
  const rule = RULES.find((r) => /clip-path/.test(r.body) && /sl-fx-aurora__glow/.test(r.selector));
  assert.ok(rule, "the seated glow must carry a clip rule");
  for (const mode of ["data-sl-fx-beam", "data-sl-fx-pillars"]) {
    assert.match(rule.selector, new RegExp(`:not\\([^)]*\\[${mode}\\]`), `${mode} must be excluded from the clip`);
  }
  assert.match(rule.selector, /:not\(:has\(\+ \.sl-fx-aurora--rim\)\)/, "--rim must be excluded from the clip");

  // ...but the curtains still need a clip of their own, at the geometry they
  // DO have. overflow:hidden clips the pattern and not the blur applied after
  // it: measured on the showcase's 43px field, the light smudged above and
  // below the control until this existed.
  // The selector carries a :not() since 2026-09-12 — the curtains stand down
  // while the beam is loading — so match the attribute, not the end of the line.
  // Adjacent attributes, so this cannot match the clip rule above, which names
  // the pillars only inside its :not(). And no ::before: the clip is on the box.
  const pillars = RULES.find(
    (r) => /\[data-sl-fx-seated\]\[data-sl-fx-pillars\]/.test(r.selector) && !/::before/.test(r.selector),
  );
  assert.ok(pillars, "the pillars' own rule must exist");
  assert.match(pillars.body, /clip-path:\s*inset\(0 round var\(--slfx-seat-radius\)\)/,
    "a pillars glow is seated with no spread, so its clip is the host's own box");
});

// Regression, 2026-09-12 (lab/1w): the bloom band was a padding ring cut out
// with a content-box mask, and a padding cannot shrink below itself — on a host
// shorter than twice --slfx-bleed the box grew past the host's bottom (a 111px
// card got a 213 x 88 rectangle from its midline down). The band is four edge
// strips now, which overlap harmlessly on a small host.
test("the bloom band is four edge strips, not a padding ring", () => {
  const rule = RULES.find((r) => r.selector === ".sl-fx-aurora__glow::before");
  assert.ok(rule, "the glow's ::before rule must exist");
  assert.doesNotMatch(rule.body, /padding:\s*var\(--slfx-bleed/, "a padding ring cannot fit a host shorter than twice the bleed");
  const strips = rule.body.match(/linear-gradient\(black 0 0\)\s+(?:top|bottom|left|right)\s*\/\s*[^,;]*var\(--slfx-bleed\)/g) ?? [];
  assert.equal(strips.length, 4, `four strips, one per edge, each --slfx-bleed deep; got ${strips.length}`);
  assert.doesNotMatch(rule.body, /mask-composite/, "strips add; no exclude composite is needed or wanted");
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

  // `animation: none` is exempt: it STOPS animation, which is what the kill
  // switches do, and they must apply regardless of motion preference. The rule
  // this guard exists for is that nothing may START animating outside the
  // block — so match a declaration that names an animation, not one that
  // removes it. The lookahead sits directly after the colon, not after `\s*`:
  // a trailing `\s*(?!none\b)` lets the quantifier give back the whitespace it
  // matched, so the lookahead is satisfied at zero-width (the character right
  // after the colon is never "none", it's a space) and the exemption never
  // actually fires — `animation: none` still matches. Folding the optional
  // whitespace into the lookahead itself closes that.
  // The glitch's four are DELIBERATELY outside (2026-09-12). They sit in the
  // open and a `prefers-reduced-motion: reduce` block takes them away — the
  // same reading, with one difference: a document can decline the removal with
  // data-sl-fx-motion="always". A product may have a documented reason to
  // animate for a visitor reporting the preference; sondalab.eu is one. The
  // escape reaches the glitch alone, and never high contrast.
  const escape = effects.slice(effects.indexOf('[data-sl-fx="on"] .sl-fx-glitch.is-glitching {'));
  const glitchOutside = [...effects.matchAll(/\banimation:(?!\s*none\b)/g)]
    .filter((m) => !guards.some(([a, b]) => m.index > a && m.index < b));
  assert.equal(glitchOutside.length, 4, `only the glitch's four animations may sit outside the guard, got ${glitchOutside.length}`);
  for (const m of glitchOutside) {
    const line = effects.slice(effects.lastIndexOf("\n", m.index), m.index + 60);
    assert.match(line, /slfx-(?:glitch-jit|glitch-a|glitch-b|shatter)/, `not a glitch animation: ${line.trim()}`);
  }

  // …and `reduce` must actually take them away, unless the document declined.
  const kill = RULES.filter(
    (r) => /data-sl-fx-motion="always"/.test(r.selector) && /animation:\s*none/.test(r.body),
  );
  assert.equal(kill.length, 1, "one rule removes the glitch's motion under reduce");
  assert.match(kill[0].selector, /:root:not\(\[data-sl-fx-motion="always"\]\)/, "and it is the document that declines, not the element");
  for (const sel of ["is-glitching", "is-glitching::before", "is-glitching::after", "sl-fx-glitch__shard"]) {
    assert.ok(kill[0].selector.includes(sel), `the kill must reach ${sel}`);
  }
  // The escape is narrow: it may not reach the high-contrast refusal.
  assert.doesNotMatch(
    escape, /data-sl-fx-motion="always"[^{]*high-contrast|high-contrast[^{]*data-sl-fx-motion="always"/,
    "a motion derogation may not stand down high contrast, which is a different requirement",
  );
});

test("only shape re-declares the ring background; states rebind the stops", () => {
  const declaring = RULES
    .filter((r) => /\.sl-fx-(?:glass|aurora)/.test(r.selector) && /::(?:before|after)/.test(r.selector) && PAINTS.test(r.body))
    .map((r) => r.selector);
  assert.equal(
    declaring.length, 11,
    `exactly eleven edge rules may declare a background, got: ${JSON.stringify(declaring)}`,
  );
  // Eleven since 2026-09-25 (lab/pillars-organic): the curtains' two combs
  // moved onto a layer each, ::before and ::after, so each sheet moves alone.
  assert.ok(declaring.some((s) => /\[data-sl-fx-pillars\][^,]*::after/.test(s)), "the second sheet must be one");
  // Ten since R3 (2026-09-25): a working tab's segment travels its underline.
  assert.ok(declaring.some((s) => s.startsWith(".sl-fx-aurora--linear:is([data-sl-fx-live=\"busy\"]")), "the travelling segment must be one");
  // Nine since 2026-09-25 (re-scope R2): the press's spill paints a
  // neighbour's edge, once on a host with no edge family and once folded into
  // the glass/aurora ring.
  assert.ok(declaring.some((s) => s === ".sl-fx-press.is-spill-lit:not(.sl-fx-glass, .sl-fx-aurora)::after"), "the plain spill must be one");
  assert.ok(declaring.some((s) => s.startsWith(".sl-fx-press.is-spill-lit:is(.sl-fx-glass, .sl-fx-aurora)")), "the spill on a ring must be one");
  // Seven since 2026-09-24 (re-scope R1): the pane's body and its lit,
  // dispersing edge were retired, and the glass's specular edge took one slot.
  // It was nine for part of 2026-09-12, the ninth a fringe of filaments hanging
  // into the pane from the loading band. Removed the same day: five geometries
  // built and measured, none of them convincing. effects.css keeps the numbers.
  // The eighth is --pillars (2026-09-11): curtains of light clipped inside the
  // pane; its background IS the light, like the beam's.
  assert.ok(declaring.some((s) => /\[data-sl-fx-pillars\][^,]*::before/.test(s)), "the pillars must be one");
  // The seventh is the beam (2026-09-11): the aurora's --beam mode paints a
  // thin line of light through the pane instead of a ring around it. Its
  // background IS the light, so it has to be one of the declaring rules.
  assert.ok(declaring.some((s) => s.includes("[data-sl-fx-beam]::before")), "the beam must be one");
  assert.ok(declaring.some((s) => s.startsWith(":is(")), "the shared ring must be one");
  assert.ok(declaring.some((s) => s === ".sl-fx-glass.is-spec-lit::after"), "the specular edge must be one");
  assert.ok(
    declaring.some((s) => s.includes('[data-sl-fx-live="busy"]') && s.endsWith("::after")),
    "the aurora's arc must be one, and it must cover busy",
  );
  assert.ok(declaring.some((s) => s.endsWith("::before")), "the aurora's inner wash must be one");
  assert.ok(declaring.some((s) => s.includes("sl-fx-aurora--linear")), "the linear segment must be one");

  // An effect may CLEAR a host's background and never paint one. It used to be
  // allowed to paint the translucency mix — the component's own fill with some
  // of it taken away — but that mix moved into glass.css's tint layer on
  // 2026-09-11, and the host now only stands down so the anatomy can carry it.
  // The rule is stronger for it: light belongs on a layer, never on the host.
  // A component the host carries as content (the keycap inside a glass
  // primary, 0.31) is not the host: its own fill is the component's, so a
  // selector whose subject is a child .sl-* outside the family is not checked.
  const onHost = RULES.filter(
    (r) => /\.sl-fx-(?:glass|aurora)/.test(r.selector) && !/::(?:before|after)/.test(r.selector) && PAINTS.test(r.body)
      && !/>\s*\.sl-(?!fx-)[\w-]+$/.test(r.selector.trim()),
  );
  for (const r of onHost) {
    assert.match(
      r.body, /background-color:\s*transparent/,
      `${r.selector} paints the host instead of standing its background down`,
    );
  }
});

// The owner's ruling: a mark burning on every element at all times is not
// glass, it is an outline. The aurora is the one family allowed to glow
// unprompted, so it is excluded here; everything the glass family paints must
// either sit behind an interaction state in its selector, or be scaled to
// nothing by --slfx-lit, which effects.js only ever writes on the one element
// under the pointer.
const LIT_STATE = /:hover|:focus-visible|:focus-within|\.is-glass-lit|\.is-spec-lit|\.is-spill-lit|\.is-press-lit|\[data-sl-fx-live/;

// The translucency mix replaces the component's own background, so the fill it
// names has to BE that background. Nothing in the cascade catches a wrong
// binding: --slfx-fill resolves, the mix is valid, and the element quietly
// wears a colour it never shipped with. So the two sheets are compared
// directly, for every component the showcase actually pairs with the family.
test("--slfx-fill names the background the component actually ships", () => {
  // Both sheets: .sl-field__control is declared by the effects layer itself,
  // and a component the family invents needs a fill as much as a shipped one.
  const components = effects + readFileSync(resolve(KIT, "components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const page = readFileSync(resolve(HERE, "../showcase/effects.html"), "utf8");

  // Every component class the showcase puts the glass family on.
  const hosts = new Set();
  for (const m of page.matchAll(/class="([^"]*\bsl-fx-glass\b[^"]*)"/g)) {
    for (const cls of m[1].split(/\s+/)) if (/^sl-(?!fx-)/.test(cls)) hosts.add(cls);
  }
  assert.ok(hosts.size > 3, `the page must exercise several components, found ${[...hosts]}`);

  // What components.css gives each of them, taking the last declaration to win.
  const shipped = new Map();
  for (const r of rules(components)) {
    const sel = r.selector.trim();
    if (!/^\.[a-z0-9_-]+$/.test(sel)) continue;
    const m = [...r.body.matchAll(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/g)].pop();
    if (m) shipped.set(sel.slice(1), m[1].trim());
  }

  const bound = new Map();
  for (const r of RULES) {
    if (!/--slfx-fill\s*:/.test(r.body)) continue;
    const value = r.body.match(/--slfx-fill\s*:\s*([^;]+)/)[1].trim();
    for (const sel of r.selector.split(",")) {
      const s = sel.trim();
      // A state (pointer or ARIA) rebinds the fill for that state; the rest
      // fill is what this test compares. The pressed state has its own below.
      if (!/\.sl-fx-glass/.test(s) || /:(?:hover|active|focus)|\[aria-/.test(s)) continue;
      const own = s.replace(/\.sl-fx-glass.*$/, "").replace(/^\./, "");
      bound.set(own || "*", value);
    }
  }
  const fallback = bound.get("*");
  assert.ok(fallback, "the family must declare a default fill");

  for (const host of [...hosts].sort()) {
    // A modifier inherits its base's fill unless it rebinds one of its own.
    const base = host.replace(/--.*$/, "");
    const want = shipped.get(host) ?? shipped.get(base) ?? "transparent";
    const got = bound.get(host) ?? bound.get(base) ?? fallback;
    assert.equal(got, want, `.${host}: components.css fills it ${want}, the family binds ${got}`);
  }
});

test("a pressed toggle on glass keeps the pressed fill components.css ships", () => {
  const components = readFileSync(resolve(KIT, "components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const shippedRule = rules(components).find((r) => r.selector.includes('.sl-icon-btn[aria-pressed="true"]') && !r.selector.includes(":hover"));
  assert.ok(shippedRule, "components.css must ship a pressed state");
  const shipped = shippedRule.body.match(/background-color\s*:\s*([^;]+)/)[1].trim();
  for (const host of [".sl-btn", ".sl-icon-btn"]) {
    const r = RULES.find((r) => /--slfx-fill\s*:/.test(r.body) && r.selector.split(",").some((s) => s.trim().startsWith(`${host}.sl-fx-glass[aria-pressed="true"]`)));
    assert.ok(r, `${host}: no pressed fill on glass — the pane would clear the pressed wash`);
    assert.equal(r.body.match(/--slfx-fill\s*:\s*([^;]+)/)[1].trim(), shipped, `${host}: the glass pressed fill must be the shipped one`);
  }
});

test("a glass element at rest is quiet: light arrives with the pointer", () => {
  const glass = RULES.filter((r) => /\.sl-fx-glass/.test(r.selector) && !/\.sl-fx-aurora/.test(r.selector));
  assert.ok(glass.length > 0, "the parser must find the glass rules");

  for (const r of glass) {
    // One selector at a time: a list whose other half carries :hover must not
    // excuse the half that does not.
    if (r.selector.split(",").every((sel) => LIT_STATE.test(sel))) continue;
    assert.ok(
      !/(?:^|;)\s*opacity\s*:\s*1\b/.test(r.body),
      `${r.selector} reveals a paint layer at rest`,
    );
    // background-color is exempt by kind, not by luck: a flat fill is the
    // component's own colour, and the translucency mix is checked above.
    for (const decl of r.body.split(";")) {
      const at = decl.indexOf(":");
      if (at < 0) continue;
      const prop = decl.slice(0, at).trim();
      if (!/^(?:background|background-image|box-shadow)$/.test(prop)) continue;
      const value = decl.slice(at + 1);
      const mixes = (value.match(/color-mix\(/g) ?? []).length;
      const gated = (value.match(/var\(--slfx-lit\)/g) ?? []).length;
      assert.equal(
        gated, mixes,
        `${r.selector} paints ${prop} at rest: ${mixes} colour-mix() terms, only ${gated} scaled by --slfx-lit`,
      );
    }
  }
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

test("the liquid never filters the host or its content", () => {
  // The owner's rule, confirmed twice: the text is never distorted. The
  // silhouette is a skin effects.js draws BELOW the content (libraries.dev/
  // gooey: "your real DOM rides crisp on top"), and the goo filter lives on
  // that skin's own SVG groups — so no CSS rule may put a filter on a liquid
  // host, on its skin, or on anything scoped under a liquid selector.
  const filtered = RULES
    .filter((r) => /\.sl-fx-liquid/.test(r.selector) && /(?:^|;)\s*filter\s*:(?!\s*none\b)/.test(r.body))
    .map((r) => r.selector);
  assert.deepEqual(filtered, [], "no rule may filter a liquid host, its skin, or its content");
  assert.doesNotMatch(effects, /url\(#slfx-/, "no CSS rule may reference an SVG filter");
});

test("the liquid's skin sits below the content and never takes the pointer", () => {
  const skin = RULES.find((r) => r.selector === ".sl-fx-liquid__skin");
  assert.ok(skin, "the skin must have its own rule");
  assert.match(skin.body, /z-index:\s*-\d/, "the skin must paint below the host's content");
  assert.match(skin.body, /pointer-events:\s*none/, "the skin must not intercept the pointer");
  assert.match(skin.body, /overflow:\s*visible/, "the swell leaves the box, so the svg must not clip it");
  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    const killed = RULES.some(
      (r) => r.selector.includes(attr) && r.selector.includes(".sl-fx-liquid__skin") && /display:\s*none/.test(r.body),
    );
    assert.ok(killed, `[${attr}] must hide the skin, the way it hides every other paint layer`);
  }
});

test("one element deforms at a time, and its border hides without touching border-color", () => {
  // The skin is one shared element, so the host-level rule that hides the
  // host's own border under the skin's band must be scoped to the single
  // element effects.js marks live, and only once Tier 1 is armed. It hides
  // the border with a transparent border-image, never with border-color:
  // the skin reads the computed border colour every frame, so hover and
  // active states have to stay the host's own.
  const live = RULES.filter((r) => /is-liquid-live/.test(r.selector) && !/::(before|after)$/.test(r.selector));
  assert.equal(live.length, 1, "exactly one host-level rule may key on the live element");
  const [rule] = live;
  assert.equal(rule.selector, '[data-sl-fx="on"] .sl-fx-liquid.is-liquid-live');
  assert.match(rule.body, /border-image:/, "the host's border hides under a border-image");
  assert.doesNotMatch(rule.body, /border-color|border-radius|filter|transform/, "the live rule may only hide the border");
});

test("no effect rewrites a host's border-radius", () => {
  // The skin traces the radii the component declared; a component stays free
  // to re-parametrise its own --sl-radius-* without this layer noticing.
  // Paint layers inherit the radius; nothing may INVENT one.
  //
  // --slfx-seat-radius is the one exception and it is not a loophole: the
  // aurora's glow moved out of its host on 2026-09-11, so that a lensed pane
  // can refract it, and a sibling cannot inherit. effects.js reads the host's
  // own computed border-top-left-radius and writes it into that property, so
  // the value still comes from the component and from nowhere else. Anything
  // that is neither `inherit` nor that property is a rewrite.
  // The beam is exempt: its 2px radius is the END-CAP of a line of light, not
  // a host's corner, and there is no component radius for it to inherit.
  const rewriting = RULES
    .filter((r) => /\.sl-fx-/.test(r.selector) && !/data-sl-fx-(?:beam|pillars)/.test(r.selector)
      && /(?:^|;)\s*border-radius\s*:(?!\s*(?:inherit\b|var\(--slfx-seat-radius\)))/.test(r.body))
    .map((r) => r.selector);
  assert.deepEqual(rewriting, [], "border-radius may only ever be inherited by a paint layer");
});

test("the glitch ghosts are real rules on the child span", () => {
  // Assert on real rules, never on substrings: Task 1's kill switches already
  // contain the literal text `.sl-fx-glitch::before`, so a substring match here
  // would pass on a file where this task's rules had never been written at all.
  const ghost = RULES.find(
    (r) => /\.sl-fx-glitch::before/.test(r.selector) && /content:\s*attr\(data-text\)/.test(r.body),
  );
  assert.ok(ghost, "the ghost channels must declare content: attr(data-text)");
  assert.match(ghost.selector, /\.sl-fx-glitch::after/, "both channels share one rule");
  assert.match(ghost.body, /mix-blend-mode:\s*screen/, "the channels must blend where they overlap");

  const channels = RULES.filter((r) => /^\.sl-fx-glitch\.is-glitching::(before|after)$/.test(r.selector));
  assert.equal(channels.length, 2, "both ghost channels must be coloured");
});

test("the glitch never claims the host's paint layers", () => {
  // ::before is the aurora's wash and ::after is the edge ring, so a glitch that
  // nested an edge or liquid class under itself would be competing for a layer
  // it does not own.
  const nested = RULES
    .filter((r) => /\.sl-fx-glitch\s+\.sl-fx-(glass|aurora|liquid)/.test(r.selector))
    .map((r) => r.selector);
  assert.deepEqual(nested, [], "the glitch must not nest an edge or liquid class");
});

test("no light is ever a disc under the pointer, and both kill switches hide the edge", () => {
  // Re-scope ruling 4 (2026-09-24): the pointer is a light source, never a
  // brush. A radial gradient placed at the pointer is exactly the blurred
  // circle the owner ruled out, so none may exist in this file — whatever it
  // is called, a gradient centred on a value the driver writes.
  const brush = RULES
    .filter((r) => /radial-gradient\([^;]*\bat\s+var\(--slfx-(?:px|py|spec|ptr)/.test(r.body))
    .map((r) => r.selector);
  assert.deepEqual(brush, [], "a pointer-positioned radial-gradient is a brush, not a light");
  assert.doesNotMatch(effects, /--slfx-px|--slfx-py/, "the pointer's position is never handed to the CSS");
  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    const killed = RULES.some(
      (r) => r.selector.includes(attr) && r.selector.includes(".sl-fx-glass::after") && /display:\s*none/.test(r.body),
    );
    assert.ok(killed, `[${attr}] must hide the glass edge, the way it hides every other paint layer`);
  }
});

test("the specular arc sits on the element's own border band, even on a --rim", () => {
  // REGRESSION (owner, 2026-09-24): on a filled --rim button the arc inherited
  // the rim aurora's outward ring and floated a border-width off the fill.
  const geo = RULES.find((r) => r.selector.startsWith(".sl-fx-glass.is-spec-lit:not(") && r.selector.endsWith("::after"));
  assert.ok(geo, "the arc's geometry must be its own rule");
  assert.match(geo.body, /inset:\s*-1px/, "the arc lands on the border band");
  assert.match(geo.body, /padding:\s*1px/, "and is one pixel wide");
  for (const lit of [":focus-visible", ":focus-within", "[data-sl-fx-live]"]) {
    assert.ok(geo.selector.includes(lit), `a lit aurora (${lit}) keeps its own rim placement`);
  }
  assert.doesNotMatch(geo.body, /background/, "it outranks the aurora, so it may carry geometry only");
});

test("the specular edge is drawn from two numbers and yields to the aurora", () => {
  const lit = RULES.find((r) => r.selector === ".sl-fx-glass.is-spec-lit::after");
  assert.ok(lit, "the specular edge must be its own rule");
  // Everything it paints scales with --slfx-spec-i, so at 0 it paints nothing.
  const mixes = (lit.body.match(/color-mix\(/g) ?? []).length;
  const gated = (lit.body.match(/var\(--slfx-spec-i\)/g) ?? []).length;
  assert.ok(mixes > 0 && gated === mixes, `every colour term must scale with --slfx-spec-i (${gated}/${mixes})`);
  assert.match(lit.body, /from calc\(var\(--slfx-spec-a\)/, "the arc faces the bearing the driver writes");
  // The driver springs the light; a transition on the background would lag it
  // behind its own spring.
  assert.doesNotMatch(lit.body, /transition:[^;]*background/, "no second easing on the arc");
  // While attention lives on the element the edge is the aurora's: its lit
  // rule comes later in the file at equal specificity.
  const aurora = RULES.find((r) => r.selector.startsWith(".sl-fx-aurora:is(:focus-visible"));
  assert.ok(aurora && aurora.index > lit.index, "the aurora's lit edge must come after the specular edge");
});

test("an effect off-screen costs nothing, and Tier 0 keeps its material", () => {
  // The expensive two are the glass's backdrop-filter — a blur of whatever is
  // behind it, recomputed as the page moves — and a running animation, which
  // keeps ticking for no one. effects.js marks what is near the viewport;
  // these rules stand down the rest.
  const near = RULES.filter((r) => /:not\(\[data-sl-fx-near\]\)/.test(r.selector));
  assert.ok(near.length >= 2, "the stand-down rules must exist");

  // SUBTRACTIVE. Every one of them must also require Tier 1 to be armed, or a
  // page that never mounts — which cannot write the attribute — would lose its
  // material entirely. Tier 0 is the state this layer promises is correct on
  // its own.
  for (const r of near) {
    assert.match(r.selector, /^\[data-sl-fx="on"\]/, `must require Tier 1: ${r.selector}`);
  }
  // Nothing may PAINT only when near: that would be the additive form, and it
  // is the one that breaks Tier 0.
  const paintsWhenNear = RULES.filter(
    (r) => /\[data-sl-fx-near\]/.test(r.selector) && !/:not\(\[data-sl-fx-near\]\)/.test(r.selector),
  );
  assert.deepEqual(paintsWhenNear.map((r) => r.selector), [], "the gate subtracts, it never adds");

  assert.ok(
    near.some((r) => /backdrop-filter:\s*none/.test(r.body)),
    "the glass's backdrop must be the first thing to go",
  );
  // Animations pause, and !important: as `animation: none` the gate lost to
  // every rule that starts an aurora animation (a tie that came later, or a
  // higher specificity), so 11 of 12 animations on the showcase ran off-screen.
  const pause = near.filter((r) => /animation-play-state:\s*paused\s*!important/.test(r.body));
  assert.ok(pause.length, "and animations the second, paused so nothing outranks the gate");
  const paused = pause.map((r) => r.selector).join(" , ");
  assert.match(paused, /\.sl-fx-aurora:not\(\[data-sl-fx-near\]\)::after/, "the ring");
  assert.match(paused, /\.sl-fx-aurora__glow\[data-sl-fx-seated\]:has\(\+ \.sl-fx-aurora:not\(\[data-sl-fx-near\]\)\)(?!::)/, "a seated glow (pillars breathe on the glow itself)");
  assert.match(paused, /\.sl-fx-aurora__glow\[data-sl-fx-seated\]:has\(\+ \.sl-fx-aurora:not\(\[data-sl-fx-near\]\)\)::before/, "and its ::before (drift, beam, sweep, busy)");
});

test("a prefixed property never follows its standard form", () => {
  // REGRESSION: `backdrop-filter: none` written before `-webkit-backdrop-filter:
  // none` was minified down to the -webkit- one alone, which Chrome does not
  // let override the standard property. The gate matched its twelve elements
  // and every one of them went on blurring. Source looked right; the built
  // bundle did not.
  for (const r of RULES) {
    for (const m of r.body.matchAll(/-webkit-([a-z-]+)\s*:/g)) {
      const std = new RegExp(`(?:^|;)\\s*${m[1]}\\s*:`);
      const stdAt = r.body.search(std);
      if (stdAt === -1) continue;
      assert.ok(
        stdAt > m.index,
        `${r.selector}: -webkit-${m[1]} must come BEFORE ${m[1]}, or a minifier may keep only the prefix`,
      );
    }
  }
});

test("injectGlass() reads the host's own radius before it becomes a glass host", () => {
  // glass.css:76 resolves .sl-glass's border-radius through --slg-radius,
  // falling back to --sl-radius-md — a rule injectGlass() makes live the
  // instant it adds .sl-glass to the host. L6: the radius is read, never
  // written; a surface stays free to re-parametrise its own radius without
  // touching the effect. injectGlass() keeps that by reading the host's own
  // computed border-radius and writing it to --slg-radius BEFORE stamping
  // .sl-glass — read after, and getComputedStyle would already report
  // glass.css's own fallback, the value this exists to preserve, not the
  // component's.
  //
  // A bare check that "--slg-radius" appears somewhere in the function proves
  // nothing: it would still pass with the read deleted, or with the read left
  // in place but moved after classList.add. This asserts the ORDER, the same
  // way scripts/effects-js.test.mjs pins "the skin must leave the previous
  // host before it enters the next" — by index inside the function body,
  // comments stripped so a sentence describing the order cannot stand in for
  // code that enforces it.
  const body = jsFnBody("injectGlass");
  const read = body.search(/getComputedStyle\(/);
  const write = body.search(/setProperty\(\s*["']--slg-radius["']/);
  const add = body.search(/classList\.add\(\s*["']sl-glass["']\s*\)/);
  assert.ok(read > -1, "injectGlass must read the host's computed style");
  assert.ok(write > -1, "injectGlass must write the host's own radius to --slg-radius");
  assert.ok(add > -1, "injectGlass must stamp .sl-glass onto the host");
  assert.ok(
    read < add,
    "injectGlass reads the host's computed style AFTER stamping .sl-glass — that reads glass.css's own fallback, not the component's radius",
  );
  assert.ok(
    write < add,
    "injectGlass writes --slg-radius AFTER stamping .sl-glass — too late to stop glass.css's own declaration from winning",
  );
});

// REGRESSION FENCE: compositions.css binds --slfx-pane-swell: 1 on every
// wrapper that both clips its contents (overflow: hidden) and hosts a glass
// pane, because the swell — a 3% scale on the pane and its seated light —
// crosses a clipping edge and is cut, so the pane loses its rim at exactly
// the moment it is being pointed at. Deleting the .sl-btn-group half of that
// binding left the suite green: nothing asserted it.
//
// "Hosts a glass pane" is a fact about a component's contract, not something
// any stylesheet states declaratively — CSS has no way to mark "this class's
// children may be .sl-fx-glass--pane" the way it marks overflow: hidden as a
// property. So PANE_WRAPPERS is manual, sourced from compositions.css's own
// prose. But checking only the two named wrappers would repeat the same
// mistake in a new shape: a THIRD clipping wrapper added later, with no
// binding and no entry anywhere, would still pass. So the fence also closes
// the world mechanically — every single-class selector in components.css
// that clips must be accounted for, either as a pane wrapper here or as a
// documented exemption in SWELL_EXEMPT below, sourced from the same
// counter-example compositions.css's own comment already gives:
// .sl-avatar clips too and is deliberately not a pane wrapper, because its
// contract admits only an <img> or the monogram — never a pane.
const PANE_WRAPPERS = ["sl-figure__media", "sl-btn-group"];

// Every OTHER clipping class components.css ships, and why a glass pane
// cannot fill it. Manual, like PANE_WRAPPERS — the reason is a contract
// fact, not a CSS property — but the classes themselves (the map keys) are
// cross-checked mechanically below, so a stale or missing key fails loudly
// rather than quietly under-covering the closed-world check.
const SWELL_EXEMPT = new Map([
  ["sl-avatar", "contract admits an <img> or the monogram, never a pane; the one glass composition it does have is BEING a pane, whose swell nothing clips"],
  ["sl-check__input", "the visually-hidden-input technique (position/size/clip-path to one pixel) — nothing ever fills it"],
  ["sl-radio__input", "same visually-hidden-input technique as .sl-check__input"],
  ["sl-switch__input", "same visually-hidden-input technique as .sl-check__input"],
  ["sl-progress", "a track whose only child is its own bar; a pane is never put inside it"],
  ["sl-list__meta", "one line of truncated text under a row's title; it holds no element, let alone a pane"],
]);

test("every wrapper that clips a filling glass pane stands its swell down", () => {
  const componentsSrc = readFileSync(resolve(KIT, "components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const compositionsSrc = readFileSync(resolve(KIT, "compositions.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const componentRules = rules(componentsSrc);
  const compositionRules = rules(compositionsSrc);
  const selectorList = (sel) => sel.split(",").map((s) => s.trim());

  for (const cls of PANE_WRAPPERS) {
    const owns = componentRules.filter((r) => selectorList(r.selector).includes(`.${cls}`));
    assert.ok(
      owns.some((r) => /(?:^|;)\s*overflow\s*:\s*hidden/.test(r.body)),
      `.${cls} is listed as a clipping pane wrapper but components.css no longer clips it (overflow: hidden) — ` +
        "either the CSS regressed or this wrapper no longer belongs in PANE_WRAPPERS",
    );

    const bound = compositionRules.filter(
      (r) => selectorList(r.selector).includes(`.${cls}`) && /--slfx-pane-swell\s*:\s*1\b/.test(r.body),
    );
    assert.ok(
      bound.length > 0,
      `.${cls} clips its contents and hosts a glass pane — compositions.css must bind --slfx-pane-swell: 1 there, ` +
        "or a pane filling it swells past the wrapper's own clip and loses its rim at the moment it is pointed at",
    );
  }

  // Closed world: every single-class selector components.css clips must be
  // either a pane wrapper (checked above) or a documented exemption. A new
  // clipping wrapper with no opinion either way fails here, by name, instead
  // of shipping unguarded the way .sl-btn-group briefly did.
  const clipping = new Set();
  for (const r of componentRules) {
    if (!/(?:^|;)\s*overflow\s*:\s*hidden/.test(r.body)) continue;
    for (const sel of selectorList(r.selector)) {
      const m = sel.match(/^\.([a-z0-9_-]+)$/);
      if (m) clipping.add(m[1]);
    }
  }
  assert.ok(
    clipping.size >= PANE_WRAPPERS.length + SWELL_EXEMPT.size,
    `the parser must find at least the ${PANE_WRAPPERS.length + SWELL_EXEMPT.size} known clipping classes, found ${clipping.size}: ` +
      `${[...clipping].join(", ")}`,
  );
  for (const cls of clipping) {
    assert.ok(
      PANE_WRAPPERS.includes(cls) || SWELL_EXEMPT.has(cls),
      `.${cls} clips its contents (overflow: hidden, components.css) with no opinion on --slfx-pane-swell — either ` +
        "bind --slfx-pane-swell: 1 in compositions.css and add it to PANE_WRAPPERS, or add it to SWELL_EXEMPT with " +
        "the reason a glass pane cannot fill it",
    );
  }
});

test("the press lights only while lit, never at the pointer, and both kill switches hide it", () => {
  // Re-scope R2 (owner, 2026-09-25). The light is the control's own body; the
  // spill is an arc on a neighbour's facing edge. Neither exists at rest.
  const body = RULES.find((r) => r.selector === ".sl-fx-press.is-press-lit::before");
  assert.ok(body, "the press light must be its own rule, and only while lit");
  assert.match(body.body, /z-index:\s*-1/, "under the label");
  const mixes = (body.body.match(/color-mix\(/g) ?? []).length;
  const gated = (body.body.match(/var\(--slfx-press\)/g) ?? []).length;
  assert.ok(mixes > 0 && gated === mixes, `every colour term scales with --slfx-press (${gated}/${mixes})`);
  assert.doesNotMatch(body.body, /radial-gradient/, "a disc is a brush, not a light");
  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    for (const pe of ["::before", "::after"]) {
      const killed = RULES.some(
        (r) => r.selector.includes(attr) && r.selector.includes(`.sl-fx-press${pe}`) && /display:\s*none/.test(r.body),
      );
      assert.ok(killed, `[${attr}] must hide the press's ${pe}`);
    }
  }
  const sink = RULES.find((r) => r.selector === ".sl-fx-press");
  assert.match(sink.body, /var\(--sl-motion-spring/, "the return runs on the spring token");
});

// spexr, 0.15.0: under high contrast mount() refuses, no layers are built, and
// a glass primary had lost its fill (transparent) and its label (the dark pole)
// — invisible on black. The host gives up its fill only where the layers are.
test("a glass host keeps its own fill until the layers exist", () => {
  const fx = readFileSync(resolve(KIT, "effects.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const clears = [...fx.matchAll(/([^{}]+)\{\s*background-color:\s*transparent;\s*\}/g)].map((m) => m[1].trim());
  const glass = clears.filter((sel) => sel.includes(".sl-fx-glass"));
  assert.ok(glass.length > 0, "the translucency rule is still there");
  for (const sel of glass) assert.match(sel, /:where\(\.sl-glass\)/, `${sel} must wait for the layers`);
  const label = fx.match(/\.sl-btn--primary\.sl-fx-glass--pane[^{]*\{\s*color:\s*oklch\(from var\(--_slfx-pane\)/)?.[0] ?? "";
  assert.match(label, /:where\(\.sl-glass\)/, "the composite-picked label only on a built pane");
  assert.match(label, /:not\(\[data-sl-theme="high-contrast"\]\)/, "and never under high contrast");
  assert.match(label, /data-sl-fx="off"/, "nor in an opt-out region");
});

// 0.18.0: data-sl-fx-still on <html> is the app's pause. Every loop the kit
// starts has to freeze under it, or one forgotten rule keeps the compositor
// awake on an idle window, which is the whole reason the flag exists.

/** Split a selector list on its top-level commas. */
function selectorList(sel) {
  const out = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === "(" || sel[i] === "[") depth++;
    else if (sel[i] === ")" || sel[i] === "]") depth--;
    else if (sel[i] === "," && depth === 0) { out.push(sel.slice(from, i).trim()); from = i + 1; }
  }
  out.push(sel.slice(from).trim());
  return out;
}

/** The element a selector lands on, as `class::pseudo` keys: its last compound,
 *  with :has()/:not() arguments and attribute tests dropped. An :is(A, B)
 *  compound fans out into one key per member. `block: false` for the rules
 *  that hold: a pause on .x--a must not be read as covering .x--b. */
function targets(sel, { block = true } = {}) {
  let depth = 0;
  let last = 0;
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === "(" || sel[i] === "[") depth++;
    else if (sel[i] === ")" || sel[i] === "]") depth--;
    else if (sel[i] === " " && depth === 0) last = i + 1;
  }
  const compound = sel.slice(last);
  const pseudo = /::(before|after)$/.exec(compound)?.[0] ?? "";
  const is = /^:is\(([\s\S]*)\)(?:::(?:before|after))?$/.exec(compound);
  const members = is ? selectorList(is[1]) : [compound];
  const keys = [];
  for (const m of members) {
    const bare = m.replace(/:(?:has|not)\((?:[^()]|\([^()]*\))*\)/g, "").replace(/\[[^\]]*\]/g, "");
    const own = /::(before|after)$/.exec(bare)?.[0] ?? pseudo;
    // A modifier never appears without its block (.sl-fx-aurora--linear is
    // always also .sl-fx-aurora), so the block's key covers it.
    for (const c of bare.matchAll(/\.([\w-]+)/g)) {
      keys.push(`${c[1]}${own}`);
      if (block) keys.push(`${c[1].split("--")[0]}${own}`);
    }
  }
  return keys;
}

test("data-sl-fx-still freezes every loop the kit starts", () => {
  const components = readFileSync(resolve(KIT, "components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const all = [...RULES, ...rules(components)];
  const still = RULES.filter((r) => /\[data-sl-fx-still\]/.test(r.selector));
  assert.ok(still.length, "the flag has rules");
  for (const r of still) {
    for (const s of selectorList(r.selector)) {
      assert.match(s, /^:root\[data-sl-fx-still\] /, `the document holds still, not an element: ${s}`);
    }
    assert.match(r.body, /!important/, `a start rule is a shorthand that outranks the flag: ${r.selector}`);
    assert.doesNotMatch(r.body, /animation-play-state:\s*running/, "nothing is exempted back into motion");
  }
  // A still rule lands on a paint layer the kit owns, never on a bare host:
  // an animation the product puts on a glass or aurora host is its own, and a
  // pause with !important would take it away for good. The exceptions are
  // the kit's own host-level loops: a drifting goo member, and a glitch while
  // it bursts (.is-glitching is the kit's own state).
  for (const r of still) {
    for (const s of selectorList(r.selector)) {
      if (/::(?:before|after)$/.test(s)) continue;
      if (s === ":root[data-sl-fx-still] .sl-fx-goo--drift .sl-fx-goo__member") continue;
      assert.match(s, /\.is-glitching/, `a still rule on a bare host reaches the product's own animations: ${s}`);
    }
  }
  const held = new Set();
  for (const r of still) {
    if (!/animation-play-state:\s*paused|animation:\s*none/.test(r.body)) continue;
    for (const s of selectorList(r.selector)) {
      // A pseudo-element inside :is() is invalid, and the forgiving list drops
      // it silently: written that way the glitch's ghosts went on strobing.
      for (const g of s.matchAll(/:is\(((?:[^()]|\([^()]*\))*)\)/g)) {
        assert.doesNotMatch(g[1], /::/, `a pseudo-element inside :is() matches nothing: ${s}`);
      }
      for (const k of targets(s.replace(/^:root\[data-sl-fx-still\] /, ""), { block: false })) held.add(k);
    }
  }
  const starts = all.filter((r) => /(?:^|;)\s*animation\s*:\s*(?!none\b)[a-z]/.test(r.body));
  assert.ok(starts.length > 10, `found the kit's start rules (${starts.length})`);
  for (const r of starts) {
    for (const s of selectorList(r.selector)) {
      const keys = targets(s);
      assert.ok(keys.some((k) => held.has(k)), `still does not reach ${s} (${keys.join(", ")})`);
    }
  }
  // The busy/run orbit pauses with the rest: aria-busy carries that state, and
  // the WebGL light it stands in for freezes under the same flag.
  assert.ok(held.has("sl-fx-aurora::after"), "the busy and run arc");
  assert.ok(held.has("sl-fx-aurora__glow::before"), "the busy orbit on the glow");
  // A glitch is taken off, not paused mid-burst, and the shatter's label comes back.
  const glitch = still.find((r) => /\.sl-fx-glitch__shard\)?\s*$/.test(r.selector.split(",").at(-1)) && /animation:\s*none/.test(r.body));
  assert.ok(glitch, "the glitch stands down under still");
  assert.ok(still.some((r) => /\.sl-fx-glitch__text$/.test(r.selector) && /opacity:\s*1\s*!important/.test(r.body)), "and the shatter's label is given back");
});

test("an unsized halftone canvas takes its container's width, square, at zero specificity", () => {
  assert.match(effects, /:where\(\[data-sl-halftone\]\)\s*\{[^}]*display:\s*block;[^}]*width:\s*100%;[^}]*aspect-ratio:\s*1;[^}]*\}/);
});

test("mount() arms the halftone before the reduced-motion guard: the picture is content", () => {
  const start = effectsJs.indexOf("export function mount(");
  const end = effectsJs.indexOf("\nexport function", start + 1);
  const body = effectsJs.slice(start, end === -1 ? undefined : end).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const arm = body.indexOf("armHalftone(root)");
  const guard = body.indexOf("window.matchMedia(REDUCE)");
  assert.ok(guard > -1, "the slice contains the motion guard");
  assert.ok(arm > -1, "mount() calls armHalftone(root)");
  assert.ok(arm < guard, "and before the motion guard");
  assert.match(jsFnBody("armHalftone"), /import\("\.\/halftone\.js"\)/, "lazily, like the goo and the live light");
});

test("high contrast hides every halftone canvas", () => {
  assert.match(effects, /:root\[data-sl-theme="high-contrast"\] \[data-sl-halftone\]\s*\{\s*display:\s*none;?\s*\}/);
});

// No rainbow by default (owner, 2026-10-02). The light theme still declares
// the spectrum, but no effect reads it: the aurora, the press light, glitch
// and the run light are the accent's and its depth companion's on every
// theme, as they always were on dark.
test("effects.css reads no spectrum token", () => {
  const reads = [...effects.matchAll(/var\(\s*(--sl-spectrum-[a-z0-9-]+)/g)].map((m) => m[1]);
  assert.deepEqual(reads, []);
});

test("the run light, the press light and glitch take the accent and its depth companion", () => {
  assert.match(effects, /--slfx-light-a:\s*var\(--slc-accent, var\(--sl-accent-default\)\);/);
  assert.match(effects, /--slfx-light-b:\s*var\(--slfx-depth\);/);
  assert.match(effects, /--slfx-press-light:[^;]*82%, var\(--slc-accent, var\(--sl-accent-default\)\)\);/);
  const channel = (side) => RULES.find((r) => r.selector === `.sl-fx-glitch.is-glitching::${side}`)?.body ?? "";
  assert.match(channel("before"), /color:\s*var\(--slc-accent, var\(--sl-accent-default\)\)/);
  assert.match(channel("after"), /color:\s*var\(--slfx-depth\)/);
});

test("busy stays the accent: state is the accent's job, not the spectrum's", () => {
  const busy = RULES.filter((r) => /data-sl-fx-live="busy"/.test(r.selector));
  assert.ok(busy.length > 0);
  for (const r of busy) assert.doesNotMatch(r.body, /--sl-spectrum/, r.selector);
});

test("the run light's two bodies resolve on the live host, not on :root", () => {
  // Declared on :root, var(--slc-accent, …) is substituted once at the root:
  // a subtree that re-sets --slc-accent (a product region, a demo swatch)
  // would still get the page's. On the host it gets its own.
  const decl = RULES.filter((r) => /--slfx-light-[ab]\s*:/.test(r.body));
  assert.ok(decl.length > 0);
  for (const r of decl) {
    assert.doesNotMatch(r.selector, /^:root$/, "declared on :root");
    assert.match(r.selector, /\[data-sl-fx-live/, r.selector);
  }
});

// The glass primary's label carries no shadow (owner, 2026-09-30): on paper the
// accent/sheen mix landed at L≈0.44, α≈0.8 — a dark smudge under a dark label.
// Contrast is carried by the label being the dark pole (Ruling 8), which the
// shadow never changed; the label clears 4.5:1 on the 72% pane without it.
test("the glass primary's label has no text-shadow", () => {
  const primary = RULES.filter((r) => /\.sl-btn--primary\.sl-fx-glass/.test(r.selector) && !/::/.test(r.selector));
  assert.ok(primary.length > 0, "the parser must find the glass primary rules");
  for (const r of primary) assert.doesNotMatch(r.body, /text-shadow\s*:/, r.selector);
});

// Owner, 2026-09-30: "glass buttons are too pale when not hovered". The glass
// primary's resting share follows its fill's lightness (the label's pole):
// 90% where the label is the dark pole, 72% (Ruling 8's measurement) where it
// is not, and the tint takes the fill in effect rather than the default accent.
// Owner, 2026-10-01: one 90% share for every fill, through a registered colour
// so hover and press fade; the label is the pole that contrasts with the
// composite of the RESTING accent, so it never flips mid-hover.
// 0.32.1: the composite is written once (--_slfx-pane) and read by the
// label, its keycap and the shade under a white label; the threshold is the
// kit's one (--_sl-pole-l, tokens.css), so the shade can never fall
// under a dark label, and the shade is declared only where the pane is (not
// in high contrast, not in an opt-out region).
test("the glass primary rests at 90%, fades its fill, and picks its label from the composite", () => {
  const r = RULES.find((r) => r.selector.trim() === ".sl-btn--primary.sl-fx-glass" && /--slg-accent\s*:/.test(r.body));
  assert.ok(r, "the glass primary binds --slg-accent");
  assert.match(r.body, /--_slfx-pane:\s*color-mix\(in oklab, var\(--_sl-fill, var\(--slc-accent\)\) 90%, var\(--slc-canvas\)\);/, "the resting fill is the primary's own fill set (components.css, 0.32)");
  assert.match(r.body, /--slfx-accent-t:\s*color-mix\(in srgb, var\(--slfx-fill\) 90%, var\(--_slfx-shade, transparent\)\);/);
  assert.doesNotMatch(r.body, /--_slfx-shade\s*:/, "the shade is not declared on the ungated rule");
  const shade = RULES.find((r) => /--_slfx-shade\s*:/.test(r.body));
  assert.equal(shade.selector, '.sl-btn--primary.sl-fx-glass:where(:root:not([data-sl-theme="high-contrast"]) *):where(:not([data-sl-fx="off"], [data-sl-fx="off"] *))');
  assert.match(shade.body, /--_slfx-shade:\s*oklch\(from var\(--_slfx-pane\) 0 0 0 \/ calc\(clamp\(0, \(l - 0\.54\) \* 10, 1\) \* clamp\(0, \(var\(--_sl-pole-l\) - l\) \* 1000, 1\)\)\);/);
  assert.match(r.body, /--slg-accent:\s*var\(--slfx-accent-t\)/);
  assert.match(r.body, /--slg-accent-a:\s*100%/);
  assert.match(effects, /@property\s+--slfx-accent-t\s*\{[^}]*syntax:\s*"<color>"/);
  // the label and the keycap read the same pane and the kit's threshold
  assert.match(effects, /color:\s*oklch\(from var\(--_slfx-pane\) clamp\(var\(--_sl-pole-dark\), \(var\(--_sl-pole-l\) - l\) \* 1000, 0\.985\) 0 h\)/);
  assert.match(effects, /--slfx-cap:\s*oklch\(from var\(--_slfx-pane\) calc\(l \+ 0\.085 \* clamp\(-1, \(l - var\(--_sl-pole-l\)\) \* 1000, 1\)\) c h\)/);
  assert.doesNotMatch(effects, /\b0\.59\b|0\.61\b/, "no threshold of its own: it reads components.css's");
  // declared once, in the generated tokens.css, and nowhere else in the kit
  const kit = ["tokens.css", "components.css", "effects.css", "glass.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"]
    .map((f) => readFileSync(resolve(KIT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
  assert.equal((kit.match(/--_sl-pole-l\s*:/g) ?? []).length, 1, "the threshold is declared once");
  assert.match(readFileSync(resolve(KIT, "tokens.css"), "utf8"), /--_sl-pole-l:\s*0\.59;/);
});

// 0.32.1: an opt-out region keeps the shipped control. mount() builds the
// glass layers on every glass host, so the region hides them, as forced
// colours does, and the host keeps its own fill; on a built pane the
// primary's states paint no opaque fill under the tint.
test("an opt-out region hides the glass layers and keeps the host's fill; a built pane stays a pane in every state", () => {
  const kill = RULES.find((r) => /display:\s*none !important/.test(r.body) && r.selector.includes('.sl-fx-glitch::after'));
  assert.ok(kill.selector.includes(':is([data-sl-fx="off"], [data-sl-fx="off"] *) :is(.sl-glass__backdrop, .sl-glass__tint, .sl-glass__specular, .sl-glass__shine)'), "the layers are hidden in an opt-out region");
  const glass = effects.slice(effects.indexOf("@supports (backdrop-filter: blur(1px))"));
  for (const m of glass.matchAll(/([^{}]+)\{\s*background-color:\s*transparent;/g)) {
    if (!m[1].includes(".sl-fx-glass")) continue;
    assert.match(m[1], /:where\(:not\(\[data-sl-fx="off"\], \[data-sl-fx="off"\] \*\)\)/, `${m[1].trim()} clears the host in an opt-out region`);
  }
  assert.match(glass, /\.sl-btn--primary\.sl-fx-glass:where\(\.sl-glass\):where\(:not\(\[data-sl-fx="off"\], \[data-sl-fx="off"\] \*\)\):is\(:hover, :active\):not\(:disabled\) \{ background-color: transparent; \}/);
});

// Regression, 2026-10-01: .sl-fx-glass--pane and .sl-fx-press reset `transition`
// to transform alone, so every glass control's hover colour snapped.
test("glass panes and press hosts keep the colour transitions", () => {
  for (const sel of [".sl-fx-glass--pane", ".sl-fx-press"]) {
    const r = RULES.find((r) => r.selector.trim() === sel && /transition:/.test(r.body));
    assert.ok(r, sel);
    for (const prop of ["color", "background-color", "border-color", "box-shadow", "--slfx-accent-t"]) {
      assert.match(r.body, new RegExp(`\\s${prop.replace(/-/g, "\\-")} var\\(--sl-motion-fast`), `${sel}: ${prop}`);
    }
  }
});

// Owner, 2026-10-01: a control's colour change travels (INK). Tier 1 only, and
// the plain fade is what stands wherever the layer is not injected.
test("ink: the wash travels on a registered reach, only under no-preference, never in high contrast or opt-out", () => {
  assert.match(effects, /@property\s+--slfx-ink-r\s*\{[^}]*syntax:\s*"<percentage>"/);
  assert.match(effects, /@property\s+--slfx-ink-a\s*\{[^}]*syntax:\s*"<angle>"/);
  const motion = effects.slice(effects.indexOf("@media (prefers-reduced-motion: no-preference) {\n  .sl-fx-ink::before"));
  assert.ok(motion.length > 0, "the ink's motion sits inside the no-preference query");
  assert.match(motion, /--slfx-ink-r:\s*230%/);
  assert.match(effects, /:root\[data-sl-theme="high-contrast"\] \.sl-fx-ink,\s*:is\(\[data-sl-fx="off"\], \[data-sl-fx="off"\] \*\) > \.sl-fx-ink\s*\{\s*display:\s*none;/);
  assert.match(effects, /\.sl-fx-ink::before\s*\{[^}]*filter:\s*url\(#sl-fx-ink-noise\)/);
});

// Regression, 2026-10-01: 0.26.0's ink held each control at rest and painted
// its own accent tint, so spexr's red danger hover came out indigo. Ink owns no
// colour: no rule keyed on the ink layer may set a host's fill, border or
// label, and the front is transparent on both sides of its band.
test("ink owns no colour: it never sets a host's paint, and its front is a band", () => {
  for (const m of effects.matchAll(/([^{}]*\.sl-fx-ink[^{}]*)\{([^}]*)\}/g)) {
    if (!/:has\(> \.sl-fx-ink\)/.test(m[1])) continue;
    assert.doesNotMatch(m[2], /(^|[;\s])(background|background-color|border-color|color|--slfx-fill|--slc-[\w-]+)\s*:/, `${m[1].trim()} paints the host`);
  }
  assert.doesNotMatch(effects, /--slfx-ink-to\b/, "ink has no target colour of its own");
  const front = effects.match(/\.sl-fx-ink::before\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(front, /transparent calc\(var\(--slfx-ink-r\) - 40%\)[\s\S]*transparent var\(--slfx-ink-r\)/, "the front is transparent on both sides");
  assert.match(effectsJs, /function inkTint\(host\)/, "the tint is read off the control");
});

test("ink: effects.js injects the layer and the noise filter, Tier 1 only, and tracks the crossing", () => {
  assert.match(effectsJs, /const INK_HOSTS = "\.sl-btn, \.sl-icon-btn";/);
  assert.match(effectsJs, /const INK_FILTER = "sl-fx-ink-noise";/);
  const guard = effectsJs.indexOf("if (window.matchMedia(REDUCE).matches && !ignoreReducedMotion) return false;");
  assert.ok(effectsJs.indexOf("injectInks(root);") > guard, "ink is injected after the reduced-motion guard");
  assert.match(effectsJs, /addEventListener\("pointerover", onInkCross/);
  assert.match(effectsJs, /addEventListener\("pointerout", onInkCross/);
});

// Regression, 2026-10-01: .sl-glass set the label at 0-1-0, tying and beating
// .sl-btn--primary by load order, so a primary inside data-sl-fx="off" took
// the page's ink: light text on a cyan fill.
test("glass sets its label colour at zero specificity", () => {
  const glass = readFileSync(resolve(KIT, "glass.css"), "utf8");
  assert.match(glass, /:where\(\.sl-glass\)\s*\{\s*color:\s*var\(--slg-text, inherit\);\s*\}/);
  assert.doesNotMatch(glass.replace(/\/\*[\s\S]*?\*\//g, ""), /(^|\n)\.sl-glass\s*\{[^}]*\bcolor:/, "no 0-1-0 colour on .sl-glass");
});

// Owner, 2026-10-01: on paper a neutral control's ink front was grey. A
// neutral shimmers in the accent, and the front never drops below a vibrant
// lightness.
test("ink: a neutral control shimmers in the accent, never grey", () => {
  assert.match(effects, /--slfx-ink-c:\s*var\(--slfx-ink-tint, var\(--slc-accent\)\);/);
  assert.match(effectsJs, /import \{ isChromatic \} from "\.\/colour\.js";/);
  assert.match(effectsJs, /paints\(v\) && isChromatic\(v\)/);
  // Anchored on the STANDALONE rules -- the selector alone between the last
  // rule's brace and its own: the shared `.sl-fx-ink::before,\n.sl-fx-ink::after {`
  // rule carries no stop, and a match on it iterated nothing, so this passed
  // with every floor removed.
  const body = (sel) => effects.match(new RegExp(`\\}\\s*${sel.replace(/[.:]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  const stops = (sel) => [...body(sel).matchAll(/oklch\(from var\(--slfx-ink-c\) (\S+)/g)].map((m) => m[1]);
  const iri = stops(".sl-fx-ink::after");
  assert.equal(iri.length, 5, `the iridescence has five stops, found ${iri.length}`);
  for (const l of iri) assert.match(l, /^max\(/, `iridescence lightness has a floor: ${l}`);
  const front = stops(".sl-fx-ink::before");
  assert.equal(front.length, 1, `the front has one coloured stop, found ${front.length}`);
  assert.match(front[0], /^max\(/, `the front's lightness has a floor: ${front[0]}`);
});

// Forced colours (the user's palette) repaint the state of a pressed or
// checked control in Highlight (components.css), and every injected layer
// painted page colours over it. The forced-colours list is the high-contrast
// kill switch's paint layers without the theme prefix, plus the material's
// own layers and ink -- derived here so the two cannot drift (review,
// 2026-10-01).
test("forced colours hide every layer the kill switch hides, plus glass and ink", () => {
  const from = effects.indexOf(':root[data-sl-theme="high-contrast"] .sl-fx-glass::before,');
  const paint = effects.slice(from, effects.indexOf("{", from));
  const hc = [...paint.matchAll(/:root\[data-sl-theme="high-contrast"\] (\.sl-[a-z_-]+(?:::(?:before|after))?),/g)].map((m) => m[1]);
  assert.ok(hc.length >= 12, `kill-switch paint layers not found (${hc.length})`);
  const at = effects.indexOf("@media (forced-colors: active)");
  assert.notEqual(at, -1, "effects.css has no forced-colours block");
  const rule = effects.slice(at).match(/\{\s*([^{}]*)\{\s*display: none !important;\s*\}/);
  assert.ok(rule, "the forced-colours block hides its layers with display: none !important");
  const listed = new Set(rule[1].split(",").map((x) => x.trim()));
  const want = [...hc, ".sl-glass__backdrop", ".sl-glass__tint", ".sl-glass__specular", ".sl-glass__shine", ".sl-fx-ink"];
  assert.deepEqual(want.filter((s) => !listed.has(s)), [], "missing from the forced-colours list");
  const block = effects.slice(at);
  assert.match(block, /:is\(\.sl-fx-glitch__shard\) \{ opacity: 0 !important; \}/, "the shatter's bands go");
  assert.match(block, /:is\(\.sl-fx-glitch__text\) \{ opacity: 1 !important; \}/, "and the label comes back");
});

// The workbench's surfaces (0.33) draw their recipe in box-shadow and keep
// ::after free for the aurora: an island (a pane, a terminal block) and a
// float (a toast, a palette). The kill switches take a host's box-shadow, so
// each recipe comes back after them, outranking them on specificity.
test("the kill switches give an island or a float its own recipe back", () => {
  const killAt = RULES.findIndex((r) => /box-shadow:\s*none !important/.test(r.body) && r.selector.startsWith(':root[data-sl-theme="high-contrast"] :is(.sl-fx-glass'));
  assert.ok(killAt > -1, "the kill rule");
  for (const [recipe, hosts] of [["island", [".sl-pane", ".sl-term-block"]], ["float", [".sl-toast", ".sl-palette"]]]) {
    const keep = RULES.find((r, i) => i > killAt && new RegExp(`box-shadow:\\s*var\\(--slc-depth-${recipe}\\) !important`).test(r.body));
    assert.ok(keep, `a rule after the kill restores --slc-depth-${recipe}`);
    const parts = keep.selector.split(/,(?![^(]*\))/).map((s) => s.trim());
    assert.ok(parts.some((p) => p.startsWith(':root[data-sl-theme="high-contrast"]')), `${recipe}: high contrast`);
    assert.ok(parts.some((p) => p.startsWith(':is([data-sl-fx="off"], [data-sl-fx="off"] *)')), `${recipe}: the opt-out`);
    for (const p of parts) for (const h of hosts) assert.ok(p.includes(h), `${recipe}: ${h} in ${p}`);
  }
});

// ...and the workbench's focusable rows (0.33) are in the control restore:
// their tile and their halo are the component's, not an effect's.
test("the kill switches give the activity item and the tree row their depth and halo back", () => {
  const depth = RULES.filter((r) => /box-shadow:\s*var\(--_sl-depth, 0 0 transparent\) !important/.test(r.body));
  const halo = RULES.filter((r) => /box-shadow:\s*var\(--_sl-depth, 0 0 transparent\), var\(--_sl-halo, 0 0 transparent\) !important/.test(r.body));
  for (const [name, list] of [["depth", depth], ["halo", halo]]) {
    assert.equal(list.length, 1, name);
    for (const part of list[0].selector.split(/,(?![^(]*\))/)) {
      for (const cls of [".sl-activitybar__item", ".sl-tree__row"]) assert.ok(part.includes(cls), `${name}: ${cls} in ${part.trim()}`);
    }
  }
});
