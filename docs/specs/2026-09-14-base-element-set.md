---
slug: 2026-09-14-base-element-set
title: Base element set — @sondalab/ui-kit as a design system
status: draft
createdAt: 2026-09-14
workflowStep: ship
forcedSteps: [specify, context, clarify, plan, implement, validate, ship]
updatedAt: 2026-10-15
---
# Base element set — `@sondalab/ui-kit` as a design system

> **What this file is:** the implementation contract for the base UI element set that turns `@sondalab/ui-kit` from a token package with a component layer into a design system a Sondalab product can build a whole surface out of. It fixes what is added, the markup shape and role-vars of each element, the one role-var deroga this requires, how the shipped classes relate to the opt-in effects layer, and what must be true per element before a slice counts as done. It does **not** re-derive the grammar: every rule it applies is cited to `docs/design-language.md`.
> **Audience:** engineers and agents implementing a slice; reviewers deciding whether a slice is done; product engineers adopting the new classes in spexr, introspect, daos and sondalab-site.
> **Owner:** marcellobarile.
> **Companion files:** `docs/design-language.md` (the grammar — this file adds no rule to it and cites it throughout), `docs/design-system-spec.md` (the token contract — **no `--sl-*` token is added here**), `docs/specs/2026-09-08-effects-layer-design.md` (the effects layer contract — Slice 5 binds to it and changes none of it), `packages/ui-kit/agent/catalog.md` (the agent-facing catalog every element must land in), `packages/ui-kit/agent/HANDOFF.md` (what `sl-audit` cannot mechanically check), `AGENTS.md` (the release rules this obeys).
> **Relationship:** this file is the implementation contract; the accompanying plan in `docs/plans/` is the task breakdown and the record of rulings made during implementation. Where the two disagree about *what* is being built, this file wins.

## Legend (status vocabulary)

- **Shipped / Delivered** — merged to the published package, available to consumers on npm.
- **PoC implemented (not delivered)** — built as a prototype, not merged or released.
- **Placeholder (not delivered)** — stub or scaffold only.

Every element in this spec targets **Shipped**. Nothing here is a prototype.

## Why this exists

`@sondalab/ui-kit` at 0.9.6 already carries most of a design system: the `--sl-*` token layer, three themes, fifteen `.sl-*` component classes, the `--slc-*` role-var seam that makes them work in both theme tiers, an opt-in five-family effects layer, and an agentic core (`catalog.md` / `catalog.json` / `sl-audit` / the author-migrate-adopt workflows). What it does not carry is enough of a **base element set** to build a surface without inventing components locally — which is precisely what every consumer then does, and what the design system exists to prevent.

Three gaps, in order of how soon a product hits them:

1. **Form controls are incomplete.** `.sl-field` styles a text input, textarea and bare select. There is no checkbox, radio, switch, or styled select. Any product form hits this on day one and invents its own.
2. **The signature patterns are not shipped.** Sticky translucent header, inversion band, hairline grid, section index and oversized display anchor live in `packages/ui-kit/agent/catalog.md` §"Signature patterns" as CSS to copy. These are the motifs that make a surface read as Sondalab, and they are the part most likely to drift, because every product re-types them.
3. **The element set stops short of a working surface.** No breadcrumb, button group, segmented control, icon button, pagination, empty state, skeleton, stat block, figure, avatar, or a class-based wordmark — the wordmark and monogram exist only as SVG assets and as bespoke CSS inside `showcase/index.html`.

## Goal

A Sondalab product can build a complete surface — chrome, layout, forms, states, identity — out of shipped `.sl-*` classes, with the house grammar already applied, and bind it to its own colour layer through the documented role-var block and nothing else.

## Non-goals

- **No framework bindings.** No React components, no custom elements, no build step. The kit's stated identity is framework-agnostic CSS that works in Theia widgets, React apps and plain HTML; that holds.
- **No icon set.** `.sl-icon-btn` accepts a caller-supplied `<svg>` at `currentColor`. Commissioning an icon family is a separate project.
- **No spinner or progress component.** Ruled out by the owner, 2026-09-14: `design-language.md` L6 already assigns that meaning to the aurora — "busy while real work runs", "determinate when the arc length *is* the value", carried by `aria-busy` and `role="progressbar"`. A `.sl-spinner` in `components.css` would be a second vocabulary for one meaning. A Tier 0 surface that needs loading feedback imports `effects.css`.
- **No `@layer`.** Considered and declined by the owner, 2026-09-14: wrapping `components.css` in `@layer sl.components` would change override semantics for consumers already overriding at equal specificity, and the current consumers (spexr, introspect, sondalab-site) work as they are.
- **No change to the effects layer's paint.** Slice 5 adds bindings and documentation. It edits no `.sl-fx-*` rule.

