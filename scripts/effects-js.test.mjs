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

test("mountGpu() refuses to bring Tier 2 up under high contrast", () => {
  // A CSS kill switch cannot silence a canvas, so the refusal has to live in
  // the module. mount()'s own guard is not enough: `armed` latches true, and a
  // visitor can switch to high contrast between mount() and this call.
  const body = fnBody("mountGpu");
  const guard = body.indexOf('"high-contrast"');
  const attach = body.indexOf('createElement("canvas")');
  assert.ok(guard > -1, "mountGpu() must consult the theme");
  assert.ok(attach > -1, "mountGpu() must create the canvas it guards");
  assert.ok(guard < attach, "the high-contrast guard must precede the canvas, not follow it");
  assert.match(
    guardStatement(body, '"high-contrast"'), /return false/,
    "the high-contrast guard must return, not merely branch",
  );
});

test("a switch to high contrast tears a live Tier 2 down", () => {
  // The guard above only covers the moment of mounting. Once the field is up,
  // nothing in CSS can stop it painting, so the theme observer inside
  // bootField() has to stop() outright — which also restores the CSS ring, by
  // removing the attribute that stood it down.
  const gpu = readFileSync(resolve(HERE, "../packages/ui-kit/effects-gpu.js"), "utf8");
  const at = gpu.indexOf("themeObserver = new MutationObserver");
  assert.ok(at > -1, "bootField() must observe the theme");
  const block = gpu.slice(at, gpu.indexOf("themeObserver.observe", at));
  assert.match(block, /"high-contrast"/, "the theme observer must recognise high contrast");
  assert.match(block, /stop\(\)/, "high contrast must tear the field down, not merely re-read tokens");
});

test("burst drops an overlapping burst rather than queueing it", () => {
  const body = fnBody("burst");
  assert.match(
    body, /if\s*\([^)]*burstActive[^)]*\)\s*return;/,
    "an in-flight burst must cause an early return",
  );
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
  // Scoped to hosts. The lens is a canvas this layer owns, holding a copy of
  // the page, and filtering THAT is the whole mechanism; filtering a host
  // would warp its own content, which is the lens the owner refused.
  const writes = [...js.matchAll(/(\w+)\.style\.filter\s*=/g)].map((m) => m[1]);
  assert.deepEqual(writes, ["lens"], `only the lens may be filtered, got ${JSON.stringify(writes)}`);
  assert.doesNotMatch(js, /setProperty\(\s*["']filter["']/, "and never through a custom property on a host");
  assert.doesNotMatch(js, /\.style\.border(?:Radius|Color|TopColor|Image)\s*=|setProperty\(\s*["']border-/, "no border property may be written onto an element");
  // Scoped to the skin's own builder: glass displaces a copy of the page, but
  // the skin must stay a shape.
  const skin = js.slice(js.indexOf("function buildSkin("), js.indexOf("function cornerPx("));
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

test("a pill radius is clamped to what the browser actually paints", () => {
  // --sl-radius-pill is 9999px. CSS reduces a radius that cannot fit to half
  // the shorter side, so a 40px round button paints a 20px circle. Without the
  // clamp the skin traced its outline against 9999px and nearestEdge answered
  // with a point on that imaginary shape: the drop was written thousands of
  // pixels from the element. The gooey was not faint on round buttons — the
  // one silhouette it exists for — it was somewhere else entirely.
  const from = js.indexOf("function cornerPx(");
  assert.ok(from > 0, "the helper must be findable");
  const body = js.slice(from, js.indexOf("\n}\n", from) + 3);
  const cornerPx = new Function(`${body}; return cornerPx;`)();
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
  // Bounded at onPanePointer, not at onPaneLeave: the pane driver in between
  // reads borderTopLeftRadius legitimately, to hand the Tier 2 light the
  // element's own corner. What must not measure a radius is the liquid's gate.
  const pointer = js.slice(js.indexOf("function onPointerMove("), js.indexOf("function onPanePointer("));
  assert.doesNotMatch(pointer, /borderRadius|borderTopLeftRadius|Radius/, "no radius may be measured to decide who goes gooey");
});

test("a pointer leaving a child of the host does not release the host", () => {
  // pointerleave does not bubble, but the listener is delegated in the
  // capture phase, so it fires for every child the pointer leaves — the
  // icon inside a round button, the glitch span inside a text button. The
  // liquid dipped to zero on every one of those before the next move.
  for (const name of ["onPointerLeave", "onPaneLeave"]) {
    const body = js.slice(js.indexOf(`function ${name}(`));
    assert.match(body.slice(0, 500), /ev\.target !== el\) return/, `${name} must release only on the host's own leave`);
  }
});

test("the pane writes nothing onto the host but custom properties", () => {
  // The pane is CSS drawing from three numbers; the driver may write where
  // the pointer is, its bearing and how lit the pane is, and nothing else —
  // no colour, no filter, no background, no geometry — so a pane the pointer
  // has left is exactly what it was.
  const pane = js.slice(js.indexOf("const PANE_HOSTS"), js.indexOf("/* ── glitch"));
  const writes = [...pane.matchAll(/style\.setProperty\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(writes.length >= 3, "the pane driver must write its properties");
  for (const w of writes) assert.match(w, /^--slfx-/, `the pane may only write --slfx-* properties, wrote ${w}`);
  assert.doesNotMatch(pane, /\.style\.(?:background|filter|color|border|transform)/, "no real property may be written by the pane");
  const cleared = pane.match(/removeProperty\(k\)/);
  assert.ok(cleared, "the properties must be removed when the pane goes dark");
  assert.match(pane, /paneTarget === 0 && paneLit < PANE_SETTLE[\s\S]*?paneRafId = 0;[\s\S]*?setPaneLive\(null\);\s*return;/, "the loop must stop itself once dark");
});
