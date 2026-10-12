---
name: currentcolor-in-a-custom-property-resolves-on-the-using-element
description: "currentColor inside an unregistered custom property resolves on the element that uses it, so a band role built on currentColor is diluted on muted-ink controls; the test cascade can't see it"
metadata:
  node_type: memory
  type: project
  originSessionId: b9ea86eb-ce13-4386-86e5-7ca5123da200
  modified: 2026-10-05T20:01:57.783Z
---

If an unregistered custom property's value contains `currentColor`, it stays a token until a property uses it, and then it resolves to *that* element's `color`. So a role like `.sl-invert > * { --slc-edge-control: color-mix(in oklch, currentColor 38%, transparent) }` picks up each control's own ink. A chip in the muted ink (×0.6) drew its edge at 23% (1.67:1), and an icon button at 30%.

**Why:** this came up in K10.1 (https://github.com/sondalab-ai/sondalab-ui/pull/77, ui-kit 0.36.1). The kit's test cascade (`scripts/lib/cascade.mjs`) substitutes the band ink for `currentColor` before computing contrast, so the tests passed while Chrome painted under 3:1.

**How to apply:** when a role must be one fixed colour across all controls, build it on a named role, e.g. `oklch(from var(--slc-canvas) …)` (the band's ink inside `.sl-invert`, see [[sondalab-ui-canvas-is-the-band-ink-inside-sl-invert]]), never on `currentColor`. Check contrast claims in rendered Chrome on a muted-ink control, not only in the cascade. Related: [[a-role-var-nothing-renders-is-a-rebinding-nobody-checks]].
