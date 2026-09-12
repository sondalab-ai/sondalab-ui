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
    for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
      assert.ok(covered.includes(cls), `[${attr}] must neutralise host-level .${cls}, not just its pseudo-elements`);
    }
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
  // The DECLARATION, not a mention: the filaments read the same property to
  // sit where the band sits, and reading it is not moving it.
  const moves = busy.filter((r) => /--slfx-bloom-inset\s*:/.test(r.body));
  assert.equal(moves.length, 1, `one rule moves the band onto the border, got ${moves.length}`);
  assert.match(moves[0].body, /--slfx-bloom-inset:\s*1px/, "the band goes back onto the element's own border");
  // The BAND must be moved, not re-declared: it is the base bloom, and a copy
  // would be a second thing to keep in step. Exactly one rule under this
  // condition may paint, and it is the filaments on ::after — a different
  // light, hanging into the pane, which is why it exists (2026-09-12: the band
  // alone cannot be seen to bend, 1.63% of its pixels against the curtains'
  // 5.00%, because the lens pulls radially and the band hugs the border).
  const paints = busy.filter((r) => /background(?:-image)?\s*:/.test(r.body));
  assert.equal(paints.length, 1, `only the filaments may paint here, got ${paints.length}`);
  assert.match(paints[0].selector, /::after$/, "and they are on ::after, since ::before is the band");
  assert.match(paints[0].body, /--slfx-filament/, "made of their own derived colour, not a literal");
  // Cut ACROSS the pull, not along it. The displacement is radial, so a comb of
  // spokes pointing at the centre is as invariant as the band itself — measured,
  // the spokes moved the bend from 1.63% to 1.83%. Vertical lines meet the left
  // and right faces side-on, which is the whole reason the curtains bend.
  // TANGENT to the border, which is the same thing as "across the pull": the
  // displacement is radial, so near the left edge it pulls sideways and only a
  // pattern varying sideways moves, near the top edge it pulls down and only
  // one varying downward does. Reading --slfx-angle straight into the comb
  // gives exactly that on every run, with no second clock — and a filament
  // parallel to its own edge never points at the centre, which is what the
  // radar was. A fixed angle here would put it back.
  assert.match(
    paints[0].body, /repeating-linear-gradient\(var\(--slfx-angle\)/,
    "the comb is tangent to the border: --slfx-angle read straight, no second clock",
  );
  // What is left is the turning itself, and it has to stay inside the guard.
  const turns = busy.filter((r) => /animation:/.test(r.body));
  assert.ok(turns.length >= 1, "the band has to travel, or it is not loading");
  // EVERY light cut from --slfx-angle must be in that rule's selector. One cut
  // from an angle nothing turns sits wherever the property's initial value
  // points — 210deg, the bottom-left corner — which is what the filaments did
  // on the day they were added, and it reads as a second light stuck in a
  // corner beside the one that travels.
  const turning = turns.map((r) => r.selector).join(",");
  for (const part of ["::before", "::after"]) {
    assert.ok(turning.includes(part), `the loading light on ${part} must travel with the rest`);
  }
  const stood = RULES.filter((r) => r.selector.includes(":not(" + BUSY + ")"));
  assert.equal(stood.length, 1, `the curtains' painting must stand down, got ${stood.length}`);
  assert.match(stood[0].selector, /\[data-sl-fx-pillars\][^,]*::before/, "and it is the curtains' paint that stands down");
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
  for (const m of effects.matchAll(/\banimation:(?!\s*none\b)/g)) {
    const inside = guards.some(([a, b]) => m.index > a && m.index < b);
    assert.ok(inside, `animation at index ${m.index} is outside a reduced-motion guard`);
  }
});

test("only shape re-declares the ring background; states rebind the stops", () => {
  const declaring = RULES
    .filter((r) => /\.sl-fx-(?:glass|aurora)/.test(r.selector) && /::(?:before|after)/.test(r.selector) && PAINTS.test(r.body))
    .map((r) => r.selector);
  assert.equal(
    declaring.length, 9,
    `exactly nine edge rules may declare a background, got: ${JSON.stringify(declaring)}`,
  );
  // The ninth is the loading filaments (2026-09-12): spokes hanging into the
  // pane from the travelling band, in the accent. They are a light of their
  // own — the band they fall from cannot be seen to bend, and they can — so
  // their background IS the light, like the beam's and the pillars'.
  assert.ok(
    declaring.some((s) => /data-sl-fx-live="busy"[^,]*::after$/.test(s)),
    "the loading filaments must be one",
  );
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
    if (!/^\.[a-z0-9-]+$/.test(sel)) continue;
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
