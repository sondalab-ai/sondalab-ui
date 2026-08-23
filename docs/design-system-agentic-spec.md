# Sondalab Design System — Agentic Layer Spec

> **What this file is:** the implementation contract for the *agentic layer* over the Sondalab design system — a portable knowledge core, an executable compliance audit, and Claude Code wrappers that let an AI agent author, migrate, and adopt Sondalab UI without re-deriving the rules each time. It is the machine-and-procedure companion to `design-language.md`: where `design-language.md` states the family-resemblance grammar in prose (the human contract) and `design-system-spec.md` states the token contract (the machine values), this spec defines the tooling that *operationalizes* both so an agent can apply them.
> **Audience:** engineers building the agentic tooling; reviewers checking that the tooling stays faithful to `design-language.md` and does not fork it.
> **Owner:** marcellobarile.
> **Companion files:** `design-language.md` (family-resemblance grammar — the rules this tooling enforces, never restates), `design-system-spec.md` (token contract — the values the audit checks against), `AGENTS.md` (release/packaging rules the agentic assets must honour). The per-workflow usage guide lives in `packages/ui-kit/agent/README.md` (use cases + examples).

## Legend (status vocabulary)

- **Shipped / Delivered** — merged to the surface's production codebase and available to users (for a package: published to its registry).
- **PoC implemented (not delivered)** — built and working, not yet shipped to consumers.
- **Placeholder (not delivered)** — stub or scaffold only.

At spec time everything below is **not delivered**. Slice 1 targets **PoC implemented (not delivered)**: the tooling runs locally against the suite but the portable core is not yet shipped via npm (that is Slice 2).

## Why this exists

The design system already has two contracts an agent could read: `design-language.md` (grammar) and `design-system-spec.md` / `sondalab.tokens.json` (values). What it lacks is a way to *act* on them repeatably:

- **Authoring** a new surface means re-reading 166 lines of grammar and hand-checking every colour against the token set — slow, non-deterministic, and different every run.
- **Migrating** an existing app (introspect, daos) means auditing its palette by eye, which the "compliance test" in `design-language.md` §Decision 1 describes but nobody executes.
- **Adoption** by consumers (other Sondalab apps, in separate repos) has no entry point: the rules live in this repo's docs, unreachable from a consumer that installs `@sondalab/ui-kit` from npm.

This spec adds the missing layer: a **portable knowledge core** (machine-readable data + ordered procedures), an **executable audit** (turns the prose compliance test into a deterministic, CI-able check), and **Claude Code wrappers** (skill + auditor subagent). Single source of truth is the invariant: the tooling *references* `design-language.md` and reads `sondalab.tokens.json` directly; it never restates a rule or hardcodes a token value.

**Authorization note.** This repo's standing `AGENTS.md` and the owner's global preferences discourage project-scoped Claude artifacts (`.claude/`) in shared repos without an explicit request. This spec's `.claude/` assets are explicitly authorized by the request that commissioned this work (make the design system agentic for consumers).

## Architecture — three layers, one source of truth

```
Layer 1  Portable core        packages/ui-kit/agent/     harness-agnostic data + procedures
Layer 2  Executable audit     scripts/sl-audit.mjs       deterministic CSS-decidable verdict
Layer 3  Claude Code wrappers .claude/                   skill (orchestrator) + auditor subagent
```

**Division of labour (hard line — blurring it makes the tool noisy and ignored):**

- The **script** emits only what is decidable from CSS text (colour value-equality, tier consistency, spacing/border literals, font-family resolution, recipe conformance for already-named elements). Mechanical verdict.
- The **subagent** owns everything requiring intent (structural labels *missing*, editorial voice, whether an inversion band is warranted, composition). Judgement.
- The **skill** orchestrates the procedure and holds the human approval gates. Edits are applied by the main thread after approval, never by the auditor.

## Layer 1 — Portable knowledge core (`packages/ui-kit/agent/`)

Sited under `packages/ui-kit/` so Slice 2 can ship it via npm (add entries to `files`/`exports`) without a rename. Contents are **only** what `design-language.md` is not: machine-readable data and ordered procedures. No prose rule is restated.

### `accent-registry.json` — machine source of the accent table

Machine mirror of `design-language.md` §Decision 2. The prose table stays (its "Resolved:" reasoning is genuine prose) and gains one line pointing here.

```json
{
  "default":    { "light": "#B56A0C", "dark": "#F5A83C",
                  "depth": { "light": "#14606C", "dark": "#35A0B4" } },
  "daos":       { "inherits": "default" },
  "spexr":      { "light": "#5b6cff", "dark": "#8b96ff" },
  "introspect": { "single": "#2ee6c0" }
}
```

