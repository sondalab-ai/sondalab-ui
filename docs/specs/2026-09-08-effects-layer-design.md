# Sondalab DS — Effects layer (glitch · liquid · aurora · glass)

> **What this file is:** the implementation contract for `@sondalab/ui-kit`'s effects layer — a fifth, opt-in layer above tokens, themes and components that gives interactive elements material behaviour (instability, response to touch, attention, physical edge). It fixes the effect grammar, who draws what and with which technology, the tiering and fallback policy, the colour contract, the per-component declension, and the delivery split. Where `design-language.md` is the human grammar contract and `design-system-spec.md` the machine token contract, this file is the design contract for one new layer; its grammar half is promoted into `design-language.md` as **L6**, and this file is the rationale record.
> **Audience:** engineers implementing the layer; reviewers checking it against the house grammar and against the visual reference; agents authoring Sondalab surfaces that consume it.
> **Owner:** marcellobarile.
> **Companion files:** `design-language.md` (the grammar these effects extend — L2 hairline, L4 motion, L5 voice), `design-system-spec.md` (token contract — no token is added here), `packages/ui-kit/agent/HANDOFF.md` (what `sl-audit` cannot check), `docs/plans/2026-09-08-effects-layer.md` (the implementation record and every ruling), `sondalab-site/docs/webgpu-surfaces.md` (the WebGPU boot/fallback pattern this reuses).
> **Visual reference:** **https://libraries.dev/** — the owner's stated desiderata. Where this document and that site disagree about how something should *look*, the site is right. Its `Metal` entry (https://libraries.dev/metal) is the reference for glass; its `Gooey` entry (https://libraries.dev/gooey) is the reference for the liquid's skin; its `Border beam` entry (https://libraries.dev/beam) is the reference for the aurora.

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
| **Metal** (`metal-fx` v2) | 2D canvas hairline + a WebGL "plasma" environment texture + SVG `feDisplacementMap` on the element for the bend; halo as blurred SVG strokes | a **1–2 px chrome ring exactly on the element's border**, filled from a moving seven-stop environment (mostly white and black with pastel flecks — `#aae8ff`, `#c5fe9e`, `#f7888d`, `#fffdc3`, `#007cff` in its chromatic preset; white and mid-grey in its light preset), a soft white halo that wanders around the ring and breathes, a bright spot under the cursor, reflections on neighbouring elements, and a Gaussian **dent of the element itself** under the cursor. Read from its sources (https://github.com/Jakubantalik/Libraries.dev, `packages/metal-fx/src`): the bend is `applyTo: 'ring'` by default — a vector outline, "button content and glow stay rigid" — with strength 0.74, reach 36 px, cap 9 px, fade 200/350 ms; the cursor light reaches 56 px and its "spill" is a 48 px glint at peak 0.55 tinted by the ring; in light mode the glow is composited with `multiply` at 0.27 under `saturate(5.4)` — on a light ground it darkens and saturates, never adds white; and its material's only colour-separation knob is the R/B channel shift (`shiftRed`/`shiftBlue` 0.3, 0.75 chromatic), which is the dispersion the pane's edge reproduces |
| **Border beam** | CSS only: `@property` angle, `conic-gradient` masked to a 1 px ring, radial colour blobs, a blurred copy for glow, `hue-rotate` drifting ±30° | a **1 px arc of light rotating along the border** (1.96 s per turn), its bloom, and a wash of the same colours confined to a ~28 px band inside the edge; every layer at 0.24–0.42 opacity |
| **Gooey** | SVG filter — `feGaussianBlur` (`blur={6}`) then an `feColorMatrix` alpha slope (`contrast={18}`) — on a **silhouette layer below the content**; the DOM "rides crisp on top" | pieces that merge and morph with a rounded neck; nothing in the UI is filtered |

Two things follow and are load-bearing for this document. First, **"the shader look" is a look, not a technology**: the reference's aurora is CSS and its gooey is an SVG filter on a silhouette below the content; only the chrome's environment needs a GPU. Second, the look is **thin and quiet**: the reference never spends more than two pixels on an edge, and its light is felt more than seen.

## Thesis

**The surface is an instrument panel behind glass, with live signal underneath — at the scale of the reference.**

