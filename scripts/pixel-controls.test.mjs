import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  CELL_PX, CONTROL_CELL_PX, CHECK_INSET, CHECK_BOX_CELLS, wipeFrame, CHECK_CELLS, TICK_CELLS, DASH_CELLS, DOT_FRAMES, SWITCH_CELLS, TICK_START, tickCount, dotFrame, knobCells,
} from "../packages/ui-kit/dither-core.js";

// Pixel direction D, S10: the check, radio and switch draw their final frames
// in CSS on a 3px lattice, effects.js animates the way there on a canvas, and
// the disabled state is a 1px checkerboard mask. The cell lists live once, in
// dither-core.js; the CSS is parsed here and pinned to them.

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/ui-kit");
const css = readFileSync(resolve(KIT, "components.css"), "utf8");
const fx = readFileSync(resolve(KIT, "effects.css"), "utf8");
const js = readFileSync(resolve(KIT, "effects.js"), "utf8");

/** The body of the first rule whose selector is exactly `sel`. */
function body(src, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = src.match(new RegExp(`(?:^|\\n)${esc} \\{([^}]*)\\}`));
  assert.ok(m, `no rule ${sel}`);
  return m[1];
}
const px = (b, prop) => {
  const m = b.match(new RegExp(`(?:^|[\\s;])${prop}:\\s*(-?\\d+)(?:px)?\\b`));
  assert.ok(m, `no ${prop} in px`);
  return Number(m[1]);
};

/** The cells a ::after pixel rule draws: its own cell plus its box-shadow sprite. */
function cellsOf(rule) {
  const left = px(rule, "left");
  const top = px(rule, "top");
  assert.equal(px(rule, "width"), CONTROL_CELL_PX);
  assert.equal(px(rule, "height"), CONTROL_CELL_PX);
  const out = [[left, top]];
  const sh = rule.match(/box-shadow:([^;]*);/)[1];
  for (const m of sh.matchAll(/(-?\d+)(?:px)? (-?\d+)(?:px)? 0 var\(--_sl-on-fill\)/g)) out.push([left + Number(m[1]), top + Number(m[2])]);
  for (const [x, y] of out) {
    assert.equal(x % CONTROL_CELL_PX, 0, `cell x ${x} off the lattice`);
    assert.equal(y % CONTROL_CELL_PX, 0, `cell y ${y} off the lattice`);
  }
  // the offsets are the box's, the lists are the mark's: the mark sits CHECK_INSET cells in
  return out.map(([x, y]) => [x / CONTROL_CELL_PX - CHECK_INSET, y / CONTROL_CELL_PX - CHECK_INSET]);
}
const sorted = (cells) => cells.map((c) => c.join(",")).sort();

test("the check and radio box hold whole 2px cells, 16px inside and 18 outside, and CSS and JS name the same lattice", () => {
  const box = body(css, ".sl-check__box,\n.sl-radio__box");
  assert.equal(CONTROL_CELL_PX, 2);
  assert.equal(CHECK_BOX_CELLS, CHECK_CELLS + 2 * CHECK_INSET);
  assert.equal(px(box, "width"), CHECK_BOX_CELLS * CONTROL_CELL_PX);
  assert.equal(px(box, "height"), CHECK_BOX_CELLS * CONTROL_CELL_PX);
  assert.equal(px(box, "width"), 16);
  assert.equal(px(box, "width") + 2, 18, "18px outside with the 1px border");
  assert.match(box, /border: 1px solid/);
  assert.equal(CHECK_CELLS, 6, "owner, 2026-10-26: the 6 x 6 shapes, 12px on 2px cells");
  assert.equal(CHECK_CELLS * CONTROL_CELL_PX, 12);
  assert.ok(CONTROL_CELL_PX * 1.5 % 1 === 0 && CONTROL_CELL_PX * 2 % 1 === 0, "whole device pixels at DPR 1, 1.5 and 2");
  assert.match(box, /box-sizing: content-box;/, "the cells' 18px is the padding box under any page reset");
});

