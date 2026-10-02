# Component catalog — Sondalab DS (agent-facing)

> **What this file is:** a copy-paste catalog of Sondalab DS primitives, opt-in effects, and signature patterns, for an agent authoring a new interface. Each entry gives the canonical markup, the role-vars it consumes, its substrate applicability, and a do/don't. Snippets use only `var(--slc-*/--sl-*)` and `color-mix()` over those — never a colour literal — so every snippet here passes `sl-audit` by construction (`scripts/catalog-audit.test.mjs` enforces it).
> **Audience:** agents building or extending a Sondalab surface (author workflow); humans reviewing component usage.
> **How to use:** pick the component, copy the markup, bind it to your product's theme (Tier A: consume `@sondalab/ui-kit` `components.css` + a theme; Tier B: map the `--slc-*` role-vars to your local colour layer). Then run `sl-audit`. Effects (`## Effects`) are a separate, opt-in import — `packages/ui-kit/effects.css` (+ `effects.js` for Tier 1) — not part of `components.css`. The machine index is `catalog.json`.
> **Companion:** `README.md` (usage), `HANDOFF.md` (what the audit does not check), `./design-language.md` (the grammar these components express), `workflows/author.md` (the procedure that consumes this catalog).

The `--slc-*` role-vars (defined at the top of `components.css`) are the seam: components read them, and they resolve to `--sl-*` tokens (Tier A) or to your product's colour layer (Tier B). Never hardcode a colour into a component — bind the role-var.

## Primitives (ready classes in `components.css`)

### Eyebrow — `sl-eyebrow`
The micro label above a heading: mono, uppercase, `--sl-text-micro` (10.5px), weight 500, tracked `0.06em`, muted (L1). The single strongest family signal, spent on structure only. Substrate: **R** on App/Page/IDE.
```html
<p class="sl-eyebrow">System status</p>
```
Consumes: `--slc-text-muted`, `--sl-font-mono`, `--sl-text-micro`. Don't: sentence-case it, use a sans face, or put it on anything you operate — controls speak in sentence case (L1).

### Tag / tier marker — `sl-tag` (`--plain`)
Accent-tinted mono pill with a leading dot, in sentence case, tracked `0.02em`; classification/status. Substrate: **R** App/Page.
```html
<span class="sl-tag">Delivered</span>
<span class="sl-tag sl-tag--plain">Draft</span>
```
Consumes: `--slc-accent`, `--slc-accent-subtle` (`--plain`: `--slc-text-muted`, `--slc-border`). Don't: introduce a second accent hue for tags, or write the label in capitals — the class no longer upper-cases it (0.30).

### Filter chip — `sl-chip` (`__count`) in `sl-chips`
A toggleable filter; a row of them is a multi-select where any number may be on. A control, so sentence case in the sans; the count stays mono (L1). Off: an outlined pill in the muted ink with a hollow dot. On: the tag's accent dress, dot filled — so the state reads by colour, fill and glyph. Substrate: **R** App/IDE, **A** Page.
```html
<div class="sl-chips" role="group" aria-label="Event kinds">
  <button class="sl-chip" aria-pressed="true">Tool <span class="sl-chip__count">42</span></button>
  <button class="sl-chip" aria-pressed="false">Spawn <span class="sl-chip__count">3</span></button>
  <button class="sl-chip" aria-pressed="true">Result</button>
</div>
```
Consumes: `--slc-text-muted`, `--slc-text`, `--slc-border`, `--slc-border-strong`, `--slc-accent`, `--slc-accent-subtle`, `--slc-focus`. Do: drive it with `aria-pressed` and label the group. Don't: use chips for one-of-N (that is `sl-segmented`), or for a label that does nothing (that is `sl-tag`).

### Button — `sl-btn` (`--primary` · `--ghost` · `--sm`)
Filled-accent primary or a ghost washed with 6% of the ink (no border). Primary hover/active track the accent hue; ghost hover deepens the wash. Substrate: **R** App/IDE, **A** Page.
```html
<button class="sl-btn sl-btn--primary">Save changes</button>
<button class="sl-btn sl-btn--ghost">Cancel</button>
<button class="sl-btn sl-btn--primary sl-btn--sm">Add</button>
```
Consumes: `--slc-accent`, `--slc-accent-hover`, `--slc-accent-active`, `--slc-accent-subtle`, `--slc-on-accent`, `--slc-border`, `--slc-text`. Do: state the effect in the label (L5 voice). Don't: use a default-blue CTA or `hover:opacity` as the only state.

**Toggle button.** An on/off button is a plain or ghost `sl-btn` carrying `aria-pressed`; "on" takes the accent text, an accent wash and an accent edge. The CSS reads the attribute, so flip `aria-pressed` and nothing else — no `.on`/`.active` class.
```html
<button class="sl-btn sl-btn--ghost sl-btn--sm" aria-pressed="true">Pause</button>
<button class="sl-btn sl-btn--ghost sl-btn--sm" aria-pressed="false">Follow</button>
```
Do: keep the label constant and let the state show it (a label that flips between "Pause" and "Resume" is a plain button, not a toggle). Don't: put `aria-pressed` on `sl-btn--primary` — its fill already reads as "on", so there is nothing to switch to. On glass the pressed wash is carried as the pane's fill (effects.css), so the state survives the material.

### Link — `sl-link`
Underlined, accent on hover. Substrate: **R** App/Page.
```html
<a class="sl-link" href="/specs">read the spec</a>
```
Consumes: `--slc-accent`. Don't: remove the underline (leave the affordance).

### Badge — `sl-badge` (`--success` · `--warning` · `--danger` · `--info` · `--live`)
Semantic status pill, in sentence case in the sans (L1). Semantic colour is **independent of the accent hue** and shared. Substrate: **R** App/IDE.
```html
<span class="sl-badge sl-badge--success">Passing</span>
<span class="sl-badge sl-badge--danger">Failed</span>
```
One modifier per status: `--success`, `--warning`, `--danger`, `--info` — never a bare `sl-badge`. Add `--live` when the thing it labels is working right now: its dot breathes (not under reduced motion). The words still carry the state ("Running").
Consumes: `--slc-text`, `--slc-success`, `--slc-warning`, `--slc-danger`, `--slc-info`. Don't: recolour a badge to the accent — status ≠ accent.

### Card — `sl-card` (`__title` · `__body`)
Surface panel. Substrate: **R** App.
```html
<article class="sl-card">
  <h3 class="sl-card__title">Migration report</h3>
  <div class="sl-card__body">2 R-violations resolved, 1 blessed.</div>
</article>
```
Consumes: `--slc-surface`, `--slc-border-subtle`, `--slc-text`, `--slc-text-secondary`. Don't: make a `rounded-lg` card grid the primary layout — prefer the hairline grid (below).

