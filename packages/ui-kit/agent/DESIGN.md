# Sondalab DESIGN.md

> **What this file is:** the Sondalab design system in one file for design agents: each token with its rule and the reason for it, so a new surface is on-system from its first line.
> **Generated** by `scripts/gen-design-md.mjs` from `sondalab.tokens.json`, `neutrals.json`, `agent/accent-registry.json`, `agent/catalog.json`, `agent/catalog.md`, the kit's `README.md`, `design-language.md` and `agent/flavour.md`. Do not edit it by hand; run `npm run gen:design-md`.
> **Authority:** `design-language.md` holds the full rules; L1 to L6 and Decision 2 name its sections.

## 1. Use the kit

Build every surface on `@sondalab/ui-kit`, the CSS kit that ships these tokens and components. Import its stylesheets in this order, as the kit's `README.md` does:

1. `@sondalab/ui-kit/tokens.css`
2. `@sondalab/ui-kit/components.css`
3. `@sondalab/ui-kit/workbench.css` (optional)
4. `@sondalab/ui-kit/themes/light.css`
5. `@sondalab/ui-kit/themes/dark.css`
6. `@sondalab/ui-kit/themes/high-contrast.css`
7. `@sondalab/ui-kit/themes/products.css` (optional)
8. `@sondalab/ui-kit/fonts.css` (optional)

- **Theme on the root.** Set `data-sl-theme` on the root element (`light`, `dark` or `high-contrast`). A product other than the default also loads `themes/products.css` and sets `data-sl-product="<id>"` on the same root, its id from the accent registry. Why: every role resolves under these two attributes, and without `data-sl-product` the page gets the default product's neutrals.
- **A product sets its accent on the root.** `themes/products.css` gives a product its neutrals and, where the registry names one, its labelled fill; it does not set the accent. The product sets `--sl-accent-default` on the root to its registry accent, one value per theme (under `[data-sl-theme="light"]` and `[data-sl-theme="dark"]`), and the kit derives hover, subtle, the text reading and the label on the fill from it. Why: every accent step is derived from that one property, so setting it alone re-colours the whole family.
- **Never rebuild a shipped component; use its class.** Every part in the table below ships in the kit's stylesheets: write its markup as in the examples under Markup, with its `.sl-*` classes on the same elements, and put an `.sl-fx-*` effect class on top of it, never in its place. Why: a hand-built copy drifts from the tokens, the states and the themes the class already carries.

### Components

