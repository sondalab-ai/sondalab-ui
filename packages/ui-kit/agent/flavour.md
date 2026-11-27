# Sondalab flavour contract

> **What this file is:** the short list of traits that make a surface read as Sondalab, used as a gate on design work. Before a pattern borrowed from an external reference lands, check it against this page: it may add to the traits below, never replace one, and never bring in an item from the do-not-converge list.
> **Authority:** `design-language.md` holds the rules; each line here cites its layer (L1–L6) or decision and does not restate it. Where this page and `design-language.md` disagree, `design-language.md` wins. Owner decisions not yet written into it are attributed to the owner and the date.

## 1 — The traits

| # | Trait | Source |
|---|---|---|
| 1 | The `sondalab.` wordmark in Fraunces (`--sl-font-brand`), with the trailing period in the accent. | L3 Wordmark |
| 2 | Mono uppercase micro labels (eyebrows, section indices), structure only, never on a control. | L1 micro labels, L3 Eyebrow |
| 3 | Geist and Geist Mono for the UI; Geist Pixel Square for display numerals, the lockup and one display word, at whole-cell sizes only. | L1 |
| 4 | 1px hairline structure, and the hairline grid (a 1px gap over the line colour). | L2 Hairline structure, Hairline grid |
| 5 | Depth as lightness: the tile, key and well (sunk) recipes, never a drop shadow as a separator. | L2 Depth is lightness |
| 6 | The inversion band, at least one per long page. | L3 Inversion band |
| 7 | The Bayer dither hover on the pixel cell. | L4 The hover is a dither wipe |
| 8 | Disabled is a checkerboard, not a dimming. | L6 Disabled is a checkerboard |
| 9 | Pixel check, radio and switch. | L4 Pixel controls |
| 10 | Four effect families (glitch, aurora, glass, goo), one meaning each. | L6 Four families |
| 11 | One accent per product, from the accent registry (`accent-registry.json`). | Decision 2 |
| 12 | Precise, technical voice: real figures and real output, never marketing. | L5 |

## 2 — The bezel card (ships as `sl-card--bezel`)

Chosen by the owner on 2026-11-27, it ships in `components.css` as `sl-card--bezel` on `sl-card`, with the elements `sl-card__stage` and `sl-card__caption`; `catalog.md` gives its markup. High contrast trades its hairlines for one solid 1px edge.

- **Frame and stage:** a frame on the surface rung holding a darker stage.
- **Concentric radii:** stage r6 (`--sl-radius-sm`) + inset 8 = frame r14 (`--sl-radius-lg`), all kit radii.
- **Edges:** drawn as alpha hairlines (lit top, faint ring, shaded bottom), with no CSS border.
- **Caption:** a caption row on the frame.

## 3 — Do not converge

Generic dev-tool traits the kit does not adopt, each with the rule it breaks.

| Trait | Rule it breaks |
|---|---|
| Pill-shaped chips and tags | L2 Radii: tags, badges and chips are r6. |
| Inter or any other non-Geist UI face | L1: five roles, fixed pairing. |
| Blur and soft colour glow as transition material | Owner decision, 2026-11-27: the dither dissolve replaces blur. (Blur as a standing material, as in L3's sticky header, is unchanged.) |
| Hover lifts | L2 Tile: hover never lifts; only selection lifts. |
| Page-load choreography in the kit | L4: no page-load choreography in the kit. |
| Figurative art | Owner ruling: no figurative art. |
