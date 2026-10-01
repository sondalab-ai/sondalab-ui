# Sondalab Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared, code-level Sondalab design system: one canonical token source generating a CSS/React kit and a Python terminal palette, adopted by spexr + introspect (web) and smartctx + daos (terminal).

**Architecture:** A single `sondalab.tokens.json` in `spexr/packages/ui-kit` is the source of truth. Two Node generators emit `tokens/tokens.css` + `themes/*.css` (web) and `sondalab_palette.py` (terminal). The web kit ships as `@sondalab/ui-kit`; the terminal palette as `sondalab-palette`. Products share grammar/type/neutrals/theme-machinery and keep a per-product accent.

**Tech Stack:** Node (ESM `.mjs` generators), TypeScript, React 18, Radix, Vitest (web); Python 3.12, pytest (terminal). Package managers: pnpm (spexr), the consuming repos' own.

**Spec:** `spexr/docs/superpowers/specs/2026-08-22-sondalab-design-system-design.md`

## Global Constraints

- Shared CSS token prefix: `--sl-*`. Theme selector: `[data-sl-theme="light|dark|high-contrast"]`.
- Type stack (verbatim): display `"Fraunces", Georgia, serif`; sans `"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif`; mono `"Martian Mono", ui-monospace, "SF Mono", Menlo, monospace`.
- Shared neutrals = brand-board warm paper (light `#ECE4D4`) / abyss (dark `#070A0D`). Per-product accent only: spexr indigo `#5b6cff`/`#8b96ff`, introspect cyan `#2ee6c0`. Sondalab default accent amber `#B56A0C`/`#F5A83C` + teal `#14606C`/`#35A0B4`.
- High-contrast theme is exempt from the brand palette (pure black/white/yellow, WCAG AAA) — carried through unchanged.
- Generated files are committed; a CI/check step fails if regeneration produces a diff.
- **Publishing to npm/PyPI is performed by the user**, not by the executor. Tasks build publish-ready packages and stop before `npm publish` / `twine upload`. Cross-repo consumption before publish uses **vendoring** (copy generated files with a `generated from sondalab.tokens.json — do not edit` header).
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_012G4MeLFu3iKRCbXnStak2w`.
- Work happens on branch `feat/sondalab-design-system` in the spexr repo (already created off `origin/main`). Consuming repos (introspect, smartctx, daos) each get their own branch.

---

## File Structure

**spexr/packages/ui-kit** (anchor)
- Create `src/tokens/sondalab.tokens.json` — canonical source (single responsibility: values).
- Create `scripts/gen-css.mjs` — tokens.json → `tokens.css` + `themes/*.css`.
- Create `scripts/gen-py.mjs` — tokens.json → `sondalab_palette.py` (written to a distributable Python package dir).
- Create `scripts/lib/tokens.mjs` — shared load/validate of tokens.json (DRY between generators).
- Modify `src/tokens/tokens.css`, `src/themes/{light,dark,high-contrast}.css` — become generated artifacts (`--sl-*`).
- Modify `src/themes/index.ts` — `--spexr-` → `--sl-`, `data-spexr-theme` → `data-sl-theme`, labels.
- Modify `package.json` — name `@sondalab/ui-kit`, add `gen:tokens` script, keep exports.
- Create `tests/gen-tokens.test.ts` — generator snapshot / drift test.

**packages/sondalab-palette-py** (new, in spexr repo for now — the Python package source)
- Create `pyproject.toml`, `sondalab_palette/__init__.py` (generated), `tests/test_palette.py`.

**introspect** — Modify `web/src/theme.css` (adopt `--sl-*`, keep cyan), font `<link>`, component token refs; add vendored `sondalab-tokens.css`.

**smartctx** — Modify `src/ccloadout/cli.py` (`_paint`/`_SGR` → `sondalab_palette`), add dep.

**daos** — Modify its CLI-ish output to use `sondalab_palette` (minimal).

---

## Slice 1 — Canonical source, generators, retuned ui-kit

### Task 1: Canonical token source `sondalab.tokens.json`

**Files:**
- Create: `spexr/packages/ui-kit/src/tokens/sondalab.tokens.json`

**Interfaces:**
- Produces: a JSON with top-level keys `shared`, `themes` (`light`/`dark`/`high-contrast`), `accent` (default), `terminal`. Consumed by `scripts/lib/tokens.mjs`.

- [ ] **Step 1: Write the canonical file**

```json
{
  "$schema-note": "Canonical Sondalab design tokens. Edit here only; run pnpm gen:tokens.",
  "shared": {
    "font": {
      "display": "\"Fraunces\", Georgia, serif",
      "sans": "\"Instrument Sans\", system-ui, -apple-system, \"Segoe UI\", sans-serif",
      "mono": "\"Martian Mono\", ui-monospace, \"SF Mono\", Menlo, monospace"
    },
    "space": { "0": "0", "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem", "5": "1.5rem", "6": "2rem", "8": "3rem" },
    "radius": { "sm": "4px", "md": "6px", "lg": "10px", "pill": "9999px" },
    "text": { "xs": "0.75rem", "sm": "0.875rem", "md": "1rem", "lg": "1.125rem", "xl": "1.5rem", "2xl": "2rem" },
    "line": { "tight": "1.2", "normal": "1.5", "relaxed": "1.6", "loose": "1.7" },
    "z": { "base": "1", "overlay": "50", "modal": "100", "toast": "200" },
    "motion": { "fast": "120ms", "mid": "220ms", "slow": "360ms", "ease": "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    "shadow": { "sm": "0 1px 2px rgba(0,0,0,0.06)", "md": "0 4px 12px rgba(0,0,0,0.08)", "lg": "0 12px 32px rgba(0,0,0,0.16)" },
    "focus": { "ring-width": "2px", "ring-offset": "0px" }
  },
  "themes": {
    "light": {
      "bg-canvas": "#ECE4D4", "bg-surface": "#F6F1E6", "bg-surface-raised": "#FFFFFF", "bg-overlay": "rgba(21,33,31,0.4)",
      "border-subtle": "rgba(21,33,31,0.09)", "border-default": "rgba(21,33,31,0.16)", "border-strong": "rgba(21,33,31,0.28)",
      "text-primary": "#15211F", "text-secondary": "#475754", "text-muted": "#6E7B78", "text-on-accent": "#FFFFFF",
      "status-success": "#16a34a", "status-warning": "#d97706", "status-danger": "#dc2626", "status-info": "#0284c7"
    },
    "dark": {
      "bg-canvas": "#070A0D", "bg-surface": "#0F151A", "bg-surface-raised": "#131C23", "bg-overlay": "rgba(0,0,0,0.6)",
      "border-subtle": "rgba(218,227,228,0.07)", "border-default": "rgba(218,227,228,0.13)", "border-strong": "rgba(218,227,228,0.28)",
      "text-primary": "#DAE3E4", "text-secondary": "#9AA9AD", "text-muted": "#6E8088", "text-on-accent": "#0A0A0B",
      "status-success": "#4ade80", "status-warning": "#fbbf24", "status-danger": "#f87171", "status-info": "#38bdf8"
    },
    "high-contrast": {
      "bg-canvas": "#000000", "bg-surface": "#000000", "bg-surface-raised": "#0a0a0a", "bg-overlay": "rgba(0,0,0,0.85)",
      "border-subtle": "#ffffff", "border-default": "#ffffff", "border-strong": "#ffff00",
      "text-primary": "#ffffff", "text-secondary": "#ffffff", "text-muted": "#cccccc", "text-on-accent": "#000000",
      "status-success": "#00ff00", "status-warning": "#ffaa00", "status-danger": "#ff5555", "status-info": "#00ffff"
    }
  },
  "accent": {
    "light": { "default": "#B56A0C", "hover": "#A05F0A", "active": "#8A5109", "subtle": "rgba(197,122,22,0.12)", "depth": "#14606C" },
    "dark": { "default": "#F5A83C", "hover": "#F7B863", "active": "#E0942A", "subtle": "rgba(245,168,60,0.16)", "depth": "#35A0B4" },
    "high-contrast": { "default": "#ffff00", "hover": "#ffffa0", "active": "#cccc00", "subtle": "#1a1a00", "depth": "#00ffff" }
  },
  "terminal": {
    "prompt": { "ansi": "bright_yellow", "true": "#F5A83C" },
    "ok":     { "ansi": "green",         "true": "#62D094" },
    "warn":   { "ansi": "yellow",        "true": "#F5A83C" },
    "err":    { "ansi": "red",           "true": "#f87171" },
    "dim":    { "ansi": "bright_black",  "true": "#6E8088" },
    "accent": { "ansi": "cyan",          "true": "#35A0B4" }
  }
}
```

- [ ] **Step 2: Validate it is well-formed JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/tokens/sondalab.tokens.json','utf8')); console.log('ok')"` from `spexr/packages/ui-kit`.
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add packages/ui-kit/src/tokens/sondalab.tokens.json
git commit -m "feat(ui-kit): add canonical Sondalab token source"
```

### Task 2: Shared token loader `scripts/lib/tokens.mjs`

**Files:**
- Create: `spexr/packages/ui-kit/scripts/lib/tokens.mjs`

**Interfaces:**
- Produces: `loadTokens()` → parsed object; `flattenShared(shared)` → `Map<cssVarName, value>` for the `--sl-*` role tokens (e.g. `--sl-font-mono`, `--sl-space-4`, `--sl-radius-md`, `--sl-motion-fast`, `--sl-shadow-md`, `--sl-z-modal`, `--sl-text-md`, `--sl-line-normal`, `--sl-focus-ring-width`). Consumed by both generators.

- [ ] **Step 1: Write the loader**

```js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const TOKENS_PATH = resolve(HERE, "../../src/tokens/sondalab.tokens.json");

export function loadTokens() {
  return JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
}

// Emit --sl-<group>-<key> for every shared scale.
export function flattenShared(shared) {
  const out = new Map();
  const groups = {
    font: "font", space: "space", radius: "radius", text: "text",
    line: "line", z: "z", motion: "motion", shadow: "shadow", focus: "focus",
  };
  for (const [group, prefix] of Object.entries(groups)) {
    for (const [key, value] of Object.entries(shared[group] ?? {})) {
      out.set(`--sl-${prefix}-${key}`, value);
    }
  }
  return out;
}
```

- [ ] **Step 2: Smoke-test the loader**

Run: `node -e "import('./scripts/lib/tokens.mjs').then(m=>{const t=m.loadTokens();console.log([...m.flattenShared(t.shared)].length,'shared tokens')})"`
Expected: prints a count > 30.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-kit/scripts/lib/tokens.mjs
git commit -m "feat(ui-kit): add token loader for generators"
```

### Task 3: CSS generator `scripts/gen-css.mjs`

**Files:**
- Create: `spexr/packages/ui-kit/scripts/gen-css.mjs`
- Modify (generated output): `src/tokens/tokens.css`, `src/themes/light.css`, `src/themes/dark.css`, `src/themes/high-contrast.css`

**Interfaces:**
- Consumes: `loadTokens`, `flattenShared` from Task 2.
- Produces: writes 4 CSS files. `tokens.css` = shared `--sl-*` on `:root` + reduced-motion override. Each theme file = `[data-sl-theme="<id>"]` block with surfaces/text/borders/status (from `themes.<id>`) + accent (from `accent.<id>`) + `--sl-focus-ring`.

- [ ] **Step 1: Write the generator**

```js
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, flattenShared } from "./lib/tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src");
const HEADER = "/* GENERATED from src/tokens/sondalab.tokens.json — do not edit. Run `pnpm gen:tokens`. */\n";

