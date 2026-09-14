# Component catalog — Sondalab DS (agent-facing)

> **What this file is:** a copy-paste catalog of Sondalab DS primitives, opt-in effects, and signature patterns, for an agent authoring a new interface. Each entry gives the canonical markup, the role-vars it consumes, its substrate applicability, and a do/don't. Snippets use only `var(--slc-*/--sl-*)` and `color-mix()` over those — never a colour literal — so every snippet here passes `sl-audit` by construction (`scripts/catalog-audit.test.mjs` enforces it).
> **Audience:** agents building or extending a Sondalab surface (author workflow); humans reviewing component usage.
> **How to use:** pick the component, copy the markup, bind it to your product's theme (Tier A: consume `@sondalab/ui-kit` `components.css` + a theme; Tier B: map the `--slc-*` role-vars to your local colour layer). Then run `sl-audit`. Effects (`## Effects`) are a separate, opt-in import — `packages/ui-kit/effects.css` (+ `effects.js` for Tier 1) — not part of `components.css`. The machine index is `catalog.json`.
> **Companion:** `README.md` (usage), `HANDOFF.md` (what the audit does not check), `./design-language.md` (the grammar these components express), `workflows/author.md` (the procedure that consumes this catalog).

The `--slc-*` role-vars (defined at the top of `components.css`) are the seam: components read them, and they resolve to `--sl-*` tokens (Tier A) or to your product's colour layer (Tier B). Never hardcode a colour into a component — bind the role-var.

## Primitives (ready classes in `components.css`)

### Eyebrow — `sl-eyebrow`
Mono uppercase micro-label above a heading. The single strongest family signal. Substrate: **R** on App/Page/IDE.
```html
<p class="sl-eyebrow">System status</p>
```
Consumes: `--slc-text-muted`, `--sl-font-mono`. Don't: sentence-case it or use a sans face.

### Tag / tier marker — `sl-tag` (`--plain`)
Accent-tinted pill with a leading dot; classification/status. Substrate: **R** App/Page.
```html
<span class="sl-tag">Delivered</span>
<span class="sl-tag sl-tag--plain">Draft</span>
```
Consumes: `--slc-accent`, `--slc-accent-subtle` (`--plain`: `--slc-text-muted`, `--slc-border`). Don't: introduce a second accent hue for tags.

### Button — `sl-btn` (`--primary` · `--ghost` · `--sm`)
Filled-accent primary or bordered ghost. Active/hover track the accent hue. Substrate: **R** App/IDE, **A** Page.
```html
<button class="sl-btn sl-btn--primary">Save changes</button>
<button class="sl-btn sl-btn--ghost">Cancel</button>
<button class="sl-btn sl-btn--primary sl-btn--sm">Add</button>
```
Consumes: `--slc-accent`, `--slc-accent-hover`, `--slc-accent-active`, `--slc-on-accent`, `--slc-border`, `--slc-text`. Do: state the effect in the label (L5 voice). Don't: use a default-blue CTA or `hover:opacity` as the only state.

### Link — `sl-link`
Underlined, accent on hover. Substrate: **R** App/Page.
```html
<a class="sl-link" href="/specs">read the spec</a>
```
Consumes: `--slc-accent`. Don't: remove the underline (leave the affordance).

### Badge — `sl-badge` (`--success` · `--warning` · `--danger` · `--info`)
Semantic status pill. Semantic colour is **independent of the accent hue** and shared. Substrate: **R** App/IDE.
```html
<span class="sl-badge sl-badge--success">Passing</span>
<span class="sl-badge sl-badge--danger">Failed</span>
```
One modifier per status: `--success`, `--warning`, `--danger`, `--info` — never a bare `sl-badge`.
Consumes: `--slc-success`, `--slc-warning`, `--slc-danger`, `--slc-info`. Don't: recolour a badge to the accent — status ≠ accent.

### Card — `sl-card` (`__title` · `__body`)
Surface panel. Substrate: **R** App.
```html
<article class="sl-card">
  <h3 class="sl-card__title">Migration report</h3>
  <div class="sl-card__body">2 R-violations resolved, 1 blessed.</div>
</article>
```
Consumes: `--slc-surface`, `--slc-border`, `--slc-text`, `--slc-text-secondary`. Don't: make a `rounded-lg` card grid the primary layout — prefer the hairline grid (below).

