---
name: the-pane-drivers-pointer-vars-are-inline-and-inherit
description: The pane driver writes --slfx-px/--slfx-py/--slfx-ptr/--slfx-lit as inline styles on the .sl-fx-glass--pane host, so they inherit; a pointer-reactive child needs CSS reading them, not new JS.
metadata:
  type: project
---

The pane driver sets its four pointer variables with `style.setProperty` on the
pane host itself — `--slfx-px` / `--slfx-py` on pointer move
(`packages/ui-kit/effects.js:446`), `--slfx-ptr` for the bearing, and
`--slfx-lit` from the easing loop (`packages/ui-kit/effects.js:510`). Inline
custom properties inherit, so **every descendant of the pane can read them** with
no extra JavaScript: a child that wants to answer the pointer only needs CSS.

`.sl-fx-glass--pane` also declares the resting values in `effects.css:693`
(`--slfx-px: 50%`, `--slfx-py: 50%`, `--slfx-lit: 0`), which is the fallback for
a document where Tier 1 was never armed — a child reading them then gets a
centred, unlit state rather than an invalid value. Write CSS that is correct at
`--slfx-lit: 0` and it degrades on its own.

`setPaneLive()` removes all four when the pointer leaves
(`packages/ui-kit/effects.js:414`) and strips an empty `style=""` afterwards, so
nothing is left on the element; exactly one pane is live at a time.

**Why:** the obvious move when a child needs to follow the pointer is a second
listener, which then has to be kept in step with the kit's easing. The values are
already there and already eased.

**How to apply:** read the vars, multiply by `--slfx-lit`, and let the kit own
the loop. See [[tier-2-needs-mountgpu-and-a-declared-backdrop]] for what Tier 1
does not give you.
