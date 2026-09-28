import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// The runtime is judged on when it asks for frames and what it draws, driven
// against a minimal fake page, as live-light.test.mjs does.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "halftone.js"), "utf8");
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const { halftone } = await import(pathToFileURL(resolve(KIT, "halftone.js")).href);

/** A fake page: elements, a rAF queue, a clock, observers the test drives, and
 *  2D contexts that record every arc drawn on a visible canvas. */
function fakePage({ reduce = false, observe = true } = {}) {
  const keys = ["Element", "Image", "MutationObserver", "IntersectionObserver", "ResizeObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "performance", "devicePixelRatio"];
  const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const page = { clock: 1000, queue: [], observers: [], io: [], ro: [], frames: [], listeners: new Map(), offscreen: [], images: [], ink: [240, 240, 240] };
  class Element {
    constructor(doc, tag, attrs = {}) {
      Object.assign(this, { ownerDocument: doc, tagName: tag.toUpperCase(), attrs: { ...attrs }, children: [], parent: null, isConnected: true, clientWidth: 200, style: {} });
    }
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
    hasAttribute(n) { return n in this.attrs; }
    setAttribute(n, v) { this.attrs[n] = String(v); }
    removeAttribute(n) { delete this.attrs[n]; }
    append(c) { c.parent = this; this.children.push(c); }
    remove() {}
    matches(sel) { return sel === "canvas[data-sl-halftone]" && this.tagName === "CANVAS" && "data-sl-halftone" in this.attrs; }
    closest(sel) {
      for (let n = this; n; n = n.parent) if (sel === '[data-sl-fx="off"]' && n.attrs["data-sl-fx"] === "off") return n;
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } };
      walk(this);
      return out;
    }
  }
  const doc = {
    visibilityState: "visible",
    createElement(tag) {
      const el = new Element(doc, tag);
      if (tag === "canvas") {
        el.getContext = () => {
          const frame = [];
          return {
            setTransform() {}, clearRect() { if (el.isConnected) { frame.length = 0; } }, beginPath() {}, moveTo() {},
            arc(x, y, r) { frame.push([x, y, r]); },
            fill() { if (el.visible) page.frames.push({ canvas: el, dots: frame.slice() }); },
            fillRect() {}, drawImage(...a) { el.drawn = a; },
            getImageData: (_x, _y, w) => {
              if (w === 1) return { data: [...page.ink, 255] };
              if (el.drawn?.[0]?.src.includes("other-origin")) throw new Error("SecurityError");
              const px = new Uint8ClampedArray(w * w * 4);
              for (let k = 0; k < px.length; k += 4) { px[k] = px[k + 1] = px[k + 2] = ((k / 4) % w) * (255 / w); px[k + 3] = 255; }
              return { data: px };
            },
          };
        };
        page.offscreen.push(el);
      }
      return el;
    },
    addEventListener(type, cb) { page.listeners.set(type, cb); },
    removeEventListener(type, cb) { if (page.listeners.get(type) === cb) page.listeners.delete(type); },
    querySelectorAll(sel) { return doc.body.querySelectorAll(sel); },
  };
  doc.documentElement = new Element(doc, "html");
  doc.body = new Element(doc, "body");
  doc.documentElement.append(doc.body);
  globalThis.Element = Element;
  globalThis.Image = class {
    constructor() { page.images.push(this); }
    set src(v) { this._src = v; }
    get src() { return this._src; }
    get naturalWidth() { return 400; }
    get naturalHeight() { return 300; }
    decode() { return this._src.includes("missing") ? Promise.reject(new Error("404")) : Promise.resolve(); }
  };
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; page.observers.push(this); }
    observe(target, opts) { this.target = target; this.opts = opts; }
    disconnect() { this.off = true; }
  };
  if (observe) {
    globalThis.IntersectionObserver = class {
      constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = []; page.io.push(this); }
      observe(t) { this.targets.push(t); }
      unobserve() {}
      disconnect() { this.off = true; }
    };
    globalThis.ResizeObserver = class {
      constructor(cb) { this.cb = cb; this.targets = []; page.ro.push(this); }
      observe(t) { this.targets.push(t); }
      unobserve() {}
      disconnect() { this.off = true; }
    };
  } else {
    delete globalThis.IntersectionObserver;
    delete globalThis.ResizeObserver;
  }
  globalThis.getComputedStyle = () => ({ color: "ink" });
  globalThis.matchMedia = () => ({ matches: reduce });
  let id = 0;
  globalThis.requestAnimationFrame = (cb) => { page.queue.push(cb); return ++id; };
  globalThis.cancelAnimationFrame = () => { page.queue.length = 0; };
  globalThis.devicePixelRatio = 1;
  Object.defineProperty(globalThis, "performance", { value: { now: () => page.clock }, configurable: true, writable: true });
  page.doc = doc;
  page.canvas = (attrs = {}, parent = doc.body) => {
    const c = doc.createElement("canvas");
    Object.assign(c.attrs, { "data-sl-halftone": "", "data-sl-src": "/a.png", ...attrs });
    c.visible = true;
    parent.append(c);
    return c;
  };
  /** Every scene near and seen, as IntersectionObserver would report once scrolled to. */
  page.show = (canvas) => {
    for (const o of page.io) o.cb([{ target: canvas, isIntersecting: true, intersectionRatio: 1, intersectionRect: { height: 200 }, rootBounds: { height: 800 } }]);
  };
  page.tick = (ms = 16) => {
    page.clock += ms;
    const q = page.queue.splice(0);
    for (const cb of q) cb(page.clock);
    return q.length;
  };
  page.attr = (name, value) => {
    if (value === null) doc.documentElement.removeAttribute(name);
    else doc.documentElement.setAttribute(name, value);
    for (const o of page.observers) if (o.target === doc.documentElement && !o.off) o.cb([{ type: "attributes", target: doc.documentElement, attributeName: name }]);
  };
  page.restore = () => {
    for (const [k, d] of Object.entries(saved)) {
      if (d) Object.defineProperty(globalThis, k, d);
      else delete globalThis[k];
    }
  };
  return page;
}

