---
name: claude-in-chrome-zoom-writes-a-dpr2-png-region-in-screenshot-frame
description: Claude-in-Chrome capture facts for pixel work — `computer screenshot` is a JPEG scaled to 1565 px wide (0.815 of a 1920 viewport) and useless for profiling; `computer zoom` with save_to_disk writes a PNG at DPR 2 (one CSS px = two capture px, verified on a 321 px card), but its `region` is in the screenshot's scaled frame (CSS px × 0.815), and passing `scale` shrinks the saved file too. Two identical zooms diff to 0 px.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-09-12
---

Measured on 2026-09-12 while profiling `lab/1w` against a reference capture.

- **Full screenshot**: 1920 × 962 viewport → 1565 × 784 JPEG. Lossy and
  resampled; never profile it.
- **Zoom**: `region` given as `[x0, y0, x1, y1]` is read in the frame of the
  LAST full screenshot taken in that tab — scaled, so a CSS-px rectangle must
  be multiplied by 0.815 (1565 / 1920) — and in plain CSS px when no full
  screenshot has been taken yet in the tab. Take none, and the region is CSS px.
  The saved file is a PNG at exactly 2 px per CSS px — a 321 CSS px card
  measured 642 px border to border — so it compares one-to-one with a retina
  screenshot of a reference at the page's own zoom.
- **`scale`** on zoom scales the saved file as well as the returned image
  (0.3 gave a 250 × 132 PNG). Omit it when the file is the point.
- **Noise floor**: two zooms of the same region with nothing changed differ by
  0 pixels through `lab/_pixdiff.py`, so any non-zero diff is signal.
- The reference capture in `docs/references/assets/border-beam-composer-
  search-dark.png` is a DPR-2 screenshot (2 px border, 2 px "1 px arc"); read
  its distances as half that in CSS px.

Related: [[claude-in-chrome-the-mcp-tab-reports-visibilitystate-hidden]],
[[sondalab-ui-next-step-lab-1w-aurora-bed]].