test("the CSS tick, dash and dot cells are exactly dither-core's lists, on the lattice, none in a corner", () => {
  const tick = cellsOf(body(css, ".sl-check__box::after"));
  assert.deepEqual(sorted(tick), sorted(TICK_CELLS));
  const dot = cellsOf(body(css, ".sl-radio__box::after"));
  assert.deepEqual(sorted(dot), sorted(DOT_FRAMES[1]));
  assert.deepEqual(sorted(DOT_FRAMES[0]), ["2,2", "2,3", "3,2", "3,3"], "the first dot frame is the 2 x 2 core");
  assert.equal(DOT_FRAMES[1].length, 12);
  for (const cell of DOT_FRAMES[0]) assert.ok(DOT_FRAMES[1].some((c) => c.join() === cell.join()), "frame 2 contains frame 1");
  const dashRule = body(css, ".sl-check__input:indeterminate + .sl-check__box::after");
  const left = px(dashRule, "left") / CONTROL_CELL_PX - CHECK_INSET;
  const row = px(dashRule, "top") / CONTROL_CELL_PX - CHECK_INSET;
  const w = px(dashRule, "width") / CONTROL_CELL_PX;
  const h = px(dashRule, "height") / CONTROL_CELL_PX;
  const dash = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) dash.push([left + i, row + j]);
  assert.deepEqual(sorted(dash), sorted(DASH_CELLS));
  const centred = (cells) => {
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    return Math.min(...xs) + Math.max(...xs) === CHECK_CELLS - 1 && Math.min(...ys) + Math.max(...ys) === CHECK_CELLS - 1;
  };
  for (const [name, cells] of [["dot core", DOT_FRAMES[0]], ["dot", DOT_FRAMES[1]], ["dash", DASH_CELLS]]) assert.ok(centred(cells), `${name} is centred on the 6 x 6 grid`);
  assert.deepEqual(TICK_CELLS.map((c) => c.join()), ["0,2", "1,3", "2,4", "3,3", "4,2", "5,1"], "the owner's V, in plotting order");
  const last = CHECK_CELLS - 1;
  const corner = ([i, j]) => (i === 0 || i === last) && (j === 0 || j === last);
  for (const c of [...TICK_CELLS, ...DASH_CELLS, ...DOT_FRAMES[1]]) assert.ok(!corner(c), `corner cell ${c}`);
  for (const [i, j] of [...TICK_CELLS, ...DASH_CELLS, ...DOT_FRAMES[1]]) assert.ok(i >= 0 && j >= 0 && i <= last && j <= last);
});

test("the marks are role vars: no colour literal in the pixel rules", () => {
  for (const sel of [".sl-check__box::after", ".sl-radio__box::after"]) {
    const b = body(css, sel);
    assert.doesNotMatch(b, /#[0-9a-f]{3,8}\b|rgb\(|oklch\(/i);
    assert.match(b, /background: var\(--_sl-on-fill\)/);
  }
});

test("the switch is a whole number of cells and its knob steps over the same count", () => {
  const track = body(css, ".sl-switch__track");
  assert.match(track, /box-sizing: border-box/);
  assert.equal(px(track, "width") - 2, SWITCH_CELLS.cols * CELL_PX);
  assert.equal(px(track, "height") - 2, SWITCH_CELLS.rows * CELL_PX);
  const knob = body(css, ".sl-switch__track::after");
  assert.equal(px(knob, "width"), SWITCH_CELLS.knob * CELL_PX);
  assert.equal(px(knob, "left"), SWITCH_CELLS.inset * CELL_PX);
  const on = body(css, ".sl-switch__input:checked + .sl-switch__track::after");
  const travel = Number(on.match(/translateX\((\d+)px\)/)[1]);
  assert.equal(travel, SWITCH_CELLS.steps * CELL_PX);
  assert.equal(SWITCH_CELLS.inset + SWITCH_CELLS.knob + SWITCH_CELLS.steps + SWITCH_CELLS.inset, SWITCH_CELLS.cols, "the knob seats one cell in on both sides");
  assert.match(css, new RegExp(`steps\\(${SWITCH_CELLS.steps}\\)`));
});

test("the knob uses steps() under prefers-reduced-motion: no-preference only, on the switch token", () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length));
  const all = [...bare.matchAll(/steps\(/g)].map((m) => m.index);
  assert.ok(all.length >= 1);
  const open = bare.indexOf("@media (prefers-reduced-motion: no-preference) {\n  .sl-switch__track::after");
  assert.ok(open > 0);
  const end = bare.indexOf("\n}\n", open);
  for (const i of all) assert.ok(i > open && i < end, "steps() outside the no-preference block");
  assert.match(bare.slice(open, end), /transform var\(--sl-motion-switch, 260ms\) steps\(5\)/);
});

test("the motion tokens exist and match the fallbacks in effects.js", () => {
  const tokens = readFileSync(resolve(KIT, "tokens.css"), "utf8");
  for (const [k, ms] of [["check", 180], ["radio", 150], ["switch", 260]]) {
    assert.match(tokens, new RegExp(`--sl-motion-${k}:\\s*${ms}ms;`));
    assert.match(js, new RegExp(`${k}: ${ms}[,} ]`));
  }
});

