# @sondalab/ui-kit

Sondalab design tokens as CSS custom properties (`--sl-*`), a CSS-only component layer (`.sl-*`), and an opt-in effects layer (`.sl-fx-*`). No build step; the tokens and components need no runtime JS — import the stylesheets and theme via a `data-sl-theme` attribute. The effects layer ships a small JavaScript driver you call explicitly (see below).

```css
@import "@sondalab/ui-kit/tokens.css";        /* shared: type, spacing, radii, motion, shadow, z */
@import "@sondalab/ui-kit/components.css";     /* .sl-* components (reads role-vars, see below) */
@import "@sondalab/ui-kit/themes/light.css";  /* [data-sl-theme="light"]  surfaces, text, borders, status, accent */
@import "@sondalab/ui-kit/themes/dark.css";
@import "@sondalab/ui-kit/themes/high-contrast.css";
@import "@sondalab/ui-kit/themes/products.css";  /* optional: per-product neutrals, see 0.29 below */
@import "@sondalab/ui-kit/fonts.css";          /* optional: the faces, served from the package, see Fonts below */
```

```html
<html data-sl-theme="dark"> … </html>
```

**Per-product accent.** The bundled accent is the Sondalab default (amber `--sl-accent-default`, teal `--sl-accent-depth`). A product keeps its own signature by overriding the accent tokens after the import:

```css
[data-sl-theme="dark"]  { --sl-accent-default: #2ee6c0; --sl-focus-ring: #2ee6c0; }
[data-sl-theme="light"] { --sl-accent-default: #0e9c84; --sl-focus-ring: #0e9c84; }
```

**Light theme: Prism (0.21).** The light theme's ground was a cool near-white (`#F4F4F8`) until 0.29, when the neutrals became tinted per product (below). It also declares a six-hue spectrum (`--sl-spectrum-0..5`, and a darkened ink set `--sl-spectrum-ink-0..4` for anything seen as text or a dot). The spectrum is not an accent: it is the same in every product and never marks state. Dark and high-contrast reset it to `initial`.

**0.30.0 — Geist type, a brand face, a micro register (Lumen).** The UI faces change and the mono uppercase register shrinks to micro labels (owner, 2026-10-02). Two tokens are added and none removed, but what every surface renders changes:

- `--sl-font-sans` and `--sl-font-display` are Geist, `--sl-font-mono` is Geist Mono (were Instrument Sans, Fraunces and Martian Mono). New `--sl-font-brand` is Fraunces: the wordmark and the monogram use it and nothing else does. If you set a heading, title or numeral in `--sl-font-display` expecting the serif, it is now Geist; point a brand mark of your own at `--sl-font-brand`.
- **If you loaded the faces yourself** (Google Fonts, Fontsource, a CDN link naming Fraunces / Instrument Sans / Martian Mono): the tokens now name Geist and Geist Mono first, which that link does not serve, so your UI falls back to `system-ui` and `ui-monospace`. Load `@sondalab/ui-kit/fonts.css` (or add Geist and Geist Mono to your own link).
- **If you override `--sl-font-*`** (e.g. a site that sets `--sl-font-display` to Fraunces for its headings): also set `--sl-font-brand` if you mean to move the brand face, and expect the kit's display tracking, now tuned for Geist (`.sl-anchor` `-0.05em`, titles `-0.02`/`-0.03em`), to land on your face. Drop the display override to take the new direction, or re-tune `letter-spacing` on the elements you keep in Fraunces.
- New `--sl-text-micro` (`0.65625rem`, 10.5px): eyebrow, nav group title, stat label, section index, figure caption and labelled rule are mono, uppercase, 10.5px, weight 500, tracked `0.06em` (were `--sl-text-xs`, tracked 0.14–0.22em).
- Sentence case, in the sans, untracked: buttons were already; chip, badge, segmented item, table head, breadcrumb and field label now are too (they were mono uppercase). The CSS no longer upper-cases them, so write their text in sentence case ("Passed", not "PASSED"). Text written in lower case — data-driven labels included (an event kind, a status read from an API) — now renders in lower case, not in sentence case: capitalise it at the source (introspect's badges and chips are examples). The callout title is the sans at `--sl-text-sm`, 600 (was mono uppercase xs). The tag stays mono, now in sentence case, tracked `0.02em`.
- Inside `.sl-invert`, muted text is the band's foreground at 60% (was 58%): at 58% it read 4.31:1 on a raised surface placed in the band and 4.46 on a card there (dark), under the 4.5 text floor. It now reads at least 4.58 on the bare band, a card and a raised surface, for every product on every theme. A Tier B band of your own that copied the 58% should take 60%.
- Headings: card title `-0.02em`, dialog title `-0.03em` (both `-0.01em` before), `.sl-anchor` `-0.05em` (was `-0.02em`), all Geist 600.
- Unchanged: `--sl-text-xs`, `--sl-text-sm`, every control's padding and line height, so the 32px row stays 32px (Geist's ascent and descent centre its cap height on a `line-height: 1` box, as Instrument Sans's did).
- `fonts.css` serves Geist and Geist Mono (new, variable, latin-subset woff2, SIL OFL 1.1) beside Fraunces. Instrument Sans and Martian Mono are deprecated: still declared and still shipped for this release window so a product that names them by hand keeps rendering; no token names them, and they go in 1.0.0.
- The compact lockup is re-cut in Geist Mono 300: `sondalab-lockup.svg` (was Martian Mono 300) now carries the `0.2em` tracking the identity board and `.sl-lockup` set, so it is wider for the same height (viewBox `8.7 -766 6984 822`, was `54.8 -855.2 6661.2 910.4`). `.sl-lockup` renders in Geist Mono at weight 300 (was the mono role's 400). If you inline the SVG, take the new file; the wordmark and the avatars are unchanged.

**0.29.0 — neutrals tinted per product (Lumen).** Every neutral — canvas, surface, raised, the new `--sl-bg-tile` and `--sl-bg-sunken`, primary/secondary/muted text, the borders, the new `--sl-border-lit`, and the neutral code roles (`--sl-code-fg`, `--sl-code-comment`, `--sl-code-null`) — is now one rung of a shared lightness/chroma ladder tinted with the product's accent hue, baked to hex at build time:

- The theme files carry the default (amber) product's values, so a page with no product attribute gets warm neutrals: light canvas `#eae6e2` (was `#F4F4F8`), surface `#fcfaf9`, text `#201c18`; dark canvas `#0a0806` (was `#070A0D`), surface `#13110e`, text `#eeeae7`.
- `themes/products.css` (new) carries every registered product's neutrals. Load it and put `data-sl-product="<id>"` on the element that carries `data-sl-theme`, or on an ancestor of it: `<html data-sl-theme="dark" data-sl-product="spexr">`. The attribute on a descendant of the theme element matches nothing. One product per theme subtree: every block weighs the same, so with two products nested the later block in `products.css` wins, not the nearer ancestor.
- `neutrals.json` (new, exported) has the same values for code that needs hex outside CSS — editor and terminal themes, Electron `backgroundColor`, a preload page, a Tier B colour layer: `products.<id>.<light|dark>.<role>` is the literal value of `--sl-<role>`.
- High contrast keeps its own literal neutrals (see the last bullet).
- Light accent text is capped at oklch L 0.46 (was 0.5), so every registered accent's text reads on the darker canvas and its own 12% wash; the focus ring follows it.
- Light `--sl-viz-2` `#0E958A` → `#0E9186` and `--sl-viz-3` `#D26A00` → `#CD6400`, to keep 3:1 on the new grounds.
- The one control edge (`--slc-edge-control`) steps 5 from the surface toward contrast, plus half a step on a light surface (read from the surface's lightness, so a Tier B layer gets it too; the base is the new `--slc-edge-control-steps`); it reads >= 3.5:1 on the light canvas. The primary's paper edge cap (`--slc-edge-accent-lmax`) goes 0.62 → 0.59, so amber's edge reads >= 3.4:1 there (it fell to 3.03).
- The light overlay (`--sl-bg-overlay`) is cast in the product's own ink too. The shadow ramp still casts in the pre-0.29 ink (`rgba(28,29,34,…)`) until the K4 casts; that ink is otherwise gone.
- `sl-audit --product <id>` allows that product's own generated neutrals. The pre-0.29 grey grounds and text (`#F4F4F8`, `#7C8D95`, …) are no longer tokens: a product that copied them gets R findings until it reads `neutrals.json`.
- High contrast gains values for the three new roles (tile = raised, sunken = canvas, lit = white) and resets to `initial` every other token light or dark declares that it has no value for (the code palette, the light text cap), so a high-contrast island inherits nothing from the page around it.

**0.28.0 — no rainbow by default.** The kit no longer paints any edge, rim or arc with the spectrum (owner, 2026-10-02). On the light theme, as on dark:

- Cards take their surface in shade (`--slc-edge-surface`), fields the one control edge (`--slc-edge-control`), and the primary button its fill in shade (`--slc-edge-accent`) with the lit top line. The 0.21–0.27 spectrum rim and its role vars (`--slc-rim`, `--slc-rim-edge`, `--slc-rim-layers`, `--slc-rim-fill`) are gone; an override that still sets them does nothing. The three hosts no longer carry a `background-image`, so a `background:` shorthand reset is safe again.
- The aurora (arc, bloom, `--rim`, `--linear`), the press light, glitch's channels and the run light are the accent's and its depth companion's on every theme.
- A halftone is single-ink by default. `data-sl-ink="spectral"` opts a canvas into the spectrum on light; `"mono"`, the old opt-out, still works and now changes nothing.
- The spectrum stays opt-in only, through the classes that are rainbow by name: `sl-haze`, `sl-spectral` (both still stand down in dark, high contrast and, for spectral text, inside `sl-invert`), and the halftone attribute above. Tier B: declare the eleven `--sl-spectrum-*` values from `themes/light.css` in your light layer to use them.
- `.sl-anchor` is set solid: `line-height: 1` (was `--sl-line-tight`, 1.2). In-flow headings are unchanged.

Dark and high contrast paint what they did in 0.27, apart from `.sl-anchor` being set solid (line-height 1) on every theme. No token changed.

**Fonts.** Import `@sondalab/ui-kit/fonts.css` and the kit serves its own faces from the package: Geist (`--sl-font-sans`, `--sl-font-display`), Geist Mono (`--sl-font-mono`) and Fraunces (`--sl-font-brand`, the wordmark and the monogram only). They are variable, latin-subset woff2 files under the SIL Open Font License 1.1, with the licences beside them in `assets/fonts/` (sources and sizes in `assets/fonts/README.md`). A surface that loads the same families another way does not need the file; every token names a system fallback stack, so a surface that loads neither renders in `system-ui` / `ui-monospace`, not in the faces it had before 0.30. Geist and Geist Mono also carry the IDE glyphs they have — arrows, math operators, keys (`⏎ ⌫`), box drawing and block elements in the mono, geometric shapes — inside their `unicode-range`. A product's code editor and terminal keep their own coding mono (`--sl-font-code`); that is not the kit's mono role.

## Components (`components.css`)

Primitives: `.sl-eyebrow`, `.sl-tag` (`--plain`), `.sl-btn` (`--primary` / `--ghost` / `--sm`), `.sl-card` (`__title` / `__body`), `.sl-badge` (`--success` / `--warning` / `--danger` / `--info`), `.sl-field` (`__label` / `__input` / `__control` / `__hint` / `__error`; `aria-invalid="true"` on the input is the invalid state), `.sl-kbd`, `.sl-code`, `.sl-link`, `.sl-rule` (`--labeled`).

Toggle buttons: any non-primary `.sl-btn` or `.sl-icon-btn` with `aria-pressed` — the attribute is the state, no extra class.

Form controls: `.sl-check` (mixed: set `input.indeterminate = true` from script — `:indeterminate` is the only hook, since a native checkbox may not carry `aria-checked`), `.sl-radio`, `.sl-switch` (each `__input` / `__box`-or-`__track` / `__label`), `.sl-select` (a wrapper on `.sl-field__control`), `.sl-slider` (a native range; write `--sl-slider-value` for the fill).

Sizing: button, field, select, segmented control and icon button are all 32px tall (the small button 24px), so a row of them lines up.

**0.27.0 — sizing.** Each control's height is now a fixed line plus its padding plus a 1px edge, instead of the font's `normal` line height:

- `.sl-btn`: padding `0.5rem 0.9rem` (was `0.55rem`) on its `line-height: 1` — 32px. `.sl-btn--sm`: padding `0.3125rem 0.6rem` (was `0.35rem`) — 24px.
- `.sl-field__input` (and a select): `line-height: 1.25rem` (new) and padding `0.3125rem 0.75rem` (was `0.55rem`) — 32px. A textarea keeps `0.55rem` top and bottom and `--sl-line-normal`.
- `.sl-segmented__item`: `line-height: 1` (new) and padding `0.4375rem 1rem` (was `var(--sl-space-2) var(--sl-space-4)`, 0.5rem 1rem) — a 26px item in the 2px inset and 1px edge, 32px in all.
- `.sl-icon-btn` and `.sl-pagination__item` are `box-sizing: border-box`, so `2rem` / `1.75rem` is the whole control in a content-box page too.

If you override `padding` on `.sl-segmented__item`, or `font-size` on `.sl-field__input`, set your own `line-height` as well. The segmented item's line went from `normal` to `1`, so an old padding override now lands shorter than it used to; the field's line is a fixed 20px that no longer grows with the font, so a larger font sits cramped in it.

Forced colours: under `forced-colors: active` (Windows High Contrast or any user palette) the states carried only by a fill, a shadow or a gradient — checked, mixed, on, selected, pressed, the progress bar, a slider's value and thumb — repaint themselves in system colours, `!important` so a later product rule cannot put a page colour back, and the effect layers that would paint over them (glass, aurora, ink, liquid, goo, glitch) are hidden. Nothing to wire.

Motion: buttons, icon buttons, chips, segmented and pagination items squash a little while held, the switch knob stretches, a check or radio box shrinks, a slider thumb grows; each springs back when let go (`--sl-motion-spring`). Transitions only, never a keyframe; tabs, nav items, list rows, fields and cards don't move — a glass-pane card only sinks a hair (a third of the swell). Glass control panes press with the same squash, and a wrapper's `--slfx-pane-swell: 1` still stands them down. Reduced motion stops it all.

**0.27.1 — entrances, selection, scrollbars.** All additive; no class or token changed.

- `.sl-dialog` opened with `showModal()` rises 6px and fades in with its backdrop, and falls back as it closes where `overlay` is supported (elsewhere it closes at once); `.sl-tooltip` rises 4px as it fades in. `@starting-style` and transitions on `--sl-motion-mid` / `--sl-motion-ease`, no keyframes, on the `translate` property so your own `transform` still composes. Reduced motion zeroes the tokens, and a browser without `@starting-style` simply shows them. A closed `sl-dialog` is transparent: show one with `open`, not with a `display` of your own.
- `.sl-pagination__item:hover` takes the one control edge (`--slc-edge-control-hover`) instead of `--slc-border`.
- `::selection` is a 24% wash of the accent with the text set to its ground's `--slc-text` (≥ 8:1 in light, dark, high contrast and inside `.sl-invert`). It weighs (0,0,1): your `.x::selection` wins, and so does a bare `::selection` loaded after the kit. An ink block of your own that does not re-derive `--slc-text` would select ink on ink — re-derive it, as `.sl-invert` does.
- The page's own scrollbar is thin, with a `--slc-edge-control` thumb and no track (`:root`, zero specificity, not on high contrast). `<body>` hands `scrollbar-color: auto` back to everything inside it, so inner scrollers keep their own look and hand-drawn `::-webkit-scrollbar` rules keep working (Chromium 121+ ignores them under a non-auto `scrollbar-color`).

Navigation & state: `.sl-breadcrumb` (`__item` / `__sep`), `.sl-btn-group`, `.sl-segmented` (`__item`; `aria-selected` for views, `aria-pressed` for a setting), `.sl-chips` / `.sl-chip` (`__count`; a multi-select filter row driven by `aria-pressed`), `.sl-progress` (`__bar`, `--success`/`--danger`; set `aria-valuenow` and `--sl-progress`), `.sl-icon-btn` (`--round`), `.sl-pagination` (`__item`), `.sl-empty` (`__title` / `__body`), `.sl-skeleton`, `.sl-stat` (`__value` / `__label`).

Identity & media: `.sl-wordmark` (`__dot`), `.sl-lockup` (`__dot`), `.sl-monogram`, `.sl-figure` (`__media` / `__caption`), `.sl-avatar` (`--sm` / `--lg`).

Patterns (page-level composition, shipped classes since 0.10.0): `.sl-wrap`, `.sl-prose`, `.sl-header`, `.sl-invert`, `.sl-hgrid`, `.sl-section` (`__head` / `__idx`), `.sl-anchor`.

App structure: `.sl-nav` (`__group` / `__item` / `__count`; current item via `aria-current`), `.sl-list` (`__row` / `__meta`, `--dense`; selection via `aria-selected` or `aria-current`), `.sl-disclosure` (`aria-expanded`), `.sl-kv` (a `<dl>`), `.sl-resizer` (`--horizontal`; `role="separator"`, the drag is the consumer's).

Complex (composed shells — no behaviour JS; the consumer wires interaction): `.sl-callout` (`--success`/`--warning`/`--danger`/`--info`), `.sl-table` (`--numeric`; wrap in an `overflow-x:auto` container), `.sl-dialog` (visual shell for the native `<dialog>` — drive with `.showModal()`/`.close()`), `.sl-tabs` (`__list`/`__tab` — supply your own ARIA + panel switching), `.sl-tooltip` (CSS-only via `data-sl-tooltip`).

### Colour contract — role-vars (`--slc-*`)

Components never read theme tokens directly (those resolve only under `[data-sl-theme]`). They read role-vars that default through a fallback chain to the `--sl-*` token, then to a brand literal. **Tier A** products (full `data-sl-theme`, e.g. spexr, daos) need zero wiring — the role-vars pick up the live theme automatically. **Tier B** products (value-pinned, e.g. introspect) map the role-vars **once** to their own colour layer. That block is the *entire* integration surface:

```css
:root {
  --slc-accent:         var(--your-accent);
  --slc-accent-hover:   var(--your-accent-hover);
  --slc-accent-active:  var(--your-accent-active);
  --slc-accent-subtle:  var(--your-accent-tint);   /* ~12% accent over surface */
  --slc-on-accent:      var(--your-on-accent);     /* text on a filled accent */
  --slc-canvas:         var(--your-canvas);        /* the page ground, below surface */
  --slc-surface:        var(--your-surface);
  --slc-raised:         var(--your-raised);
  --slc-overlay:        var(--your-overlay);        /* dialog backdrop */
  --slc-text:           var(--your-text);
  --slc-text-secondary: var(--your-text-2);
  --slc-text-muted:     var(--your-text-muted);
  --slc-border:         var(--your-border);
  --slc-border-subtle:  var(--your-border-subtle);
  --slc-border-strong:  var(--your-border-strong);
  --slc-focus:          var(--your-accent);
  --slc-success: var(--your-success); --slc-warning: var(--your-warning);
  --slc-danger:  var(--your-danger);  --slc-info:    var(--your-info);
}
```

**Derived roles — never map these.** Two families are computed from the ones above, so a Tier B product gets them in its own colours for free:

- `--slc-accent-text` is the accent as text or a thin line: `oklch(from var(--slc-accent) min(l, var(--sl-accent-text-lmax, 1)) c h)`. On the light theme the accent is a *fill* and the cap (`0.46` since 0.29, `0.5` before) darkens it until it reads at 4.5:1; elsewhere it is the accent. Links, tags, tabs, pressed labels and the focus ring use it. On a solid status fill use `--slc-on-success|warning|danger|info` instead of `--slc-on-accent`: each picks the pole that contrasts with its own fill (white on the light theme, near-black on the dark), where the accent's partner can be dark on dark. Inside `.sl-invert` the ground is the theme's ink — light on the dark and high-contrast themes — so the band re-derives it with its own cap, `--sl-accent-band-text-lmax` (0.45 there, none on light), and a fixed floor (oklch L 0.68) that lifts a dark product hue on the light theme's band. The band also derives `--slc-success-text` / `-warning-` / `-danger-` / `-info-text` (status as text or a thin mark, same floor and cap) and its own translucent `--slc-accent-subtle`; outside a band those four are unset and components fall back to the status role.
- `--slc-edge-*` (`ground`, `surface`, `raised`, `wash`, `accent`, `pressed`, `control`) is each edge as its own fill one step less bright (`--slc-shade-step`, 0.075 of oklch lightness). Every bordered component uses them instead of the neutral `--slc-border*` lines; high contrast maps them back to its drawn border, the inversion band to its re-derived neutrals.

**Light-layer numbers (Tier B).** The kit sets three numbers only on `:root[data-sl-theme="light"]` and the light theme file, which a `[data-theme]` layer never matches, because they cannot be read off the colours themselves. Set them in your light layer, on the root element (the role-vars resolve there):

```css
:root[data-theme="light"] {
  --sl-accent-text-lmax: 0.46;                    /* the accent as text, capped */
  --slc-edge-accent-lmax: 0.59;                   /* the primary's edge, capped on paper */
  --slc-edge-accent-top: var(--slc-edge-accent);  /* its top line is that edge too */
}
```

The control edge needs nothing: its extra half step on a light surface is read from the surface. Your neutrals (`--your-canvas`, `--your-text`, the borders, the overlay) come from `neutrals.json` → `products.<id>.<light|dark>`.

**Inversion bands.** `.sl-invert` ships the fix. Inside a band whose background is the strongest neutral, `--slc-border`'s alpha-over-canvas value sits on the wrong ground and the hairline disappears — and a component that paints its own surface keeps the light one under re-derived light text. The class re-derives the border, text **and surface** role-vars from the band's own foreground, on its children, so any component placed inside keeps a visible edge and a ground it can be read against. A product rolling its own band does the same by hand:

```css
.invert > * {
  --slc-border:  color-mix(in srgb, currentColor 22%, transparent);
  --slc-surface: color-mix(in srgb, currentColor 7%, transparent);
}
```

The re-derivation sits on the children, not on the band: a custom property whose value references one declared on the same element is a cycle, and CSS makes every property in a cycle invalid — the band would paint itself its own foreground.

The full reference implementation — every component in all three themes — is `showcase/index.html` (§04).

## Effects (`effects.css` + `effects.js`, opt-in)

Five additive families, each carrying one meaning, composed onto a shipped `.sl-*` class — never replacing it. **Glass** (`sl-fx-glass`) — the element's own border as chrome; with `--pane`, the element is made of glass: a slab of light under the label, a glint that follows the pointer, a hairline that turns to face it with a fringe of colour either side. Every text button takes `--pane`, primary or ghost; with `--text` the letterform itself is the pane — a mask cuts the glass to the element's own glyphs, measured off the element, so the type stays entirely the surface's. **Aurora** (`sl-fx-aurora`) — a 1px arc of light riding the border while attention lives on the element: focus, `data-sl-fx-live="on"` (one ambient sweep per document), `data-sl-fx-live="busy"` (with `aria-busy`), or a determinate arc from an inline `--slfx-progress` (with `role="progressbar"`). **Liquid** (`sl-fx-liquid`) — the outline gives under the pointer and springs back; gated behind `--drop`, a round icon-only button and nothing else, and inert without it. **Goo** (`sl-fx-goo` on a container + `sl-fx-goo__member` on each element in the set — standard elements only; `button`, `input`, `select`, `textarea` and `a[href]` are refused) — several elements read as one substance, welding where they come within `--slfx-goo-weld` of one another; it answers the layout, not the pointer, and each member's silhouette is painted in that member's own fill so their colours blend across the neck. **Glitch** (`sl-fx-glitch`) — a finite burst on a child `<span>`, fired from JavaScript.

```css
@import "@sondalab/ui-kit/effects.css";   /* after components.css */
@import "@sondalab/ui-kit/compositions.css"; /* optional, AFTER effects.css — bindings only */
```

**Compositions.** `compositions.css` is an optional stylesheet carrying the custom-property bindings a composition needs: today, the pane-swell stand-down on `.sl-figure__media`, where a pane filling the media box would have its 3% hover swell and its seated light cut by the wrapper's `overflow: hidden`. It contains no paint and no new class, and is inert without `effects.css`. The canonical class string per component lives in `agent/catalog.md` § Effects.

```js
import { mount, mountGpu, burst, autoBurst, hoverBurst, scramble, grantLive } from "@sondalab/ui-kit/effects.js";
mount();                      // Tier 1: the liquid, the goo's fields, glitch bursts, the aurora's sweep. Explicit, never automatic.
// A product with a documented reason to animate for a visitor reporting
// prefers-reduced-motion takes the derogation explicitly. It reaches the
// GLITCH and the HALFTONE's motion; high contrast still refuses.
// mount(document, { ignoreReducedMotion: true });
// bursts: the ambient glitch ceiling, default 1. A page with several ambient
// glitches raises it, or most of them are dropped.
// mount(document, { bursts: 3 });
//
// burst(el)                     — one finite burst
// autoBurst(el, {waitMin, waitMax})   — ambient: burst, wait, burst again; returns stop
// hoverBurst(hoverEl, targetEl)       — while the pointer is over one, glitch the other
mountGpu().then((ok) => {});  // Tier 2 is retired: always resolves false (kept for existing callers).

// Glass text: mount() cuts every .sl-fx-glass--text host to its own glyphs and
// seats an unmasked .sl-fx-glass__glow before it to carry the light. The two
// boxes are the same size and carry the same string; PLACING them together is
// the surface's one rule — a slot that stacks them is enough:
//   .folio-slot { display: inline-grid; }
//   .folio-slot > * { grid-area: 1 / 1; }
// One line only: the mask is a single SVG <text> run and SVG text does not wrap.
```

- **Tiers.** Without `mount()` the CSS alone is Tier 0 and correct on its own: a static glass hairline, a static aurora arc on focus, and a goo field's members simply laid out unmerged. `mount()` arms Tier 1 by setting `data-sl-fx="on"` on `<html>`. `mountGpu()` needs `vgpu` (an optional peer dependency — install it yourself if you want Tier 2; nothing breaks without it) and sets `data-sl-fx-gpu="on"` only once a frame is actually on screen.
- **Kill switches, all honoured at every tier:** `prefers-reduced-motion: reduce` (nothing animates; `mount()` refuses), `[data-sl-theme="high-contrast"]` (every family off, the GPU tier torn down), and `data-sl-fx="off"` on any element (that element and its subtree). The focus `outline` is never replaced or removed.
- **Holding still:** set `data-sl-fx-still` on `<html>` while the app is idle or its window is unfocused. The attribute works by presence: any value holds, `"false"` included, so remove it to resume. Motion freezes in place and resumes where it stopped when the attribute is removed: the live light (`live-light.js`) draws the frame it is on and asks for no more, keeping its canvases and WebGL contexts; the halftone (`halftone.js`) freezes on the frame it is on and resumes from it; and every kit animation (aurora sweep, curtains, beam, busy/run orbit, goo drift, the live badge's breath) is paused with `animation-play-state`. A glitch stands down to its label instead of freezing mid-burst. It is a pause, not a kill switch: nothing is detached, and apart from the glitch nothing changes how it looks. Not reached: the pointer-driven loops in `effects.js` (liquid, specular, press), which run only while the pointer moves; the glitch's `autoBurst` timers, which keep starting bursts that the flag then takes off; a drifting goo field's `goo-field.js` measuring loop; and anything the product animates itself, including animations it puts on a glass or aurora host.
- **Replaced controls** (`<input>`, `<textarea>`, `<select>`) render no pseudo-element: wrap them in `<span class="sl-field__control sl-fx-…">` and put the effect classes on the wrapper.
- **Filled elements** (`sl-btn--primary`) take `sl-fx-aurora--rim`, which steps the arc just outside the fill — and tells a glass pane that its ground is the fill.

**Knobs a surface is expected to set.** Everything else is derived; these four are the ones written by hand.

| Property | On | Default | What it does |
|---|---|---|---|
| `--slfx-pillar-count` | an aurora host | `3` | how many curtains cross the host. The intensity control: fewer bands are wider bands. The pitch follows from the host's own width, so the pattern scales with the element rather than holding a fixed pixel size. |
| `--slfx-pane-swell` | a glass pane, **or any ancestor of it** | `1.03` | on a control pane (button, icon button, chip, segmented or pagination item) it scales the kit squash (k = (swell − 1) / 0.03); on any other pane it drives the uniform press sink, a third of the swell the other way (0.99 at the default). `1` stands either down. The hover growth this used to drive retired in 0.13 with `sl-fx-press`. Set it to `1` on a wrapper that scales the pane itself — otherwise the two scales compose and the pane's seated light spills past its edge. |
| `--slg-lens-disperse` | a lens host | `18` | the lens's red-to-blue separation, in px. Not raised in the default because it applies to everything behind the pane — at 60 the page's own text splits into visible RGB copies — so raise it per surface. |
| `--slg-lens-reach` | a lens host | `6` (`18` on an aurora host) | how far the lens is allowed to bend. The box caps it too, at a sixth of its shorter side, so a 32px control bends at most ~5.3px whatever this asks; a lens nested inside another glass pane is refused and keeps the material. |
| `--slg-lens-bulge` | a lens host | `0.4` | the pane's convex bulge: magnification at its centre as a fraction, falling to nothing at the rim; `0` turns it off. The owner's pick, 2026-09-25. |
| `--slfx-text-light` | a `--text` host or any ancestor | `--slc-text` | the light the cut glyphs are lit by, with `--slfx-text-core-a` (46%) and `--slfx-text-halo-a` (26%) for the two shadows. Rebind all three inside an inversion band, where `--slc-text` is the band's own ground. |

Read every one of them with `var(--name, default)` at the point of use if you extend this layer: a default **declared** on the pane or the glow would shadow the value an ancestor inherits down, and be unreachable from there.

The reference page is `showcase/effects.html`; the contract is `docs/specs/2026-09-08-effects-layer-design.md`; the per-component declension (which family goes on which component, and which never do) is `agent/catalog.md` § Effects.

### Halftone — `data-sl-halftone` (0.19.0)

A picture drawn in round dots whose size follows its light, inside a circle that dissolves at its edge — sondalab.eu's stance and method vignettes. The dots gather the first time the canvas is 40% in view, then float. The ink is the canvas's own `color`: dark ink prints the picture's dark (a halftone on paper), light ink its light. Armed by `mount()`, or by `halftone(root)` from `@sondalab/ui-kit/halftone.js` without it. Under reduced motion the settled picture is drawn, still; `data-sl-fx-still` holds it; high contrast hides it.

```html
<canvas data-sl-halftone data-sl-src="/art/kinship.png" data-sl-grid="130" aria-hidden="true"
        style="width: 22rem; aspect-ratio: 1"></canvas>
```

`data-sl-grid` is cells per side (16–256, default 96); `data-sl-seed` fixes which edge dots survive and how they scatter. A non-square picture is centre-cropped. **What reads as dots:** one iconic subject with near-binary contrast, drawn at ≥ 320px with a grid near 130; busy photos and dark renders do not. The engine is `@sondalab/ui-kit/halftone-core.js` (`sampleDots`, `dotFrame`, `settledFrame`, `toSVG`, `cover`), and `tools/halftone/` in the repo turns any picture into an SVG or PNG with the same dots.

Generated tokens (`tokens.css`, `themes/*.css`) come from the canonical `sondalab.tokens.json` — do not hand-edit them. `components.css` is hand-authored.
