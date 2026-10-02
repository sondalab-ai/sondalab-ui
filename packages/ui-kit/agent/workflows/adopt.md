# Workflow — Adopt a single Sondalab component

> **What this file is:** the ordered procedure for pulling **one** Sondalab component or signature pattern into an existing app **without** a full migration — the lightest of the three workflows. Companion to `migrate.md` (whole-surface compliance) and `author.md` (greenfield).
> **Reads:** `catalog.md` + `catalog.json` (the component), `../design-language.md` (grammar), `substrate-matrix.json` (substrate applicability), `sl-audit` (verdict, scoped to the touched file).
> **Invariant:** adopt touches only what it adds. The rest of the app is out of scope — do not audit or "fix" surrounding code. The change is small and reversible; the gate is showing the diff, not a full migration plan.

## When to use this (vs migrate)

Use adopt when the ask is "add a Sondalab eyebrow/tag/inversion band here", "give this header the house look", "use the DS button on this one screen" — a taste of the family look, not a wholesale adoption. If the ask is "bring this app onto the DS", that is `migrate.md`.

## Steps

### 0 — Identify the component and the host
Pick the target from `catalog.md` (a primitive like `sl-tag`, or a signature pattern like the inversion band). Note the host app's **substrate** and **tier** — an adopted component must honour the host's tier: on a Tier-B app you bind the component's `--slc-*` role-vars to the app's local colour layer; you do not switch the app to `data-sl-theme`.

### 1 — Bind, don't fork
Copy the component's markup from `catalog.md`. Resolve its `--slc-*`/`--sl-*` role-vars to the host's existing values — every one must resolve to a Sondalab token or the host's registered accent (Tier-B rule). If the host lacks a role-var the component needs, define it once, mapped to a Sondalab value. Never bind the component to a raw literal.

### 2 — Insert
Place the component in the host markup. Keep the change minimal and localised — one component, the files it touches, nothing else. Match the host's existing structure and naming.

**If the component's canonical string carries an effects declension, carry it too.** `catalog.md`'s canonical-strings table is the contract: a text button is `sl-btn sl-btn--primary sl-fx-glass sl-fx-glass--pane`, and adopting it without the `sl-fx-*` half adopts a different component. Two consequences for an adopt, which is the workflow most likely to get this wrong because it touches so little:

- **The effect classes need the runtime.** `catalog.md` § *Turning effects on* — the host must import `effects.css` (plus `glass.css` for the glass family) and call `mount()` once. If the host has no such call, adding one is part of the adopt, not out of scope.
- **If you cannot wire it, drop the effect rather than shipping dead classes.** A host that genuinely cannot run the JS takes the plain component. Say so in the diff; do not leave `sl-fx-*` classes rendering Tier 0 and call it adopted.

For glass specifically, check what sits behind the insertion point before you use it — a pane over flat ground shows nothing (`catalog.md` § *Glass pane*).

### 3 — Audit the touched file only
```sh
npx sl-audit --surface "<the one file you edited>" --product <host> --substrate <host substrate>
```
The **added** component must contribute zero R-violations. Pre-existing findings elsewhere in the file are **not** yours to fix in an adopt — note them (they are migrate's job) but leave them. Populate `blessed/<host>.json` only for a deviation your added component legitimately needs.

### 4 — Judgement check (the one component)
Against `design-language.md`, scoped to just what you added: does the eyebrow read as a micro label (mono, uppercase, 10.5px, `0.06em`) and the tag as mono in sentence case, with every control you added in sentence case (L1)? Does an adopted inversion band avoid an alpha-on-canvas hairline inside it? Is the copy in the component precise/active (L5)? See `HANDOFF.md` for judgement vs mechanical.

### 5 — Show the diff
Present the diff (it is small). No full migration plan — the change is localised and reversible. Render the touched screen across the host's themes to confirm the component sits right; in high contrast every effect family is off, so the component must still read complete. If you adopted a glass component, do not sign it off by eye — `HANDOFF.md` § *How to verify an effect*.

## Output
One Sondalab component living correctly in the host app, bound to the host's colour layer, carrying its effects declension with the runtime wired (or the effect deliberately dropped and said so), auditing clean for what it added — the rest of the app untouched.
