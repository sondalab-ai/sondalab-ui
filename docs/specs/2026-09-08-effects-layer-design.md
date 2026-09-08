# Sondalab DS — Effects layer (glitch · liquid · aurora · glass)

> **What this file is:** the implementation contract for `@sondalab/ui-kit`'s effects layer — a fifth, opt-in layer above tokens, themes and components that gives interactive elements material behaviour (instability, response to touch, attention, physical edge). It fixes the effect grammar, the tiering and fallback policy, the colour contract, the per-component declension, and the delivery split. Where `design-language.md` is the human grammar contract and `design-system-spec.md` the machine token contract, this file is the design contract for one new layer; on delivery of Slice 2 its grammar half is promoted into `design-language.md` as **L6** and this file becomes the rationale record.
> **Audience:** engineers implementing the layer; reviewers checking it against the house grammar; agents authoring Sondalab surfaces that consume it.
> **Owner:** marcellobarile.
> **Companion files:** `design-language.md` (the grammar these effects extend — L2 hairline, L4 motion, L5 voice), `design-system-spec.md` (token contract — no token is added here), `packages/ui-kit/agent/HANDOFF.md` (what `sl-audit` cannot check), `sondalab-site/docs/webgpu-surfaces.md` (the WebGPU boot/fallback pattern this reuses), `sondalab-site/src/lib/glitch.ts` (the glitch prior art being generalised).

## Legend (status vocabulary)

- **Shipped / Delivered** — merged to the surface's production codebase, available to users.
- **PoC implemented (not delivered)** — built as a prototype, not merged/released.
- **Placeholder (not delivered)** — stub or scaffold only.

At authoring time (2026-09-08) the entire layer is **Placeholder (not delivered)**. `showcase/effects.html` is targeted at **PoC implemented (not delivered)**; the published `@sondalab/ui-kit` files (`effects.css`, `effects.js`) are targeted at **Delivered** on the 0.8.0 release.

## Why this exists

The design language currently fixes *materials* (type roles, spacing scale, 1px rule weight, motifs, motion easing) and spends distinctiveness on *composition*. It has no vocabulary for **material behaviour** — how a surface reacts to being looked at, touched, focused, or invalidated. The result is correct and inert: a Sondalab surface reads as one family but never as alive.

The prior art already exists but is stranded. `sondalab-site` has a two-channel VHS glitch (`src/lib/glitch.ts` + `src/styles/site.css` lines 240–340) and a WebGPU CRT surface (`src/lib/crt-surface.ts`, generalised in `docs/webgpu-surfaces.md`), neither of which any other product can reach. This layer generalises the reusable half into the kit and leaves the site's blessed exceptions where they are.

## Thesis

**The surface is an instrument panel behind glass, with live signal underneath.**

The operative constraint: effects spend their budget on **light and material**, never on **weight, radius, or added chrome**. The house grammar forbids heavy borders (L2: structural separation is always `1px`) and generic card-grid decoration. So the glass edge stays exactly `1px` and becomes chromatically alive rather than thick; the aurora widens only inward and pays for its presence in light rather than in an added concentric ring; the liquid warps light, not geometry that carries text. This is what keeps four expressive effect families compatible with editorial modernism instead of turning the suite into generic glassmorphism.

## Decision 1 — Effects are semantic, not decorative

L5 ("structure encodes truth") applied to motion: **an effect that means nothing gets switched off.** Each family owns one meaning, and a family never fires outside it.

| Family | Means | Fires on |
|---|---|---|
| **Glitch** | *something re-resolved* | discrete events: value change, destructive confirmation, validation failure, dialog open, identity |
| **Liquid** | *you are recognised* | pointer proximity/pressure; re-solidifies on leave |
| **Aurora** | *attention lives here* | `:focus-visible`, `:focus-within`, active tab, a running operation, primary call-to-action |
| **Glass** | *this is a physical surface* | a **state**, not an event: card, field, dialog, keycap edges |

