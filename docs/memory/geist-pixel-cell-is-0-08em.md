---
name: geist-pixel-cell-is-0-08em
description: "Geist Pixel draws one cell per 0.08em (measured: 16px stem at 200px), so crisp sizes are multiples of 12.5px; at ~36px it reads as a smooth sans on DPR 1."
metadata:
  node_type: memory
  type: reference
  originSessionId: dd0a84bd-f725-4153-bf6b-bc38f444c79e
  modified: 2026-10-26T08:34:48.617Z
---

Geist Pixel (Square/Grid/Circle, geist@1.7.2 jsdelivr woff2) has a pixel cell of 0.08em. Measured in Chrome on 2026-10-26: the stem of "I" is 16px at 200px, and the cap height is about 9 cells.

**How to apply:**
- Use sizes on whole cells: 12.5px gives 1px cells, 25px gives 2px, 37.5px gives 3px, 50px gives 4px.
- At 24–36px the face reads as an ordinary sans, especially in a downscaled screenshot. Judge it at display size, or with CSS `zoom` on a copy of the text.
- `document.fonts.ready` can resolve before the faces are requested. Await `document.fonts.load('… "GP Square"')` before you measure text with these faces.

Probe: `lab/pixel-directions.html`. Related: [[the-mono-face-carries-the-brand-at-display-scale-too]].