| Component | Kind | Classes | Purpose |
| --- | --- | --- | --- |
| `eyebrow` | primitive | `.sl-eyebrow` | The mono uppercase micro label above a heading. |
| `tag` | primitive | `.sl-tag`, `.sl-tag--plain` | An inline mono mark for a status or a classification, in sentence case. |
| `chip` | primitive | `.sl-chip`, `.sl-chips`, `.sl-chip__count` | A mono filter or reference control that toggles on, with an optional count. |
| `button` | primitive | `.sl-btn`, `.sl-btn--primary`, `.sl-btn--ghost`, `.sl-btn--sm`, `.sl-btn--danger` | The text button: primary, secondary (ghost), small, and the danger tone. |
| `link` | primitive | `.sl-link` | An inline link in the accent. |
| `badge` | primitive | `.sl-badge`, `.sl-badge--success`, `.sl-badge--warning`, `.sl-badge--danger`, `.sl-badge--info`, `.sl-badge--live` | A small status mark in a line of text; `--live` breathes while its state lasts. |
| `card` | primitive | `.sl-card`, `.sl-card__title`, `.sl-card__body`, `.sl-card--bezel`, `.sl-card__stage`, `.sl-card__caption` | A bounded surface with a title and a body. |
| `field` | primitive | `.sl-field`, `.sl-field__label`, `.sl-field__input`, `.sl-field__control`, `.sl-field__hint`, `.sl-field__error` | A labelled input with its hint and its error line. |
| `callout` | primitive | `.sl-callout`, `.sl-callout--success`, `.sl-callout--warning`, `.sl-callout--danger`, `.sl-callout--info`, `.sl-callout__title`, `.sl-callout__body` | A block note in a status tone, with a title and a body. |
| `rule` | primitive | `.sl-rule`, `.sl-rule--labeled` | A 1px structural divider, optionally labelled. |
| `table` | primitive | `.sl-table`, `.sl-table--numeric` | A data table; `--numeric` aligns figures. |
| `tabs` | primitive | `.sl-tabs`, `.sl-tabs__list`, `.sl-tabs__tab`, `.sl-tabs--tile`, `.sl-tabs__item`, `.sl-tabs__dot`, `.sl-tabs__close` | Tabs over panels, and the IDE's tile tab strip with an unsaved dot and a close glyph. |
| `tooltip` | primitive | `.sl-tooltip` | A short label that floats beside its trigger. |
| `kbd` | primitive | `.sl-kbd`, `.sl-code` | A keycap for a shortcut, and inline code. |
| `dialog` | primitive | `.sl-dialog`, `.sl-dialog__title`, `.sl-dialog__body`, `.sl-dialog__actions` | A modal overlay on the float recipe, with a title, a body and actions. |
| `toast` | primitive | `.sl-toast-stack`, `.sl-toast-stack__live`, `.sl-toast`, `.sl-toast--info`, `.sl-toast--success`, `.sl-toast--warning`, `.sl-toast--danger`, `.sl-toast__mark`, `.sl-toast__content`, `.sl-toast__title`, `.sl-toast__body`, `.sl-toast__dismiss`, `.sl-toast__timer` | A transient message in a stack at the bottom right, with a tone and an optional timer. |
| `fx-glass` | effect | `.sl-fx-glass`, `.sl-fx-glass--wide`, `.sl-fx-glass--field`, `.sl-fx-glass--pane`, `.sl-fx-glass--text` | Effect: glass chrome on the element's own border, for a physical surface. |
| `fx-aurora` | effect | `.sl-fx-aurora`, `.sl-fx-aurora--wide`, `.sl-fx-aurora--field`, `.sl-fx-aurora--linear`, `.sl-fx-aurora--rim`, `.sl-fx-aurora--top` | Effect: a 1px arc of light on an existing edge, where attention lives. |
| `fx-goo` | effect | `.sl-fx-goo`, `.sl-fx-goo__member` | Effect: welds the members of a set into one substance. |
| `fx-press` | effect | `.sl-fx-press` | Effect: the light of a press on a control. |
| `fx-glitch` | effect | `.sl-fx-glitch`, `.sl-fx-glitch--shatter`, `.sl-fx-glitch__text`, `.sl-fx-glitch__shards`, `.sl-fx-glitch__shard` | Effect: a burst when something re-resolves (a value change, a confirmed destructive action, a failed validation). |
| `fx-halftone` | effect | — | Effect: a halftone ornament, opted into by its data attributes rather than a class. |
| `sticky-header` | signature | `.sl-header` | The sticky translucent page header: the lockup on the left, meta and controls on the right, a 1px bottom rule. |
| `inversion-band` | signature | `.sl-invert` | A full-width band flipped to the strongest neutral, for the thesis or the primary call to action. |
| `hairline-grid` | signature | `.sl-hgrid` | A card grid ruled by a 1px gap over the line colour. |
| `section-index` | signature | `.sl-section`, `.sl-section__head`, `.sl-section__idx` | A section with its mono index label, its heading and a 1px top rule. |
| `oversized-anchor` | signature | `.sl-anchor` | The one oversized display heading of a screen, set solid. |
| `haze` | signature | `.sl-haze` | A soft glow of the light theme's spectrum behind a block, as an opt-in ornament. |
| `spectral-text` | signature | `.sl-spectral` | Text in the light theme's spectrum ink, as an opt-in ornament. |
| `checkbox` | primitive | `.sl-check`, `.sl-check__input`, `.sl-check__box`, `.sl-check__label` | The pixel check box with its label. |
| `radio` | primitive | `.sl-radio`, `.sl-radio__input`, `.sl-radio__box`, `.sl-radio__label` | The pixel radio with its label. |
| `switch` | primitive | `.sl-switch`, `.sl-switch__input`, `.sl-switch__track`, `.sl-switch__label` | The pixel switch with its label. |
| `select` | primitive | `.sl-select` | A native select, sunken like a field. |
| `wrap` | signature | `.sl-wrap` | The max-width content wrap with the fluid gutter. |
| `prose` | signature | `.sl-prose` | Running text capped at the body measure. |
| `breadcrumb` | primitive | `.sl-breadcrumb`, `.sl-breadcrumb__item`, `.sl-breadcrumb__sep` | A path of links to the current page. |
| `button-group` | primitive | `.sl-btn-group` | Buttons joined into one outlined group with 1px rules between them. |
| `segmented` | primitive | `.sl-segmented`, `.sl-segmented__item` | A segmented control: a sunk track whose chosen segment is a raised tile. |
| `progress` | primitive | `.sl-progress`, `.sl-progress__bar`, `.sl-progress--success`, `.sl-progress--danger` | A determinate progress bar, in the accent or a status tone. |
| `slider` | primitive | `.sl-slider` | A range input on the kit's track and thumb. |
| `icon-button` | primitive | `.sl-icon-btn`, `.sl-icon-btn--round`, `.sl-icon-btn--danger` | A square or round button holding a glyph, with the danger tone. |
| `pagination` | primitive | `.sl-pagination`, `.sl-pagination__item` | Page links; the current page is a tile with the seam. |
| `empty-state` | primitive | `.sl-empty`, `.sl-empty__title`, `.sl-empty__body` | The message of an empty panel: a title and a body. |
| `skeleton` | primitive | `.sl-skeleton` | A placeholder block while content loads. |
| `stat` | primitive | `.sl-stat`, `.sl-stat__value`, `.sl-stat__label` | A figure with its micro label; the value is set in the pixel face. |
| `nav` | primitive | `.sl-nav`, `.sl-nav__group`, `.sl-nav__item`, `.sl-nav__count` | A sidebar navigation of grouped items with counts; the current item is a tile with the seam. |
| `list` | primitive | `.sl-list`, `.sl-list__row`, `.sl-list__meta`, `.sl-list--dense` | Rows of items with meta; the selected row is a tile with the seam, and `--dense` tightens the rows. |
| `disclosure` | primitive | `.sl-disclosure` | A details and summary block that opens and closes. |
| `kv` | primitive | `.sl-kv` | A key-value list of facts. |
| `resizer` | primitive | `.sl-resizer`, `.sl-resizer--horizontal` | A drag handle between two panes, vertical or horizontal. |
| `titlebar` | workbench | `.sl-titlebar`, `.sl-titlebar__l`, `.sl-titlebar__menu`, `.sl-titlebar__mark`, `.sl-titlebar__dot`, `.sl-titlebar__crumb`, `.sl-titlebar__sep`, `.sl-titlebar__cmd`, `.sl-titlebar__cmd-text`, `.sl-titlebar__keys`, `.sl-titlebar__r`, `.sl-titlebar__btn`, `.sl-titlebar__btn--dot` | Workbench: the top frame with the product's mark, a crumb, the command field and icon buttons. |
| `pane` | workbench | `.sl-pane` | Workbench: an island pane on the frame; the pane that holds the focus is lit. |
| `statusbar` | workbench | `.sl-statusbar`, `.sl-statusbar--separators`, `.sl-statusbar__item`, `.sl-statusbar__value`, `.sl-statusbar__sep`, `.sl-statusbar__dot`, `.sl-statusbar__spacer` | Workbench: the meta line of facts at the foot of the window. |
| `activitybar` | workbench | `.sl-activitybar`, `.sl-activitybar__item`, `.sl-activitybar__badge` | Workbench: the column of view glyphs with count badges; the current view is a flat tile with the seam. |
| `tree` | workbench | `.sl-tree`, `.sl-tree--guides`, `.sl-tree__row`, `.sl-tree__twisty`, `.sl-tree__label` | Workbench: an indented tree of rows with twisties and optional guides. |
| `palette` | workbench | `.sl-palette`, `.sl-palette__head`, `.sl-palette__input`, `.sl-palette__list`, `.sl-palette__group`, `.sl-palette__row`, `.sl-palette__label`, `.sl-palette__meta`, `.sl-palette__keys`, `.sl-palette__foot` | Workbench: the command palette overlay with its field, grouped results and keycaps. |
| `term-block` | workbench | `.sl-term-block`, `.sl-term-block__head`, `.sl-term-block__cmd`, `.sl-term-block__prompt`, `.sl-term-block__meta`, `.sl-term-block__exit`, `.sl-term-block__out` | Workbench: one command and its output as a small island, with its exit status. |
| `term-output` | workbench | `.sl-term-block__ok`, `.sl-term-block__warn`, `.sl-term-block__err`, `.sl-term-block__dim`, `.sl-term-block__accent`, `.sl-term-block__inverse`, `.sl-term-block__sel`, `.sl-term-block__spin`, `.sl-term-block--screen` | Workbench: the terminal role spans inside a terminal block's output, and its full-screen mode. |
| `wordmark` | signature | `.sl-wordmark`, `.sl-wordmark__dot` | The `sondalab.` wordmark in the brand face, its period in the accent. |
| `lockup` | signature | `.sl-lockup`, `.sl-lockup__sep`, `.sl-lockup__dot` | The compact `sonda/lab` lockup in the pixel face. |
| `pixel-word` | signature | `.sl-px` | One emphasised word in a heading, set in the pixel face. |
| `monogram` | signature | `.sl-monogram` | The `s.` monogram on a square avatar tile. |
| `figure` | primitive | `.sl-figure`, `.sl-figure__media`, `.sl-figure__caption` | An image or media block with a caption. |
| `avatar` | primitive | `.sl-avatar`, `.sl-avatar--sm`, `.sl-avatar--lg` | The picture of a person or an agent, in three sizes. |
| `compositions` | effect | — | Page compositions shipped in `compositions.css`, with no class listed in the catalog. |
| `signal` | primitive | `.sl-signal`, `.sl-signal--muted` | A decorative dithered signal strip, drawn by `mountSignals()`. |
| `art` | signature | `.sl-eyebrow--mark`, `.sl-eyebrow--mark-square`, `.sl-eyebrow--mark-tri`, `.sl-eyebrow--mark-circle`, `.sl-eyebrow--mark-half`, `.sl-eyebrow--mark-stair`, `.sl-rule--shapes`, `.sl-rule--weave`, `.sl-art-corner`, `.sl-art-field`, `.sl-art-field--grid`, `.sl-art-field--albers`, `.sl-art-field--stripes`, `.sl-art-field--fade-start`, `.sl-art-field--fade-end`, `.sl-art-field--fade-down`, `.sl-empty--void`, `.sl-empty--shapes`, `.sl-art-poster`, `.sl-art-poster--overprint`, `.sl-art-poster--hills`, `.sl-art-poster--orbit`, `.sl-art-horizon`, `.sl-art-horizon--dawn` | Opt-in static art on the pixel cell: eyebrow marks, rule strips, a card corner, fields, empty-state pieces, posters and horizons. |