test("the shared maths: no tick before the fill is half in, all of it at the end; the dot steps; the knob steps", () => {
  assert.equal(tickCount(0), 0);
  assert.equal(tickCount(0.45), 0);
  assert.equal(tickCount(1), TICK_CELLS.length);
  let prev = 0;
  for (let t = 0; t <= 1; t += 0.01) { const n = tickCount(t); assert.ok(n >= prev); prev = n; }
  assert.deepEqual([0, 0.25, 0.5, 0.75, 1].map(dotFrame), [0, 1, 1, 2, 2]);
  assert.equal(knobCells(0, 0, 1), 0);
  assert.equal(knobCells(0.99, 0, 1), SWITCH_CELLS.steps - 1);
  assert.equal(knobCells(1, 0, 1), SWITCH_CELLS.steps);
  assert.equal(knobCells(1, 1, 0), 0);
  assert.equal(knobCells(0, 1, 0), SWITCH_CELLS.steps);
});

// ── the driver, run against stubs ───────────────────────────────────────────

const START = js.indexOf("/* ── pixel controls:");
const END = js.indexOf("/* ── end pixel controls ── */");
const SECTION = js.slice(START, END);
assert.ok(START > 0 && END > START, "the pixel section is found");

function rig({ reduced = false, dpr = 2 } = {}) {
  const env = { reduced, suppressed: false, now: 1000, queue: [], ops: [], canvases: [], layers: [], origins: [], styleLog: [] };
  class FakeNode {}
  class FakeEl extends FakeNode {
    constructor(classes = []) {
      super(); this.classes = new Set(classes); this.isConnected = true; this.children = []; this.closest = () => null;
      this.props = {};
      this.style = { setProperty: (k, v) => { this.props[k] = v; env.styleLog.push([this, k, v]); }, removeProperty: (k) => { delete this.props[k]; env.styleLog.push([this, k, null]); } };
    }
    matches(sel) { return sel.split(",").some((s) => this.classes.has(s.trim().replace(/^\./, ""))); }
  }
  const mkCtx = (canvas) => ({
    clearRect: () => { canvas.frame = []; },
    fillRect: () => canvas.frame.push({ full: true, fill: canvas.fs }),
    beginPath() { canvas.pending = []; },
    rect: (x, y, w, h) => canvas.pending.push({ x, y, w, h }),
    fill: () => { for (const r of canvas.pending) canvas.frame.push({ ...r, fill: canvas.fs }); },
    set fillStyle(v) { canvas.fs = v; }, get fillStyle() { return canvas.fs; },
  });
  const document = {
    documentElement: {},
    createElement(t) {
      if (t === "canvas") {
        const c = { width: 0, height: 0, frame: [], fs: "" };
        c.getContext = () => (c.ctx ??= mkCtx(c));
        env.canvases.push(c);
        return c;
      }
      const l = new FakeEl();
      l.className = ""; l.setAttribute = () => {}; l.append = (c) => { l.canvas = c; };
      l.classList = { add: (c) => l.classes.add(c), remove: (c) => l.classes.delete(c), contains: (c) => l.classes.has(c) };
      env.layers.push(l);
      return l;
    },
    querySelectorAll: () => env.inputs ?? [],
  };
  const window = { devicePixelRatio: dpr, matchMedia: () => ({ matches: env.reduced }) };
  const api = new Function("CELL_PX", "CONTROL_CELL_PX", "CHECK_INSET", "CHECK_BOX_CELLS", "wipeFrame", "CHECK_CELLS", "TICK_CELLS", "DOT_FRAMES", "SWITCH_CELLS", "TICK_START", "tickCount", "dotFrame", "knobCells",
    "suppressed", "REDUCE", "document", "window", "Element", "motionMs", "getComputedStyle", "requestAnimationFrame", "performance",
    `${SECTION}\nreturn { onPixelChange, seedPixel, prunePixels, pixels, pixeling };`)(
    CELL_PX, CONTROL_CELL_PX, CHECK_INSET, CHECK_BOX_CELLS, (grid, origin, t, spread) => { env.origins.push(origin); return wipeFrame(grid, origin, t, spread); }, CHECK_CELLS, TICK_CELLS, DOT_FRAMES, SWITCH_CELLS, TICK_START, tickCount, dotFrame, knobCells,
    () => env.suppressed, "(reduce)", document, window, FakeEl, () => 100,
    (el) => (el.layerLike ? { color: "FILL", borderTopColor: "ON" } : {}),
    (cb) => { env.queue.push(cb); return env.queue.length; }, { now: () => env.now });
  env.run = (ms, max = 1000) => { for (let i = 0; i < max && env.queue.length; i++) { env.now += ms; env.queue.shift()(env.now); } };
  /** A control: input + box, wired as the kit's markup is. */
  env.control = (kind, { name = "", checked = false, form = null, indeterminate = false } = {}) => {
    const boxClass = { check: "sl-check__box", radio: "sl-radio__box", switch: "sl-switch__track" }[kind];
    const inputClass = { check: "sl-check__input", radio: "sl-radio__input", switch: "sl-switch__input" }[kind];
    const box = new FakeEl([boxClass]);
    box.prepend = (l) => { box.layer = l; l.layerLike = true; };
    const input = new FakeEl([inputClass]);
    Object.assign(input, { name, checked, form, indeterminate, disabled: false, type: kind === "radio" ? "radio" : "checkbox", nextElementSibling: box });
    if (form) form.elements.push(input);
    return { input, box };
  };
  env.ev = (input) => ({ type: "change", target: input });
  env.form = () => ({ elements: [] });
  /** What a browser does for a click on `input`: pointerdown, then the state
   *  change (the group's others uncheck), then `change` on the one that took it. */
  env.click = (input, group = []) => {
    api.seedPixel({ target: input });
    for (const r of group) if (r !== input) r.checked = false;
    input.checked = input.type === "radio" ? true : !input.checked;
    input.indeterminate = false;
    api.onPixelChange(env.ev(input));
  };
  return { env, api, FakeEl };
}

