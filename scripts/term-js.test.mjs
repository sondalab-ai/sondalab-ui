import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { loadTokens } from "./lib/tokens.mjs";
import * as t from "../packages/ui-kit/term.js";

// @sondalab/ui-kit/term.js (0.43.0): the spec's own examples, the rules a
// reader checks first, and what the parity fixture cannot hold (streams that
// arrive in pieces, the module's imports, the generated constants).

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const UTF8 = { LANG: "en_US.UTF-8", COLUMNS: "80" };
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function sink(isTTY = false) {
  const chunks = [];
  const w = new Writable({ write(c, _e, cb) { chunks.push(String(c)); cb(); } });
  w.isTTY = isTTY;
  w.text = () => chunks.join("");
  return w;
}

test("colour precedence: flag, NO_COLOR, FORCE_COLOR, then TTY and TERM", () => {
  const cm = (o) => t.colorMode({ env: {}, isTTY: false, ...o });
  assert.equal(cm({ flag: true, env: { NO_COLOR: "1" } }), "ansi16");
  assert.equal(cm({ flag: false, env: { FORCE_COLOR: "1" }, isTTY: true }), "none");
  assert.equal(cm({ env: { NO_COLOR: "1", FORCE_COLOR: "1" }, isTTY: true }), "none");
  assert.equal(cm({ env: { NO_COLOR: "" }, isTTY: true }), "ansi16", "an empty NO_COLOR is unset");
  assert.equal(cm({ env: { FORCE_COLOR: "1" } }), "ansi16");
  assert.equal(cm({ env: { FORCE_COLOR: "0" } }), "none");
  assert.equal(cm({ isTTY: true, env: { TERM: "dumb" } }), "none");
  assert.equal(cm({ isTTY: true, env: { COLORTERM: "truecolor" } }), "ansi16", "truecolor is opt-in");
  assert.equal(cm({ isTTY: true, truecolor: true, env: { COLORTERM: "24bit" } }), "truecolor");
});

test("paint: the named-ANSI floor, the brand hue, dim is bright black", () => {
  assert.equal(t.paint("x", "ok", "ansi16"), "\x1b[32mx\x1b[0m");
  assert.equal(t.paint("x", "ok", "truecolor"), "\x1b[38;2;98;208;148mx\x1b[0m");
  assert.equal(t.paint("x", "dim", "ansi16"), "\x1b[90mx\x1b[0m");
  assert.equal(t.paint("", "ok", "ansi16"), "");
  assert.throws(() => t.paint("x", "bold", "none"), RangeError);
});

test("ASCII forms: every glyph, the ellipsis, the progress ramp and the arrows", () => {
  assert.equal(t.asciiMode({ env: { LANG: "C" } }), true);
  assert.equal(t.asciiMode({ env: { LANG: "en_US.UTF-8" } }), false);
  assert.equal(t.asciiMode({ env: { LANG: "en_US.UTF-8", SONDALAB_ASCII: "1" } }), true);
  assert.equal(t.asciiMode({ env: { TERM: "dumb" }, override: false }), false);
  const forms = Object.keys(t.GLYPHS).map((g) => t.stepLine(g, "x", "", { ascii: true })[2]);
  assert.deepEqual(forms, Object.values(t.GLYPHS).map((g) => g.ascii));
  assert.equal(t.stepLine("active", "Waiting…", "", { ascii: true }), "  * Waiting...");
  assert.equal(t.progressBar(61, 128, { ascii: true }), "    ############:.             61/128   48%");
  assert.equal(t.arrows({ ascii: true }), "up/dn");
});

test("step line and summary match the spec's examples", () => {
  assert.equal(t.stepLine("done", "Resolved 128 probes", "2.1s"), "  ✓ Resolved 128 probes         2.1s");
  assert.equal(t.summary(1, 1, 1, 1), "Summary  1 ok · 1 fixed · 1 warn · 1 failed");
  assert.equal(t.summary(0, 0, 0, 0, { ascii: true }), "Summary  0 ok | 0 fixed | 0 warn | 0 failed");
  assert.equal(t.summary(0, 2, 0, 0, { mode: "ansi16" }).split("\x1b[90m0 ok").length, 2, "a zero count is dim");
});

test("error block: what cut at the cap, why wrapped from the label column, fix never cut", () => {
  const env = { COLUMNS: "30" };
  const fix = "git remote -v --and-a-very-long-flag-that-passes-the-width";
  const lines = t.errorBlock("W".repeat(130), "git ls-remote timed out after 10s (exit 128)", fix, { env, link: "sondalab.eu/e/T102" }).split("\n");
  assert.equal(lines[0], "  ✗ " + "W".repeat(96));
  assert.deepEqual(lines.slice(1, 3), ["    git ls-remote timed out", "    after 10s (exit 128)"]);
  assert.equal(lines[3], `    Try: ${fix} · sondalab.eu/e/T102`);
  assert.equal(t.errorBlock("Failed", "", ""), "  ✗ Failed", "empty why and fix omit their lines");
});

