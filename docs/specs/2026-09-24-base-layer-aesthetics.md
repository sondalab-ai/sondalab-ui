---
slug: 2026-09-24-base-layer-aesthetics
title: Base-layer aesthetics sweep
status: draft
createdAt: 2026-09-24
---

> **What this file is:** the design contract for the aesthetic sweep of the *base* layer of `@sondalab/ui-kit` — tokens (`sondalab.tokens.json` → `tokens.css`, `themes/*.css`) and `components.css` — and for rolling it out to the two consumers, sondalab-site and spexr.
> **Audience:** the owner (picks directions), engineers and agents working a slice, reviewers.
> **Owner:** marcellobarile.
> **Companion files:** `docs/specs/2027-improve-aesthetics.md` (the hub for the *effects* layer; its §Method is reused here, scaled down); `docs/design-language.md` (the human grammar); `docs/plans/2026-09-24-base-layer-aesthetics.md` (the implementation plan for this spec).
> **Order with the effects layer:** base first (this file), effects after, under the hub.

Status vocabulary: **Shipped** = merged and published to npm; **PoC implemented (not delivered)** = exists in `lab/` only.

## Problem

The brand layer reads as designed: Fraunces at display scale, tracked mono eyebrows, the amber/teal ground, the hero. The component layer, one scroll below it, reads as a generic SaaS kit. Measured on the showcase (2026-09-24):

1. **Stock palettes.** The status colours are Tailwind defaults (dark `#4ade80 #fbbf24 #f87171 #38bdf8`, light `#16a34a #d97706 #dc2626 #0284c7`). The categorical data-visualisation ramp `--sl-viz-0..7` is Material (`#b388ff #4dd0e1 #ffb74d …`). The syntax palette `--sl-code-*` is Atom One. None of the three is derived from the brand ground or accent.
2. **Generic depth.** `--sl-shadow-*` are neutral `rgba(0,0,0,…)`. On the teal-black dark ground and the warm paper light ground, a neutral black shadow looks grey and dirty rather than cast.
3. **A type scale that stops short.** `--sl-text-*` tops out at `2xl = 2rem`. Every display moment on the site and the showcase hand-rolls its own size, so the kit has no display step to offer.
4. **Stock silhouettes.** Button, field, select, card, badge and switch use the shapes every kit uses. The house signatures (hairline structure, mono uppercase labels, the single accent) stop at the section heading and do not reach the controls.

## Goal

The component layer carries the same identity the brand layer does, and it gets there through changed *values* and changed CSS, so the two consumers adopt it by bumping one dependency.

## Non-goals

- New components, or new modifiers beyond what a chosen direction strictly needs.
- The effects layer (`effects.css`, `glass.css`, the JavaScript and WGSL). It follows under the hub.
- The terminal palette (`terminal` in `sondalab.tokens.json`, `packages/palette-py/`). Untouched.
- High-contrast theme values. They exist to be maximal, not tasteful, and stay as they are.

## Contract that makes "bump the dependency" true

