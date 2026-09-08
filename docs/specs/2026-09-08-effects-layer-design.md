# Sondalab DS — Effects layer (glitch · liquid · aurora · glass)

> **What this file is:** the implementation contract for `@sondalab/ui-kit`'s effects layer — a fifth, opt-in layer above tokens, themes and components that gives interactive elements material behaviour (instability, response to touch, attention, physical edge). It fixes the effect grammar, who draws what and with which technology, the tiering and fallback policy, the colour contract, the per-component declension, and the delivery split. Where `design-language.md` is the human grammar contract and `design-system-spec.md` the machine token contract, this file is the design contract for one new layer; its grammar half is promoted into `design-language.md` as **L6**, and this file is the rationale record.
> **Audience:** engineers implementing the layer; reviewers checking it against the house grammar and against the visual reference; agents authoring Sondalab surfaces that consume it.
> **Owner:** marcellobarile.
> **Companion files:** `design-language.md` (the grammar these effects extend — L2 hairline, L4 motion, L5 voice), `design-system-spec.md` (token contract — no token is added here), `packages/ui-kit/agent/HANDOFF.md` (what `sl-audit` cannot check), `docs/plans/2026-09-08-effects-layer.md` (the implementation record and every ruling), `sondalab-site/docs/webgpu-surfaces.md` (the WebGPU boot/fallback pattern this reuses).
> **Visual reference:** **https://libraries.dev/** — the owner's stated desiderata. Where this document and that site disagree about how something should *look*, the site is right. Its `Metal` entry (https://libraries.dev/metal) is the reference for glass and for the cursor's liquid dent; its `Border beam` entry (https://libraries.dev/beam) is the reference for the aurora.

## Legend (status vocabulary)

- **Shipped / Delivered** — merged to the surface's production codebase, available to users.
- **PoC implemented (not delivered)** — built as a prototype, not merged/released.
- **Placeholder (not delivered)** — stub or scaffold only.

At the time of this revision (2026-09-09) the layer is **PoC implemented (not delivered)** on `feat/effects-layer`: `effects.css`, `effects.js`, `effects-gpu.js`, `effects-shader.js` and `showcase/effects.html` exist and run; nothing is published.

## Why this exists

The house grammar (`design-language.md`) says a surface is *precise, technical and editorial*: hairline structure, restrained motion, one strong accent. Sondalab products are instruments, and the owner asked for the instruments to feel physical — glitches on interactive elements; buttons that look solid and go liquid under the mouse, non-destructively; aurora light on the borders of interactive elements and cards; borders like the edge of a piece of glass. The reference for all of that is https://libraries.dev/: chrome hairlines, a wandering halo, a cursor that bends the ring, a rainbow beam riding a border — and, above everything, **restraint at the pixel level.** Everything there is one or two pixels wide, low in opacity, and fades within a few tens of pixels.

## What the reference actually does (read before changing anything)

Measured on the site, not inferred from its copy:

| Entry | Technology | What it draws |
|---|---|---|
| **Metal** (`metal-fx` v2) | 2D canvas hairline + a WebGL "plasma" environment texture + SVG `feDisplacementMap` on the element for the bend; halo as blurred SVG strokes | a **1–2 px chrome ring exactly on the element's border**, filled from a moving seven-stop environment (mostly white and black with pastel flecks — `#aae8ff`, `#c5fe9e`, `#f7888d`, `#fffdc3`, `#007cff` in its chromatic preset; white and mid-grey in its light preset), a soft white halo that wanders around the ring and breathes, a bright spot under the cursor, reflections on neighbouring elements, and a Gaussian **dent of the element itself** under the cursor |
| **Border beam** | CSS only: `@property` angle, `conic-gradient` masked to a 1 px ring, radial colour blobs, a blurred copy for glow, `hue-rotate` drifting ±30° | a **1 px arc of light rotating along the border** (1.96 s per turn), its bloom, and a wash of the same colours confined to a ~28 px band inside the edge; every layer at 0.24–0.42 opacity |
| **Gooey** | SVG filter | pieces that merge and morph |

Two things follow and are load-bearing for this document. First, **"the shader look" is a look, not a technology**: the reference's aurora is CSS and its liquid is an SVG filter; only the chrome's environment needs a GPU. Second, the look is **thin and quiet**: the reference never spends more than two pixels on an edge, and its light is felt more than seen.

## Thesis

