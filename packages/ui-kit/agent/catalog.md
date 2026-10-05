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

### Button — `sl-btn` (`--primary` · `--ghost` · `--sm` · `--danger`)
Three Lumen keys (0.32, L2). The primary is a flat key on a **foot**: its accent fill (`--slc-accent-fill` where the product sets one, at any scope), edged in the fill in shade, with one more pixel of that edge along the bottom as a background layer, so its box is a plain button's and the row stays 32px (24px small) whatever padding a product gives `.sl-btn`; pressed, the foot moves to the top and the key sinks a pixel. The secondary (`--ghost`) is a raised key: the raised rung in the one control edge, lit inside its top, on a short cast; hover lifts it to the tile rung. A plain `sl-btn` is text. Substrate: **R** App/IDE, **A** Page.
```html
<button class="sl-btn sl-btn--primary">Save changes</button>
<button class="sl-btn sl-btn--ghost">Cancel</button>
<button class="sl-btn">Skip</button>
<button class="sl-btn sl-btn--primary sl-btn--sm">Add</button>
```
Consumes: `--slc-accent`, `--slc-accent-fill`, `--slc-accent-fill-hover`, `--slc-accent-fill-active`, `--slc-on-accent-fill`, `--slc-accent-subtle`, `--slc-edge-accent`, `--slc-edge-control`, `--slc-edge-control-hover`, `--slc-raised`, `--slc-tile`, `--slc-lit`, `--slc-shadow-sm`, `--slc-text`, `--slc-danger`, `--slc-on-danger`, `--slc-focus`. Do: state the effect in the label (L5 voice). Don't: use a default-blue CTA or `hover:opacity` as the only state. Don't: re-bind `--slc-accent` on the primary to deepen its fill — set `--slc-accent-fill` once on the root (README, Tier B), and every labelled fill follows. A `background` shorthand of your own on a primary strips its foot with its fill (as stripping it to text should).

**Danger tone** (`--danger`, 0.32). A tone on any button, not a variant. On a primary it swaps the fill for the danger, labelled in `--slc-on-danger`, edged and footed in the danger in shade; on a secondary or a plain button it is the danger ink on a 12% wash of itself with a danger edge, filling with the danger on hover. Its focus ring and halo are the danger's. `sl-icon-btn--danger` is the same tone on an icon button.
```html
<button class="sl-btn sl-btn--primary sl-btn--danger">Delete workspace</button>
<button class="sl-btn sl-btn--ghost sl-btn--danger">Drop cache</button>
<button class="sl-btn sl-btn--danger sl-btn--sm">Archive</button>
```
Do: keep one destructive action per view and say in the label what goes. Don't: use the tone for an error state or a warning — that is a badge or a callout; the tone marks an action that destroys something.

