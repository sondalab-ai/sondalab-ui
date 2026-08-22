# Sondalab Design System — Design Spec

> **What this file is:** the implementation contract for the shared Sondalab design system (phase 2 of the umbrella-brand effort) — the canonical token source, its generators, and how each tool in `~/src/mine/ai-tools` consumes them across web (CSS/React) and terminal (Python/TS).
> **Audience:** engineers implementing the token pipeline and migrating each tool; reviewers.
> **Owner:** marcellobarile.
> **Companion files:** the identity board artifact (`https://claude.ai/code/artifact/abbebb7f-5778-4af6-a9b4-2b3f169ae20f`) is the visual thesis and value source; the decision record `~/.claude/debug-decisions/-Users-marcello.barile-src-mine-ai-tools/2026-08-22-1247-umbrella-brand-name-sondalab.md` covers the brand-level trade-offs. This spec is the code-level contract; the implementation plan (writing-plans, next step) is the build sequence.

## Legend (status vocabulary)

- **Shipped / Delivered** — merged to the tool's production codebase, available to users.
- **PoC implemented (not delivered)** — built as a prototype, not merged/released.
- **Placeholder (not delivered)** — stub or scaffold only.

At spec time everything below is **not delivered** (design only).

## Context

Sondalab is the umbrella brand (a future AI company) over the local/agentic tools in `~/src/mine/ai-tools`. Phase 1 (brand identity) is finalized. Phase 2 (this spec) homologates UI/TUI across the suite onto a shared, code-level design system.

Survey of the actual UI/TUI surface (2026-08-22):

| Tool | Web (React) | Terminal | Token system today |
|---|---|---|---|
| **spexr** | 15 tsx, 7 css — flagship IDE | trivial | `--spexr-*`, two-layer (`tokens.css` → `themes/*.css`), 3 themes, Radix, WCAG AA. Inter + JetBrains Mono, accent indigo `#5b6cff` |
| **introspect** | 25 tsx, 2 css — dashboard | trivial `console.log` bin | own `--bg/--cy/--txt` tokens, dark-first + light. Space Grotesk + IBM Plex Mono, accent cyan `#2ee6c0` |
| **smartctx** (ccloadout) | — | **real**: `src/ccloadout/cli.py` 1097 lines, hand-rolled `_paint`/`_SGR` ANSI painter + arrow-key redraw menu | named ANSI (yellow/green/dim) resolved through user theme |
| **daos** | — | Python library, no rich/textual | none |
| **local-agents** | — | — | no UI surface |
| **claude-skills** | — | — | no UI surface |

So there are **~3 real consumers**: spexr + introspect (web), smartctx (terminal). introspect's TS bin and daos are trivial terminal adopters. local-agents and claude-skills are out of scope (no UI).

**No tool currently uses the brand-board values** (Fraunces / Instrument Sans / Martian Mono, amber/teal). spexr/ui-kit anchors the *architecture* (two-layer tokens, `--prefix-*` naming, reduced-motion override, 3-theme set), **not** the values — every concrete value is replaced.

CSS custom properties cannot reach Python, so there is **no single shared package**: one canonical value source generates a CSS/React distribution and a Python terminal palette.

## Decisions locked (from brainstorming)

1. **Convergence = shared grammar, per-product accent.** Shared across web apps: token architecture, type stack, spacing, radii, motion, shadows, z-layers, neutrals, semantic status, 3-theme machinery. **Per-product:** the accent only (spexr keeps indigo, introspect keeps cyan). The brand-board amber/teal becomes the **default** Sondalab accent (company site + future tools with no identity of their own), not an override of spexr/introspect.
2. **Terminal color = semantic roles + truecolor opt-in.** Color applies only to roles (`prompt`/`ok`/`warn`/`err`/`dim`/`accent`) via named ANSI that resolve through the user's theme (the legibility floor); when `COLORTERM=truecolor`, upgrade to exact amber/teal hex, falling back to named ANSI otherwise. No decorative fills that depend on an unknown user background.
3. **Source of truth = one generated file.** A canonical `sondalab.tokens.json` → generators emit `tokens.css` (web) and `sondalab_palette.py` (terminal). Zero drift; one edit site.

