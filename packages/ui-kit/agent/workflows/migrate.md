# Workflow — Migrate a surface onto the Sondalab DS

> **What this file is:** the ordered, harness-agnostic procedure an agent follows to migrate an existing app's UI onto the Sondalab design system. It is the portable core; the Claude Code `sl-migrate` skill loads and executes it. Any other harness can follow it directly.
> **Reads:** `docs/design-language.md` (grammar), `sondalab.tokens.json` (values), `packages/ui-kit/agent/` (accent-registry, substrate-matrix, blessed/<product>.json), `scripts/sl-audit.mjs` (verdict engine).
> **Invariant:** migrating a live surface is semi-irreversible. Work on a branch; do not edit before the human approves the mapping plan (Step 3 gate).

## Division of labour (do not blur)

- **`sl-audit.mjs`** — the mechanical verdict: colour value-equality and tier consistency, decidable from CSS text. Trust it for those; never re-derive them by eye.
- **You (the agent)** — the judgement: is a structural label *missing*, is the editorial voice off, is an inversion band warranted, does the composition earn its "one unexpected decision". The audit cannot see these; you read `design-language.md` and decide.
- **The human** — approves the blessed list (Step 2) and the mapping plan (Step 3). Applies nothing without that yes.

## Steps

### 0 — Classify substrate
Determine the product name and its substrate: **IDE** (fixed-chrome host), **App** (data-grid web app), **Page** (marketing/landing), **Term** (terminal). Read it from `substrate-matrix.json` `products` if listed, else infer. The substrate selects which rules are Required vs Adapt vs N/A — skip this and you will, e.g., propose a sticky translucent header for a Theia panel the matrix marks N/A.

### 1 — Baseline audit
Create a branch. Run the audit, no edits:
```sh
node scripts/sl-audit.mjs --surface "<glob>" --product <name> --substrate <IDE|App|Page|Term>
```
Record the grouped baseline (R-violation / A-deviation / N/A counts). This is the before-picture the final report is measured against.

### 2 — Separate blessed deviations from defects  · GATE
`design-language.md` authorizes colours that fail literal value-equality: accent-derived hover/active/subtle tints, locally-derived on-ink status pairs, alpha-on-canvas hairlines. For each finding decide:
- **Blessed** → add an entry to `blessed/<product>.json` with a `why` that cites the authorizing `design-language.md` rule. It silences the finding *and* records the intentional deviation.
- **Defect** → keep it on the list to fix in Step 3.

An accent-derivation swamp (many tints off the product's single accent) is the common case for Tier-B products; bless the derivations as a group rather than mapping each to a token. **Present the blessed list and wait for the human's confirmation before continuing.**

### 3 — Propose the mapping plan  · GATE
For each remaining R-violation, map the free-floating value to an `--sl-*` role or the product's accent-registry value. Add your judgement-level findings (missing mono labels, hairline structure, section index, editorial voice) scoped to the substrate's Required rules. Present the plan **in chat**: the value→token mapping plus the concrete edits. **Stop. Apply nothing until the human says yes.**

### 4 — Apply
After approval, edit per the product's tier (A: consume the theme layer; B: keep the local colour layer but pin every value to a Sondalab value). Small, rollback-friendly chunks.

### 5 — Re-audit and diff
Re-run the audit. R-violations must reach 0 or be blessed. Produce a before/after report (baseline counts vs current).

### 6 — Visual check
Render the surface across the applicable themes (light / dark / high-contrast). Verify reduced-motion. Check the dark-invert hairline regression explicitly: alpha-on-canvas rules (`--rule` style) can go invisible inside an inverted block — confirm they remain visible.

## Output
A compliant surface + the before/after compliance report + a populated `blessed/<product>.json` + the CSS diff, all on the branch for review.
