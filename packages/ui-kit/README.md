# @sondalab/ui-kit

Sondalab design tokens as CSS custom properties (`--sl-*`), a CSS-only component layer (`.sl-*`), and an opt-in effects layer (`.sl-fx-*`). No build step; the tokens and components need no runtime JS — import the stylesheets and theme via a `data-sl-theme` attribute. The effects layer ships a small JavaScript driver you call explicitly (see below).

```css
@import "@sondalab/ui-kit/tokens.css";        /* shared: type, spacing, radii, motion, shadow, z */
@import "@sondalab/ui-kit/components.css";     /* .sl-* components (reads role-vars, see below) */
@import "@sondalab/ui-kit/workbench.css";      /* optional: IDE and console chrome, see 0.33 below */
@import "@sondalab/ui-kit/themes/light.css";  /* [data-sl-theme="light"]  surfaces, text, borders, status, accent */
@import "@sondalab/ui-kit/themes/dark.css";
@import "@sondalab/ui-kit/themes/high-contrast.css";
@import "@sondalab/ui-kit/themes/products.css";  /* optional: per-product neutrals, see 0.29 below */
@import "@sondalab/ui-kit/fonts.css";          /* optional: the faces, served from the package, see Fonts below */
```

```html
<html data-sl-theme="dark"> … </html>
```

**Per-product accent.** The bundled accent is the Sondalab default (amber `--sl-accent-default`, teal `--sl-accent-depth`). A product keeps its own signature by overriding the accent tokens after the import:

```css
[data-sl-theme="dark"]  { --sl-accent-default: #2ee6c0; --sl-focus-ring: #2ee6c0; }
[data-sl-theme="light"] { --sl-accent-default: #0e9c84; --sl-focus-ring: #0e9c84; }
```

**Light theme: Prism (0.21).** The light theme's ground was a cool near-white (`#F4F4F8`) until 0.29, when the neutrals became tinted per product (below). It also declares a six-hue spectrum (`--sl-spectrum-0..5`, and a darkened ink set `--sl-spectrum-ink-0..4` for anything seen as text or a dot). The spectrum is not an accent: it is the same in every product and never marks state. Dark and high-contrast reset it to `initial`.

**0.35.0 — Lumen parity: colour.** The light ink, the syntax palette, the hairlines and the accent fill now match the Lumen target (owner's Lumen parity plan, slice K9). No token or role is added, renamed or removed: values change, `neutrals.json` gains keys, and `themes/products.css` gains one declaration per registered fill. palette-py 0.3.8 ships alongside; its output is unchanged.

- **Light primary text is oklch L 0.20 (was 0.23), on every product.**
  - The default and daos go from `#201c18` to `#191511`, spexr from `#1b1d22` to `#14161b`, introspect from `#181f1d` to `#111816`, and local-agents from `#1a1d22` to `#13161b`.
  - The light borders and the light overlay are cast in the product's ink, so they take the new ink.
  - The worst primary text on a light ground goes from 13.62:1 to 14.62:1. Secondary, muted and code text are unchanged.
  - The glass glint mirrors a dark ink's lightness about 1.17 (it was 1.2), so on paper it stays at L 0.97. This applies to `--slfx-glint`, `--slfx-veil` and `--slfx-press-light` in `effects.css`, and `--slg-pole` in `glass.css`. The generator fails the build if the glint leaves sRGB, and a test holds the four expressions to the generator's number.
  - The veil over a paper glass pane is slightly more opaque: alpha 0.894, was 0.86.
- **The syntax palette is the Lumen target's.** Before → after:

  | Role | Light | Dark |
  |---|---|---|
  | keyword | `#4460b6` → `#5847b7` | `#87a7fd` → `#a9b0fd` |
  | string | `#536d0b` → `#316a23` | `#99b860` → `#9ccf7f` |
  | function | `#1f6a96` → `#006191` | `#6db3e4` → `#75caf2` |
  | number, boolean | `#aa442b` → `#b13e06` | `#f5886c` → `#fd9976` |
  | builtin | `#865d06` → `#865900` | `#d4a14a` → `#e5bf6d` |
  | tag | `#b33c1e` → `#5847b7` | `#fe8263` → `#a9b0fd` |

  - `tag` now reads as `keyword`: the target has no tag colour, and atom-one's tag sat within OKLab ΔE 1.5 of the new `number` on paper. The palette is five hues. `fg` and `comment` are unchanged.
  - The hues are authored as oklch in `sondalab.tokens.json` and baked to hex by the generator, the same for every product.
  - Two are outside sRGB: light `function`, oklch(0.47 0.12 240), and light `builtin`, oklch(0.5 0.11 75). Each keeps its lightness and hue and gives up chroma (0.1077 and 0.1055), never a per-channel clip. The target, clipped by Chrome, paints `#006197` and `#875800`.
  - `boolean` is now an alias of `number`, and `tag` of `keyword`.
  - Every role reads at 4.5:1 or more (comment and null 3:1) on every product's canvas, surface, raised, tile and sunken grounds, and in an editor: on raised under the current line (the primary ink at 4.5%) and under the selection (the product's accent at 18%). The tightest is light `number` at 4.54:1, on local-agents' selection.
- **`neutrals.json` carries the whole syntax palette.** `products.<id>.<light|dark>` now holds `code-keyword`, `code-string`, `code-number`, `code-boolean`, `code-function`, `code-tag` and `code-builtin` beside `code-fg`, `code-comment` and `code-null`. An editor or terminal theme can be built without reading CSS.
- **Hairlines are the Lumen target's, in the product's own ink.**
  - `--sl-border-subtle` goes from 0.09 to 0.08 on light and from 0.07 to 0.065 on dark.
  - `--sl-border-default` goes from 0.16 to 0.14 on light and from 0.13 to 0.11 on dark.
  - `--sl-border-strong` is unchanged.
  - Dividers, table rows, rules, the island and tile rings, figure and avatar borders and the tab list's baseline are a little fainter. For example, a solid `border-default` over spexr's surface is `#dadbdd` on light (was `#d6d7da`) and `#28292c` on dark (was `#2c2d30`).
  - No boundary that must read at 3:1 is drawn in these roles. Controls are outlined in `--slc-edge-control`, and a glass control's edge is that edge too.
  - The one interactive line drawn in `--slc-border-subtle` is a resizer at rest: 1.11–1.18:1, was 1.13–1.20. It has never been a 3:1 boundary. Hovered, pressed or focused it turns to the accent text.
- **The registered fill is generated.** `themes/products.css` now sets `--slc-accent-fill` from the registry's `fill` on each product's light and dark blocks; today that is spexr, `#4c58e9` on both themes. `neutrals.json` exports it as `products.<id>.fill.<light|dark>`, and a product with no fill has no `fill` key.
  - **Migration (spexr):** delete `--slc-accent-fill: #4c58e9` from `spexr-overrides.css`. The fill arrives with `data-sl-product="spexr"` on the theme element and `products.css` loaded, which spexr already has.
    - spexr's `theia-chrome-css.test.ts` ("Theia's labelled fills") asserts that literal in `spexr-overrides.css`. Update that test in the same change, to read the fill from `neutrals.json` or the registry.
    - Until the literal goes, it wins. `:root:not([data-sl-theme="high-contrast"])` weighs (0,2,0), the same as the `products.css` block, and `spexr-overrides.css` loads after `products.css`, so a fill changed in the registry does not reach spexr.
  - **A fill a product sets itself.** A rule of your own that weighs less than (0,2,0) now loses to `products.css` wherever your product registers a fill. That includes a plain `:root { --slc-accent-fill: … }` at (0,1,0), and it loses silently. Delete it and register the fill, or give your rule the weight it needs. A fill set on a subtree, below the theme element, still wins there, because it is nearer.
  - **What a fill change takes:**
    - edit the registry's `fill`;
    - run `npm run gen:tokens` and commit the regenerated `products.css` and `neutrals.json`;
    - dual-bump (`AGENTS.md`).
  - No kit test pins the value. The tests derive the label, hover and press from the registry and hold them to 4.5:1. With spexr's dark fill set to `#8b96ff`, the whole suite passes unchanged, and its label turns to the dark pole.
  - The prose that quotes the value is a separate edit: the registry's `$fill-note`, the accent table in `docs/design-language.md`, and this README.
  - spexr receives the change at its next kit upgrade, once its own literal is gone.
  - High contrast is unchanged: `products.css` has no high-contrast block, and `components.css` resets the fill on the high-contrast root and on the filled controls under it.
- `components.css`'s fallback literals, used by a bare import with no theme, follow the default product's new light ink and borders.
- **Migration (Tier B):** a Tier A host (`data-sl-theme`, the theme files and `products.css`) needs no action. A Tier B layer that copied the old values gets `sl-audit` R findings on them: they no longer ship anywhere. Re-copy `text-primary`, the borders, the overlay and the `code-*` roles from `neutrals.json` → `products.<id>.<light|dark>`. For example, introspect's `web/src/theme.css` copies the ten old code hues.

**0.34.0 — Lumen parity: the workbench and its frame.** The workbench chrome follows the Lumen IDE screen as it renders at 1440×900 (owner, 2026-10-05: spexr is to look like the demo), within a pixel or two: the kit keeps its 4px grid (owner, same day), so every gap, padding, inset and row, bar or control size below is a whole number of 4px steps, and where the demo sits between two steps the kit's own rules decide (one control height, 32px), then the demo's invariants (the activity bar's 44px pitch, 4px round a status item, 10px round the palette's field), then the 0.33 value. Several sizes therefore stay what they were in 0.33 (the activity item, the status bar, the tree row, the palette row); what changes is the shape, the paint and the spacing round them. `workbench.css` gains a title bar. No token changes, so palette-py is unchanged. Four role-vars are added, all derived from roles you already map, so a Tier B layer maps nothing new. Classes are only added, but most workbench pieces, the tile tab and the toast render differently; the tile tab and the toast live in `components.css`, so they change for every product that upgrades, not only a workbench. The three owner rules hold throughout: every selected or current tile keeps its seam (Lumen draws none), focus is the kit's flush ring and halo (not Lumen's glow ring), and nothing animates on page load.

