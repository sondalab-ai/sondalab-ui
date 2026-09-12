---
name: sondalab-ui-next-step-lab-1w-aurora-bed
description: sondalab-ui — the aurora slice ran lab/1w, 1x and 1y on 2026-09-12 and all three are CLOSED. The light model changed at 1y: the aurora's light is the CURTAINS (--pillars), because a lens can only be seen to bend light that has structure; --sweep, --beam and --rim keep the conic bloom fitted at 1x. Read the spec's "Start here" block first; no task is queued. Do not judge the aurora on the showcase's wordmark cell, and freeze a page's animations before diffing it.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-11
  updated: 2026-09-12
---

`docs/specs/2027-improve-aesthetics.md` opens with **Start here — handoff,
2026-09-12 09:30**. It is the entry point for a fresh session: current kit
state, the traps that cost most of two days, and the fact that **no task is
queued** — the owner rules on the 1w findings, the kit's release and the GPU
tier's cut.

Each section records its own measured table and verification diffs: "1w — the
curve is hooked", "1x — the reference at its own zoom", "1y — the light the
glass can be seen to bend". The beds (`lab/1w-aurora-flat.html`,
`1x-aurora-own-zoom.html`, `1y-pillars-refracted.html`) are gitignored like
every probe and can be rebuilt from those sections; the instrument,
`lab/_profile_edge.py`, is tracked and carries both target curves.

**The one thing to know before touching the aurora again:** the composer
reference is not glass, so fitting our light to its flat profile puts that
light in the one geometry a lens cannot show itself bending. The owner ruled
the refraction wins that conflict.

The file below the Start-here block is a chronological record and reads
correctly only downward from there.

Related: [[claude-in-chrome-zoom-writes-a-dpr2-png-region-in-screenshot-frame]],
[[claude-in-chrome-the-mcp-tab-reports-visibilitystate-hidden]].
