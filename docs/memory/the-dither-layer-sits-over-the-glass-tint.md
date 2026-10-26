---
name: the-dither-layer-sits-over-the-glass-tint
description: The dither hover layer is at z -2 AFTER __tint, over the tint (owner, 2026-10-26); under the tint a glass primary's hover was almost invisible because __tint is the accent at 0.9 alpha.
metadata:
  type: project
---

The first cut of the dither hover (S3, pixel direction D) laid its span between `__backdrop` and `__tint`, as the plan's Context point 1 said. On a glass primary the hover was **almost invisible**: `__tint` is the accent at 0.9 alpha, so it covered the fill. The owner moved the layer on 2026-10-26 after a measurement: `z-index: -2`, after `__tint` in DOM order, so the fill paints over the tint and under the shine (-1), the specular and live light, the press light and the label.

**Why:** a fill under a 0.9 tint of its own hue shows as 10% of itself. The label is read against the fill, not the tint, so the contrast test for the on-fill pole holds.

**How to apply:** the cost is accepted: while hovered the fill covers the frost and the lens. The layer must not use `opacity`, `filter` or `mix-blend-mode`, which would throttle the host's `backdrop-filter` or make it a backdrop root ([[opacity-on-the-backdrop-filter-element-throttles-the-filter]]). If a future glass layer needs to paint under the tint, check a glass primary first. Spec: *Dither hover* in `docs/specs/2026-09-08-effects-layer-design.md`; plan: `docs/plans/2026-10-26-pixel-direction-d.md`.