### Field — `sl-field` (`__label` · `__input` · `__control`)
Label + input/textarea/select. Substrate: **R** App.
```html
<label class="sl-field">
  <span class="sl-field__label">Product</span>
  <input class="sl-field__input" type="text" placeholder="introspect">
</label>
```
Consumes: `--slc-surface`, `--slc-border`, `--slc-border-strong`, `--slc-text`, `--slc-focus`. Do: keep the shared focus ring. `sl-field__control` is the wrapper an effect binds to — see Glass and Aurora below; without an effect the field needs no wrapper.

### Checkbox — `sl-check` (`__input` · `__box` · `__label`)
A `<label>` host, a visually-hidden but focusable `<input>`, a `<span>` that paints the box, and a `<span>` that carries the text. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-check">
  <input class="sl-check__input" type="checkbox">
  <span class="sl-check__box"></span>
  <span class="sl-check__label">Run the audit on save</span>
</label>
```
Consumes: `--slc-surface`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus`. Do: keep the four parts in that order — `sl-check__box` is styled by an adjacent-sibling selector, so an element between it and `sl-check__input` breaks every checked state. Don't: hide the input with `display:none` or `visibility:hidden`; both remove it from the focus order and the control stops being reachable by keyboard.

### Radio — `sl-radio` (`__input` · `__box` · `__label`)
The checkbox's shape with a round box and a dot. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-radio">
  <input class="sl-radio__input" type="radio" name="tier">
  <span class="sl-radio__box"></span>
  <span class="sl-radio__label">Tier A — full theme selector</span>
</label>
```
Consumes: `--slc-surface`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus`. Do: give every radio in a set the same `name`. Don't: use a radio where only one option exists — that is a checkbox.

### Callout — `sl-callout` (`--success` · `--warning` · `--danger` · `--info`)
Banner / admonition. The accent is a short "measure tick" on the top edge (not a left stripe). Substrate: **A** App/Page.
```html
<div class="sl-callout sl-callout--info">
  <p class="sl-callout__title">Tier B</p>
  <div class="sl-callout__body">Every colour must resolve to a Sondalab value.</div>
</div>
```
One modifier per status: `--success`, `--warning`, `--danger`, `--info` colours the tick.
Consumes: `--slc-surface`, `--slc-border`, `--slc-success`, `--slc-warning`, `--slc-danger`, `--slc-info`. Don't: reinstate a full left border stripe.

### Rule — `sl-rule` (`--labeled`)
Hairline divider; `--labeled` centres a mono caption over the line. Substrate: **R** App/Page.
```html
<hr class="sl-rule">
<div class="sl-rule sl-rule--labeled">since 0.2.0</div>
```
Consumes: `--slc-border`. Weight is always 1px — never thicken a separator.

### Table — `sl-table` (`--numeric`)
Data table shell. Wrap in an `overflow-x:auto` container so wide tables never scroll the page. Substrate: **R** App.
```html
<div style="overflow-x:auto">
  <table class="sl-table sl-table--numeric">
    <thead><tr><th>Product</th><th>R-violations</th></tr></thead>
    <tbody><tr><td>daos</td><td>2</td></tr></tbody>
  </table>
</div>
```
Consumes: `--slc-border`, `--slc-text`, `--slc-text-secondary`, `--slc-surface`. Do: `--numeric` for tabular figures.

### Tabs — `sl-tabs` (`__list` · `__tab`)
Visual-only tabs (consumer wires ARIA + panel switching). Active tab uses a 2px accent underline — an emphasis accent, not a separator. Substrate: **R** App.
```html
<div class="sl-tabs">
  <div class="sl-tabs__list" role="tablist">
    <button class="sl-tabs__tab" aria-selected="true">Tokens</button>
    <button class="sl-tabs__tab">Components</button>
  </div>
</div>
```
Consumes: `--slc-accent`, `--slc-text`, `--slc-text-muted`, `--slc-border`. Active state is the accent (never a neutral).

### Kbd / inline code — `sl-kbd` · `sl-code`
Keyboard key and inline monospace code. Substrate: **A**.
```html
Press <kbd class="sl-kbd">⌘K</kbd>, then run <code class="sl-code">sl-audit</code>.
```
Consumes: `--slc-surface`, `--slc-border`, `--slc-text`, `--sl-font-mono`.

