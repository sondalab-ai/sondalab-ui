> **What is this file.** The implementation contract for giving the 0.10.0 base element set an effects declension — which of the five families reaches which shipped class, under which meaning, with which canonical string. It fixes the per-element verdict, where the CSS lives, what the showcase must render, and what must be true before a slice counts as done. It adds **no rule** to the design language: every verdict below is cited to a rule that already exists in `docs/design-language.md`.
> **Audience:** the implementer of the follow-up plan, and reviewers checking that an effect was granted for a reason rather than because it was available.
> **Owner:** marcellobarile.
> **Companion files:** `docs/design-language.md` (the grammar — L1 and L6 are what this file applies), `docs/specs/2026-09-08-effects-layer-design.md` (the effects layer contract — this adds declensions and changes none of it), `docs/specs/2026-09-14-base-element-set.md` (the elements being declined), `packages/ui-kit/agent/catalog.md` § Effects (the canonical-strings table this extends), `packages/ui-kit/agent/HANDOFF.md` (what `sl-audit` cannot mechanically check — all of L6 is on that list), `AGENTS.md` (the release rules this obeys).

# Effects declension for the base element set

## Goal

`packages/ui-kit/effects.css` names **six** shipped classes in its entire 127 KB: `.sl-btn`, `.sl-btn--primary`, `.sl-field__control`, `.sl-tag`, `.sl-badge`, `.sl-dialog`. Every class introduced in 0.10.0 — twenty-four catalog entries — has none.

That absence reads two ways and only one is true. The families are **generic**: `.sl-fx-glass` composes onto any element with a border, and works there today. What the base set lacks is not effects but **tuning** — the per-component CSS that stops a family fighting the structure of the component it lands on — and, before that, a documented verdict on which elements should take a family at all.

This spec supplies the verdict for all twenty-four, and the order in which the tuning is discovered: apply, look, then tune only what actually broke.

## Legend (status vocabulary)

- **Shipped / Delivered** — merged to the production codebase, available to consumers of `@sondalab/ui-kit`.
- **PoC implemented (not delivered)** — built as a prototype on a showcase page, not released.
- **Open** — a decision this file deliberately does not take.

## Scope (locked)

1. **No new rule in the design language.** `docs/design-language.md` is not edited by this work. Every verdict cites L1 or L6 as they already stand. This is also a hard gate: `scripts/agent-docs-drift.test.mjs` requires `packages/ui-kit/agent/design-language.md` to stay byte-identical to the canonical doc, and an unchanged copy is an exit condition for the branch.
2. **No new token.** Every value comes from the existing `--sl-*` tokens, the `--slc-*` role-vars, the `--slfx-*` knobs, and `color-mix()` over them.
3. **Tuning CSS lives in `effects.css`**, sectioned by that file's existing `══ BANNER ══` convention, next to the six declensions already there. No second stylesheet: the declension belongs with the families, and splitting it would make one contract live in two files.
4. **`showcase/index.html` is not touched.** It imports no `effects.css` and must keep not importing it — it is the only place the base set can be seen bare, which is what makes the effects pages legible by contrast.
5. **Classes stay additive.** Every `.sl-fx-*` composes onto a shipped `.sl-*` class and never replaces it (L6, "Classes are additive"). No effect is baked into `components.css`.
6. **The focus ring is never replaced.** No aurora, glass ring or swell removes or substitutes the `outline` a component already gets from the shared focus rule in `components.css`.
7. **Ships in 0.10.0, on the existing branch.** Decided by the owner, 2026-09-14, against the recommendation to split it into 0.11.0: the review is larger, and Slice 2 tunes CSS that Slice 1 introduced in the same pull request. Recorded here because the trade-off was raised and overridden, not missed.

## The verdict, per element

Twenty-four catalog entries (`compositions` is not a class and is excluded). Counts: **8** take a family, **2** need tuning only, **12** take nothing, **2** are open.

### A — Take a family (8)