A parity test (`scripts/accent-registry.test.mjs`, ~20 lines) asserts the JSON product set equals the doc table's product rows. Cheaper than a generator; it is the consistency invariant the owner's `CLAUDE.md` requires.

### `substrate-matrix.json` — machine source of the compliance matrix

The per-substrate matrix from `design-language.md` as a lookup: for each rule id, the level (`R` / `A` / `N/A`) per substrate (`IDE` / `App` / `Page` / `Term`). Drives both the script (which `R` rules are blocking for this substrate) and the subagent (what is `N/A` → silent).

```json
{ "L2-hairline-1px": { "IDE": "A", "App": "R", "Page": "R", "Term": "A" } }
```

### `blessed/<product>.json` — authorized deviations

`design-language.md` itself blesses colours that fail literal value-equality: derived hover/active/subtle off the accent (§Decision 2), locally-derived on-ink status pairs (daos `.artifact .ok`/`.no`, cited as *correct*), and alpha-on-canvas hairlines (daos `--rule`/`--rule-2`). A naive equality check flags all of these on the two Tier-B products we most want to migrate. The allowlist silences them **and** doubles as the record of every intentional deviation — one justification line each.

```json
{
  "substrate": "Page",
  "deviations": [
    { "selectors": ["--rule", "--rule-2"],
      "value": "color-mix alpha-on-canvas hairline",
      "why": "hairline needs alpha; design-language.md L2 hairline structure" },
    { "selectors": [".artifact .ok", ".artifact .no"],
      "value": "light-on-ink status greens/reds",
      "why": "design-language.md §Decision 2 blesses local on-ink status pair" }
  ]
}
```

A deviation is matched by `selectors` (the colour sits under a distinctive selector or property — substring match against the selector + declaration context) **or** by `values` (an exact colour value — for demo data with no distinctive selector, e.g. a JS swatch object; matched by normalized colour equality, not substring). The product's **tier is not stored here** — it lives in `substrate-matrix.json` `tiers` (single source for the audit's tier check); a blessed file carries only `substrate` and `deviations`.

**Direction (not this slice).** Requiring derivations to be written as `color-mix()` / `rgb(from <accent-var> …)` would make them syntactically traceable and shrink the allowlist. That is a `design-language.md` decision; recorded here as direction, not done in Slice 1.

### `workflows/migrate.md` — the migrate procedure

Ordered steps with gates (see the Migrate workflow section below). Slice 1 ships this one; `author.md` and `adopt.md` arrive in later slices and reuse the same core.

### `README.md` — the usage guide

What the core is, how any agent (in any harness, any consumer repo) loads it, and the use-cases-plus-examples guide required by this work. Separate deliverable, described in the "Usage documentation" section.

## Layer 2 — Executable audit (`scripts/sl-audit.mjs`)

The keystone: it turns the prose compliance test into a deterministic, CI-able, harness-agnostic verdict.

**Invocation.** `node scripts/sl-audit.mjs --surface <glob> --product <name> [--substrate IDE|App|Page|Term]`. Substrate defaults to the product's known substrate. Reads `sondalab.tokens.json`, `agent/accent-registry.json`, `agent/substrate-matrix.json`, `agent/blessed/<product>.json`.

**Output.** JSON report + grouped text, findings bucketed by enforceability:

- **R-violation (blocking)** — a required rule broken.
- **A-deviation (needs justification)** — an adapt-level rule diverges; either bless it or fix it.
- **N/A (silent)** — not applicable to this substrate; never printed.

A flat list destroys the tier nuance the whole spec is built around; grouping is mandatory.

**Checks (CSS-text-decidable only):**

1. **Colour value-equality** — every declared hex/rgb resolves to a value in `sondalab.tokens.json`, or the product's accent-registry entry, or the blessed allowlist. The bug-prone core is **colour normalization**: `#FFF`, `#ffffff`, `rgb(255 255 255)`, and `rgb(255,255,255)` must compare equal. Alpha forms (`color-mix`, `/ .5`, 8-digit hex) compare on the base colour or match a blessed entry. Fixtures first (TDD).
2. **Tier consistency** — the selector used (`[data-sl-theme]` Tier A vs `[data-theme]` Tier B) matches the product's declared tier.
3. **Spacing literals** — `padding`/`gap`/`margin` values not off `--sl-space-*`.
4. **Border width > 1px** — L2 hairline.
5. **Font-family** not resolving to the three roles, honouring the mono-substitute exception (introspect IBM Plex Mono, spexr editor font).
6. **Recipe conformance** for elements *already named* `eyebrow`/`tag` (and `.sl-*` variants): mono + uppercase + tracking in the `0.14–0.22em` band. It checks only what exists; it never asserts an element is missing.

