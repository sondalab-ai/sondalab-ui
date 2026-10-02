# Fonts

The faces `tokens.css` names, vendored so a surface does not depend on a
third-party CDN and renders the same offline (an Electron shell, a preload
page). Consume them with `@sondalab/ui-kit/fonts.css`; it declares the faces
against these paths and nothing else.

| File | Family | Token | Axes | Version | Size |
|---|---|---|---|---|---|
| `geist-latin.woff2` | Geist | `--sl-font-sans`, `--sl-font-display` | `wght` 100–900 | 1.800 | 27 KB |
| `geist-mono-latin.woff2` | Geist Mono | `--sl-font-mono` | `wght` 100–900 | 1.701 | 22 KB |
| `fraunces-latin.woff2` | Fraunces | `--sl-font-brand` (wordmark, monogram) | `opsz` 9–144, `wght` 100–900 | 1.000 | 66 KB |
| `instrument-sans-latin.woff2` | Instrument Sans | none — **deprecated** | `wght` 400–700 | 1.000 | 29 KB |
| `martian-mono-latin.woff2` | Martian Mono | none — **deprecated** | `wght` 100–800 | 1.000 | 23 KB |

115 KB for the three the tokens name. They are **variable** fonts and the
**latin subset only**: one file per family covers every weight the kit uses. A
surface needing another subset fetches it itself. Upright only: the kit sets no
italic, so none is shipped.

**Deprecated (0.30):** Instrument Sans and Martian Mono were the sans and mono
roles until 0.29. No token names them now; they are still declared in
`fonts.css` and still shipped for one release window, so a product that names
them by hand keeps rendering while it moves to the tokens. They are removed in
1.0.0. (`sondalab-lockup.svg` is still cut from Martian Mono, as outlines; it
needs no font file.)

## Sources and licences

All five are licensed under the **SIL Open Font License 1.1** — `OFL-*.txt`
beside them, copied verbatim from `github.com/google/fonts`. The OFL requires
the licence to travel with the files, which is what those copies are for.
None of the five licences declares a Reserved Font Name, so a subset (a
Modified Version under the OFL) may keep its family name.

- **Geist** — `google/fonts` `ofl/geist/Geist[wght].ttf` at commit
  `718e1db4deb9e4d9d85a0ead1b9f5fde2761ccfd` (2026-04-27), font version 1.800;
  upstream `vercel/geist-font` commit `a6d260e6cbc07eafdfad438f33601fe3c38b1e6f`.
  Licence `OFL-Geist.txt` (Copyright 2024 The Geist Project Authors).
- **Geist Mono** — `google/fonts` `ofl/geistmono/GeistMono[wght].ttf` at commit
  `9e25e2ba265e5298f70f6182dd4e8a3ebf1b9123` (2026-05-20), font version 1.701;
  upstream `vercel/geist-font` commit `77f0563c03009d6c15c6342183fa53b352255b22`.
  Licence `OFL-GeistMono.txt` (the same text as Geist's).
- **Fraunces**, **Instrument Sans**, **Martian Mono** — the Google Fonts latin
  subsets, vendored on 2026-09-11; licences `OFL-Fraunces.txt`,
  `OFL-InstrumentSans.txt`, `OFL-MartianMono.txt`.

The two Geist files were cut with fontTools 4.60.2 (`pyftsubset`, brotli
1.2.0) to the same `unicode-range` `fonts.css` gives every face, keeping the
default layout features plus tabular and proportional figures and
case-sensitive forms, every name record, and no hinting (the other three ship
unhinted too):

```sh
pyftsubset "Geist[wght].ttf" \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --layout-features+=tnum,pnum,case --name-IDs='*' --no-hinting \
  --flavor=woff2 --output-file=geist-latin.woff2
# the same for "GeistMono[wght].ttf" -> geist-mono-latin.woff2
```

`scripts/font-coverage.test.mjs` fails if a `--sl-font-*` token's first family
has no `@font-face` in `fonts.css`, if a face's file is missing or not in the
package's `files`, or if its licence does not travel with it.
