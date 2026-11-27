# Sondalab DESIGN.md

> **What this file is:** the Sondalab design system in one file for design agents: each token with its rule and the reason for it, so a new surface is on-system from its first line.
> **Generated** by `scripts/gen-design-md.mjs` from `sondalab.tokens.json`, `neutrals.json`, `agent/accent-registry.json`, `design-language.md` and `agent/flavour.md`. Do not edit it by hand; run `npm run gen:design-md`.
> **Authority:** `design-language.md` holds the full rules; L1 to L6 and Decision 2 name its sections.

## 1. Brand and voice

Sondalab is a family of developer tools that read as one suite. The look is editorial modernism for an IDE: hairline structure, mono micro labels, oversized display type, inversion bands and real content over marketing copy. Products share the whole grammar and differ only in their accent hue.

The grammar fixes the materials (type roles, spacing scale, rule weight, motifs, motion, voice); surprise is spent on composition, with at least one intentional layout decision per screen. Why: family resemblance comes from the shared materials, distinctiveness from each screen's composition.

Voice:

- **Precise and technical, never marketing.** Name things by what they are and do; prefer a real measured figure or executed output to an adjective. Why: these are tools, and real output is the proof.
- **Active voice; controls state their effect.** A button says what happens; its confirmation says it happened. Why: the label is the contract for the action.
- **Controls speak in sentence case.** Write "Run checks" in the markup; nothing upper-cases a label for you. Why: uppercase belongs to micro labels, which name structure.
- **Structure encodes truth.** Numbered markers, eyebrows and dividers appear only where they reflect a real sequence or classification. Why: decoration dressed as structure misleads the reader.
- **Real content.** Where a surface shows output (JSON, a terminal, code, data rows), show actual content in mono, not illustrative filler. Why: it is both the voice and the look.
- **English** for product copy and all identifiers. Why: it matches the suite.

## 2. Colour

Roles are `--sl-*` custom properties set per theme by `data-sl-theme` on the root (light, dark or high-contrast). The light and dark neutrals below are the default product's, from `neutrals.json`; every other product's are generated from the same ladder tinted with its accent hue (`themes/products.css` under `data-sl-product`, or `neutrals.json` for a hex-only consumer). High contrast keeps its literal values. Why: one temperature per product, and a neutral copied by hand drifts.

### Colour roles

| Role | Light | Dark | High contrast | Purpose |
| --- | --- | --- | --- | --- |
| `--sl-bg-canvas` | `#eae6e2` | `#0a0806` | `#000000` | The page ground: the farthest rung, so everything nearer is lighter. |
| `--sl-bg-surface` | `#fcfaf9` | `#13110e` | `#000000` | Panes, cards and chrome on the canvas. |
| `--sl-bg-surface-raised` | `#ffffff` | `#1c1915` | `#0a0a0a` | A raised key, an overlay, a lit pane. |
| `--sl-bg-tile` | `#ffffff` | `#26221e` | `#0a0a0a` | A raised selection (the tile recipe). |
| `--sl-bg-sunken` | `#f9f6f4` | `#0e0c09` | `#000000` | A field's fill and a control's track (the sunk recipe). |
| `--sl-bg-overlay` | `rgba(25,21,17,0.4)` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.85)` | The scrim behind a modal overlay. |
| `--sl-text-primary` | `#191511` | `#eeeae7` | `#ffffff` | Body text and headings; the borders are this ink at an alpha. |
| `--sl-text-secondary` | `#47413c` | `#bebab5` | `#ffffff` | Supporting text and an icon button's glyph. |
| `--sl-text-muted` | `#605953` | `#9f9a95` | `#cccccc` | Meta, micro labels and captions. |
| `--sl-text-on-accent` | `oklch(from var(--sl-accent-default) var(--_sl-on))` | `#0A0A0B` | `#000000` | The label on an accent fill. |
| `--sl-border-subtle` | `rgba(25,21,17,0.08)` | `rgba(238,234,231,0.065)` | `#ffffff` | The quietest hairline. |
| `--sl-border-default` | `rgba(25,21,17,0.14)` | `rgba(238,234,231,0.11)` | `#ffffff` | The structural 1px hairline. |
| `--sl-border-strong` | `rgba(25,21,17,0.28)` | `rgba(238,234,231,0.28)` | `#ffff00` | A strong edge where a hairline would not read. |
| `--sl-border-lit` | `rgba(255,255,255,0.9)` | `rgba(255,255,255,0.07)` | `#ffffff` | The lit top line of a tile, key or island. |
| `--sl-accent-default` | `#FF9F1C` | `#F5A83C` | `#ffff00` | The product accent: primary fill, focus ring, links, tags, the seam. |
| `--sl-status-success` | `#4a6205` | `#98b958` | `#00ff00` | Success, on the canvas; never a second accent. |
| `--sl-status-warning` | `#795305` | `#db9e2e` | `#ffaa00` | Warning, on the canvas; never a second accent. |
| `--sl-status-danger` | `#a72b05` | `#fe8263` | `#ff5555` | Danger and errors, on the canvas; never a second accent. |
| `--sl-status-info` | `#3853af` | `#87a7fd` | `#00ffff` | Information, on the canvas; never a second accent. |

