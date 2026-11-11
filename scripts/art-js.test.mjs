import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { ART_CELL_PX, HORIZON_ROWS, renderPoster, renderHorizon, toRgba } from "../packages/ui-kit/art-core.js";

// art.js is judged on source (what it imports, what it may never contain)
// and on what it sets, driven against a minimal fake page.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "art.js"), "utf8");
const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const COLOUR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g;
const { mountArt } = await import(pathToFileURL(resolve(KIT, "art.js")).href);

/** What the fake canvas encodes a picture's layer as: a URL that names its bytes. */
const urlOf = (picture, layer) => `url("data:image/png;fake,${createHash("sha256").update(toRgba(picture, layer)).digest("hex").slice(0, 24)}")`;

/** A fake page: elements with classes, attributes and an inline style map,
 *  canvases that encode to a hash of their pixels, and observers the test
 *  drives. */
function fakePage() {
  const keys = ["Element", "MutationObserver", "ResizeObserver"];
  const saved = Object.fromEntries(keys.map((k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const page = { observers: [], ro: [], canvases: 0 };
  const matches = (el, sel) => sel.split(",").some((s) => el.classList.contains(s.trim().slice(1)));
  class Element {
    constructor(tag, classes = [], attrs = {}) {
      const set = new Set(classes), style = new Map();
      Object.assign(this, { tagName: tag.toUpperCase(), attrs: { ...attrs }, children: [], parent: null, isConnected: true, clientWidth: 0 });
      this.classList = { contains: (c) => set.has(c), add: (c) => set.add(c), remove: (c) => set.delete(c) };
      this.style = { setProperty: (k, v) => style.set(k, v), removeProperty: (k) => style.delete(k), get: (k) => style.get(k), has: (k) => style.has(k) };
    }
    getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
    get nodeType() { return 1; }
    append(c) { c.parent = this; this.children.push(c); }
    matches(sel) { return matches(this, sel); }
    querySelectorAll(sel) {
      const out = [];
      const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } };
      walk(this);
      return out;
    }
  }
  const doc = {};
  doc.documentElement = new Element("html");
  doc.body = new Element("body");
  doc.documentElement.append(doc.body);
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);
  doc.createElement = () => {
    page.canvases++;
    let pixels = null;
    return {
      getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: (image) => { pixels = image.data; } }),
      toDataURL: () => `data:image/png;fake,${createHash("sha256").update(pixels).digest("hex").slice(0, 24)}`,
    };
  };
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
  page.add = (classes, attrs = {}, width = 0) => { const e = new Element("div", classes, attrs); e.clientWidth = width; doc.body.append(e); return e; };
  page.attr = (el, name, value) => { if (value === null) delete el.attrs[name]; else el.attrs[name] = value; page.observers[0].cb([{ type: "attributes", target: el, attributeName: name }]); };
  page.resize = (el, width) => { el.clientWidth = width; page.ro[0].cb([{ target: el }]); };
  page.reclass = (el, drop, add) => { for (const c of drop) el.classList.remove(c); for (const c of add) el.classList.add(c); page.observers[0].cb([{ type: "attributes", target: el, attributeName: "class" }]); };
  page.remove = (el) => { el.isConnected = false; page.observers[0].cb([{ type: "childList", addedNodes: [], removedNodes: [el] }]); };
  page.noCanvas = () => { doc.createElement = () => ({ getContext: () => null }); };
  page.doc = doc;
  page.forget = () => { for (const [k, d] of Object.entries(saved)) d ? Object.defineProperty(globalThis, k, d) : delete globalThis[k]; };
  return page;
}

test("art.js draws with art-core.js, not a copy, and holds no colour", () => {
  assert.match(code, /import\s*\{[^}]*\brenderPoster\b[^}]*\brenderHorizon\b[^}]*\}\s*from\s*"\.\/art-core\.js"/);
  assert.doesNotMatch(code, /BAYER|bayerAt|const\s+ART_CELL_PX/, "no second copy of the matrix or the cell size");
  assert.deepEqual(code.match(COLOUR) ?? [], []);
  assert.doesNotMatch(code, /requestAnimationFrame|setInterval|setTimeout/, "the art never animates");
  assert.doesNotMatch(code, /\.append\(|appendChild|insertAdjacent|innerHTML/, "the module adds no element to the page");
});

