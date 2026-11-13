---
name: art-direction-prototype-on-the-real-page-no-figurative-art
description: "Owner rejected figurative pixel-art posters on the site (2026-11-11); prototype art on the real consumer page first, in the page's own ink and accent, and keep heads free of art."
metadata:
  node_type: memory
  type: feedback
  originSessionId: a2faf2f3-06ba-4674-a923-e0b9033bf60f
  modified: 2026-11-11T22:58:36.080Z
---

On 2026-11-11 the owner approved four procedural "prints" (dawn, overprint, hills, orbit) and two landscape horizons on isolated lab pages, they shipped in ui-kit 0.45.0, and the owner then rejected them on the real website: "the result is so cheap", "THE CHANGES ARE NO SENSE", "a patchwork of different styles". The owner's final decision for sondalab-site: no art in the page heads, one trace band in the footer, "pieces of art here and there where they dont distract are accepted".

**Why:** (my reading) a small figurative illustration with its own paper and palette says nothing about a developer tool and fights the site's CRT scenes; approvals on blank lab pages did not predict how the art read on a real page. Formula-drawn illustration (discs, parabolas) has a low quality ceiling; systemic graphics (traces, fields, dither) in the page's ink and accent fit the brand. See [[ds-direction-dev-tool-first]].

**How to apply:**
- For any art or visual change meant for a product, build the first example on the real consumer page (a worktree of that repo plus its dev server), not on a blank lab page.
- Do not propose figurative or landscape illustration for Sondalab surfaces. Use the page's own ink and one accent; no separate palette, no paper card.
- Do not refill an existing layout slot without asking if the slot itself is the weak idea.
- The kit still ships the 0.45.0 posters and horizons; the owner deferred the decision to keep, remove or replace them.