### Field — `sl-field` (`__label` · `__input` · `__control` · `__hint` · `__error`)
Label + input/textarea/select, with an optional hint or error line under it. The label is read with the control, so it is sentence case in the sans, in the secondary ink (L1; it was a mono uppercase micro label before 0.30). Substrate: **R** App.
```html
<label class="sl-field">
  <span class="sl-field__label">Product</span>
  <input class="sl-field__input" type="text" placeholder="introspect">
</label>
```
With a hint or an error line, the host is a `<div>` and the label names the input by `for`; the line is a sibling the input points at with `aria-describedby`:
```html
<div class="sl-field">
  <label class="sl-field__label" for="product">Product</label>
  <input class="sl-field__input" id="product" type="text" placeholder="introspect" aria-describedby="product-hint">
  <p class="sl-field__hint" id="product-hint">The registry name, lower case.</p>
</div>
<div class="sl-field">
  <label class="sl-field__label" for="accent">Accent</label>
  <input class="sl-field__input" id="accent" type="text" value="#12" aria-invalid="true" aria-describedby="accent-error">
  <p class="sl-field__error" id="accent-error">Six hex digits, e.g. a registry value.</p>
</div>
```
Don't: put `sl-field__hint` or `sl-field__error` inside a wrapping `<label class="sl-field">`. Everything inside a label becomes the input's accessible name, so the line is read as part of the name and then again as its description.

Consumes: `--slc-surface`, `--slc-border`, `--slc-border-strong`, `--slc-text`, `--slc-text-muted`, `--slc-danger`, `--slc-focus`. Do: keep the shared focus ring. `sl-field__control` is the wrapper an effect binds to — see Glass and Aurora below; without an effect the field needs no wrapper.

`aria-invalid="true"` on the input is the invalid state — no extra class. The edge, the focus ring and the focus halo all take the danger ink together (never a red edge inside an accent ring). Do: point `aria-describedby` at a `sl-field__error` line, which leads with a drawn mark so the state never rests on colour alone; remove both the attribute and the line once the value is valid. Don't: mark a field invalid before the user has had a chance to fill it.

### Checkbox — `sl-check` (`__input` · `__box` · `__label`)
A `<label>` host, a visually-hidden but focusable `<input>`, a `<span>` that paints the box, and a `<span>` that carries the text. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-check">
  <input class="sl-check__input" type="checkbox">
  <span class="sl-check__box"></span>
  <span class="sl-check__label">Run the audit on save</span>
</label>
```
Mixed (a parent box over a partly-checked set): set `input.indeterminate = true` from script — there is no attribute for it; the box fills and shows a dash instead of the tick. Don't: put `aria-checked` on the native checkbox (ARIA in HTML forbids it, and a screen reader announces the native state anyway).

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

### Switch — `sl-switch` (`__input` · `__track` · `__label`)
A checkbox that reads as a state rather than a choice: use it where the change takes effect immediately, and a checkbox where it takes effect on submit. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-switch">
  <input class="sl-switch__input" type="checkbox" role="switch">
  <span class="sl-switch__track"></span>
  <span class="sl-switch__label">Tier 2 GPU effects</span>
</label>
```
Consumes: `--slc-surface`, `--slc-border-strong`, `--slc-accent`, `--slc-on-accent`, `--slc-text`, `--slc-focus`. Do: carry `role="switch"` on the input, so the state reaches a screen reader as on/off rather than as checked. Don't: put ON/OFF text inside the track — the knob's position is the state, and a label that repeats it goes stale in translation.

### Select — `sl-select`
The chevron a `<select>` cannot draw for itself. Composes onto `sl-field__control`, the wrapper the effects layer already binds to, so a field and a select take an effect the same way. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-field">
  <span class="sl-field__label">Substrate</span>
  <span class="sl-field__control sl-select">
    <select class="sl-field__input">
      <option>App</option>
      <option>IDE</option>
      <option>Page</option>
    </select>
  </span>
</label>
```
Consumes: `--slc-text-muted`. Do: keep `sl-field__input` on the `<select>` itself — the border, the ground and the focus ring all come from there. Don't: reach for a `mask-image` to draw the arrow; a mask on a `<select>` masks its text along with the arrow. Don't: put the glass/aurora effect classes on `.sl-select` itself — it is a wrapper, but its `::after` is the chevron, and both families paint their ring there too, so the chevron is replaced in silence. Nest `.sl-select` inside `.sl-field__control` and dress that instead.

### Callout — `sl-callout` (`--success` · `--warning` · `--danger` · `--info`)
Banner / admonition. The panel is a light wash of its status; the accent is a short "measure tick" on the top edge (not a left stripe). Substrate: **A** App/Page.
```html
<div class="sl-callout sl-callout--info">
  <p class="sl-callout__title">Tier B</p>
  <div class="sl-callout__body">Every colour must resolve to a Sondalab value.</div>
</div>
```
One modifier per status: `--success`, `--warning`, `--danger`, `--info` colours the tick.
Consumes: `--slc-surface`, `--slc-accent`, `--slc-success`, `--slc-warning`, `--slc-danger`, `--slc-info`. Don't: reinstate a full left border stripe.

### Rule — `sl-rule` (`--labeled`)
Hairline divider; `--labeled` centres a micro-label caption (mono, uppercase, `--sl-text-micro`) over the line. Substrate: **R** App/Page.
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
Consumes: `--slc-border-subtle`, `--slc-text`, `--slc-text-secondary`, `--slc-surface`. Do: `--numeric` for tabular figures.

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

### Tooltip — `sl-tooltip`
A CSS-only label above its host, in the inverted ink. The text lives in `data-sl-tooltip`; a host that is not already focusable takes `tabindex="0"` so the keyboard reveals it too. Substrate: **R** App/IDE, **A** Page.
```html
<span class="sl-tooltip" data-sl-tooltip="Measured on the canvas ground" tabindex="0">4.89:1</span>
<button class="sl-icon-btn sl-tooltip" data-sl-tooltip="Re-run the audit" aria-label="Re-run the audit">↻</button>
```
Consumes: `--slc-text`, `--slc-raised`. It rises 4px into place as it fades in, on `--sl-motion-mid` (still under reduced motion). Do: keep it to one short line (it never wraps). Don't: put anything a user must read to act in a tooltip — it is a hint, invisible on touch; and on an icon button repeat the text in `aria-label`, since the pseudo-element is not its accessible name.

### Kbd / inline code — `sl-kbd` · `sl-code`
Keyboard key and inline monospace code. Substrate: **A**.
```html
Press <kbd class="sl-kbd">⌘K</kbd>, then run <code class="sl-code">sl-audit</code>.
```
Consumes: `--slc-surface`, `--slc-text`, `--sl-font-mono`.

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
Consumes: `--slc-raised`, `--slc-border`, `--slc-overlay`, `--slc-text`, `--slc-text-secondary`. Opened with `showModal()`, it rises 6px and fades in with its backdrop, and falls back as it closes where `overlay` is supported (`@starting-style` and transitions on `--sl-motion-mid`; no keyframes). Reduced motion, or a browser without `@starting-style`, opens it at once. Don't: put a `display` of your own on a closed `sl-dialog` to show it — a closed dialog is transparent; set `open` instead.

## Navigation & state

### Breadcrumb — `sl-breadcrumb` (`__item` · `__sep`)
The trail to here. Navigation you operate, so sentence case in the sans (L1; it was mono uppercase tracked before 0.30). Substrate: **R** App, **A** IDE/Page.
```html
<nav class="sl-breadcrumb" aria-label="Breadcrumb">
  <a class="sl-breadcrumb__item" href="/">Specs</a>
  <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
  <a class="sl-breadcrumb__item" href="/specs/ds">Design system</a>
  <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
  <span class="sl-breadcrumb__item" aria-current="page">Base element set</span>
