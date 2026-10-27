# Bauhaus art, pixel declension → ui-kit 0.41.0, palette-py 0.8.0

> **For agentic workers:** execute slice by slice with superpowers:subagent-driven-development. One Opus author and one Sonnet reviewer per slice. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ship six static Bauhaus pixel-art pieces and a TUI header pattern in the kit, then place them in every consumer.

**Architecture:** a build-time generator draws each piece on the dither cell grid and writes it into `components.css` as an SVG `data:` URI used in `mask-image`. The paint comes from role variables, so no colour lives in the art. The TUI header is a pure string builder in `sondalab_palette.term`.

**Tech stack:** Node ESM scripts and `node --test`; CSS masks and container queries; Python 3 stdlib; Astro (site), Theia/React (spexr), React + Vite (introspect).

**Spec:** `docs/specs/2026-10-26-bauhaus-art-design.md` (approved by the owner on 2026-10-26). Read it with this plan. Probe: `/Users/marcello.barile/src/mine/ai-tools/sondalab-ui/lab/art-bauhaus.html` (git-ignored, so it exists only in the main checkout; worktrees read it by this absolute path).

## Global constraints

- Cell: `CELL_PX` (3) and `BAYER` / `bayerAt` from `packages/ui-kit/dither-core.js`. No other grid.
- Colour: masks only. Paint from `--slc-*` and `--sl-accent*`. No colour literal anywhere in the art, including inside a data URI.
- Static: no animation, no transition, `pointer-events: none`, decorative (`aria-hidden` or pseudo-element).
- Contrast: `--slc-text-secondary` ≥ 4.5:1 against a solid cell of each piece's paint, composited on `--slc-canvas` and on `--slc-surface`, light and dark.
- Payload: the masks add ≤ 24 KB (uncompressed) to `components.css`.
- High contrast theme and `forced-colors: active`: every piece paints nothing.
- No layout change to the decorated content.
- Tones (upper bounds unless the contrast test passes higher): truchet 7% ink, molnar 30% ink, corner 22% ink fading to 0, rules 50% ink fading.
- Versions: ui-kit 0.40.0 → 0.41.0; palette-py 0.7.1 → 0.8.0.
- One integration branch `integration/bauhaus-art`, one PR per slice into it, full CI on each PR, one merge to `main`. No stacked PRs.
- Every author works in a git worktree (peer sessions exist; the `roboemot-e4` session works in the roboemot repo).

## Review focus

The inputs the spec implies but no slice test exercises by default. Each line has a test in the owning slice.

1. **A piece inside `.sl-invert`.** Expect it to paint with the band's rebound roles, not the page roles. Test in A1: a rule for each piece reads only role vars that `.sl-invert > *` rebinds.
2. **A long empty-state message in a small panel.** Expect the L void step and no stroke drawn over the text box. Test in A1: the container-query thresholds match the S/M/L void sizes in the generator.
3. **A non-TTY run, `NO_COLOR`, `TERM=dumb`, ASCII locale and a 40-column terminal.** Expect the one-line lockup or no colour, never a broken 3-line block. Tests in A3.
4. **A header wider than the description allows.** Expect the description cut at the width cap (100 columns), never wrapped under the mark. Test in A3.
5. **A consumer that already styles `.sl-empty` or `.sl-rule` locally.** Expect the opt-in modifier to add only the mask layer. Test in A1: the modifier rules set no `padding`, `margin`, `display`, `width` or `height`.

---

## A1 · Generator, masks, classes (sondalab-ui)

**Files:**
- Create: `scripts/gen-art.mjs`, `scripts/art.test.mjs`
- Modify: `packages/ui-kit/components.css` (one generated block between `/* @gen-art:start */` and `/* @gen-art:end */`, plus hand-written rules beside `.sl-eyebrow` :445, `.sl-rule` :1091, `.sl-empty` :2413, and the high-contrast list :3142)
- Modify: `packages/ui-kit/agent/catalog.json`, `packages/ui-kit/agent/catalog.md`, `package.json` (script `gen:art`)
- Follow the "seven places a new element needs" list in `docs/plans/2026-09-14-base-element-set.md`.

**Interfaces:**
- Produces: `node scripts/gen-art.mjs [--check]`. Without a flag it rewrites the generated block. With `--check` it exits 1 when the block differs.
- Produces the classes `.sl-eyebrow--mark`, `.sl-rule--shapes`, `.sl-rule--weave`, `.sl-art-corner`, `.sl-art-field`, `.sl-empty--void`, `.sl-empty--shapes`.
- Produces custom properties per piece: `--sl-art-<piece>` (the mask URI) and `--_sl-art-paint` (the paint colour, from roles).

