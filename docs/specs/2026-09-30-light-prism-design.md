---
slug: 2026-09-30-light-prism-design
title: Light Prism — a playful, colourful light theme
status: accepted
createdAt: 2026-09-30
---
> **What this file is:** the design contract for turning the kit's light theme into **Prism**: a clean cool-white ground on which colour arrives as light — a shared six-hue spectrum on effects, hairline rims and a few opt-in ornaments — while each product keeps its one accent for meaning.
> **Audience:** the owner (approves the design), engineers and agents implementing it, reviewers.
> **Owner:** marcellobarile.
> **Companion files:** `docs/plans/2026-09-30-light-prism.md` (the implementation plan, written after this spec is approved); `docs/design-language.md` (the grammar this spec amends, see §Design-language amendments); `lab/light-playful.html` (the throwaway probe the direction was chosen from, git-ignored, column C).

Status vocabulary: **Shipped** = merged and published to npm. Nothing in this file is shipped yet.

Terms: **WCAG** = Web Content Accessibility Guidelines; "AA" is its 4.5:1 contrast floor for body text and 3:1 for large text. **OKLab** = the perceptual colour space the palette tests measure distance in. **Tier A / Tier B** = the two theme-adoption patterns in `docs/design-language.md` Decision 1 (A: the product sets `data-sl-theme` and uses the kit's theme files; B: the product keeps its own `[data-theme]` colour layer whose values must equal kit tokens).

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

A light-theme screen built from the kit reads as bright and colourful with no markup change, and a dark or high-contrast screen renders exactly as on 0.20.1.

## Non-goals

- **Dark and high-contrast themes.** Their look is untouched. Their own contrast gaps, if any, are a separate change.
- **Per-product spectra.** The spectrum does not tilt toward a product's accent (option rejected 2026-09-30).
- **Glass at rest.** A glass element stays quiet until the pointer arrives — the 0.20.1 contract, guarded by `effects-guards.test.mjs` ("a glass element at rest is quiet"). Prism colours the light that arrives, not the resting state.
- **Goo, liquid, pillars.** Goo and liquid paint with their members' own fills, which change with the ground anyway; the pillars' light branch (ink curtains on paper) stays.
- **A new accent hue.** Amber is deepened, not replaced; the other products in the accent registry are untouched.
- **Brand assets.** `assets/sondalab-avatar-paper.svg` and `scripts/gen-logo.py` keep the cream: the logo is not the theme.

## The mechanism

The light theme defines the spectrum. Dark and high-contrast reset it to `initial` (the guaranteed-invalid value), so a dark region nested inside a light page does not inherit it. Every consumer reads it through `var()` with a fallback to what it paints today:

```css
/* themes/light.css — generated */
--sl-spectrum-0: #FF4D6D;       /* … -5 */
--sl-spectrum-ink-0: #D6264A;   /* … -4 */

/* themes/dark.css, themes/high-contrast.css — generated */
--sl-spectrum-0: initial;       /* … every spectrum property */

/* consumer */
--slfx-beam: var(--sl-spectrum-0, var(--slfx-accent-vivid));
```

- Light: the spectrum is defined, so it wins. Dark / high-contrast: invalid, so the fallback — today's value — wins.
- No `[data-sl-theme]` selector is added to `effects.css` or `components.css`. This keeps the effects layer's contract ("a derivation, not a theme branch", `effects.css:387`).
- A property built from the spectrum (e.g. a rim gradient) is itself invalid wherever a stop is invalid, so `var(--slc-rim, none)` paints nothing in dark without a second switch.
- A Tier-B product opts in by declaring the eleven `--sl-spectrum-*` values in its light layer; value-equality with `sondalab.tokens.json` keeps it compliant.
- JavaScript effects read the same properties through the existing `roleColour()` probe (`colour.js`), which resolves fallbacks.
- **Inversion band on light** (`sl-invert`, an ink block): it inherits the spectrum, so effects inside it are spectral too. Kept (owner, 2026-09-30).

## Tokens (`sondalab.tokens.json`)

### Light theme ground and ink

| Token | Today | Prism | On canvas |
|---|---|---|---|
| `bg-canvas` | `#ECE4D4` | `#F4F4F8` | — |
| `bg-surface` | `#F6F1E6` | `#FAFAFC` | — |
| `bg-surface-raised` | `#FFFFFF` | `#FFFFFF` | — |
| `bg-overlay` | `rgba(21,33,31,0.4)` | `rgba(28,29,34,0.4)` | — |
| `border-subtle / default / strong` | `rgba(21,33,31, .09/.16/.28)` | `rgba(28,29,34, .09/.16/.28)` | — |
| `text-primary` | `#15211F` | `#1C1D22` | 14.9:1 |
| `text-secondary` | `#475754` | `#454857` | 8.3:1 |
| `text-muted` | `#6E7B78` (3.5:1) | `#5F6374` | 5.4:1 |
| `accent.light.default` | `#B56A0C` (3.8:1) | `#9A5300` | 5.3:1; white on it 5.8:1 |
| `accent.light.depth` | `#14606C` | unchanged | — |
| `shadow.light.*` and the shared `:root` shadow (documented as "the light ramp") | ink `21,33,31` | ink `28,29,34`, same alphas | — |

**Moved during implementation (2026-09-30):** the ink was specified as `#13141C`; the glass glint mirrors the ink's lightness (`1.2 − L`), and at L 0.19 with a blue cast the glint fell outside sRGB, so the ink is the more neutral `#1C1D22` (L 0.23, chroma 0.010). Status and code palettes keep their values; the existing `palette-contrast` test re-proves them on the new ground.

**Literals that follow the tokens** (same commit): the fallbacks in the `components.css` `:root` role block, `agent/accent-registry.json` (default light accent), and the contrast figures quoted in `effects.css` / `glass.css` comments. The alphas behind those figures (glass tint 34% → 4.94:1, primary 72% share → 5.67:1, ghost label 4.24 → 5.19) were tuned on cream and are **re-measured** on `#F4F4F8`, not just renumbered. `sl-audit.test.mjs` fixtures keep the old hexes: they test the audit, not the theme.

### Spectrum (new, light only)

- **`--sl-spectrum-0..5`** — the light. Rose `#FF4D6D`, orange `#FF9F1C`, yellow `#FFD60A`, teal `#2EC4B6`, blue `#3A86FF`, violet `#8338EC`. Used where colour is glow (aurora bloom, press light, haze). No contrast requirement: never text, never the only carrier of a meaning.
- **`--sl-spectrum-ink-0..4`** — the same wheel darkened, used wherever the spectrum must be *seen* against white at 1px or as dots: rims, glass fringe, glitch channels, halftone dots, spectral text. Each ≥ 3:1 on canvas, surface and raised (the yellow light stop is 1.4:1 and would vanish; the ink wheel has no pure yellow). Starting points, fixed by the contrast test during implementation: `#D6264A`, `#B85A00`, `#0B857A`, `#2A62D8`, `#7A2FE0`.

Emitted from a new top-level `spectrum.light` block: values into `themes/light.css`, `initial` resets into the other theme files.

### Chart ramp (`viz.light`)

The probe's brighter ramp, tuned so every hue clears the existing 3:1 floor and the 0.08 OKLab pairwise distance. Shipped: `#E0405E`, `#2F6FE0`, `#0E958A`, `#D26A00`, `#7A35E0`, `#2E8540`, `#A57C00`, `#C93FC4` (yellow darkened from the probe's `#FFD60A`; slot 5 moved from `#08875F`, 0.067 OKLab from the teal).

