---
slug: 2026-09-30-light-prism-design
title: Light Prism — a playful, colourful light theme
status: draft
createdAt: 2026-09-30
---
> **What this file is:** the design contract for turning the kit's light theme into **Prism**: a clean cool-white ground on which colour arrives as light — a shared six-hue spectrum on effects, hairline rims and a few opt-in ornaments — while each product keeps its one accent for meaning.
> **Audience:** the owner (approves the design), engineers and agents implementing it, reviewers.
> **Owner:** marcellobarile.
> **Companion files:** `docs/plans/2026-09-30-light-prism.md` (the implementation plan, written after this spec is approved); `docs/design-language.md` (the grammar this spec amends, see §Design-language amendments); `lab/light-playful.html` (the throwaway probe the direction was chosen from, git-ignored, column C).

Status vocabulary: **Shipped** = merged and published to npm. Nothing in this file is shipped yet.

## Problem

The owner wants the light theme to be *playful, vibrant, happy, colourful*. Today it is the opposite by design: cream paper (`#ECE4D4`), green-black ink, one amber accent, and effects that paint in the accent and its teal depth companion. Two of its values also fail WCAG AA as text on the canvas: muted text (`#6E7B78`, 3.5:1) and the amber accent (`#B56A0C`, 3.8:1). Nothing tests either.

## Decisions taken (owner, 2026-09-30)

Chosen in a side-by-side probe of four directions (Sunlit, Confetti, **Prism**, Riso):

1. **Accent + spectrum.** Each product keeps its one accent for meaning (links, focus, selected tab, checked switch, tags, primary fill). The spectrum is shared atmosphere, identical in every product, and never marks state.
2. **Cool near-white ground.** The warm paper goes in the light theme.
3. **Amber stays the default accent**, deepened to pass 4.5:1 as text.
4. **All four Prism elements ship:** spectral effects, rainbow rims on base components, haze + spectral text, a brighter chart ramp.
5. **Mechanism: light-theme tokens with a fallback** (approach 1 of 3). Rejected: `[data-sl-theme="light"]` branches (Tier-B products never match them, and branches scatter) and a separate `data-sl-prism` switch (not what was asked; doubles the test matrix).
6. **One PR**, one commit per slice.

## Goal

A light-theme screen built from the kit reads as bright and colourful with no markup change, and a dark or high-contrast screen renders pixel-identical to 0.20.1.

## Non-goals

- **Dark and high-contrast themes.** Untouched. Their contrast gaps (if any) are a separate change.
- **Per-product spectra.** The spectrum does not tilt toward a product's accent (option rejected 2026-09-30).
- **Goo, liquid, pillars.** Goo and liquid paint with their members' own fills, which already change with the ground; the pillars' light branch (ink curtains on paper) stays as it is.
- **A new accent hue.** Amber is deepened, not replaced; the accent registry's other products are untouched.

## The mechanism

The light theme defines the spectrum; dark and high-contrast do not. Every consumer reads it through `var()` with a fallback to what it paints today:

```css
/* themes/light.css — generated */
--sl-spectrum-0: #FF4D6D;  /* … -5 */
--sl-spectrum-ink-0: …;    /* … -4 */

/* consumer */
--slfx-beam: var(--sl-spectrum-0, var(--slfx-accent-vivid));
```

- Light: the spectrum is defined, so it wins. Dark / high-contrast: undefined, so the fallback — today's value — wins, byte-for-byte.
- No `[data-sl-theme]` selector is added anywhere. This keeps the effects layer's existing contract ("a derivation, not a theme branch", `effects.css:387`).
- A Tier-B product (own `[data-theme]` layer) opts in by declaring the eleven `--sl-spectrum-*` values in its light layer; value-equality with `sondalab.tokens.json` keeps it compliant.
- JS effects read the same properties through the existing `roleColour()` probe, which already resolves fallbacks.

## Tokens (`sondalab.tokens.json`)

### Light theme ground and ink