## Goals / Non-goals

**Goals**
- One canonical token source; generated CSS + Python; no hand-sync.
- spexr + introspect share grammar/type/neutrals/theme-machinery, keep per-product accent.
- smartctx (+ daos, introspect-bin) share a terminal role vocabulary with a safe ANSI floor and truecolor upgrade.
- Each slice is independently reviewable and leaves the suite building.

**Non-goals**
- No full rebrand of spexr/introspect identity (house-of-brands: products keep name/logo/accent).
- No UI for local-agents / claude-skills.
- No forcing spexr's product-specific roles (`agent-*`, `editor-*`, `hljs-*`) onto other tools.
- No new umbrella monorepo; tools stay separate repos, consume via published packages (or vendored interim).

## Architecture

Three layers, one source:

```
sondalab.tokens.json            ← CANONICAL SOURCE (in spexr/packages/ui-kit)
   │
   ├─ scripts/gen-css.mjs  → tokens/tokens.css  +  themes/{light,dark,high-contrast}.css   (web)
   └─ scripts/gen-py.mjs   → sondalab_palette.py                                            (terminal)

Distributions:
   web      : @sondalab/ui-kit (npm)     → spexr consumes in-repo, introspect adds dep
   terminal : sondalab-palette (PyPI)    → smartctx, daos
              + tiny TS palette mirror    → introspect-bin
```

### Layer 1 — canonical source `sondalab.tokens.json`

Single JSON with three sections:

- **`shared`** — values identical across all web consumers: type stack, spacing scale, radii, motion, shadows, z-layers, neutrals (warm-paper light / abyss dark), semantic status.
- **`themes`** — `light` / `dark` / `high-contrast` role→value maps for surfaces, borders, text, focus. High-contrast is **exempt from the brand palette** (pure black/white/yellow — accessibility floor, WCAG AAA target), carried through unchanged from spexr.
- **`accent`** — the **default** Sondalab accent (amber/teal). Per-product accents are **not** in the canonical file; each product overrides the `--sl-accent-*` tokens in its own theme layer.

### Layer 2 — generators (`ui-kit/scripts/`)

- `gen-css.mjs` → emits `tokens/tokens.css` (`--sl-*` role tokens on `:root`) + `themes/{light,dark,high-contrast}.css` (concrete values, selector `[data-sl-theme="…"]`). Preserves the reduced-motion override block.
- `gen-py.mjs` → emits `sondalab_palette.py`: a role→(named-ANSI, truecolor-hex) map + a `paint(text, role, *, err=False)` helper and a `supports_truecolor()` check (reads `COLORTERM`). Mirrors smartctx's current `_paint`/`_SGR` shape so migration is a drop-in.

Both run in a `pnpm gen:tokens` script; generated files are committed (so consumers without the generator still build) and CI checks they are up to date (fail if `git diff` after regenerate).

### Layer 3 — distributions

- **Web** — `@sondalab/ui-kit` (retunes the existing `spexr/packages/ui-kit`, renamed package): ships `tokens.css`, `themes/*.css`, the existing `Tip` component, `cn` util. spexr consumes it in-repo; introspect adds it as a dependency and maps its old `--bg/--cy/--txt` names via a thin compat shim during migration, then switches to `--sl-*`.
- **Terminal** — `sondalab-palette` (PyPI) for smartctx + daos; introspect's TS bin gets a ~30-line TS mirror of the same role table (not worth a package).

## Canonical token schema + values

### Shared — type

