import random

import pytest

import sondalab_palette as p
from sondalab_palette import term as t

# Expected strings are copied from the fenced examples in docs/tui-patterns.md.


class Scripted:
    """An rng whose choice() returns a scripted sequence, checking each pick is in the pool."""

    def __init__(self, picks):
        self.picks = list(picks)

    def choice(self, seq):
        c = self.picks.pop(0)
        assert c in seq, f"{c!r} is not in the pool"
        return c


# --- generated constants -------------------------------------------------

def test_new_constants_present():
    assert p.RAMP["unicode"] == ("░", "▒", "▓", "█")
    assert p.SPINNER["frames"] == (" ", "░", "▒", "▓", "█", "▓", "▒", "░")
    assert p.SPINNER["intervalMs"] == 100
    assert p.DECODE["frames"] == 4
    assert p.PROGRESS["cells"] == 24
    assert p.MOTION["maxFps"] == 10
    assert p.BOX["topLeft"] == ("╭", "+")
    assert p.KEYS["down"] == ("↓", "dn")
    assert p.ROBUSTNESS["promptRetries"] == 3
    assert p.ENV["accessible"] == ("SONDALAB_ACCESSIBLE", "ACCESSIBLE")
    assert p.LAYOUT["maxWidth"] == 100


# --- motion_enabled ------------------------------------------------------

def test_motion_on_for_a_plain_tty():
    assert t.motion_enabled({"TERM": "xterm-256color"}, isatty=True) is True


@pytest.mark.parametrize(
    "env,isatty",
    [
        ({}, False),
        ({"CI": "true"}, True),
        ({"CI": ""}, True),
        ({"TERM": "dumb"}, True),
        ({"SONDALAB_REDUCED_MOTION": "1"}, True),
        ({"SONDALAB_ACCESSIBLE": "1"}, True),
        ({"ACCESSIBLE": "1"}, True),
        ({"ACCESSIBLE": ""}, True),
    ],
)
def test_motion_off(env, isatty):
    assert t.motion_enabled(env, isatty=isatty) is False


def test_sondalab_vars_need_1():
    assert t.motion_enabled({"SONDALAB_REDUCED_MOTION": "0"}, isatty=True) is True
    assert t.motion_enabled({"SONDALAB_ACCESSIBLE": ""}, isatty=True) is True


# --- ascii_mode ----------------------------------------------------------

@pytest.mark.parametrize("enc", ["UTF-8", "utf8", "utf_8"])
def test_ascii_off_on_utf8(enc):
    assert t.ascii_mode({}, enc) is False


@pytest.mark.parametrize(
    "env,enc",
    [
        ({}, "latin-1"),
        ({}, "ascii"),
        ({}, "no-such-codec"),
        ({"TERM": "dumb"}, "UTF-8"),
        ({"SONDALAB_ASCII": "1"}, "UTF-8"),
    ],
)
def test_ascii_on(env, enc):
    assert t.ascii_mode(env, enc) is True


def test_ascii_override_wins():
    assert t.ascii_mode({}, "UTF-8", override=True) is True
    assert t.ascii_mode({"TERM": "dumb"}, "ascii", override=False) is False


# --- color_mode ----------------------------------------------------------

TC = {"COLORTERM": "truecolor"}


@pytest.mark.parametrize(
    "env,isatty,flag,expected",
    [
        # 1. the flag beats everything
        ({"NO_COLOR": "1"}, True, True, "ansi16"),
        ({"FORCE_COLOR": "1"}, True, False, "none"),
        ({"TERM": "dumb"}, False, True, "ansi16"),
        # 2. NO_COLOR (non-empty) beats FORCE_COLOR and a TTY
        ({"NO_COLOR": "1", "FORCE_COLOR": "1"}, True, None, "none"),
        ({"NO_COLOR": ""}, True, None, "ansi16"),
        # 3. FORCE_COLOR beats non-TTY and TERM=dumb
        ({"FORCE_COLOR": "1"}, False, None, "ansi16"),
        ({"FORCE_COLOR": "1", "TERM": "dumb"}, False, None, "ansi16"),
        # 4. TTY detection and TERM=dumb
        ({}, True, None, "ansi16"),
        ({}, False, None, "none"),
        ({"TERM": "dumb"}, True, None, "none"),
    ],
)
def test_color_precedence(env, isatty, flag, expected):
    assert t.color_mode(env, isatty, flag) == expected


def test_truecolor_needs_opt_in_and_colorterm():
    assert t.color_mode(TC, True) == "ansi16"
    assert t.color_mode(TC, True, truecolor=True) == "truecolor"
    assert t.color_mode({"COLORTERM": "24bit"}, True, truecolor=True) == "truecolor"
    assert t.color_mode({}, True, truecolor=True) == "ansi16"
    assert t.color_mode(TC, False, truecolor=True) == "none"
    assert t.color_mode(TC, False, flag=True, truecolor=True) == "truecolor"


# --- spinner_frame -------------------------------------------------------

