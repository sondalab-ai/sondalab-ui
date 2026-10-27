# Bauhaus art, pixel declension — design

Date: 2026-10-26 · Status: draft · Owner: marcello.barile
Probe: `/Users/marcello.barile/src/mine/ai-tools/sondalab-ui/lab/art-bauhaus.html` (git-ignored; served by `python3 lab/_serve.py 8891` from the repo root)

## Intent

Add art to the Sondalab family: Bauhaus shapes (circle, square, triangle, quarter-disc, bar) drawn on the kit's pixel cell and shaded with the kit's Bayer dither. The art has three jobs:

- **Ornaments:** marks on section heads, dividers and panel corners.
- **Subtle backgrounds:** a faint field behind copy.
- **Fillers:** compositions that fill empty space, such as an empty list or a blank pane.

The owner's test for "it has a visual meaning" is: **adding it disrupts nothing.** The art belongs to the page. It never competes with the content, never moves, and never changes layout.

A second, related part: a **TUI header** for every Sondalab terminal app. It shows the Sondalab mark, the app name and a one-line description. It is a kit pattern, not a per-app banner.

## References (from the research pass)

- Kolomyjec, *Ode to Gestalt*: a small tile grammar (half-round, quarter-round, petal) on a square grid. https://www.raster.art/artwork/ode-to-gestalt-by-dr-bill-kolomyjec/about
- fffuel *qqquad*: quadtree placement, big shapes where there is room. https://fffuel.co/qqquad/
- leanrada, quarter-circle tiles: one shape only, so the field reads as one thing. https://leanrada.com/wares/dimensions/part-one-generative-art/
- Vera Molnár, *Interruptions* (1968): a regular grid with erased zones. https://infiniteimages.toledomuseum.org/?p=811
- Anni Albers' Bauhaus weaving: a grid of discrete colour cells. https://www.theartstory.org/artist/albers-anni/

No dithered or 1-bit geometric empty-state art was found. The look is not owned by anyone.

## Goals

1. Six static art pieces in `@sondalab/ui-kit`, chosen by the owner from the probe:

   | Piece | Job | Probe cell |
   |---|---|---|
   | ornament | a glyph (quarter-disc + bar) in an eyebrow, and a shape-sequence divider | `ornament` |
   | corner | nested quarter-discs that fade into a panel corner through the Bayer matrix | `corner` |
   | truchet | a quarter-circle tile field, one tone, behind copy | `truchet` |
   | molnar | a field of 3-cell strokes with an erased zone that frames a message | `molnar` |
   | empty-state | circle + square outline + triangle, above an empty-state message | `empty-state` |
   | weave | a 2/2 twill strip used as a divider | `weave` |

2. A TUI header pattern in `docs/tui-patterns.md`, a helper in `sondalab_palette.term`, and a sample in the showcase terminal section.
3. Adoption in every consumer: sondalab.eu, spexr, introspect (web), and the TUI apps claude-loadout (`cld`), MxM and roboemot's installer.

## Non-goals

- **The hero-field** (large faint shapes behind display type). The owner rejected it.
- Motion of any kind. No hover, no entrance, no ambient animation.
- Bauhaus primaries (red, yellow, blue). The pieces use the accent and the neutral roles only.
- Illustrations with meaning per state (a different picture for "error" and "empty"). One composition serves every empty state.
- daos as a separate consumer. It does not use the kit. Its public page lives in sondalab.eu and is covered there.

## Anti-goals

The work fails, even if it renders, when any of these is true:

- Body text next to or over a piece drops below 4.5:1 against the darkest cell under it.
- A piece changes the size or position of the content it decorates.
- A piece reads as a broken effect: half cells, blurred cells, or a cell grid that does not match the 3px cell of the dither hover.
- A piece carries a colour literal. The colour contract (`sl-audit`) only reads CSS, so a literal hidden in a data URI must also fail a test.
- A TUI header appears in machine output (piped stdout, `--json`, `--plain`, accessible mode).

## Constraints

