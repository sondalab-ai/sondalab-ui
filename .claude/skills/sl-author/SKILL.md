---
name: sl-author
description: Author a new Sondalab-compliant interface or element from the component catalog. Use when asked to build/scaffold a new screen, panel, page, or component "in the Sondalab design system", "with the DS", or "Sondalab-styled" — greenfield UI that should be DS-compliant from the first line. For bringing an EXISTING surface into compliance, use sl-migrate instead.
---

# sl-author — build a new surface from the Sondalab DS

You are orchestrating the author workflow. The full procedure is the portable
core at `packages/ui-kit/agent/workflows/author.md` — **read it now and follow it
exactly**. This skill only wires it into Claude Code; it does not restate the
steps.

## What this skill adds

- **Create a todo per workflow step (0–5)** and work them in order.
- **Build from the catalog, don't invent.** `packages/ui-kit/agent/catalog.md` is
  the source of markup: for every part of the screen, copy the matching
  primitive or signature pattern rather than hand-rolling elements. `catalog.json`
  is the machine index. A component's colour always comes from a `--slc-*`/`--sl-*`
  role-var — never a literal (a raw hex fails the audit).
- **Spend the surprise on composition (step 2).** The materials are shared; the
  screen still needs ≥1 unexpected, intentional layout decision. A generic centred
  card grid fails the house rule; a second accent or a new type scale fails the
  grammar.
- **Audit must be clean on the first run (step 4).** Greenfield compliance is
  built in, not retrofitted — a dirty first audit means you bound a colour to a
  literal. Delegate the audit + judgement pass to the `sl-ds-auditor` subagent
  (mechanical value-equality/tier from the script; missing-labels / voice /
  composition from `design-language.md` + `HANDOFF.md`).

## Inputs to confirm before Step 0

- the **product** (for its accent — a key in `accent-registry.json`; add one if new), and
- the **substrate** (IDE / App / Page / Term) and where the new surface's files go.

If either is unclear, ask once, then proceed.

## Reference

- Procedure: `packages/ui-kit/agent/workflows/author.md`
- Components: `packages/ui-kit/agent/catalog.md` (+ `catalog.json`)
- Grammar (judgement rules): `docs/design-language.md`; what's judgement vs mechanical: `packages/ui-kit/agent/HANDOFF.md`
- Values: `sondalab.tokens.json`; role-vars: `packages/ui-kit/components.css`
- Audit: `packages/ui-kit/agent/sl-audit.mjs` (must pass clean)