- **Depth is lightness.** What is nearer the viewer is lighter: canvas, then surface, then raised, then tile. Why: depth reads without lines or drop shadows.
- **One accent per product.** A product picks one accent hue and derives hover, active and subtle from it; it never adds a second chromatic accent. Why: the accent is the product's identity and the carrier of selection and focus.
- **Fill and text are one accent, two readings.** `--slc-accent` is what a control fills with; `--slc-accent-text` is the same hue capped in lightness for text and thin lines, and `--sl-text-on-accent` is the label on the fill. Why: an accent bright enough to fill can be too light to read as text.
- **Status is not the accent.** `--sl-status-*` are shared across products and tuned for the canvas; on an inverted surface derive an on-ink pair locally. Why: the canvas inks lose contrast on ink.
- **No free colour value.** Every colour resolves to a token, a registry accent or the product's generated neutral, and neutrals are never hand-tuned. Why: value equality is the invariant `sl-audit` checks.
- **Viz, code and spectrum palettes are not accents** (`--sl-viz-*`, `--sl-code-*`, `--sl-spectrum-*`). They never track the product hue and never carry state. Why: a series colour must not read as selection or focus.

### Accent registry

One accent per product, from `agent/accent-registry.json`; the default's comes from `sondalab.tokens.json`. A product other than the default loads `themes/products.css` and sets `data-sl-product="<id>"` beside `data-sl-theme`, so its neutrals take its hue. Changing an accent re-tints the product's neutrals, so it is a token change.

| Product | Light | Dark | Note |
| --- | --- | --- | --- |
| `default` | `#FF9F1C` | `#F5A83C` | depth `#14606C` / `#35A0B4` |
| `daos` | `#FF9F1C` | `#F5A83C` | inherits `default` |
| `spexr` | `#5b6cff` | `#8b96ff` | labelled fill `#4c58e9` / `#4c58e9` |
| `introspect` | `#0e9c84` | `#2ee6c0` | — |
| `roboemot` | `#f726b4` | `#ff48c4` | — |
| `local-agents` | `#1d63d8` | `#58a6ff` | — |

## 3. Typography

Five font roles with a fixed pairing. The kit ships the faces in `fonts.css`.

| Role | Stack | Use |
| --- | --- | --- |
| `--sl-font-display` | `"Geist", system-ui, -apple-system, "Segoe UI", sans-serif` | Headings and the oversized anchor, semibold with negative tracking. |
| `--sl-font-sans` | `"Geist", system-ui, -apple-system, "Segoe UI", sans-serif` | Body, controls and the labels read with a control. |
| `--sl-font-mono` | `"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace` | Identifiers, figures, tags, chips, counts, meta and micro labels. |
| `--sl-font-brand` | `"Fraunces", Georgia, serif` | The wordmark and the monogram, nothing else. |
| `--sl-font-pixel` | `"Geist Pixel Square", "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace` | Display numerals, the lockup and one display word, at the `--sl-text-px-*` sizes only. |