- **`.sl-titlebar` (new).** It has these parts: `__l`, `__menu`, `__mark`, `__dot`, `__crumb`, `__sep`, `__cmd`, `__cmd-text`, `__keys`, `__r`, `__btn` and `__btn--dot`.
  - **The bar** is a 44px grid on the canvas, `1fr minmax(0, 32rem) 1fr`, with a 16px gap, 16px in at the start and 8px at the end.
  - **The left side** holds a compact-menu slot, the product's mark and a crumb. The mark is the display face at 700, 15px, tracked -0.04em, with a 5px accent dot (a child element, 4px after it). The crumb is 13px in the secondary ink, its separators 4px apart from the words.
  - **The command field** is the one control height, 32px (Lumen's is 30), at r8, in the one control edge, on the surface rung, lit along its top, 12px in at the start and 8 at the end. Under the pointer it takes the raised rung and the edge's hover step. On focus it takes the shared flush ring and halo.
  - **The right cluster** holds icon buttons that rest on the surface rung in their own edge; a pressed toggle keeps the kit's pressed tint. `--dot` adds Lumen's 6px unread dot as a background layer, in `--slc-accent-fill` (or the accent as a mark). Under forced colours, which drop it, the button takes a 2px `Highlight` edge; its name says the state in words ("Notifications, 3 unread").
  - **Drag region.** The bar is the window's drag region: `-webkit-app-region: drag` and `app-region: drag`. Buttons, links, fields, a `summary`, a `label`, an editable, `role="button"` and tab stops inside it are `no-drag`. A control of yours that is none of those needs `no-drag` of its own, and so does a popup from elsewhere in the page that overlaps the bar: the region is hit-tested as a rectangle.
  - **macOS.** For the traffic lights, give the bar their room as its own `padding-inline-start`.
- **The lit pane, as rendered.** `.sl-pane[data-lit]` changes in two ways, with no accent rim (owner decision); its seam stays 12px in (Lumen's 10, on the grid):
  - Its 24px glow all round is replaced by `--slc-lit-drop`, a glow that falls below the pane.
  - Two roles are for your own chrome inside the lit pane:
    - `--slc-lit-wash`: an image for the tab strip or head along its top. It is a radial wash of the seam at 80% of Lumen's strength (20.8% at its peak on ink, 14.6% on paper; Lumen 26 / 18.2), in the seam capped at oklch L 0.65. At its peak, the strip's top edge, a muted label reads ≥ 4.60:1 for every product, wherever the label sits (Lumen's own wash took one to 3.84–4.01:1 there).
    - `--slc-lit-tint`: an image for the row under it. It is the seam at 7%, fading down the row.

  All three read `--slc-glow` and are nothing in high contrast and under forced colours. **If your layout clips the pane's shadow** (Lumino's `contain: strict`), wear the drop inward on the element right under the pane: `box-shadow: inset var(--slc-lit-drop)`. The falloff and the line it starts from are the same.
- **`--slc-depth-cast` (new role).** Lumen's overlay cast for an overlay with no border: the float, plus the ring folded in (the overlay's own fill in shade), lit along its top. High contrast draws the ring in the theme's line. Forced colours turn it off, and the palette and the toast then get a drawn outline. The effects kill switches now restore it on a toast and a palette, where they restored `--slc-depth-float`.
- **Activity bar.** The bar is 52px wide, the first item starts 4px from the top, and the items keep their 36×36 (Lumen's 38) but sit 8px apart (it was 4), so they keep Lumen's 44px pitch. They are r9 (they were r8).
  - **The current view** is a flat tile on the surface rung (it was the tile rung) and keeps its seam.
  - **A count badge** (new), `<span class="sl-activitybar__badge" aria-hidden="true">3</span>` inside the item, sits 4px in from its corner: the mono at 9px, on the accent fill that carries a label, with its label picked on that fill, ringed in the canvas, a 16px pill at least 20px wide (Lumen's is 20×14). It is a child, never a pseudo-element: the item is an effect host, and the aurora owns its `::after`. Under forced colours it is `Highlight` ringed in `HighlightText`, so it keeps its shape on a current item. Put the count in the item's name too ("Source control, 3 changes").
- **Status bar.**
  - The bar keeps its 28px (Lumen's 30), now 4px in at the start and 8 at the end.
  - Each item is a 20px pill at r6 (it was square), 4px from the bar's edges as in the demo. An item that does something is a `<button>`, a link or `role="button"`: it brings the surface rung up under the pointer, with a pointer cursor, takes the shared ring, and a link is not underlined. A fact does not answer the pointer.
  - **Separators are off.** Add `.sl-statusbar--separators` to the bar to get them back. This is a silent visual removal for any bar that relied on them.
  - The live dot breathes every 2.4s, only under `prefers-reduced-motion: no-preference`. It stops under forced colours and in a `data-sl-fx="off"` region, and pauses under `data-sl-fx-still`, as the live badge does.
- **Tree.**
  - Rows keep their 24px (Lumen's 26), at 13px (they were 14px).
  - The twisty's chevron is sized to Lumen's 12px glyph: 6px tall, 3px deep, a 1.25px stroke (it was a 1.5px stroke on a 5.6px square). It is still CSS, so it needs no markup and still turns.
  - **Indent guides are opt-in:** `.sl-tree--guides` on the tree. A tree that relied on them loses them silently.
- **Tile tabs** (`components.css`, every product). A tab is 28px at r7 (it was r6), 13px at weight 500 (it was 14px), 12px in as before (Lumen's 11.2). Hover lifts the ink to the secondary (it was the primary). The `sl-tabs__item` wrapper is r7 too.
- **Palette.**
  - It is 580px wide (it was 576) and has no border. It sits on `--slc-depth-cast`.
  - Where the backdrop can blur, it is the raised rung at 94% under `blur(24px) saturate(1.3)`. It stays opaque where it cannot, under `prefers-reduced-transparency: reduce`, in high contrast and under forced colours.
  - Its seam is Lumen's: a 1px line from 16px in, gone 40% before the end, glowing at 55%. It is the palette's `::before` (it was a background layer), as the pane's seam and the toast's tick are, so glass, press and glitch are unsupported on a palette; the aurora is not.
  - The head is 52px (Lumen's 54) over a hairline (`--slc-border-subtle`; it was the raised edge in shade), 10px round the field as in the demo.
  - The input is the kit's field, the one control height, 32px (Lumen's 34), at 16px, 8px in, with no fill or well, in the one control edge. Lumen draws it borderless (1.00:1); the kit keeps the edge, because a field is found by its boundary (≥ 3:1 against the palette, over the canvas or the page's ink).
  - The list is 4px in at the top and 8 elsewhere; rows keep their 36px (Lumen's 38), 12px between the icon and the label. Its keycaps are 4px apart (they were 3), as the title bar's are.
  - The foot sits on the surface at 70%, over a hairline.
- **Toast** (`components.css`, every product).
  - It is r12 (it was r14), has no border (it was the raised edge in shade) and sits on `--slc-depth-cast`. Padding is 12 / 12 / 16 / 16px (top, end, bottom, start; Lumen's 12.8 / 12.8 / 14.4 / 16).
  - The tone tick is a 1px line from 16px in to the middle, fading and glowing at 50% (it was a solid 2px tick, 2.75rem long).
  - The mark keeps its 24px (Lumen's 26), now on a 16% wash (it was 12%).
  - The dismiss is the icon button's own 32px at r8 (it was 24px at r6).
  - `.sl-toast__timer` (new) on an `.sl-progress` draws a 2px bar of the tone along the bottom, 16px in from either end; it stays a 2px bar in high contrast and under forced colours.
- **Paint layers.** Four marks are a `::before`: the lit pane's seam, the palette's seam, the toast's tick and the terminal block's exit mark, so glass, press and glitch are unsupported on those four hosts (the palette joins them in 0.34). No workbench piece takes `::after`, which stays the aurora's. The title bar's dots and the activity item's count badge are children or background layers, so they take no pseudo-element.

**Migration.** Class names are unchanged. Re-check any rule of yours that sets the sizes above. If you relied on status separators or tree guides, add `--separators` or `--guides`. If you wrote a `--slc-depth-float` restore for a toast or a palette, change it to `--slc-depth-cast`. A status item that is a `<span>` no longer answers the pointer; make the ones that do something buttons or links.

**For spexr** (checked against `spexr-wt-lumen-d` at `86e69e0`). Of the pieces 0.34 changes, spexr renders only `.sl-pane` directly, on its islands (it also renders kit pieces 0.34 leaves alone, such as `.sl-icon-btn`, `.sl-progress` and the effects). It mirrors the rest in its own Theia CSS, and S5b–S5f take the new values there.
- **Islands.** The kit's lit-pane seam stays 12px in. `.spexr-island.sl-pane[data-lit] { box-shadow: none }` also removes the new drop. S5f wears the drop inward on the bottom split panel's handle, and paints `--slc-lit-wash` on the main tab bar and `--slc-lit-tint` on the breadcrumbs. The inward 24px glow on the island's `::after` goes then.
- **Mirrored values to move:**
  - the activity item keeps 36px; r8 → r9, 8px apart, 4px from the top, a 52px column;
  - the status bar: spexr's 22px Theia row → the kit's 28, with 20px items at r6;
  - tree rows keep 24px, at 13px;
  - tile tabs r6 → r7, at 13px;
  - the toast: border, float and 2.75rem tick → no border, the cast, the 1px tick, a 16% mark and a 32px dismiss;
  - the palette: S5f.
- **Power-save, a paired edit.** spexr's power-save copy of the kill-switch restores (`spexr.css:261-262`, `:root[data-spexr-power-save] :is(.sl-toast, .sl-palette)…`) still restores `--slc-depth-float`, and `power-save-style.test.ts:111-120` pins the kit's restores in order, the last as `var(--slc-depth-float`. Both change together at the kit bump (S5b-1): the copy to `--slc-depth-cast`, and the test's last expected entry to `var(--slc-depth-cast`. The two new members of the depth and halo restores (`.sl-statusbar__item`, `.sl-titlebar__cmd`) join spexr's mirrored selector lists in the same edit.
- **The live dot.** The status dot's breath stops in a `data-sl-fx="off"` region and pauses under `data-sl-fx-still`, which spexr sets while motion is paused; spexr's power saving sets neither on the root, so a status bar of spexr's that uses the kit's dot keeps breathing while saving power unless spexr's power-save CSS holds `.sl-statusbar__dot` too.

**0.33.1 — `sl-audit` runs when called through its bin.** A patch to the audit script only: no token, role, class or stylesheet changes, and palette-py is unchanged. Since the bin shipped (0.3.0), `sl-audit` printed nothing and exited 0 when it was reached through npm's `node_modules/.bin/sl-audit` symlink (so also through `npx sl-audit`) or through pnpm's shim, which calls node on a path inside the linked package directory. A CI step gating on `--fail-on R` therefore passed whatever the surface held. The script decides whether it was started as a program by comparing the path it was called by with its own path; the first was the unresolved link, the second the resolved file. It now resolves both. `scripts/sl-audit.test.mjs` runs it directly, through a symlink to the file and through a linked package directory, and asserts the finding and the exit code each way. The exit codes are unchanged: 2 on a usage error, 1 on an R finding only with `--fail-on R`, otherwise 0. If you call `node node_modules/@sondalab/ui-kit/agent/sl-audit.mjs` to work around this (spexr does), `npx sl-audit` works again; both stay supported.

**0.33.0 — the Lumen workbench.** A new opt-in stylesheet, `workbench.css`, carries the chrome of an IDE or a console: a lit pane, a status bar, an activity bar, a tree, a command palette and terminal blocks. `components.css` gains a toast stack and one state cue for every selected or current tile, the seam (owner's Lumen plan, checkpoint C). No token or role is added, changed or removed, and palette-py is unchanged. Classes are only added, but selected and current tiles across the kit now render differently (the seam, below).

- **The seam on every selected or current tile (visible change).**
  - The tile's fill, ring and cast are depth, not a state cue: they measure 1.00–1.42:1 against their ground. The nav item has carried a seam since 0.31. Now every selected or current tile carries one, from one rule in `components.css`: the current nav item, the current activity item, a selected tree row, the palette's active result, a selected or current list row, the active tile tab (or its `sl-tabs__item` wrapper), the chosen segment and the current page. A selected table row has none: its state lives in its content.
  - In a row or column the seam is a 2px line, half the tile's height, 3px inside its leading edge (mirrored right to left). In a tab, a segment or a page it is a short line 3px above the bottom edge.
  - Its colour says where the focus is: the accent (`--slc-seam`) while the container holds the focus, and the muted ink while it does not. A palette always holds the focus. Measured against the tile and against the ground around it, the seam reads at least 5.24:1 on the page and 3.4 in the band. On the light theme's dark band the seam is floored one step above the band's accent text, at oklch L 0.72 instead of 0.68, so a dark product hue that the floor lifts out of sRGB (spexr's indigo) still clears 3:1. On the dark theme's light band the cap decides, so the floor changes nothing there. **The nav item's seam, accent-coloured at all times until 0.33, is now muted while the nav lacks the focus.**
  - **A host outside a kit container** never sees the focus flag, so its seam stays muted. A row in your own list is an example. Set `--sl-seam-focus: 1` on the host or an ancestor, for example under your container's `:focus-within`, to give it the focused seam. A kit container also honours the hook at rest. The kit's containers are `sl-nav`, `sl-list`, `sl-tree`, `sl-tabs__list`, `sl-segmented`, `sl-pagination` and `sl-activitybar`.
  - The seam is a layer of the tile's background, so a `background` shorthand of yours on a selected or current tile wipes it. Set `background-color`. The chosen segment and the current page now set `background-color` (they used the `background` shorthand), and the segment's resting fill is a longhand too.
- **`aria-current="false"` is not current.** Every `[aria-current]` rule (nav, list, pagination, breadcrumb, activity bar) now reads `[aria-current]:not([aria-current="false"])`, which React renders for `aria-current={false}`. Each of those selectors weighs one class more. Because `:is()` takes its heaviest argument, the `aria-selected="true"` variants in the same `:is()` rose to (0,3,0) too: the selected list row and the activity item. An override of a current or selected tile's paint now needs (0,3,0).
- **A subtree accent reaches the marks.** `--slc-accent-text` and `--slc-seam` are now derived again, from the accent in effect there, on these hosts: links, nav, tabs, list, segmented, pagination and the workbench. Other readers still take the root's value. They are a tag, inline code, a progress bar, a slider, a resizer, a callout's tick, a pressed button, icon button or chip, and a breadcrumb's hover. An accent re-bound on a section now reaches its seams, links, icons on tiles, the live dot, a palette match's underline and a terminal prompt, as well as the fill set (0.32). Inside an `sl-invert` band these hosts take the band's formula. The focus ring and its halo (`--slc-focus`) still follow the theme, not a subtree accent.
- **`workbench.css` (new).** Import it after `components.css` and before `effects.css`. It reads the kit's role-vars, its depth recipes, its shared focus rule and its seam, so it does nothing alone. It adds no role, so a Tier B layer needs no new mapping. It ships in the package `files` and as the `./workbench.css` export. Inside an `sl-invert` band, only `.sl-term-block` is supported, set straight on the band; the rest lives on the workbench's frame.
- **Paint layers.** Glass, press and glitch own an effect host's `::before`, and the aurora its `::after`. A tile's seam and the palette's are layers of their host's background, so an effect keeps its pseudo-elements. Three marks are a `::before` instead:
  - the lit pane's seam, which must paint over the pane's children (a header or a tab strip with a ground of its own), at `z-index: 1`;
  - the toast's tick;
  - the terminal block's exit mark.

  Glass, press and glitch are therefore unsupported on a pane, a toast and a terminal block; the aurora is not.
- **`.sl-pane`** is an island: the surface rung on the canvas with the island recipe (a lit top line and the quieter ring) at `--sl-radius-pane`, and no border. **`[data-lit]`** marks the pane that holds the focus. That pane is the raised rung, with a seam of the accent along its top edge and the seam's glow at `--slc-glow`'s strength. Set it on one pane, where the focus is. **Lit and focused are two things:** the pane stays lit while a palette holds the focus over it, and a tree inside the pane then reads as unfocused. The seam is the pane's `::before`, so glass, press and glitch on a pane are unsupported. The pane is `position: relative` and `border: 0`; a Lumino widget's inline `position: absolute` still wins.
- **`.sl-statusbar`** (`__item`, `__value`, `__sep`, `__dot`, `__spacer`) is the workbench's meta line on the canvas, as the Lumen target draws it. Facts are in the sans at 12px, sentence case, in the muted ink. A value read as data (`__value`: a branch, a model, a count) is in the mono at the primary ink, as written. It is 28px tall whatever it holds, and a fact that does not fit ends in an ellipsis. Don't put `role="status"` on it.
- **`.sl-activitybar`** (`__item`) is the column of views. Its items are borderless chrome glyphs, the documented exception to the one control edge. The current item (`aria-current`, or `aria-selected="true"` on a `role="tab"`) is a flat tile with the seam, and its glyph is in the accent. It has the shared focus ring and halo.
- **`.sl-tree`** (`__row`, `__twisty`, `__label`) is a file tree of 24px rows. The indent reads `aria-level` up to 8, and a deeper row holds at 8. For its full indent, write the level again as `--sl-tree-level` (inline); the kit's levels weigh nothing. A flat list of treeitems also needs `aria-setsize` and `aria-posinset` on each row. Each ancestor gets a hairline guide, a background layer laid under the seam. The twisty turns with `aria-expanded`. Selection is the raised tile with an accent seam and icon while the tree has the focus, and a flat tile with a muted seam and icon while it does not. Use a roving `tabindex`; you wire the keys.
- **`.sl-palette`** (`__head`, `__input`, `__list`, `__group`, `__row`, `__label`, `__meta`, `__keys`, `__foot`) is a command palette. It floats, with a seam just inside its top edge.
  - Its input is the kit's sunken field (`sl-field__input sl-palette__input`). It is a combobox with `aria-autocomplete="list"` that points at the active option through `aria-activedescendant`. It takes no transition, at two classes' weight.
  - Give the list `tabindex="-1"`: Chromium 130 makes a scroller with no focusable children a tab stop.
  - The active result is a raised tile with the accent seam. A `<mark>` anywhere in the palette is a match.
  - It never animates.
- **`.sl-term-block`** (`[data-exit]`, `__head`, `__cmd`, `__prompt`, `__meta`, `__exit`, `__out`) is one command and its output, as an island. It is set in `--sl-font-code` (your terminal's face), or the kit's mono where you set none. In a lit pane it steps down to `--slc-sunken`, so its fill still bounds it. The exit mark and the exit text follow `data-exit`:
  - `"0"` is the success;
  - `"cancelled"` is neutral, for a stop you asked for (130, 143);
  - any other code is the danger;
  - `""` and a missing attribute (still running) draw no mark.
  - Inside `.sl-invert` it drops its wash.
- **The shared focus rule** in `components.css` now lists `.sl-activitybar__item` and `.sl-tree__row`, alongside the halo, the depth painter and the forced-colours resets. Without `workbench.css` these selectors match nothing.
- **`.sl-toast-stack` / `.sl-toast`**, in `components.css`, with `__live` on the stack and `--info`, `--success`, `--warning`, `--danger`, `__mark`, `__content`, `__title`, `__body`, `__dismiss` on the toast. A fixed stack at the bottom right (`--sl-z-toast`) holds toasts that float like a dialog. The tone is a tick on the top edge and the mark's wash. A toast arrives with a 6px rise on the motion tokens, transitions only. The dismiss is an icon button at 24px that keeps its edge.
  - **Live regions.** The stack has no role, so it is no landmark. It holds two regions side by side: `sl-toast-stack__live` with `aria-live="polite"` for every toast, and one with `role="alert"` for a toast that must interrupt. Toasts carry no role. Keep both regions in the DOM, empty, from page load, and never hide one with `display: none` or `contents`.
  - **Above a modal dialog (opt-in).** A `showModal()` dialog is in the top layer, above any `z-index`. Make the stack `popover="manual"` and call `showPopover()`. A popover stack stays hidden until shown, so the plain stack is the default; while it is closed, its regions are hidden live regions and announce nothing. After a dialog opens, call `hidePopover()` and then `showPopover()`. Add the toast a frame later (`requestAnimationFrame`): the regions have only just come back into the accessibility tree, and an addition in the same frame may not be heard. The stack undoes the browser's popover box, and a closed one stays hidden.
  - Mount the stack under `<body>`, never in an `sl-invert` band.
- **Forced colours.** A pane and a terminal block get a `CanvasText` outline inside their box, since their ring was a shadow. The lit pane gets a 2px `Highlight` outline, since its seam is a gradient. The toast's tick and the exit mark are drawn in `CanvasText`.
- **Effects.** The kill switches (high contrast, `data-sl-fx="off"`) give back each component's own shadow, as they already do for a control's depth: a pane or a terminal block its island, a toast or a palette its float, and the activity item and the tree row their depth and halo. In an opt-out region the lit pane keeps its seam and loses its glow. To drop one of those restored shadows inside such a region, a rule of yours needs `!important` at (0,4,0) under high contrast, or (0,3,0) under `data-sl-fx="off"`.

**0.32.1 — the primary's label holds 4.5:1 for every product, theme and state.** A patch: no public token or role is added or removed; the light theme's label and both themes' accent hover and press change value (sondalab-site's composited sweep measured the primary's label under 4.5:1 on 0.32.0 in five places). Measured through the cascade for every registered product, wired as a Tier A theme, as sondalab-site's product section and as a Tier B page, on both themes, opaque, with no script, in an opt-out region and on a built glass pane (lensed or not) over the canvas, a surface and a raised surface, at rest, hovered and pressed (450 cells, and the danger primary's 450): the worst label was 1.01:1 (a Tier B glass primary) and 3.15 elsewhere, and is now 4.84; every hover and press moves at least ΔE 4.5 (OKLab × 100), and the edge and foot follow it (`scripts/primary-label.test.mjs`).

- **One label rule and one step, written once** (generated into `tokens.css`, `:root`, from `sondalab.tokens.json` → `label`; private macros, not API): `--_sl-pole-l` (0.59), `--_sl-pole-dark` (0.16), `--_sl-hold` (5.4), `--_sl-on`, `--_sl-lum` and `--_sl-step-hover` / `--_sl-step-press`. A labelled fill reads them as `oklch(from <fill> var(--_sl-on))` and `oklch(from <fill> var(--_sl-step-hover))`: the light theme's `--sl-text-on-accent`, both themes' `--sl-accent-hover` / `--sl-accent-active`, the accent fill's label and steps, `--slc-on-<status>`, the danger tone's steps, the `:root` fallbacks of `--slc-accent-hover` / `-active`, the in-button key and the glass primary. They live in `tokens.css`, which every page loads first, so the theme files need nothing else: a page that loads only `tokens.css` and a theme (a CDN `<link>`, a preload page, a webview) resolves `--sl-text-on-accent`, `--sl-accent-hover` and `--sl-accent-active` exactly as the full kit does. **Migration:** none; load `tokens.css` with the themes, as the import list above already does.
- **Hover and press: the danger tone's step, toward black unless the label would drop under 5.4:1.** Hovered a fill moves 0.05 of oklch lightness and pressed 0.10, toward black, the way a key reads pressed — unless its label is the dark pole and would read under 5.4:1 on the fill pressed toward black; then the fill steps toward white instead. 5.4 is the rule, not a tuning: a pressed primary must leave its label 4.5:1 on a glass pane as well, and a pane over a dark page shows a tenth of that page through the fill, which costs a dark label up to about 0.9:1. The direction is decided once per fill, on the press, so hover and press always move the same way, and each state moves at least ΔE 4.5 from the last (0.32.0's dark hover to press moved ΔE 1.0 and its spexr glass hover 1.5). The step runs along the line to the pole it moves toward, so it never leaves sRGB (the danger's press on ink was clipped by the browser): darkening keeps chroma in proportion to lightness, lightening eases it. **What you will see against 0.32.0:**
  - **introspect's teal on paper now lightens** on hover and press (`#4ea893` / `#72b4a3`; it darkened to `#0c8b75` / `#0b7764`, and its press read 3.15:1);
  - **on the dark theme, hover and press darken for every dark-label fill** — the default amber and daos (`#e19a36` / `#cd8c30`; the hover lightened to `#f7b963`), introspect's mint (`#2ad4b1` / `#25c2a1`; the hover lightened to `#58ebcd`) and the danger (`#e8765a` / `#d26a50`; both lightened);
  - **local-agents' blue on ink now lightens** on press as well as hover (`#7eb6f9` / `#9fc6f5`; the press darkened to `#4a94e8`, and read 4.45 in the site's sweep);
  - on paper the default amber and daos darken as before, by the lightness step (`#ea9119` / `#d58415`, were `#e38e19` / `#c27915`); every white label's fill darkens as before (spexr's indigo `#444ecf` / `#3a43b1` becomes `#424ccd` / `#3841b1`, local-agents' light blue `#1a58c0` / `#164ba4` becomes `#1856bd` / `#1349a3`, the light danger `#961700` / `#850000` becomes `#902404` / `#791d02`).

  The dark theme's `--sl-accent-active` loses its `#E0942A` line, which no browser read: a custom property declared twice in one rule takes the later declaration everywhere. **Migration:** none. A Tier B product that maps its own `--slc-accent-hover` / `-active` keeps them; unmapped, the kit's fallback follows the same rule.
- **The edge and the foot follow the state.** Hovered or pressed, the primary's edge and foot are that state's fill in shade (they were the resting fill's), capped on paper like the resting edge, so a pressed fill is found by its edge on the canvas, a surface and a raised surface (>= 3:1), and the foot stands at least ΔE 3 off the fill above it (it sat closer in 90 cells on 0.32.0). High contrast keeps its drawn edge.
- **One dark pole, one threshold.** The light theme's label is near-black at oklch L 0.16, the kit's own on every labelled fill (it was 0.22: the worst dark label across the registry goes from 5.03 to 5.64:1), and every label turns from white to that pole at oklch L 0.59 (it was 0.61, tuned for the 0.22 pole). The one fill this moves is spexr's bare accent `#5b6cff` (L 0.6015), which now takes the dark pole at 4.65:1 where white read 4.17; spexr's registered fill keeps its white label. The dark theme's `#0A0A0B` (oklch L ≈ 0.15) is unchanged.
- **The glass primary's white label holds over a real page.** At the owner's 90% share, white on spexr's indigo read 4.32:1 on paper (4.34 in the site's sweep; local-agents' blue 4.39, 4.45 there): the tenth of the page that shows through is lighter than the fill. The pane now puts the page behind the fill in shade under a white label, from none where the pane composites at oklch L 0.54 or darker to half at the threshold, so white reads at least 4.84:1 there. The share, the white label and the look stay; on ink and on the light danger the shade is zero and the pane is unchanged (pinned). The resting composite is written once (`--_slfx-pane`, private), and the label, its keycap and the shade read it. **Hovered and pressed, a built pane stays a pane:** the primary's state fill no longer paints an opaque host under the tint (the step is carried by the tint, at the same 90%), which on ink had left a white label's hover ΔE 2.1 from rest.
- **An opt-out region keeps the opaque key.** In `[data-sl-fx="off"]` the glass layers `mount()` built are hidden, as under forced colours, and the host keeps its own fill and label (it was a 90% tint over a blurred page under the opaque label); the shade is off there and on high contrast.
- **Tier B glass has a tint.** The glass tint read `--sl-bg-canvas`, which a Tier B page does not have, so it was invalid and a glass primary's label sat on the bare page (1.01–1.19:1). It falls back to your `--slc-canvas` now; Tier A is unchanged.
- Known limit, an owner call: on the dark theme spexr's `#4c58e9` fill reads at least 3.25:1 against the ink grounds at rest but 2.14 (opaque) / 1.95 (glass) pressed, and its edge in shade less (2.65 / 2.50 / 2.33 at rest); a per-theme dark `fill` in the accent registry would resolve it.
- Corrected in the 0.32.0 note below: the switch's checked held-state rule weighs (0,6,1), not (0,5,1).

**0.32.0 — Lumen controls.** Every control takes Lumen's depth, focus gains a soft halo, and the kit ships a danger tone and an accent-fill role (owner, 2026-10-02). One token is added (`--sl-focus-glow-width`) and none removed; what every control renders changes:

- **The primary stands on a foot:** one more pixel of its edge (its fill in shade) along the bottom, inside the 1px border, so the bottom reads 2px deep; the lit top line is gone. The foot is a background layer (`background-image`, `-size: 100% 1px`, `-position: bottom`), not a border width or padding, so the box is exactly a plain button's: your own `padding` or `font-size` on `.sl-btn` / `.sl-btn--sm` gives the primary the same height as the buttons beside it, and you need do nothing about the foot. A `background` shorthand of your own (stripping a button to text with `background: transparent; border: 0`) strips it with the fill; a `background-image` of your own on a primary replaces it. Pressed, the foot moves to the top and the key sinks by it (`translate: 0 1px`; the squash keeps `transform`); under keyboard focus it takes the ring's colour, as the border does, so the bottom reads a pixel heavier than the other sides. It stands down inside `.sl-btn-group` and on a built glass pane (`mount()`, where `backdrop-filter` works); with no script, no backdrop support, high contrast or `data-sl-fx="off"` the primary is its own opaque key and keeps it. `.sl-btn`'s transition is `background-color` now (it was the `background` shorthand), so the foot does not slide when pressed.
- **The secondary (`--ghost`) is a raised key:** `--slc-raised` (it was a 6% wash of the ink) in the one control edge, a lit line inside its top and the short cast (`--slc-shadow-sm`); hover lifts it to `--slc-tile` with the edge's hover step. A pressed toggle sits flat.
- **The icon button is clear** at rest (it was a 6% wash), still in the one control edge, its glyph in `--slc-text-secondary`; hover brings `--slc-surface` under it with the edge's hover step.
- **Fields, selects and textareas are sunken:** `--slc-sunken` (it was a 4% wash over the raised rung) with the sunk inset cast, in the one control edge. Focused, the border is `--slc-focus` (it was `--slc-accent-text`; the same colour on the shipped themes) and the halo replaces the 3px accent wash; an invalid field's halo is the danger's. Hovering a focused field no longer swaps its edge for the hover step inside the ring.
- **Check, radio, switch:** the box and the track are `--slc-sunken` (the track was a 14% wash) and the track wears the sunk cast. Checked, each is the accent fill on an inset foot of its own shade with a soft glow of the fill, as strong as `--slc-glow` (none on high contrast or under forced colours). The switch is 2.1 × 1.25rem (was 1.9 × 1.05) with a 0.85rem knob (was 0.75), `box-sizing: border-box`, the knob 2px in from either end; held, it still stretches toward where it will go. **If you resize the switch** (a compact one of your own): the width and height now include the 1px edge (`border-box`), so a size written for the old content box leaves the knob 1px off on each axis, and the held-state rules (`.sl-switch:active:not(:has(:disabled)) .sl-switch__track::after`, weighing (0,4,1), and its checked twin, `.sl-switch:active:not(:has(:disabled)) .sl-switch__input:checked + .sl-switch__track::after`, weighing (0,6,1); this read (0,5,1) until 0.32.1) outrank a size rule on the knob at (0,2,1) or (0,3,1): redo the track size for `border-box` and override the held width and travel at those weights too, or the held knob grows to the kit's 0.935rem and runs past a smaller track.
- **The segmented control's track is sunk** (`--slc-sunken` and the sunk cast; it was a 6% wash); the chosen segment is the 0.31 tile.
- **Focus halo.** Every control the shared focus rule covers (and a slider's thumb) gets a halo outside the flush ring: the ring's own colour at 22%, `--sl-focus-glow-width` (5px) wide, starting where the ring ends. It is composed with the control's own depth in `box-shadow`. A `box-shadow` of your own on a kit control replaces the resting depth at (0,1,0) loaded after the kit (a bare `.sl-btn` rule; the kit paints the depth at that weight, a selected tile or a checked box included, which painted at (0,2,0) until 0.31), and replaces the halo only at (0,2,0) or more (`.sl-btn:focus-visible` paints it). Off in high contrast and under forced colours. The outline is unchanged and still carries the state. Effects: the kill switches (high contrast, `data-sl-fx="off"`) take an effect host's `box-shadow` away with `!important`, and since 0.32 restore the control's own depth and focus halo after it, as they restore a selected tile.
- **A depth recipe that a theme turns off is `0 0 transparent`, not `none`** (high contrast's `--slc-depth-sunk` and `--slc-depth-float`, every recipe under forced colours), so it can join a shadow list. If you read a recipe and test it against `none`, test for the empty shadow too.
- **The danger tone** (new): `.sl-btn--danger` on any button, `.sl-icon-btn--danger` on an icon button. On a primary it is the danger fill with its own label (`--slc-on-danger`), edge and foot, its hover and press stepping away from the label; on a secondary, a plain or an icon button it is the danger ink on a 12% wash of itself with a danger edge, filling with the danger on hover (inside `.sl-invert` the wash goes, and the band's danger ink, `--slc-danger-text`, is floored at oklch L 0.76 instead of 0.68, so it reads 4.5:1 on a card, a raised surface or a tile in the band too). The focus ring, the border and the halo are the danger's. On glass it keeps its edge, and a hovered one keeps its fill and its label. **Migration:** delete your local danger CSS (spexr's `.sl-btn--danger` / `.sl-icon-btn--danger` rules in `spexr.css`) and keep the classes in the markup; a test that pins your local rule's `background` moves to the kit's.
- **The accent fill** (new role, `--slc-accent-fill`, unset by default): the colour of an accent fill that carries a label. **Migration:** a product that re-bound `--slc-accent` (with its hover, active, `--slc-edge-accent` and `--slc-on-accent`) on `.sl-btn--primary` sets `--slc-accent-fill: <its registered fill>` once instead, excluding high contrast (recipe under Tier B, below); the primary, a checked check, radio or switch and its count badges then all take it, with a derived label, hover, press and edge. The kit's controls compute that fill set on themselves, so the role works on the root or on any subtree, and so does an accent (with its steps and label) re-bound on a subtree, as a product page painting a section in another product's hue does (since 0.33 the accent text and the seam follow it too, on every host that reads them; the focus ring and halo still follow the theme); the public `--slc-on-accent-fill` / `-hover` / `-active` roles compute on `:root` and follow a root fill only, for a fill you draw yourself. A re-binding of `--slc-accent` on the primary itself keeps working too. High contrast resets the fill at every scope.
- **No band inside the ring.** A focused checked or mixed box, a checked radio or switch, a pressed chip and, on high contrast, a secondary, an icon button and a switch track now hand their border to the ring under keyboard focus, as every other control did: their state edge outranked the shared focus rule and sat inside the ring. Hovering a focused field no longer swaps its edge either.
- `::selection` inside a primary is the primary's own label (its fill's).
- Tier B: `--slc-edge-accent-top` is no longer read (below).
- Effects: glass owns the depth of the control it is on: on a glass button the secondary's cast stands down for the glass edge and, on a built pane, the primary's foot; the glass edge carries the halo under keyboard focus; a glass field gives up its well, an aurora field keeps it; a hovered glass secondary or icon button stays translucent.
- Known limits, unchanged in 0.32.0: on high contrast the drawn white edge replaces the danger tone's red edge on a secondary and an icon button (the ink stays the danger's); with a non-zero `--sl-focus-ring-offset` the halo tints the gap between the border and the ring; a filled danger button inside the light theme's band stands at 1.76:1 against the band (its label is what finds it); the label pole on a fill (`--slc-on-*`) is L 0.16 on the dark side where the light theme's `--sl-text-on-accent` uses 0.22, to be unified in a patch of its own (done in 0.32.1: 0.16 on every derived label; dark's `#0A0A0B` is L ≈ 0.15).

**0.31.0 — depth is lightness (Lumen).** Selection lifts as a tile, shortcuts are keycaps, the IDE gets tile tabs, and the radii, the curves and the casts follow the Lumen direction (owner, 2026-10-02). Three tokens are added and none removed; what several components render changes:

- Radii: `--sl-radius-md` 10px → 8px, `--sl-radius-lg` 16px → 14px, new `--sl-radius-pane` (10px, an island pane). `sm` stays 6px. Buttons, fields, callouts and the empty state follow `md`; cards and dialogs `lg`. The kit's own `var(--sl-radius-*, …)` fallbacks match.
- Motion: `--sl-motion-ease` is `cubic-bezier(0.25, 1, 0.5, 1)` (was `cubic-bezier(0.2, 0.8, 0.2, 1)`); new `--sl-motion-enter`, `cubic-bezier(0.22, 1, 0.36, 1)`, is the arrival curve the dialog, its backdrop and the tooltip now enter on. Durations are unchanged and still zero under reduced motion.
- Casts are black (`rgba(0,0,0,…)`) on every theme, retuned to the Lumen casts: `--sl-shadow-sm` is the short cast under a tile or key, `--sl-shadow-md` a small floating surface, `--sl-shadow-lg` the overlay cast (three layers; the overlay's own border in shade is its ring). New `--sl-shadow-inset`, a field's well. The pre-0.29 cool ink `rgba(28,29,34,…)` is gone, so `#1c1d22` is no longer allowlisted by `sl-audit`: ANY `#1c1d22` or `rgba(28,29,34,…)` literal in a product — a copied shadow, and also a light-layer overlay, border or ink a Tier B layer took from a pre-0.29 theme — becomes an R finding, until it takes the new value, `var(--sl-shadow-*)`, or its own ink from `neutrals.json`.
- New role-vars in `components.css`: `--slc-tile`, `--slc-sunken`, `--slc-lit` (from `--sl-bg-tile`, `--sl-bg-sunken`, `--sl-border-lit`; without those tokens — a Tier B page — they fall back to your `--slc-raised`, your `--slc-surface` and a white 8% hairline, so a dark Tier B page gets its own raised rung as the tile; map them from `neutrals.json` `bg-tile`, `bg-sunken`, `border-lit` for Lumen's exact rungs), `--slc-seam` (the accent as a line of light), `--slc-glow` (a number), `--slc-shadow-inset`, and the depth recipes `--slc-depth-tile`, `--slc-depth-flat`, `--slc-depth-island`, `--slc-depth-key`, `--slc-depth-sunk`, `--slc-depth-float`. The inversion band re-derives every one; high contrast trades them for drawn rings (selection in the accent, a key or an island in white, no well and no cast); forced colours turn them off.
- **Selection is a tile.** A selected `sl-list__row`, the current `sl-nav__item` and `sl-pagination__item`, the chosen `sl-segmented__item` and a selected table row (`<tr aria-selected="true">`, new) take the tile fill and `--slc-depth-tile` (lit top line, ring, short cast) in the primary ink, where they were the accent wash with a pressed edge (the nav item a 2px accent edge on its leading side, the segment the raised ground). The current nav item also carries a seam: a 2px accent line (`--slc-seam`), half its height, 3px inside its leading edge, drawn as a layer of its own background (owner, 2026-10-02) — so a `background` shorthand of your own on `.sl-nav__item[aria-current]` removes it; set `background-color` instead. Hover is a flat wash: the pagination item's hover edge is gone. An icon (`> svg`) in a selected row or the current nav item takes the accent. Under forced colours they become `Highlight` (a table row is bracketed in it). On a table, `aria-selected` on a `<tr>` is announced only in a `role="grid"` (or `treegrid`); otherwise carry the state in the row (a checkbox, a visually hidden "selected"), since on the light theme the white tile on a white table is found by its ring and cast alone.
- **Give a nav a little inset.** The current item's ring and cast sit outside its box: a nav flush against a pane's edge (or inside an `overflow: hidden` one) clips them. The pane's padding, or a few pixels of margin on the nav, is enough.
- **No border on a tile's host.** `sl-list__row` (was `1px solid transparent`), `sl-nav__item` (its `border-left`) and `sl-pagination__item` are borderless, so the tile's lit line sits flush under its ring (no gap between lines). The list row's lost pixel is padding (`calc(var(--sl-space-2) + 1px) calc(var(--sl-space-3) + 1px)`, dense likewise), so a row is the size it was. If you set your own `padding` on `.sl-list__row`, add 1px each side to keep its size. If you drew any row state with `border-color` (a selected, an expanded or a flagged row), it no longer shows: move it to a fill, or a ring in `box-shadow` (the tile's own is `--slc-depth-tile`). `sl-nav__item` takes `--sl-radius-sm`.
- **The keycap.** `.sl-kbd` is a small physical key: Geist Mono 500, at least 20px square (it was `0.8125em` text with a wash), radius 5px, raised-to-surface fill, ring, lit top line, a base in its own fill in shade (`--slc-depth-key`). Write one cap per key (`<kbd class="sl-kbd">⌘</kbd><kbd class="sl-kbd">K</kbd>`). High contrast rings it instead of bordering it; forced colours give it a 1px `CanvasText` border (inside its 20px). In a button, put the key in as a child — `<button class="sl-btn" aria-keyshortcuts="Meta+S">Save <kbd class="sl-kbd" aria-hidden="true">⌘S</kbd></button>` — an 18px cap (16px in `--sm`) that keeps the 32px (24px) row. Its fill steps away from its label, so it reads at least as well as the label on the button: on a neutral button (plain, ghost, a pressed toggle) a half wash of the pole opposite the ink, on a primary the accent one step further from its label's pole; high contrast rings it in its label's colour. On a glass pane primary (`effects.css`) the cap follows the pane's re-picked label: the composited pane stepped away from that label. A standalone glass keycap's fill is `--slc-raised`.
- **Tile tabs.** `.sl-tabs--tile` on a `sl-tabs__list`: no rule under the strip, no underline, the active tab a flat tile (`--slc-depth-flat`) in the primary ink with its icon in the accent, hover a wash; `sl-tabs__dot` marks unsaved work, `sl-tabs__close` is a borderless close glyph: an `aria-hidden` span in the tab (the consumer wires Delete on the tab), or a sibling `<button tabindex="-1" aria-label="Close …">` with the tab in a `role="none"` `sl-tabs__item` wrapper, which then carries the tile. The underline tabs are unchanged.
- The dialog floats on `--slc-depth-float` (was `--slc-shadow-lg`, the same cast). Cards, callouts and the empty state change only their radius.
- Tier B: a fourth light-layer number, `--slc-glow: 0.35` (below). Nothing in 0.31 reads it yet; the focus halo (0.32) and the lit pane (0.33) will.

**0.30.0 — Geist type, a brand face, a micro register (Lumen).** The UI faces change and the mono uppercase register shrinks to micro labels (owner, 2026-10-02). Two tokens are added and none removed, but what every surface renders changes:

- `--sl-font-sans` and `--sl-font-display` are Geist, `--sl-font-mono` is Geist Mono (were Instrument Sans, Fraunces and Martian Mono). New `--sl-font-brand` is Fraunces: the wordmark and the monogram use it and nothing else does. If you set a heading, title or numeral in `--sl-font-display` expecting the serif, it is now Geist; point a brand mark of your own at `--sl-font-brand`.
- **If you loaded the faces yourself** (Google Fonts, Fontsource, a CDN link naming Fraunces / Instrument Sans / Martian Mono): the tokens now name Geist and Geist Mono first, which that link does not serve, so your UI falls back to `system-ui` and `ui-monospace`. Load `@sondalab/ui-kit/fonts.css` (or add Geist and Geist Mono to your own link).
- **If you override `--sl-font-*`** (e.g. a site that sets `--sl-font-display` to Fraunces for its headings): also set `--sl-font-brand` if you mean to move the brand face, and expect the kit's display tracking, now tuned for Geist (`.sl-anchor` `-0.05em`, titles `-0.02`/`-0.03em`), to land on your face. Drop the display override to take the new direction, or re-tune `letter-spacing` on the elements you keep in Fraunces.
- New `--sl-text-micro` (`0.65625rem`, 10.5px): eyebrow, nav group title, stat label, section index, figure caption and labelled rule are mono, uppercase, 10.5px, weight 500, tracked `0.06em` (were `--sl-text-xs`, tracked 0.14–0.22em).
- Sentence case, in the sans, untracked: buttons were already; chip, badge, segmented item, table head, breadcrumb and field label now are too (they were mono uppercase). The CSS no longer upper-cases them, so write their text in sentence case ("Passed", not "PASSED"). Text written in lower case — data-driven labels included (an event kind, a status read from an API) — now renders in lower case, not in sentence case: capitalise it at the source (introspect's badges and chips are examples). The callout title is the sans at `--sl-text-sm`, 600 (was mono uppercase xs). The tag stays mono, now in sentence case, tracked `0.02em`.
- Inside `.sl-invert`, muted text is the band's foreground at 60% (was 58%): at 58% it read 4.31:1 on a raised surface placed in the band and 4.46 on a card there (dark), under the 4.5 text floor. It now reads at least 4.58 on the bare band, a card and a raised surface, for every product on every theme. A Tier B band of your own that copied the 58% should take 60%.
- Headings: card title `-0.02em`, dialog title `-0.03em` (both `-0.01em` before), `.sl-anchor` `-0.05em` (was `-0.02em`), all Geist 600.
- Unchanged: `--sl-text-xs`, `--sl-text-sm`, every control's padding and line height, so the 32px row stays 32px (Geist's ascent and descent centre its cap height on a `line-height: 1` box, as Instrument Sans's did).
- `fonts.css` serves Geist and Geist Mono (new, variable, latin-subset woff2, SIL OFL 1.1) beside Fraunces. Instrument Sans and Martian Mono are deprecated: still declared and still shipped for this release window so a product that names them by hand keeps rendering; no token names them, and they go in 1.0.0.
- The compact lockup is re-cut in Geist Mono 300: `sondalab-lockup.svg` (was Martian Mono 300) now carries the `0.2em` tracking the identity board and `.sl-lockup` set, so it is wider for the same height (viewBox `8.7 -766 6984 822`, was `54.8 -855.2 6661.2 910.4`). `.sl-lockup` renders in Geist Mono at weight 300 (was the mono role's 400). If you inline the SVG, take the new file; the wordmark and the avatars are unchanged.

**0.29.0 — neutrals tinted per product (Lumen).** Every neutral — canvas, surface, raised, the new `--sl-bg-tile` and `--sl-bg-sunken`, primary/secondary/muted text, the borders, the new `--sl-border-lit`, and the neutral code roles (`--sl-code-fg`, `--sl-code-comment`, `--sl-code-null`) — is now one rung of a shared lightness/chroma ladder tinted with the product's accent hue, baked to hex at build time:

- The theme files carry the default (amber) product's values, so a page with no product attribute gets warm neutrals: light canvas `#eae6e2` (was `#F4F4F8`), surface `#fcfaf9`, text `#201c18`; dark canvas `#0a0806` (was `#070A0D`), surface `#13110e`, text `#eeeae7`.
- `themes/products.css` (new) carries every registered product's neutrals. Load it and put `data-sl-product="<id>"` on the element that carries `data-sl-theme`, or on an ancestor of it: `<html data-sl-theme="dark" data-sl-product="spexr">`. The attribute on a descendant of the theme element matches nothing. One product per theme subtree: every block weighs the same, so with two products nested the later block in `products.css` wins, not the nearer ancestor.
- `neutrals.json` (new, exported) has the same values for code that needs hex outside CSS — editor and terminal themes, Electron `backgroundColor`, a preload page, a Tier B colour layer: `products.<id>.<light|dark>.<role>` is the literal value of `--sl-<role>`.
- High contrast keeps its own literal neutrals (see the last bullet).
- Light accent text is capped at oklch L 0.46 (was 0.5), so every registered accent's text reads on the darker canvas and its own 12% wash; the focus ring follows it.
- Light `--sl-viz-2` `#0E958A` → `#0E9186` and `--sl-viz-3` `#D26A00` → `#CD6400`, to keep 3:1 on the new grounds.
- The one control edge (`--slc-edge-control`) steps 5 from the surface toward contrast, plus half a step on a light surface (read from the surface's lightness, so a Tier B layer gets it too; the base is the new `--slc-edge-control-steps`); it reads >= 3.5:1 on the light canvas. The primary's paper edge cap (`--slc-edge-accent-lmax`) goes 0.62 → 0.59, so amber's edge reads >= 3.4:1 there (it fell to 3.03).
- The light overlay (`--sl-bg-overlay`) is cast in the product's own ink too. The shadow ramp still cast in the pre-0.29 ink (`rgba(28,29,34,…)`) until 0.31, which casts in black; that ink is otherwise gone.
- `sl-audit --product <id>` allows that product's own generated neutrals. The pre-0.29 grey grounds and text (`#F4F4F8`, `#7C8D95`, …) are no longer tokens: a product that copied them gets R findings until it reads `neutrals.json`.
- High contrast gains values for the three new roles (tile = raised, sunken = canvas, lit = white) and resets to `initial` every other token light or dark declares that it has no value for (the code palette, the light text cap), so a high-contrast island inherits nothing from the page around it.

**0.28.0 — no rainbow by default.** The kit no longer paints any edge, rim or arc with the spectrum (owner, 2026-10-02). On the light theme, as on dark:

- Cards take their surface in shade (`--slc-edge-surface`), fields the one control edge (`--slc-edge-control`), and the primary button its fill in shade (`--slc-edge-accent`) with the lit top line. The 0.21–0.27 spectrum rim and its role vars (`--slc-rim`, `--slc-rim-edge`, `--slc-rim-layers`, `--slc-rim-fill`) are gone; an override that still sets them does nothing. The three hosts no longer carry a `background-image`, so a `background:` shorthand reset is safe again.
- The aurora (arc, bloom, `--rim`, `--linear`), the press light, glitch's channels and the run light are the accent's and its depth companion's on every theme.
- A halftone is single-ink by default. `data-sl-ink="spectral"` opts a canvas into the spectrum on light; `"mono"`, the old opt-out, still works and now changes nothing.
- The spectrum stays opt-in only, through the classes that are rainbow by name: `sl-haze`, `sl-spectral` (both still stand down in dark, high contrast and, for spectral text, inside `sl-invert`), and the halftone attribute above. Tier B: declare the eleven `--sl-spectrum-*` values from `themes/light.css` in your light layer to use them.
- `.sl-anchor` is set solid: `line-height: 1` (was `--sl-line-tight`, 1.2). In-flow headings are unchanged.

Dark and high contrast paint what they did in 0.27, apart from `.sl-anchor` being set solid (line-height 1) on every theme. No token changed.

**Fonts.** Import `@sondalab/ui-kit/fonts.css` and the kit serves its own faces from the package: Geist (`--sl-font-sans`, `--sl-font-display`), Geist Mono (`--sl-font-mono`) and Fraunces (`--sl-font-brand`, the wordmark and the monogram only). They are variable, latin-subset woff2 files under the SIL Open Font License 1.1, with the licences beside them in `assets/fonts/` (sources and sizes in `assets/fonts/README.md`). A surface that loads the same families another way does not need the file; every token names a system fallback stack, so a surface that loads neither renders in `system-ui` / `ui-monospace`, not in the faces it had before 0.30. Geist and Geist Mono also carry the IDE glyphs they have — arrows, math operators, keys (`⏎ ⌫`), box drawing and block elements in the mono, geometric shapes — inside their `unicode-range`. A product's code editor and terminal keep their own coding mono (`--sl-font-code`); that is not the kit's mono role.

## Components (`components.css`)

Primitives: `.sl-eyebrow`, `.sl-tag` (`--plain`), `.sl-btn` (`--primary` / `--ghost` / `--sm`, and the `--danger` tone on any of them), `.sl-card` (`__title` / `__body`), `.sl-badge` (`--success` / `--warning` / `--danger` / `--info`), `.sl-field` (`__label` / `__input` / `__control` / `__hint` / `__error`; `aria-invalid="true"` on the input is the invalid state), `.sl-kbd`, `.sl-code`, `.sl-link`, `.sl-rule` (`--labeled`).

Toggle buttons: any non-primary `.sl-btn` or `.sl-icon-btn` with `aria-pressed` — the attribute is the state, no extra class.

Form controls: `.sl-check` (mixed: set `input.indeterminate = true` from script — `:indeterminate` is the only hook, since a native checkbox may not carry `aria-checked`), `.sl-radio`, `.sl-switch` (each `__input` / `__box`-or-`__track` / `__label`), `.sl-select` (a wrapper on `.sl-field__control`), `.sl-slider` (a native range; write `--sl-slider-value` for the fill).

Sizing: button, field, select, segmented control and icon button are all 32px tall (the small button 24px), so a row of them lines up.

**0.27.0 — sizing.** Each control's height is now a fixed line plus its padding plus a 1px edge, instead of the font's `normal` line height:

- `.sl-btn`: padding `0.5rem 0.9rem` (was `0.55rem`) on its `line-height: 1` — 32px. `.sl-btn--sm`: padding `0.3125rem 0.6rem` (was `0.35rem`) — 24px.
- `.sl-field__input` (and a select): `line-height: 1.25rem` (new) and padding `0.3125rem 0.75rem` (was `0.55rem`) — 32px. A textarea keeps `0.55rem` top and bottom and `--sl-line-normal`.
- `.sl-segmented__item`: `line-height: 1` (new) and padding `0.4375rem 1rem` (was `var(--sl-space-2) var(--sl-space-4)`, 0.5rem 1rem) — a 26px item in the 2px inset and 1px edge, 32px in all.
- `.sl-icon-btn` and `.sl-pagination__item` are `box-sizing: border-box`, so `2rem` / `1.75rem` is the whole control in a content-box page too.

If you override `padding` on `.sl-segmented__item`, or `font-size` on `.sl-field__input`, set your own `line-height` as well. The segmented item's line went from `normal` to `1`, so an old padding override now lands shorter than it used to; the field's line is a fixed 20px that no longer grows with the font, so a larger font sits cramped in it.

Forced colours: under `forced-colors: active` (Windows High Contrast or any user palette) the states carried only by a fill, a shadow or a gradient — checked, mixed, on, selected, pressed, the progress bar, a slider's value and thumb — repaint themselves in system colours, `!important` so a later product rule cannot put a page colour back, and the effect layers that would paint over them (glass, aurora, ink, liquid, goo, glitch) are hidden. Nothing to wire.

Motion: buttons, icon buttons, chips, segmented and pagination items squash a little while held, the switch knob stretches, a check or radio box shrinks, a slider thumb grows; each springs back when let go (`--sl-motion-spring`). Transitions only, never a keyframe; tabs, nav items, list rows, fields and cards don't move — a glass-pane card only sinks a hair (a third of the swell). Glass control panes press with the same squash, and a wrapper's `--slfx-pane-swell: 1` still stands them down. Reduced motion stops it all.

**0.27.1 — entrances, selection, scrollbars.** All additive; no class or token changed.

- `.sl-dialog` opened with `showModal()` rises 6px and fades in with its backdrop, and falls back as it closes where `overlay` is supported (elsewhere it closes at once); `.sl-tooltip` rises 4px as it fades in. `@starting-style` and transitions on `--sl-motion-mid` / `--sl-motion-ease`, no keyframes, on the `translate` property so your own `transform` still composes. Reduced motion zeroes the tokens, and a browser without `@starting-style` simply shows them. A closed `sl-dialog` is transparent: show one with `open`, not with a `display` of your own.
- `.sl-pagination__item:hover` takes the one control edge (`--slc-edge-control-hover`) instead of `--slc-border`.
- `::selection` is a 24% wash of the accent with the text set to its ground's `--slc-text` (≥ 8:1 in light, dark, high contrast and inside `.sl-invert`). It weighs (0,0,1): your `.x::selection` wins, and so does a bare `::selection` loaded after the kit. An ink block of your own that does not re-derive `--slc-text` would select ink on ink — re-derive it, as `.sl-invert` does.
- The page's own scrollbar is thin, with a `--slc-edge-control` thumb and no track (`:root`, zero specificity, not on high contrast). `<body>` hands `scrollbar-color: auto` back to everything inside it, so inner scrollers keep their own look and hand-drawn `::-webkit-scrollbar` rules keep working (Chromium 121+ ignores them under a non-auto `scrollbar-color`).

Navigation & state: `.sl-breadcrumb` (`__item` / `__sep`), `.sl-btn-group`, `.sl-segmented` (`__item`; `aria-selected` for views, `aria-pressed` for a setting), `.sl-chips` / `.sl-chip` (`__count`; a multi-select filter row driven by `aria-pressed`), `.sl-progress` (`__bar`, `--success`/`--danger`; set `aria-valuenow` and `--sl-progress`), `.sl-icon-btn` (`--round`, `--danger`), `.sl-pagination` (`__item`), `.sl-empty` (`__title` / `__body`), `.sl-skeleton`, `.sl-stat` (`__value` / `__label`).

Identity & media: `.sl-wordmark` (`__dot`), `.sl-lockup` (`__dot`), `.sl-monogram`, `.sl-figure` (`__media` / `__caption`), `.sl-avatar` (`--sm` / `--lg`).

Patterns (page-level composition, shipped classes since 0.10.0): `.sl-wrap`, `.sl-prose`, `.sl-header`, `.sl-invert`, `.sl-hgrid`, `.sl-section` (`__head` / `__idx`), `.sl-anchor`.

App structure: `.sl-nav` (`__group` / `__item` / `__count`; current item via `aria-current`), `.sl-list` (`__row` / `__meta`, `--dense`; selection via `aria-selected` or `aria-current`), `.sl-disclosure` (`aria-expanded`), `.sl-kv` (a `<dl>`), `.sl-resizer` (`--horizontal`; `role="separator"`, the drag is the consumer's).

Complex (composed shells — no behaviour JS; the consumer wires interaction): `.sl-callout` (`--success`/`--warning`/`--danger`/`--info`), `.sl-table` (`--numeric`; wrap in an `overflow-x:auto` container), `.sl-dialog` (visual shell for the native `<dialog>` — drive with `.showModal()`/`.close()`), `.sl-tabs` (`__list`/`__tab` — supply your own ARIA + panel switching), `.sl-tooltip` (CSS-only via `data-sl-tooltip`), `.sl-toast-stack` (`__live`) / `.sl-toast` (0.33; `__timer` 0.34; the consumer adds, times and removes toasts).

Workbench (`workbench.css`, opt-in since 0.33; inside an `sl-invert` band only `.sl-term-block`): `.sl-titlebar` (0.34; `__l` / `__menu` / `__mark` / `__dot` / `__crumb` / `__sep` / `__cmd` / `__cmd-text` / `__keys` / `__r` / `__btn` / `__btn--dot`), `.sl-pane` (`[data-lit]`; its light is `--slc-lit-wash` / `--slc-lit-tint` / `--slc-lit-drop`), `.sl-statusbar` (`--separators`; `__item` / `__value` / `__sep` / `__dot` / `__spacer`), `.sl-activitybar` (`__item` / `__badge`), `.sl-tree` (`--guides`; `__row` / `__twisty` / `__label`; `--sl-tree-level` past level 8), `.sl-palette` (`__head` / `__input` / `__list` / `__group` / `__row` / `__label` / `__meta` / `__keys` / `__foot`), `.sl-term-block` (`[data-exit]`; `__head` / `__cmd` / `__prompt` / `__meta` / `__exit` / `__out`).

### Colour contract — role-vars (`--slc-*`)

Components never read theme tokens directly (those resolve only under `[data-sl-theme]`). They read role-vars that default through a fallback chain to the `--sl-*` token, then to a brand literal. **Tier A** products (full `data-sl-theme`, e.g. spexr, daos) need zero wiring — the role-vars pick up the live theme automatically. **Tier B** products (value-pinned, e.g. introspect) map the role-vars **once** to their own colour layer. That block is the *entire* integration surface:

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
  /* optional (0.31): Lumen's own rungs; unmapped, the tile is your raised,
     the well your surface, the lit line a white 8% hairline */
  --slc-tile:           var(--your-tile);           /* neutrals.json bg-tile */
  --slc-sunken:         var(--your-sunken);         /* neutrals.json bg-sunken */
  --slc-lit:            var(--your-lit);            /* neutrals.json border-lit */
}
```

**Derived roles — never map these.** Two families are computed from the ones above, so a Tier B product gets them in its own colours for free:

- `--slc-accent-text` is the accent as text or a thin line: `oklch(from var(--slc-accent) min(l, var(--sl-accent-text-lmax, 1)) c h)`. On the light theme the accent is a *fill* and the cap (`0.46` since 0.29, `0.5` before) darkens it until it reads at 4.5:1; elsewhere it is the accent. Links, tags, tabs, pressed labels and the focus ring use it. On a solid status fill use `--slc-on-success|warning|danger|info` instead of `--slc-on-accent`: each picks the pole that contrasts with its own fill (white on the light theme, near-black on the dark), where the accent's partner can be dark on dark. Inside `.sl-invert` the ground is the theme's ink — light on the dark and high-contrast themes — so the band re-derives it with its own cap, `--sl-accent-band-text-lmax` (0.45 there, none on light), and a fixed floor (oklch L 0.68) that lifts a dark product hue on the light theme's band. The band also derives `--slc-success-text` / `-warning-` / `-danger-` / `-info-text` (status as text or a thin mark, same floor and cap) and its own translucent `--slc-accent-subtle`; outside a band those four are unset and components fall back to the status role.
- `--slc-edge-*` (`ground`, `surface`, `raised`, `wash`, `accent`, `pressed`, `control`) is each edge as its own fill one step less bright (`--slc-shade-step`, 0.075 of oklch lightness). Every bordered component uses them instead of the neutral `--slc-border*` lines; high contrast maps them back to its drawn border, the inversion band to its re-derived neutrals.

**Light-layer numbers (Tier B).** The kit sets three numbers only on `:root[data-sl-theme="light"]` and the light theme file, which a `[data-theme]` layer never matches, because they cannot be read off the colours themselves. Set them in your light layer, on the root element (the role-vars resolve there):

```css
:root[data-theme="light"] {
  --sl-accent-text-lmax: 0.46;                    /* the accent as text, capped */
  --slc-edge-accent-lmax: 0.59;                   /* the primary's edge, capped on paper */
  --slc-glow: 0.35;                               /* an accent glow reads at less on paper (0.31) */
}
```

(`--slc-edge-accent-top`, the fourth until 0.31, set the primary's lit top line; the line became a foot in 0.32 and nothing reads it. Drop it.)

**Dark-layer number (Tier B).** An inversion band on the dark theme has a light ground, and the bright accent reads on it at about 1.1:1 until it is capped. The kit's dark and high-contrast theme files set that cap; a `[data-theme]` layer must set it itself. Without it, a seam (0.33) or any accent text inside a dark band falls under 3:1:

```css
:root[data-theme="dark"] {
  --sl-accent-band-text-lmax: 0.45;               /* the accent as text inside an inversion band, capped */
}
```

**An accent that cannot carry its label (0.32).** If neither white nor the dark pole reads at 4.5:1 on your accent, register a deeper `fill` for it in `agent/accent-registry.json`. Since 0.35 a Tier A host needs nothing more: `themes/products.css` sets it as the role `--slc-accent-fill` on the product's theme blocks. A Tier B layer sets the role once, where its theme is set (your root; a subtree works for the kit's controls too), from `neutrals.json` → `products.<id>.fill.<light|dark>`:

```css
[data-theme="light"], [data-theme="dark"] { --slc-accent-fill: var(--your-fill); }   /* neutrals.json products.<id>.fill */
```

The primary, a checked check, radio or switch and any count badge you draw with `var(--slc-accent-fill, var(--slc-accent))` take it, with its label (`--slc-on-accent-fill`), its hover and press (`--slc-accent-fill-hover|active`) and its edge (`--slc-edge-accent`). Unset, all of them are the accent's own. Those public roles compute on `:root`, so a badge of yours follows a root fill only; the kit's controls derive theirs on themselves and follow a fill or an accent set at any scope. Never re-bind `--slc-accent` on a component for this: the accent still drives links, tags, the ring and selection.

The control edge needs nothing: its extra half step on a light surface is read from the surface. Your neutrals (`--your-canvas`, `--your-text`, the borders, the overlay) come from `neutrals.json` → `products.<id>.<light|dark>`.

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

Five additive families, each carrying one meaning, composed onto a shipped `.sl-*` class — never replacing it. **Glass** (`sl-fx-glass`) — the element's own border as chrome; with `--pane`, the element is made of glass: a slab of light under the label, a glint that follows the pointer, a hairline that turns to face it with a fringe of colour either side. A glass text button takes `--pane`, whatever its variant, and the material owns its depth (0.32: the primary's foot, the secondary's cast and a field's well stand down, and the glass edge carries the focus halo); with `--text` the letterform itself is the pane — a mask cuts the glass to the element's own glyphs, measured off the element, so the type stays entirely the surface's. **Aurora** (`sl-fx-aurora`) — a 1px arc of light riding the border while attention lives on the element: focus, `data-sl-fx-live="on"` (one ambient sweep per document), `data-sl-fx-live="busy"` (with `aria-busy`), or a determinate arc from an inline `--slfx-progress` (with `role="progressbar"`). **Liquid** (`sl-fx-liquid`) — the outline gives under the pointer and springs back; gated behind `--drop`, a round icon-only button and nothing else, and inert without it. **Goo** (`sl-fx-goo` on a container + `sl-fx-goo__member` on each element in the set — standard elements only; `button`, `input`, `select`, `textarea` and `a[href]` are refused) — several elements read as one substance, welding where they come within `--slfx-goo-weld` of one another; it answers the layout, not the pointer, and each member's silhouette is painted in that member's own fill so their colours blend across the neck. **Glitch** (`sl-fx-glitch`) — a finite burst on a child `<span>`, fired from JavaScript.

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
| `--slfx-pane-swell` | a glass pane, **or any ancestor of it** | `1.03` | on a control pane (button, icon button, chip, segmented or pagination item) it scales the kit squash (k = (swell − 1) / 0.03); on any other pane it drives the uniform press sink, a third of the swell the other way (0.99 at the default). `1` stands either down. The hover growth this used to drive retired in 0.13 with `sl-fx-press`. Set it to `1` on a wrapper that scales the pane itself — otherwise the two scales compose and the pane's seated light spills past its edge. |
| `--slg-lens-disperse` | a lens host | `18` | the lens's red-to-blue separation, in px. Not raised in the default because it applies to everything behind the pane — at 60 the page's own text splits into visible RGB copies — so raise it per surface. |
| `--slg-lens-reach` | a lens host | `6` (`18` on an aurora host) | how far the lens is allowed to bend. The box caps it too, at a sixth of its shorter side, so a 32px control bends at most ~5.3px whatever this asks; a lens nested inside another glass pane is refused and keeps the material. |
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