### Dialog — `sl-dialog` (`__title` · `__body` · `__actions`)
Visual shell for the native `<dialog>` (consumer wires open/close). Substrate: **R** App.
```html
<dialog class="sl-dialog">
  <h2 class="sl-dialog__title">Discard changes?</h2>
  <div class="sl-dialog__body">This cannot be undone.</div>
  <div class="sl-dialog__actions">
    <button class="sl-btn sl-btn--ghost">Keep</button>
    <button class="sl-btn sl-btn--primary">Discard</button>
  </div>
</dialog>
```
Consumes: `--slc-raised`, `--slc-border`, `--slc-overlay`, `--slc-text`, `--slc-text-secondary`.

## Effects (opt-in, `effects.css`)

Additive classes over `components.css` — never a replacement for the shared component. Each family carries exactly one meaning (`design-language.md` L6); an effect that means nothing is switched off. See `HANDOFF.md` for what stays judgement (right family for the meaning, the effect budget, the focus ring, the ARIA).

### Glass edge — `sl-fx-glass` (`--wide` · `--field`)
The element's own border, as chrome: a hairline reflecting a moving environment, a halo that wanders around it, a bright spot under the cursor, a reflection onto the near edge of an adjacent effect element (WebGPU, via `mountGpu()`); a static conic hairline where there is no GPU. Width is the border's own, never spent. Substrate: **R** Page, **A** App.
```html
<article class="sl-card sl-fx-glass sl-fx-glass--wide">…</article>
<label class="sl-field">
  <span class="sl-field__label">Product</span>
  <span class="sl-field__control sl-fx-glass sl-fx-glass--field">
    <input class="sl-field__input" type="text">
  </span>
</label>
```
`--wide` widens the CSS fallback ring to 2px for containers (card, dialog, panel); `--field` does the same for a field's wrapper. Neither changes the chrome, which is always the element's own border width. **On a replaced control the `sl-field__control` wrapper is mandatory:** `<input>`, `<textarea>` and `<select>` render no `::before`/`::after`, so the class on the control itself renders nothing at all — no error, no ring.
Consumes: `--slc-border-strong`, `--slc-border-subtle`, `--slc-accent`, `--slc-text` (the chrome's poles and flecks, read at runtime). Don't: thicken it to replace a separator — a separator is always 1px.

### Aurora — `sl-fx-aurora` (`--wide` · `--field` · `--linear` · `--rim`)
Attention lives here: a 1px arc of light riding the border with its bloom, which reaches ~22px outside the box and ~28px inside it — CSS at every tier. Inhabits the element's own edge; never a second concentric ring, never a replacement for the focus outline. A filled element (`sl-btn--primary`) takes `--rim`: the arc steps just outside the fill, in the depth companion. Substrate: **R** Page, **A** App.
```html
<button class="sl-btn sl-btn--ghost sl-fx-aurora">Run audit</button>
<button class="sl-btn sl-btn--primary sl-fx-aurora sl-fx-aurora--rim" data-sl-fx-live="busy" aria-busy="true" disabled>Saving…</button>
<span class="sl-field__control sl-fx-aurora sl-fx-aurora--field"><input class="sl-field__input" type="text"></span>
<article class="sl-card sl-fx-aurora sl-fx-aurora--wide" data-sl-fx-live="busy" aria-busy="true">…</article>
<article class="sl-card sl-fx-aurora sl-fx-aurora--wide" data-sl-fx-live="busy"
         role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100"
         style="--slfx-progress: .62">…</article>
```
`--wide` widens the arc to 2px on containers, `--field` on a field's wrapper; `--linear` sweeps a segment (a tab's or link's underline; add `--top` for an inversion band's rule) instead of a perimeter and has no busy mode; `--rim` is for filled elements. **On a replaced control the `sl-field__control` wrapper is mandatory** — the control itself hosts no pseudo-element, and `:focus-within` on the wrapper is what lights the arc.
Consumes: `--slc-accent`, `--slc-text`. Do: pair every busy aurora with `aria-busy`, and every determinate one with `role="progressbar"` + `aria-valuenow` — the aurora renders state, it never is the state. Don't: grant more than one ambient `data-sl-fx-live="on"` per document. Don't put an aurora element under an ancestor that clips (`overflow` other than `visible`, `contain: paint`, `clip-path`): the bloom reaches ~22px outside the box, and a glow cut at a container's edge is a defect — wrap the table in the scroll container, not the card beside it.