function block(selector, entries) {
  const body = entries.map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `${selector} {\n${body}\n}\n`;
}

function main() {
  const t = loadTokens();

  // tokens.css — shared role tokens + reduced-motion
  const shared = [...flattenShared(t.shared)];
  let tokensCss = HEADER + block(":root", shared);
  tokensCss += `\n@media (prefers-reduced-motion: reduce) {\n  :root {\n` +
    `    --sl-motion-fast: 0ms;\n    --sl-motion-mid: 0ms;\n    --sl-motion-slow: 0ms;\n  }\n}\n`;
  writeFileSync(resolve(SRC, "tokens/tokens.css"), tokensCss);

  // theme files
  for (const id of ["light", "dark", "high-contrast"]) {
    const theme = t.themes[id];
    const accent = t.accent[id];
    const entries = [
      ...Object.entries(theme).map(([k, v]) => [`--sl-${k}`, v]),
      ...Object.entries(accent).map(([k, v]) => [`--sl-accent-${k}`, v]),
      ["--sl-focus-ring", accent.default],
    ];
    const css = HEADER + block(`[data-sl-theme="${id}"]`, entries);
    writeFileSync(resolve(SRC, `themes/${id}.css`), css);
  }
  console.log("gen-css: wrote tokens.css + 3 themes");
}