**Scope-pressure fallback.** If Slice 1 must shrink, ship checks **1 + 2** only — together they cover the compliance test `design-language.md` §Decision 1 actually states (sample any colour → equals a token/registry value; plus tier). Checks 3–6 are additive.

> **As built (Slice 1):** the script implements checks **1 (colour value-equality) + 2 (tier consistency)** — the documented fallback. Checks 3–6 (spacing literals, border width, font-family, recipe conformance) are **specified but not implemented** (see Open decisions). Colour value-equality supports two blessing mechanisms: `selectors` (suppress under a distinctive selector/property context, matched with word-delimiters so `--rule` does not match `--rule-2`) and `values` (suppress an exact colour value — the honest mechanism for demo data with no distinctive selector, e.g. a JS swatch object; empty selectors/values are rejected, and `scripts/blessed-schema.test.mjs` enforces the blessed-file schema). `resolveAccentEntry` follows chained `inherits` transitively and throws on a cycle.

**Not the script's job (subagent only):** missing structural labels, editorial voice, inversion-band warrant, "one unexpected layout decision" composition.

## Layer 3 — Claude Code wrappers (`.claude/`)

- **`skills/sl-migrate/SKILL.md`** — orchestrates `workflows/migrate.md`: runs the steps as a checklist, holds the gates. Loads the procedure from the portable core; does not duplicate the steps. Trigger: "migrate `<app>` to sondalab DS", `/sl-migrate`.
- **`agents/sl-ds-auditor.md`** — read-only subagent (`Read, Grep, Glob, Bash`). Runs `sl-audit.mjs`, reads `design-language.md` for the intent-level judgement, returns findings grouped R/A/N-A with `file:line`. Applies no edits. Reused by the future author/adopt slices.

`AGENTS.md` gains a pointer to `packages/ui-kit/agent/` (what it is, how consumers use it).

## Migrate workflow (Slice 1)

Migrating a live app's CSS is semi-irreversible → branch first, human approval gate before applying.

0. **Classify substrate.** Determine product + substrate (`IDE`/`App`/`Page`/`Term`). Not a detail: the matrix selects which rules are `R`/`A`/`N/A`. Skipping it proposes, e.g., a sticky translucent header for a Theia panel (matrix: `N/A`).
1. **Baseline audit.** New branch. Run `sl-audit` on the surface → grouped baseline report. No edits yet.
2. **Populate blessed allowlist.** For each A-deviation: bless it (→ `blessed/<product>.json` with justification) or mark it a real defect. **Gate:** user confirms the blessed list.
3. **Propose token mapping.** For each R-violation, map the free-floating value → an `--sl-*` role / accent-registry value. The subagent adds intent-level findings (missing labels, voice). Output = migration plan (mapping + proposed edits) **in chat**. **Gate: stop, wait for an explicit yes. No edits before it.**
4. **Apply.** Auto-accept after approval. Edit per the chosen tier, in small rollback-friendly chunks.
5. **Re-audit + diff.** Run `sl-audit`; compare to baseline. R-violations must reach 0 (or be blessed). Before/after report.
6. **Visual check.** Render the surface across the applicable themes (light/dark/high-contrast). Verify reduced-motion and the dark-invert hairline regression (daos `--rule` alpha invisible in dark-invert blocks) explicitly.

**Slice output:** compliant surface + before/after compliance report + populated `blessed/<product>.json` + CSS diff.

## Calibration (acceptance gate, do before any live migration)

Run the audit in this order; it converts "does the tool work" into an empirical day-one question at ~zero cost:

1. `showcase/index.html` + `packages/ui-kit/components.css` (the reference implementation of the language) → **must pass**. If the audit flags the reference, the audit or the reference is wrong — that is the finding to surface on day one, before proposing edits to any live app.
2. `spexr` (Tier A, delivered) → **measured 22 R-violations** at calibration (Theia host-chrome literals + ad-hoc panel colours), not clean. This is empirical data, not a tool failure: Tier A means spexr consumes the theme layer, not that every literal is a token. These belong to spexr's separate L3 track, not pass-1 migration.
3. `introspect` (App, Tier B) → **70 R-violations** (its colour layer never converged, only its type did; accent-derived tints dominate — the derivation-swamp the blessed step handles). `daos` (Page, Tier B) → **2 R-violations** (`#a6abad`, `#565b5d`); nearly conformant. Feed both into the blessed-allowlist step of a real migration.

