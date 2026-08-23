# Sondalab Design Language — Family-Resemblance Spec

> **What this file is:** the family-resemblance rules that sit *above* the token contract — the shared grammar of layout, graphic motifs, type treatment, and editorial voice that makes every Sondalab surface (spexr, introspect, daos, future products) read as one package. Where `design-system-spec.md` is the machine contract (the canonical `--sl-*`/terminal values and their generators), this file is the human contract (how to *use* those values so products look related without looking identical).
> **Audience:** engineers and designers building or migrating any Sondalab UI surface; reviewers checking cross-product coherence.
> **Owner:** marcellobarile.
> **Companion files:** `design-system-spec.md` (token contract — the values this language spends), `design-system-plan.md` (token pipeline build sequence), the identity board artifact `https://claude.ai/code/artifact/abbebb7f-5778-4af6-a9b4-2b3f169ae20f` (visual thesis). The per-product application of this language is tracked in a separate implementation plan (writing-plans), not here.

## Legend (status vocabulary)

- **Shipped / Delivered** — merged to the surface's production codebase, available to users.
- **PoC implemented (not delivered)** — built as a prototype, not merged/released.
- **Placeholder (not delivered)** — stub or scaffold only.

At authoring time (2026-08-22): spexr consumes the token architecture (delivered); introspect has adopted the shared type (delivered, type-only); daos landing and the sondalab-ui showcase are **not delivered** (this language spec is design only until the pass-1 plan lands).

## Why this exists

Colour and type harmonisation alone (phase 2 tokens) does not make products feel like one suite. introspect after its type swap still "looks the same" because the values converged but the *grammar* did not: the same accent and font can carry two unrelated layouts. This document codifies the grammar — the reusable editorial decisions — so a new product (or a reviewer) can achieve family resemblance without re-deriving it.

The reference implementation is **daos landing** (`daos/docs/daos-landing.html`): it already expresses the intended editorial modernism (hairline structure, mono structural labels, oversized display type, inversion bands, real content over marketing copy). This spec extracts daos's vocabulary and generalises it; daos is the *source*, not the first target.

## Decision 1 — Theme selector policy (two tiers)

Products reach Sondalab colour through one of two blessed patterns. This was previously decided twice, inconsistently (spexr uses `data-sl-theme`; introspect and daos use `[data-theme]`); it is now a policy keyed on substrate, not an ad-hoc per-product call.

- **Tier A — full theme adoption.** Set `data-sl-theme="light|dark|high-contrast"` on the root and consume the generated theme layer (`themes/*.css`) wholesale. Best for greenfield surfaces and chrome-heavy hosts that need every neutral. **Adopter:** spexr (its Theia chrome needs the full neutral set; see `spexr-theme-contribution.ts`).
- **Tier B — shared-root adoption.** Vendor only the shared `:root` layer of the token CSS (`--sl-*` type/space/radius/motion/etc., theme-independent). The product keeps its own `[data-theme]` colour layer, but **every colour value in that layer must resolve to a Sondalab value** (a product token equals an `--sl-*` value or an accent-registry value; no free-floating hex). Best for surfaces with an existing editorial palette. **Adopters:** introspect, daos.

**Why not one tier:** the generated theme layer is scoped `[data-sl-theme]`; a product on `[data-theme]` can never match that selector, so forcing Tier A on introspect/daos would mean rewriting their working colour layers for no visual gain. Tier B keeps their selector and pins their *values*.

**Compliance test (both tiers):** open the surface, sample any surface/text/accent colour, and confirm it equals a value in `sondalab.tokens.json` or the accent registry below. Tier is an implementation detail; value-equality is the invariant.

**Migration note (the loser):** Tier B is the default for products with a pre-existing palette. A Tier-B product should migrate to Tier A only if it later drops its own colour layer entirely (unlikely for introspect/daos). No forced migration.

## Decision 2 — Product accent registry

Shared grammar, per-product accent. The brand default is amber (with a teal *depth* companion); each product may override the accent hue only. Everything else (neutrals, type, spacing, motion) is shared.

