import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadTokens } from "./lib/tokens.mjs";

// The Term spec (ui-kit 0.40, T1): the `tui` tokens, the prose and examples
// in docs/tui-patterns.md, and the Term column of the compliance matrix. Each
// token value the prose cites is rebuilt here from the token, so a token
// change without a doc change fails; numbers inside examples are not tokens.

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(HERE, "..", p), "utf8");
const DOC = read("docs/tui-patterns.md");
const DL = read("docs/design-language.md");
const MATRIX = JSON.parse(read("packages/ui-kit/agent/substrate-matrix.json"));
const tui = loadTokens().tui;

// East Asian Width W and F ranges below U+2E80 (Unicode 17, EastAsianWidth.txt).
// Every code point from U+2E80 up is rejected outright: the CJK, Hangul,
// fullwidth and emoji planes are W or F, and no tui glyph belongs there.
// To regenerate: take https://www.unicode.org/Public/UCD/latest/ucd/EastAsianWidth.txt,
// keep the lines whose property is W or F, merge adjacent code points into
// ranges, and keep the ranges that start below U+2E80. Python's
// `unicodedata.east_asian_width` gives the same table for its Unicode version.
const WIDE_BELOW_2E80 = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0],
  [0x23f3, 0x23f3], [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2630, 0x2637], [0x2648, 0x2653],
  [0x267f, 0x267f], [0x268a, 0x268f], [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab],
  [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705],
  [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755],
  [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50], [0x2b55, 0x2b55],
];

/** Every Unicode glyph the `tui` section defines, as [path, glyph] pairs. */
function unicodeGlyphs() {
  const out = [];
  for (const [n, g] of Object.entries(tui.glyphs)) out.push([`glyphs.${n}`, g.unicode]);
  for (const [n, g] of Object.entries(tui.box)) out.push([`box.${n}`, g.unicode]);
  for (const [n, g] of Object.entries(tui.keys)) out.push([`keys.${n}`, g.unicode]);
  tui.ramp.unicode.forEach((g, i) => out.push([`ramp.unicode[${i}]`, g]));
  tui.spinner.frames.forEach((g, i) => out.push([`spinner.frames[${i}]`, g]));
  tui.decode.glyphs.forEach((g, i) => out.push([`decode.glyphs[${i}]`, g]));
  tui.header.mark.forEach((row, r) => [...row].forEach((g, c) => out.push([`header.mark[${r}][${c}]`, g])));
  [...tui.header.compact].forEach((g, c) => out.push([`header.compact[${c}]`, g]));
  return out;
}

/** Every ASCII fallback the `tui` section defines, as [path, glyph] pairs. */
function asciiGlyphs() {
  const out = [];
  for (const [n, g] of Object.entries(tui.glyphs)) out.push([`glyphs.${n}`, g.ascii]);
  for (const [n, g] of Object.entries(tui.box)) out.push([`box.${n}`, g.ascii]);
  tui.ramp.ascii.forEach((g, i) => out.push([`ramp.ascii[${i}]`, g]));
  tui.spinner.ascii.forEach((g, i) => out.push([`spinner.ascii[${i}]`, g]));
  return out;
}

test("new tui tokens carry the decided values", () => {
  assert.deepEqual(tui.spinner, {
    frames: [" ", "░", "▒", "▓", "█", "▓", "▒", "░"],
    ascii: [" ", ".", ":", "#", "#", "#", ":", "."],
    intervalMs: 100, delayMs: 300, role: "prompt",
  });
  assert.deepEqual(tui.decode, { glyphs: ["░", "▒", "▓", "█", "▚", "▞"], randomAscii: [33, 126], frames: 4, frameMs: 60 });
  assert.deepEqual(tui.ramp, { unicode: ["░", "▒", "▓", "█"], ascii: [".", ":", "#", "#"] });
  assert.deepEqual(tui.progress, { cells: 24, role: "prompt", percentWidth: 4 });
  assert.deepEqual(tui.keys, { up: { unicode: "↑", ascii: "up" }, down: { unicode: "↓", ascii: "dn" } });
  assert.deepEqual(tui.robustness, { osc11TimeoutMs: 100, promptRetries: 3 });
  assert.deepEqual(tui.motion, { maxFps: 10, firstOutputMs: 100 });
  assert.equal(tui.layout.maxWidth, 100);
  assert.deepEqual(
    Object.fromEntries(Object.entries(tui.box).map(([k, v]) => [k, [v.unicode, v.ascii]])),
    {
      topLeft: ["╭", "+"], topRight: ["╮", "+"], bottomLeft: ["╰", "+"], bottomRight: ["╯", "+"],
      horizontal: ["─", "-"], vertical: ["│", "|"], seam: ["▌", ">"],
    },
  );
  assert.deepEqual(tui.env, {
    reducedMotion: ["SONDALAB_REDUCED_MOTION"],
    accessible: ["SONDALAB_ACCESSIBLE", "ACCESSIBLE"],
    noColor: ["NO_COLOR"],
    forceColor: ["FORCE_COLOR"],
    ci: ["CI"],
    term: ["TERM"],
    colorTerm: ["COLORTERM"],
    ascii: ["SONDALAB_ASCII"],
  });
});

