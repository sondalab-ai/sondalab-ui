---
name: backdrop-filter-url-svg-displacement-is-applied-but-inert-ch152
description: Chrome 152 applies `backdrop-filter: url(#svgfilter)` over feDisplacementMap but yields NO backdrop displacement — measured on liqui.design, scale=45 on a 76x35 element moved 45px of 114704 (0.04%, max delta 13/255) confined to the rim bands, with the backdrop's own hairline bit-identical. Confirms 620b7b7 and keeps the capture-plate lens as the only route.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-11
---

`620b7b7` recorded that `backdrop-filter: url(#f)` displacement "does not work in Chrome 152",
which is why `effects.js` takes the expensive capture-plate route (`capturePlate()`, rasterise
the page into a plate and crop it per pane).

That ruling is **confirmed**, and the precise statement is sharper than "does not work":
**the filter is applied and composites at the rim, but performs no usable displacement of
the backdrop.**

Measured 2026-09-11 against https://liqui.design/docs/components/button, which ships exactly
this technique in production (`.liqui-glass__refract`, `backdrop-filter: url(#lq-refract-0)`,
`feImage` → `feDisplacementMap scale="45" xChannelSelector="R" yChannelSelector="B"` on a
76 × 35 element):

- Toggle only that layer's `backdrop-filter` to `none`, diff the identical crop:
  **45 pixels of 114 704 change (0.04 %), max channel delta 13/255**.
- The changed pixels sit in rows 118–125 and 143–151 — the top and bottom **rim bands**.
- The backdrop's own horizontal hairline is row **135** (the brightest row in the frame,
  luminance 184.4) and it is **bit-identical**. Nothing behind the element moved.
- Control: the same crop in the site's dark and light themes differs by **0 pixels**, so the
  capture pipeline adds no noise and the 45 px is real signal.

At `scale=45` on an element that size a working displacement would be unmissable.

**How to measure this, because eyeballing fails here.** My first read of the screenshot was
"the backdrop grid hairlines bend under the button" — wrong. The hairline appears to stop at
the button's edge in *both* states; that is the `__tint` layer (opacity 0.5125) occluding it,
ordinary alpha, not a lens. Only the row-level pixel diff separated the two. Toggle one
property, diff the identical crop, and look at *which rows* changed before claiming a cause.

Related: [[svg-fedisplacementmap-samples-at-scale-map-0-5-if-the-displa]] (the same primitive
when it *is* working, applied to a normal `filter` rather than `backdrop-filter`).
