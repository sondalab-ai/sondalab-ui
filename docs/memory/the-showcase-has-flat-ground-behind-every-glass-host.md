---
name: the-showcase-has-flat-ground-behind-every-glass-host
description: showcase/effects.html cannot show a glass or lens defect that only appears over CONTENT — nothing sits behind its glass hosts but flat canvas, which is how disperse:90 shipped with a negative red channel on ten of sixteen aurora hosts.
metadata:
  type: project
---

Every `.sl-fx-glass` / `.sl-fx-aurora` host on the showcase sits over the page's
own flat ground. A `backdrop-filter` with nothing behind it but one colour
renders almost identically however badly its filter chain is misconfigured: a
bend has nothing to bend, and a prism has no edge to open.

Measured 2026-09-15: `--slg-lens-disperse: 90` shipped on every aurora host and
looked fine on the showcase. On a field over a data grid it fringed the text
underneath, and ten of sixteen aurora hosts were running a NEGATIVE
`feDisplacementMap` scale on the red channel — which does not error, it
displaces the channel backwards.

**Why:** the page is a catalogue of components, not of situations. The
situations that break glass are a field over a data grid, a busy button over a
list of numbers, a selected tab over a table — surfaces with a reader behind
them, and none of them appear there.

**How to apply:** never sign off a glass, lens or backdrop-filter change on
`showcase/effects.html` alone. Build a throwaway page with an aurora host over
dense body copy and a table, and read the numbers off the page rather than
eyeballing it — enumerate `feDisplacementMap` elements and compare their live
`scale` attributes against each host's `getBoundingClientRect()`. See
[[svg-fedisplacementmap-samples-at-scale-map-0-5-if-the-displa]] and
[[backdrop-filter-url-svg-displacement-is-applied-but-inert-ch152]].