test("a poster with no seed is left to the stylesheet; a seed sets its own picture", () => {
  const page = fakePage();
  try {
    const plain = page.add(["sl-art-poster", "sl-art-poster--hills"]);
    const seeded = page.add(["sl-art-poster", "sl-art-poster--hills"], { "data-sl-art-seed": "7" });
    const bare = page.add(["sl-art-poster"], { "data-sl-art-seed": "3" });
    const handle = mountArt(page.doc);
    assert.equal(plain.style.has("--_sl-art-live"), false);
    assert.equal(seeded.style.get("--_sl-art-live"), urlOf(renderPoster("hills", 7), "colour"));
    assert.equal(bare.style.get("--_sl-art-live"), urlOf(renderPoster("dawn", 3), "colour"), "the bare poster is the dawn");
    handle.stop();
  } finally { page.forget(); }
});

test("a seed change redraws the poster, text is hashed, and removing the seed gives the picture back to the stylesheet", () => {
  const page = fakePage();
  try {
    const el = page.add(["sl-art-poster", "sl-art-poster--orbit"], { "data-sl-art-seed": "1" });
    const handle = mountArt(page.doc);
    const first = el.style.get("--_sl-art-live");
    page.attr(el, "data-sl-art-seed", "2");
    assert.equal(el.style.get("--_sl-art-live"), urlOf(renderPoster("orbit", 2), "colour"));
    assert.notEqual(el.style.get("--_sl-art-live"), first);
    const before = page.canvases;
    page.attr(el, "data-sl-art-seed", "2");
    assert.equal(page.canvases, before, "the same seed is not drawn twice");
    page.attr(el, "data-sl-art-seed", "blog");
    const blog = el.style.get("--_sl-art-live");
    assert.ok(blog && blog !== urlOf(renderPoster("orbit", 2), "colour"));
    page.attr(el, "data-sl-art-seed", null);
    assert.equal(el.style.has("--_sl-art-live"), false);
    handle.stop();
  } finally { page.forget(); }
});

test("a horizon is drawn at its section's width, in whole steps, with its ink as a second layer", () => {
  const page = fakePage();
  try {
    const el = page.add(["sl-art-horizon"], { "data-sl-art-seed": "4" }, 900);
    const handle = mountArt(page.doc);
    const cols = 464, size = `0 100% / ${cols * ART_CELL_PX}px ${HORIZON_ROWS * ART_CELL_PX}px no-repeat`;
    assert.ok(cols * ART_CELL_PX >= 900 && (cols - 16) * ART_CELL_PX < 900, "the picture covers the width, by less than one step");
    const picture = renderHorizon("hills", cols, 4);
    assert.equal(el.style.get("--_sl-art-live-bg"), `${urlOf(picture, "colour")} ${size}`);
    assert.equal(el.style.get("--_sl-art-live-ink"), `${urlOf(picture, "ink")} ${size}`);
    const before = page.canvases;
    page.resize(el, 910);
    assert.equal(page.canvases, before, "a width inside the same step is not redrawn");
    page.resize(el, 1300);
    assert.ok(page.canvases > before, "a wider section is redrawn");
    assert.match(el.style.get("--_sl-art-live-bg"), / 0 100% \/ 1312px 200px no-repeat$/);
    handle.stop();
  } finally { page.forget(); }
});

test("a horizon with no seed is drawn too, a scene with no ink sets none, and a box with no width waits", () => {
  const page = fakePage();
  try {
    const dawn = page.add(["sl-art-horizon", "sl-art-horizon--dawn"], {}, 640);
    const hidden = page.add(["sl-art-horizon"], {}, 0);
    const handle = mountArt(page.doc);
    assert.equal(dawn.style.get("--_sl-art-live-bg"), `${urlOf(renderHorizon("dawn", 320, 0), "colour")} 0 100% / 640px 200px no-repeat`);
    assert.equal(dawn.style.has("--_sl-art-live-ink"), false);
    assert.equal(hidden.style.has("--_sl-art-live-bg"), false);
    page.resize(hidden, 320);
    assert.ok(hidden.style.has("--_sl-art-live-bg"), "it is drawn once it has a width");
    handle.stop();
  } finally { page.forget(); }
});

