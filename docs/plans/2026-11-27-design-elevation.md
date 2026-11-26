---
slug: 2026-11-27-design-elevation
title: Design elevation from external references
status: draft
createdAt: 2026-11-27
---

# Design elevation from external references

> **What this file is:** the plan to raise the quality of `@sondalab/ui-kit` with four external references, without losing the brand traits the kit already has.
> **Owner:** marcellobarile.
> **Companion files:** `docs/design-language.md` (the grammar, L1–L6), `docs/specs/2027-improve-aesthetics.md` (reference cards, method), `packages/ui-kit/agent/` (catalog, workflows, `sl-audit`).

## Principle

The references give **method**, not **style**. Every borrowed pattern goes through the flavour filter below. A pattern that survives is redrawn in the Sondalab idiom: pixel cells, dither, hairlines, Geist Pixel, depth as lightness.

## Sources

| Source | Take | Status in this repo |
|---|---|---|
| https://github.com/Jakubantalik/transitions.dev | Usage-keyed motion tokens (duration, ease, distance, scale), decision rules per UI element, an audit that maps a hard-coded value to a token by usage, not by number. | New. L4 has curves and three speeds, no per-component recipes, no distance or scale tokens. |
| https://github.com/Jakubantalik/Libraries.dev | Thinking orbs, img-fx (pixel mosaic settles into the photo), voice glow, "every library ships as a prompt". | Partly known. L6 already cites it for scale. Metal, border beam and gooey already have cards in `2027-improve-aesthetics.md`. |
| https://academy.claude.com/use-cases/elevate-claudes-design-using-skills | Method: interrogate each choice, show functional then elevated, apply 1–2 techniques strongly, check restraint, check uniqueness. | New. The page does not publish its technique catalog. Do not depend on it. |
| https://github.com/VoltAgent/awesome-claude-design | The `DESIGN.md` format (token, rule and reason in one agent-readable file). The 68 brand files act as negative references. | New. |

## Licence constraints

- transitions.dev forbids redistribution of its library as a competing kit. Take the method only. Derive every value and recipe again. Copy no snippet.
- Libraries.dev packages are MIT. Its models and Pro presets are not. Cite public pages only.

## Flavour filter

| Borrowed pattern | Verdict | Rule |
|---|---|---|
| Usage-keyed motion tokens, decision rules, usage-based audit | Keep (method) | Gap in L4 |
| Cross-blur in text swap, icon swap, panel reveal, skeleton reveal | Adapt: dither dissolve on the 2px cell (owner, 2026-11-27) | Direction D identity |
| Modal and dropdown scale-in, toast rise | Adapt: `--sl-motion-enter`, `--sl-motion-spring` | L4 |
| Avatar-group hover lift, card hover tilt | Reject | L2: hover never lifts |
| Texts reveal, hero stagger | Reject in the kit. A product may own it. | L4: no page-load choreography |
| Bot avatars with faces | Reject | Owner ruling: no figurative art |
| "Agent is generating" skeleton | Adapt: dither-threshold reveal | `dither-core.js` |
| img-fx mosaic → photo | Adapt: Bayer or halftone settle | `dither-core.js`, `halftone-core.js` |
| Thinking orbs | Adapt: pixel matrix in Geist Pixel cells, bound to `aria-busy` | L6: the aurora renders state |
| Generic dev-tool looks in DESIGN.md files | Reject. Use as the "do not converge" list. | DS direction: dev-tool-first |

## Owner decisions (2026-11-27)

1. The dither dissolve replaces the blur in every motion recipe.
2. New motion tokens live in ui-kit CSS only. `sondalab.tokens.json` does not change, so no palette-py release.
3. The "agent is working" family is in scope, after phases 1–4.
4. No copy-prompt button on showcase cards.
5. The plan aims at the resting look too, not only motion and tooling. A trait from the references that conflicts with the pixel and dither direction (Direction D) is dropped, not adapted.

## Process

- Every visual phase opens with a lab page on a real consumer page, with 1–2 alternatives. The owner picks.
- Work runs through `ads work`. One integration branch, one short PR per slice, one merge to `main`.
- Opus writes each slice. Sonnet reviews each slice, once.
- Any new skill is self-contained and names no other skill.

## Phases

### Phase 0 — Look study (1 slice)