main();
```

- [ ] **Step 2: Run it**

Run: `node scripts/gen-css.mjs` from `spexr/packages/ui-kit`.
Expected: `gen-css: wrote tokens.css + 3 themes`; the 4 CSS files now start with the GENERATED header and use `--sl-*`.

- [ ] **Step 3: Verify output**

Run: `grep -c -- '--sl-' src/tokens/tokens.css src/themes/light.css`
Expected: both counts > 8.

- [ ] **Step 4: Commit**

```bash
git add packages/ui-kit/scripts/gen-css.mjs packages/ui-kit/src/tokens/tokens.css packages/ui-kit/src/themes/*.css
git commit -m "feat(ui-kit): generate CSS tokens + themes from canonical source"
```

### Task 4: Python palette generator `scripts/gen-py.mjs`

**Files:**
- Create: `spexr/packages/ui-kit/scripts/gen-py.mjs`
- Create (generated output): `spexr/packages/sondalab-palette-py/sondalab_palette/__init__.py`

**Interfaces:**
- Consumes: `loadTokens` from Task 2.
- Produces: `sondalab_palette/__init__.py` exposing `ROLES` (dict role→(ansi, hex)), `supports_truecolor() -> bool`, `paint(text: str, role: str, *, err: bool=False) -> str`, and `NO_COLOR` handling.

- [ ] **Step 1: Write the generator**

```js
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens } from "./lib/tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../sondalab-palette-py/sondalab_palette/__init__.py");

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

  const py = `# GENERATED from src/tokens/sondalab.tokens.json — do not edit.
"""Sondalab terminal palette: semantic roles, named-ANSI floor + truecolor opt-in."""
import os

# role -> (named_ansi_sgr_code, (r, g, b))
ROLES = {
${roles}
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
```

- [ ] **Step 2: Run it**

Run: `node scripts/gen-py.mjs` from `spexr/packages/ui-kit`.
Expected: `gen-py: wrote sondalab_palette/__init__.py`.

- [ ] **Step 3: Verify Python is valid + behaves**

Run: `cd spexr/packages/sondalab-palette-py && NO_COLOR= COLORTERM=truecolor python3 -c "import sondalab_palette as p; print(repr(p.paint('x','ok')))"`
Expected: a string containing `38;2;` (truecolor path).
Run: `COLORTERM= python3 -c "import sondalab_palette as p; print(repr(p.paint('x','ok')))"`
Expected: contains `\x1b[32m` (named-ANSI floor).
Run: `NO_COLOR=1 python3 -c "import sondalab_palette as p; print(repr(p.paint('x','ok')))"`
Expected: `'x'` (no codes).

- [ ] **Step 4: Commit**

```bash
git add packages/ui-kit/scripts/gen-py.mjs packages/sondalab-palette-py/sondalab_palette/__init__.py
git commit -m "feat: generate sondalab_palette Python module from canonical source"
```

### Task 5: Wire `gen:tokens` script + rename package

**Files:**
- Modify: `spexr/packages/ui-kit/package.json`

**Interfaces:**
- Produces: `pnpm gen:tokens` runs both generators; package name `@sondalab/ui-kit`.

- [ ] **Step 1: Edit package.json**

Change `"name": "@spexr/ui-kit"` → `"name": "@sondalab/ui-kit"`. Add to `scripts`:
```json
"gen:tokens": "node scripts/gen-css.mjs && node scripts/gen-py.mjs"
```

- [ ] **Step 2: Update internal stylesheet refs**

In `src/themes/index.ts`, replace the three `"@spexr/ui-kit/themes/*.css"` stylesheet strings with `"@sondalab/ui-kit/themes/*.css"` and the labels `"Spexr Light/Dark"` → `"Sondalab Light/Dark"`.

- [ ] **Step 3: Run gen:tokens end to end**

Run: `pnpm gen:tokens` from `spexr/packages/ui-kit`.
Expected: both generator success lines; `git diff --stat` shows only regenerated files (no drift beyond intended).

- [ ] **Step 4: Commit**

```bash
git add packages/ui-kit/package.json packages/ui-kit/src/themes/index.ts
git commit -m "feat(ui-kit): rename to @sondalab/ui-kit, add gen:tokens"
```

### Task 6: Migrate `--spexr-` → `--sl-` and `data-spexr-theme` → `data-sl-theme` in ui-kit + spexr

**Files:**
- Modify: `spexr/packages/ui-kit/src/themes/index.ts` (prefix guard + attr)
- Modify: all spexr sources referencing `--spexr-` or `data-spexr-theme` (found via grep)

**Interfaces:**
- Consumes: generated `--sl-*` tokens.
- Produces: spexr renders on `--sl-*` / `[data-sl-theme]`; product accent overrides restored (see Task 7).

- [ ] **Step 1: Update the theme registry guard + apply**

In `src/themes/index.ts`: change `applyTheme` to set `data-sl-theme`; change `applyCustomThemeTokens` prefix check from `--spexr-` to `--sl-`; error message accordingly.

- [ ] **Step 2: Inventory references**

Run: `grep -rln -- '--spexr-\|data-spexr-theme' spexr --include=*.ts --include=*.tsx --include=*.css | grep -v node_modules | grep -v dist`
Record the file list.

- [ ] **Step 3: Bulk-rename references**

For each file from Step 2: `--spexr-` → `--sl-`, `data-spexr-theme` → `data-sl-theme`. (Use sed per file, e.g. `sed -i '' 's/--spexr-/--sl-/g; s/data-spexr-theme/data-sl-theme/g' <file>`.)

- [ ] **Step 4: Typecheck + build + tests**

Run: `pnpm -C spexr/packages/ui-kit build && pnpm -C spexr/packages/ui-kit test`
Run spexr app typecheck: `pnpm -C spexr typecheck` (or the repo's equivalent).
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A spexr
git commit -m "refactor(spexr): migrate --spexr-* to --sl-* token namespace"
```

### Task 7: Restore spexr product accent + extension tokens

**Files:**
- Create: `spexr/packages/ui-kit/src/themes/spexr-accent.css` (product override layer)
- Modify: spexr shell to load `spexr-accent.css` after the base theme

**Interfaces:**
- Consumes: `--sl-accent-*` base tokens.
- Produces: spexr keeps indigo accent + its `agent-*`/`editor-*`/`hljs-*` roles. `--sl-font-code` defined here (spexr editor coding mono).

- [ ] **Step 1: Write the override file**

```css
/* spexr product overrides — accent + product-specific roles. Loaded after base theme. */
[data-sl-theme="light"] {
  --sl-accent-default: #5b6cff; --sl-accent-hover: #4858ee; --sl-accent-active: #3645d4;
  --sl-accent-subtle: #eef0ff; --sl-focus-ring: #5b6cff;
  --sl-font-code: "JetBrains Mono", "Geist Mono", "SF Mono", "Menlo", monospace;
}
[data-sl-theme="dark"] {
  --sl-accent-default: #8b96ff; --sl-accent-hover: #a3acff; --sl-accent-active: #6b78f0;
  --sl-accent-subtle: #1c1f3a; --sl-focus-ring: #8b96ff;
}
```
(Move spexr's existing `agent-*`/`editor-*`/`hljs-*` values here too, re-prefixed `--sl-`.)

- [ ] **Step 2: Load it in the shell** after the base theme CSS import.

- [ ] **Step 3: Visual/build check** — spexr accent renders indigo in light + dark; editor uses JetBrains Mono; all three themes legible (spot-check high-contrast unaffected).

Run: `pnpm -C spexr build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A spexr
git commit -m "feat(spexr): keep indigo accent + coding mono via product override layer"
```

### Task 8: Add Fraunces + Instrument Sans + Martian Mono web fonts to spexr

**Files:**
- Modify: spexr `index.html` (or the shell's font `<link>`).

- [ ] **Step 1: Add the Google Fonts link**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,340;9..144,500;9..144,600&family=Instrument+Sans:wght@400;500;600&family=Martian+Mono:wght@100;200;300;400&display=swap">
```
(If spexr runs offline/Theia with a strict CSP, self-host the woff2 instead and add `@font-face`; note which path the repo needs.)