Consequence: glitch is never ambient on a control (ambient glitch is the wordmark's alone, and rare); liquid never fires without a pointer; aurora never marks something that is not currently the focus of attention; glass never animates on its own.

## Decision 2 — No new tokens; ui-kit-only versioning

`design-language.md` §New-token policy admits a token only for a shared fixed value recurring across **≥2 products**. An effects layer has zero adopters at authoring time and fails that bar by construction. Independently, editing `sondalab.tokens.json` regenerates **both** distributions and forces a `sondalab-palette` (PyPI) bump for a web-only visual effect — semantically wrong, and it drags the terminal palette (whose values are pinned by smartctx's contract test in `claude-loadout`) into an unrelated release.

Therefore:

- `packages/ui-kit/effects.css` and `packages/ui-kit/effects.js` are **hand-authored**, like `components.css` and the `agent/` core. `npm run gen:tokens` does not emit them, so `check-drift.yml` (which runs the generators and then `git diff --exit-code -- packages/`) stays green.
- Every colour derives via `color-mix()` from the existing role-vars.
- Release: **`packages/ui-kit/package.json` → `0.8.0`** (minor — new backward-compatible surface). **`packages/palette-py/pyproject.toml` is not bumped.** This is the same "ui-kit-only change" posture `AGENTS.md` records for the agent core.

## Decision 3 — Namespace

Effects introduce `--slfx-*` custom properties and `.sl-fx-*` classes, mirroring how `--slc-*` role-vars sit beside `--sl-*` tokens without occupying the token namespace. `--sl-fx-*` is rejected precisely because it would read as a token to both humans and `sl-audit`'s allowlist resolution.

Effect classes are **additive** and compose onto existing components — `class="sl-btn sl-btn--primary sl-fx-liquid sl-fx-aurora"`. `components.css` is not modified by this work.

Two role-vars are introduced at the top of `effects.css`, following the `--slc-*` fallback-chain convention:

```css
--slfx-depth: var(--sl-accent-depth, var(--slc-accent));
--slfx-sheen: var(--slc-text);
```

The rest of the namespace is geometry rather than colour, and every entry is a per-component binding with a conservative default: `--slfx-ring-w` (`1px`) and `--slfx-bloom` (`0`) size the aurora edge, `--slfx-arc` / `--slfx-progress` shape its busy arc, `--slfx-angle` is its `@property`-registered sweep angle, and `--slfx-px`/`--slfx-py`/`--slfx-d` carry the liquid's pointer state. Defaults are chosen so an element that opts into a class without binding anything renders the most restrained version of the effect, never a broken one.

`--slfx-depth` exists because `--sl-accent-depth` is a theme-layer token: Tier A products get it live, Tier B products that mapped only `--slc-accent` still resolve to a valid single-accent value rather than to nothing.

## Decision 4 — Three tiers, attribute-keyed; the base tier is the default state

Reusing the rule from `sondalab-site/docs/webgpu-surfaces.md` verbatim — *"the fallback is the default state"*. CSS is the implementation; JavaScript and the GPU are additive tiers keyed off attributes that only get set once each capability has actually answered.

| Tier | Key | Requires | Delivers |
|---|---|---|---|
| **0 — material** | none (always on) | CSS only | glass edge; static aurora ring on `:focus-visible`/`:focus-within` |
| **1 — behaviour** | `data-sl-fx="on"` on `<html>`, set by `effects.js` at `mount()` | JavaScript | pointer-driven liquid, finite glitch bursts, animated aurora sweep |
| **2 — field** | `data-sl-fx-gpu="on"`, set only after the GPU device answers | WebGPU + `vgpu` | fluid liquid field with inertia (Slice 3) |

Nothing auto-mounts on import. `mount()` is explicit, which is what makes the IDE opt-in of Decision 6 possible at all.

### Kill switches (all three are hard requirements)

1. **`prefers-reduced-motion: reduce`** — `effects.js` never arms Tier 1, and `effects.css` additionally guards every animation in a `@media (prefers-reduced-motion: no-preference)` block. Tier 0 survives, because the glass edge and the static aurora ring are not motion.
   **The site's exception does not travel.** `sondalab-site/src/lib/glitch.ts` deliberately ignores reduced-motion ("the glitch is brand, not decoration"), protected by `scripts/motion-gate.mjs`. That is a **site-level blessed deviation**: `l4-reduced-motion` is **R** on IDE/App/Page in `substrate-matrix.json`, and the kit ships to spexr, introspect, local-agents and daos. The kit respects the preference; a product that wants the site's posture opts out explicitly and records it as a blessed deviation of its own.
2. **`[data-sl-theme="high-contrast"]`** — all four families are disabled. Precedent: `showcase/index.html` already drops `#field` and the hero scrim under high-contrast.
3. **`data-sl-fx="off"`** on any element — disables effects for that element and its subtree. Enables a dense data region inside an otherwise expressive page.

## Decision 5 — The effect budget (anti-neon-soup)

Four families across a dozen components, unconstrained, is a Christmas tree. `effects.js` acts as a coordinator holding module-level singletons:

- **At most one *ambient* aurora is animated per document.** Ambient auroras are the coordinator's: an element requests one via `data-sl-fx-live="on"`, and the coordinator grants it to at most one element at a time (most recent request wins; the previous falls back to its static ring).
- **At most one glitch burst runs at a time.** A burst requested while another runs is dropped, not queued — a queue would produce a stutter train, which reads as breakage rather than as signal.
- **State-driven auroras are exempt** because they are singular by construction: `:focus-visible` and `:focus-within` are pure CSS, and the platform guarantees a single focused element.
- **Busy auroras are exempt.** `data-sl-fx-live="busy"` is bound to real work, and several cards can legitimately be loading at once; capping them would make the interface report a false state. The cap exists to stop decoration accumulating, not to stop the interface telling the truth — which is Decision 1 read in the other direction.

**Aurora never replaces the focus ring.** The `outline` from the shared focus-ring rule in `components.css` stays, drawn outside the border box at `outline-offset: 2px`; the aurora inhabits the border band itself and therefore never occupies the outline's position. An effect that removes an accessibility affordance is a defect, not a variant.

**Aurora renders state; it never *is* the state.** Same discipline, one level up: a busy aurora requires the element to carry `aria-busy="true"`, and a determinate one `role="progressbar"` with `aria-valuenow`. A screen reader, a reduced-motion visitor and a high-contrast visitor all get the state from the markup; the aurora is how the state looks, not where it lives.

## Decision 6 — Substrate scope

| Substrate | Scope |
|---|---|
| **Page** (daos, sondalab-site) | primary target — glass and aurora are **R**, liquid and glitch **A** |
| **App** (introspect, local-agents) | measured — every family is **A**; the effect budget is **R** if any family is used |
| **IDE** (spexr in Theia) | **N/A by default, opt-in.** The host chrome is fixed and competes for the same visual bandwidth; `effects.css` is a separate import precisely so an IDE surface can decline it at the import boundary. A spexr panel that deliberately imports it is then held to the **App** column. |
| **Term** (smartctx) | **N/A** |

This is why `effects.css` is a separate file rather than an append to `components.css`: declining it must be free.

## Per-component declension

The design work proper. Each component gets the families that match its semantics — never all four, and never one because it was available.

● = required where the substrate requires the family · ○ = adapt (reduced amplitude) · — = never

| Component | Glitch | Liquid | Aurora | Glass |
|---|---|---|---|---|
| `sl-btn--primary` | on destructive confirmation | ● specular + radius morph | ● `:focus-visible`; ● `busy` while submitting | — (filled; no edge to cut) |
| `sl-btn--ghost` | — | ○ specular on the border | ● `:focus-visible` | ● its `1px` border **is** the glass edge |
| `sl-card` | — | ○ low amplitude, no tilt | ● `busy` while loading; `sweep` only when granted | ● edge + inner top highlight |
| `sl-field__input` | 1 burst on validation failure | — (typing must not be disturbed) | ● `:focus-within` | ● |
| `sl-tabs__tab` | scramble on label change | — | ● the 2px active underline becomes a sweep | — |
| `sl-badge` / `sl-tag` | scramble on value change | — | — | ○ micro-rim |
| `sl-dialog` | shatter-in on open (1 burst) | — | ● rim while open; `busy` while its action runs | ● |
| `sl-table tbody tr` | — | ○ row-level specular | — | — |
| `sl-eyebrow` / section index | scramble on entering the viewport | — | — | — |
| wordmark | rare ambient burst | — | — | — |
| `sl-callout--danger` | 1 burst on mount | — | — | ● |
| `sl-link` | — | — | ● underline becomes an aurora on hover | — |
| `sl-kbd` | — | — | — | ● the keycap edge |
| inversion band | — | — | ● along the top edge | — |

Two exclusions are deliberate and load-bearing:

- **No liquid on `sl-field__input`.** A text field that deforms while being typed into trades legibility for spectacle.
- **No glitch on `sl-btn--ghost` or `sl-card`.** Glitch marks *something re-resolved*; a passive container has nothing to re-resolve, so a burst there would be decoration and Decision 1 forbids it.

## Implementation contract

### Glass — `sl-fx-glass`

A `1px` edge painted with a conic gradient so it catches light at two angles, plus a single inner highlight. Border **width is unchanged**; only its colour becomes a gradient.

Glass and aurora share **one** edge mechanism — the masked `::after` ring described under Aurora below, occupying exactly the border band. Glass is its resting temperament (static angle, neutral-dominant stops); aurora is its attention temperament (swept angle, accent-dominant stops). A `background-clip: border-box` gradient was rejected for this: it would require every component to declare its own ground colour (`--slc-surface` for a card, `--slc-raised` for a field) so the padding-box layer could repaint it, adding a role-var and a per-component binding for no visual gain. The ring composites over whatever background the element already has.

**One ring, four stop variables, swapped by state.** The two temperaments cannot be two `background` declarations on the same `::after` — an element carrying both classes would resolve to a single winning background and show the attention state permanently. So the ring declares its gradient once in terms of `--slfx-s0..s3`, and each state binds the stops:

```css
.sl-fx-glass {
  --slfx-s0: var(--slfx-edge-warm);
  --slfx-s1: var(--slfx-edge-dim);
  --slfx-s2: var(--slfx-edge-cool);
  --slfx-s3: var(--slfx-edge-dim);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--slfx-sheen) 7%, transparent);
}
.sl-fx-glass::after { opacity: 1; }
```

with the three edge stops mixed from role-vars only:

```css
--slfx-edge-warm: color-mix(in srgb, var(--slc-accent) 24%, var(--slc-border-strong));
--slfx-edge-cool: color-mix(in srgb, var(--slfx-depth)  24%, var(--slc-border-strong));
--slfx-edge-dim:  var(--slc-border-subtle);
```

Inside an inversion band the alpha-over-canvas default of `--slc-border` sits on the wrong ground — the pitfall `components.css` already documents. The fix stays at the band, unchanged: `.invert { --slc-border: color-mix(in srgb, currentColor 22%, transparent); }`.

### Aurora — `sl-fx-aurora`

**The aurora inhabits an edge that already exists; it never adds a concentric ring.** A second ring would be added chrome, which the thesis forbids, and on a focused element it would stack three concentric rings — the `1px` border, the aurora, then the `outline` at `outline-offset: 2px` — blurring the accessibility affordance into the decoration. So:

1. **Where the element has a border, the aurora *is* that border in its attention state** — same geometry, same `1px`, no growth, and the `outline` stays the only external ring and therefore unambiguously readable as focus.
2. **An external rim only where there is no edge to inhabit** — `sl-btn--primary` is filled and borderless, and is the one case where the ring genuinely sits outside the box.
3. **Where the edge is not a ring, the aurora is linear** — it inhabits the active tab's 2px underline, the link's underline, the inversion band's top rule. It never becomes a ring there.

**The band is not fixed at `1px`.** The hairline rule (L2) governs *separators*; `HANDOFF.md` check 4 already draws the distinction the aurora falls on the other side of — *"a 2px edge that emphasizes (active-tab underline, keycap, measure-tick) is a deliberate accent — leave it"*. The aurora is emphasis, so its width is an already-blessed category rather than a deviation. It is `--slfx-ring-w`, and it scales with how much room the element has: `1px` on inline controls (a thick ring on a 28px-tall control eats the control), `2px` on fields and tabs, `3px` on cards, dialogs and panels.

**The band grows inward, never outward** — outward growth would walk into the focus `outline` at `outline-offset: 2px`, which Decision 5 protects. Mechanically that is `padding: var(--slfx-ring-w)` on a ring whose `inset` stays pinned to the border box. On a card the ring eats `3px` of a `--sl-space-5` (24px) padding, which is invisible to the layout.

**Width alone is not the aurora, though.** A thick hard-edged ring is just a fat border; an aurora in nature has no edge. So width pairs with `--slfx-bloom`, an inward luminous falloff carried by `box-shadow: inset` on the element (it follows `border-radius` exactly, composites cheaply, and costs no third stacking layer — `::before` is already the liquid sheen). The division of labour: **the rim carries direction, the bloom carries volume.** `--slfx-bloom` is `0` on inline controls and roughly `18px`–`28px` on containers.

The corollary is that **glass and aurora are one mechanism, not two stacked decorations**: a single `::after` occupying exactly the border band, with two temperaments — at rest the static conic catching light at two angles (glass), under attention the same conic saturated to the accent and swept (aurora). An element carrying both classes does not stack them; the aurora is the attention state of its glass edge.

A masked `1px` conic ring on a pseudo-element, swept by an `@property`-registered angle. **Geometry note:** for an absolutely positioned child, `inset: 0` resolves against the *padding* box, so `inset: -1px` with `padding: 1px` and `mask-composite: exclude` lands exactly **on** the border when the border is `1px`, and `1px` outside the visible box when the element has none — which is precisely the rule above, expressed in one declaration. Implementations must not "correct" it to a positive inset.

```css
@property --slfx-angle { syntax: "<angle>"; inherits: false; initial-value: 210deg; }

/* shared ring geometry — glass and aurora are two temperaments of this one edge */
:is(.sl-fx-glass, .sl-fx-aurora) { position: relative; }
:is(.sl-fx-glass, .sl-fx-aurora)::after {
  content: ""; position: absolute; inset: -1px; border-radius: inherit;
  padding: var(--slfx-ring-w, 1px); pointer-events: none; opacity: 0;
  background: conic-gradient(from var(--slfx-angle),
    var(--slfx-s0) 0deg, var(--slfx-s1) 95deg,
    var(--slfx-s2) 185deg, var(--slfx-s3) 290deg, var(--slfx-s0) 360deg);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;   /* Safari below 15.4 */
  mask-composite: exclude;
  transition: opacity var(--sl-motion-mid) var(--sl-motion-ease);
}

.sl-fx-aurora:is(:focus-visible, :focus-within, [data-sl-fx-live="on"]) {
  --slfx-s0: transparent;
  --slfx-s1: color-mix(in srgb, var(--slc-accent) 90%, transparent);
  --slfx-s2: color-mix(in srgb, var(--slfx-depth) 90%, transparent);
  --slfx-s3: transparent;
}
.sl-fx-aurora:is(:focus-visible, :focus-within, [data-sl-fx-live="on"])::after { opacity: 1; }
```

Because the stops are variables on the *element* and the gradient lives once on the pseudo-element, an element carrying both classes transitions from glass to aurora by rebinding four custom properties — the ring itself never changes, which is what makes the two families read as one material rather than as a swap.

`--slfx-s0..s3` default to `transparent` in the `--slfx-*` block, so a bare `.sl-fx-aurora` at rest is a well-formed invisible ring rather than an invalid gradient. The sweep (`@keyframes` animating `--slfx-angle` from its `210deg` initial value to `570deg`, so the rotation is continuous rather than snapping back through the resting angle) is added only under Tier 1 and `prefers-reduced-motion: no-preference`. Where `@property` is unsupported the angle is not animatable and the ring renders **static** — a correct Tier-0 degradation, not a broken state. The `@property` floor (Chrome 85 / Safari 16.4 / Firefox 128) is the same floor the theme layer already accepts for its relative-colour accent step, so this adds no new browser requirement.

#### Three modes, distinguished by illuminated arc

One mechanism, three readings. What separates them is **the fraction of the perimeter that is lit** — not colour, not speed, which is why they stay legible next to each other.

| Mode | Selector | Arc | Motion | Means |
|---|---|---|---|---|
| **static** | `:focus-visible`, `:focus-within` | ~60% | none | this element has focus |
| **sweep** | `[data-sl-fx-live="on"]` | ~60% | angle rotates, ~3.2s linear | ambient liveness; capped at one per document |
| **busy** | `[data-sl-fx-live="busy"]` | `--slfx-arc`, `65deg` (~18%) | arc orbits, ~1.1s linear | a real operation is running here |
| **determinate** | `[data-sl-fx-live="busy"]` + `--slfx-progress` | `calc(var(--slfx-progress) * 360deg)` | none — the **length** is the value | how far that operation has got |

`busy` is the one mode that replaces the shared four-stop background rather than rebinding the stops, because it is a different geometry — a short travelling marker, not a full-perimeter wash. That override is deliberate and is the *only* one: on an element carrying both `sl-fx-glass` and a busy state, busy wins, which is correct — a resting edge and a working edge are not the same edge, and the work is the more important thing to report.

```css
@keyframes slfx-orbit { to { --slfx-angle: 570deg; } }

.sl-fx-aurora[data-sl-fx-live="busy"] { --slfx-arc: 65deg; }
.sl-fx-aurora[data-sl-fx-live="busy"]::after {
  opacity: 1;
  background: conic-gradient(from var(--slfx-angle),
    color-mix(in srgb, var(--slc-accent) 92%, transparent) 0deg,
    color-mix(in srgb, var(--slfx-depth)  78%, transparent) calc(var(--slfx-arc) * 0.62),
    transparent var(--slfx-arc),
    transparent 360deg);
}
[data-sl-fx="on"] .sl-fx-aurora[data-sl-fx-live="busy"]:not([style*="--slfx-progress"])::after {
  animation: slfx-orbit 1.1s linear infinite;
}
```

Determinate needs no animation: `--slfx-progress` sets `--slfx-arc` directly and the arc stays pinned at the resting angle, so the edge of a card *is* its progress bar — no extra widget, no layout.

**Under reduced motion the arc does not orbit.** It renders as a static full ring at reduced opacity: present, honest about there being something going on, and not moving. The state itself is carried by `aria-busy` / `role="progressbar"` per Decision 5, so nothing is lost — which is the whole reason that rule is a hard requirement rather than a recommendation. Under high-contrast the aurora is off entirely and only the ARIA remains.

### Liquid — `sl-fx-liquid`

Two composed parts, both non-destructive:

1. **Specular sheen** on a `::before` layer: a radial gradient centred on `--slfx-px`/`--slfx-py` (pointer position, written by `effects.js` inside a single shared `requestAnimationFrame`), scaled by `--slfx-d` (engagement, `0`→`1`, eased on enter and leave).
2. **Radius morph**: `effects.js` writes four per-corner bulge values from the pointer's proximity to each corner; `border-radius` interpolates between `--sl-radius-md` and roughly `+10px` on the near corners.

Under Tier 1 the sheen layer additionally carries an SVG `feTurbulence` + `feDisplacementMap` filter, injected once by `effects.js` as a hidden `<svg>` on `mount()`.

**Non-destructiveness is a contract, not a preference: the filter is applied only to the sheen pseudo-element, never to a box that contains text.** SVG filters disable subpixel antialiasing on their subtree; filtering the element itself would visibly degrade every label in the interface. Text geometry never moves; only light does.

### Glitch — `sl-fx-glitch`

Generalised from `sondalab-site/src/lib/glitch.ts` and its CSS. Kept as-is:

- two ghost channels on `::before`/`::after` reading `attr(data-text)`, `mix-blend-mode: screen`, coloured `--slc-accent` and `--slfx-depth`;
- JS owns burst *timing* — finite, randomised length, hard-capped;
- per-burst randomisation of channel durations, phase offsets and amplitude multiplier via inline custom properties;
- `scramble()` for short labels (decode-readout, left-to-right lock), reading its target from `data-num`/`textContent`;
- the `--shatter` variant (horizontal bands with random sideways offsets).

Changed on the way into the kit: reduced-motion is respected (Decision 4), high-contrast disables it, and bursts go through the coordinator (Decision 5). The `CAP_MS` ceiling and the detached-node guard in `autoBurst` are carried over unchanged — both exist because of real defects.

### GPU tier (Slice 3)

One shared `<canvas>`, `position: fixed`, `pointer-events: none`, below `--sl-z-overlay` so the sticky translucent header stays above it. It renders a fluid field only within the bounding rectangles of currently visible elements carrying `data-sl-fx-gpu`, passed as a uniform array with a fixed cap.

What justifies the GPU here and nowhere else: **inertia**. The field keeps moving after the pointer leaves, and the displacement is a real advection of the sheen rather than a gradient repositioned per frame. Glitch, aurora and glass have no such gap — they are already at full quality in CSS, which is why they have no GPU tier.

Boot, double-guarded exactly as `sondalab-site/src/lib/crt-surface.ts` does it — `navigator.gpu` alone is insufficient because the adapter can refuse and the device can be lost:

```js
if (!('gpu' in navigator) || !navigator.gpu) return false;
let gpu;
try { gpu = await (await import('vgpu')).init(); } catch { return false; }
```

`vgpu` is declared an **`optionalDependency`**, so a consumer that never calls `mountGpu()` installs nothing extra and a failed optional install cannot break `npm install`. The WGSL ships as an inline template string, not through a bundler plugin — the same call `sondalab-site` made, for the same reason (no consumer build-config change).

### Public API — `effects.js`

```js
import { mount, burst, scramble, mountGpu } from '@sondalab/ui-kit/effects.js';

mount(root = document);   // arms Tier 1: sets data-sl-fx, injects filter defs, wires pointer + observers
burst(el, opts);          // one finite glitch burst, subject to the coordinator
scramble(el, opts);       // decode-scramble a short label
await mountGpu();         // Slice 3; resolves false when WebGPU is unavailable
```

Importing the module has no side effects. Pointer tracking is a single delegated listener writing custom properties inside one shared `requestAnimationFrame`; elements outside the viewport are skipped via `IntersectionObserver`.

## Colour contract, and the audit gap it has to cover

Every hue resolves through `color-mix()` over `--slc-*`/`--sl-*` role-vars. No literal appears in `effects.css`.

**The real trap is JavaScript.** `sl-audit` reads CSS; a colour literal in `effects.js` or in WGSL **passes the gate while breaking the contract** — recorded in `sondalab-site/docs/webgpu-surfaces.md` after it cost a debugging cycle there. Therefore:

- every hue used by JavaScript or the shader is read with `getComputedStyle` from `--sl-accent-default`, `--sl-accent-depth`, `--sl-text-primary`, `--sl-bg-canvas`;
- values are re-read on theme change, via a `MutationObserver` on the root's `data-sl-theme`;
- a test asserts `effects.js` contains no hex or `rgb()` literal, closing the gap mechanically rather than by convention.

## Testing

| Test | Asserts |
|---|---|
| `scripts/effects-audit.test.mjs` | `effects.css` passes `auditCss` (no colour literal, tier-agnostic) |
| `scripts/effects-guards.test.mjs` | `effects.css` disables every animation under `prefers-reduced-motion: reduce`; disables all four families under `[data-sl-theme="high-contrast"]`; the busy aurora's orbit is inside the reduced-motion guard while its ring is not; `effects.js` contains no hex/`rgb()` literal |
| `scripts/catalog-audit.test.mjs` | *(existing)* the new catalog snippets carry no colour literals |
| `scripts/agent-docs-drift.test.mjs` | *(existing)* `agent/design-language.md` stays byte-identical after the L6 edit + regeneration |

`scripts/showcase-accent.test.mjs` reads `showcase/index.html` only and is unaffected by a new sibling page.

## Delivery slices

Each slice is independently reviewable and independently revertible.

### Slice 1 — Effects layer and demo page

`packages/ui-kit/effects.css`, `packages/ui-kit/effects.js` (Tiers 0 and 1), `showcase/effects.html`, `scripts/effects-audit.test.mjs`, `scripts/effects-guards.test.mjs`. Package `exports` and `files` gain the two new entries.

The demo page ships in the same slice deliberately: an effects layer cannot be reviewed by reading its CSS. The page shows every common component in its declension, with the tier and the active kill switches stated on the page in the house's mono structural labels — it documents its own state rather than asserting a look.

Status on merge: `showcase/effects.html` → **PoC implemented (not delivered)**; `effects.css`/`effects.js` → **Delivered** at 0.8.0.

### Slice 2 — Promotion into the design-system contract

`docs/design-language.md` gains **L6 — Effects & material** plus the effect-budget rule; `npm run gen:tokens` regenerates `packages/ui-kit/agent/design-language.md`. `agent/substrate-matrix.json` gains the rows below; `agent/catalog.md` + `catalog.json` gain the four effect entries; `agent/HANDOFF.md` records what `sl-audit` cannot check about effects. `packages/ui-kit/package.json` → `0.8.0`.

```json
"l6-glass":         { "IDE": "N/A", "App": "A", "Page": "R", "Term": "N/A" },
"l6-aurora":        { "IDE": "N/A", "App": "A", "Page": "R", "Term": "N/A" },
"l6-liquid":        { "IDE": "N/A", "App": "A", "Page": "A", "Term": "N/A" },
"l6-glitch":        { "IDE": "N/A", "App": "A", "Page": "A", "Term": "N/A" },
"l6-effect-budget": { "IDE": "N/A", "App": "R", "Page": "R", "Term": "N/A" }
```

The `HANDOFF.md` addition is the substantive part: `sl-audit` can check that `effects.css` uses no literal, but it cannot check that a surface **used the right family for the right meaning** (Decision 1), **respected the budget** (Decision 5), or **kept the focus ring** — those join the existing judgement list.

### Slice 3 — WebGPU liquid field

`packages/ui-kit/effects-gpu.js` + the WGSL template string, `vgpu` as an `optionalDependency`, `showcase/effects.html` extended to report which tier actually resolved. Package version → `0.8.1` or `0.9.0` depending on whether `mountGpu` lands as a new export in Slice 1's API surface (it does — so `0.8.1`, patch, since Slice 1 already publishes the export as a documented no-op returning `false`).

## Risks

| Risk | Handling |
|---|---|
| Conic-gradient borders and masked rings repaint on every frame while swept | `will-change` is set only while the aurora is active, and the budget caps ambient auroras at one |
| `mix-blend-mode` on the GPU canvas interacting with the sticky header's `backdrop-filter` | canvas sits below `--sl-z-overlay`; verified against the showcase header in Slice 3 |
| Glass edge invisible inside an inversion band | already-documented `--slc-border` remap at the band; the effects layer adds no new instance of the pitfall |
| An adopting product enables all four families everywhere | Decision 1 + Decision 5 are the written defence; the judgement half lands in `HANDOFF.md` so the auditing agent enforces it |
| `vgpu` is at `0.3.x` and pre-1.0 | it is optional and dynamically imported behind a `try`/`catch`; a breaking change degrades the page to Tier 1 rather than breaking the build |