| Class | Canonical string | Family and the rule it is claimed under |
|---|---|---|
| `.sl-anchor` | `sl-fx-glass sl-fx-glass--text sl-fx-glass--pane` | **Glass (text).** L1: where a display-scale heading wants to be more than a hairline tick, spend the variation on *shape and colour, never on the face* — cut the glyphs out of a material. |
| `.sl-stat__value` | `sl-fx-glass sl-fx-glass--text sl-fx-glass--pane` | **Glass (text).** L1, same clause: a display-scale numeral is a structural label and stays mono; the material is where its variation goes. |
| `.sl-figure__media` | `sl-fx-glass sl-fx-glass--wide` | **Glass.** L6: glass means *this is a physical surface*. A 1 px frame around an image is the literal case. `--wide` matches the container treatment card and dialog already take. |
| `.sl-avatar` | `sl-fx-glass sl-fx-glass--pane` | **Glass (pane).** Only when the avatar is a `<button>` — then it is a text button's silhouette without the text. A static avatar takes nothing. |
| `.sl-select` | `sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field` | **Glass + aurora.** The field declension, unchanged in meaning: material at rest, attention on focus. |
| `.sl-segmented__item` (selected) | `sl-fx-aurora sl-fx-aurora--rim` | **Aurora.** L6: *attention lives here* — the active item. `--rim` because a selected item is **filled**, and a filled element has no edge to inhabit, so the arc steps just outside it in the depth companion. |
| `.sl-skeleton` (container) | `sl-fx-aurora sl-fx-aurora--wide` + `data-sl-fx-live="busy"` + `aria-busy="true"` | **Aurora (busy).** L6: *busy while real work runs*. The ARIA is not decoration — the aurora renders state and never is the state. Busy auroras are exempt from the one-ambient budget. |
| `.sl-section__idx` | `scramble(el)` from JavaScript | **Glitch.** L6: *something re-resolved*. `showcase/effects.html` already does exactly this, on a page-local `.sec-idx`; this moves an existing behaviour onto the public class. |

One row carries a caveat that Slice 1 resolves by looking, not by design:

- **`.sl-select` — the collision is `::after`, not the selector.** Corrected after reading `effects.css`: `--field` is **not** bound to `.sl-field__control`. It is a generic modifier that sets `--slfx-ring-w: 2px` and nothing else (`effects.css:835`), so the class reaches whatever element carries it. The real constraint is the one the catalog already states — a replaced control renders no `::before`/`::after`, so the effect must land on a wrapper — and `.sl-select` **is** a wrapper. What actually collides is the pseudo-element: the glass and aurora rings are painted on `::after` (`effects.css:499`), and `.sl-select::after` is the chevron. Either the markup nests `.sl-select` inside `.sl-field__control`, putting the two on different elements, or one of the two is given up. Decided in Slice 2 from the rendered page; the nesting route is preferred on current information because it adds no selector to a released layer and keeps both.

### B — Tuning only (2)

| Class | Canonical string | What needs tuning, and why |
|---|---|---|
| `.sl-btn-group` | `sl-btn-group sl-fx-glass sl-fx-glass--wide` **or** members as panes | The family is not in doubt — they are text buttons, so they are panes. What is in doubt is *where the glass goes*. The group sets `border: none` on its children and its own `background` **is** the 1 px rule between them; a ring on each member would be drawn exactly where the group already draws a line, and one hairline would render as two. The alternative needs no tuning at all: the **group** is the glass host, one silhouette with one ring, and the members keep the group's rule between them untouched. Slice 1 renders both and Slice 2 keeps one. |
| `.sl-icon-btn` | `sl-icon-btn sl-icon-btn--round sl-fx-liquid sl-fx-liquid--drop` (round) · `sl-icon-btn sl-fx-glass sl-fx-glass--pane` (quad) | The round icon button is **already** in the catalog's canonical-strings table, and `effects.css` never names `.sl-icon-btn` — nor does it need to. `sl-fx-liquid--drop` is **not a CSS class at all**: it is a JavaScript selector gate (`LIQUID_HOSTS = ".sl-fx-liquid.sl-fx-liquid--drop"` in `effects.js`), and the driver reads the host's computed box rather than matching a component. So the liquid works on the shipped icon button with no binding, and the only work here is rendering it and saying so. The quad variant is not round and therefore takes no drop: it is a pane like any other button, and *that* is the row needing a look. |

