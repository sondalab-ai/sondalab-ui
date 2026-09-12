---
name: an-svg-image-inside-a-pattern-is-placed-in-the-tiles-space
description: Giving the <image> the pattern's own absolute x/y offsets it twice; the picture still looks present and only its edges are wrong, so it reads as "the effect is broken" rather than "the fill is wrong".
metadata:
  type: reference
---

A `<pattern patternUnits="userSpaceOnUse" x y width height>` places the **tile**
in user space. The `<image>` inside it is placed in the **tile's own** coordinate
system, which already starts at the tile's origin. Setting both to the same
absolute x/y offsets the picture twice; the pattern repeats, so every tile shows
the wrapped-around part of the picture.

The failure is nasty because the picture still looks correct at a glance — only
its **edges** carry content from the opposite side. In `goo-field.js` the edges
are the only part a weld blends, so three images sat side by side welding into
black and it read as "the merge does not work".

**What separated the two hypotheses:** filling the same paths with saturated
solid colours. The necks appeared immediately, which proved the geometry, the
sigma and the weld were all correct and moved the search to the fill.

The tile takes the offset; the picture sits at `0,0`:

```js
pattern.setAttribute("x", String(shape.x));
picture.setAttribute("x", "0");
```

Related: [[fedisplacementmap-needs-a-data-uri-map-not-an-element-ref]],
[[the-goo-filters-alpha-slope-erases-anything-below-half]].