- **Cell and dither:** every piece is drawn on `CELL_PX` (3px) from `packages/ui-kit/dither-core.js` and shades with its `BAYER` matrix. The pieces and the dither hover share one grid.
- **Colour:** shapes are masks. The paint comes from role variables (`--slc-*`, `--sl-accent*`). This makes every piece follow every theme, including `.sl-invert` bands and high contrast. In `.sl-invert`, rebind on `> *`, not on the element itself (see the inversion-band memory: a rebinding on the same element is a custom-property cycle).
- **Static and decorative:** `aria-hidden` or pseudo-elements, `pointer-events: none`, no motion. Reduced motion needs no special case.
- **Forced colours / high contrast:** the pieces paint nothing under `forced-colors: active`. Under the high-contrast theme they paint nothing, unless a measurement shows they keep the theme's contrast floors (builder decides, with the measurement in the PR).
- **Release discipline:** one integration branch, one slice PR per slice, full CI on each PR, one merge to `main`. The merge publishes ui-kit and palette-py.

## Decisions (owner)

- The six pieces above; the hero-field is out.
- Accent + neutrals only, static, decorative.
- Adopt in the consumer apps in the same epic.
- The TUI header is a kit pattern. It shows the Sondalab mark, the app name and a brief description. It appears **on every interactive launch**. One-shot subcommands that print a result and exit get a tiny version (see "Two header sizes" below).

## Decisions (agent's calls, open to the owner)