| Token | Value | Replaces |
|---|---|---|
| `--sl-font-display` | `"Fraunces", Georgia, serif` | (new — display/headline) |
| `--sl-font-sans` | `"Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif` | Inter (spexr), Space Grotesk (introspect) |
| `--sl-font-mono` | `"Martian Mono", ui-monospace, "SF Mono", Menlo, monospace` | JetBrains Mono (spexr), IBM Plex Mono (introspect) — UI/data/TUI labels, thin/extra-light hierarchy |
| `--sl-font-code` | **per-product override**, defaults to `--sl-font-mono` | source-code surfaces (spexr editor / code blocks) — a carve-out so the code editor may keep a coding-optimized mono; Martian Mono thin is a display face, not an editor face |

Mono weight hierarchy (from board): 100 large numerals · 200 data/TUI · 300 tracked labels · 400 accent.

### Shared — scales (carried from spexr `tokens.css`, re-prefixed `--sl-*`)

Spacing `0/1/2/3/4/5/6/8` (4px base), radii `sm 4 / md 6 / lg 10 / pill`, motion `fast 120 / mid 220 / slow 360` + `ease cubic-bezier(0.2,0.8,0.2,1)` + reduced-motion→0, shadows `sm/md/lg`, z `base 1 / overlay 50 / modal 100 / toast 200`, focus ring `2px / offset 2px`.

### Themes — surfaces/text/borders (canonical shared neutrals = brand-board warm paper / abyss)

| Role token | light | dark |
|---|---|---|
| `--sl-bg-canvas` | `#ECE4D4` | `#070A0D` |
| `--sl-bg-surface` | `#F6F1E6` | `#0F151A` |
| `--sl-bg-surface-raised` | `#FFFFFF` | `#131C23` |
| `--sl-text-primary` | `#15211F` | `#DAE3E4` |
| `--sl-text-secondary` | `#475754` | `#9AA9AD` |
| `--sl-text-muted` | `#6E7B78` | `#6E8088` |
| `--sl-border-subtle` | `rgba(21,33,31,0.09)` | `rgba(218,227,228,0.07)` |
| `--sl-border-default` | `rgba(21,33,31,0.16)` | `rgba(218,227,228,0.13)` |

> **Note — spexr surfaces warm up.** Shared neutrals adopt the brand-board warm paper/abyss. spexr moves from cool zinc (`#fafafa`/`#0c0d10`) to warm paper (`#ECE4D4`/`#070A0D`); introspect is already warm and barely moves. This is the intended brand convergence (shared neutrals, per-product accent). High-contrast theme is exempt.

### Themes — status (shared)

| Role | light | dark |
|---|---|---|
| `--sl-status-success` | `#16a34a` | `#4ade80` |
| `--sl-status-warning` | `#d97706` | `#fbbf24` |
| `--sl-status-danger` | `#dc2626` | `#f87171` |
| `--sl-status-info` | `#0284c7` | `#38bdf8` |

### Accent — default (canonical) + per-product overrides

| Token | Sondalab default (light / dark) | spexr override | introspect override |
|---|---|---|---|
| `--sl-accent-default` | `#B56A0C` / `#F5A83C` (amber) | `#5b6cff` / `#8b96ff` | `#2ee6c0` / `#2ee6c0` |
| `--sl-accent-depth` | `#14606C` / `#35A0B4` (teal) | (spexr keeps single accent) | `#5ad1ff` (cy2) |
| `--sl-focus-ring` | = accent-default | = spexr accent | = introspect accent |

Per-product overrides live in the product's own theme layer (spexr: `themes/*.css` accent block; introspect: its `theme.css`), overriding the `--sl-accent-*` names. spexr's product-specific roles (`agent-*`, `editor-*`, `hljs-*`) stay in spexr as an extension file, unchanged, re-prefixed `--sl-` only if desired (optional, not required).

### Terminal — role vocabulary

