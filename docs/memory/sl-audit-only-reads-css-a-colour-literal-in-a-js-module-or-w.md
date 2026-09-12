---
name: sl-audit-only-reads-css-a-colour-literal-in-a-js-module-or-w
description: sl-audit only reads CSS: a colour literal in a JS module or WGSL shader passes the gate while breaking the DS colour contract. Hues used from JS must be read via getComputedStyle on --sl-* and re-read on data-sl-theme change (cost a debugging cycle in sondalab-site; see its docs/webgpu-surfaces.md).
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-08
---
