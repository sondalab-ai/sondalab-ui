# Sondalab Design Language — Pass 1 Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is a **visual/CSS** plan, so the classic red-green TDD cycle is adapted: each task ends with a *build/lint gate* (must pass) plus a *visual checkpoint* (the owner confirms the look). There are no unit tests for "reads as Sondalab"; do not fabricate them.

**Goal:** Apply the Sondalab Design Language (family-resemblance grammar) to the three pass-1 surfaces so they read as one package: build the sondalab-ui showcase, re-baseline daos landing, and extend introspect beyond its type swap.

**Architecture:** Each surface adopts the language at its substrate's compliance level (see the matrix in `design-language.md`). Colour reaches products via the two-tier selector policy: showcase = Tier A (`data-sl-theme`, full theme layer); daos + introspect = Tier B (own `[data-theme]` layer, values pinned to Sondalab). No new `--sl-*` tokens are introduced.

**Tech Stack:** Static HTML + generated `@sondalab/ui-kit` CSS (showcase, daos); Vite + React + CSS custom properties (introspect).

**Spec:** `sondalab-ui/docs/design-language.md` (family-resemblance rules) — the plan argues from it. Token contract: `sondalab-ui/docs/design-system-spec.md`.

## Global Constraints

- **Two-tier selector policy.** Showcase adopts `data-sl-theme` + `themes/*.css` (Tier A). daos and introspect keep their `[data-theme]` colour layer (Tier B); every colour value in that layer must equal a `sondalab.tokens.json` value or an accent-registry value.
- **Accent registry.** daos → amber `#B56A0C`/`#F5A83C` (subtle `rgba(197,122,22,0.12)`/`rgba(245,168,60,0.16)`); introspect → cyan `#2ee6c0` (kept; registered accent, not required to match `depth`); showcase → Sondalab default amber.
- **No new tokens.** `--sl-measure` (~63ch), `--sl-gutter` (fluid clamp), and the oversized-display clamp are product-local conventions, not tokens. Adding a real token requires regen + `check-drift.yml` + dual bump of `packages/ui-kit/package.json` and `packages/palette-py/pyproject.toml` — out of scope here.
- **Fonts.** Roles: display `--sl-font-display` (Fraunces), sans `--sl-font-sans` (Instrument Sans), mono `--sl-font-mono` (Martian Mono). introspect keeps IBM Plex Mono for its `ch`-clamped grids (blessed `adapt`); the mono substitution never touches the sans/display roles.
- **Reduced motion** comes from the token layer; never bypass it.
- **English** for all product copy and identifiers.
- **Self-containment.** daos landing is published as a standalone artifact — it must stay a single self-contained HTML file (inline the shared tokens; no external CSS import, Google Fonts excepted).

## Neutral & accent mapping (Tier B surfaces)

Canonical values from `sondalab.tokens.json`. Both daos and introspect pin to these.

| Role | Sondalab light | Sondalab dark |
|---|---|---|
| canvas (page bg) | `#ECE4D4` | `#070A0D` |
| surface (card base) | `#F6F1E6` | `#0F151A` |
| surface-raised (floating) | `#FFFFFF` | `#131C23` |
| text-primary / ink | `#15211F` | `#DAE3E4` |
| text-secondary | `#475754` | `#9AA9AD` |
| text-muted | `#6E7B78` | `#6E8088` |
| border-subtle | `rgba(21,33,31,0.09)` | `rgba(218,227,228,0.07)` |
| border-default | `rgba(21,33,31,0.16)` | `rgba(218,227,228,0.13)` |
| accent (daos) | `#B56A0C` | `#F5A83C` |
| accent-subtle (daos) | `rgba(197,122,22,0.12)` | `rgba(245,168,60,0.16)` |

---

## File Structure

- **Create:** `sondalab-ui/showcase/index.html` — self-contained showcase; imports `../packages/ui-kit/tokens.css` + `../packages/ui-kit/themes/*.css` relatively (Tier A).
- **Modify:** `daos/docs/daos-landing.html` — palette vars, font imports, accent → registry (Tier B, single file).
- **Modify:** `introspect/web/src/theme.css` — pin neutrals to Sondalab, add mono-label/hairline/section utility classes.
- **Modify:** `introspect/web/src/components/*.tsx`, `introspect/web/src/pages/*.tsx` — apply signature header, mono structural labels, section indices, editorial copy (scoped in Task 4).

