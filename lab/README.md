# `lab/` — direction probes

Throwaway variants, looked at side by side, so that choosing a direction costs
minutes instead of an implementation. The method and the rules that govern this
directory are in `docs/specs/2027-improve-aesthetics.md` (§Method, and
§Capture protocol for how a reference capture is framed).

## The one rule

**Nothing in here ever enters `packages/`.** The chosen variant is *rewritten*
in the kit under the AC-18 – AC-25 gates — never copied. A probe is material to throw away,
and it should be written like it.

## What does not apply here

No design tokens. No `sl-audit`. No tests. No `.sl-fx-*` namespace. No tiers, no
fallbacks, no kill switches, no ARIA, no browser compatibility, no review.
Hardcoded values are normal in a probe and forbidden in the kit.

## Layout

```
lab/
  _harness.css      the grid, the labels, the two grounds
  _harness.js       builds the grid from VARIANTS + render()
  _template.html    copy this to start a probe
  <slice>-<probe>.html
```

One page per probe. A page holds one element and N variants of it, on one grid,
on the same ground, in both themes, each cell labelled with the parameters that
make it different from its neighbours.

## Writing a probe

Copy `_template.html`. Fill three things and nothing else:

- `REFERENCE` — the crop this probe is measured against, and its caption. The
  path points at the capture named in the probe's reference card.
- `VARIANTS` — one object per cell. The keys are the parameters under test;
  they are printed on the cell as its label, so name them the way the card names
  them.
- `render(cell, v)` — draws one variant into one cell.

Click a cell to blow it up; click again to put it back.

## Looking at it

Two passes, and both are needed:

1. **Interactive** — open the file in a browser and use the pointer. Motion and
   response cannot be judged from a still, and that judgement is the owner's.
2. **Contact sheet** — the agent captures the page in both themes and attaches
   one image to the slice. This is what leaves a trace in the pull request.

## Lifecycle

Choose → the winner is rewritten in the kit → **every probe file for that slice
is deleted** → one row goes into the slice log in the spec. If probes from three
slices ago are still sitting here, the method is not being followed.
