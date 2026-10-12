---
name: spexr-no-local-tests
description: "Never run spexr's E2E/Playwright (or full test) suite locally — it opens many Electron windows and crashed the machine"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1ed91121-e6f0-45fa-a2ae-2e3b1b850825
  modified: 2026-10-01T18:36:30.784Z
---

Do not run spexr's tests locally: not `npx playwright test` in `tests/e2e`, and not the full `pnpm test`. Lint, typecheck and build are fine.

**Why:** on 2026-10-01 a local E2E run opened lots of windows and crashed the user's system mid-session (user: "do not run spexr tests again as they popup tons of windows crashing the system").

**How to apply:** for spexr bumps, validate with `pnpm build`, `pnpm lint` and `pnpm typecheck`, and leave tests to CI on the PR. If one specific unit test needs checking, ask first.
