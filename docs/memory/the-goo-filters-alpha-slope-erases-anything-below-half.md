---
name: the-goo-filters-alpha-slope-erases-anything-below-half
description: A gooey chain steepens only alpha about 0.5, so a translucent source vanishes — but forcing it opaque turns a tint into the full colour; composite over an opaque ground instead.
metadata:
  type: reference
---

The house gooey is `feGaussianBlur` then `feColorMatrix` with an alpha row of
`18` and intercept `-8.5` — a slope whose midpoint sits at **alpha 0.5**. Two
consequences that are easy to get wrong in opposite directions:

**A translucent source disappears.** A member at alpha 0.3 maps to
`18·0.3 − 8.5 < 0`. The obvious fix — force the member's own colour opaque —
is worse: `--slc-accent-subtle` is the accent at low alpha, and at alpha 1 it
stops being a tint and *becomes* the accent. Three quiet `sl-tag`s rendered as
three saturated slabs. The correct shape is to draw each outline **twice**: the
field's substance underneath, opaque, and the member's own fill composited over
it at the alpha the component chose.

**The weld distance is derived, not tuned.** Blur is linear in alpha, so at the
midpoint of a gap `g` between two facing straight edges the two blurred alphas
sum to `erfc(g / (2σ√2))`. They cross the slope's midpoint — a neck appears — at

    g = 2·√2·erfc⁻¹(0.5)·σ ≈ 1.3489·σ

so an author binds the **gap** (a distance readable off their own layout) and
the code derives σ. Exact for facing straight edges only: diagonal neighbours in
a grid stand further apart than the grid's `gap` and stay open.

The RGB row of that matrix is identity, and the blur is premultiplied — which is
why two members of different colours blend across the neck for free, with no GPU
and no second pass.

Related: [[an-svg-image-inside-a-pattern-is-placed-in-the-tiles-space]],
[[light-on-light-effects-take-contrast-from-saturation-floor-oklch]].