### Liquid — `sl-fx-liquid` (`--drop`)
The element's outline gives under the pointer — a small outward swell that follows it with a little lag, springs back and settles when it leaves. It is a skin drawn below the content in the element's own fill and border colours (driven by `mount()`); the text is never filtered and the radius is never rewritten. Non-destructive: the skin exists only while the pointer shapes the element, and nothing is changed afterwards. **The gooey belongs to a round silhouette:** `--drop` goes on a round icon-only button and nowhere else — on a text button the drop reads as a blister on a box, and a text button is a glass pane instead (`sl-fx-glass--pane`). The modifier is the contract, written in the markup; nothing measures a radius to decide. A bare `sl-fx-liquid` is inert. Substrate: **A** App/Page.
```html
<button class="sl-btn sl-btn--ghost sl-fx-glass sl-fx-liquid sl-fx-liquid--drop sl-fx-aurora" aria-label="Send" style="width:2.5rem;height:2.5rem;padding:0;border-radius:var(--sl-radius-pill)">…</button>
<article class="sl-card sl-fx-glass">…</article>
```
A container takes no swell at all — one yielding under the pointer reads as a toy; for several elements that should read as one material, use `sl-fx-goo` below.
Consumes: nothing of its own — the skin is painted in the host's computed background and border colours. Don't: put it on a text input — a field that deforms while being typed into trades legibility for spectacle. Don't: put `--drop` on a text button — the owner rejected the gooey there; use `sl-fx-glass--pane`.

### Goo — `sl-fx-goo` + `sl-fx-goo__member`
These are one substance. A container carries `sl-fx-goo` and owns one injected silhouette layer; every `sl-fx-goo__member` inside it contributes its own rounded box, and members within `--slfx-goo-weld` of one another grow a soft neck between them. Static at rest — it answers the layout, not the pointer, so it marks a *set* (a tag row, a gallery of cards or pictures, a cluster of draggable chips) and never a state. Driven by `mount()`; without it the members simply render unmerged, which is the correct Tier 0. The content is never filtered: the members ride crisp on top of the layer. Substrate: **A** App/Page.
```html
<div class="sl-fx-goo" style="display:flex; gap:.5rem">
  <div class="sl-card sl-fx-goo__member">daos</div>
  <div class="sl-card sl-fx-goo__member">introspect</div>
</div>
```
Bind `--slfx-goo-weld` (default `14px`) — the largest gap between two **members, as laid out**, that still welds, measured **edge to edge between facing sides**, so a grid's diagonals stand further apart than its `gap` and stay open. `--slfx-goo-reach` (default `3px`) is the rim the substance shows past a member with no neighbour, and a floor rather than a target. `--slfx-goo-soft` (default `5px`) caps the blur: dilation and blur both close a gap, but dilation preserves the outline while blur melts it, so raise `soft` for a more liquid neck and lower it for a crisper one. `--slfx-goo-fill` is the substance every member stands on.
Consumes: `--slfx-goo-fill` under every member, and each member's own computed `background-color` composited over it at the component's own alpha — so a tinted member stays a tint and a member with no fill is simply the substance. A member that welds to a neighbour gives up its own **border** and its own **background**, and the substance paints it: an outline drawn across a merged mass reads as a card stacked on a blob, and an opaque rectangular box covering a neighbour's substance reads as boxes stepped over one another rather than as drops merging. Handing the paint over moves that colour boundary inside the filter, where the blur softens it. The member keeps its text. One standing alone keeps both. **Never a form control or a link.** `button`, `input`, `select`, `textarea` and `a[href]` are refused a field outright, marked or not: they paint their own chrome through layers this family does not own, so a welded control kept an outline the substance was meant to replace. Use a standard element — and a `div[role="button"][tabindex="0"]` where a member must be operable, which paints nothing of its own. Do: mark members explicitly — membership is a class, never "every child of the container". Members may also **move**: a drag or an arrow-key nudge re-welds, because the field re-measures per frame while a pointer or the focus is inside the container (and not at all otherwise). Place a movable member with insets or `margin`, never with a `transform` — a transform moves the painted element without moving the box `getBoundingClientRect()` reports, and the silhouette stays behind. Do: give the container padding — the substance reaches `--slfx-goo-reach` plus three blur sigmas (~34px at the default weld) past the outermost member, and an ancestor that clips cuts it along a straight line. Don't: expect a neck between members whose own fills are both near the ground's colour — the weld is there, but nothing separates it from the background.