### Markup

One example per component, the first in `agent/catalog.md`; that file holds the variants and states. Copy the element structure and the classes, and replace the text.

#### `eyebrow`

```html
<p class="sl-eyebrow">System status</p>
```

#### `tag`

```html
<span class="sl-tag">Delivered</span>
<span class="sl-tag sl-tag--plain">Draft</span>
```

#### `chip`

```html
<div class="sl-chips" role="group" aria-label="Event kinds">
  <button class="sl-chip" aria-pressed="true">Tool <span class="sl-chip__count">42</span></button>
  <button class="sl-chip" aria-pressed="false">Spawn <span class="sl-chip__count">3</span></button>
  <button class="sl-chip" aria-pressed="true">Result</button>
</div>
```

#### `button`

```html
<button class="sl-btn sl-btn--primary">Save changes</button>
<button class="sl-btn sl-btn--ghost">Cancel</button>
<button class="sl-btn">Skip</button>
<button class="sl-btn sl-btn--primary sl-btn--sm">Add</button>
```

#### `link`

```html
<a class="sl-link" href="/specs">read the spec</a>
```

#### `badge`

```html
<span class="sl-badge sl-badge--success">Passing</span>
<span class="sl-badge sl-badge--danger">Failed</span>
```

#### `card`

```html
<article class="sl-card">
  <h3 class="sl-card__title">Migration report</h3>
  <div class="sl-card__body">2 R-violations resolved, 1 blessed.</div>
</article>
```

#### `field`

```html
<label class="sl-field">
  <span class="sl-field__label">Product</span>
  <input class="sl-field__input" type="text" placeholder="introspect">
</label>
```

#### `callout`

```html
<div class="sl-callout sl-callout--info">
  <p class="sl-callout__title">Tier B</p>
  <div class="sl-callout__body">Every colour must resolve to a Sondalab value.</div>
</div>
```

#### `rule`

```html
<hr class="sl-rule">
<div class="sl-rule sl-rule--labeled">Earlier runs</div>
```

#### `table`

```html
<div style="overflow-x:auto">
  <table class="sl-table sl-table--numeric">
    <thead><tr><th>Product</th><th>R-violations</th></tr></thead>
    <tbody><tr><td>daos</td><td>2</td></tr></tbody>
  </table>
</div>
```

#### `tabs`

```html
<div class="sl-tabs">
  <div class="sl-tabs__list" role="tablist">
    <button class="sl-tabs__tab" aria-selected="true">Tokens</button>
    <button class="sl-tabs__tab">Components</button>
  </div>
</div>
```

#### `tooltip`

```html
<span class="sl-tooltip" data-sl-tooltip="Measured on the canvas ground" tabindex="0">4.89:1</span>
<button class="sl-icon-btn sl-tooltip" data-sl-tooltip="Re-run the audit" aria-label="Re-run the audit">↻</button>
```

#### `kbd`

```html
Press <kbd class="sl-kbd">⌘</kbd><kbd class="sl-kbd">K</kbd>, then run <code class="sl-code">sl-audit</code>.
```

#### `dialog`

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

#### `toast`

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

#### `fx-glass`

```html
<article class="sl-card sl-fx-glass sl-fx-glass--wide">…</article>
<label class="sl-field">
  <span class="sl-field__label">Product</span>
  <span class="sl-field__control sl-fx-glass sl-fx-glass--field">
    <input class="sl-field__input" type="text">
  </span>
</label>
```

#### `fx-aurora`

```html
<button class="sl-btn sl-btn--ghost sl-fx-aurora">Run audit</button>
<button class="sl-btn sl-btn--primary sl-fx-aurora sl-fx-aurora--rim" data-sl-fx-live="busy" aria-busy="true" disabled>Saving…</button>
<span class="sl-field__control sl-fx-aurora sl-fx-aurora--field"><input class="sl-field__input" type="text"></span>
<article class="sl-card sl-fx-aurora sl-fx-aurora--wide" data-sl-fx-live="busy" aria-busy="true">…</article>
<article class="sl-card sl-fx-aurora sl-fx-aurora--wide" data-sl-fx-live="busy"
         role="progressbar" aria-valuenow="62" aria-valuemin="0" aria-valuemax="100"
         style="--slfx-progress: .62">…</article>
```

#### `fx-goo`

```html
<div class="sl-fx-goo sl-fx-goo--drift" style="display:flex; gap:.75rem; padding:2.5rem; --slfx-goo-weld: 20px">
  <div class="sl-callout sl-callout--warning sl-fx-goo__member">daos</div>
  <div class="sl-callout sl-callout--info sl-fx-goo__member" style="margin-top:1.25rem">introspect</div>
</div>
```

#### `fx-press`

```html
<div style="display:flex; gap:0.6rem">
  <button class="sl-btn sl-btn--primary sl-fx-press">Run probe</button>
  <button class="sl-btn sl-btn--ghost sl-fx-press">Cancel</button>
</div>
```

#### `fx-glitch`

```html
<button class="sl-btn sl-btn--primary">
  <span class="sl-fx-glitch" data-text="Delete branch">Delete branch</span>
</button>
```

#### `sticky-header`

```html
<header class="sl-header">
  <div class="sl-wrap"> … </div>
</header>
```

#### `inversion-band`

```html
<section class="sl-invert">
  <div class="sl-wrap"> … </div>
</section>
```

#### `hairline-grid`

```html
<div class="sl-hgrid">
  <div>…</div>
  <div>…</div>
  <div>…</div>
</div>
```

#### `section-index`

```html
<section class="sl-section">
  <div class="sl-section__head">
    <span class="sl-section__idx">03</span>
    <h2>Signature components</h2>
  </div>
</section>
```

#### `oversized-anchor`

```html
<h1 class="sl-anchor">Everything measured, nothing asserted.</h1>
```

#### `haze`

```html
<section class="sl-haze"> … </section>
```

#### `spectral-text`

