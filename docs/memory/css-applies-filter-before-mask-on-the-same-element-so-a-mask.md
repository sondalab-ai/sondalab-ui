---
name: css-applies-filter-before-mask-on-the-same-element-so-a-mask
description: CSS applies filter BEFORE mask on the same element, so a masked shape cannot then be blurred/drop-shadowed — the mask clips the filter's output to the masked band. A glow on a masked ring therefore looks 'truncated by its container' when no container is clipping it at all (on the effects layer, 28 of 29 elements had no clipping ancestor; the culprit was the ring's own mask, proven by toggling the mask on the page). Fix needs two nested boxes: inner carries the mask, outer carries the filter. An aria-hidden child injected at mount() is one way.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-09
---
