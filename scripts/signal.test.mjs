import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { rampFrame, CELL_PX } from "../packages/ui-kit/dither-core.js";

// signal.js is judged on source (what it imports, what it may never contain)
// and on what it draws, driven against a minimal fake page.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "signal.js"), "utf8");
const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const { mountSignals } = await import(pathToFileURL(resolve(KIT, "signal.js")).href);

/** A fake page: one strip per attrs object, a recording 2D context, observers
 *  the test drives, a settable DPR, and a computed colour per canvas. */
function fakePage({ dpr = 1, forced = false } = {}) {
  const keys = ["Element", "MutationObserver", "ResizeObserver", "getComputedStyle", "matchMedia", "devicePixelRatio"];
  const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const page = { observers: [], ro: [], rects: [], clears: [], fills: [], ink: "ink-a", mq: { matches: forced, listeners: [] } };
  class Element {
    constructor(doc, tag, attrs = {}) {
      Object.assign(this, { ownerDocument: doc, tagName: tag.toUpperCase(), attrs: { ...attrs }, children: [], parent: null, isConnected: true, clientWidth: 60, clientHeight: 12, width: 300, height: 150 });
    }
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
    append(c) { c.parent = this; this.children.push(c); }
    contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
    matches(sel) { return sel === "canvas[data-sl-signal]" && this.tagName === "CANVAS" && "data-sl-signal" in this.attrs; }
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } };
      walk(this);
      return out;
    }
    addEventListener() {}
    removeEventListener() {}
    getContext() {
      return this.g ??= {
        set fillStyle(v) { page.fills.push(v); },
        clearRect: (...a) => page.clears.push(a),
        fillRect: (...a) => page.rects.push(a),
      };
    }
  }
  const doc = { listeners: new Map() };
  doc.documentElement = new Element(doc, "html");
  doc.body = new Element(doc, "body");
  doc.documentElement.append(doc.body);
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);
  doc.addEventListener = () => {};
  doc.removeEventListener = () => {};
  globalThis.Element = Element;
  globalThis.MutationObserver = class {
    constructor(cb) { this.cb = cb; page.observers.push(this); }
    observe(target, opts) { this.target = target; this.opts = opts; }
    disconnect() { this.off = true; }
  };
  globalThis.ResizeObserver = class {
    constructor(cb) { this.cb = cb; this.targets = new Set(); page.ro.push(this); }
    observe(t) { this.targets.add(t); }
    unobserve(t) { this.targets.delete(t); }
    disconnect() { this.off = true; }
  };
  globalThis.getComputedStyle = () => ({ color: page.ink });
  globalThis.matchMedia = () => ({ get matches() { return page.mq.matches; }, addEventListener: (_t, f) => page.mq.listeners.push(f), removeEventListener() {} });
  globalThis.devicePixelRatio = dpr;
  page.canvas = (attrs = {}) => {
    const c = new Element(doc, "canvas", { "data-sl-signal": "", ...attrs });
    doc.body.append(c);
    return c;
  };
  page.doc = doc;
  page.forget = () => { for (const [k, d] of Object.entries(saved)) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k]; };
  return page;
}

test("signal.js draws its ramp with rampFrame and CELL_PX from dither-core.js, not a copy", () => {
  assert.match(code, /import\s*\{[^}]*\brampFrame\b[^}]*\}\s*from\s*"\.\/dither-core\.js"/);
  assert.match(code, /import\s*\{[^}]*\bCELL_PX\b[^}]*\}\s*from\s*"\.\/dither-core\.js"/);
  assert.doesNotMatch(code, /BAYER|bayerAt|const\s+CELL_PX/, "no second copy of the matrix or the cell size");
});

test("signal.js contains no colour literal: the ink is the canvas's own computed colour", () => {
  assert.deepEqual(code.match(COLOUR) ?? [], []);
  assert.match(code, /getComputedStyle\(canvas\)\.color/);
});

