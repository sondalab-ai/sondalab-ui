"""The 0.9.0 public helpers: paint, lockup, prompts, guards, summary, width, error lines, VT."""
import inspect
import re

import pytest

import sondalab_palette as p
from sondalab_palette import term as t

SGR = re.compile(r"\x1b\[[0-9;]*m")
RETRIES = p.ROBUSTNESS["promptRetries"]


def sgr(role):
    return "\x1b[%dm" % p.ROLES[role][0]


def plain(s):
    return SGR.sub("", s)


class IO:
    """Scripted read/write pair: `answers` are returned by read() in order."""

    def __init__(self, *answers):
        self.answers = list(answers)
        self.reads = 0
        self.out = []

    def read(self):
        self.reads += 1
        if not self.answers:
            return ""
        return self.answers.pop(0)

    def write(self, s):
        self.out.append(s)

    @property
    def text(self):
        return "".join(self.out)


# --- paint ----------------------------------------------------------------

def test_paint_none_is_plain():
    assert t.paint("x", "ok", "none") == "x"


def test_paint_ansi16_is_the_named_floor():
    assert t.paint("x", "ok", "ansi16") == "\x1b[32mx\x1b[0m"


def test_paint_truecolor_uses_the_brand_hue():
    assert t.paint("x", "ok", "truecolor") == "\x1b[38;2;98;208;148mx\x1b[0m"


def test_paint_dim_is_the_role_not_sgr_2():
    assert t.paint("x", "dim", "ansi16") == "\x1b[90mx\x1b[0m"
    assert "\x1b[2m" not in t.paint("x", "dim", "ansi16")


def test_paint_empty_text_stays_empty():
    assert t.paint("", "ok", "ansi16") == ""


@pytest.mark.parametrize("role,mode", [("nope", "ansi16"), ("ok", "256"), ("ok", "")])
def test_paint_rejects_unknown_role_or_mode(role, mode):
    with pytest.raises(ValueError):
        t.paint("x", role, mode)


@pytest.mark.parametrize(
    "env,isatty,flag,expected",
    [
        ({}, True, None, "\x1b[32mx\x1b[0m"),
        ({}, False, None, "x"),
        ({"NO_COLOR": "1"}, True, None, "x"),
        ({"NO_COLOR": "1"}, False, True, "\x1b[32mx\x1b[0m"),
        ({"FORCE_COLOR": "1"}, False, None, "\x1b[32mx\x1b[0m"),
        ({"FORCE_COLOR": "1"}, True, False, "x"),
        ({"FORCE_COLOR": "0"}, False, None, "x"),
        ({"TERM": "dumb"}, True, None, "x"),
        ({"TERM": "dumb", "FORCE_COLOR": "1"}, True, None, "\x1b[32mx\x1b[0m"),
        ({"COLORTERM": "truecolor"}, True, None, "\x1b[32mx\x1b[0m"),
    ],
)
def test_paint_follows_color_mode(env, isatty, flag, expected):
    assert t.paint("x", "ok", t.color_mode(env, isatty, flag)) == expected


def test_paint_truecolor_only_on_opt_in():
    env = {"COLORTERM": "24bit"}
    assert t.paint("x", "ok", t.color_mode(env, True, truecolor=True)).startswith("\x1b[38;2;")


# --- step_line mode ---------------------------------------------------------

def test_step_line_paints_only_the_glyph():
    line = t.step_line("failed", "Verify remote", "origin unreachable", mode="ansi16")
    assert line == "  " + sgr("err") + "✗\x1b[0m Verify remote               origin unreachable"


def test_step_line_paints_a_spinner_frame_in_the_spinner_role():
    assert t.step_line("▒", "Resolving", mode="ansi16") == "  " + sgr(p.SPINNER["role"]) + "▒\x1b[0m Resolving"


def test_step_line_default_is_uncoloured():
    assert t.step_line("done", "x") == "  ✓ x"


# --- lockup -----------------------------------------------------------------

def test_lockup_is_one_line_with_the_slash_in_prompt():
    assert t.lockup("cld", "0.9.0") == "sonda/lab cld 0.9.0"
    assert t.lockup("cld", "0.9.0", "ansi16") == "sonda" + sgr("prompt") + "/\x1b[0mlab cld 0.9.0"


def test_lockup_is_cut_at_the_cap():
    assert len(t.lockup("x" * 300, "1.0")) == p.LAYOUT["maxWidth"]


# --- parse_yes_no -------------------------------------------------------------

