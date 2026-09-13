---
name: tier-2-needs-mountgpu-and-a-declared-backdrop
description: Tier 2 needs BOTH a separate mountGpu() call and an ancestor carrying [data-sl-fx-backdrop] with --slfx-backdrop; mount() arms Tiers 0-1 only, and without the declared texture a pane keeps the shared pointer light and no material at rest.
metadata:
  type: project
---

`mount()` (`packages/ui-kit/effects.js:989`) arms Tiers 0 and 1. It does **not**
start the GPU: `mountGpu()` is a second, `async` export
(`packages/ui-kit/effects.js:1226`) and a consumer that calls only `mount()`
gets no Tier 2 at all, with no warning — the panes still light up under the
pointer, so nothing looks broken.

The second half is easy to miss because it is declarative. `mountGpu()` collects
only elements that `closest("[data-sl-fx-backdrop]")` matches
(`packages/ui-kit/effects.js:1284`), and the shader reads the image off that
**anchor**, not off the host (`packages/ui-kit/effects-gpu.js:228`): a custom
property inherits, so the kit reads it from the box that declared it. An
ancestor must therefore carry both halves:

```html
<main data-sl-fx-backdrop style="--slfx-backdrop: url('/backdrops/thesis-dark.svg')">
```

**Why:** a pane with `mountGpu()` but no declared backdrop is not inert — it
keeps the shared pointer-following light from Tier 1, which is the part a human
notices. What it loses is the part that is there at rest: the material has
nothing behind it to bend, so the surface reads as a flat tint and the failure
looks like a styling choice rather than a missing call.

**How to apply:** when Tier 2 "does nothing", check the call and the anchor
before the shader. See [[the-pane-drivers-pointer-vars-are-inline-and-inherit]]
for what Tier 1 alone still gives you.