| Token | Today | Prism | On canvas |
|---|---|---|---|
| `bg-canvas` | `#ECE4D4` | `#F4F4F8` | — |
| `bg-surface` | `#F6F1E6` | `#FAFAFC` | — |
| `bg-surface-raised` | `#FFFFFF` | `#FFFFFF` | — |
| `bg-overlay` | `rgba(21,33,31,0.4)` | `rgba(19,20,28,0.4)` | — |
| `border-subtle / default / strong` | `rgba(21,33,31, .09/.16/.28)` | `rgba(19,20,28, .09/.16/.28)` | — |
| `text-primary` | `#15211F` | `#13141C` | 16.7:1 |
| `text-secondary` | `#475754` | `#454857` | 8.3:1 |
| `text-muted` | `#6E7B78` (3.5:1) | `#5F6374` | 5.4:1 |
| `accent.light.default` | `#B56A0C` (3.8:1) | `#9A5300` | 5.3:1; white on it 5.8:1 |
| `accent.light.depth` | `#14606C` | unchanged | — |
| `shadow.light.*` | ink `21,33,31` | ink `19,20,28`, same alphas | — |

Status and code palettes keep their values; the existing `palette-contrast` test re-proves them on the new ground (they have more contrast on a lighter canvas, not less).

### Spectrum (new, light only)

- **`--sl-spectrum-0..5`** — the light. Rose `#FF4D6D`, orange `#FF9F1C`, yellow `#FFD60A`, teal `#2EC4B6`, blue `#3A86FF`, violet `#8338EC`. No contrast requirement: it is never text and never the only carrier of a meaning.
- **`--sl-spectrum-ink-0..4`** — the same wheel darkened for text (spectral text only). Each ≥ 3:1 on canvas, surface and raised (the large-text threshold; spectral text is restricted to display sizes). Values are fixed during implementation by the contrast test; starting points: `#D6264A`, `#B85A00`, `#0B857A`, `#2A62D8`, `#7A2FE0`.

Emitted into `themes/light.css` only, from a new top-level `spectrum.light` block (the `code` pattern: per theme, absent themes emit nothing).

### Chart ramp (`viz.light`)

The probe's brighter ramp, tuned so every hue clears the existing 3:1 floor and 0.08 OKLab pairwise distance: starting points `#E0405E`, `#2F6FE0`, `#0E958A`, `#D26A00`, `#7A35E0`, `#08875F`, `#A57C00`, `#C93FC4` (yellow darkened from the probe's `#FFD60A`, which is 1.4:1).

## Effects (`effects.css`, CSS only)

| Effect | Today (light) | Prism |
|---|---|---|
| Aurora arc | accent-vivid along, hue+180°/+150° companions, depth-vivid at the tails | a conic sweep through `spectrum-0..5` |
| Aurora bloom | accent-bloom 44% / depth-bloom 33% | spectrum stops at the same alphas |
| Aurora `--rim`, `--linear` | depth companion / depth+accent gradient | spectrum gradient |
| Aurora busy | accent only | unchanged — busy is a *state*, and state is the accent's job |
| Glass pane hairline | accent fringe on one side, depth on the other | spectrum fringe (dispersion reads as a full rainbow) |
| Glass resting ring `--slfx-s0..s3` | `transparent` (dead) | spectrum stops at low alpha: glass at rest finally carries its "pastel flecks" |
| Press light | light pole 82% + accent | light pole 82% + a spectrum stop |
| Glitch channels | accent / depth | `spectrum-0` / `spectrum-4` (rose / blue, the classic split) |

Each row is one `var(--sl-spectrum-N, <today's expression>)`. The sweep's `hue-rotate(±16deg)` drift stays.

## Effects (JS)

- **Live light** (`live-light.js`) reads `--slfx-light-a` / `--slfx-light-b` (new role properties in `effects.css`, defaulting to `--slc-accent` / `--slfx-depth` and set to spectrum stops where the spectrum exists) instead of the two accent roles directly. Busy keeps `--slc-accent`.
- **Halftone** (`halftone.js`) gains a spectrum ink: when the canvas's computed `--slfx-halftone-ink` is `spectrum` (the light-theme default; any other value or absent = today's `currentColor` ink), dots are filled with one canvas `linearGradient` across the scene through `spectrum-0..5`. One fill, no per-dot colour, so `halftone-core` and its SVG export are unchanged. An author forces mono with `style="--slfx-halftone-ink: mono"`.