```html
<h1 class="sl-anchor">Everything measured, <span class="sl-spectral">nothing asserted.</span></h1>
```

#### `checkbox`

```html
<label class="sl-check">
  <input class="sl-check__input" type="checkbox">
  <span class="sl-check__box"></span>
  <span class="sl-check__label">Run the audit on save</span>
</label>
```

#### `radio`

```html
<label class="sl-radio">
  <input class="sl-radio__input" type="radio" name="tier">
  <span class="sl-radio__box"></span>
  <span class="sl-radio__label">Tier A — full theme selector</span>
</label>
```

#### `switch`

```html
<label class="sl-switch">
  <input class="sl-switch__input" type="checkbox" role="switch">
  <span class="sl-switch__track"></span>
  <span class="sl-switch__label">Tier 2 GPU effects</span>
</label>
```

#### `select`

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

#### `wrap`

```html
<div class="sl-wrap"> … </div>
```

#### `prose`

```html
<div class="sl-prose"> <p>…</p> </div>
```

#### `breadcrumb`

```html
<nav class="sl-breadcrumb" aria-label="Breadcrumb">
  <a class="sl-breadcrumb__item" href="/">Specs</a>
  <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
  <a class="sl-breadcrumb__item" href="/specs/ds">Design system</a>
  <span class="sl-breadcrumb__sep" aria-hidden="true">/</span>
  <span class="sl-breadcrumb__item" aria-current="page">Base element set</span>
</nav>
```

#### `button-group`

```html
<div class="sl-btn-group">
  <button class="sl-btn sl-btn--ghost">Audit</button>
  <button class="sl-btn sl-btn--ghost">Migrate</button>
  <button class="sl-btn sl-btn--ghost">Adopt</button>
</div>
```

#### `segmented`

```html
<div class="sl-segmented" role="tablist">
  <button class="sl-segmented__item" role="tab" aria-selected="true">Light</button>
  <button class="sl-segmented__item" role="tab" aria-selected="false">Dark</button>
  <button class="sl-segmented__item" role="tab" aria-selected="false">Contrast</button>
</div>
```

#### `progress`

```html
<div class="sl-progress" role="progressbar" aria-label="Spec steps" aria-valuemin="0" aria-valuemax="100" aria-valuenow="60" style="--sl-progress: 60%">
  <span class="sl-progress__bar"></span>
</div>
```

#### `slider`

```html
<input class="sl-slider" type="range" min="0" max="100" value="40" aria-label="Volume"
       style="--sl-slider-value: 40%"
       oninput="this.style.setProperty('--sl-slider-value',
               (this.value - this.min) / (this.max - this.min) * 100 + '%')">
```

#### `icon-button`

```html
<button class="sl-icon-btn" aria-label="Re-run the audit">
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3" fill="none" stroke="currentColor" stroke-width="1.3"/>
  </svg>
</button>
<button class="sl-icon-btn sl-icon-btn--round" aria-label="Add a product">
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.4"/>
  </svg>
</button>
```

#### `pagination`

```html
<nav class="sl-pagination" aria-label="Pagination">
  <a class="sl-pagination__item" href="?p=1">1</a>
  <a class="sl-pagination__item" href="?p=2" aria-current="page">2</a>
  <a class="sl-pagination__item" href="?p=3">3</a>
</nav>
```

#### `empty-state`

```html
<div class="sl-empty">
  <span class="sl-eyebrow">No findings</span>
  <p class="sl-empty__title">The audit found nothing to report.</p>
  <p class="sl-empty__body">4 surfaces read, 0 R-violations, 0 blessed deviations.</p>
</div>
```

#### `skeleton`

```html
<div class="sl-skeleton" style="height: 1rem; width: 60%"></div>
```

#### `stat`

```html
<div class="sl-stat">
  <span class="sl-stat__value">268</span>
  <span class="sl-stat__label">Tests green</span>
</div>
```

#### `nav`

```html
<nav class="sl-nav" aria-label="Sections">
  <div class="sl-nav__group">Observe</div>
  <a class="sl-nav__item" href="/live" aria-current="page">Live <span class="sl-nav__count">12</span></a>
  <a class="sl-nav__item" href="/sessions">Sessions <span class="sl-nav__count">340</span></a>
</nav>
```

#### `list`

```html
<div class="sl-list" role="listbox" aria-label="Sessions">
  <button class="sl-list__row" role="option" aria-selected="true">Refactor the audit<span class="sl-list__meta">2m ago · 14 tools</span></button>
  <button class="sl-list__row" role="option" aria-selected="false">Prism light theme<span class="sl-list__meta">1h ago · 212 tools</span></button>
</div>
```

#### `disclosure`

```html
<button class="sl-disclosure" aria-expanded="false" aria-controls="raw-1">Raw payload</button>
<pre id="raw-1" hidden>…</pre>
```

#### `kv`

```html
<dl class="sl-kv">
  <dt>Model</dt><dd>claude-opus-5-5</dd>
  <dt>Started</dt><dd>Today, 17:52</dd>
</dl>
```

#### `resizer`

```html
<div class="sl-resizer" role="separator" aria-orientation="vertical" aria-label="Resize the list" aria-valuenow="320" aria-valuemin="200" aria-valuemax="640" tabindex="0"></div>
```

#### `titlebar`

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

#### `pane`

```html
<div style="display: flex; gap: var(--sl-space-2); padding: var(--sl-space-2); background: var(--slc-canvas)">
  <aside class="sl-pane" aria-label="Explorer">…</aside>
  <main class="sl-pane" data-lit aria-label="Editor">…</main>
</div>
```

#### `statusbar`

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

#### `activitybar`

```html
<nav class="sl-activitybar" aria-label="Views">
  <button class="sl-activitybar__item" aria-label="Explorer" aria-current="true"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 1.75h5l3.25 3.25v9H4Z"/></svg></button>
  <button class="sl-activitybar__item" aria-label="Search"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="7" cy="7" r="4.25"/></svg></button>
  <button class="sl-activitybar__item" aria-label="Source control, 3 changes"><svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="4.5" cy="3.5" r="1.5"/></svg><span class="sl-activitybar__badge" aria-hidden="true">3</span></button>
</nav>
```

#### `tree`

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

#### `palette`

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

#### `term-block`

```html
<article class="sl-term-block" data-exit="1">
  <header class="sl-term-block__head">
    <span class="sl-term-block__cmd"><span class="sl-term-block__prompt">$</span> pnpm sl-audit</span>
    <span class="sl-term-block__meta"><time>14:02:19</time><span>0.8 s</span><span class="sl-term-block__exit">exit 1</span></span>
  </header>
  <pre class="sl-term-block__out">R  components.css:412  raw colour literal outside the role vars</pre>
</article>
```

#### `term-output`