## Effects (`effects.css`)

| Effect | Today (light) | Prism |
|---|---|---|
| Aurora arc | accent-vivid along, hue +180° / +150° companions, depth-vivid at the tails | a conic sweep through `spectrum-0..5` |
| Aurora bloom | accent-bloom 44% / depth-bloom 33% | spectrum stops at the same alphas |
| Aurora `--rim`, `--linear` | depth companion / depth + accent gradient | spectrum-ink gradient |
| Aurora busy | accent only | unchanged — busy is a *state*, and state is the accent's job |
| Press light | light pole 82% + accent | light pole 82% + a spectrum stop |
| Glitch channels | accent / depth | `spectrum-ink-0` / `spectrum-ink-3` (rose / blue, the classic split) |

Each row is one `var(--sl-spectrum…, <today's expression>)`. The sweep's `hue-rotate(±16deg)` drift stays. Aurora hosts copy their bloom and beam properties onto the seated glow as inline style (`effects.js:741-777`); the spectral values are set on the host, where that copy reads them.

**Glass is not in this table.** Its pointer light is the neutral specular edge (`--slfx-spec-light` / `--slfx-spec-shade`); the accent/depth fringe it once had was retired on 2026-09-24 (`effects.css:855-873`), and its lens already splits the backdrop into RGB channels. Glass stays neutral; Prism reaches it only through the aurora and live light it can carry.

