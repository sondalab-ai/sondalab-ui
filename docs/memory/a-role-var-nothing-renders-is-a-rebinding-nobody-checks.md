---
name: a-role-var-nothing-renders-is-a-rebinding-nobody-checks
description: A role-var re-derivation is only as complete as the components the showcase renders. `.sl-invert > *` shipped in 0.10.0 rebinding `--slc-border` and `--slc-border-subtle` but not `--slc-border-strong`, which is not a third weight nobody uses — the checkbox/radio box edge, the switch track edge and the switch KNOB are painted with it, the knob as a solid fill — so inside the band the knob was `rgba(21,33,31,0.28)` on `rgb(21,33,31)` and the switch rendered as a slab with no knob and no edge; `effects.css` reads the same var twice for `--slfx-edge-hi/mid`, so the glass ring was built on the wrong ground for one cause. It shipped because the band's showcase cell held an eyebrow, a tag, a badge, a kbd and a card — not one component that reads the strong line. The durable fence is the general form, not the property: every `--slc-*` neutral role `components.css` paints with outside its `:root` block must be re-derived by the band, with `--slc-canvas` (it IS the band's light) and `--slc-overlay` (a page scrim) excluded BY NAME so the exclusion is a claim rather than a hole, and the chromatic roles excluded because a product has one accent whatever the ground. See [[the-inversion-band-rebinding-is-a-custom-property-cycle]] and [[a-shipped-stylesheet-nothing-imports-has-never-resolved]].
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-14
---
