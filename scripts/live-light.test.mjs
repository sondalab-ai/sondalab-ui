import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// Re-scope R3 (docs/specs/2027-improve-aesthetics.md): the aurora's run and
// busy readings as light with body. The CSS arc is the fallback, so what this
// module refuses matters as much as what it draws.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "live-light.js"), "utf8");
const css = readFileSync(resolve(KIT, "effects.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const comp = readFileSync(resolve(KIT, "components.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;

test("live-light.js contains no colour literal: hues come from role variables", () => {
  assert.deepEqual(js.match(COLOUR) || [], []);
  assert.match(js, /roleColour\(el, mode === "run" \? "--slfx-light-a" : "--slc-accent"\)/, "run takes the light, busy the accent");
  assert.match(js, /roleColour\(el, mode === "run" \? "--slfx-light-b" : "--slfx-depth"\)/, "and its second body");
});

test("importing the module has no side effects", async () => {
  await assert.doesNotReject(import(pathToFileURL(resolve(KIT, "live-light.js")).href));
});

test("the CSS arc keeps what the canvas refuses", () => {
  const wanted = js.slice(js.indexOf("function wanted("), js.indexOf("function attach("));
  assert.match(wanted, /\.sl-fx-aurora--linear, \.sl-fx-aurora--rim/, "a linear or rim aurora keeps the CSS reading");
  assert.match(wanted, /--slfx-progress/, "a determinate one keeps its arc: the length IS the value");
  assert.match(wanted, /data-sl-fx="off"/, "the subtree opt-out");
  assert.match(wanted, /"high-contrast"/, "and high contrast");
  const max = Number(/const MAX_LIVE = (\d+);/.exec(js)[1]);
  assert.ok(max > 0 && max <= 12, `a bounded number of WebGL contexts (${max})`);
  assert.match(js, /if \(!gl\) return;/, "no WebGL, no canvas: the arc stays");
});

test("reduced motion draws one still frame and never loops", () => {
  assert.match(js, /if \(draw\([^)]*\) && moving\(\)[^)]*\) rafId = requestAnimationFrame\(frame\);/, "the loop is conditional");
  assert.match(js, /matchMedia\?\.\(REDUCE\)/, "on the motion preference");
});