- [ ] **Step 2: Build + eyeball** the app uses Instrument Sans body, Martian Mono for data labels.

- [ ] **Step 3: Commit**

```bash
git add -A spexr
git commit -m "feat(spexr): load Sondalab web fonts"
```

### Task 9: Generator drift test

**Files:**
- Create: `spexr/packages/ui-kit/tests/gen-tokens.test.ts`

**Interfaces:**
- Consumes: the generators + committed outputs.

- [ ] **Step 1: Write the test**

```ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("token generation", () => {
  it("committed CSS matches regenerated output (no drift)", () => {
    const before = readFileSync("src/tokens/tokens.css", "utf8");
    execSync("node scripts/gen-css.mjs", { cwd: process.cwd() });
    const after = readFileSync("src/tokens/tokens.css", "utf8");
    expect(after).toBe(before);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm -C spexr/packages/ui-kit test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui-kit/tests/gen-tokens.test.ts
git commit -m "test(ui-kit): fail on token generation drift"
```

### Task 10: Slice 1 checkpoint — push

- [ ] **Step 1:** `git push` the branch.
- [ ] **Step 2:** Report to the user: ui-kit is `@sondalab/ui-kit`, publish-ready (user runs `npm publish --access public` when ready); `sondalab-palette-py` is publish-ready (user runs the PyPI upload).

