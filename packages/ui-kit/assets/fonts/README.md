# Fonts

The three faces `tokens.css` names, vendored so a surface does not depend on a
third-party CDN — and so the effects layer's lens can inline them into its plate,
which is the reason they are here at all: a page cannot read `@font-face` rules
from a cross-origin stylesheet, so a lens that clones the document renders every
string in a fallback face and crops the wrong content.

| File | Family | Token | Axes | Size |
|---|---|---|---|---|
| `fraunces-latin.woff2` | Fraunces | `--sl-font-display` | `opsz` 9–144, `wght` 100–900 | 66 KB |
| `instrument-sans-latin.woff2` | Instrument Sans | `--sl-font-sans` | `wght` 400–700 | 29 KB |
| `martian-mono-latin.woff2` | Martian Mono | `--sl-font-mono` | `wght` 100–800 | 23 KB |

118 KB for all three. They are **variable** fonts and the **latin subset only**:
one file per family covers every weight the kit uses, which is why nine faces
cost three files. A surface needing another subset fetches it itself.

Licensed under the SIL Open Font License 1.1 — `OFL-*.txt` beside them, taken
from `github.com/google/fonts`. The OFL requires the licence to travel with the
files, which is what those three copies are for.

Consume them with `@sondalab/ui-kit/fonts.css`; it declares the faces against
these paths and nothing else.
