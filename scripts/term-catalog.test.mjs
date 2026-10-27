import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { loadTokens } from "./lib/tokens.mjs";

// The catalog's Terminal section (ui-kit 0.40, T3): the Term spec drawn as
// painted terminal output. Its blocks are examples of docs/tui-patterns.md,
// so their text is the spec's text, their glyphs are tui tokens painted in
// the glyph's role, and the showcase draws the very same blocks.

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(HERE, "..", p), "utf8");
const CATALOG = read("packages/ui-kit/agent/catalog.md");
const SPEC = read("docs/tui-patterns.md");
const SHOWCASE = read("showcase/index.html");
const tui = loadTokens().tui;

const start = CATALOG.indexOf("\n## Terminal (opt-in, `workbench.css`)\n");
const SECTION = CATALOG.slice(start, CATALOG.indexOf("\n## ", start + 1));
/** The section's entries: { title, fences } in order. */
const ENTRIES = SECTION.split(/^### /m).slice(1).map((e) => ({
  title: e.slice(0, e.indexOf(" — ")),
  fences: [...e.matchAll(/```html\n([\s\S]*?)\n```/g)].map((m) => m[1]),
}));
const FENCES = ENTRIES.flatMap((e) => e.fences);

const decode = (html) => html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** The text a block's output shows, the spinner standing on a frame. */
const outText = (fence, frame = "▒") => {
  const pre = fence.match(/<pre class="sl-term-block__out">([\s\S]*?)<\/pre>/)[1];
  return decode(pre.replace(/<span class="sl-term-block__spin"[^>]*><\/span>/g, frame).replace(/<[^>]+>/g, ""));
};
/** The spec's fenced examples, each as its lines without trailing spaces. */
const SPEC_BLOCKS = [...SPEC.matchAll(/^```\n([\s\S]*?)^```$/gm)].map((m) => m[1].replace(/\n$/, "").split("\n").map((l) => l.trimEnd()));
const inSpec = (lines) => SPEC_BLOCKS.some((b) => b.some((_, i) => lines.every((l, k) => b[i + k] === l)));

test("the Terminal section sits after the terminal block and holds the spec's patterns", () => {
  assert.ok(start > CATALOG.indexOf("### Terminal block — `sl-term-block`"), "after the terminal block entry");
  assert.deepEqual(ENTRIES.map((e) => e.title), [
    "Roles and glyphs", "Header", "Step list and summary", "Error block and did you mean", "Confirmation",
    "Terminal progress", "Spinner", "Decode", "Full-screen view", "Plain and accessible output",
  ]);
  for (const e of ENTRIES) assert.ok(e.fences.length > 0, `${e.title}: no html block`);
  for (const f of FENCES) assert.match(f, /^<article class="sl-term-block[ "]/, "every block is a terminal block");
});

test("every non-ASCII character in a Terminal block is a tui token (or the running label's ellipsis)", () => {
  const allowed = new Set(["…"]);
  for (const g of Object.values(tui.glyphs)) allowed.add(g.unicode);
  for (const g of Object.values(tui.box)) allowed.add(g.unicode);
  for (const g of Object.values(tui.keys)) allowed.add(g.unicode);
  for (const g of [...tui.ramp.unicode, ...tui.spinner.frames, ...tui.decode.glyphs]) allowed.add(g);
  for (const g of [...tui.header.mark.join(""), ...tui.header.compact]) allowed.add(g);
  for (const f of FENCES) for (const ch of decode(f.replace(/<[^>]+>/g, ""))) {
    if (ch.codePointAt(0) <= 0x7e) continue;
    assert.ok(allowed.has(ch), `${JSON.stringify(ch)} is not a tui token`);
  }
});

test("every glyph that stands alone in a span is painted with its tui role", () => {
  const roleOf = new Map(Object.values(tui.glyphs).map((g) => [g.unicode, g.role]));
  let n = 0;
  for (const f of FENCES) for (const m of f.matchAll(/<span class="sl-term-block__(\w+)">(.)<\/span>/gu)) {
    // a key in the footer is a key (accent), not a glyph: `?` is help there
    if (!roleOf.has(m[2]) || m[1] === "accent") continue;
    n++;
    assert.equal(m[1], roleOf.get(m[2]), `${m[2]} is painted ${m[1]}`);
  }
  assert.ok(n >= 20, `expected the painted glyphs, found ${n}`);
});

test("the roles block lists every tui glyph: Unicode in its role, name, ASCII, role", () => {
  const roles = ENTRIES[0].fences[0].match(/<pre class="sl-term-block__out">([\s\S]*?)<\/pre>/)[1];
  for (const r of ["prompt", "ok", "warn", "err", "dim", "accent"]) {
    assert.ok(roles.includes(`<span class="sl-term-block__${r}">${r}</span>`), `role ${r} is shown in its own paint`);
  }
  for (const [name, g] of Object.entries(tui.glyphs)) {
    const line = `  <span class="sl-term-block__${g.role}">${g.unicode}</span> ${name.padEnd(10)} ${g.ascii}  ${g.role}`;
    assert.ok(roles.split("\n").includes(line), `no line for ${name}: ${line}`);
  }
});

