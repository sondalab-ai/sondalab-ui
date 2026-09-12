---
name: opacity-on-the-backdrop-filter-element-throttles-the-filter
description: Two things silently break `backdrop-filter`. (1) `opacity` on the same element scales the already-filtered result, so a tint driving it throttles the blur — at 0.14 you see 14%, at 0 the element is not painted and the filter never runs. (2) ANY descendant of the same stacking context carrying `mix-blend-mode` other than `normal` makes that context a BACKDROP ROOT and kills the filter outright — 0 px. Split __backdrop and __tint the way liqui.design does, and darken by colour choice rather than by blend mode.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-11
---

`backdrop-filter` output is composited with the element's own `opacity`. So this
collapses two knobs into one and makes the blur look broken:

```css
/* WRONG — the tint throttles the blur */
.pane {
  backdrop-filter: blur(var(--blur)) saturate(1.7);
  background: linear-gradient(...);
  opacity: var(--tint);        /* 0.14 → you see 14% of the blur */
}
```

```css
/* RIGHT — one knob each, and what liqui.design actually ships */
.backdrop { backdrop-filter: blur(var(--blur)) saturate(1.7); }  /* opacity 1 */
.tint     { background: linear-gradient(...); opacity: var(--tint); }
```

Measured on `lab/1b-buttons-rim-blur.html` at tint 0.5125, toggling blur 5.9px →
1px in the same cell: **max channel delta 6/255 collapsed, 46/255 split** — the
same change reads 7.7× stronger once the layers are separate.

The `liqui-glass` reference card already listed `__backdrop`, `__refract`,
`__tint`, `__specular`, `__shine` as *separate* layers. Collapsing two of them is
what broke it. When a card enumerates layers, the enumeration is load-bearing.

`isolation: isolate` on an ancestor was the wrong suspect here — the blur works
with it in place.

**Two ways to fake a measurement, both hit in one session:**

1. **Diffing across a scroll.** `scrollIntoView()` between the two captures makes
   the diff measure the scroll. The tell is in the row histogram: ~126 changed
   pixels on a 214-px-wide row means the whole row moved. A blur confined to a
   button never changes most of a row.
2. **Testing at `opacity: 0`.** An element at opacity 0 is not painted, so its
   `backdrop-filter` never runs and a "decisive" test proves nothing. Test at
   full opacity with a transparent background instead.

## The second killer: `mix-blend-mode` on any sibling

A descendant with `mix-blend-mode` other than `normal` makes its stacking context
a **backdrop root**, so a sibling's `backdrop-filter` has nothing behind it and
produces **nothing at all** — not a weakened effect, zero.

```css
/* This one line removed ALL glass from the light theme */
[data-ground="light"] .btn__lit { mix-blend-mode: multiply; }
```

Measured on the light panel, toggling blur 2px → none at tint 0.14: **0 px changed
with multiply present, 2847 px (9.88%, max delta 103/255) with it removed.** It
bit only the light theme because only the light theme applied the blend.

This matters for the Sondalab light theme specifically. The `metal` card rules
that on a light ground the glow *darkens and never adds white*, and the reference
achieves that by compositing with `multiply`. **Take the result, not the
mechanism:** use colours that are already dark and no blend mode. A blend mode
anywhere inside a glass element's stacking context costs the whole material.

See [[lab-pixdiff-toggle-one-property-and-diff-the-identical-crop]] for the
method these traps sit inside.