Effects spend their budget on *light and shape*, never on *weight*: a structural separator stays `1px` whatever an effect is doing to it; the chrome is a hairline on the border the component already has; the aurora is a 1 px arc with bloom, not a band; the liquid swells the silhouette the component declared, as a skin below the content, and never rewrites a declared value. That is what keeps four expressive families compatible with editorial modernism instead of turning the suite into generic glassmorphism.

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
| **Glass** | a **chrome hairline** drawn by a WebGPU fragment shader on one page-level canvas: a signed distance field of the element's rounded box, filled from a moving environment through a five-stop palette, with a wandering halo, a cursor reflection, reflections onto neighbouring effect elements, and the liquid's swell. Fallback: a static conic hairline on `::after`. **`--pane` — the element is made of glass**, the family's pointer-reactive mode and the rule for every text button: a slab of light on `::before` under the label (CSS at every tier), a radial glint that follows the pointer (CSS, from three custom properties `effects.js` writes), and a hairline that turns to face the pointer fringed with the accent and the depth companion — dispersion, refraction's visible form on an edge (CSS at Tier 1; the chrome's cursor reflection disperses per channel at Tier 2). | 0 (body) / 1 (pointer) / 2 (chrome) | `effects.css`, `effects.js`, `effects-shader.js` |
| **Aurora** | **CSS at every tier** — the border-beam recipe: a 1 px arc of light on `::after` swept by an `@property` angle, and on `::before` its bloom: the same arc, blurred, reaching `--slfx-glow` (22 px) outside the element and `--slfx-wash` (28 px) inside it, hue drifting ±16° while it sweeps. There is no GPU aurora. | 0 (static) / 1 (moving) | `effects.css` |
| **Liquid** | **the silhouette deforms; the content never does.** While the pointer shapes an element, `effects.js` parents one shared `<svg class="sl-fx-liquid__skin">` into it, below its content: the host's own rounded box plus a drop at the pointer, welded by a goo filter (blur, then alpha contrast — the reference's own chain) and painted in the host's computed background and border colours. Driven by an underdamped spring; the skin leaves when it settles. The chrome shader welds the same drop onto the same box (a smooth-union distance field) so the ring follows the silhouette. **Gated behind a modifier in the markup:** `--drop` on a round icon-only button (the full swell), `--calm` on a container (a fraction); a bare `sl-fx-liquid` is inert. The gooey belongs to a round silhouette — on a text button the drop read as a blister on a box — and the gate is a class, never a measured radius. | 1 | `effects.js`, `effects.css`, `effects-shader.js` |
| **Glitch** | CSS ghost channels on a required child `<span>`; JavaScript owns timing only | 1 | `effects.css`, `effects.js` |

Why the GPU is *necessary* for glass and only for glass: a chrome reflection is a texture sliding along a ring — bright and dark bands at high contrast with coloured flecks between them, changing as the environment moves. A conic gradient can hold one static arrangement of that; it cannot move it, dent it, or put a halo beside it. The reference reaches for WebGL at exactly this point and nowhere else, and so does this layer.

Why the aurora is *not* on the GPU: the reference's beam is CSS, and it is the look the owner pointed at. A shader aurora was built here first (drifting ribbons, tens of pixels of reach) and it read as marbling, not as light. CSS also keeps the aurora available under every tier and every browser, which matters more for an attention affordance than for a material.

Why the gooey is gated by a class and not by geometry: the owner's ruling is that it works on round buttons alone, and the obvious implementation — measure `border-radius` against the width and decide "round" — is exactly the kind of heuristic that breaks the moment a component re-parametrises its own `--sl-radius-*`, which this layer has now promised twice not to break under. `sl-fx-liquid--drop` is the contract; the consumer writes it on a round icon-only button, and `effects.js` matches `.sl-fx-liquid.sl-fx-liquid--drop` and nothing else. Containers take no swell at all — the owner, after seeing it: the gooey is not to be applied to other elements such as cards, and a container yielding under the pointer reads as a toy. The `--calm` variant that gave them a fraction of the depth is gone rather than left dead.

Why every other button is glass, and why that is not a fifth family: the owner's words for the text buttons are *vetro, traslucenza, giochi di luce, distorsione/rifrazione*, and `sl-fx-glass` already owns the edge — the conic hairline at Tier 1, the chrome at Tier 2. What the buttons gain is that family's pointer-reactive mode, `--pane`, which keeps the settled paint-layer budget (two pseudo-elements per host, glitch on a child) intact: the body takes `::before`, which was free; the edge stays on `::after`. Refraction lives on the edge band and nowhere else — the label is flat and legible, the same rule the owner set when he refused the lens.

Why the liquid is a shape under the content and not a filter over it: the reference's gooey entry (https://libraries.dev/gooey) never filters the UI — a silhouette layer below the content carries the goo, one plain shape per item run through blur and alpha contrast so touching pieces merge with a rounded neck, and "your real DOM rides crisp on top"; its metal entry does the same by default (`applyTo: "ring"`: the bend is a vector outline, content and glow stay rigid). A displacement filter on the host was built here first and rejected by the owner on three counts, all of which are properties of filtering pixels rather than drawing a shape: the text refracted, the border re-rasterised and went pixelated at device-pixel-ratio 2, and the result read as a lens rather than as a light gooey. **The text is never filtered** — the project's original rule, retired once on reference grounds and now confirmed by the owner; it is not to be retired again. The skin costs the host nothing but a transparent `border-image` while it is live (which hides the host's own border under the skin's band *without* touching `border-color`, so the skin can keep reading the computed hover and active colours every frame); the radius is read, never written; the skin is removed the moment the spring settles.

## Decision 3 — Namespace

Effects introduce `--slfx-*` custom properties and `.sl-fx-*` classes, mirroring how `--slc-*` role-vars sit beside `--sl-*` tokens without occupying the token namespace. `--sl-fx-*` is rejected precisely because it would read as a token to both humans and `sl-audit`'s allowlist resolution.

Effect classes are **additive** and compose onto existing components — `class="sl-btn sl-btn--primary sl-fx-glass sl-fx-glass--pane sl-fx-aurora sl-fx-aurora--rim"`. `components.css` is not modified by this work.

Two role-vars are introduced at the top of `effects.css`, following the `--slc-*` fallback-chain convention:

```css
--slfx-depth: var(--sl-accent-depth, var(--slc-accent));
--slfx-sheen: var(--slc-text);
```