## Effects (JavaScript)

- **Live light** (`live-light.js`) reads two new role properties, `--slfx-light-a` / `--slfx-light-b`, declared in `effects.css` as `var(--sl-spectrum-0, var(--slc-accent))` / `var(--sl-spectrum-4, var(--slfx-depth))`, instead of the accent roles directly, for `data-sl-fx-live="run"` (two bodies of light: an agent working). `busy` keeps reading `--slc-accent` for both — busy is a state.
- **Halftone** (`halftone.js`): when `--sl-spectrum-ink-0` resolves on the canvas, dots are filled with one canvas `linearGradient` across the scene through `spectrum-ink-0..4`; otherwise today's single `currentColor` ink. One fill call, no per-dot colour, so `halftone-core` and its SVG export are unchanged. An author forces the single ink with `data-sl-ink="mono"`.

## Base components (`components.css`)

### Rainbow rims

Cards (`sl-card`), the primary button (`sl-btn--primary`) and text fields (`sl-field__input`) get a 1px spectrum-ink hairline.

- Two role properties in the `:root` role block: `--slc-rim: linear-gradient(120deg, var(--sl-spectrum-ink-0), …, var(--sl-spectrum-ink-4))`, and `--slc-rim-edge: color-mix(in srgb, var(--sl-spectrum-ink-0) 0%, transparent)` — transparent where the spectrum exists. Both are invalid wherever the spectrum is reset.
- Painted through the host's own border box: `--slc-rim-layers` (declared on the host) is a fill image of the host's own colour over the padding box, above the rim across the border box; `background-image: var(--slc-rim-layers, none, none)`; `border-color: var(--slc-rim-edge, <today's border>)`. Where the spectrum is reset the image is two empty layers — two, so the background colour keeps the border-box clip it always had — and the border is today's. Dark and high-contrast pages were diffed against 0.20.1: 0 differing pixels.
- States keep their cues: the primary's hover/active move the fill layer with the background colour (`--slc-rim-fill`); a field's hover and focus recolour its border, which covers the rim while they last.
- **An effect host keeps its effect's edge.** `effects.css` (which may name components; `components.css` may not name effects) resets `--slc-rim` and `--slc-rim-edge` to `initial` on glass, aurora, press, glitch, liquid and goo-member hosts, and so on everything they contain.
- A `background:` shorthand reset (the site un-buttons its hero button this way) clears the rim with the fill. A product that sets only `background-color` sees it covered by the fill layer in light.

*Changed during implementation:* this spec first placed the rim on a `::before` ring. That would out-specify the effects' own `::before` rules (0,2,1 against 0,1,1) and could not exclude effect hosts without `components.css` naming them, which a guard forbids. The border-box technique also gives bare inputs a rim, where the ring needed the `sl-field__control` wrapper.

### New opt-in classes

- **`sl-haze`** — on a section: a soft, blurred field of three spectrum stops behind the content (a `::before` at `z-index: -1` in an isolated stacking context, `pointer-events: none`). Transparent where the spectrum is reset. Static.
- **`sl-spectral`** — on a word or phrase inside a display-size heading (`sl-anchor`, `h1`, `h2`): text painted with `spectrum-ink-0..4` through `background-clip: text`. Plain `currentColor` where the spectrum is reset and under `forced-colors`.

Both are catalogued (`agent/catalog.md` / `catalog.json`) with the rule: at most one of each per screen, never on body text.

