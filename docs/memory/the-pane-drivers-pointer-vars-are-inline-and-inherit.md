---
name: the-pane-drivers-pointer-vars-are-inline-and-inherit
description: The glass host's pointer vars are inline styles, so they inherit; they are now --slfx-spec-a / --slfx-spec-i (and --slfx-press / --slfx-spill / --slfx-spill-a on a press). --slfx-px/py/ptr/lit are no longer written.
metadata:
  type: project
---

**Corrected 2026-10-26.** The original note named `--slfx-px`, `--slfx-py`, `--slfx-ptr` and `--slfx-lit`. The 2026-09-24 re-scope retired the pointer glint and the pane driver that wrote them; `effects.js` sets none of the four now (only comments in `effects.css` still mention them). The principle survived, the names did not.

What `effects.js` writes now, all with `style.setProperty` on the host:

- `--slfx-spec-a` (the light's bearing, a conic angle) and `--slfx-spec-i` (how lit the edge is, 0 to 1) on a `.sl-fx-glass` host (`stepSpec` in `packages/ui-kit/effects.js`). `releaseSpec()` removes both and strips an empty `style=""`. Resting values are declared in `effects.css` (`--slfx-spec-a: 0deg; --slfx-spec-i: 0`).
- `--slfx-press`, `--slfx-spill` and `--slfx-spill-a` on a pressed control (the press light).

Inline custom properties inherit, so **a descendant can read them with CSS alone**; it needs no listener. Write CSS that is correct at `--slfx-spec-i: 0`.

**Why:** a second listener has to be kept in step with the kit's easing; the values are already there and already eased. Writes are guarded (an unchanged string is not written) because each write restyles the host's subtree.

**How to apply:** `grep -n 'setProperty("--slfx' packages/ui-kit/effects.js` for the current list before relying on a name here. The dither hover keeps no pointer var: it draws on a canvas.