// 0.16.0: on the showcase the loop spent 1.45 ms a frame drawing three
// canvases that were all off-screen.
test("only near hosts are drawn, and the loop stops when none are", () => {
  const draw = js.slice(js.indexOf("function draw("), js.indexOf("function frame("));
  assert.match(draw, /if \(!it\.near\) continue;/, "an off-screen host is skipped");
  assert.match(js, /new IntersectionObserver\([\s\S]*?rootMargin: NEAR_MARGIN/, "nearness comes from an observer");
  assert.match(js, /near: true,/, "and fails open: a host is near until told otherwise");
  assert.match(js, /nearIO\?\.unobserve\(el\)/, "a detached host is unobserved");
});

test("a frame reads no layout and looks nothing up", () => {
  const draw = js.slice(js.indexOf("function draw("), js.indexOf("function frame("));
  assert.doesNotMatch(draw, /getBoundingClientRect|getComputedStyle|getUniformLocation|matchMedia/);
  assert.match(js, /new ResizeObserver\(/, "the box is read when it resizes");
});

test("a host removed from the DOM releases its context without waiting for a frame", () => {
  const watch = js.slice(js.indexOf("const watch = new MutationObserver"), js.indexOf("watch.observe("));
  assert.match(watch, /removedNodes/);
  assert.match(watch, /if \(!el\.isConnected\) detach\(el\)/);
});

test("the canvas stands the arc down, and both kill switches hide the canvas", () => {
  assert.match(css, /\.sl-fx-aurora\.is-live-lit\[data-sl-fx-live\]::after\s*\{\s*opacity:\s*0;/);
  for (const attr of [':root[data-sl-theme="high-contrast"] .sl-fx-live__canvas', ':is([data-sl-fx="off"], [data-sl-fx="off"] *) .sl-fx-live__canvas']) {
    assert.ok(css.includes(attr), `${attr} must be in the display:none list`);
  }
  assert.match(css, /\.sl-fx-live__canvas\s*\{[^}]*z-index:\s*-1/, "under the label");
});

test("\"run\" lights the CSS arc too, so its fallback is complete", () => {
  assert.match(css, /\[data-sl-fx-live="on"\], \[data-sl-fx-live="busy"\], \[data-sl-fx-live="run"\]\)::after/);
});

test("a live badge breathes only where motion is welcome", () => {
  const guard = comp.indexOf("@media (prefers-reduced-motion: no-preference)");
  const anim = comp.indexOf(".sl-badge--live::before { animation:");
  assert.ok(guard > -1 && anim > guard, "the breath sits inside the reduced-motion guard");
});

// spexr, 0.15.0: a depth companion bound to color-mix() computes to oklab(),
// whose numbers read as bytes gave a near-black light on the paper theme.
test("a role colour is converted to sRGB by painting it, never parsed", () => {
  const colour = readFileSync(resolve(KIT, "colour.js"), "utf8");
  const fn = colour.slice(colour.indexOf("export function toSrgb("), colour.indexOf("export function roleColour("));
  assert.match(fn, /getContext\("2d"/, "painted on a 2D canvas");
  assert.match(fn, /getImageData\(0, 0, 1, 1\)/, "and read back as a pixel");
  assert.doesNotMatch(fn, /\.match\(/, "no parsing of the computed string");
  assert.match(js, /import \{ roleColour \} from "\.\/colour\.js";/, "live-light reads colour through it");
});

// spexr, 0.15.1: the run light still carried 18% alpha (46/255) 6px out, where the
// canvas ended, so it stopped on a hard rectangle around the card.
test("the canvas reaches as far as PAD says, and the light is gone by its edge", () => {
  const pad = Number(/const PAD = (\d+);/.exec(js)[1]);
  const rule = /\.sl-fx-live__canvas\s*\{([^}]*)\}/.exec(css)[1];
  assert.match(rule, new RegExp(`inset:\\s*-${pad}px`), "the CSS inset is -PAD");
  assert.match(rule, new RegExp(`width:\\s*calc\\(100% \\+ ${pad * 2}px\\)`), "the width adds PAD on both sides");
  assert.match(rule, new RegExp(`height:\\s*calc\\(100% \\+ ${pad * 2}px\\)`), "and so does the height");
  const run = js.slice(js.indexOf("const FS_RUN"), js.indexOf("const FS_BUSY"));
  assert.match(run, /\(1\.-smoothstep\([^,]+,uPad,d\)\)/, "the outer light fades to zero at uPad");
  // The bleed alone (exp(-d/3)*.5) must be negligible at PAD, so the fade is a
  // soft shoulder rather than the thing hiding a cut.
  assert.ok(0.5 * Math.exp(-pad / 3) < 0.005, `bleed at PAD=${pad} is below 0.5%`);
});

// ── 0.18.0: data-sl-fx-still ─────────────────────────────────────────────────
// spexr pauses decorative motion while its window is unfocused or idle; this
// loop was the one per-frame requester left, at ~50% GPU on an idle window.
// Driven for real against a minimal fake DOM: the loop's contract is when it
// asks for frames and at what time it draws, which a regex cannot see.

/** A fake page: one document, a rAF queue, a clock and WebGL stubs that record
 *  what reaches uT and whether a context was lost. */
function fakePage({ observe = false } = {}) {
  const saved = {};
  for (const k of ["Element", "MutationObserver", "IntersectionObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "performance"]) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
  }
  const page = { clock: 1000, queue: [], observers: [], lost: 0, uT: [] };
  class Element {
    constructor(doc, attrs = {}, classes = []) {
      this.ownerDocument = doc;
      this.attrs = { ...attrs };
      this.classes = new Set(classes);
      this.children = [];
      this.isConnected = true;
      this.offsetWidth = 200;
      this.offsetHeight = 80;
      this.style = {};
      const self = this;
      this.classList = {
        add: (c) => self.classes.add(c),
        remove: (c) => self.classes.delete(c),
        contains: (c) => self.classes.has(c),
      };
    }
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
    hasAttribute(n) { return n in this.attrs; }
    setAttribute(n, v) { this.attrs[n] = String(v); }
    removeAttribute(n) { delete this.attrs[n]; }
    append(c) { this.children.push(c); }
    remove() {}
    closest() { return null; }
    matches(sel) {
      if (sel.startsWith(".sl-fx-aurora:is(")) return this.classes.has("sl-fx-aurora") && ["busy", "run"].includes(this.attrs["data-sl-fx-live"]);
      if (sel === ".sl-fx-aurora") return this.classes.has("sl-fx-aurora");
      return false;
    }
    querySelectorAll() { return this.children.filter((c) => c.classes?.has("sl-fx-aurora")); }
  }
  const gl = () => new Proxy({
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_p, n) => n,
    uniform1f: (loc, v) => { if (loc === "uT") page.uT.push(v); },
    getExtension: () => ({ loseContext: () => { page.lost++; } }),
  }, { get: (t, k) => (k in t ? t[k] : () => ({})) });
  const doc = {
    documentElement: null,
    createElement(tag) {
      const el = new Element(doc);
      if (tag === "canvas") {
        el.getContext = (kind) => kind === "webgl" ? gl() : {
          clearRect() {}, fillRect() {}, getImageData: () => ({ data: [255, 128, 0, 255] }),
        };
      }
      return el;
    },
    querySelectorAll() { return doc.body.querySelectorAll(); },
  };
  doc.documentElement = new Element(doc);
  doc.body = new Element(doc);
  globalThis.Element = Element;
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; page.observers.push(this); }
    observe(target, opts) { this.target = target; this.opts = opts; }
    disconnect() {}
  };
  // With `observe`, nearness and size come from observers the test drives;
  // without, they are absent and every host stays near (the module fails open).
  if (observe) {
    const Obs = (slot) => class {
      constructor(cb) { this.cb = cb; page[slot] = this; }
      observe() {}
      unobserve() {}
    };
    globalThis.IntersectionObserver = Obs("io");
    globalThis.ResizeObserver = Obs("ro");
  } else {
    delete globalThis.IntersectionObserver;
    delete globalThis.ResizeObserver;
  }
  globalThis.getComputedStyle = () => ({ color: "x", borderTopLeftRadius: "8px" });
  let id = 0;
  globalThis.requestAnimationFrame = (cb) => { page.queue.push(cb); return ++id; };
  Object.defineProperty(globalThis, "performance", { value: { now: () => page.clock }, configurable: true, writable: true });
  page.doc = doc;
  page.host = (mode = "run") => {
    const h = new Element(doc, { "data-sl-fx-live": mode }, ["sl-fx-aurora"]);
    doc.body.append(h);
    return h;
  };
  /** Run the frames queued so far, `ms` after the current clock. */
  page.tick = (ms = 16) => {
    page.clock += ms;
    const q = page.queue.splice(0);
    for (const cb of q) cb(page.clock);
    return q.length;
  };
  /** Set or clear the flag and deliver the record, as the browser would. */
  page.still = (on) => {
    if (on) doc.documentElement.setAttribute("data-sl-fx-still", "");
    else doc.documentElement.removeAttribute("data-sl-fx-still");
    const theme = page.observers.find((o) => o.target === doc.documentElement);
    theme.cb([{ type: "attributes", target: doc.documentElement, attributeName: "data-sl-fx-still" }]);
  };
  page.restore = () => {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  };
  return page;
}

let fresh = 0;
const freshModule = () => import(`${pathToFileURL(resolve(KIT, "live-light.js")).href}?still=${++fresh}`);

test("still: the frame that sees the flag is drawn, and no further frame is asked for", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const { liveLight } = await freshModule();
  const host = page.host("run");
  liveLight(page.doc);
  assert.equal(page.tick(), 1);
  assert.equal(page.queue.length, 1, "moving: the loop asks for the next frame");
  page.still(true);
  assert.equal(page.tick(), 1, "the frame already asked for runs");
  assert.equal(page.queue.length, 0, "and asks for no other");
  assert.equal(page.lost, 0, "no context is lost");
  assert.ok(host.classes.has("is-live-lit"), "the host keeps its light");
  assert.equal(host.children.filter((c) => c.className === "sl-fx-live__canvas").length, 1, "and its one canvas");
});

