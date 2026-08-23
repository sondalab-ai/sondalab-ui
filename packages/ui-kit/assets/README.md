# Sondalab logo assets

The Sondalab logo is **typographic** — no pictorial mark. These SVGs are the
official wordmark with the letterforms converted to **outline paths**, so they
render identically anywhere without the fonts installed.

| File | Form | Font (baked) |
|---|---|---|
| `sondalab-wordmark.svg` | primary — `sondalab.` | Fraunces, wght 500, opsz 144 |
| `sondalab-lockup.svg` | compact — `SONDA·LAB` | Martian Mono, wght 300 |
| `favicon.svg` | the mark — the amber dot alone | — |

`favicon.svg` is the brand's accent dot (fixed `#F5A83C`) on transparent — the
tab/app icon. Wire it as `<link rel="icon" href="…/assets/favicon.svg">`.
(Claude Artifacts take an emoji favicon, not an SVG — use 🟠 there to match.)

## Colour

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

The paths were generated from the variable fonts (Fraunces, Martian Mono)
instanced at the weights above and shaped with HarfBuzz, then outlined with
fontTools. To regenerate after a brand-type change, re-run that outline step
against the updated axis values — do not hand-edit the path data.
