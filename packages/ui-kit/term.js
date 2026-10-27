/**
 * Terminal helpers for Node CLIs, the Term spec (docs/tui-patterns.md in
 * sondalab-ui): the JavaScript counterpart of sondalab-palette 0.9.0's `term`.
 *
 * Pure string builders and environment checks, byte-identical to the Python
 * helpers for the same inputs (scripts/term-parity.test.mjs). Nothing here
 * starts a timer: the caller owns redraw and timing (SPINNER.intervalMs,
 * SPINNER.delayMs, DECODE.frameMs, MOTION.maxFps). Only confirm() and choose()
 * do I/O, on the streams they are given. No CSS, no DOM, no dependencies;
 * Node 18+.
 *
 * No Windows VT helper: Node's console streams handle escape sequences on
 * Windows 10 and later. This is not verified on legacy consoles, and the spec's
 * plain-text fallback has no Node hook; no Windows host was tested.
 *
 * Lengths, cuts and wrapping count code points, as Python's str does: not
 * UTF-16 units, and not display width, so wide (CJK, emoji), combining and
 * ZWJ characters can misalign a column. Without LANG or LC_* the locale has no
 * charset and asciiMode() is true. width() reads COLUMNS, then stdout's size,
 * even for text bound for stderr.
 */
import { DECODE, ENV, GLYPHS, HEADER, KEYS, LAYOUT, PROGRESS, RAMP, ROBUSTNESS, ROLES, SPINNER } from "./term-tokens.js";

export * from "./term-tokens.js";

// How each switch variable in ENV reads (spec, Robustness > Environment):
// "one" is on only when it equals "1" (SONDALAB_*), "set" whenever present (CI,
// ACCESSIBLE). A variable added to ENV needs its own entry, as in term.py.
const SWITCH = {
  SONDALAB_REDUCED_MOTION: "one",
  SONDALAB_ACCESSIBLE: "one",
  SONDALAB_ASCII: "one",
  CI: "set",
  ACCESSIBLE: "set",
};
const MODES = ["none", "ansi16", "truecolor"];
const TRUECOLOR = ["truecolor", "24bit"];
// Python's str.isspace() set, for split() and strip(); JS \s differs (it lacks
// \x1c-\x1f and \x85, and has ﻿).
const WS = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const WS_RUN = new RegExp(`[${WS}]+`, "g");
const WS_EDGES = new RegExp(`^[${WS}]+|[${WS}]+$`, "g");
// Python's utf-8 codec names after codecs.lookup's normalisation.
const UTF8 = new Set(["utf_8", "utf8", "u8", "utf", "cp65001", "utf8_ucs2", "utf8_ucs4", "utf_8_sig"]);

const cps = (s) => Array.from(s);
const len = (s) => cps(s).length;
/** Python's s[start:end] by code point; `end` undefined means to the end. */
const cut = (s, start, end) => cps(s).slice(start, end).join("");
const sp = (n) => " ".repeat(Math.max(0, n));
const ljust = (s, n) => s + sp(n - len(s));
const rjust = (s, n) => sp(n - len(s)) + s;
const pyStrip = (s) => s.replace(WS_EDGES, "");
const envOf = (env) => env ?? process.env;
const has = (env, name) => env[name] !== undefined;

/** True when any of the switch variables `names` is on, each by its SWITCH rule. */
function on(env, names) {
  return names.some((name) => {
    const rule = SWITCH[name];
    if (rule === undefined) throw new RangeError(`no switch rule for ${name}`);
    return rule === "one" ? env[name] === "1" : has(env, name);
  });
}

/**
 * True when any variable of the ENV switch purpose `name` is on:
 * "reducedMotion", "accessible", "ci" or "ascii". SONDALAB_* count only when
 * they equal "1"; CI and ACCESSIBLE whenever set, even empty. Any other name
 * throws RangeError.
 */
