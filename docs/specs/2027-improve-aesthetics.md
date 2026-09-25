---
slug: 2027-improve-aesthetics
title: Improve aesthetics
status: draft
createdAt: 2026-09-10
---

> **What this file is:** the hub for the aesthetic effort of `@sondalab/ui-kit` after the 2026-09-11 pivot. It holds four things and nothing else: the bar (**Goal**, **Non-goals**), the working method that replaces iterate-until-it-convinces (**Method**), the curated visual ground truth everything is measured against (**Reference knowledge base** — owner-filled), and what has to be true before the ambition counts as met (**Acceptance Criteria**). It does **not** decide mechanism, and it is not an implementation plan.
> **Audience:** the owner setting the bar and curating the references; engineers and agents working a slice; reviewers deciding whether a slice is done.
> **Owner:** marcellobarile.
> **Companion files:** `docs/specs/2026-09-08-effects-layer-design.md` (the design contract for the effects layer — the first area this method is applied to; where the two disagree about *mechanism*, that file wins until an explicit ruling here overrules it), `docs/plans/2026-09-08-effects-layer.md` (the implementation record and every ruling to date), `docs/design-language.md` (the human grammar, L6), `sondalab-site/docs/webgpu-surfaces.md` (the boot/fallback pattern), `packages/ui-kit/agent/HANDOFF.md` (what `sl-audit` cannot mechanically check).
> **Ground truth:** the **Reference knowledge base** below. Where a document and a reference card disagree about how something should *look*, the card is right.

## Re-scope — 2026-09-24 (supersedes the handoff below where they disagree)

**If you are the next agent, start here, then read the new cards under Reference knowledge base.** The 2026-09-13 handoff below is the record of the first effects pass and stays accurate about what shipped.

**Why.** After the base-layer sweep (`@sondalab/ui-kit` 0.11.0, `docs/specs/2026-09-24-base-layer-aesthetics.md`, https://github.com/sondalab-ai/sondalab-ui/pull/34) the components are quiet, filled and compact. The owner's ruling on the effects layer as it stands, 2026-09-24: **not striking enough, wrongly placed, and its light is bare minimum next to the state of the art.** Light and kinetics are wanted in all four placements — signature moments, live state, surfaces and controls — so the problem is ambition and quality, not coverage.

**Method, unchanged.** The two loops below still hold: owner-verified cards first, three directions per slice on a contact sheet in `lab/`, the owner picks, the winner is rewritten into the kit under AC-18 – AC-25.

### Rulings (owner, 2026-09-24)

1. **Families are rebuilt around the new cards**, one meaning each (the effects-layer spec's Decision 1 stands):

   | Placement | Family | Means | Built from | Replaces |
   |---|---|---|---|---|
   | Surfaces | **Specular** | this is a physical surface | `linear-specular`, `proximity-glow`, `relight-normals` | glass (blur + rim + glint) |
   | Controls | **Press** | you acted on this | `press-light`, `spring-tokens`, `magnetic-primary` | liquid on buttons |
   | Live state | **Live light** | work is happening here | `pulsing-border`, `edge-breath`, `peripheral-indicator` | aurora (the 1px arc) |
   | Signature | **Signature light** (new) | this is the brand | `halftone-light`, `volumetric-type`, `prism-dispersion` | — |

   Glitch and goo are outside this re-scope and stay as they are.
2. ~~**The refracting lens is retired.**~~ **Reversed by the owner the same day**, after seeing the site on a local 0.12.0 with the material gone: the distortion and dispersion of light are wanted, on every glass host. The frosted pane and the SVG lens stay; the specular edge replaces only the pointer glint, the pane's dispersing edge and the WebGPU chrome. The lens's own open defects ("Why slice 1 is still open", below) stay open with it.
3. **The gooey drop is retired** (`sl-fx-liquid--drop`). Backlog, not scheduled: *the whole shape responds to the pointer as a liquid, subtly* — a future Press direction, never a blister on one spot.
4. **Pointer light is a light source, never a brush.** Governs every family that follows the pointer:
   - the pointer is a light *above* the surface; light appears only where the surface's form catches it — bevel, rim, corners — never as a disc on a flat interior;
   - the highlight is a specular response from the shape's own normals (an SDF of the rounded rectangle), with Fresnel at grazing edges: a thin crescent that turns to face the light;
   - luminance lift of a few percent, falling off with distance; the light is a warm white tinted by the material, never an accent-coloured patch;
   - it trails the pointer on a spring and settles when the pointer leaves; an element at rest carries no light (AC-33);
   - blue-noise dither in the shader, so no falloff bands;
   - **mechanically enforced:** a test fails any pointer-positioned `radial-gradient` in the effects CSS (lands with slice R1, together with the code it replaces).
5. **Order:** Surfaces → Controls → Live state → Signature. Surfaces first because it touches every card, button and dialog and unblocks slice 1; Signature last because it is hero-only and the heaviest GPU work.

### Slice log (re-scope)

| # | Placement | Cards | Directions probed | Picked | Rejected | Status |
|---|---|---|---|---|---|---|
| R1 | Surfaces | `linear-specular`, `proximity-glow`, `relight-normals` | A crisp bevel (WebGL SDF specular) · B proximity edge (CSS) · C material relight (WebGL + microsurface) | **B** (owner, 2026-09-24); direction sprung as a vector after the owner saw the arc jump on a crossing | A — correct but quiet; the crescent needs a GPU for a reading B gives in CSS; C — the grain adds texture the quiet base does not ask for | **promoted** — `sl-fx-glass`'s pointer light is the specular edge (same class); glint, dispersing edge and WebGPU chrome retired; frost and lens kept on every glass host (owner reversal, 2026-09-24) |
| R2 | Controls | `press-light`, `spring-tokens`, `magnetic-primary` | A press light + spill · B springs only · C magnetic primary + press light (`lab/r2-controls.html`) | **A** (owner, 2026-09-25) | B — springs alone carry no light; C — magnetism on the primary not wanted | **promoted** — new family `sl-fx-press` (press light from within, spill onto neighbours within 48px), new token `--sl-motion-spring` (press sink, switch knob); the pane's hover lift retired |
| R3 | Live state | `pulsing-border`, `edge-breath`, `peripheral-indicator` | A volume · B breath · C peripheral (`lab/r3-live.html`) | **A** (owner, 2026-09-25) | B — nothing travels, so a running agent reads like a loading panel; C — too quiet for the agent wall | **promoted** — `live-light.js` (WebGL): `data-sl-fx-live="run"` travels two bodies of light round the edge, `"busy"` breathes the edge; `--linear` gets a travelling segment; `sl-badge--live` breathes its dot; the CSS arc is the fallback |
| R4 | Signature | `halftone-light`, `volumetric-type`, `prism-dispersion` | | | | not started |
| R5 | Lens (added by the owner, 2026-09-24) | `linear-specular` (rim light), glass-studio / kube.io refraction | A shipped lens · B Snell bevel, per-channel index · C B + dispersed edge (`lab/r5-lens.html`) | | | sheet ready 2026-09-25 · **A with a slightly convex distortion** (owner, 2026-09-25); strength strip at `lab/r5-convex.html` (3 / 6 / 10% centre magnification) | B, C — the Snell bevel not preferred | picked · strength pending; black-rectangle defect not reproduced on filled panes, dark or light |

## Start here — handoff, 2026-09-13

**If you are the next agent, read this block and the Reference knowledge base;
the rest of this file is a chronological record and reads best from here
downward, not from the bottom up.**

**State.** The layer is **released**. `feat/effects-layer` merged as
https://github.com/sondalab-ai/sondalab-ui/pull/22 and everything after it has
landed in small branches; `main` carries kit **0.9.5**, published. One kit
branch is open — `feat/curtains-fit-their-pane`,
https://github.com/sondalab-ai/sondalab-ui/pull/28, kit **0.9.6**: **268 tests
green** (`node --test scripts/*.test.mjs`), `npm run audit -- --surface
"packages/ui-kit/effects.css" --product effects` clean. It carries three things
that were briefly three branches — the curtains fitted to their pane, the glass
cut to a letterform, and this record — collapsed into one release because none
of them had been published.

The first consumer is **`sondalab-site`**, which pins **0.9.5** and carries 24
commits on `tune/method-goo-contrast`
(https://github.com/sondalab-ai/sondalab-site/pull/11, **draft until 0.9.6
publishes** — on 0.9.5 the page renders degraded, not broken). While PR 28 is
unpublished that site runs against a **symlink** into this repo's
`feat/curtains-fit-their-pane` worktree, with the published copy set aside as `node_modules/@sondalab/ui-kit.published`;
its own `npm run audit` wrapper exits silently under that rig, so audits there
are run against the set-aside copy's `agent/sl-audit.mjs`. Undo the symlink once
0.9.6 publishes. The kit ships:

- `glass.css` — the glass MATERIAL, adopted from liqui-glass (MIT), matched to
  its capture within ±3 luminance on `lab/1n`; tint 0.18, floored at 0.34 under
  a lens so a ghost pane's label always has something to sit on
  (`--slg-tint-lens`); layers sit at negative z-index under the host's own
  label; `__specular` paints nothing.
- `glass-lens.js` — a REAL refraction, adopted from shuding/liquid-glass (MIT):
  `backdrop-filter: url(#…)` with a data-URI displacement map; per-channel
  dispersion (`disperse`, the red-to-blue separation in PIXELS, default 18,
  and since 0.9.6 **readable from the element as `--slg-lens-disperse`** so a
  surface can raise it without a second `mount` argument);
  bend capped at `reach`, 6 px for the material and **readable from the element
  as `--slg-lens-reach`**, which the aurora's hosts raise to 18 px; **the lens
  refuses a pane shorter than six times that cap** and leaves it the material; frost and saturation animatable via
  `--slg-lens-blur` / `--slg-lens-sat`.
- `effects.css` / `effects.js` — the aurora's light is **the curtains**
  (`--pillars`), by default on every host that does not ask for another
  (`--sweep`, `--beam`, `--rim`), and it is **white**: both curtains are the
  page's derived light pole, so the only colour in a pane is the colour the
  glass makes of it (rgb spread 3 in the middle, 46 at the faces). Fitted on
  `lab/1y` (2026-09-12): ribs 32 %, curtains 45 / 42 %, blur 8 px, pitch
  320 / 480 px — **the two pitches are superseded in 0.9.6**, which derives one
  from the host; the alphas and the blur stand. **How many curtains hang across a pane is the author's, and how
  wide one is follows the host** (2026-09-13): `--slfx-pillar-count` (default
  3) is read off the host by `seatGlow()`, which divides the host's own width
  by it and writes the pitch; every stop, both tiles and the sway are fractions
  of that one length, in the ratios they were fitted at. Left absolute, the
  fitted 104 px made a 1104 px row show nine ribs where the 320 px card it was
  measured on showed three, and the owner read the difference as stripes rather
  than as light. The 104 px stays as the Tier 0 fallback, so a page that never
  mounts keeps exactly the pattern it had. **And each pane drifts on a phase of
  its own**: every animation starts when its rule begins to match, so a surface
  that lights all its cards at once started them together and they moved in
  formation — `--slfx-pillar-phase`, an ordinal spread by the golden ratio,
  becomes a negative delay on both clocks (different multipliers, or the offset
  moves the formation rather than breaking it). **Loading and busy are an aurora that runs the whole border, in
  the accent**: the curtains stand down and the glow paints the conic band on
  the element's own edge, turning once per 5.5 s — cut across the lens's pull, so they bend where the
  band cannot. Determinate keeps its arc, whose length is the value. The
  glow is a SIBLING seated before the host, so it is in the backdrop and the
  lens bends it — which is the whole reason the curtains are the default: a
  wash that follows the edge moves 0.93 % of its pixels under the lens, the
  curtains 5.00 %.
  The conic bloom, kept for `--sweep` / `--beam` / `--rim`, is solved against
  border-beam's composer at its own zoom on `lab/1x`: `--slfx-bleed` 10 px,
  blur `--slfx-soft` 6.5 px, alphas 44 / 33 % of the vivid accent lifted a
  quarter toward white (chroma kept), arc 90°, hairline `--slfx-ring-lit`
  0.28, the seated glow clipped to the host's box (except `--beam`, `--rim`
  and `--pillars`, whose geometry is not the spread). Twelve `--slfx-*`
  variables are copied onto the seated glow.
- the showcase is back to defaults. `lab/` keeps only its **harness**
  (`_template.html`, `_harness.*`, `_serve.py`, `_pixdiff.py`, `_profile*.py`,
  `README.md`); the 28 direction probes it held were deleted on 2026-09-13 —
  they were gitignored and disposable by construction, and every number they
  produced is recorded in the dated sections below.

**1w, 1x and 1y are closed — see the three sections below for the numbers**,
and read them in that order: each one answered the owner's verdict on the one
before it.

- **1w** hooked the handoff's curve as stated and found two kit defects (a
  padding ring that could not fit a host shorter than 88 px; a `calc()` the
  seat read as nothing), each fixed with a regression test.
- **1x** followed *"non siamo ancora vicini"*: the reference re-read at its own
  zoom (it is a DPR-2 capture), with the colour's saturation measured beside
  its luminance. The conic bloom reads +42.9 / +34.2 / +27.9 / +19.8 / +11.8 /
  +4.0 / 0 at 4 / 8 / 10 / 12 / 15 / 20 / 30 px against the reference's
  +43 / +34 / +27 / +20 / +13 / +4 / 0, same rgb spread, nothing outside.
- **1y** followed *"luce vera che si deforma dietro al vetro"* and changed the
  light model: the curtains are the aurora's light, because a lens can only be
  seen to bend what has structure (0.93 % of the bloom's pixels move under the
  lens, 5.00 % of the curtains'). **It supersedes 1x's fit as the DEFAULT
  light** — the conic bloom and its numbers stay for `--sweep`, `--beam` and
  `--rim`.

**That open question is now closed** (2026-09-13). It asked how far the white
light should be made to decompose; the owner's answer was *"ancora di piu', deve
essere molto accentuato"*. It was **not** settled by moving the default — the
kit keeps `disperse` at 18, because raising it applies to everything behind a
pane and at 60 the page's own text splits into visible red/green/blue copies.
It was settled by making the value **readable from the element**
(`--slg-lens-disperse`, 0.9.6): a surface that wants the split raises it on the
panes that should have it and leaves the rest of the page alone. `sondalab-site`
sets 90 on its card panes.

**Otherwise no task is assigned.** One thing stays the owner's: the 1 px line on
the reference's border where the beam passes (ours is the glass rim plus a
0.28 ring; see 1w's list). Whether a card is glass is **ruled** (2026-09-12,
below): it is, with distortion and refraction, and the refraction wins where
it pulls against the composer's flat-light curve. The kit's release and the
GPU tier's cut are the owner's decisions.

**Traps that cost hours, in order of cost:**

1. **Do not eyeball.** Three "it's there now" readings were wrong. Diff a
   capture against the same capture with the layer `display:none`
   (`lab/_pixdiff.py`), and read computed style for variables — a `::before`
   with an undefined `var()` renders nothing while looking healthy.
2. **The extension's tab is `visibilityState: hidden`.** rAF, IntersectionObserver
   and CSS transitions never settle there. Drive things by hand and say so;
   only the owner's real browser judges motion.
3. **A page that animates has no noise floor.** Two captures of the showcase
   with nothing changed differed by **39 %** — its own keyframes advance
   between calls. Freeze first (`*, *::before, *::after { animation: none
   !important; transition: none !important; }`), take a control pair, and only
   believe a diff once the control reads 0. Three showcase measurements were
   taken and thrown away before this was noticed.
4. **Capture with the extension's `zoom`, never its `screenshot`.** The full
   screenshot is a JPEG scaled to 1565 px wide (0.815 of a 1920 viewport) and
   useless for pixels. `zoom` with `save_to_disk` writes a PNG at DPR 2 — one
   CSS px is two capture px, measured on a 321 px card — but its `region` is
   in the screenshot's scaled frame (divide CSS px by 0.815), and passing
   `scale` shrinks the saved file too. Two identical zooms differ by 0 px, so
   a non-zero diff is signal.
5. **Serve with `python3 lab/_serve.py`**, never `python3 -m http.server`: the
   latter sends no cache headers and a stale stylesheet beside fresh JS
   produced false readings twice. Kill any other server on other ports first.
6. **A sibling inherits nothing from the host.** Anything moved out of the host
   needs its variables copied (`GLOW_VARS` in `effects.js`) and its own
   `z-index: auto` — `-1` under a non-stacking parent falls behind the page.
   And an `@property` with `inherits: false` (`--slfx-angle`) is not seen by
   the pseudo-element that paints from it: pin it ON the pseudo-element.
7. **A `calc()` custom property computes to text unless registered.**
   `parseFloat("calc(14px * 3 + 12px)")` is `NaN`; register lengths JavaScript
   has to read (`--slfx-glow` is, now).
8. **`sl-audit` reads comments.** No hex, no `rgb()`, in prose either.
9. **The guards are contracts, not obstacles.** Eight edge rules may declare a
   background, each named; the radius guard exempts only `--beam`/`--pillars`.
   Extend them with the reason, never bypass.