---

## Slice 2 — introspect adopts the web kit

### Task 11: Vendor Sondalab tokens into introspect + swap fonts

**Files:**
- Create: `introspect/web/src/sondalab-tokens.css` (vendored copy of `tokens.css` + all three theme files concatenated, with the GENERATED header noting the source).
- Modify: `introspect/web/src/theme.css` (font `<link>`/`@import`, map old vars).
- Modify: `introspect/index.html` (Google Fonts link from Task 8, replacing the Space Grotesk + IBM Plex import).

**Interfaces:**
- Consumes: `--sl-*` tokens.
- Produces: introspect renders on `--sl-*`, warm neutrals, cyan accent retained.

- [ ] **Step 1: Vendor the CSS** — copy the generated `tokens.css` + `themes/*.css` into `sondalab-tokens.css`; adjust theme selector to introspect's toggle if it uses `data-theme` (map `[data-theme="light"]`→ include `[data-sl-theme="light"]`, or set both attributes in the shell). Import it first in the app entry.

- [ ] **Step 2: introspect accent override** — add a small block keeping cyan:
```css
[data-sl-theme="dark"]  { --sl-accent-default:#2ee6c0; --sl-accent-depth:#5ad1ff; --sl-focus-ring:#2ee6c0; }
[data-sl-theme="light"] { --sl-accent-default:#0e9c84; --sl-accent-depth:#2a82b8; --sl-focus-ring:#0e9c84; }
```

