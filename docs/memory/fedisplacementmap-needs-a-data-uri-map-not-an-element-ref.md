---
name: fedisplacementmap-needs-a-data-uri-map-not-an-element-ref
description: In Chrome 152 feDisplacementMap works on an ordinary `filter:` but the map must come from `feImage href="data:…"`. `feImage href="#someElement"` is silently ignored — no error, no warning, the element simply renders unbent. This is the difference between "refraction is impossible" and "refraction is one data URI away", and it cost a probe that rendered nothing.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-11
---

Three copies of the same grid, one filter each (`lab/z-displacement-minimal.html`):

| map source | result |
|---|---|
| none — control | flat grid |
| `feImage href="#map"`, an element in the same document | **identical to the control** |
| `feImage href="data:image/svg+xml;utf8,…"` | **visibly bent** |

No console error for the failing one. A filter that silently does nothing looks
exactly like a filter that is not supported, which is how this was nearly written
off twice.

**Why it matters.** The effects-layer spec concluded that `backdrop-filter:
url(#f)` displacement does not work in Chrome 152, and that is separately true —
see [[backdrop-filter-url-svg-displacement-is-applied-but-inert-ch152]]. But its
own probe list already recorded that the same filter "applied as an ordinary
`filter:` to a striped test element — shreds it". So refraction was never
impossible; it needs two things together:

1. a **declared backdrop** — a copy of what lies behind, inside the pane, so
   there is something to displace with an ordinary `filter:`;
2. a map delivered as a **data URI**.

That is what `lab/1j-refraction-declared-backdrop.html` does, with no GPU and at
tier 0. Both implementations in the knowledge base work the same way — neither
`glass-studio` nor `glass-vue` ever refracts a live document; they refract an
image or a video they were handed.