test("still: clearing the flag restarts the loop where the light froze", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const { liveLight } = await freshModule();
  page.host("busy");
  liveLight(page.doc);
  page.tick(16);
  page.still(true);
  page.tick(16);
  const frozen = page.uT.at(-1);
  page.clock += 60_000;                         // a minute unfocused
  page.still(false);
  assert.equal(page.queue.length, 1, "the observer asks for a frame again");
  page.tick(16);
  assert.ok(Math.abs(page.uT.at(-1) - frozen) < 1e-9, `resumes at the frozen instant (${frozen}s), got ${page.uT.at(-1)}s`);
  page.tick(16);
  assert.ok(Math.abs(page.uT.at(-1) - (frozen + 0.016)) < 1e-9, "and moves on from there");
  assert.equal(page.queue.length, 1, "the loop runs again");
});

test("still: a host that attaches while held is drawn once, at the frozen instant", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const { liveLight } = await freshModule();
  page.host("run");
  liveLight(page.doc);
  page.tick(16);
  page.still(true);
  page.tick(16);
  const frozen = page.uT.at(-1);
  const late = page.host("busy");
  const watch = page.observers.find((o) => o.target === page.doc);
  watch.cb([{ type: "childList", addedNodes: [late], removedNodes: [] }]);
  assert.ok(late.classes.has("is-live-lit"), "the new host is lit");
  const before = page.uT.length;
  assert.equal(page.tick(1000), 1, "one frame for it");
  assert.equal(page.queue.length, 0, "and no loop after it");
  assert.deepEqual(page.uT.slice(before), [frozen, frozen], "both hosts drawn at the frozen instant");
});