test("signal.js caps the device pixel ratio at 2", () => {
  assert.match(code, /MAX_DPR\s*=\s*2/);
  assert.match(code, /Math\.min\(MAX_DPR,\s*globalThis\.devicePixelRatio/);
});

test("signal.js never fills a ground: every fill is a cell rect, none spans the canvas", () => {
  const fills = [...code.matchAll(/\.fillRect\(([^;]*)\);/g)].map((m) => m[1]);
  assert.equal(fills.length, 1, "one fillRect call site, the cell");
  assert.doesNotMatch(fills[0], /\b0,\s*0\b|\bpw\b\s*,\s*\bph\b/, "not a full-canvas fillRect");
  assert.doesNotMatch(code, /fillRect\(\s*0\s*,\s*0/);
  assert.doesNotMatch(code, /canvas\.style|background/i, "no ground set from script");
});

test("importing the module has no side effects", () => {
  // The import above ran in bare Node, with no document, observer or matchMedia.
  assert.equal(typeof mountSignals, "function");
  assert.equal(mountSignals.length, 0, "root defaults to document, read only when called");
  assert.doesNotMatch(code, /^(?:mountSignals|new |document\.|globalThis\.\w+\s*=)/m, "no top-level call or global write");
});

test("each lit cell is one CELL_PX square, in device px, matching rampFrame; the ground is transparent", () => {
  const page = fakePage({ dpr: 1 });
  try {
    const c = page.canvas({ "data-sl-signal-level": "0.5" });
    const h = mountSignals(page.doc);
    assert.equal(c.width, 60);
    assert.equal(c.height, 12);
    const cols = Math.ceil(60 / CELL_PX);
    const on = rampFrame({ cols, rows: 4 }, 0.5);
    assert.equal(page.rects.length, on.reduce((a, b) => a + b, 0));
    assert.ok(page.rects.length > 0);
    for (const [x, y, w, hh] of page.rects) {
      assert.equal(w, CELL_PX);
      assert.equal(hh, CELL_PX);
      assert.equal(x % CELL_PX, 0);
      assert.equal(y % CELL_PX, 0);
    }
    assert.deepEqual(page.fills, ["ink-a"], "painted in the element's computed colour");
    assert.deepEqual(page.clears, [[0, 0, 60, 12]], "cleared, never painted over");
    h.stop();
  } finally { page.forget(); }
});

test("backing store follows device resolution, capped at 2: dpr 3 draws as dpr 2", () => {
  const page = fakePage({ dpr: 3 });
  try {
    const c = page.canvas();
    mountSignals(page.doc);
    assert.equal(c.width, 120);
    assert.equal(c.height, 24);
    for (const [, , w, h] of page.rects) { assert.equal(w, CELL_PX * 2); assert.equal(h, CELL_PX * 2); }
  } finally { page.forget(); }
});

test("level defaults to 1, clamps to 0..1, and a bad value falls back to 1", () => {
  const count = (attrs) => {
    const page = fakePage();
    try { page.canvas(attrs); mountSignals(page.doc); return page.rects.length; } finally { page.forget(); }
  };
  const full = count({});
  assert.ok(full > 0);
  assert.equal(count({ "data-sl-signal-level": "7" }), full);
  assert.equal(count({ "data-sl-signal-level": "nope" }), full);
  assert.equal(count({ "data-sl-signal-level": "" }), full);
  assert.equal(count({ "data-sl-signal-level": "0" }), 0);
  assert.equal(count({ "data-sl-signal-level": "-1" }), 0);
});

test("forced colours: the canvas is cleared and nothing is drawn; leaving them redraws", () => {
  const page = fakePage({ forced: true });
  try {
    page.canvas();
    mountSignals(page.doc);
    assert.equal(page.rects.length, 0);
    assert.equal(page.clears.length, 1);
    page.mq.matches = false;
    page.mq.listeners.forEach((f) => f());
    assert.ok(page.rects.length > 0);
  } finally { page.forget(); }
});

test("a canvas with no box draws nothing and does not throw", () => {
  const page = fakePage();
  try {
    const c = page.canvas();
    c.clientWidth = 0;
    mountSignals(page.doc);
    assert.equal(page.rects.length, 0);
  } finally { page.forget(); }
});

test("a resize redraws; a theme change on <html> repaints in the new ink", () => {
  const page = fakePage();
  try {
    const c = page.canvas();
    mountSignals(page.doc);
    const first = page.rects.length;
    c.clientWidth = 120;
    page.ro[0].cb([{ target: c }]);
    assert.equal(c.width, 120);
    assert.ok(page.rects.length > first);
    page.ink = "ink-b";
    const theme = page.observers.find((o) => o.target === page.doc.documentElement && o.opts.attributeFilter.length === 1);
    assert.deepEqual(theme.opts.attributeFilter, ["data-sl-theme"]);
    theme.cb([]);
    assert.equal(page.fills.at(-1), "ink-b");
  } finally { page.forget(); }
});

test("canvases added later are armed; stop() disconnects every observer", () => {
  const page = fakePage();
  try {
    const h = mountSignals(page.doc);
    assert.equal(page.rects.length, 0);
    const late = page.canvas();
    const watcher = page.observers.find((o) => o.opts.childList);
    watcher.cb([{ type: "childList", addedNodes: [late] }]);
    assert.ok(page.rects.length > 0);
    h.stop();
    assert.ok(page.observers.every((o) => o.off));
    assert.ok(page.ro.every((o) => o.off));
  } finally { page.forget(); }
});