test("spinner frames are exactly ' ░▒▓█▓▒░' and 8 long", () => {
  assert.equal(tui.spinner.frames.join(""), " ░▒▓█▓▒░");
  assert.equal(tui.spinner.frames.length, 8);
});

test("spinner ascii frames are the unicode frames mapped through the ramp", () => {
  const map = new Map(tui.ramp.unicode.map((g, i) => [g, tui.ramp.ascii[i]]));
  map.set(" ", " ");
  assert.deepEqual(tui.spinner.ascii, tui.spinner.frames.map((f) => map.get(f)));
});

test("decode stays under 300ms and its random range is printable ASCII", () => {
  assert.ok(tui.decode.frames * tui.decode.frameMs < 300);
  const [lo, hi] = tui.decode.randomAscii;
  assert.ok(lo >= 0x21 && hi <= 0x7e && lo < hi, "randomAscii must sit in 0x21..0x7e");
});

test("spinner and progress roles exist in terminal", () => {
  const terminal = loadTokens().terminal;
  assert.ok(Object.hasOwn(terminal, tui.spinner.role));
  assert.ok(Object.hasOwn(terminal, tui.progress.role));
});

test("every unicode glyph in tui is one code point, one column wide, not an emoji", () => {
  for (const [path, g] of unicodeGlyphs()) {
    const cps = [...g];
    assert.equal(cps.length, 1, `${path}: ${JSON.stringify(g)} is not one code point`);
    const cp = cps[0].codePointAt(0);
    assert.ok(cp >= 0x20 && cp < 0x2e80, `${path}: U+${cp.toString(16)} is outside the narrow range`);
    assert.ok(!WIDE_BELOW_2E80.some(([a, b]) => cp >= a && cp <= b), `${path}: U+${cp.toString(16)} is East Asian Width W/F`);
    assert.doesNotMatch(g, /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u, `${path}: emoji`);
    assert.doesNotMatch(g, /\p{M}|\p{Cc}|\p{Cf}/u, `${path}: combining, control or format character`);
  }
});

test("every ascii fallback in tui is one printable ASCII character", () => {
  for (const [path, g] of asciiGlyphs()) {
    assert.match(g, /^[\x20-\x7e]$/, `${path}: ${JSON.stringify(g)} is not one printable ASCII character`);
  }
});

test("key names have a printable ASCII form", () => {
  for (const [n, g] of Object.entries(tui.keys)) {
    assert.match(g.ascii, /^[\x21-\x7e]+$/, `keys.${n}: ${JSON.stringify(g.ascii)} is not printable ASCII`);
  }
});

test("tui-patterns.md has the six spec sections and Sources, in order", () => {
  const order = ["Voice", "Motion", "Effects", "Patterns (line output)", "Patterns (full screen)", "Robustness", "Sources"];
  const at = order.map((h) => DOC.indexOf(`\n## ${h}\n`));
  at.forEach((i, k) => assert.ok(i > 0, `missing section: ## ${order[k]}`));
  assert.deepEqual([...at].sort((a, b) => a - b), at, "sections out of order");
  for (const h of ["Glyphs", "Layout", "Header", "Step list", "Confirmation", "Summary", "Error block", "Did you mean",
    "Success with next step", "Progress", "Spinner", "Decode"]) {
    assert.ok(DOC.includes(`\n### ${h}\n`), `missing subsection: ### ${h}`);
  }
});

test("tui-patterns.md names every env var", () => {
  for (const names of Object.values(tui.env)) {
    for (const n of names) assert.ok(DOC.includes(`\`${n}`), `env var ${n} not named`);
  }
  for (const s of ["`TERM=dumb`", "`SONDALAB_REDUCED_MOTION=1`", "`SONDALAB_ACCESSIBLE=1`"]) {
    assert.ok(DOC.includes(s), `${s} not named`);
  }
});