export function switchOn(name, env) {
  env = envOf(env);
  const names = Object.hasOwn(ENV, name) ? ENV[name] : null;
  if (!names || names.some((v) => !Object.hasOwn(SWITCH, v))) throw new RangeError(`'${name}' is not a switch purpose`);
  return on(env, names);
}

/** Accessible mode: SONDALAB_ACCESSIBLE=1, or ACCESSIBLE set (even empty). Implies reducedMotion(). */
export function accessible(env) {
  return switchOn("accessible", envOf(env));
}

/** The user asked for reduced motion: SONDALAB_REDUCED_MOTION=1, or accessible(). */
export function reducedMotion(env) {
  env = envOf(env);
  return switchOn("reducedMotion", env) || accessible(env);
}

/** FORCE_COLOR per force-color.org: set, and neither empty nor "0". */
const forced = (env) => ENV.forceColor.some((n) => !["", "0"].includes(env[n] ?? ""));
const termDumb = (env) => ENV.term.some((n) => env[n] === "dumb");

/**
 * Whether the spinner, progress bar and decode may run: off for a non-TTY
 * stream, CI, TERM=dumb, reduced motion and accessible mode. `isTTY` is the
 * stream motion draws on; undefined reads process.stderr.isTTY.
 */
export function motionEnabled({ env, isTTY } = {}) {
  env = envOf(env);
  if (isTTY === undefined || isTTY === null) isTTY = process.stderr.isTTY === true;
  if (!isTTY || termDumb(env)) return false;
  return !(switchOn("ci", env) || reducedMotion(env));
}

/** The charset of the first non-empty LC_ALL, LC_CTYPE, LANG ("de_DE.UTF-8@euro" gives "UTF-8"). */
function localeCharset(env) {
  for (const name of ["LC_ALL", "LC_CTYPE", "LANG"]) {
    const value = env[name];
    if (value) {
      const dot = value.indexOf(".");
      const part = dot < 0 ? value : value.slice(dot + 1);
      return part.split("@")[0];
    }
  }
  return "";
}

/** Python's encodings.normalize_encoding after lower(): runs of non-alphanumerics (bar ".") become one "_". */
function normEncoding(enc) {
  let out = "";
  let punct = false;
  for (const c of enc.toLowerCase()) {
    if (/[\p{L}\p{N}.]/u.test(c)) {
      if (punct && out) out += "_";
      if (c.charCodeAt(0) < 128) out += c;
      punct = false;
    } else punct = true;
  }
  return out;
}

/**
 * Whether every glyph takes its ASCII form: a non-UTF-8 charset, TERM=dumb or
 * SONDALAB_ASCII=1. `override` is the --ascii flag (true forces ASCII, false
 * Unicode). `encoding` undefined reads the locale charset from `env`; none is ASCII.
 */
export function asciiMode({ override, env, encoding } = {}) {
  env = envOf(env);
  if (override !== undefined && override !== null) return override;
  if (termDumb(env) || switchOn("ascii", env)) return true;
  const n = normEncoding(encoding ?? localeCharset(env));
  return !(UTF8.has(n) || UTF8.has(n.replaceAll(".", "_")));
}

/**
 * "none", "ansi16" or "truecolor"; the first rule that applies wins: `flag`
 * (true --color, false --no-color), NO_COLOR non-empty, FORCE_COLOR set and not
 * "" or "0", then `isTTY` and TERM != dumb. Truecolor only when `truecolor` is
 * true and COLORTERM is truecolor or 24bit. `isTTY` undefined reads process.stdout.isTTY.
 */
export function colorMode({ flag, env, isTTY, truecolor = false } = {}) {
  env = envOf(env);
  let colour;
  if (flag !== undefined && flag !== null) colour = flag;
  else if (ENV.noColor.some((n) => env[n])) colour = false;
  else if (forced(env)) colour = true;
  else {
    if (isTTY === undefined || isTTY === null) isTTY = process.stdout.isTTY === true;
    colour = isTTY && !termDumb(env);
  }
  if (!colour) return "none";
  if (truecolor && ENV.colorTerm.some((n) => TRUECOLOR.includes((env[n] ?? "").toLowerCase()))) return "truecolor";
  return "ansi16";
}

