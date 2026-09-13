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
| **introspect** | `#0e9c84` / `#2ee6c0` | introspect `--cy` | Teal-to-mint cyan, per theme. Registered as its product accent; not required to match the default's `depth` teal `#35A0B4` (`depth` constrains the default product, not cyan-accented ones). Its secondary sky-blue (`--cy2`) is **not** a second accent — it maps to `--sl-status-info`. |
| **local-agents** | `#1d63d8` / `#58a6ff` | local-agents `--accent-coder` | Coder-blue, per theme. The de-facto primary accent (`--accent-coder → var(--sl-accent-default)`); its rgb() literals matched the pre-adoption values exactly, so tints derive via `color-mix` with no registered steps. The other three agent hues (creative/home/system) are a blessed **categorical identity**, not a second accent (`--sl-viz-*` was rejected: they carry theme-distinct pairs). |

Machine values of this table: `packages/ui-kit/agent/accent-registry.json` (consumed by the compliance audit). The table above stays authoritative for the reasoning; `scripts/accent-registry.test.mjs` asserts product-set parity between the two.

Rule: a product picks **one** accent hue and derives hover/active/subtle from it; it never introduces a second chromatic accent. **Derivation is concrete and complete:** the generator emits **every** accent step as a hue-relative expression off `--sl-accent-default`, so a product override that sets **only the hue** re-derives the whole family (the one-var contract — no step is a bare literal that could leak the previous hue). Two forms: `color-mix()` off `--sl-accent-default` for steps a straight mix reproduces (hover everywhere, subtle everywhere, light/HC active), and CSS **relative colour** — `oklch(from var(--sl-accent-default) calc(l * k) calc(c * s) h)` — for a step whose hand-tune a mix can't reach while preserving hue (dark-active, whose value carries a slight chroma/hue shift; `color-mix` in sRGB would leave it fixed and off-hue for other products). The relative-colour step also emits a preceding baked-literal declaration as a graceful fallback for browsers below the relative-colour floor (Safari 16.4 / Chrome 119 / Firefox 128); `color-mix` itself is Baseline. The audit enforces this mechanically as of ui-kit v0.7.0 (`auditAccentDerivation`, an R-level `accent-derivation` finding): a bare-literal accent step is a defect unless it is a graceful fallback (redeclared with a relative-colour expression in the same block) or a step registered in the product's `accent-registry.json` entry — the "register instead of derive" path for a fixed-hue product whose steps don't fit the shared ratios (see `packages/ui-kit/agent/HANDOFF.md`). Semantic status colours (ok/warn/err) are separate from the accent and shared — but the `--sl-status-*` tokens are tuned for **on-canvas** use. On an inverted surface (a block whose background is the strongest neutral, e.g. an ink-on-paper output panel) they lose contrast; there, derive an on-ink status pair locally rather than using the canvas tokens (daos `.artifact .ok`/`.no` are a correct instance of this — kept as light-on-ink greens/reds, not swapped to the darker canvas tokens).

## Decision 3 — Data-viz & code palettes

Two shared palettes that are **not** brand accents and must never track the product hue: a categorical data-viz ramp and a syntax-highlight set. Both were per-product literals until they recurred across ≥2 products (spexr + introspect), which is the New-token-policy threshold for promotion.

- **`--sl-viz-0..7`** — a categorical ramp of eight distinct hues for arbitrary series / one-colour-per-item (an agent-monitoring wall, per-event-kind tinting). **Theme-independent** (shipped once in `tokens.css`); the consumer places the hues on its own surface. It is independent of `--sl-accent-*` and carries no semantic meaning — for *semantic* state (error, warning) use `--sl-status-*`, not a viz slot.
- **`--sl-code-<role>`** — the syntax-highlight palette (`fg`, `comment`, `keyword`, `string`, `number`, `boolean`, `function`, `tag`, `builtin`, `null`). Canonical = **atom-one**, emitted **per theme** (light + dark). High-contrast is intentionally omitted — syntax is undefined there and consumers fall back. A code token stays semantically stable and readable; it does not re-hue per product.

**Adopters:** spexr (darkfactory categorical wall → `--sl-viz-*`; atom-one hljs → `--sl-code-*`), introspect (agent-event-kind tints → `--sl-viz-*`, with error/warning routed to `--sl-status-*`; JSON view → `--sl-code-*`). Machine values live in `sondalab.tokens.json` (`shared.viz`, `code.{light,dark}`); the audit allowlists them automatically because they ship in `tokens.css` / `themes/*.css`.

## The family-resemblance layer