## Design-language amendments (`docs/design-language.md` + its byte-identical agent copy)

- **Decision 2:** add "the spectrum is not an accent" beside the one-accent rule: shared, light-only, never carries state or meaning; the accent does.
- **Decision 3:** add the spectrum as the third shared non-accent palette next to viz and code; fix the stale line saying viz is theme-independent.
- **Glass / aurora bullets:** state the light-theme behaviour from §Effects.
- **Accent registry:** default light accent `#B56A0C` → `#9A5300`.
- **Light ground:** "paper" means cool white in the light theme; the pole wording ("on paper between white and a mid grey") holds.
- **New-token policy:** record the owner's override — the spectrum is promoted on the owner's call (2026-09-30), not on the ≥2-products rule.

## Consumer impact

| Consumer | Adoption | What changes on bump |
|---|---|---|
| sondalab-site | Tier A (`:root[data-sl-theme='light']`, e.g. `src/components/Thesis.astro:63`) | whole light theme; its six halftone canvases turn spectral |
| spexr | Tier A (design-language Decision 1) | whole light theme; the photo backdrop's halftone turns spectral |
| daos (`docs/daos-landing.html`), introspect (`web/src/theme.css`) | Tier B, pinned to today's light values | **their `sl-audit` fails** on the old hexes once they bump — see §Decisions on the open points |
| local-agents | Tier B | no old light literal found; unaffected |

## Testing

| Test | What it proves |
|---|---|
| `palette-contrast` (extended) | light `text-muted` ≥ 4.5, `accent.default` ≥ 4.5 as text, `text-on-accent` on accent ≥ 4.5, `spectrum-ink-*` ≥ 3 — on canvas, surface, raised; existing status / code / viz checks re-run on the new ground |
| `theme-isolation` (new) | light declares every spectrum property; dark and high-contrast reset each to `initial` and are otherwise byte-identical to 0.20.1 (fixtures `scripts/fixtures/theme-*-0.20.1.css`); every spectrum read in `effects.css` has a fallback (`effects-guards`); the test evaluator treats `initial` as guaranteed-invalid (`effects-gamut`) |
| `effects-gamut`, `effects-guards`, `effects-audit` (updated) | the spectrum joins the allowed colour set; the glitch / live-light source pins move to the new roles, whose fallbacks are the old ones |
| `halftone` (extended) | spectrum ink paints with a gradient; `mono` and dark paint `currentColor`; export unchanged |
| `components-token-scope` | `--slc-rim` reads theme tokens only in the role block |
| `types-drift`, `public-surface`, `agent-docs-drift` | new classes and properties are declared and documented |
| Visual | headless captures of the showcase: light before/after, dark before/after (must match) |

## Release

`@sondalab/ui-kit` **0.21.0** (minor: new tokens and classes; light-theme values change). `palette-py` bumped in the same PR per the new-token policy (`AGENTS.md`).

## Decisions on the open points (owner, 2026-09-30)

1. **Tier-B products after the bump: no legacy allowlist.** daos and introspect fail `sl-audit` on the old light values until migrated, in follow-up PRs in their repos (no backwards-compat shim in the audit).
2. **Spectrum inside the ink band on light: kept.** Effects inside `sl-invert` stay spectral, as in the probe.

## Risks

- **Everyone's light theme changes at once.** That is the request; `theme-isolation`, the effects fallback guard and a pixel diff of dark and high-contrast pages against 0.20.1 (0 px) guard the rest.
- **Product CSS on rim hosts.** A product that sets only `background-color` on a card, primary button or field sees it covered by the rim's fill layer in light. Noted in the README; the rim can be removed per element with `--slc-rim: none`.
- **Nested theme regions.** A light region inside a dark page gets spectral effects (they read the spectrum on the host) but not the rims, and a dark region inside a light page keeps the light rims: like every `--slc-*` role, the rim resolves on `:root`. Pre-existing for all roles (a card's surface behaves the same on 0.20.1).
- **Brand drift.** Cream paper was a family trait. The design-language amendment makes the new rule explicit, so reviewers don't flag cool white as a defect.
