# Workflow — Migrate a surface onto the Sondalab DS

> **What this file is:** the ordered, harness-agnostic procedure an agent follows to migrate an existing app's UI onto the Sondalab design system. It is the portable core; the Claude Code `sl-migrate` skill loads and executes it. Any other harness can follow it directly.
> **Reads:** `catalog.md` (components and the effects layer), `../design-language.md` (grammar), the token CSS (`../../tokens.css` + `../../themes/*.css`, the values), the product's neutrals (`../../neutrals.json` → `products.<id>`, hex tinted with its accent — what a Tier B layer copies), the agent core (`accent-registry.json`, `substrate-matrix.json`, `blessed/<product>.json`), `sl-audit` (verdict engine).
> **Invariant:** migrating a live surface is semi-irreversible. Work on a branch; do not edit before the human approves the mapping plan (Step 3 gate) or the effects plan (Step 6 gate).

## Division of labour (do not blur)

- **`sl-audit.mjs`** — the mechanical verdict: colour value-equality and tier consistency, decidable from CSS text. Trust it for those; never re-derive them by eye.
- **You (the agent)** — the judgement: is a structural label *missing*, is the editorial voice off, is an inversion band warranted, does the composition earn its "one unexpected decision". The audit cannot see these; you read `design-language.md` and decide.
- **The human** — approves the blessed list (Step 2), the mapping plan (Step 3) and the effects plan (Step 6). Applies nothing without that yes.

## Steps

### 0 — Classify substrate
Determine the product name and its substrate: **IDE** (fixed-chrome host), **App** (data-grid web app), **Page** (marketing/landing), **Term** (terminal). Read it from `substrate-matrix.json` `products` if listed, else infer. The substrate selects which rules are Required vs Adapt vs N/A — skip this and you will, e.g., propose a sticky translucent header for a Theia panel the matrix marks N/A.

### 1 — Baseline audit
Create a branch. Run the audit, no edits:
```sh
npx sl-audit --surface "<glob>" --product <name> --substrate <IDE|App|Page|Term>
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
- **Tier A, any product but the default:** load `themes/products.css` and set `data-sl-product="<id>"` on the element that carries `data-sl-theme` (or an ancestor), one product per theme subtree.
- **Tier B:** take the neutrals (grounds, text, borders, the light overlay, the neutral code roles) from `neutrals.json` → `products.<id>.<light|dark>`, never another product's entry and never a pre-0.29 grey. In the light layer also set the numbers the kit keeps on `:root[data-sl-theme="light"]`, which a `[data-theme]` layer never matches: `--sl-accent-text-lmax: 0.46`, `--slc-edge-accent-lmax: 0.59`, `--slc-edge-accent-top: var(--slc-edge-accent)`, `--slc-glow: 0.35` (0.31). The control edge needs nothing: its step count reads the surface's lightness.

### 5 — Re-audit and diff
Re-run the audit. R-violations must reach 0 or be blessed. Produce a before/after report (baseline counts vs current).

### 6 — Effects pass  · GATE
Colour compliance makes a surface *correct*; the effects layer is what makes it read as Sondalab. A migration that stops at Step 5 produces a compliant, flat screen — which is the common failure of this workflow, not a safe minimum.

Scoped to the substrate's Required column (`design-language.md` L6 rows: glass edge, aurora, liquid, goo, glitch, budget — all `N/A` on IDE and Term by default):

1. **Wire the runtime**, per `catalog.md` § *Turning effects on*. Without `mount()` the classes render Tier 0 with no error, and check 8 raises an R-violation.
2. **Apply the canonical strings** from `catalog.md` for the components the surface already has. You are not redesigning: the declension is already bound per component.
3. **Glass needs something behind it** — `catalog.md` § *Glass pane*. On a data-grid App the field-over-grid and button-over-table cases are exactly where the material pays off; on a marketing Page it is the pane over an image.
4. **Respect the budget** and the ARIA contracts (`HANDOFF.md` L6). The aurora renders state, it never *is* the state.

Present the effects plan in chat the way Step 3's mapping plan was presented — which components get which family, and why each meaning fits. **Apply nothing until the human says yes.**

### 7 — Visual check
Render the surface across the applicable themes (light / dark / high-contrast). Verify reduced-motion. Check the dark-invert hairline regression explicitly: alpha-on-canvas rules (`--rule` style) can go invisible inside an inverted block — confirm they remain visible. In high contrast every effect family is off: the surface must still be complete without them.

If you touched glass or the lens, do not sign it off by eye — `HANDOFF.md` § *How to verify an effect*.

## Output
A compliant surface that also carries the effects layer its substrate requires + the before/after compliance report + a populated `blessed/<product>.json` + the CSS diff, all on the branch for review.
