---
name: sl-adopt
description: Pull ONE Sondalab component or signature pattern into an existing app without a full migration. Use when asked to "add a Sondalab eyebrow/tag/inversion band here", "give this header the house look", or "use the DS button on this screen" — a localised taste of the family look. For bringing a whole surface into compliance use sl-migrate; for a new surface use sl-author.
---

# sl-adopt — pull one Sondalab component into an existing app

You are orchestrating the adopt workflow. The full procedure is the portable
core at `packages/ui-kit/agent/workflows/adopt.md` — **read it now and follow it
exactly**. This skill only wires it into Claude Code; it does not restate the
steps.

## What this skill adds

- **Create a todo per workflow step (0–5)** and work them in order.
- **Scope discipline is the whole point.** Adopt touches only the one component
  it adds and the files that component lands in. Do **not** audit or fix the rest
  of the host app — pre-existing findings elsewhere are migrate's job, not yours.
  If you find yourself editing more than the added component, stop: the ask was
  adopt, not migrate.
- **Honour the host's tier.** On a Tier-B app, bind the component's `--slc-*`
  role-vars to the app's local colour layer; never switch the app to
  `data-sl-theme`. Every bound value must still resolve to a Sondalab token or the
  host's registered accent.
- **Build from the catalog.** Copy the component markup from `catalog.md`; don't
  hand-roll it. Bind role-vars, never literals.
- **Audit the touched file only** (step 3) — the added component contributes zero
  R-violations. Delegate to `sl-ds-auditor` if useful, but keep its scope to the
  edited file.
- **Carry the effects declension.** `catalog.md`'s canonical string is the whole
  component: adopting `sl-btn sl-btn--primary` without `sl-fx-glass
  sl-fx-glass--pane` adopts a different one. The effect classes need the runtime
  (`catalog.md` § *Turning effects on*) — wiring `mount()` into the host is part
  of the adopt. If the host cannot run it, take the plain component and say so;
  never leave `sl-fx-*` classes rendering Tier 0.

## Inputs to confirm before Step 0

- **which component** (a `catalog.md` entry), and
- **the host app + the file(s)** it goes into (for substrate/tier and the audit scope).

If unclear, ask once, then proceed.

## Reference

- Procedure: `packages/ui-kit/agent/workflows/adopt.md`
- Components: `packages/ui-kit/agent/catalog.md` (+ `catalog.json`)
- Grammar / judgement: `docs/design-language.md`, `packages/ui-kit/agent/HANDOFF.md`
- Audit (scope to the touched file): `packages/ui-kit/agent/sl-audit.mjs`
