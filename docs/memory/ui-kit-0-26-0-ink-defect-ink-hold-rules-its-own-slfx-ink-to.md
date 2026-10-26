---
name: ui-kit-0-26-0-ink-defect-ink-hold-rules-its-own-slfx-ink-to
description: SUPERSEDED in 0.39.0 (2026-10-26) — ink is removed and replaced by the dither hover. The one fact worth keeping is that the hover layer takes colours only from role-vars, so a product's hover colour is never overpainted.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-10-01
  modified: 2026-10-26
---

**Superseded.** Ink (`.sl-fx-ink`, `--slfx-ink-*`) was deleted in ui-kit 0.39.0 (pixel direction D, S3, https://github.com/sondalab-ai/sondalab-ui/pull/88). The hover is now an 8x8 Bayer dither wipe of 3px cells. See [[the-dither-layer-sits-over-the-glass-tint]] and the spec's *Dither hover* section.

History, one line each: 0.26.0's ink painted its own target colour over every hover colour (spexr's red danger came out indigo), and the owner chose Fix A (the layer owns no hover colour). 0.36.6 (https://github.com/sondalab-ai/sondalab-ui/pull/82) made it a pool of light.

**Still useful:** the dither takes its colours only from `--slfx-dither-fill` and `--slfx-dither-on`, bound per variant from kit roles in `effects.css`, never from `[data-sl-theme]`. A lab mock's product toggle must also set `--sl-accent-default`, because `products.css` sets only neutrals and the fill. See [[light-on-light-effects-take-contrast-from-saturation-floor-oklch]].
