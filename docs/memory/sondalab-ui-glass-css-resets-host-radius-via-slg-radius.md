---
name: sondalab-ui-glass-css-resets-host-radius-via-slg-radius
description: "glass.css sets the host radius to var(--slg-radius, --sl-radius-md) at equal weight after the component, so any non-8px component radius needs --slg-radius bound on .sl-fx-glass"
metadata:
  node_type: memory
  type: project
  originSessionId: b9ea86eb-ce13-4386-86e5-7ca5123da200
  modified: 2026-10-05T15:40:18.322Z
---

`glass.css` sets a glass host's `border-radius` to `var(--slg-radius, var(--sl-radius-md))`. It loads after `components.css`, at equal specificity. So a component whose own radius isn't 8px gets reset to 8px as soon as it wears glass. Example: K10's small button is r7, but `.sl-btn--sm` with glass went back to r8. The fix is to bind the knob on the glass host, e.g. `.sl-btn--sm.sl-fx-glass { --slg-radius: 7px }`.

**Why:** found in K10 (ui-kit 0.36.0). The bug is invisible on 8px components and appears only when a component's radius differs.

**How to apply:** whenever a component's radius differs from `--sl-radius-md`, bind `--slg-radius` on `.sl-fx-glass` for it, and test it with glass on. Related: [[an-effect-class-cannot-be-aliased-is-raises-specificity]].