@pytest.mark.parametrize(
    "answer,default,expected",
    [
        ("", False, False),
        ("", True, True),
        ("\n", True, True),
        ("  \n", False, False),
        ("y", False, True),
        ("Y\n", False, True),
        ("yes", False, True),
        (" YES ", False, True),
        ("n", True, False),
        ("No\n", True, False),
        ("yep", False, None),
        ("1", False, None),
        ("ny", True, None),
        ("q", True, None),
    ],
)
def test_parse_yes_no(answer, default, expected):
    assert t.parse_yes_no(answer, default) is expected


# --- confirm ------------------------------------------------------------------

def test_confirm_prompt_shape_default_no():
    io = IO("y\n")
    assert t.confirm("Install the hook into ~/.config/git?", read=io.read, write=io.write, mode="none") is True
    assert io.text == "? Install the hook into ~/.config/git? [y/N] "


def test_confirm_prompt_shape_default_yes_and_enter_takes_it():
    io = IO("\n")
    assert t.confirm("Install the hook?", True, read=io.read, write=io.write, mode="none") is True
    assert io.text == "? Install the hook? [Y/n] "


def test_confirm_paints_the_question_glyph_in_prompt():
    io = IO("n\n")
    assert t.confirm("Delete probe q-8f2a?", read=io.read, write=io.write, mode="ansi16") is False
    assert io.text == sgr("prompt") + "?\x1b[0m Delete probe q-8f2a? [y/N] "


def test_confirm_asks_again_on_unrecognised_input():
    io = IO("maybe\n", "y\n")
    assert t.confirm("Go?", read=io.read, write=io.write, mode="none") is True
    assert io.reads == 2
    assert io.text == "? Go? [y/N] " * 2


def test_confirm_last_allowed_try_succeeds():
    io = IO(*(["what\n"] * (RETRIES - 1) + ["n\n"]))
    assert t.confirm("Go?", True, read=io.read, write=io.write, mode="none") is False
    assert io.reads == RETRIES


def test_confirm_fails_after_the_retry_cap():
    io = IO(*(["what\n"] * (RETRIES + 5)))
    with pytest.raises(t.NoValidAnswer) as e:
        t.confirm("Go?", read=io.read, write=io.write, mode="none")
    assert io.reads == RETRIES
    assert "no valid answer" in str(e.value).lower()
    assert isinstance(e.value, t.TermError)


def test_confirm_end_of_input_never_takes_the_default():
    io = IO()
    with pytest.raises(t.NoValidAnswer):
        t.confirm("Go?", True, read=io.read, write=io.write, mode="none")
    assert io.reads == 1


def test_confirm_eoferror_from_read_is_no_answer():
    def read():
        raise EOFError

    with pytest.raises(t.NoValidAnswer):
        t.confirm("Go?", read=read, write=lambda s: None, mode="none")


def test_confirm_default_writer_goes_to_stderr(capsys):
    t.confirm("Go?", read=lambda: "y\n", env={"NO_COLOR": "1"})
    out = capsys.readouterr()
    assert out.out == "" and out.err == "? Go? [y/N] "


# --- parse_choice / choose ------------------------------------------------------

@pytest.mark.parametrize(
    "answer,count,expected",
    [("1", 3, 0), ("3\n", 3, 2), (" 2 ", 3, 1), ("0", 3, None), ("4", 3, None),
     ("", 3, None), ("two", 3, None), ("-1", 3, None), ("1.0", 3, None), ("²", 3, None)],
)
def test_parse_choice(answer, count, expected):
    assert t.parse_choice(answer, count) == expected


def test_choose_draws_the_numbered_list():
    io = IO("2\n")
    got = t.choose("Open which probe?", ["q-8f2a  ok", "q-71c0  live", "q-0d9e  err"],
                   read=io.read, write=io.write, mode="none")
    assert got == 1
    assert io.text == (
        "? Open which probe? Type a number, then Enter\n"
        "  1  q-8f2a  ok\n"
        "  2  q-71c0  live\n"
        "  3  q-0d9e  err\n"
        "> "
    )


def test_choose_right_aligns_numbers_past_nine():
    io = IO("10\n")
    assert t.choose("Pick?", [str(i) for i in range(10)], read=io.read, write=io.write, mode="none") == 9
    assert "\n   1  0\n" in io.text and "\n  10  9\n" in io.text