```html
<article class="sl-term-block" aria-label="Terminal roles and glyphs">
  <pre class="sl-term-block__out"><span class="sl-term-block__prompt">prompt</span>  <span class="sl-term-block__ok">ok</span>  <span class="sl-term-block__warn">warn</span>  <span class="sl-term-block__err">err</span>  <span class="sl-term-block__dim">dim</span>  <span class="sl-term-block__accent">accent</span>

  <span class="sl-term-block__ok">✓</span> done       +  ok
  <span class="sl-term-block__ok">✓</span> fixed      +  ok
  <span class="sl-term-block__err">✗</span> failed     x  err
  <span class="sl-term-block__warn">!</span> warn       !  warn
  <span class="sl-term-block__prompt">●</span> active     *  prompt
  <span class="sl-term-block__dim">○</span> pending    .  dim
  <span class="sl-term-block__dim">↷</span> skipped    -  dim
  <span class="sl-term-block__prompt">?</span> question   ?  prompt
  <span class="sl-term-block__dim">·</span> separator  |  dim</pre>
</article>
```

#### `wordmark`

```html
<span class="sl-wordmark">sondalab<span class="sl-wordmark__dot">.</span></span>
```

#### `lockup`

```html
<span class="sl-lockup">sonda<span class="sl-lockup__sep">/</span>lab</span>
```

#### `pixel-word`

```html
<h2>Measured, not <span class="sl-px">guessed</span></h2>
```

#### `monogram`

```html
<span class="sl-monogram" role="img" aria-label="Sondalab">s</span>
```

#### `figure`

```html
<figure class="sl-figure">
  <div class="sl-figure__media" style="aspect-ratio: 16 / 9">
    <img src="/contact-1k.jpg" alt="Glass pane, GPU tier, dark theme">
  </div>
  <figcaption class="sl-figure__caption">Contact 1k — the GPU glass pane</figcaption>
</figure>
```

#### `avatar`

```html
<span class="sl-avatar"><img src="/avatar.png" alt=""></span>
<span class="sl-avatar sl-avatar--sm"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
<span class="sl-avatar sl-avatar--lg"><span class="sl-monogram" role="img" aria-label="Sondalab">s</span></span>
```

#### `signal`

```html
<canvas class="sl-signal" data-sl-signal data-sl-signal-level="0.6" aria-hidden="true"></canvas>
```

#### `art`

```html
<div class="sl-eyebrow sl-eyebrow--mark">§ 02 — Signals</div>
<div class="sl-eyebrow sl-eyebrow--mark sl-eyebrow--mark-circle">§ 03 — Traces</div>
<hr class="sl-rule sl-rule--shapes">
<hr class="sl-rule sl-rule--weave">
<article class="sl-card sl-art-corner"> … </article>
<section class="sl-art-field"> … </section>
<section class="sl-art-field sl-art-field--albers sl-art-field--fade-end"> … </section>
<div class="sl-empty sl-empty--shapes">
  <p class="sl-empty__title">Nothing here yet</p>
  <p class="sl-empty__body">Start a run and its traces land in this panel.</p>
</div>
<header>
  <div> <h1>…</h1> <p>…</p> </div>
  <div class="sl-art-poster sl-art-poster--hills" data-sl-art-seed="7" aria-hidden="true"></div>
</header>
<section class="sl-art-horizon" style="padding-bottom: 12.5rem"> <h2>…</h2> <p>…</p> </section>
```

## 2. Brand and voice

Sondalab is a family of developer tools that read as one suite. The look is editorial modernism for an IDE: hairline structure, mono micro labels, oversized display type, inversion bands and real content over marketing copy. Products share the whole grammar and differ only in their accent hue.

The grammar fixes the materials (type roles, spacing scale, rule weight, motifs, motion, voice); surprise is spent on composition, with at least one intentional layout decision per screen. Why: family resemblance comes from the shared materials, distinctiveness from each screen's composition.

Voice:

- **Precise and technical, never marketing.** Name things by what they are and do; prefer a real measured figure or executed output to an adjective. Why: these are tools, and real output is the proof.
- **Active voice; controls state their effect.** A button says what happens; its confirmation says it happened. Why: the label is the contract for the action.
- **Controls speak in sentence case.** Write "Run checks" in the markup; nothing upper-cases a label for you. Why: uppercase belongs to micro labels, which name structure.
- **Structure encodes truth.** Numbered markers, eyebrows and dividers appear only where they reflect a real sequence or classification. Why: decoration dressed as structure misleads the reader.
- **Real content.** Where a surface shows output (JSON, a terminal, code, data rows), show actual content in mono, not illustrative filler. Why: it is both the voice and the look.
- **English** for product copy and all identifiers. Why: it matches the suite.

## 3. Colour

Roles are `--sl-*` custom properties set per theme by `data-sl-theme` on the root (light, dark or high-contrast). The light and dark neutrals below are the default product's, from `neutrals.json`; every other product's are generated from the same ladder tinted with its accent hue (`themes/products.css` under `data-sl-product`, or `neutrals.json` for a hex-only consumer). High contrast keeps its literal values. Why: one temperature per product, and a neutral copied by hand drifts.

### Colour roles

| Role | Light | Dark | High contrast | Purpose |
| --- | --- | --- | --- | --- |
| `--sl-bg-canvas` | `#eae6e2` | `#0a0806` | `#000000` | The page ground: the farthest rung, so everything nearer is lighter. |
| `--sl-bg-surface` | `#fcfaf9` | `#13110e` | `#000000` | Panes, cards and chrome on the canvas. |
| `--sl-bg-surface-raised` | `#ffffff` | `#1c1915` | `#0a0a0a` | A raised key, an overlay, a lit pane. |
| `--sl-bg-tile` | `#ffffff` | `#26221e` | `#0a0a0a` | A raised selection (the tile recipe). |
| `--sl-bg-sunken` | `#f9f6f4` | `#0e0c09` | `#000000` | A field's fill and a control's track (the sunk recipe). |
| `--sl-bg-overlay` | `rgba(25,21,17,0.4)` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.85)` | The scrim behind a modal overlay. |
| `--sl-text-primary` | `#191511` | `#eeeae7` | `#ffffff` | Body text and headings; the borders are this ink at an alpha. |
| `--sl-text-secondary` | `#47413c` | `#bebab5` | `#ffffff` | Supporting text and an icon button's glyph. |
| `--sl-text-muted` | `#605953` | `#9f9a95` | `#cccccc` | Meta, micro labels and captions. |
| `--sl-text-on-accent` | `oklch(0.16 0 0)` | `#0A0A0B` | `#000000` | The label on an accent fill. |
| `--sl-border-subtle` | `rgba(25,21,17,0.08)` | `rgba(238,234,231,0.065)` | `#ffffff` | The quietest hairline. |
| `--sl-border-default` | `rgba(25,21,17,0.14)` | `rgba(238,234,231,0.11)` | `#ffffff` | The structural 1px hairline. |
| `--sl-border-strong` | `rgba(25,21,17,0.28)` | `rgba(238,234,231,0.28)` | `#ffff00` | A strong edge where a hairline would not read. |
| `--sl-border-lit` | `rgba(255,255,255,0.9)` | `rgba(255,255,255,0.07)` | `#ffffff` | The lit top line of a tile, key or island. |
| `--sl-accent-default` | `#FF9F1C` | `#F5A83C` | `#ffff00` | The product accent: primary fill, focus ring, links, tags, the seam. |
| `--sl-status-success` | `#4a6205` | `#98b958` | `#00ff00` | Success, on the canvas; never a second accent. |
| `--sl-status-warning` | `#795305` | `#db9e2e` | `#ffaa00` | Warning, on the canvas; never a second accent. |
| `--sl-status-danger` | `#a72b05` | `#fe8263` | `#ff5555` | Danger and errors, on the canvas; never a second accent. |
| `--sl-status-info` | `#3853af` | `#87a7fd` | `#00ffff` | Information, on the canvas; never a second accent. |