</nav>
```
Consumes: `--slc-text-muted`, `--slc-text`, `--slc-accent`, `--slc-focus`. Do: mark the last item `aria-current="page"` and leave it a `<span>` — the page you are on is not a link. Don't: import an icon for the separator; a glyph is one character and needs no asset.

### Button group — `sl-btn-group`
Joins `sl-btn` children into one control with a shared 1px rule. Built on the hairline-grid technique, so no rule is ever doubled (L2). Substrate: **R** IDE/App, **A** Page.
```html
<div class="sl-btn-group">
  <button class="sl-btn sl-btn--ghost">Audit</button>
  <button class="sl-btn sl-btn--ghost">Migrate</button>
  <button class="sl-btn sl-btn--ghost">Adopt</button>
</div>
```
Consumes: `--slc-edge-control`, `--slc-surface`. Do: use one variant across the group. Don't: mix `sl-btn--primary` and `sl-btn--ghost` inside one group — a group is one control, and two fills read as two. Do: put `sl-fx-glass sl-fx-glass--pane` on the members, never `sl-fx-glass` on `.sl-btn-group` itself — a group's `background` **is** the 1px rule between its members, and the material clears the host's own background so its tint layer can paint instead, so glass on the group dissolves the separator it was supposed to leave alone. The group also clips (`overflow: hidden`), so its ring would be cut at the group's own edges regardless of the background question.

### Segmented control — `sl-segmented` (`__item`)
A small set of mutually exclusive views. Sentence-case items in the sans, as every control (L1; mono uppercase before 0.30). Substrate: **R** IDE/App, **A** Page.
```html
<div class="sl-segmented" role="tablist">
  <button class="sl-segmented__item" role="tab" aria-selected="true">Light</button>
  <button class="sl-segmented__item" role="tab" aria-selected="false">Dark</button>
  <button class="sl-segmented__item" role="tab" aria-selected="false">Contrast</button>
</div>
```
Consumes: `--slc-border`, `--slc-surface`, `--slc-raised`, `--slc-text-muted`, `--slc-text`, `--slc-focus`. Do: drive the selected state with `aria-selected` — the CSS reads it, so the accessible state and the visible state cannot drift apart. When it switches a setting rather than a view, it is a group of toggle buttons: `role="group"` on the control and `aria-pressed` on the items, which the CSS reads the same way. Don't: use it for more than about four options; that is a `select`.
```html
<div class="sl-segmented" role="group" aria-label="Language">
  <button class="sl-segmented__item" aria-pressed="true">EN</button>
  <button class="sl-segmented__item" aria-pressed="false">IT</button>
</div>
```

### Progress — `sl-progress` (`__bar` · `--success` · `--danger`)
A determinate 4px bar. Write the value twice: `aria-valuenow` for assistive tech and `--sl-progress` (a percentage) for the paint — CSS cannot yet read a number out of an attribute. Substrate: **R** App/IDE, **A** Page.
```html
<div class="sl-progress" role="progressbar" aria-label="Spec steps" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60" style="--sl-progress: 60%">
  <span class="sl-progress__bar"></span>
</div>
```
Consumes: `--slc-text`, `--slc-accent`, `--slc-success`, `--slc-danger`. `--success`/`--danger` are for a finished or failed run, not for decoration. Don't: fake an indeterminate bar — work with no measurable value is `aria-busy="true"` (with effects, the aurora's busy reading), and a bar that moves without a value is L5's "structure encodes truth" broken.

### Slider — `sl-slider`
A styled native range input: keyboard, screen readers and touch are the browser's. The thumb is the page's light pole (near-white on light, light grey on dark); it grows when hovered, grows and flattens when grabbed, and springs back when let go. Write the value twice: the input's own, and `--sl-slider-value` (a percentage) for the fill — Chromium and Safari have no fill pseudo-element; Firefox fills itself. A unitless `--sl-slider-value` drops the whole track background, and setting `.value` from code fires no `input` event, so write the property too. Substrate: **R** App/IDE, **A** Page.
```html
<input class="sl-slider" type="range" min="0" max="100" value="40" aria-label="Volume"
       style="--sl-slider-value: 40%"
       oninput="this.style.setProperty('--sl-slider-value',
               (this.value - this.min) / (this.max - this.min) * 100 + '%')">
```
Consumes: `--slc-canvas`, `--slc-text`, `--slc-accent-text`, `--slc-shade-step`, `--slc-shadow-sm`, `--slc-focus`, `--slc-border`. Under forced colours (a user palette) the value stays visible: the rest of the track in `GrayText`, the value in `Highlight`, the thumb in `ButtonText` with a `CanvasText` focus ring — forced colours would otherwise drop the fill, which is a gradient image. Do: give it an accessible name (`aria-label` or a `<label for>`). Don't: use it for a value the user must set exactly — pair it with a number field, or use one instead.

### Icon button — `sl-icon-btn` (`--round`)
A square icon-only control. The kit ships no icon set: supply your own `<svg>` and let it inherit `currentColor`. Substrate: **R** IDE/App, **A** Page.
```html
<button class="sl-icon-btn" aria-label="Re-run the audit">
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3" fill="none" stroke="currentColor" stroke-width="1.3"/>
  </svg>
</button>
<button class="sl-icon-btn sl-icon-btn--round sl-fx-liquid sl-fx-liquid--drop" aria-label="Add a product">
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.4"/>
  </svg>
</button>
```
Consumes: `--slc-border`, `--slc-text`, `--slc-accent`, `--slc-accent-subtle`, `--slc-focus`. As a toggle it takes `aria-pressed`, painted like the toggle button's. Do: give it an `aria-label` — an icon-only control has no accessible name otherwise. `sl-icon-btn--round` is the round silhouette the liquid's `--drop` is allowed on, and the only element in the kit that is; the author still writes `sl-fx-liquid sl-fx-liquid--drop`, because L6 makes the modifier in the markup the contract and forbids anything from measuring a radius to decide. Don't: put `--round` on a text button; the deformation belongs to a round silhouette.

### Pagination — `sl-pagination` (`__item`)
Numbered navigation across pages of results. Mono tabular figures (L1). Substrate: **R** App, **A** Page, **N/A** IDE.
```html
<nav class="sl-pagination" aria-label="Pagination">
  <a class="sl-pagination__item" href="?p=1">1</a>
  <a class="sl-pagination__item" href="?p=2" aria-current="page">2</a>
  <a class="sl-pagination__item" href="?p=3">3</a>