## Invariants

These bind every slice. They are not style preferences; each has a mechanical consequence in this repo.

### I1 — Zero new `--sl-*` tokens

`design-language.md` §New-token policy: a new token forces regenerating `packages/`, satisfying `check-drift.yml`, and bumping **both** `packages/ui-kit/package.json` and `packages/palette-py/pyproject.toml` in the same pull request. Every element here is built from existing tokens, the `--slc-*` role-vars, and `color-mix()` over them.

`--sl-measure` (~63ch) and `--sl-gutter` (the fluid clamp) are **conventions, not tokens** — the policy says products define them locally with the canonical values. Slice 2 ships `.sl-wrap` and `.sl-prose`, which declare them *inside the class*, not on `:root` in `tokens.css`. This looks like token creation and is not: no generated file changes, and `check-drift.yml` is unaffected because `components.css` is hand-authored.

### I2 — Exactly one new `--slc-*` role-var: `--slc-canvas`

The README calls the Tier B mapping block "the *entire* integration surface". Every role-var added is a line every Tier B product must map, so the default is zero. One is unavoidable.

`components.css` forbids reading theme tokens directly, because `--sl-*` colour tokens resolve only under `[data-sl-theme]` and are absent in Tier B products (introspect, daos). The five signature patterns currently read them directly — `catalog.json` records `--sl-bg-canvas`, `--sl-text-primary`, `--sl-border-subtle` — which is legitimate for copy-paste CSS and illegitimate for a shipped class. Re-expressing them on role-vars works for five of the seven Slice 2 entries. It fails for two:

- **`.sl-header`** is translucent over the **page ground**: `color-mix(in srgb, <canvas> 84%, transparent)`.
- **`.sl-invert`** flips to canvas-on-ink: background `--slc-text`, foreground **canvas**.

There is no canvas role-var. `--slc-surface` is not a substitute: the values differ materially (`#ECE4D4` vs `#F6F1E6` in light; `#070A0D` vs `#0F151A` in dark), and substituting surface would put the inversion band's text on the wrong ground in every theme.

So Slice 2 adds:

```css
--slc-canvas: var(--sl-bg-canvas, #ECE4D4);
```

with the same fallback chain as every other role-var, declared alongside them at the top of `components.css`. It is added to the Tier B mapping recipe in `packages/ui-kit/README.md` and in `packages/ui-kit/agent/catalog.md`. **Adding a second role-var in this effort requires an explicit ruling recorded in the plan.**

### I3 — Tier 0 correctness

Every element must be correct with `components.css` alone, no `effects.css` import, no JavaScript. No glass, aurora or liquid is baked into a component. The effects layer composes onto these classes and never replaces them (`design-language.md` L6, "Classes are additive").

### I4 — Colour comes from a role-var, never a literal

`sl-audit` enforces this mechanically for CSS. Any data-URI SVG used as a `mask-image` carries **geometry only, no colour** — the colour arrives as `background: currentColor` under the mask.

### I5 — Structural labels take the mono treatment

`design-language.md` L1: eyebrows, section indices, meta, badges, tags are `--sl-font-mono`, `text-transform: uppercase`, letter-spacing in the `0.14em–0.22em` band. This reaches the new set at: the segmented item, the breadcrumb, the stat caption **and the stat value**, the figure caption, the empty state's eyebrow, and the pagination's figures. It does **not** reach the checkbox, radio and switch labels: those are content describing an option, not structural labels, and they take `--sl-font-sans` like any other body copy. L1 also fixes that the rule is about **role, not size** — a display-scale numeral is a structural label and stays mono.

### I6 — Hairline structure

`design-language.md` L2: structural separation is a single `1px` rule in the line colour. No heavy borders, no drop-shadow-as-separator. The button group, segmented control, pagination and hairline grid are all built from the hairline-grid technique (a `1px` gap over a line-colour background) rather than from adjacent borders, so they never double a rule.

## Architecture

### Where things live

