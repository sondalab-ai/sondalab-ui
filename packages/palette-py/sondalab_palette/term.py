"""Reference helper for the Term spec (docs/tui-patterns.md in sondalab-ui).

Pure string builders and environment checks. Nothing here starts a thread or
sleeps: the caller owns redraw and timing (SPINNER["intervalMs"],
SPINNER["delayMs"], DECODE["frameMs"], MOTION["maxFps"]). The only helpers
that do I/O are confirm() and choose(), through injectable read/write
callables, and enable_vt(), which sets the Windows console mode.
"""
from __future__ import annotations

import codecs
import os
import sys
import textwrap
from typing import Callable, Iterable, Mapping, Optional, Sequence, Tuple, TypeVar

from . import DECODE, ENV, GLYPHS, HEADER, KEYS, LAYOUT, PROGRESS, RAMP, ROBUSTNESS, ROLES, SPINNER

__all__ = [
    "accessible",
    "reduced_motion",
    "switch_on",
    "motion_enabled",
    "ascii_mode",
    "color_mode",
    "spinner_frame",
    "progress_bar",
    "decode_frames",
    "step_line",
    "header",
    "lockup",
    "TermError",
    "NoValidAnswer",
    "MissingFlag",
    "parse_yes_no",
    "parse_choice",
    "confirm",
    "choose",
    "needs_prompt",
    "summary",
    "width",
    "wrap",
    "error_block",
    "next_line",
    "key_hints",
    "arrows",
    "heading",
    "kv_line",
    "enable_vt",
]

# `paint` is public as term.paint but left out of __all__: a star-import of
# term would otherwise shadow the legacy top-level sondalab_palette.paint.
_TRUECOLOR = ("truecolor", "24bit")
_T = TypeVar("_T")

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


def _env(env: Optional[Mapping[str, str]]) -> Mapping[str, str]:
    """The environment to read: `env`, or os.environ when it is None.

    The public helpers default to None and resolve here, at call time. A
    default of os.environ would be evaluated once and kept in the signature,
    so help() or inspect.signature() would print every variable, secrets
    included (0.7.1).
    """
    return os.environ if env is None else env


def switch_on(name: str, env: Optional[Mapping[str, str]] = None) -> bool:
    """True when any variable of the ENV switch purpose `name` is on.

    `name` is an ENV key whose variables are switches: "reducedMotion",
    "accessible", "ci" or "ascii". SONDALAB_* variables count only when they
    equal "1"; CI and ACCESSIBLE count whenever set, even empty. Any other
    name, including a non-switch ENV key such as "noColor", raises KeyError.
    """
    env = _env(env)
    names = ENV[name]
    if any(var not in _SWITCH for var in names):
        raise KeyError(f"{name!r} is not a switch purpose")
    return _on(env, names)


def accessible(env: Optional[Mapping[str, str]] = None) -> bool:
    """Whether accessible mode is on, per the spec's Accessible mode section.

    On for SONDALAB_ACCESSIBLE=1, or ACCESSIBLE set to any value (even
    empty). It means plain prompts, no redraw and states written as words;
    it implies reduced_motion().
    """
    env = _env(env)
    return switch_on("accessible", env)


def reduced_motion(env: Optional[Mapping[str, str]] = None) -> bool:
    """Whether the user asked for reduced motion.

    On for SONDALAB_REDUCED_MOTION=1, or when accessible() is on. It reads
    only the user's request: motion_enabled() also turns motion off for a
    non-TTY stream, CI and TERM=dumb.
    """
    env = _env(env)
    return switch_on("reducedMotion", env) or accessible(env)


def _forced(env: Mapping[str, str]) -> bool:
    """FORCE_COLOR per force-color.org: set, and neither empty nor "0"."""
    return any(env.get(name, "") not in ("", "0") for name in ENV["forceColor"])