</nav>
```
Consumes: `--slc-edge-control-hover`, `--slc-text-muted`, `--slc-text`, `--slc-accent`, `--slc-accent-subtle`, `--slc-focus`. Do: mark the current page `aria-current="page"`. There is no ellipsis class — a truncated range is a product decision, and the caller writes `<span class="sl-pagination__item" aria-hidden="true">…</span>`. Don't: render a page count you have not measured (L5, structure encodes truth).

### Empty state — `sl-empty` (`__title` · `__body`)
What a surface shows where its content would be. Composes `sl-eyebrow` above the title. Substrate: **R** App, **A** IDE/Page.
```html
<div class="sl-empty">
  <span class="sl-eyebrow">No findings</span>
  <p class="sl-empty__title">The audit found nothing to report.</p>
  <p class="sl-empty__body">4 surfaces read, 0 R-violations, 0 blessed deviations.</p>
</div>
```
Consumes: `--slc-text`, `--slc-text-secondary`. Do: say what is absent and what was actually measured — L5 prefers a real figure to an adjective. Don't: write "Nothing here yet!"; the exclamation mark is the marketing voice this house does not use.

### Skeleton — `sl-skeleton`
A placeholder block for content that has not arrived. **Static** — it does not shimmer. Substrate: **R** App, **A** IDE/Page.
```html
<div class="sl-skeleton" style="height: 1rem; width: 60%"></div>
```
Consumes: `--slc-text`. Do: size it to the content it stands in for, give the block `aria-hidden="true"`, and carry the real loading state on the container's `aria-busy`. Don't: animate it. A shimmer is ambient motion that means nothing, and L6 switches off an effect that means nothing — the same rule that forbids an ambient glitch on a control. Where a surface genuinely needs to say *work is running*, that is the aurora's busy reading, bound to `aria-busy`. Do: put the busy aurora (`sl-fx-aurora sl-fx-aurora--wide`) on the skeleton's *container*, never on the individual bars — one operation is loading, not three — and require `data-sl-fx-live="busy"` with `aria-busy="true"` on that same container: the aurora renders the state, it never *is* the state.

### Stat — `sl-stat` (`__value` · `__label`)
A single measured figure with its caption. Substrate: **R** App/Page, **N/A** IDE.
```html
<div class="sl-stat">
  <span class="sl-stat__value">268</span>
  <span class="sl-stat__label">Tests green</span>
</div>
```
Consumes: `--slc-text`, `--slc-text-muted`. The label is a micro label (mono, uppercase, `--sl-text-micro`). Do: keep the value in the mono face whatever its size — a display-scale numeral is a structural label and stays mono (L1; owner's ruling, 2026-09-13, after Fraunces at `opsz` 144 was tried and rejected; kept in 0.30, where the Lumen reference sets it in Geist, until the owner rules again). Don't: set a stat you have not measured.

## App structure

### Sidebar nav — `sl-nav` (`__group` · `__item` · `__count`)
A vertical list of destinations under micro-label group titles (mono, uppercase, `--sl-text-micro`). The current one is `aria-current="page"` and takes a 2px accent edge on the leading side over the accent wash. Substrate: **R** App/IDE, **N/A** Page.
```html
<nav class="sl-nav" aria-label="Sections">
  <div class="sl-nav__group">Observe</div>
  <a class="sl-nav__item" href="/live" aria-current="page">Live <span class="sl-nav__count">12</span></a>
  <a class="sl-nav__item" href="/sessions">Sessions <span class="sl-nav__count">340</span></a>
</nav>
```
Consumes: `--slc-text-muted`, `--slc-text-secondary`, `--slc-text`, `--slc-accent`, `--slc-accent-subtle`, `--slc-focus`. Do: mark the current destination with `aria-current`, not a class. Don't: use it as the page's only navigation on a marketing page — that is the header's job.

### List — `sl-list` (`__row` · `__meta` · `--dense`)
Selectable rows for a master-detail pane or a feed. A row is a `<button>`/`<a>`, or `role="option"` inside `role="listbox"`; the selected one is `aria-selected="true"` (or `aria-current` on a link). `--dense` is the IDE register: mono, tighter. Substrate: **R** App/IDE, **A** Page.
```html
<div class="sl-list" role="listbox" aria-label="Sessions">
  <button class="sl-list__row" role="option" aria-selected="true">Refactor the audit<span class="sl-list__meta">2m ago · 14 tools</span></button>
  <button class="sl-list__row" role="option" aria-selected="false">Prism light theme<span class="sl-list__meta">1h ago · 212 tools</span></button>
</div>
```
Consumes: `--slc-text`, `--slc-text-muted`, `--slc-accent`, `--slc-accent-subtle`, `--slc-focus`. Do: let the row's own markup carry its columns (a grid inside the row is fine). Don't: use it for tabular data with comparable columns — that is `sl-table`.

### Disclosure — `sl-disclosure`
The expand/collapse control: a `<button aria-expanded>` whose chevron points right when closed and down when open. The panel is the consumer's (`aria-controls` + `hidden`). Substrate: **R** App/IDE, **A** Page.
```html
<button class="sl-disclosure" aria-expanded="false" aria-controls="raw-1">Raw payload</button>
<pre id="raw-1" hidden>…</pre>
```
Consumes: `--slc-text-secondary`, `--slc-text`, `--slc-focus`. Do: flip `aria-expanded` and `hidden` together. Don't: animate the panel's height — the chevron is the motion.

### Key-value list — `sl-kv`
A `<dl>` of labelled facts on a two-column grid; labels in the muted ink, values in the text ink, long values wrap under themselves. Substrate: **R** App/IDE, **A** Page.
```html
<dl class="sl-kv">
  <dt>Model</dt><dd>claude-opus-5-5</dd>
  <dt>Started</dt><dd>2026-09-30 17:52</dd>