- [ ] **Step 1: write `scripts/art.test.mjs` with these failing tests**
  - `gen-art --check` exits 0.
  - Every mask path has integer coordinates that are multiples of 1 cell, and the SVG has `shape-rendering="crispEdges"`.
  - No mask contains `fill="#`, `rgb(`, `hsl(` or `oklch(` (mask fill is `black` or `white` only).
  - The generated block is ≤ 24 576 bytes.
  - For each piece × {light, dark} × {canvas, surface}: contrast(`--slc-text-secondary`, paint composited on ground) ≥ 4.5. Read token values through the existing colour helpers (`scripts/lib`, `packages/ui-kit/colour.js`).
  - Each modifier rule sets no `padding`, `margin`, `display`, `width` or `height` on the host (review focus 5).
  - Each piece paints `none` under `[data-sl-theme="high-contrast"]` and `@media (forced-colors: active)`.
  - Each piece uses `pointer-events: none` and declares no `animation` or `transition`.
  - Each piece's paint reads only role vars that `.sl-invert > *` rebinds (review focus 1).
  - The `.sl-empty--void` container-query thresholds equal the generator's S/M/L void sizes (review focus 2).
  - The catalog lists every new class.
- [ ] **Step 2:** run `node --test scripts/art.test.mjs`. Expect failures.
- [ ] **Step 3: write `scripts/gen-art.mjs`.** Port the shapes and tones from `/Users/marcello.barile/src/mine/ai-tools/sondalab-ui/lab/art-bauhaus.html` (`R.ornament`, `R.corner`, `R.truchet`, `R.molnar`, `R["empty-state"]`, `R.weave`). Emit run-length rects per row, not one rect per cell, to stay under the payload cap. Truchet, weave and the molnar stroke field are repeating tiles. The corner is one anchored tile. The molnar void is a second mask layer in three pre-dithered sizes.
- [ ] **Step 4: write the hand rules.** Each piece paints through a pseudo-element with `background: var(--_sl-art-paint)` and `mask: var(--sl-art-<piece>)`. Hosts that are not positioned get `position: relative` only when the class is on them, and `isolation: isolate`, following `.sl-haze` (`scripts/prism-ornaments.test.mjs`).
- [ ] **Step 5:** run `npm run gen:art`, `npm test` and `npm run audit -- --surface packages/ui-kit/components.css --product default`. Expect all to pass.
- [ ] **Step 6:** check in Chrome at DPR 1 and 2, both themes: no half cells, and the cells line up with a hovered `.sl-btn` dither. Serve with `python3 lab/_serve.py 8891` from the repo root.
- [ ] **Step 7:** commit `feat(ui-kit): Bauhaus pixel art pieces (A1)` and open a PR into `integration/bauhaus-art`.

## A2 · Showcase and design language (sondalab-ui)

**Files:**
- Modify: `showcase/index.html` (a new "Art" section), `docs/design-language.md` (a short section: what the pieces are for, the "disrupts nothing" test, the hero-field rejection), then `npm run gen:agent-docs`.
- Modify: `scripts/showcase-screens.test.mjs` or `scripts/catalog-audit.test.mjs`, whichever already pins showcase coverage.

**Interfaces:** consumes the A1 classes.

- [ ] **Step 1:** add a failing coverage test: every A1 class appears in `showcase/index.html`.
- [ ] **Step 2:** build the section. Each piece sits beside real text, once on flat ground and once over the aurora. A memory note records that flat ground hid a glass defect before.
- [ ] **Step 3:** run `npm test`. Expect a pass.
- [ ] **Step 4:** check in Chrome: dark, light, high contrast (pieces gone), and `.sl-invert`.
- [ ] **Step 5:** commit `docs(ui-kit): Art showcase section (A2)` and open a PR.

## A3 · TUI header (sondalab-ui)

**Files:**
- Modify: `docs/tui-patterns.md` (amend :107; add a "Header" pattern under "Patterns (line output)" with the full and compact examples), `sondalab.tokens.json` `tui` section (the mark cells, the width cap), then `npm run gen:tokens`.
- Modify: `packages/palette-py/sondalab_palette/term.py`, its tests in `packages/palette-py/tests/`, and `packages/palette-py/pyproject.toml` (0.8.0).
- Modify: `packages/ui-kit/agent/catalog.md` Term section and showcase §06 (one header sample); `scripts/tui-spec.test.mjs`, `scripts/term-catalog.test.mjs`.