## Base components (`components.css`)

### Rainbow rims

Cards, text fields (`sl-field__input`) and the primary button get a 1px spectrum hairline.

- A role variable `--slc-rim` in the `:root` role block: `linear-gradient(<angle>, var(--sl-spectrum-0) …)` where the spectrum exists; where it does not, the rim is the element's existing border colour, so dark/HC paint what they paint today.
- Painted as a second background layer on `border-box` under a `padding-box` fill, with the border itself transparent. Radius is respected (a `border-image` would square it).
- State changes that today recolour the border (field hover/focus, button hover/active) are re-expressed on the fill or the ring, not the border, so no state loses its cue.
- A glass or aurora host keeps its effect's own edge: the effect's declarations win on the elements it binds, as today.

This is the riskiest part of the change: it touches the painting model of three components used everywhere. Its commit is separate and last-but-one so it can be dropped from the PR without touching the rest.

### New opt-in classes

- **`sl-haze`** — on a section: a soft, blurred field of three spectrum stops behind the content (a `::before`, `z-index: -1`, `pointer-events: none`, isolated). Where the spectrum is undefined, the layer is transparent. Reduced motion: it never moves anyway.
- **`sl-spectral`** — on a word or phrase inside a display-size heading (`sl-anchor`, `h1`, `h2`): text painted with `spectrum-ink-0..4` through `background-clip: text`. Where the spectrum is undefined, it is plain `currentColor`. Forced-colors: plain text.

Both are catalogued (`agent/catalog.md` / `catalog.json`), with the rule: one of each per screen at most, never on body text.

## Design-language amendments (`docs/design-language.md` + its agent copy)

- **Decision 2:** add "the spectrum is not an accent" beside the one-accent rule: shared, light-only, never carries state or meaning; the accent does.
- **Decision 3:** add the spectrum as the third shared non-accent palette next to viz and code; fix the stale line saying viz is theme-independent.
- **Glass / aurora bullets:** state the light-theme behaviour from §Effects.
- **Accent registry:** default light accent `#B56A0C` → `#9A5300`.
- **Light ground:** "paper" means cool white in the light theme; the ink pole wording ("on paper between white and a mid grey") holds.
- **New-token policy:** record the owner's override — the spectrum is promoted on the owner's call (2026-09-30), not on the ≥2-products rule.

## Testing

| Test | What it proves |
|---|---|
| `palette-contrast` (extended) | light `text-muted` ≥ 4.5, `accent.default` ≥ 4.5 as text, `text-on-accent` on accent ≥ 4.5, `spectrum-ink-*` ≥ 3 — on canvas, surface, raised; existing status/code/viz checks re-run on the new ground |
| `dark-unchanged` (new) | `themes/dark.css` and `themes/high-contrast.css` are byte-identical to 0.20.1's, and the effects cascade evaluated with the dark theme resolves the same values as before |
| `effects-gamut`, `effects-guards`, `effects-audit` (updated) | the spectrum joins the allowed colour set; the glitch/live-light source pins are updated to the new roles with the old roles as fallback |
| `halftone` (extended) | `spectrum` ink paints with a gradient; `mono` and absent paint `currentColor`; export unchanged |
| `components-token-scope` | `--slc-rim` reads theme tokens only in the role block |
| `types-drift`, `public-surface`, `agent-docs-drift` | the new classes and properties are declared and documented |
| Visual | headless captures of the showcase in light (before/after) and dark (must match before) |

## Release

`@sondalab/ui-kit` **0.21.0** (minor: new tokens and classes; light-theme values change). `palette-py` bumped in the same PR per the new-token policy (`AGENTS.md`). The site and spexr pick it up with a normal version bump after merge; both are Tier A on light, so they change without markup edits.

## Risks

- **Everyone's light theme changes at once.** That is the request; the dark theme's byte-identity test is the guard for the rest.
- **Rims on base components** can collide with product CSS that sets `background` on a card or field: that product would lose the rim, not break. Acceptable; noted in the README.
- **Brand drift.** Cream paper was a family trait. The design-language amendment makes the new rule explicit so reviewers don't flag cool white as a defect.