1. Capture https://transitions.dev/, https://libraries.dev/ and the showcase in Chrome, both themes, at the same zoom.
2. Name the 2–3 resting-look traits that make the references feel crafted (for example: light, material, density, scale of detail). Mark each trait as verified from a capture.
3. Drop each trait that conflicts with Direction D. Record the rule it conflicts with.
4. Build one lab page that applies the remaining traits to a real Sondalab page, with one alternative. The owner picks. The pick feeds phases 1 and 3.

#### Phase 0 findings (2026-11-27, measured in Chrome)

Both sites share one card recipe (same author). Captures: `docs/references/assets/librariesdev-bezel-cards.png`, `docs/references/assets/librariesdev-blueprint-hero.png`.

| Trait | Measured | Verdict |
|---|---|---|
| Bezel card | Frame r24 `#181818`, 12px inset, stage r14 `#131313`, page `#121212`. | Keep. Redrawn on kit radii: stage r6 + inset 8 = frame r14. |
| Edge as alpha hairlines | No border. Five inset shadows: 1px top at 4% white, 1px rings at 6–7%, 1px bottom at 6% black. | Keep. Same idea as L2 "depth is lightness". |
| Caption row | 13px/500 title, 13px muted line, 32px icon tile. | Keep. Icon tile carries a Geist Pixel index. |
| Blueprint overlay | Dot lattice, crop marks, mono note `130 × 130 t+1.20s`. | Keep. The note prints live measurements (L5). |
| Pill chips | Radius 40–999px. | Drop. L2: tags and chips are r6. |
| Inter, Saans | Fonts. | Drop. L1: Geist family. |
| Soft colour glow, blur | Hero and effect stages. | Drop. Owner decision 1. |

Lab page: `lab/look-bezel.html` (Today, A Bezel, B Bezel + blueprint, both themes).

**Owner pick (2026-11-27): A, Bezel.** The blueprint overlay is not adopted. Phase 1 records the bezel in `flavour.md`. The kit implementation of the bezel card is a new slice after phase 1. It rewrites the probe under the kit gates (lab/README.md) and does not copy it.

### Phase 1 — Flavour contract (1 slice)

Write `packages/ui-kit/agent/flavour.md`: about 12 brand traits (wordmark with accent period, mono eyebrows, hairline grid, depth as lightness, inversion band, dither hover, checker disabled, pixel controls, Geist Pixel numerals, four effect families with one meaning each, per-product accent, precise voice), and a "do not converge" list derived from the generic DESIGN.md files. Every later phase is gated on this file.

### Phase 2 — Generated DESIGN.md (2 slices)

1. Write a script that generates `packages/ui-kit/agent/DESIGN.md` from `sondalab.tokens.json`, `design-language.md` and `flavour.md`. Add a drift test.
2. Load the file into Claude Design. Diff the scaffold against the showcase. Add a rule for each place the scaffold looks generic.

### Phase 3 — Motion vocabulary (3 slices)

1. Lab page: dialog, toast, tooltip, tabs and segmented slide, disclosure, skeleton → content, each with the dither dissolve.
2. Add usage-keyed tokens (duration, distance, scale) to ui-kit CSS. Add the recipes for shipped components. A dropdown or menu is not shipped, so it is out of this slice. Extend L4 and `catalog.md`.
3. Add a usage-based motion check to `sl-audit`. Verified on 2026-11-27: about 10 ambient loops use literal durations. The other timings read `--sl-motion-*`.

### Phase 4 — Sondalab elevation procedure (2 slices)

Extend `workflows/author.md` with: interrogation questions keyed to L1–L6, a technique catalog of the kit's own families only, references from the showcase and the cards in `2027-improve-aesthetics.md`, and the steps functional → elevated → restraint check (effect budget) → uniqueness check (`flavour.md`).

### Phase 5 — "Agent is working" family (3 slices, new features)

1. Lab page with the three states.
2. Dither reveal for generated content, pixel thinking matrix bound to `aria-busy`.
3. Pixel-mosaic image loader on `dither-core.js` or `halftone-core.js`.

## Estimate

12 slices, about 24 agents. Phase 0 is a study. Phases 1–4 are restyling and tooling. Phase 5 is new features. Re-confirm if the estimate grows by more than 50%.