---

## Task 1: sondalab-ui showcase page

**Files:**
- Create: `sondalab-ui/showcase/index.html`

**Interfaces:**
- Consumes: generated `sondalab-ui/packages/ui-kit/tokens.css` and `themes/{light,dark,high-contrast}.css`.
- Produces: the visual reference proving L1–L4 against `design-language.md`; nothing imports it.

**Status target:** PoC implemented (not delivered).

- [ ] **Step 1: Scaffold the page (Tier A).** Create `showcase/index.html` with `<!doctype html>`, `<html data-sl-theme="dark">`, and in `<head>` link the generated CSS relatively:
  ```html
  <link rel="stylesheet" href="../packages/ui-kit/tokens.css">
  <link rel="stylesheet" href="../packages/ui-kit/themes/light.css">
  <link rel="stylesheet" href="../packages/ui-kit/themes/dark.css">
  <link rel="stylesheet" href="../packages/ui-kit/themes/high-contrast.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Instrument+Sans:wght@400;500;600&family=Martian+Mono:wght@400;600&display=swap">
  ```
  Body uses `background: var(--sl-bg-canvas); color: var(--sl-text-primary); font-family: var(--sl-font-sans);`.

- [ ] **Step 2: Theme + accent switcher.** Add a mono uppercase control (top-right) that cycles `data-sl-theme` across `light/dark/high-contrast`, and a second control that swaps a local `--demo-accent` across the registry hues (amber/indigo/cyan) so the page demonstrates per-product accent on shared grammar. Persist choice in `localStorage` (wrapped in try/catch).

- [ ] **Step 3: L1 type specimen.** Render: an oversized display anchor (Fraunces, `clamp(2.7rem,1.6rem+5vw,5.4rem)`), the heading scale (`--sl-text-2xl`→`--sl-text-xs`), a mono eyebrow + a `63ch` body paragraph. Label each with its token name in a mono caption.

- [ ] **Step 4: L2 structure specimen.** Render a hairline-grid (`display:grid; gap:1px; background:var(--sl-border-subtle)`) of 3–4 cells each painting `--sl-bg-surface`, a section separated by a `1px` top rule with a mono `sec-idx`, and a gutter ruler.

- [ ] **Step 5: L3 signature components.** Render each of: eyebrow, tag/tier marker (accent tint + dot), inversion band (ink bg / paper text), sticky translucent header (already the page header), and a real-content mono block on the ink surface. Each with a mono caption naming it.

- [ ] **Step 6: L4 motion.** Add a staggered rise entrance (`translateY(6px)`+opacity on `--sl-motion-mid`, nth-child delays) to the L3 component row; confirm it zeroes under `prefers-reduced-motion` (inherited from tokens).

- [ ] **Step 7: Gate + checkpoint.** Open the file in a browser. Verify: all three themes render legibly (no colour defined only in a media/`[data-theme]` block), fonts load, no horizontal body scroll. **Owner visual checkpoint.**

- [ ] **Step 8: Commit** (sondalab-ui repo).
  ```bash
  git -C sondalab-ui add showcase/index.html
  git -C sondalab-ui commit -m "feat(showcase): design-language reference page (PoC, not delivered)"
  ```

---

## Task 2: Re-baseline daos landing

**Files:**
- Modify: `daos/docs/daos-landing.html`

**Interfaces:**
- Consumes: the neutral & accent mapping table above.
- Produces: daos on Sondalab values (Tier B); the amber reference product.

**Status target:** the aesthetic is already correct; this pins values + fonts. Low risk.

- [ ] **Step 1: Add fonts.** At the top of the `<style>` block, add the Google Fonts `@import` for Fraunces, Instrument Sans, Martian Mono (same families as Task 1). Keep the existing system stacks as fallbacks.

