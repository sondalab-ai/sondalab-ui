import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens } from "./lib/tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../packages/palette-py/sondalab_palette/__init__.py");

const NAMED = {
  black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  bright_black: 90, bright_red: 91, bright_green: 92, bright_yellow: 93,
  bright_blue: 94, bright_magenta: 95, bright_cyan: 96, bright_white: 97,
};

// JSON value -> Python literal: arrays become tuples, objects dicts. Only
// strings, numbers, arrays and objects are tokens; anything else would emit
// invalid Python (true/false/null), so it fails the build instead.
function py(v, path) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (Array.isArray(v)) return `(${v.map((x, i) => py(x, `${path}[${i}]`)).join(", ")}${v.length === 1 ? "," : ""})`;
  if (v && typeof v === "object") return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${py(x, `${path}.${k}`)}`).join(", ")}}`;
  throw new Error(`gen-py: ${path} is ${JSON.stringify(v)}, not a string, number, array or object`);
}

// A dict table, one key per line, as LAYOUT is written.
function table(obj, path, row = (v, k) => py(v, `${path}.${k}`)) {
  return Object.entries(obj).map(([k, v]) => `    ${JSON.stringify(k)}: ${row(v, k)},`).join("\n");
}

// name -> (unicode, ascii), the GLYPHS shape without the role.
function pairs(obj, path) {
  return table(obj, path, (v, k) => {
    if (!v || typeof v.unicode !== "string" || typeof v.ascii !== "string") throw new Error(`gen-py: ${path}.${k} needs unicode and ascii`);
    return `(${JSON.stringify(v.unicode)}, ${JSON.stringify(v.ascii)})`;
  });
}

function main() {
  const t = loadTokens();
  const roles = Object.entries(t.terminal).map(([role, def]) => {
    const code = NAMED[def.ansi];
    if (code === undefined) throw new Error(`Unknown ANSI name: ${def.ansi}`);
    const hex = def.true.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return `    "${role}": (${code}, (${r}, ${g}, ${b})),`;
  }).join("\n");

  const glyphs = Object.entries(t.tui.glyphs).map(([name, g]) => {
    if (!Object.hasOwn(t.terminal, g.role)) throw new Error(`tui glyph ${name}: unknown role ${g.role}`);
    return `    ${JSON.stringify(name)}: (${JSON.stringify(g.unicode)}, ${JSON.stringify(g.ascii)}, ${JSON.stringify(g.role)}),`;
  }).join("\n");
  const layout = Object.entries(t.tui.layout).map(([k, v]) => `    ${JSON.stringify(k)}: ${v},`).join("\n");
  for (const part of ["spinner", "progress"]) {
    if (!Object.hasOwn(t.terminal, t.tui[part].role)) throw new Error(`tui ${part}: unknown role ${t.tui[part].role}`);
  }
  if (!Object.hasOwn(t.terminal, t.tui.header.accentRole)) throw new Error(`tui header: unknown role ${t.tui.header.accentRole}`);

  const source = `# GENERATED from sondalab.tokens.json — do not edit.
"""Sondalab terminal palette: semantic roles, named-ANSI floor + truecolor opt-in."""
import os

# role -> (named_ansi_sgr_code, (r, g, b))
ROLES = {
${roles}
}

# name -> (unicode, ascii, role); ascii is used on a non-UTF-8 locale or TERM=dumb
GLYPHS = {
${glyphs}
}

# layout integers: indent, labelWidth, blankBeforeSummary, maxWidth
LAYOUT = {
${layout}
}

# dither ramp, lightest to darkest; ascii[i] is the fallback for unicode[i]
RAMP = {
${table(t.tui.ramp, "tui.ramp")}
}

# burst spinner: frames (unicode) / ascii, one column wide, painted in role
SPINNER = {
${table(t.tui.spinner, "tui.spinner")}
}

# decode effect: glyphs plus printable ASCII in randomAscii (inclusive code points)
DECODE = {
${table(t.tui.decode, "tui.decode")}
}

# progress bar: cell count, role, percent column width
PROGRESS = {
${table(t.tui.progress, "tui.progress")}
}

# redraw cap and first-output budget
MOTION = {
${table(t.tui.motion, "tui.motion")}
}

# name -> (unicode, ascii): rounded light box drawing and the selection seam
BOX = {
${pairs(t.tui.box, "tui.box")}
}

# name -> (unicode, ascii): key names in hints
KEYS = {
${pairs(t.tui.keys, "tui.keys")}
}

# OSC 11 timeout and prompt retry cap
ROBUSTNESS = {
${table(t.tui.robustness, "tui.robustness")}
}

# setting -> the environment variables that control it
ENV = {
${table(t.tui.env, "tui.env")}
}

# TUI header: mark rows, accent mask ("a" paints accentRole), compact mark, columns between mark and text
HEADER = {
${table(t.tui.header, "tui.header")}
}


def _no_color() -> bool:
    return bool(os.environ.get("NO_COLOR"))


def supports_truecolor() -> bool:
    return os.environ.get("COLORTERM", "").lower() in ("truecolor", "24bit")


def paint(text: str, role: str, *, err: bool = False) -> str:
    """Wrap text in role's SGR; NO_COLOR and COLORTERM only. Legacy: spec callers use term.paint(text, role, term.color_mode())."""
    if _no_color() or role not in ROLES:
        return text
    code, (r, g, b) = ROLES[role]
    sgr = f"38;2;{r};{g};{b}" if supports_truecolor() else str(code)
    return f"\\033[{sgr}m{text}\\033[0m"
`;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, source);
  console.log("gen-py: wrote sondalab_palette/__init__.py");
}

main();
