---
name: light-on-light-effects-take-contrast-from-saturation-floor-oklch
description: A light effect (beam, glow, hairline glint) on a light page cannot take its contrast from luminance — a dark token reads as pigment, and lifting it toward white makes it pale. Fix that worked on the Sondalab effects layer (effects.css, 2026-09-09) — bring every emitted hue to the palette's vivid tier (where --sl-status-* sit) with a FLOOR on oklch lightness and pay the lift in chroma, `oklch(from var(--tok) max(l, 0.66) calc(c + max(0, 0.66 - l) * 0.45) h)`, and make the neutral glint the light pole by mirroring a dark sheen, `max(l, 1.2 - l)` (1.17 since ui-kit 0.35, when the paper ink went to L 0.20, so the glint stays at L 0.97 inside sRGB). Theme-agnostic (ink tokens already above the floor pass through unchanged), inversion-band-safe, no [data-sl-theme] branch, no literal. Relative colour syntax with max()/calc() and var() inside channels parses in Chrome; when a probe returns the TEXT colour for a custom property it is `inherit` from an invalid var() — usually a stale cached stylesheet, cache-bust before diagnosing the syntax.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-09
---