/** The burst spinner's frame at tick `i`, cycling; painted SPINNER.role by the caller. */
export function spinnerFrame(i, { ascii = false } = {}) {
  const frames = ascii ? SPINNER.ascii : SPINNER.frames;
  return frames[((i % frames.length) + frames.length) % frames.length];
}

/** Each ramp cell mapped to its RAMP.ascii form; other characters pass. */
function toAscii(cells) {
  const table = new Map(RAMP.unicode.map((u, i) => [u, RAMP.ascii[i]]));
  return cps(cells).map((c) => table.get(c) ?? c).join("");
}

/**
 * The progress continuation line: indent, a PROGRESS.cells bar, count, percent.
 * `done` is clamped to [0, total]; total <= 0 throws RangeError. The percent
 * rounds half up and stays at 99 until done == total. Integers only.
 */
export function progressBar(done, total, { ascii = false } = {}) {
  if (total <= 0) throw new RangeError(`total must be positive, got ${total}`);
  const cells = PROGRESS.cells;
  done = Math.min(Math.max(done, 0), total);
  const full = Math.floor((done * cells) / total);
  const edge = [...RAMP.unicode.slice(0, -1)].reverse().join("");
  let bar = ljust(cut(RAMP.unicode.at(-1).repeat(full) + edge, 0, cells), cells);
  if (ascii) bar = toAscii(bar);
  let pct = Math.floor((200 * done + total) / (2 * total));
  if (done < total) pct = Math.min(pct, 99);
  const count = `${rjust(String(done), String(total).length)}/${total}`;
  return `${sp(LAYOUT.indent + 2)}${bar}  ${count}  ${rjust(`${pct}%`, PROGRESS.percentWidth)}`;
}

/**
 * The decode's frames for `value`, first to last; the last is `value`. Unsettled
 * characters come from rng.choice(pool) (DECODE.glyphs plus printable ASCII, ASCII
 * only when `ascii`); spaces stay spaces and draw nothing.
 */
export function decodeFrames(value, rng, { ascii = false } = {}) {
  const [lo, hi] = DECODE.randomAscii;
  let pool = Array.from({ length: hi - lo + 1 }, (_, k) => String.fromCodePoint(lo + k));
  if (!ascii) pool = [...DECODE.glyphs, ...pool];
  const chars = cps(value);
  const out = [];
  for (let n = 1; n <= DECODE.frames; n++) {
    const settled = Math.floor((n * chars.length) / DECODE.frames);
    out.push(chars.slice(0, settled).join("") + chars.slice(settled).map((c) => (c === " " ? c : rng.choice(pool))).join(""));
  }
  return out;
}

/** `label` cut and padded to LAYOUT.labelWidth, then `detail`; shared by stepLine and kvLine. */
function label(text, detail) {
  const w = LAYOUT.labelWidth;
  if (!detail) return cut(text, 0, w);
  return ljust(cut(text, 0, w - 1), w) + detail;
}

/**
 * One step-list line: indent, glyph, label padded to labelWidth, detail. `glyph`
 * is a GLYPHS key or a spinner frame. With a detail the label is cut at
 * labelWidth - 1, else at labelWidth with no padding; never wrapped. In ASCII
 * `…` becomes `...`. `mode` paints the glyph only.
 */
export function stepLine(glyph, text, detail = "", { ascii = false, mode = "none" } = {}) {
  let g;
  let role;
  if (Object.hasOwn(GLYPHS, glyph)) {
    g = ascii ? GLYPHS[glyph].ascii : GLYPHS[glyph].unicode;
    role = GLYPHS[glyph].role;
  } else if (SPINNER.frames.includes(glyph) || SPINNER.ascii.includes(glyph)) {
    g = ascii ? toAscii(glyph) : glyph;
    role = SPINNER.role;
  } else throw new RangeError(`unknown glyph '${glyph}'`);
  if (ascii) text = text.replaceAll("…", "...");
  return sp(LAYOUT.indent) + paint(g, role, mode) + " " + label(text, detail);
}