Each rule below carries a **compliance level per substrate** (see the matrix). Layout rules are expressed as **invariants** (a spacing scale, a rule weight, a measure, a type-scale relationship) — never as fixed templates — so a data-grid app with hard pixel columns can satisfy them as readily as a marketing page.

### L1 — Type treatment

- **Three roles, fixed pairing.** Display/serif = `--sl-font-display` (Fraunces); body/UI sans = `--sl-font-sans` (Instrument Sans); mono = `--sl-font-mono` (Martian Mono). A surface may substitute the *mono* face for a narrower one where fixed pixel grids demand it (introspect keeps IBM Plex Mono; Martian is materially wider and overflows `ch`-clamped columns) — this is an `adapt`, not a violation, provided the substitute stays monospace and the sans/display roles are unchanged.
- **Structural labels are mono, uppercase, wide-tracked.** Eyebrows, section indices, meta, wordmark, badges, tags: `--sl-font-mono`, `text-transform: uppercase`, `letter-spacing` in the `0.14em–0.22em` band, size `--sl-text-xs`. This mono-label motif is the single strongest family signal — a surface reads as Sondalab primarily through it. **The rule is about role, not size:** `--sl-text-xs` is where these labels usually land, not a bound on the rule — see the display-scale numeral bullet below.
- **Headings.** `font-weight: 600`, `text-wrap: balance`, `letter-spacing: -0.02em`, `line-height: --sl-line-tight`. Sizes step off the shared scale (`--sl-text-xl`/`--sl-text-2xl`) for in-flow headings.
- **Oversized display is a structural element, used sparingly.** Hero/anchor headings scale beyond the fixed token scale via a fluid clamp (pattern: `clamp(2.7rem, 1.6rem + 5vw, 5.4rem)`), not a token — the size is fluid, so it is a documented pattern, not a `--sl-text-*` addition. At most one oversized anchor per screen.
- **A display-scale numeral is a structural label, and it stays mono.** A section index, a card's folio, a step number: these are the same motif as the eyebrow, so they take `--sl-font-mono` whatever their size. A display serif at that scale is a defensible editorial folio in general, and it is the wrong voice here — mono at display scale is part of the suite's tech register, not merely a label convention (owner's ruling, 2026-09-13, after Fraunces at `opsz` 144 was tried on the method cards and rejected). Where such a numeral wants to be more than a hairline tick, spend the variation on **shape and colour, never on the face**: clip the brand pair to the glyphs, cut them out of a material, outline and offset a second copy behind them. Martian Mono's slashed zero is doing most of the work and should be left to.
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
- **Monogram (avatar)** — where the wordmark is too wide to read (social profile pictures, square tiles), the mark contracts to `s.` in the same Fraunces cut and tracking, letter in the theme's primary text colour and the period in the accent, on a full-bleed square tile of the theme's surface. Three fixed corrections, all for the small end of the scale: the mark is sized to the inscribed crop circle (~60% of the canvas wide) rather than the square; the accent period is scaled +35% around its own centre so it survives a 32px render; and it is pushed +0.06em off the letter, because the wordmark's tight tracking is drawn for a period at its natural size. Rendered assets: `packages/ui-kit/assets/sondalab-avatar-{ink,paper}.{svg,png}`.
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

### L6 — Effects & material

- **Five families, one meaning each.** Glitch means *something re-resolved* — a value changes, a destructive action is confirmed, validation fails. Liquid means *you are recognised* — it answers pointer proximity and re-solidifies the moment the pointer leaves. Aurora means *attention lives here* — focus, an active tab, a running operation, the primary call to action. Glass means *this is a physical surface*, a state rather than an event: a card edge, a field, a keycap. Goo means *these belong to one another* — it marks a set, and it answers the layout rather than the pointer. A family never fires outside the meaning it owns.
- **An effect that means nothing is switched off.** This is L5 ("structure encodes truth") applied to motion: glitch is never ambient on a control, liquid never fires without a pointer, aurora never marks something that is not currently the focus of attention, glass never animates on its own — its reflection moves, the way a mirror's does; the edge does not.
- **The reference is https://libraries.dev/, and its lesson is scale.** Everything there is one or two pixels wide, low in opacity, and fades within a few tens of pixels. Effects spend their budget on *light and shape*, never on *weight*: a structural separator stays `1px` whatever an effect is doing to it, the chrome is a hairline on the border the component already has, the aurora is a 1px arc with bloom rather than a band, and the liquid deforms the silhouette the component declared — through a filter over the rendered result, never by rewriting a declared value, so a surface stays free to re-parametrise its own radius without touching the effect.
- **Glass is chrome on the element's own border.** A hairline exactly as wide as the border (a borderless element gets 1px), reflecting a moving environment: bright and dark bands at high contrast, the product's hue as pastel flecks between them — never as a tint over the whole ring. One soft halo wanders slowly around the edge; the ring brightens under the cursor; its environment falls faintly onto the near edge of whatever effect element stands within a few pixels of it, the way a mirror's does. Its two poles are placed around the page's own ground — on ink between the ground and the theme's brightest neutral, on paper between white and a mid grey, never black, which reads as dirt on a light page. This is what the GPU is for, and the only thing it is for; where WebGPU does not answer, the same border carries a static conic hairline that must stay correct on its own. **Every text button, primary or ghost, is a pane** (`--pane`) — made of glass, not merely edged with it: a slab of light under the label (a glint along the top, a shade along the bottom, a 1px rim inside the edge), a glint that follows the pointer, and a hairline that turns to face the pointer fringed with the accent on one side and the depth companion on the other — dispersion, which is what refraction looks like on an edge. The label is never refracted; nothing behind the button is bent. On paper the pointer's glint is colour, not white: a white glint on cream is invisible, and the reference's own light preset composites its light with multiply and saturation.
- **The aurora is light, and it is CSS.** The border-beam: a 1px arc riding the border — the accent's depth companion at the tails, the accent along it, a white-hot core — with a bloom of the same light that peaks on the edge and falls away on both sides of it, outside the element as much as inside. Light is never truncated: an aurora element sits under no ancestor that clips (`overflow` other than `visible`, `contain: paint`, `clip-path`) — a scroll container wraps the table, not the card beside it, and a grid separates its cells with `gap`. Its hue drifts a little either side of the accent while it sweeps. Four readings, separated by the *fraction of the perimeter lit* and never by colour or speed: static on focus (~70%), sweep for ambient liveness (~70%, one turn per 3.2s), busy while real work runs (18%, one turn per 1.1s), determinate when the arc length *is* the value. It inhabits an edge that already exists — a second concentric ring would stack the border, the aurora and the focus `outline` into an unreadable sandwich — and where the edge is not a ring (a tab's underline, a link's, an inversion band's top rule) it is linear. A filled element has no edge to inhabit, so there the arc steps just outside the fill (`--rim`), in the accent's depth companion rather than the accent the fill is made of, and a busy filled control keeps full opacity: it is working, not unavailable.
- **The liquid deforms the silhouette, never the content.** Under the pointer the outline swells — a gentle outward bulge, a few pixels, that follows the cursor with a little lag, a drop welded onto the element's own rounded box with a soft neck, the way the reference's gooey pieces merge; released, it springs back, overshoots and settles. The text is never filtered: the swell is a skin drawn below the content in the element's own fill and border colours, present only while the pointer shapes the element, and nothing about the element is changed afterwards — the radius is read, never written; non-destructive is a contract. Where the element is also glass, the chrome welds the same drop onto the same box. It reads as a very light gooey, not as a lens. One element deforms at a time. Never on a text field, and never on a text button: the deformation belongs to a round silhouette — a round icon-only button takes it through `--drop`, and the modifier written in the markup is the contract; nothing measures a radius to decide. A container takes no swell at all: one yielding under the pointer reads as a toy.
- **The goo welds neighbours; it does not answer the pointer.** Where the liquid deforms one element under the cursor, the goo states that several elements are *one substance*: a declared container owns a single silhouette layer, each marked member contributes its own rounded box to it, and members that come within a declared gap of one another grow a soft neck between them. It is static — laid out, not animated — because belonging is a property of the layout and not an event. Two silhouettes can only weld if they share a filter coordinate space, which is why the container owns the layer and why the family is not a looser gate on the liquid. The content is never filtered here either: the members ride crisp on top, and each silhouette is painted in its own member's fill, so where two weld their colours run into one another across the neck. A member that has welded gives up its own border *and its own background*, and the substance paints it — an outline drawn across a merged shape reads as a card stacked on a blob, and an opaque rectangular box covering a neighbour's substance reads as boxes stepped over one another rather than as drops merging; the member keeps its text. One standing alone keeps both. A member with no fill of its own contributes the field's declared substance rather than a hole in it. A **form control or a link is never a member**: it paints its own chrome through layers this family does not own, so a welded control keeps an outline the substance was meant to replace, and its own affordance is worth more than the merge. Standard elements only; where a member must be operable, an element that paints nothing of its own and carries the semantics through `role` and a tab stop. The author binds the *gap* at which two members weld — a distance readable off their own layout — never the blur behind it, and that distance is spent on dilation first: dilation preserves an outline where blur melts it, so a substance whose whole budget went into blur reads as melted rather than as a material. Members may move, and a substance that stayed where its member used to be would deny the claim the family makes. Light is not truncated and neither is a substance: the goo reaches past the outermost member, so the same no-clipping rule the aurora carries applies to the container, one scale up.
- **The aurora renders state; it never *is* the state.** A busy aurora requires the element to carry `aria-busy="true"`; a determinate one requires `role="progressbar"` with `aria-valuenow`. A screen-reader user, a reduced-motion visitor and a high-contrast visitor all get the state from the markup; the aurora is how the state looks, not where it lives.
- **The effect budget: at most one ambient aurora, one glitch burst and one deforming element, per document, at a time.** A later aurora request wins and the pre-empted element falls back to its resting edge; a later glitch burst is dropped, not queued. Busy auroras are exempt — they are bound to real work, and several can legitimately run at once.
- **Three kill switches, all hard requirements.** `prefers-reduced-motion: reduce` (nothing animates; static material survives, and the chrome stops its environment, its halo and its swell — a product with a *documented* reason may keep the glitch animating, and only the glitch, by taking the derogation explicitly), `[data-sl-theme="high-contrast"]` (every family off, the GPU field torn down), and `data-sl-fx="off"` on any element (that element and its subtree, at every tier). No effect ever replaces or removes the focus `outline`.
- **Classes are additive, colour is derived.** `.sl-fx-*` composes onto a shipped `.sl-*` class and never replaces it. Every hue is `color-mix()` over a role-var in CSS, or a token read at runtime and passed as a uniform in JavaScript and WGSL — no literal, anywhere, ever.

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
| L6 glass edge | N/A | A | R | N/A |
| L6 aurora | N/A | A | R | N/A |
| L6 liquid | N/A | A | A | N/A |
| L6 goo | N/A | A | A | N/A |
| L6 glitch | N/A | A | A | N/A |
| L6 effect budget | N/A | R | R | N/A |

