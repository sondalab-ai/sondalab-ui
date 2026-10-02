# Sondalab DS — Agentic Core

> **What this file is:** the usage guide for the Sondalab design-system *agentic layer* — how an AI agent (in any harness, in this repo or a consumer repo) loads this core and runs the author / migrate / adopt workflows against the shared design system.
> **Audience:** anyone pointing an agent at a Sondalab surface — the DS maintainer, and engineers on consumer apps (spexr, introspect, daos, and future products) who want their UI to read as Sondalab without re-deriving the grammar.
> **Status:** shipped in `@sondalab/ui-kit` (v0.3.0+). The migrate / author / adopt workflows, the component catalog, and the `sl-audit` bin all ship in the package; a consumer resolves them from `node_modules/@sondalab/ui-kit/agent/`.
> **Companion files:** `./design-language.md` (the grammar this tooling enforces — never restated here; shipped alongside). The tooling contract and the token spec live in the source repo: `docs/design-system-agentic-spec.md` and `docs/design-system-spec.md` at https://github.com/sondalab-ai/sondalab-ui.

## What this core is

The design system has always had the *rules* (`design-language.md`) and the *values* (`sondalab.tokens.json`). This core adds the missing third thing: a way for an agent to **act** on them repeatably. It is deliberately thin — it holds only what the prose docs are not:

| File | What it is |
|---|---|
| `accent-registry.json` | Machine mirror of the per-product accent table (`design-language.md` §Decision 2). |
| `substrate-matrix.json` | The per-substrate compliance matrix (IDE/App/Page/Term → R/A/N-A) as a lookup. |
| `blessed/<product>.json` | Per-product allowlist of authorized deviations, one justification each. |
| `workflows/migrate.md` | The ordered migrate procedure with human gates. |
| `workflows/author.md` | The ordered author procedure (greenfield), built on the catalog. |
| `workflows/adopt.md` | The ordered adopt procedure (one component into an existing app). |
| `catalog.md` + `catalog.json` | Copy-paste component catalog (primitives, opt-in effects, and signature patterns) with markup, role-vars, and substrate; its machine index. Effects are a separate opt-in import (`effects.css`, plus `effects.js` for Tier 1) — not part of `components.css`. Snippets are audited clean. |
| `HANDOFF.md` | What the audit does **not** check mechanically, and how to judge those cases (deferred spacing/border/recipe checks). Read before a job. |

Everything else — the actual rules, why they exist, the compliance philosophy — stays in `design-language.md`. This core **references** it; it never forks it.