**The surface is an instrument panel behind glass, with live signal underneath — at the scale of the reference.**

Effects spend their budget on *light and shape*, never on *weight*: a structural separator stays `1px` whatever an effect is doing to it; the chrome is a hairline on the border the component already has; the aurora is a 1 px arc with bloom, not a band; the liquid deforms the silhouette the component declared, through a filter, and never rewrites a declared value. That is what keeps four expressive families compatible with editorial modernism instead of turning the suite into generic glassmorphism.

## Decision 1 — Effects are semantic, not decorative

L5 ("structure encodes truth") applied to motion: **an effect that means nothing gets switched off.** Each family owns one meaning, and a family never fires outside it.

| Family | Means | Fires on |
|---|---|---|
| **Glitch** | *something re-resolved* | discrete events: value change, destructive confirmation, validation failure, dialog open, identity |
| **Liquid** | *you are recognised* | pointer proximity; re-solidifies on leave |
| **Aurora** | *attention lives here* | `:focus-visible`, `:focus-within`, active tab, a running operation, primary call-to-action |
| **Glass** | *this is a physical surface* | a **state**, not an event: card, field, dialog, keycap edges |

Consequence: glitch is never ambient on a control (ambient glitch is the wordmark's alone, and rare); liquid never fires without a pointer; aurora never marks something that is not currently the focus of attention; glass never animates on its own — its environment moves, the way a mirror's reflection moves, but the edge does not.

## Decision 2 — Who draws what, and with which technology

Four families, three mechanisms. This is the decision the first sixteen tasks of this layer got wrong (see the plan's root-cause ruling): the layer was scoped as "CSS first, GPU as an optional extra on the liquid", which produced a conic hairline where the owner wanted chrome and a painted dent where the owner wanted the element to bend. It is replaced by what the reference does.

| Family | Mechanism | Tier | File |
|---|---|---|---|
| **Glass** | a **chrome hairline** drawn by a WebGPU fragment shader on one page-level canvas: a signed distance field of the element's rounded box, filled from a moving environment through a five-stop palette, with a wandering halo, a cursor reflection, reflections onto neighbouring effect elements, and the liquid's dent. Fallback: a static conic hairline on `::after`. | 2, fallback 0 | `effects-shader.js`, `effects-gpu.js`, `effects.css` |
| **Aurora** | **CSS at every tier** — the border-beam recipe: a 1 px arc of light on `::after` swept by an `@property` angle, its bloom as `drop-shadow` of the arc's own alpha, a blurred wash of the same light on `::before` confined to a band inside the edge, hue drifting ±16° while it sweeps. There is no GPU aurora. | 0 (static) / 1 (moving) | `effects.css` |
| **Liquid** | **the element itself deforms**: an SVG `feDisplacementMap` on the host, fed a Gaussian push away from the pointer, driven by an underdamped spring; removed when the spring settles. The chrome shader evaluates the same Gaussian so the ring bends where the surface does. | 1 | `effects.js`, `effects-shader.js` |
| **Glitch** | CSS ghost channels on a required child `<span>`; JavaScript owns timing only | 1 | `effects.css`, `effects.js` |

Why the GPU is *necessary* for glass and only for glass: a chrome reflection is a texture sliding along a ring — bright and dark bands at high contrast with coloured flecks between them, changing as the environment moves. A conic gradient can hold one static arrangement of that; it cannot move it, dent it, or put a halo beside it. The reference reaches for WebGL at exactly this point and nowhere else, and so does this layer.

Why the aurora is *not* on the GPU: the reference's beam is CSS, and it is the look the owner pointed at. A shader aurora was built here first (drifting ribbons, tens of pixels of reach) and it read as marbling, not as light. CSS also keeps the aurora available under every tier and every browser, which matters more for an attention affordance than for a material.

Why the liquid filters the whole element and not a paint layer: a filter can only deform the layer it is applied to. Filtering a pseudo-element required that pseudo-element to impersonate the surface (capturing the host's background, making the host transparent), which broke hover and active states, lost a bordered control's edge, and still left a crisp ring around a deforming fill. The reference filters the element, text included; filtered text rasterises with greyscale antialiasing, which every Sondalab surface already sets. Non-destructiveness is preserved where it matters: the filter is present only while the pointer shapes the element and its spring is settling, and nothing about the element is changed afterwards.

## Decision 3 — Namespace

Effects introduce `--slfx-*` custom properties and `.sl-fx-*` classes, mirroring how `--slc-*` role-vars sit beside `--sl-*` tokens without occupying the token namespace. `--sl-fx-*` is rejected precisely because it would read as a token to both humans and `sl-audit`'s allowlist resolution.

Effect classes are **additive** and compose onto existing components — `class="sl-btn sl-btn--primary sl-fx-liquid sl-fx-aurora"`. `components.css` is not modified by this work.

Two role-vars are introduced at the top of `effects.css`, following the `--slc-*` fallback-chain convention:

```css
--slfx-depth: var(--sl-accent-depth, var(--slc-accent));
--slfx-sheen: var(--slc-text);
```

The rest of the namespace is geometry, each entry a per-component binding with a conservative default: `--slfx-ring-w` (`1px`) is the width of the CSS ring, `--slfx-arc` the aurora's arc length, `--slfx-progress` its determinate value, `--slfx-wash` how far the aurora's inner wash reaches, `--slfx-angle` its `@property`-registered sweep angle, `--slfx-s0..s3` the glass fallback's stops. Defaults are chosen so an element that opts into a class without binding anything renders the most restrained version of the effect, never a broken one.

No new design token is added (`design-language.md` §New-token policy: a token needs ≥2 adopters; this layer has none at authoring time, and editing `sondalab.tokens.json` would force a PyPI bump for a web-only effect). `effects.css` and the three JavaScript files are hand-authored, not generated. Release: ui-kit only; `packages/palette-py/` is untouched.

## Decision 3b — Two paint layers per element, and where they cannot go

**Every element has exactly two paint layers.** `::after` is the edge — the glass hairline at rest, the aurora's arc while attention lives on the element. `::before` is the aurora's inner wash. The liquid uses neither: it filters the host. There is no third layer.

Consequence: **the glitch never uses its host's pseudo-elements.** Its two ghost channels live on a required child, `<span class="sl-fx-glitch" data-text="…">`. Without this, a primary button that both glitches on destructive confirmation and carries an aurora on focus — a combination the declension table calls for — would need three layers and one effect would silently win.

```html
<button class="sl-btn sl-btn--primary sl-fx-aurora">
  <span class="sl-fx-glitch" data-text="Delete branch">Delete branch</span>
</button>
```

**Replaced form controls cannot host a paint layer at all.** `<input>`, `<textarea>` and `<select>` do not render `::before`/`::after`. Any effect on a form control binds to a wrapper, `.sl-field__control` (`display: block; position: relative`, with the control filling it), and never to the control itself. `:focus-within` on the wrapper is what drives the field's aurora, which is why the declension table names `:focus-within` rather than `:focus-visible` for fields.

## Decision 4 — Three tiers, attribute-keyed; the base tier is the default state

Reusing the rule from `sondalab-site/docs/webgpu-surfaces.md` verbatim — *"the fallback is the default state"*. CSS is the implementation; JavaScript and the GPU are additive tiers keyed off attributes that only get set once each capability has actually answered.

| Tier | Key | Requires | Delivers |
|---|---|---|---|
| **0 — material** | none (always on) | CSS only | the glass fallback hairline; a static aurora arc on `:focus-visible`/`:focus-within` |
| **1 — behaviour** | `data-sl-fx="on"` on `<html>`, set by `effects.js` at `mount()` | JavaScript | the liquid's deformation, finite glitch bursts, the aurora's sweep, orbit and hue drift |
| **2 — chrome** | `data-sl-fx-gpu="on"`, set by `effects-gpu.js` only after the first frame is on screen | WebGPU + `vgpu` | the glass hairline as chrome: moving environment, wandering halo, cursor reflection, the liquid's dent carried into the ring |

Nothing auto-mounts on import. `mount()` is explicit, which is what makes the IDE opt-in of Decision 6 possible at all.

**The fallback must be correct, not beautiful.** A browser without WebGPU sees the static conic hairline and everything else at full quality — the aurora and the liquid do not depend on the GPU tier at all. Tier 2 stands the glass hairline down by `opacity: 0` under `[data-sl-fx-gpu="on"]` and never removes it; the attribute is cleared by the same `stop()` that removes the canvas, so a lost device or a shader error restores the hairline by itself.

### Kill switches (all three are hard requirements)

1. **`prefers-reduced-motion: reduce`** — `effects.js` never arms Tier 1, and `effects.css` guards every `animation:` declaration in a `@media (prefers-reduced-motion: no-preference)` block (enforced by `scripts/effects-guards.test.mjs`). Tier 0 survives, because the glass edge and the static aurora arc are not motion. Under Tier 2 the chrome still renders — it is material — but its environment stops sliding, the halo stops wandering and the pointer stops denting (`look.flags.x`, read live from the media query).
   **The site's exception does not travel.** `sondalab-site` deliberately ignores reduced-motion for its glitch; that is a site-level blessed deviation. The kit respects the preference; a product that wants the site's posture opts out explicitly and records it as a blessed deviation of its own.
2. **`[data-sl-theme="high-contrast"]`** — all four families are disabled: every host-level effect (`animation`, `box-shadow`, `filter`) is neutralised with `!important`, every paint layer is `display: none`, `mount()` and `mountGpu()` refuse, and a live GPU field tears itself down when the theme switches.
3. **`data-sl-fx="off"`** on any element — disables effects for that element **and** its subtree: the same neutralisation as high contrast, compounded with the family classes so ordinary components inside the region keep their own shadows and focus rings; `effects.js` ignores pointer events inside it; `effects-gpu.js` registers no geometry from it.

## Decision 5 — The effect budget (anti-neon-soup)

Four families across a dozen components, unconstrained, is a Christmas tree. `effects.js` acts as a coordinator holding module-level singletons:

- **At most one *ambient* aurora is animated per document.** An element requests one via `grantLive(el)` (which sets `data-sl-fx-live="on"`); the coordinator grants it to at most one element at a time — most recent request wins, the previous falls back to its resting edge.
- **At most one glitch burst runs at a time.** A burst requested while another runs is dropped, not queued — a queue produces a stutter train, which reads as breakage rather than as signal.
- **At most one element deforms at a time.** The liquid's filter is one shared SVG resource; `effects.js` marks the single element the pointer is shaping with `is-liquid-live`, and the CSS scopes the filter to it.
- **State-driven auroras are exempt** because they are singular by construction: the platform guarantees a single focused element.
- **Busy auroras are exempt.** `data-sl-fx-live="busy"` is bound to real work, and several cards can legitimately be loading at once; capping them would make the interface report a false state.

**No effect ever replaces or removes the focus ring.** The `outline` from `components.css` stays, at `outline-offset: 2px` outside the border box; the edge effects occupy the border band itself and grow **inward** (`padding`, never a positive inset), so they never reach the outline's position.

**Aurora renders state; it never *is* the state.** A busy aurora requires `aria-busy="true"`; a determinate one `role="progressbar"` with `aria-valuenow`. A screen reader, a reduced-motion visitor and a high-contrast visitor all get the state from the markup; the aurora is how the state looks, not where it lives.

## Decision 6 — Substrate scope

| Substrate | Scope |
|---|---|
| **Page** (daos, sondalab-site) | primary target — glass and aurora are **R**, liquid and glitch **A** |
| **App** (introspect, local-agents) | measured — every family is **A**; the effect budget is **R** if any family is used |
| **IDE** (spexr in Theia) | **N/A by default, opt-in.** `effects.css` is a separate import precisely so an IDE surface can decline it at the import boundary. A spexr panel that imports it is then held to the **App** column. |
| **Term** (smartctx) | **N/A** |

## Per-component declension

Each component gets the families that match its semantics — never all four, and never one because it was available.

● = required where the substrate requires the family · ○ = adapt (reduced amplitude) · — = never

| Component | Glitch | Liquid | Aurora | Glass |
|---|---|---|---|---|
| `sl-btn--primary` | on destructive confirmation | ● dents under the pointer | ● `:focus-visible`; ● `busy` while submitting — **`--rim`**: the arc sits outside the box, in the depth companion | — (filled; no edge to cut) |
| `sl-btn--ghost` | — | ○ dents under the pointer | ● `:focus-visible` | ● its `1px` border **is** the chrome |
| `sl-card` | — | ○ `--calm`: a fraction of the depth | ● `busy` while loading; `sweep` only when granted | ● |
| `sl-field__input` | 1 burst on validation failure | — (typing must not be disturbed) | ● `:focus-within` on the wrapper | ● on the wrapper |
| `sl-tabs__tab` | scramble on label change | — | ● the 2px active underline becomes a linear aurora | — |
| `sl-badge` / `sl-tag` | scramble on value change | — | — | ○ micro-rim |
| `sl-dialog` | shatter-in on open (1 burst) | — | ● rim while open; `busy` while its action runs | ● |
| `sl-table tbody tr` | — | ○ `--calm` | — | — |
| `sl-eyebrow` / section index | scramble on entering the viewport | — | — | — |
| wordmark | rare ambient burst | — | — | — |
| `sl-callout--danger` | 1 burst on mount | — | — | ● |
| `sl-link` | — | — | ● underline becomes a linear aurora on hover | — |
| `sl-kbd` | — | — | — | ● the keycap edge |
| inversion band | — | — | ● along the top edge (`--linear --top`) | — |

Two exclusions are deliberate and load-bearing:

- **No liquid on `sl-field__input`.** A text field that deforms while being typed into trades legibility for spectacle.
- **No glitch on `sl-btn--ghost` or `sl-card`.** Glitch marks *something re-resolved*; a passive container has nothing to re-resolve, so a burst there would be decoration and Decision 1 forbids it.

## Implementation contract

### Glass — `sl-fx-glass`

**What it looks like.** A hairline of chrome exactly on the element's own border: `max(border-width, 1px)` wide plus a hair of cover, so a ghost button's `1px` border *is* the chrome and a borderless card gets a 1 px line. Along it, a mirror's environment slides: bright and dark bands at high contrast, the product's hue as pastel flecks between them — never as a tint over the whole ring. A directional key from the upper left and a slightly darker outer half are the only shading, both as subtle multipliers. Outside the ring, one soft halo (≈30 px along the edge, ≈14 px of reach, ≈0.3 peak alpha) wanders slowly around the perimeter and breathes. Under the cursor the ring goes bright and slightly coloured, and only there.

**How (Tier 2, `effects-shader.js`).** One page-level `<canvas>`, `position: absolute`, re-topped to the scroll offset each frame (a fixed overlay composites a frame behind the page during scroll), below `--sl-z-overlay`, `pointer-events: none`, alpha only on the hairline and the halo. Per registered element, uniforms carry its rect, its **corner radius read from its own `border-radius`** (a `%` radius resolved against the current box, never assumed), its **border width read from its own `border-top-width`**, and the liquid's current dent depth and radius. The fragment stage: signed distance to the nearest element's rounded box (through the dent), coverage `1 − smoothstep(hw − 0.6, hw + 0.6, |d|)`, the environment `environment(angle, p, t)` — sines along the perimeter angle and across page space, warped by one another, sliding at `ENV_RATE` — mapped through a five-stop palette (`dark · pastel accent · bright · pastel depth · dark`, Gaussian weights with `k = 64`, the reference's shape) and gamma-punched (`pow 1.3`). The poles are placed **around the page's own ground**: on ink, bright = the theme's brightest neutral and dark = the ground lifted a fifth toward it (a trough at the page's own value is a gap, and a ring with gaps reads as dashed); on paper, bright = the ground pushed to 0.985 luminance with its hue intact and dark = a mid grey at 0.60 (a black trough on a light page reads as dirt — the reference's own light preset is white and mid-grey). Which of `--sl-text-primary` / `--sl-bg-canvas` is the bright one is decided at runtime from their luminance, so an inversion band reads correctly.

**Reflections on neighbours.** The reference's one-line description names them, and a mirror does cast its environment onto what stands beside it. Every effect element (`.sl-fx-glass, .sl-fx-aurora, .sl-fx-liquid`) is registered as a surface; a pixel inside one element and within `REF_GAP` (14 px, exponential) of another element's chrome edge receives that chrome's environment, fading into the neighbour over `REF_DEPTH` (12 px) at a peak alpha of `REF_GAIN` (0.34) scaled by the environment's own brightness. The source is the nearest chrome edge the pixel is *outside* of, so a keycap beside a keycap catches the other's light on the facing edge. The canvas paints above the DOM, which is why the reflection is a short strip along the edge rather than a wash across the element: text sits further in than 12 px on every shipped component. Perceptibility, measured on the showcase: clear on adjacent keycaps and pills, faint on a filled accent button (a light strip on an amber fill), absent where elements are further apart than a gap — which is most of a page. Cheap: one extra distance per registered element per pixel.

**Where the aurora holds the edge, the chrome stands down.** The canvas sits above the DOM, so on an element whose aurora is lit (`data-sl-fx-live` on/busy, or focus) `effects-gpu.js` registers it as a reflection surface only, never as chrome; the edge belongs to the light until attention leaves.

**Fallback (Tiers 0/1, `effects.css`).** The shared `::after` ring, `inset: -1px; padding: var(--slfx-ring-w)`, masked to the border band, painted with a static conic alternating `--slfx-edge-hi` / `--slfx-edge-lo` / `--slfx-edge-tint` / `--slfx-edge-mid` — all `color-mix()` over the border and text roles, resolved on the edge itself so an inversion band's remap reaches them. Static by design. Under `[data-sl-fx-gpu="on"]` it goes `opacity: 0`.

### Aurora — `sl-fx-aurora`

**What it looks like.** The border-beam: a 1 px arc of light riding the border — the depth companion at its tails, the accent along it, a white-hot core at its centre (`--slfx-sheen` mixed 86% over the accent) — with a three-stage bloom (`drop-shadow` 2 px sheen, 6 px accent, 16 px depth) that follows the arc's own alpha shape, and a wash of the same light blurred 8 px and confined to a `--slfx-wash` (28 px, at most 42%) band inside the edge, under the content. While it sweeps, its hue drifts ±16° either side of the accent over 9 s — an aurora's colour moves, and a narrow range keeps the product's hue recognisable.

**Four readings, separated by the fraction of the perimeter lit** — never by colour, never by speed, which is why they stay legible side by side:

| Reading | Trigger | Arc | Motion |
|---|---|---|---|
| static | `:focus-visible` / `:focus-within` | ~70% (`--slfx-arc: 250deg`) | none — it marks where focus is |
| sweep | `data-sl-fx-live="on"` (granted by `grantLive`) | ~70% | one turn per 3.2 s |
| busy | `data-sl-fx-live="busy"` + `aria-busy` | 18% (`65deg`) | one turn per 1.1 s |
| determinate | busy + inline `--slfx-progress` + `role="progressbar"` | `progress × 360deg` | none — the length is the value |

**The aurora inhabits an edge that already exists; it never adds a concentric ring.** Where the element has a border, the arc *is* that border in its attention state. Where the edge is not a ring, the aurora is **linear** (`--linear`, `--top` for an inversion band's rule): the same light swept along a segment. A linear aurora has no busy mode.

**Filled elements take `--rim`.** `sl-btn` has a `1px` *transparent* border that its fill paints under, so the shared ring — pinned to that border band — would sit on the fill, accent on accent, and vanish; that is what happened on this branch until it was looked at. `--rim` steps the ring one border-width further out (`inset: calc(-1px - var(--slfx-ring-w))`), hugging the fill inside the 2 px the focus outline leaves free and never past it, at `2px` wide (a 1 px line of the depth companion against the page is below the threshold of notice), with the beam rebound to the **depth companion** — the accent is what the fill is made of, so the contrast is against the page — and no inner wash. A busy `--rim` element keeps full opacity even when `:disabled`: it is working, not unavailable, and `components.css`'s half-opacity would dim the very ring that says so. The override is scoped out of both kill switches, which restore the plain disabled look.

**Geometry note:** for an absolutely positioned child, `inset: 0` resolves against the *padding* box, so `inset: -1px` with `padding: var(--slfx-ring-w)` and `mask-composite: exclude` lands exactly **on** a `1px` border. Implementations must not "correct" it to a positive inset — that would walk the ring into the focus outline.

Under `prefers-reduced-motion: reduce` the busy arc does not orbit: it renders as a full static ring at reduced opacity, and `aria-busy` carries the state. A determinate arc keeps its length, because its length is the value.

### Liquid — `sl-fx-liquid`

**What it looks like.** The element is solid until the pointer touches it; then its outline gives under the cursor — a smooth dent, a few pixels deep, that follows the pointer with a little lag — and text near the pointer flees it. Released, the shape springs back, overshoots, and settles. Nothing is left behind.

**How.** `effects.js` injects one hidden `<svg>` with one filter: `feImage` (the map) → `feDisplacementMap` (`R` → x, `G` → y). The map is a Gaussian push *away* from the pointer, `v = (p − c)/σ`, `push = v · exp(−|v|²/2) / 0.6065`, so the peak sits one sigma out and is normalised to exactly `depth` pixels; points between the pointer and the edge sample from beyond the edge, so the edge recedes toward the pointer. It is rasterised **every frame at a quarter of the resolution, covering the whole filter region** — the reference's own approach. (A static map moved under the pointer through `feImage`'s `x`/`y` was tried first and abandoned: Chrome placed the raster unpredictably and read the area it covered as a constant offset.) `color-interpolation-filters="sRGB"` is set on **every** primitive: under the default `linearRGB` the map's 128 decodes to 0.22 and the element slides by a third of the scale, and the filter element's own attribute does not reach a `feImage`'s raster — both verified against the rendered page. The filter region is sized per live element in pixels (its box plus room for the overshoot's outward bulge).

`σ = clamp(0.42 × shortSide, 12px, 30px)`, `depth = 0.30 × σ` (× 0.4 for `--calm`). The spring (`k = 170`, damping `14`) is critically underdamped, so the release overshoots (a negative scale, which is valid SVG and is the bulge) and settles within about a second; the dent's centre chases the pointer with its own lag, so it arrives after the cursor — that trail is the mass. The filter is applied only while `is-liquid-live` is on the host (`[data-sl-fx="on"] .sl-fx-liquid.is-liquid-live`), and the class is removed when the spring settles.

**The chrome bends with the surface.** `effects-gpu.js` reads `liquidState()` — the live element, its current signed depth, its sigma and the *lagged* centre — and the shader evaluates the same Gaussian on its distance field (`dentAt`), so the hairline dents exactly where the border does. Anything that changes in one place must change in the other.

**The radius is never rewritten.** The filter distorts whatever the component declared, so a component stays free to re-parametrise its own `--sl-radius-*` without touching this layer.

### Glitch — `sl-fx-glitch`

Generalised from `sondalab-site/src/lib/glitch.ts` and its CSS: two ghost channels on the child span's `::before`/`::after` reading `attr(data-text)`, `mix-blend-mode: screen`, coloured `--slc-accent` and `--slfx-depth`; JavaScript owns burst *timing* — finite, randomised length, hard-capped at 1500 ms; per-burst randomisation of channel durations, phase offsets and amplitude via inline custom properties; `scramble()` for short labels; the `--shatter` variant (horizontal bands with random sideways offsets, each carrying `--slfx-i`/`--slfx-n` inline). Reduced motion is respected, high contrast disables it, bursts go through the coordinator, and `burst()` refuses a detached element.

### GPU tier boot

Double-guarded exactly as `sondalab-site/src/lib/crt-surface.ts` does it: `typeof navigator === "undefined" || !("gpu" in navigator)` returns null before anything is created; the `vgpu` import, `init()`, surface, effect and first frame all sit in one `try` whose `catch` runs the same `stop()` the happy path uses; `gpu.onError` and `gpu.gpu.lost` both call `stop()`; a switch to high contrast calls `stop()`. `stop()` removes the canvas, disconnects every observer and listener, and clears `data-sl-fx-gpu` only if this handle set it.

`vgpu` is an **optional peer dependency** — `peerDependencies` plus `peerDependenciesMeta: { vgpu: { optional: true } }`, never `optionalDependencies`. The WGSL ships as an inline template string.

### Public API — `effects.js`

```js
import { mount, burst, scramble, grantLive, revokeLive, mountGpu } from '@sondalab/ui-kit/effects.js';

mount(root = document);   // arms Tier 1: sets data-sl-fx, injects the filter, wires the pointer + observers
burst(el, opts);          // one finite glitch burst, subject to the coordinator
scramble(el, opts);       // decode-scramble a short label
grantLive(el);            // the one ambient aurora; revokeLive(el) gives it back
await mountGpu();         // Tier 2; resolves false when WebGPU is unavailable
```

Importing the module has no side effects. Pointer tracking is one delegated listener; the liquid's integration runs in one shared `requestAnimationFrame` that stops itself when the spring settles.

## Colour contract, and the audit gap it has to cover

Every hue in `effects.css` resolves through `color-mix()` over `--slc-*`/`--sl-*` role-vars; masks use the `black` keyword. No literal appears in any shipped file.

**The real trap is JavaScript and WGSL.** `sl-audit` reads CSS; a literal in `effects.js`, `effects-gpu.js` or the shader would pass the gate while breaking the contract. Therefore every hue the GPU tier uses is read with `getComputedStyle` from `--sl-accent-default`, `--sl-accent-depth`, `--sl-text-primary`, `--sl-bg-canvas` (re-read on `data-sl-theme` and inline-style changes on `<html>`) and reaches the shader as a uniform; the shader's palette takes its coloured stops from the accent pair and its poles from the neutral pair, and `scripts/effects-gpu.test.mjs` asserts exactly that, alongside the literal ban on all three JavaScript files. The dent map's `128` and the feColorMatrix-free filter are numbers, not colours. The aurora's `hue-rotate` drift is a filter on a token-derived colour, not a colour.

## Testing

| Test | Asserts |
|---|---|
| `scripts/effects-audit.test.mjs` | `effects.css` passes `auditCss` (no colour literal, no accent redefinition, `black` for masks) |
| `scripts/effects-guards.test.mjs` | both kill switches neutralise host-level `animation`/`box-shadow`/`filter` on every family; the opt-out matches the carrying element; one shared ring rule growing inward; `--slfx-angle` registered; every `animation:` inside the reduced-motion guard; exactly four edge rules paint (shared ring, aurora arc covering busy, aurora wash, linear); the busy arc paints outside the guard while its orbit is inside; determinate drives arc length; the liquid filter sits on the host, scoped to `.is-liquid-live` and to `[data-sl-fx="on"]` |
| `scripts/effects-js.test.mjs` | no colour literal; the documented exports; import has no side effects; `mount()` refuses under reduced motion and high contrast; `mountGpu()` refuses under high contrast; a live field tears down on high contrast; burst drops rather than queues, refuses detached and unarmed; the ambient grant is single |
| `scripts/effects-gpu.test.mjs` | no colour literal in the GPU module or the shader; the palette is fed from the token uniforms; `bootField` returns null without WebGPU and when `vgpu` is missing; `vgpu` is an optional peer; the WGSL is inline |
| `scripts/effects-showcase.test.mjs` | the package ships the layer; the showcase applies all four families; every busy aurora carries ARIA; the glitch is a child span; the tier label reads `data-sl-fx-gpu` |
| `scripts/agent-docs-drift.test.mjs` | `agent/design-language.md` stays byte-identical to `docs/design-language.md` |

Nothing in this repository renders a frame. **Every real defect in this layer was found by looking at the rendered page beside the reference, and none by reading**; a change to any of the four shipped files is not done until it has been looked at, in dark and in light, with the reference open.

## Delivery

`packages/ui-kit/effects.css`, `effects.js`, `effects-gpu.js`, `effects-shader.js`; `showcase/effects.html`; the tests above; `docs/design-language.md` L6 with `packages/ui-kit/agent/design-language.md` regenerated; `agent/catalog.md`, `agent/HANDOFF.md` and the `l6-*` rows of `agent/substrate-matrix.json`. `packages/ui-kit/package.json` carries the version; `packages/palette-py/` is not touched.

## Known gaps against the reference (honest)

- **Reflections on neighbours** are built (glass section above) but reach only across a gap of a few pixels and only onto other effect elements: a plain `<p>` beside a chrome card catches nothing, and a neighbour further away than ~14 px catches nothing visible. The reference reflects onto explicitly named targets at up to 32 px.
- **Inner reflection.** The reference's metal shows its environment faintly *inside* the element too. Not built; the glass here is the edge only.
- **Straight runs.** A rectangle's long edge has one surface direction; the reference's circle sweeps continuously. The environment varies along page space as well as angle to compensate, but a very long edge still reads calmer than the reference's ring.
- **Tier 2 does not arm from a cold load under `prefers-reduced-motion: reduce`**, because `mount()` refuses and `mountGpu()` requires `mount()`; the static chrome is therefore not shown to a reduced-motion visitor, who gets the CSS hairline instead. Coherent, documented, not equal.

## Risks

| Risk | Handling |
|---|---|
| Per-frame `toDataURL` for the dent map | quarter resolution over one element's region — a few kilobytes a frame, only while one element is live; the reference does the same |
| `filter` on the host disables subpixel antialiasing while live | every Sondalab surface sets `-webkit-font-smoothing: antialiased`; the filter is removed when the spring settles |
| Conic rings and drop-shadow bloom repaint while swept | the budget caps ambient auroras at one per document; busy ones are bound to real work |
| The page-level canvas over a sticky translucent header | canvas below `--sl-z-overlay`; verified against the showcase header |
| `vgpu` is at `0.3.x` and pre-1.0 | optional peer, dynamically imported inside the guarded boot; a breaking change degrades to the CSS hairline rather than breaking a build |
| An adopting product enables all four families everywhere | Decisions 1 and 5 are the written defence; the judgement half lives in `HANDOFF.md` so the auditing agent enforces it |
