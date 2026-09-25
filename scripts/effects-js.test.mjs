import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = resolve(HERE, "../packages/ui-kit/effects.js");
const js = readFileSync(MODULE, "utf8");
const load = () => import(pathToFileURL(MODULE).href);

/** The body of a top-level exported function, so an assertion can be about
 *  ORDER inside it rather than about a string existing somewhere in the file. */
function fnBody(name) {
  const start = js.search(new RegExp(`export (?:async )?function ${name}\\b`));
  assert.ok(start > -1, `missing export: ${name}`);
  // Step over the parameter list first. A destructured default such as
  // `{ burstMin = 200 }` puts a brace before the body, so the first `{` after
  // the function name is not the body's.
  let i = js.indexOf("(", start);
  let depth = 0;
  do {
    if (js[i] === "(") depth++;
    else if (js[i] === ")") depth--;
    i++;
  } while (depth > 0 && i < js.length);
  const open = js.indexOf("{", i);
  depth = 0;
  i = open;
  do {
    if (js[i] === "{") depth++;
    else if (js[i] === "}") depth--;
    i++;
  } while (depth > 0 && i < js.length);
  return js.slice(open + 1, i - 1);
}

// 2026-09-12: the aurora's light is the curtains, and the reason is measured —
// a wash that follows the edge it hugs is the one shape a lens cannot be seen
// to bend (0.93% of pixels moved, against 5.00% for the curtains). So a seated
// glow carries the pillars unless its host asks for one of the lights whose
// geometry is not the box: the rotation, the beam, the rim, the linear segment.
test("the seated glow carries the curtains unless the host asks for another light", () => {
  const body = js.slice(js.indexOf("function injectGlow"));
  const block = body.slice(0, body.indexOf("\nfunction "));
  assert.match(block, /wantsPillars/, "the default has to be decided, not assumed");
  const own = block.match(/const OWN_LIGHT = \[([^\]]*)\]/);
  assert.ok(own, "the lights that paint their own must be named in one list");
  for (const mode of ["sweep", "beam", "rim"]) {
    assert.match(own[1], new RegExp(`"${mode}"`), `--${mode} paints its own light, so it must opt out of the curtains`);
  }
  // --linear is deliberately absent: GLOW_HOSTS never gives it a glow at all.
  assert.match(js, /GLOW_HOSTS = "\.sl-fx-aurora:not\(\.sl-fx-aurora--linear\)"/);
  assert.match(block, /contains\("sl-fx-aurora--pillars"\)/, "--pillars must keep meaning for markup that already says it");
});

// Regression, 2026-09-12 (lab/1w): the bloom's inward reach is read on the
// seated glow's ::before, and a seated glow is the host's SIBLING — it inherits
// nothing from the host. Every variable the glow paints from has to be in the
// list effects.js copies across at seat time, or a component that rebinds it
// is silently ignored.
test("the seated glow copies the bloom's inward reach from its host", () => {
  const list = js.match(/const GLOW_VARS = \[([^\]]*)\]/);
  assert.ok(list, "GLOW_VARS must be a literal array");
  assert.match(list[1], /"--slfx-bleed"/, "--slfx-bleed is painted by the glow's ::before and declared on the host");
});

// The audit reads CSS only, so a literal here would pass the gate while
// breaking the contract. Cover every CSS colour function, not just rgb() —
// `color-mix(` is deliberately not matched, since it takes role-vars.
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;

test("effects.js contains no colour literal", () => {
  const hits = js.match(COLOUR) || [];
  assert.deepEqual(hits, [], `hues must be read from tokens with getComputedStyle, found: ${hits}`);
});

test("effects.js exports the documented API", () => {
  for (const name of ["mount", "burst", "scramble", "grantLive", "revokeLive", "mountGpu"]) {
    assert.match(js, new RegExp(`export (async )?function ${name}\\b`), `missing export: ${name}`);
  }
});

test("importing the module has no side effects", async () => {
  // Node has no `document` and no `window`, so ANY top-level DOM access throws
  // a ReferenceError here. Executing the module beats guessing at its shape:
  // a regex for `^document\.` missed indented and `window.`-prefixed access.
  await assert.doesNotReject(load);
});