test("still: the flag is watched on the root without re-reading every host's colours", () => {
  assert.match(js, /attributeFilter: \["data-sl-theme", "style", STILL\]/);
  assert.match(js, /const STILL = "data-sl-fx-still";/);
  const theme = js.slice(js.indexOf("const theme = new MutationObserver"), js.indexOf("theme.observe("));
  assert.match(theme, /records\.every\(\(r\) => r\.attributeName === STILL\)\) \{ ensureLoop\(\); return; \}/,
    "a still-only change reconciles nothing and re-reads no colour");
  const draw = js.slice(js.indexOf("function draw("), js.indexOf("function stilled("));
  assert.doesNotMatch(draw, /STILL|hasAttribute/, "the flag is read once per frame, not per host");
});

/** uT is seconds since the loop's origin, which the fake clock sets at 1000ms. */
const near = (a, b) => Math.abs(a - b) < 1e-9;

test("still: set, cleared and set again before any frame is one held frame, then an exact resume", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const { liveLight } = await freshModule();
  page.host("run");
  liveLight(page.doc);                          // a frame is queued at clock 1000
  page.still(true);
  page.still(false);
  page.still(true);
  assert.equal(page.queue.length, 1, "the toggles queue nothing more");
  page.tick(16);
  assert.deepEqual(page.uT, [0.016], "one frame, at the instant the flag was seen");
  assert.equal(page.queue.length, 0, "and none after it");
  page.clock += 30_000;
  page.still(false);
  page.tick(16);
  assert.ok(near(page.uT.at(-1), 0.016), `resumes at the frozen instant, got ${page.uT.at(-1)}`);
  assert.equal(page.queue.length, 1, "and loops again");
});

test("still: cleared and set again between frames changes nothing", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const { liveLight } = await freshModule();
  page.host("busy");
  liveLight(page.doc);
  page.tick(16);
  page.still(true);
  page.tick(16);
  const frozen = page.uT.at(-1);
  page.clock += 5_000;
  page.still(false);
  page.still(true);                             // back before the frame runs
  page.tick(16);
  assert.ok(near(page.uT.at(-1), frozen), "the frame it asked for draws the frozen instant");
  assert.equal(page.queue.length, 0, "and the loop stays stopped");
  page.clock += 5_000;
  page.still(false);
  page.tick(16);
  assert.ok(near(page.uT.at(-1), frozen), "the pause that never ended is not counted twice");
});

test("still: held while nothing is near, a host coming near and a resize each draw one frame at the frozen instant", async (t) => {
  const page = fakePage({ observe: true });
  t.after(page.restore);
  const { liveLight } = await freshModule();
  const host = page.host("run");
  liveLight(page.doc);
  page.tick(16);
  page.io.cb([{ target: host, isIntersecting: false }]);
  page.tick(16);
  assert.equal(page.queue.length, 0, "off-screen: the loop has stopped on its own");
  const drawn = page.uT.length;
  page.still(true);
  page.tick(16);
  const frozen = (page.clock - 1000) / 1000;
  assert.equal(page.uT.length, drawn, "nothing near, nothing drawn");
  assert.equal(page.queue.length, 0);
  page.clock += 2_000;
  page.io.cb([{ target: host, isIntersecting: true }]);
  assert.equal(page.tick(16), 1, "coming near asks for one frame");
  assert.equal(page.queue.length, 0, "and only one");
  assert.ok(near(page.uT.at(-1), frozen), "drawn at the frozen instant");
  page.clock += 2_000;
  page.ro.cb([{ target: host, borderBoxSize: [{ inlineSize: 320, blockSize: 90 }] }]);
  assert.equal(page.tick(16), 1, "a resize asks for one frame");
  assert.equal(page.queue.length, 0, "and only one");
  assert.ok(near(page.uT.at(-1), frozen), "drawn at the frozen instant too");
  page.clock += 60_000;
  page.still(false);
  page.tick(16);
  assert.ok(near(page.uT.at(-1), frozen), "and the light resumes from there");
  assert.equal(page.queue.length, 1);
});
