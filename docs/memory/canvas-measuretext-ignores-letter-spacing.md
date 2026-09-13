---
name: canvas-measuretext-ignores-letter-spacing
description: ctx.measureText() returns the untracked advance unless ctx.letterSpacing is set, so centring an SVG text mask on it is right for a numeral at -0.02em and visibly wrong for a label at 0.2em; use text-anchor="middle" and let the renderer do it.
metadata:
  type: reference
---

`ctx.font` carries family, size, weight and style. It does **not** carry
`letter-spacing` — that is `ctx.letterSpacing`, a separate property — so
`measureText(s).width` is the advance with **no tracking at all**.

Measured on the effects showcase, Martian Mono at 88px, `"01"` tracked
`-0.02em`: the canvas reported 123.2px, the element's own `max-content` box was
132.0px, and 132.0 − 12.32 of padding = **119.68** — the canvas advance plus
2 × (−1.76px). The error is one letter-space per character. At −0.02em on two
digits it is 3.5px and reads as "close enough"; at +0.2em on a tracked label it
is most of a glyph.

**How to apply:** when writing an SVG `<text>` mask over a CSS-laid-out run,
do not compute an x offset from the canvas. Set `text-anchor="middle"` at half
the box and let SVG lay the run out with the real advance — give the host
`width: max-content` so its box *is* the run, and the two agree at any
tracking. Verified in Chrome: the run then starts at exactly `padding-left`, at
both −0.02em and +0.06em.

The canvas is still the right tool for the **vertical**: `actualBoundingBoxAscent`
/ `Descent` are the real ink for this face at this size, and those are not
affected. See [[the-lens-plate-misaligns-because-webfonts-do-not-load]] for the
other half of measuring type from JavaScript.