/**
 * `text` in `role`'s colour for `mode`, a colorMode() result: "none" returns it
 * unchanged, "ansi16" the named-ANSI floor (dim is bright black, never SGR 2),
 * "truecolor" the brand hue. Empty text stays empty; an unknown role or mode throws RangeError.
 */
export function paint(text, role, mode = "none") {
  if (!Object.hasOwn(ROLES, role)) throw new RangeError(`unknown role '${role}'`);
  if (!MODES.includes(mode)) throw new RangeError(`unknown colour mode '${mode}'`);
  if (mode === "none" || !text) return text;
  return `\x1b[${ROLES[role][mode]}m${text}\x1b[0m`;
}

/** The value of a Unicode decimal digit: Nd digits sit in contiguous runs that start at 0. */
function digitValue(c) {
  let cp = c.codePointAt(0);
  let k = 0;
  while (/\p{Nd}/u.test(String.fromCodePoint(cp - 1))) { cp--; k++; }
  return k % 10;
}

/** Python's int() on a decimal string: whitespace, a sign, single underscores and any Unicode decimal digits. */
function pyInt(s) {
  const m = /^([+-]?)(\p{Nd}+(?:_\p{Nd}+)*)$/u.exec(pyStrip(s));
  if (!m) return NaN;
  return Number(m[1] + cps(m[2].replaceAll("_", "")).map(digitValue).join(""));
}

/** The terminal width: COLUMNS in `env`, else stdout's columns, else the cap; 0 or less is unknown. */
function columns(env) {
  const fromEnv = env.COLUMNS === undefined ? 0 : pyInt(env.COLUMNS);
  if (fromEnv > 0) return fromEnv;
  const tty = process.stdout.isTTY ? process.stdout.columns : 0;
  return tty > 0 ? tty : LAYOUT.maxWidth;
}

/** `cells` with each run marked "a" in `mask` painted HEADER.accentRole. */
function masked(cells, mask, mode) {
  const c = cps(cells);
  const m = cps(mask);
  let out = "";
  for (let i = 0; i < c.length; ) {
    let j = i;
    while (j < c.length && (m[j] === "a") === (m[i] === "a")) j++;
    const run = c.slice(i, j).join("");
    out += m[i] === "a" ? paint(run, HEADER.accentRole, mode) : run;
    i = j;
  }
  return out;
}

const lockupText = (text, mode) => "sonda" + paint("/", "prompt", mode) + "lab" + text;

/** The one-line lockup `sonda/lab <name> <version>` for --version, slash in prompt, cut at maxWidth. */
export function lockup(name, version, mode = "none") {
  return lockupText(cut(` ${name} ${version}`, 0, LAYOUT.maxWidth - len("sonda/lab")), mode);
}

/**
 * The TUI header for an interactive launch; "" means print nothing. `machine`
 * (--json, --plain), a non-TTY stdout (`isTTY` undefined reads
 * process.stdout.isTTY) and accessible mode give "". On a TTY, TERM=dumb, ASCII
 * mode or a terminal narrower than the header give lockup(). `compact` is the
 * 2-column mark and `sonda/lab name` in dim, then a blank line.
 */
