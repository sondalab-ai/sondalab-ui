import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import * as t from "../packages/ui-kit/term.js";

// term.js must give the bytes sondalab_palette.term gives. The cases and the
// Python results are scripts/fixtures/term-parity.json, written by
// scripts/gen-term-parity.py; the palette's tests/test_term_parity.py re-runs
// them through Python, so a change on either side fails CI. Each case is the
// Python call; ADAPT maps it onto the camelCase signature.

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = JSON.parse(readFileSync(resolve(HERE, "fixtures/term-parity.json"), "utf8"));

/** The stand-in rng of gen-term-parity.py: a fixed stride through the pool. */
function cycle() {
  let k = 0;
  return { choice: (pool) => pool[(k += 7) % pool.length] };
}

/** A string sink with the isTTY of a pipe. */
function sink() {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(String(c)); cb(); } });
  w.text = () => chunks.join("");
  return w;
}

const tty = (k) => (k.isatty === undefined ? {} : { isTTY: k.isatty });
const opt = (k, ...names) => Object.fromEntries(names.filter((n) => k[n] !== undefined && k[n] !== null).map((n) => [n, k[n]]));

/** Python helper name -> (args, kwargs) => the term.js result in the fixture's shape. */
const ADAPT = {
  color_mode: (a, k) => t.colorMode({ env: k.env, ...tty(k), ...opt(k, "flag", "truecolor") }),
  accessible: (a, k) => t.accessible(k.env),
  reduced_motion: (a, k) => t.reducedMotion(k.env),
  switch_on: (a, k) => t.switchOn(a[0], k.env),
  motion_enabled: (a, k) => t.motionEnabled({ env: k.env, ...tty(k) }),
  ascii_mode: (a, k) => t.asciiMode({ env: k.env, ...opt(k, "encoding", "override") }),
  paint: (a) => t.paint(...a),
  lockup: (a) => t.lockup(...a),
  step_line: (a, k) => t.stepLine(a[0], a[1], a[2], opt(k, "ascii", "mode")),
  header: (a, k) => t.header(a[0], a[1], a[2], { env: k.env, ...tty(k), ...opt(k, "compact", "machine") }),
  spinner_frame: (a, k) => t.spinnerFrame(a[0], opt(k, "ascii")),
  progress_bar: (a, k) => t.progressBar(a[0], a[1], opt(k, "ascii")),
  decode_frames: (a, k) => t.decodeFrames(a[0], cycle(), opt(k, "ascii")),
  summary: (a, k) => t.summary(...a, opt(k, "mode", "ascii")),
  width: (a) => t.width(a[0]),
  wrap: (a, k) => t.wrap(a[0], { env: a[1], ...opt(k, "indent") }),
  error_block: (a, k) => t.errorBlock(a[0], a[1], a[2], opt(k, "link", "env", "ascii", "mode")),
  next_line: (a, k) => t.nextLine(a[0], opt(k, "mode")),
  heading: (a, k) => t.heading(a[0], opt(k, "mode")),
  key_hints: (a, k) => t.keyHints(a[0], opt(k, "ascii", "mode")),
  arrows: (a, k) => t.arrows(opt(k, "ascii")),
  kv_line: (a) => t.kvLine(...a),
  parse_yes_no: (a) => t.parseYesNo(...a),
  parse_choice: (a) => t.parseChoice(...a),
  needs_prompt: (a, k) => t.needsPrompt(a[0], { ...opt(k, "given", "what", "command"), ...tty(k) }),
  TermError: (a) => fields(new t.TermError(...a)),
  NoValidAnswer: (a) => fields(new t.NoValidAnswer(...a)),
  MissingFlag: (a) => fields(new t.MissingFlag(...a)),
  confirm: (a, k) => prompt((io) => t.confirm(a[0], { ...io, ...opt(k, "default", "mode") }), k.lines),
  choose: (a, k) => prompt((io) => t.choose(a[0], a[1], { ...io, ...opt(k, "mode") }), k.lines),
};

/** An error's parts and both renderings, as gen-term-parity.py records them. */
function fields(e) {
  return {
    str: e.message, what: e.what, why: e.why, fix: e.fix,
    block: e.block({ env: { COLUMNS: "80" } }),
    block_ansi: e.block({ env: { COLUMNS: "40" }, mode: "ansi16", ascii: true }),
  };
}

/** Run a prompt over `lines` then end of input; the value or the NoValidAnswer, and what it wrote. */
async function prompt(call, lines) {
  const output = sink();
  let got;
  try {
    got = { value: await call({ input: Readable.from(lines.length ? [lines.join("")] : []), output }) };
  } catch (e) {
    if (!(e instanceof t.NoValidAnswer)) throw e;
    got = { raises: "NoValidAnswer", str: e.message };
  }
  return { ...got, written: output.text() };
}

// ValueError and KeyError are RangeError in JS; a TermError keeps its name.
const JS_ERROR = { ValueError: RangeError, KeyError: RangeError };

test("the parity fixture covers every helper", () => {
  assert.ok(CASES.length > 500);
  assert.deepEqual([...new Set(CASES.map((c) => c.fn))].sort(), Object.keys(ADAPT).sort());
});

for (const [i, c] of CASES.entries()) {
  test(`#${i} ${c.fn}(${JSON.stringify(c.args).slice(1, -1).slice(0, 60)}) ${JSON.stringify(c.kwargs).slice(0, 80)}`, async () => {
    const run = () => ADAPT[c.fn](c.args, c.kwargs);
    if (c.raises && JS_ERROR[c.raises]) {
      await assert.rejects(async () => run(), JS_ERROR[c.raises]);
      return;
    }
    if (c.raises) {
      let err;
      try { await run(); } catch (e) { err = e; }
      assert.ok(err instanceof t[c.raises], `expected ${c.raises}, got ${err}`);
      assert.deepEqual({ str: err.message, what: err.what, why: err.why, fix: err.fix }, c.out);
      return;
    }
    assert.deepEqual(await run(), c.out);
  });
}