test("halftone.js contains no colour literal: the ink is the canvas's own colour", () => {
  assert.deepEqual(js.match(COLOUR) || [], []);
});

test("importing the module has no side effects", async () => {
  await assert.doesNotReject(import(`${pathToFileURL(resolve(KIT, "halftone.js")).href}?import`));
});

test("nothing is drawn until the scene is seen; then it gathers and keeps moving while near", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  page.tick();
  assert.equal(page.frames.length, 0, "not seen, not drawn");
  page.show(c);
  assert.equal(page.tick(), 1);
  assert.ok(page.frames.at(-1).dots.length > 0, "dots drawn");
  assert.equal(page.queue.length, 1, "the loop asks for the next frame");
});

test("a scene that leaves the viewport stops the loop", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  page.tick();
  for (const o of page.io) o.cb([{ target: c, isIntersecting: false }]);
  page.tick();
  assert.equal(page.queue.length, 0);
});

test("reduced motion: one settled frame and no loop; data-sl-fx-motion=always restores the motion", async (t) => {
  const page = fakePage({ reduce: true });
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32", "data-sl-seed": "3" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  assert.equal(page.tick(), 1);
  assert.equal(page.queue.length, 0, "no loop");
  const settled = page.frames.at(-1).dots;
  assert.ok(settled.length > 0);
  // Every dot sits on the lattice: the settled frame, not a gathering one.
  for (const [x] of settled) assert.ok(Math.abs(((x / 200) * 32) % 1 - 0.5) < 1e-9, `x ${x} off the lattice`);
  page.attr("data-sl-fx-motion", "always");
  page.tick();
  assert.equal(page.queue.length, 1, "the derogation brings the loop back");
});

test("still: the frame that sees the flag is drawn, none after; cleared, it resumes where it froze", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32", "data-sl-seed": "5" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  page.tick(16);
  page.tick(16);
  page.attr("data-sl-fx-still", "");
  page.tick(16);
  assert.equal(page.queue.length, 0, "held: no further frame");
  const frozen = page.frames.at(-1).dots;
  page.clock += 60_000;
  page.attr("data-sl-fx-still", null);
  assert.equal(page.queue.length, 1, "cleared: a frame is asked for");
  page.tick(0);
  assert.deepEqual(page.frames.at(-1).dots, frozen, "resumes at the frozen instant");
  assert.equal(page.queue.length, 1, "and the loop runs again");
});

test('a canvas under data-sl-fx="off" is never armed', async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const off = page.doc.createElement("div");
  off.setAttribute("data-sl-fx", "off");
  page.doc.body.append(off);
  const c = page.canvas({}, off);
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  page.tick();
  assert.equal(page.frames.length, 0);
});

test("a picture that fails, or taints its canvas, leaves the others drawing", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const missing = page.canvas({ "data-sl-src": "/missing.png" });
  const tainted = page.canvas({ "data-sl-src": "https://other-origin.test/a.png" });
  const good = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  for (const c of [missing, tainted, good]) page.show(c);
  page.tick();
  const drawn = new Set(page.frames.map((f) => f.canvas));
  assert.ok(drawn.has(good), "the good one draws");
  assert.ok(!drawn.has(missing), "the missing one does not");
  assert.ok(!drawn.has(tainted), "nor the tainted one");
});

test("a bad grid falls back to 96, a huge one is clamped to 256, a tiny one to 16", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  page.canvas({ "data-sl-grid": "abc" });
  page.canvas({ "data-sl-grid": "5000" });
  page.canvas({ "data-sl-grid": "2" });
  const start = page.offscreen.length;
  const { ready } = halftone(page.doc);
  await ready;
  const sizes = page.offscreen.slice(start).filter((c) => c.drawn).map((c) => c.width).sort((a, b) => a - b);
  assert.deepEqual(sizes, [32, 192, 512]);
});

