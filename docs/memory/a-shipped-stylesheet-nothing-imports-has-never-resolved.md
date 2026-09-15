---
name: a-shipped-stylesheet-nothing-imports-has-never-resolved
description: A CSS file can pass `sl-audit`, ship in `exports`/`files` and be documented while never having resolved against an element. `compositions.css` shipped in 0.10.0 with no page importing it; wired into `showcase/effects.html` afterwards, one of its two blocks turned out to be a no-op (`.sl-invert` bound `--slfx-text-light` to a value the point-of-use fallback `var(--slfx-text-light, var(--slc-text, …))` already resolved to, because `.sl-invert > *` binds `--slc-text` to the band's canvas, and its two alphas equalled the defaults — the computed `text-shadow` was byte-identical with the stylesheet enabled and disabled) and the other was live but guarding a composition the catalog never blessed. Two rules follow. First, the importing page must GIVE UP its own copy of what the file ships: a page that keeps a local remap cannot distinguish a working shipped class from a shadowed one, so deleting the local copy IS the test. Second, fence both directions — assert the import exists and comes after the file it binds into, assert the page's own `<style>` declares none of the properties the file owns (read that list out of the stylesheet, not hardcoded), and assert every class the file binds exists on the page, so a selector matching nothing fails the suite instead of shipping inert.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-14
---
