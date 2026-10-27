"""Golden cases for @sondalab/ui-kit/term.js, computed by sondalab_palette.term.

Writes scripts/fixtures/term-parity.json: each case is a Python call (fn, args,
kwargs) and what it gave (out, or raises). scripts/term-parity.test.mjs runs the
same cases through term.js and asserts byte equality; the palette's
tests/test_term_parity.py re-runs them through Python, so a change on either side
fails CI. Regenerate after changing a case or term.py:

    uv run --no-project --python 3.9 --with-editable packages/palette-py \\
        python scripts/gen-term-parity.py
"""
import json
import sys
from pathlib import Path

from sondalab_palette import term

OUT = Path(__file__).resolve().parent / "fixtures" / "term-parity.json"

UTF8 = {"LANG": "en_US.UTF-8", "COLUMNS": "80"}
MODES = ("none", "ansi16", "truecolor")
EMOJI = "Deploy \U0001F680 rocket to the moon and far beyond it"


class Cycle:
    """A stand-in rng: choice() walks the pool by a fixed stride, so both languages agree."""

    def __init__(self):
        self.k = 0

    def choice(self, pool):
        self.k += 7
        return pool[self.k % len(pool)]


class Lines:
    """read()/write() for confirm() and choose(): `lines` then end of input."""

    def __init__(self, lines):
        self.lines = list(lines)
        self.out = []

    def read(self):
        return self.lines.pop(0) if self.lines else ""

    def write(self, s):
        self.out.append(s)


def case(fn, *args, **kwargs):
    return {"fn": fn, "args": list(args), "kwargs": kwargs}


