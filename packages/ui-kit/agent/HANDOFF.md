# Agent hand-off — Sondalab DS agentic layer

> **What this file is:** operational guidance for an AI agent working with the Sondalab DS agentic layer. It records what the audit does **not** mechanically check and how to handle those gaps, so you don't either (a) trust the script for things it doesn't cover or (b) mechanically "fix" intentional deviations. Read it before running a migrate/author/adopt job.
> **Audience:** agents (and their humans) running `sl-audit.mjs` or the migrate workflow.
> **Companion:** `README.md` (usage), `design-language.md` (the grammar, shipped alongside). The contract with its human-facing "Open decisions" is `docs/design-system-agentic-spec.md` in the source repo (https://github.com/sondalab-ai/sondalab-ui).

## What the script decides — and what it does not

`sl-audit.mjs` mechanically checks three things:

1. **Colour value-equality** — every hex/rgb literal resolves to a token, the product's accent, or a blessed value.
2. **Tier consistency** — the theme selector (`[data-sl-theme]` vs `[data-theme]`) matches the product's tier in `substrate-matrix.json`.
3. **Accent-step derivation** *(check 7, mechanical as of v0.7.0)* — every `--sl-accent-hover/active/subtle` derives off `--sl-accent-default` (see the check-7 section below for the exemptions).

**Everything else is your judgement.** The script is silent on it — silence is not a pass. In particular, the checks below were specified but deliberately **not** built, because the design language itself uses "violating" values in blessed places, so a mechanical flag would fire on the DS's own reference. Do not treat their absence as "these are fine"; treat them as *yours to judge*.

## Deferred checks — judge these yourself, do not mechanically flag or fix

### Spacing off the `--sl-space-*` scale  *(check 3 — deferred)*
The scale is `{0, .25, .5, .75, 1, 1.5, 2, 3}rem`. But off-scale literals are legitimate in places:
- The **canonical tag recipe** in `design-language.md` L3 is `padding: 3px 7px` — off-scale on purpose.
- Hairline nudges (`margin-bottom: -1px` to overlap a 1px rule), optical adjustments, and `ch`/`%`/`vw`/`calc()` values.

**How to judge:** new *layout* spacing (section gaps, stack rhythm, card padding) should step off `--sl-space-*`. Recipe-level and optical one-offs are fine. When in doubt, match what the nearest `design-language.md` recipe does; don't invent a new spacing literal for structural rhythm.

### Border width > 1px  *(check 4 — deferred)*
The hairline rule (L2) is about *structural separators* being 1px. But 2px borders are intentional as **emphasis accents**, not separators — confirmed in the reference: `components.css:208` (a keycap's 2px bottom edge) and `components.css:360` (a 2px active-tab underline). Focus rings also legitimately use the 2px `--sl-focus-ring-width` token (usually on `outline`, which is not a border).

**How to judge:** a 1px rule that *separates* content (section top, card edge, header/footer, gutter ruler) must be 1px. A 2px edge that *emphasizes* (active-tab underline, keycap, measure-tick) is a deliberate accent — leave it. Never bump a separator to 2px; never flatten an emphasis accent to 1px.

**Active/pressed control states resolve to the product accent** (amber for the `default` product; the product's registered hue otherwise) — an active tab, a pressed button, a selected control shows the accent, never a neutral. So a 2px active-state edge is coloured with the accent (or its `active` step), and a colour-value-equality finding there should map to the accent, not be flattened away.

### Eyebrow / tag recipe conformance  *(check 6 — deferred)*
For elements already named eyebrow/tag, the recipe (mono + uppercase + tracking `0.14–0.22em`) is fixed in `design-language.md` L3. The script does not verify it.

**How to judge:** when you author or touch an eyebrow/tag/section-index, cite the canonical recipe in `design-language.md` and match it — don't re-derive tracking/size. When migrating, check existing eyebrow/tag elements against the recipe by eye.

### Font-family  *(check 5 — dropped, not deferred)*
Evaluated and **dropped**: the only literal faces across the calibrated surfaces are introspect's IBM Plex Mono (a blessed mono substitute) and spexr's editor font (blessed). A font check would yield nothing. Just keep using `var(--sl-font-display|sans|mono)`; the only allowed substitution is a *narrower mono* where fixed pixel grids demand it (`design-language.md` L1), recorded as a blessed `font` deviation.

### Accent step derivation  *(check 7 — MECHANICAL as of v0.7.0)*
`design-language.md` §Decision 2 requires **every** accent step (`--sl-accent-hover/active/subtle`) to be a hue-relative expression off `--sl-accent-default` — `color-mix()` (Baseline) or `oklch(from var(--sl-accent-default) …)` relative colour (dark-active only) — never a bare literal that would leak the previous hue when a product overrides only the default. The relative-colour step carries a preceding baked-literal **fallback** line (for browsers below the relative-colour floor); that fallback is a legitimate bare-literal accent-step declaration because it is always paired with a following `oklch(...)`/`var(--sl-accent-default)` line for the same property.

`sl-audit` now checks this mechanically (`auditAccentDerivation`): an accent-step declaration whose value is a bare hex/`rgb()` is an **R-level `accent-derivation` finding** UNLESS (a) the same property is redeclared with a relative-colour expression later **in the same block** (the graceful-fallback pattern), or (b) the literal is an **intentionally tuned step registered in the product's `accent-registry.json` entry** (the "register instead of derive" path — a fixed-hue product like spexr whose steps don't fit the shared ratios; see §Decision 2). Everything else fails.

**Consequence for judgement:** you no longer eyeball this for the value itself — the script decides. What stays yours: deciding *whether a product should derive or register* its steps. Deriving is the default (keeps one-var re-hue). Registering literals is correct only when the steps are hand-tuned away from the shared ratios and the product's hue is fixed; when you register them, that same registry entry is what exempts them here.

## Structural / judgement rules the script never sees

These are always yours (the `sl-ds-auditor` subagent covers them by reading `design-language.md`), scoped to the substrate's Required column in `substrate-matrix.json`:

- **Missing** structural labels (eyebrow, section index, tag) where the substrate requires them.
- Hairline structure and the hairline-grid technique, gutter/ruler, section-index-leads-section.
- Signature components present and matching: inversion band, sticky translucent header, real-content blocks.
- **L5 editorial voice** — precise/technical, active, structure-encodes-truth, English identifiers.
- The house rule: ≥1 unexpected, intentional *composition* decision per screen (spend boldness on layout, keep materials shared).

> **Effects (L6) — entirely judgement.** `sl-audit` can verify that `effects.css` uses no colour literal, and `scripts/effects-js.test.mjs` closes the same hole for the driver. It cannot verify any of what actually matters:
> - **the right family for the right meaning** — a glitch on a passive container, or a liquid on something that is not interactive, is decoration, and Decision 1 forbids it; a text button is a glass pane (`sl-fx-glass--pane`), never gooey, and `sl-fx-liquid--drop` goes on a round icon-only button alone;
> - **the budget** — more than one ambient `data-sl-fx-live="on"` per document, or four families stacked on one component;
> - **the focus ring** — an aurora that replaced the `outline` instead of sitting inside the border band;
> - **the ARIA** — a `busy` or determinate aurora without `aria-busy` / `role="progressbar"`, which leaves reduced-motion and high-contrast visitors with no state at all;
> - **the paint-layer budget** — a glitch put on the component instead of on a child span, which silently drops the edge or the aurora's wash.
>
> Judge these by reading the surface against `design-language.md` L6 and `docs/specs/2026-09-08-effects-layer-design.md`.

## If you think a deferred check should become mechanical

That is a human decision (see the spec's "Open decisions"), because it requires committing to a blessing policy for the legitimate off-scale/2px cases above. Don't add the check to `sl-audit.mjs` on your own initiative — raise it, with the specific reference example it would flag, and let the human decide.
