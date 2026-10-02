#!/usr/bin/env python3
"""Regenerate the Sondalab logo SVGs (outlined paths) from the variable fonts.

The logo is typographic; these SVGs bake the letterforms into vector paths so
they render without the fonts installed. Letters use currentColor; the accent
dot uses var(--sl-accent-default) with an amber fallback.

The social avatar is the same letterforms, monogram-cropped: it ships as an SVG
plus a rasterised PNG, because avatar uploads take a bitmap. Rastering needs
`rsvg-convert` (librsvg) and `magick` (ImageMagick) on PATH; if either is
missing the SVG is still written and the PNG step is skipped.

Deps:  pip install fonttools brotli uharfbuzz
Fonts: fetched at runtime from the google/fonts repo (not committed).
Run:   python scripts/gen-logo.py   # writes packages/ui-kit/assets/*.svg|png
"""
import io
import os
import shutil
import subprocess
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.misc.transform import Offset, Transform
import uharfbuzz as hb

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "packages", "ui-kit", "assets"))
CACHE = os.path.join(HERE, ".fontcache")
DOT_FILL = "var(--sl-accent-default, #F5A83C)"

# The avatar is a flat bitmap, so it cannot be theme-aware: colours are literal,
# like favicon.svg's amber. Each palette is one theme's (surface, text, accent).
AVATAR_PALETTES = {
    "ink": ("#0F151A", "#DAE3E4", "#F5A83C"),      # dark theme
    "paper": ("#F6F1E6", "#15211F", "#B56A0C"),    # light theme
}
AVATAR_PX = 1024
# Every social platform crops avatars to the inscribed circle, so the mark is
# fitted to one 0.80 of the canvas wide. Only the bounding box's corners touch
# that arc — the letterform never reaches them, which is the visual margin.
AVATAR_CIRCLE = 0.80

FONTS = {
    "fraunces.ttf": "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf",
    # Pinned to the google/fonts commit the kit's geist-mono-latin.woff2 was cut
    # from (Geist Mono 1.701), so the lockup and the UI's mono are one cut.
    "geistmono.ttf": "https://github.com/google/fonts/raw/9e25e2ba265e5298f70f6182dd4e8a3ebf1b9123/ofl/geistmono/GeistMono%5Bwght%5D.ttf",
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


def build_svg(ttf, axes, text, amber_char_index, out, tracking_em=0.0):
    """tracking_em bakes CSS letter-spacing (em) into the advances (e.g. -0.05)."""
    f, fb = instance(ttf, axes)
    glyphs, bounds, upem = _place_glyphs(f, fb, text, tracking_em, amber_char_index)
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


def _place_glyphs(f, fb, text, tracking_em, amber_char_index, dot_scale=1.0,
                  dot_gap_em=0.0):
    """Shape `text` and return [(path_d, is_amber)] plus the inked bounding box.

    `dot_scale` blows the accent glyph up around its own centre: at avatar sizes
    a Fraunces period is the first thing to vanish, and that dot is the mark.
    `dot_gap_em` adds advance in front of it — an enlarged dot at the wordmark's
    tight tracking crowds the letter it follows.
    """
    gs = f.getGlyphSet()
    upem = f["head"].unitsPerEm
    track = tracking_em * upem
    x = 0
    glyphs = []
    box = [None, None, None, None]
    for info, pos in shape(fb, text):
        gname = f.getGlyphName(info.codepoint)
        amber = info.cluster == amber_char_index
        if amber:
            x += dot_gap_em * upem
        t = Offset(x + pos.x_offset, pos.y_offset)
        if amber and dot_scale != 1.0:
            bp = BoundsPen(gs)
            gs[gname].draw(TransformPen(bp, t))
            if bp.bounds:
                cx = (bp.bounds[0] + bp.bounds[2]) / 2
                cy = (bp.bounds[1] + bp.bounds[3]) / 2
                t = (Transform().translate(cx, cy).scale(dot_scale)
                     .translate(-cx, -cy).transform(t))
        spen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(spen, t))
        d = spen.getCommands()
        bp = BoundsPen(gs)
        gs[gname].draw(TransformPen(bp, t))
        if bp.bounds:
            xmin, ymin, xmax, ymax = bp.bounds
            box[0] = xmin if box[0] is None else min(box[0], xmin)
            box[1] = ymin if box[1] is None else min(box[1], ymin)
            box[2] = xmax if box[2] is None else max(box[2], xmax)
            box[3] = ymax if box[3] is None else max(box[3], ymax)
        if d:
            glyphs.append((d, amber))
        x += pos.x_advance + track
    return glyphs, box, upem


