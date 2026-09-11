# MEMORY

Index of project memory entries. One line per memory, oldest first; the linked file holds the body.

- [sl-audit only reads CSS](sl-audit-only-reads-css-a-colour-literal-in-a-js-module-or-w.md) — a colour literal in a JS module or WGSL shader passes the gate while breaking the colour contract; read hues via `getComputedStyle` on `--sl-*` and re-read on theme change.
- [SVG feDisplacementMap samples at `scale*(map-0.5)`](svg-fedisplacementmap-samples-at-scale-map-0-5-if-the-displa.md) — a distortion pulling the wrong way is a mean bias or the field's sign; measure the map's mean before assuming either, and amplitude is a third separate change.
- [CSS applies `filter` before `mask` on the same element](css-applies-filter-before-mask-on-the-same-element-so-a-mask.md) — a glow on a masked ring reads as "truncated by its container" when nothing is clipping it; the fix needs two nested boxes, inner masked, outer filtered.
- [Light-on-light effects take contrast from saturation, not luminance](light-on-light-effects-take-contrast-from-saturation-floor-oklch.md) — floor the oklch lightness and pay the lift in chroma; theme-agnostic, no `[data-sl-theme]` branch, no literal.
- [Claude-in-Chrome freezes rAF in the MCP tab](claude-in-chrome-the-mcp-tab-reports-visibilitystate-hidden.md) — `visibilityState` is `hidden` between calls, so awaiting `requestAnimationFrame` inside `javascript_tool` times out CDP; drive pointer effects with `computer` hover/wait/zoom instead.
- [`backdrop-filter: url()` SVG displacement is applied but inert in Chrome 152](backdrop-filter-url-svg-displacement-is-applied-but-inert-ch152.md) — confirms `620b7b7` with numbers; the capture-plate lens stays the only route, and eyeballing a screenshot gets this wrong.
- [Two things silently kill `backdrop-filter`](opacity-on-the-backdrop-filter-element-throttles-the-filter.md) — `opacity` on the same element throttles it; `mix-blend-mode` on any sibling makes the stacking context a backdrop root and zeroes it. Split `__backdrop` from `__tint`, and darken the light theme by colour, not by blend mode.