- **Delivery is CSS masks, no JavaScript.** Each shape is a pixel-snapped SVG, generated at build time, inlined as a `data:` URI in `mask-image`. A generator script (`scripts/gen-art.mjs`) produces the masks from `dither-core.js`. A test fails when the committed CSS differs from the generator output.
- **The pieces live in `components.css`, as opt-in classes.** The precedent is prism's opt-in ornaments (`.sl-haze`, tested in `scripts/prism-ornaments.test.mjs`). A separate `art.css` would need a new import in every consumer and a new wrapper and exports entry in spexr. A stylesheet nothing imports has shipped broken before.
- **Class names** bind to the kit's existing elements where one exists:
  - `.sl-eyebrow--mark` (ornament glyph before the eyebrow text)
  - `.sl-rule--shapes` (shape-sequence divider) and `.sl-rule--weave` (weave strip)
  - `.sl-art-corner` (on any positioned panel or `.sl-card`)
  - `.sl-art-field` (truchet field behind the element's content)
  - `.sl-empty--void` (molnar field around an `.sl-empty`) and `.sl-empty--shapes` (composition above `.sl-empty__title`)
  
  Every name goes into `packages/ui-kit/agent/catalog.json` and `catalog.md`, and into sondalab.eu's `kit-names` gate.
- **TUI header shape:**
  ```
  ▗▄▖ ▌  sonda/lab
  ▐█▌ ▌  cld 0.9.0
  ▝▀▘ ●  Manage Claude Code loadouts.
  ```
  The glyph above is illustrative only; the builder draws the mark. It is 3 lines high, at most 6 columns wide, with one accent shape. Every glyph is one column wide (the existing width rule). The text column carries `sonda/lab` (slash in `prompt`), the app name and version, and the description in `dim`.
  - Fallbacks: ASCII mode → the current one-line lockup `sonda/lab <app> <version>`. `NO_COLOR` → the same shapes, no colour. Narrower than the header → the one-line lockup.
  - Never in machine output: piped stdout, `--json`, `--plain`, accessible mode, `TERM=dumb`. These keep the current one-line lockup or nothing.
  - API: `term.header(name, version, description, *, compact=False, machine=False, env=None, isatty=None) -> str`. The `env=None` default follows palette 0.7.1 (the `env=os.environ` default leaked secrets through `help()`).
- **Spec amendment:** `docs/tui-patterns.md:107` currently says "No ASCII-art banner, on start or on `--version`." The amendment allows exactly this header, on interactive launch only. `--version` stays one line. The amended rule keeps "pixel graphics are for data only" for everything else.
- **Versions:** ui-kit 0.40.0 → 0.41.0 (minor, additive). palette-py 0.7.1 → 0.8.0 (minor, new helper).

## Consumer sites (from the recon pass)

### sondalab.eu (`sondalab-site`, kit ^0.40.0, CI: check, test, kit-names, audit, build)

- truchet: the empty backdrop slots `.products__bed` (`src/components/ProductsIndex.astro:27`) and `.method__bed` (`src/components/Method.astro:29`).
- ornament: the home section heads (`Thesis.astro:29`, `ProductsIndex.astro:29`, `Method.astro:32`, `Contact.astro:7`).
- weave / shapes rule: `.interlude` (`src/components/Interlude.astro:40`) and `.article-prose hr` (`src/styles/site.css:405`).
- corner: `.triptych > li.panel` (`Thesis.astro:45`), the daos page cards (`src/pages/daos.astro:148`, `:248`).
- molnar: the blog's "no transmission" line (`src/pages/blog/[...page].astro:146`).
- empty-state: a new "no matches" message on the design-system filter (`src/pages/design-system.astro:359`).

### spexr (kit ^0.40.0 on the remote, through `@spexr/ui-kit` wrappers, CI: lint, typecheck; e2e is separate)

- Bump to ^0.41.0. Pieces live in `components.css`, so no new wrapper file is needed.
- empty-state: the `sl-empty` blocks (`views/memory-widget.tsx:326`, `views/experts-widget.tsx:228`, `views/spec-widget.tsx:456`, `darkfactory/schedule/schedule-sidebar.tsx:320`) and `search/smart-search-widget.tsx:355`.
- molnar: the darkfactory wall (`darkfactory/darkfactory-wall-widget.tsx:1584`, `:1602`) and the agent pane (`agent-pane/agent-pane-view.tsx:76`).
- ornament: the shared panel head (`views/panel-head.tsx:14`), which covers every panel.
- corner: `.spexr-welcome-card` (`views/welcome-splash.tsx:230`).
- weave: between the welcome cards and the workflow section (`views/welcome-splash.tsx:256`).
- Paths are relative to `packages/theia-extensions/src/browser/`. Local tests are not run (E2E crashed the machine before). Build, lint and typecheck only; CI runs tests. A packaged-app check stays with the owner.

### introspect (`web/`, kit ^0.40.0 on the remote, no CI)

- Bump to ^0.41.0.
- empty-state: the shared `.ld-empty` (`web/src/components/ListDetail.tsx:88`), used by nine pages.
- molnar: the blank detail pane (`ListDetail.tsx:119`, renders `null` today).
- weave: between the `.ld-section` blocks (`web/src/pages/HooksPermsEnvPage.tsx:33`).
- Local `npm test` and `npm run build` are the only gate.

### TUI apps (palette-py ≥0.8)

- claude-loadout: `src/ccloadout/cli.py`.
- MxM: `src/mxm/agent/tui.py`.
- roboemot: `packages/roboemot-core/src/roboemot/install/ui.py`.

## Resolved after the builder check (agent's calls unless marked)

- **Size rules.** truchet, weave and the stroke field of molnar are repeating tiles (`mask-repeat: repeat`). The corner is one anchored tile (`mask-position: top right; mask-repeat: no-repeat`), so it fits any panel. The molnar erased zone is a second mask layer, pre-dithered, in three size steps (S, M, L) chosen by a container query on the `.sl-empty` box. The message must fit inside the largest step; longer copy gets the L step and may touch strokes at the edge. That is acceptable.
- **Payload budget:** the masks add at most 32 KB to `components.css`, uncompressed. A test enforces it. It was 24 KB in 0.41; it was raised to 32 KB in 0.42 for the variants (the eyebrow glyphs, the fields and the poster's primitives), when the block reached 24445 bytes before the poster.
- **Device pixel ratio:** the masks use `shape-rendering="crispEdges"`. The acceptance check is DPR 1 and DPR 2 in Chrome, with no half cells. Fractional ratios are not gated.
- **Contrast basis:** the test takes each piece's paint colour (its role, at its tone, composited on `--slc-canvas` and on `--slc-surface`) as a solid cell, in both themes. Body text (`--slc-text-secondary`) must reach 4.5:1 against that cell. Coverage density does not soften the test. The aurora showcase is a visual check only.
- **Tones (starting points from the probe):** truchet at 7% ink, molnar strokes at 30% ink, corner at 22% ink fading to 0, rules at 50% ink fading. The builder may lower them. Raising them needs the contrast test to pass.
- **High contrast and forced colours:** the pieces paint nothing in both. This is the decision, not a fallback.
- **`.sl-eyebrow--mark`** adds the glyph as `::before` inside the eyebrow, so the eyebrow text shifts right by the glyph and the gap. The "no layout change" anti-goal applies to the content a piece decorates, not to the eyebrow that carries the mark.
- **`kit-names` gate** (sondalab.eu, `scripts/kit-names-gate.mjs`): it fails on retired names. The site slice runs after the kit release, so the new names exist on npm when its CI runs.
- **Consumer checkouts** are siblings of this repo (`../sondalab-site`, `../spexr`, `../introspect`, `../claude-loadout`, `../MxM`, `../roboemot`). The local `main` of spexr and introspect is behind its remote: spexr PR #120 (kit 0.40.0) is merged, and introspect PR #16 is merged. Each consumer slice pulls first. The file:line references above are a snapshot from 2026-10-26 and must be re-checked after the pull. The 0.37–0.40 breaking changes are already absorbed by those merged bump PRs.
- **TUI adoption** ships in this epic: one PR per app (bump palette-py to `>=0.8`, call `term.header` at the launch point). These PRs open after palette-py 0.8.0 is on PyPI. The owner approves their merges.
- **Two header sizes (owner):** the full 3-line header appears when an app starts an interactive session (a TUI screen, a prompt loop, an installer), on bare launch, and in `--help`. A one-shot subcommand that prints a result and exits (`cld list`) gets a **compact header**: one line, a 2-column mark (one accent shape) followed by `sonda/lab <app>` in `dim`, then a blank line. The API grows `compact: bool = False`. The same machine-output rules apply to both sizes.
- **TUI header stream and flags:** the header goes to stdout. `term.header` takes `machine: bool = False`; the app passes `True` for `--json`, `--plain` and accessible mode. The helper also returns the one-line lockup when stdout is not a TTY, when `TERM=dumb`, or when accessible mode is on through the environment.

## Left to the builder

- The exact cell drawings: glyph size, rule rhythm, tile size, stroke density, the composition's proportions. Start from the probe; the probe's numbers are not binding.
- How the molnar erased zone gets a cell-snapped edge without JavaScript (for example, a pre-dithered erase mask per size step). A stroke cut in half is an anti-goal.
- The contrast test mechanism. It must compute from token values in both themes, not from a screenshot.
- The TUI mark's drawing.

## Verification

- Kit: the full `npm test` suite, `sl-audit`, the generator-drift test, a contrast test per piece in both themes, and a showcase section with each piece next to real text over the aurora (not over flat ground: the showcase hid glass defects that way before).
- Visual check in Chrome, both themes, at 1:1 and at 2× zoom, for cell alignment.
- Consumers: each repo's own CI or local gate, as listed above.
- The owner tests at the end, on the integration branch.

## Size and cost estimate

Seven slices on one integration branch (`integration/bauhaus-art`), each a short PR into it:

| Slice | Repo | Content |
|---|---|---|
| A1 | sondalab-ui | `scripts/gen-art.mjs`, the six masks, the classes in `components.css`, catalog entries, contrast, drift and payload tests |
| A2 | sondalab-ui | showcase section (each piece beside real text, over the aurora), design-language entry |
| A3 | sondalab-ui | TUI header: `docs/tui-patterns.md` amendment, `term.header` in palette-py, terminal catalog spans, showcase sample |
| — | sondalab-ui | integration merge to `main`: publishes ui-kit 0.41.0 and palette-py 0.8.0 |
| A4 | sondalab-site | bump to ^0.41.0, place the pieces, register names in `kit-names` |
| A5 | spexr | bump to ^0.41.0, place the pieces |
| A6 | introspect | bump to ^0.41.0, place the pieces |
| A7 | claude-loadout, MxM, roboemot | bump palette-py to `>=0.8`, call `term.header` (one PR per repo) |

Agents: one Opus author and one Sonnet reviewer per slice, so about 14 agents. A3 can run beside A1–A2. A4–A7 run in parallel after the release. The size is close to the pixel epic (14 agents).