test("every other block's output is the spec's own example text", () => {
  for (const e of ENTRIES.slice(1)) for (const f of e.fences) {
    // the decode filmstrip labels its frames; the labels are not output
    const lines = outText(f).split("\n").map((l) => l.replace(/ {2}frame \d · .*$/, "").trimEnd());
    const chunks = lines.join("\n").split(/\n\n/).map((c) => c.split("\n"));
    for (const c of chunks) assert.ok(inSpec(c), `${e.title}: not a spec example:\n${c.join("\n")}`);
  }
});

test("every progress line is progress.cells cells, two spaces, the count, two spaces, the percent in percentWidth columns", () => {
  const { cells, percentWidth } = tui.progress;
  const indent = tui.layout.indent + 2;
  const bars = FENCES.flatMap((f) => outText(f).split("\n")).filter((l) => /^ +[█▓▒░]/.test(l) && /\d+\/\d+ +\d+%$/.test(l));
  assert.ok(bars.length >= 3, `expected the progress lines, found ${bars.length}`);
  for (const l of bars) {
    const ch = [...l];
    assert.equal(ch.slice(0, indent).join(""), " ".repeat(indent), `not on the continuation column: ${l}`);
    const bar = ch.slice(indent, indent + cells).join("");
    assert.match(bar, /^█*(▓▒░|▓▒|▓)? *$/u, `not a filled run, an edge and spaces: ${l}`);
    const [, done, total, pct] = l.match(/(\d+)\/(\d+) +(\d+%)$/);
    const count = ch.slice(indent + cells).join("");
    assert.equal(count, `  ${done.padStart(total.length)}/${total}  ${pct.padStart(percentWidth)}`, `count and percent columns: ${l}`);
    assert.equal(bar.replace(/ +$/, "").replace(/[▓▒░]/g, "").length, Math.floor((done / total) * cells), `filled run: ${l}`);
  }
});

test("the spinner is the CSS cell in the spinner and progress blocks, hidden from assistive tech, in a busy block", () => {
  const spin = '<span class="sl-term-block__spin" aria-hidden="true"></span>';
  for (const title of ["Spinner", "Terminal progress"]) {
    const f = ENTRIES.find((e) => e.title === title).fences[0];
    assert.ok(f.includes(spin), `${title}: no spinner cell`);
    assert.match(f, /^<article class="sl-term-block" aria-busy="true">/, `${title}: the block is busy`);
  }
  assert.equal(FENCES.join("").split("sl-term-block__spin").length - 1, 2, "the spinner runs in those two blocks only");
});

test("the full-screen view keeps its geometry and marks focus, selection and keys", () => {
  const f = ENTRIES.find((e) => e.title === "Full-screen view").fences[0];
  assert.match(f, /^<article class="sl-term-block sl-term-block--screen"/);
  const rows = outText(f).split("\n");
  const width = [...rows[0]].length;
  for (const r of rows.slice(0, -1)) assert.equal([...r].length, width, `a box row is not ${width} columns: ${r}`);
  assert.match(f, /<span class="sl-term-block__inverse"> PROBES <\/span>/, "the focused title in inverse video");
  assert.match(f, /<span class="sl-term-block__sel"><span class="sl-term-block__prompt">▌<\/span>/, "the selected row opens on the seam");
  for (const k of ["↑↓", "enter", "/", ":", "?", "q", "ctrl-c"]) assert.ok(f.includes(`<span class="sl-term-block__accent">${k}</span>`), `key ${k} in accent`);
});

test("the showcase draws every Terminal block, verbatim", () => {
  for (const f of FENCES) assert.ok(SHOWCASE.includes(f), `missing from showcase/index.html:\n${f.slice(0, 160)}`);
  assert.match(SHOWCASE, /<link rel="stylesheet" href="\.\.\/packages\/ui-kit\/workbench\.css">/, "the showcase loads workbench.css");
});

test("the header block paints only the mark's accent cells in accent, the slash in prompt and the description in dim", () => {
  const f = ENTRIES.find((e) => e.title === "Header").fences[0];
  const { mark, markAccent, gap } = tui.header;
  const pre = f.match(/<pre class="sl-term-block__out">([\s\S]*?)<\/pre>/)[1].split("\n");
  const text = ['sonda<span class="sl-term-block__prompt">/</span>lab', "cld 0.9.0", '<span class="sl-term-block__dim">Manage Claude Code loadouts.</span>'];
  const paint = (row, mask) => [...row].map((g, i) => (mask[i] === "a" ? `\u0000${g}` : g)).join("")
    .replace(/(\u0000.)+/g, (run) => `<span class="sl-term-block__${tui.header.accentRole}">${run.replace(/\u0000/g, "")}</span>`);
  mark.forEach((row, i) => assert.equal(pre[i], `${paint(row, markAccent[i])}${" ".repeat(gap)}${text[i]}`, `header row ${i}`));
});