</dl>
```
Consumes: `--slc-text-muted`, `--slc-text`. Don't: nest a table in a value; a fact that needs columns is not a fact.

### Resizer — `sl-resizer` (`--horizontal`)
The drag handle between two panes: a 9px hit area around a 1px rule, turning to a 2px accent line on hover, drag and keyboard focus. Vertical (a column split) by default, `--horizontal` for a row split. The dragging is the consumer's. Substrate: **R** App/IDE, **N/A** Page.
```html
<div class="sl-resizer" role="separator" aria-orientation="vertical" aria-label="Resize the list" aria-valuenow="320" aria-valuemin="200" aria-valuemax="640" tabindex="0"></div>
```
Consumes: `--slc-border-subtle`, `--slc-accent`, `--slc-focus`. Do: make it keyboard-operable (`tabindex="0"`, arrow keys move it, `aria-valuenow` tracks it). Don't: draw a second line beside it; the handle is the rule between the panes.

## Identity & media

### Wordmark — `sl-wordmark` (`__dot`)
The official logo. The brand is typographic; there is no pictorial mark. `sondalab.` in the brand face (`--sl-font-brand`, Fraunces) at weight 500, tracked `-0.05em`, the trailing period in the accent. Since 0.30 the display face is Geist; Fraunces is the wordmark's and the monogram's alone. Substrate: **R** App/Page, **A** IDE.
```html
<span class="sl-wordmark">sondalab<span class="sl-wordmark__dot">.</span></span>
```
Consumes: `--slc-text`, `--slc-accent`. Source of truth: `packages/ui-kit/assets/sondalab-wordmark.svg` — where this class and that file disagree, the file is right. Do: let it inherit its size from context; it is type, so it scales with `font-size`. Don't: re-letter it, re-space it, or set the period in the text colour — the accent period is the mark.

### Compact lockup — `sl-lockup` (`__dot`)
The wordmark where the wordmark is too wide: headers, tight chrome. `sonda·lab` in the mono face, uppercase, tracked `0.2em`, the middle dot in the accent. Substrate: **R** IDE/App/Page.
```html
<span class="sl-lockup">sonda<span class="sl-lockup__dot">·</span>lab</span>
```
Consumes: `--slc-text`, `--slc-accent`. Source of truth: `packages/ui-kit/assets/sondalab-lockup.svg` — with one open exception: the asset is still cut in Martian Mono 300, the class renders in the mono role, Geist Mono since 0.30, until the owner signs off a re-cut. A mark, not a label: its `0.2em` tracking stands outside the micro register. Do: use this one in a `sl-header`. Don't: mix the two marks on one surface.

### Monogram — `sl-monogram`
Where even the lockup is too wide to read: a social avatar, a square tile. `s.` in the wordmark's cut (`--sl-font-brand`, Fraunces), the letter in the text colour and the period in the accent, on a full-bleed square of the surface. Substrate: **R** IDE/App/Page.
```html
<span class="sl-monogram" role="img" aria-label="Sondalab">s</span>
```
Consumes: `--slc-text`, `--slc-accent`, `--slc-surface`. Rendered assets: `packages/ui-kit/assets/sondalab-avatar-{ink,paper}.{svg,png}`. Resize it by setting `--sl-monogram-size` (default `3rem`) — the letter is sized off that box, never off an inherited `font-size`, so the three corrections hold at every size. Those corrections are fixed in `design-language.md` L3 and transcribed here, not re-derived: the mark is sized to the inscribed crop circle (~60% of the canvas wide) rather than the square; the accent period is scaled +35% around its own centre so it survives a 32px render; and it is pushed +0.06em off the letter, because the wordmark's tight tracking is drawn for a period at its natural size. Do: give it `role="img"` and a label — `s.` read aloud is not the brand. The period is drawn by the class, so the markup carries the letter alone. Don't: re-tune the three corrections per surface; they are what makes the small end legible.

### Figure — `sl-figure` (`__media` · `__caption`)
An image in a hairline frame with a micro-label caption. The house way to put a picture in a page without it reading as a blog post. Substrate: **R** Page, **A** App, **N/A** IDE.
```html
<figure class="sl-figure">
  <div class="sl-figure__media" style="aspect-ratio: 16 / 9">
    <img src="/contact-1k.jpg" alt="Glass pane, GPU tier, dark theme">
  </div>
  <figcaption class="sl-figure__caption">Contact 1k — the GPU glass pane</figcaption>
</figure>
```
Consumes: `--slc-border`, `--slc-surface`, `--slc-text-muted`. Do: declare the `aspect-ratio` on `sl-figure__media` yourself — the class sets none, because the right ratio is a property of the image and not of the design system, and a default would silently crop most of them. Don't: let the caption run to sentence case in the sans face; a caption is a structural label (L1).

### Avatar — `sl-avatar` (`--sm` · `--lg`)
A person or a product, as a square tile. Falls back to `sl-monogram` when there is no image. Substrate: **R** IDE/App, **A** Page.
```html
<span class="sl-avatar"><img src="/avatar.png" alt=""></span>
<span class="sl-avatar sl-avatar--sm"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
<span class="sl-avatar sl-avatar--lg"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
```
Consumes: `--slc-surface`, `--slc-border`. Do: use the monogram as the fallback rather than initials in a circle — the monogram is the mark, and it already carries the three small-size corrections; the avatar hands it its own box, so the corrections scale with the modifier. Don't: give a decorative avatar alt text; `alt=""` is correct when the name is beside it.

## Effects (opt-in, `effects.css`)

Additive classes over `components.css` — never a replacement for the shared component. Each family carries exactly one meaning (`design-language.md` L6); an effect that means nothing is switched off. See `HANDOFF.md` for what stays judgement (right family for the meaning, the effect budget, the focus ring, the ARIA).

### Turning effects on — the runtime contract

**Read this before you write a single `sl-fx-*` class.** Most of the effect layer needs JavaScript, and a surface that carries the classes without it renders Tier 0 silently — no error, no warning, and `sl-audit` reads CSS text, so it cannot see the omission either. This is not hypothetical: sondalab.eu shipped with every glass class in place and Tier 2 never came up, because `mountGpu()` was never called and no box carried `data-sl-fx-backdrop`.

```html
<link rel="stylesheet" href="@sondalab/ui-kit/effects.css">
<!-- glass.css too, if you use the glass family: it carries the pane's anatomy -->
<link rel="stylesheet" href="@sondalab/ui-kit/glass.css">
```
```js
import { mount, mountGpu } from "@sondalab/ui-kit/effects.js";