| File | Status | Contents after this work |
|---|---|---|
| `packages/ui-kit/tokens.css` | generated, untouched | `--sl-*` tokens |
| `packages/ui-kit/themes/*.css` | generated, untouched | per-theme colour |
| `packages/ui-kit/components.css` | hand-authored, **grows** | role-vars (+`--slc-canvas`), focus ring, primitives, complex shells, **form controls (Slice 1)**, **patterns (Slice 2)**, **nav/state (Slice 3)**, **identity/media (Slice 4)** |
| `packages/ui-kit/compositions.css` | hand-authored, **new (Slice 5)** | bindings only — the custom properties a composition must set. No paint. |
| `packages/ui-kit/effects.css` | hand-authored, **untouched** | the five effect families |

The owner ruled on 2026-09-14 that the patterns ship inside `components.css` rather than a separate `patterns.css`, so a consumer's import list does not grow. `components.css` roughly doubles as a result; it stays one file, sectioned by the existing `══ HEADING ══` banner convention, with the new sections **FORM CONTROLS**, **NAVIGATION & STATE**, **IDENTITY & MEDIA**, and **PATTERNS**.

### Slice 5 — why `compositions.css` carries bindings and not alias classes

The original design for Slice 5 was alias classes: one short class per component expanding to the canonical effect binding. **Plain CSS cannot alias a class**, and the two workarounds both fail:

- **Selector rewriting.** Making `.sl-fx-glass` also match a composed form requires `:is(.sl-fx-glass, …)` on every rule that mentions it — 58 selector lines for glass alone, 174 across the five families. `:is()` takes the specificity of its most specific argument (Selectors Level 4), so this silently raises every glass rule from (0,1,0) to (0,2,0) and shifts override behaviour across a released layer.
- **A JavaScript stamping pass.** A `compose(root)` in `effects.js` that adds `.sl-fx-*` classes to shipped `.sl-*` elements works in plain HTML and fails in the kit's two primary consumers: a class added from outside is dropped the first time React or a Theia widget re-renders that element's `className`.

Neither is worth it, because **the binding already exists**. `effects.css:574-587` and `:788-815` already carry the per-component declension — `.sl-btn.sl-fx-glass`, `.sl-badge.sl-fx-glass`, `.sl-field__control.sl-fx-glass`, `.sl-tag.sl-fx-glass`, `.sl-dialog.sl-fx-glass`, `.sl-btn--primary.sl-fx-glass`. A product importing `effects.css` does not re-derive which family goes on which component or how it tunes. What it lacks is the **knowledge of what to type**, which is a documentation problem.

So Slice 5 delivers two things:

1. **`compositions.css`** — the custom-property bindings that today live in prose as "knobs a surface is expected to set" (`packages/ui-kit/README.md` §Effects). Shipping them removes a footgun each:
   - `.sl-invert` rebinds `--slfx-text-light`, `--slfx-text-core-a`, `--slfx-text-halo-a` — inside an inversion band `--slc-text` is the band's own ground, so a glass-text host lit by it is lit by its own background.
   - `.sl-invert` rebinds `--slc-border` from `currentColor` — the documented fix that is currently a footnote in two READMEs and the `components.css` header. *(This one ships in Slice 2, inside `.sl-invert`; it is listed here for completeness.)*
   - `--slfx-pane-swell: 1` on any shipped wrapper that scales a pane itself, so the two scales do not compose and spill the pane's seated light past its edge.
2. **The canonical class string per component**, stated in `catalog.md`, indexed in `catalog.json`, listed in `README.md`, and **rendered with effects on** in `showcase/index.html`. An author copies one line and gets the correct declension.

`compositions.css` is opt-in — a consumer imports it after `effects.css` — and is inert without `effects.css`, since it only sets custom properties that nothing else reads.

### What the effects declension does and does not cover

Per `design-language.md` L6, a family fires only inside the meaning it owns, and the effect budget caps ambient work at one aurora, one glitch burst and one deforming element per document. The canonical strings therefore cover only what is bound to a state or to the element's material nature — the glass pane on a text button, the glass field and focus aurora on `.sl-field__control`, the linear aurora on the selected tab. They do **not** cover, and the documentation must say so:

- **Goo** — requires a declared container and a declared weld gap, both properties of the layout the author owns.
- **Glitch** — fired from JavaScript on a real event.
- **Ambient, busy and determinate aurora** — budget-limited and bound to an ARIA contract (`aria-busy`, `role="progressbar"` with `aria-valuenow`). The aurora renders state; it never *is* the state.
- **Liquid `--drop`** — L6 is explicit that "the modifier written in the markup is the contract; nothing measures a radius to decide". A rule inferring `--drop` from `.sl-icon-btn--round` would be exactly the inference L6 forbids. The author writes `sl-fx-liquid sl-fx-liquid--drop`.

