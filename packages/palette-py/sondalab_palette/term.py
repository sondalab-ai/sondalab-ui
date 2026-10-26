"""Reference helper for the Term spec (docs/tui-patterns.md in sondalab-ui).

Pure string builders and environment checks. Nothing here writes to a
terminal, starts a thread or sleeps: the caller owns redraw and timing
(SPINNER["intervalMs"], SPINNER["delayMs"], DECODE["frameMs"], MOTION["maxFps"]).
"""
from __future__ import annotations

import codecs
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

# How each switch variable in ENV reads, per docs/tui-patterns.md, Robustness >
# Environment: "one" is on only when it equals "1" (SONDALAB_*), "set" is on
# whenever it is present, whatever its value (CI, ACCESSIBLE). A variable added
# to ENV must get its own entry here: _on() raises on a name it does not know.
_SWITCH = {
    "SONDALAB_REDUCED_MOTION": "one",
    "SONDALAB_ACCESSIBLE": "one",
    "SONDALAB_ASCII": "one",
    "CI": "set",
    "ACCESSIBLE": "set",
}


def _on(env: Mapping[str, str], names: Sequence[str]) -> bool:
    """True when any of the switch variables `names` is on.

    Each name reads by its _SWITCH rule ("one": equals "1"; "set": present).
    A name missing from _SWITCH raises KeyError, so a new ENV variable never
    inherits a rule silently.
    """
    for name in names:
        rule = _SWITCH[name]
        if (env.get(name) == "1") if rule == "one" else (name in env):
            return True
    return False


def _forced(env: Mapping[str, str]) -> bool:
    """FORCE_COLOR per force-color.org: set, and neither empty nor "0"."""
    return any(env.get(name, "") not in ("", "0") for name in ENV["forceColor"])


def _term_dumb(env: Mapping[str, str]) -> bool:
    """True when TERM is `dumb`: no colour, no motion, ASCII glyphs."""
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
    `encoding` None reads the charset of the first set of LC_ALL, LC_CTYPE,
    LANG in `env` ("en_US.UTF-8" gives UTF-8); none set, or no charset, is ASCII.
    """
    if override is not None:
        return override
    if _term_dumb(env) or _on(env, ENV["ascii"]):
        return True
    if encoding is None:
        encoding = _locale_charset(env)
    try:
        return codecs.lookup(encoding).name not in ("utf-8", "utf-8-sig")
    except LookupError:
        return True


def _locale_charset(env: Mapping[str, str]) -> str:
    """The charset of the effective POSIX locale in `env`, or "" if it has none.

    The first non-empty of LC_ALL, LC_CTYPE, LANG wins; its charset sits
    between "." and an optional "@modifier" ("de_DE.UTF-8@euro" gives "UTF-8").
    A value with no "." is read whole, as macOS sets LC_CTYPE=UTF-8.
    """
    for name in ("LC_ALL", "LC_CTYPE", "LANG"):
        value = env.get(name)
        if value:
            lang, dot, charset = value.partition(".")
            return (charset if dot else lang).partition("@")[0]
    return ""


def color_mode(
    env: Mapping[str, str] = os.environ,
    isatty: Optional[bool] = None,
    flag: Optional[bool] = None,
    truecolor: bool = False,
) -> str:
    """Return 'none', 'ansi16' or 'truecolor'; the first rule that applies wins.

    Order: `flag` (True for --color, False for --no-color), then NO_COLOR set
    and non-empty, then FORCE_COLOR set and not "" or "0", then `isatty`
    and TERM != dumb.
    Colour is 'truecolor' only when `truecolor` is True (the program opts in)
    and COLORTERM is truecolor or 24bit. `isatty` None reads sys.stdout.isatty().
    """
    if flag is not None:
        on = flag
    elif any(env.get(name) for name in ENV["noColor"]):
        on = False
    elif _forced(env):
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
    """Map each ramp cell to its RAMP["ascii"] form; other characters pass."""
    table = dict(zip(RAMP["unicode"], RAMP["ascii"]))
    return "".join(table.get(c, c) for c in cells)


def progress_bar(done: int, total: int, ascii: bool = False) -> str:
    """The progress continuation line: indent, bar, count and percent.

    The bar is PROGRESS["cells"] wide: floor(done/total*cells) full cells, then
    the ramp darkest first as the leading edge, cut at the bar's end. `done`
    is clamped to [0, total]; total <= 0 raises ValueError. The percent rounds
    half up and stays at 99 until done == total. The bar is PROGRESS["role"],
    the percent `dim`; colour is the caller's.
    """
    if total <= 0:
        raise ValueError(f"total must be positive, got {total}")
    cells = PROGRESS["cells"]
    done = min(max(done, 0), total)
    full = done * cells // total
    edge = "".join(reversed(RAMP["unicode"][:-1]))
    bar = (RAMP["unicode"][-1] * full + edge)[:cells].ljust(cells)
    if ascii:
        bar = _to_ascii(bar)
    pct = (200 * done + total) // (2 * total)
    if done < total:
        pct = min(pct, 99)
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

    `glyph_name` is a GLYPHS key, or a spinner frame (SPINNER frames/ascii).
    With a detail the label is cut at labelWidth - 1, so a space always
    separates them; without one it is cut at labelWidth, with no trailing
    padding. Never wrapped. In ASCII, `…` becomes `...`.
    Uncoloured: paint the glyph with GLYPHS[name][2] (done/fixed ok, failed
    err, warn warn, active/question prompt, pending/skipped/separator dim;
    a spinner frame prompt), label and detail in the default ink.
    """
    if glyph_name in GLYPHS:
        uni, asc, _role = GLYPHS[glyph_name]
        glyph = asc if ascii else uni
    elif glyph_name in SPINNER["frames"] + SPINNER["ascii"]:
        glyph = _to_ascii(glyph_name) if ascii else glyph_name
    else:
        raise ValueError(f"unknown glyph {glyph_name!r}")
    if ascii:
        label = label.replace("…", "...")
    width = LAYOUT["labelWidth"]
    head = " " * LAYOUT["indent"] + glyph + " "
    if not detail:
        return head + label[:width]
    return head + label[: width - 1].ljust(width) + detail