mount();                 // Tier 1 — call once, after the DOM exists
await mountGpu();        // Tier 2 — optional, and only after mount()
```

| Tier | Needs | You get | If you skip it |
|---|---|---|---|
| **0** | `effects.css` alone | Static aurora arc on focus, no motion; glass carries no light without a pointer | Nothing is broken — Tier 0 is a correct, complete state, not a degraded one |
| **1** | `mount()` | The glass's specular edge (an arc of light on the border facing the pointer), the liquid's deformation, finite glitch bursts, the aurora's sweep, the goo's weld, the glass lens | The classes render Tier 0 and nothing tells you |
| **2** | `await mountGpu()` | **Retired 2026-09-24** — resolves `false`; kept so existing calls still work | Nothing: Tier 1 is the whole reading |

Four things that bite, in the order they usually bite:

- **`mount()` arms once per document.** Calling it again returns the first result; it does not re-scan. Mount after your markup exists, and use `mount(root)` for a subtree you add later.
- **Two different refractions, and only the second needs an anchor.** `mount()` gives every glass host the **SVG lens** — it bends whatever is actually behind the element, with nothing to declare. `mountGpu()` adds the **GPU chrome**, and a shader cannot read the document, so there a surface *names* what lies behind a region: the **`data-sl-fx-backdrop` attribute** on an ancestor box, with the image declared as **`--slfx-backdrop: url(…)` on that same element**. Both together, on the anchor — the attribute marks which box the image covers, and the custom property would otherwise inherit with no way to tell which ancestor set it. Only `url()` is sampled; a gradient or a keyword is ignored rather than guessed at. An unmarked pane still has its Tier 1 lens; it simply has no declared image for the GPU layer, which is additive and takes nothing away.
- **Both refuse under high contrast, by design.** `mount()` returns `false` when `data-sl-theme="high-contrast"`, and `mountGpu()` re-checks at call time. Reduced motion refuses Tier 1 as well. Do not work around either: the component must still read correctly with every family off, which is what those guards exist to guarantee.

`mount()` also takes `ignoreReducedMotion` — a derogation a consumer takes on their own evidence, not a convenience. It arms Tier 1 for a visitor reporting `prefers-reduced-motion: reduce` and lets the **glitch** animate for them; every other family's motion stays inside the media query in `effects.css`, where nothing can overrule it. High contrast refuses regardless.

**Canonical strings.** The declension below is already bound per component inside `effects.css` — a product importing it does not re-derive which family goes where, or how each tunes. What it needs is the string to write. These are the canonical ones; `compositions.css` (opt-in, imported after `effects.css`) carries the custom-property bindings that have no other home.

| Component | Canonical string |
|---|---|
| Text button, any variant | `sl-btn sl-btn--primary sl-fx-glass sl-fx-glass--pane sl-fx-press` |
| Field / select wrapper | `sl-field__control sl-fx-glass sl-fx-glass--field sl-fx-aurora sl-fx-aurora--field` |
| Selected tab | `sl-tabs__tab sl-fx-aurora sl-fx-aurora--linear` |
| Round icon button | `sl-icon-btn sl-icon-btn--round sl-fx-liquid sl-fx-liquid--drop` |
| Oversized anchor | `sl-anchor sl-fx-glass sl-fx-glass--text sl-fx-glass--pane` |
| Stat value | `sl-stat__value sl-fx-glass sl-fx-glass--text sl-fx-glass--pane` |
| Figure frame | `sl-figure__media sl-fx-glass sl-fx-glass--wide` |
| Avatar, interactive | `sl-avatar sl-fx-glass sl-fx-glass--pane` |
| Segmented item, selected | `sl-segmented__item sl-fx-aurora sl-fx-aurora--rim` |
| Inversion band | `sl-invert sl-fx-aurora sl-fx-aurora--linear sl-fx-aurora--top` |

The **section index** is the one declension driven from JavaScript rather than written in markup: `scramble(el)` on an element entering the viewport, which is *something re-resolved* at the smallest scale the grammar has. Bind it with an `IntersectionObserver` over `.sl-section__idx`; it is a text change rather than motion, so it is safe under `prefers-reduced-motion`.

Four families are **not** in that table, and must not be applied by rote: **goo** needs a declared container and a weld gap, both properties of a layout the author owns; **glitch** is fired from JavaScript on a real event; and the **ambient, busy and determinate aurora** readings are budget-limited and bound to an ARIA contract (`aria-busy`, `role="progressbar"` with `aria-valuenow`) — the aurora renders state, it never *is* the state.

### Glass pane — the material (`glass.css`)

The edge below is chrome on the border. This is the **surface inside it**, and it is a separate stylesheet: `glass.css`. Import it whenever you use the glass family; `effects.css` alone gives you the edge and no material.

`mount()` stamps `.sl-glass` on the host and injects four layers beneath the host's own content, so a component needs no wrapper and its text is never filtered:

| Layer | What it is |
|---|---|
| `__backdrop` | the frost — `blur(var(--slg-blur, 5.9px)) saturate(var(--slg-sat, 1.7))` |
| `__tint` | the colour, at `--slg-tint-a` (18% by default, 34% under a lens) |
| `__specular` · `__shine` | the rim highlight and the inner top edge |

**The lens.** Where the browser allows it, `mount()` also gives the host a real refraction — an SVG displacement map in the host's own `backdrop-filter`, so what is *behind* the pane bends while its content stays crisp. The host then carries `.is-lensed`. Three numbers govern it, all readable from CSS on the element:

| Property | Default | What it does |
|---|---|---|
| `--slg-lens-reach` | `18px` on aurora hosts, `6px` otherwise | how far the light bends, in pixels |
| `--slg-lens-bulge` | `0.4` | the convex bulge: magnification at the pane's centre, nothing at the rim; `0` turns it off |
| `--slg-lens-blur` | `2.5px` | the lensed pane's own frost (raised from 1.5px for legibility once the bulge carried the distortion) |
| `--slg-lens-contrast` | `0.72` | how much contrast the page behind keeps; with the text halo on glass surfaces, it is what keeps the copy readable without more blur. `1` turns it off |
| `--slg-lens-disperse` | `90` | the prism, as a **pixel budget**: 0.24px of red-to-blue per unit, so 90 is 21.6px |

Four facts that decide whether your pane looks like glass or like nothing:

- **A pane over flat ground shows nothing.** The material is mostly what is behind it. With one flat colour back there, a bend has nothing to bend and a prism has no edge to open — the pane renders almost identically however its chain is configured. Put glass where there is *content* behind it: over a picture, a data grid, a table, a page that scrolls under it. A pane floating on the canvas is a tinted box, and you may as well have spent nothing.
- **The box caps the bend at a sixth of its shorter side.** `reach` asks; `min(w, h) / 6` decides. A 32px field bends ~5.3px whatever you ask for. This is not tunable from markup, and it exists because a large bend on a small box samples outside the element's own region, which comes back transparent and renders a flat grey slab.
- **The frost and the bend compete, and the frost wins.** A frost wider than the bend erases exactly the detail the bend moved. This is why `--slg-lens-blur` is **2.5px** and not the 5.9px the non-lensed layer runs: at 5.9 the refraction on a field measured at most 10/255 of interior change (taken when fields were 37px and bent 6.2px; a 32px field bends ~5.3px, so the frost wins by more), and raising the bend did not buy it back. 2.5px holds only because the convex bulge (`--slg-lens-bulge`) carries a distortion tens of pixels wide that the frost cannot erase. If you widen the frost on a lensed surface, you are switching the lens off.
- **On a lensed host, `__backdrop`'s own blur is dead.** The host's `backdrop-filter` makes it a backdrop root, so that child layer has nothing behind it left to filter. A lensed pane's only frost is `--slg-lens-blur`; the 5.9px figure applies to non-lensed panes alone. Do not "fix" one by changing the other.

The prism is bounded in `glass-lens.js`, not by you: the split can never exceed twice the bend, so a box with no room gets the widest prism it can hold rather than a red channel displaced backwards. In practice a host from ~65px up gets the full 21.6px and anything smaller degrades smoothly — a 40px button to 13.3px, a 32px icon button to 10.4px.

**Don't**: lower `--slg-lens-bulge` and raise the frost — without the bulge the frost erases the rim bend and the pane reads as a plain frosted box.

### Glass edge — `sl-fx-glass` (`--wide` · `--field`)
The pointer is a light above the surface: a narrow arc of warm white wakes on the border facing it, from 140px before the pointer arrives, and on paper a soft shade answers on the far side. A crossing dims, turns and brightens it again rather than snapping. Nothing is lit at rest, and there is never a disc under the cursor (a test bans a pointer-positioned `radial-gradient`). Tier 1 only: `mount()` writes `--slfx-spec-a` (bearing) and `--slfx-spec-i` (how lit) and the class `is-spec-lit`. The WebGPU chrome that used to draw this edge is retired (2026-09-24); the material and the lens above are not. Width is the border's own, never spent. Substrate: **R** Page, **A** App.
```html
<article class="sl-card sl-fx-glass sl-fx-glass--wide">…</article>
<label class="sl-field">
  <span class="sl-field__label">Product</span>
  <span class="sl-field__control sl-fx-glass sl-fx-glass--field">
    <input class="sl-field__input" type="text">
  </span>