/** The single statement a guard opens: from its text to its first `;`.
 *  Bounding to the statement matters — mount()'s two guards sit three lines
 *  apart, and a window spanning both accepted either one's `return false` as
 *  evidence for the other, so gutting one guard alone went undetected. */
function guardStatement(body, needle) {
  const at = body.indexOf(needle);
  assert.ok(at > -1, `guard not found: ${needle}`);
  return body.slice(at, body.indexOf(";", at) + 1);
}

test("mount() refuses to arm Tier 1 under reduced motion", () => {
  const body = fnBody("mount");
  const guard = body.indexOf("matchMedia(REDUCE).matches");
  const arm = body.indexOf('setAttribute("data-sl-fx", "on")');
  assert.ok(guard > -1, "mount() must consult the reduced-motion query");
  assert.ok(arm > -1, "mount() must arm Tier 1 by setting data-sl-fx");
  assert.ok(guard < arm, "the reduced-motion guard must precede arming, not follow it");
  assert.match(
    guardStatement(body, "matchMedia(REDUCE).matches"), /return false/,
    "the reduced-motion guard must return, not merely branch",
  );
});

test("mount() refuses to arm Tier 1 under high contrast", () => {
  const body = fnBody("mount");
  const guard = body.indexOf('"high-contrast"');
  const arm = body.indexOf('setAttribute("data-sl-fx", "on")');
  assert.ok(guard > -1, "mount() must consult the theme");
  assert.ok(guard < arm, "the high-contrast guard must precede arming");
  assert.match(
    guardStatement(body, '"high-contrast"'), /return false/,
    "the high-contrast guard must return, not merely branch",
  );
});