def cases():
    out = []
    # colour precedence matrix
    envs = [
        {}, {"NO_COLOR": "1"}, {"NO_COLOR": ""}, {"FORCE_COLOR": "1"}, {"FORCE_COLOR": "0"},
        {"FORCE_COLOR": ""}, {"NO_COLOR": "1", "FORCE_COLOR": "1"}, {"TERM": "dumb"},
        {"TERM": "dumb", "FORCE_COLOR": "3"}, {"COLORTERM": "truecolor"}, {"COLORTERM": "24BIT"},
        {"COLORTERM": "256color"}, {"NO_COLOR": "x", "COLORTERM": "truecolor"},
    ]
    for env in envs:
        for isatty in (True, False):
            for flag in (None, True, False):
                for truecolor in (False, True):
                    out.append(case("color_mode", env=env, isatty=isatty, flag=flag, truecolor=truecolor))
    # switches
    for env in ({}, {"CI": ""}, {"CI": "false"}, {"ACCESSIBLE": ""}, {"SONDALAB_ACCESSIBLE": "1"},
                {"SONDALAB_ACCESSIBLE": "true"}, {"SONDALAB_REDUCED_MOTION": "1"}, {"SONDALAB_ASCII": "1"},
                {"TERM": "dumb"}):
        out.append(case("accessible", env=env))
        out.append(case("reduced_motion", env=env))
        for name in ("reducedMotion", "accessible", "ci", "ascii"):
            out.append(case("switch_on", name, env=env))
        for isatty in (True, False):
            out.append(case("motion_enabled", env=env, isatty=isatty))
    out.append(case("switch_on", "noColor", env={}))
    out.append(case("switch_on", "nope", env={}))
    # ASCII mode
    for env in ({}, {"LANG": "en_US.UTF-8"}, {"LANG": "de_DE.UTF-8@euro"}, {"LC_CTYPE": "UTF-8"},
                {"LANG": "C"}, {"LANG": "POSIX"}, {"LANG": "en_US.ISO-8859-1"}, {"LANG": "en_US.utf8"},
                {"LC_ALL": "C", "LANG": "en_US.UTF-8"}, {"LC_ALL": "", "LANG": "en_US.UTF-8"},
                {"LANG": "en_US.UTF-8", "TERM": "dumb"}, {"LANG": "en_US.UTF-8", "SONDALAB_ASCII": "1"}):
        out.append(case("ascii_mode", env=env))
    for enc in ("UTF-8", "utf8", "U8", "utf", "UTF_8", "utf-8-sig", "cp65001", "latin1", "ascii", "", "utf 8", "--utf--8--"):
        out.append(case("ascii_mode", env={}, encoding=enc))
    for override in (True, False):
        out.append(case("ascii_mode", env={"TERM": "dumb"}, override=override))
    # paint and lockup
    for role in ("prompt", "ok", "warn", "err", "dim", "accent"):
        for mode in MODES:
            out.append(case("paint", "x y", role, mode))
    out += [case("paint", "", "ok", "ansi16"), case("paint", "x", "bold", "none"), case("paint", "x", "ok", "256")]
    for mode in MODES:
        out.append(case("lockup", "cld", "0.9.0", mode))
    out.append(case("lockup", "n" * 120, "1.0.0"))
    # step lines
    for glyph in ("done", "fixed", "failed", "warn", "active", "pending", "skipped", "question", "separator",
                  " ", "░", "▓", "█", ".", "#"):
        for ascii in (False, True):
            out.append(case("step_line", glyph, "Resolved 128 probes", "2.1s", ascii=ascii, mode="ansi16"))
    long_label = "Checking the configuration of every installed hook…"
    for detail in ("", "ok"):
        for ascii in (False, True):
            out.append(case("step_line", "active", long_label, detail, ascii=ascii))
    out += [
        case("step_line", "done", "x" * 28, "d"), case("step_line", "done", "x" * 27, "d"),
        case("step_line", "done", "x" * 28), case("step_line", "done", EMOJI, "d"),
        case("step_line", "done", "Resolved", "2.1s", mode="truecolor"), case("step_line", "nope", "x"),
    ]
    # header
    full = ("cld", "0.9.0", "Manage Claude Code loadouts.")
    for env in (UTF8, dict(UTF8, NO_COLOR="1"), dict(UTF8, COLORTERM="truecolor"), dict(UTF8, TERM="dumb"),
                dict(UTF8, SONDALAB_ASCII="1"), {"COLUMNS": "80"}, dict(UTF8, ACCESSIBLE=""),
                dict(UTF8, COLUMNS="30"), dict(UTF8, COLUMNS="15"), dict(UTF8, COLUMNS="12"), dict(UTF8, COLUMNS="x"),
                dict(UTF8, COLUMNS=" 40 "), dict(UTF8, COLUMNS="4_0"), dict(UTF8, COLUMNS="-5")):
        for compact in (False, True):
            for isatty in (True, False):
                out.append(case("header", *full, compact=compact, env=env, isatty=isatty))
    out += [
        case("header", *full, machine=True, env=UTF8, isatty=True),
        case("header", "cld", "0.9.0", "", env=UTF8, isatty=True),
        case("header", "cld", "0.9.0", "d" * 150, env=dict(UTF8, COLUMNS="200"), isatty=True),
        case("header", "n" * 150, "1.0", "x", compact=True, env=dict(UTF8, COLUMNS="200"), isatty=True),
        case("header", "cld", "0.9.0", "trailing   ", env=UTF8, isatty=True),
    ]
    # spinner, progress, decode
    for i in (0, 1, 7, 8, 9, -1, -9, 100):
        for ascii in (False, True):
            out.append(case("spinner_frame", i, ascii=ascii))
    for done, total in ((0, 1), (1, 1), (61, 128), (127, 128), (128, 128), (200, 128), (-3, 128),
                        (1, 3), (2, 3), (1, 200), (199, 200), (5, 1000), (0, 0), (1, -1)):
        for ascii in (False, True):
            out.append(case("progress_bar", done, total, ascii=ascii))
    for value in ("sha 9c41e0b", "", "a", "two  spaces", "\U0001F680x"):
        for ascii in (False, True):
            out.append(case("decode_frames", value, ascii=ascii))
    # summary
    for counts in ((1, 1, 1, 1), (0, 0, 0, 0), (3, 0, 2, 0), (12, 1, 0, 1)):
        for mode in MODES:
            for ascii in (False, True):
                out.append(case("summary", *counts, mode=mode, ascii=ascii))
    # width and wrap
    for cols in ("80", "100", "150", "1", "0", "-1", "abc", "", " 72\n", "+60", "6_0", "_60", "60.0"):
        out.append(case("width", {"COLUMNS": cols}))
    prose = "git ls-remote timed out after 10s (exit 128) while   reaching\torigin\n over ssh"
    for cols in ("80", "30", "20", "12", "5", "1"):
        for indent in (0, 4):
            out.append(case("wrap", prose, {"COLUMNS": cols}, indent=indent))
    out += [
        case("wrap", "", {"COLUMNS": "40"}), case("wrap", "  \t ", {"COLUMNS": "40"}),
        case("wrap", "a " + "b" * 50 + " c", {"COLUMNS": "20"}, indent=2),
        case("wrap", "x\x1cy\x85z\xa0w　v﻿u", {"COLUMNS": "40"}),
        case("wrap", EMOJI, {"COLUMNS": "20"}), case("wrap", "word " * 40, {"COLUMNS": "200"}),
        case("wrap", "exactly ten chars here", {"COLUMNS": "10"}),
    ]
    # error block
    eb = ("Could not reach origin", "git ls-remote timed out after 10s (exit 128)", "git remote -v")
    for mode in MODES:
        for ascii in (False, True):
            out.append(case("error_block", *eb, link="sondalab.eu/e/T102", env={"COLUMNS": "80"}, ascii=ascii, mode=mode))
    out += [
        case("error_block", *eb, env={"COLUMNS": "30"}),
        case("error_block", *eb, env={"COLUMNS": "1"}),
        case("error_block", eb[0], "", "", env={"COLUMNS": "80"}),
        case("error_block", eb[0], eb[1], "", env={"COLUMNS": "80"}),
        case("error_block", eb[0], "", eb[2], env={"COLUMNS": "80"}),
        case("error_block", eb[0], "   ", eb[2], env={"COLUMNS": "80"}),
        case("error_block", "W" * 130, "y" * 130, "f" * 130, link="l" * 50, env={"COLUMNS": "60"}),
        case("error_block", "Stopped…", "waited… then gave up", "retry…", env={"COLUMNS": "80"}, ascii=True),
        case("error_block", EMOJI * 3, EMOJI, "x", env={"COLUMNS": "40"}),
    ]
    # line patterns
    for mode in MODES:
        out += [
            case("next_line", "smartctx doctor --fix", mode=mode),
            case("heading", "Config straße", mode=mode),
        ]
        for ascii in (False, True):
            out.append(case("key_hints", [["↑↓", "move"], ["q", "back"], ["/", "filter"]], ascii=ascii, mode=mode))
    out += [case("key_hints", []), case("arrows"), case("arrows", ascii=True)]
    for key, value in (("Profile", "work"), ("x" * 40, "v"), ("x" * 40, ""), ("Key", ""), (EMOJI, "v")):
        out.append(case("kv_line", key, value))
    # parsing and guards
    for answer in ("", "\n", "  \n", "y", "Y", "yes", " YES \n", "n", "No", "nope", "yy", "1", "\x1cy\x85", "﻿y"):
        for default in (False, True):
            out.append(case("parse_yes_no", answer, default))
    for answer in ("1", "3", "4", "0", "", " 2 \n", "02", "-1", "+1", "1.0", "٣", "x", "99999999999999999999"):
        out.append(case("parse_choice", answer, 3))
    out += [
        case("needs_prompt", "--yes", given=True, isatty=False),
        case("needs_prompt", "--yes", given=False, isatty=True),
        case("needs_prompt", "--yes", given=False, isatty=False),
        case("needs_prompt", "--force", given=False, what="Refusing to overwrite", command="cld apply", isatty=False),
        case("TermError", "Bad config", "line 3 is not TOML", "cld config --edit"),
        case("TermError", "Bad config"),
        case("NoValidAnswer", "Continue?", "input ended before an answer"),
        case("MissingFlag", "--yes"),
        case("MissingFlag", "--yes", "Refusing", "cld rm"),
    ]
    # prompts
    for lines in ([], ["y\n"], ["\n"], ["maybe\n", "n\n"], ["a\n", "b\n", "c\n"], ["a\n", "b\n", "yes\n"], ["y"], ["  \n"], ["x\n"]):
        for default in (False, True):
            out.append(case("confirm", "Delete 3 files?", default=default, lines=lines, mode="none"))
    out.append(case("confirm", "Delete?", lines=["y\n"], mode="ansi16"))
    opts = ["alpha", "beta", "gamma"]
    for lines in ([], ["2\n"], ["0\n", "4\n", "3\n"], ["x\n", "y\n", "z\n"], ["1"]):
        out.append(case("choose", "Pick one", opts, lines=lines, mode="none"))
    out += [
        case("choose", "Pick", [str(n) for n in range(1, 12)], lines=["11\n"], mode="ansi16"),
        case("choose", "Pick", [], lines=[], mode="none"),
    ]
    return out