</label>
```
`--wide` widens the CSS fallback ring to 2px for containers (card, dialog, panel); it does not change the chrome, which is always the element's own border width. `--field` marks a field's wrapper: its ring sits on the input's own border, 1px. Glass controls (buttons, icon buttons, `--field` inputs) share one edge: a sharp 1px line on the border and a softer 1px line just inside it. **On a replaced control the `sl-field__control` wrapper is mandatory:** `<input>`, `<textarea>` and `<select>` render no `::before`/`::after`, so the class on the control itself renders nothing at all — no error, no ring.
Consumes: `--slc-border-strong`, `--slc-border-subtle`, `--slc-accent`, `--slc-text` (the chrome's poles and flecks, read at runtime). Don't: thicken it to replace a separator — a separator is always 1px. Don't: put glass or aurora on a component whose own `::after` is load-bearing — both families paint their ring there (`:is(.sl-fx-glass, .sl-fx-aurora)::after`, `effects.css:499`), and the ring rule silently wins over whatever the component needed the pseudo-element for. `.sl-switch__track` is the instance that proved it: the track's `::after` **is** the knob, and glass on the track computed `opacity: 0` there, deleting the knob with no error and no warning. The same collision waits on `::before`: that is where `--pane` seats its pointer-following light, so a component that needs its own `::before` for something load-bearing is in the same position. Check what a component's `::before`/`::after` already does before reaching for either family. Don't: put glass on a container whose own background is structural — a separator, a rule, a divider — rather than a surface. The material clears the host's background so its own tint layer can paint (`glass.css:209`), and a container that has no fill of its own to spare loses whatever that background was doing. `.sl-btn-group` is the instance that proved it: the group's `background` **is** the 1px rule between its members, and glass on the group measured `rgba(0, 0, 0, 0)` there — the rule gone, silently. Same shape as the `::after` collision above, one property over: the effect layer takes over something the component was already using, with no error and no warning. The switch's knob (`::after`), the select's chevron (no pseudo-element at all on a replaced control), and the group's rule (`background`) are three instances of one pattern, in three different properties.

### Aurora — `sl-fx-aurora` (`--wide` · `--field` · `--linear` · `--rim`)
**Work readings (2026-09-25, re-scope R3):** `data-sl-fx-live="run"` (an agent working here, with `aria-busy="true"`) draws two bodies of light travelling the edge; `"busy"` (loading) breathes light in from the edges. Both are WebGL from `live-light.js`, loaded by `mount()`; a `--linear` aurora gets a travelling segment on its underline instead, and a `--rim` or determinate one keeps the CSS arc. Without WebGL, past eight live hosts, or under reduced motion, the CSS arc is the reading. `data-sl-fx-still` on `<html>` (0.18.0) holds the light and every kit animation where they are while the app is idle or unfocused; removing it resumes them from there.
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
`--wide` widens the arc to 2px on containers; `--field` lights a field's input border (1px, the sharp line of the control edge); `--linear` sweeps a segment (a tab's or link's underline; add `--top` for an inversion band's rule) instead of a perimeter and has no busy mode; `--rim` is for filled elements. **On a replaced control the `sl-field__control` wrapper is mandatory** — the control itself hosts no pseudo-element, and `:focus-within` on the wrapper is what lights the arc.
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

### Halftone — `data-sl-halftone`
A picture in round dots whose size follows its light, in a circle that dissolves at its edge; gathers when first seen, then floats. Content, not decoration: under reduced motion it is drawn still. Substrate: **R** Page, **A** App.
```html
<canvas data-sl-halftone data-sl-src="/art/subject.png" data-sl-grid="130" aria-hidden="true"
        style="width: 22rem; aspect-ratio: 1; color: var(--slc-text)"></canvas>
```
Attributes: `data-sl-grid` is cells per side (16–256, default 96); `data-sl-seed` (optional) makes the scatter reproducible; a non-square picture is centre-cropped; `data-sl-ink="spectral"` (opt-in, light theme only) fills the dots with the spectrum ink instead of the single ink, which is the default on every theme since 0.28.
Consumes: the canvas's inherited `color` (set it with a role-var, e.g. `var(--slc-text)` or `var(--slc-accent)`). Don't: feed it a busy photo or a dark render — only one iconic subject with near-binary contrast reads, at ≥ 320px with a grid near 130. Don't: give it meaning — it is a picture, so a label or caption says what it shows; keep `aria-hidden` when the text beside it already does.

### Press — `sl-fx-press`
**You acted on this.** Pressing the control lights it from within: the light rises from its own lower body. Press controls within 48px catch that light on the edge that faces it, the way a lit key lights the keys beside it. On release both fade on their own clocks, and the control squashes like every control while held, returning on the spring token `--sl-motion-spring`. Enter and Space press exactly like a click. Tier 1 (`mount()`); without it a press is the component's own `:active` and the spring squash. Substrate: **A** App/Page.
```html
<div style="display:flex; gap:0.6rem">
  <button class="sl-btn sl-btn--primary sl-fx-press">Run probe</button>
  <button class="sl-btn sl-btn--ghost sl-fx-press">Cancel</button>