- [ ] **Step 2: Define shared type vars inline.** In `:root`, add `--sl-font-display: "Fraunces", Georgia, serif; --sl-font-sans: "Instrument Sans", system-ui, sans-serif; --sl-font-mono: "Martian Mono", ui-monospace, Menlo, monospace;`. Keep `--font-mono`/`--font-sans` as aliases pointing at the new vars so existing rules resolve.

- [ ] **Step 3: Pin the light palette.** In the `:root` and `:root[data-theme="light"]` blocks, replace the daos hex with the mapping table's *light* column: `--paper`→`#ECE4D4`, `--raised`→`#FFFFFF`, `--ink`→`#15211F`, `--strong`→`#475754`, `--mid`→`#6E7B78`, `--rule`→`rgba(21,33,31,0.09)`, `--rule-2`→`rgba(21,33,31,0.16)`, `--research`→`#B56A0C`, `--research-soft`→`rgba(197,122,22,0.12)`. Add a `--surface: #F6F1E6;` tier for card bases. `--soft` stays local (faint text, no Sondalab equivalent).

- [ ] **Step 4: Pin the dark palette.** In `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`, apply the *dark* column: `--paper`→`#070A0D`, `--raised`→`#131C23`, `--ink`→`#DAE3E4`, `--strong`→`#9AA9AD`, `--mid`→`#6E8088`, `--rule`→`rgba(218,227,228,0.07)`, `--rule-2`→`rgba(218,227,228,0.13)`, `--research`→`#F5A83C`, `--research-soft`→`rgba(245,168,60,0.16)`, `--surface: #0F151A;`.

- [ ] **Step 5: Adopt display + body faces.** Point `h1,h2,h3` at `var(--sl-font-display)` (Fraunces) and `body` at `var(--sl-font-sans)` (Instrument Sans). Keep the mono structural labels on `var(--sl-font-mono)`.

- [ ] **Step 6: Mono-face width check.** Load the page; inspect the dense mono blocks (`.artifact`, `#proof .canon`, `.vrow`). If Martian Mono overflows their `ch`/grid widths, revert *only those blocks* to `ui-monospace` (documented `adapt`) while labels keep Martian. Note the decision in an HTML comment.

- [ ] **Step 7: Gate + checkpoint.** Confirm light + dark + `prefers-color-scheme` all render; no colour only-in-media-block regression; file still self-contained (no external CSS beyond Google Fonts). **Owner visual checkpoint** (compare against pre-change screenshot).

- [ ] **Step 8: Commit** (daos repo).
  ```bash
  git -C daos add docs/daos-landing.html
  git -C daos commit -m "feat(landing): re-baseline palette + type onto Sondalab tokens"
  ```

---

## Task 3: introspect — pin neutrals (colour)

**Files:**
- Modify: `introspect/web/src/theme.css`

**Interfaces:**
- Consumes: the neutral mapping table (introspect keeps cyan `#2ee6c0`).
- Produces: introspect neutrals value-equal to Sondalab; unblocks Task 4's structure work.

- [ ] **Step 1: Pin dark neutrals.** In `:root`, set `--bg: #070A0D;` (was `#06070a`) and `--txt: #DAE3E4;` (was `#cdd9e1`), `--mut: #6E8088;` (was `#52656f`). Leave `--cy`/`--cy2` (accent) and the glass/jv vars.

- [ ] **Step 2: Pin light neutrals.** In `:root[data-theme="light"]`, set `--bg: #ECE4D4;` (was `#e9e5db`), `--txt: #15211F;` (was `#2c3138`), `--mut: #6E7B78;` (was `#837c6e`).

- [ ] **Step 3: Reconcile `--line`.** Set `--line` to a Sondalab border value resolved solid over canvas — dark `#1C2830`, light `#D8CEBC` (the solid equivalents already used for spexr chrome). Keep as solid (introspect draws solid rules).

- [ ] **Step 4: Gate.** `npm -C introspect/web run build` (tsc --noEmit + vite) must pass.

- [ ] **Step 5: Checkpoint.** Dev server; confirm dark + light backgrounds now read as the Sondalab warm-paper / near-black, cyan accent unchanged. **Owner visual checkpoint.**