The consumers reach the kit only through CSS custom properties and `.sl-*` class names (verified 2026-09-24: sondalab-site imports the CSS files; spexr's `@spexr/ui-kit` `@import`s them and reads `--sl-status-*` through `var()` in `spexr-theme-contribution.ts`). So:

- **C-1 No removal.** No `--sl-*` token and no `.sl-*` class that exists at `0.10.1` disappears or is renamed. Additions are allowed.
- **C-2 No markup change.** A component renders correctly with the markup documented in `packages/ui-kit/agent/catalog.md` at `0.10.1`. A direction that needs a new element or attribute to look right is rejected at the contact sheet.
- **C-3 Enforced.** A new test, `scripts/public-surface.test.mjs`, snapshots every token name and `.sl-*` class shipped at `0.10.1` into `scripts/fixtures/public-surface.json` and fails if any is missing. Additions pass; the fixture is regenerated only by an explicit script flag.

## Method

The hub's two-loop method, one decision per *group* rather than per element (owner ruling, 2026-09-24):

1. For each slice, a contact sheet in `lab/base-<n>-<group>.html` renders **three** directions side by side, on both the dark and the light ground. Probes follow `lab/README.md`: hardcoded values allowed, nothing is imported into `packages/`.
2. The owner picks one (or a mix, named explicitly). Rejected directions get one line each in the slice log below; their probe code is deleted.
3. The winner is rewritten into `packages/ui-kit/` under every gate in §Gates.
4. The slice's commit carries before/after renders of the showcase section it touches, dark and light.

References to draw from (not copy): Linear, Vercel, Raycast, Stripe Docs, Resend, Swiss/International typography, editorial print.

## Slices

Each slice is one reviewable, revertible commit set on one branch. The token slices come first because every component reads them: the controls are judged in their final colours and depth.

### Slice 1 — Palette

Scope: `status-*` (light, dark), `viz-0..7`, `code-*` (light, dark).
Directions to probe, for example: (a) brand-derived hues at the ground's chroma, (b) a restrained set where only danger is chromatic, (c) print-ink hues (vermilion, ultramarine, olive, ochre).
Constraints:
- Status foreground on `bg-surface` and `bg-canvas`: contrast ratio ≥ 4.5:1 (Web Content Accessibility Guidelines 2 formula) in light and dark — the badge uses it as text.
- Viz colours: ≥ 3:1 against both canvases (non-text, WCAG 2 §1.4.11), and every pair distinguishable (Euclidean distance in the OKLab colour space ≥ 0.08) so eight series stay separable.
- Code colours: `fg`, `keyword`, `string`, `function` ≥ 4.5:1 on `bg-surface` and `bg-canvas`; `comment` ≥ 3:1. (The kit itself does not read `--sl-code-*`; consumers' editors and highlighters do.)
- Enforced by a new `scripts/palette-contrast.test.mjs`.

Baseline at `0.10.1` (measured 2026-09-24 with the WCAG 2 formula; this is an accessibility defect, not only an aesthetic one):

| Ground | Status (need 4.5) | Code, non-comment (need 4.5) | Viz (need 3) |
|---|---|---|---|
| light `bg-canvas` | 2.52 – 3.82, all fail | only `fg` and `keyword` pass | 1.37 – 2.73, all fail |
| light `bg-surface` | 2.83 – 4.29, all fail | `fg`, `keyword` pass | 1.54 – 3.06, 7 of 8 fail |
| dark `bg-canvas` | 7.17 – 11.89, pass | pass | 5.75 – 11.46, pass |
| dark `bg-surface` | 6.64 – 11.01, pass | pass | 5.33 – 10.62, pass |

Closest viz pair: OKLab distance 0.091.

Consequence for viz: one theme-independent ramp that clears 3:1 against both canvases must sit in a relative-luminance window of roughly 0.11 – 0.22, which leaves eight hues very little room. The sheet may therefore emit `--sl-viz-0..7` per theme from the theme files instead of `tokens.css`. The names do not change, so C-1 holds; `$viz-note` in `sondalab.tokens.json` is updated to say so.

### Slice 2 — Depth and shape

Scope: `shadow-sm/md/lg`, `radius-*`, border opacities, and additive type steps (`text-3xl`, `text-display`).
Shadows are tinted with the ground's hue instead of neutral black. Radius and border direction chosen at the sheet. Type additions only — existing steps keep their values unless the sheet rules otherwise.

### Slice 3 — Controls

Scope: `.sl-btn*`, `.sl-icon-btn*`, `.sl-field*`, `.sl-select`, `.sl-check*`, `.sl-radio*`, `.sl-switch*`, `.sl-segmented*`, `.sl-btn-group`, `.sl-pagination*`, `.sl-tabs__*`.
Silhouette, rest/hover/active/disabled states, and motion. Focus ring behaviour is fixed by `scripts/focus-ring.test.mjs` and does not change.

### Slice 4 — Surfaces and labels

Scope: `.sl-card*`, `.sl-callout*`, `.sl-dialog*`, `.sl-badge*`, `.sl-tag*`, `.sl-empty*`, `.sl-stat*`, `.sl-table*`, `.sl-tooltip`, `.sl-kbd`, `.sl-code`.

### Slice 5 — Release and rollout

- Bump `@sondalab/ui-kit` to `0.11.0` (minor: additions only, per C-1), one PR, published on merge.
- sondalab-site: bump to `^0.11.0`, build, render before/after of every page, fix only what the bump breaks.
- spexr: bump `packages/ui-kit` to `^0.11.0`, build, check `spexr-overrides.css` rules that pinned old values, render the IDE shell in both themes.
- Any consumer change beyond the version line is recorded here with its reason. The expectation is none.

## Gates (every slice, must stay green)

- `npm test` (all `scripts/*.test.mjs`, including the two new ones).
- `npm run audit` (`sl-audit`) clean.
- `npm run gen:tokens` leaves no diff after the slice's token edits (generated files are committed in sync).
- `packages/palette-py/` and the `terminal` block unchanged.

## Acceptance

- **A-1** Every slice has a contact sheet with three directions, dark and light, and an owner pick recorded below.
- **A-2** `public-surface.test.mjs` and `palette-contrast.test.mjs` exist and pass.
- **A-3** `@sondalab/ui-kit@0.11.0` is on npm.
- **A-4** sondalab-site and spexr run on `^0.11.0` with no change other than the version line, or each exception is recorded here.
- **A-5** The owner signs off the showcase in both themes.

## Slice log

| Slice | Directions probed | Picked | Rejected (one line each) | Status |
|---|---|---|---|---|
| 1 — Palette | A ground-derived · B ink restraint · C print inks | **C** (owner, 2026-09-24); viz hues re-spaced 45° apart after promotion because the sheet's ramp failed the distinctness gate (two pairs at 0.049 / 0.054) | A — status tied to the brand but chart hues too close to C's to justify; B — success and info indistinguishable in light, a risk for spexr's agent wall | promoted; `--sl-viz-*` now per theme |
| 2 — Depth and shape | A hairline · B soft cast · C offset print | **B** (owner, 2026-09-24): radius 6/10/16; two-layer contact + ambient shadow in the ground's ink; `text-3xl` 2.75rem, `text-display` clamp(3.5rem, 2rem + 5vw, 6rem) | A — restrained, but reads as a spec sheet next to the print inks; C — hard offset shadow is loud on a dense IDE surface and dates fast | promoted; `--sl-shadow-*` now per theme, read through new `--slc-shadow-*` role vars (re-derived in black inside `.sl-invert`) |
| 3 — Controls | A tactile · B editorial · C quiet precision | **C** (owner, 2026-09-24): compact buttons (weight 500, `--sl-radius-md`), ghost and icon button as a 6% ink wash, fields filled with a focus halo, compact switch, neutral selected states | A — lift/sink reads only under the pointer, subtle at rest; B — mono uppercase buttons loud in a dense IDE, underline fields hard to find in spexr panels | promoted; focus outline contract kept (the halo adds to it); glass `--slfx-fill` rebound for ghost / icon button |
| 4 — Surfaces and labels | | | | not started |
| 5 — Release and rollout | — | — | — | not started |

## Found on the way

- **Showcase accent picker ignores the theme** (present on `main` at `8d220e4`). Choosing *Amber* writes `--sl-accent-default: #F5A83C` inline on `<html>`, so the light theme renders the dark amber (pale button, pale eyebrow) instead of `#B56A0C`. Showcase-only; consumers unaffected. To fix when a slice next touches `showcase/index.html`.
- **`components.css` role-var fallbacks duplicate the light theme** (`--slc-success: var(--sl-status-success, #…)`). They must be updated with every light-theme value change; `sl-audit` catches a stale one.