def run(c):
    """Run one case through sondalab_palette.term; return the case with its result."""
    fn, args, kwargs = c["fn"], list(c["args"]), dict(c["kwargs"])
    res = dict(c)
    try:
        if fn in ("TermError", "NoValidAnswer", "MissingFlag"):
            e = getattr(term, fn)(*args, **kwargs)
            got = {"str": str(e), "what": e.what, "why": e.why, "fix": e.fix,
                   "block": e.block(env={"COLUMNS": "80"}), "block_ansi": e.block(env={"COLUMNS": "40"}, mode="ansi16", ascii=True)}
        elif fn in ("confirm", "choose"):
            io = Lines(kwargs.pop("lines"))
            try:
                got = {"value": getattr(term, fn)(*args, read=io.read, write=io.write, **kwargs)}
            except term.NoValidAnswer as e:
                got = {"raises": "NoValidAnswer", "str": str(e)}
            got["written"] = "".join(io.out)
        elif fn == "decode_frames":
            got = term.decode_frames(args[0], Cycle(), **kwargs)
        else:
            got = getattr(term, fn)(*args, **kwargs)
        res["out"] = got
    except term.TermError as e:
        res["raises"] = type(e).__name__
        res["out"] = {"str": str(e), "what": e.what, "why": e.why, "fix": e.fix}
    except (ValueError, KeyError) as e:
        res["raises"] = type(e).__name__
    return res


def main():
    data = [run(c) for c in cases()]
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"gen-term-parity: wrote {len(data)} cases to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