/** The cells of the last frame whose fill is `colour`, as [col,row]. */
const lastCells = (canvas, colour, dpr = 2) =>
  canvas.frame.filter((r) => !r.full && r.fill === colour).map((r) => [r.x / (CONTROL_CELL_PX * dpr) - CHECK_INSET, r.y / (CONTROL_CELL_PX * dpr) - CHECK_INSET]);

test("nothing is built before a change: no canvas, no layer", () => {
  const { env, api } = rig();
  assert.equal(env.canvases.length, 0);
  assert.equal(api.pixels.size, 0);
  assert.equal(api.pixeling.size, 0);
  assert.equal(env.queue.length, 0);
});

test("checking a box: the layer goes live, the fill and then the tick are plotted, and it ends hidden on the CSS frame", () => {
  const { env, api } = rig();
  const { input, box } = env.control("check");
  input.checked = true;
  api.onPixelChange(env.ev(input));
  assert.equal(env.canvases.length, 1);
  assert.ok(box.layer.classes.has("is-live"));
  const c = env.canvases[0];
  assert.equal(c.width, CHECK_BOX_CELLS * CONTROL_CELL_PX * 2, "the whole 16px box in whole 2px cells at the device ratio");
  assert.equal(env.queue.length, 1, "one rAF");
  let sawPartialTick = false;
  const seen = [];
  while (env.queue.length) {
    env.now += 16; env.queue.shift()(env.now);
    const n = lastCells(c, "ON").length;
    seen.push(n);
    if (n > 0 && n < TICK_CELLS.length) sawPartialTick = true;
    if (box.layer.classes.has("is-live")) assert.ok(n >= 0);
  }
  assert.ok(sawPartialTick, "the tick is plotted cell by cell");
  assert.deepEqual(seen, [...seen].sort((a, b) => a - b), "cells only get added going in");
  assert.ok(!box.layer.classes.has("is-live"), "hidden when the motion ends");
  assert.equal(api.pixeling.size, 0);
  // the last frame, drawn just before it hid, is the CSS frame: a full fill and the tick's cells
  assert.ok(c.frame.some((r) => r.full && r.fill === "FILL"));
  assert.deepEqual(sorted(lastCells(c, "ON")), sorted(TICK_CELLS));
});

test("unchecking reverses it, and the last frame is nothing over the ground", () => {
  const { env, api } = rig();
  const { input, box } = env.control("check", { checked: true });
  input.checked = false;
  api.onPixelChange(env.ev(input));
  const c = env.canvases[0];
  assert.deepEqual(sorted(lastCells(c, "ON")), sorted(TICK_CELLS), "starts on the checked frame");
  env.run(16);
  assert.ok(!box.layer.classes.has("is-live"));
  assert.equal(c.frame.length, 0, "ended on the bare ground");
});

/** Run every queued frame, noting each canvas's last drawn ON cells. */
const runAll = (env, ms = 10) => { while (env.queue.length) { env.now += ms; env.queue.shift()(env.now); } };