export function header(name, version, description, { compact = false, machine = false, env, isTTY } = {}) {
  if (machine) return "";
  env = envOf(env);
  if (isTTY === undefined || isTTY === null) isTTY = process.stdout.isTTY === true;
  if (!isTTY || accessible(env)) return "";
  const mode = colorMode({ env, isTTY });
  const cap = LAYOUT.maxWidth;
  const fallback = lockup(name, version, mode) + "\n";
  if (termDumb(env) || asciiMode({ env })) return fallback;
  if (compact) {
    const mark = HEADER.compact;
    const text = cut(`sonda/lab ${name}`, 0, cap - len(mark) - 1);
    if (columns(env) < len(mark) + 1 + len(text)) return fallback;
    return masked(mark, HEADER.compactAccent, mode) + " " + paint(text, "dim", mode) + "\n\n";
  }
  const rows = HEADER.mark;
  const gap = sp(HEADER.gap);
  const room = cap - len(rows[0]) - gap.length;
  const texts = ["sonda/lab", cut(`${name} ${version}`, 0, room), cut(description, 0, room)];
  if (columns(env) < len(rows[0]) + gap.length + Math.max(...texts.map(len))) return fallback;
  const painted = [lockupText("", mode), texts[1], paint(texts[2], "dim", mode)];
  const lines = rows.map((row, i) => (masked(row, HEADER.markAccent[i], mode) + (painted[i] ? gap + painted[i] : "")).replace(/ +$/, ""));
  return lines.join("\n") + "\n";
}

// --- errors -----------------------------------------------------------------

/**
 * A failure the caller reports as the spec's three-line error block. `what`,
 * `why` and `fix` are its parts, uncoloured; `fix` is a command or "". block()
 * renders them through errorBlock(), so the error and the block never drift.
 */
export class TermError extends Error {
  constructor(what, why = "", fix = "") {
    super(why ? `${what}: ${why}` : what);
    this.name = "TermError";
    this.what = what;
    this.why = why;
    this.fix = fix;
  }

  /** This error as errorBlock() lines, for stderr. */
  block({ env, ascii = false, mode = "none" } = {}) {
    return errorBlock(this.what, this.why, this.fix, { env, ascii, mode });
  }
}

/** A prompt got no valid answer: the retry cap was reached or input ended. `fix` is empty. */
export class NoValidAnswer extends TermError {
  constructor(question, why) {
    super(`No valid answer to: ${question}`, why);
    this.name = "NoValidAnswer";
    this.question = question;
  }
}

/** No TTY on stdin and `flag` was not passed: the program never takes a default on its own. */
export class MissingFlag extends TermError {
  constructor(flag, what = "", command = "") {
    const why = `stdin is not a terminal, so nothing can be asked, and ${flag} was not passed`;
    super(what || `Missing ${flag}`, why, `${command} ${flag}`.trim());
    this.name = "MissingFlag";
    this.flag = flag;
  }
}

// --- prompts -----------------------------------------------------------------

/** A `[y/N]` answer: true, false, or null when not recognised; empty takes `dflt`. */
export function parseYesNo(answer, dflt) {
  const text = pyStrip(answer).toLowerCase();
  if (!text) return dflt;
  if (text === "y" || text === "yes") return true;
  if (text === "n" || text === "no") return false;
  return null;
}

