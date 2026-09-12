---
name: geom-js-new-holds-the-effects-layer-s-pure-geometry-cornerpx
description: cornerPx lives twice on purpose — exported from geom.js and private in effects.js — because effects-js.test.mjs extracts it by source position; consolidating it is a pending follow-up.
metadata:
  type: project
---

`packages/ui-kit/geom.js` holds the effects layer's pure geometry (the radius
clamp, the rounded-box path at an offset, the field origin, the weld
arithmetic), so `scripts/effects-goo.test.mjs` asserts shapes as values.

`cornerPx` is **duplicated**: exported from `geom.js` and still private in
`effects.js`.

**Why:** `scripts/effects-js.test.mjs` locates `cornerPx` by slicing
`effects.js` between two `indexOf("function …(")` positions and rebuilds it with
`new Function`. Extracting it breaks that mechanism, which is a separate change
from shipping the goo.

**How to apply:** consolidating is a pending follow-up — move both helpers into
`geom.js`, import them in `effects.js`, and replace the source-slicing in
`effects-js.test.mjs` with a real import. Until then, a change to the clamp has
to be made in both copies; its `--sl-radius-pill` (9999px) clamp has already
caused one documented defect.

Related: [[the-goo-filters-alpha-slope-erases-anything-below-half]].
