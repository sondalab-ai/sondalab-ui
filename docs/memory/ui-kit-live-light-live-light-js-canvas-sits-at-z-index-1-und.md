---
name: ui-kit-live-light-live-light-js-canvas-sits-at-z-index-1-und
description: ui-kit live light (live-light.js): canvas sits at z-index -1 under host children and its brightest band is ~9px INSIDE the edge, so any opaque child bleeding to the host edge (e.g. spexr .spexr-df-pinned__bar) hides it; canvas PAD=6px (effects.css inset -6px) is too small for the run shader's outer bleed and leaves a hard rectangle (fixed in 0.15.2: PAD 16 + fade to 0 at uPad)
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-25
---

The live-light canvas is a child of its host at z-index -1, so it paints above the host's own fill and below every child. The run shader's brightest band sits about 9px INSIDE the host edge. An opaque child that reaches the edge (a sticky toolbar with negative margins, like spexr's `.spexr-df-pinned__bar`) hides that band, and the light looks cut off there. Fix it in the consumer by insetting that child about 10px, not by raising the canvas.

Until 0.15.2 the canvas reached only 6px past the host, and the light still had 18% alpha (46/255) there. It ended on a hard rectangle. 0.15.2 uses 16px and fades to zero at the edge. Now an ancestor with `overflow` other than `visible` within 16px of a live host clips the light instead.

**How to measure:** wrap `HTMLCanvasElement.prototype.getContext` to force `preserveDrawingBuffer: true` before the module loads, then `gl.readPixels` on the border rows. Without it the read returns zeros once the frame is composited.
