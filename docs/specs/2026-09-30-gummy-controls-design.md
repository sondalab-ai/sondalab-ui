# Gummy controls — tactile spring motion on every control, and a slider

> **What this file is:** the design spec for giving the kit's controls a small, physical "gummy" response to being pressed, and for adding a slider component (`sl-slider`). Audience: whoever implements it in `@sondalab/ui-kit`, and reviewers of the kit. Owner: the Sondalab design system owner. Companion files: the throwaway probe `lab/gummy.html` (git-ignored; the "Quiet — final" column is this spec, rendered), and the implementation plan that follows this spec in `docs/plans/`.

## Intent

The owner, 2026-09-30: *"can we introduce motions into the elements? E.g. a slight bump to the toggle, like if they are gummies, same for buttons and sliders"*. After trying three strengths side by side (quiet / springy / gummy), the owner chose **Quiet**, with one change: *"the slider should scale up not only squash"*.

**Success looks like:** pressing any control feels like pressing something soft — it gives a little under the finger and springs back with one small overshoot — in every product, with no JavaScript, no new token, and nothing moving for a visitor who asked for reduced motion.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Built into `components.css`, on by default for every control; not an opt-in effect class. | Owner's pick. The motion is part of how a control behaves, not a decoration. |
| 2 | Strength: **Quiet** — a 2% squash while held, released on the kit's existing spring (`--sl-motion-spring`, one ~5% overshoot). | Owner's pick. The existing token is used as-is: no new token, so no palette-py release, and the switch knob already travels on it. |
| 3 | **Squash and stretch, volume kept:** a held control is `scale(1 + s, 1 − 1.6·s)` with `s = 0.02` — slightly wider, slightly shorter. | The "gummy" read comes from the non-uniform scale; a uniform shrink reads as a click, not as something soft. |
| 4 | **No keyframe "pop" on a state change.** The pop the demo showed on toggling is the spring-back on release. | A keyframe tied to `:checked` / `aria-pressed` also runs when the page loads, on every checked box and pressed chip. The release spring gives the same feel without that. |
| 5 | **Transform only**, and only `transition`, reading the motion tokens. | The tokens are zeroed under `prefers-reduced-motion`, so every piece stops there with no extra rule (L4, "respect reduced motion"). Transforms never reflow a layout. |
| 6 | Add **`sl-slider`**: a styled native `<input type="range">`. Its thumb **grows** when hovered (×1.1) and **grows and flattens** when grabbed (`scale(1.35, 1.22)`). | Owner: the slider scales up, not only squashes. |

## Behaviour per control

All presses go down quickly on `--sl-motion-fast` with `--sl-motion-ease`, and come back on `--sl-motion-slow` with `--sl-motion-spring` — the pattern `sl-fx-press` already uses ("going down is quick and plain; the spring is for the way back").

| Control | While held (`:active`) | On release |
|---|---|---|
| `sl-btn` (every variant), `sl-icon-btn`, `sl-chip`, `sl-segmented__item`, `sl-pagination__item` | `scale(1.02, 0.968)` | springs back, one small overshoot |
| `sl-switch` | the knob stretches toward the side it will travel to: width 0.75rem → 0.825rem, rounded ends; when checked it grows leftward (the knob sits on the right) | the knob springs across (as today) |
| `sl-check`, `sl-radio` | the box shrinks to `scale(0.96)` | springs back; a newly checked box overshoots slightly, which is the "pop" |
| `sl-slider` thumb | hover `scale(1.1)`; grabbed `scale(1.35, 1.22)` | springs back to its size |

Not moved: disabled controls (`:not(:disabled)`), links, tabs, fields, list rows, nav items, cards. A tab or a list row is a selection, not a button.

## The slider — `sl-slider`

A native range input, so keyboard, screen readers and touch work unchanged.

```html
<input class="sl-slider" type="range" min="0" max="100" value="40"
       aria-label="Volume" style="--sl-slider-value: 40%"
       oninput="this.style.setProperty('--sl-slider-value', this.value + '%')">
```

- **Track:** 4px, pill, `color-mix(in srgb, var(--slc-text) 12%, transparent)`; the filled part is `--slc-accent`. Firefox paints the fill itself (`::-moz-range-progress`). Chromium and Safari have no fill pseudo-element, so the fill comes from `--sl-slider-value`, which the consumer writes on `input` — the same contract as `sl-progress`'s `--sl-progress`. Without it the track shows unfilled; nothing breaks.
- **Thumb:** 1.1rem, round, filled with the page's **light pole**, `oklch(from var(--slc-canvas) max(l, 1 - l) 0 h)` — near-white on light, light grey on dark (about 13:1 on the dark canvas), white on high contrast — with its own fill in shade as the edge (three shade steps) and `--slc-shadow-sm`. Not `--slc-raised`: on dark that is the page's own near-black, and the owner found the thumb *"hard to see"* there (2026-09-30).
- **Focus:** the focus ring goes on the thumb (`::-webkit-slider-thumb`, `::-moz-range-thumb`), since the input's own outline would ring the whole track.
- **High contrast:** the track gets the theme's border, like the progress track.
- **Catalog:** new entry `slider` (interactive; focus-ring coverage), with a `Consumes:` line; README class list.

## Interaction with the effects layer

- `sl-fx-press` already sinks its host with a uniform `scale(0.965)` on `:active`. It changes to the same squash as the base (`scale(1.02, 0.968)`), so a control moves the same way with or without the effects layer; the press **light** stays the effect's job. Its guard test is updated to the new value.
- The glass lens and the liquid measure their host's box. A 2% transform for the duration of a press is below what either redraws on; the implementation checks this on the effects showcase (`showcase/effects.html`) rather than assuming it.
- The switch knob's travel and the press squash both use `transform`. The knob is the track's `::after`, the squash is on the host or the track, so they never compete for one property on one element.

## Accessibility

- Reduced motion: every duration is a motion token, zeroed by `tokens.css`; the controls still change state instantly. A test asserts no literal duration and no `animation` in the new rules.
- No motion carries meaning: the pressed/checked state is still drawn by colour, fill and glyph (unchanged).
- The squash never changes the hit area in a way that moves a target away from the pointer (2%).

## Testing

- `components-token-scope.test.mjs`: the existing "component motion reads the motion tokens" test covers the new transitions; add a test that the squash rules use `transform` only and declare no `animation`.
- `focus-ring.test.mjs`: the slider joins the focus ring via its thumb (the test learns the thumb selector).
- `catalog-audit.test.mjs`: the new `slider` entry, its snippet and `Consumes:` line.
- `effects-guards.test.mjs`: the press sink value.
- A headless probe of the showcase in light, dark and high contrast, with reduced motion forced, to confirm nothing is left mid-transform.

## Release

`@sondalab/ui-kit` **0.25.0** (minor: a new component, `sl-slider`). No token change, so `palette-py` does not move. Then bump spexr, introspect and sondalab-site (site deploys on merge); daos and local-agents take it from the CDN (daos is pinned to `@0.24` — its pin moves to `@0.25`).

## Out of scope

- A drag-velocity stretch on the slider thumb (needs JavaScript).
- Keyframe pops on state change (Decision 4).
- The stronger "springy" and "gummy" strengths, and any per-product strength knob.
