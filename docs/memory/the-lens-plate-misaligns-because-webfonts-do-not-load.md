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

## Answered 2026-09-11 — and there are TWO causes, not one

`lab/z-plate-fonts.html` settles the mechanism, in one look:

| in a foreignObject raster | result |
|---|---|
| `@font-face` with an external URL, even same-origin and absolute | **does not load** |
| `@font-face` with the bytes as a `data:` URI | **loads** — matches the live line |

So the fonts must travel as bytes inside the CSS. `effects.js` now does that
(`inlineFaces()`), and the kit vendors the three faces so they are readable and
fetchable at all. Write the probe's rasters into `<img>` elements, never into
`Image()` + canvas: the first version awaited `Image.onload` and hung with no
error in every browser, which taught nothing.

**The second cause, found by LOOKING at the plate.** Render the plate into an
`<img>` pinned over the page, cropped to a pane's own band, one copy per clone
strategy. At the button's band the `el.remove()` plate carried a heading from two
sections away; the `opacity: 0` plate carried the line that is actually behind the
button. That is the whole diagnosis, and it took one screenshot after three
rounds of guessing — **render the plate before theorising about the crop.**

`capturePlate` removes every glass element from the clone so a pane does not
capture itself. A removal takes the box out of flow: everything after it moves up,
and with thirty panes the accumulated shift is hundreds of pixels. `opacity: 0`
keeps the box, paints nothing, and aligns the plate. (`visibility: hidden` also
aligns it; `opacity: 0` is the one that shipped.)

**What is left after both fixes, narrowed as far as it went:** a `--rim` pane —
a filled primary — crops a **black rectangle** out of the plate, while a ghost
pane in the same row is correct. It is the plate's own pixels, not the
displacement: forcing `filter: none` on the lens leaves the black exactly where it
was. Four things did *not* clear it —

1. `visibility: hidden` on the clone's glass elements instead of `opacity: 0`;
2. also forcing `background`, `box-shadow` and `filter` to none on them;
3. also forcing `backdrop-filter: none` on them;
4. hiding a lens whose crop falls outside the plate, so an empty canvas never
   paints its filter (kept — it is right on its own terms, and fixes panes below
   the fold, but it is not this bug).

So whatever writes that black is upstream of all four. The next person should
render the plate and look at the primary's own band — the same one-screenshot
method that found the flow bug — rather than reasoning about the lens.

**Superseded note —** what follows was written before the plate was rendered: With the fonts embedded the crop still lands
wrong — the text under the pane changed, so the plate's layout did change, but it
is still not the page's. The remaining offset is `capturePlate` **removing** every
glass element from the clone: a removal takes the box out of flow, so everything
after it moves up, and with thirty panes on a page the accumulated shift is
hundreds of pixels. `visibility: hidden` keeps the box, but leaves a **black
rectangle** in the raster — still there with `backdrop-filter`, `background`,
`box-shadow` and `filter` all forced off. Three attempts, none clean; left as a
removal. Whoever takes it next needs a way to reserve a box without painting it
that survives the rasteriser.

## What a fix had to get past (probed 2026-09-11)

The obvious repair — inline the faces as data URIs in the plate's CSS — needs the
font bytes, and a page cannot discover them on its own:

- **The Google Fonts CSS endpoint is not fetchable.** `fetch()` on the
  `fonts.googleapis.com/css2?...` href throws `TypeError: Failed to fetch`; it is
  also unreadable through `sheet.cssRules`, being cross-origin. So the `@font-face`
  rules and their `url()`s cannot be read at all.
- **The faces are not enumerable either.** `[...document.fonts]` on the showcase
  lists only unrelated browser/extension faces, all `unloaded`, even though
  `document.fonts.status` is `loaded` — CSS-connected faces from a cross-origin
  sheet are not exposed as `FontFace` objects.
- **The font FILES are reachable.** A deliberately wrong `fonts.gstatic.com` URL
  returned `404` with `response.type === "cors"`, so the request was not opaque:
  given a URL, the bytes can be fetched and base64'd.

So the missing piece is the URL list, and only the surface knows it. The workable
shape of a fix is therefore **the surface self-hosts or declares its fonts** and
the kit inlines them as data URIs — not something the kit can solve alone.

Not verified: whether a `foreignObject` raster can load an external font URL at
all (it is widely held that subresources do not load in that context). The test
for it awaits `Image.onload` inside `javascript_tool`, which froze the renderer
and timed out CDP — the same throttling as
[[claude-in-chrome-the-mcp-tab-reports-visibilitystate-hidden]]. Run it in a real
tab, not through the extension.

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