### C — Take nothing (12)

Switching a family off is as much a decision as switching it on (L6: "an effect that means nothing is switched off"). Each of these is recorded with its reason so a later reader does not read the absence as an oversight.

| Class | Why nothing |
|---|---|
| `.sl-switch__track` | Measured, 2026-09-14: the track's own `::after` **is the knob**, and the glass family paints its ring on `::after` too. With the class the pseudo-element computes `opacity: 0` and a conic-gradient — the ring rule takes it over and nothing paints, so the control silently loses the moving part that carries its state. Not a question of scale; the element has one `::after` and the knob needs it. |
| `.sl-header` | Already expresses *physical surface* through its own `backdrop-filter`. A glass ring would be a second concentric treatment of one idea. |
| `.sl-hgrid` | The goo welds silhouettes; the whole point of the hairline grid is the crisp shared 1 px rule between cells. The family would destroy the signature it landed on. |
| `.sl-check` | A `1rem` box: the chrome is illegible at that width, and an aurora beside the focus `outline` is exactly the unreadable sandwich L6 forbids. |
| `.sl-radio` | Identical geometry, identical conclusion. |
| `.sl-breadcrumb` | The current crumb states *where you are*, which is position, not attention. An aurora there would mark something that is not the focus. |
| `.sl-pagination__item` | Same argument for the current page. |
| `.sl-wrap` | Measure and gutter. Not a surface — the place surfaces sit. |
| `.sl-prose` | The running-text measure. Same. |
| `.sl-empty` | An empty state is content explaining an absence; no family owns that meaning. |
| `.sl-lockup` | Glass-text at lockup scale is mush; the lockup lives small and tracked, in headers. |
| `.sl-monogram` | Same scale, same outcome. The three corrections that make it legible at 32 px do not survive a mask. |

### D — Open (2)

- **`.sl-invert` — already covered, undocumented.** Its declension exists: `sl-fx-aurora sl-fx-aurora--linear sl-fx-aurora--top`. Where the edge is not a ring the aurora is linear, and `--top` pins it to the band's structural rule, which — unlike a tab's or a link's — is on top. What is missing is the row in the catalog's canonical-strings table. One line of documentation, no CSS.
- **`.sl-wordmark` — the owner's call, deliberately not taken.** Glass-text on the wordmark would be the identity board's treatment. It is left out of this spec because making the mark material is a **brand** decision rather than a system one, and the system should not decide unprompted how the name presents itself. If it comes in, it comes in with `.sl-anchor`'s string and this section is amended.

### The goo reaches nothing new, and that is stated on purpose

The only declared sets in the base element set are the button group and the segmented control, and the goo **refuses** `button`, `input`, `select`, `textarea` and `a[href]` outright, marked or not: a control paints its own chrome through layers that family does not own, so a welded control keeps an outline the substance was meant to replace, and its affordance is worth more than the merge. No goo row exists in this spec, and a later reader should not add one for the button group.

## Architecture

**Two slices, in this order, because the order is the method.**

- **Slice 1 — apply and look. No new CSS.** The showcase applies the canonical strings from section A to real elements, the catalog's canonical-strings table gains the new rows, and the fences below go in. Nothing is tuned. The point of the slice is to find out which of the predicted collisions are real, since a tuning written before the collision is observed is a guess.
- **Slice 2 — tune what broke.** Only the collisions Slice 1 actually produced get CSS in `effects.css`, each in its own section under the banner convention, each with a comment naming the collision it resolves. Rows that turned out not to need tuning get nothing, and the spec is amended to say so.

**Files.**

| File | Slice | Change |
|---|---|---|
| `showcase/effects.html` | 1 | New live cells per family section; new rows in § 06 Declension. |
| `packages/ui-kit/agent/catalog.md` | 1 | New rows in the § Effects canonical-strings table; per-component `Do`/`Don't` where a row carries a caveat. |
| `packages/ui-kit/agent/catalog.json` | 1 | Machine index kept in step. |
| `scripts/effects-showcase.test.mjs` | 1 | The fences below. |
| `packages/ui-kit/effects.css` | 2 | Per-component tuning, only where Slice 1 proved it necessary. |
| `packages/ui-kit/README.md` | 2 | Only if a tuning changes what a consumer must write. |

