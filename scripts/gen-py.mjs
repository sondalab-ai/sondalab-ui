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

  const py = `# GENERATED from sondalab.tokens.json — do not edit.
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


def _no_color() -> bool:
    return bool(os.environ.get("NO_COLOR"))


def supports_truecolor() -> bool:
    return os.environ.get("COLORTERM", "").lower() in ("truecolor", "24bit")


def paint(text: str, role: str, *, err: bool = False) -> str:
    if _no_color() or role not in ROLES:
        return text
    code, (r, g, b) = ROLES[role]
    sgr = f"38;2;{r};{g};{b}" if supports_truecolor() else str(code)
    return f"\\033[{sgr}m{text}\\033[0m"
`;
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, py);
  console.log("gen-py: wrote sondalab_palette/__init__.py");
}

main();