test("tui-patterns.md cites each token value it uses (number drift guard)", () => {
  const { spinner, decode, ramp, progress, motion, layout, box, keys, robustness } = tui;
  const cites = [
    `\`${spinner.frames.join("")}\` (\`spinner.frames\`), ${spinner.frames.length} frames`,
    `${spinner.intervalMs}ms per frame (\`spinner.intervalMs\`), ${(spinner.intervalMs * spinner.frames.length) / 1000}s per cycle`,
    `${spinner.delayMs}ms (\`spinner.delayMs\`)`,
    `\`${spinner.role}\` (\`spinner.role\`)`,
    `${decode.frames} frames (\`decode.frames\`) of ${decode.frameMs}ms each (\`decode.frameMs\`), ${decode.frames * decode.frameMs}ms in all`,
    `\`${decode.glyphs.join("")}\` (\`decode.glyphs\`)`,
    `code points ${decode.randomAscii[0]} to ${decode.randomAscii[1]} (\`decode.randomAscii\`)`,
    `\`${ramp.unicode.join("")}\` (\`ramp.unicode\`)`,
    `\`${ramp.ascii.join(" ")}\` (\`ramp.ascii\``,
    `${progress.cells} cells (\`progress.cells\`) in \`${progress.role}\` (\`progress.role\`)`,
    `${motion.maxFps} frames per second (\`motion.maxFps\`)`,
    `${motion.firstOutputMs}ms (\`motion.firstOutputMs\`)`,
    `\`indent\` ${layout.indent} columns, \`labelWidth\` ${layout.labelWidth} columns, \`blankBeforeSummary\` ${layout.blankBeforeSummary} line, \`maxWidth\` ${layout.maxWidth} columns`,
    `right-aligned to ${progress.percentWidth} columns (\`progress.percentWidth\`)`,
    `${robustness.osc11TimeoutMs}ms timeout (\`robustness.osc11TimeoutMs\`)`,
    `at most ${robustness.promptRetries} times in all (\`robustness.promptRetries\`)`,
    `\`${keys.up.unicode}\` and \`${keys.down.unicode}\` (\`keys.up\`, \`keys.down\`)`,
    `written \`${keys.up.ascii}/${keys.down.ascii}\``,
    `capped at ${layout.maxWidth} columns (\`layout.maxWidth\`)`,
    `\`${box.topLeft.unicode} ${box.topRight.unicode} ${box.bottomLeft.unicode} ${box.bottomRight.unicode}\``,
    `\`${box.horizontal.unicode}\` and \`${box.vertical.unicode}\``,
    `ASCII: \`${["topLeft", "topRight", "bottomLeft", "bottomRight", "horizontal", "vertical"].map((k) => box[k].ascii).join(" ")}\``,
    `\`${box.seam.unicode}\` (\`box.seam\`, ASCII \`${box.seam.ascii}\`)`,
    `${tui.header.mark.length} lines, ${[...tui.header.mark[0]].length} columns, \`header.gap\` ${tui.header.gap} columns from the text`,
    `painted \`${tui.header.accentRole}\` (\`header.accentRole\`)`,
    `the ${[...tui.header.compact].length}-column mark \`header.compact\``,
  ];
  for (const c of cites) assert.ok(DOC.includes(c), `tui-patterns.md does not cite: ${c}`);
});

test("tui-patterns.md fixes the colour precedence of D7", () => {
  const i = ["`--color` or `--no-color` flag", "`NO_COLOR`;", "`FORCE_COLOR`;", "TTY detection"].map((s) => DOC.indexOf(s));
  i.forEach((x) => assert.ok(x > 0));
  assert.deepEqual([...i].sort((a, b) => a - b), i, "colour precedence out of order");
});

test("Term column: L4 motion A, L4 reduced motion R, L6 glitch A, in both the doc and the JSON", () => {
  const rows = {
    "L4 motion (ease/speeds/stagger)": ["l4-motion", "A"],
    "L4 reduced-motion respect": ["l4-reduced-motion", "R"],
    "L6 glitch": ["l6-glitch", "A"],
  };
  for (const [label, [id, level]] of Object.entries(rows)) {
    const row = DL.split("\n").find((l) => l.startsWith(`| ${label} |`));
    assert.ok(row, `matrix row ${label} missing`);
    const term = row.split("|").map((c) => c.trim()).filter(Boolean).at(-1);
    assert.equal(term, level, `${label}: Term is ${term}`);
    assert.equal(MATRIX.rules[id].Term, level, `${id}: substrate-matrix.json Term is ${MATRIX.rules[id].Term}`);
  }
});

/** The fenced code blocks of tui-patterns.md, each as an array of lines. */
function fencedBlocks() {
  return [...DOC.matchAll(/^```\n([\s\S]*?)^```$/gm)].map((m) => m[1].replace(/\n$/, "").split("\n"));
}