The rest of the namespace is geometry, each entry a per-component binding with a conservative default: `--slfx-ring-w` (`1px`) is the width of the CSS ring, `--slfx-arc` the aurora's arc length, `--slfx-progress` its determinate value, `--slfx-wash` how far the aurora's inner wash reaches, `--slfx-angle` its `@property`-registered sweep angle, `--slfx-s0..s3` the glass fallback's stops. Defaults are chosen so an element that opts into a class without binding anything renders the most restrained version of the effect, never a broken one.

No new design token is added (`design-language.md` §New-token policy: a token needs ≥2 adopters; this layer has none at authoring time, and editing `sondalab.tokens.json` would force a PyPI bump for a web-only effect). `effects.css` and the three JavaScript files are hand-authored, not generated. Release: ui-kit only; `packages/palette-py/` is untouched.

## Decision 3b — Two paint layers per element, and where they cannot go

**Every element has exactly two paint layers.** `::after` is the edge — the glass hairline at rest, the aurora's arc while attention lives on the element. `::before` is the glass pane's body (`--pane`), and free on everything else. The aurora's bloom is an injected child (`.sl-fx-aurora__glow`), the one layer that leaves the box: its own box is the element's plus `--slfx-glow` on every side. The liquid uses neither pseudo-element: its skin is an injected child below the content, like the bloom, and it exists only while the pointer shapes the element. There is no third pseudo-element.

**Containers must not clip an effect element.** The bloom reaches `--slfx-glow` (22 px) outside the element's box, so any ancestor with `overflow` other than `visible`, with `contain: paint` (or `layout`, `strict`, `content`), or with a `clip-path` truncates it at that ancestor's edge, and a glow cut off along a straight line is the defect this rule exists to prevent. The consumer gives the element room: a table's scroll container wraps the table, not the busy card beside it; a card grid separates cells with `gap`, never with `overflow: hidden`; a dialog or drawer that must clip its own content keeps the aurora on the container, not on a child. An agent building a surface has to know this before it lays out the container, which is why the rule is here and in the design language, not only in `effects.css`. Enumerated on the showcase before the rule was written: none of its 29 effect elements sat under a clipping ancestor, and the truncation the owner saw came from the ring's own mask — CSS applies a `filter` *before* the element's `mask`, so a `drop-shadow` on the masked `::after` could never leave the ring band. That is why the bloom lives on `::before` and shapes its own falloff in its own mask.

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
| **2 — chrome** | `data-sl-fx-gpu="on"`, set by `effects-gpu.js` only after the first frame is on screen | WebGPU + `vgpu` | the glass hairline as chrome: moving environment, wandering halo, cursor reflection, the liquid's swell carried into the ring |

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
- **At most one element deforms at a time.** The liquid's skin is one shared `<svg>`; `effects.js` parents it into the single element the pointer is shaping and marks that element `is-liquid-live`, and the CSS scopes the border hand-off to it.
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
| `sl-btn--primary` | on destructive confirmation | — (a text button is glass, not gooey) | ● `:focus-visible`; ● `busy` while submitting — **`--rim`**: the arc sits outside the box, in the depth companion | ● **`--pane`** over the fill: light that sits on the fill, a rim inside its edge, a glint under the pointer; `--rim` tells the pane its ground is the fill |
| `sl-btn--ghost` | — | — (a text button is glass, not gooey) | ● `:focus-visible` | ● **`--pane`**: its `1px` border **is** the chrome, and turns to face the pointer |
| `sl-btn` round, icon-only (square, `--sl-radius-pill`; no dedicated class in `components.css` yet) | — | ● **`--drop`**: the one button that goes gooey | ● `:focus-visible`; `--rim` on a filled one | ● on a ghost one — the chrome follows the swell |
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
- **No liquid on a text button.** The owner looked at it: the drop on a box reads as a blister, and it only works on a round silhouette. Text buttons are glass panes; `--drop` goes on round icon-only buttons and nowhere else, and the gate is the class, never a measured radius.
- **No glitch on `sl-btn--ghost` or `sl-card`.** Glitch marks *something re-resolved*; a passive container has nothing to re-resolve, so a burst there would be decoration and Decision 1 forbids it.

## Implementation contract

### Glass — `sl-fx-glass`

**What it looks like.** A hairline of chrome exactly on the element's own border: `max(border-width, 1px)` wide plus a hair of cover, so a ghost button's `1px` border *is* the chrome and a borderless card gets a 1 px line. Along it, a mirror's environment slides: bright and dark bands at high contrast, the product's hue as pastel flecks between them — never as a tint over the whole ring. A directional key from the upper left and a slightly darker outer half are the only shading, both as subtle multipliers. Outside the ring, one soft halo (≈30 px along the edge, ≈14 px of reach, ≈0.3 peak alpha) wanders slowly around the perimeter and breathes. Under the cursor the ring goes bright and slightly coloured, and only there.