test("a radio steps from the 2 x 2 core to the 12-cell dot; the radio it replaces steps back down", () => {
  const { env, api } = rig();
  const a = env.control("radio", { name: "g", checked: true });
  const b = env.control("radio", { name: "g" });
  env.inputs = [a.input, b.input];
  env.click(b.input, [a.input, b.input]);
  assert.equal(api.pixeling.size, 2, "both radios animate");
  assert.ok(a.box.layer.classes.has("is-live") && b.box.layer.classes.has("is-live"));
  const cb = b.box.layer.canvas;
  const shapes = new Set();
  while (env.queue.length) {
    env.now += 10; env.queue.shift()(env.now);
    shapes.add(lastCells(cb, "ON").length);
  }
  assert.ok(shapes.has(4) && shapes.has(12), "the core, then the dot");
  assert.deepEqual(sorted(lastCells(cb, "ON")), sorted(DOT_FRAMES[1]));
  assert.ok(!a.box.layer.classes.has("is-live") && !b.box.layer.classes.has("is-live"));
});

test("a programmatic change before a user's: the old radio is the one painted on, not the stale record", () => {
  const { env, api } = rig();
  const a = env.control("radio", { name: "g", checked: true });
  const b = env.control("radio", { name: "g" });
  const c = env.control("radio", { name: "g" });
  env.inputs = [a.input, b.input, c.input];
  api.seedPixel({ target: a.input }); // an earlier hover or press left this record: a
  a.input.checked = false; b.input.checked = true; // script moved it, with no event
  env.click(c.input, env.inputs);
  assert.ok(b.box.layer, "b, which CSS showed on, steps down");
  assert.equal(a.box.layer, undefined, "a, which was already empty, is never animated from 1: no flash");
  assert.ok(c.box.layer.classes.has("is-live"));
});

test("form.reset() then a user change: the reset's checked radio is the one that steps down", () => {
  const { env, api } = rig();
  const form = env.form();
  const a = env.control("radio", { name: "g", checked: true, form });
  const b = env.control("radio", { name: "g", form });
  env.click(b.input, form.elements);
  runAll(env);
  a.input.checked = true; b.input.checked = false; // form.reset(): no change event
  env.click(b.input, form.elements);
  assert.ok(a.box.layer.classes.has("is-live"), "a was painted on after the reset, so it drains");
  assert.equal(a.input.checked, false);
});

test("two forms with one radio name and a formless group never touch each other's radios", () => {
  const { env, api } = rig();
  const f1 = env.form();
  const f2 = env.form();
  const a1 = env.control("radio", { name: "g", checked: true, form: f1 });
  const b1 = env.control("radio", { name: "g", form: f1 });
  const a2 = env.control("radio", { name: "g", checked: true, form: f2 });
  const a0 = env.control("radio", { name: "g", checked: true });
  const b0 = env.control("radio", { name: "g" });
  env.inputs = [a0.input, b0.input]; // the formless pool document.querySelectorAll sees
  env.click(b1.input, f1.elements);
  assert.ok(a1.box.layer && b1.box.layer);
  assert.equal(a2.box.layer, undefined, "the other form's checked radio is untouched");
  assert.equal(a0.box.layer, undefined, "so is the formless one");
  runAll(env);
  env.click(b0.input, env.inputs);
  assert.ok(a0.box.layer && b0.box.layer, "the formless group animates its own pair");
  assert.equal(a2.box.layer, undefined);
});

test("reversal mid-animation: progress is continuous, and the layer ends hidden", () => {
  const { env, api } = rig();
  const { input, box } = env.control("check");
  env.click(input);
  for (let i = 0; i < 4; i++) { env.now += 16; env.queue.shift()(env.now); }
  const d = api.pixels.get(box);
  const mid = d.p;
  assert.ok(mid > 0 && mid < 1);
  env.click(input); // unchecks
  assert.equal(d.p, mid, "reversal starts from where the motion is");
  assert.equal(d.dir, -1);
  runAll(env, 16);
  assert.equal(d.p, 0);
  assert.ok(!box.layer.classes.has("is-live"));
  assert.equal(api.pixeling.size, 0);
});

test("a programmatic change during a live motion: it ends hidden, and the next user change restarts from the painted state", () => {
  const { env, api } = rig();
  const { input, box } = env.control("check");
  env.click(input);
  env.now += 16; env.queue.shift()(env.now);
  input.checked = false; // script, no event
  runAll(env, 16);
  assert.ok(!box.layer.classes.has("is-live"));
  const d = api.pixels.get(box);
  env.click(input); // a user check now: CSS showed empty, so the motion starts from 0
  assert.equal(d.p <= 0.001 || d.p < 0.2, true, "starts from empty, not from 1");
  assert.equal(d.dir, 1);
});