## The element set

Role-vars listed per element are the **intended** set; the authoritative list is what the CSS actually reads, and `scripts/catalog-audit.test.mjs` asserts set equality between `catalog.json` `roleVars` and the section's `Consumes:` line in both directions.

Substrate levels use the matrix vocabulary from `design-language.md`: **R** required · **A** adapt · **N/A** not applicable, across **IDE** / **App** / **Page** / **Term**. Every element in this spec is `N/A` on Term — it is a CSS layer and the terminal substrate consumes `sondalab-palette` instead.

### Slice 1 — Form controls

The real gap. All three of checkbox, radio and switch use **one uniform markup shape**: a `<label>` host, a visually-hidden-but-focusable `<input>`, a `<span>` that paints the control, and a `<span>` that carries the text.

```html
<label class="sl-check">
  <input class="sl-check__input" type="checkbox">
  <span class="sl-check__box"></span>
  <span class="sl-check__label">Run the audit on save</span>
</label>
```

**Mechanism ruling.** The leaner alternative — `appearance: none` directly on the `<input>` plus a `mask-image` — is **rejected**. Pseudo-elements on replaced elements are undefined per spec and inconsistent across engines; the kit's own README already records that `<input>`, `<textarea>` and `<select>` render no pseudo-element, which is why `effects.css` requires an `.sl-field__control` wrapper. The switch needs a track and a knob regardless, so the sibling-span shape is required for one of the three; using it for all three keeps one shape to learn. The `__input` is hidden with `clip-path`/`position: absolute`, never `display: none` or `visibility: hidden`, both of which remove it from the focus order.

| Element | Classes | Substrate (IDE/App/Page) | Intended role-vars |
|---|---|---|---|
| Checkbox | `sl-check`, `sl-check__input`, `sl-check__box`, `sl-check__label` | R / R / A | `--slc-surface`, `--slc-border`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus` |
| Radio | `sl-radio`, `sl-radio__input`, `sl-radio__box`, `sl-radio__label` | R / R / A | same as checkbox |
| Switch | `sl-switch`, `sl-switch__input`, `sl-switch__track`, `sl-switch__label` | R / R / A | `--slc-surface`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus` |
| Select | `sl-select` (wrapper on `sl-field__control`) | R / R / A | `--slc-surface`, `--slc-border`, `--slc-border-strong`, `--slc-text`, `--slc-text-muted` |

The checkmark and the radio dot are **drawn in CSS** (a rotated border corner; a filled inner circle), not imported as assets — no data URI, no literal, nothing to audit. The select chevron is drawn on the wrapper's `::after` for the same reason, and because a `mask-image` on a `<select>` would mask its text along with the arrow. The switch knob transitions on `--sl-motion-fast` with `--sl-motion-ease`; the token layer already zeroes it under `prefers-reduced-motion`.

### Slice 2 — The signature patterns, shipped

Seven entries. Five modify existing `"kind": "signature"` entries in `catalog.json` — each gains a `classes` array and a `Consumes:` line, where today it has `classes: []` and is matched by id-words-in-headings. Two are new (`sl-wrap`, `sl-prose`), which promote the `--sl-gutter` and `--sl-measure` conventions from prose into classes.

| Element | Classes | Substrate (IDE/App/Page) | Grammar |
|---|---|---|---|
| Wrap | `sl-wrap` | N/A / A / R | L2 gutter — max-width `~78rem`, `--sl-gutter: clamp(1.25rem, 5vw, 6rem)` declared in-class |
| Prose | `sl-prose` | A / R / R | L1 measure — `--sl-measure: 63ch` declared in-class |
| Sticky header | `sl-header` | N/A / R / R | L3 — sticky, `color-mix(canvas 84%, transparent)`, `backdrop-filter`, 1px bottom rule |
| Inversion band | `sl-invert` | N/A / A / R | L3 — canvas-on-ink; **re-derives `--slc-border` from `currentColor` inside the class** |
| Hairline grid | `sl-hgrid` | N/A / R / R | L2 — `gap: 1px` over the line colour, cells paint their own surface |
| Section + index | `sl-section`, `sl-section__head`, `sl-section__idx` | N/A / A / R | L2 — 1px top rule, mono index beside the heading |
| Display anchor | `sl-anchor` | N/A / A / R | L1 — `clamp(2.7rem, 1.6rem + 5vw, 5.4rem)`, at most one per screen |

