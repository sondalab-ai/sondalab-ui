---
name: sl-migrate
description: Migrate an existing app's UI onto the Sondalab design system — audit its palette against the tokens, separate blessed deviations from defects, map free-floating values to --sl-* roles, apply per tier, re-audit. Use when asked to "migrate <app> to the Sondalab DS", adopt the design system in a consumer app, or bring a surface into design-language compliance.
---

# sl-migrate — migrate a surface onto the Sondalab DS

You are orchestrating the migrate workflow. The full procedure is the portable
core at `packages/ui-kit/agent/workflows/migrate.md` — **read it now and follow
it exactly**. This skill only wires it into Claude Code; it does not restate the
steps.

## What this skill adds

- **Create a todo per workflow step (0–6)** and work them in order.
- **Honour the two gates.** Step 2 (blessed list) and Step 3 (mapping plan) each
  stop for explicit human approval. Present, then wait. Apply nothing before the
  Step 3 yes — migrating a live surface is semi-irreversible.
- **Delegate the audit** to the `sl-ds-auditor` subagent (read-only). It runs
  `packages/ui-kit/agent/sl-audit.mjs` and reads `design-language.md` for the judgement-level
  findings, returning them grouped R / A / N-A with `file:line`. You do not run
  the audit inline and you do not eyeball colour equality — trust the script for
  what is mechanical, the subagent for what needs intent.
- **Apply edits yourself** (or via a 1–2 file builder subagent) only after
  approval, in small rollback-friendly chunks, on a branch.

## Inputs to confirm before Step 0

- the **product name** (must match a key in `accent-registry.json` /
  `blessed/<product>.json`; add one if the app is new to the registry), and
- the **surface glob** (which CSS/HTML files to audit and migrate).

If either is missing, ask once, then proceed.

## Reference

- Procedure: `packages/ui-kit/agent/workflows/migrate.md`
- Grammar (judgement rules): `docs/design-language.md`
- Values: `sondalab.tokens.json`
- Core data: `packages/ui-kit/agent/{accent-registry,substrate-matrix}.json`, `blessed/`
- Usage + examples: `packages/ui-kit/agent/README.md`