Type scale:

| Token | Value |
| --- | --- |
| `--sl-text-micro` | `0.65625rem` |
| `--sl-text-xs` | `0.75rem` |
| `--sl-text-sm` | `0.875rem` |
| `--sl-text-md` | `1rem` |
| `--sl-text-lg` | `1.125rem` |
| `--sl-text-xl` | `1.5rem` |
| `--sl-text-2xl` | `2rem` |
| `--sl-text-3xl` | `2.75rem` |
| `--sl-text-display` | `clamp(3.5rem, 2rem + 5vw, 6rem)` |
| `--sl-text-px-1` | `12.5px` |
| `--sl-text-px-2` | `25px` |
| `--sl-text-px-3` | `37.5px` |
| `--sl-text-px-4` | `50px` |

Line heights:

| Token | Value |
| --- | --- |
| `--sl-line-tight` | `1.2` |
| `--sl-line-normal` | `1.5` |
| `--sl-line-relaxed` | `1.6` |
| `--sl-line-loose` | `1.7` |

- **Five roles, fixed pairing.** UI text is `--sl-font-sans`, headings `--sl-font-display`, identifiers and figures `--sl-font-mono`, the wordmark `--sl-font-brand`, the display accent `--sl-font-pixel`. There is no serif anywhere in the UI; a heading or numeral in the brand face is a defect. Why: the pairing is a family signal.
- **Micro labels are mono, uppercase, lightly tracked, and only micro labels.** Eyebrows, section indices, stat labels and captions take `--sl-font-mono` at `--sl-text-micro`, uppercase, in the muted ink; uppercase anywhere else is a defect. Why: a micro label names a region, never an action.
- **Headings** take `--sl-font-display`, semibold, `--sl-line-tight`, balanced, with negative tracking that tightens as the size grows. Why: tight display type carries the editorial look.
- **Oversized display is structure, used sparingly:** at most one fluid anchor per screen, set solid. Why: an anchor only anchors when it is alone.
- **The pixel face only at whole cells.** `--sl-font-pixel` is set at `--sl-text-px-1` to `--sl-text-px-4` only, untracked, never uppercase; a figure that changes in place keeps `--sl-font-mono`. Why: any other size smears its pixel cells, and the face is proportional with no tabular figures.
- **Body measure.** Running text is capped by `--sl-measure`, a local convention, and never runs full-bleed. Why: long lines are hard to read.

## 4. Spacing, radii and control height

Space scale:

| Token | Value |
| --- | --- |
| `--sl-space-0` | `0` |
| `--sl-space-1` | `0.25rem` |
| `--sl-space-2` | `0.5rem` |
| `--sl-space-3` | `0.75rem` |
| `--sl-space-4` | `1rem` |
| `--sl-space-5` | `1.5rem` |
| `--sl-space-6` | `2rem` |
| `--sl-space-8` | `3rem` |

Radii:

| Token | Value | Use |
| --- | --- | --- |
| `--sl-radius-sm` | `6px` | Rows, tiles, small chrome, tags, badges and chips. |
| `--sl-radius-md` | `8px` | Controls, fields and callouts. |
| `--sl-radius-lg` | `14px` | Cards, dialogs and overlays. |
| `--sl-radius-pane` | `10px` | An island pane. |
| `--sl-radius-pill` | `9999px` | A fully rounded end; never a tag or a chip. |

