---
name: sl-fx-goo-has-no-tier-2-and-survives-prefers-reduced-motion
description: The goo animates nothing, so it arms before mount()'s motion guard and refuses only on high contrast — and armLenses() makes the same argument in its own comment while sitting after that guard.
metadata:
  type: project
---

`mountGoo()` runs **before** `mount()`'s `prefers-reduced-motion` guard and
refuses only on `[data-sl-theme="high-contrast"]`. The goo is laid out, not
played: the kill-switch clause is "nothing animates; static material survives",
and nothing in its CSS keys on `data-sl-fx="on"`, so arming is all it needs.
It has no Tier 2 either — the neck is a filter result, not a per-pixel lighting
calculation, so the GPU stays reserved for the glass.

**Why:** refusing a family that animates nothing for a motion preference takes
away material rather than movement — the argument `lensRefused()` already
spells out in `effects.js`.

**How to apply:** `armLenses()` states that same argument in its own comment but
is called *after* the guard, so a lens **is** in fact refused under reduced
motion. That divergence between `effects.js` and its own comment is
pre-existing; it is written up in spec Decision 2b for the owner rather than
changed, because it alters shipped glass behaviour. Do not "fix" it silently.

Related: [[the-goo-filters-alpha-slope-erases-anything-below-half]].

**2026-10-26:** Tier 2 itself is retired (`mountGpu()` always resolves false) and the liquid, which the goo was written against, was removed in 0.39. The goo and the lens guard are unchanged.