`.sl-invert` carrying its own `--slc-border` re-derivation is the point of shipping it: the fix stops being a footnote that three documents repeat and every adopter forgets, and any bordered component placed inside the band — card, table, field, callout, and now checkbox and switch — inherits it.

### Slice 3 — Navigation, structure, state

| Element | Classes | Substrate (IDE/App/Page) | Notes |
|---|---|---|---|
| Breadcrumb | `sl-breadcrumb`, `__item`, `__sep` | A / R / A | Mono uppercase tracked (I5). Separator is a hairline glyph, not an imported icon. |
| Button group | `sl-btn-group` | R / R / A | Joins `.sl-btn` children with a shared 1px rule via the hairline technique (I6) — never adjacent borders. |
| Segmented control | `sl-segmented`, `__item` | R / R / A | Promotes `.seg` from `showcase/index.html`. Mono uppercase items. |
| Icon button | `sl-icon-btn`, `sl-icon-btn--round` | R / R / A | Square by default. Caller supplies `<svg>` at `currentColor`. `--round` is the markup contract the liquid's `--drop` reads — it does **not** apply it. |
| Pagination | `sl-pagination`, `__item`, `__item[aria-current]` | N/A / R / A | Mono figures, `font-variant-numeric: tabular-nums`. |
| Empty state | `sl-empty`, `__title`, `__body` | A / R / A | Composes `.sl-eyebrow` above the title. L5 voice: says what is absent and what to do, not "Nothing here yet!". |
| Skeleton | `sl-skeleton` | A / R / A | **Static.** No shimmer. |
| Stat | `sl-stat`, `__value`, `__label` | N/A / R / R | `__value` is **mono**, not display serif. |

**Two rulings recorded here because they will look like omissions.**

*The skeleton does not shimmer.* A shimmer is ambient motion that means nothing, and L6 says an effect that means nothing is switched off — the same rule that forbids an ambient glitch on a control. A skeleton is a surface block with a hairline: it states that something is absent, which is all it knows.

*The stat value is mono, not Fraunces.* L1: a display-scale numeral is a structural label and keeps `--sl-font-mono` whatever its size. This is the owner's ruling of 2026-09-13, made after Fraunces at `opsz` 144 was tried on the method cards and rejected — mono at display scale is part of the suite's tech register. Where such a numeral wants more presence, it is spent on shape and colour, never on the face.

### Slice 4 — Identity and media

| Element | Classes | Substrate (IDE/App/Page) | Notes |
|---|---|---|---|
| Wordmark | `sl-wordmark`, `__dot` | A / R / R | `sondalab.` in `--sl-font-display` weight 500, `letter-spacing: -0.05em`, trailing period in the accent. |
| Lockup | `sl-lockup`, `__dot` | R / R / R | `sonda·lab` in `--sl-font-mono`, uppercase, tracked `0.2em`, middle dot in the accent. The compact form for headers. |
| Monogram | `sl-monogram` | R / R / R | `s.` with L3's three fixed corrections. |
| Figure | `sl-figure`, `__media`, `__caption` | N/A / A / R | Hairline frame, declared `aspect-ratio`, mono uppercase caption. |
| Avatar | `sl-avatar`, `--sm`, `--lg` | R / R / A | Image, falling back to `.sl-monogram` when no image is supplied. |

The monogram's three corrections are fixed in `design-language.md` L3 and are **transcribed, not re-derived**: the mark is sized to the inscribed crop circle (~60% of the canvas wide) rather than the square; the accent period is scaled +35% around its own centre so it survives a 32px render; and it is pushed +0.06em off the letter, because the wordmark's tight tracking is drawn for a period at its natural size.

These three classes must render identically to `packages/ui-kit/assets/sondalab-{wordmark,lockup}.svg` and `sondalab-avatar-{ink,paper}.svg`. Where the CSS and the asset disagree, **the asset is right** and the CSS is the defect — the assets are the published identity.

### Slice 5 — Compositions

As specified under Architecture. `compositions.css`, its export and `files` entries, the canonical class strings in the catalog and README, and the showcase rendering the base set with effects on.

## What every element touches

Seven places. A slice is not done until every element in it has all seven. This list exists because the second item is the one that gets skipped.