- **One control height.** Button, field, select, segmented control and icon button are all `32px`, each summing a fixed line, padding and a 1px edge; a product that needs a taller control scales the row, not one member of it. Why: controls that share a row share a height, so a field and its submit button align.
- **Spacing off the scale.** Every gap and padding steps off `--sl-space-*`; no arbitrary values in new work. Why: one rhythm across products.
- **Radii are shape.** Controls, fields and callouts are `--sl-radius-md`, cards and dialogs `--sl-radius-lg`, tags, badges and chips `--sl-radius-sm`. Why: one corner per kind of part.
- **Hairline structure.** Structural separation is a single 1px rule in the theme's line colour; no heavy borders, no drop shadow as a separator. Why: casts are reserved for what is lifted or floating.
- **Hairline grid.** Card grids are a 1px `gap` over the line colour, each cell painting its own surface. Why: crisp shared rules instead of doubled borders.
- **Sections lead with an index.** A section opens with a mono index label beside its heading and a 1px top rule. Why: the index is real structure, numbered only for a real sequence.

## 5. Depth recipes

Depth is lightness, not lines: canvas, surface, raised and tile are the rungs of the neutral ladder. Seven recipes spend them as role-vars in `components.css` (`--slc-depth-*`), so no product re-derives a shadow.

- **Tile** — a selection lifted out of its pane: the tile fill (`--sl-bg-tile`), a lit top hairline (`--sl-border-lit`), a 1px ring and a short cast. Hover never lifts; only selection lifts, and a selected tile carries the seam. Why: the tile is depth, not a state cue, so the seam carries the state.
- **Flat tile** — a tile that does not leave its row: lit and ringed, no cast (an active tile tab). Why: it marks selection without lifting out of a strip.
- **Island** — a pane on a darker frame: lit, with the quieter ring (`.sl-pane`); the pane that holds the focus is lit, with no accent rim. Why: the focused pane is the bright one at a glance.
- **Key** — a keycap: a fill that steps from raised to surface, a ring, a lit top line and a base of its own fill in shade. Why: every shortcut reads as a physical key.
- **Sunk** — a well, an inset cast on the sunken rung: a field, a select, a textarea, the switch and segmented tracks. Why: what you type into sits below the surface.
- **Float** — an overlay: three layers of cast under the overlay's own border in shade, which is the ring (a dialog). Why: a floating surface carries its own edge.
- **Cast** — an overlay that keeps no border (the palette, the toast): the float with the ring folded in, lit along its top (`--slc-depth-cast`). Why: a borderless overlay still needs an edge in shade.

A host that wears a recipe carries no border of its own, so the lit line sits flush under the ring. Shadows are black at each theme's alpha (`--sl-shadow-sm`, `--sl-shadow-md`, `--sl-shadow-lg`, `--sl-shadow-inset`). High contrast trades every recipe for a drawn ring; a theme that turns a recipe off sets an empty shadow (`0 0 transparent`), never `none`, which would void the box-shadow list. Why: keys stand, tiles lift, wells sink, focus glows, one physical vocabulary across the kit.

## 6. Signature components

These recurring parts carry the family look. A surface need not use all of them, but any it uses matches.

- **Wordmark** — the brand is typographic, with no pictorial mark: `sondalab.` in `--sl-font-brand` with the trailing period in the accent. The compact lockup is `sonda/lab`, lowercase, in `--sl-font-pixel` at `--sl-text-px-1`, untracked, with the `/` in the accent ink (`.sl-lockup`). Why: the brand face is the wordmark's and the monogram's alone, so a wordmark in the display role is a defect.
- **Eyebrow** — the micro label above a heading: `--sl-font-mono`, uppercase, `--sl-text-micro`, medium weight, lightly tracked, in the muted ink. Why: it is the strongest family signal, and it names structure only.
- **Tag** — an inline mono mark at `--sl-radius-sm`, in sentence case: a 1px border in a soft accent tint, a small dot before the label, accent text. Why: mono because it carries an identifier, sentence case because it is read, not shouted.
- **Inversion band** — a full-width block flipped to the strongest neutral (ink ground, paper text) that punctuates the rhythm and marks the thesis or the primary call to action; at least one per long page (`.sl-invert`). A control in a band rests on the band's own hairline and takes the band's control edge on hover. Why: the recurring inversion is a core motif.
- **Keycap** — every shortcut is a small physical key, `.sl-kbd`, in `--sl-font-mono`, one cap per key, wearing the key recipe. Inside a button it is a child `<kbd class="sl-kbd" aria-hidden="true">` and the button names the shortcut with `aria-keyshortcuts`. Why: `::after` belongs to glass, and the cap never reads weaker than the label beside it.
- **Tile** — selection is a raised tile plus a seam: a short line inside its leading edge, or above its bottom edge in a tab or a segment, in the accent while its container holds the focus and in the muted ink otherwise. Why: the tile alone barely separates from its ground, and the seam carries the state at 3:1.
- **Bezel card** — chosen, not yet shipped: it is not in `components.css` or `catalog.md`, so until it ships the shipped card is the one to use.
  - **Frame and stage:** a frame on the surface rung holding a darker stage.
  - **Concentric radii:** stage r6 (`--sl-radius-sm`) + inset 8 = frame r14 (`--sl-radius-lg`), all kit radii.
  - **Edges:** drawn as alpha hairlines (lit top, faint ring, shaded bottom), with no CSS border.
  - **Caption:** a caption row on the frame.

