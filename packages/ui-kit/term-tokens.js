// GENERATED from sondalab.tokens.json by scripts/gen-term-js.mjs — do not edit.

/** Freeze `o` and everything inside it, so a consumer cannot edit a token. */
function freeze(o) {
  for (const v of Object.values(o)) if (v && typeof v === "object") freeze(v);
  return Object.freeze(o);
}

/** role -> SGR foreground parameters: ansi16 (the named-ANSI floor) and truecolor (the brand hue) */
export const ROLES = freeze({
  "prompt": {
    "ansi16": "93",
    "truecolor": "38;2;245;168;60"
  },
  "ok": {
    "ansi16": "32",
    "truecolor": "38;2;98;208;148"
  },
  "warn": {
    "ansi16": "33",
    "truecolor": "38;2;245;168;60"
  },
  "err": {
    "ansi16": "31",
    "truecolor": "38;2;248;113;113"
  },
  "dim": {
    "ansi16": "90",
    "truecolor": "38;2;110;128;136"
  },
  "accent": {
    "ansi16": "36",
    "truecolor": "38;2;53;160;180"
  }
});

/** name -> unicode, ascii and role; ascii on a non-UTF-8 locale, TERM=dumb or SONDALAB_ASCII=1 */
export const GLYPHS = freeze({
  "done": {
    "unicode": "✓",
    "ascii": "+",
    "role": "ok"
  },
  "fixed": {
    "unicode": "✓",
    "ascii": "+",
    "role": "ok"
  },
  "failed": {
    "unicode": "✗",
    "ascii": "x",
    "role": "err"
  },
  "warn": {
    "unicode": "!",
    "ascii": "!",
    "role": "warn"
  },
  "active": {
    "unicode": "●",
    "ascii": "*",
    "role": "prompt"
  },
  "pending": {
    "unicode": "○",
    "ascii": ".",
    "role": "dim"
  },
  "skipped": {
    "unicode": "↷",
    "ascii": "-",
    "role": "dim"
  },
  "question": {
    "unicode": "?",
    "ascii": "?",
    "role": "prompt"
  },
  "separator": {
    "unicode": "·",
    "ascii": "|",
    "role": "dim"
  }
});

/** layout integers: indent, labelWidth, blankBeforeSummary, maxWidth */
export const LAYOUT = freeze({
  "indent": 2,
  "labelWidth": 28,
  "blankBeforeSummary": 1,
  "maxWidth": 100
});

/** dither ramp, lightest to darkest; ascii[i] is the fallback for unicode[i] */
export const RAMP = freeze({
  "unicode": [
    "░",
    "▒",
    "▓",
    "█"
  ],
  "ascii": [
    ".",
    ":",
    "#",
    "#"
  ]
});

/** burst spinner: frames (unicode) / ascii, one column wide, painted in role */
export const SPINNER = freeze({
  "frames": [
    " ",
    "░",
    "▒",
    "▓",
    "█",
    "▓",
    "▒",
    "░"
  ],
  "ascii": [
    " ",
    ".",
    ":",
    "#",
    "#",
    "#",
    ":",
    "."
  ],
  "intervalMs": 100,
  "delayMs": 300,
  "role": "prompt"
});

/** decode effect: glyphs plus printable ASCII in randomAscii (inclusive code points) */
export const DECODE = freeze({
  "glyphs": [
    "░",
    "▒",
    "▓",
    "█",
    "▚",
    "▞"
  ],
  "randomAscii": [
    33,
    126
  ],
  "frames": 4,
  "frameMs": 60
});

/** progress bar: cell count, role, percent column width */
export const PROGRESS = freeze({
  "cells": 24,
  "role": "prompt",
  "percentWidth": 4
});

/** redraw cap and first-output budget */
export const MOTION = freeze({
  "maxFps": 10,
  "firstOutputMs": 100
});

/** name -> unicode, ascii: rounded light box drawing and the selection seam */
export const BOX = freeze({
  "topLeft": {
    "unicode": "╭",
    "ascii": "+"
  },
  "topRight": {
    "unicode": "╮",
    "ascii": "+"
  },
  "bottomLeft": {
    "unicode": "╰",
    "ascii": "+"
  },
  "bottomRight": {
    "unicode": "╯",
    "ascii": "+"
  },
  "horizontal": {
    "unicode": "─",
    "ascii": "-"
  },
  "vertical": {
    "unicode": "│",
    "ascii": "|"
  },
  "seam": {
    "unicode": "▌",
    "ascii": ">"
  }
});

/** name -> unicode, ascii: key names in hints */
export const KEYS = freeze({
  "up": {
    "unicode": "↑",
    "ascii": "up"
  },
  "down": {
    "unicode": "↓",
    "ascii": "dn"
  }
});

/** OSC 11 timeout and prompt retry cap */
export const ROBUSTNESS = freeze({
  "osc11TimeoutMs": 100,
  "promptRetries": 3
});

/** setting -> the environment variables that control it */
export const ENV = freeze({
  "reducedMotion": [
    "SONDALAB_REDUCED_MOTION"
  ],
  "accessible": [
    "SONDALAB_ACCESSIBLE",
    "ACCESSIBLE"
  ],
  "noColor": [
    "NO_COLOR"
  ],
  "forceColor": [
    "FORCE_COLOR"
  ],
  "ci": [
    "CI"
  ],
  "term": [
    "TERM"
  ],
  "colorTerm": [
    "COLORTERM"
  ],
  "ascii": [
    "SONDALAB_ASCII"
  ]
});

/** TUI header: mark rows, accent mask ("a" paints accentRole), compact mark, columns between mark and text */
export const HEADER = freeze({
  "mark": [
    "▄█▄ ▄▄",
    "▀█▀ ▀▀",
    "▄▄▄▄▄▄"
  ],
  "markAccent": [
    "aaa...",
    "aaa...",
    "......"
  ],
  "compact": "●■",
  "compactAccent": "a.",
  "accentRole": "prompt",
  "gap": 2
});