**Interfaces:**
- Produces `term.header(name: str, version: str, description: str, *, compact: bool = False, machine: bool = False, env: Optional[Mapping[str, str]] = None, isatty: Optional[bool] = None) -> str`. The result ends with a newline. The empty string means "print nothing".
- Behaviour:
  - `machine=True` → `""`.
  - Not a TTY (`isatty` is False, or `sys.stdout.isatty()` when `isatty` is None), `TERM=dumb`, or accessible mode → the one-line lockup `sonda/lab <name> <version>`.
  - ASCII mode → the one-line lockup.
  - Width < the mark width + 2 + the longest text line → the one-line lockup.
  - `compact=True` → one line: the 2-column mark, a space, `sonda/lab <name>` in `dim`, then a blank line.
  - Otherwise the 3-line header: mark on the left (≤ 6 columns, one accent shape), text on the right: `sonda/lab` (slash in `prompt`), `<name> <version>`, `<description>` in `dim`, cut to the 100-column cap.
  - `NO_COLOR` → the same shapes without SGR codes. Colour follows `color_mode()`.
- Default `env=None` (palette 0.7.1 rule: never `env=os.environ`).

- [ ] **Step 1:** write failing pytest cases, one per behaviour line above, plus these (review focus 3 and 4):
  - every output line has a display width ≤ 100;
  - every glyph is one column wide;
  - `help(term.header)` prints no environment value.
- [ ] **Step 2:** run `python -m pytest packages/palette-py -q`. Expect failures.
- [ ] **Step 3:** implement `header` in `term.py`, reusing `color_mode`, `ascii_mode`, `accessible` and the glyph roles.
- [ ] **Step 4:** run pytest, `npm run gen:tokens` and `npm test`. Expect a pass, with no drift.
- [ ] **Step 5:** commit `feat(palette): term.header, the TUI header pattern (A3, palette 0.8.0)` and open a PR.

## Release (sondalab-ui)

- [ ] Bump `packages/ui-kit/package.json` to 0.41.0 and add the README release note.
- [ ] Open the integration PR `integration/bauhaus-art` → `main`. Wait for CI to register before you watch it.
- [ ] The owner tests on the integration branch, then merges.
- [ ] Verify with `npm view @sondalab/ui-kit version` = 0.41.0 and on PyPI `sondalab-palette` = 0.8.0 before you start A4–A7.

## A4 · sondalab.eu (`../sondalab-site`)

- [ ] Pull `main`, create a worktree, bump `@sondalab/ui-kit` to `^0.41.0`.
- [ ] Place the pieces at the spec's sondalab.eu sites, re-checked after the pull.
- [ ] Register the new names in `scripts/kit-names-gate.mjs` if it keeps an allow list.
- [ ] Run `npm run check`, `npm test`, `npm run kit-names`, `npm run audit` and `npm run build`. Check in Chrome, both themes.
- [ ] Open the PR; CI must pass.

## A5 · spexr (`../spexr`)

- [ ] Pull `main`, create a worktree, bump `packages/ui-kit/package.json` to `^0.41.0`.
- [ ] Place the pieces at the spec's spexr sites, re-checked after the pull. The shared `views/panel-head.tsx` takes `.sl-eyebrow--mark`.
- [ ] Run build, lint and typecheck only. Do not run tests locally. CI runs them.
- [ ] Open the PR. The packaged-app check stays with the owner.

## A6 · introspect (`../introspect`)

- [ ] Pull `main`, create a worktree, bump `web/package.json` to `^0.41.0`.
- [ ] Place the pieces at the spec's introspect sites. The blank detail pane (`ListDetail.tsx`) renders an `.sl-empty.sl-empty--void` instead of `null`.
- [ ] Run `npm test` and `npm run build` in `web/`. Check in Chrome, both themes.
- [ ] Open the PR.

## A7 · TUI apps (`../claude-loadout`, `../MxM`, `../roboemot`)

One PR per repo:
- [ ] Bump `sondalab-palette` to `>=0.8`.
- [ ] Call `term.header` at the interactive launch point: full on interactive sessions, bare launch and `--help`; `compact=True` on one-shot subcommands; `machine=True` for `--json`, `--plain` and accessible mode.
- [ ] Add one test per repo: the header is absent with `--json` and when stdout is not a TTY.
- [ ] Run each repo's own test command. In roboemot, work in a worktree: a peer session works there.

## Cost and check-ins

- 7 slices, about 14 agents (Opus author + Sonnet reviewer per slice), about 10 agent-hours.
- A1 and A3 run in parallel. A2 follows A1. A4–A7 run in parallel after the release.
- After each phase, report the agent count and what remains. Stop and ask if a phase runs more than 2× its estimate.