**How (Tier 2, `effects-shader.js`).** One page-level `<canvas>`, `position: absolute`, re-topped to the scroll offset each frame (a fixed overlay composites a frame behind the page during scroll), below `--sl-z-overlay`, `pointer-events: none`, alpha only on the hairline and the halo. Per registered element, uniforms carry its rect, its **corner radius read from its own `border-radius`** (a `%` radius resolved against the current box, never assumed), its **border width read from its own `border-top-width`**, and, on the one element the pointer is shaping, the liquid's drop radius and the goo's neck width, with the drop's lagged centre in a uniform of its own. The fragment stage: signed distance to the nearest element's rounded box, welded to the liquid's drop by a smooth minimum where one is live, coverage `1 − smoothstep(hw − 0.6, hw + 0.6, |d|)`, the environment `environment(angle, p, t)` — sines along the perimeter angle and across page space, warped by one another, sliding at `ENV_RATE` — mapped through a five-stop palette (`dark · pastel accent · bright · pastel depth · dark`, Gaussian weights with `k = 64`, the reference's shape) and gamma-punched (`pow 1.3`). The poles are placed **around the page's own ground**: on ink, bright = the theme's brightest neutral and dark = the ground lifted a fifth toward it (a trough at the page's own value is a gap, and a ring with gaps reads as dashed); on paper, bright = the ground pushed to 0.985 luminance with its hue intact and dark = a mid grey at 0.60 (a black trough on a light page reads as dirt — the reference's own light preset is white and mid-grey). Which of `--sl-text-primary` / `--sl-bg-canvas` is the bright one is decided at runtime from their luminance, so an inversion band reads correctly.

**Reflections on neighbours.** The reference's one-line description names them, and a mirror does cast its environment onto what stands beside it. Every effect element (`.sl-fx-glass, .sl-fx-aurora, .sl-fx-liquid`) is registered as a surface; a pixel inside one element and within `REF_GAP` (14 px, exponential) of another element's chrome edge receives that chrome's environment, fading into the neighbour over `REF_DEPTH` (12 px) at a peak alpha of `REF_GAIN` (0.34) scaled by the environment's own brightness. The source is the nearest chrome edge the pixel is *outside* of, so a keycap beside a keycap catches the other's light on the facing edge. The canvas paints above the DOM, which is why the reflection is a short strip along the edge rather than a wash across the element: text sits further in than 12 px on every shipped component. Perceptibility, measured on the showcase: clear on adjacent keycaps and pills, faint on a filled accent button (a light strip on an amber fill), absent where elements are further apart than a gap — which is most of a page. Cheap: one extra distance per registered element per pixel.

**Where the aurora holds the edge, the chrome stands down.** The canvas sits above the DOM, so on an element whose aurora is lit (`data-sl-fx-live` on/busy, or focus) `effects-gpu.js` registers it as a reflection surface only, never as chrome; the edge belongs to the light until attention leaves.

**Fallback (Tiers 0/1, `effects.css`).** The shared `::after` ring, `inset: -1px; padding: var(--slfx-ring-w)`, masked to the border band, painted with a static conic alternating `--slfx-edge-hi` / `--slfx-edge-lo` / `--slfx-edge-tint` / `--slfx-edge-mid` — all `color-mix()` over the border and text roles, resolved on the edge itself so an inversion band's remap reaches them. Static by design. Under `[data-sl-fx-gpu="on"]` it goes `opacity: 0`. On a filled element (`--rim`) it stands down at rest as well: the `::after` there is stepped outside the fill for the rim aurora, and a resting chrome conic on it would be a 2 px bezel around the button, not an edge on it.

**The pane — `sl-fx-glass--pane`.** The element is *made* of glass, not merely edged with it: the family's pointer-reactive mode, and the rule for every text button whatever its variant (the owner: buttons are made of glass, and the interaction is light, translucency, refraction). Three layers, none of them a filter, and the label sits on top of all three untouched.

