// gen-term-js — write the Term spec's constants for Node from sondalab.tokens.json:
// packages/ui-kit/term-tokens.js (deep-frozen literals) and term-tokens.d.ts.
// term.js holds the hand-written logic and re-exports these. Run via
// `npm run gen:tokens`; check-drift.yml fails on a stale or uncommitted copy.

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens } from "./lib/tokens.mjs";
import { NAMED } from "./lib/ansi.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const HEAD = "// GENERATED from sondalab.tokens.json by scripts/gen-term-js.mjs — do not edit.\n";

/** A JSON token value as a TypeScript type: numbers, strings, readonly arrays and objects. */
function tsType(v, path, depth = 1) {
  if (typeof v === "string") return "string";
  if (typeof v === "number" && Number.isFinite(v)) return "number";
  if (Array.isArray(v)) {
    const kinds = [...new Set(v.map((x, i) => tsType(x, `${path}[${i}]`, depth + 1)))];
    return `readonly ${kinds.length === 1 ? kinds[0] : `(${kinds.join(" | ")})`}[]`;
  }
  if (v && typeof v === "object") {
    const pad = "  ".repeat(depth);
    const rows = Object.entries(v).map(([k, x]) => `${pad}readonly ${k}: ${tsType(x, `${path}.${k}`, depth + 1)};`);
    return `{\n${rows.join("\n")}\n${"  ".repeat(depth - 1)}}`;
  }
  throw new Error(`gen-term-js: ${path} is ${JSON.stringify(v)}, not a string, number, array or object`);
}

/** The constants, in the order sondalab_palette declares them. */
function constants(t) {
  const roles = {};
  for (const [role, def] of Object.entries(t.terminal)) {
    const code = NAMED[def.ansi];
    if (code === undefined) throw new Error(`gen-term-js: unknown ANSI name ${def.ansi}`);
    const hex = def.true.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    roles[role] = { ansi16: String(code), truecolor: `38;2;${r};${g};${b}` };
  }
  const glyphs = {};
  for (const [name, g] of Object.entries(t.tui.glyphs)) {
    if (!Object.hasOwn(t.terminal, g.role)) throw new Error(`gen-term-js: glyph ${name}: unknown role ${g.role}`);
    glyphs[name] = { unicode: g.unicode, ascii: g.ascii, role: g.role };
  }
  for (const part of ["spinner", "progress"]) {
    if (!Object.hasOwn(t.terminal, t.tui[part].role)) throw new Error(`gen-term-js: tui ${part}: unknown role ${t.tui[part].role}`);
  }
  if (!Object.hasOwn(t.terminal, t.tui.header.accentRole)) throw new Error(`gen-term-js: tui header: unknown role ${t.tui.header.accentRole}`);
  const tui = t.tui;
  return [
    ["ROLES", "role -> SGR foreground parameters: ansi16 (the named-ANSI floor) and truecolor (the brand hue)", roles],
    ["GLYPHS", "name -> unicode, ascii and role; ascii on a non-UTF-8 locale, TERM=dumb or SONDALAB_ASCII=1", glyphs],
    ["LAYOUT", "layout integers: indent, labelWidth, blankBeforeSummary, maxWidth", tui.layout],
    ["RAMP", "dither ramp, lightest to darkest; ascii[i] is the fallback for unicode[i]", tui.ramp],
    ["SPINNER", "burst spinner: frames (unicode) / ascii, one column wide, painted in role", tui.spinner],
    ["DECODE", "decode effect: glyphs plus printable ASCII in randomAscii (inclusive code points)", tui.decode],
    ["PROGRESS", "progress bar: cell count, role, percent column width", tui.progress],
    ["MOTION", "redraw cap and first-output budget", tui.motion],
    ["BOX", "name -> unicode, ascii: rounded light box drawing and the selection seam", tui.box],
    ["KEYS", "name -> unicode, ascii: key names in hints", tui.keys],
    ["ROBUSTNESS", "OSC 11 timeout and prompt retry cap", tui.robustness],
    ["ENV", "setting -> the environment variables that control it", tui.env],
    ["HEADER", 'TUI header: mark rows, accent mask ("a" paints accentRole), compact mark, columns between mark and text', tui.header],
  ];
}

function main() {
  const t = loadTokens();
  const list = constants(t);
  const js = [
    HEAD,
    "/** Freeze `o` and everything inside it, so a consumer cannot edit a token. */",
    "function freeze(o) {",
    "  for (const v of Object.values(o)) if (v && typeof v === \"object\") freeze(v);",
    "  return Object.freeze(o);",
    "}",
    "",
    ...list.map(([name, doc, value]) => `/** ${doc} */\nexport const ${name} = freeze(${JSON.stringify(value, null, 2)});\n`),
  ].join("\n");
  const unionOf = (obj) => Object.keys(obj).map((k) => JSON.stringify(k)).join(" | ");
  const types = new Map([
    ["ROLES", `{ readonly [R in Role]: { readonly ansi16: string; readonly truecolor: string } }`],
    ["GLYPHS", `{ readonly [G in GlyphName]: { readonly unicode: string; readonly ascii: string; readonly role: Role } }`],
  ]);
  const dts = [
    HEAD,
    `/** A terminal colour role. */\nexport type Role = ${unionOf(t.terminal)};\n`,
    `/** A GLYPHS key. */\nexport type GlyphName = ${unionOf(t.tui.glyphs)};\n`,
    ...list.map(([name, doc, value]) => `/** ${doc} */\nexport declare const ${name}: ${types.get(name) ?? tsType(value, name)};\n`),
  ].join("\n");
  writeFileSync(resolve(KIT, "term-tokens.js"), js);
  writeFileSync(resolve(KIT, "term-tokens.d.ts"), dts);
  console.log("gen-term-js: wrote packages/ui-kit/term-tokens.js and term-tokens.d.ts");
}

main();