## 7. Motion

| Token | Value | Use |
| --- | --- | --- |
| `--sl-motion-fast` | `120ms` | Short state changes; reduced motion zeroes it. |
| `--sl-motion-mid` | `220ms` | Entrance reveals and most transitions; reduced motion zeroes it. |
| `--sl-motion-slow` | `360ms` | Longer entrances; reduced motion zeroes it. |
| `--sl-motion-ease` | `cubic-bezier(0.25, 1, 0.5, 1)` | Every state change. |
| `--sl-motion-enter` | `cubic-bezier(0.22, 1, 0.36, 1)` | What arrives (a dialog, a tooltip, a toast): moves at once, settles long. |
| `--sl-motion-dither-in` | `260ms` | The hover dither wipe filling a control. |
| `--sl-motion-dither-out` | `320ms` | The hover dither wipe draining from a control. |
| `--sl-motion-check` | `180ms` | The pixel check's fill and tick. |
| `--sl-motion-radio` | `150ms` | The pixel radio's dot. |
| `--sl-motion-switch` | `260ms` | The pixel switch's knob and fill, which end together. |
| `--sl-motion-spring` | `linear(0, 0.024, 0.087, 0.174, 0.275, 0.382, 0.488, 0.588, 0.68, 0.761, 0.831, 0.89, 0.937, 0.975, 1.003, 1.023, 1.037, 1.045, 1.049, 1.05, 1.048, 1.044, 1.04, 1.035, 1.029, 1.024, 1.019, 1.015, 1.011, 1.007, 1.005, 1.003, 1)` | A control returning from a press: one small overshoot, transforms only. |

- **Durations come from the tokens, never a literal.** Why: reduced motion zeroes the duration tokens, which stops everything at once.
- **Respect reduced motion.** Under `prefers-reduced-motion: reduce` nothing animates; never add motion that bypasses the tokens. The dither wipe and the pixel-control frames are never armed there, so their durations are not zeroed. Why: motion must stay optional.
- **No page-load choreography in the kit.** The kit animates what arrives, never the page itself; a page that wants an entrance stagger owns it, on the motion tokens. Why: the page is content, not a show.
- **Stagger related entrances** rather than fading the whole screen at once. Why: a stagger shows order, a whole-screen fade shows nothing.
- **Entrances rise a little.** A small rise plus opacity on `--sl-motion-mid` or `--sl-motion-slow`, as transitions, never keyframes. Why: a browser without `@starting-style` simply shows the element.
- **The hover is a dither wipe.** On a button or icon button the pointer's answer is a fill that grows through an 8x8 Bayer threshold on the kit's pixel cell from where the pointer entered and drains toward where it left, clipped to the control's radius; once half the control is covered its label flips to the on-fill pole. Why: the pixel cell is the kit's unit, and the silhouette stays smooth.
- **Controls give under the finger.** Held, a text button sinks a little and returns on `--sl-motion-spring`; tabs, rows, fields and cards do not move. Transitions only. Why: a keyframe would also play when a page loads with a box already checked.
- **Pixel controls.** The check, radio and switch draw their final frames in CSS on the pixel lattice; the motion (`--sl-motion-check`, `--sl-motion-radio`, `--sl-motion-switch`) only plays the way there. Why: with reduced motion, high contrast or no script they show the same shapes.