def test_choose_retries_then_fails():
    io = IO(*(["x\n"] * (RETRIES + 2)))
    with pytest.raises(t.NoValidAnswer):
        t.choose("Pick?", ["a", "b"], read=io.read, write=io.write, mode="none")
    assert io.reads == RETRIES
    assert io.text.count("> ") == RETRIES


def test_choose_end_of_input_fails():
    io = IO()
    with pytest.raises(t.NoValidAnswer):
        t.choose("Pick?", ["a"], read=io.read, write=io.write, mode="none")


def test_choose_needs_options():
    with pytest.raises(ValueError):
        t.choose("Pick?", [], read=lambda: "1\n", write=lambda s: None, mode="none")


# --- non-TTY guard ----------------------------------------------------------------

def test_flag_given_skips_the_prompt_even_without_a_tty():
    assert t.require_tty_or_flag("--yes", True, isatty=False) is False


def test_tty_without_flag_prompts():
    assert t.require_tty_or_flag("--yes", False, isatty=True) is True


def test_no_tty_no_flag_raises_naming_the_flag():
    with pytest.raises(t.MissingFlag) as e:
        t.require_tty_or_flag("--yes", False, isatty=False, what="Could not install the hook", command="cld hook install")
    err = e.value
    assert isinstance(err, t.TermError)
    assert err.flag == "--yes"
    assert err.what == "Could not install the hook"
    assert "--yes" in err.why and "not a terminal" in err.why
    assert err.fix == "cld hook install --yes"


def test_missing_flag_defaults():
    err = t.MissingFlag("--yes")
    assert err.what == "Missing --yes"
    assert err.fix == "--yes"
    assert "--yes" in str(err)


def test_guard_reads_stdin_by_default(monkeypatch):
    class Stdin:
        def isatty(self):
            return False

    monkeypatch.setattr(t.sys, "stdin", Stdin())
    with pytest.raises(t.MissingFlag):
        t.require_tty_or_flag("--yes", False)


def test_term_error_renders_as_an_error_block():
    err = t.MissingFlag("--yes", what="Could not install", command="cld install")
    assert err.block() == t.error_block(err.what, err.why, err.fix)
    assert err.block().splitlines()[-1] == "    Try: cld install --yes"


# --- summary --------------------------------------------------------------------

def test_summary_spec_example():
    assert t.summary(1, 1, 1, 1) == "Summary  1 ok · 1 fixed · 1 warn · 1 failed"


def test_summary_ascii_separator():
    assert t.summary(1, 0, 2, 0, ascii=True) == "Summary  1 ok | 0 fixed | 2 warn | 0 failed"


def test_summary_paints_roles_and_zero_dim():
    out = t.summary(3, 0, 1, 2, mode="ansi16")
    end = "\x1b[0m"
    sep = " " + sgr("dim") + "·" + end + " "
    assert out == ("Summary  " + sgr("ok") + "3 ok" + end + sep + sgr("dim") + "0 fixed" + end + sep
                   + sgr("warn") + "1 warn" + end + sep + sgr("err") + "2 failed" + end)


def test_summary_always_has_four_counts():
    assert plain(t.summary(0, 0, 0, 0, mode="ansi16")) == "Summary  0 ok · 0 fixed · 0 warn · 0 failed"


# --- width / wrap -----------------------------------------------------------------

@pytest.mark.parametrize(
    "cols,expected",
    [("80", 80), ("100", 100), ("240", 100), ("40", 40)],
)
def test_width_is_capped(cols, expected):
    assert t.width({"COLUMNS": cols}) == expected


@pytest.mark.parametrize("cols", ["0", "-5", "wide", ""])
def test_width_unknown_columns_falls_back(cols, monkeypatch):
    def no_size(*_):
        raise OSError

    monkeypatch.setattr(t.os, "get_terminal_size", no_size)
    assert t.width({"COLUMNS": cols}) == p.LAYOUT["maxWidth"]


def test_width_terminal_size_zero_is_unknown(monkeypatch):
    class Size:
        columns = 0

    monkeypatch.setattr(t.os, "get_terminal_size", lambda *_: Size())
    assert t.width({}) == p.LAYOUT["maxWidth"]


def test_wrap_at_width_with_indent():
    text = "alpha beta gamma delta epsilon"
    assert t.wrap(text, env={"COLUMNS": "16"}, indent=4) == "    alpha beta\n    gamma delta\n    epsilon"


def test_wrap_caps_at_max_width():
    out = t.wrap("word " * 100, env={"COLUMNS": "500"})
    assert max(len(line) for line in out.split("\n")) <= p.LAYOUT["maxWidth"]


