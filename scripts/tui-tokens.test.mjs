import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadTokens } from "./lib/tokens.mjs";

// The tui section (glyphs + layout) sits beside `terminal`, never inside it:
// gen-py reads every `terminal` entry as a colour role.

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = readFileSync(resolve(HERE, "../packages/palette-py/sondalab_palette/__init__.py"), "utf8");
const t = loadTokens();

test("every glyph has unicode + ascii forms and a role that exists in terminal", () => {
  assert.ok(t.tui?.glyphs, "tui.glyphs missing");
  for (const [name, g] of Object.entries(t.tui.glyphs)) {
    assert.ok(g.unicode && g.unicode.length > 0, `${name}: empty unicode`);
    assert.ok(g.ascii && g.ascii.length > 0, `${name}: empty ascii`);
    assert.ok(Object.hasOwn(t.terminal, g.role), `${name}: role "${g.role}" is not a terminal role`);
  }
});

test("every ascii form is 7-bit", () => {
  for (const [name, g] of Object.entries(t.tui.glyphs)) {
    assert.match(g.ascii, /^[\x20-\x7e]+$/, `${name}: ascii form is not 7-bit printable`);
  }
});

test("layout carries the four integers", () => {
  assert.deepEqual(t.tui.layout, { indent: 2, labelWidth: 28, blankBeforeSummary: 1, maxWidth: 100 });
});

test("generated python exposes GLYPHS and LAYOUT", () => {
  assert.ok(PY.includes("GLYPHS = {"), "GLYPHS table missing");
  assert.ok(PY.includes('"done": ("✓", "+", "ok")'), "done glyph row missing");
  assert.ok(PY.includes('"failed": ("✗", "x", "err")'), "failed glyph row missing");
  assert.ok(PY.includes("LAYOUT = {"), "LAYOUT table missing");
  assert.ok(PY.includes('"labelWidth": 28'), "labelWidth missing");
  assert.ok(PY.includes('"maxWidth": 100'), "maxWidth missing");
});

test("generated python exposes every tui table", () => {
  for (const name of ["RAMP", "SPINNER", "DECODE", "PROGRESS", "MOTION", "BOX", "KEYS", "ROBUSTNESS", "ENV"]) {
    assert.ok(PY.includes(`\n${name} = {\n`), `${name} table missing`);
  }
  assert.ok(PY.includes('"frames": (" ", "░", "▒", "▓", "█", "▓", "▒", "░")'), "spinner frames missing");
  assert.ok(PY.includes('"intervalMs": 100'), "spinner interval missing");
  assert.ok(PY.includes('"topLeft": ("╭", "+")'), "box corner missing");
  assert.ok(PY.includes('"reducedMotion": ("SONDALAB_REDUCED_MOTION",)'), "env tuple missing");
});

test("terminal is unchanged: six roles, same values", () => {
  assert.deepEqual(t.terminal, {
    prompt: { ansi: "bright_yellow", true: "#F5A83C" },
    ok: { ansi: "green", true: "#62D094" },
    warn: { ansi: "yellow", true: "#F5A83C" },
    err: { ansi: "red", true: "#f87171" },
    dim: { ansi: "bright_black", true: "#6E8088" },
    accent: { ansi: "cyan", true: "#35A0B4" },
  });
});
