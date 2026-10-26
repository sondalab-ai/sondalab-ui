# GENERATED from sondalab.tokens.json — do not edit.
"""Sondalab terminal palette: semantic roles, named-ANSI floor + truecolor opt-in."""
import os

# role -> (named_ansi_sgr_code, (r, g, b))
ROLES = {
    "prompt": (93, (245, 168, 60)),
    "ok": (32, (98, 208, 148)),
    "warn": (33, (245, 168, 60)),
    "err": (31, (248, 113, 113)),
    "dim": (90, (110, 128, 136)),
    "accent": (36, (53, 160, 180)),
}

# name -> (unicode, ascii, role); ascii is used on a non-UTF-8 locale or TERM=dumb
GLYPHS = {
    "done": ("✓", "+", "ok"),
    "fixed": ("✓", "+", "ok"),
    "failed": ("✗", "x", "err"),
    "warn": ("!", "!", "warn"),
    "active": ("●", "*", "prompt"),
    "pending": ("○", ".", "dim"),
    "skipped": ("↷", "-", "dim"),
    "question": ("?", "?", "prompt"),
    "separator": ("·", "|", "dim"),
}

# layout integers: indent, labelWidth, blankBeforeSummary, maxWidth
LAYOUT = {
    "indent": 2,
    "labelWidth": 28,
    "blankBeforeSummary": 1,
    "maxWidth": 100,
}

# dither ramp, lightest to darkest; ascii[i] is the fallback for unicode[i]
RAMP = {
    "unicode": ("░", "▒", "▓", "█"),
    "ascii": (".", ":", "#", "#"),
}

# burst spinner: frames (unicode) / ascii, one column wide, painted in role
SPINNER = {
    "frames": (" ", "░", "▒", "▓", "█", "▓", "▒", "░"),
    "ascii": (" ", ".", ":", "#", "#", "#", ":", "."),
    "intervalMs": 100,
    "delayMs": 300,
    "role": "prompt",
}

# decode effect: glyphs plus printable ASCII in randomAscii (inclusive code points)
DECODE = {
    "glyphs": ("░", "▒", "▓", "█", "▚", "▞"),
    "randomAscii": (33, 126),
    "frames": 4,
    "frameMs": 60,
}

# progress bar: cell count, role, percent column width
PROGRESS = {
    "cells": 24,
    "role": "prompt",
    "percentWidth": 4,
}

# redraw cap and first-output budget
MOTION = {
    "maxFps": 10,
    "firstOutputMs": 100,
}

# name -> (unicode, ascii): rounded light box drawing and the selection seam
BOX = {
    "topLeft": ("╭", "+"),
    "topRight": ("╮", "+"),
    "bottomLeft": ("╰", "+"),
    "bottomRight": ("╯", "+"),
    "horizontal": ("─", "-"),
    "vertical": ("│", "|"),
    "seam": ("▌", ">"),
}

# name -> (unicode, ascii): key names in hints
KEYS = {
    "up": ("↑", "up"),
    "down": ("↓", "dn"),
}

# OSC 11 timeout and prompt retry cap
ROBUSTNESS = {
    "osc11TimeoutMs": 100,
    "promptRetries": 3,
}

# setting -> the environment variables that control it
ENV = {
    "reducedMotion": ("SONDALAB_REDUCED_MOTION",),
    "accessible": ("SONDALAB_ACCESSIBLE", "ACCESSIBLE"),
    "noColor": ("NO_COLOR",),
    "forceColor": ("FORCE_COLOR",),
    "ci": ("CI",),
    "term": ("TERM",),
    "colorTerm": ("COLORTERM",),
    "ascii": ("SONDALAB_ASCII",),
}


def _no_color() -> bool:
    return bool(os.environ.get("NO_COLOR"))


def supports_truecolor() -> bool:
    return os.environ.get("COLORTERM", "").lower() in ("truecolor", "24bit")


def paint(text: str, role: str, *, err: bool = False) -> str:
    """Wrap text in role's SGR; NO_COLOR and COLORTERM only. Spec callers: term.color_mode."""
    if _no_color() or role not in ROLES:
        return text
    code, (r, g, b) = ROLES[role]
    sgr = f"38;2;{r};{g};{b}" if supports_truecolor() else str(code)
    return f"\033[{sgr}m{text}\033[0m"