test("a wide picture is centre-cropped, not squashed", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  page.canvas({ "data-sl-grid": "32" });
  const start = page.offscreen.length;
  const { ready } = halftone(page.doc);
  await ready;
  const off = page.offscreen.slice(start).find((c) => c.drawn);
  // Image is 400×300: source square is x 50..350.
  assert.deepEqual(off.drawn.slice(1), [50, 0, 300, 300, 0, 0, 64, 64]);
});

test("a canvas with no width draws nothing and does not throw; given a size, it draws", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  c.clientWidth = 0;
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  assert.doesNotThrow(() => page.tick());
  assert.equal(page.frames.length, 0);
  for (const o of page.ro) o.cb([{ target: c, contentRect: { width: 180 } }]);
  page.tick();
  assert.ok(page.frames.length > 0);
});

test("canvases added later are armed", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const h = halftone(page.doc);
  await h.ready;
  const late = page.canvas({ "data-sl-grid": "32" });
  const added = page.observers.find((o) => o.opts?.childList);
  added.cb([{ type: "childList", addedNodes: [late], removedNodes: [] }]);
  await new Promise((r) => setTimeout(r, 0));
  page.show(late);
  page.tick();
  assert.ok(page.frames.some((f) => f.canvas === late));
});

test("stop() disconnects every observer, drops the listener and cancels the frame", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const h = halftone(page.doc);
  await h.ready;
  page.show(c);
  page.tick();
  h.stop();
  for (const o of [...page.observers, ...page.io, ...page.ro]) assert.ok(o.off, "an observer is still connected");
  assert.ok(!page.listeners.has("visibilitychange"));
  assert.equal(page.queue.length, 0);
});

test("without IntersectionObserver every scene counts as near and seen (fail open)", async (t) => {
  const page = fakePage({ observe: false });
  t.after(page.restore);
  page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  page.tick();
  assert.ok(page.frames.length > 0);
});

test("a theme flip to dark ink resamples as a print of the picture's dark", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32", "data-sl-seed": "1" });
  const { ready } = halftone(page.doc);
  await ready;
  page.show(c);
  // The fake picture is a ramp, dark on the left, light on the right; the
  // weight of the dots (their radius) says which side is being printed.
  const centre = (dots) => dots.reduce((s, [x, , r]) => s + x * r, 0) / dots.reduce((s, [, , r]) => s + r, 0);
  page.tick(5000);                               // gathered: dots at their places
  assert.ok(centre(page.frames.at(-1).dots) > 100, "light ink draws the light side");
  page.ink = [20, 20, 20];
  page.attr("data-sl-theme", "light");
  page.tick(16);
  assert.ok(centre(page.frames.at(-1).dots) < 100, "dark ink prints the dark side");
});

test("a scene gathers only once 40% of it is in view, not at the first pixel", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  for (const o of page.io) o.cb([{ target: c, isIntersecting: true, intersectionRatio: 0.1, intersectionRect: { height: 20 }, rootBounds: { height: 800 } }]);
  page.tick();
  assert.equal(page.frames.length, 0, "a sliver does not start the gather");
  page.show(c);
  page.tick();
  assert.ok(page.frames.length > 0, "a ratio of 1 does");
});

test("pictures are requested with CORS so a cross-origin one can be read", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  assert.ok(page.images.length > 0);
  for (const img of page.images) assert.equal(img.crossOrigin, "anonymous");
});

test("a canvas taller than 2.5 viewports gathers once 40% of the viewport is filled by it", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32" });
  const { ready } = halftone(page.doc);
  await ready;
  for (const o of page.io) o.cb([{ target: c, isIntersecting: true, intersectionRatio: 0.35, intersectionRect: { height: 400 }, rootBounds: { height: 800 } }]);
  page.tick();
  assert.ok(page.frames.length > 0, "a ratio that can never reach 0.4 still gathers");
});

test("a scene first seen while still is held gathers from the start once released", async (t) => {
  const page = fakePage();
  t.after(page.restore);
  const c = page.canvas({ "data-sl-grid": "32", "data-sl-seed": "5" });
  const { ready } = halftone(page.doc);
  await ready;
  page.attr("data-sl-fx-still", "");
  page.tick(16);
  page.tick(60_000);
  page.show(c);
  page.tick(60_000);
  page.attr("data-sl-fx-still", null);
  page.tick(0);
  const mean = (dots) => dots.reduce((s, [, , r]) => s + r, 0) / dots.length;
  const first = mean(page.frames.at(-1).dots);
  for (let i = 0; i < 200; i++) page.tick(16);
  assert.ok(mean(page.frames.at(-1).dots) > 2 * first, "dots have grown to their places within ~3s, not held scattered");
});