- **Depth is lightness.** What is nearer the viewer is lighter: canvas, then surface, then raised, then tile. Why: depth reads without lines or drop shadows.
- **One accent per product.** A product picks one accent hue and derives hover, active and subtle from it; it never adds a second chromatic accent. Why: the accent is the product's identity and the carrier of selection and focus.
- **Fill and text are one accent, two readings.** `--slc-accent` is what a control fills with; `--slc-accent-text` is the same hue capped in lightness for text and thin lines, and `--sl-text-on-accent` is the label on the fill. On light that label follows the fill: white where the fill's oklch lightness is below 0.59, `oklch(0.16 0 0)` above it; the table gives it for the default accent. Why: an accent bright enough to fill can be too light to read as text.
- **Status is not the accent.** `--sl-status-*` are shared across products and tuned for the canvas; on an inverted surface derive an on-ink pair locally. Why: the canvas inks lose contrast on ink.
- **No free colour value.** Every colour resolves to a token, a registry accent or the product's generated neutral, and neutrals are never hand-tuned. Why: value equality is the invariant `sl-audit` checks.
- **Viz, code and spectrum palettes are not accents** (`--sl-viz-*`, `--sl-code-*`, `--sl-spectrum-*`). They never track the product hue and never carry state. Why: a series colour must not read as selection or focus.

### Accent registry

One accent per product, from `agent/accent-registry.json`; the default's comes from `sondalab.tokens.json`. A product other than the default loads `themes/products.css` and sets `data-sl-product="<id>"` beside `data-sl-theme`, so its neutrals take its hue, and sets `--sl-accent-default` on the root to the accent below for each theme. Changing an accent re-tints the product's neutrals, so it is a token change.

| Product (`data-sl-product`) | Accent, light theme | Accent, dark theme | Depth companion, labelled fill or inheritance |
| --- | --- | --- | --- |
| `default` | `#FF9F1C` | `#F5A83C` | depth `#14606C` / `#35A0B4` |
| `daos` | `#FF9F1C` | `#F5A83C` | inherits `default` |
| `spexr` | `#5b6cff` | `#8b96ff` | labelled fill `#4c58e9` / `#4c58e9` |
| `introspect` | `#0e9c84` | `#2ee6c0` | — |
| `roboemot` | `#f726b4` | `#ff48c4` | — |
| `local-agents` | `#1d63d8` | `#58a6ff` | — |

`spexr`'s labelled fill is `#4c58e9` on both themes: its filled controls (the primary, a checked check, radio or switch, a count badge) take it instead of the accent so their white label reads, and links, tags and the focus ring stay on the accent.

## 4. Typography

Five font roles with a fixed pairing. The kit ships the faces in `fonts.css`.

| Role | Stack | Use |
| --- | --- | --- |
| `--sl-font-display` | `"Geist", system-ui, -apple-system, "Segoe UI", sans-serif` | Headings and the oversized anchor, semibold with negative tracking. |
| `--sl-font-sans` | `"Geist", system-ui, -apple-system, "Segoe UI", sans-serif` | Body, controls and the labels read with a control. |
| `--sl-font-mono` | `"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace` | Identifiers, figures, tags, chips, counts, meta and micro labels. |
| `--sl-font-brand` | `"Fraunces", Georgia, serif` | The wordmark and the monogram, nothing else. |
| `--sl-font-pixel` | `"Geist Pixel Square", "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace` | The display accent: a section index, a card's folio, a step number, a stat's value, the compact lockup and one emphasised word in a heading, at the `--sl-text-px-*` sizes only. |

Type scale:

| Token | Value |
| --- | --- |
| `--sl-text-micro` | `0.65625rem` |
| `--sl-text-xs` | `0.75rem` |
| `--sl-text-sm` | `0.875rem` |
| `--sl-text-md` | `1rem` |
| `--sl-text-lg` | `1.125rem` |
| `--sl-text-xl` | `1.5rem` |
| `--sl-text-2xl` | `2rem` |
| `--sl-text-3xl` | `2.75rem` |
| `--sl-text-display` | `clamp(3.5rem, 2rem + 5vw, 6rem)` |
| `--sl-text-px-1` | `12.5px` |
| `--sl-text-px-2` | `25px` |
| `--sl-text-px-3` | `37.5px` |
| `--sl-text-px-4` | `50px` |

Line heights:

| Token | Value |
| --- | --- |
| `--sl-line-tight` | `1.2` |
| `--sl-line-normal` | `1.5` |
| `--sl-line-relaxed` | `1.6` |
| `--sl-line-loose` | `1.7` |

- **Five roles, fixed pairing.** UI text is `--sl-font-sans`, headings `--sl-font-display`, identifiers and figures `--sl-font-mono`, the wordmark `--sl-font-brand`, the display accent `--sl-font-pixel`. There is no serif anywhere in the UI; a heading or numeral in the brand face is a defect. Why: the pairing is a family signal.
- **Micro labels are mono, uppercase, lightly tracked, and only micro labels.** Eyebrows, section indices, stat labels and captions take `--sl-font-mono` at `--sl-text-micro`, uppercase, in the muted ink; uppercase anywhere else is a defect. Why: a micro label names a region, never an action.
- **Headings** take `--sl-font-display`, semibold, `--sl-line-tight`, balanced, with negative tracking that tightens as the size grows. Why: tight display type carries the editorial look.
- **Oversized display is structure, used sparingly:** at most one fluid anchor per screen, set solid. Why: an anchor only anchors when it is alone.
- **The pixel face marks six display roles, only at whole cells.** A section index, a card's folio, a step number, a stat's value, the compact lockup and one emphasised word in a heading take `--sl-font-pixel`, at `--sl-text-px-1` to `--sl-text-px-4` only, untracked, never uppercase; body and UI text stay in Geist, code in Geist Mono, and a figure that changes in place keeps `--sl-font-mono`. The rule is about role, not size: a micro section index is a micro label and stays mono. Why: any other size smears its pixel cells, and the face is proportional with no tabular figures.
- **Body measure.** Running text is capped by `--sl-measure: 63ch`, a local convention rather than a token, and never runs full-bleed. Why: long lines are hard to read.

## 5. Spacing, radii, control height and screen layout

Space scale:

| Token | Value |
| --- | --- |
| `--sl-space-0` | `0` |
| `--sl-space-1` | `0.25rem` |
| `--sl-space-2` | `0.5rem` |
| `--sl-space-3` | `0.75rem` |
| `--sl-space-4` | `1rem` |
| `--sl-space-5` | `1.5rem` |
| `--sl-space-6` | `2rem` |
| `--sl-space-8` | `3rem` |

