import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CELL_PX, wipeFrame } from "../packages/ui-kit/dither-core.js";

// The dither driver of effects.js, run for real against a stub DOM, canvas and
// rAF. effects.js cannot be imported with a document (Node has none, and its
// mount() arms far more than a button), so the dither section is cut out by
// its markers and evaluated with stubs, the way effects-js.test.mjs and
// halftone.test.mjs reach code that wants a page.

const SRC = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../packages/ui-kit/effects.js"), "utf8");
const SECTION = SRC.slice(SRC.indexOf("/* ── dither:"), SRC.indexOf("function injectGlassLayers"));
assert.ok(SECTION.includes("function onDitherCross"), "the dither section is found");

/** A fresh driver with its own fake clock, rAF queue, canvas and one host. */
function rig({ reduced = false } = {}) {
  const env = { reduced, suppressed: false, now: 1000, queue: [], draws: [], themeCbs: [] };
  class FakeNode {}
  class FakeEl extends FakeNode {}
  const ctx = {
    clearRect: () => env.draws.push("clear"),
    fillRect: () => env.draws.push("full"),
    beginPath() {}, rect: () => env.draws.push("cell"), fill: () => env.draws.push("fill"),
    set fillStyle(v) { env.fillStyles.push(v); }, get fillStyle() { return ""; },
  };
  env.fillStyles = [];
  const host = Object.assign(new FakeEl(), {
    classes: new Set(), isConnected: true, clientWidth: 60, clientHeight: 30, children: [],
    classList: { toggle: (c, on) => (on ? host.classes.add(c) : host.classes.delete(c)), contains: (c) => host.classes.has(c) },
    closest: (sel) => (sel === ".sl-btn, .sl-icon-btn" ? host : null),
    contains: () => false, matches: () => false,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 60, height: 30 }),
    querySelector: () => null, prepend() {},
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const layer = { className: "", setAttribute() {}, append() {} };
  const document = { createElement: (t) => (t === "canvas" ? canvas : layer), documentElement: {} };
  const window = { devicePixelRatio: 2, matchMedia: () => ({ matches: env.reduced }) };
  const api = new Function("CELL_PX", "wipeFrame", "suppressed", "REDUCE", "document", "window", "Element", "Node", "MutationObserver",
    "getComputedStyle", "requestAnimationFrame", "performance",
    `${SECTION}\nreturn { onDitherCross, pruneDithers, dithers, dithering };`)(
    CELL_PX, wipeFrame, () => env.suppressed, "(reduce)", document, window, FakeEl, FakeNode,
    class { constructor(cb) { env.themeCbs.push(cb); } observe() {} },
    () => ({ color: "FILL", getPropertyValue: () => "100ms" }),
    (cb) => { env.queue.push(cb); return env.queue.length; },
    { now: () => env.now });
  /** Run frames until none is queued (or `max`), `ms` apart. */
  env.run = (ms, max = 1000) => {
    for (let i = 0; i < max && env.queue.length; i++) { env.now += ms; env.queue.shift()(env.now); }
  };
  env.ev = (type, x, y) => ({ type, target: host, relatedTarget: null, clientX: x, clientY: y, pointerType: "mouse" });
  return { env, host, api, canvas };
}

test("enter, leave, re-enter mid-drain: progress is continuous, the label flips at 0.5, the loop sleeps when done", () => {
  const { env, host, api, canvas } = rig();
  api.onDitherCross(env.ev("pointerover", 5, 5));
  const d = api.dithers.get(host);
  assert.ok(d, "the layer is built on the first entry");
  assert.equal(canvas.width, 120, "60 css px at the device ratio 2");
  assert.deepEqual([...env.fillStyles], [], "nothing drawn before the first frame");
  assert.equal(env.queue.length, 1, "one frame queued");
  const seen = [];
  while (env.queue.length && d.p < 1) { env.run(10, 1); seen.push([d.p, host.classes.has("is-dithered")]); }
  for (const [p, flipped] of seen) assert.equal(flipped, 1 - (1 - p) ** 3 >= 0.5, `flip follows the eased progress at p=${p.toFixed(2)}`);
  assert.equal(d.p, 1);
  assert.equal(env.queue.length, 0, "the loop sleeps once the wipe is full");
  assert.ok(env.draws.includes("cell") && env.draws.at(-1) === "full", "cells while wiping, a solid fill at the end");

  api.onDitherCross(env.ev("pointerout", 55, 25));
  env.run(10, 2);
  const mid = d.p;
  assert.ok(mid < 1 && mid > 0, "draining");
  api.onDitherCross(env.ev("pointerover", 30, 0));
  assert.equal(d.p, mid, "re-entering does not reset the progress");
  assert.deepEqual(d.origin, { x: 30 / CELL_PX, y: 0 }, "and takes the new origin");
  env.run(10, 1);
  assert.ok(d.p > mid, "it reverses from where it was");

  api.onDitherCross(env.ev("pointerout", 0, 0));
  env.run(10);
  assert.equal(d.p, 0);
  assert.equal(host.classes.has("is-dithered"), false, "the label is the control's again");
  assert.equal(env.draws.at(-1), "clear", "an empty canvas at rest");
  assert.equal(env.queue.length, 0);
  assert.equal(api.dithering.size, 0, "nothing is left animating");
});

test("reduced motion switched on mid-hover still drains and clears; it starts nothing new", () => {
  const { env, host, api } = rig();
  api.onDitherCross(env.ev("pointerover", 5, 5));
  env.run(10);
  const d = api.dithers.get(host);
  assert.equal(d.p, 1);
  env.reduced = true;
  api.onDitherCross(env.ev("pointerout", 5, 5));
  env.run(10);
  assert.equal(d.p, 0, "drained");
  assert.equal(host.classes.has("is-dithered"), false);
  assert.equal(env.draws.at(-1), "clear");
  api.onDitherCross(env.ev("pointerover", 5, 5));
  assert.equal(env.queue.length, 0, "no wipe starts under reduced motion");
  env.reduced = false;
  env.suppressed = true;
  api.onDitherCross(env.ev("pointerover", 5, 5));
  assert.equal(env.queue.length, 0, "nor under high contrast");
});

test("a frame timestamp earlier than the seed never runs the wipe backwards", () => {
  const { env, host, api } = rig();
  api.onDitherCross(env.ev("pointerover", 5, 5));
  env.queue.shift()(env.now - 500);
  assert.equal(api.dithers.get(host).p, 0);
});

test("pruneDithers removes a detached host from the map and the loop", () => {
  const { env, host, api } = rig();
  api.onDitherCross(env.ev("pointerover", 5, 5));
  assert.equal(api.dithers.size, 1);
  assert.equal(api.dithering.size, 1);
  api.pruneDithers();
  assert.equal(api.dithers.size, 1, "a connected host is kept");
  host.isConnected = false;
  api.pruneDithers();
  assert.equal(api.dithers.size, 0);
  assert.equal(api.dithering.size, 0);
});