**Shortcut in a button** (0.31). A shortcut rides in the label as a child keycap, never as `::after` (glass owns a button's pseudo-elements). Name the shortcut on the button with `aria-keyshortcuts` and hide the cap from its accessible name. The cap is 18px (16px in `--sm`) and gives its extra height back in negative margin, so the button stays on the 32px (24px) row; its text is the label's colour on a fill that steps away from the label, so it never reads weaker than the label on the button: on a neutral button (plain, ghost, a pressed toggle, in a band too) a half wash of the pole opposite the ink; on a primary its fill (the accent, the product's accent fill or the danger) one step further from its label's pole; on a glass pane primary, whose label is re-picked from the composited pane, that composite one step further from the pane's label. High contrast rings it in its label's colour.
```html
<button class="sl-btn sl-btn--primary" aria-keyshortcuts="Meta+S">Save changes <kbd class="sl-kbd" aria-hidden="true">⌘S</kbd></button>
<button class="sl-btn sl-btn--ghost sl-btn--sm" aria-keyshortcuts="R">Re-run <kbd class="sl-kbd" aria-hidden="true">R</kbd></button>
```

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

Consumes: `--slc-sunken`, `--slc-depth-sunk`, `--slc-edge-control`, `--slc-edge-control-hover`, `--slc-text`, `--slc-text-muted`, `--slc-danger`, `--slc-focus`. The input is a well (0.32): the sunken rung and the sunk inset cast inside the one control edge; focused (on any focus, a pointer's included), the border takes the ring's colour and the halo rings it. Do: keep the shared focus ring. `sl-field__control` is the wrapper an effect binds to — see Glass and Aurora below; without an effect the field needs no wrapper.

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

Consumes: `--slc-sunken`, `--slc-edge-control`, `--slc-accent`, `--slc-accent-fill`, `--slc-on-accent-fill`, `--slc-edge-accent`, `--slc-glow`, `--slc-text`, `--slc-focus`. The box is a small well on the sunken rung (0.32); checked or mixed, it is the accent fill on an inset foot of its own shade, with a soft glow of the fill as strong as `--slc-glow`. Do: keep the four parts in that order — `sl-check__box` is styled by an adjacent-sibling selector, so an element between it and `sl-check__input` breaks every checked state. Don't: hide the input with `display:none` or `visibility:hidden`; both remove it from the focus order and the control stops being reachable by keyboard.

### Radio — `sl-radio` (`__input` · `__box` · `__label`)
The checkbox's shape with a round box and a dot. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-radio">
  <input class="sl-radio__input" type="radio" name="tier">
  <span class="sl-radio__box"></span>
  <span class="sl-radio__label">Tier A — full theme selector</span>
</label>
```
Consumes: `--slc-sunken`, `--slc-edge-control`, `--slc-accent`, `--slc-accent-fill`, `--slc-on-accent-fill`, `--slc-edge-accent`, `--slc-glow`, `--slc-text`, `--slc-focus`. Checked, like a checkbox: the accent fill on its foot, with its glow. Do: give every radio in a set the same `name`. Don't: use a radio where only one option exists — that is a checkbox.

### Switch — `sl-switch` (`__input` · `__track` · `__label`)
A checkbox that reads as a state rather than a choice: use it where the change takes effect immediately, and a checkbox where it takes effect on submit. Substrate: **R** IDE/App, **A** Page.
```html
<label class="sl-switch">
  <input class="sl-switch__input" type="checkbox" role="switch">
  <span class="sl-switch__track"></span>
  <span class="sl-switch__label">Tier 2 GPU effects</span>
</label>
```
Consumes: `--slc-sunken`, `--slc-depth-sunk`, `--slc-edge-control`, `--slc-accent`, `--slc-accent-fill`, `--slc-on-accent-fill`, `--slc-edge-accent`, `--slc-glow`, `--slc-text`, `--slc-focus`. The track is sunk (0.32): 2.1 × 1.25rem, border-box, a 0.85rem knob 2px in from either end; on, it is the accent fill on its foot with its glow, the knob in the fill's label. Do: carry `role="switch"` on the input, so the state reaches a screen reader as on/off rather than as checked. Don't: put ON/OFF text inside the track — the knob's position is the state, and a label that repeats it goes stale in translation.

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
Consumes: `--slc-border-subtle`, `--slc-text`, `--slc-text-secondary`, `--slc-surface`, `--slc-tile`, `--slc-depth-tile`. Do: `--numeric` for tabular figures. A selected row is `<tr aria-selected="true">` (0.31): a raised tile — the tile fill and `--slc-depth-tile` on the row, so the ring and the lit line run unbroken across its cells, and the rules above and below it give way. A row has no corners, so the tile is square. The ring and the cast are what find it: on the light theme the tile is the table's own white, so the fill alone measures 1.00:1, and an engine that does not paint a row's shadow shows nothing. Under forced colours the rules around it are drawn in `Highlight`. **`aria-selected` on a `<tr>` is announced only in a `role="grid"` (or `treegrid`)**: give an interactive table that role, or carry the state in the row itself — a checkbox cell, or a visually hidden "selected".
```html
<table class="sl-table" role="grid" aria-label="Probes" aria-multiselectable="true">
  <tbody>
    <tr aria-selected="true"><td>q-8f2a</td><td>Deterministic resolve</td></tr>
    <tr aria-selected="false"><td>q-77c1</td><td>Evidence replay</td></tr>
  </tbody>
</table>
```

### Tabs — `sl-tabs` (`__list` · `__tab` · `--tile` · `__item` · `__dot` · `__close`)
Visual-only tabs (consumer wires ARIA + panel switching). Active tab uses a 2px accent underline — an emphasis accent, not a separator. Substrate: **R** App.
```html
<div class="sl-tabs">
  <div class="sl-tabs__list" role="tablist">
    <button class="sl-tabs__tab" aria-selected="true">Tokens</button>
    <button class="sl-tabs__tab">Components</button>
  </div>
</div>
```
Consumes: `--slc-accent`, `--slc-text`, `--slc-text-secondary`, `--slc-text-muted`, `--slc-border`, `--slc-tile`, `--slc-depth-flat`, `--slc-seam`. On the underline tabs the active state is the accent (never a neutral). On the tile tabs below it is a neutral tile with the kit's seam, a short line 3px above its bottom edge (the wrapper `sl-tabs__item` carries it in the second pattern), and the accent is otherwise only its icon.

**Tile tabs — `sl-tabs--tile`** (0.31, Lumen): the editor's tab strip. A modifier on the same tablist: no rule under the strip, no underline; the active tab is a flat tile (`--slc-tile` with `--slc-depth-flat`: lit and ringed, no cast) in the primary ink, its icon in the accent; hover is a flat wash that lifts the ink to the secondary. Since 0.34 a tab is Lumen's: 28px at r7, 13px at weight 500, 11.2px in (off the kit's radius and spacing scales, as the workbench chrome is, L2). Inside a tab, in order: an icon, the name, `sl-tabs__dot` (unsaved work) and `sl-tabs__close`. The dot is a dot, so it is `aria-hidden` and the tab's name says the state in words. The close glyph is borderless chrome — the one documented exception to the one control edge (design-language L3). A `<button>` may not sit inside `role="tab"`, so there are two patterns, and the consumer wires the closing in both: an `aria-hidden` span inside the tab for the pointer, with Delete on the focused tab (announced with `aria-keyshortcuts`); or, so assistive tech reaches the close by name, the tab and a sibling `<button class="sl-tabs__close" tabindex="-1" aria-label="Close …">` in a `role="none"` wrapper, `sl-tabs__item`, which then carries the tile. Substrate: **R** IDE, **A** App.
```html
<div class="sl-tabs__list sl-tabs--tile" role="tablist" aria-label="Open files">
  <button class="sl-tabs__tab" role="tab" aria-selected="true" aria-keyshortcuts="Delete">
    <span>resolve.ts</span><span class="sl-tabs__dot" aria-hidden="true"></span><span class="sl-tabs__close" aria-hidden="true">×</span>
  </button>
  <button class="sl-tabs__tab" role="tab" aria-selected="false" aria-keyshortcuts="Delete"><span>cache.ts</span></button>
</div>
<div class="sl-tabs__list sl-tabs--tile" role="tablist" aria-label="Open files">
  <div class="sl-tabs__item" role="none">
    <button class="sl-tabs__tab" role="tab" aria-selected="true" aria-keyshortcuts="Delete"><span>evidence.ts</span></button>
    <button class="sl-tabs__close" type="button" tabindex="-1" aria-label="Close evidence.ts">×</button>
  </div>
</div>
```
Don't: pair it with `sl-fx-aurora--linear` — that rides the underline, which a tile tab does not have. Don't: put a real `<button>` inside the tab.

### Tooltip — `sl-tooltip`
A CSS-only label above its host, in the inverted ink. The text lives in `data-sl-tooltip`; a host that is not already focusable takes `tabindex="0"` so the keyboard reveals it too. Substrate: **R** App/IDE, **A** Page.
```html
<span class="sl-tooltip" data-sl-tooltip="Measured on the canvas ground" tabindex="0">4.89:1</span>
<button class="sl-icon-btn sl-tooltip" data-sl-tooltip="Re-run the audit" aria-label="Re-run the audit">↻</button>
```
Consumes: `--slc-text`, `--slc-raised`. It rises 4px into place as it fades in, on `--sl-motion-mid` and the arrival curve `--sl-motion-enter` (still under reduced motion). Do: keep it to one short line (it never wraps). Don't: put anything a user must read to act in a tooltip — it is a hint, invisible on touch; and on an icon button repeat the text in `aria-label`, since the pseudo-element is not its accessible name.

### Kbd / inline code — `sl-kbd` · `sl-code`
A keycap (0.31, Lumen) and inline monospace code. The keycap is a small physical key: Geist Mono 500, at least 20px square, radius 5, a fill that steps from raised to surface, a ring, a lit top line and a base that is its own fill in shade (`--slc-depth-key`). One cap per key. High contrast rings it in white; under forced colours, which drop the depth, it gets a drawn `CanvasText` edge. Inside a button it is the in-button key (see Button). Substrate: **A**.
```html
Press <kbd class="sl-kbd">⌘</kbd><kbd class="sl-kbd">K</kbd>, then run <code class="sl-code">sl-audit</code>.
```
Consumes: `--slc-raised`, `--slc-surface`, `--slc-text-secondary`, `--slc-depth-key`, `--slc-accent-text`, `--slc-accent-subtle`, `--sl-font-mono`.

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
Consumes: `--slc-raised`, `--slc-border`, `--slc-overlay`, `--slc-text`, `--slc-text-secondary`, `--slc-depth-float`. It floats on the overlay cast (`--slc-depth-float`, three layers under its own border in shade, which is the ring) at `--sl-radius-lg` (14px since 0.31). Opened with `showModal()`, it rises 6px and fades in with its backdrop, and falls back as it closes where `overlay` is supported (`@starting-style` and transitions on `--sl-motion-mid` with the arrival curve `--sl-motion-enter`; no keyframes). Reduced motion, or a browser without `@starting-style`, opens it at once. Don't: put a `display` of your own on a closed `sl-dialog` to show it — a closed dialog is transparent; set `open` instead.

### Toast — `sl-toast-stack` · `sl-toast` (`__live` · `--info` · `--success` · `--warning` · `--danger` · `__mark` · `__content` · `__title` · `__body` · `__dismiss`)
A message that arrives (0.33, Lumen), in a stack fixed to the bottom right, newest last, nearest the corner. Since 0.34 it is Lumen's toast: the raised rung at r12 on Lumen's cast (`--slc-depth-cast`), whose ring is its only edge, so it keeps no border (under forced colours, which drop the cast, it gets a `CanvasText` outline inside its box); padding 12.8 / 12.8 / 14.4 / 16px. The tone is a 1px line of light on its top edge, from 14px in to the middle, fading, glowing at 50% wherever `--slc-glow` is not 0 (not in high contrast; drawn in `CanvasText` under forced colours), and the 16% wash under its 26px mark. The words stay neutral. It arrives as the dialog does: a 6px rise and a fade from `@starting-style`, on `--sl-motion-mid` and the arrival curve, with transitions only, so reduced motion shows it at once. In `components.css`. Substrate: **R** App/IDE, **A** Page.
```html
<div class="sl-toast-stack">
  <div class="sl-toast-stack__live" aria-live="polite"><div class="sl-toast sl-toast--success">
      <span class="sl-toast__mark" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor"><path d="m3.5 8.5 3 3 6-7"/></svg></span>
      <div class="sl-toast__content">
        <p class="sl-toast__title">Probe saved</p>
        <p class="sl-toast__body">q-8f2a re-runs in 14 days</p>
      </div>
      <button class="sl-btn sl-btn--sm">Undo</button>
      <button class="sl-icon-btn sl-toast__dismiss" aria-label="Dismiss">×</button>
      <div class="sl-progress sl-toast__timer" role="progressbar" aria-label="Time left" aria-valuemin="0" aria-valuemax="100" aria-valuenow="62" style="--sl-progress: 62%"><span class="sl-progress__bar"></span></div>
    </div></div>
  <div class="sl-toast-stack__live" role="alert"></div>
</div>
```
Consumes: `--slc-raised`, `--slc-depth-cast`, `--slc-text`, `--slc-text-secondary`, `--slc-text-muted`, `--slc-glow`, `--slc-info`, `--slc-success`, `--slc-warning`, `--slc-danger`. A bare `sl-toast` is neutral: its tick and mark use the muted ink. The dismiss is the icon button's own 32px (24 before 0.34), and it keeps the one control edge. A toast that dismisses itself shows its time left as `sl-toast__timer` on an `sl-progress`: no track, a 2px bar of the tone at 70% along the flat of the bottom edge, 14px in from either end; say the time in its `aria-valuenow`.

**Live regions.** The stack itself has no role, so it is not a landmark. It holds two regions side by side, never one inside the other: a polite one (`aria-live="polite"`) for every toast, and an alert one (`role="alert"`) for a toast that must interrupt. The toasts carry no role, so nothing is read twice. Keep both regions in the DOM, empty, from page load, because a region that is inserted together with its content is not announced. Never hide an empty region with `display: none` or `display: contents`: it would drop out of the accessibility tree.

**Above a modal dialog (opt-in).** A `showModal()` dialog sits in the top layer, above any `z-index`. A stack that must show over one is a manual popover: add `popover="manual"` to the stack and call `showPopover()` once. Without that call the popover stack stays hidden, and its regions with it. A closed popover's regions are hidden live regions, which announce nothing. After a dialog opens, call `hidePopover()` and then `showPopover()` again, so the stack is the later of the two in the top layer. Add the toast a frame later (`requestAnimationFrame`): the regions have only just come back into the accessibility tree, and an addition in the same frame may not be heard. The stack undoes the browser's popover box (inset, margin, padding, border, background, overflow), and a closed one stays hidden.

Do: mount the stack as a child of `<body>`, never inside an `sl-invert` band, whose roles are washes of the band's own ground. Do: pause any auto-dismiss while the toast is hovered or focused, and never auto-dismiss a toast that offers an action. Don't: move focus to a toast, or put the only path to an action in one. Don't: put glass, press or glitch on a toast. Its tick is its `::before`, which those three need; `::after` is left free for the aurora.

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
Consumes: `--slc-sunken`, `--slc-depth-sunk`, `--slc-edge-control`, `--slc-tile`, `--slc-depth-tile`, `--slc-text-muted`, `--slc-text`, `--slc-seam`, `--slc-focus`. The track is a well (0.32: the sunken rung and the sunk cast in the one control edge), and the chosen segment is a raised tile standing out of it (0.31): the tile fill, a lit top line, a ring and a short cast, with the kit's seam 3px above its bottom edge (0.33). Do: drive the selected state with `aria-selected` — the CSS reads it, so the accessible state and the visible state cannot drift apart. When it switches a setting rather than a view, it is a group of toggle buttons: `role="group"` on the control and `aria-pressed` on the items, which the CSS reads the same way. Don't: use it for more than about four options; that is a `select`.
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

### Icon button — `sl-icon-btn` (`--round` · `--danger`)
A square icon-only control: clear at rest in the one control edge, its glyph in the secondary ink, the surface rung under it on hover (0.32). The kit ships no icon set: supply your own `<svg>` and let it inherit `currentColor`. Substrate: **R** IDE/App, **A** Page.
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
Consumes: `--slc-edge-control`, `--slc-edge-control-hover`, `--slc-surface`, `--slc-text-secondary`, `--slc-text`, `--slc-accent`, `--slc-accent-subtle`, `--slc-danger`, `--slc-on-danger`, `--slc-focus`. As a toggle it takes `aria-pressed`, painted like the toggle button's. `--danger` is the button's danger tone (a remove or delete glyph). The edge stays: only a chrome glyph inside a workbench primitive (a tab's close, 0.31; the activity bar, 0.33) may drop it. Do: give it an `aria-label` — an icon-only control has no accessible name otherwise. `sl-icon-btn--round` is the round silhouette the liquid's `--drop` is allowed on, and the only element in the kit that is; the author still writes `sl-fx-liquid sl-fx-liquid--drop`, because L6 makes the modifier in the markup the contract and forbids anything from measuring a radius to decide. Don't: put `--round` on a text button; the deformation belongs to a round silhouette.

### Pagination — `sl-pagination` (`__item`)
Numbered navigation across pages of results. Mono tabular figures (L1). Substrate: **R** App, **A** Page, **N/A** IDE.
```html
<nav class="sl-pagination" aria-label="Pagination">
  <a class="sl-pagination__item" href="?p=1">1</a>
  <a class="sl-pagination__item" href="?p=2" aria-current="page">2</a>
  <a class="sl-pagination__item" href="?p=3">3</a>
</nav>
```
Consumes: `--slc-text-muted`, `--slc-text`, `--slc-tile`, `--slc-depth-tile`, `--slc-seam`, `--slc-focus`. The current page is a raised tile with the kit's seam 3px above its bottom edge (0.33), and hover is a flat wash (0.31; hover drew the control edge's hover step before, and the items are now borderless). Do: mark the current page `aria-current="page"`. There is no ellipsis class — a truncated range is a product decision, and the caller writes `<span class="sl-pagination__item" aria-hidden="true">…</span>`. Don't: render a page count you have not measured (L5, structure encodes truth).

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
Consumes: `--slc-text`, `--slc-text-muted`. The label is a micro label (mono, uppercase, `--sl-text-micro`). Do: keep the value in the mono face whatever its size — a display-scale numeral is a structural label and stays mono (L1; owner's ruling, 2026-09-13, after Fraunces at `opsz` 144 was tried and rejected; confirmed 2026-10-02, when Lumen's Geist 600 figures were considered and declined). Don't: set a stat you have not measured.

## App structure

### Sidebar nav — `sl-nav` (`__group` · `__item` · `__count`)
A vertical list of destinations under micro-label group titles (mono, uppercase, `--sl-text-micro`). The current one is `aria-current="page"` and is a raised tile (0.31, Lumen): the tile fill, a lit top line, a ring and a short cast, in the primary ink, with a **seam** — a 2px line, half the item's height, 3px inside its leading edge (owner, 2026-10-02: the tile alone reads ~1.0–1.3:1 against its ground; the seam ≥ 3:1 against the tile on every ground). Since 0.33 the seam is the kit's one state cue for every selected or current tile, and it says where the focus is: the accent (`--slc-seam`) while the nav holds the focus, the muted ink while it does not. An icon in it takes the accent. Hover is a flat wash; only the current item lifts. (Until 0.31 it took a 2px accent edge on the leading side over the accent wash.) Substrate: **R** App/IDE, **N/A** Page.
```html
<nav class="sl-nav" aria-label="Sections">
  <div class="sl-nav__group">Observe</div>
  <a class="sl-nav__item" href="/live" aria-current="page">Live <span class="sl-nav__count">12</span></a>
  <a class="sl-nav__item" href="/sessions">Sessions <span class="sl-nav__count">340</span></a>
</nav>
```
Consumes: `--slc-text-muted`, `--slc-text-secondary`, `--slc-text`, `--slc-accent-text`, `--slc-tile`, `--slc-depth-tile`, `--slc-seam`, `--slc-focus`. The seam is a layer of the item's own background, not a pseudo-element, so an effect family on the item keeps its `::before`; a `background` shorthand of yours on the current item wipes it (set `background-color`). Do: mark the current destination with `aria-current` (`aria-current="false"` is not current), not a class. Give the nav a little inset (its pane's padding) so the tile's ring and cast have room. Don't: use it as the page's only navigation on a marketing page — that is the header's job.

### List — `sl-list` (`__row` · `__meta` · `--dense`)
Selectable rows for a master-detail pane or a feed. A row is a `<button>`/`<a>`, or `role="option"` inside `role="listbox"`; the selected one is `aria-selected="true"` (or `aria-current` on a link). `--dense` is the IDE register: mono, tighter. Substrate: **R** App/IDE, **A** Page.
```html
<div class="sl-list" role="listbox" aria-label="Sessions">
  <button class="sl-list__row" role="option" aria-selected="true">Refactor the audit<span class="sl-list__meta">2m ago · 14 tools</span></button>
  <button class="sl-list__row" role="option" aria-selected="false">Prism light theme<span class="sl-list__meta">1h ago · 212 tools</span></button>
</div>
```
Consumes: `--slc-text`, `--slc-text-muted`, `--slc-text-secondary`, `--slc-accent-text`, `--slc-tile`, `--slc-depth-tile`, `--slc-seam`, `--slc-focus`. The selected row is a raised tile (0.31; the accent wash with a pressed edge before) with the kit's seam on its leading edge (0.33: the accent while the list holds the focus, the muted ink while it does not), its meta in the secondary ink and an icon in it in the accent; hover is a flat wash. An icon's colour on a selected row (`> svg`, weighing (0,3,1) and more) outranks a single-class colour of yours on the icon: colour your file icons at that weight, or not on a selected row. Rows are borderless, the old 1px border is padding, so a row is the size it was. Do: let the row's own markup carry its columns (a grid inside the row is fine). Don't: use it for tabular data with comparable columns — that is `sl-table`.

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

## Workbench (opt-in, `workbench.css`)

The chrome of a workbench, such as an IDE or a console (0.33, Lumen; since 0.34 the geometry the Lumen IDE screen renders at 1440×900): a title bar, panes, a status bar, an activity bar, a tree, a command palette and terminal blocks. It is a separate stylesheet imported after `components.css`. It reads that file's role-vars, depth recipes, shared focus rule and shared seam, and it adds no role of its own (the lit pane's three roles, 0.34, live in `components.css` with the depth recipes). Panes are islands of light on the darker frame (the canvas), and the pane that holds the focus is lit. The frame's own chrome (the title bar, the status bar and the activity bar) sits on the canvas and paints no ground of its own. Its geometry is Lumen's and steps off the kit's 4px grid and spacing scale (L2): a 44px title bar, 38px activity items at r9, 26px tree rows, a 30px status bar with 22px items, 6px gaps.

**Paint layers.** Glass, press and glitch own an effect host's `::before`, and the aurora owns its `::after`. A selected or current tile's seam is a layer of its host's background, so an effect keeps its pseudo-elements. A `background` shorthand of yours on such a host wipes the seam; set `background-color`. Four marks are a `::before` instead: the lit pane's seam, which must paint over the pane's own children (a header or a tab strip with a ground of its own), the palette's seam (0.34, Lumen's line of light with its glow), the terminal block's exit mark, and the toast's tick (in `components.css`). Glass, press and glitch are unsupported on those four hosts, while the aurora is not. Nothing takes `::after`. The title bar's dots and the activity item's count badge (0.34) are children or background layers, so they take no pseudo-element.

**The inversion band.** Inside an `sl-invert` band, only `.sl-term-block` is supported, set straight on the band (a real-content block, L3). Everything else here is the chrome of a workbench, which lives on the workbench's frame.

### Title bar — `sl-titlebar` (`__l` · `__menu` · `__mark` · `__dot` · `__crumb` · `__sep` · `__cmd` · `__cmd-text` · `__keys` · `__r` · `__btn` · `__btn--dot`)
The workbench's top frame (0.34), on the canvas as Lumen draws it: a 44px grid of three tracks, `1fr minmax(0, 32rem) 1fr`, so the command field holds a centre track of up to 512px. On the left (`__l`, 12px apart): a slot for a compact menu button (`__menu`, an app whose menus are not the system's: Windows, Linux), the product's mark (`__mark`: the display face, 700 at 15px, tracked -0.04em, with `__dot`, a 5px dot of the accent, a child sitting 1px up) and a crumb (`__crumb`: 13px in the secondary ink, its `__sep` separators muted, an ellipsis where it runs out). In the centre the command field (`__cmd`): 30px at r8 in the one control edge, the surface rung lit along its top, the muted ink at 13px, the raised rung and the edge's hover step under the pointer, the shared flush ring and halo on focus; `__cmd-text` takes the room, `__keys` holds the keycaps. On the right (`__r`, 8px apart) the title-bar icon buttons (`__btn` on an `sl-icon-btn`), which rest on the surface rung in the icon button's own edge; `__btn--dot` draws Lumen's 6px unread dot on the corner, ringed in the surface, in the product's labelled fill (`--slc-accent-fill`) or the accent as a mark. Substrate: **R** IDE, **A** App, **N/A** Page.
```html
<header class="sl-titlebar">
  <div class="sl-titlebar__l">
    <button class="sl-icon-btn sl-titlebar__btn sl-titlebar__menu" aria-label="Menu">…</button>
    <span class="sl-titlebar__mark">spexr<span class="sl-titlebar__dot" aria-hidden="true"></span></span>
    <span class="sl-titlebar__crumb">probe-engine<span class="sl-titlebar__sep" aria-hidden="true">/</span>src</span>
  </div>
  <button class="sl-titlebar__cmd" type="button" aria-keyshortcuts="Meta+P">
    <span class="sl-titlebar__cmd-text">Search files, run a command</span>
    <span class="sl-titlebar__keys" aria-hidden="true"><kbd class="sl-kbd">⌘</kbd><kbd class="sl-kbd">P</kbd></span>
  </button>
  <div class="sl-titlebar__r">
    <button class="sl-icon-btn sl-titlebar__btn" aria-label="Toggle the right panel">…</button>
    <button class="sl-icon-btn sl-titlebar__btn sl-titlebar__btn--dot" aria-label="Notifications, 3 unread">…</button>
  </div>
</header>
```
Consumes: `--slc-text`, `--slc-text-secondary`, `--slc-text-muted`, `--slc-accent`, `--slc-accent-fill`, `--slc-accent-text`, `--slc-surface`, `--slc-raised`, `--slc-lit`, `--slc-edge-control`, `--slc-edge-control-hover`, `--slc-focus`. **The bar drags the window**: it is `-webkit-app-region: drag` (Electron) and `app-region: drag` (a web app's window-controls overlay), and every button, link, field, `role="button"` and tab stop in it is `no-drag`, so the pointer reaches them. A control of yours that is none of those (a `<div>` with a click handler) needs `no-drag` of its own. A product that draws the system's window buttons (macOS traffic lights) gives the bar their room as its own `padding-inline-start`, and drops it in full screen. The mark is the product's name, not the Sondalab wordmark, which is the brand face's (`sl-wordmark`). The dot on the bell is a layer of the button's background, so its pseudo-elements stay an effect's; forced colours drop it with every image, so **the button's name says the state** ("Notifications, 3 unread"). Do: put the product's real Quick Open shortcut in `__keys`, from its keybinding registry, and name it in `aria-keyshortcuts`. Don't: nest a second drag region, or put the title bar in an `sl-invert` band.

### Pane — `sl-pane` (`[data-lit]`)
An island: the surface rung on the canvas, drawn with the island recipe (a lit top hairline and the quieter ring) at `--sl-radius-pane` (10px), with no border of its own. `data-lit` marks the pane that holds the focus. That pane is the raised rung. A seam of the accent runs along its top edge as a line of light (`--slc-seam`), from where the pane's corner ends (10px in, since 0.34): it fades in from the leading edge and out before the far one, mirrored right to left. It is the pane's `::before`, at `z-index: 1`, so a header or a tab strip with a ground of its own does not cover it; an overlay with a `z-index` of its own still paints over it. The seam's light falls below the pane (`--slc-lit-drop`, 0.34; it fell round the pane before) as strongly as `--slc-glow` allows. Substrate: **R** IDE, **A** App, **N/A** Page.
```html
<div style="display: flex; gap: var(--sl-space-2); padding: var(--sl-space-2); background: var(--slc-canvas)">
  <aside class="sl-pane" aria-label="Explorer">…</aside>
  <main class="sl-pane" data-lit aria-label="Editor">…</main>
</div>
```
Consumes: `--slc-surface`, `--slc-raised`, `--slc-depth-island`, `--slc-seam`, `--slc-glow`, `--slc-lit-drop`.

**The lit pane's light, as Lumen renders it** (0.34; owner: no accent rim round the pane). Three roles, declared with the depth recipes in `components.css` and re-derived on every pane from its own seam, carry it, so a product paints it on its own chrome without a literal. Each reads `--slc-glow` and is nothing in high contrast and under forced colours.
- **Wash** (the role `--slc-lit-wash`) — an image for the tab strip or the head along the lit pane's top edge: a radial wash of the seam (26% at its peak on ink, 18% on paper) peaking toward the seam's leading end and gone by 78%, sized by the box it is painted on. Its colour is the seam capped at oklch L 0.72 (spexr's indigo passes untouched), so a muted label **centred** in a 38px strip reads at least 4.55:1 for every product; a label against the strip's top edge reads less.
- **Tint** (`--slc-lit-tint`) — an image for the row under it (breadcrumbs): the seam at 7% (3.5% on ink, 2.45% on paper) fading down the row, over the row's own fill.
- **Drop** (`--slc-lit-drop`) — one shadow, the glow below the lit pane, which the pane wears. A product whose layout clips the pane's own shadow (Lumino's `contain: strict`) wears it **inward** on the element right under the pane, `box-shadow: inset var(--slc-lit-drop)`: the same falloff from the same line, inside a box the clip cannot cut.
```css
.my-editor[data-lit] .my-tabstrip { background-image: var(--slc-lit-wash); }
.my-editor[data-lit] .my-breadcrumbs { background-image: var(--slc-lit-tint); }
.my-split:has(> .my-editor[data-lit]) > .my-handle { box-shadow: inset var(--slc-lit-drop); }
```
High contrast draws the island as a ring in the theme's line and the seam in its yellow. Under forced colours the pane gets a `CanvasText` outline inside its box, and the lit pane a 2px `Highlight` one, with its seam in `Highlight`. **Lit and focused are two things.** `data-lit` is where the focus is in the workbench: you set it, and it stays while a palette or a menu holds the focus over the pane. The selections inside the pane follow the actual focus. So while a palette is open, the editor stays lit and a tree in it reads as unfocused (its seam muted). Do: set `data-lit` on one pane per workbench. Do: put a gap between panes (Lumen's 6px) and give the frame a little padding, so the rings and the drop have room. Don't: give a pane a border (a recipe host has none: the lit line sits flush under the ring), or put glass, press or glitch on it: its seam is its `::before`.

### Status bar — `sl-statusbar` (`__item` · `__value` · `__sep` · `__dot` · `__spacer`)
The workbench's meta line, on the canvas, as Lumen draws it. Facts are in the sans at the small step (`--sl-text-xs`, 12px), in sentence case, in the muted ink, each a 22px pill at r6 that brings the surface rung up under the pointer (0.34). A value read as data (a branch, a model, a count) is `__value`, in the mono at the primary ink, as written: a branch is case-sensitive, so nothing is upper-cased. Hairlines between groups of facts are off, as Lumen draws none: `sl-statusbar--separators` on the bar turns the `__sep` hairlines on (they were on by default before 0.34). An accent dot marks a live state, while the words carry that state; it breathes, a ring of itself swelling and fading every 2.4s (`--sl-motion-fast` × 20 on the arrival curve), only under `prefers-reduced-motion: no-preference`, and never under forced colours. The bar's height is its own (30px; 28 before 0.34), 4px in at the start and 8 at the end, so an item with an icon or a dot cannot move it, and a fact that does not fit ends in an ellipsis. Substrate: **R** IDE, **A** App, **N/A** Page.
```html
<footer class="sl-statusbar" aria-label="Status">
  <span class="sl-statusbar__item"><span class="sl-statusbar__value">feat/K6-workbench</span> ↑2</span>
  <span class="sl-statusbar__sep" aria-hidden="true"></span>
  <span class="sl-statusbar__item"><span class="sl-statusbar__dot" aria-hidden="true"></span>2 agents running</span>
  <span class="sl-statusbar__spacer"></span>
  <span class="sl-statusbar__item">Ln 42, Col 18</span>
  <span class="sl-statusbar__item">UTF-8</span>
  <span class="sl-statusbar__item">Opus · <span class="sl-statusbar__value">1.2k</span> tok/s</span>
</footer>
```
Consumes: `--slc-text-muted`, `--slc-text`, `--slc-border`, `--slc-accent-text`, `--slc-surface`, `--slc-focus`. The dot is the accent as text, a thin mark: on paper the accent itself is a fill (the default's amber reads 1.6:1 on the canvas). The separator is a border, not a fill, so it survives forced colours. The dot is drawn in `CanvasText` there. Don't: put `role="status"` on the bar. Every fact in it would be read out each time the caret moves. Give a fact that must be heard when it changes a `role="status"` of its own. A `<footer>` that is a direct child of `<body>` is the page's `contentinfo` landmark; inside an application shell, make the bar a `<div role="group" aria-label="Status">` instead. Do: make an item that opens something a `<button>` (or a link) with the same class: its chrome is reset, it takes the shared flush ring and halo, and the bar clips only horizontally, so the halo still shows.

### Activity bar — `sl-activitybar` (`__item`)
The column of views on the frame, on the canvas. Its items are chrome glyphs and **borderless**: together with the tab's close glyph, they are the owner-approved exception to the one control edge (L3). A strip of glyphs, each in its own edge, would put an edge beside every edge. A glyph is in the muted ink (≥ 3:1 as a graphical object), and hover is a flat wash. The current view is a flat tile on the surface rung (0.34; the tile rung before) with the kit's seam on its leading edge, and its glyph is in the accent. Since 0.34 the bar is Lumen's: 52px wide, 38px items at r9, 6px apart, 4px from the top; a count is a child of the item, `sl-activitybar__badge`, a badge on its corner: the mono at 9px on the accent fill that carries a label (`--slc-accent-fill`, or the accent), its label picked on that fill, ringed 2px in the canvas, at least 20 × 14px. Substrate: **R** IDE, **N/A** App/Page.
```html
<nav class="sl-activitybar" aria-label="Views">
  <button class="sl-activitybar__item" aria-label="Explorer" aria-current="true"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 1.75h5l3.25 3.25v9H4Z"/></svg></button>
  <button class="sl-activitybar__item" aria-label="Search"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="7" cy="7" r="4.25"/></svg></button>
  <button class="sl-activitybar__item" aria-label="Source control, 3 changes"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="4.5" cy="3.5" r="1.5"/></svg><span class="sl-activitybar__badge" aria-hidden="true">3</span></button>
</nav>
```
Consumes: `--slc-text-muted`, `--slc-text`, `--slc-surface`, `--slc-depth-flat`, `--slc-seam`, `--slc-accent-text`, `--slc-accent-fill`, `--slc-accent`, `--slc-canvas`, `--slc-focus`. The badge is a child, never a pseudo-element (the item is an effect host, and the aurora owns its `::after`); it is `aria-hidden`, so the item's name says the count ("Source control, 3 changes"); under forced colours it is drawn in system colours. The state is `aria-current` (a view, a link; `aria-current="false"` is not current) or `aria-selected="true"` (a `role="tab"` in a `role="tablist"`, as an IDE's activity bar often is). Focus is the shared flush ring and halo. Do: name each view in `aria-label`, because the glyph is not a name. Don't: give an item a border or a fill at rest. Don't: use the borderlessness outside a strip of chrome glyphs. A lone icon button keeps its edge (`sl-icon-btn`).

### Tree — `sl-tree` (`__row` · `__twisty` · `__label`)
A file tree, as Lumen draws it (0.34). Rows are 26px at 13px (24px at 14px before), and each is indented by its level. Hairline guides under every ancestor's twisty are opt-in, `sl-tree--guides` on the tree (Lumen draws none; they were on by default before 0.34). The twisty is a 16px box holding a chevron the size of Lumen's 12px chevron glyph (6px tall, 3px deep), drawn from two borders rather than a glyph: it needs no markup and no icon, and it turns between the two states, pointing at the hidden children and turning down with `aria-expanded` (a rotation, on the motion tokens). Selection is a tile (the K4 recipe) with the kit's seam. While the tree has the focus, the selected row is the raised tile with its cast, and its seam and its icon are in the accent. While the focus is elsewhere, it is a flat tile (lit and ringed, no cast), and its seam and its icon are in the muted ink. Substrate: **R** IDE, **A** App, **N/A** Page.
```html
<ul class="sl-tree sl-tree--guides" role="tree" aria-label="Files">
  <li class="sl-tree__row" role="treeitem" aria-level="1" aria-setsize="1" aria-posinset="1" aria-expanded="true" aria-selected="false" tabindex="-1">
    <span class="sl-tree__twisty" aria-hidden="true"></span><span class="sl-tree__label">src</span></li>
  <li class="sl-tree__row" role="treeitem" aria-level="2" aria-setsize="2" aria-posinset="1" aria-selected="true" tabindex="0">
    <span class="sl-tree__twisty" aria-hidden="true"></span><span class="sl-tree__label">resolve.ts</span></li>
  <li class="sl-tree__row" role="treeitem" aria-level="2" aria-setsize="2" aria-posinset="2" aria-selected="false" tabindex="-1">
    <span class="sl-tree__twisty" aria-hidden="true"></span><span class="sl-tree__label">cache.ts</span></li>
</ul>
```
Consumes: `--slc-text-secondary`, `--slc-text`, `--slc-text-muted`, `--slc-accent-text`, `--slc-tile`, `--slc-depth-tile`, `--slc-depth-flat`, `--slc-border-subtle`, `--slc-seam`, `--slc-focus`. The rows are a flat list of treeitems, so each says its own place in the hierarchy: `aria-level`, `aria-setsize` and `aria-posinset`, or a screen reader counts every row as a sibling. The indent reads `aria-level` up to 8, and a deeper row holds at 8. A deeper tree that wants its full indent writes the level again as `--sl-tree-level` (inline), because CSS cannot read a number out of an attribute; the kit's levels weigh nothing, so your value always wins. There is one tab stop, a roving `tabindex`: the arrow keys move it, and Right and Left open and close. The consumer wires those keys. An icon goes in as a direct `<svg>` child of the row. Its colour on a selected row (`> svg`, (0,4,1) while the tree is focused) outranks a single-class colour of yours on the icon. Do: keep a leaf's empty twisty, so its name lines up with its siblings'. Don't: draw selection with the accent fill. The accent is the focused selection's seam and icon only.

### Palette — `sl-palette` (`__head` · `__input` · `__list` · `__group` · `__row` · `__label` · `__meta` · `__keys` · `__foot`)
The command palette, as Lumen draws it (0.34). It floats on Lumen's cast (`--slc-depth-cast`), whose ring is its edge, so it keeps no border; 580px wide at r14; the raised rung at 94% under `blur(24px) saturate(1.3)` where the backdrop blurs, opaque where it does not, in high contrast and under forced colours (which also give it a `CanvasText` outline). A line of the accent runs just inside its top edge, from 16px in to 40% before the end, fading, glowing at 55% wherever `--slc-glow` is not 0, because it holds the focus; it is the palette's `::before`. The head is 54px over a hairline, 16px in. The input is the kit's field (`sl-field__input`) at 16px on a 34px line, with no fill and no well, in the one control edge. The rows are 38px, 11.2px between the icon and the label; the foot sits on the surface at 70% over a hairline. The active result is a raised tile with the kit's seam, always in the accent, because the palette always holds the focus. Shortcuts are keycaps, one cap per key. It **never animates**: it appears at once, and the active row moves without a transition, because a palette is driven at typing speed. Substrate: **R** IDE, **A** App, **N/A** Page.
```html
<div class="sl-palette" role="dialog" aria-label="Command palette">
  <div class="sl-palette__head">
    <input class="sl-field__input sl-palette__input" role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls="pal-list" aria-activedescendant="pal-1" aria-label="Command" value="run probe">
  </div>
  <div class="sl-palette__list" id="pal-list" role="listbox" aria-label="Results" tabindex="-1">
    <div role="group" aria-labelledby="pal-g1">
      <div class="sl-palette__group" id="pal-g1" role="presentation">Commands</div>
      <div class="sl-palette__row" id="pal-1" role="option" aria-selected="true">
        <span class="sl-palette__label"><mark>Run</mark> <mark>probe</mark> q-8f2a</span>
        <span class="sl-palette__meta">resolve.ts</span>
        <span class="sl-palette__keys"><kbd class="sl-kbd">⌘</kbd><kbd class="sl-kbd">⏎</kbd></span>
      </div>
    </div>
  </div>
  <div class="sl-palette__foot"><span><kbd class="sl-kbd">esc</kbd> close</span></div>
</div>
```
Consumes: `--slc-raised`, `--slc-depth-cast`, `--slc-depth-tile`, `--slc-tile`, `--slc-seam`, `--slc-glow`, `--slc-text`, `--slc-text-muted`, `--slc-text-secondary`, `--slc-accent-text`, `--slc-border-subtle`, `--slc-surface`, `--slc-edge-control`, `--slc-focus`. Every text in it holds 4.5:1 with the page's own ink under the 6% that shows through. A match is a `<mark>` anywhere in the palette, in the primary ink, heavier and underlined in the accent, never the accent alone. The group label is a micro label. Do: keep the focus in the input. It is a combobox (`aria-autocomplete="list"`) pointing at the active option with `aria-activedescendant`, and the options are not focusable. Give the list `tabindex="-1"`: since Chromium 130 a scroller with no focusable children is a tab stop of its own. The input shows the field's ring and halo while it has the focus, as every field does; it takes no transition, at a weight (two classes) that holds whatever order the sheets load in. Do: mount the palette in the top layer or under `<body>`, never inside an `sl-invert` band. Don't: animate it, or the movement of its active row. Don't: put glass, press or glitch on it (0.34): its seam is its `::before`.

### Terminal block — `sl-term-block` (`[data-exit]` · `__head` · `__cmd` · `__prompt` · `__meta` · `__exit` · `__out`)
One command and its output, as a small island in a pane: the raised rung with the island recipe. In a lit pane, which is the raised rung too, it steps down to the sunken rung, so its fill still bounds it. It is set in the product's coding mono where the product sets one (`--sl-font-code`, because a terminal is product content, L1), and in the kit's mono otherwise. The exit status is a short mark on the top edge plus the exit text in the same ink: `data-exit="0"` is success, `data-exit="cancelled"` is neutral (a stop you asked for: 130, 143), and any other code is the danger. `data-exit=""` (an exit not known) and a block with no `data-exit` (still running) have no mark. The exit text is what states the status; the mark only helps find it. Substrate: **R** IDE, **A** App, **A** Page (a real-content block, L3).
```html
<article class="sl-term-block" data-exit="1">
  <header class="sl-term-block__head">
    <span class="sl-term-block__cmd"><span class="sl-term-block__prompt">$</span> pnpm sl-audit</span>
    <span class="sl-term-block__meta"><time>14:02:19</time><span>0.8 s</span><span class="sl-term-block__exit">exit 1</span></span>
  </header>
  <pre class="sl-term-block__out">R  components.css:412  raw colour literal outside the role vars</pre>
</article>
```
Consumes: `--slc-raised`, `--slc-sunken`, `--slc-depth-island`, `--slc-text`, `--slc-text-secondary`, `--slc-text-muted`, `--slc-accent-text`, `--slc-success`, `--slc-danger`. It may sit straight on an inversion band (a real-content block on the ink surface). There its wash goes and the island's ring still draws it. Under forced colours it gets a `CanvasText` outline inside its box, and its exit mark is drawn in `CanvasText`. Do: write the exit code in the words ("exit 1"), not only in the attribute, and mark a block that is running with `aria-busy="true"`. Do: write `cancelled` for a stop you asked for, and keep the code in the words ("exit 130"). Don't: put glass, press or glitch on it. Its mark is its `::before`, which those three need; `::after` is left free for the aurora.

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
Consumes: `--slc-text`, `--slc-accent`. Source of truth: `packages/ui-kit/assets/sondalab-lockup.svg` — Geist Mono weight 300, tracked `0.2em`, in the asset and the class alike since 0.30. A mark, not a label: its `0.2em` tracking stands outside the micro register. Do: use this one in a `sl-header`. Don't: mix the two marks on one surface.

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
`--wide` widens the CSS fallback ring to 2px for containers (card, dialog, panel); it does not change the chrome, which is always the element's own border width. `--field` marks a field's wrapper: its ring sits on the input's own border, 1px. Glass controls (buttons, icon buttons, `--field` inputs) share one edge: a sharp 1px line on the border and a softer 1px line just inside it. **Glass owns the control's depth** (0.32): the primary's foot, the secondary's lit line and cast and a `--field` input's well stand down for that edge, and under keyboard focus the edge carries the kit's focus halo; high contrast and an opt-out region keep the shipped control. **On a replaced control the `sl-field__control` wrapper is mandatory:** `<input>`, `<textarea>` and `<select>` render no `::before`/`::after`, so the class on the control itself renders nothing at all — no error, no ring.
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
- **Depth is lightness, and selection is a tile** (0.31, Lumen). A selected row, the current page or nav item, the chosen segment, an active tile tab and a selected table row are lifted as tiles from the depth recipes (`--slc-tile` + `--slc-depth-tile` / `--slc-depth-flat`); hover stays a flat wash; every selected or current tile carries the seam (0.33: the accent while its container holds the focus, the muted ink while it does not; the focus is read off the kit's container class — `sl-nav`, `sl-list`, `sl-tree`, `sl-tabs__list`, `sl-segmented`, `sl-pagination`, `sl-activitybar` — and a row outside one opts in with `--sl-seam-focus: 1` on itself or an ancestor, for example under your own container's `:focus-within`; ≥ 5.24:1 against the tile and its ground on the page, ≥ 3.4 in the band), because the tile alone reads 1.00–1.42:1 against its ground; the accent otherwise marks only an icon. A host that wears a depth recipe carries no border of its own, so the lit line sits flush under the ring (no gap between lines). The workbench (`workbench.css`, 0.33) ships the tree row and the palette row on them; reuse the recipes for any chrome of your own instead of re-deriving them: `--slc-depth-tile`, `-flat`, `-island`, `-key`, `-sunk`, `-float`. High contrast rings them, forced colours turn them off.
- **One accent hue.** The accent varies per product (see `accent-registry.json`); status colours (success/warning/danger/info) are shared and independent of it.
- **Spend surprise on composition, not materials.** Family resemblance comes from these shared components; distinctiveness comes from how you compose them (≥1 unexpected layout decision per screen).
