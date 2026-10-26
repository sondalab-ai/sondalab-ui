"""Reference helper for the Term spec (docs/tui-patterns.md in sondalab-ui).

Pure string builders and environment checks. Nothing here writes to a
terminal, starts a thread or sleeps: the caller owns redraw and timing
(SPINNER["intervalMs"], SPINNER["delayMs"], DECODE["frameMs"], MOTION["maxFps"]).
"""
from __future__ import annotations

import codecs
import locale
import os
import sys
from typing import Mapping, Optional, Sequence

from . import DECODE, ENV, GLYPHS, LAYOUT, PROGRESS, RAMP, SPINNER

__all__ = [
    "motion_enabled",
    "ascii_mode",
    "color_mode",
    "spinner_frame",
    "progress_bar",
    "decode_frames",
    "step_line",
]

_TRUECOLOR = ("truecolor", "24bit")


def _on(env: Mapping[str, str], names: Sequence[str]) -> bool:
    """True when any of the variables is on, per the spec's Environment table.

    A SONDALAB_* variable is on only when it is "1"; any other name
    (CI, ACCESSIBLE) is on when it is set at all, whatever its value.
    """
    for name in names:
        if name.startswith("SONDALAB_"):
            if env.get(name) == "1":
                return True
        elif name in env:
            return True
    return False


def _term_dumb(env: Mapping[str, str]) -> bool:
    return any(env.get(name) == "dumb" for name in ENV["term"])


def motion_enabled(env: Mapping[str, str] = os.environ, isatty: Optional[bool] = None) -> bool:
    """Whether the spinner, progress bar and decode may run.

    Off for a non-TTY stream, CI set, TERM=dumb, SONDALAB_REDUCED_MOTION=1 and
    accessible mode (SONDALAB_ACCESSIBLE=1 or ACCESSIBLE set). `isatty` is the
    TTY state of the stream motion draws on; None reads sys.stderr.isatty().
    """
    if isatty is None:
        isatty = sys.stderr.isatty()
    if not isatty or _term_dumb(env):
        return False
    return not (_on(env, ENV["ci"]) or _on(env, ENV["reducedMotion"]) or _on(env, ENV["accessible"]))


def ascii_mode(
    env: Mapping[str, str] = os.environ,
    encoding: Optional[str] = None,
    override: Optional[bool] = None,
) -> bool:
    """Whether every glyph takes its ASCII form.

    True on a non-UTF-8 encoding, TERM=dumb or SONDALAB_ASCII=1. `override`
    is the caller's --ascii flag (True forces ASCII, False forces Unicode).
    `encoding` None reads locale.getpreferredencoding(False).
    """
    if override is not None:
        return override
    if _term_dumb(env) or _on(env, ENV["ascii"]):
        return True
    enc = encoding or locale.getpreferredencoding(False)
    try:
        return codecs.lookup(enc).name != "utf-8"
    except LookupError:
        return True


def color_mode(
    env: Mapping[str, str] = os.environ,
    isatty: Optional[bool] = None,
    flag: Optional[bool] = None,
    truecolor: bool = False,
) -> str:
    """Return 'none', 'ansi16' or 'truecolor'; the first rule that applies wins.

    Order: `flag` (True for --color, False for --no-color), then NO_COLOR set
    and non-empty, then FORCE_COLOR set, then `isatty` and TERM != dumb.
    Colour is 'truecolor' only when `truecolor` is True (the program opts in)
    and COLORTERM is truecolor or 24bit. `isatty` None reads sys.stdout.isatty().
    """
    if flag is not None:
        on = flag
    elif any(env.get(name) for name in ENV["noColor"]):
        on = False
    elif any(name in env for name in ENV["forceColor"]):
        on = True
    else:
        if isatty is None:
            isatty = sys.stdout.isatty()
        on = isatty and not _term_dumb(env)
    if not on:
        return "none"
    if truecolor and any(env.get(name, "").lower() in _TRUECOLOR for name in ENV["colorTerm"]):
        return "truecolor"
    return "ansi16"


