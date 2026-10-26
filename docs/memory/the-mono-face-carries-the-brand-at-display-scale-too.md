---
name: the-mono-face-carries-the-brand-at-display-scale-too
description: SUPERSEDED in part on 2026-10-26 — the 2026-09-13 ruling (oversized numerals stay mono, never the face) was amended: display numerals, the lockup and single display words now use Geist Pixel Square (direction D). Body stays Geist, code stays Geist Mono. The reasoning below is the history.
metadata:
  type: project
---

`docs/design-language.md:66` says structural labels are mono, uppercase and
wide-tracked, and that this motif is **"the single strongest family signal — a
surface reads as Sondalab primarily through it"**. But it lists eyebrows,
section indices, meta, wordmark, badges and tags — all at `--sl-text-xs`. It
says nothing about a numeral set at `--step-numeral`, seven rems tall, used as
a card's own folio.

**Amended 2026-10-26 (owner, direction D, picked from `lab/pixel-directions.html`):** display numerals, the lockup and single display words are Geist Pixel Square (`--sl-font-pixel`) at the 12.5px-multiple sizes only (`--sl-text-px-1…4`); body and UI text stay Geist, code stays Geist Mono. The face is proportional with no `tnum`, so a figure that changes in place keeps Geist Mono. `docs/design-language.md` L1 and L3 carry the amendment; the text below is the 2026-09-13 reasoning that it replaces.

The owner closed that gap on 2026-09-13: **those stay mono too.** A display
serif was tried on the method cards' numerals — Fraunces at `opsz` 144, which
is a defensible editorial folio on its own terms — and his reading was that it
is the wrong voice for this project, which is **tech/cyberpunk**. Mono at
display scale is part of that register, not merely a label convention.

**Why:** the rule as written was scoped by SIZE, so it did not forbid what it
was meant to forbid. Reading it literally and finding the big numeral outside
its scope is exactly the mistake to avoid. **The grammar has since been
amended** — `docs/design-language.md` L1 now says the rule is about role, not
size, and carries a bullet of its own for a display-scale numeral — so this
entry records the reasoning rather than a gap.

**How to apply:** where an oversized numeral wants to be more than a hairline
tick, change its SHAPE and COLOUR, not its face. What worked: the brand pair
clipped to the glyphs with `background-clip: text` (prefixed first — see
[[css-applies-filter-before-mask-on-the-same-element-so-a-mask]] for the
Lightning CSS class of defect), and the same figure outlined and offset behind
it, which is the registration slip the glitch family is built from, held still.
Martian Mono's slashed zero is doing most of the work and should be left to.