</div>
```
Put it on every control in a group, not one: the spill only reaches other `sl-fx-press` hosts. It composes with glass (the spill joins the glass edge as one more layer). `mount()` writes `--slfx-press`, `--slfx-spill` and `--slfx-spill-a`, and the classes `is-press-lit` / `is-spill-lit` while lit.
Consumes: `--slc-accent`. Don't: put it on a switch, checkbox or radio — their own state change is the answer to the press. Don't: put it on a component whose `::before` is load-bearing; the press light paints there while lit.

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

## Signature patterns (shipped classes)

These were CSS to copy until 0.10.0; they are shipped classes now. They carry the composition motifs from `design-language.md` L2/L3, and like every other component they reach colour through `--slc-*` role-vars — which is why `--slc-canvas` exists.

### Wrap — `sl-wrap`
The content measure and the fluid gutter, in one class. `--sl-gutter` is a convention, not a token (`design-language.md` §New-token policy), and this class is where the kit declares it. Substrate: **A** App, **R** Page, **N/A** IDE.
```html
<div class="sl-wrap"> … </div>
```
Consumes: nothing — layout only. Do: put it inside a full-bleed section, so the section's background reaches the viewport edge and only the content is inset. Don't: nest one `sl-wrap` in another; the gutters add up.

### Prose — `sl-prose`
Caps running text at the ~63ch measure. `--sl-measure` is a convention, not a token. Substrate: **A** IDE, **R** App/Page.
```html
<div class="sl-prose"> <p>…</p> </div>
```
Consumes: nothing — layout only. Do: put it on the text container, not on a grid cell that also holds a figure. Don't: let prose run full-bleed; L1 caps the measure for a reason.

### Sticky translucent header — `sl-header`
The house header: sticky, translucent over the page ground, a 1px bottom rule. The lockup left, micro-label meta and sentence-case controls right. Substrate: **R** App/Page, **N/A** IDE.
```html
<header class="sl-header">
  <div class="sl-wrap"> … </div>
</header>
```
Consumes: `--slc-canvas`, `--slc-border-subtle`. Do: put a `sl-wrap` inside it, so the translucency reaches the viewport edge and only the content is inset. Don't: use an opaque header, or a drop-shadow instead of the 1px rule.

### Inversion band — `sl-invert`
A full-width block flipped to paper-on-ink. It punctuates rhythm and marks the thesis or the primary call to action; at least one per long page is idiomatic. Substrate: **R** Page, **A** App, **N/A** IDE.
```html
<section class="sl-invert">
  <div class="sl-wrap"> … </div>
</section>
```
Consumes: `--slc-text`, `--slc-canvas`.

The class re-derives the border, text **and surface** role-vars from the band's own foreground **on its children**, so every component placed inside — card, table, field, callout, checkbox, switch — keeps a visible hairline and a ground it can be read against. Re-deriving only the lines and the text is not enough: a component that paints its own surface would keep the light one and render the re-derived light text on top of it. (This sentence is deliberately on its own line: `scripts/catalog-audit.test.mjs` reads the whole `Consumes:` line and compares every `--slc-*` on it against `catalog.json` as a set, so a role-var named in trailing prose fails parity.)

Do: give it a direct child to hold the content (a `sl-wrap` is the usual one); the re-derivation is a `> *` rule, because a custom property cannot be defined on the same element that reads it. Don't: hand-write an alpha-over-canvas hairline inside the band — that is the bug this class exists to close.

### Hairline grid — `sl-hgrid`
Cards formed by a 1px gap over a line-colour background; cells paint their own surface, producing crisp shared rules instead of doubled borders. This is a signature — prefer it over the bordered-card grid the house style otherwise avoids. Substrate: **R** App/Page, **N/A** IDE.
```html
<div class="sl-hgrid">
  <div>…</div>
  <div>…</div>
  <div>…</div>
</div>
```
Consumes: `--slc-border-subtle`, `--slc-surface`. Do: let the cells be plain elements — the grid paints them. Don't: give a cell its own border; that is the doubling this technique exists to avoid.

### Section with mono index — `sl-section` (`__head` · `__idx`)
A section opens with a micro-label index (mono, uppercase, `--sl-text-micro`) beside its heading, separated from the previous section by a 1px top rule. Substrate: **R** Page, **A** App, **N/A** IDE.
```html
<section class="sl-section">
  <div class="sl-section__head">
    <span class="sl-section__idx">03</span>
    <h2>Signature components</h2>
  </div>
</section>
```
Consumes: `--slc-border-subtle`, `--slc-text-muted`. Do: number it only where the content is a real sequence — L5, structure encodes truth. Don't: number four unrelated sections 01–04 because it looks tidy.

### Oversized display anchor — `sl-anchor`
One oversized display heading per screen, sized by a fluid clamp — a documented pattern, not a token, because the size is fluid — in Geist 600 tracked `-0.05em`, and set solid (`line-height: 1`). Substrate: **R** Page, **A** App where a hero exists, **N/A** IDE.
```html
<h1 class="sl-anchor">Everything measured, nothing asserted.</h1>
```
Consumes: nothing — type only. Do: spend the screen's one oversized element here. Don't: use more than one per screen, and don't set a numeral in the display face — a display-scale numeral is a structural label and stays mono (L1).

### Haze — `sl-haze`
A soft field of the spectrum behind a section: the light theme's colour as atmosphere (Prism). **Opt-in only** — the kit never adds it, and since 0.28 the spectrum paints no edge, rim or arc anywhere by default. Substrate: **A** Page/App, **N/A** IDE.
```html
<section class="sl-haze"> … </section>
```
Consumes: `--slc-haze`. Paints nothing in dark and high-contrast. Do: one per screen, behind a hero. Don't: put it behind body text that must be read at a glance, or stack two.

### Spectral text — `sl-spectral`
A word or phrase of a display heading painted in the spectrum ink (Prism). **Opt-in only**, like `sl-haze`. Substrate: **A** Page/App, **N/A** IDE.
```html
<h1 class="sl-anchor">Everything measured, <span class="sl-spectral">nothing asserted.</span></h1>
```
Consumes: `--slc-spectral-ink`, `--slc-spectral-fill`. Plain text in dark, high-contrast and forced colours. Do: display sizes only (`sl-anchor`, `h1`, `h2`). Don't: body text — the ink clears 3:1, not 4.5.

## Rules of use (all components)

- **Bind role-vars, never literals.** A component's colour comes from a `--slc-*`/`--sl-*` var. A raw hex fails `sl-audit`.
- **Selection and scrollbars come with the kit.** `components.css` paints `::selection` as a 24% wash of the accent with the text paired to its ground (`--slc-text`; ≥ 8:1 in all three themes and in `sl-invert`), and gives the page's own scrollbar a thin `--slc-edge-control` thumb and no track (not on high contrast); `<body>` resets `scrollbar-color: auto` for everything inside it. A product's own `.x::selection` wins on specificity, a later bare `::selection` on order, any `scrollbar-color` on a scroller wins outright. A product ink block that does not re-derive `--slc-text` selects ink on ink: re-derive it, as `sl-invert` does. Inner scrollers, hand-drawn `::-webkit-scrollbar` ones included, are left as they were.
- **One accent hue.** The accent varies per product (see `accent-registry.json`); status colours (success/warning/danger/info) are shared and independent of it.
- **Spend surprise on composition, not materials.** Family resemblance comes from these shared components; distinctiveness comes from how you compose them (≥1 unexpected layout decision per screen).