**What does not change:** `packages/ui-kit/tokens.css`, `packages/ui-kit/themes/*.css`, `packages/ui-kit/components.css`, `packages/ui-kit/compositions.css`, `packages/palette-py/`, `docs/design-language.md`, `packages/ui-kit/agent/design-language.md`, `showcase/index.html`.

## Testing

`sl-audit` verifies colour value-equality and tier consistency. It cannot verify a single thing in this spec — the right family for the right meaning, the budget, the focus ring and the ARIA are all on `HANDOFF.md`'s judgement list. So the fences here are showcase-shaped: they assert the page *renders* the contract, because a claim nothing renders is a claim nothing can contradict.

New assertions in `scripts/effects-showcase.test.mjs`:

1. **Every canonical string in `catalog.md` is applied on the page.** Parse the § Effects table, and for each row assert the class combination appears in a `class="…"` attribute — not merely in prose. This is the fence that makes the table a contract rather than a wish.
2. **The ambient budget holds.** At most one `data-sl-fx-live="on"` per page. Busy auroras are exempt and are counted separately.
3. **`--drop` only on a round icon-only button.** A `sl-fx-liquid--drop` host must carry `sl-icon-btn--round` (or be the page's documented pre-0.10.0 equivalent) and an `aria-label`. Extends the existing button rule rather than replacing it.
4. **Every busy or determinate aurora carries its ARIA.** Already present; extended to cover the skeleton container, which is not a `<button>` and so escapes the existing button-shaped assertion.
5. **No effect class sits on a `components.css` selector.** Assert `packages/ui-kit/components.css` contains no `sl-fx-` string, so "additive" cannot quietly stop being true.

Existing fences that must keep passing unchanged: the five families are applied to real elements; the glitch is a child span; every text button is a glass pane and only a round icon-only button goes gooey; `compositions.css` is imported after `effects.css`, the page declares none of its bindings, and every class it binds exists on the page.

**Per-element visual check, at three themes.** Each row in section A is looked at in light, dark and high-contrast before its task is closed — high contrast in particular, because L6 makes it a kill switch: every family off, the GPU field torn down. An element whose *layout* depends on an effect would break there, and that is the failure the theme pass catches.

## Error handling

The failure modes worth naming are silent ones — the layer has a recorded history of them.

- **A family that renders nothing.** A `.sl-fx-glass` on a replaced control (`<input>`, `<select>`, `<textarea>`) paints nothing at all, with no error, because the browser owns that box and it hosts no `::before`/`::after`. This is precisely the `.sl-select` caveat above. The wrapper is mandatory, and fence 1 does not catch it — only the theme pass does.
- **A binding whose selector matches nothing.** Shipped in 0.10.0 once already. Fence 1 generalises the guard: a canonical string that no element carries fails the suite.
- **An effect that survives its kill switch.** `prefers-reduced-motion: reduce`, `[data-sl-theme="high-contrast"]` and `data-sl-fx="off"` are hard requirements, and the existing layer honours them; a *new* tuning must not reintroduce motion or paint beneath them. Checked in the theme pass, not mechanically.
- **A tuning that widens a structural rule.** L6 caps the effect budget on weight, not only on count: a structural separator stays 1 px whatever an effect is doing to it. The button group is the live case — moving the glass to the group, or standing the ring down on the facing edges, is correct; thickening the group's rule to hide the doubling is not.

## Deliverable

`@sondalab/ui-kit` 0.10.0, on the existing branch, with:

- nine shipped classes carrying a documented, rendered effects declension, and eleven carrying a documented decision to take none;
- the catalog's canonical-strings table extended from four rows to cover the base element set, and machine-checked against the showcase;
- per-component tuning in `effects.css` for the collisions Slice 1 demonstrates — and none for those it does not;
- five new fences, none of which can pass on a page where the contract was deleted.