def _term_dumb(env: Mapping[str, str]) -> bool:
    """True when TERM is `dumb`: no colour, no motion, ASCII glyphs."""
    return any(env.get(name) == "dumb" for name in ENV["term"])


def motion_enabled(env: Optional[Mapping[str, str]] = None, isatty: Optional[bool] = None) -> bool:
    """Whether the spinner, progress bar and decode may run.

    Off for a non-TTY stream, CI set, TERM=dumb, SONDALAB_REDUCED_MOTION=1 and
    accessible mode (SONDALAB_ACCESSIBLE=1 or ACCESSIBLE set). `isatty` is the
    TTY state of the stream motion draws on; None reads sys.stderr.isatty().
    """
    env = _env(env)
    if isatty is None:
        isatty = sys.stderr.isatty()
    if not isatty or _term_dumb(env):
        return False
    return not (switch_on("ci", env) or reduced_motion(env))


def ascii_mode(
    env: Optional[Mapping[str, str]] = None,
    encoding: Optional[str] = None,
    override: Optional[bool] = None,
) -> bool:
    """Whether every glyph takes its ASCII form.

    True on a non-UTF-8 encoding, TERM=dumb or SONDALAB_ASCII=1. `override`
    is the caller's --ascii flag (True forces ASCII, False forces Unicode).
    `encoding` None reads the charset of the first set of LC_ALL, LC_CTYPE,
    LANG in `env` ("en_US.UTF-8" gives UTF-8); none set, or no charset, is ASCII.
    """
    env = _env(env)
    if override is not None:
        return override
    if _term_dumb(env) or switch_on("ascii", env):
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
    env: Optional[Mapping[str, str]] = None,
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
    env = _env(env)
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


def step_line(glyph_name: str, label: str, detail: str = "", ascii: bool = False, *, mode: str = "none") -> str:
    """One step-list line: indent, glyph, label padded to labelWidth, detail.

    `glyph_name` is a GLYPHS key, or a spinner frame (SPINNER frames/ascii).
    With a detail the label is cut at labelWidth - 1, so a space always
    separates them; without one it is cut at labelWidth, with no trailing
    padding. Never wrapped. In ASCII, `…` becomes `...`.
    `mode` (a color_mode() result, 0.9.0) paints the glyph only, with
    GLYPHS[name][2] or SPINNER["role"] for a spinner frame; the default
    'none' is uncoloured. Label and detail stay in the default ink.
    """
    if glyph_name in GLYPHS:
        uni, asc, role = GLYPHS[glyph_name]
        glyph = asc if ascii else uni
    elif glyph_name in SPINNER["frames"] + SPINNER["ascii"]:
        glyph = _to_ascii(glyph_name) if ascii else glyph_name
        role = str(SPINNER["role"])
    else:
        raise ValueError(f"unknown glyph {glyph_name!r}")
    if ascii:
        label = label.replace("…", "...")
    head = " " * LAYOUT["indent"] + paint(glyph, role, mode) + " "
    return head + _label(label, detail)


def _label(label: str, detail: str) -> str:
    """`label` cut and padded to LAYOUT["labelWidth"], then `detail`.

    With a detail the label is cut at labelWidth - 1 so one space always
    separates them; without one it is cut at labelWidth and not padded.
    Shared by step_line() and kv_line() so the two columns line up.
    """
    width = LAYOUT["labelWidth"]
    if not detail:
        return label[:width]
    return label[: width - 1].ljust(width) + detail


_MODES = ("none", "ansi16", "truecolor")


def paint(text: str, role: str, mode: str) -> str:
    """`text` in `role`'s colour for `mode`, the spec-compliant painter (0.9.0).

    `mode` is a color_mode() result: 'none' returns `text` unchanged,
    'ansi16' uses the role's named-ANSI code (the floor; `dim` is
    bright_black, never SGR 2), 'truecolor' its brand hue. Empty text stays
    empty; an unknown role or mode raises ValueError.
    """
    if role not in ROLES:
        raise ValueError(f"unknown role {role!r}")
    if mode not in _MODES:
        raise ValueError(f"unknown colour mode {mode!r}")
    if mode == "none" or not text:
        return text
    code, (r, g, b) = ROLES[role]
    sgr = f"38;2;{r};{g};{b}" if mode == "truecolor" else str(code)
    return f"\033[{sgr}m{text}\033[0m"