test("indeterminate to checked starts from the filled state: the fill never vanishes and regrows", () => {
  const { env, api } = rig();
  const { input, box } = env.control("check", { indeterminate: true });
  env.click(input);
  const d = api.pixels.get(box);
  const c = env.canvases[0];
  assert.equal(d.p, TICK_START, "starts where the tick begins");
  assert.ok(c.frame.some((r) => r.full && r.fill === "FILL"), "the fill is whole on the first frame");
  assert.equal(lastCells(c, "ON").length, 0, "and no tick yet");
  let sawPartial = false;
  while (env.queue.length) {
    env.now += 10; env.queue.shift()(env.now);
    assert.ok(c.frame.some((r) => r.full && r.fill === "FILL"), "the fill stays whole on every frame");
    const n = lastCells(c, "ON").length;
    if (n > 0 && n < TICK_CELLS.length) sawPartial = true;
  }
  assert.ok(sawPartial);
  assert.deepEqual(sorted(lastCells(c, "ON")), sorted(TICK_CELLS));
  assert.equal(d.keep, false);
});

test("a change on a disabled input does nothing", () => {
  const { env, api } = rig();
  const { input } = env.control("check");
  input.checked = true;
  input.disabled = true;
  api.onPixelChange(env.ev(input));
  assert.equal(env.canvases.length, 0);
  assert.equal(api.pixeling.size, 0);
});

test("a switch: the knob variable and the fill's origin agree on every frame, however fast it is toggled", () => {
  const { env, api } = rig();
  const { input, box } = env.control("switch");
  const c0 = () => SWITCH_CELLS.inset + SWITCH_CELLS.knob / 2;
  let seen = 0;
  let drawn = 0;
  const check = (last) => {
    const knobPx = Number.parseFloat(box.props["--slfx-knob-x"]);
    assert.equal(knobPx % CELL_PX, 0, "the knob moves in whole cells");
    if (env.origins.length > drawn) { // a frame at t=0 covers nothing and asks for no frame
      assert.equal(env.origins[env.origins.length - 1].x, c0() + knobPx / CELL_PX, "the fill's origin is the knob's centre");
      drawn = env.origins.length;
    }
    assert.ok(knobPx >= 0 && knobPx <= SWITCH_CELLS.steps * CELL_PX);
    if (last !== undefined) assert.ok(Math.abs(knobPx - last) <= CELL_PX, "never more than a step per frame");
    seen++;
    return knobPx;
  };
  env.click(input); // on
  let prev = check();
  for (let i = 0; i < 5; i++) { env.now += 16; env.queue.shift()(env.now); prev = check(prev); }
  env.click(input); // off again, mid-way, in the same breath
  prev = check(prev);
  while (env.queue.length) { env.now += 16; env.queue.shift()(env.now); if (box.props["--slfx-knob-x"] !== undefined) prev = check(prev); }
  assert.ok(seen > 6);
  assert.equal(box.props["--slfx-knob-x"], undefined, "dropped on the last frame, so CSS owns the knob again");
  assert.ok(!box.layer.classes.has("is-live"));
  // and a plain on ends full, with the knob's last value the whole travel
  env.click(input);
  runAll(env, 16);
  const sets = env.styleLog.filter(([el, , v]) => el === box && v !== null);
  const lastKnob = Number.parseFloat(sets[sets.length - 1][2]);
  assert.equal(lastKnob, SWITCH_CELLS.steps * CELL_PX, "the last frame puts the knob on its CSS seat");
  assert.ok(env.canvases[0].frame.some((r) => r.full && r.fill === "FILL"), "the on-track ends solid");
});

test("the live knob: JS owns it through a custom property while the layer is live, over the held-knob rules", () => {
  const rule = fx.match(/\.sl-switch__track:has\(> \.sl-fx-pixel\.is-live\)::after \{([^}]*)\}/)[1];
  assert.match(rule, /transform: translateY\(-50%\) translateX\(var\(--slfx-knob-x, 0px\)\) !important;/);
  assert.match(rule, /transition-property: background-color !important;/);
  assert.match(SECTION, /style\.setProperty\("--slfx-knob-x"/);
  assert.match(SECTION, /style\.removeProperty\("--slfx-knob-x"\)/);
});