test("elements added later are drawn, and stop() disconnects every observer", () => {
  const page = fakePage();
  try {
    const handle = mountArt(page.doc);
    assert.deepEqual(page.observers[0].opts, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-sl-art-seed", "class"] });
    const wrap = page.add([]);
    const late = new globalThis.Element("div", ["sl-art-poster"], { "data-sl-art-seed": "9" });
    wrap.append(late);
    page.observers[0].cb([{ type: "childList", addedNodes: [wrap], removedNodes: [] }]);
    assert.equal(late.style.get("--_sl-art-live"), urlOf(renderPoster("dawn", 9), "colour"));
    handle.stop();
    assert.ok(page.observers.every((o) => o.off) && page.ro.every((o) => o.off));
    const after = page.add(["sl-art-poster"], { "data-sl-art-seed": "5" });
    page.observers[0].cb([{ type: "childList", addedNodes: [after], removedNodes: [] }]);
    assert.equal(after.style.has("--_sl-art-live"), false, "a stopped mount draws nothing");
  } finally { page.forget(); }
});

test("seed 0 on a poster is the stylesheet's picture: nothing is drawn", () => {
  const page = fakePage();
  try {
    const zero = page.add(["sl-art-poster", "sl-art-poster--hills"], { "data-sl-art-seed": "0" });
    const empty = page.add(["sl-art-poster"], { "data-sl-art-seed": "" });
    const handle = mountArt(page.doc);
    assert.equal(page.canvases, 0);
    assert.equal(zero.style.has("--_sl-art-live"), false);
    assert.equal(empty.style.has("--_sl-art-live"), false);
    handle.stop();
  } finally { page.forget(); }
});

test("an element that changes kind gives back what it held, and follows its new kind", () => {
  const page = fakePage();
  try {
    const el = page.add(["sl-art-poster"], { "data-sl-art-seed": "3" }, 640);
    const handle = mountArt(page.doc), ro = page.ro[0];
    assert.ok(el.style.has("--_sl-art-live") && !ro.targets.has(el));
    page.reclass(el, ["sl-art-poster"], ["sl-art-horizon"]);
    assert.equal(el.style.has("--_sl-art-live"), false, "the poster's picture is given back");
    assert.ok(el.style.has("--_sl-art-live-bg") && el.style.has("--_sl-art-live-ink"));
    assert.ok(ro.targets.has(el), "a horizon is observed for its width");
    page.resize(el, 1300);
    assert.match(el.style.get("--_sl-art-live-bg"), / 1312px 200px no-repeat$/);
    page.reclass(el, ["sl-art-horizon"], ["sl-art-poster"]);
    assert.ok(!el.style.has("--_sl-art-live-bg") && !el.style.has("--_sl-art-live-ink"), "the horizon's layers are given back");
    assert.equal(el.style.get("--_sl-art-live"), urlOf(renderPoster("dawn", 3), "colour"));
    assert.ok(!ro.targets.has(el), "a poster is not observed");
    page.resize(el, 900);
    assert.equal(el.style.has("--_sl-art-live-bg"), false, "a resize does not draw a horizon on a poster");
    page.reclass(el, ["sl-art-poster"], []);
    assert.equal(el.style.has("--_sl-art-live"), false, "an element with no art class holds nothing");
    handle.stop();
  } finally { page.forget(); }
});

test("an element removed from the page is forgotten and no longer observed", () => {
  const page = fakePage();
  try {
    const el = page.add(["sl-art-horizon"], {}, 640);
    const handle = mountArt(page.doc), ro = page.ro[0];
    assert.ok(ro.targets.has(el));
    page.remove(el);
    assert.ok(!ro.targets.has(el));
    const before = page.canvases;
    page.resize(el, 1300);
    assert.equal(page.canvases, before, "a forgotten element is not redrawn");
    handle.stop();
  } finally { page.forget(); }
});

test("where no canvas can encode a picture, nothing is set and the stylesheet's picture stays", () => {
  const page = fakePage();
  try {
    page.noCanvas();
    const poster = page.add(["sl-art-poster"], { "data-sl-art-seed": "4" });
    const horizon = page.add(["sl-art-horizon"], {}, 640);
    const handle = mountArt(page.doc);
    assert.equal(poster.style.has("--_sl-art-live"), false);
    assert.ok(!horizon.style.has("--_sl-art-live-bg") && !horizon.style.has("--_sl-art-live-ink"));
    handle.stop();
  } finally { page.forget(); }
});