def _columns(env: Mapping[str, str]) -> int:
    """The terminal width: COLUMNS in `env`, else stdout's size, else the cap.

    Not shutil.get_terminal_size(): it reads COLUMNS from os.environ, so an
    explicit `env` would not decide the width. A COLUMNS or size of 0 or
    less counts as unknown.
    """
    try:
        cols = int(env["COLUMNS"])
    except (KeyError, ValueError):
        cols = 0
    if cols > 0:
        return cols
    try:
        cols = os.get_terminal_size(sys.stdout.fileno()).columns
    except (AttributeError, OSError, ValueError):
        cols = 0
    return cols if cols > 0 else LAYOUT["maxWidth"]


def _masked(cells: str, mask: str, mode: str) -> str:
    """`cells` with each run marked "a" in `mask` painted HEADER["accentRole"]."""
    out, i = [], 0
    while i < len(cells):
        j = i
        while j < len(cells) and (mask[j] == "a") == (mask[i] == "a"):
            j += 1
        run = cells[i:j]
        out.append(paint(run, HEADER["accentRole"], mode) if mask[i] == "a" else run)
        i = j
    return "".join(out)


def _lockup(text: str, mode: str) -> str:
    """`sonda/lab` with the slash in `prompt`, then `text`; plain text otherwise."""
    return "sonda" + paint("/", "prompt", mode) + "lab" + text


def lockup(name: str, version: str, mode: str = "none") -> str:
    """The one-line lockup `sonda/lab <name> <version>`, for `--version`.

    The slash is painted `prompt` per `mode` (a color_mode() result); the
    line is cut at LAYOUT["maxWidth"] and carries no newline. header() uses
    the same line as its fallback on a TTY that cannot draw the mark.
    """
    return _lockup(f" {name} {version}"[: LAYOUT["maxWidth"] - len("sonda/lab")], mode)


def header(
    name: str,
    version: str,
    description: str,
    *,
    compact: bool = False,
    machine: bool = False,
    env: Optional[Mapping[str, str]] = None,
    isatty: Optional[bool] = None,
) -> str:
    """The TUI header for an interactive launch; "" means print nothing.

    Full: the HEADER mark beside `sonda/lab`, `name version` and the
    description in `dim`, every line cut at LAYOUT["maxWidth"]. `compact`:
    the 2-column mark and `sonda/lab name` in `dim`, then a blank line.
    `machine` (--json, --plain), a non-TTY stdout (`isatty` None reads
    sys.stdout.isatty()) and accessible mode give "", so piped output stays
    byte-identical (0.9.0). On a TTY, TERM=dumb, ASCII mode or a terminal
    narrower than the header gives lockup(). Colour follows color_mode().
    """
    if machine:
        return ""
    env = _env(env)
    if isatty is None:
        isatty = sys.stdout.isatty()
    if not isatty or accessible(env):
        return ""
    mode = color_mode(env, isatty=isatty)
    cap = LAYOUT["maxWidth"]
    fallback = lockup(name, version, mode) + "\n"
    if _term_dumb(env) or ascii_mode(env):
        return fallback
    if compact:
        mark = HEADER["compact"]
        text = f"sonda/lab {name}"[: cap - len(mark) - 1]
        if _columns(env) < len(mark) + 1 + len(text):
            return fallback
        return _masked(mark, HEADER["compactAccent"], mode) + " " + paint(text, "dim", mode) + "\n\n"
    rows = HEADER["mark"]
    gap = " " * HEADER["gap"]
    room = cap - len(rows[0]) - len(gap)
    texts = ["sonda/lab", f"{name} {version}"[:room], description[:room]]
    if _columns(env) < len(rows[0]) + len(gap) + max(len(x) for x in texts):
        return fallback
    painted = [_lockup("", mode), texts[1], paint(texts[2], "dim", mode)]
    lines = [
        (_masked(row, mask, mode) + (gap + text if text else "")).rstrip(" ")
        for row, mask, text in zip(rows, HEADER["markAccent"], painted)
    ]
    return "\n".join(lines) + "\n"


