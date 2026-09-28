---
slug: 2026-09-28-halftone-dots-design
title: Halftone dots — the site's dot scenes as a kit primitive
status: draft
createdAt: 2026-09-28
---
> **What this file is:** the design contract for moving sondalab-site's dot scenes (a picture resampled into a grid of round dots whose size follows the light) into `@sondalab/ui-kit`, as one engine shared by a live web runtime and a browser export page for marketing assets.
> **Audience:** the owner (approves the design), engineers and agents working a slice, reviewers.
> **Owner:** marcellobarile.
> **Companion files:** `docs/plans/2026-09-28-halftone-dots.md` (the implementation plan, written after this spec is approved); `docs/design-language.md` (the grammar); sondalab-site `docs/specs/2026-09-26-method-section-design.md` (where dot scenes were designed; its numbers have since drifted, and the site's code is the reference this spec ports).

Status vocabulary: **Shipped** = merged and published to npm; **Site-only** = exists in sondalab-site and nowhere in the kit.

## Problem

sondalab-site draws its Method and Thesis vignettes as dot halftones (`src/lib/dot-scene.ts`, 110 lines of pure maths; `src/lib/dot-scene-runtime.ts`, 140 lines of canvas and observers). The look is now part of the house style, but it is **Site-only**:

1. Another product (spexr, future surfaces) cannot use it without copying two files.
2. Marketing cannot make an asset in the same look: there is no way to turn an image into dots outside the site's page, and the site's output is not reproducible (the edge dissolve and the scatter use `Math.random`).
3. The runtime does not follow the kit's effect contract: it ignores `data-sl-fx-still`, `data-sl-fx="off"` and reduced motion, and it never disconnects its observers.

## Goal

One dot engine in the kit. A web surface gets a live dot scene from one attribute; a marketer gets an SVG or PNG from a page, and both draw the same dots for the same image, grid and seed.

## Non-goals

- **Other cell shapes.** Squares, lines, ordered dithering: owner's call 2026-09-28, dots only.
- **CRT scenes.** The site's WebGPU depth-plate scenes (`CrtScene.astro`, `crt-*.ts`, the ComfyUI plate pipeline) are not halftones and stay in the site. Their generic parts (shatter bands) are already in the kit.
- **A Node CLI.** No image decoder enters the kit's dependencies. `toSVG` is pure, so a project that wants a script can call it with pixels it decoded itself.
- **Hosting the export page.** It runs locally; deploying it is a later decision.
- **Art tooling.** The site's crop script (`make-scene-crops.mjs`, macOS `sips`) stays in the site.

## Design

### 1. Engine — `packages/ui-kit/halftone-core.js`

Pure ES module, no DOM, runs in a browser and in Node. Ported from the site's `dot-scene.ts` with its behaviour unchanged at default options.

```js
sampleDots(pixels, size, { grid = 96, invert = false, seed } = {}) → Dot[]
dotFrame(dot, t, width, grid, motion?) → { x, y, r }
toSVG(dots, { size, grid, color, background }) → string
```

- `pixels` is RGBA bytes of a `size`×`size` square picture (callers sample at `2 × grid`, as the site does).
- **`sampleDots`**: the picture's 2nd–99th luminance percentile becomes the full range; smoothstep on the stretched value; the outer half of the inscribed circle dissolves (dots shrink, and thin out at random); cells under the floor (0.03) are dropped. `invert` prints the dark of the picture: `(1 − lum)^1.8`. Each dot carries its place, light `L`, a scatter start inside the circle, a delay and a phase.
- **`seed`** (new): a number seeding a small deterministic PRNG (mulberry32) used for the edge thinning, scatter, delays and phases. Omitted → `Math.random`, as the site does today. Same pixels + grid + invert + seed → identical dots.
- **`dotFrame`**: gather from the scatter (cubic ease-out over 1.1 s, delayed by distance from the centre), then float on an orbit of 0.15 cell, light breathing ±7.5 %, a scan band every 6 s; radius `0.56 × cell × √L × (0.4 + 0.6e)`. The site's constants become the fields of an optional `motion` object whose defaults are the site's values. The site's `a` (alpha) field is dropped: it is always 1.
- **`toSVG`** (new): the settled frame only: each dot at its place, radius `0.56 × cell × √L`, with no scatter, float, shimmer or scan band. One `<svg viewBox="0 0 size size">`, one `<circle>` per dot, coordinates rounded to 2 decimals, `fill` set once on a `<g>`. Optional `background` adds a full-size `<rect>`. Animated exports (video, GIF) are out of scope.
- `halftone-core.d.ts`: hand-written types, covered by `scripts/types-drift.test.mjs`.

### 2. Runtime — `packages/ui-kit/halftone.js`

```html
<canvas data-sl-halftone data-sl-src="/art/kinship.png" data-sl-grid="130" aria-hidden="true"></canvas>
```

`halftone(root = document) → { stop() }`. It loads every `canvas[data-sl-halftone]` under `root` and follows ones added later.

- **Loading**: decode the image, draw it at `2 × grid` on an offscreen canvas, keep the bytes so a theme change can resample without refetching. A failed image leaves its own canvas empty and nothing else (`Promise.allSettled`, as today).
- **Colour**: the canvas's inherited `color`, resolved to sRGB through the kit's one colour reader (below). Ink darker than mid-grey (luminance < 128) sets `invert`. The theme is followed by a MutationObserver on `data-sl-theme`; a polarity flip resamples, a colour change only repaints.
- **Shared colour reader**: `roleColour` in `live-light.js` (probe element + 1 px canvas) moves to an internal `packages/ui-kit/colour.js` taking any CSS colour expression; `live-light.js` passes `var(--slc-accent)`, `halftone.js` passes `currentColor`. `colour.js` ships in `files` but is not a public export.
- **Loop**: one shared `requestAnimationFrame` loop for all scenes, running only while a scene is within 200 px of the viewport and the page is visible. A scene starts gathering the first time it is 40 % in view.
- **Reduced motion**: when `prefers-reduced-motion: reduce` matches and `<html>` does not carry `data-sl-fx-motion="always"` (what `mount({ ignoreReducedMotion: true })` writes), each scene draws its settled frame once when first seen, and redraws once on resize or theme change. No loop. sondalab-site already mounts with `ignoreReducedMotion` (`src/layouts/Base.astro`), so it keeps its motion.
- **Still**: `data-sl-fx-still` on `<html>` behaves as in `live-light.js`: the frame that sees it is drawn and no further frame is requested; a scene that resizes meanwhile is drawn once at the frozen instant; clearing the flag moves every `t0` forward by the pause, so scenes resume where they stopped.
- **Off / high contrast**: a canvas inside `[data-sl-fx="off"]` is not armed. Under `data-sl-theme="high-contrast"` `effects.css` hides `[data-sl-halftone]` (`display: none`); the runtime draws nothing while that theme is set.
- **`stop()`**: cancels the frame, disconnects every observer (near, seen, size, theme, added-nodes), removes the `visibilitychange` listener. Canvases keep their last frame.
- **Wiring into `mount()`**: `effects.js` gains `armHalftone(root)`, a lazy `import("./halftone.js")` like `armGooFields`. It runs **before** the reduced-motion guard, next to `mountGoo`: the picture is content, not decoration, and the runtime owns its own reduced-motion rule above. `mount()` still refuses under high contrast.
- Types: `halftone.d.ts`.

### 3. Export page — `tools/halftone/index.html`

A new top-level `tools/` directory for asset-making tools, distinct from `showcase/` (what the kit looks like) and `lab/` (disposable probes). Not in the npm package.

- Imports `packages/ui-kit/halftone-core.js` by relative path, so there is no build step and it is always the working-tree engine. Served with the repo's existing static server (`lab/_serve.py`) or any static server, since ES modules need http, not `file://`.
- Built with the kit itself (`tokens.css`, `components.css`, themes), in the house style.
- Controls: image (drop or pick), grid (48–200, default 130), invert (auto from ink / on / off), ink (paper-on-ink, ink-on-paper, accent; read from the kit's tokens), background (transparent / ground), output size (px), seed (number, with a "reroll" button).
- A live preview canvas runs the same gather-and-float as the runtime, and a "settled" toggle shows the frame that will be exported.
- Downloads: **SVG** from `toSVG` (the settled frame), **PNG** from an offscreen canvas at the chosen output size and device-independent (1×).
- The photo-fit rule, stated on the page and in the kit README: *a photo reads as dots only when its subject is one iconic outline with near-binary contrast, drawn at ≥ 320 px with a grid near 130* (sondalab-site memory `photos-as-dot-halftones-only-read-when-the-subject-is-one-ic`: three rounds of noir renders and busy stock photos were rejected at 280 px).

### 4. Rollout

- The kit ships as **0.19.0**: `halftone-core.js`, `halftone.js`, `colour.js`, the two `.d.ts`, the `effects.css` rule, `package.json` `exports` + `files`, README and `agent/catalog.md` entries.
- **sondalab-site** follows in its own PR: bump to 0.19.0; Method and Thesis canvases become `data-sl-halftone data-sl-src data-sl-grid`; `mount()` arms them; `src/lib/dot-scene*.ts` and `scripts/dot-scene.test.mjs` are deleted.

## Testing

`node --test scripts/*.test.mjs`, the kit's existing harness.

- `scripts/halftone-core.test.mjs`: the site's 9 cases ported (black draws nothing; uniform picture does not divide by zero; dots stay in the circle; percentile stretch; scatter then settle; size follows light; invert; edge dissolve; scatter stays in the circle), plus: same seed → deep-equal dots, different seed → different; `toSVG` is well-formed, has one `<circle>` per dot, sets `fill` once, and its settled coordinates equal the dots' places.
- `scripts/halftone.test.mjs` (the runtime, driven against a fake page with a rAF queue and a clock, as `scripts/live-light.test.mjs` does): still flag stops frame requests and resumes with `t0` shifted; reduced motion draws once and requests no loop, `data-sl-fx-motion="always"` restores it; `data-sl-fx="off"` subtree is skipped; `stop()` disconnects every observer it created.
- `scripts/types-drift.test.mjs` covers `halftone-core` and `halftone`.
- `scripts/effects-guards.test.mjs`: the high-contrast rule exists for `[data-sl-halftone]`.
- **Visual parity (site PR)**: the Method and Thesis vignettes at 1440 and 390 px, dark and light, before and after, settled frame with a fixed seed, pixel-diffed; the difference must be zero or explained.

## Acceptance criteria

1. The kit's tests pass, including the new ones, and `sl-audit` reports no violation for the new files.
2. A plain HTML page with `effects.css`, one `<canvas data-sl-halftone …>` and `mount()` shows a dot scene that gathers when scrolled into view, follows the theme, freezes under `data-sl-fx-still`, and is gone under high contrast.
3. The export page turns a PNG into an SVG and a PNG; the same image, grid, seed and ink give a byte-identical SVG on two runs.
4. sondalab-site's vignettes look the same after the migration (visual-parity check above) and the site no longer contains `dot-scene`.

## Slices

- **Slice 1 — engine.** `halftone-core.js` + `.d.ts` + tests. Independent and reviewable alone.
- **Slice 2 — runtime.** `colour.js` extraction (live-light keeps passing its tests), `halftone.js` + `.d.ts`, `mount()` wiring, `effects.css` rule, tests, README/catalog, 0.19.0.
- **Slice 3 — export page.** `tools/halftone/`.
- **Slice 4 — site migration.** Separate PR in sondalab-site.

## Notes

- The site's spec (`2026-09-26-method-section-design.md`) says grid 72, radius `L^0.6`, alpha `0.25 + 0.75L`, floor 0.06, fade 30 %. The site's code says grid 96/130, `√L`, alpha 1, floor 0.03, fade 50 %. This spec ports the code.
- The invert threshold (luminance 128 on the ink) is the site's heuristic, kept as-is; the export page exposes it as an explicit toggle.
