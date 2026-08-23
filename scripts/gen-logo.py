#!/usr/bin/env python3
"""Regenerate the Sondalab logo SVGs (outlined paths) from the variable fonts.

The logo is typographic; these SVGs bake the letterforms into vector paths so
they render without the fonts installed. Letters use currentColor; the accent
dot uses var(--sl-accent-default) with an amber fallback.

Deps:  pip install fonttools brotli uharfbuzz
Fonts: fetched at runtime from the google/fonts repo (not committed).
Run:   python scripts/gen-logo.py   # writes packages/ui-kit/assets/*.svg
"""
import io
import os
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Offset
import uharfbuzz as hb

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "packages", "ui-kit", "assets"))
CACHE = os.path.join(HERE, ".fontcache")
DOT_FILL = "var(--sl-accent-default, #F5A83C)"

FONTS = {
    "fraunces.ttf": "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf",
    "martian.ttf": "https://github.com/google/fonts/raw/main/ofl/martianmono/MartianMono%5Bwdth%2Cwght%5D.ttf",
}


def font_path(name):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        urllib.request.urlretrieve(FONTS[name], p)
    return p


def instance(path, axes):
    f = TTFont(path)
    instantiateVariableFont(f, axes, inplace=True)
    buf = io.BytesIO()
    f.save(buf)
    return f, buf.getvalue()


def shape(font_bytes, text):
    face = hb.Face(font_bytes)
    font = hb.Font(face)
    b = hb.Buffer()
    b.add_str(text)
    b.guess_segment_properties()
    hb.shape(font, b, {"kern": True, "liga": True})
    return list(zip(b.glyph_infos, b.glyph_positions))


def build_svg(ttf, axes, text, amber_char_index, out):
    f, fb = instance(ttf, axes)
    gs = f.getGlyphSet()
    upem = f["head"].unitsPerEm
    x = 0
    glyphs = []
    bounds = [None, None, None, None]
    for info, pos in shape(fb, text):
        gname = f.getGlyphName(info.codepoint)
        off = Offset(x + pos.x_offset, pos.y_offset)
        spen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(spen, off))
        d = spen.getCommands()
        bp = BoundsPen(gs)
        gs[gname].draw(TransformPen(bp, off))
        if bp.bounds:
            xmin, ymin, xmax, ymax = bp.bounds
            bounds[0] = xmin if bounds[0] is None else min(bounds[0], xmin)
            bounds[1] = ymin if bounds[1] is None else min(bounds[1], ymin)
            bounds[2] = xmax if bounds[2] is None else max(bounds[2], xmax)
            bounds[3] = ymax if bounds[3] is None else max(bounds[3], ymax)
        if d:
            glyphs.append((d, info.cluster == amber_char_index))
        x += pos.x_advance
    xmin, ymin, xmax, ymax = bounds
    pad = upem * 0.04
    xmin -= pad; xmax += pad; ymin -= pad; ymax += pad
    w, h = xmax - xmin, ymax - ymin
    paths = "\n".join(
        f'    <path fill="{DOT_FILL if amber else "currentColor"}" d="{d}"/>'
        for d, amber in glyphs
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{xmin:.1f} {-ymax:.1f} {w:.1f} {h:.1f}" '
        f'role="img" aria-label="{text}" fill="currentColor">\n'
        f'  <g transform="scale(1,-1)">\n{paths}\n  </g>\n</svg>\n'
    )
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, out), "w") as fh:
        fh.write(svg)
    print("wrote", out, f"({len(glyphs)} glyphs)")


if __name__ == "__main__":
    # Primary wordmark: sondalab. — Fraunces 500, display optical size; dot amber.
    build_svg(font_path("fraunces.ttf"), {"wght": 500, "opsz": 144}, "sondalab.", 8, "sondalab-wordmark.svg")
    # Compact lockup: SONDA·LAB — Martian Mono 300; middle dot amber.
    build_svg(font_path("martian.ttf"), {"wght": 300}, "SONDA·LAB", 5, "sondalab-lockup.svg")
