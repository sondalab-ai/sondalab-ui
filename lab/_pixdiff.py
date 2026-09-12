#!/usr/bin/env python3
"""Diff two PNG crops and report WHERE they differ, not just whether.

    python3 lab/_pixdiff.py before.png after.png [threshold]

Why this exists, and why it is not a one-liner with Pillow: judging an effect by
looking at two screenshots fails, and failed twice in one session. A backdrop
hairline that "clearly bends" under a glass button turned out to be bit-identical
between the two states — what moved was 45 pixels of rim compositing, and what
looked like a bend was an alpha layer occluding the line. Only a row histogram
separated the two.

So the method is: toggle ONE property, capture the identical crop, diff, and read
the affected ROWS before claiming a cause. Rows clustered at the element's edges
are compositing; rows on a backdrop feature mean the backdrop actually moved.
Always take a control diff too (something that should change nothing) — a
0-pixel control is what proves the capture pipeline adds no noise and that a
non-zero result elsewhere is signal.

Pure stdlib: this machine has no Pillow, and a decoder small enough to read is
worth more here than a dependency.
"""

import sys
import zlib
import struct


def read_png(path):
    """Decode an 8-bit non-interlaced RGB/RGBA PNG to (w, h, channels, pixels)."""
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{path}: not a PNG")

    pos, idat, meta = 8, b"", None
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            w, h, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", chunk)
            meta = (w, h, depth, color, interlace)
        elif kind == b"IDAT":
            idat += chunk
        elif kind == b"IEND":
            break

    w, h, depth, color, interlace = meta
    if depth != 8 or interlace != 0 or color not in (2, 6):
        raise SystemExit(f"{path}: need 8-bit non-interlaced RGB/RGBA, got {meta}")

    ch = 3 if color == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0

    for y in range(h):
        filt = raw[p]
        p += 1
        line = bytearray(raw[p : p + stride])
        p += stride
        if filt == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif filt == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif filt == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif filt == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pred) & 255
        out[y * stride : (y + 1) * stride] = line
        prev = line

    return w, h, ch, bytes(out)


def main(argv):
    if len(argv) < 3:
        raise SystemExit(__doc__)
    threshold = int(argv[3]) if len(argv) > 3 else 4

    w, h, ca, pa = read_png(argv[1])
    w2, h2, cb, pb = read_png(argv[2])
    if (w, h) != (w2, h2):
        raise SystemExit(f"different sizes: {w}x{h} vs {w2}x{h2} — recapture the same region")

    per_row, total, peak = {}, 0, 0
    for y in range(h):
        count = 0
        for x in range(w):
            ia, ib = (y * w + x) * ca, (y * w + x) * cb
            delta = max(abs(pa[ia + k] - pb[ib + k]) for k in range(3))
            if delta > threshold:
                count += 1
                peak = max(peak, delta)
        if count:
            per_row[y] = count
            total += count

    print(f"{argv[1]}  vs  {argv[2]}")
    print(f"  {w}x{h} = {w * h} px, threshold >{threshold}/255")
    print(f"  differing: {total} px ({100 * total / (w * h):.2f}%), max channel delta {peak}/255")
    if not per_row:
        print("  IDENTICAL — if you expected a change, the property you toggled does nothing here")
        return
    ys = sorted(per_row)
    print(f"  affected rows: {ys[0]}..{ys[-1]} ({len(ys)} rows)")
    busiest = sorted(per_row.items(), key=lambda kv: -kv[1])[:8]
    print("  busiest (y:count): " + ", ".join(f"{y}:{c}" for y, c in busiest))

    # The brightest row is usually the backdrop feature you care about (a rule, a
    # hairline). If it is absent from the diff, the backdrop did not move.
    def row_luma(pix, ch, y):
        return sum(pix[(y * w + x) * ch + k] for x in range(w) for k in range(3)) / (w * 3)

    bright = max(range(h), key=lambda y: row_luma(pa, ca, y))
    print(f"  brightest row in the first image: {bright} — differs by {per_row.get(bright, 0)} px")


if __name__ == "__main__":
    main(sys.argv)