Calibration verdict: the reference implementation is clean, the tool runs cross-repo, and the findings on the three live surfaces are plausible and actionable — the audit is trustworthy for checks 1+2.

The blessed allowlist (Layer 1) **blocks** running the audit against daos/introspect for a real migration proposal until it is populated — otherwise the first report shown is mostly false positives.

## Directory layout

```
sondalab-ui/
  packages/ui-kit/agent/
    accent-registry.json
    substrate-matrix.json
    workflows/migrate.md
    blessed/{daos,introspect,spexr}.json      # populated during calibration / migrate
    README.md                                  # usage guide: use cases + examples
  scripts/
    sl-audit.mjs
    sl-audit.test.mjs                           # node:test — colour-norm fixtures, tier, spacing
    accent-registry.test.mjs                    # JSON <-> doc-table parity
    fixtures/audit/*.css
  .claude/
    skills/sl-migrate/SKILL.md
    agents/sl-ds-auditor.md
```

## Testing

- **`sl-audit.test.mjs`** — `node:test` (no new dependency: the repo has no JS test runner and three tests do not justify vitest). Fixtures-first on colour normalization (`#FFF` == `#ffffff` == `rgb(...)`), alpha base-match, tier detection, off-scale spacing.
- **`accent-registry.test.mjs`** — parity between `accent-registry.json` and the `design-language.md` accent table.
- **Calibration = acceptance test** — audit passes on showcase + `components.css`; expected findings on introspect/daos.

## Packaging & release impact

- Slice 1 adds no shipped files: `agent/` and `scripts/` are not in `@sondalab/ui-kit`'s `files`. No version bump (per `AGENTS.md`, docs/tooling-only changes bump neither package).
- Slice 2 ships the portable core: add `agent/**` to ui-kit `files`/`exports` and bump **ui-kit only** (palette-py untouched).
- The audit reads `sondalab.tokens.json` (repo root) directly; when shipped, the core must resolve tokens from the installed `@sondalab/ui-kit/tokens.css` instead — a Slice 2 concern, noted here so the Slice 1 reader signature does not calcify.

## Open decisions (for review)

Decisions deferred deliberately — each needs a human call, not more code:

1. **Spacing check (3) + recipe check (6): build or drop?** Both are high-noise because the design language itself uses off-scale literals in blessed places: the canonical **tag recipe** in `design-language.md` L3 is `padding: 3px 7px` — off the `--sl-space-*` scale. A spacing check would flag the DS's own reference recipe on the reference surface. Building these means committing to a blessing policy for legitimate off-scale literals (recipes, hairline nudges, optical adjustments). Recommendation: **defer** until there is a real consumer demand; checks 1+2 cover the stated compliance test.
2. **Font check (5): drop.** Evaluated at Slice 1 (grep of `font-family` across all four calibrated surfaces): the only literal faces are introspect's IBM Plex Mono and spexr's editor font — both already blessed. Zero new yield, pure false-positive surface. **Not building it.**
3. **Border check (4): low priority.** Focus rings legitimately use the 2px `--sl-focus-ring-width` token, so a naïve "border > 1px" flags them. Needs to exempt `outline`/focus. Small but not free of judgement.
4. **Push `feat/ds-agentic-layer`?** Held — pushing to the (private) remote is outward-facing and was not explicitly authorized. Open a PR when ready; no drift risk while local.
5. **Slice 2 npm-shipping.** Ship the portable core: add `agent/**` to `@sondalab/ui-kit`'s `files`/`exports`, resolve tokens from the installed package rather than the repo root, bump **ui-kit only**.

## Slice plan

- **Slice 1 (this spec).** Core (`accent-registry.json`, `substrate-matrix.json`, `blessed/*`) + `sl-audit.mjs` (checks 1+2 minimum, 3–6 if scope holds) + `workflows/migrate.md` + CC wrappers + calibration. Status target: **PoC implemented (not delivered)**.
- **Slice 2.** Author-new-UI workflow (reuses core + auditor, adds a compliant scaffold). Ship the portable core via npm.
- **Slice 3.** Adopt-single-element workflow (pull one component into an existing app without full migration).
- **Direction.** Move derivations to traceable `color-mix(from <accent-var> …)` form — a `design-language.md` decision, not tooling.
