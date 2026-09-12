# Sondalab logo assets

The Sondalab logo is **typographic** — no pictorial mark. These files are the
official marks with the letterforms converted to **outline paths**, so they
render identically anywhere without the fonts installed. Everything here is an
SVG except the avatars, which also ship as PNG because avatar uploads take a
bitmap.

| File | Form | Font (baked) |
|---|---|---|
| `sondalab-wordmark.svg` | primary — `sondalab.` | Fraunces, wght 500, opsz 144 |
| `sondalab-lockup.svg` | compact — `SONDA·LAB` | Martian Mono, wght 300 |
| `favicon.svg` | the mark — the amber dot alone | — |
| `app-icon.svg` | the mark on an ink tile (rounded) | — |
| `sondalab-avatar-ink.svg` / `.png` | monogram — `s.` on the ink tile | Fraunces, wght 500, opsz 144 |
| `sondalab-avatar-paper.svg` / `.png` | monogram — `s.` on the paper tile | Fraunces, wght 500, opsz 144 |

`favicon.svg` is the brand's accent dot (fixed `#F5A83C`) on transparent — the
tab/app icon. Wire it as `<link rel="icon" href="…/assets/favicon.svg">`.
(Claude Artifacts take an emoji favicon, not an SVG — use 🟠 there to match.)

`app-icon.svg` is the same dot on a rounded ink tile (`#0F151A`) — the maskable /
apple-touch icon where a bare transparent dot needs a shape and contrast.

`sondalab-avatar-*` are the social-profile avatars: the `s.` monogram in the
wordmark's own cut, on a full-bleed square tile (no corner radius — every
platform crops the corners away anyway). Ship the **PNG** — avatar uploads take
a bitmap; `1024×1024`, indexed palette, ~12 KB, and it downscales cleanly
to the 400 px and 32 px sizes the platforms actually serve. Use `ink` by
default; `paper` is for surfaces that are already dark.

Three deliberate deviations from plain type-setting, all driven by the crop and
the small end of the scale:

- the mark is sized to fit the **inscribed circle** (X, LinkedIn, Mastodon and
  Instagram all crop to it), not the square — so it spans ~60 % of the canvas
  wide by ~53 % tall. Only its bounding box's corners reach that arc; the `s.`
  itself never does, and that gap is the visual margin;
- the accent dot is scaled **+35 %** around its own centre. At 32 px a natural
  Fraunces period all but vanishes, and the dot *is* the mark (`favicon.svg` is
  the dot alone);
- the dot is pushed **+0.06 em** off the letter. The wordmark's `-0.05em`
  tracking is drawn for a period at its natural size; an enlarged one sitting at
  that tracking crowds the `s`.

## Colour

Applies to `sondalab-wordmark.svg` and `sondalab-lockup.svg`. The favicon, the
app icon and the avatars are fixed-palette by design — see their notes above.

- **Letters** use `fill="currentColor"` — inline the SVG and they inherit the
  surrounding text colour, so the mark adapts to light / dark automatically.
- **The dot** (trailing `.` / middle `·`) uses `fill="var(--sl-accent-default, #F5A83C)"`
  — inline with the token layer it takes the active theme accent; used as a
  plain `<img>` (where CSS variables don't apply) it falls back to the brand
  amber `#F5A83C`.

Inline for full theme-awareness:

```html
<span style="color: var(--sl-text-primary)">
  <!-- paste sondalab-wordmark.svg here, or load + inline it -->
</span>
```

As a static image (dot fixed to `#F5A83C`):

```html
<img src="@sondalab/ui-kit/assets/wordmark.svg" alt="Sondalab" height="28">
```

## Source of truth & regeneration

The visual reference is the identity board
(`https://claude.ai/code/artifact/abbebb7f-5778-4af6-a9b4-2b3f169ae20f`); the
type/colour spec lives in `sondalab-ui/docs/design-language.md` (L3 → Wordmark).

Avatar colours are literal hex, not tokens — a PNG cannot be theme-aware, and
the SVG is exported alongside it from the same source, so both stay in step.

The PNG step needs `rsvg-convert` (librsvg) and `magick` (ImageMagick) on PATH;
without them the script still writes the SVGs and skips the raster.

The paths were generated from the variable fonts (Fraunces, Martian Mono)
instanced at the weights above and shaped with HarfBuzz, then outlined with
fontTools. To regenerate after a brand-type change, re-run that outline step
against the updated axis values — do not hand-edit the path data.