### Glitch — `sl-fx-glitch` (`--shatter`)
Something re-resolved. A finite burst, fired from JavaScript on a discrete event. Always a child span, never the component itself. Substrate: **A** App/Page.
```html
<button class="sl-btn sl-btn--primary">
  <span class="sl-fx-glitch" data-text="Delete branch">Delete branch</span>
</button>
```
The `--shatter` variant additionally wraps an intact `sl-fx-glitch__text` and a `sl-fx-glitch__shards` stack. Every `sl-fx-glitch__shard` carries `--slfx-i` (its 0-based index) and `--slfx-n` (the band count) inline — the shard's `clip-path` divides by them, so a shard missing either one silently fails to render.
```html
<button class="sl-btn sl-btn--primary">
  <span class="sl-fx-glitch sl-fx-glitch--shatter" data-text="Delete branch">
    <span class="sl-fx-glitch__text">Delete branch</span>
    <span class="sl-fx-glitch__shards" aria-hidden="true">
      <span class="sl-fx-glitch__shard" style="--slfx-i:0; --slfx-n:3">Delete branch</span>
      <span class="sl-fx-glitch__shard" style="--slfx-i:1; --slfx-n:3">Delete branch</span>
      <span class="sl-fx-glitch__shard" style="--slfx-i:2; --slfx-n:3">Delete branch</span>
    </span>
  </span>
</button>
```
Consumes: `--slc-accent`, `--slc-accent-hover`. Do: call `effects.js`'s `mount()` once and fire `burst(el)` on the triggering event — CSS alone renders nothing; set `data-text` to the element's own text, and give every shard its `--slfx-i`/`--slfx-n` pair. Don't: run it ambiently on a control — ambient glitch is the wordmark's alone.

## Signature patterns (page-level composition — copy the CSS)

These are not single classes; they are the composition motifs from `design-language.md` L2/L3. Copy the CSS into your surface (they read `--sl-*` tokens directly, theme-independent).

### Sticky translucent header
Substrate: **R** App/Page. The house header: sticky, translucent, 1px bottom rule; mono wordmark left, mono meta right.
```css
.site-header {
  position: sticky; top: 0; z-index: var(--sl-z-overlay);
  background: color-mix(in srgb, var(--sl-bg-canvas) 84%, transparent);
  backdrop-filter: saturate(140%) blur(10px);
  border-bottom: 1px solid var(--sl-border-subtle);
}
```
Don't: use an opaque header or a drop-shadow instead of the 1px rule.

### Inversion band
Substrate: **R** Page, **A** App/IDE/Term. A full-width block flipped to paper-on-ink; punctuates rhythm, marks the thesis or primary CTA. At least one per long page.
```css
.invert {
  background: var(--sl-text-primary);
  color: var(--sl-bg-canvas);
}
.invert .sl-eyebrow { color: color-mix(in srgb, var(--sl-bg-canvas) 70%, transparent); }
```
Don't: put an alpha-on-canvas hairline inside it (it vanishes) — derive an on-ink rule locally.

### Hairline grid
Substrate: **R** App/Page. Cards formed by a 1px gap over a line-colour background; cells paint their own surface → crisp shared rules, no doubled borders. Prefer over bordered-card grids.
```css
.hgrid {
  display: grid; gap: 1px;
  background: var(--sl-border-subtle);
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
}
.hgrid > * { background: var(--sl-bg-surface); padding: var(--sl-space-5); }
```

### Section with mono index
Substrate: **R** Page. A section opens with a mono index label beside its heading, separated from the previous section by a 1px top rule. Number it only where the content is a real sequence.
```css
.section { border-top: 1px solid var(--sl-border-subtle); padding-block: var(--sl-space-8); }
.section__idx { font-family: var(--sl-font-mono); font-size: var(--sl-text-xs); letter-spacing: 0.2em; text-transform: uppercase; color: var(--sl-text-muted); }
```

### Oversized display anchor
Substrate: **R** Page (**A** App where a hero exists). One oversized display heading per screen, sized by a fluid clamp (a documented pattern, not a token).
```css
.anchor {
  font-family: var(--sl-font-display); font-weight: 600;
  letter-spacing: -0.02em; line-height: var(--sl-line-tight);
  font-size: clamp(2.7rem, 1.6rem + 5vw, 5.4rem);
}
```
Don't: use more than one oversized anchor per screen.

## Rules of use (all components)

- **Bind role-vars, never literals.** A component's colour comes from a `--slc-*`/`--sl-*` var. A raw hex fails `sl-audit`.
- **One accent hue.** The accent varies per product (see `accent-registry.json`); status colours (success/warning/danger/info) are shared and independent of it.
- **Spend surprise on composition, not materials.** Family resemblance comes from these shared components; distinctiveness comes from how you compose them (≥1 unexpected layout decision per screen).
