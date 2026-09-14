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
    declaring.length, 8,
    `exactly eight edge rules may declare a background, got: ${JSON.stringify(declaring)}`,
  );
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
  assert.ok(declaring.some((s) => s === ".sl-fx-glass--pane::before"), "the pane's body must be one");
  assert.ok(
    declaring.some((s) => s.startsWith('[data-sl-fx="on"] .sl-fx-glass--pane.is-glass-lit') && s.endsWith("::after")),
    "the pane's lit edge must be one, and only once Tier 1 is armed",
  );
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
  const onHost = RULES.filter(
    (r) => /\.sl-fx-(?:glass|aurora)/.test(r.selector) && !/::(?:before|after)/.test(r.selector) && PAINTS.test(r.body),
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
const LIT_STATE = /:hover|:focus-visible|:focus-within|\.is-glass-lit|\[data-sl-fx-live/;

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
      if (!/\.sl-fx-glass/.test(s) || /:(?:hover|active|focus)/.test(s)) continue;
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

test("the pane's body sits below the label, never filters, and both kill switches hide it", () => {
  // The owner's rule on a new surface: refraction lives on the edge band,
  // the label stays flat. The body is ::before at a negative z-index (above
  // the host's own fill, below its content); no rule scoped to the pane may
  // filter anything or reach for a backdrop-filter — a lens over the label
  // is the effect the owner refused; and the body goes with the paint
  // layers under both kill switches.
  const body = RULES.find((r) => r.selector === ".sl-fx-glass--pane::before");
  assert.ok(body, "the pane's body must be its own rule");
  assert.match(body.body, /z-index:\s*-\d/, "the body must paint below the host's label");
  assert.match(body.body, /pointer-events:\s*none/);
  const filtered = RULES
    .filter((r) => /--pane/.test(r.selector) && /(?:^|;)\s*(?:backdrop-)?filter\s*:/.test(r.body))
    .map((r) => r.selector);
  assert.deepEqual(filtered, [], "no pane rule may filter — the content is never refracted");
  for (const attr of ['data-sl-theme="high-contrast"', 'data-sl-fx="off"']) {
    const killed = RULES.some(
      (r) => r.selector.includes(attr) && r.selector.includes(".sl-fx-glass::before") && /display:\s*none/.test(r.body),
    );
    assert.ok(killed, `[${attr}] must hide the pane's body, the way it hides every other paint layer`);
  }
});

test("the pane's lit edge yields to the aurora and stays off a filled element", () => {
  // While attention lives on the element the edge belongs to the light; on a
  // --rim the ::after is the rim aurora's, outside the fill. The lit ring
  // rewrites --slfx-angle from the bearing effects.js writes, and nothing
  // else may set the registered angle outside an animation.
  const lit = RULES.find((r) => /\.sl-fx-glass--pane\.is-glass-lit/.test(r.selector) && r.selector.endsWith("::after"));
  assert.ok(lit, "the lit edge must be its own rule");
  assert.match(lit.selector, /^\[data-sl-fx="on"\]/, "the lit edge needs Tier 1 armed");
  assert.match(lit.selector, /:not\([^)]*\.sl-fx-aurora--rim[^)]*\)/, "never on a --rim");
  assert.match(lit.selector, /:not\([^)]*:focus-visible[^)]*\[data-sl-fx-live\][^)]*\)/, "never over a lit aurora");
  assert.match(lit.body, /--slfx-angle:\s*var\(--slfx-ptr/, "the angle comes from the bearing the driver writes");
  assert.doesNotMatch(lit.body, /(?:^|;)\s*opacity\s*:/, "the lit edge must not force the ring visible under Tier 2");
  const rim = RULES.find((r) => r.selector === ".sl-fx-glass.sl-fx-aurora--rim::after");
  assert.ok(rim && /opacity:\s*0/.test(rim.body), "the resting glass conic must stand down on a --rim");
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
  assert.ok(near.some((r) => /animation:\s*none/.test(r.body)), "and animations the second");
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
// property. compositions.css's own prose names exactly two wrappers so far,
// and gives the counter-example that proves the set can't be inferred from
// "clips" alone: .sl-avatar clips too (components.css) and is deliberately
// left out, because its contract admits only an <img> or the monogram, never
// a pane. So PANE_WRAPPERS below is manual, sourced from that same prose —
// but everything checked ABOUT each wrapper is read mechanically from the
// stylesheets, so a wrapper that stops clipping, or a binding that quietly
// disappears, does not pass silently.
const PANE_WRAPPERS = ["sl-figure__media", "sl-btn-group"];

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
});
