---
name: sl-fx-glitch-makes-its-host-an-inline-block
description: .sl-fx-glitch sets display:inline-block on whatever carries it, so a block heading paired with an inline-level eyebrow lands on the same line — and the symptom looks like a broken effect, not a display bug.
metadata:
  type: project
---

`.sl-fx-glitch` declares `position: relative; display: inline-block`
(`effects.css`). The `display` is not optional decoration — but it is also not
what a consumer expects when the class goes on an `<h1>`, and `<h1>` is a
block. Paired with a preceding element that is itself inline-level, the two
share a line and the heading renders over the label above it.

That is exactly what happened when `sondalab-site` adopted the kit: its own
retired `.glitch` was `position: relative` and nothing else, its `.eyebrow` is
`display: inline-flex`, and every `<p class="eyebrow">` + `<h1 class="sl-fx-glitch">`
header collapsed onto one line — three surfaces at once (post, product page,
blog index). The shatter shards are `white-space: nowrap` and absolutely
positioned, so the wreckage reads as *the glitch effect is broken* rather than
as *this heading is an inline box*.

**Why:** the kit's own comment says the glitch host is "a CHILD of the
component, never the component itself", which is true of `::before`/`::after`
but says nothing about `display` — and consumers put the class on headings
anyway, because that is what glitches.

**How to apply:** when auditing a glitch host, check the host's TAG and its
PARENT. A `<span>`, or anything inside a `display: flex`/`grid` parent (which
blockifies its children), is already fine. A block element in a plain block
container needs `display: block` restored at the consumer. Do not fix it by
making the neighbour block — an `.eyebrow` may be inline-level on purpose,
sitting beside a section numeral.

Related: [[sl-fx-goo-has-no-tier-2-and-survives-prefers-reduced-motion]].