# --- errors -----------------------------------------------------------------


class TermError(Exception):
    """A failure the caller reports as the spec's three-line error block.

    `what`, `why` and `fix` are the block's three parts, uncoloured; `fix`
    is a command (or "" when only the caller knows it). block() renders
    them through error_block(), so the exception and the block never drift.
    """

    def __init__(self, what: str, why: str = "", fix: str = "") -> None:
        super().__init__(what, why, fix)
        self.what, self.why, self.fix = what, why, fix

    def __str__(self) -> str:
        return f"{self.what}: {self.why}" if self.why else self.what

    def block(
        self, *, env: Optional[Mapping[str, str]] = None, ascii: bool = False, mode: str = "none"
    ) -> str:
        """This error as error_block() lines, for stderr."""
        return error_block(self.what, self.why, self.fix, env=env, ascii=ascii, mode=mode)


class NoValidAnswer(TermError):
    """A prompt got no valid answer: the retry cap was reached or input ended.

    Raised by confirm() and choose() after ROBUSTNESS["promptRetries"]
    unrecognised answers, or at end of input, which never takes the default.
    `fix` is empty: the caller knows the flag that answers without a prompt.
    """

    def __init__(self, question: str, why: str) -> None:
        super().__init__(f"No valid answer to: {question}", why)
        self.args = (question, why)  # so pickle and copy rebuild it through __init__
        self.question = question


class MissingFlag(TermError):
    """No TTY on stdin and the flag that answers without a prompt was not passed.

    TP "Non-TTY: no prompts": the program never takes a default on its own.
    `what` defaults to "Missing <flag>"; `fix` is `<command> <flag>`, or the
    flag alone when no command is given.
    """

    def __init__(self, flag: str, what: str = "", command: str = "") -> None:
        why = f"stdin is not a terminal, so nothing can be asked, and {flag} was not passed"
        super().__init__(what or f"Missing {flag}", why, f"{command} {flag}".strip())
        self.args = (flag, what, command)  # so pickle and copy rebuild it through __init__
        self.flag = flag


# --- prompts -----------------------------------------------------------------

_YES = ("y", "yes")
_NO = ("n", "no")


def parse_yes_no(answer: str, default: bool) -> Optional[bool]:
    """Read a `[y/N]` answer: True, False, or None when it is not recognised.

    Surrounding whitespace and case are ignored. An empty answer (Enter)
    takes `default`; y/yes is True, n/no is False; anything else is None,
    never a choice, so the caller asks again.
    """
    text = answer.strip().lower()
    if not text:
        return default
    if text in _YES:
        return True
    if text in _NO:
        return False
    return None


def parse_choice(answer: str, count: int) -> Optional[int]:
    """Read a numbered-list answer: the 0-based index, or None if not recognised.

    Only an ASCII number from 1 to `count` is a choice; surrounding
    whitespace is ignored. Empty input, 0, out-of-range numbers and anything
    else give None.
    """
    text = answer.strip()
    if not (text.isascii() and text.isdigit()):
        return None
    n = int(text)
    return n - 1 if 1 <= n <= count else None


def _stderr_write(text: str) -> None:
    """Write `text` to sys.stderr and flush, the default prompt writer."""
    sys.stderr.write(text)
    sys.stderr.flush()