1. **`packages/ui-kit/components.css`** — the class, in the right banner section.
2. **The shared focus-ring selector list, `components.css:54-63`** — **hand-enumerated**. A new interactive class that does not get a line here silently loses the house focus ring, and nothing fails. Slices 1, 3 and 4 all add focusable things: `.sl-check__input:focus-visible + .sl-check__box` and its radio and switch equivalents, `.sl-segmented__item`, `.sl-icon-btn`, `.sl-pagination__item`, `.sl-breadcrumb__item`.
3. **`packages/ui-kit/agent/catalog.md`** — a section with canonical markup, the `Consumes:` line, the substrate levels, a do and a don't, and the canonical effect string where one applies.
4. **`packages/ui-kit/agent/catalog.json`** — the machine index entry: `id`, `kind`, `classes`, `roleVars`.
5. **`packages/ui-kit/README.md`** — the primitives / complex / patterns lists, and the Tier B mapping recipe for `--slc-canvas`.
6. **`showcase/index.html` §04** — the reference implementation, correct in all three themes.
7. **`packages/ui-kit/package.json`** — `exports` and `files` for `compositions.css` (Slice 5 only).

## Testing

- `node --test scripts/*.test.mjs` — 268 tests green at 0.9.6, and they must stay green. `scripts/catalog-audit.test.mjs` is the one this work loads most: every class must be documented in `catalog.md` **outside a heading**, and `catalog.json` `roleVars` must equal the `Consumes:` line as a set, both directions.
- `npm run audit -- --surface "packages/ui-kit/components.css" --product default` — clean. Same for `compositions.css` in Slice 5.
- **New: a focus-ring coverage test.** Given the hand-enumerated list at `components.css:54-63` is the likeliest silent failure in this work, a test asserts that every interactive class the catalog declares appears in the focus-ring selector list. This closes a gap `sl-audit` does not cover and belongs in `agent/HANDOFF.md`'s scope note.
- **New: a pattern-token test.** No selector in `components.css` may read a `--sl-*` **colour** token directly (the `--sl-bg-*`, `--sl-text-*`, `--sl-border-*`, `--sl-status-*`, `--sl-accent-*` families) outside the `:root` role-var block. This is the contract the signature patterns break today and Slice 2 must not re-introduce; type, spacing, radius, motion, shadow and z tokens stay freely readable.
- **Manual, per slice:** the showcase in all three themes, light and dark, plus `high-contrast` — which must show every element correct with every effect family off.

## Release

**Bump `packages/ui-kit/package.json` only, to `0.10.0`.** `components.css` and `compositions.css` are hand-authored — `components.css` says so in its own header and neither appears in `AGENTS.md`'s generated-files list — so no generated output drifts, `check-drift.yml` is unaffected, and `packages/palette-py/pyproject.toml` stays put. The dual-bump rule in `AGENTS.md` binds changes to `sondalab.tokens.json`; this is not one.

Minor rather than patch: the classes are new backward-compatible API. Minor rather than major: no class is removed or renamed, and `--slc-canvas` is additive with a working fallback, so an existing Tier B product that never maps it still renders — it falls through to the light-theme literal, which is wrong in dark and is why the README recipe gains the line.

Confirm before merging that `0.10.0` is not already live: `curl -fsS https://registry.npmjs.org/@sondalab%2Fui-kit/0.10.0` must return 404.

If any slice ends up editing `docs/design-language.md` — which only Slice 4 might, and only if the identity classes reveal the L3 wordmark text is wrong — then `npm run gen:tokens` must run and the regenerated `packages/ui-kit/agent/design-language.md` must be committed in the same change, or `scripts/agent-docs-drift.test.mjs` fails.

## Acceptance criteria

1. Every element in Slices 1–4 exists as a shipped class in `components.css` and has all seven touchpoints above.
2. `node --test scripts/*.test.mjs` is green, including the two new tests.
3. `npm run audit` is clean on `components.css` and `compositions.css`.
4. No `--sl-*` token is added; exactly one `--slc-*` role-var is added (`--slc-canvas`), mapped in the README recipe.
5. No selector in `components.css` reads a `--sl-*` colour token outside the `:root` role-var block.
6. Every interactive class appears in the focus-ring selector list.
7. `showcase/index.html` renders the whole base set correctly in light, dark and high-contrast, and the effects-on rendering matches the canonical strings the catalog states.
8. Every element renders correctly with `components.css` alone — no `effects.css`, no JavaScript (I3).
9. `packages/ui-kit/package.json` is at `0.10.0`; `packages/palette-py/pyproject.toml` is unchanged.

## Open questions

None blocking. Two decisions are deliberately deferred to implementation and must be recorded in the plan when made:

- The exact `aspect-ratio` default for `.sl-figure` (or whether it declares none and leaves it to the caller).
- Whether `.sl-pagination` needs a truncation affordance (an ellipsis item) in this pass, or whether the caller composes it.