test("kill switches: reduced motion, suppression (high contrast), and an opt-out region start nothing", () => {
  for (const mod of [(e, i) => { e.reduced = true; }, (e) => { e.suppressed = true; }, (e, i) => { i.closest = () => ({}); }]) {
    const { env, api } = rig();
    const { input } = env.control("check");
    input.checked = true;
    mod(env, input);
    api.onPixelChange(env.ev(input));
    assert.equal(env.canvases.length, 0);
    assert.equal(api.pixeling.size, 0);
  }
  assert.match(SECTION, /window\.matchMedia\(REDUCE\)\.matches/);
  assert.match(fx, /:root\[data-sl-theme="high-contrast"\] \.sl-fx-pixel,\n:is\(\[data-sl-fx="off"\], \[data-sl-fx="off"\] \*\) \.sl-fx-pixel \{ display: none !important; \}/);
  assert.match(fx, /@media \(prefers-reduced-motion: reduce\) \{\n  \.sl-fx-pixel \{ display: none !important; \}/);
  assert.match(fx, /@media \(forced-colors: active\) \{\n  \.sl-fx-pixel \{ display: none !important; \}/);
});

test("a non-pixel change and a detached host are ignored or pruned; the device ratio is capped at 2", () => {
  const { env, api, FakeEl } = rig({ dpr: 3 });
  const other = new FakeEl(["sl-field__input"]);
  api.onPixelChange(env.ev(other));
  assert.equal(env.canvases.length, 0);
  const { input, box } = env.control("check");
  input.checked = true;
  api.onPixelChange(env.ev(input));
  assert.equal(env.canvases[0].width, CHECK_BOX_CELLS * CONTROL_CELL_PX * 2, "dpr 3 is capped to 2");
  box.isConnected = false;
  api.prunePixels();
  assert.equal(api.pixels.size, 0);
  assert.equal(api.pixeling.size, 0);
});

test("effects.js: delegated change listener, lazy build, one loop, shared maths, pruned", () => {
  assert.equal([...js.matchAll(/addEventListener\("change"/g)].length, 1, "exactly one change listener");
  assert.match(js, /root\.addEventListener\("change", onPixelChange\);/);
  assert.match(js, /root\.addEventListener\("pointerdown", seedPixel, \{ capture: true, passive: true \}\);/);
  assert.match(js, /root\.addEventListener\("keydown", seedPixel, \{ capture: true, passive: true \}\);/);
  assert.match(SECTION, /r\.name === input\.name && r\.form === input\.form/, "a group is the same name in the same form");
  assert.doesNotMatch(SECTION, /pointerover|focusin/, "the record is written right before a change, not on hover");
  assert.match(js, /import \{[^}]*\bTICK_CELLS\b[^}]*\} from "\.\/dither-core\.js";/);
  assert.equal([...SECTION.matchAll(/createElement\("canvas"\)/g)].length, 1);
  assert.equal([...js.matchAll(/ensurePixel\(/g)].length, 2, "defined and called once (movePixel)");
  assert.equal([...SECTION.matchAll(/requestAnimationFrame\(/g)].length, 2, "one loop: wake and re-arm");
  assert.match(SECTION, /Math\.min\(PIXEL_DPR_CAP, window\.devicePixelRatio/);
  assert.match(SECTION, /PIXEL_DPR_CAP = 2;/);
  assert.match(js, /pruneDithers\(\);\n  prunePixels\(\);/);
  assert.doesNotMatch(SECTION, /#[0-9a-f]{3,8}\b|rgba?\(|oklch\(|hsl\(/i, "colours come from the layer's computed role vars");
  assert.doesNotMatch(SECTION, /globalCompositeOperation|\.filter\s*=|globalAlpha|stroke/, "no blend, filter, alpha or outline");
});

test("the layer: opaque off-ground, above the box's tick, below the track's knob, rounded and clipped, no blend", () => {
  const layer = body(fx, ".sl-fx-pixel");
  assert.match(layer, /border-radius: inherit/);
  assert.match(layer, /overflow: hidden/);
  assert.match(layer, /background-color: var\(--slfx-pixel-ground\)/);
  assert.match(layer, /color: var\(--slfx-pixel-fill\)/);
  assert.match(layer, /border-top-color: var\(--slfx-pixel-on\)/);
  assert.doesNotMatch(layer, /mix-blend-mode|opacity|filter|backdrop-filter|outline/);
  assert.match(fx, /:is\(\.sl-check__box, \.sl-radio__box\) > \.sl-fx-pixel \{ z-index: 1; \}/);
  assert.doesNotMatch(body(fx, ".sl-fx-pixel"), /z-index/, "the track's layer stays below its ::after knob");
});

// ── disabled: the checkerboard ──────────────────────────────────────────────

const DISABLED_START = css.indexOf("/* DISABLED (owner, 2026-10-26");
const DISABLED = css.slice(DISABLED_START, css.indexOf("\n}\n", css.indexOf("@media not (forced-colors: active)", DISABLED_START)));

test("disabled: a 50% 1px checkerboard mask on the control itself, on every listed control, no pseudo-element", () => {
  assert.ok(DISABLED_START > 0);
  for (const sel of [".sl-btn:disabled", ".sl-icon-btn:disabled", ".sl-field__input:disabled", ".sl-chip:disabled", ".sl-segmented__item:is(:disabled", ".sl-check:has(.sl-check__input:disabled)", ".sl-radio:has(.sl-radio__input:disabled)", ".sl-switch:has(.sl-switch__input:disabled)"]) {
    assert.ok(DISABLED.includes(sel), sel);
  }
  assert.doesNotMatch(DISABLED.slice(DISABLED.indexOf("@media not")), /::(before|after)/);
  for (const prefix of ["", "-webkit-"]) {
    assert.match(DISABLED, new RegExp(`${prefix}mask-image: repeating-conic-gradient\\(#000 0 25%, transparent 0 50%\\);`));
    assert.match(DISABLED, new RegExp(`${prefix}mask-size: 2px 2px;`));
  }
  assert.match(DISABLED, /opacity: 1;/, "the old half opacity is undone where the checker applies");
  assert.match(DISABLED, /\n  \):not\(:focus-visible\) \{/, "never on a focus-visible control: its ring is not cut");
  assert.match(DISABLED, /clips|clip/, "the clipped outset shadows are named in the comment");
});

test("disabled: high contrast and forced colours keep today's half opacity and get no mask", () => {
  assert.match(DISABLED, /@media not \(forced-colors: active\) \{\n  :root:not\(\[data-sl-theme="high-contrast"\]\) :is\(/);
  for (const sel of [".sl-btn:disabled", ".sl-icon-btn:disabled", ".sl-field__input:disabled", ".sl-chip:disabled", ".sl-segmented__item:is(:disabled, [aria-disabled=\"true\"])", ".sl-check:has(.sl-check__input:disabled),\n.sl-radio:has(.sl-radio__input:disabled),\n.sl-switch:has(.sl-switch__input:disabled)"]) {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(css, new RegExp(`(?:^|\\n)${esc} \\{ opacity: 0\\.5; cursor: not-allowed; \\}`), sel);
  }
  assert.doesNotMatch(css.slice(0, DISABLED_START), /mask-image: repeating-conic/);
});

test("disabled: an aria-disabled segmented item that has focus-visible gets the opacity fallback, no mask", () => {
  assert.match(css, /\n\.sl-segmented__item:is\(:disabled, \[aria-disabled="true"\]\) \{ opacity: 0\.5; cursor: not-allowed; \}/);
  const masked = DISABLED.slice(DISABLED.indexOf("@media not"));
  const sel = masked.slice(masked.indexOf(":root:not"), masked.indexOf("):not(:focus-visible) {") + 22);
  assert.match(sel, /\.sl-segmented__item:is\(:disabled, \[aria-disabled="true"\]\)/);
  assert.match(sel, /:not\(:focus-visible\)/);
});

test("disabled: a busy aurora rim keeps full opacity and no checker", () => {
  const m = fx.match(/\.sl-fx-aurora--rim\[data-sl-fx-live="busy"\]:disabled:not\([^{]*\{([^}]*)\}/);
  assert.match(m[1], /opacity: 1;/);
  assert.match(m[1], /mask-image: none;/);
});

test("the knob's seat is rendered for one frame before the layer goes, so CSS starts no transition from the frame before", () => {
  const { env, api } = rig();
  const { input, box } = env.control("switch");
  env.click(input);
  const seat = `${SWITCH_CELLS.steps * CELL_PX}px`;
  while (box.props["--slfx-knob-x"] !== seat) { env.now += 16; env.queue.shift()(env.now); }
  assert.ok(box.layer.classes.has("is-live"), "the layer is still live on the frame that puts the knob on its seat");
  assert.equal(env.queue.length, 1, "and one more frame is asked for");
  env.now += 16; env.queue.shift()(env.now);
  assert.equal(box.props["--slfx-knob-x"], undefined);
  assert.ok(!box.layer.classes.has("is-live"));
});