def test_wrap_keeps_long_words_whole_and_empty_is_empty():
    assert t.wrap("x" * 30, env={"COLUMNS": "10"}) == "x" * 30
    assert t.wrap("", env={"COLUMNS": "10"}) == ""


# --- error block, next line, key hints, report lines ---------------------------------

def test_error_block_spec_example():
    out = t.error_block("Could not reach origin", "git ls-remote timed out after 10s (exit 128)",
                        "git remote -v", link="sondalab.eu/e/T102")
    assert out == (
        "  ✗ Could not reach origin\n"
        "    git ls-remote timed out after 10s (exit 128)\n"
        "    Try: git remote -v · sondalab.eu/e/T102"
    )


def test_error_block_painted():
    out = t.error_block("Could not reach origin", "timed out", "git remote -v", link="x/T1", mode="ansi16")
    end = "\x1b[0m"
    assert out.split("\n") == [
        "  " + sgr("err") + "✗" + end + " Could not reach origin",
        "    " + sgr("dim") + "timed out" + end,
        "    " + sgr("prompt") + "Try:" + end + " git remote -v " + sgr("dim") + "·" + end + " " + sgr("dim") + "x/T1" + end,
    ]


def test_error_block_ascii_and_omitted_lines():
    assert t.error_block("Failed…", "", "cmd", link="l", ascii=True) == "  x Failed...\n    Try: cmd | l"
    assert t.error_block("Failed") == "  ✗ Failed"


def test_error_block_what_is_not_cut_at_label_width():
    what = "Could not resolve the workspace probe cache directory"
    assert t.error_block(what).split("\n")[0] == "  ✗ " + what


def test_next_line():
    assert t.next_line("smartctx doctor --fix") == "    Next: smartctx doctor --fix"
    assert t.next_line("x", mode="ansi16") == "    " + sgr("dim") + "Next:\x1b[0m x"


def test_key_hints():
    pairs = [(t.arrows(), "move"), ("enter", "open"), ("/", "filter"), ("q", "back")]
    assert t.key_hints(pairs) == "↑↓ move · enter open · / filter · q back"
    ascii_pairs = [(t.arrows(ascii=True), "move"), ("q", "back")]
    assert t.key_hints(ascii_pairs, ascii=True) == "up/dn move | q back"


def test_key_hints_painted():
    out = t.key_hints([("q", "back")], mode="ansi16")
    assert out == sgr("accent") + "q\x1b[0m " + sgr("dim") + "back\x1b[0m"


def test_heading_is_dim_uppercase():
    assert t.heading("Config") == "CONFIG"
    assert t.heading("Config", mode="ansi16") == sgr("dim") + "CONFIG\x1b[0m"


def test_kv_line_aligns_with_step_labels():
    step = t.step_line("done", "Check git repository", "clean, on main")
    kv = t.kv_line("Profile", "work")
    assert kv == "    Profile                     work"
    assert kv.index("work") == step.index("clean")
    assert kv.index("Profile") == step.index("Check")


def test_kv_line_cuts_a_long_key_and_keeps_a_gap():
    kv = t.kv_line("k" * 40, "v")
    assert kv == "    " + "k" * 27 + " v"


# --- enable_vt ----------------------------------------------------------------------

def test_enable_vt_is_a_no_op_on_posix(monkeypatch):
    monkeypatch.setattr(t.os, "name", "posix")
    assert t.enable_vt() is True


def test_enable_vt_signals_plain_text_when_it_cannot_enable(monkeypatch):
    # On a non-Windows host msvcrt / windll are missing, so the Windows path fails.
    monkeypatch.setattr(t.os, "name", "nt")
    import sys as _sys

    if _sys.platform != "win32":
        assert t.enable_vt() is False


# --- public surface -------------------------------------------------------------------

NEW = ["paint", "lockup", "parse_yes_no", "parse_choice", "confirm", "choose", "require_tty_or_flag",
       "summary", "width", "wrap", "error_block", "next_line", "key_hints", "arrows", "heading",
       "kv_line", "enable_vt", "TermError", "NoValidAnswer", "MissingFlag"]


@pytest.mark.parametrize("name", NEW)
def test_new_helpers_are_public(name):
    assert name in t.__all__
    assert callable(getattr(t, name))


@pytest.mark.parametrize("name", [n for n in NEW if n[0].islower()])
def test_new_helpers_have_a_docstring(name):
    doc = inspect.getdoc(getattr(t, name))
    assert doc and len(doc.splitlines()) >= 2
