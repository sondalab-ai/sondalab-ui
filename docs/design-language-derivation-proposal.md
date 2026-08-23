# Proposal — Traceable accent derivations (`color-mix` off the hue)

> **What this file is:** a proposal (RFC) to change how the Sondalab accent *steps* (hover / active / subtle) are expressed — from baked per-theme hex values to `color-mix()` expressions derived from a single base hue. It is a decision document for the DS owner, not an implementation. Nothing here is shipped.
> **Audience:** the DS owner (decision), and engineers who would implement it (the token generator + `components.css` + the audit).
> **Owner:** marcellobarile.
> **Status:** **Proposal (not delivered).** Awaiting a decision on the open questions at the end.
> **Companion files:** `design-language.md` §Decision 2 (the accent registry rule this refines), `design-system-spec.md` (the token contract), `design-system-agentic-spec.md` (the audit that would gain a derivation check).

## Problem — three symptoms of one root cause

Today each accent step is a **baked value**: the generator emits `--sl-accent-hover/active/subtle` as fixed hex per theme, and a product override (or the showcase switcher) must set the whole family. Because the steps are free-floating values with no *syntactic* link to the base hue, three problems follow:

1. **The amber-leak class of bug.** An override that sets only `--sl-accent-default` leaves hover/active/subtle pointing at the previous (amber) values. This is exactly the bug fixed in the showcase switcher (PR #3) — but that fix was a *symptom patch* (make the switcher set every step). Any incomplete override, in any consumer, re-introduces it.
2. **Blessing noise.** `design-language.md` §Decision 2 says a product "derives hover/active/subtle from" its hue — but since the derived values are written as literals, the compliance audit can't tell a legitimate derivation from a rogue colour. They must be blessed per product, cluttering the allowlist.
3. **No mechanical derivation check.** Because there is no syntactic marker of "this is derived from the accent", the audit cannot verify that a product's steps actually track its hue. The derivation rule is stated in prose and enforced only by eye.

**Root cause:** the accent steps are *values*, not *expressions*. Making them expressions — `color-mix()` off the base hue — dissolves all three at once.

## Proposal

Express the accent steps as `color-mix()` derived from `--sl-accent-default`, emitted by the generator per theme:

```css
/* light theme (generated) */
--sl-accent-default: #B56A0C;
--sl-accent-hover:  color-mix(in srgb, var(--sl-accent-default) 89%, black);
--sl-accent-active: color-mix(in srgb, var(--sl-accent-default) 76%, black);
```

A product override then needs to set **only the hue**:

```css
[data-theme] { --sl-accent-default: #5b6cff; } /* spexr — hover/active re-derive */
```

The `sondalab.tokens.json` accent block changes from fixed per-step hex to a base hue plus a per-theme, per-step **mix recipe** (ratio + anchor). The generator emits the `color-mix()` expressions; the audit gains the ability to check that a step is a `color-mix()` off the accent var (not a literal).

## Does it reproduce the tuned values? (measured)

Reverse-fitting the current tuned steps to `color-mix(in srgb, <default> P%, <anchor>)` (see `scripts/` reverse-fit, run at authoring):

| Theme | Step | Tuned | Best `color-mix` | Δ (sRGB) |
|---|---|---|---|---|
| light | hover  | `#A05F0A` | `89%, black` → `#a15e0b` | **1.4** |
| light | active | `#8A5109` | `76%, black` → `#8a5109` | **0.6** |
| dark  | hover  | `#F7B863` | `80%, white` → `#f7b963` | **1.4** |
| dark  | active | `#E0942A` | `90%, black` → `#dd9736` | **12.9** |
| high-contrast | hover  | `#FFFFA0` | `37%, white` → `#ffffa1` | **0.7** |
| high-contrast | active | `#CCCC00` | `80%, black` → `#cccc00` | **0.0** |

**Five of six steps fit within Δ≈1.5 — imperceptible.** The anchor is theme-aware: light and HC-active darken toward black; dark-hover and HC-hover lighten toward white (a dark theme brightens its hover). Only **dark active** resists a simple mix (Δ12.9): its tuned value `#E0942A` carries a slight hue rotation a straight black-mix can't reproduce.

**Design consequence:** the generator emits a `color-mix()` for each step *unless* the token set gives an explicit tuned override for that (theme, step) — the escape hatch for dark-active and any future step where the fit is poor. Traceable everywhere the fit is good; tuned where it isn't. An explicit override is still a value the audit blesses once (in the token layer, not per product).

## Wrinkles (honest)

- **`subtle` is not a clean hue-mix.** Dark subtle `rgba(245,168,60,0.16)` *is* the default at 16% alpha (derivable as `color-mix(... default 16%, transparent)`). But **light** subtle `rgba(197,122,22,0.12)` uses a *lighter* base (`#c57a16`, not the default `#B56A0C`), and **high-contrast** subtle `#1a1a00` is opaque (not an alpha at all). So `subtle` can be derived in dark, needs an accepted small hue shift in light, and stays a tuned value in HC. Recommend: derive `subtle` where clean (dark), keep the tuned override elsewhere.
- **Browser support.** `color-mix(in srgb, …)` is Baseline (all current evergreen browsers, Safari 16.2+). For the substrates the DS targets (web apps, landing pages, Theia/Chromium) this is safe. A `@supports` fallback to the baked hex can be emitted if a consumer needs a legacy floor.
- **Tier-B products** keep their own colour layer; this proposal changes what the *generated* theme layer emits, which Tier-B products may or may not consume. The registry rule ("derive from one hue") applies to them either way — the win is that they too can write `color-mix()` off their accent var and become audit-traceable.
- **Perceptual sign-off.** Δ<1.5 is imperceptible, but the whole point of the tuned values was hand-tuning. The PoC (below) must get a visual OK across all three themes before this replaces the baked values.

## Benefits

- **Kills the amber-leak class at the source** — an override sets one var; every step re-derives. The PR #3 switcher patch becomes unnecessary.
- **Shrinks blessed allowlists** — derived steps are recognisably derived, not rogue literals.
- **Enables the deferred derivation check** — the audit can assert accent steps are `color-mix()` off the accent var, upgrading a prose rule to a mechanical one (the honest version of the checks deferred in `HANDOFF.md`).
- **One-var theming for consumers** — the cleanest possible override API.

## Scope & phasing

1. **Schema + generator.** Extend the `accent` block in `sondalab.tokens.json` to carry, per theme, a base hue + per-step mix recipe (ratio + anchor) with optional explicit overrides. Update `gen-css.mjs` to emit `color-mix()` (or the override). Regenerate `tokens.css`/`themes/*.css`. **Semver: minor** (backward-compatible — the emitted vars keep their names and resolve to the same colours within Δ<1.5; dark-active kept via override). If any consumer pins exact pixels, treat as **major**.
2. **`components.css` role-vars.** The `--slc-accent-*` fallbacks (currently baked amber literals) become `color-mix()` off `--slc-accent`, so even a bare `--sl-accent-default` override is safe without the theme layer.
3. **`design-language.md` rule.** Upgrade §Decision 2 from "derives … from it" (prose) to the concrete "accent steps are `color-mix()` off `--sl-accent-default`; a baked step value requires a token-layer override with a reason."
4. **Audit (optional, later).** Add a mechanical check: an accent step that is a literal (not `color-mix()`/`var()` off the accent) is a finding. This is the derivation check deferred in `HANDOFF.md`, now buildable because derivation has a syntactic marker.

## PoC plan (before any of the above lands)

Prove it on the **`default` product, one theme first (light)**, at zero user risk:

1. Emit the light-theme accent steps as `color-mix()` (hover 89% black, active 76% black) in a throwaway branch.
2. Render `showcase/index.html` (light) and eyeball the primary button hover/active + tag/ghost tints against the current baked values — a side-by-side.
3. Run the audit; confirm the derived steps read as accent-derived, not rogue.
4. If the light PoC is visually accepted, extend to dark (hover 80% white; active via **explicit override** `#E0942A`) and HC, then repeat the side-by-side.

Gate: a visual OK per theme from the owner before replacing the baked values. `subtle` decided per the wrinkle above.

## Open decisions (for the owner)

1. **Fit tolerance.** Accept Δ<1.5 as "identical" and derive those five steps, keeping **dark-active** (Δ12.9) as an explicit tuned override? (Recommended.) Or require exact reproduction everywhere (→ more overrides, less traceability)?
2. **`subtle`.** Derive where clean (dark), accept the small light-subtle hue shift, keep HC tuned? Or keep `subtle` fully tuned and out of scope for now?
3. **Audit derivation check.** Ship it as a **required** rule (a literal accent step is an R-violation) or keep it advisory (a judgement note) at first?
4. **Semver.** Minor (Δ<1.5, names unchanged) or major (any consumer pins exact accent-step pixels)?

Recommendation: **1 = accept Δ<1.5 + override dark-active; 2 = derive dark, tune light/HC subtle; 3 = advisory first, required after one release; 4 = minor.** This is the smallest change that dissolves all three symptoms while preserving the hand-tuned look where it actually diverges.