def _ask(
    question: str,
    prompt: str,
    parse: Callable[[str], Optional[_T]],
    read: Optional[Callable[[], str]],
    write: Callable[[str], None],
) -> _T:
    """Write `prompt` and parse a line, up to ROBUSTNESS["promptRetries"] times.

    Returns the first non-None parse. End of input ("" from read, or
    EOFError) ends the prompt line with a newline and raises NoValidAnswer
    at once; so does the last unrecognised answer. `read` None reads
    sys.stdin.readline at call time.
    """
    tries = ROBUSTNESS["promptRetries"]
    for _ in range(tries):
        write(prompt)
        try:
            line = (read or sys.stdin.readline)()
        except EOFError:
            line = ""
        if line == "":
            write("\n")
            raise NoValidAnswer(question, "input ended before an answer")
        got = parse(line)
        if got is not None:
            return got
    raise NoValidAnswer(question, f"no recognised answer in {tries} tries")


def _prompt_mode(mode: Optional[str], env: Optional[Mapping[str, str]]) -> str:
    """`mode`, or color_mode() for stderr, where prompts are written."""
    if mode is not None:
        return mode
    return color_mode(_env(env), isatty=sys.stderr.isatty())


def confirm(
    question: str,
    *,
    default: bool = False,
    read: Optional[Callable[[], str]] = None,
    write: Optional[Callable[[str], None]] = None,
    env: Optional[Mapping[str, str]] = None,
    mode: Optional[str] = None,
) -> bool:
    """Ask `? <question> [y/N] ` (or `[Y/n]` when `default`) and return the answer.

    `read` returns one line with its newline, as readline() does, and ""
    at end of input; `write` defaults to stderr. Unrecognised input asks
    again, ROBUSTNESS["promptRetries"] times in all, then raises
    NoValidAnswer. Guard a non-TTY stdin first with needs_prompt().
    """
    mode = _prompt_mode(mode, env)
    marks = "[Y/n]" if default else "[y/N]"
    prompt = f"{paint(GLYPHS['question'][0], GLYPHS['question'][2], mode)} {question} {marks} "
    return _ask(question, prompt, lambda a: parse_yes_no(a, default), read, write or _stderr_write)


def choose(
    question: str,
    options: Sequence[str],
    *,
    read: Optional[Callable[[], str]] = None,
    write: Optional[Callable[[str], None]] = None,
    env: Optional[Mapping[str, str]] = None,
    mode: Optional[str] = None,
) -> int:
    """Ask the numbered-list question of accessible mode; return the 0-based index.

    Writes `? <question> Type a number, then Enter`, one `  n  option` row
    each, then `> `. The palette has no key reader, so this is always the
    numbered form. I/O, retries and NoValidAnswer are as in confirm();
    empty `options` raises ValueError.
    """
    if not options:
        raise ValueError("choose() needs at least one option")
    mode = _prompt_mode(mode, env)
    write = write or _stderr_write
    q = paint(GLYPHS["question"][0], GLYPHS["question"][2], mode)
    w = len(str(len(options)))
    pad = " " * LAYOUT["indent"]
    rows = "".join(f"{pad}{n:>{w}}  {opt}\n" for n, opt in enumerate(options, 1))
    write(f"{q} {question} Type a number, then Enter\n{rows}")
    return _ask(question, "> ", lambda a: parse_choice(a, len(options)), read, write)


def needs_prompt(
    flag: str,
    *,
    given: bool,
    what: str = "",
    command: str = "",
    isatty: Optional[bool] = None,
) -> bool:
    """True when the caller must prompt; False when `flag` already answered.

    `given` is whether the caller passed `flag` (e.g. --yes). Without it, a
    TTY stdin means prompt; otherwise this raises MissingFlag naming `flag`
    (TP "Non-TTY: no prompts"):
    without a terminal the program never takes a default on its own.
    `isatty` None reads sys.stdin.isatty(); `what` and `command` shape the
    error's what line and `Try:` command.
    """
    if given:
        return False
    if isatty is None:
        isatty = sys.stdin.isatty()
    if isatty:
        return True
    raise MissingFlag(flag, what, command)


