# Workflow — Author a new Sondalab surface

> **What this file is:** the ordered procedure an agent follows to author a *new* interface or element that is Sondalab-compliant from the first line, using the component catalog. Companion to `migrate.md` (which brings an *existing* surface into compliance).
> **Reads:** `catalog.md` + `catalog.json` (components), `../design-language.md` (grammar), the token CSS (`../../tokens.css` + `../../themes/*.css`, the values), `substrate-matrix.json` (what's Required for the substrate), `sl-audit` (verdict).
> **Invariant:** authoring is greenfield, so the audit should pass on the *first* run — compliance is built in, not retrofitted. If your first audit is dirty, you bound a colour to a literal instead of a role-var.

## Steps

### 0 — Classify substrate
Decide the substrate (**IDE** / **App** / **Page** / **Term**) and the product (for its accent). The substrate's Required column in `substrate-matrix.json` is your checklist of what this surface must have.

### 1 — Choose components from the catalog
For each part of the screen, pick the matching entry from `catalog.md`. Prefer the ready primitives (`sl-*` classes) over hand-rolled markup; reach for the signature patterns (sticky header, inversion band, hairline grid, section index, oversized anchor) to carry the family look. `catalog.json` is the machine index if you need to list what exists.

### 2 — Compose (spend the surprise here)
Assemble the components into a layout. Family resemblance comes from the shared materials (the catalog); distinctiveness comes from composition — every screen needs **≥1 unexpected, intentional layout decision** (an asymmetric split, an oversized anchor, a full-bleed inversion). A generic centred card grid fails the house rule; a second accent or a new type scale fails the grammar. Spend boldness on layout, keep materials shared.

### 3 — Bind role-vars per tier
- **Tier A** (greenfield is the common case): consume `@sondalab/ui-kit` `components.css` + a theme (`themes/*.css`) under `data-sl-theme`. Components resolve their `--slc-*` role-vars automatically. An IDE or console surface also imports `workbench.css` after `components.css` (0.33: panes, the status bar, the activity bar, the tree, the palette, the terminal block). For any product but the default, also load `themes/products.css` and set `data-sl-product="<id>"` on the element that carries `data-sl-theme` (or an ancestor of it), so the neutrals take the product's hue; one product per theme subtree.
- **Tier B** (you have an existing colour layer): map each `--slc-*` role-var to a value that resolves to a Sondalab token or your registered accent; the neutrals come from `neutrals.json` → `products.<id>`. Never bind a component to a literal. Set the light-layer numbers listed in the README's Tier B recipe (`--sl-accent-text-lmax`, `--slc-edge-accent-lmax`, `--slc-glow`). If your accent cannot carry a label at 4.5:1 (white on it, or the dark pole), set `--slc-accent-fill` to your registered `fill` once, on the root: never re-bind `--slc-accent` on a component.

### 4 — Audit + judgement pass
Run the audit (must be clean on greenfield):
```sh
npx sl-audit --surface "<glob>" --product <name>
```
Then the judgement pass the script can't do (delegate to `sl-ds-auditor` or do it yourself against `design-language.md`, scoped to the substrate's Required rules): are the structural mono labels present (eyebrow, section index)? Is there real content, not filler? Is the editorial voice precise/active (L5)? See `HANDOFF.md` for what is judgement vs mechanical.

### 5 — Effects
Once the surface is composed and compliant, apply the effects layer. This is a real step, not a flourish: the families are how a Sondalab surface reads as *material* rather than as a flat theme, and a screen that ships without them is half the design system.

1. **Wire the runtime first.** Read `catalog.md` § *Turning effects on* and do what it says — the imports (`effects.css`, and `glass.css` for the glass family), `mount()`, and `await mountGpu()` if the surface wants Tier 2. Classes without the JS render Tier 0 silently, and the audit's check 8 will fail you for it.
2. **Take the canonical string, don't invent a declension.** `catalog.md`'s canonical-strings table already binds which family goes on which component. Copy the string.
3. **Judge what the table does not cover.** Goo, glitch, and the ambient/busy/determinate aurora readings are never applied by rote — see the note under the table. Each family carries exactly one meaning; an effect that means nothing is switched off, and the budget is `design-language.md` L6.
4. **For glass, place the pane before you tune it.** `catalog.md` § *Glass pane* — a pane over flat ground shows nothing no matter what you set. If there is no content behind the surface, that is a composition problem, not a parameter problem.

Skip a family when no meaning fits. Skipping *all* of them on an App or Page substrate is a decision to justify, not a default.

### 6 — Visual check
Render across the applicable themes (light / dark / high-contrast); verify reduced-motion and that active/pressed states show the accent, not a neutral. In high contrast every family is off and the GPU field is torn down: each component must still be legible and complete. A cell that only makes sense with its effect running is a defect this pass exists to find.

If you touched glass or the lens, do not sign it off by eye — `HANDOFF.md` § *How to verify an effect*.

## Output
A new surface that passes `sl-audit` clean, satisfies its substrate's Required rules, and reads as Sondalab through the shared components — with its one intentional composition surprise.