def test_spinner_cycles():
    assert "".join(t.spinner_frame(i) for i in range(8)) == " ░▒▓█▓▒░"
    assert t.spinner_frame(8) == " "
    assert t.spinner_frame(10) == "▒"


def test_spinner_ascii():
    assert "".join(t.spinner_frame(i, ascii=True) for i in range(8)) == " .:###:."


# --- step_line -----------------------------------------------------------

def test_step_list_example():
    assert t.step_line("done", "Check git repository", "clean, on main") == "  ✓ Check git repository        clean, on main"
    assert t.step_line("fixed", "Install pre-commit hook", "fixed") == "  ✓ Install pre-commit hook     fixed"
    assert t.step_line("warn", "Check signing key", "not loaded") == "  ! Check signing key           not loaded"
    assert t.step_line("failed", "Verify remote", "origin unreachable") == "  ✗ Verify remote               origin unreachable"


def test_motion_examples():
    assert t.step_line(t.spinner_frame(2), "Resolving 128 probes…") == "  ▒ Resolving 128 probes…"
    assert t.step_line("active", "Resolving 128 probes…") == "  ● Resolving 128 probes…"
    assert t.step_line("done", "Resolved 128 probes", "2.1s") == "  ✓ Resolved 128 probes         2.1s"
    assert t.step_line("done", "Fetched manifest", "0.1s") == "  ✓ Fetched manifest            0.1s"


def test_error_and_success_examples():
    assert t.step_line("failed", "Could not reach origin") == "  ✗ Could not reach origin"
    assert t.step_line("done", "Installed hook", ".git/hooks/pre-commit") == "  ✓ Installed hook              .git/hooks/pre-commit"


def test_long_label_is_cut_not_wrapped():
    label = "Resolve every probe in the workspace cache"
    line = t.step_line("done", label, "ok")
    assert line == "  ✓ " + label[:28] + "ok"
    assert "\n" not in t.step_line("done", label)
    assert t.step_line("done", label) == "  ✓ " + label[:28]


def test_step_line_ascii():
    assert t.step_line("failed", "Verify remote", "origin unreachable", ascii=True) == "  x Verify remote               origin unreachable"
    assert t.step_line("active", "Resolving 128 probes…", ascii=True) == "  * Resolving 128 probes..."
    assert t.step_line(t.spinner_frame(2), "Resolving", ascii=True) == "  : Resolving"


def test_step_line_unknown_glyph():
    with pytest.raises(ValueError):
        t.step_line("nope", "x")


# --- progress_bar --------------------------------------------------------

def test_progress_examples():
    assert t.progress_bar(61, 128) == "    ███████████▓▒░             61/128   48%"
    assert t.progress_bar(0, 128) == "    ▓▒░                         0/128    0%"
    assert t.progress_bar(128, 128) == "    ████████████████████████  128/128  100%"


def test_progress_edge_cut_at_end():
    # 23/24 full: one edge cell left, so the edge is just ▓
    assert t.progress_bar(23, 24) == "    " + "█" * 23 + "▓" + "  23/24   96%"


def test_progress_rounds_half_up():
    assert t.progress_bar(1, 8).endswith(" 13%")  # 12.5%


def test_progress_clamps():
    assert t.progress_bar(200, 128) == t.progress_bar(128, 128)
    assert t.progress_bar(-3, 128) == t.progress_bar(0, 128)


def test_progress_ascii():
    assert t.progress_bar(61, 128, ascii=True) == "    ############:.             61/128   48%"
    assert t.progress_bar(0, 128, ascii=True) == "    #:.                         0/128    0%"


# --- decode_frames -------------------------------------------------------

DECODE_PICKS = list("▓▞#░▒%█▚") + list("▒▚░@▞▓") + list("▞%░")


def test_decode_example():
    frames = t.decode_frames("sha 9c41e0b", Scripted(DECODE_PICKS))
    lines = [t.step_line("warn", "Value changed", f) for f in frames]
    assert lines == [
        "  ! Value changed               sh▓ ▞#░▒%█▚",
        "  ! Value changed               sha 9▒▚░@▞▓",
        "  ! Value changed               sha 9c41▞%░",
        "  ! Value changed               sha 9c41e0b",
    ]


def test_decode_spaces_stay_and_draw_nothing():
    # only the x is ever drawn: frames 1 and 2 scramble it, frame 3 settles it
    rng = Scripted("ab")
    assert t.decode_frames("  x ", rng, ascii=True) == ["  a ", "  b ", "  x ", "  x "]
    assert rng.picks == []


def test_decode_ascii_pool_has_no_glyphs():
    rng = random.Random(7)
    for frame in t.decode_frames("abcdefghijklmnop", rng, ascii=True):
        assert all(33 <= ord(c) <= 126 for c in frame)
    with pytest.raises(AssertionError):
        t.decode_frames("ab", Scripted("▓"), ascii=True)


def test_decode_is_deterministic_and_ends_on_value():
    a = t.decode_frames("sha 9c41e0b", random.Random(1))
    b = t.decode_frames("sha 9c41e0b", random.Random(1))
    assert a == b
    assert len(a) == 4 and a[-1] == "sha 9c41e0b"