# --- line patterns --------------------------------------------------------------


def _glyph(name: str, ascii: bool) -> str:
    """GLYPHS[name] in its Unicode or ASCII form, uncoloured."""
    uni, asc, _role = GLYPHS[name]
    return asc if ascii else uni


def _sep(ascii: bool, mode: str) -> str:
    """The separator glyph in `dim` with a space each side: ` · ` or ` | `."""
    return f" {paint(_glyph('separator', ascii), GLYPHS['separator'][2], mode)} "


def _cont(text: str) -> str:
    """A continuation line: `text` from the label column, indent + 2."""
    return " " * (LAYOUT["indent"] + 2) + text


def summary(ok: int, fixed: int, warn: int, failed: int, *, mode: str = "none", ascii: bool = False) -> str:
    """The summary line: `Summary  1 ok · 1 fixed · 1 warn · 1 failed`.

    All four counts, always, joined by the separator (` | ` in ASCII).
    Each count is painted ok, ok, warn, err, and a zero count dim. No
    newline; print LAYOUT["blankBeforeSummary"] blank lines before it.
    """
    parts = []
    for count, word, role in ((ok, "ok", "ok"), (fixed, "fixed", "ok"), (warn, "warn", "warn"), (failed, "failed", "err")):
        parts.append(paint(f"{count} {word}", role if count else "dim", mode))
    return "Summary  " + _sep(ascii, mode).join(parts)


def width(env: Optional[Mapping[str, str]] = None) -> int:
    """The width to wrap prose at: the terminal's, capped at LAYOUT["maxWidth"].

    The width is stdout's: COLUMNS in `env`, then sys.stdout's terminal
    size, even for text bound for stderr; when neither is known (or is 0
    or less) the cap is used. Labels are cut, never wrapped: this is
    for prose only.
    """
    return min(_columns(_env(env)), LAYOUT["maxWidth"])


def wrap(text: str, env: Optional[Mapping[str, str]] = None, *, indent: int = 0) -> str:
    """`text` as prose wrapped at width(env), every line starting `indent` spaces in.

    Whitespace runs collapse to one space; words are kept whole, so a word
    longer than the line stands on its own. Returns the lines joined by
    newlines, with no trailing newline; "" for empty text.
    """
    pad = " " * indent
    return textwrap.fill(
        " ".join(text.split()), width(env), initial_indent=pad, subsequent_indent=pad,
        break_long_words=False, break_on_hyphens=False,
    )


def error_block(
    what: str,
    why: str = "",
    fix: str = "",
    *,
    link: str = "",
    env: Optional[Mapping[str, str]] = None,
    ascii: bool = False,
    mode: str = "none",
) -> str:
    """The error block: `✗ what`, why in dim, `Try: fix` (TP Error block).

    `what` is one line cut at LAYOUT["maxWidth"], not labelWidth (no detail
    column). `why` is prose wrapped at width(env) from the label column.
    `fix` and `link` are never cut or wrapped: they are copy-paste. In ASCII
    `…` becomes `...` in `what` and `why` before the cut or the wrap. An
    empty `why` or `fix` omits its line. No trailing newline; for stderr.
    """
    if ascii:
        what, why = what.replace("…", "..."), why.replace("…", "...")
    col = LAYOUT["indent"] + 2
    head = " " * LAYOUT["indent"] + paint(_glyph("failed", ascii), GLYPHS["failed"][2], mode) + " "
    lines = [head + what[: LAYOUT["maxWidth"] - col]]
    if why:
        lines += [_cont(paint(line[col:], "dim", mode)) for line in wrap(why, env, indent=col).split("\n")]
    if fix:
        tail = _sep(ascii, mode) + paint(link, "dim", mode) if link else ""
        lines.append(_cont(f"{paint('Try:', 'prompt', mode)} {fix}{tail}"))
    return "\n".join(lines)