/** A numbered-list answer: the 0-based index, or null; only an ASCII number from 1 to `count`. */
export function parseChoice(answer, count) {
  const text = pyStrip(answer);
  if (!/^[0-9]+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= count ? n - 1 : null;
}

// One reader per input stream, kept across prompts: a readline interface
// closed between prompts would drop the lines it had buffered, and one made on
// an ended stream would never hear its end.
const readers = new WeakMap();

/** The line reader for `input`: its interface, queued lines, end state and waiter. */
async function readerFor(input) {
  let r = readers.get(input);
  if (r) return r;
  const { createInterface } = await import("node:readline");
  r = { rl: null, lines: [], ended: input.readableEnded === true, wake: null };
  if (!r.ended) {
    r.rl = createInterface({ input, terminal: false });
    r.rl.on("line", (l) => { r.lines.push(l); r.wake?.(); });
    r.rl.on("close", () => { r.ended = true; r.wake?.(); });
  }
  readers.set(input, r);
  return r;
}

/**
 * The next line of `input` without its newline, or null at end of input. A
 * queued line comes first; an ended input with none resolves null at once.
 * The input is resumed only while a line is awaited and paused after, so a
 * process with no prompt pending can exit.
 */
async function readLine(input) {
  const r = await readerFor(input);
  if (!r.lines.length && !r.ended) {
    r.rl.resume();
    while (!r.lines.length && !r.ended) await new Promise((res) => { r.wake = res; });
    r.wake = null;
    if (!r.ended) r.rl.pause();
  }
  return r.lines.length ? r.lines.shift() : null;
}

/**
 * Write `prompt` and read a line from `input`, up to ROBUSTNESS.promptRetries
 * times; resolve to the first non-null parse. End of input ends the prompt line
 * and rejects with NoValidAnswer at once, as does the last unrecognised answer.
 */
async function ask(question, prompt, parse, input, output) {
  const tries = ROBUSTNESS.promptRetries;
  for (let i = 0; i < tries; i++) {
    output.write(prompt);
    const line = await readLine(input);
    if (line === null) {
      output.write("\n");
      throw new NoValidAnswer(question, "input ended before an answer");
    }
    const got = parse(line);
    if (got !== null) return got;
  }
  throw new NoValidAnswer(question, `no recognised answer in ${tries} tries`);
}

const promptMode = (mode, env, output) => mode ?? colorMode({ env, isTTY: output.isTTY === true });

/**
 * Ask `? <question> [y/N] ` (`[Y/n]` when `default`) on `output` (process.stderr)
 * and read `input` (process.stdin). Unrecognised input asks again,
 * ROBUSTNESS.promptRetries times in all, then rejects with NoValidAnswer; so
 * does end of input. Guard a non-TTY stdin first with needsPrompt().
 */
export async function confirm(question, { default: dflt = false, input = process.stdin, output = process.stderr, env, mode } = {}) {
  mode = promptMode(mode, env, output);
  const q = GLYPHS.question;
  const prompt = `${paint(q.unicode, q.role, mode)} ${question} ${dflt ? "[Y/n]" : "[y/N]"} `;
  return ask(question, prompt, (a) => parseYesNo(a, dflt), input, output);
}

/**
 * The numbered-list question of accessible mode; resolves to the 0-based index.
 * Writes `? <question> Type a number, then Enter`, one `  n  option` row each,
 * then `> `. I/O and retries as confirm(); empty `options` throws RangeError.
 */
export async function choose(question, options, { input = process.stdin, output = process.stderr, env, mode } = {}) {
  if (!options.length) throw new RangeError("choose() needs at least one option");
  mode = promptMode(mode, env, output);
  const q = GLYPHS.question;
  const w = String(options.length).length;
  const rows = options.map((opt, i) => `${sp(LAYOUT.indent)}${rjust(String(i + 1), w)}  ${opt}\n`).join("");
  output.write(`${paint(q.unicode, q.role, mode)} ${question} Type a number, then Enter\n${rows}`);
  return ask(question, "> ", (a) => parseChoice(a, options.length), input, output);
}

/**
 * True when the caller must prompt; false when `flag` already answered (`given`).
 * Without it a TTY stdin means prompt; otherwise this throws MissingFlag. `isTTY`
 * undefined reads process.stdin.isTTY; `what` and `command` shape the error.
 */
export function needsPrompt(flag, { given, what = "", command = "", isTTY } = {}) {
  if (given) return false;
  if (isTTY === undefined || isTTY === null) isTTY = process.stdin.isTTY === true;
  if (isTTY) return true;
  throw new MissingFlag(flag, what, command);
}

// --- line patterns ---------------------------------------------------------------

const glyphOf = (name, ascii) => (ascii ? GLYPHS[name].ascii : GLYPHS[name].unicode);
const sep = (ascii, mode) => ` ${paint(glyphOf("separator", ascii), GLYPHS.separator.role, mode)} `;
const cont = (text) => sp(LAYOUT.indent + 2) + text;

/** `Summary  1 ok · 1 fixed · 1 warn · 1 failed`: all four, painted ok, ok, warn, err; zero in dim. No newline. */
export function summary(ok, fixed, warn, failed, { mode = "none", ascii = false } = {}) {
  const parts = [[ok, "ok", "ok"], [fixed, "fixed", "ok"], [warn, "warn", "warn"], [failed, "failed", "err"]]
    .map(([count, word, role]) => paint(`${count} ${word}`, count ? role : "dim", mode));
  return "Summary  " + parts.join(sep(ascii, mode));
}

/** The prose width: the terminal's (COLUMNS, then stdout), capped at LAYOUT.maxWidth. */
export function width(env) {
  return Math.min(columns(envOf(env)), LAYOUT.maxWidth);
}

/**
 * `text` as prose wrapped at width(env), each line `indent` spaces in, as
 * Python's textwrap.fill with words kept whole: whitespace runs collapse, a
 * word longer than the line stands alone. No trailing newline; "" for empty text.
 */
export function wrap(text, { env, indent = 0 } = {}) {
  const words = text.split(WS_RUN).filter(Boolean);
  const pad = sp(indent);
  const room = width(env) - indent;
  const lines = [];
  let line = [];
  let used = 0;
  for (const word of words) {
    const w = len(word);
    if (line.length && used + 1 + w > room) {
      lines.push(pad + line.join(" "));
      line = [];
      used = 0;
    }
    used += (line.length ? 1 : 0) + w;
    line.push(word);
  }
  if (line.length) lines.push(pad + line.join(" "));
  return lines.join("\n");
}

/**
 * The error block: `✗ what`, why in dim, `Try: fix`. `what` is cut at
 * LAYOUT.maxWidth; `why` is wrapped from the label column; `fix` and `link` are
 * never cut. In ASCII `…` becomes `...`. Empty why or fix omits its line. No newline.
 */
export function errorBlock(what, why = "", fix = "", { link = "", env, ascii = false, mode = "none" } = {}) {
  if (ascii) {
    what = what.replaceAll("…", "...");
    why = why.replaceAll("…", "...");
  }
  const col = LAYOUT.indent + 2;
  const head = sp(LAYOUT.indent) + paint(glyphOf("failed", ascii), GLYPHS.failed.role, mode) + " ";
  const lines = [head + cut(what, 0, LAYOUT.maxWidth - col)];
  if (why) lines.push(...wrap(why, { env, indent: col }).split("\n").map((l) => cont(paint(cut(l, col), "dim", mode))));
  if (fix) {
    const tail = link ? sep(ascii, mode) + paint(link, "dim", mode) : "";
    lines.push(cont(`${paint("Try:", "prompt", mode)} ${fix}${tail}`));
  }
  return lines.join("\n");
}

/** The `Next:` continuation line under a success step, `Next:` in dim. No newline. */
export function nextLine(command, { mode = "none" } = {}) {
  return cont(`${paint("Next:", "dim", mode)} ${command}`);
}

/** The movement keys for a key hint: `↑↓`, or `up/dn` in ASCII. */
export function arrows({ ascii = false } = {}) {
  return ascii ? `${KEYS.up.ascii}/${KEYS.down.ascii}` : `${KEYS.up.unicode}${KEYS.down.unicode}`;
}

/** The full-screen footer: `key verb` pairs, keys in accent, verbs and separator in dim. */
export function keyHints(pairs, { ascii = false, mode = "none" } = {}) {
  return [...pairs].map(([k, v]) => `${paint(k, "accent", mode)} ${paint(v, "dim", mode)}`).join(sep(ascii, mode));
}

/** A section heading: `text` uppercase in dim, from column 0. No newline. */
export function heading(text, { mode = "none" } = {}) {
  return paint(text.toUpperCase(), "dim", mode);
}

/** A key-value report line: the key from the label column, padded like a step label. Uncoloured. */
export function kvLine(key, value) {
  return sp(LAYOUT.indent + 2) + label(key, value);
}