The verdict engine is `sl-audit` (`agent/sl-audit.mjs`, exposed as the `sl-audit` bin). It reads this core plus the shipped token CSS (`../tokens.css`, `../themes/light.css`, `../themes/dark.css`, `../themes/high-contrast.css` — not `themes/products.css`, which would allow every product's neutrals for every product) and the audited product's own entry in `../neutrals.json` (since 0.29), and reports what is decidable from CSS text. What requires human/agent judgement (missing structural labels, editorial voice, layout composition) is out of the script's scope by design.

**What the script checks today:** colour value-equality, theme-selector tier consistency, accent-step derivation (check 7, mechanical since v0.7.0) and the effects runtime (check 8 — `sl-fx-*` classes used with no `mount()` call anywhere in the surface). Spacing-off-scale, border width, font-family, and eyebrow/tag recipe conformance are *specified* (see the agentic spec) but **not implemented in the script**; they are judgement-level and belong to the `sl-ds-auditor` subagent, not the audit script. `HANDOFF.md` is the authority on that split. A colour finding can be silenced two ways in `blessed/<product>.json`: `selectors` (a distinctive selector/property the colour sits under) or `values` (an exact colour value — for demo data with no distinctive selector).

## The three workflows

| Workflow | Job | For whom | Status |
|---|---|---|---|
| **Migrate** | Move an existing app's UI onto the DS: audit → map values to tokens → pick tier → apply L1–L5. | An app with its own palette adopting the DS wholesale (introspect, daos). | Slice 1 |
| **Author** | Scaffold a new surface/element DS-compliant from the first line. | Greenfield screens or components. | Slice 2 — catalog + `workflows/author.md` + `sl-author` skill landed |
| **Adopt** | Pull one signature component (eyebrow, tag, inversion band) into an app without a full migration. | Consumers wanting a taste of the family look. | Slice 3 — `workflows/adopt.md` + `sl-adopt` skill landed |

All three share the same core and the same read-only auditor. Migrate is the deepest; author and adopt are subsets of its machinery.

## How an agent loads the core

**In Claude Code (this repo).** The wrappers do it for you:

- Say *"migrate `<app>` to the Sondalab DS"* or run `/sl-migrate` → the `sl-migrate` skill drives `workflows/migrate.md` and holds the gates.
- Say *"build a new `<screen>` in the Sondalab DS"* or run `/sl-author` → the `sl-author` skill drives `workflows/author.md` and builds from `catalog.md`.
- Say *"add a Sondalab `<component>` to this app"* or run `/sl-adopt` → the `sl-adopt` skill drives `workflows/adopt.md` (one component, scoped to the touched file).
- The `sl-ds-auditor` subagent runs the audit and reads `design-language.md` for the judgement-level findings, returning them grouped by severity with `file:line`.

**In any other harness / a consumer repo.** `npm i @sondalab/ui-kit`, then point the agent at the installed core and give it the relevant workflow as its instructions:

1. `node_modules/@sondalab/ui-kit/agent/` (this core — registry, matrix, blessed, catalog, workflows),
2. `node_modules/@sondalab/ui-kit/agent/design-language.md` (the grammar),
3. `node_modules/@sondalab/ui-kit/tokens.css` + `themes/light.css`, `themes/dark.css`, `themes/high-contrast.css` + `neutrals.json` (the values the audit checks against; `neutrals.json` → `products.<id>` holds each product's tinted neutrals as hex).

Then run the audit via the shipped bin:

```sh
npx sl-audit --surface "web/src/**/*.css" --product introspect --substrate App
```

Surface globs resolve against your current working directory; the audit resolves the token allowlist from the installed package.

## Reading an audit report

Findings are bucketed by enforceability — a flat list would destroy the tier nuance the DS is built on:

- **R-violation (blocking)** — a required rule is broken. Must reach zero (or be blessed) before a migration is done.
- **A-deviation (needs justification)** — an adapt-level rule diverges. Either bless it (record why in `blessed/<product>.json`) or fix it.
- **N/A** — not applicable to this substrate. Never printed.

Example (illustrative):

```
introspect  (App, Tier B)   —  sl-audit

R-violation (2)
  web/src/theme.css:44   colour #3aa0ff does not resolve to a token, accent, or blessed value
  web/src/theme.css:12   selector [data-sl-theme] but product declared Tier B ([data-theme])

A-deviation (1)
  web/src/theme.css:88   #1e2a24 on-ink status green — bless or fix (design-language.md §Decision 2)

N/A: 6 rules skipped for substrate App
```

## Use cases

### 1 — Maintainer migrates a live app (Migrate, Slice 1)

> *"Migrate daos to the Sondalab DS."*

The agent classifies daos as **Page / Tier B**, runs a **baseline audit**, and separates real defects from blessed deviations. daos's `--rule`/`--rule-2` (alpha-on-canvas hairlines) and its `.artifact .ok`/`.no` (on-ink status pairs) are *authorized* by `design-language.md` — they go into `blessed/daos.json`, not the defect list. The remaining R-violations become a **token-mapping plan**, presented in chat. **Nothing is edited until you say yes.** After approval the agent applies the mapping in small chunks, re-audits (R-violations → 0), and does a visual pass across light/dark/high-contrast — including the dark-invert hairline regression that alpha-on-canvas rules are prone to.

### 2 — Consumer app adopts one component (Adopt, Slice 3)

> *"Add a Sondalab eyebrow + tag to our settings header, we're not migrating everything yet."*

The agent pulls the canonical eyebrow/tag recipe from `design-language.md` L3, binds it to the consumer's local colour vars (Tier B — values must still resolve to Sondalab), and runs the audit scoped to the touched file only. No full migration; the rest of the app is untouched.

### 3 — Greenfield element, compliant from the start (Author, Slice 2)

> *"Scaffold a new empty-state panel for introspect."*

The agent starts from the substrate (App), applies the required rules for that column of the matrix (mono micro labels and sentence-case controls, hairline structure, spacing off `--sl-space-*`, one accent hue), and the audit passes on first run because compliance was built in, not retrofitted.

### 4 — CI guard (any slice)

The audit is deterministic, so it runs headless:

```sh
npx sl-audit --surface "web/src/**/*.css" --product introspect --substrate App --fail-on R
```

A non-zero exit on any unblessed R-violation keeps a merged surface from drifting off the DS — the prose "compliance test" in `design-language.md`, now enforceable.

## Extending the core

- **New product** → add its accent to `accent-registry.json` (and its row to the `design-language.md` table; the parity test enforces both exist), then create `blessed/<product>.json`.
- **New blessed deviation** → add an entry with a `why` that cites the `design-language.md` rule authorizing it. An unjustified entry is a defect in disguise.
- **New rule** → it belongs in `design-language.md` first (prose), then in `substrate-matrix.json` (its per-substrate levels), then optionally in the script if it is CSS-text-decidable. Rules that need intent stay with the subagent.