def next_line(command: str, *, mode: str = "none") -> str:
    """The `Next:` continuation line under a success step, `Next:` in dim.

    Names the follow-up command; it starts in the label column. Print it
    only when a follow-up exists. No newline.
    """
    return _cont(f"{paint('Next:', 'dim', mode)} {command}")


def arrows(*, ascii: bool = False) -> str:
    """The movement keys for a key hint: `↑↓`, or `up/dn` in ASCII.

    Built from KEYS["up"] and KEYS["down"]; pass it as the key of a
    key_hints() pair.
    """
    up, down = KEYS["up"], KEYS["down"]
    return f"{up[1]}/{down[1]}" if ascii else f"{up[0]}{down[0]}"


def key_hints(pairs: Iterable[Tuple[str, str]], *, ascii: bool = False, mode: str = "none") -> str:
    """The full-screen footer: `key verb` pairs joined by the separator glyph.

    Keys are painted `accent`, verbs `dim`, the separator `dim` (` · `, or
    ` | ` in ASCII). Shared keys: `/` filter, `:` command, `?` help, `q`/`esc`
    back, `ctrl-c` quit; arrows() names the movement keys.
    """
    return _sep(ascii, mode).join(f"{paint(k, 'accent', mode)} {paint(v, 'dim', mode)}" for k, v in pairs)


def heading(text: str, *, mode: str = "none") -> str:
    """A section heading over a group of step or report lines (TP Report lines).

    The micro label: `text` uppercase, in `dim`, from column 0. Print one
    blank line before every heading but the first. No newline.
    """
    return paint(text.upper(), "dim", mode)


def kv_line(key: str, value: str) -> str:
    """A key-value report line: a fact, not a check (TP Report lines).

    The key starts in the label column and is padded like a step label,
    so values line up with step details; the glyph cell stays blank.
    A long key is cut at labelWidth - 1 when a value follows, at
    labelWidth when the value is empty; never wrapped. Uncoloured.
    """
    return " " * (LAYOUT["indent"] + 2) + _label(key, value)


# --- Windows ------------------------------------------------------------------

_VT_PROCESSING = 0x0004  # ENABLE_VIRTUAL_TERMINAL_PROCESSING


def enable_vt(stream=None) -> bool:
    """Turn on VT processing for `stream`'s console; False means plain text.

    Pass the stream you draw on: spinners, progress and prompts draw on
    sys.stderr; None means sys.stdout. A no-op returning True off Windows.
    On Windows it sets ENABLE_VIRTUAL_TERMINAL_PROCESSING on that console
    handle; False when that fails, and the caller then writes no escape
    sequences, no motion and ASCII glyphs (TP Windows).
    """
    if os.name != "nt":
        return True
    try:
        import ctypes
        import msvcrt
        from ctypes import wintypes
    except ImportError:
        return False
    try:
        handle = msvcrt.get_osfhandle((sys.stdout if stream is None else stream).fileno())  # type: ignore[attr-defined]
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)  # type: ignore[attr-defined]
        get_mode, set_mode = kernel32.GetConsoleMode, kernel32.SetConsoleMode
        get_mode.argtypes, get_mode.restype = (wintypes.HANDLE, wintypes.LPDWORD), wintypes.BOOL
        set_mode.argtypes, set_mode.restype = (wintypes.HANDLE, wintypes.DWORD), wintypes.BOOL
        current = wintypes.DWORD()
        if not get_mode(handle, ctypes.byref(current)):
            return False
        if current.value & _VT_PROCESSING:
            return True
        return bool(set_mode(handle, current.value | _VT_PROCESSING))
    except (AttributeError, OSError, ValueError, ctypes.ArgumentError):
        return False
