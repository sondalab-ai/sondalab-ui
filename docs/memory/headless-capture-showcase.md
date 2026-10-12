---
name: headless-capture-showcase
description: How to take deterministic headless Chrome captures of the sondalab-ui showcase for pixel diffs
metadata:
  node_type: memory
  type: reference
  originSessionId: 73854b75-ffeb-4897-b357-7b52536c0f6d
  modified: 2026-09-30T10:32:54.544Z
---

Capturing `showcase/*.html` with headless Chrome for `lab/_pixdiff.py`:

- `--virtual-time-budget` hangs forever on the showcase (effects run rAF loops). Use `--timeout=6000` instead.
- The high-contrast showcase page hangs even with `--timeout`. Prove high-contrast with a small lab page instead.
- Entrance animations make before/after diffs non-zero (cards caught mid-reveal). Add `--force-prefers-reduced-motion` and set `data-sl-fx-still` on `<html>`, then take a control pair (after vs after = 0 px) before trusting a diff.
- The theme comes from localStorage `sl-demo-theme`. Inject a `<head>` script into a temp copy that sets it and `data-sl-theme`, and use a separate `--user-data-dir` per theme.
- "Before" images can come from the main checkout, since the files are the same at base. Copy the probe page into both `lab/` dirs (`lab/*.html` is git-ignored).

Related: [[gh-checks-watch-race]]