Radii:

| Token | Value | Use |
| --- | --- | --- |
| `--sl-radius-sm` | `6px` | Rows, tiles, small chrome, tags, badges and chips. |
| `--sl-radius-md` | `8px` | Controls, fields and callouts. |
| `--sl-radius-lg` | `14px` | Cards, dialogs and overlays. |
| `--sl-radius-pane` | `10px` | An island pane. |
| `--sl-radius-pill` | `9999px` | A fully rounded end; never a tag or a chip. |

- **One control height.** Button, field, select, segmented control and icon button are all `32px`, each summing a fixed line, padding and a 1px edge; a product that needs a taller control scales the row, not one member of it. Why: controls that share a row share a height, so a field and its submit button align.
- **Spacing off the scale.** Every gap and padding steps off `--sl-space-*`; no arbitrary values in new work. Why: one rhythm across products.
- **Radii are shape.** Controls, fields and callouts are `--sl-radius-md`, cards and dialogs `--sl-radius-lg`, tags, badges and chips `--sl-radius-sm`. Why: one corner per kind of part.
- **Hairline structure.** Structural separation is a single 1px rule in the theme's line colour; no heavy borders, no drop shadow as a separator. Why: casts are reserved for what is lifted or floating.
- **Hairline grid.** Card grids are a 1px `gap` over the line colour, each cell painting its own surface. Why: crisp shared rules instead of doubled borders.
- **Sections lead with an index.** A section opens with a mono index label beside its heading and a 1px top rule. Why: the index is real structure, numbered only for a real sequence.
- **Settings and form screens.** A settings or form screen is a sidebar nav (`sl-nav`) beside one main pane. The pane opens with a head: an eyebrow, the title, a one-line lede, and any scope switch on the right. Each section is one row of two columns: its title and a one-line description on the left, its controls on the right, at most two control columns wide. 1px hairlines split the sections, never cards. Pending edits collect in one action bar at the foot of the pane: a note of what changed, then Discard and the primary Save. Why: every settings screen reads the same way, and the hairline structure carries it without boxes.

## 6. Depth recipes

Depth is lightness, not lines: canvas, surface, raised and tile are the rungs of the neutral ladder. Seven recipes spend them as role-vars in `components.css` (`--slc-depth-*`), so no product re-derives a shadow.

- **Tile** — a selection lifted out of its pane: the tile fill (`--sl-bg-tile`), a lit top hairline (`--sl-border-lit`), a 1px ring and a short cast. Hover never lifts; only selection lifts, and a selected tile carries the seam. Why: the tile is depth, not a state cue, so the seam carries the state.
- **Flat tile** — a tile that does not leave its row: lit and ringed, no cast (an active tile tab). Why: it marks selection without lifting out of a strip.
- **Island** — a pane on a darker frame: lit, with the quieter ring (`.sl-pane`); the pane that holds the focus is lit, with no accent rim. Why: the focused pane is the bright one at a glance.
- **Key** — a keycap: a fill that steps from raised to surface, a ring, a lit top line and a base of its own fill in shade. Why: every shortcut reads as a physical key.
- **Sunk** — a well, an inset cast on the sunken rung: a field, a select, a textarea, the switch and segmented tracks. Why: what you type into sits below the surface.
- **Float** — an overlay: three layers of cast under the overlay's own border in shade, which is the ring (a dialog). Why: a floating surface carries its own edge.
- **Cast** — an overlay that keeps no border (the palette, the toast): the float with the ring folded in, lit along its top (`--slc-depth-cast`). Why: a borderless overlay still needs an edge in shade.

A host that wears a recipe carries no border of its own, so the lit line sits flush under the ring. Shadows are black at each theme's alpha (`--sl-shadow-sm`, `--sl-shadow-md`, `--sl-shadow-lg`, `--sl-shadow-inset`). High contrast trades every recipe for a drawn ring; a theme that turns a recipe off sets an empty shadow (`0 0 transparent`), never `none`, which would void the box-shadow list. Why: keys stand, tiles lift, wells sink, focus glows, one physical vocabulary across the kit.

The well's cast, `--sl-shadow-inset`: light `inset 0 1px 2px rgba(0,0,0,0.06)`; dark and high contrast `inset 0 1px 2px rgba(0,0,0,0.2)`.

## 7. Signature components

These recurring parts carry the family look. A surface need not use all of them, but any it uses matches.

- **Wordmark** — the brand is typographic, with no pictorial mark: `sondalab.` in `--sl-font-brand` with the trailing period in the accent. The compact lockup is `sonda/lab`, lowercase, in `--sl-font-pixel` at `--sl-text-px-1`, untracked, with the `/` in the accent ink (`.sl-lockup`). Why: the brand face is the wordmark's and the monogram's alone, so a wordmark in the display role is a defect.
- **Product name** — a product's name in a header or title bar is set in the display face (`--sl-font-display`) at weight 700 with an accent dot after it (`.sl-titlebar__mark`); the `sondalab.` wordmark in the brand face (`--sl-font-brand`) stays the brand alone. Why: the product's name is UI type, and the brand face belongs to the brand.
- **Eyebrow** — the micro label above a heading: `--sl-font-mono`, uppercase, `--sl-text-micro`, medium weight, lightly tracked, in the muted ink. Why: it is the strongest family signal, and it names structure only.
- **Tag** — an inline mono mark at `--sl-radius-sm`, in sentence case: a 1px border in a soft accent tint, a small dot before the label, accent text. Why: mono because it carries an identifier, sentence case because it is read, not shouted.
- **Inversion band** — a full-width block flipped to the strongest neutral (ink ground, paper text) that punctuates the rhythm and marks the thesis or the primary call to action; at least one per long page (`.sl-invert`). A control in a band rests on the band's own hairline and takes the band's control edge on hover. Why: the recurring inversion is a core motif.
- **Keycap** — every shortcut is a small physical key, `.sl-kbd`, in `--sl-font-mono`, one cap per key, wearing the key recipe. Inside a button it is a child `<kbd class="sl-kbd" aria-hidden="true">` and the button names the shortcut with `aria-keyshortcuts`. Why: `::after` belongs to glass, and the cap never reads weaker than the label beside it.
- **Tile** — selection is a raised tile plus a seam: a short line inside its leading edge, or above its bottom edge in a tab or a segment, in the accent while its container holds the focus and in the muted ink otherwise. Why: the tile alone barely separates from its ground, and the seam carries the state at 3:1.
- **Bezel card** — the card as a bezel, `.sl-card.sl-card--bezel` with a `.sl-card__stage` and a `.sl-card__caption` (markup in `agent/catalog.md`); high contrast trades its hairlines for one solid 1px edge. Why: the stage sits in the frame like a screen in its bezel.
  - **Frame and stage:** a frame on the surface rung holding a darker stage.
  - **Concentric radii:** stage r6 (`--sl-radius-sm`) + inset 8 = frame r14 (`--sl-radius-lg`), all kit radii.
  - **Edges:** drawn as alpha hairlines (lit top, faint ring, shaded bottom), with no CSS border.
  - **Caption:** a caption row on the frame.