- [ ] **Step 6: Commit** (introspect repo).
  ```bash
  git -C introspect add web/src/theme.css
  git -C introspect commit -m "feat(web): pin neutrals to Sondalab canvas/text values"
  ```

---

## Task 4: introspect — apply structure & signature (L2/L3/L5)

**Files:**
- Modify: `introspect/web/src/theme.css` (utility classes)
- Modify: the app shell (`introspect/web/src/App.tsx`) and highest-traffic pages/components for header + section indices + labels

**Interfaces:**
- Consumes: Task 3's pinned neutrals; the L1–L5 rules.
- Produces: introspect reading as a Sondalab surface, not just sharing its palette.

- [ ] **Step 1: Mono-label utility.** In `theme.css`, add a `.sl-eyebrow` class (mono, uppercase, `letter-spacing:0.2em`, `--sl-text-xs`, muted) and a `.sl-tag` class (accent tint pill + dot). These are the strongest family signal.

- [ ] **Step 2: Apply eyebrows to page/section headers.** In the app shell and the list/detail page headers, precede the primary heading with a `.sl-eyebrow` naming the section (e.g. `SESSIONS`, `LIVE`). Where a section is genuinely a sequence, add a mono numbered index; otherwise no number (structure-encodes-truth rule).

- [ ] **Step 3: Hairline structure.** Replace any heavy separators between the sidebar / rail / detail panes with a single `1px var(--line)` rule; convert any bordered-card group that is really a grid to the hairline-grid technique (`gap:1px; background:var(--line)`).

- [ ] **Step 4: Signature header.** Give the top bar the signature treatment: sticky, translucent (`color-mix(in srgb, var(--bg) 86%, transparent)` + `backdrop-filter: blur`), `1px` bottom rule, mono tracked wordmark left, mono meta/controls right.

- [ ] **Step 5: Editorial copy pass.** Sweep visible strings for marketing/vague phrasing; make labels state what they are/do, in English. (Scope to shell + top pages; not every string.)

- [ ] **Step 6: Gate.** `npm -C introspect/web run build` must pass; lint clean.

- [ ] **Step 7: Checkpoint.** Dev server; confirm introspect now reads as same-family as the showcase/daos (mono labels, hairline rhythm, signature header) while keeping its cyan data-app identity. **Owner visual checkpoint** — this is the "does it finally look different / related" gate.

- [ ] **Step 8: Commit** (introspect repo).
  ```bash
  git -C introspect add web/src
  git -C introspect commit -m "feat(web): adopt Sondalab structure, mono labels, signature header"
  ```

---

## Task 5: Cross-surface consistency sweep

**Files:** none (review only)

- [ ] **Step 1: Invariant sweep.** Open showcase, daos, introspect side by side. Verify three invariants across all three: (a) structural labels are mono/uppercase/tracked; (b) separators are `1px` hairlines; (c) each surface uses exactly one accent hue from the registry and no second chromatic accent.
- [ ] **Step 2: Value-equality spot check.** Sample canvas + primary text + a border on daos and introspect (both themes); confirm each equals its mapping-table value.
- [ ] **Step 3: House-rule check.** Confirm each surface has ≥1 unexpected composition decision (not a generic centred card grid) while keeping shared materials.
- [ ] **Step 4: Report.** Summarise pass/fail per invariant to the owner; file any residual as follow-ups (e.g. spexr L3 components, out of pass 1).

---

## Self-Review

- **Spec coverage:** L1 (Tasks 1.3, 2.5, 4.1–2), L2 (1.4, 2.3–4, 4.3), L3 (1.5, 4.4), L4 (1.6), L5 (4.5); two-tier policy (1.1 Tier A, 2/3 Tier B); accent registry (global constraint, 1.2, 2.3–4); per-substrate levels honoured (introspect mono `adapt` in 2.6/global). Covered.
- **Placeholders:** none — every step names files, values, or commands.
- **Consistency:** neutral values identical to `sondalab.tokens.json` (verified against the themes dump); accent hexes match the registry in `design-language.md`; commit uses `git -C <repo>` since the suite root is not a single git repo.
