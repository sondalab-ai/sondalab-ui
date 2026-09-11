---
name: the-lens-plate-misaligns-because-webfonts-do-not-load
description: The glass lens (e33ea31) paints the WRONG page content inside every pane, and the cause is fonts, not geometry — its plate rasterises a body clone inside an SVG foreignObject where webfonts never load, so text falls back, metrics change, blocks shift, and the crop drifts further the lower you scroll. Its sx/sy formula is correct. Hide `.sl-fx-glass__lens` to confirm in one step.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-11
---

Seen on `showcase/effects.html` at scroll ~3630: every glass button showed a
line of small text through it that belonged to a different part of the page —
legible, unblurred, and unrelated to what sits behind the button. Thirty lenses
on the page, all wrong the same way.

**It is not the crop arithmetic.** `paintLens` computes

```js
const sx = Math.round(r.left) + (Math.round(window.scrollX) - plateScrollX);
const sy = Math.round(r.top)  + (Math.round(window.scrollY) - plateScrollY);
```

which is right: the plate is a viewport-aligned snapshot taken at
`plateScrollY`, and the clone is offset by `top: -scrollY` so the frame stays
put while the page slides behind it.

**It is the fonts.** `capturePlate` serialises a `document.body` clone into an
SVG `foreignObject` and rasterises it through a blob-URL `Image()`. That render
happens in a separate document context with no network:

1. The page's `@font-face` rules come from a cross-origin Google Fonts
   stylesheet, and the CSS collector skips it — `sheet.cssRules` throws on a
   cross-origin sheet and the `catch` swallows it (correctly, but silently).
2. Even with the rules copied, the `.woff2` files would not load from a blob URL.

So every string in the plate renders in a fallback face. Metrics change, lines
wrap differently, every block shifts vertically, and the shift **accumulates
down the document** — which is why the crop is plausible near the top and badly
wrong thousands of pixels down.

**Confirm it in one step:** `.sl-fx-glass__lens { display: none !important }`.
The spurious text disappears and the panes read correctly.

Consequences worth knowing before touching this:

- Any fix has to get the fonts into the plate (embed the faces as data URIs in
  the inlined CSS) or stop cloning the document altogether. Matching only the
  `font-family` is not enough; the files have to be there.
- The same class of drift will hit any other external resource the clone cannot
  fetch — background images, icon fonts.
- It also means the lens cannot be judged on any page that uses webfonts, which
  is every Sondalab surface.

Related: [[opacity-on-the-backdrop-filter-element-throttles-the-filter]] and
[[backdrop-filter-url-svg-displacement-is-applied-but-inert-ch152]] — the lens
exists because that displacement route does not work in Chrome 152.