| Product | Accent (light / dark) | Source | Note |
|---|---|---|---|
| **Sondalab default / daos** | `#B56A0C` / `#F5A83C` (depth `#14606C` / `#35A0B4`) | `sondalab.tokens.json` `accent.*.default` | daos re-baselines from its near-amber `#9a6a15`/`#d29a44` to the exact token values. |
| **spexr** | `#5b6cff` / `#8b96ff` | `spexr-overrides.css` | Delivered. |
| **introspect** | `#2ee6c0` (single) | introspect `--cy` | ⚠ Differs from the Sondalab teal depth `#35A0B4`. **Resolved:** introspect's brighter mint-cyan is registered as its product accent (kept); it is not required to match `depth`. `depth` is the *default* product's teal, not a constraint on cyan-accented products. |

Rule: a product picks **one** accent hue and derives hover/active/subtle from it; it never introduces a second chromatic accent. Semantic status colours (ok/warn/err) are separate from the accent and shared — but the `--sl-status-*` tokens are tuned for **on-canvas** use. On an inverted surface (a block whose background is the strongest neutral, e.g. an ink-on-paper output panel) they lose contrast; there, derive an on-ink status pair locally rather than using the canvas tokens (daos `.artifact .ok`/`.no` are a correct instance of this — kept as light-on-ink greens/reds, not swapped to the darker canvas tokens).

## The family-resemblance layer

Each rule below carries a **compliance level per substrate** (see the matrix). Layout rules are expressed as **invariants** (a spacing scale, a rule weight, a measure, a type-scale relationship) — never as fixed templates — so a data-grid app with hard pixel columns can satisfy them as readily as a marketing page.

### L1 — Type treatment

- **Three roles, fixed pairing.** Display/serif = `--sl-font-display` (Fraunces); body/UI sans = `--sl-font-sans` (Instrument Sans); mono = `--sl-font-mono` (Martian Mono). A surface may substitute the *mono* face for a narrower one where fixed pixel grids demand it (introspect keeps IBM Plex Mono; Martian is materially wider and overflows `ch`-clamped columns) — this is an `adapt`, not a violation, provided the substitute stays monospace and the sans/display roles are unchanged.
- **Structural labels are mono, uppercase, wide-tracked.** Eyebrows, section indices, meta, wordmark, badges, tags: `--sl-font-mono`, `text-transform: uppercase`, `letter-spacing` in the `0.14em–0.22em` band, size `--sl-text-xs`. This mono-label motif is the single strongest family signal — a surface reads as Sondalab primarily through it.
- **Headings.** `font-weight: 600`, `text-wrap: balance`, `letter-spacing: -0.02em`, `line-height: --sl-line-tight`. Sizes step off the shared scale (`--sl-text-xl`/`--sl-text-2xl`) for in-flow headings.
- **Oversized display is a structural element, used sparingly.** Hero/anchor headings scale beyond the fixed token scale via a fluid clamp (pattern: `clamp(2.7rem, 1.6rem + 5vw, 5.4rem)`), not a token — the size is fluid, so it is a documented pattern, not a `--sl-text-*` addition. At most one oversized anchor per screen.
- **Body measure.** Running text is capped at ~`63ch` (convention var `--sl-measure: 63ch`, defined locally — not a token, it is layout-level). Never let prose run full-bleed.

### L2 — Structure & spacing

- **Spacing rhythm off the scale.** All gaps/padding step off `--sl-space-*` (0.25rem base). No arbitrary spacing values in new work.
- **Hairline structure.** Structural separation is a single `1px` rule in the theme's line colour — section tops, header/footer borders, card edges, gutter rulers. Weight is always `1px`; no heavy borders, no drop-shadow-as-separator (shadows are reserved for genuinely floating surfaces via `--sl-shadow-*`).
- **Hairline grid technique.** Card grids are formed by a `1px` gap over a line-colour background (`display: grid; gap: 1px; background: <line>`), cells painting their own surface — producing crisp shared rules between cells instead of doubled borders. This is a signature; prefer it over bordered-card grids (which the house style otherwise avoids).
- **Gutter & ruler.** Content sits in a max-width wrap (`~78rem`) with a fluid gutter (`clamp(1.25rem, 5vw, 6rem)`, convention var `--sl-gutter`); on wide viewports a `1px` vertical ruler at the gutter edge is an optional editorial accent.
- **Sections lead with an index.** A section opens with a mono `sec-idx` label (numbered where the content is genuinely a sequence — see the structure-is-information rule) beside its heading, separated from the previous section by a `1px` top rule.

### L3 — Signature components

These recurring parts carry the family look. A surface need not use all, but any it does use should match:

- **Wordmark (official logo)** — the brand is typographic, no pictorial mark. Primary: `sondalab.` set in `--sl-font-display` (Fraunces) weight 500, `letter-spacing: -0.05em`, with the trailing period in the accent (`.dot { color: accent }`). Compact lockup (headers, tight spots): `sonda·lab` in `--sl-font-mono`, uppercase, tracked `0.2em`, with the middle dot in the accent. Source of truth: the identity board artifact `https://claude.ai/code/artifact/abbebb7f-5778-4af6-a9b4-2b3f169ae20f`; reference implementation: `sondalab-ui/showcase/index.html` (`.brand-word` hero + `.wordmark` header).
- **Eyebrow** — mono uppercase micro-label above a heading (`--sl-text-xs`, tracked `0.22em`, muted).
- **Tag / tier marker** — inline mono uppercase pill: `1px` border in a soft accent tint, small dot or square glyph before the label, accent-coloured text. Used for status/classification.
- **Inversion band** — a full-width block flipped to `text-on-*` on the strongest neutral (ink background, paper text), used to punctuate rhythm and mark the thesis or primary call-to-action. The recurring inversion is a core motif; at least one per long page is idiomatic.
- **Sticky translucent header** — `position: sticky`, background `color-mix(paper 86%, transparent)` + `backdrop-filter: blur()`, `1px` bottom rule; brand wordmark (mono, tracked) left, mono meta/controls right.
- **Real-content blocks** — where a surface shows output (JSON, terminal, code, data rows), show *actual* content in mono on the ink surface, not illustrative filler. This is both an editorial-voice rule and a visual one.

**Canonical recipe — eyebrow + tag.** These two are the strongest family signal, so their values are fixed here (a convention, like `--sl-measure`; not a token, because products bind them to their own local colour vars). Every implementation cites this recipe rather than re-deriving it; a product substitutes its own token names for the roles in brackets.

```css
/* eyebrow — mono uppercase micro-label */
.eyebrow {
  font-family: var(--sl-font-mono);          /* or the product's mono face */
  font-size: var(--sl-text-xs);              /* ~9.5–11px in px-scaled UIs */
  letter-spacing: 0.2em;                      /* band 0.18–0.22em */
  text-transform: uppercase;
  color: [text-muted];
}
/* tag / tier marker — accent-tinted pill with a leading dot */
.tag {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--sl-font-mono);
  font-size: var(--sl-text-xs); font-weight: 500;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: [accent];
  border: 1px solid [accent-subtle];
  background: [accent-subtle];
  padding: 3px 7px; line-height: 1;
}
.tag::before { content: ""; width: 5px; height: 5px; border-radius: 50%; background: [accent]; flex: none; }
```