test("every non-ASCII character in a tui-patterns.md example is a tui token", () => {
  // `…` marks a running label; it is prose punctuation, not a token.
  const allowed = new Set(["…"]);
  for (const [, g] of unicodeGlyphs()) allowed.add(g);
  const blocks = fencedBlocks();
  assert.ok(blocks.length >= 15, `expected the spec's example blocks, found ${blocks.length}`);
  for (const lines of blocks) {
    for (const line of lines) {
      for (const ch of line) {
        if (ch.codePointAt(0) <= 0x7e) continue;
        assert.ok(allowed.has(ch), `example uses ${JSON.stringify(ch)}, which is not a tui token: ${line}`);
      }
    }
  }
});

test("every progress example draws a bar of exactly progress.cells cells", () => {
  const { cells, percentWidth } = tui.progress;
  const indent = tui.layout.indent + 2;
  const bars = fencedBlocks().flat().filter((l) => /^ +[█▓▒░]/.test(l) && /\d+\/\d+ +\d+%$/.test(l));
  assert.ok(bars.length >= 3, `expected progress examples, found ${bars.length}`);
  for (const l of bars) {
    const chars = [...l];
    assert.equal(chars.slice(0, indent).join(""), " ".repeat(indent), `bar not on the continuation column: ${l}`);
    const bar = chars.slice(indent, indent + cells).join("");
    assert.match(bar, /^█*(▓▒░|▓▒|▓)? *$/u, `bar is not filled run + edge + spaces: ${l}`);
    assert.equal(chars.slice(indent + cells, indent + cells + 2).join(""), "  ", `no two-space gap after ${cells} cells: ${l}`);
    const [, done, total, pct] = l.match(/(\d+)\/(\d+) +(\d+%)$/);
    const full = Math.floor((done / total) * cells);
    assert.equal(bar.replace(/ +$/, "").replace(/[▓▒░]/g, "").length, full, `filled run is not floor(done/total*cells): ${l}`);
    assert.equal(l.slice(-percentWidth).trimStart(), pct, `percent field is not ${percentWidth} columns: ${l}`);
  }
});

test("the header mark: 3 rows of at most 6 columns, an accent mask of the same shape, one accent region", () => {
  const { mark, markAccent, compact, compactAccent, gap } = tui.header;
  assert.equal(mark.length, 3);
  const w = [...mark[0]].length;
  assert.ok(w <= 6, `mark is ${w} columns`);
  for (const [i, row] of mark.entries()) {
    assert.equal([...row].length, w, `mark row ${i} is not ${w} columns`);
    assert.match(markAccent[i], new RegExp(`^[a.]{${w}}$`), `markAccent row ${i}`);
    [...row].forEach((g, c) => assert.ok(g !== " " || markAccent[i][c] === ".", `accent on a blank cell at ${i},${c}`));
  }
  const cells = markAccent.flatMap((row, r) => [...row].flatMap((m, c) => (m === "a" ? [`${r},${c}`] : [])));
  const seen = new Set();
  const todo = [cells[0]];
  while (todo.length) {
    const k = todo.pop();
    if (seen.has(k) || !cells.includes(k)) continue;
    seen.add(k);
    const [r, c] = k.split(",").map(Number);
    todo.push(`${r + 1},${c}`, `${r - 1},${c}`, `${r},${c + 1}`, `${r},${c - 1}`);
  }
  assert.equal(seen.size, cells.length, "the accent cells are not one shape");
  assert.equal([...compact].length, 2);
  assert.match(compactAccent, /^(a\.|\.a)$/);
  assert.ok(Number.isInteger(gap) && gap > 0);
});

test("tui-patterns.md draws the header and the compact header from the tokens", () => {
  const { mark, compact, gap } = tui.header;
  const full = mark.map((row, i) => `${row}${" ".repeat(gap)}${["sonda/lab", "cld 0.9.0", "Manage Claude Code loadouts."][i]}`);
  const blocks = fencedBlocks().map((b) => b.join("\n"));
  assert.ok(blocks.includes(full.join("\n")), `no header example:\n${full.join("\n")}`);
  assert.ok(blocks.includes(`${compact} sonda/lab cld`), "no compact header example");
});

test("tui-patterns.md allows the header on interactive launch only and keeps --version one line", () => {
  assert.doesNotMatch(DOC, /No ASCII-art banner, on start or on `--version`\./);
  assert.ok(DOC.includes("`--version` prints the one-line lockup"));
  assert.ok(DOC.includes("on interactive launch only"));
  assert.ok(DOC.includes("are for data only"));
});