- [ ] **Step 3: Remap introspect's own vars** — replace `--bg/--line/--txt/--mut/--cy/--cy2/...` usages with `--sl-*` equivalents (`--bg`→`--sl-bg-canvas`, `--txt`→`--sl-text-primary`, `--mut`→`--sl-text-muted`, `--cy`→`--sl-accent-default`, `--line`→`--sl-border-default`). Grep: `grep -rln -- 'var(--bg)\|var(--cy)\|var(--txt)\|var(--mut)\|var(--line)' introspect/web/src`.

- [ ] **Step 4: Swap fonts** — replace the `@import url("…Space+Grotesk…IBM+Plex+Mono…")` at the top of `theme.css` with the Sondalab families.

- [ ] **Step 5: Build + visual check** — `pnpm -C introspect/web build`; dashboard renders warm-paper light + abyss dark, cyan accent, Instrument/Martian fonts. Expected: pass.

- [ ] **Step 6: Commit** (introspect repo, own branch `feat/sondalab-tokens`)

```bash
git -C introspect add -A && git -C introspect commit -m "feat(web): adopt Sondalab tokens + fonts, keep cyan accent"
```

---

## Slice 3 — terminal palette + smartctx

### Task 12: Vendor `sondalab_palette` into smartctx + migrate `_paint`

