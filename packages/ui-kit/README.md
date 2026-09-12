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

**Fonts** (load separately, e.g. Google Fonts): Fraunces (display), Instrument Sans (body), Martian Mono (mono).

## Components (`components.css`)

Primitives: `.sl-eyebrow`, `.sl-tag` (`--plain`), `.sl-btn` (`--primary` / `--ghost` / `--sm`), `.sl-card` (`__title` / `__body`), `.sl-badge` (`--success` / `--warning` / `--danger` / `--info`), `.sl-field` (`__label` / `__input`), `.sl-kbd`, `.sl-code`, `.sl-link`, `.sl-rule` (`--labeled`).

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

**Inversion bands.** `--slc-border` defaults to an alpha-over-canvas value; inside a band whose background is the strongest neutral (`.invert`), that alpha sits on the wrong ground and the hairline disappears. Re-derive it at the band from the band's foreground — no new token:

```css
.invert { --slc-border: color-mix(in srgb, currentColor 22%, transparent); }
```

The full reference implementation — every component in all three themes — is `showcase/index.html` (§04).

## Effects (`effects.css` + `effects.js`, opt-in)

Five additive families, each carrying one meaning, composed onto a shipped `.sl-*` class — never replacing it. **Glass** (`sl-fx-glass`) — the element's own border as chrome; with `--pane`, the element is made of glass: a slab of light under the label, a glint that follows the pointer, a hairline that turns to face it with a fringe of colour either side. Every text button takes `--pane`, primary or ghost. **Aurora** (`sl-fx-aurora`) — a 1px arc of light riding the border while attention lives on the element: focus, `data-sl-fx-live="on"` (one ambient sweep per document), `data-sl-fx-live="busy"` (with `aria-busy`), or a determinate arc from an inline `--slfx-progress` (with `role="progressbar"`). **Liquid** (`sl-fx-liquid`) — the outline gives under the pointer and springs back; gated behind `--drop`, a round icon-only button and nothing else, and inert without it. **Goo** (`sl-fx-goo` on a container + `sl-fx-goo__member` on each element in the set — standard elements only; `button`, `input`, `select`, `textarea` and `a[href]` are refused) — several elements read as one substance, welding where they come within `--slfx-goo-weld` of one another; it answers the layout, not the pointer, and each member's silhouette is painted in that member's own fill so their colours blend across the neck. **Glitch** (`sl-fx-glitch`) — a finite burst on a child `<span>`, fired from JavaScript.

```css
@import "@sondalab/ui-kit/effects.css";   /* after components.css */
```

```js
import { mount, mountGpu, burst, scramble, grantLive } from "@sondalab/ui-kit/effects.js";
mount();                      // Tier 1: the liquid, the goo's fields, glitch bursts, the aurora's sweep. Explicit, never automatic.
// A product with a documented reason to animate for a visitor reporting
// prefers-reduced-motion takes the derogation explicitly. It reaches the
// GLITCH alone; high contrast still refuses.
// mount(document, { ignoreReducedMotion: true });
mountGpu().then((ok) => {});  // Tier 2: the glass edge as chrome where WebGPU answers; resolves false otherwise.
```

- **Tiers.** Without `mount()` the CSS alone is Tier 0 and correct on its own: a static glass hairline, a static aurora arc on focus, and a goo field's members simply laid out unmerged. `mount()` arms Tier 1 by setting `data-sl-fx="on"` on `<html>`. `mountGpu()` needs `vgpu` (an optional peer dependency — install it yourself if you want Tier 2; nothing breaks without it) and sets `data-sl-fx-gpu="on"` only once a frame is actually on screen.
- **Kill switches, all honoured at every tier:** `prefers-reduced-motion: reduce` (nothing animates; `mount()` refuses), `[data-sl-theme="high-contrast"]` (every family off, the GPU tier torn down), and `data-sl-fx="off"` on any element (that element and its subtree). The focus `outline` is never replaced or removed.
- **Replaced controls** (`<input>`, `<textarea>`, `<select>`) render no pseudo-element: wrap them in `<span class="sl-field__control sl-fx-…">` and put the effect classes on the wrapper.
- **Filled elements** (`sl-btn--primary`) take `sl-fx-aurora--rim`, which steps the arc just outside the fill — and tells a glass pane that its ground is the fill.

The reference page is `showcase/effects.html`; the contract is `docs/specs/2026-09-08-effects-layer-design.md`; the per-component declension (which family goes on which component, and which never do) is `agent/catalog.md` § Effects.

Generated tokens (`tokens.css`, `themes/*.css`) come from the canonical `sondalab.tokens.json` — do not hand-edit them. `components.css` is hand-authored.