def spinner_frame(i: int, ascii: bool = False) -> str:
    """The burst spinner's frame at tick `i`, cycling every len(frames) ticks.

    One column wide, painted in SPINNER["role"]. The caller advances `i`
    every SPINNER["intervalMs"] and shows the spinner only after
    SPINNER["delayMs"]; put the frame in the glyph column via step_line().
    """
    frames = SPINNER["ascii"] if ascii else SPINNER["frames"]
    return frames[i % len(frames)]


def _to_ascii(cells: str) -> str:
    table = dict(zip(RAMP["unicode"], RAMP["ascii"]))
    return "".join(table.get(c, c) for c in cells)


def progress_bar(done: int, total: int, ascii: bool = False) -> str:
    """The progress continuation line: indent, bar, count and percent.

    The bar is PROGRESS["cells"] wide: floor(done/total*cells) full cells, then
    the ramp darkest first as the leading edge, cut at the bar's end. `done`
    is clamped to [0, total]; total 0 reads as complete. The percent rounds
    half up. The bar is PROGRESS["role"], the percent `dim`; colour is the caller's.
    """
    cells = PROGRESS["cells"]
    total = max(total, 0)
    done = min(max(done, 0), total)
    num, den = (done, total) if total else (1, 1)
    full = num * cells // den
    edge = "".join(reversed(RAMP["unicode"][:-1]))
    bar = (RAMP["unicode"][-1] * full + edge)[:cells].ljust(cells)
    if ascii:
        bar = _to_ascii(bar)
    pct = (200 * num + den) // (2 * den)
    width = len(str(total))
    count = f"{done:>{width}}/{total}"
    percent = f"{pct}%".rjust(PROGRESS["percentWidth"])
    pad = " " * (LAYOUT["indent"] + 2)
    return f"{pad}{bar}  {count}  {percent}"


def decode_frames(value: str, rng, ascii: bool = False) -> list:
    """The decode's frames for `value`, first to last; the last is `value`.

    Frame n of DECODE["frames"] settles the first floor(n/frames*len) chars;
    the rest are drawn with rng.choice() from DECODE["glyphs"] plus printable
    ASCII (ASCII only when `ascii`). Spaces stay spaces and draw nothing.
    `rng` is any object with choice(), e.g. random.Random(seed).
    """
    lo, hi = DECODE["randomAscii"]
    pool = [chr(c) for c in range(lo, hi + 1)]
    if not ascii:
        pool = list(DECODE["glyphs"]) + pool
    count = DECODE["frames"]
    out = []
    for n in range(1, count + 1):
        settled = n * len(value) // count
        out.append(value[:settled] + "".join(
            c if c == " " else rng.choice(pool) for c in value[settled:]
        ))
    return out


def step_line(glyph_name: str, label: str, detail: str = "", ascii: bool = False) -> str:
    """One step-list line: indent, glyph, label padded to labelWidth, detail.

    `glyph_name` is a GLYPHS key, or a one-character spinner frame. A label
    longer than LAYOUT["labelWidth"] is cut there, never wrapped; with no
    detail the line has no trailing padding. In ASCII, `…` becomes `...`.
    Uncoloured: paint the glyph with GLYPHS[name][2] (done/fixed ok, failed
    err, warn warn, active/question prompt, pending/skipped/separator dim;
    a spinner frame prompt), label and detail in the default ink.
    """
    if glyph_name in GLYPHS:
        uni, asc, _role = GLYPHS[glyph_name]
        glyph = asc if ascii else uni
    elif len(glyph_name) == 1:
        glyph = _to_ascii(glyph_name) if ascii else glyph_name
    else:
        raise ValueError(f"unknown glyph {glyph_name!r}")
    if ascii:
        label = label.replace("…", "...")
    width = LAYOUT["labelWidth"]
    label = label[:width]
    head = " " * LAYOUT["indent"] + glyph + " "
    if not detail:
        return head + label
    return head + label.ljust(width) + detail
