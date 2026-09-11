#!/usr/bin/env python3
"""Profile a glass pane down one column and print it against the reference.

The eye cannot judge a frost, a tint and a highlight at the same time — this
session produced three wrong readings that way. This reads the actual pixels
of a capture, finds the pane's top and bottom edge, and reports luminance at
fixed FRACTIONS of its height relative to the ground just outside it, so a
34px reference button and a 42px screenshot compare number for number.

    python3 lab/_profile.py <ours.png> [reference.png]

Each row is summarised by the MEDIAN luminance across the pane's left PADDING
— inside the rim, outside the label. Three cruder choices all lied here: a
column three pixels in reported the rim's inset shadow as the interior, a
column a quarter across ran through the letters and reported white text as the
glass, and a median across the full width was still pulled up by them. The
padding band is the only part of a text button that is nothing but glass.
"""
import importlib.util, sys, pathlib

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location("pd", HERE / "_pixdiff.py")
pd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pd)

MARKS = ((0.06, "top +6%"), (0.18, "+18%"), (0.5, "middle"), (0.88, "+88%"), (0.97, "bottom"))


def profile(path):
    w, h, ch, px = pd.read_png(path)
    at = lambda X, Y: tuple(px[(Y * w + X) * ch:(Y * w + X) * ch + 3])
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

    def med(vals):
        v = sorted(vals)
        return v[len(v) // 2]

    # The pane's box, from the row through the middle of the image.
    mid = h // 2
    row = [lum(at(X, mid)) for X in range(w)]
    e = [X for X in range(1, w - 2) if abs(row[X + 1] - row[X]) > 4]
    if not e:
        raise SystemExit(f"{path}: no pane found on the middle row")
    left, right = min(e), max(e)
    wdt = right - left
    span = range(left + max(3, int(wdt * 0.08)), left + max(6, int(wdt * 0.22)))

    col = [med([lum(at(X, y)) for X in span]) for y in range(h)]
    edges = [y for y in range(h - 1) if abs(col[y + 1] - col[y]) > 4]
    if not edges:
        raise SystemExit(f"{path}: no pane edge found")
    top, bot = min(edges), max(edges)
    ground = col[max(0, top - 8)]
    return ground, bot - top, [round(col[min(int(top + (bot - top) * f), h - 1)] - ground, 1) for f, _ in MARKS]


def main(argv):
    if len(argv) < 2:
        raise SystemExit(__doc__)
    g, hh, ours = profile(argv[1])
    ref = None
    if len(argv) >= 3:
        gr, hr, ref = profile(argv[2])
        print(f"reference  ground {gr:6.1f}  height {hr}px")
    print(f"ours       ground {g:6.1f}  height {hh}px\n")
    for i, (_, name) in enumerate(MARKS):
        if ref:
            print(f"  {name:<9} ref {ref[i]:+7.1f}   ours {ours[i]:+7.1f}   delta {ours[i] - ref[i]:+7.1f}")
        else:
            print(f"  {name:<9} {ours[i]:+7.1f}")


if __name__ == "__main__":
    main(sys.argv)
