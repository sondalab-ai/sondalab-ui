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
- **Tier A** (greenfield is the common case): consume `@sondalab/ui-kit` `components.css` + a theme (`themes/*.css`) under `data-sl-theme`. Components resolve their `--slc-*` role-vars automatically.
- **Tier B** (you have an existing colour layer): map each `--slc-*` role-var to a value that resolves to a Sondalab token or your registered accent. Never bind a component to a literal.

### 4 — Audit + judgement pass
Run the audit (must be clean on greenfield):
```sh
npx sl-audit --surface "<glob>" --product <name>
```
Then the judgement pass the script can't do (delegate to `sl-ds-auditor` or do it yourself against `design-language.md`, scoped to the substrate's Required rules): are the structural mono labels present (eyebrow, section index)? Is there real content, not filler? Is the editorial voice precise/active (L5)? See `HANDOFF.md` for what is judgement vs mechanical.

### 5 — Effects (optional layer)
Once the surface is composed and compliant, reach for effects (`catalog.md` `## Effects`) where a meaning applies — each family carries exactly one meaning, subject to the effect budget (`design-language.md` L6). Skip if no meaning fits; an effect that means nothing is switched off.

### 6 — Visual check
Render across the applicable themes (light / dark / high-contrast); verify reduced-motion and that active/pressed states show the accent, not a neutral.

## Output
A new surface that passes `sl-audit` clean, satisfies its substrate's Required rules, and reads as Sondalab through the shared components — with its one intentional composition surprise.