L6 is `N/A` on IDE by default: the host chrome is fixed and `effects.css` is a separate import, so declining it costs nothing. A spexr panel that deliberately imports it is then held to the App column.

## Reconciling shared grammar with "one unexpected layout decision per screen"

The house aesthetic (personal `CLAUDE.md`, UI Aesthetics) requires ≥1 unexpected, intentional layout decision per screen. That does **not** conflict with this shared grammar: the grammar fixes the *materials* (type roles, spacing scale, rule weight, motifs, motion, voice), while the surprise is spent on *composition* (an asymmetric split, an oversized anchor, a full-bleed inversion, an unexpected adjacency). Family resemblance comes from shared materials; distinctiveness comes from per-screen composition. A screen that satisfies the grammar but reads as a generic centred card grid has failed the house rule; a screen that invents a new type scale or a second accent to be "surprising" has failed the grammar. Spend boldness on layout, keep the materials shared.

## New-token policy

Express the language in **existing** `--sl-*` tokens. A new token forces regenerating `packages/`, satisfying `check-drift.yml`, and bumping **both** `packages/ui-kit/package.json` and `packages/palette-py/pyproject.toml` in the same PR (see `AGENTS.md`). Therefore:

- **Kept as conventions, not tokens** (layout-level, fluid, or product-local): `--sl-measure` (~63ch), `--sl-gutter` (fluid clamp), the oversized-display clamp pattern. Products define these locally with the canonical values above.
- **A new token is justified only** for a genuine shared, fixed value that recurs across ≥2 products and cannot be a convention — and then it goes through the full regen + dual-bump flow. Realized instance: the `--sl-viz-*` / `--sl-code-*` palettes (Decision 3), promoted once spexr and introspect both needed them.

## Pass-1 application (scope & order)

Full task breakdown lives in the implementation plan (writing-plans). Order (daos is the source, so it is extracted-from first and re-based later, once the language is written):

1. **Extract from daos** → this spec. *(Done at authoring.)*
2. **Write this spec** (`design-language.md`). *(This file.)*
3. **sondalab-ui showcase** — a page that renders the tokens + L3 signature components against this spec. Proves the language at zero user-facing risk. Status target: **PoC implemented (not delivered)**.
4. **Re-baseline daos landing** — swap its local palette vars onto Sondalab values (Tier B), align accent to the registry, mono-label/measure already conformant. Low risk; aesthetics already correct.
5. **introspect** — apply beyond the type swap: mono structural labels, hairline structure, section indices, signature header, editorial voice. Most work, most regression surface; done last.

spexr is out of pass 1 (token + chrome already delivered); its remaining margin is L3 signature components inside SPEXR panels, tracked separately.