def build_avatar(ttf, axes, text, amber_char_index, out, tracking_em=0.0,
                 dot_scale=1.0, dot_gap_em=0.0, palette="ink"):
    """Write a square social-avatar SVG + PNG: the monogram on a flat tile.

    The mark is scaled to fit the inscribed crop circle (its bounding box's
    half-diagonal against the circle radius, not its width against the square)
    and centred on that box.
    """
    bg, ink, accent = AVATAR_PALETTES[palette]
    f, fb = instance(ttf, axes)
    glyphs, box, _ = _place_glyphs(f, fb, text, tracking_em, amber_char_index,
                                   dot_scale, dot_gap_em)
    xmin, ymin, xmax, ymax = box
    w, h = xmax - xmin, ymax - ymin
    C = AVATAR_PX
    radius = C * AVATAR_CIRCLE / 2
    scale = radius / ((w ** 2 + h ** 2) ** 0.5 / 2)
    tx = C / 2 - (xmin + w / 2) * scale
    ty = C / 2 + (ymin + h / 2) * scale  # y is flipped by the outer scale(1,-1)
    paths = "\n".join(
        f'      <path fill="{accent if amber else ink}" d="{d}"/>'
        for d, amber in glyphs
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" '
        f'viewBox="0 0 {C} {C}" role="img" aria-label="Sondalab">\n'
        f'  <rect width="{C}" height="{C}" fill="{bg}"/>\n'
        f'  <g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.6f} {-scale:.6f})">\n'
        f'{paths}\n  </g>\n</svg>\n'
    )
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, out)
    with open(path, "w") as fh:
        fh.write(svg)
    print("wrote", out, f"(mark {w * scale / C:.0%} x {h * scale / C:.0%} of canvas)")
    rasterise(path)


def rasterise(svg_path):
    """Render the avatar SVG to a flat-palette PNG next to it, if tools exist."""
    if not all(shutil.which(t) for t in ("rsvg-convert", "magick")):
        print("  skipped PNG: needs rsvg-convert + magick on PATH")
        return
    png = svg_path[:-4] + ".png"
    subprocess.run(["rsvg-convert", "-w", str(AVATAR_PX), "-h", str(AVATAR_PX),
                    "-o", png, svg_path], check=True)
    # Three flat colours: an indexed palette costs nothing visible and is an
    # order of magnitude smaller than truecolour. PNG8 caps at 256 entries on
    # its own — do not quantise further, the antialias ramp needs the levels.
    subprocess.run(["magick", png, "-strip", "PNG8:" + png], check=True)
    print("  wrote", os.path.basename(png),
          f"({os.path.getsize(png) / 1024:.1f} KB)")


if __name__ == "__main__":
    # Primary wordmark: sondalab. — Fraunces 500, display optical size; dot amber.
    # tracking -0.05em matches the identity board's tight letter-spacing.
    build_svg(font_path("fraunces.ttf"), {"wght": 500, "opsz": 144}, "sondalab.", 8, "sondalab-wordmark.svg", tracking_em=-0.05)
    # Compact lockup: SONDA·LAB — Geist Mono 300 (ui-kit 0.30; Martian Mono 300
    # before), tracked 0.2em as the identity board's brandline and L3 set it;
    # middle dot amber.
    build_svg(font_path("geistmono.ttf"), {"wght": 300}, "SONDA·LAB", 5, "sondalab-lockup.svg", tracking_em=0.2)
    # Social avatar: the `s.` monogram, same Fraunces cut as the wordmark. The
    # dot is optically enlarged — at 32px the natural period is the first thing
    # to disappear, and the dot is the mark — then given back the space that
    # enlargement stole from the wordmark's tight tracking.
    for palette in AVATAR_PALETTES:
        build_avatar(font_path("fraunces.ttf"), {"wght": 500, "opsz": 144},
                     "s.", 1, f"sondalab-avatar-{palette}.svg",
                     tracking_em=-0.05, dot_scale=1.35, dot_gap_em=0.06,
                     palette=palette)