test("mountGpu() is retired and resolves false", () => {
  // Tier 2 drew the glass edge as WebGPU chrome; the edge is the CSS specular
  // arc since 2026-09-24. The export stays for its callers and resolves false,
  // the answer a browser without WebGPU always got.
  const body = fnBody("mountGpu");
  assert.match(body, /^\s*\{?\s*return false;\s*\}?\s*$/, "mountGpu() must do nothing but resolve false");
  assert.doesNotMatch(js, /import\(["']\.\/effects-gpu\.js["']\)/, "nothing may load the retired GPU module");
});


test("burst drops a burst over the budget rather than queueing it", () => {
  const body = fnBody("burst");
  assert.match(
    body, /if\s*\([^)]*burstsRunning >= burstBudget[^)]*\)\s*return;/,
    "a burst over the ceiling must cause an early return",
  );
  // The ceiling is the consumer's and the DEFAULT IS STILL ONE: a surface that
  // says nothing behaves exactly as it did when the budget was a boolean.
  assert.match(js, /let burstBudget = 1;/, "one, until someone decides otherwise");
  assert.match(js, /burstBudget = Math\.max\(1, Math\.floor\(bursts\)\);/, "and it can never be raised below one");
  assert.doesNotMatch(
    body, /setTimeout\([^)]*\bburst\s*\(/,
    "a dropped burst must not be re-scheduled — a queue reads as breakage, not as signal",
  );
});

test("burst refuses a detached element", () => {
  assert.match(
    fnBody("burst"), /isConnected/,
    "a burst on a detached node leaves a timer mutating something nothing can see",
  );
});

test("burst does nothing before mount() has armed Tier 1", async () => {
  const { burst } = await load();
  const el = {
    isConnected: true,
    classList: { add: () => assert.fail("burst must not fire before mount() arms Tier 1") },
    style: { setProperty() {} },
    querySelectorAll: () => [],
  };
  burst(el);
});

test("the ambient aurora is granted to one element at a time", async () => {
  const { grantLive, revokeLive } = await load();
  const make = () => {
    const attrs = {};
    return {
      attrs,
      setAttribute: (k, v) => { attrs[k] = v; },
      removeAttribute: (k) => { delete attrs[k]; },
    };
  };
  const first = make();
  const second = make();
  grantLive(first);
  assert.equal(first.attrs["data-sl-fx-live"], "on");
  grantLive(second);
  assert.equal(first.attrs["data-sl-fx-live"], undefined, "the previous holder falls back to its resting ring");
  assert.equal(second.attrs["data-sl-fx-live"], "on");
  revokeLive(second);
  assert.equal(second.attrs["data-sl-fx-live"], undefined);
});

test("the liquid never filters, re-radiuses or re-colours the host", () => {
  // The silhouette deforms; the content does not. effects.js draws the swell
  // on its own <svg> skin and its goo filter is applied to the skin's groups,
  // never to the host. It reads the host's radii and colours; it never
  // writes them — a rewritten radius would break a component's own
  // --sl-radius-* contract, and a rewritten border-color would freeze the
  // hover state the skin is supposed to follow.
  // Nothing in this layer writes a filter onto anything. This used to allow one
  // exception — the lens, a canvas holding a copy of the page, where filtering
  // was the whole mechanism. The lens was removed on 2026-09-11 in favour of a
  // declared backdrop, so the rule is now the stronger one it always wanted to
  // be: no element is filtered by this layer at all.
  const writes = [...js.matchAll(/(\w+)\.style\.filter\s*=/g)].map((m) => m[1]);
  assert.deepEqual(writes, [], `this layer filters nothing, got ${JSON.stringify(writes)}`);
  assert.doesNotMatch(js, /setProperty\(\s*["']filter["']/, "and never through a custom property on a host");
  assert.doesNotMatch(js, /\.style\.border(?:Radius|Color|TopColor|Image)\s*=|setProperty\(\s*["']border-/, "no border property may be written onto an element");
  // Scoped to the skin's own builder: glass displaces a copy of the page, but
  // the skin must stay a shape.
  const skin = js.slice(js.indexOf("function buildSkin("), js.indexOf("function nearestEdge("));
  assert.doesNotMatch(skin, /feDisplacementMap|feImage/, "the skin is a shape, not a lens");
  assert.match(js, /<g filter="url\(#slfx-goo\)">/, "the goo filter sits on the skin's own group");
});

test("one skin, parented into one live element at a time", async () => {
  // The skin is a single module-level element. Before it is parented into a
  // new host it must leave the previous one — otherwise two elements would
  // carry the same silhouette, or the old host would keep a stale one.
  assert.match(js, /function buildSkin\(\)\s*\{\s*if \(skin\) return;/, "the skin is built once");
  const set = js.slice(js.indexOf("function setLiquidLive("));
  const leave = set.indexOf("skin?.remove()");
  const enter = set.indexOf("el.appendChild(skin)");
  assert.ok(leave > -1 && enter > -1, "setLiquidLive must move the skin");
  assert.ok(leave < enter, "the skin must leave the previous host before it enters the next");
  assert.match(js, /liquidLiveEl\.classList\.remove\("is-liquid-live"\)/, "the previous host must lose its live class");
});

test("the coordinator never touches the busy value", () => {
  // Busy auroras are the consumer's and are exempt from the budget: they are
  // bound to real work, and several can legitimately run at once.
  assert.doesNotMatch(fnBody("grantLive"), /busy/);
  assert.doesNotMatch(fnBody("revokeLive"), /busy/);
});

test("a pill radius is clamped to what the browser actually paints", async () => {
  // --sl-radius-pill is 9999px. CSS reduces a radius that cannot fit to half
  // the shorter side, so a 40px round button paints a 20px circle. Without the
  // clamp the skin traced its outline against 9999px and nearestEdge answered
  // with a point on that imaginary shape: the drop was written thousands of
  // pixels from the element. The gooey was not faint on round buttons — the
  // one silhouette it exists for — it was somewhere else entirely.
  // Imported, not sliced out of the source: it lives in geom.js now, shared
  // with the field family, and rebuilding it from a byte offset was a test
  // mechanism that broke every time the file moved.
  const { cornerPx } = await import("../packages/ui-kit/geom.js");
  assert.equal(cornerPx("9999px", 40, 40), 20, "a pill on a 40px box paints a circle");
  assert.equal(cornerPx("9999px", 200, 40), 20, "and is bounded by the SHORTER side");
  assert.equal(cornerPx("6px", 200, 40), 6, "a radius that fits is untouched");
  assert.equal(cornerPx("50%", 40, 60), 20, "a percentage is of the shorter side");
  assert.equal(cornerPx("auto", 40, 40), 0, "an unparseable radius is none");
});

test("the gooey engages only behind a modifier written in the markup", () => {
  // The owner: the gooey works on round buttons alone, and is not applied to
  // other elements such as cards. The gate is one class the consumer writes —
  // --drop on a round icon-only button — and never a measured radius: a
  // geometric heuristic misfires
  // the moment a component re-parametrises --sl-radius-*, which this layer
  // has twice promised not to break under. A bare .sl-fx-liquid is inert.
  assert.match(js, /const LIQUID_HOSTS = "\.sl-fx-liquid\.sl-fx-liquid--drop";/);
  assert.doesNotMatch(js, /sl-fx-liquid--calm/, "a container takes no swell at all");
  assert.doesNotMatch(js, /closest\("\.sl-fx-liquid"\)/, "the pointer path must not match a bare .sl-fx-liquid");
  assert.match(js.slice(js.indexOf("function onPointerMove(")), /closest\(LIQUID_HOSTS\)/);
  const pointer = js.slice(js.indexOf("function onPointerMove("), js.indexOf("function onPointerLeave("));
  assert.doesNotMatch(pointer, /borderRadius|borderTopLeftRadius|Radius/, "no radius may be measured to decide who goes gooey");
});

test("a pointer leaving a child of the host does not release the host", () => {
  // pointerleave does not bubble, but the listener is delegated in the
  // capture phase, so it fires for every child the pointer leaves — the
  // icon inside a round button, the glitch span inside a text button. The
  // liquid dipped to zero on every one of those before the next move.
  for (const name of ["onPointerLeave"]) {
    const body = js.slice(js.indexOf(`function ${name}(`));
    assert.match(body.slice(0, 500), /ev\.target !== el\) return/, `${name} must release only on the host's own leave`);
  }
});

test("the specular edge writes nothing onto the host but its two properties", () => {
  // The edge is CSS drawing from two numbers: the light's bearing and how lit
  // the edge is. No colour, no filter, no geometry — so a host the light has
  // left is exactly what it was.
  const spec = js.slice(js.indexOf("const SPEC_HOSTS"), js.indexOf("/* ── press:"));
  const writes = [...spec.matchAll(/style\.setProperty\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(writes.sort(), ["--slfx-spec-a", "--slfx-spec-i"], `wrote ${writes}`);
  assert.doesNotMatch(spec, /\.style\.(?:background|filter|color|border|transform)/, "no real property may be written");
  for (const k of ["--slfx-spec-a", "--slfx-spec-i"]) {
    assert.match(spec, new RegExp(`removeProperty\\("${k}"\\)`), `${k} must be removed when the edge goes dark`);
  }
  assert.match(spec, /specRafId = lit \? requestAnimationFrame\(integrateSpec\) : 0;/, "the loop must stop itself once every edge is dark");
});

test("the reduced-motion derogation is narrow, opt-in, and named so a reader cannot mistake it", async () => {
  // A product may have a documented reason to animate for a visitor reporting
  // the preference. The escape is the consumer's to take and to justify, so it
  // is a named option rather than a default, it writes an attribute the CSS
  // reads (so both decline together or not at all), and it reaches the glitch
  // alone — never high contrast, which is a different requirement.
  const body = fnBody("mount");
  assert.match(js, /export function mount\(root = document, \{ ignoreReducedMotion = false, bursts = 1 \} = \{\}\)/,
    "it must be an explicit, defaulted option");
  assert.match(body, /if \(ignoreReducedMotion\) html\.setAttribute\("data-sl-fx-motion", "always"\);/,
    "and it must publish itself to the stylesheet");
  assert.match(body, /matchMedia\(REDUCE\)\.matches && !ignoreReducedMotion\) return false;/,
    "only then does the motion guard stand down");

  // High contrast is refused before the derogation is even read.
  const hc = body.indexOf('"high-contrast"');
  const derogation = body.indexOf("ignoreReducedMotion");
  assert.ok(hc > -1 && hc < derogation, "high contrast must refuse first, and unconditionally");

  // suppressed() gates burst()/scramble(); it must honour the same attribute,
  // or a derogated document would arm Tier 1 and still drop every burst.
  assert.match(js, /return window\.matchMedia\(REDUCE\)\.matches && !motionDerogated\(\);/,
    "the burst gate must read the same derogation");
  const derogate = js.slice(js.indexOf("function motionDerogated()"), js.indexOf("function suppressed()"));
  assert.doesNotMatch(derogate, /high-contrast/, "the derogation may not know about high contrast");
});

test("Tier 1 watches what is near the viewport, with a margin", () => {
  // "near" rather than "visible": the margin arms an element before it
  // arrives, because a pane that blurs in as it crosses the fold is worse than
  // one that was always blurred.
  assert.match(js, /const NEAR_MARGIN = "200px";/, "the margin is what makes it 'near'");
  assert.match(js, /rootMargin: NEAR_MARGIN/, "and it must reach the observer");
  assert.match(js, /e\.target\.toggleAttribute\("data-sl-fx-near", e\.isIntersecting\)/,
    "the attribute tracks intersection in both directions");
  assert.match(js, /const NEAR_HOSTS = "\.sl-fx-glass, \.sl-fx-aurora";/, "the two families that cost something off-screen");

  // One observer for the document, not one per element, and elements arriving
  // later are picked up by the same MutationObserver that arms everything else.
  assert.match(js, /if \(!nearObserver\) \{/, "one observer for the document, built once and reused");
  // The margin is the house's: the lazy backdrop paint already arms 200px
  // early for the same reason, and the two must not drift apart.
  const margins = [...js.matchAll(/rootMargin:\s*([^,}]+)/g)].map((m) => m[1].trim());
  assert.deepEqual(margins, ["NEAR_MARGIN"], `every observer takes the same margin, got ${margins}`);
  const mounted = fnBody("mount");
  assert.match(mounted, /watchNear\(root\)/, "mount() must start it");
  assert.match(js, /watchNear\(n\);/, "and late arrivals must be picked up too");

  // It must degrade, not throw, where the API is absent.
  assert.match(js, /if \(typeof IntersectionObserver !== "function"\) return;/, "absent API is a no-op, not a crash");
});

test("the viewport gate fails open", () => {
  // An IntersectionObserver that never delivers — a background tab, a headless
  // capture, a harness that suppresses it — must not leave a page stripped of
  // its material. Hosts are marked near BEFORE they are observed, so the
  // observer's only job is to take the mark away.
  const fn = js.slice(js.indexOf("function watchNear("), js.indexOf("function motionDerogated("));
  const marked = fn.indexOf('el.toggleAttribute("data-sl-fx-near", true);');
  const observed = fn.indexOf("nearObserver.observe(el);");
  assert.ok(marked > -1 && observed > -1, "watchNear must mark and observe");
  assert.ok(marked < observed, "the mark must be written before the observer can contradict it");
});

test("autoBurst and hoverBurst are the kit's, and each hands back a stop", () => {
  // Both came from sondalab-site, whose driver is this module's ancestor:
  // ambient re-resolution and a pointer-driven one are real uses the kit did
  // not cover, so nine call sites had to keep a parallel implementation.
  const auto = fnBody("autoBurst");
  assert.match(auto, /\bburst\(el, \{ burstMin, burstMax \}\)/, "the ambient loop must go through burst(), budget and all");
  assert.match(auto, /if \(stopped \|\| !el\?\.isConnected\) return;/, "and let itself go when the element leaves the document");
  assert.match(auto, /return \(\) => \{ stopped = true; clearTimeout\(timer\); \};/, "callers get a stop");

  // hoverBurst is the one path past the budget, and deliberately: a hover is a
  // direct answer to the pointer, and dropping it because something ambient is
  // mid-burst would make the surface feel unresponsive exactly when asked.
  const hover = fnBody("hoverBurst");
  assert.doesNotMatch(hover, /\bburst\(/, "a hover must not be dropped by the ambient budget");
  assert.match(hover, /if \(!active \|\| suppressed\(\) \|\| !targetEl\?\.isConnected\) return;/,
    "…but it still honours the kill switches and a detached target");
  assert.match(hover, /hoverEl\.removeEventListener\("pointerenter", enter\)/, "its stop releases the listeners");
  assert.match(hover, /pointerenter|pointerleave/, "pointer events, not mouse events");
});

test("material survives a motion preference; motion does not", () => {
  // A lens and the glass layers are STATIC properties of a surface: they do not
  // animate and they do not redraw on scroll. lensRefused() has argued exactly
  // that in its own comment since it was written, and the call site said
  // otherwise — armLenses() sat after the motion guard, so a visitor reporting
  // the preference got no lens. injectGlassLayers() sat there too, and that is
  // the larger half: those children ARE the material, since glass.css puts the
  // backdrop-filter on .sl-glass__backdrop.
  const body = fnBody("mount");
  const guard = body.indexOf("matchMedia(REDUCE).matches && !ignoreReducedMotion) return false;");
  assert.ok(guard > -1, "the motion guard must still be there");

  for (const call of ["injectGlassLayers(root);", "armLenses(root);", "watchLensTheme(root);", "mountGoo(root);"]) {
    const at = body.indexOf(call);
    assert.ok(at > -1, `mount() must call ${call}`);
    assert.ok(at < guard, `${call} is material, not motion — it must come BEFORE the guard`);
  }
  // …and what genuinely moves must stay behind it.
  for (const call of ["injectGlows(root);", "watchNear(root);"]) {
    const at = body.indexOf(call);
    assert.ok(at > guard, `${call} belongs to Tier 1 and must stay after the guard`);
  }

  // A page that refuses below still has to dress an element rendered later, so
  // the material needs its own observer on the near side of the guard.
  const beforeGuard = body.slice(0, guard);
  assert.match(beforeGuard, /new MutationObserver\([\s\S]*?injectGlassLayers\(n\);[\s\S]*?armLenses\(n\);/,
    "late arrivals must get the material even when Tier 1 refused");
  assert.doesNotMatch(beforeGuard, /injectGlows\(n\)/, "…but not the moving layers");

  // High contrast is a different requirement and still refuses everything.
  const hc = body.indexOf('"high-contrast"');
  assert.ok(hc > -1 && hc < body.indexOf("injectGlassLayers(root);"), "high contrast refuses first");
});

test("the specular edge springs its direction as a vector, frame-rate independent", () => {
  // The owner's note on the first probe: a pointer crossing the element made
  // the light switch sides almost at once. Sprung as a vector, a crossing
  // dims, turns and re-brightens instead of snapping 180 degrees.
  const spec = js.slice(js.indexOf("const SPEC_HOSTS"), js.indexOf("/* ── press:"));
  assert.match(spec, /s\.dx \+= \(nx - s\.dx\) \* kd;/, "the direction's x is sprung");
  assert.match(spec, /s\.dy \+= \(ny - s\.dy\) \* kd;/, "and its y");
  assert.match(spec, /Math\.hypot\(s\.dx, s\.dy\)/, "the vector's length dims the arc through a crossing");
  assert.match(spec, /\*\* \(dt \* 60\)/, "the spring rate must follow the real frame time");
  const reach = Number(/const SPEC_REACH = (\d+);/.exec(spec)[1]);
  assert.ok(reach > 0 && reach <= 200, `the edge wakes before the pointer arrives, within reason (${reach}px)`);
});

/* ── the curtains fit the pane they hang in ──────────────────────────────── */

const css = readFileSync(resolve(HERE, "../packages/ui-kit/effects.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** The balanced block that follows `at`, braces included. */
function blockAt(src, at) {
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error("unbalanced block");
}

const pillarsRule = blockAt(css, css.search(/\.sl-fx-aurora__glow\[data-sl-fx-seated\]\[data-sl-fx-pillars\]\s*\{/));
// The combs are painted on the glow's ::before, not on the glow itself, and
// that selector is long enough that matching it is its own trap — so find the
// declaration and take the block around it.
const pillarsPaint = (() => {
  const at = css.indexOf("--slfx-pillar-a");
  assert.ok(at > -1, "the curtains must still be painted");
  return blockAt(css, css.lastIndexOf("{", at) - 1);
})();

test("every curtain measurement is a fraction of one pitch", () => {
  // The pattern was fitted at 104px on a 320px card and left at that length it
  // does not scale: a 1104px row showed nine ribs where the card it was
  // measured on showed three. Both combs, both tiles and the sway now derive
  // from one length, so changing it scales the pattern and never its
  // proportions — which is the only reason the pair still beats as measured.
  const gradients = /background:\s*([\s\S]*?);/.exec(pillarsPaint)[1];
  assert.match(gradients, /--slfx-pillar-pitch/, "the stops must derive from the pitch");
  assert.doesNotMatch(gradients, /\b\d+px\b/, "no stop may keep a fitted pixel figure of its own");

  const size = /background-size:\s*([\s\S]*?);/.exec(pillarsPaint)[1];
  assert.doesNotMatch(size, /\b\d+px\b/, "the tiles scale with the pattern they carry");

  const sway = /@keyframes\s+slfx-pillars-drift\s*\{[\s\S]*?\n\s*\}/.exec(css)[0];
  assert.match(sway, /--slfx-pillar-pitch/, "a fixed sway is a twitch on a wide curtain");
  assert.doesNotMatch(sway, /-?\d+px/, "and a lean on a narrow one");
});

test("a page that never mounts keeps the pattern it was fitted with", () => {
  // The pitch comes from seatGlow(), so Tier 0 has to carry the measured value
  // itself or a consumer without JS loses the curtains' shape entirely.
  const fallback = /--slfx-pillar-pitch:\s*(\d+)px/.exec(pillarsRule);
  assert.ok(fallback, "the pillars glow must declare a Tier 0 pitch");
  assert.equal(fallback[1], "104", "and it is the figure the pattern was fitted at");
});

test("the count is what an author binds, and the width follows the host", () => {
  const body = js.slice(js.indexOf("function seatGlow"), js.indexOf("function injectGlow"));
  assert.match(body, /--slfx-pillar-count/, "the author's knob is a COUNT, not a length");
  assert.match(body, /--slfx-pillar-pitch.*r\.width \/ count/s, "and the width is the host's own, divided by it");
  assert.match(js, /const PILLAR_COUNT = 3;/, "three across the pane is what it was fitted at");
  // seatGlow is what runs on every resize, which is why the division lives
  // there rather than at injection.
  assert.match(js, /new ResizeObserver\(\(\) => seatGlow\(el, glow\)\)/, "so a resize re-fits it");
});

test("no two panes drift in step, and the offset is stable", () => {
  const body = js.slice(js.indexOf("function seatGlow"), js.indexOf("function injectGlow"));
  assert.match(body, /--slfx-pillar-phase/, "each glow carries a phase of its own");
  assert.match(js, /const PHI = 0\.618033988749895;/, "spread by the golden ratio");
  // Stable across a re-render: a curtain that jumped to a new phase on every
  // navigation would flicker for nothing. The ordinal is remembered per host.
  assert.match(js, /function glowOrdinal/, "the ordinal is derived, not rolled");
  assert.match(js, /ordinals\.set\(id, ordinals\.size\)/, "and remembered, so a resize does not reshuffle the page");

  // The delay has to reach BOTH clocks, with different multipliers: the
  // breathe and the drift are the pair that beats, and one offset for both
  // would move the formation rather than break it.
  const anims = [...css.matchAll(/animation:\s*slfx-pillars-(breathe|drift)[^;]*;/g)].map((m) => m[0]);
  assert.equal(anims.length, 2, "both pillars clocks must be declared");
  for (const a of anims) assert.match(a, /--slfx-pillar-phase/, `${a.slice(0, 40)}… must take the phase`);
  const mults = anims.map((a) => /\* (-[\d.]+)s/.exec(a)[1]);
  assert.notEqual(mults[0], mults[1], "one offset for both clocks only moves the formation");
});

test("a seated glow swells with the pane it hangs in", () => {
  // The glow is the host's previous SIBLING, so a transform on the host reaches
  // it not at all: the pane grew under the pointer and its curtains stayed the
  // size they were, which reads as the light sliding out from under the glass.
  const paneScale = (state) => {
    const at = css.search(new RegExp(`\\.sl-fx-glass--pane${state}[^{]*\\{`));
    assert.ok(at > -1, `the pane must still have a ${state} scale`);
    return /transform:\s*scale\(([\d.]+)\)/.exec(blockAt(css, at))?.[1];
  };
  const glowScale = (state) => {
    const at = css.search(new RegExp(`\\.sl-fx-aurora__glow\\[data-sl-fx-seated\\]:has\\(\\+ \\.sl-fx-glass--pane${state}`));
    assert.ok(at > -1, `the glow must mirror the pane's ${state}`);
    return /transform:\s*scale\(([\d.]+)\)/.exec(blockAt(css, at))?.[1];
  };
  for (const state of [":hover", ":active"]) {
    assert.equal(glowScale(state), paneScale(state), `${state}: the light must swell exactly as its pane does`);
  }

  // …and on the same curves. A glow easing differently from the pane it hangs
  // in is the same defect one step smaller.
  const glowRest = blockAt(css, css.search(/\.sl-fx-aurora__glow\[data-sl-fx-seated\]\s*\{\s*\n?\s*transition:/));
  assert.match(glowRest, /transform 420ms cubic-bezier\(0\.22, 0\.61, 0\.28, 1\)/,
    "the way out is the pane's own curve");
  assert.match(glowRest, /opacity/, "and lighting up is still a fade, not a jump");
});

test("the press writes nothing but its three properties, and lets go when dark", () => {
  const press = js.slice(js.indexOf("const PRESS_HOSTS"), js.indexOf("/* ── glitch"));
  const writes = [...press.matchAll(/style\.setProperty\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(writes)].sort(), ["--slfx-press", "--slfx-spill", "--slfx-spill-a"], `wrote ${writes}`);
  assert.doesNotMatch(press, /\.style\.(?:background|filter|color|border|transform)/, "no real property may be written");
  assert.match(press, /for \(const k of \["--slfx-press", "--slfx-spill", "--slfx-spill-a"\]\) el\.style\.removeProperty\(k\);/,
    "all three leave when the host goes dark");
  assert.match(press, /pressRafId = lit \? requestAnimationFrame\(integratePress\) : 0;/, "the loop stops itself");
  const reach = Number(/const PRESS_REACH = (\d+);/.exec(press)[1]);
  assert.ok(reach > 0 && reach <= 64, `neighbours within reach only (${reach}px)`);
  // Falls slower than it rises: a release must not snap the room dark.
  const tin = Number(/const PRESS_TAU_IN = ([\d.]+);/.exec(press)[1]);
  const tout = Number(/const PRESS_TAU_OUT = ([\d.]+);/.exec(press)[1]);
  assert.ok(tout > tin, `fade (${tout}) slower than rise (${tin})`);
});

test("a keyboard press is the same act as a click", () => {
  const press = js.slice(js.indexOf("const PRESS_HOSTS"), js.indexOf("/* ── glitch"));
  assert.match(press, /ev\.key !== "Enter" && ev\.key !== " "/, "Enter and Space press");
  const mounted = fnBody("mount");
  for (const ev of ['"pointerdown", onPressDown', '"keydown", onPressKey', '"keyup", onPressKey', '"pointerup", pressEnd', '"pointercancel", pressEnd']) {
    assert.ok(mounted.includes(ev), `mount() must listen for ${ev}`);
  }
});