Current citations: introspect `.sl-eyebrow`/`.sl-tag` in `introspect/web/src/theme.css`; spexr `.spexr-agent-chat__label`, `.spexr-spec-resources__caption`, and `.spexr-df-card__status` in `packages/theia-extensions/src/browser/style/spexr.css` — these adopt the **eyebrow** half of the recipe (mono uppercase tracked, via spexr's `--sl-font-code`). spexr has **not** adopted the tag/pill half; its existing status pills `.spexr-df-pill--attn/--error` are untouched. In spexr the eyebrow face is the design mono `--sl-font-code`, deliberately distinct from code-content runs (`.spexr-df-card__branch`/`__trail`, which mirror the editor font `--theia-code-font-family`): labels are design-layer, code content mirrors the editor.

### L4 — Motion

- **One easing, three speeds.** All transitions use `--sl-motion-ease` with `--sl-motion-fast|mid|slow`. Entrance reveals use a small rise (`translateY(~6px)` + opacity) on `--sl-motion-mid|slow`.
- **Stagger, don't fade-everything.** Where multiple related elements enter, stagger them (nth-child delays) rather than fading the whole screen at once.
- **Respect reduced motion.** The token layer already zeroes durations under `prefers-reduced-motion`; never re-introduce motion that bypasses the tokens.
- **Interaction, not opacity.** Hover/focus states change colour/border/background meaningfully; `hover:opacity` alone is not a state.

### L5 — Editorial voice (copy)

- **Precise and technical, never marketing.** Name things by what they are and do. Prefer a real measured figure or executed output to an adjective.
- **Active voice; controls state their effect.** A button says what happens; its confirmation says it happened.
- **Structure encodes truth.** Numbered markers, eyebrows, dividers appear only where they reflect something real (an actual sequence, a real classification) — not as decoration.
- **English for product copy and all identifiers**, matching the suite.

## Per-substrate compliance matrix

Substrates: **IDE** (fixed-chrome host, e.g. spexr in Theia), **App** (data-grid web app, e.g. introspect), **Page** (marketing/landing, e.g. daos), **Term** (terminal/CLI, e.g. smartctx). Levels: **R** required · **A** adapt (honour the intent within substrate limits) · **N/A** not applicable.

| Rule | IDE | App | Page | Term |
|---|---|---|---|---|
| Theme selector (Tier A/B) | R (A) | R (B) | R (B) | N/A |
| Accent registry (one hue) | R | R | R | R (roles) |
| L1 type roles (display/sans/mono) | R | A (mono sub allowed) | R | A (mono only) |
| L1 mono uppercase structural labels | R | R | R | A (dim/caps where ANSI allows) |
| L1 heading treatment | A (host headings limited) | R | R | N/A |
| L1 oversized display anchor | N/A | A (where a hero exists) | R | N/A |
| L1 body measure ~63ch | A | R | R | R (wrap width) |
| L2 spacing off `--sl-space-*` | R | R | R | A (char cells) |
| L2 hairline `1px` structure | A (host chrome fixed) | R | R | A (box-drawing rules) |
| L2 hairline-grid technique | N/A | R | R | N/A |
| L2 gutter/ruler | N/A | A | R | N/A |
| L2 section index | N/A | A | R | N/A |
| L3 eyebrow / tag / tier | A | R | R | A |
| L3 inversion band | N/A | A | R | A (inverse video attribute) |
| L3 sticky translucent header | N/A | R | R | N/A |
| L3 real-content blocks | R | R | R | R |
| L4 motion (ease/speeds/stagger) | A | R | R | N/A |
| L4 reduced-motion respect | R | R | R | N/A |
| L5 editorial voice | R | R | R | R |

## Reconciling shared grammar with "one unexpected layout decision per screen"

The house aesthetic (personal `CLAUDE.md`, UI Aesthetics) requires ≥1 unexpected, intentional layout decision per screen. That does **not** conflict with this shared grammar: the grammar fixes the *materials* (type roles, spacing scale, rule weight, motifs, motion, voice), while the surprise is spent on *composition* (an asymmetric split, an oversized anchor, a full-bleed inversion, an unexpected adjacency). Family resemblance comes from shared materials; distinctiveness comes from per-screen composition. A screen that satisfies the grammar but reads as a generic centred card grid has failed the house rule; a screen that invents a new type scale or a second accent to be "surprising" has failed the grammar. Spend boldness on layout, keep the materials shared.

## New-token policy

Express the language in **existing** `--sl-*` tokens. A new token forces regenerating `packages/`, satisfying `check-drift.yml`, and bumping **both** `packages/ui-kit/package.json` and `packages/palette-py/pyproject.toml` in the same PR (see `AGENTS.md`). Therefore:

- **Kept as conventions, not tokens** (layout-level, fluid, or product-local): `--sl-measure` (~63ch), `--sl-gutter` (fluid clamp), the oversized-display clamp pattern. Products define these locally with the canonical values above.
- **A new token is justified only** for a genuine shared, fixed, theme-independent value that recurs across ≥2 products and cannot be a convention — and then it goes through the full regen + dual-bump flow.

## Pass-1 application (scope & order)

Full task breakdown lives in the implementation plan (writing-plans). Order (daos is the source, so it is extracted-from first and re-based later, once the language is written):

1. **Extract from daos** → this spec. *(Done at authoring.)*
2. **Write this spec** (`design-language.md`). *(This file.)*
3. **sondalab-ui showcase** — a page that renders the tokens + L3 signature components against this spec. Proves the language at zero user-facing risk. Status target: **PoC implemented (not delivered)**.
4. **Re-baseline daos landing** — swap its local palette vars onto Sondalab values (Tier B), align accent to the registry, mono-label/measure already conformant. Low risk; aesthetics already correct.
5. **introspect** — apply beyond the type swap: mono structural labels, hairline structure, section indices, signature header, editorial voice. Most work, most regression surface; done last.

spexr is out of pass 1 (token + chrome already delivered); its remaining margin is L3 signature components inside SPEXR panels, tracked separately.
