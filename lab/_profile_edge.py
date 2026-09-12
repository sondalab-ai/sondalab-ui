#!/usr/bin/env python3
"""Profile a card's LEFT edge inward and print it against the target curve.

    python3 lab/_profile_edge.py <capture.png> <left> <top> <right> <bottom> [scale] [stated|own-zoom]

The box is the card's border box in the capture's own pixels; `scale` is the
capture's pixels per CSS pixel (1 for the extension's screenshots, 2 for a
retina screenshot), so depths print in CSS px whatever the capture's DPR.

Method, the same as lab/_profile.py: never a single column. Each depth is the
MEDIAN luminance across a band of rows through the middle of the card (the
central 40 % of its height), where no specular highlight and no text can sit,
so a stray pixel of either cannot move the reading. The ground is the median
of the same band 60 CSS px inside the edge, where the reference has no light
left, and every value prints as a delta over it.

Why the left edge: in the reference capture (docs/references/assets/
border-beam-composer-search-dark.png) the beam is on the left side at the
moment of capture, and that is the one edge whose bloom is fully developed.
"""
import importlib.util, pathlib, sys

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("pd", HERE / "_pixdiff.py")
pd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pd)

# The reference's curve, two readings of the same capture. "stated" is the
# 2026-09-11 handoff's, with the capture's pixels taken as CSS px; "own-zoom"
# reads the capture as what it is, a DPR-2 screenshot, so every distance is
# half — the beam's brightest rows, 2026-09-12. Both are luminance deltas over
# the composer's interior (L 29); SPREAD is the median of max(r,g,b) -
# min(r,g,b), a colour's saturation in the same units — the reference's edge
# is a saturated green (spread 30 for a lift of 48), which a pastel cannot be.
TARGETS = {
    "stated": {0: 48, 30: 16, 45: 3, 60: 0},
    "own-zoom": {0: 48, 4: 43, 8: 34, 10: 27, 12: 20, 15: 13, 20: 4, 25: 1, 30: 0},
}
SPREAD = {"stated": {0: 30}, "own-zoom": {0: 30, 10: 22, 15: 11, 20: 3}}
DEPTHS = (-12, -6, -3, -1, 0, 1, 2, 4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70)


def profile(path, left, top, right, bottom, scale=1):
    w, h, ch, px = pd.read_png(path)

    def lum(X, Y):
        i = (Y * w + X) * ch
        return 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]

    def med(vals):
        v = sorted(vals)
        return v[len(v) // 2]

    def rgb(X, Y):
        i = (Y * w + X) * ch
        return px[i], px[i + 1], px[i + 2]

    hh = bottom - top
    rows = range(top + int(hh * 0.30), top + int(hh * 0.70))
    band = lambda x: med([lum(x, y) for y in rows])
    spread = lambda x: med([max(c) - min(c) for c in (rgb(x, y) for y in rows)])
    ground = band(left + int(60 * scale))
    out = {}
    for d in DEPTHS:
        x = left + int(round(d * scale))
        if 0 <= x < w:
            out[d] = (band(x) - ground, spread(x))
    return ground, out


def report(ground, prof, which="stated"):
    """Print the profile against one of the two targets, spread beside it."""
    target, sp = TARGETS[which], SPREAD[which]
    print(f"  ground L {ground:.1f}   target: {which}")
    print("  depth   ours  spread   target   delta")
    for d, (v, s) in prof.items():
        t = target.get(d)
        tail = f"  {t:+5d}   {v - t:+6.1f}" if t is not None else ""
        want = f"  (ref spread {sp[d]})" if d in sp else ""
        print(f"  {d:5d}  {v:+6.1f}  {s:5d}{tail}{want}")


def main(argv):
    if len(argv) < 6:
        raise SystemExit(__doc__)
    path = argv[1]
    left, top, right, bottom = (int(v) for v in argv[2:6])
    scale = float(argv[6]) if len(argv) > 6 else 1
    which = argv[7] if len(argv) > 7 else "stated"
    ground, prof = profile(path, left, top, right, bottom, scale)
    print(f"{path}: box {left},{top}..{right},{bottom} at {scale} px/CSS px")
    report(ground, prof, which)


if __name__ == "__main__":
    main(sys.argv)