**Files:**
- Create: `smartctx/src/ccloadout/_sondalab_palette.py` (vendored copy of generated module) — until `sondalab-palette` is on PyPI.
- Modify: `smartctx/src/ccloadout/cli.py` (`_SGR`/`_paint` → palette roles).

**Interfaces:**
- Consumes: `paint(text, role, *, err=False)` from the vendored module.

- [ ] **Step 1: Vendor the module** — copy `sondalab_palette/__init__.py` to `_sondalab_palette.py` with the GENERATED header.

- [ ] **Step 2: Map current colors to roles** — in `cli.py`, replace `_paint(s,'yellow',...)`→`paint(s,'warn'/'prompt')`, `'green'`→`'ok'`, `'dim'`→`'dim'`. Keep the `err=` kwarg (writes to stderr behaviour stays in the caller; `paint` only colors). The arrow-key redraw loop keeps its own logic; only color calls change.

- [ ] **Step 3: Tests** — run smartctx's CLI tests: `python3 -m pytest smartctx/tests/test_cli.py -q`. Expected: pass. Add a case asserting `paint('x','ok')` degrades to `'x'` under `NO_COLOR=1`.

- [ ] **Step 4: Manual check** — run a smartctx command on `COLORTERM=truecolor` and unset; output colored then named-ANSI.

- [ ] **Step 5: Commit** (smartctx repo, own branch)

```bash
git -C smartctx add -A && git -C smartctx commit -m "feat(cli): adopt Sondalab terminal palette (roles + truecolor opt-in)"
```

---

## Slice 4 — trivial terminal adopters

### Task 13: daos + introspect-bin

**Files:**
- Modify: daos CLI-ish output modules to import the vendored palette (copy `_sondalab_palette.py` into daos).
- Create: `introspect/server/src/sondalab-palette.ts` (~30-line TS mirror of `ROLES` + `paint`).

- [ ] **Step 1: daos** — vendor `_sondalab_palette.py`, route its user-facing prints through `paint`. Run daos tests: `python3 -m pytest daos/packages/daos-core -q -k cli`. Expected: pass.

- [ ] **Step 2: introspect-bin TS mirror** — write `paint(text, role)` reading `process.env.COLORTERM`/`NO_COLOR`, same role table; use it in `server/src/bin/introspect.ts` startup lines.

- [ ] **Step 3: Commit** each repo on its branch.

---

## Self-Review

**Spec coverage:**
- Canonical source → Task 1. Generators (CSS+Py) → Tasks 3, 4. `gen:tokens` + rename → Task 5. Naming migration → Task 6. Per-product accent + extension roles + `--sl-font-code` → Task 7. Type stack → Tasks 7 (code font), 8, 11 (fonts). Shared neutrals warm-up → Tasks 1/3 (values), verified in 6/11. Terminal role vocab + ANSI floor + truecolor → Task 4, adopted 12/13. Drift CI → Task 9. Slices 1-4 → Tasks 1-13. Prereqs (publish by user, vendoring interim) → Tasks 10, 11, 12, 13 + Global Constraints. HC exempt → Task 1 (values), 7 (untouched). ✅ no gaps.

**Placeholder scan:** All code steps contain real code; no TBD/TODO. The one conditional ("if spexr uses strict CSP, self-host fonts" in Task 8) is a documented branch with the concrete alternative named, not a placeholder.

**Type consistency:** `paint(text, role, *, err=False)` and `supports_truecolor()` consistent across Tasks 4, 12, 13. `--sl-accent-default/-hover/-active/-subtle/-depth` + `--sl-focus-ring` consistent across Tasks 3, 7, 11. `flattenShared`/`loadTokens` consistent Tasks 2, 3, 4. `data-sl-theme` consistent Tasks 3, 5, 6, 11. ✅
