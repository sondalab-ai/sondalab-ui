---
name: site-art-is-owner-picked-generated-prints-not-agent-drawn
description: sondalab-site art (2026-11-12/13) - the owner rejected every agent-drawn or procedural illustration; what worked is image-model prints on the owner's ComfyUI, picked by the owner from contact sheets, in short rounds
metadata:
  type: feedback
---

For sondalab-site pictures, do not draw illustration in code (SVG, canvas, procedural kit art) and do not run a long agent pipeline before the owner sees a page. Generate candidates on the owner's ComfyUI server and let the owner pick.

**What happened (owner, 2026-11-12 and 2026-11-13):**
- Three directions built by Opus authors plus Sonnet critics were all rejected: "they all seem AI-made, without soul, and the illustrations are glitchy". My own pixel skyline was "ugly". My hand-placed SVG figure got no approval.
- The owner then supplied four reference pictures (inked cyberpunk figures on a flat orange ground) and access to ComfyUI. Ideogram 4 was "the clear winner" over flux1-schnell, z-image-turbo and ernie-image-turbo. The owner picked every print from HTML contact sheets, one line per pick, and the work moved fast.
- The owner wants the CRT terminal hero kept: it "tells a story which resonates with the whole sondalab concept and cyberpunk vibes".

**Why:** the owner's eye came last in the pipeline, and formula-drawn pictures have no hand. (My reading: three failures of the same method, counting the 0.45 posters.)

**How to apply:**
- Show one real page early, then iterate in short rounds with the owner's verdict each round.
- For a picture: write a scene sentence, generate 2 to 3 seeds, put them in a contact sheet, wait for the pick. Open the candidates yourself only to reject clear defects.
- In sondalab-site use `scripts/make-post-cover.mjs` and `docs/agents/transmissions.md`. The server address goes in `COMFYUI_URL`, never in the repo.
- Ideogram 4 returns a flat grey "Image blocked by safety filter" card as a normal image, also for harmless scenes, and per seed. Detect it by colour variation, and run more than one seed.
- Hero prints need the subject in the right half and empty ground in the left half. Say that in the prompt. Repaint the ground to one orange so prints match.
- A print as a card beside text read as "just put there". The owner wanted it as the hero band itself. See [[art-direction-prototype-on-the-real-page-no-figurative-art]], which this corrects: figurative art is wanted when the owner picks it.
