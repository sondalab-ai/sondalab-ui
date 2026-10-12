---
name: sondalab-ui-canvas-is-the-band-ink-inside-sl-invert
description: "Inside .sl-invert, --slc-canvas is the band's ink, so anything painted with the canvas there shows as a solid square; override it to --slc-sunken in the band"
metadata:
  node_type: memory
  type: project
  originSessionId: b9ea86eb-ce13-4386-86e5-7ca5123da200
  modified: 2026-10-05T15:40:18.127Z
---

In the kit's inversion band (`.sl-invert > *`), `--slc-canvas` is rebound to the band's ink colour. A control whose ground is `var(--slc-canvas)` therefore paints as a solid ink square inside the band. Example: K10's check box moved to the canvas, and inside the band it showed as a filled square. In the band, rebind that ground to `--slc-sunken`.

**Why:** K10 (ui-kit 0.36.0) hit this when it moved the check box to the canvas ground. The band's rebinding is a custom-property swap, and the canvas role carries the band's ink there.

**How to apply:** when a kit component paints with `--slc-canvas`, add a band override (`.sl-invert …` → `--slc-sunken`) and test the band context. Related: [[the-inversion-band-rebinding-is-a-custom-property-cycle]], [[a-role-var-nothing-renders-is-a-rebinding-nobody-checks]].