## 8. Effect families

Effects are an opt-in import (`effects.css`, plus `effects.js`). Classes are additive (`.sl-fx-*` on a shipped `.sl-*` class), and every hue is derived from a role-var, never a literal.

- **Glitch** means *something re-resolved*: a value changes, a destructive action is confirmed, validation fails. It is never ambient on a control.
- **Aurora** means *attention lives here*: focus, an active tab, a running operation, the primary call to action. It is a 1px arc of light on an edge that already exists, and it renders state without being the state (`aria-busy`, `role="progressbar"`).
- **Glass** means *this is a physical surface*, a state rather than an event: a card edge, a field, a keycap. It is chrome on the element's own border and never animates on its own.
- **Goo** means *these belong to one another*: it marks a set and answers the layout, not the pointer. A form control or a link is never a member.

- **One meaning each.** A family never fires outside the meaning it owns, and an effect that means nothing is switched off. Why: structure encodes truth, in motion too.
- **The effect budget.** At most one ambient aurora and one glitch burst per document at a time; busy auroras are exempt. Why: two competing lights mean nothing.
- **Three kill switches.** `prefers-reduced-motion: reduce`, `[data-sl-theme="high-contrast"]` and `data-sl-fx="off"` on any element; no effect replaces or removes the focus outline. Why: an effect is decoration on top of the state.
- **Disabled is a checkerboard, not a dimming.** A disabled control is greyed by a checker of 1px cells drawn as a `mask-image` on the control itself. Why: the control stays legible as a shape and plainly unavailable.
- **Light and shape, never weight.** An effect is a pixel or two wide and fades within a few tens of pixels; a separator stays 1px whatever an effect does, and no effect rewrites a declared value. Why: the surface under an effect stays free to set its own radius and edges.

## 9. Do and do not

From `agent/flavour.md`. A pattern borrowed from an external reference may add to the do list; it never replaces an item of it and never brings in an item of the do-not list.

### Do

- The `sondalab.` wordmark in Fraunces (`--sl-font-brand`), with the trailing period in the accent. See L3 Wordmark.
- Mono uppercase micro labels (eyebrows, section indices), structure only, never on a control. See L1 micro labels, L3 Eyebrow.
- Geist and Geist Mono for the UI; Geist Pixel Square for display numerals, the lockup and one display word, at whole-cell sizes only. See L1.
- 1px hairline structure, and the hairline grid (a 1px gap over the line colour). See L2 Hairline structure, Hairline grid.
- Depth as lightness: the tile, key and well (sunk) recipes, never a drop shadow as a separator. See L2 Depth is lightness.
- The inversion band, at least one per long page. See L3 Inversion band.
- The Bayer dither hover on the pixel cell. See L4 The hover is a dither wipe.
- Disabled is a checkerboard, not a dimming. See L6 Disabled is a checkerboard.
- Pixel check, radio and switch. See L4 Pixel controls.
- Four effect families (glitch, aurora, glass, goo), one meaning each. See L6 Four families.
- One accent per product, from the accent registry (`accent-registry.json`). See Decision 2.
- Precise, technical voice: real figures and real output, never marketing. See L5.

### Do not

- **Pill-shaped chips and tags.** L2 Radii: tags, badges and chips are r6.
- **Inter or any other non-Geist UI face.** L1: five roles, fixed pairing.
- **Blur and soft colour glow as transition material.** The dither dissolve replaces blur. (Blur as a standing material, as in L3's sticky header, is unchanged.)
- **Hover lifts.** L2 Tile: hover never lifts; only selection lifts.
- **Page-load choreography in the kit.** L4: no page-load choreography in the kit.
- **Figurative art.** The brand is typographic, with no pictorial mark.
