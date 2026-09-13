---
name: the-mono-face-carries-the-brand-at-display-scale-too
description: design-language.md:66 makes the mono label the strongest family signal but scopes it to small structural labels; the owner's ruling is that it governs oversized numerals too, because mono is the project's tech register.
metadata:
  type: project
---

`docs/design-language.md:66` says structural labels are mono, uppercase and
wide-tracked, and that this motif is **"the single strongest family signal — a
surface reads as Sondalab primarily through it"**. But it lists eyebrows,
section indices, meta, wordmark, badges and tags — all at `--sl-text-xs`. It
says nothing about a numeral set at `--step-numeral`, seven rems tall, used as
a card's own folio.

The owner closed that gap on 2026-09-13: **those stay mono too.** A display
serif was tried on the method cards' numerals — Fraunces at `opsz` 144, which
is a defensible editorial folio on its own terms — and his reading was that it
is the wrong voice for this project, which is **tech/cyberpunk**. Mono at
display scale is part of that register, not merely a label convention.

**Why:** the rule as written is scoped by SIZE, so it does not forbid what it
was meant to forbid. Reading it literally and finding the big numeral outside
its scope is exactly the mistake to avoid.

**How to apply:** where an oversized numeral wants to be more than a hairline
tick, change its SHAPE and COLOUR, not its face. What worked: the brand pair
clipped to the glyphs with `background-clip: text` (prefixed first — see
[[css-applies-filter-before-mask-on-the-same-element-so-a-mask]] for the
Lightning CSS class of defect), and the same figure outlined and offset behind
it, which is the registration slip the glitch family is built from, held still.
Martian Mono's slashed zero is doing most of the work and should be left to.