| Role | named-ANSI floor | truecolor (COLORTERM=truecolor) | meaning |
|---|---|---|---|
| `prompt` | `bright_yellow` | amber `#F5A83C` | prompt / label |
| `ok` | `green` | `#62D094` | success |
| `warn` | `yellow` | `#F5A83C` | warning |
| `err` | `red` | `#f87171` | error |
| `dim` | `bright_black` | `#6E8088` | secondary/muted |
| `accent` | `cyan` | teal `#35A0B4` | highlight/depth |

`sondalab_palette.py` API mirrors smartctx today: `paint(text, role, *, err=False) -> str`, `supports_truecolor() -> bool`. smartctx migrates its `_SGR`/`_paint` to import from the package; its arrow-key menu keeps its own render loop (only the color calls change).

## Naming migration

`--spexr-*` → `--sl-*` (shared) across spexr; `--bg/--cy/--txt/...` → `--sl-*` across introspect. Theme selector `[data-spexr-theme]` → `[data-sl-theme]`. spexr's Theia theme contribution (`packages/theia-extensions/src/browser/theme/spexr-theme-contribution.ts`) maps Theia color IDs to the new `--sl-*` values.

## Rollout — slices

Each slice is independently reviewable, rollback-friendly, and leaves the suite building.

- **Slice 1 — canonical source + generators + retuned ui-kit.** Add `sondalab.tokens.json` + `gen-css.mjs`/`gen-py.mjs` + `pnpm gen:tokens` in spexr/packages/ui-kit. Rename package to `@sondalab/ui-kit`. Regenerate `tokens.css`/`themes/*.css` with `--sl-*` + warm neutrals. spexr adopts in-place (keeps indigo accent via its override; keeps `--sl-font-code` = its coding mono). Suite still green. *Regression check: spexr builds, renders, all three themes legible.*
- **Slice 2 — introspect adopts the web kit.** introspect adds `@sondalab/ui-kit`, swaps Space Grotesk/IBM Plex → Instrument/Martian, maps old tokens → `--sl-*` (compat shim then removal), keeps cyan accent. *Regression check: introspect dashboard + light/dark parity.*
- **Slice 3 — terminal palette + smartctx.** Publish `sondalab-palette` (PyPI); smartctx migrates `_SGR`/`_paint` → package (roles + truecolor opt-in); daos adopts for its CLI-ish output. *Regression check: smartctx CLI output + arrow-key menu on truecolor and non-truecolor terminals.*
- **Slice 4 — trivial terminal adopters.** introspect-bin TS palette mirror; any remaining daos surfaces. *Regression check: color output present, degrades to named ANSI.*

## Prerequisites

- Claim npm scope `@sondalab` + PyPI project `sondalab-palette` (open follow-up in the decision record). **Interim if unclaimed:** vendor the generated `tokens.css`/`sondalab_palette.py` into each consumer (copy + a `// generated from sondalab.tokens.json` header) until the scope exists; Slice 1 can proceed vendored.

## Testing

- **Generator:** snapshot test — `gen:tokens` output matches committed files; CI fails on drift.
- **Web:** each app builds; visual parity check of all themes (light/dark/high-contrast) after migration; focus-ring contrast ≥ 3:1 preserved.
- **Terminal:** `sondalab_palette` unit tests — role→code mapping, `supports_truecolor()` honors `COLORTERM`, `NO_COLOR` disables. Manual check of smartctx on a truecolor and a 16-color terminal.

## Open questions / follow-ups

- [ ] Canonical source home confirmed as `spexr/packages/ui-kit` (anchor repo). Alternative — a standalone `@sondalab/tokens` package — deferred; revisit if a third web consumer appears.
- [ ] Claim `@sondalab` npm scope + `sondalab-palette` PyPI before Slice 2/3 (or vendor interim).
- [ ] Confirm spexr's editor code font (`--sl-font-code`): keep JetBrains Mono for the editor surface, or move to Martian Mono? (legibility at code sizes — recommend keep a coding mono).
- [ ] Whether to re-prefix spexr's `agent-*`/`editor-*`/`hljs-*` extension tokens to `--sl-` (cosmetic; optional).