- **Body** — `::before`, `z-index: -1` (above the host's own fill, since the host is a stacking context; below its label). A slab: the glint (`--slfx-glint`) along the top inside edge at 40% and the shade along the bottom at 20% (the reference's `innerShadow`: white 90%, offset 1 px, blur 0.5 — the same light from above), a 1 px inner rim of the glint at 10% just inside the border, which is the thickness of the pane, and a wash from 9% glint at the top to 9% shade at the bottom. `--slfx-shade` is the dark pole of the neutral pair the way `--slfx-glint` is the light one: `oklch(from var(--slfx-sheen) min(l, 1 − l) c h)` — the sheen on paper (L 0.24), under the surface on ink (L 0.09). Over a filled control the fill shows through all of it: translucency over an opaque brand fill is light that sits *on* the fill, not a fill that lets the page through. CSS at every tier.
- **Spot** — the same layer carries a radial glint at the pointer, the reference's cursor "spill" (48 px radius, 1 → 0.35 at 45% → 0, peak 0.55): `radial-gradient(circle 3rem at var(--slfx-px) var(--slfx-py), …)`, peaking at 26% (cool) or 34% (warm) times `--slfx-lit`. `effects.js` writes the three properties — the pointer's position in the padding box, and the lit amount, eased with a time constant of 80 ms in and 140 ms out (the reference fades its cursor light over 200 ms and its bend out over 350 ms) in a `requestAnimationFrame` loop that stops itself once dark — and removes them when the pointer has gone; it writes nothing else onto the host, ever. **On paper the spot is not white.** The reference's own light preset composites its light with `multiply` and `saturate(5.4)`, and a near-white glint on cream is invisible (the surface sits at L 0.95, the glint at 0.96). So the spot is two colours whose *alpha* carries the theme and only one of them is ever visible: `--slfx-spot-cool` is the glint with alpha `clamp(0, (l − 0.45) × 4, 1)` of the sheen's lightness — 1 on ink, 0 on paper; `--slfx-spot-warm` is the accent's hue at the vivid tier's floor (the vivid accent brought to L 0.66 and fitted to the gamut again, `--slfx-spot`, since a bright token holds more chroma at its own lightness than the floor holds) with the opposite alpha, read off `color-mix(in oklab, spot 30%, sheen-at-chroma-0)` — the sheen's lightness alone, because the real sheen is not neutral (paper's is a cool near-black, C 0.02) and 70% of it had turned the amber 14° toward yellow; against a grey the mix is exact, the hue untouched, the chroma × 0.3 (restored ÷ 0.3), the lightness 0.3 × 0.66 + 0.7 sheen — paper 0.37 → alpha 1 (also with the ink amber pinned onto paper as the showcase's accent switch does), ink 0.84 → alpha 0. The sheen decides, as it does for the glint and for the chrome's poles, so an inversion band's remapped sheen flips the spot. A filled pane (`--rim`) always takes the cool spot: its ground is the fill, which is dark on paper (L 0.60), and a warm spot on an accent fill is accent on accent.
- **Edge** — the hairline turns to face the pointer. While lit (`.is-glass-lit`, under `[data-sl-fx="on"]`, never on a `--rim` and never over a lit aurora, which owns the edge), the `::after` conic's hot stop sits at the pointer's bearing with a fringe of the accent on one side (`--slfx-edge-warm`, accent-vivid 70%) and of the depth companion on the other (`--slfx-edge-cool`, depth-vivid 70%), 20° each: dispersion, which is what refraction looks like on an edge — the reference's material has exactly one colour-separation knob, its R/B channel shift (`shiftRed`/`shiftBlue`, 0.3 base, 0.75 in its chromatic preset). `effects.js` writes the bearing as a conic angle, unwrapped against the previous value so the transition on `--slfx-angle` (a registered property, so it interpolates, over `--sl-motion-fast`) never turns the long way round. Under Tier 2 the chrome's cursor reflection does the same on a pane: wider (`PANE_REACH` 48 px, the reference's spill radius), a little stronger (`PANE_GAIN` 0.95), and dispersed — red and blue sample the environment either side of green by `DISPERSE` (0.45 rad) times the cursor's presence, so the split is zero away from the pointer. Only on the hairline, only near the cursor; the content under the ring is never touched.

**What refraction is not, here.** Nothing bends the page behind the button: a canvas above the DOM has no backdrop to sample, and a `backdrop-filter` on the edge band would show nothing on a 1 px band and be the lens the owner refused on a wider one. Refraction is the edge's dispersion and the pane's Fresnel pair (bright rim inside, dark line outside, glint above, shade below); the label is never refracted. `--pane` requires `sl-fx-glass` on the same element, where the glint is declared (the vivid tier and its fits sit on the element's parent, see below).

### Aurora — `sl-fx-aurora`

**What it looks like.** The border-beam: a 1 px arc of light riding the border — the depth companion at its tails, the accent along it, a white-hot core at its centre (`--slfx-sheen` mixed 86% over the accent) — and, on `::before`, its bloom: the same arc blurred `--slfx-soft` (14 px), peaking on the edge and falling away over `--slfx-glow` (22 px) outward — past the box — and `--slfx-wash` (28 px, at most 42%) inward under the content. The falloff is shaped by the mask's own stops (a filter runs before the mask, so the blur can only soften the arc along its length, never across the ring), composited normally at about 0.45–0.5 alpha, in the beam and depth colours lifted toward white — light is lighter than what it falls on, and unlifted the dark depth companion reads as a grey smear on paper. Two axis ramps unioned, each trimmed by half the glow along the other axis (untrimmed they ran past the corners as arms; trimmed fully the corners went dark), so a corner is a little squarer than the ring. `--rim` takes no inner wash, a stronger depth-only bloom, a beam lifted a quarter toward white, and a core that stays coloured (`--slfx-core` 40% sheen, against 86% elsewhere), so the ring reads as its own hue beside an accent fill in both themes. Lit states fade over `--sl-motion-slow` (360 ms) rather than snapping, the arc replacing the chrome as a background transition; under reduced motion the motion tokens are 0 ms and the bloom is static material. While it sweeps, its hue drifts ±16° either side of the accent over 9 s — an aurora's colour moves, and a narrow range keeps the product's hue recognisable.

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

Under `prefers-reduced-motion: reduce` the busy arc does not orbit: it renders as a full static ring at reduced opacity (0.55, so a full static ring is not mistaken for focus), and `aria-busy` carries the state. A determinate arc is exempt from both the full ring and the dimming: it never moved, its length is the value, and looked at on the page the dimmed version blurs the end of the arc — the very thing that carries the value. It stays at full opacity.

### Liquid — `sl-fx-liquid`

**What it looks like.** The element is solid until the pointer touches it; then its outline swells at the cursor — a gentle outward bulge, a few pixels, that follows the pointer with a little lag: a drop welded onto the element's own rounded box with a soft neck, the way the reference's gooey pieces merge — and the content does not move. Released, the shape springs back, overshoots, and settles. Nothing is left behind. It reads as a very light gooey, never as a lens.

**How.** `effects.js` keeps one hidden `<svg class="sl-fx-liquid__skin">` and, while the pointer shapes an element, parents it into that element at `z-index: -2` — above the host's own background and border (a negative z-index child paints over both; the aurora's bloom already relies on this) and below its content, which is never filtered. The skin draws the host's silhouette — its rounded box, with the four radii read from its computed style (a percentage resolved against the shorter side, overlapping radii scaled down together, as CSS does) — plus a *drop*: a circle of radius `clamp(0.35 × shortSide, 10px, 16px)` whose centre sits inside the outline at the point nearest the lagged pointer, protruding by `amp × 0.24 × radius × exp(−½ (d / 1.5 radius)²)`, `d` being the pointer's distance from that edge (≈ 3 px on a 40 px button at full amplitude; × 0.4 for `--calm`). Box and drop go through the goo filter — `feGaussianBlur` σ 4, then `feColorMatrix` with an alpha slope of 18 about 0.5; the reference's own pair (its defaults are σ 6 and 18, with the slope's midpoint at 0.42), the sigma smaller here because the swell is a few pixels and its neck has to stay in proportion, and the midpoint at 0.5 so a straight edge of the goo lands exactly on the source edge — which welds the drop to the box with a soft neck. The crisp box is drawn again unfiltered on top of that, so the goo can only *add* the swell and never rounds a corner the component declared. A second filter turns the merged alpha into paint: an `feFlood` of the host's computed `background-color` inside it, and a band one border-width wide (`feMorphology` erode) in the host's computed `border-top-color` along its outline, so the ring bends with the swell. Both colours are re-read every frame — hover and active states are the host's, and the skin follows them. `color-interpolation-filters="sRGB"` on both filters, so the alpha slope acts on a linear alpha. Meanwhile the host's own border is hidden under a transparent `border-image` (`[data-sl-fx="on"] .sl-fx-liquid.is-liquid-live`), never by `border-color`: the computed border colour stays the truth for the skin to read. The filter regions are sized per live element in pixels (its box plus room for the drop and the blur's tail). Verified on the rendered page at 1× and at a 2× zoom standing in for device-pixel-ratio 2: the band stays crisp, the swell is a small bump with a soft neck, the label does not move.

The spring (`k = 170`, damping `14`) is critically underdamped, so the release overshoots and settles within about a second; the drop's centre chases the pointer with its own lag, so it arrives after the cursor — that trail is the mass. The skin and the class are removed when the spring settles.

**The chrome follows the silhouette.** `effects-gpu.js` reads `liquidState()` — the live element, the drop's radius (0 while it is still wholly inside the box), its *lagged* centre and the goo's neck width (`GOO_BLEND`, 1.5 σ) — and the shader's distance field is the smooth minimum (`smin`, k = that width) of the same rounded box and the same circle about the same point, so the hairline follows the swell where the skin has it. Anything that changes in one place must change in the other.

**The radius is never rewritten.** The skin traces the radii the component declared, so a component stays free to re-parametrise its own `--sl-radius-*` without touching this layer. Under Tier 1 the glass hairline (`::after`) fades while the element is live — the skin's band is the edge, and a rigid ring around a swelling shape reads as broken; under Tier 2 the chrome follows the silhouette instead.

**The gate.** `effects.js` matches `.sl-fx-liquid.sl-fx-liquid--drop` and nothing else: a round icon-only button, and no other shape. A bare `sl-fx-liquid`, and every container, is inert. The amplitude is `BULGE_K = 0.5` of the drop radius — 7px on a 2.5rem button; at the original 0.24 the same button swelled 3.4px and the owner called it "quasi inesistente". The owner's ruling — the gooey works on round buttons alone — could have been implemented by measuring `border-radius` against the width; it was not, because a geometric heuristic misfires the moment a component re-parametrises its own `--sl-radius-*`, and the modifier written in the markup is the contract. The round icon-only button has no dedicated class in `components.css` yet; the showcase sizes a `.sl-btn` square and re-parametrises its radius to `--sl-radius-pill`, which is exactly the case the gate protects. A pointer leaving a *child* of the host (the icon) does not release the host: the delegated `pointerleave` listener fires for every child, and only the host's own leave counts — the same guard the pane's driver carries.

### Glitch — `sl-fx-glitch`

Generalised from `sondalab-site/src/lib/glitch.ts` and its CSS: two ghost channels on the child span's `::before`/`::after` reading `attr(data-text)`, `mix-blend-mode: screen`, coloured `--slc-accent` and `--slfx-depth`; JavaScript owns burst *timing* — finite, randomised length, hard-capped at 1500 ms; per-burst randomisation of channel durations, phase offsets and amplitude via inline custom properties; `scramble()` for short labels; the `--shatter` variant (horizontal bands with random sideways offsets, each carrying `--slfx-i`/`--slfx-n` inline). Reduced motion is respected, high contrast disables it, bursts go through the coordinator, and `burst()` refuses a detached element.

### GPU tier boot

Double-guarded exactly as `sondalab-site/src/lib/crt-surface.ts` does it: `typeof navigator === "undefined" || !("gpu" in navigator)` returns null before anything is created; the `vgpu` import, `init()`, surface, effect and first frame all sit in one `try` whose `catch` runs the same `stop()` the happy path uses; `gpu.onError` and `gpu.gpu.lost` both call `stop()`; a switch to high contrast calls `stop()`. `stop()` removes the canvas, disconnects every observer and listener, and clears `data-sl-fx-gpu` only if this handle set it.

`vgpu` is an **optional peer dependency** — `peerDependencies` plus `peerDependenciesMeta: { vgpu: { optional: true } }`, never `optionalDependencies`. The WGSL ships as an inline template string.

### Public API — `effects.js`

```js
import { mount, burst, scramble, grantLive, revokeLive, mountGpu } from '@sondalab/ui-kit/effects.js';

mount(root = document);   // arms Tier 1: sets data-sl-fx, injects the bloom children, wires the pointer + observers
burst(el, opts);          // one finite glitch burst, subject to the coordinator
scramble(el, opts);       // decode-scramble a short label
grantLive(el);            // the one ambient aurora; revokeLive(el) gives it back
await mountGpu();         // Tier 2; resolves false when WebGPU is unavailable
```

Importing the module has no side effects. Pointer tracking is one delegated listener; the liquid's integration runs in one shared `requestAnimationFrame` that stops itself when the spring settles.

## Colour contract, and the audit gap it has to cover

Every hue in `effects.css` resolves through `color-mix()` over `--slc-*`/`--sl-*` role-vars, or through relative colour syntax (`oklch(from var(--…) …)`) whose channel arithmetic is the derivation and not a colour; masks use the `black` keyword. No literal appears in any shipped file.

**Paper takes its contrast from saturation, not luminance.** On the light theme the accent and its depth companion are dark by construction (they have to contrast with cream), and a dark line on a light page reads as pigment; lifting it toward white makes it pale. So every hue an effect emits is first brought to the palette's own vivid tier — where `--sl-status-*` already sit on both themes — by a floor on oklch lightness (0.66) whose lift is paid for in chroma (0.45 per unit of lift), then **fitted to sRGB**: the lift can ask for more chroma than the gamut holds at that lightness and hue (teal at L 0.66 holds C 0.114; the tier asks 0.166), and Chrome does not gamut-map, it clips in sRGB, which moves hue and lightness silently — so every colour that pushes chroma (the two vivid tokens, the pane's warm spot, the blooms, the `--rim` beam) goes through a fit: CSS Color 4 §13's mapping, chroma reduced at constant lightness and hue until inside, written as seven bisection steps in relative colour syntax, each probing linear sRGB and carrying the in-gamut bit in its alpha (`--slfx-in-gamut`). The paper depth companion goes from L 0.45 / C 0.07 to 0.66 / 0.11 (the ceiling; asked 0.17), the paper accent from 0.60 / 0.13 to 0.66 / 0.15 (asked 0.16); the ink tokens already sit above the floor and pass through unchanged. `scripts/effects-gamut.test.mjs` evaluates the stylesheet's own declarations over a hue sweep on both themes and holds every emitted colour inside sRGB, at its derived lightness and hue, and at the ceiling whenever more was asked. The neutral glint (the hairline's bright stop, the arc's hot core) is the sheen where the sheen is the light pole, and its lightness mirrored (1.2 − l) where it is the dark one. All are derivations, not `[data-sl-theme]` branches: a page without the theme attribute still gets the right answer. The six fitted colours are registered (`@property`, `<color>`, inherited) and declared on the **parent** of the edge, `:has(> :is(.sl-fx-glass, .sl-fx-aurora))`: a fit is nine nested relative colours (~0.15 ms of style resolution each in Chrome 152), and on the edge itself the six were recomputed with every pointer move on a pane (1.7 ms per move, against 0.13 before); on the parent they are paid only when the parent's style changes, and the parent still sees every ancestor's `--slc-*` remap — what it cannot see is a remap on the edge element itself. The glint and the chrome's stops stay on the edge.

**The real trap is JavaScript and WGSL.** `sl-audit` reads CSS; a literal in `effects.js`, `effects-gpu.js` or the shader would pass the gate while breaking the contract. Therefore every hue the GPU tier uses is read with `getComputedStyle` from `--sl-accent-default`, `--sl-accent-depth`, `--sl-text-primary`, `--sl-bg-canvas` (re-read on `data-sl-theme` and inline-style changes on `<html>`) and reaches the shader as a uniform; the shader's palette takes its coloured stops from the accent pair and its poles from the neutral pair, and `scripts/effects-gpu.test.mjs` asserts exactly that, alongside the literal ban on all three JavaScript files. The skin's shapes are drawn in `currentColor` and only their alpha is used; its flood colours are the host's computed `background-color` and `border-top-color`, read every frame. The goo's blur sigma and alpha slope are numbers, not colours. The aurora's `hue-rotate` drift is a filter on a token-derived colour, not a colour. The pane's driver writes three numbers (`--slfx-px`, `--slfx-py`, `--slfx-ptr`) and a lit amount (`--slfx-lit`); every colour the pane paints is derived in `effects.css` from the sheen and the accent pair, and the theme switch between its cool and warm spot is an alpha computed from the sheen's lightness, not a `[data-sl-theme]` branch.

## Testing

| Test | Asserts |
|---|---|
| `scripts/effects-audit.test.mjs` | `effects.css` passes `auditCss` (no colour literal, no accent redefinition, `black` for masks) |
| `scripts/effects-guards.test.mjs` | both kill switches neutralise host-level `animation`/`box-shadow`/`filter` on every family; the opt-out matches the carrying element; one shared ring rule growing inward; `--slfx-angle` registered; every `animation:` inside the reduced-motion guard; exactly six edge rules paint (shared ring, the pane's body on `::before`, the pane's lit edge under `[data-sl-fx="on"]`, aurora arc covering busy, aurora bloom band, linear); the busy arc paints outside the guard while its orbit is inside; determinate drives arc length; no rule filters a liquid host, its skin or its content, and no rule references an SVG filter; the skin sits below the content, takes no pointer, does not clip, and both kill switches hide it; exactly one host-level rule keys on `.is-liquid-live`, under `[data-sl-fx="on"]`, and it only sets `border-image`; no effect rule sets a `border-radius` other than `inherit` |
| `scripts/effects-js.test.mjs` | no colour literal; the documented exports; import has no side effects; `mount()` refuses under reduced motion and high contrast; `mountGpu()` refuses under high contrast; a live field tears down on high contrast; burst drops rather than queues, refuses detached and unarmed; the ambient grant is single; the liquid never writes a filter or a border property onto an element and carries no displacement primitive; one skin, which leaves its previous host before entering the next; the gooey engages only behind `--drop`/`--calm` and measures no radius; a child's `pointerleave` releases neither the liquid nor the pane; the pane writes only `--slfx-*` properties, removes them when dark, and its loop stops itself |
| `scripts/effects-gpu.test.mjs` | no colour literal in the GPU module or the shader; the palette is fed from the token uniforms; the chrome welds the liquid's drop onto the box with a smooth minimum about the reported centre and the displacement-era geometry is gone; the pane flag travels in `kinds.y` and the dispersion is scaled by the cursor's presence and confined to the hairline branch; `bootField` returns null without WebGPU and when `vgpu` is missing; `vgpu` is an optional peer; the WGSL is inline |
| `scripts/effects-showcase.test.mjs` | the package ships the layer; the showcase applies all four families; every busy aurora carries ARIA; the glitch is a child span; the tier label reads `data-sl-fx-gpu`; every `.sl-btn` is either a glass pane or a `--drop` icon-only button with an `aria-label`, and at least one of the latter exists |
| `scripts/agent-docs-drift.test.mjs` | `agent/design-language.md` stays byte-identical to `docs/design-language.md` |

Nothing in this repository renders a frame. **Every real defect in this layer was found by looking at the rendered page beside the reference, and none by reading**; a change to any of the four shipped files is not done until it has been looked at, in dark and in light, with the reference open.

## Delivery

`packages/ui-kit/effects.css`, `effects.js`, `effects-gpu.js`, `effects-shader.js`; `showcase/effects.html`; the tests above; `docs/design-language.md` L6 with `packages/ui-kit/agent/design-language.md` regenerated; `agent/catalog.md`, `agent/HANDOFF.md` and the `l6-*` rows of `agent/substrate-matrix.json`. `packages/ui-kit/package.json` carries the version; `packages/palette-py/` is not touched.

## Known gaps against the reference (honest)

- **Reflections on neighbours** are built (glass section above) but reach only across a gap of a few pixels and only onto other effect elements: a plain `<p>` beside a chrome card catches nothing, and a neighbour further away than ~14 px catches nothing visible. The reference reflects onto explicitly named targets at up to 32 px.
- **Inner reflection.** The reference's metal shows its environment faintly *inside* the element too. Not built; the glass here is the edge only. The pane's body is light from a fixed direction and from the pointer, not the environment.
- **Refraction of the backdrop.** Nothing bends what lies behind a pane: the canvas has no backdrop to sample and a `backdrop-filter` on a 1 px band shows nothing. The pane's refraction is the edge's dispersion and its Fresnel pair; a reader expecting the page to warp through the button will not see it, by design.
- **Straight runs.** A rectangle's long edge has one surface direction; the reference's circle sweeps continuously. The environment varies along page space as well as angle to compensate, but a very long edge still reads calmer than the reference's ring.
- **Tier 2 does not arm from a cold load under `prefers-reduced-motion: reduce`**, because `mount()` refuses and `mountGpu()` requires `mount()`; the static chrome is therefore not shown to a reduced-motion visitor, who gets the CSS hairline instead. Coherent, documented, not equal.

## Risks

| Risk | Handling |
|---|---|
| Per-frame work for the liquid's skin | two `getComputedStyle` reads and a handful of attribute writes on one element, only while it is live; the goo filter's region is that element's box plus a few pixels. The displacement map this replaced rasterised and `toDataURL`-encoded a canvas every frame |
| `filter` on the host disables subpixel antialiasing while live | every Sondalab surface sets `-webkit-font-smoothing: antialiased`; the filter is removed when the spring settles |
| Conic rings and the blurred bloom repaint while swept | the budget caps ambient auroras at one per document; busy ones are bound to real work |
| The page-level canvas over a sticky translucent header | canvas below `--sl-z-overlay`; verified against the showcase header |
| `vgpu` is at `0.3.x` and pre-1.0 | optional peer, dynamically imported inside the guarded boot; a breaking change degrades to the CSS hairline rather than breaking a build |
| An adopting product enables all four families everywhere | Decisions 1 and 5 are the written defence; the judgement half lives in `HANDOFF.md` so the auditing agent enforces it |
