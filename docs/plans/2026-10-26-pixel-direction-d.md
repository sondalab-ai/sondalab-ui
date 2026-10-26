# Pixel accent direction (D) → ui-kit 0.39.0

## Context

The owner compared four lab cells in `lab/pixel-directions.html` (git-ignored) and picked **D**:
- the brand of A: Lumen stays, and Geist Pixel is the display accent;
- the button hover of B: a Bayer dither wipe from the pointer's entry point that drains toward its exit point;
- the signal strip of B: a dithered ramp.

The owner also decided these four points (2026-10-26):
1. **Glass hover:** the dither fill paints *under* the glass (above `__backdrop`, below tint, shine, live light and press).
2. **Ink:** the dither wipe **replaces ink** on `.sl-btn` and `.sl-icon-btn`. Ink is removed.
3. **Live light** moves to the 3px grid, in its own droppable slice.
4. **Liquid:** `sl-fx-liquid` is removed in this epic, as the last code slice.

The owner tests only at the end. There is no mid-epic checkpoint.

## Calls made in this plan (not asked; the owner can overturn them)

- **The dither canvas never draws an outline.** In D, the round `+` button looked odd because the canvas drew its own stepped 3px rim (the owner's feedback, 2026-10-26). In the kit the canvas paints **fill cells only**. The border stays the control's own CSS border plus the `::after` ring, so a round icon button keeps a smooth circle and the cells are clipped inside it.
- **The silhouette stays smooth.** D drew stepped corners, but L6 :185 forbids rewriting declared values, and L6 :189 says the radius is read, never written. Every ring layer and the live-light SDF follow `border-radius`. The dither layer is clipped like ink was: `border-radius: inherit; overflow: hidden`. The pixel lives in the fill, the type and the light, not in the outline. No width snapping: cells at the far edge are clipped.
- **This overturns the 2026-09-13 numeral ruling.** Measured on 2026-10-26: Geist Pixel Square is **proportional**. Its advances at 100px are i 38 · W 91 · 1 49 · 8 65, while Geist Mono gives 60 for every glyph. So it cannot pass as L1 :74's "monospace substitute". L1 :79 ("shape and colour, never the face") and its three copies get an explicit amendment that cites the D pick. Before the slice ships it, check whether the face has `tnum`. If not, a live-changing stat must keep Geist Mono.
- **Colours:** the filled-label colour comes from the kit's on-accent pole logic (`--_sl-on`, the `$accent-note` in `sondalab.tokens.json`), not from D's amber hex values. A test pins the contrast for every accent in `agent/accent-registry.json` (amber, indigo, cyan, roboemot, …) × light and dark.

## How glass and light cope (the owner's focus)

The dither layer is a span plus a canvas, injected into the isolated `.sl-btn` **after `__tint`, at z-index −2** (owner, 2026-10-26: under the tint a glass primary's 0.9 accent tint hid the fill almost completely). In an isolated stacking context the host background paints first, then children with a negative z-index, in z order and then in DOM order.

| Effect | Layer / z | With the fill over the tint (chosen) | Decision |
|---|---|---|---|
| Glass `__backdrop` (blur) | span, −3 | covered by the fill while hovered | accepted: hover means intent, so the frost "fills in" |
| Lens (`backdrop-filter: url()` on the host) | the host's own backdrop | covered while hovered, because it paints with the host background | accepted. Refraction returns on leave. |
| Glass `__tint` (gradients) | −2 | **under the fill**: the fill paints over it (same step, later in DOM order) | owner, 2026-10-26; the label is read against the fill itself |
| Glass `__shine` (inset rim) | −1 | over the fill | no change |
| Specular arc and aurora arc | `::after`, +1 | over the fill | no change. Both stay smooth 1px hairlines on the smooth radius. |
| Aurora seated bloom | sibling outside the host | unaffected | no change |
| Live light (WebGL canvas) | −1, inset −16px | over the fill, including the inner band (the opaque-child pitfall is avoided) | S5 quantises it to the 3px grid |
| Press `::before` and spill | −1, and a neighbour's `::after` | over the fill | the 97% pane sink resamples the cells during a press: check in Chrome, accept if the blur shows only during the press |
| Ink | −1 | n/a | removed (S3) |
| Plain buttons (no glass) | — | the fill sits on the host background, under the press light | — |
| Goo, halftone | not on buttons | — | — |
| Glass text | text mask | for Geist Pixel text, await `document.fonts.load` | covered in S1 |

**Pitfalls that the design avoids, from memory notes:**
- no `mix-blend-mode` on the dither layer, because it would make the context a backdrop root;
- no `opacity` or `filter` on it;
- the radius is read through `inherit`, so it follows the pinned `--slg-radius`.

## Slices

All slices go on one integration branch, `integration/pixel-d`, with one short PR per slice into it and **one merge to `main`**. Before S1, run `ListAgents` and work in a git worktree if a peer session exists. Write this plan to `docs/plans/2026-10-26-pixel-direction-d.md` as the first commit.

**S1 · Pixel face and type role**
- **Font files:** vendor a latin subset of Geist Pixel Square (woff2 and its OFL file) into `packages/ui-kit/assets/fonts/`. Record it in that folder's `README.md`, `fonts.css` and `package.json` `"files"`. The showcase forbids font CDNs.
- **Tokens:** add the font role `--sl-font-pixel` and discrete sizes on whole cells (12.5 / 25 / 37.5 / 50px) to `sondalab.tokens.json`, then run `npm run gen:tokens`.
- **Where the face applies:**
  - `.sl-stat__value` (numerals);
  - `.sl-lockup` (lowercase pixel wordmark, with the `/` in the accent ink);
  - a new emphasis span `.sl-px` for a display word.
- **Tests:** `font-coverage.test.mjs` goes from 4 tokens to 5 and adds the OFL name. Update `type-register.test.mjs` (lockup case) and `display-type.test.mjs`.
- **Docs:** L1 amendment in `docs/design-language.md`, then `gen:agent-docs`. Update the catalog (md and json), the README components list and showcase §01.

**S2 · `dither-core.js` (pure, Node-testable, modelled on `halftone-core.js`)**
- Contents: the 8×8 Bayer matrix and `wipeCovered(cell, origin, t, spread)`, ported from `lab/pixel-directions.html` `BAYER` and `ditherFx`.
- Ship with a `.d.ts`, an export and a `"files"` entry. Add `dither-core.test.mjs` (matrix is a permutation of 0..63, t=0 covers nothing, t=1 covers everything, coverage is monotonic in t). Update `types-drift`.

**S3 · Dither hover replaces ink**
- **Remove ink:** `effects.css:2780-2874`, `effects.js:1184-1400`, and the ink tests in `effects-guards.test.mjs:1127-1234`.
- **Add the dither hover:**
  - Create the canvas lazily on the first pointer entry, from a delegated root listener. Reuse ink's cross plumbing (`onInkCross` gives the entry and exit points).
  - Use one shared rAF loop.
  - Cap DPR at 2, as live light does. Draw the cells as rects at device resolution.
  - The label flips through an `.is-dithered` class at t ≥ 0.5.
- **Colours** come only from CSS custom properties (`--slfx-dither-fill`, `--slfx-dither-on`), bound per variant in `effects.css` from kit roles. JS reads them through `getComputedStyle` and reads them again on theme change.
- **Motion** comes from `--sl-motion-*` tokens. Rename ink's in/out durations rather than adding literals.
- **Kill switches:**
  - high contrast, `data-sl-fx="off"` and forced colours (`effects.css:201-202, 336-389`) hide the layer;
  - under reduced motion, Tier 1 is not armed, so the declared CSS hover applies.
- **Tests:**
  - a dither guard set replaces the ink guards;
  - `effects-perf` gets a guard: no canvas at `mount()`;
  - a contrast test checks the filled label against the fill for every registry accent × 2 themes;
  - `depth.test` `FX_HOSTS` is updated.
- **Measure in Chrome:**
  - label contrast through the glass tint, on the showcase buttons listed in `showcase/effects.html:416, 509, 585-586`;
  - the press sink;
  - an empty canvas at rest.

**S4 · Signal strip component**
- `signal.js`, modelled on `halftone.js`, with `canvas[data-sl-signal]` and a `.d.ts`. Ink comes from the inherited `color`. Cells that are off stay transparent, not ground-painted. Decorative, so `aria-hidden`.
- Add it in the seven places a new element needs (`docs/plans/2026-09-14-base-element-set.md`). Add `catalog-audit` coverage and a showcase section.

**S5 · Pixel light (droppable)**
- In `live-light.js`, the shader samples its SDF per 3px cell (`floor(fragCoord / (3·dpr))`) and quantises the intensity into a few fixed levels.
- Update `live-light.test.mjs`. Check in Chrome on a hovered primary that the glow and the dither cells share one grid.

**S6 · Remove liquid**
- Delete the `.sl-fx-liquid*` code: `effects.css:2141-2157` and the kill-switch lists, `effects.js:48-363` and the `LIQUID_HOSTS` arming, plus the geom helpers that only liquid uses.
- Update everything that mentions it (36 files): tests (`effects-js` 191-276, `effects-guards` 83 and 539-623, `effects-showcase`, `effects-perf`, `sl-audit.test` 288), the catalog, `substrate-matrix.json`, `showcase/effects.html`, the specs and the README.
- Regenerate the fixture with `UPDATE_PUBLIC_SURFACE=1`. Round icon buttons get the dither wipe through the inherited radius.

**S7 · Docs, memory, release**
- **Specs and rules:**
  - L4 and L6 amendments, including :187 "never an opaque fill under a pane", which now allows the under-glass dither;
  - `docs/specs/2026-09-08-effects-layer-design.md`: ink becomes dither, liquid is removed, and the note that Tier 2 is retired.
- **Release:** a release note in `packages/ui-kit/README.md`, version 0.39.0 in `packages/ui-kit/package.json`, and fresh showcase captures.
- **Memory:** fix the stale notes on Tier 2 (`mountGpu` always resolves false), pointer vars (`--slfx-px/py` are gone) and ink (now replaced).

**Out of scope:** consumer bumps. Consumers pin `^0.36.x`, which does not accept 0.39.0. They follow later in the documented order: daos, sondalab-site, introspect, spexr.

## Cost estimate

- **Slices:** 7.
- **Agents:** about 14, one Sonnet author and one Sonnet reviewer pass per slice. Opus only if a slice fails once.
- **Effort:** S3 and S6 are the large ones, about 2–3 agent-hours each. The rest take about 1 hour each, so about 10–12 agent-hours in total.
- **Check-ins:** a budget report after each slice.

## Verification

- After each slice, run `npm test` (`node --test scripts/*.test.mjs`) and `node packages/ui-kit/agent/sl-audit.mjs --surface packages/ui-kit/components.css --product default`. Also run the audit on `effects.css`. The repo has no lint or typecheck script.
- In Chrome (Claude-in-Chrome, `computer` hover and zoom, no rAF inside `javascript_tool`), serve on port 8765 with cache-busted asset URLs. Check:
  - `showcase/effects.html` and `showcase/index.html`, in dark, light and high contrast, for every registry accent;
  - a round icon button at rest and hovered: a smooth circle edge, no stepped rim;
  - the wipe in and out, the label flip, contrast through the tint, live light over the fill, the press sink, reduced motion (declared hover only) and `data-sl-fx="off"`.
- Headless captures follow `docs/memory/headless-capture-showcase.md`.
- The final integration PR runs full CI (`check-drift.yml`). The owner tests on the integration branch before the merge to `main`.
