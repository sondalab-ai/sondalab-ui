---
name: ui-kit-0-26-0-ink-defect-ink-hold-rules-its-own-slfx-ink-to
description: Ink owns no colour (Fix A won, 2026-10-01); since 0.36.6 (PR #82, 2026-10-13) ink is a pool of light trailing the pointer, its blend picked from the ground under it, never the theme. Ink runs only where mount() is called: spexr and sondalab-site.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-10-01
---

0.26.0's ink painted its own target colour (`--slfx-ink-to`) over every hover colour (spexr's red danger came out indigo). The owner chose Fix A: ink animates light only, the control's own hover applies as declared. Guard tests forbid `--slfx-ink-to` and any ink rule that sets a host's paint.

0.36.6 (https://github.com/sondalab-ai/sondalab-ui/pull/82) replaced the sweeping ring and iridescence with a "viscous light" pool, chosen by the owner from six options in `lab/ink-liquid.html`.

**Why:** the ring was flashy along toolbars. In the lab draft of the pool, a pool painted in the fill's own colour was invisible on the light primary.

**How to apply:** pick the blend from the opaque ground under the control (screen on a fill or dark ground, chroma lift on a light neutral one), never from `[data-sl-theme]`. In the lab, the product toggle must also set `--sl-accent-default`. `products.css` sets only neutrals and the fill, so without it neutral controls stay amber and the lab looks wrong. See [[light-on-light-effects-take-contrast-from-saturation-floor-oklch]].
