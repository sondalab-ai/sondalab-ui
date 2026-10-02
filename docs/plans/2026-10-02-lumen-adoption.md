# Lumen adoption plan

> **What this file is.** The slice list for moving the Sondalab kit, and then
> its products, to the Lumen direction. **Audience:** whoever implements or
> reviews a slice. **Owner:** Marcello Barile, who approved the plan on
> 2026-10-02. **Companion files:**
> - `lab/directions-2/lumen.html` describes the direction and its signature
>   details.
> - `lab/directions-2/dir-lumen.css` is the reference stylesheet. It is never
>   copied into `packages/`.
> - `showcase/screens.html` is the harness every slice is judged on.
>
> This file says what ships in which order. Each slice's pull request holds
> its details.

**Status terms.** *Delivered* means merged to `main` and published.
*In review* means a pull request is open. *Planned* means not started.

## Context

The owner rejected three serif and editorial directions as not bold or
premium enough, too print-like, wrong for a developer tool, and generic. From
the second round he picked **Lumen**:
- Geist and Geist Mono;
- neutrals tinted by each product's accent;
- panes as islands of light, with one lit pane;
- raised-tile selection, keycap shortcuts, sunken fields, a 2px foot under
  the primary button and a soft focus glow;
- a status dock and a toast stack.

The goal is a premium kit designed for developer tools first. It must ship
safely to spexr (a Theia-based integrated development environment, IDE),
sondalab-site, introspect and daos.

**Owner decisions (2026-10-02):**
- The focus glow stays: a 5px halo around the flush ring. It is off in high
  contrast and in forced colours.
- Fraunces is used only for the wordmark and the monogram. All other display
  type is Geist, including on the site and on daos.
- spexr keeps JetBrains Mono in its editor and terminal.

## Slices

Each slice is one pull request and one release. To roll a slice back, revert
it and publish the next patch.

| Slice | What | Release | Status |
|---|---|---|---|
| K0 | Ship the pending 0.28.0 | ui-kit 0.28.0 | Delivered (https://github.com/sondalab-ai/sondalab-ui/pull/65) |
| K1 | Screens harness (`showcase/screens.html`) and the committed Lumen reference | none | Delivered (https://github.com/sondalab-ai/sondalab-ui/pull/66) |
| K2 | Neutral ladder baked to hex, tinted per product (`themes/products.css`, `neutrals.json`) | ui-kit 0.29.0, palette-py 0.3.3 | Delivered (https://github.com/sondalab-ai/sondalab-ui/pull/67) |
| K3 | Geist and Geist Mono vendored in `fonts.css`; brand face for the wordmark; micro labels; sentence-case controls. Checkpoint A | ui-kit 0.30.0, palette-py 0.3.4 | In review (https://github.com/sondalab-ai/sondalab-ui/pull/68) |
| K4 | Depth recipes, new radii, two motion curves, tile selection, keycap `.sl-kbd`, tile tabs | minor | Planned |
| K5 | Controls: primary foot, raised ghost, sunken fields, check and switch, segmented, focus halo, `.sl-btn--danger`. Checkpoint B | minor | Planned |
| K6 | `workbench.css` (lit pane, status bar, activity bar, tree, palette, terminal block) and the toast stack. Checkpoint C | minor | Planned |
| K7 | Remove the old faces and the lab reference; final documentation | 1.0.0 | Planned |

The products follow each checkpoint, in this order: daos, then sondalab-site,
then introspect, then spexr.

## How every slice is checked

- `npm test` passes, and `npm run gen:tokens` leaves `packages/` unchanged.
- `sl-audit` reports no required findings over `showcase/*.html` with
  `--product default`.
- `showcase/screens.html` is checked in dark, light and high contrast, for
  amber, indigo (spexr) and cyan (introspect):
  - no console errors;
  - the in-page contrast and height report passes;
  - the slice looks visibly closer to the **Target: Lumen** overlay.
- An independent code review happens before merge, and the merge waits for
  green continuous integration (CI).
