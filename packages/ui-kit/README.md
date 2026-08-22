# @sondalab/ui-kit

Sondalab design tokens as CSS custom properties (`--sl-*`). CSS-only: no components, no build step — import the stylesheets and theme via a `data-sl-theme` attribute.

```css
@import "@sondalab/ui-kit/tokens.css";        /* shared: type, spacing, radii, motion, shadow, z */
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

Generated from the canonical `sondalab.tokens.json` — do not hand-edit the CSS.
