# @sondalab/ui-kit

Sondalab design tokens as CSS custom properties (`--sl-*`), a CSS-only component layer (`.sl-*`), and an opt-in effects layer (`.sl-fx-*`). No build step; the tokens and components need no runtime JS — import the stylesheets and theme via a `data-sl-theme` attribute. The effects layer ships a small JavaScript driver you call explicitly (see below).

```css
@import "@sondalab/ui-kit/tokens.css";        /* shared: type, spacing, radii, motion, shadow, z */
@import "@sondalab/ui-kit/components.css";     /* .sl-* components (reads role-vars, see below) */
@import "@sondalab/ui-kit/themes/light.css";  /* [data-sl-theme="light"]  surfaces, text, borders, status, accent */
@import "@sondalab/ui-kit/themes/dark.css";
@import "@sondalab/ui-kit/themes/high-contrast.css";
```

```html
<html data-sl-theme="dark"> … </html>
```

**Per-product accent.** The bundled accent is the Sondalab default (amber `--sl-accent-default`, teal `--sl-accent-depth`). A product keeps its own signature by overriding the accent tokens after the import:

```css
[data-sl-theme="dark"]  { --sl-accent-default: #2ee6c0; --sl-focus-ring: #2ee6c0; }
[data-sl-theme="light"] { --sl-accent-default: #0e9c84; --sl-focus-ring: #0e9c84; }
```

**Light theme: Prism (0.21).** The light theme is a cool near-white ground (`#F4F4F8`) on which colour arrives as light: a six-hue spectrum (`--sl-spectrum-0..5`, and a darkened ink set `--sl-spectrum-ink-0..4` for anything seen at 1px or as text) paints the effects, a 1px hairline on cards, primary buttons and text fields, and two opt-in ornaments (`sl-haze`, `sl-spectral`). The spectrum is not an accent: it is the same in every product and never marks state — the product's accent still does. Dark and high-contrast reset it to `initial`, so they paint exactly what they did.

- Drop the rim on one element with the pair `--slc-rim: initial; --slc-rim-edge: initial` — it gets back the 0.20 border. Setting only `--slc-rim`, or restyling the element with the `background:` shorthand, clears the rim **and** leaves its border transparent on light; pair a `background:` override with the two resets. One that sets only `background-color` sees it covered by the rim's fill layer on light.
- Inside an inversion band (`sl-invert`) the rim and spectral text stand down (the band's surfaces are translucent, and the spectrum ink does not clear 3:1 on its ink); effects inside the band stay spectral.
- Keep a halftone single-ink with `data-sl-ink="mono"` on its canvas.
- An effect host (glass, aurora, press, glitch, liquid, a goo member) keeps its effect's edge and takes no rim; neither does what it contains.
- Nested theme regions: effects read the spectrum on their own host, so they follow the region's theme. The rims and the two ornaments resolve on `:root` like every `--slc-*` role, so they follow the page's theme — a light region in a dark page gets no rims, a dark region in a light page keeps them.
- Tier B: declare the eleven `--sl-spectrum-*` values from `themes/light.css` in your light layer to opt in; without them nothing is spectral.

**Fonts** (load separately, e.g. Google Fonts): Fraunces (display), Instrument Sans (body), Martian Mono (mono).

## Components (`components.css`)

Primitives: `.sl-eyebrow`, `.sl-tag` (`--plain`), `.sl-btn` (`--primary` / `--ghost` / `--sm`), `.sl-card` (`__title` / `__body`), `.sl-badge` (`--success` / `--warning` / `--danger` / `--info`), `.sl-field` (`__label` / `__input` / `__control`), `.sl-kbd`, `.sl-code`, `.sl-link`, `.sl-rule` (`--labeled`).

Toggle buttons: any non-primary `.sl-btn` or `.sl-icon-btn` with `aria-pressed` — the attribute is the state, no extra class.

Form controls: `.sl-check`, `.sl-radio`, `.sl-switch` (each `__input` / `__box`-or-`__track` / `__label`), `.sl-select` (a wrapper on `.sl-field__control`).

Navigation & state: `.sl-breadcrumb` (`__item` / `__sep`), `.sl-btn-group`, `.sl-segmented` (`__item`; `aria-selected` for views, `aria-pressed` for a setting), `.sl-chips` / `.sl-chip` (`__count`; a multi-select filter row driven by `aria-pressed`), `.sl-progress` (`__bar`, `--success`/`--danger`; set `aria-valuenow` and `--sl-progress`), `.sl-icon-btn` (`--round`), `.sl-pagination` (`__item`), `.sl-empty` (`__title` / `__body`), `.sl-skeleton`, `.sl-stat` (`__value` / `__label`).

Identity & media: `.sl-wordmark` (`__dot`), `.sl-lockup` (`__dot`), `.sl-monogram`, `.sl-figure` (`__media` / `__caption`), `.sl-avatar` (`--sm` / `--lg`).

Patterns (page-level composition, shipped classes since 0.10.0): `.sl-wrap`, `.sl-prose`, `.sl-header`, `.sl-invert`, `.sl-hgrid`, `.sl-section` (`__head` / `__idx`), `.sl-anchor`.

Complex (composed shells — no behaviour JS; the consumer wires interaction): `.sl-callout` (`--success`/`--warning`/`--danger`/`--info`), `.sl-table` (`--numeric`; wrap in an `overflow-x:auto` container), `.sl-dialog` (visual shell for the native `<dialog>` — drive with `.showModal()`/`.close()`), `.sl-tabs` (`__list`/`__tab` — supply your own ARIA + panel switching), `.sl-tooltip` (CSS-only via `data-sl-tooltip`).

### Colour contract — role-vars (`--slc-*`)

Components never read theme tokens directly (those resolve only under `[data-sl-theme]`). They read role-vars that default through a fallback chain to the `--sl-*` token, then to a brand literal. **Tier A** products (full `data-sl-theme`, e.g. spexr) need zero wiring — the role-vars pick up the live theme automatically. **Tier B** products (value-pinned, e.g. daos, introspect) map the role-vars **once** to their own colour layer. That block is the *entire* integration surface:

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
| `--slfx-pane-swell` | a glass pane, **or any ancestor of it** | `1.03` | the pane's press sink, a third of this the other way (0.99 at the default); `1` stands it down. The hover growth this used to drive retired in 0.13 with `sl-fx-press`. Set it to `1` on a wrapper that scales the pane itself — otherwise the two scales compose and the pane's seated light spills past its edge. |
| `--slg-lens-disperse` | a lens host | `18` | the lens's red-to-blue separation, in px. Not raised in the default because it applies to everything behind the pane — at 60 the page's own text splits into visible RGB copies — so raise it per surface. |
| `--slg-lens-reach` | a lens host | `6` (`18` on an aurora host) | how far the lens is allowed to bend. A pane shorter than six times this is refused the lens and keeps the material. |
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