test("width is the terminal's, capped at layout.maxWidth; unknown is the cap", () => {
  assert.equal(t.width({ COLUMNS: "60" }), 60);
  assert.equal(t.width({ COLUMNS: "300" }), 100);
  if (!process.stdout.isTTY) {
    assert.equal(t.width({ COLUMNS: "0" }), 100);
    assert.equal(t.width({ COLUMNS: "wide" }), 100);
  }
  assert.equal(t.wrap("a b c", { env: { COLUMNS: "3" } }), "a b\nc");
});

test("header: nothing off a TTY, in accessible mode or for machine output", () => {
  const args = ["cld", "0.9.0", "Manage Claude Code loadouts."];
  assert.equal(t.header(...args, { env: UTF8, isTTY: false }), "");
  assert.equal(t.header(...args, { env: { ...UTF8, ACCESSIBLE: "" }, isTTY: true }), "");
  assert.equal(t.header(...args, { env: UTF8, isTTY: true, machine: true }), "");
  assert.equal(strip(t.header(...args, { env: UTF8, isTTY: true })), "▄█▄ ▄▄  sonda/lab\n▀█▀ ▀▀  cld 0.9.0\n▄▄▄▄▄▄  Manage Claude Code loadouts.\n");
  assert.equal(t.header(...args, { env: { ...UTF8, TERM: "dumb" }, isTTY: true }), "sonda/lab cld 0.9.0\n");
});

test("parse: [y/N] and numbered answers; unrecognised is null, never a choice", () => {
  assert.equal(t.parseYesNo(" YES ", false), true);
  assert.equal(t.parseYesNo("", true), true);
  assert.equal(t.parseYesNo("maybe", true), null);
  assert.equal(t.parseChoice("2", 3), 1);
  assert.equal(t.parseChoice("4", 3), null);
  assert.equal(t.parseChoice("+1", 3), null);
});

test("confirm retries up to robustness.promptRetries, then fails", async () => {
  const input = new PassThrough();
  const output = sink();
  const answer = t.confirm("Delete?", { input, output, env: {} });
  for (const l of ["what\n", "huh\n", "no idea\n"]) {
    await new Promise((r) => setImmediate(r));
    input.write(l);
  }
  await assert.rejects(answer, (e) => e instanceof t.NoValidAnswer && e.why === "no recognised answer in 3 tries");
  assert.equal(output.text(), "? Delete? [y/N] ".repeat(3));
});

test("confirm reads answers that arrive in pieces; end of input never takes the default", async () => {
  const input = new PassThrough();
  const answer = t.confirm("Go?", { default: true, input, output: sink() });
  input.write("ye");
  await new Promise((r) => setImmediate(r));
  input.write("s\n");
  assert.equal(await answer, true);
  const ended = new PassThrough();
  const output = sink();
  const eof = t.confirm("Go?", { default: true, input: ended, output });
  ended.end();
  await assert.rejects(eof, (e) => e instanceof t.NoValidAnswer && e.why === "input ended before an answer");
  assert.equal(output.text(), "? Go? [Y/n] \n");
});

test("prompt colour follows the output stream when mode is omitted", async () => {
  const input = new PassThrough();
  const output = sink(true);
  const answer = t.confirm("Go?", { input, output, env: {} });
  input.end("y\n");
  assert.equal(await answer, true);
  assert.equal(output.text(), "\x1b[93m?\x1b[0m Go? [y/N] ");
});

test("needsPrompt: a given flag skips, a TTY prompts, otherwise MissingFlag", () => {
  assert.equal(t.needsPrompt("--yes", { given: true, isTTY: false }), false);
  assert.equal(t.needsPrompt("--yes", { given: false, isTTY: true }), true);
  assert.throws(() => t.needsPrompt("--yes", { given: false, isTTY: false, command: "cld rm" }),
    (e) => e instanceof t.MissingFlag && e instanceof t.TermError && e.fix === "cld rm --yes");
});

test("the constants are the tokens, frozen", () => {
  const tok = loadTokens();
  assert.deepEqual(Object.keys(t.ROLES), Object.keys(tok.terminal));
  assert.deepEqual(t.LAYOUT, tok.tui.layout);
  assert.deepEqual(t.HEADER, tok.tui.header);
  assert.deepEqual(t.ENV, tok.tui.env);
  assert.ok(Object.isFrozen(t.GLYPHS.done) && Object.isFrozen(t.SPINNER.frames));
});

test("term.js imports no CSS, no DOM and no package: only its tokens and node:readline", () => {
  const src = readFileSync(resolve(KIT, "term.js"), "utf8");
  const specifiers = [...src.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(specifiers)].sort(), ["./term-tokens.js", "node:readline"]);
  assert.doesNotMatch(src, /\b(document|window|HTMLElement|getComputedStyle)\b/);
});
