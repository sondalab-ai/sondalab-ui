---
name: the-inversion-band-rebinding-is-a-custom-property-cycle
description: The obvious way to write the inversion band is a custom-property CYCLE and fails silently. `.sl-invert { background: var(--slc-text); --slc-text: var(--slc-canvas); }` — a property whose value references a property declared on the SAME element — makes every property in the cycle invalid at computed-value time, so the band paints itself its own foreground instead of the strongest neutral. Capturing the ground into a local var first (`--ink: var(--slc-text)`) does not escape it; it is the same cycle with one more hop. The fix is to rebind on the CHILDREN (`.sl-invert > *`), because custom properties inherit and one generation reaches the whole subtree. This is also why the band's `--slc-border` re-derivation had lived as a copy-paste footnote in three documents rather than as a shipped class. The band needs `--slc-canvas` to exist as a role-var at all: `--slc-surface` is not a substitute (`#ECE4D4` vs `#F6F1E6` light, `#070A0D` vs `#0F151A` dark), and a component may never read a `--sl-*` colour token directly because those resolve only under `[data-sl-theme]` and are absent in Tier B products. See [[an-effect-class-cannot-be-aliased-is-raises-specificity]].
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-14
---