## 8. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--sl-motion-fast` | `120ms` | Short state changes; reduced motion zeroes it. |
| `--sl-motion-mid` | `220ms` | Entrance reveals and most transitions; reduced motion zeroes it. |
| `--sl-motion-slow` | `360ms` | Longer entrances; reduced motion zeroes it. |
| `--sl-motion-ease` | `cubic-bezier(0.25, 1, 0.5, 1)` | Every state change. |
| `--sl-motion-enter` | `cubic-bezier(0.22, 1, 0.36, 1)` | What arrives (a dialog, a tooltip, a toast): moves at once, settles long. |
| `--sl-motion-dither-in` | `260ms` | The hover dither wipe filling a control. |
| `--sl-motion-dither-out` | `320ms` | The hover dither wipe draining from a control. |
| `--sl-motion-check` | `180ms` | The pixel check's fill and tick. |
| `--sl-motion-radio` | `150ms` | The pixel radio's dot. |
| `--sl-motion-switch` | `260ms` | The pixel switch's knob and fill, which end together. |
| `--sl-motion-spring` | `linear(0, 0.024, 0.087, 0.174, 0.275, 0.382, 0.488, 0.588, 0.68, 0.761, 0.831, 0.89, 0.937, 0.975, 1.003, 1.023, 1.037, 1.045, 1.049, 1.05, 1.048, 1.044, 1.04, 1.035, 1.029, 1.024, 1.019, 1.015, 1.011, 1.007, 1.005, 1.003, 1)` | A control returning from a press: one small overshoot, transforms only. |

- **Durations come from the tokens, never a literal.** Why: reduced motion zeroes the duration tokens, which stops everything at once.
- **Respect reduced motion.** Under `prefers-reduced-motion: reduce` nothing animates; never add motion that bypasses the tokens. The dither wipe and the pixel-control frames are never armed there, so their durations are not zeroed. Why: motion must stay optional.
- **No page-load choreography in the kit.** The kit animates what arrives, never the page itself; a page that wants an entrance stagger owns it, on the motion tokens. Why: the page is content, not a show.
- **Stagger related entrances** rather than fading the whole screen at once. Why: a stagger shows order, a whole-screen fade shows nothing.
- **Entrances rise a little.** A small rise plus opacity on `--sl-motion-mid` or `--sl-motion-slow`, as transitions, never keyframes. Why: a browser without `@starting-style` simply shows the element.
- **The hover is a dither wipe.** On a button or icon button the pointer's answer is a fill that grows through an 8x8 Bayer threshold on the kit's pixel cell from where the pointer entered and drains toward where it left, clipped to the control's radius; once half the control is covered its label flips to the on-fill pole. Why: the pixel cell is the kit's unit, and the silhouette stays smooth.
- **Controls give under the finger.** Held, a text button sinks a little and returns on `--sl-motion-spring`; tabs, rows, fields and cards do not move. Transitions only. Why: a keyframe would also play when a page loads with a box already checked.
- **Pixel controls.** The check, radio and switch draw their final frames in CSS on the pixel lattice; the motion (`--sl-motion-check`, `--sl-motion-radio`, `--sl-motion-switch`) only plays the way there. Why: with reduced motion, high contrast or no script they show the same shapes.

## 9. Effect families

Effects are an opt-in import (`effects.css`, plus `effects.js`). Classes are additive (`.sl-fx-*` on a shipped `.sl-*` class), and every hue is derived from a role-var, never a literal.

- **Glitch** means *something re-resolved*: a value changes, a destructive action is confirmed, validation fails. It is never ambient on a control.
- **Aurora** means *attention lives here*: focus, an active tab, a running operation, the primary call to action. It is a 1px arc of light on an edge that already exists, and it renders state without being the state (`aria-busy`, `role="progressbar"`).
- **Glass** means *this is a physical surface*, a state rather than an event: a card edge, a field, a keycap. It is chrome on the element's own border and never animates on its own.
- **Goo** means *these belong to one another*: it marks a set and answers the layout, not the pointer. A form control or a link is never a member.

- **One meaning each.** A family never fires outside the meaning it owns, and an effect that means nothing is switched off. Why: structure encodes truth, in motion too.
- **The effect budget.** At most one ambient aurora and one glitch burst per document at a time; busy auroras are exempt. Why: two competing lights mean nothing.
- **Three kill switches.** `prefers-reduced-motion: reduce`, `[data-sl-theme="high-contrast"]` and `data-sl-fx="off"` on any element; no effect replaces or removes the focus outline. Why: an effect is decoration on top of the state.
- **Disabled is a checkerboard, not a dimming.** A disabled control is greyed by a checker of 1px cells drawn as a `mask-image` on the control itself. Why: the control stays legible as a shape and plainly unavailable.
- **Light and shape, never weight.** An effect is a pixel or two wide and fades within a few tens of pixels; a separator stays 1px whatever an effect does, and no effect rewrites a declared value. Why: the surface under an effect stays free to set its own radius and edges.

## 10. Do and do not

From `agent/flavour.md`. A pattern borrowed from an external reference may add to the do list; it never replaces an item of it and never brings in an item of the do-not list.

### Do

- The `sondalab.` wordmark in Fraunces (`--sl-font-brand`), with the trailing period in the accent. See L3 Wordmark.
- Mono uppercase micro labels (eyebrows, section indices), structure only, never on a control. See L1 micro labels, L3 Eyebrow.
- Geist and Geist Mono for the UI; Geist Pixel Square for display numerals, the lockup and one display word, at whole-cell sizes only. See L1.
- 1px hairline structure, and the hairline grid (a 1px gap over the line colour). See L2 Hairline structure, Hairline grid.
- Depth as lightness: the tile, key and well (sunk) recipes, never a drop shadow as a separator. See L2 Depth is lightness.
- The inversion band, at least one per long page. See L3 Inversion band.
- The Bayer dither hover on the pixel cell. See L4 The hover is a dither wipe.
- Disabled is a checkerboard, not a dimming. See L6 Disabled is a checkerboard.
- Pixel check, radio and switch. See L4 Pixel controls.
- Four effect families (glitch, aurora, glass, goo), one meaning each. See L6 Four families.
- One accent per product, from the accent registry (`accent-registry.json`). See Decision 2.
- Precise, technical voice: real figures and real output, never marketing. See L5.

### Do not

- **Pill-shaped chips and tags.** L2 Radii: tags, badges and chips are r6.
- **Inter or any other non-Geist UI face.** L1: five roles, fixed pairing.
- **Blur and soft colour glow as transition material.** The dither dissolve replaces blur. (Blur as a standing material, as in L3's sticky header, is unchanged.)
- **Hover lifts.** L2 Tile: hover never lifts; only selection lifts.
- **Page-load choreography in the kit.** L4: no page-load choreography in the kit.
- **Figurative art.** The brand is typographic, with no pictorial mark.