**Owner's standing rulings:** use the knowledge base, do not reproduce it
("prendi spunto, non usare la libreria"); AC-33 overridden for glass (every
layer on at rest); tint 0.18; hover lift 3 % with a soft settle; button radius
`--sl-radius-lg`; the aurora's model is border-beam's page, not its README;
the reference is read at its own zoom (2026-09-12, after 1w); **a card is
glass, with distortion and refraction** (2026-09-12, on 1x: "deve essere
vetro con effetti di distorsione, rifrazione, etc.") — the composer's plain
edge is not taken, and the material's inset rim stays on cards.

Added 2026-09-13:

- **No light follows the pointer on a card.** The pointer glint stays on
  buttons, where it answers a hit target; on a card it was refused outright
  ("in generale non mi piace quel glow che segue il mouse, va rimosso ovunque").
- **Every card's curtains stay lit, not one at a time.** A rotation was tried
  and rejected; the kit's one-live-aurora grant governs the *ambient* aurora,
  and a page of glass cards lighting them all is a surface decision.
- **The band count is the intensity knob.** `--slfx-pillar-count`, with the
  width following from it — fewer bands, wider bands.
- **The dispersion is raised per surface, not in the default** (see the closed
  question above).
- **A display-scale numeral stays mono.** Fraunces at `opsz` 144 was tried on
  the method cards and rejected as the wrong voice for a tech/cyberpunk
  project; variation is spent on shape and colour instead. Written into the
  grammar at `docs/design-language.md` L1.

## Goal

We should strengthen the aesthetics of the design system, and make it appear unique. We should add lighting, and kinetics effects depending by the element we are considering. It is a must to use webgpu whenever possible, and always provide a fallback when that's not available because not supported by the client.

While looking for gradients, effects, and animations, we should rely on the state-of-the-art of UX and design, searching the web if necessary.

## Non-goals

- Cheap and mediocre solutions
- Bland UI and effects
- Common AI-generated solutions
- **Exploration that costs as much as delivery** — a direction probe built inside the published package, at production quality, that someone then has to defend (added by the pivot; see below)

## Why this file changed shape — the 2026-09-11 pivot

Three iterations of the effects layer were run on model-led judgement (Opus, then Fable), each producing a result the owner was not convinced by. The diagnosis is **not** that the specification was too thin: `2026-09-08-effects-layer-design.md` measures its reference from the reference's own source, fixes a semantic grammar, a budget, three tiers and a per-component declension, and it still records — in its own §Decision 2 — that *"This decision has been wrong twice"*, and in `620b7b7` that a report *"claimed a result it did not have"*.

Two failure modes were running at once, and the owner confirms both: **fidelity** (the render never reached the reference he had in mind) and **direction** (the render did what the spec said, and the spec pointed at the wrong thing). They need loops with opposite economics, and until now they shared one loop. Every direction probe was built inside the published package, under the audit, the colour gates and the tests — so trying a direction cost a full implementation and discarding one meant overturning a written Decision. When exploring costs what delivering costs, you explore once and marry the first result.

The spec's own confession is the other half: *"Nothing in this repository renders a frame. Every real defect in this layer was found by looking at the rendered page beside the reference, and none by reading."* The only aesthetic instrument in the loop was the owner's eye, one round trip at a time, on four families across fifteen components.

## Method — two loops, three artifacts

| Artifact | Loop | Lives in | Rules that apply | Disposable |
|---|---|---|---|---|
| **Reference cards** | — (input to both) | `docs/references/` + the index below | curated by the owner; every value read from the reference, never inferred | no — they outlive every slice |
| **Direction probes** | **divergence** — many cheap variants, looked at together, one chosen | `lab/` (outside `packages/`) | none. No tokens, no `sl-audit`, no tests, no kit imports, no review | **yes, by construction** — a probe is never merged into the package |
| **The promoted variant** | **convergence** — measured against the card until it lands | `packages/ui-kit/` | all of them: the AC-18 – AC-25 gates, colour contract, tiers, kill switches, tests | no |

The rule that makes the split work: **a direction probe never enters the published package.** It is the only thing that makes ten probes cost less than one implementation.

Order of work in a slice: (1) the owner fills the reference cards for **one element**; (2) probes are built in `lab/` and rendered side by side; (3) the owner picks, and the rejected ones are recorded, not kept; (4) the winner is promoted into the kit under the AC-18 – AC-25 gates, carrying rendered evidence beside the card; (5) the ruling is written down — chosen, rejected, why. The spec entry is written **last and thin**: a minute of the decision, not a plan.

## Reference knowledge base

**Owner-filled. This is the ground truth of the whole effort, and the part no model can supply.**
Governing rule for anyone implementing: **no value is invented where a reference can supply one.**

Glassmorphism design system principles:
- https://open-design.ai/plugins/design-system-glassmorphism/
- https://www.designmonks.co/blog/liquid-glass-vs-glassmorphism
- _(slot — source to add)_

Glassmorphism and liquid glass implementations:
- Liquid Glass Vue WebGL implementation https://liquidglassdesign.com/resources/liquid-glass-vue (see if we can port it to our webgpu based solution)
- Liquid glass components https://liqui.design/docs/components
- STRONG CODE HINTS HERE: https://github.com/iyinchao/liquid-glass-studio

### Index

`carried over` = extracted from `2026-09-08-effects-layer-design.md`, where it was measured from the reference's own source.

**All eight cards were verified by the owner on 2026-09-11**, which closes AC-1 for slice 1. The *State* column records two independent things: whether the owner has signed the card, and whether the element the card describes has been **captured to disk** — four cards have captures, four are measured from source or carry no measurable values at all, and that is a property of the reference, not a gap in the card.

| Slug | Governs | Source | State |
|---|---|---|---|
| `metal` | glass — ring, cursor light, dispersion | https://libraries.dev/metal · https://github.com/Jakubantalik/Libraries.dev (`packages/metal-fx/src`) | verified 2026-09-11 · captured |
| `border-beam` | aurora — the arc and its bloom | https://libraries.dev/beam | verified 2026-09-11 · captured |
| `gooey` | liquid — the skin below the content | https://libraries.dev/gooey | verified 2026-09-11 · captured |
| `liqui-glass` | glass — **the text button**, and the layer architecture | https://liqui.design/docs/components/button | verified 2026-09-11 · captured · measured from the rendered component |
| `glass-studio` | glass — parameter set, backend policy, LCH lighting | https://github.com/iyinchao/liquid-glass-studio | verified 2026-09-11 · no capture — measured from source at `HEAD` |
| `glass-vue` | glass — a second WebGL-only implementation | https://liquidglassdesign.com/resources/liquid-glass-vue · https://github.com/Muggleee/liquid-glass | verified 2026-09-11 · no capture — demo only, supplies no values |
| `liquid-vs-glass` | vocabulary — what separates liquid glass from glassmorphism | https://www.designmonks.co/blog/liquid-glass-vs-glassmorphism | verified 2026-09-11 · no capture — definitional, supplies no values |
| `od-glassmorphism` | **negative reference** — the generic look the non-goals reject | https://open-design.ai/plugins/design-system-glassmorphism/ | verified 2026-09-11 · no capture — the values are the point |

Every source the owner put in the knowledge base above is now a card, which is what AC-35 asks for. Three of them (`glass-vue`, `liquid-vs-glass`, `od-glassmorphism`) turned out to carry no measurable parameters; they are kept as short cards saying exactly that, because "we looked and it had nothing" is worth recording once rather than re-discovering.

Slice 1's assignment, after the 2026-09-11 pass: **`liqui-glass` governs the text button**, `gooey` the round icon-only one, `border-beam` the focus state of both, with `metal` and `glass-studio` supplying the glass parameter grammar across both silhouettes. It **did** need a new slug — the original line here assigned the text button to `metal`, which has no text button (Note 8).

Every card below reads `Verified by owner: yes — 2026-09-11`. That field means *a person looked at this*, and it was the owner who set it; nothing else in this file may set it.

### Capture protocol

Captures live in `docs/references/assets/` as `<slug>-<variant>-<state>-<ground>.png`. One rule, so two captures can be laid side by side: **a 320 × 200 CSS-px region of the viewport, centred on the element, at the page's own zoom** — the crop size is fixed, the centre moves with the element. A second, optional **160 × 100 detail crop** carries pixel-level claims (a rim, a hairline) and is named `-detail`. The `<ground>` segment is `dark` or `light` where the reference has themes, and **`fixedbg`** where the demo sits on its own backdrop and does not follow the page theme — asserting `-dark` on such a file would claim something the file does not carry.

The twelve captures now on disk total 248 KB, which settles Note 6's weight question for a repository of this size.

**Glass has no light-ground reference, on either source.** libraries.dev is dark-only: `data-theme="dark"` is hard on `<html>`, the menu offers no switch, forcing the attribute to `light` changes nothing. liqui.design *does* have a theme toggle and it works on the page chrome — but the component tiles keep their own fixed colourful backdrop, and the proof is measured rather than eyeballed: the same crop taken in dark and in light differs by **0 pixels of 114 704**. So no reference in this knowledge base shows glass on a light ground; `metal`'s light-mode numbers (`multiply` at 0.27 under `saturate(5.4)`) come from `metal-fx`'s source, not from anything rendered. See Note 7 for what follows for AC-3 and AC-4.

That 0-pixel control is also what makes the other measurements here trustworthy: the capture pipeline adds no noise, so a non-zero diff elsewhere is signal.

### Cards

#### `metal` — Libraries.dev "Metal" *(carried over; captured and verified 2026-09-11)*

- **Source:** https://libraries.dev/metal · **Code:** https://github.com/Jakubantalik/Libraries.dev, `packages/metal-fx/src`
- **Capture:** `docs/references/assets/metal-circle-pointer-off-dark.png` and `metal-circle-pointer-on-dark.png` (v2, chromatic, circle button) · `metal-text-hover-dark.png` (the playground's **Text** type, cursor visible on the glyph). Captured 2026-09-11 from the page's own playground, dark only, per the capture protocol above. **What they evidence, and what they do not:** both circle frames show the always-on ring and a wandering halo — that is the *Leave* line's subject, and it is well evidenced. They are otherwise **indistinguishable**, and neither renders a cursor (the text frame does), so **the cursor light and the ring bend are not captured here**; the card's numbers for them still rest on `metal-fx`'s source, and the reading is the owner's to take in the interactive pass
- **Technology:** 2D-canvas hairline + a WebGL "plasma" environment texture + SVG `feDisplacementMap` for the bend; halo as blurred SVG strokes
- **Measured:** ring **1–2 px, exactly on the element's border**; seven-stop moving environment (mostly white and black, pastel flecks `#aae8ff`, `#c5fe9e`, `#f7888d`, `#fffdc3`, `#007cff` in the chromatic preset); bend `applyTo: 'ring'` — strength **0.74**, reach **36 px**, cap **9 px**, fade **200/350 ms**; cursor light reach **56 px**, spill a **48 px** glint at peak **0.55** tinted by the ring; light mode composites the glow with `multiply` at **0.27** under `saturate(5.4)`; colour separation is one knob — `shiftRed`/`shiftBlue` **0.3** (**0.75** chromatic)
- **Take:** the pixel restraint (one to two pixels on an edge, never more); dispersion as the single colour-separation knob; "content and glow stay rigid" — the bend is a vector outline, not a filter over the label
- **Leave:** the always-on ring (owner ruling: an element at rest carries no light); reflections cast onto neighbouring elements (needs a page-level surface, rejected)
- **Governs:** glass — the edge, the pointer light, the dispersion
- **Verified by owner:** **yes** — 2026-09-11

#### `border-beam` — Libraries.dev "Border beam" *(carried over; captured and verified 2026-09-11)*

- **Source:** https://libraries.dev/beam · **Code:** as above
- **Capture:** `docs/references/assets/border-beam-large-rotate-colorful-dark.png` (Rotate · Large · Colorful, read off the control panel) · `border-beam-rotate-colorful-a-dark.png` and `border-beam-rotate-colorful-b-dark.png` (same, after clicking Type toward **Line** — **the toggle was not confirmed in a screenshot, so treat the Type as unknown on these two**). Captured 2026-09-11, same protocol; the two are ~8 s apart, roughly four full turns, not two phases of one. **What they evidence:** the bloom and the ~28 px inner wash, both very quiet, which is consistent with the *Measured* line's 0.24–0.42. **No crisp 1 px arc is visible in any of the three** — a still cannot carry a travelling arc, so that half of the card is the owner's interactive pass, not these files
- **Technology:** CSS only — `@property` angle, `conic-gradient` masked to a 1 px ring, radial colour blobs, a blurred copy for the glow, `hue-rotate` drifting
- **Measured:** **1 px** arc of light travelling the border, **1.96 s** per turn; hue drift **±30°**; every layer at **0.24–0.42** opacity; inner wash confined to a **~28 px** band inside the edge
- **Take:** the recipe entire — this is the look the owner pointed at, and it is CSS at every tier
- **Leave:** any attempt to redo it on the GPU — a shader aurora was built first and read as marbling, not as light
- **Governs:** aurora — arc, bloom, wash
- **Verified by owner:** **yes** — 2026-09-11

#### `gooey` — Libraries.dev "Gooey" *(carried over; captured and verified 2026-09-11)*

- **Source:** https://libraries.dev/gooey · **Code:** as above
- **Capture:** `docs/references/assets/gooey-rest-dark.png` (closed) · `gooey-open-dark.png` (open — the silhouette below the content is visible as a blob behind the four pieces, which is the *Take* line's evidence) · `gooey-partially-closed-dark.png` (pieces part-way back). Captured 2026-09-11, same protocol. The last two were taken with the page's transitions slowed to 6 s by an injected `transition-duration` override — timing only, the geometry is the reference's. **The merging neck is not legible in the part-way frame**; it forms at a separation these captures missed, so the blur-then-contrast chain's actual reading is still the owner's interactive pass
- **Technology:** SVG filter — `feGaussianBlur` then an `feColorMatrix` alpha slope — applied to a **silhouette layer below the content**; the real DOM rides crisp on top
- **Measured:** `blur = 6`, `contrast = 18`; nothing in the UI itself is filtered — **both numbers re-read from the playground's own controls on 2026-09-11** ("Goo blur 6", "Contrast 18"), so this card's *Measured* line no longer rests on the carried-over reading
- **Take:** the silhouette-below-content architecture; the blur-then-alpha-contrast chain
- **Leave:** filtering the host (text refracts, the border re-rasterises at DPR 2, and it reads as a lens); applying it to anything but a round silhouette
- **Governs:** liquid — the skin
- **Verified by owner:** **yes** — 2026-09-11

#### `liqui-glass` — Liqui Design "Button" *(captured, measured and verified 2026-09-11)*

**This is the card slice 1's text button was missing.** It is the only reference in this knowledge base that shows a *text* button as a glass surface; `metal`'s only button is round (see Note 8).

- **Source:** https://liqui.design/docs/components/button · **Distribution:** `npx shadcn add https://liqui.design/r/button.json`, kernel package `@liqui-design/glass`
- **Capture:** `docs/references/assets/liqui-button-text-glass-fixedbg.png` (the 76 × 35 button on the doc tile's backdrop) · `liqui-button-text-glass-detail-fixedbg.png` (160 × 100 detail on the rim) · `liqui-button-text-glass-refract-off-fixedbg.png` (the A/B control described under *Measured*)
- **Technology:** six stacked layers under one host, read off the live DOM — `__backdrop`, `__refract`, `__tint`, `__specular`, `__shine`, then `__content` on top. The host itself paints nothing: no background, no border, no shadow, `border-radius: 12px`, and its only transition is `transform` and `box-shadow` over **0.15 s** `cubic-bezier(0.4, 0, 0.2, 1)`
- **Measured**, per layer:
  - `__backdrop` — `backdrop-filter: blur(5.9px) saturate(1.7)`. This is the whole frost, and it is **under 6 px**
  - `__refract` — `backdrop-filter: url(#lq-refract-0)`, a filter chain of `feImage` (a data-URI displacement map sized to the element, `userSpaceOnUse`, 76 × 35) then `feDisplacementMap in="SourceGraphic" in2="map" scale="45" xChannelSelector="R" yChannelSelector="B"`, at `color-interpolation-filters="sRGB"`. Note the **B** channel for Y, not the usual G
  - `__tint` — `linear-gradient(135deg, rgba(30,32,46,.62), rgba(18,20,32,.4))` at opacity **0.5125**. The tint is **dark**, not a white wash
  - `__specular` — a **pre-baked PNG** (data URI) at opacity **0.7**; the highlight is an image, not a gradient
  - `__shine` — inset box-shadows only: `rgba(255,255,255,0.5) 0 1px 1px 0 inset` plus a 1 px side pair. **The bright rim is an inset shadow, not a border**
- **Measured — what `__refract` actually does in Chrome 152.** Toggling only that layer's `backdrop-filter` to `none` and diffing the identical crop changes **45 pixels of 114 704 (0.04 %), max channel delta 13/255**, confined to rows 118–125 and 143–151 — the top and bottom rim bands. The backdrop's own horizontal hairline is row **135** (luminance 184.4, the brightest row in the frame) and it has **zero** differing pixels. So the filter is applied and composites at the rim, and it does **not** displace the backdrop: at `scale=45` on a 76 × 35 element a working displacement would be unmissable. This **refines** `620b7b7` rather than overturning it — see Note 3
- **Take:** the layer architecture — one host that paints nothing, named single-purpose layers, content crisp on top (the same shape `gooey` arrives at from the SVG side); the frost kept **under 6 px**; the rim as an **inset** shadow so it cannot fatten the box; the documented variant rule — *"Variants don't paint over the glass — they override `--lg-tint`, so the lens keeps refracting the background through the accent colour instead of hiding it"*, which is the same instinct as this repo's colour contract, where an accent is a token the effect reads and never a paint
- **Leave:** **its resting state.** Every layer is on at rest — tint at 0.5125, a specular PNG at 0.7, the shine shadows always painted — and AC-33 says an element at rest carries no light. This is the same ruling `metal`'s *Leave* line already makes about the always-on ring, and it applies here in full. Also leave the pre-baked specular PNG: a raster highlight cannot follow a token through a theme change, which AC-18 forbids
- **Governs:** glass — the text button's architecture and its edge
- **Verified by owner:** **yes** — 2026-09-11

#### `glass-studio` — Liquid Glass Studio *(measured from source and verified 2026-09-11)*

- **Source / code:** https://github.com/iyinchao/liquid-glass-studio · demo https://liquid-glass-studio.vercel.app/ · read at `HEAD` of the default branch
- **Capture:** _none — this card is measured from source, not from a render; the demo's own screenshots are in the repository at `.github/assets/`_
- **Technology:** one shader set maintained in **two ports** — GLSL (`src/shaders/`) and WGSL (`src/shaders-wgsl/`) — behind a renderer switch; shapes are SDFs (`roundedRectSDF` with a superellipse exponent, merged by `smin`), blur is multipass
- **Measured — the default parameter set** (`src/Controls.tsx`): refraction thickness **20** (range 1–80), distance **0.05** (0–0.2), factor **1.4** (1–4), dispersion **7** (0–50); Fresnel range **30**, hardness **20**, factor **20**; glare range **30**, hardness **20**, factor **90**, convergence **50**, opposite-side factor **80**, angle **−45°**; blur radius **1** (range 1–200); **tint `rgba(255,255,255,0)` — fully transparent by default**; shadow expand **25**, factor **15**; shape 200 × 200, corner radius **80**, superellipse roundness **5** (2–7), merge rate **0.05**; spring size factor **10**
- **Measured — dispersion is an index-of-refraction triple**, not a pixel offset: `N_R = 0.98`, `N_G = 1.0`, `N_B = 1.02` (`fragment-main.wgsl`) — ±0.02 around 1.0
- **Measured — lighting is computed in LCH, not sRGB.** Fresnel and glare both convert with `SRGB_TO_LCH`, add to lightness and chroma (`L += 20 · fresnelFactor · factor`; `L += 150 · glareAngleFactor · geoFactor`, `C += 30 · …`), clamp (`L` to 0–100, and to 0–120 for glare), then convert back with `LCH_TO_SRGB`. The clamp is a clamp, not a gamut map
- **Measured — the backend policy.** WebGPU is **not** the default and **not** required: the renderer control ships `selected: ['webgl']`, `App.tsx` holds `useState<'webgl' | 'webgpu'>('webgl')`, and the WebGPU option is rendered `disabled` with a human-readable `reason` string from `detectWebGPU()` when the adapter or device is missing. Detection is cached, promise-deduplicated, and every failure path returns `{ supported: false, reason }` rather than throwing
- **Take:** the two-port discipline — the same look expressed on the cheaper backend first, the GPU as an opt-in second path, which is what AC-15 already asks of `mountGpu()`; **lighting arithmetic in a perceptual space**, which is what this repo's own oklch lightness floor and gamut fit already do, now with a second source behind it; dispersion as a per-channel IOR triple rather than a pixel shift; one SDF covering both silhouettes, where a circle is just a rounded rect at a large radius — which is directly the question slice 1 is scoped to answer
- **Leave:** the clamp-instead-of-fit on the LCH result — `scripts/effects-gamut.test.mjs` exists precisely because Chrome clips in sRGB and moves hue silently, and this reference takes the shortcut this repo already rejected. Leave the 25/15 drop shadow (AC-32's bloom limit) and the video backdrops
- **Governs:** glass — the parameter set, the backend policy, the colour space of the lighting
- **Verified by owner:** **yes** — 2026-09-11

#### `glass-vue` — Liquid Glass Vue *(read and verified 2026-09-11)*

- **Source:** https://liquidglassdesign.com/resources/liquid-glass-vue · **Code:** https://github.com/Muggleee/liquid-glass
- **Capture:** _none — nothing measurable to capture_
- **What it is:** a Vue 3 + Vite demo, not a library. WebGL2 with GLSL ES 3.0, shapes defined by SDF
- **Measured:** **nothing.** The page states no parameter names and no numeric defaults; the values would have to come from the linked repository, which has not been read
- **Take:** one corroborating data point and no more — a second independent liquid-glass implementation that is **WebGL2-only, with no WebGPU path at all**. Read alongside `glass-studio`, the knowledge base now contains zero implementations that require WebGPU
- **Leave:** treating this as a source of values. It has none, and the KB rule is that no value is invented where a reference can supply one — this one cannot
- **Governs:** nothing on its own; evidence for Note 2
- **Verified by owner:** **yes** — 2026-09-11

#### `liquid-vs-glass` — "Liquid Glass vs Glassmorphism" *(read and verified 2026-09-11)*

- **Source:** https://www.designmonks.co/blog/liquid-glass-vs-glassmorphism
- **Capture:** _none — definitional, nothing to measure_
- **Measured:** **nothing.** The article gives no blur radii, no opacities, no contrast ratios
- **Take:** the distinction, as vocabulary this file can use precisely: liquid glass *"reacts to light, depth, and motion"* and refracts in real time, where glassmorphism is a *"static frosted blur"* whose *"opacity stays fixed after you set it once"* and whose *"one consistent Gaussian blur value covers the entire card background"*. That is a usable operational test for the "not generic glassmorphism" non-goal — if the effect has one blur and one opacity and never responds, it is the thing the non-goals reject
- **Also worth carrying:** the article flags both styles as struggling with WCAG contrast and text readability, rating liquid glass the higher risk. AC-25 (text is never filtered) and the repo's existing contrast gates are the answer, and they should not be relaxed on a glass surface
- **Leave:** everything else; there is nothing else
- **Governs:** the wording of the non-goals
- **Verified by owner:** **yes** — 2026-09-11

#### `od-glassmorphism` — OpenDesign glassmorphism tokens *(read and verified 2026-09-11 — **negative reference**)*

**Kept as the thing to steer away from.** A reference card usually says what to reach for; this one records what the non-goals mean concretely, so "generic" stops being an unfalsifiable adjective.

- **Source:** https://open-design.ai/plugins/design-system-glassmorphism/ — a token collection for the OpenDesign tool
- **Capture:** _none — the values are the point_
- **Measured:** surfaces `rgba(255,255,255,0.74)` and `rgba(255,255,255,0.72)`; borders `rgba(255,255,255,0.64)` and `rgba(255,255,255,0.38)`; raised shadow `0 24px 80px rgba(79,140,255,0.18)`; focus ring `0 0 0 4px rgba(79,140,255,0.28)`; corner radii 16 px to 9999 px. It states **no blur radius at all**
- **Take:** nothing to take. Its value is the contrast: a white fill at 0.74 over a 24/80 blue-tinted drop shadow is the generic look, and every number in it runs the opposite way from `liqui-glass` (a *dark* tint at 0.5125, frost under 6 px, the rim an inset shadow) and from `glass-studio` (tint alpha **0**, blur radius **1**). A design system that ships a glassmorphism token set without a blur value is describing a style, not a material
- **Leave:** the whole set. Named here so that "bland" and "common AI-generated solutions" in the non-goals have an address
- **Governs:** the non-goals, by counter-example
- **Verified by owner:** **yes** — 2026-09-11

### Cards — re-scope, 2026-09-24

Chosen by the owner on 2026-09-24 from a research sweep of 2024–2026 work. **None is verified yet**: every line below was read from the source's text, not from watching the effect run, and *Take* / *Leave* are drafts for the owner to correct. `Verified by owner` is the owner's to set, as for the cards above. No captures yet; the capture protocol above applies when they are taken.

| Slug | Governs | Source | State |
|---|---|---|---|
| `linear-specular` | Specular — the highlight model | https://linear.app/now/linear-liquid-glass | chosen 2026-09-24 · **verified 2026-09-24** |
| `proximity-glow` | Specular — the edge facing the pointer | https://codepen.io/jh3y/pen/QWYPaax | chosen · **verified 2026-09-24** |
| `relight-normals` | Specular — imagery and the paper ground | https://tympanus.net/codrops/2026/08/19/relighting-images-with-depth-maps-and-three-js/ | chosen · **verified 2026-09-24** |
| `press-light` | Press — light on press, spill to neighbours | https://developer.apple.com/videos/play/wwdc2025/219/ | chosen · **verified 2026-09-24** |
| `spring-tokens` | Press — spring motion as a CSS token | https://linear-easing-generator.netlify.app/ | chosen · **verified 2026-09-24** |
| `magnetic-primary` | Press — pull on the primary call to action | https://motion.dev/examples/js-spring-follow-cursor | chosen · **verified 2026-09-24** |
| `pulsing-border` | Live light — the one running element | https://shaders.paper.design/pulsing-border | chosen · **verified 2026-09-24** |
| `edge-breath` | Live light — ambient busy surface | https://github.com/Huxpro/hux.pro/pull/261 | chosen · **verified 2026-09-24** |
| `peripheral-indicator` | Live light — tab / badge scale | https://linear.app/changelog/2026-05-14-code-intelligence | chosen · **verified 2026-09-24** |
| `halftone-light` | Signature — light as print | https://shaders.paper.design/halftone-dots · https://shaders.paper.design/dithering · https://blog.maximeheckel.com/posts/shades-of-halftone/ | chosen · pending |
| `volumetric-type` | Signature — light raking through type | https://blog.maximeheckel.com/posts/shaping-light-volumetric-lighting-with-post-processing-and-raymarching/ | chosen · pending |
| `prism-dispersion` | Signature — a beam split into a fan | https://tympanus.net/codrops/2026/09/03/from-rays-to-meshes-building-vercels-prism-with-vgpu/ | chosen · pending |

#### `linear-specular` — Linear "Liquid Glass" *(chosen 2026-09-24)*

- **Source:** https://linear.app/now/linear-liquid-glass
- **Technology (as described):** Gaussian blur + a gradient layer + a specular pass computed from an SDF-derived normal map of the rounded rectangle, composited `plus-lighter`. Native (SwiftUI / Metal); the recipe ports to WebGPU / WebGL
- **Take:** material from light, not distortion — no refraction, on purpose, for legibility in dense UI; a highlight that knows the shape's curvature and wraps its corners; "Increase Contrast" adds solid outlines
- **Leave:** the blur as the main event; anything that depends on scroll-driven motion of a native sheet
- **Governs:** Specular — the highlight model for every surface and control
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `proximity-glow` — Jhey Tompkins, proximity glow border *(chosen 2026-09-24)*

- **Source:** https://codepen.io/jh3y/pen/QWYPaax
- **Technology:** pointer angle and proximity into CSS variables; a conic gradient masked to the border ring (`mask-composite: intersect`); it wakes before the pointer enters the card
- **Take:** the angle-aware arc on the side facing the light, and the proximity zone outside the box
- **Leave:** the rainbow conic (single warm-white light, tinted by the material); any reading of the arc as a coloured stripe rather than a specular on the bevel (ruling 4)
- **Governs:** Specular — the edge
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `relight-normals` — Codrops, relighting images with depth maps *(chosen 2026-09-24)*

- **Source:** https://tympanus.net/codrops/2026/08/19/relighting-images-with-depth-maps-and-three-js/ · demo https://tympanus.net/Tutorials/RelightingImages
- **Technology:** three.js WebGPU + TSL; depth map → blurred → normals, plus luminance-gradient detail and ray-traced self-shadowing; a movable light
- **Take:** a true lighting model on 2D content; the same maths as paper grain catching raking light
- **Leave:** a depth-generation pipeline per image as a requirement — the paper ground's normals can be procedural
- **Governs:** Specular — imagery and the paper ground
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `press-light` — Apple, "Meet Liquid Glass" (WWDC25) *(chosen 2026-09-24)*

- **Source:** https://developer.apple.com/videos/play/wwdc2025/219/
- **Take:** the behaviour — on press the control illuminates from within and the light spills onto adjacent elements; Reduce Motion removes the elastic part
- **Leave:** the Apple material and its look; anything literal enough to read as Apple
- **Governs:** Press
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `spring-tokens` — CSS `linear()` spring easing *(chosen 2026-09-24)*

- **Source:** https://linear-easing-generator.netlify.app/ · explainer https://www.joshwcomeau.com/animation/linear-timing-function/
- **Take:** spring overshoot and settle as a design token (`--sl-ease-spring`), zero runtime
- **Leave:** springs where interruption matters mid-flight (a CSS timing function cannot be interrupted like a JS spring)
- **Governs:** Press — motion
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `magnetic-primary` — Motion, spring follow *(chosen 2026-09-24)*

- **Source:** https://motion.dev/examples/js-spring-follow-cursor (the magnetic variant is Motion+, paid — the free spring-follow is the reference)
- **Take:** an interruptible, velocity-preserving pull on the label, on the primary call to action only
- **Leave:** magnetism on any other control; any effect for a coarse pointer or under reduced motion
- **Governs:** Press — the primary call to action
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `pulsing-border` — Paper Shaders, pulsing border *(chosen 2026-09-24)*

- **Source:** https://shaders.paper.design/pulsing-border · repo https://github.com/paper-design/shaders (Apache-2.0)
- **Technology:** canvas fragment shader; roundness, thickness, softness, spots per colour, pulse, smoke, bloom
- **Take:** light with volume travelling through the edge material, instead of a rotating conic stripe
- **Leave:** more than two hues (amber, receding to teal); one canvas per element on many elements — one running element at a time (Decision 5)
- **Governs:** Live light — the one running element
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `edge-breath` — Hux, Siri-style edge light *(chosen 2026-09-24)*

- **Source:** https://github.com/Huxpro/hux.pro/pull/261
- **Technology:** one fragment shader; four travelling waves at co-prime harmonics (2·3·5·7) so it never visibly loops; steeper-than-exponential falloff; DPR cap 1, half frame rate on slow devices, a still frame under reduced motion, CSS-gradient fallback
- **Take:** the non-repeating breath, and the whole degradation ladder
- **Leave:** the Apple rainbow (single amber field)
- **Governs:** Live light — ambient busy surface
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `peripheral-indicator` — Linear, agent-working indicator *(chosen 2026-09-24)*

- **Source:** https://linear.app/changelog/2026-05-14-code-intelligence
- **Take:** the principle — live state as a small peripheral signal at tab or badge scale, not a full-surface glow
- **Leave:** nothing yet; **the visual itself was not seen** (the changelog only states it exists) — the owner's capture decides what this card carries
- **Governs:** Live light — tab / badge scale
- **Verified by owner:** **yes** — 2026-09-24 (Take / Leave accepted as drafted)

#### `halftone-light` — Paper Shaders halftone / dithering; Maxime Heckel, halftone and dithering *(chosen 2026-09-24)*

- **Source:** https://shaders.paper.design/halftone-dots · https://shaders.paper.design/dithering · https://blog.maximeheckel.com/posts/shades-of-halftone/ · https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/
- **Technology:** fragment shaders; luminance thresholded against a Bayer matrix or blue noise, quantised to a palette (Paper's rendering backend is undocumented — not assumed WebGPU)
- **Take:** light rendered as print ink — the dot screen as the brand's way of showing light
- **Leave:** coarse dot pitch (retro-game kitsch); default palettes — the ink palette only
- **Governs:** Signature
- **Verified by owner:** pending

#### `volumetric-type` — Maxime Heckel, volumetric light with SDFs *(chosen 2026-09-24)*

- **Source:** https://blog.maximeheckel.com/posts/shaping-light-volumetric-lighting-with-post-processing-and-raymarching/
- **Technology:** WebGL post-processing raymarch; shadow map for occlusion; Henyey-Greenstein scattering; blue-noise dither (≈5000 → ≈100 steps)
- **Take:** real shafts with occlusion — Fraunces letterforms as the occluder
- **Leave:** a full 3D scene as a requirement; the parts the author calls creative rather than production-ready
- **Governs:** Signature
- **Verified by owner:** pending

#### `prism-dispersion` — Vercel Prism, built with vgpu *(chosen 2026-09-24)*

- **Source:** https://tympanus.net/codrops/2026/09/03/from-rays-to-meshes-building-vercels-prism-with-vgpu/ · live https://vgpu.sh · code https://github.com/vercel-labs/vgpu
- **Technology:** WebGPU (vgpu — already the kit's optional peer dependency); per-wavelength refraction traced into a triangle mesh; adaptive quality tiers by GPU tier, battery and frame rate
- **Take:** dispersion cheap enough for a hero; the adaptive-quality architecture, whatever the look
- **Leave:** the prism object and the RGB fan — it is Vercel's signature; our split is amber → teal and our object is not a prism
- **Governs:** Signature
- **Verified by owner:** pending

## Acceptance Criteria

The three aesthetic non-goals are unfalsifiable as written: no test fails because a surface is bland. So the criteria come in **two registers**, and the split is the one the effects-layer spec already lives by ("Nothing in this repository renders a frame…").

The first register is **AC-1 – AC-29, mechanically asserted or procedurally checkable**: each criterion there names the command, test file or artifact that decides it. The second is **AC-30 – AC-35, judgment-gated**: each criterion there names a referee and a procedure, not a threshold — this is where "unique" and "not generic" live, honestly, instead of being dressed up as assertions.

Criteria are numbered `AC-1` … `AC-35` continuously, in document order, across the six groups below. The two sentences above define the registers; they are not criteria and take no id.

Status vocabulary follows the effects-layer legend: **Shipped / Delivered** = merged and available to users; **PoC implemented (not delivered)** = prototype only.

### The method holds (new; this is what the pivot buys) — AC-1 – AC-7

- **AC-1** A slice does not start until its reference cards exist, are verified by the owner, and carry both a *Take* and a *Leave* line — *Decided by:* the Reference knowledge base above
- **AC-2** Every direction probe lives outside `packages/`; no probe is merged into the published package, at any quality — *Decided by:* `git log --stat` on `packages/` for the slice's branch
- **AC-3** A direction is chosen only after **at least three** variants have been rendered side by side, in dark and light — *Decided by:* the slice's contact sheet
- **AC-4** The promoted variant carries rendered evidence beside its reference card — same crop size, same ground, both themes — *Decided by:* the slice's pull request
- **AC-5** Rejected directions are recorded with the reason, in one line each, and their code is deleted rather than parked — *Decided by:* the slice's spec entry; `lab/` carries no dead variant
- **AC-6** No value in shipped code that a card supplies is different from the card's, unless a recorded ruling says so — *Decided by:* review against the card
- **AC-7** A slice covers **one element** until the method has produced one result the owner accepts; only then does it widen. A slice covering two silhouettes of the same component is allowed **only when the contrast between them is the question**, and the slice log has to say so — *Decided by:* this file's slice log

### Delivery: the layer stops being a prototype — AC-8 – AC-11

- **AC-8** The version of `@sondalab/ui-kit` carrying the four effects files (`files` and `exports` already list them at `0.8.1`) is **live on the npm registry**, and the effects-layer spec's status line reads **Shipped**, not *PoC implemented (not delivered)* — *Decided by:* `curl -fsS https://registry.npmjs.org/@sondalab%2Fui-kit/<version>` returns 200; `scripts/effects-showcase.test.mjs` ("the package ships the layer")
- **AC-9** `npm test` is green on `main` with every `scripts/effects-*.test.mjs` present and running — *Decided by:* `node --test scripts/*.test.mjs`
- **AC-10** At least one surface outside this repo consumes the published layer from npm, not from a checkout — *Decided by:* the consuming repo's lockfile + a rendered page
- **AC-11** `packages/palette-py/` is untouched by the whole effort; no entry is added to `sondalab.tokens.json` — *Decided by:* `git diff` on the two paths; `scripts/*.test.mjs` drift checks

### Technology choice, and the fallback that is the default state — AC-12 – AC-17

`sondalab-site/docs/webgpu-surfaces.md` §"The fallback is the default state" is the governing wording; these criteria restate it for this group rather than re-inventing it.

- **AC-12** Every family's mechanism and tier is written down before it is built, and the shipped code matches that table; the GPU is used **where per-pixel work is the only way to get the reading**, and every other family stays on the cheapest technology that produces the look — *Decided by:* the effects-layer spec §Decision 2 vs the shipped files; `scripts/effects-gpu.test.mjs`
- **AC-13** Tier 0 renders correctly with JavaScript disabled: the glass hairline and the static aurora arc are present, in dark **and** light — *Decided by:* rendered showcase, scripts blocked
- **AC-14** Tier 1 renders at full quality with no WebGPU: aurora, liquid and glitch depend on the GPU tier for nothing — *Decided by:* rendered showcase in a browser without WebGPU; `scripts/effects-guards.test.mjs`
- **AC-15** WebGPU boot is guarded and optional — `vgpu` an optional **peer** dependency, dynamically imported inside the guard; `mountGpu()` resolves `false` when WebGPU is missing and never throws — *Decided by:* `scripts/effects-gpu.test.mjs`
- **AC-16** A lost device, a shader error or a theme switch to high contrast tears the GPU tier down and restores the CSS reading **without a reload**; the attribute and the canvas go together — *Decided by:* `scripts/effects-gpu.test.mjs` + one manual device-loss probe
- **AC-17** No criterion anywhere in this document requires the GPU for a family the design contract puts on CSS or SVG — *Decided by:* review of this file against §Decision 2

### The gates the repo already owns (must stay green, none may be relaxed) — AC-18 – AC-25

- **AC-18** No colour literal in `effects.css`, the three JavaScript files, or the WGSL; every hue the GPU uses traces to a token read with `getComputedStyle` and re-read on theme change — *Decided by:* `scripts/effects-audit.test.mjs`, `effects-js.test.mjs`, `effects-gpu.test.mjs`; `sl-audit --fail-on R`
- **AC-19** Every emitted colour is inside sRGB at its derived lightness and hue, on both themes, over a hue sweep — *Decided by:* `scripts/effects-gamut.test.mjs`
- **AC-20** All three kill switches hold: `prefers-reduced-motion: reduce`, `[data-sl-theme="high-contrast"]`, `data-sl-fx="off"` on any subtree — *Decided by:* `scripts/effects-guards.test.mjs`, `effects-js.test.mjs`
- **AC-21** The budget singletons hold: one ambient aurora per document, one glitch burst at a time (dropped, never queued), one deforming element, one shared canvas moved rather than multiplied — *Decided by:* `scripts/effects-js.test.mjs`, `effects-gpu.test.mjs`
- **AC-22** No effect replaces or removes the focus `outline`; edge effects grow inward and never reach `outline-offset: 2px` — *Decided by:* `scripts/effects-guards.test.mjs`
- **AC-23** Aurora renders state without being it: `aria-busy="true"` for busy, `role="progressbar"` + `aria-valuenow` for determinate — *Decided by:* `scripts/effects-showcase.test.mjs`
- **AC-24** No component carries a family the per-component declension table does not assign it — the table is exhaustive, and a new pairing is a spec change first — *Decided by:* `scripts/effects-showcase.test.mjs` + review against the table
- **AC-25** The text is never filtered, on any family, at any tier — *Decided by:* `scripts/effects-guards.test.mjs`, `effects-js.test.mjs`

### Cost (thresholds are open — see Notes 4) — AC-26 – AC-29

- **AC-26** A pointer move over a lit pane costs no more than **_TBD_ ms** of style + script per frame, measured in Chrome on **_TBD_ reference machine** — *Decided by:* performance trace on the showcase
- **AC-27** The lens's page capture is idle-scheduled, never per frame; scroll and resize trigger at most one recapture per idle callback — *Decided by:* `scripts/effects-js.test.mjs` + a trace
- **AC-28** The layer adds no more than **_TBD_ KB** gzipped to `@sondalab/ui-kit`, and importing the module has no side effects — *Decided by:* package size report; `scripts/effects-js.test.mjs`
- **AC-29** With every family active on the showcase, the page holds 60 fps at rest and during one interaction — *Decided by:* performance trace, dark and light

### The bar itself (judgment-gated; the referee is named) — AC-30 – AC-35

- **AC-30** No change to a shipped effects file is done until it has been **looked at rendered, in dark and in light, beside its reference card** — *Referee:* the implementer, before opening the PR
- **AC-31** Every family is measured against a **named, owner-verified** card. A family with neither a card nor an explicit owner ruling is not shipped — *Referee:* the owner, at review
- **AC-32** **Restraint at the pixel level holds:** a structural separator stays `1px` whatever an effect does to it; an edge effect stays within the border band; bloom reaches no further than `--slfx-glow` — *Referee:* the owner, at review, on the rendered page
- **AC-33** **An element at rest carries no light.** Glass at rest is translucency only; aurora appears only where attention actually lives; glitch is never ambient on a control — *Referee:* the owner, at review — the operational form of "not generic glassmorphism"
- **AC-34** The showcase is signed off by the owner in **both** themes, with a screenshot set per family attached to the PR — *Referee:* the owner
- **AC-35** Where the state of the art was searched for a gradient, effect or animation, the source **becomes a card** — an uncited effect is not evidence of the state of the art — *Referee:* reviewer, at review
## Slice log

Order set by the owner on 2026-09-11: **buttons → input fields → cards and layout.** It is the right order for the method, not only for the product — the button is where three families meet on one small silhouette, so the first pass through the loop exercises the whole machine on the cheapest possible surface, and cards and layout come last because they are the ones a wrong ruling is most expensive to undo.

One row per slice, written when the slice closes: chosen direction, rejected directions with the reason, and the card it was measured against.

| # | Element | Cards | Chosen | Rejected (and why) | Closed |
|---|---|---|---|---|---|
| 1 | buttons — text and round icon-only | `liqui-glass` (text), `gooey` (round), `border-beam` (focus), `metal` + `glass-studio` (glass grammar) | **inset-rim** — tint **0.14**, blur **2px**, saturate **1.7**, `__backdrop` and `__tint` on separate layers, no blend mode; light rim and glow `oklch(0.86 0.17 82)` | `veil` (edge only, no material); `arc` (border-beam's beam read as decoration on a control at this size); `dispersion` (the R/B split is invisible at 84×36); on light, `white` (goes pale, as `metal` measured) and `dark` (reads as dark glass) | promoted 2026-09-11; **open** — see below |
| 2 | input fields — the common ones (text, select, textarea) | _TBD_ | | | not started |
| 3 | cards and layout | _TBD_ | | | not started |

**Slice 1 deliberately carries two silhouettes**, under the carve-out AC-7 already grants ("allowed **only when** the contrast between them is the question, and the slice log has to say so") — this paragraph is that saying-so. The whole open question about buttons is a *contrast* — the previous effort ruled that the drop belongs to a round silhouette and reads as a blister on a box, and that ruling can only be re-examined with the two side by side in the same probe. One page, two rows, one decision. If slice 1 starts sprawling past that, it is a sign the ruling was right and the round button should be split off into `1b`.

Slice 2 and 3 have no cards yet, and picking them is the owner's first task when each opens — a field and a card are not the same design problem as a button, and `metal` is unlikely to be the right reference for either.

## Slice 1 is clear to start

AC-1 is the gate: *"a slice does not start until its reference cards exist, are verified by the owner, and carry both a Take and a Leave line."* **All three conditions hold as of 2026-09-11.** Eight cards exist, each carries a *Take* and a *Leave*, and each is signed by the owner. The *Take*/*Leave* lines are therefore rulings now, not proposals — including the two that take a position rather than report a measurement: `metal`'s rejection of the always-on ring, and `liqui-glass`'s rejection of the reference's resting-state luminance under AC-33.

Two open items remain, and **neither blocks the divergence loop**, because `lab/` has no rules and a probe can be built and looked at while they are open:

1. **One sentence of the Goal** — *"It is a must to use webgpu whenever possible"* — is contradicted by the references it was meant to be served by, and is the owner's to reword (Note 2). Everything else in this file is already consistent with AC-12's reconciled rule.
2. **The cost numbers are unset** (Note 4), so AC-26 – AC-29 are not a gate for slice 1.

What the cards do **not** settle, and the probe therefore has to answer with its own eyes:

- The **cursor light and the ring bend** on `metal` — the two circle captures are indistinguishable, so those live only in `metal-fx`'s source numbers.
- The **travelling 1 px arc** on `border-beam` — no still carries it; the captures hold the bloom and the inner wash only.
- The **merging neck** on `gooey` — not legible at the separation the captures caught.
- **Glass on a light ground** — unreferenced anywhere in the knowledge base (Note 7), so the light theme is original work, not reproduction.

The next artifact is a `lab/` probe page for slice 1: one element, at least three variants, both themes, rendered side by side (AC-3).

## Why slice 1 is still open

Owner, 2026-09-11: *slice 1 does not close until the effects are decent.* The
material is promoted and every gate is green, but a filled pane still carries a
black rectangle from the lens, and a button that looks broken is not a delivered
effect whatever the tests say. So AC-34's sign-off is deliberately withheld
rather than waived, and the slice stays open with the lens on the critical path —
it is `e33ea31`'s defect, but it is slice 1's blocker.

The alternative was offered and declined: switching the lens off by default would
make the slice signable today, at the cost of shipping glass that is only blur
and rim. The ruling is that the bar comes first.

## Slice 1 evidence (AC-3, AC-4)

Contact sheets live in `docs/slices/<n>-<element>/` — a new directory, kept apart from `docs/references/assets/` on purpose: those are ground truth measured off someone else's work, these are our own renders, and mixing the two would let an artifact we made drift into the knowledge base. Each sheet carries both grounds, every variant, and the parameters printed on the cell.

| Sheet | Question it settles | Variants |
|---|---|---|
| `contact-1-directions.jpg` | which direction | `veil`, `inset-rim`, `arc`, `dispersion` |
| `contact-1b-tint-x-blur.jpg` | how much material | tint 0.5125 / 0.30 / 0.14 × blur 5.9 / 2 / 1 px |
| `contact-1c-light-rim.jpg` | what light is made of on a light ground | `white`, `sun-clipped`, `sun-fitted`, `dark` |
| `contact-1d-variant-hierarchy.jpg` | where primary / ghost / base stay distinguishable | `tint-carries`, `light-carries`, `both`, `flat-today` |
| `contact-1e-primary-transparency.jpg` | how transparent primary can get, with the label's contrast measured per cell | tint 0.28 / 0.42 / 0.58 / 0.92 |
| `contact-1f-two-layers.jpg` | that the settled design fits Decision 3b's two paint layers | the three variants in `::before` / `::after` form |
| `contact-1g-real-ground.jpg` | the fill construction and then the primary's share, on real Sondalab surfaces rather than a decorative wash | `mix to transparent` vs `mix to veil`; then share 0.34 / 0.42 / 0.50 |
| `contact-1h-dark-islands.jpg` | the dark theme's two viable regions, edge to edge | share 0.42 + light label vs 0.72 + the shipped dark label |
| `contact-1i-rim-shape.jpg` | why the lit rim reads old-school, and the corner shape | `bevel`, `ring`, `ring-round`, `soft`, `squircle`, `superellipse(4)` |
| `contact-1j-refraction.jpg` | **real refraction of a declared backdrop, no GPU** | `flat`, `bend` (scale 14), `dispersion` (IOR 0.98/1.00/1.02), `thick` (scale 20) |
| `contact-1k-gpu-glass.jpg` | refraction **plus Fresnel and glare**, on the GPU | one pane, every term switchable, every default from the `glass-studio` card |
| `contact-1k-parametric.png` | the same pane driven from CSS alone — thickness 30, fresnel 70, no slider touched | proof the three parameters are custom properties, not shader constants |
| `promoted-showcase-dark.png` · `promoted-showcase-light.png` | **the promoted material on the showcase**, after the pane cell was given a substrate | both themes, `.sl-fx-glass__lens` hidden — see below |

The two showcase captures are taken with `.sl-fx-glass__lens` hidden, because the lens paints the wrong page content into every pane (its own defect, recorded under *Found on the way*). Everything else in them is the shipped material.

AC-3's floor is three variants rendered side by side in dark and light; all three sheets clear it. The 1c sheet is captured with the light pinned on every cell, since a rim that only exists under the pointer cannot otherwise be compared across four cells at once.

## Refraction — the route that works, found 2026-09-11

Owner's choice between three routes was the **declared backdrop**: the surface says
what lies behind a region and the pane bends *that*, rather than trying to bend
arbitrary DOM. Both implementations in the knowledge base work this way —
`glass-studio`'s background options are images and videos handed to the shader,
`glass-vue` is a demo over a backdrop — and **neither ever refracts a live
document**, which is the problem the lens has been losing to.

It needs no GPU. Two things together make it work, and the second is the one that
was missing:

1. **A copy of the backdrop inside the pane**, displaced with an ordinary
   `filter:`. `backdrop-filter: url(#f)` is inert for displacement in Chrome 152
   (Note 3), but an ordinary `filter:` is not — the effects-layer spec's own probe
   list already said so and it was never acted on.
2. **The map as a `data:` URI.** `feImage href="#anElement"` is *silently ignored*
   — no error, the element simply renders unbent. That single detail is the
   difference between "refraction is impossible here" and "refraction is one data
   URI away", and it is why the first version of this probe rendered nothing.

`lab/1j-refraction-declared-backdrop.html` shows it working at tier 0 with the
`glass-studio` card's own numbers: one bend at scale 14, the same at its measured
thickness of 20, and the IOR triple 0.98 / 1.00 / 1.02 as three displacements
recombined one channel each. `lab/z-displacement-minimal.html` is the one-look
proof of the data-URI point.

Not yet chosen: which of the four the button takes, and whether the tint at 0.72
leaves enough of the bend visible — the probe runs at 0.35 precisely because the
settled tint hides what it is measuring.

**Fresnel and glare need the GPU, and `lab/1k-glass-gpu.html` has them.** Both are
per-pixel functions of the surface normal, and CSS has no normal — that is the
honest boundary between the two routes, not a preference. The probe is raw WebGL2
with a superellipse SDF, the normal taken from the field's own gradient,
refraction pushed once per channel at the IOR triple, Fresnel on the rim and a
directional glare, every default read from the `glass-studio` card. `vgpu` is
**not** added: a probe has no rules, and whether the promotion goes through the
kit's existing tier-2 wrapper is a question for the promotion.

**The bevel was physics, not units.** The first pass pushed the sample point
along the normal by a flat amount, which is exactly what a bevel is: four faces,
each pushing one way, meeting on a diagonal at every corner. Glass does not have
faces — it refracts through a **thickness profile**, steep at the rim and flat
almost at once. Taking the push from the slope of a lens section
(`u / sqrt(1 - u²)`, the vertical tangent at the edge) removes the seams
entirely and bends a straight line into a curve instead of creasing it.

**Does `vgpu` help?** No, and it is worth writing down so it is not asked again.
It is a setup wrapper — `init`, `surface`, `effect`, `clock`, `frame` — and the
pixel is decided by the fragment stage, which is the same maths on either
backend. What it buys is at **promotion**: it is already the tier-2 contract, so
going through it inherits AC-15's dynamic import inside the guard, the kill
switches and the device-loss teardown, none of which is worth rewriting by hand.
So the order is: settle the look in the probe, then promote through `vgpu`.

**The glare does not follow the pointer, and that is the ruling.** *Owner, on the
render: it moves too abruptly.* Three separate causes, and the third is the one
that matters:

1. the angle was written straight from each `pointermove` with no easing — the
   effects-layer spec eases the pane's own bearing on a time constant of 80 ms in
   and 140 ms out, and this had none;
2. `atan2` wraps at ±π, so crossing the left of the pane swung the highlight the
   long way round — the spec's own word for the fix is *"unwrapped against the
   previous value"*, and it was not being done here;
3. **in `glass-studio` the glare angle is a constant.** It is a setting, `-45°`,
   not a function of anything. The pointer moves the specular *spot*; it does not
   move the direction the light comes from. A light source that chases the cursor
   is the thing that reads as unreal, and no amount of easing fixes it.

So the probe now eases and unwraps — both worth having — but `follow` is **off**,
and the reference's fixed `-45°` is the resting state. *Owner, 2026-09-11:
settled that way, with the note that a future slice may let the light respond to
other elements on the page rather than to the cursor.* The toggle stays so the
two can be compared rather than argued about.

**Tint 70 on the GPU pane.** *Owner, same pass.* Which lines up with slice 1's
CSS pane at 0.72 — the two routes land on the same translucency rather than
needing to be reconciled later. The refraction survives at that tint but goes
quiet: it reads as a bend in the grid rather than as a lens, and anything wanting
more has to come from the Fresnel and the glare, not from thinning the tint.

**Thickness, tint and Fresnel are CSS custom properties, not shader constants.**
*Owner, 2026-09-11.* `--glass-thickness`, `--glass-tint` and `--glass-fresnel`
are declared on the element and read every frame with `getComputedStyle`, which
is exactly how `effects-gpu.js` already feeds design tokens into `vgpu`'s `look`
object field by field. Verified by setting two of them from CSS alone, with no
slider touched, and watching the pane answer. Nothing is cached in a JavaScript
variable: a number held in two places is the first thing to drift.

This is what makes a per-variant declension possible without a second shader —
`.sl-btn--primary` can ask for a thicker pane than `.sl-btn--ghost` by rebinding
a property, the same way the fill already rebinds `--slfx-fill`. Dispersion and
glare are deliberately *not* parametric yet: they are still probe-only numbers,
and promoting a knob nobody has asked to turn is how a contract grows by
accident.

**`vgpu` can carry this.** Installed and inspected at 0.3.1: it exports
`sampler`, `storage` and `target` alongside `init` / `surface` / `effect` /
`clock` / `frame`, so a declared backdrop can reach the shader as a texture —
which was the open question, since the kit's current tier-2 shader states plainly
that "a canvas cannot read the DOM beneath it" and has no texture binding at all.

Still open: the thickness unit. It is in the probe's own pixels rather than
`glass-studio`'s units on its 200 × 200 shape, so the value 10 here is not the
card's 20 under another name, and the conversion should be settled before it
becomes a token.

### 1y — the light the glass can be seen to bend — 2026-09-12

*Owner: "riusciamo a far diventare l'aurora luce vera che si deforma dietro al
vetro?"* It was already behind it — the glow has been a sibling in the backdrop
since `7be2d20` — so the question was really why the lens was doing nothing
visible to it. Isolated on `lab/1w`'s bed by setting the three
`feDisplacementMap` scales to 0 and leaving the rest of the chain alone (an
identity pass; the control read 0 px):

| light behind the pane | pixels moved | max delta |
|---|---|---|
| the smooth bloom, as fitted that morning | 0.93 % | 13/255 |
| the curtains (`--pillars`), same lens | 5.00 % | 35/255 |

**A lens can only be seen to bend what has structure.** The bloom is a wide
soft gradient drawn in the shape of the edge it hugs; displacing it radially
maps it onto very nearly itself, and its dispersion is invisible for the same
reason — three channels of a smooth amber shifted by ±2 px re-sum to nearly
the same amber. This is the tradeoff the morning's two commits had set up
without naming: the composer **is not glass**, so its profile is the light
itself, and fitting our light to that curve put it in the one geometry the
lens cannot show. *Owner's ruling: the refraction wins.*

**So the curtains are the aurora's light again**, as they were at `5c1b433`
before the sweep took the default back: `--sweep` asks for the rotating arc,
`--beam` and `--rim` keep their own light, `--linear` never had a glow at all.
The conic bloom and its 1x fit stay, for the three modes that use it.

**Fitted on `lab/1y`** (the same bed, a card and a button, the curtains'
alphas, pitch, blur and the lens's `reach` on the URL), reading the card's
interior with the glass rim's own band excluded:

| | peak over the bed | p90 | median |
|---|---|---|---|
| as shipped (ribs 42 %, curtains 62 / 58 %) | +61.7 | +52.4 | +26.2 |
| **fitted (30 %, 44 / 41 %, blur 4 px, pitch ×1.25)** | **+49.0** | +39.5 | +17.6 |
| the reference's own light, for scale | +48 | — | — |

The pitch widened because a rib narrower than about twice the blur it sits
under is erased by that blur — and then there is nothing left for the lens to
bend.

**The bend needed raising, and that is a second measurement.** `reach` caps the
displacement at a fixed number of pixels; 6 px was fitted against a wide card
bending the page behind it into a wave. On light it is invisible:

| reach | pixels the bend moves | vs reach 6 |
|---|---|---|
| 6 | 4.53 % | — |
| 12 | 7.27 % | 5.09 % |
| 18 | — | 7.70 % |
| 24 | 10.40 % | 9.65 % |
| 40 | — | 12.16 % |

From about 18 the curtains visibly gather and part into their colours at the
faces. So `reach` is now readable from the element as `--slg-lens-reach` — how
hard a surface bends is a property of that surface — and `.sl-fx-aurora`
declares 18 px while a plain pane keeps the material's 6. The cost to the page
behind, measured with the page's animations frozen against a 0-pixel control:
**2.44 %** of pixels on the showcase's 494 px card over the wordmark and
**1.80 %** on the pane cell over dense telemetry text, both confined to the
host's own rim band, where the glass already fringed at 6.

**And one the default flip reached that the bed never would have.** Making the
curtains the default put them on every aurora host, including the showcase's
43 px text field — where they smudged above and below the control. `overflow:
hidden` clips the ::before that paints them, but `filter: blur()` is applied to
the result and spills past the box anyway; `clip-path` runs after the filter,
so it is the one that holds, at `inset(0)` because a pillars glow is seated
with no spread. Fixed in `3b1693f` with a test. The lesson generalises: a
default is not a mode, and the surfaces it newly reaches are where to look.

**A regression the bed caught, and it was `12367ef`'s.** That commit clipped the
seated glow to the host's box using `--slfx-glow`, the spread `seatGlow()` gives
a normal glow. A `--pillars` glow is seated with **no** spread — its box is the
host's own — so the same inset ate it from every side: on a 90 × 40 button,
11 297 pixels of curtain, max delta 149, simply gone. Fixed in `072d919` with a
test; nothing on the showcase carried the class, which is why 185 stayed green.

**White light, more blur, and a beam for loading — 2026-09-12, later.** Three
changes on the owner's reading of the rendered result: *"i pillars generici
vanno bene, solo non mi convincono i colori — userei luce bianca che si
scompone, e poi sembrano zebrati, li blurrerei ancora di più"*, and *"il
loading dovrebbe essere un loading beam"*.

- **White.** Both curtains are now the derived light pole rather than the
  accent and its complement. Measured with the kit's own defaults on the bed:
  the interior peaks at **+45.2** (the reference's light peaks at +48), the
  colour in the middle of the pane is **3** and at the faces **46** — white
  light, parted by the glass where the glass acts. White carries much less
  over a near-black ground than the vivid accent did, so the alphas went **up**
  (44 / 41 → 45 / 42, ribs 30 → 32) to hold the same luminance.
- **Less zebra.** Blur 4 → 8 px, its breath 3–5.5 → 7–10, pitch 200 / 300 →
  320 / 480 px. The two move together by necessity: a rib narrower than about
  twice its blur is erased by that blur, and an erased rib is nothing for the
  lens to bend.
- **The loading band is round, and it does not bend.** *Owner: "si puo' dare un
  effetto piu' stondato alla luce? Inoltre, si dovrebbe deformare come i
  pilastri? Perche' non mi sembra ma forse e' subtle."* Both answered by
  measurement. Round: each of the band's four strips now **fades** inward over
  twice its depth instead of being cut, so the light has no edge of its own and
  only the element's corner radius shapes it (15 563 pixels changed, max delta
  13 — a softening). Subtle: it is not subtle, it is **absent** — bend on
  against bend off, control 0 px, the band moves **1.63 %** of its pixels where
  the curtains move **5.00 %**. Same structural fact as the one that made the
  curtains the ambient light: the displacement pulls radially inward, and light
  that hugs the border maps onto very nearly itself. A lobed variant (a
  repeating conic comb intersected into the mask) was built and measured: it
  renders, and bends **1.43 %**. Not shipped — it costs a mask layer and buys
  nothing.

- **Filaments, and the geometry that decides everything here.** *Owner: "si
  prova, e usa il colore di accento."* The middle path: the light stays on the
  border and hangs spokes into the pane. The first cut of them was **radial** —
  a conic comb from the centre — and it moved the bend from 1.63 % to
  **1.83 %**, which is nothing, because **the displacement is radial**: it pulls
  every sample toward the middle, so anything radially symmetric is invariant
  under it, a band along the border and a comb of spokes alike. Cut the
  curtains' way instead — vertical, meeting the left and right faces side-on —
  the same filaments take it to **2.76 %** (control 0 px; the ambient curtains
  are 5.00 %). **This is the rule the whole slice turns on, stated once: a lens
  with a radial map can only be seen to bend structure that runs across the
  radius.** The filaments hang five times deeper than the band, fade out, are
  cut from the same angle, and live on the glow's `::after`, which was free.

**Four defects on the light theme — 2026-09-12.** *Owner, with two
screenshots: "ritengo questi dei difetti."* Two were the lens, one was a
strength, one was mine from an hour earlier.

- **The grey pane was TWO things, and the first answer to it was wrong.** The
  first attempt dropped the lens on any pane under six times its cap — most of
  the kit's controls. *Owner: "ma chi ti ha detto di togliere l'effetto lente
  dai bottoni? Quello era fondamentale per liquid glass!"* Right on both
  counts: that is a decision about what liquid glass **is**, and it was not the
  implementer's to take. Reverted, and the two real causes separated:
  - **The cap has to be proportionate, not a gate.** `reach` says a slab bends
    at its edge by a fixed few pixels, but "a few" must stay few *relative to
    the pane*: 18 px is a tenth of a card's height and most of a button's, and
    at that share the filter samples outside its own region. The cap is now
    `min(asked, shorter side / 6)` — the card keeps 18, a 40 px button gets
    6.7, a 30 px one 5, all near the material's fitted 6. **The lens stays
    bound on every pane.**
  - **A lens cannot see through a glass ancestor, and that is the browser's
    rule.** A glass host carries `isolation: isolate` so its layers sit under
    its own label, and that alone makes it a Backdrop Root; a backdrop-filter
    inside one gets an **empty** backdrop and renders whatever its material
    makes of nothing — the grey slab. Isolated by subtraction on the dialog,
    each step a capture: still grey at displacement 0, at cap 5, with the
    region grown 24 px a side, at 44 px tall, and with the ancestor's own lens
    removed; correct only when the ancestor dropped its lens **and** its
    isolation together, which is not available. So the innermost lens refuses
    there and only there.
- **The colour split.** It was a fraction of the bend, right only while the
  bend is physical; ours is capped for looks. At 6 px the red-to-blue
  separation was 4.3 px, the fringe the prism was fitted at; at the aurora's
  18 px cap the same expression gave **13 px**, which on text behind a pane is
  a broken render. `disperse` is now that separation in **pixels**.
- **The blue blob.** `--rim`'s bloom was the depth companion at 90/78 % and read
  as a cyan blob beside a busy button. The hue stays — a ring in the accent
  would vanish into the accent fill it outlines — at **44/33 %**, the register
  every other bloom uses.
- **The fill-less control's label**, which the tint floor an hour earlier had
  fixed only while lensed. A button, badge or field carries no fill, so its
  label sits on whatever is behind it: 4.24:1 over a dark region. Their tint
  goes 18 → **25 %** (4.74:1); the material's fitted 18 % is untouched wherever
  a surface has a fill of its own.

| light theme, all four in | contrast |
|---|---|
| ghost, over the telemetry substrate | 4.74:1 |
| primary, same substrate | 6.97:1 |
| ghost, on the white dialog | 14.63:1 |
| primary, on the white dialog | 9.72:1 |

**The light theme's unreadable label — 2026-09-12.** *Owner: "i pulsanti su
tema light hanno label nera poco visibile."* Measured off the rendered page,
and it is not the label colour: every button carries the same dark ink, and
only one case fails.

| | contrast |
|---|---|
| primary glass, over the page's own ground | 9.62:1 |
| ghost glass, over the page's own ground | 14.02:1 |
| primary glass, over the telemetry substrate | 5.98:1 |
| **ghost glass, over the telemetry substrate** | **2.28:1** |

The cause is in `glass.css`: a lens sent the **ground tint to zero**, by a rule
written so the lens reads as a window rather than a tinted panel. A lensed
primary survives it because its accent share is untouched; a ghost has no
share, so over a dark region nothing at all stood between the page and the
theme's dark ink. `--slg-tint-lens` is now a floor at **34 %**, which reads
**5.35:1** on paper and **10.69:1** on ink; 58 % reads 7.09 with very little
lens left. One number serves both themes because the tint colour already
follows the theme. A surface that wants the bare window sets it to 0 and owns
the contrast. It costs some of the lens everywhere — checked on the ambient
card in both themes, the wordmark behind is muted but still legible.

**Still the owner's, and unchanged by this:** `--sl-text-on-accent` is white on
both themes and measures 1.99:1 on the plain filled button with every effect
off. That is a token decision, recorded since the first pass and still open.

- **The filaments are OUT.** *Owner, 2026-09-12: "si infatti non mi
  convince."* Five geometries, all of them aimed at giving the lens something
  to bend, none of them failing on its number and all of them failing on looks:

  | geometry | bend | how it read |
  |---|---|---|
  | radial spokes | 1.83 % | a radar, and bent nothing |
  | vertical, all four runs | 2.76 % | bent best, still a radar |
  | vertical, side runs only | 1.93 % | out of step with the light |
  | whole layer rotated | 1.60 % | outside the box on a wide card |
  | tangent, long | — | a flamethrower |
  | tangent, short | 2.64 % | still not convincing |

  **The band alone is the loading light.** What the removal costs is only the
  refraction, which was never visible enough to be the point; what it buys back
  is a light that plainly runs the border — which is what was asked for and
  accepted before any of this. The numbers stay in `effects.css` where the code
  was, and a guard now refuses any second light under the loading condition, so
  one cannot return without its own ruling. **If you reach for this again, the
  thing to know is that the geometry decides it, not the parameters.**

- **Short, or it is a flame.** *Owner, on the tangent version: "non solo adesso
  non segue il bordo ma sembra anche uno sputafuoco."* Both halves had one
  cause: the filaments reached up to **96 px** in, and at that length a tangent
  comb stacks into a plume leaving the edge rather than a curtain hanging off
  it. **Long and perpendicular is a radar; long and tangent is a flame.** They
  are now 11 → 27 px. At that depth the striation reads as a fringe hugging the
  border, and the light stays on the edge at every phase — checked at three,
  driven rather than waited for. Still refracts: 2.64 % on a tighter crop
  (120 rows, so not comparable to the numbers above it).

  **Five rounds went into this fringe** and the bar for a sixth should be high:
  the band alone was already accepted, and everything since has been buying
  refraction the band cannot have. Removing the filaments entirely is one line,
  and is the right move if they cost another round.

- **Tangent to the border, and three complaints close at once.** *Owner: "adesso
  la luce che segue il bordo e' fuori sync con la tenda."* It was: the filaments
  lived on two runs out of four, so the curtain waited at the sides while the
  light crossed the top. The comb's angle is now **`--slfx-angle` itself**, read
  straight — no second clock, nothing to keep in phase — and in a linear
  gradient that angle lays the stripes **across** it, so they are always
  parallel to the edge they sit under. **In sync** (all four runs again);
  **no radar** (a filament parallel to its own edge never points at the middle,
  which is what the sweep was); and **more bend, not less** — **2.25 %** against
  1.93 % for the sides-only comb and 1.60 % for the rotated layer. Same geometry
  as the radial spokes, stated positively: the pull is radial, so a pattern has
  to vary **along** the pull to be seen moving, and tangent stripes do that on
  every run where perpendicular ones do it on none.

- **The filaments turn with the light.** *Owner: "man mano che seguono il bordo
  dovrebbero anche ruotare, adesso sembrano delle bande che si allungano e
  basta solo su asse y."* The comb was a fixed 90°, so every filament was
  vertical wherever the light was. **Rotating the whole layer is the wrong
  shape**, and it was built and measured before the one that shipped: a rotated
  rectangle uncovers its own corners, so the layer must be grown past the box,
  and `inset: -30%` on a 494 px card pushes the side strips **148 px outside
  it** — the filaments left the element and the bend fell from 1.93 % to
  **1.60 %**, the band on its own. So the **gradient's angle** turns instead, on
  the light's own 5.5 s clock, and the strips stay on the border. Measured at
  the frozen phase, control 0 px: **1.93 %**, unchanged from the version that
  did not turn; it varies over the turn, which is the point.

- **The filaments keep to the side runs.** *Owner, after the sway fix: "in
  minima parte le bande si estendono ancora verso il centro dando l'effetto
  radar."* They did, and on two of the four runs only: the filaments are
  vertical, so along the **top and bottom** they hang straight at the middle of
  the element — spokes pointing at the centre, turning with the band, which is
  what a radar is. Along the sides they run parallel to the edge and read as
  curtains. The mask keeps the left and right strips and drops the other two.
  **It costs some bend, and the first version of this claim said it would not.**
  Measured on one frozen phase, control 0 px: band alone **1.63 %**, filaments
  on all four runs **2.76 %**, on the sides only **1.93 %** — so the top and
  bottom ones were worth about two fifths of it, because a vertical line on the
  bottom run is parallel to the pull at its middle but not near the corners,
  where the pull turns. The trade is deliberate.

- **The curtains sway; they do not scan.** *Owner: "si puo evitare l'effetto
  radar sui pilastri?"* Read off the page rather than guessed: the drift ran
  0 → 160 px, **linear, one way, restarting**. A comb of light sliding steadily
  in one direction is a radar sweep whatever it is made of, and the lens curving
  it at the faces sharpened the reading. Now it travels half as far (−38 → 44 px)
  on nearly twice the clock (23 s), eased at both ends and **alternating** — the
  turn-around is the moment it stops being a sweep — at about a quarter of the
  old peak speed. The breath moves to 8.7 s so it shares no factor with 23.

- **Slower, and alive without being random.** *Owner: "il movimento adesso e'
  troppo veloce, rendiamo parecchio piu' lento, molto smooth e soft, e diamo un
  po' di dinamicita' facendo cambiare l'altezza delle bande casualmente."* The
  turn is **5.5 s** (was 1.1 s), named `--slfx-load-turn`, and stays **linear**:
  an eased turn on a closed loop slows and speeds at the same two points every
  pass, which is a stutter you cannot unsee. The filaments' depth breathes
  **28 → 96 px on 7.3 s** — registered so a keyframe interpolates it — and 5.5
  against 7.3 share no factor, so the pair does not repeat its arrangement for
  over four minutes. The comb is uneven too (three stripes of different widths
  in a 58 px period), and the band's ramps shorten the filaments at its ends.
  **Nothing is random**, and nothing needs to be: three periods that do not
  divide each other is the same trick the curtains' two pitches already use.
  Verified by driving the animations rather than waiting: at 1.2 s the light is
  at 288° with filaments 31.7 px deep, at 4.0 s at 489° and 71.7 px.

- **A light with no clock is parked, not slow.** *Owner, on the first render of
  the filaments: "oltre la luce che ruota, ce n'è altra che però è limitata
  all'angolo inferiore sx, non mi piace."* The filaments are cut from
  `--slfx-angle` like the band, but the orbit rule named only `::before`, so
  nothing turned them and they sat wherever that property's initial value
  points — **210deg, the bottom-left corner**. Read off the page rather than
  guessed: the band's pseudo-element carried the orbit, the filaments' carried
  `none`, both at 210deg a second apart. The guard now requires every light cut
  from that angle to appear in the selector that turns it.

- **Loading is the accent.** The ambient light is white, so the one colour a
  surface shows while working is the product's own — which is what tells a
  loading card from a resting one at a glance. Band and filaments are one hue
  at three strengths. Both are declared **on the pseudo-elements that paint
  them**, and that is not a style choice: `seatGlow()` copies the host's values
  onto the glow as **inline** style, and no rule beats an inline declaration.
  The first version put them on the glow and they were silently ignored — the
  same trap as a sibling's missing variables, one level down.

- **Loading runs the border.** *Owner, on the first attempt at it: "deve
  essere un effetto aurora ma che percorre tutto il bordo, da usare per il
  loading" — e il busy.* A line crossing the pane was built first and
  withdrawn; `--beam` keeps it as its own mode. While an element is working the
  curtains stand down and the glow paints the **band** — the conic bloom,
  masked to four strips on the element's own border — and the orbit already in
  the file turns it once per 1.1 s. Nothing is re-declared: it is the base
  bloom, and only where it sits changes. A curtains glow is seated with **no**
  spread, so the band's usual inset — written for a box 32.5 px larger than the
  host on every side — pushed it a third of the way into a card;
  `--slfx-bloom-inset` puts it back on the border. Verified on the showcase's
  busy card: inset 1 px, the four strips at 10 px, blur 6.5 px, clipped to the
  box, orbiting. Determinate is excluded throughout: there the arc's length is
  the value. A filled control (`--rim`) is untouched — its ring steps outside
  the fill by the declension and already orbits.

**Open, and the owner's: how far the white light should decompose.** The colour
at the faces is the lens's `disperse`, an amplification of the IOR triple, and
it is a fraction of the bend — so it applies to everything behind a pane, not
only to the light. Measured on the bed and on the showcase's densest cell:

| `disperse` | colour at the faces | the page's own text behind a pane |
|---|---|---|
| 18 (shipped) | 46 | already fringed, as it was at reach 6 |
| 60 | 63 | each letter splits into red/green/blue copies |
| 100 | 68 | an oil slick |

Sixty is where the decomposition reads as a prism rather than a tint, and it is
also where text behind a pane stops being legible. The two cannot be separated
with one filter: a filter that decomposes the light decomposes the page with
it. The alternatives, neither built: draw the spectrum into the curtains
themselves (costs the page nothing, but the colour is then authored rather than
made by the glass), or accept 18 and a quieter decomposition.

### 1x — the reference at its own zoom — 2026-09-12

*Owner, on 1w rendered: "non siamo ancora vicini alle risorse di
riferimento."* Right: 1w hit four numbers that described depth only, and
three of the four differences it had listed as open were the look. `lab/1x-
aurora-own-zoom.html` (gitignored) is 1w's bed with the three changed
together and measured with `lab/_profile_edge.py … own-zoom`, which reads
the reference as the DPR-2 capture it is and prints the rgb spread (max −
min, a saturation in the same units) beside each luminance delta.

**What changed, and why each:**

- **Colour.** The reference's bloom pixel is a saturated green: spread 30 for
  a lift of 48. The kit's bloom was the vivid accent lifted 55 % toward white
  with chroma pushed 1.25 — spread 17 for the same lift, milk. Now a quarter
  toward white with chroma kept; the gamut fit is unchanged. The depth
  companion's bloom takes the rim beam's 1.15 push so a bloom is never paler
  than its beam (the gamut test says so, and said so).
- **Scale.** `--slfx-soft` 14 → 6.5 px, `--slfx-bleed` 20 → 10 px: at the
  page's zoom the reference's glow is gone by 25 CSS px, and a 14 px Gaussian
  cannot fall to nothing in that distance whatever the band.
- **Clip.** The seated glow is clipped to the host's border box and radius
  (`clip-path` runs after `filter`, so only the spill is cut): the reference
  reads −5 outside, 1w read +33. `--beam` (a line that leaves the pane) and
  `--rim` (light outside a filled control, by the declension) keep the
  outside.
- **Arc.** 250° → 90°: the beam lights ~75 px of one edge of a 320 px card,
  never three edges. The ring's plateau profile is unchanged.

**Measured, kit defaults on the bed, no override** (peak-row reference; the
first two pixels are the glass rim, +104 / +76, and belong to the material):

| depth (CSS px) | 4 | 8 | 10 | 12 | 15 | 20 | 25 | 30 | outside |
|---|---|---|---|---|---|---|---|---|---|
| reference | +43 | +34 | +27 | +20 | +13 | +4 | +1 | 0 | −5 |
| kit | +42.9 | +34.2 | +27.9 | +19.8 | +11.8 | +4.0 | +0.4 | 0 | −1 |
| spread, reference | 32 | — | 22 | — | 11 | 3 | 0 | 0 | 0 |
| spread, kit | 36 | 29 | 24 | 17 | 11 | 3 | 2 | 0 | 0 |

Eight rounds of captures to get there (lift 0 / 0.25 / 0.55; bleed 8–11;
soft 6–7; alpha 35–55). The pale lift read as milk at every alpha, the
vivid accent unlifted read too dark for its spread; a quarter is where the
two ratios meet.

**Still the owner's:** the border line (1w's item 2). The rim of the glass on
a card is ruled: a card is glass, with distortion and refraction (owner,
2026-09-12), so the inset shine stays and the first two profiled pixels are
the material's by design. Everything else in 1w's list is closed.

### 1w — the curve is hooked — 2026-09-12

`lab/1w-aurora-flat.html` (gitignored, like every probe): one `sl-card
sl-fx-glass sl-fx-aurora` from the kit, 319 × 111 CSS px — the composer's own
box — on a flat ground, granted the live sweep with its angle pinned at 145°
so the plateau lies on the LEFT edge, where the beam sits in the reference
capture. Beside it, the reference crop at the page's own zoom. Transitions
and the sweep's keyframes are frozen by hand because the extension's tab is
hidden; the angle is pinned on the pseudo-elements because `--slfx-angle`
does not inherit.

**The instrument.** `lab/_profile_edge.py`: the left edge inward, each depth
the median across the card's middle rows (30–70 % of its height), every
value a delta over the same band 60 px inside, where nothing is lit. The
reference read the same way: its border pixels carry +83 / +88 and the
first interior pixel +34 on the band, +48 on the beam's brightest rows — the
handoff's +48 is the peak-row reading, and the three deeper points agree
between the two readings within 2.

**Two defects the bed exposed before a single parameter moved.** Both were
invisible on the showcase and both are fixed with a regression test:

- the bloom band was a padding ring (`padding: 44px` cut out with a
  content-box mask). A padding cannot shrink below itself, so on any host
  shorter than 88 px the box grew past the host — measured, a 111 px card got
  a 213 × 88 rectangle from its own midline to 29 px below it. The band is
  four edge strips now, which simply overlap on a small host.
- the seated glow was one pixel larger than its host instead of 55:
  `--slfx-glow` is a `calc()`, an unregistered property computes to that text,
  and `parseFloat` read it as nothing. Registered as a `<length>`.

**The fit.** Bleed and the plateau's alpha were varied on the URL, the tail's
alpha held at the reference's own rose-to-green ratio (0.75), the hairline
left where it was; three rounds of three captures:

| | edge | 30 px | 45 px | 60 px |
|---|---|---|---|---|
| target | +48 | +16 | +3 | 0 |
| kit before (44 px, 46 / 34 %) | not readable — the 44 px top and bottom strips lit the middle band itself (+53 over the bed) | +30.6 | +13.3 | 0 |
| **shipped (20 px, 51 / 38 %)** | **+48.0** | **+18.6** | **+2.7** | **0.0** |

"Edge" is the first pixel past the glass rim (the material's own inset shine,
+60 at the border with the aurora off), 2 CSS px in. Verified, not looked at:
two identical captures differ by 0 px; the glow shown against `display:none`
differs by 123 230 px (33.6 %), rows 45–367, max delta 74 — the band, its
blur, nothing else; the hairline at 0.28 against 0 differs by 1 998 px on the
border rows only, +25 on the border pixel. The committed defaults, loaded
with no URL override, reproduce the fitted capture to 0 px.

**Open, for the owner — measured, not decided:**

1. **The reference is a DPR-2 capture, and the target reads it as CSS px.**
   Its border is 2 px, its "1 px arc" is 2 px, the composer is 638 px for a
   ~320 px card. So "+16 at 30 px" is 15 CSS px at the page's own zoom, and
   the reference's glow is gone by 30 CSS px where ours is gone by 60. The
   fit above is to the target as stated. Matching the reference at its own
   zoom is not reachable with bleed and alpha alone — a 14 px Gaussian cannot
   fall to a third in 15 px — and would take `--slfx-soft` ≈ 7 px with a
   bleed near 10 px.
2. **There IS a bright line on the reference's border where the beam passes:**
   +83 / +88 on the band, +93 / +98 on its brightest rows, one CSS px wide.
   The handoff's "no bright line at the edge" read the column after it. At
   0.28 our border pixel is +85, which matches the band reading; the peak-row
   reading would ask for about 0.37.
3. **Our blur spills outside the box** — +33 at 3 px out, +26 at 6, +14 at 12 —
   where the reference has nothing outside (−5). Clipping the seated glow to
   the host's box, as `--pillars` already does, is a one-line ruling.
4. **The sweep lights three edges, the beam one.** A 250° plateau covers the
   top-left and bottom-left as well as the left edge, and on a 111 px card the
   top and bottom strips' blur tails lift the middle band by +5 (interior
   reads 34 where the bed gives 29). A narrower arc would remove it; that is
   a change to the sweep's shape, not to its light.

### The prism — 2026-09-11, late

*Owner: "hai presente l'effetto di luce di un prisma? quello è ciò che ho in
mente."* Dispersion: glass bends red less than blue, so white light crossing an
edge opens into a spectrum. One displacement moves every colour the same
distance, which is a lens with no glass in it — and that is what the lens was
until now.

`glass-lens.js` now splits the backdrop into its three channels
(`feColorMatrix`), displaces each with the **same** map at a **different**
scale, and adds them back (`feComposite arithmetic`). The ratio is
`glass-studio`'s IOR triple — N_R 0.98 / N_G 1.00 / N_B 1.02 — amplified by a
`disperse` parameter, because on a 96 × 40 button the map's own scale is four or
five pixels and ±2 % of that is a tenth of a pixel: physically faithful and
invisible. `disperse` is a parameter rather than a constant for the same reason
glass-studio's own "dispersion" is a knob — the right amount depends on the
pane's size.

Measured on `lab/1t-prism.html` — a WHITE source on a NEUTRAL ground, the only
setup in which a spectrum can be told from a tint; the amber source in `lab/1s`
reads R > B everywhere and proves nothing:

| disperse | the grid line at a pane's edge |
|---|---|
| 0 | grey |
| 18 (kit default) | a thin warm/cool fringe, one side each |
| 45 | red, green and blue lines fully separated |

Still static, still nothing per frame: three displacements of one map, built
once per size.

### The light goes INSIDE, and the lens gets a ceiling — 2026-09-11, late

*Owner, with a screenshot of libraries.dev's own page: "confermo, non è quello
che mi aspetto."* Banked as `docs/references/assets/border-beam-composer-
search-dark.png` and profiled. Against a card ground of L 29 the glow is
**+48** (green) and **+36** (rose) at the very edge, +16 at 30 px in, +3 at
45 px, gone by 60 px — and there is NOTHING outside the box, and NO bright line
at the edge: the edge pixel is the bloom itself (L 77), not a hairline (which
would read L 150+). The only bright core in the picture is the search bar's
beam (L 207).

Three numbers followed from that, all in `effects.css`:

- the bloom band now starts ON the host's border and reaches **44 px inward**
  (`--slfx-bleed`), instead of a 12 px ring straddling the edge;
- its alphas drop from 78/66 % to **46/34 %** — the reference's edge pixel is a
  saturated hue at roughly a third alpha, softened;
- the lit hairline drops to **0.28** opacity (`--slfx-ring-lit`): the light is
  the glow's job, and a focus ring is still a ring.

**And the lens gets a ceiling.** The map's displacement is a fraction of the
box, so a 500 px card bent about 30 px where a 96 px button bends 5 — the wave
under the live card that made nothing about its light judgeable. Glass does not
bend more for being wider; a slab bends at its edge by a fixed few pixels.
`lens()` now caps the scale at `reach` (default **6 px**); on the showcase every
lens reads 6, card and button alike, and the card's backdrop lies still.

**Not measured, and why.** The showcase's live card sits on a giant typographic
wordmark, and a profile through it reads the letters, not the glow (+90 at 30
px in is a white "R" through the glass). The reference's card sits on flat
near-black. Matching the aurora to the reference's curve the way the glass was
matched (`lab/1n`) needs its own bed on a flat ground — `lab/1w`, next.

### The sweep, in border-beam's image — 2026-09-11, late

*Owner, pasting border-beam's README: "prendi spunto, non usare la libreria di
per sé… è per darti idea dell'effetto che ho in mente per l'aurora e il
loading."* The library needs React 18 and inlines its stylesheet in its JS;
the site is Astro without React and the kit is vanilla, so it is a source to
read, not a dependency to take. Read from its 1.3.0 bundle:

- the `md` beam's mask spans 30 → 95 % of the ring with a full plateau from
  52 → 80 %: a LONG soft band, not a point;
- its body is several radial colour blobs under that mask — multi-hue along
  the arc — with a `hue-rotate` drift of ±range over 12 s;
- opacities are low (stroke 0.46, bloom 0.38 on dark) and `mono` halves them;
- `strength` scales the opacities; `active` pauses the spin.

Our arc was already 250° (69 % of the ring), so the width was never the
difference. What read as a lighthouse was the PROFILE: one hue with a white
core (`--slfx-core: 86%`) — a hard bright point sweeping a rim. Changed:

- the ring's stops now ramp 0 → 22 %, hold to 80 %, ramp out to 91 % of the
  arc, and the colour CHANGES along it — accent at 22 %, its complement
  (oklch h + 180) at 50 %, a split (h + 150) at 72 % — all derived from
  `--slfx-accent-vivid`; the white core is 0 %;
- the bloom follows the same plateau, so the glow is a long soft band under
  the arc and not a halo round one point;
- the sweep is the default again; `--pillars` and `--beam` stay as classes.

**Found while looking, and larger than the sweep:** on a 400 px card the lens
warps the whole interior — the backdrop's letters bend as if under water. The
displacement map's scale grows with the element's size, so the same `lens()`
that is a prism on a button is a wave on a card. `disperse` and the map's own
scale need to fall with size, or cards need a lower-scale mode. Untuned; it is
the next thing.

### Pillars are the aurora — 2026-09-11, late

*Owner: "sfruttiamo lo stesso concetto per le aurore che ruotano lungo i bordi…
sostituiti dai pilastri, che però in questo caso hanno tonalità che si basano
sul colore accent + suoi colori complementari."*

The pillars are now the aurora's light by DEFAULT on every host: the rotating
sweep on the edge is opt-in (`--sweep`), `--beam` is the line through the
glass, and everything else gets the curtains. Nothing torn out — one class
brings the lighthouse back. The busy orbit is untouched: it reports state and
is not the sweep.

**The palette is derived, never declared.** Curtain A is `--slfx-accent-vivid`
— the accent lifted to the vivid tier and gamut-fitted, which is already how the
edge's warm fringe is made. Curtain B is the same colour turned 180° in oklch:
`oklch(from var(--slfx-accent-vivid) l c calc(h + 180))`, so it keeps the
accent's lightness and chroma and changes only hue — which is what
"complementary" means in a perceptual space, and what keeps it inside the gamut
the accent was fitted to. The ribs stay the light pole. A product that
re-registers its accent gets its own pair (AC-18 holds; no new token, AC-11).
Measured on the showcase: A resolves to oklch h 71 (amber), B to h 251 (blue).

Verified on the busy card: amber and blue curtains inside the card, each one
parted by the lens into a coloured fringe at its edges, the title and body text
crisp on top. Eighteen seated glows carry it.

**What to expect, and the two levers.** On a 320 px card the map's own scale is
large, so dispersion is visible across the whole interior, not only at the
pane's faces — every pillar edge fringes. It is a lot. The levers are
`disperse` on the lens and the two curtain alphas (62 % / 58 %); neither has
been tuned, because the owner said he does not yet know what he wants, and a
strong first cut is easier to bring down than a faint one is to find.

### Pillars — 2026-09-11, late

*Owner: "la verità è che non so nemmeno io cosa voglio… proviamo con un glow a
pilastri di luce tipo aurora, che non deve uscire dall'elemento ma vedersi solo
al suo interno, e scomporsi come abbiamo fatto adesso."* That is what probes
are for, and the beam stays as a mode rather than being torn out.

`.sl-fx-aurora--pillars`: aurora borealis rather than a lighthouse — vertical
curtains of light hanging INSIDE the pane, brighter at the foot and fading
upward, drifting sideways on one clock (13 s) and breathing their softness on
another (5.5 s) so the shimmer never repeats. Two curtains at different pitches
beat against each other. They never leave the element: the seated glow has no
spread for this mode, and is clipped to the host's own box and radius. They
sit behind the pane, so the lens bends them at the faces and dispersion parts
them — the same prism as the beam, on a softer light.

On the showcase's Glass cell both buttons carry it. Measured, pillars on
against pillars `display:none`: 34 223 differing pixels (12 %), max channel
delta 207/255, confined to rows 171–282 of the capture — the button row and
nothing outside it. So they paint, they are strong, and the clip holds.

The guards now allow eight edge rules to declare a background, the eighth named
as the pillars, and the radius exemption covers both light modes.

### The beam is in the kit — 2026-09-11, late

`.sl-fx-aurora--beam`: the aurora's seated glow paints a thin white line
through the pane instead of a ring around it. Additive — the conic sweep stays
for every host that does not ask for this — so it is reversible with one class.
The line is `--slfx-glint`, 3 px, angled −18°, long enough to enter one face
and leave the other whatever the host's width, drifting across the pane on an
11 s alternate (registered `--slfx-beam-dy`, inside the motion guard). Nothing
else is drawn: the bend at each face and the colours parting there are what
the pane's lens does to a light passing behind it.

On the showcase's Glass cell, "Run probe" carries it. Verified: the glow is
seated, lit, drifting, rotated, and — after one more variable — visible. The
beam is MADE of `--slfx-glint`, which was not among the nine variables copied
onto the seated glow, and a background of an undefined `var()` is no background
at all. Same class of defect as the ring's earlier disappearance, found the
same way: computed style, not a screenshot.

Two guards were extended rather than bypassed: the count of edge rules allowed
to declare a background goes from six to seven, naming the beam; and the
radius guard exempts the beam's 2 px end-cap, which is a line's own shape and
not a host corner.

### The prism proper — 2026-09-11, late

*Owner, with the reference picture: a white beam enters one face of the prism,
the spectrum leaves the opposite face as a widening fan; "disperse 60 però con
blur variabile, deve essere tutto molto dinamico."*

Two different things are in that picture, and the kit does one of them:

- **The entry is real.** The beam sits behind the pane; the lens bends it where
  it crosses the face and dispersion parts it there — at 60, blue/green/orange
  fully apart at the entry face and a cyan fringe at the exit. That is
  `backdrop-filter`, and it costs nothing per frame.
- **The exit is emitted light, and no filter can paint it.** A displacement
  map moves pixels inside the pane; it cannot put a spectrum on the page
  outside it. The fan is a DRAWN element: a band anchored at the exit point on
  the far face, rotated to the exit angle, clipped to a wedge, filled across
  its width with the spectrum (red on the side nearest the incoming line —
  red is bent least), fading with distance. It shares one custom property
  with the beam (`--dy`), so the two drift together and the fan stays glued
  to the beam without a line of script.

**Dynamic, by three clocks that never lock step.** The frost on the pane
breathes (`--slg-lens-blur` 0.2 → 3.2 px, `--slg-lens-sat` 1.05 → 1.5, 4.2 s),
so the beam inside sharpens and softens; the fan's blur breathes on its own
(0.8 → 7 px, 6.5 s) and its reach on a third (×0.82 → ×1.12, 9 s, offset); the
whole assembly drifts (12 s). `lab/1v-prism-fan.html`.

**Kit change to make it possible:** `glass-lens.js` no longer writes blur and
saturation as literals into the filter chain. They are `var(--slg-lens-blur,
<fallback>)` and `var(--slg-lens-sat, <fallback>)`, and `glass.css` registers
both with `@property` so a keyframe interpolates them. Verified: half-way
through the frost keyframe the computed chain reads `blur(1.7px)`.

### The beam — 2026-09-11, late

*Owner: "immagino un fascio di luce che entra nel vetro e si scompone."* That is
the prism proper, and the lens now does it with no further code: a narrow white
line, angled, sitting behind the pane. Where it crosses the pane's edge the lens
bends it and dispersion parts it — red bent least, blue most — so the beam
enters at one edge as orange/green/blue and leaves at the other as
blue/green/red. `lab/1u-beam.html`, two cells: `disperse` 18 (the kit default:
a coloured fringe on the beam at each edge) and 60 (the three colours fully
apart, the schoolbook prism).

What this settles about the light model: the aurora's light source should be a
BEAM, not a blob and not an arc. A blob (`lab/1s`) makes a pane glow; a beam
makes a pane *do* something — bend and split it — which is the whole reason to
have glass rather than a tint. The beam wants to be thin (3 px, a soft halo),
white, angled off the axis, and to drift slowly across the pane rather than
around it. Next slice: this beam is what replaces the conic sweep in
`effects.js`.

### The aurora is a lighthouse, and no parameter fixes that — 2026-09-11, late

*Owner: "sembra più che altro una sirena o un faro… nulla a che vedere con
bagliori di luce che interagiscono con vetro e si deformano."* Correct, and it
is structural: `border-beam`'s recipe is a conic arc **travelling around a
border**. That is a beam on a rim, and it stays a beam whatever its width,
blur or speed. The card's *Take: the recipe entire* is therefore superseded for
the glass family — it was verified before a real lens existed to compare it
with.

**What light in glass actually is:** a soft SOURCE with a hot core, sitting
behind the pane, moving **across** it rather than around it. The lens bends the
whole source and CONCENTRATES the core — the pile-up of brightness along a
pane's edge is a caustic, and it is the one thing a rotating arc can never
produce. `lab/1s-light-source-behind-glass.html`: stage A is a wandering
source on a 14 s path through a row of lensed panes; stage B is the same source
following the pointer with a 900 ms lag. Verified on a still with the source
parked behind a ghost button: the pane lights from within, the core banks up
against the pane's right edge, and the primary beside it stays its own colour.

**Two kit defects found on the way, both fixed in `glass.css`:** the rule that
stands the ground tint down under a lens had been cut by accident with the
specular block and never shipped; and `glass-lens.js` claimed to clear the
host's background and did not, which only showed on a page without
`effects.css` — every lensed card and primary stayed opaque over a working
lens. Under a lens the host fill and the GROUND tint now go to zero; the ACCENT
share stays, or a lensed primary is indistinguishable from a lensed ghost.

**Not done: retiring the sweep from the kit.** The aurora's `data-sl-fx-live`
contract — busy, determinate, granted-live — is state the surface reports, and
replacing its renderer is a change to that contract, not a tuning. The source
model is proven in the lab; moving it into `effects.js` in place of the conic
sweep is the next slice's first task.

### The light has to move behind the glass — 2026-09-11, measured on `lab/1r`

The lens is a `backdrop-filter`, so it bends what is painted BEFORE the element.
`.sl-fx-aurora__glow` is a CHILD of the host: a child is painted as part of its
element, after the backdrop has been sampled, so the lens cannot see it. Today's
aurora is therefore light laid ON the glass, not light caught IN it.

One light, one lens, two placements, side by side:

| | placement | what the lens does to it |
|---|---|---|
| A | glow inside the pane (today) | nothing — a flat, uniform wash |
| B | same glow as a sibling before the pane | it pools and bends at the edges |

In B the light gathers along the inner edges and squeezes into a bright band at
the bottom, which is what light does in a glass edge. That is the effect the
owner asked for, and it costs no new code at all — only a different place in
the DOM.

**The open fork, and it is a real one.** A sibling needs geometry from
somewhere:

- *Coordinates* — position the glow absolutely against the host's box and
  track it with a ResizeObserver. No markup change for consumers, but it is
  the same viewport-versus-offset-parent trap that made shuding's panel jump,
  and it breaks if the host's offset parent is not positioned.
- *A seat* — inject a wrapper around the host, `position: relative`, with the
  glow inside it before the host. No coordinate arithmetic at all and it cannot
  drift, but it changes a consumer's DOM around an element they wrote, and an
  inline-flex seat around a button can move layout.

The seat is the more robust of the two and the more invasive. Not chosen yet.

### The route that works — 2026-09-11, late

**`shuding/liquid-glass`** (MIT, © 2025 Shu Ding, 292 lines, copy-paste, no npm
package). It builds an feImage displacement map on a canvas from a rounded-rect
SDF, hands it to `feDisplacementMap` as a `data:` URI, and puts
`backdrop-filter: url(#id)` on an element. **Nothing rasterises the DOM**, which
is what makes it usable: every hang in the `@ybouane/liquidglass` attempt came
from DOM rasterisation, and that dependency is now removed.

**It overturns this repo's own ruling.** `backdrop-filter: url(#f)` displacement
is NOT inert in Chrome 152 — his script bends a page's grid lines visibly, in
this browser, unmodified. The 45-pixels-of-114 704 measurement was a fact about
*liqui.design's* filter, not about the browser, and the capture-plate lens was
never the only route. `docs/memory/backdrop-filter-url-svg-displacement-is-
applied-but-inert-ch152.md` carries the correction.

**What to bind, and what not to.** His file builds one fixed draggable panel.
Aimed at a design system, the useful part is his `Shader` class; the panel is
not. Tested as five cases on one page (`lab/1q-shuding-variants.html`), his code
unchanged and only the container's size and placement varying:

| | case | bends? |
|---|---|---|
| A | his own 300 × 200, fixed | yes |
| B | 96 × 40, fixed | yes |
| C | 96 × 40, absolute in a holder | yes |
| D | 96 × 40, absolute over a real `.sl-btn` | yes — but the LABEL refracts too |
| E | his filter put **on** the `.sl-btn` itself | **yes, and the label stays crisp** |

**What scroll does, and what it should do.** A lensed button that scrolls WITH
the page shows an unchanging refracted image — measured at `scrollY` 421 and
438, the view through the lens is identical — and that is correct, not a frozen
effect: the element and its backdrop move together, so nothing new passes
behind it. Scroll becomes visible motion only under an element that stays put
while the page moves — a sticky toolbar, a fixed command bar — which is the
place to reach for this next. Dragging changes the image for the same reason in
reverse: the panel moves relative to the page.

**It costs nothing per frame.** The displacement map is built once for an
element's size; `backdrop-filter` is continuous and the browser reapplies it
itself. No render loop, no rAF, no per-frame canvas — the opposite of the GPU
route this slice spent a day on.

**Do not move his container.** His drag code reads the start position from
`getBoundingClientRect()` — viewport coordinates — and writes it back into
`style.left/top`, which on an absolutely positioned element are relative to its
offset parent. Re-parenting his panel into a holder therefore makes it jump by
the distance between those two frames on the first pointer movement: a large,
arbitrary-looking offset on click. His code is correct for the fixed panel it
was written for; the defect was in moving it. This is a second reason case E is
the right shape — it uses his filter and never his container at all.

**E is the shape to ship.** Construct his `Shader` at the element's size, append
only its `svg` (never its `container`), clear the element's own background and
set `backdrop-filter: url(#<id>_filter) …` on the element. The label is then
untouched by construction — `backdrop-filter` reaches only what is behind an
element, never its content — which satisfies AC-25 without a rule.

**A rewrite of the same idea does not work.** `lab/1p` re-implemented the SDF,
the normalisation and the scale by hand and never displaced at any `scale`, with
`href` or `xlink:href`, while `blur`/`saturate`/`brightness` in the same chain
all took effect. Use his code; do not paraphrase it. The differences that matter
and were got wrong are his `maxScale *= 0.5` normalisation, deriving the
filter's `scale` from the measured maximum displacement, and his SDF's own
half-extents (0.3, 0.2) and radius (0.6).

### Direction change — 2026-09-11: USE the knowledge base, do not reproduce it

*Owner: "voglio riusare quello che sta nel KB con leggere differenze. ESATTAMENTE
COME SONO, non devi replicarli, devi usarli."*

Measuring a reference capture and re-tuning the kit's own CSS until the profile
matches within ±2 luminance — which the section below records — **is**
reproducing it. Everything after this heading is the route the owner asked for:
install the library and drive the kit's own elements with it.

**`@ybouane/liquidglass` 1.0.3** — MIT, **zero dependencies**, zero peer
dependencies, vanilla ESM, WebGL refraction with chromatic aberration, Fresnel
and a specular. Chosen over `dashersw/liquid-glass-js`, which is the other
library the owner pointed at and is not usable here: no npm package, script tags
only, and an API that CONSTRUCTS its buttons (`new Button({text, onClick})`)
rather than decorating ones a design system already ships.

**Four conditions it needs, none of them in its README, all found by
experiment.** They are integration constraints on any surface that uses it:

1. Glass elements must be **direct children** of the root passed to `init()`.
   Anything nested is dropped with a console warning.
2. The backdrop must be a **child** of the root, never the root's own
   `background`. The library rasterises the root's non-glass children, so a
   background painted on the root itself is invisible to it and every pane
   renders solid white.
3. A glass host must **not paint its own fill** — the library puts its canvas
   INSIDE the element, and an opaque background covers it.
4. A glass host must be a **stacking context**; that canvas sits at
   `z-index: -1` and otherwise falls behind the page entirely.

**The settled configuration**, on `lab/1o-liquidglass-real.html`, 121 fps from a
cold load:

```json
{"cornerRadius":22,"button":true,"blurAmount":0.06,"refraction":0.80,
 "chromAberration":0.07,"edgeHighlight":0.14,"specular":0.18,"fresnel":1,
 "saturation":0.10,"tintStrength":0.04,"shadowOpacity":0.28,"shadowSpread":12}
```

The library's own defaults ship `blurAmount`, `specular`, `saturation` and
`tintStrength` all at 0, which reads as a bare lens; the first pass upward
(`specular: 0.55`, `edgeHighlight: 0.35`) washed the labels out. These are the
values between the two.

**Still open.** An earlier build of the same probe hung in `init()` — the
canvases were created, so `_setupGlassElements` ran, and the first
`captureToCanvas` never settled. Rebuilding from a minimal case and growing back
up reached a working page, but the cause was never found: it is not the webfont,
not `color-mix` in the backdrop, not the `<button>` tag, not the kit's
stylesheets, not `button: true`, not two panes and not the paragraphs — each was
added to the working baseline in turn and none reproduced it. A design system
cannot ship an integration whose failure mode is unknown, so this has to be
understood before the kit depends on it.

### It runs — 2026-09-11, in the kit, on the showcase and on `lab/1l`

The GPU route is no longer code that has only seen static tests. Four things had
to be true before a single refracted pixel existed, and each cost a measurement:

1. **`vgpu`'s reflection is usage-based.** A binding reached only from inside a
   branch is not in the pipeline at all, and `effect()` refuses with
   `Binding 'backSampler' does not exist in 'effect'` before anything draws.
   The backdrop is therefore sampled **unconditionally** and mixed by the flag.
   WGSL wants this anyway: `textureSample` in non-uniform control flow is
   undefined, which also forces the sampling *above* the `inside` early return.
   Cost of an undeclared backdrop: three reads of a 1 × 1 transparent texel.
2. **`createImageBitmap` refuses an SVG** — *"The source image could not be
   decoded"* — and a declared backdrop is most naturally an SVG. The route that
   works is `new Image()` + `await img.decode()` +
   `copyExternalImageToTexture`, which takes the element directly. The first
   version swallowed this failure in silence, so the glass branch went a whole
   session without ever executing while all 173 tests stayed green; the catch
   now says so out loud.
3. **The backdrop needs an anchor, not just a declaration.** `--slfx-backdrop`
   inherits, so a pane cannot tell which ancestor set it — and it is that
   ancestor's box the image covers. Sampling at the pane's own `uv` squeezes the
   whole image into every button. The surface marks the box with
   `data-sl-fx-backdrop`; the kit measures the pane inside it and passes the
   rect as `look.backRect`.
4. **A surface must PAINT what it declares.** The showcase declared
   `backdrop.svg` over a cell that painted DOM telemetry text instead, so the
   glass would have bent an image nobody could see. The anchor now paints it
   from the same custom property — one source of truth — at
   `background-size: 100% 100%`, because any other size lies to the mapping.

**Withdrawn: the tint ruling at 0.50.** It measured the wrong quantity, and the
owner's verdict on the day — *"il risultato mi sembra sempre mediocre comparato
alle librerie"* — is what sent us back to the cards to find out why.

**The gap to the references was never refraction.** This file already contains
the measurement, taken 2026-09-11 and recorded under the `liqui-glass` card:
toggling only its `__refract` layer changes **45 pixels of 114 704**, and the
backdrop's own hairline behind the button has **zero** differing pixels. The
reference this slice is modelled on does not displace anything. A full day went
into building a working lens, which the kit now has and the reference does not,
and none of that day went into the four things the reference actually does.

**AC-33 is overridden for the glass family.** *Owner, 2026-09-11: "il risultato
finale deve essere COME IL KNOWLEDGE BASE".* AC-33 reads "an element at rest
carries no light", and both the `metal` and `liqui-glass` cards carry a *Leave*
line saying the same — the latter naming the reference's always-on layers as the
thing not to take. The owner's newer ruling supersedes all three: the rim and
the polish are what the surface IS, and a pane with them switched off at rest is
not the material the knowledge base shows. What stays pointer-gated is the light
the pointer actually brings — the pool, the specular that tracks it, and the
edge that turns to face it.

**The specular is not optional, and dropping it is why an earlier pass read as
flat.** Profiled down the middle of the reference capture, against a backdrop at
luminance 102: the top edge peaks at **197** and is still at **148** six pixels
in, the interior sits at **85**, and the bottom edge returns to **163**. The
bright top is a BAND about eight pixels deep — not the 1 px inset shadow the
card records for `__shine`, which is a second, harder thing. It is rebuilt here
as two gradients over the page's light pole rather than the original's
pre-baked PNG, so it follows a theme and AC-18 holds.

**The material is now adopted, not re-derived.** `packages/ui-kit/glass.css` is
liqui-glass's own anatomy (MIT, © 2026 Fan Li) with every colour moved onto a
Sondalab token, `__refract` dropped (0.04 % of pixels, and it needs JS), and
`__specular` dropped (a pre-baked PNG cannot follow a token through a theme
change — AC-18). 141 lines, no script, no dependency.

**Settled by measurement, not by eye: the profile matches the reference within
±2 luminance.** *2026-09-11.* `lab/_profile.py` reads the reference capture and
a capture of ours down the pane's PADDING band — inside the rim, outside the
label, the only part of a text button that is nothing but glass — and reports
luminance at fixed fractions of the pane's height relative to the ground just
outside it, so a 34 px reference and a 66 px screenshot compare number for
number. Final state:

| | reference | ours | delta |
|---|---|---|---|
| top +6% | +78.5 | +79.6 | **+1.1** |
| +18% | +23.7 | +22.4 | −1.3 |
| middle | −14.6 | −16.5 | −1.9 |
| +88% | −14.6 | −15.5 | −0.9 |
| bottom | −14.3 | −8.3 | +6.0 |

Shipped values: `--slg-tint-a: 18%`, `--slg-spec-a: 72%` falling to nothing at
26 % of the height, `--slg-spec-lo-a: 0`, `--slg-rim-lo` at 5 %.

**Every highlight is made of a derived light POLE, not of `--sl-text-primary`.**
On ink that token is the bright end of the neutral pair (L 0.91); on paper it is
the dark end (L 0.24), and a highlight made of it paints a black band where the
reference has a white one. `glass.css` mirrors its lightness — `max(l, 1.2 - l)`
— which is the same criterion `effects.css` already applies to `--slfx-glint`
and the shader applies at runtime. Written out in `glass.css` so the stylesheet
stands alone, and bound to `--slfx-glint` from `effects.css` so there is one
source wherever both are loaded. Verified on the light theme: the band stays
light and the label stays ink.

**The light theme is NOT comparable against this capture, and the numbers were
not chased.** Profiled on the same bed it reads roughly +35 across the whole
pane — correctly. The tint follows the page's own ground, the probe's bed is a
fixed mid-blue, and a cream veil over blue can only lighten; the reference's
capture sits on its own light page. Judging the light theme needs either a light
Sondalab surface under the pane or its own reference capture. Left open.

**Three of the readings that produced this were wrong, and the instrument is
the finding.** A column three pixels inside the left edge reported `__shine`'s
inset shadow as the interior, and sent the tint to 0.37. A column a quarter
across ran through the label and reported white text as the glass, and sent it
to 0.46. A median across the full width was still pulled up by both. The
owner's 0.14, picked by eye, was closer than either correction. Do not profile
a text button on a column you chose by hand.

**Superseded: tint density 0.14.** *Owner, 2026-09-11, on `lab/1n-css-material.html`
against the reference capture.* The card's own figure is 0.5125, and the
departure is required rather than preferred: that alpha sits on a dark blue-grey
in the original, while `--sl-bg-canvas` is nearly black, so the same number
covers far more. AC-6 recorded.

Three of the four deltas are corrected, and each traces to a card:

1. **The tint was one knob doing two jobs.** `glass = mix(glass, accent, tint)`
   made the pane a slab of coloured plastic at any value worth seeing. The card
   says a material's tint is *dark and desaturated* — `liqui-glass` tints
   near-black at 0.5125, `glass-studio` ships one that is fully transparent —
   and that a variant *"overrides `--lg-tint`… instead of hiding"* the glass.
   Split in two: `--slfx-glass-shade` (default **0.5125**, the card's figure)
   darkens toward the page's own ink, and `--slfx-glass-tint` (default **0**)
   is the variant's small accent share. The dark pole mirrors the light pole —
   the ground on ink, the text colour on paper — so a light theme darkens
   rather than turning into the white frost `od-glassmorphism` is kept to name.
2. **The rim was a ring.** `liqui-glass`'s is an inset shadow on the **top**
   edge plus a weaker 1 px side pair and nothing along the bottom: light from
   above. A Fresnel term applied evenly round the perimeter reads as a border.
   Now weighted by how far the outward normal points at the sky
   (`--slfx-glass-rim-up`, default 1).
3. **Still missing: the specular.** `liqui-glass` has a dedicated `__specular`
   layer at 0.7 — a broad soft highlight on the face, not only on the edge. The
   kit has a glare lobe on the rim and nothing on the face.

**And the limit that remains structural.** `liqui-glass` frosts the *real page*
with `backdrop-filter`; the kit bends a **declared image**, because a canvas
cannot read the DOM beneath it and `backdrop-filter: url()` displacement is
inert in Chrome 152. So the refraction only exists where a surface marks a box
with `data-sl-fx-backdrop`. Everywhere else the pane is the CSS tier, which is
correct on its own but is not the reference's material.

**Closed: refraction is a material, not a light.** *2026-09-11.* The shader used
to return early on `presence`, so a pane bent its backdrop only under the
pointer. AC-33 asks an element at rest to carry no *light*, and a bend is not
light. Two changes:

- `presence` now gates the light terms alone — every one of them is already
  multiplied by it — and only kills the frame outright when no backdrop is
  declared, where there is no material to show either.
- A pane that resolves a backdrop anchor gets a canvas **of its own**, painted
  once and repainted only when its box or the theme moves. Every other pane
  keeps the single shared canvas the pointer carries between them.

The split is what makes it affordable. A sweep of thirty surfaces measured about
0.6 s in one go, so nothing sweeps: a static refraction has nothing to animate,
and panes are tracked lazily as they scroll into view. A pane with nothing
declared still gets no canvas, because the shader would leave it empty.

`lab/1l` no longer forges this with a forced `lit: 1` — it runs `mount()` +
`mountGpu()`, so the tint was chosen on the shipped rendering.

## Slice 1 rulings (AC-6)

AC-6: *"No value in shipped code that a card supplies is different from the card's, unless a recorded ruling says so."* Slice 1 diverges from `liqui-glass` on both of its material numbers, and on one mechanism. The rulings:

1. **Tint 0.14, not the card's 0.5125.** *Owner, 2026-09-11, on the rendered ladder.* The card's pair was measured on a demo tile sitting on a saturated, high-contrast backdrop, which is what makes a heavy tint survivable there. On a Sondalab surface the same tint reads as an opaque slab and leaves the blur nothing to do.
2. **Blur 2px, not the card's 5.9px.** *Owner, same pass.* Between `glass-studio`'s default of 1 and the card's 5.9; with the tint down, 2px is enough to register as material without erasing what is behind the control.
3. **No `mix-blend-mode`, though the card's light mode composites with `multiply`.** *Forced, and measured.* A descendant carrying a blend mode other than `normal` makes its stacking context a backdrop root, which leaves a sibling's `backdrop-filter` with nothing behind it: toggling blur on the light panel changed **0 px** with the blend present and **2847 px (9.88 %, max delta 103/255)** with it removed. `metal`'s light-mode ruling — the glow darkens and never adds white — is therefore taken as a *result* and carried by already-dark colours, not by the reference's mechanism. Any promotion that reintroduces a blend mode inside a glass element loses the material entirely.

4. **On the light theme the rim and the pointer glow are not dark — they are light, and take their contrast from chroma.** *Owner, 2026-09-11, overruling a verified card.* `metal`'s measured light preset composites the glow with `multiply` at 0.27 under `saturate(5.4)` and so *darkens*; rendered on a Sondalab ground that reads as dark glass, which the owner rejects — the light theme has to be solar. The ruling keeps the **saturates** and drops the **darkens**, which is not an invention: `effects.css` already solved this shape on 2026-09-09 — a light effect on a light page cannot take contrast from luminance, because a dark token reads as pigment and lifting it toward white goes pale, so the recipe floors the oklch lightness and pays the lift in chroma. `metal`'s *Leave* line gains this clause. **Chosen 2026-09-11: `oklch(0.86 0.17 82)`** — a warm hue kept high in lightness with the contrast paid in chroma; the sides and the specular are the same hue one step down (`0.84 0.16 78` and `0.87 0.15 84`). The deeper alternative at `0.78 0.20 70` was rejected as heavier than the ground wants.

   **How it is expressed in the kit, since AC-18 forbids a colour literal and AC-11 forbids a new token.** The house accent is already warm — `--sl-accent-default` is `#B56A0C` on light (`L .595 C .133 h 62.8`) and `#F5A83C` on dark (`L .789 C .148 h 71.0`) — so the rim derives from it, with the hue carried by a **fixed rotation of +19°**: that is exactly the gap between the light accent's hue and the hue chosen on the render, and writing it as a rotation keeps the hue traceable to the token instead of stamped as a constant. The rotation applies to the **light theme only**; the dark rim stays neutral and comes from the existing sheen-derived glint, so `h + 19` is never evaluated there.

   ```css
   /* asked for; the existing seven-step bisection fits it to sRGB */
   oklch(from var(--slc-accent, var(--sl-accent-default)) 0.86 0.17 calc(h + 19))
   ```

   **And the chosen colour is outside sRGB, which matters.** `oklch(0.86 0.17 82)` puts red at **1.035**; Chrome does not gamut-map, it clips, so what was on screen during the pick was `#FFC425` — the clipped colour, not the one asked for. AC-19 and `scripts/effects-gamut.test.mjs` forbid shipping that, and `effects.css` already carries the fit that solves it: chroma reduced at constant lightness and hue until inside. Fitted, chroma goes **0.170 → 0.141 (83 % of asked)** and the colour is **`#FFC759`**, a touch creamier — the sides fit at 92 % (`#FFBD4A`) and the specular at 92 % (`#FFCC5F`). The owner confirmed the **fitted** colour against the clipped one on `lab/1c-buttons-light-rim.html`. The kit asks for 0.17 and lets the bisection fit it, rather than hardcoding 0.141, so the result stays correct if the accent token ever moves. The tint gradient also goes warm-neutral rather than slate on light, since a slate tint carries the dark-glass reading on its own.

5. **Variant hierarchy lives in the tint. The light never carries it.** *Owner's doubt, 2026-09-11, answered on the render.* The concern was real: the kit puts the whole primary/ghost/base distinction in the **fill** (`.sl-btn--primary` is a solid `--slc-accent`, `.sl-btn--ghost` is a border, `.sl-btn` is bare), and glass replaces exactly that. `lab/1d-buttons-variant-hierarchy.html` put three arrangements beside the flat components as they ship:

   - **the light carries it** (one tint for all, the variant in how much light each takes) — **rejected**: with the light armed, Save, Cancel and Skip are barely separable, which is the failure the doubt predicted;
   - **the tint carries it** — holds, and reads in the same order as the flat components do today;
   - **both** — holds, but buys nothing the tint does not already buy, and makes the light semantic, which Decision 1 reserves for state.

   So the ruling follows `liqui-glass`'s measured line — *"Variants don't paint over the glass — they override `--lg-tint`"* — and it has a consequence that corrects ruling 1: **tint 0.14 is the tint of the neutral button, not a global constant.** Primary carries the accent at near-full alpha and keeps its `--slc-on-accent` label; ghost carries a faint accent tint plus the 1 px border; base carries none and is glass and rim only. The **pointer light is identical on all three**, because it is the material responding to a pointer, not a signal about rank.

6. **Primary is glass too, at tint ≈ 0.42, and its label flips with the theme.** *Owner, 2026-09-11: primary has to keep an appreciable transparency and its own play of light.* Ruling 5 had left primary at a near-opaque accent, which is not glass at all. `lab/1e-buttons-primary-glass.html` ladders it and computes, per cell, the worst WCAG ratio of the label against the accent composited over each of the four backdrop stops:

   | tint | dark theme | light theme |
   |---|---|---|
   | 0.28 | 6.67:1 (light label) | 9.75:1 (dark label) |
   | **0.42** | **5.07:1 (light label)** | **8.29:1 (dark label)** |
   | 0.58 | **4.42:1 — fails** | 6.84:1 |
   | 0.92 | 8.19:1 (dark label) | **4.43:1 — fails** |

   Two things follow, and neither is what intuition suggests. **Transparency helps contrast rather than hurting it**: the failures are at 0.58 on dark and at 0.92 on light, not at the transparent end. And there is a **dead band in the middle on dark**, around 0.58, where the composite sits at mid-luminance and neither a light nor a dark label clears 4.5 — a primary must not be tuned into it. 0.42 clears both themes with margin and is transparent enough to read as glass, so that is the value; the label takes the light `on-accent` on dark and the dark one on light.

   The measurement is analytic over the four wash stops rather than sampled off the rendered pixels, and it ignores the blur and the saturate — both pull the backdrop toward its local average, which cannot make a stop more extreme than the stop itself, so the figures are the pessimistic end. The repo's own contrast gate at promotion remains the authority.

7. **Primary is glass — tint 0.42 on light, 0.34 on dark — and the label is `--slc-text`, not `--slc-on-accent`.** *Owner, 2026-09-11.* Appreciable transparency with its own play of light, not a solid fill.

   The first pass of this ruling said 0.42 on both themes, on a probe figure of 5.07:1. **That figure was wrong and the error was the method's own:** the probe used `#FFF6E8` as the dark label, which is not a token — it was invented, which the knowledge base's governing rule forbids. Against the real `--sl-text-primary` (`#DAE3E4`) the same cell measures **4.16:1 and fails**. On dark the ceiling is between 0.34 (4.86:1) and 0.38 (4.50:1, already under), so dark takes **0.34**; light is unaffected and keeps **0.42** at 8.21:1.

   **The label token changes too, on both themes.** `--slc-on-accent` is built for an opaque accent and goes the wrong way under a translucent pane — `#0A0A0B` on dark gives 3.39:1, `#FFFFFF` on light gives 1.92:1, both failing. `--slc-text` clears every variant on both themes: primary 4.86 / 8.21, ghost 6.66 / 10.80, base 9.25 / 13.10. This is a change to the component contract, not only to the effect, and the promotion has to carry it.

## The design, as it goes to promotion

Settled across 1–1f, in the form the kit has to take:

| | |
|---|---|
| **Material** | `backdrop-filter: blur(2px) saturate(1.7)` |
| **Layers** | `::before` the pane's body — the filter **and** the variant tint; `::after` the edge and the pointer's light. Two, as Decision 3b requires |
| **Tint alpha lives in the colour**, never in `opacity` | `opacity` on the filter's own element scales the filtered backdrop and throttles the blur; a background with alpha composites over it and does not |
| **Tint per variant** | primary `color-mix(in srgb, var(--slc-accent) 72%, transparent)` on **both** themes; ghost 18 % plus the 1 px border; base none. The remainder is the page, never a veil |
| **Label** | the pole that contrasts with the composited pane: `--slc-on-accent` on the primary's dark pane, `--slc-text` everywhere else |
| **Edge** | one continuous 1 px conic ring on `::after`, masked to the border band, static, `opacity: 0` at rest — AC-33 as one number |
| **Spot** | the radial glint rides `::before` with the pane, since the ring's mask would clip it |
| **Light theme's hue** | `oklch(from var(--slc-accent, var(--sl-accent-default)) 0.86 0.17 calc(h + 19))`, through the existing bisection fit |
| **Dark theme's hue** | neutral, from the existing sheen-derived glint |
| **Never** | a `mix-blend-mode` anywhere inside the element; a pre-baked raster for the specular; a third paint layer |

Three things the reference has that this does not, each with a recorded reason: `__refract` (measured inert in Chrome 152), the pre-baked specular PNG (a raster cannot follow a token through a theme, AC-18), and the resting-state light (AC-33).

8. **The primary's share is 0.72 on both themes, and the label is the pole that contrasts with the composite.** *Owner, 2026-09-11, on `lab/1h-dark-two-islands.html`.* Ruling 7's 0.42 left the dark primary at `#705328`, a muted brown that keeps only 47 % of the accent's chroma and does not read as the brand. The dark theme turned out to have **two islands, not a continuum**: `--slc-text` clears 4.5 up to 0.42, `--slc-on-accent` clears it from 0.65 up, and between 0.50 and 0.58 neither does. The high island is the one the theme is already equipped for — `--sl-text-on-accent` `#0A0A0B` has shipped since `2e224b6`.

   At 0.72: dark `#B57F32` at **5.48:1** with the shipped dark label; light `#C79049` at **5.67:1** with `--slc-text`. One share for both themes, so nothing branches on the theme. What differs is the label, and it differs for a measured reason rather than a switch: the two accents sit on opposite sides of mid-lightness (`#F5A83C` at L 0.789, `#B56A0C` at L 0.595), so the rule is one sentence — **the label is whichever pole contrasts with the composited pane** — and it holds without a `[data-sl-theme]` branch.

   *Withdrawn by this ruling:* ruling 7's 0.42, and the claim that `--slc-on-accent` is wrong on both themes. It is wrong at a low share and right at a high one.

9. **The lit rim is one continuous 1 px conic ring, masked to the border band; radius stays 9 px.** *Owner, 2026-09-11: the rim "looks very old-school and not much like real glass".*

   The cause was mechanical, not tonal. The rim was three `inset box-shadow`s — a top band and two side bands — which is the 3D bevel of twenty years ago: straight runs that **stop at the corners** instead of passing through them, with a hard step rather than a falloff. The replacement is `border-beam`'s own recipe, whose *Take* line already grants it ("the recipe entire, and it is CSS at every tier"), with the conic **static and positioned** rather than travelling — the motion belongs to the aurora, not to glass at rest.

   Two consequences worth carrying:

   - **The specular cannot share the ring's layer.** `mask-composite: exclude` clips the ring to the 1 px band and would eat a radial gradient painted beside it. In the kit this needs no third layer: the effects-layer spec's §Glass already puts the pointer spot on `::before` with the pane and leaves `::after` to the edge alone, which is exactly the split this ruling needs.
   - **`corner-shape` is available and is not taken here.** `glass-studio` defines its shape with a superellipse SDF (`superellipseCornerSDF`, roundness 2–7, default 5) rather than a radius, and CSS shipped `corner-shape` in Chrome 139 — verified supported, `squircle` and `superellipse(4)` both true. The owner chose the plain 9 px arc, so the squircle is **not** adopted for slice 1. It is recorded because it is a system-level primitive, available at tier 0 with no GPU, and the next slice that wants it does not have to rediscover it.

10. **The remainder is the page, not a veil — and the probes' ground was wrong.** *Owner, 2026-09-11: "the page shows through".*

   Probes 1b–1f stood the buttons on a decorative gradient. Real surfaces are `--sl-bg-canvas` `#070A0D` / `--sl-bg-surface` `#0F151A` on ink and `#ECE4D4` / `#F6F1E6` on paper; the decorative ground was supplying brightness and hue a page does not, so every look approved on it had to be re-checked. **This is the method's own failure mode, caught by the method**: `lab/README.md` requires the reference's own ground, and nothing said the *probe* had to stand on the product's.

   Re-checked on the real surfaces, two things changed and one did not:

   - **The construction.** `effects.css` mixes the fill with `--slfx-veil` for the remainder, never with transparency, precisely because diluting amber toward a near-black page reads as dark olive — which my numbers confirm at 0.34 (`#5D4726`). But measured on paper the veil's own alpha is 0.854 by construction and the pane resolves to **0.915** — effectively solid, which is the opposite of this slice's purpose. The owner chose the transparent construction on the rendered page: the remainder is the page.
   - **The share, and the per-theme split.** Ruling 7 set dark to 0.34 from a figure taken on the decorative wash. That wash is *brighter* than a real surface and therefore the harder case: on the real ground the ceiling is between **0.42 (5.17:1, passes)** and 0.50 (4.27:1, fails), so **0.42 holds on both themes and the asymmetry introduced in ruling 7 is withdrawn.**
   - **The label.** `--slc-text` on every variant, unchanged — it clears everything on the real ground with more margin than on the wash.

   The rejection of the veil is an explicit ruling overruling the companion spec's §Translucency on mechanism, which the hub's own header requires before that file can be departed from. It is recorded here for that reason, and the reason is measured: 0.915.

A final point is architecture rather than a value, and belongs in the promotion: **`__backdrop` and `__tint` must stay separate elements.** An element's own `opacity` scales what its `backdrop-filter` produced, so a tint sharing the element with the filter throttles it — at tint 0.14, to 14 %. The card already lists them as separate layers; collapsing them is what hid the blur through two rounds of this slice.

## Found on the way, outside this slice

**The effects-layer spec's contrast premise is wrong.** `2026-09-08-effects-layer-design.md` states that *"`--sl-text-on-accent` is white on both themes, and white on the amber accent measures 1.99:1"*, and builds the label's `text-shadow` legibility aid on that number. The dark theme has shipped `#0A0A0B` since the initial commit `2e224b6`, not white; 1.99:1 is white on the **dark** accent, a pairing the kit never ships. What it does ship is white on the light accent, at 4.17:1. The aid may still be wanted, but its stated justification does not hold and should be re-derived before anyone relies on it.

**The glass lens paints the wrong page content into every pane.** Found while checking slice 1's promotion on `showcase/effects.html`: at scroll ~3630 every glass button carried a line of small text that belonged elsewhere on the page — thirty panes, all wrong the same way, and hiding `.sl-fx-glass__lens` removes it. The crop arithmetic in `paintLens` is correct; the cause is that `capturePlate` rasterises a body clone inside an SVG `foreignObject`, where the page's webfonts never load — the cross-origin Google Fonts sheet is skipped by the `sheet.cssRules` guard, and the font files would not load from a blob URL anyway. Every string falls back, metrics change, blocks shift, and the drift accumulates down the document. This is `e33ea31`'s to fix, not slice 1's, and until it is fixed **the lens cannot be judged on any page that uses webfonts** — which is every Sondalab surface. It is the remaining reason AC-34 is not satisfiable on the showcase.

**The first reason is fixed.** The pane cell had nothing behind its buttons but a flat 28 % tint, so a blur there was indistinguishable from the tint — 2 px and the shipped 26 px differed by **933 px of 148 456, max delta 6/255**. The cell now carries three lines of telemetry at a real type size behind the button row, and the same toggle moves **1921 px of 22 761, max delta 32/255**, confined to the button's own forty rows. Five times the pixels and five times the amplitude. Note what did *not* work: the section's oversized display word was already behind the gallery, and its strokes are too large-scale for a hairline blur to alter — a pane needs fine detail behind it, not a big shape.

**`.sl-btn--primary` fails WCAG AA on the light theme today, before any effect is added.** `--sl-accent-default` `#B56A0C` with `--sl-text-on-accent` `#FFFFFF` measures **4.17:1**, against a 4.5 floor for normal text — and `.sl-btn` is `0.875rem` at weight 600, which is normal text, not large. The dark theme is fine at 9.94:1. This is a pre-existing defect in `themes/light.css` + `components.css`, not something slice 1 introduces, and it is recorded here rather than fixed because it belongs to the component contract and wants its own change. Note the direction of travel: the glass primary at tint 0.42 measures **8.29:1** on light, so this slice improves the number it inherits.

## Notes

Open questions, and the record of the ones now closed. Each open item blocks the criteria named beside it.

1. **Scope — settled by the pivot.** This file is the hub for the aesthetic effort as a whole; the effects layer is the first area the method is applied to, not the boundary of the effort. The delivery group (AC-8 – AC-11) therefore stays in scope (that layer still has to stop being a prototype), and later slices may touch typography, layout or motion beyond L6 without a new hub.

2. **"It is a must to use webgpu whenever possible" — the knowledge base answers this, and it answers against the literal reading.** *No longer blocking; one sentence of the Goal is the owner's to rewrite.*

   The effects-layer spec §Decision 2 puts the aurora on **CSS at every tier** ("There is no GPU aurora") and the liquid on an SVG goo chain, records that a shader aurora *was built first and rejected* — "it read as marbling, not as light" — and that the GPU is "necessary for glass and only for glass". AC-12 is the reconciled rule: *GPU where per-pixel work is the only way to get the reading; every other family on the cheapest technology that produces the look; the choice recorded per family.*

   Both liquid-glass implementations in the owner's own knowledge base now corroborate that rule rather than the Goal's wording. `glass-studio` is the strongest possible case — it maintains the same shader in **both** GLSL and WGSL, and still ships `selected: ['webgl']` as the default, with WebGPU an opt-in option that renders `disabled` and carries a reason string when the adapter is missing. `glass-vue` has no WebGPU path at all. **The knowledge base contains zero implementations that require WebGPU**, including the one the owner flagged as the strong code hint.

   So: Decision 2 and AC-12 stand, now with sources behind them. What needs changing is the Goal's sentence *"It is a must to use webgpu whenever possible"*, which as written is contradicted by the references it was meant to be served by. Suggested replacement, for the owner to accept or reword — *"Use the GPU where per-pixel work is the only way to get the reading, and always provide a fallback; every other family stays on the cheapest technology that produces the look."* That is AC-12's wording, moved up into the Goal so the two stop disagreeing.

3. **The effects-layer spec's Known-gaps section was stale — corrected 2026-09-11.** It stated "**Refraction of the backdrop.** Nothing bends what lies behind a pane: the canvas has no backdrop to sample" while HEAD of `feat/effects-layer` is `e33ea31` *"the lens — real page content, captured and bent at the rim"*, which captures the page into a plate and crops it per pane (`packages/ui-kit/effects.js:703`). That entry now records the lens and narrows the remaining gap to live content between captures. Nothing else in that section was re-checked against the code, so the other four entries carry the same risk and are unverified.

   **The `620b7b7` ruling behind the lens route is confirmed, and sharpened.** `liqui-glass` ships exactly the technique that ruling rejected — `backdrop-filter: url(#f)` over `feDisplacementMap` — so it was worth re-testing rather than trusting. Measured in Chrome 152 by toggling only that layer and diffing the identical crop: **45 pixels of 114 704 change (0.04 %), max delta 13/255, all of it in the rim bands (rows 118–125 and 143–151)**, while the backdrop's own hairline at row 135 is **bit-identical**. The filter is therefore applied and composites at the rim, but performs no usable displacement of the backdrop. "Does not work" was the right call for the purpose; the precise statement is *"applied, but yields no backdrop displacement"*, and the capture-plate lens stays the route.

4. **The cost group (AC-26 – AC-29) has no numbers.** Frame budget, package weight and the reference machine are the owner's to set. Until they are set, that group is not a gate.

5. **Filename convention.** Every other spec here is `YYYY-MM-DD-<topic>-design.md`; this one is `2027-<topic>.md` with `createdAt: 2026-09-10`. If `2027` is a sequence number rather than a year, it reads as a future date to anyone scanning the directory. Cosmetic; rename in a follow-up.

6. **Where cards live, and how big `lab/` gets.** Cards are inline here while they are few; the move to `docs/references/<slug>.md` + `docs/references/assets/` happens when this file stops being readable, and captures are binary in a private repo, so their weight is worth a thought before the first one lands. AC-3's floor of three variants is a proposal, not a measured number. **Partly settled 2026-09-11:** `docs/references/assets/` now exists and holds twelve captures at 248 KB total; the cards themselves stay inline, though at eight of them this file is close to the point the note anticipates.

7. **"Dark and light" applies to our artifacts, not to reference captures.** *Resolved 2026-09-11; AC-3 and AC-4 unchanged.*

   No glass reference in this knowledge base has a light ground, and that is now measured rather than assumed: libraries.dev is dark-only at the `<html>` attribute, and liqui.design has a working theme toggle whose effect on a component tile is **0 pixels of 114 704**. Reading (b) — manufacture a light reference by running `metal-fx` under its light preset — would put an artifact *we made* inside the ground truth, which is the one thing the knowledge base must not contain.

   So AC-3 and AC-4 are read as their own wording already implies — they name *"the slice's contact sheet"* and *"the slice's pull request"*, both of which are ours: **probes and promoted variants owe both themes; reference captures carry whatever themes the reference has, and the filename says which** (`-dark`, `-light`, or `-fixedbg`). Neither criterion needs rewording.

   This leaves one real consequence, and it is worth naming rather than burying: **glass on a light ground is unreferenced**, so the light theme is the half of slice 1 where the probe is doing original work, not reproducing a reference. `metal`'s light-mode numbers (`multiply` at 0.27 under `saturate(5.4)`) are the only guidance in the knowledge base, and they come from source, not from a render.

8. **`metal` was assigned to the text button with no reference behind it.** *Resolved 2026-09-11 by a new card.*

   The problem was real: `metal`'s only button is round, and its **Text** type is `MetalText` — metallic *type* ("Plan **Pro**"), not a bordered button. The knowledge base the owner had already written supplied the missing reference: **`liqui-glass` is a text button rendered as glass**, with its whole layer architecture readable off the live DOM, and it is now a card with measured values and its own *Take*/*Leave*.

   Slice 1's card assignment therefore reads: **`liqui-glass` governs the text button** (architecture and edge), **`gooey` the round icon-only one** (the skin), **`border-beam` the focus state of both**, with `metal` and `glass-studio` supplying the glass parameter grammar across both silhouettes. `glass-studio`'s `roundedRectSDF` is worth noting here — one SDF covers both silhouettes, a circle being a rounded rect at a large radius, which is a concrete way to put slice 1's contrast question to a probe.
