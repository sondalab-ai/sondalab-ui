import random
import re
import unicodedata

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


def test_unknown_switch_variable_raises():
    with pytest.raises(KeyError):
        t._on({"NEW_VAR": "1"}, ("NEW_VAR",))


def test_every_switch_in_env_has_a_rule():
    for key in ("reducedMotion", "accessible", "ci", "ascii"):
        for name in p.ENV[key]:
            assert name in t._SWITCH


def test_sondalab_vars_need_1():
    assert t.motion_enabled({"SONDALAB_REDUCED_MOTION": "0"}, isatty=True) is True
    assert t.motion_enabled({"SONDALAB_ACCESSIBLE": ""}, isatty=True) is True


# --- accessible, reduced_motion, switch_on --------------------------------

@pytest.mark.parametrize(
    "env,expected",
    [
        ({}, False),
        ({"SONDALAB_ACCESSIBLE": "1"}, True),
        ({"SONDALAB_ACCESSIBLE": "0"}, False),
        ({"SONDALAB_ACCESSIBLE": ""}, False),
        ({"SONDALAB_ACCESSIBLE": "true"}, False),
        ({"ACCESSIBLE": "1"}, True),
        ({"ACCESSIBLE": ""}, True),
        ({"ACCESSIBLE": "0"}, True),
        ({"SONDALAB_ACCESSIBLE": "0", "ACCESSIBLE": ""}, True),
    ],
)
def test_accessible(env, expected):
    assert t.accessible(env) is expected


@pytest.mark.parametrize(
    "env,expected",
    [
        ({}, False),
        ({"SONDALAB_REDUCED_MOTION": "1"}, True),
        ({"SONDALAB_REDUCED_MOTION": "0"}, False),
        ({"SONDALAB_ACCESSIBLE": "1"}, True),
        ({"SONDALAB_ACCESSIBLE": "0"}, False),
        ({"ACCESSIBLE": ""}, True),
        ({"CI": "true"}, False),
        ({"TERM": "dumb"}, False),
    ],
)
def test_reduced_motion(env, expected):
    assert t.reduced_motion(env) is expected


def test_reduced_motion_does_not_imply_accessible():
    assert t.accessible({"SONDALAB_REDUCED_MOTION": "1"}) is False


@pytest.mark.parametrize(
    "name,env,expected",
    [
        ("ci", {"CI": ""}, True),
        ("ci", {"CI": "false"}, True),
        ("ci", {}, False),
        ("ascii", {"SONDALAB_ASCII": "1"}, True),
        ("ascii", {"SONDALAB_ASCII": "yes"}, False),
        ("reducedMotion", {"SONDALAB_REDUCED_MOTION": "1"}, True),
        ("reducedMotion", {"SONDALAB_ACCESSIBLE": "1"}, False),
        ("accessible", {"ACCESSIBLE": ""}, True),
    ],
)
def test_switch_on(name, env, expected):
    assert t.switch_on(name, env) is expected


@pytest.mark.parametrize("name", ["bogus", "noColor", "forceColor", "term", "colorTerm"])
def test_switch_on_unknown_purpose_raises(name):
    with pytest.raises(KeyError):
        t.switch_on(name, {})


def test_helpers_are_public():
    for name in ("accessible", "reduced_motion", "switch_on", "header"):
        assert name in t.__all__


# --- ascii_mode ----------------------------------------------------------

@pytest.mark.parametrize("enc", ["UTF-8", "utf8", "utf_8", "utf-8-sig"])
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


@pytest.mark.parametrize(
    "env,expected",
    [
        ({"LANG": "en_US.UTF-8"}, False),
        ({"LC_CTYPE": "UTF-8"}, False),
        ({"LANG": "de_DE.utf8@euro"}, False),
        ({"LC_ALL": "C", "LANG": "en_US.UTF-8"}, True),
        ({"LC_ALL": "", "LC_CTYPE": "en_US.UTF-8", "LANG": "C"}, False),
        ({"LANG": "en_US.ISO8859-1"}, True),
        ({"LANG": "C"}, True),
        ({}, True),
    ],
)
def test_ascii_reads_locale_from_env(env, expected):
    assert t.ascii_mode(env) is expected


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
        # 3. FORCE_COLOR beats non-TTY and TERM=dumb, unless empty or "0"
        ({"FORCE_COLOR": "1"}, False, None, "ansi16"),
        ({"FORCE_COLOR": "true"}, False, None, "ansi16"),
        ({"FORCE_COLOR": ""}, False, None, "none"),
        ({"FORCE_COLOR": "0"}, False, None, "none"),
        ({"FORCE_COLOR": "0"}, True, None, "ansi16"),
        ({"FORCE_COLOR": "1", "TERM": "dumb"}, False, None, "ansi16"),
        # 4. TTY detection and TERM=dumb
        ({}, True, None, "ansi16"),
        ({}, False, None, "none"),
        ({"TERM": "dumb"}, True, None, "none"),
        ({"TERM": "dumb", "NO_COLOR": ""}, True, None, "none"),
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
    assert line == "  ✓ " + label[:27] + " ok"
    assert "\n" not in t.step_line("done", label)
    assert t.step_line("done", label) == "  ✓ " + label[:28]


def test_step_line_ascii():
    assert t.step_line("failed", "Verify remote", "origin unreachable", ascii=True) == "  x Verify remote               origin unreachable"
    assert t.step_line("active", "Resolving 128 probes…", ascii=True) == "  * Resolving 128 probes..."
    assert t.step_line(t.spinner_frame(2), "Resolving", ascii=True) == "  : Resolving"


def test_label_of_exactly_label_width_keeps_a_gap():
    label = "Check every workspace probes"
    assert len(label) == 28
    assert t.step_line("done", label, "ok") == "  ✓ Check every workspace probe ok"
    assert t.step_line("done", label) == "  ✓ " + label


@pytest.mark.parametrize("glyph", ["nope", "x", "#x", "▚"])
def test_step_line_unknown_glyph(glyph):
    with pytest.raises(ValueError):
        t.step_line(glyph, "x")


@pytest.mark.parametrize("frame", sorted(set(p.SPINNER["frames"] + p.SPINNER["ascii"])))
def test_step_line_accepts_every_spinner_frame(frame):
    assert t.step_line(frame, "Resolving").startswith("  ")


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


def test_progress_shows_100_only_when_full():
    assert t.progress_bar(999, 1000).endswith("  99%")
    assert t.progress_bar(127, 128).endswith("  99%")
    assert t.progress_bar(1000, 1000).endswith(" 100%")


@pytest.mark.parametrize("total", [0, -1])
def test_progress_rejects_non_positive_total(total):
    with pytest.raises(ValueError):
        t.progress_bar(0, total)


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


def test_decode_empty_value():
    assert t.decode_frames("", Scripted([])) == ["", "", "", ""]


def test_decode_non_ascii_value():
    value = "héllo wörld"
    frames = t.decode_frames(value, random.Random(3))
    assert frames[-1] == value
    for f in frames:
        assert len(f) == len(value) and f[5] == " "
    assert frames[0][:2] == "hé"


def test_decode_is_deterministic_and_ends_on_value():
    a = t.decode_frames("sha 9c41e0b", random.Random(1))
    b = t.decode_frames("sha 9c41e0b", random.Random(1))
    assert a == b
    assert len(a) == 4 and a[-1] == "sha 9c41e0b"


ENV_HELPERS = [t.switch_on, t.accessible, t.reduced_motion, t.motion_enabled, t.ascii_mode, t.color_mode, t.header]


@pytest.mark.parametrize("fn", ENV_HELPERS, ids=lambda f: f.__name__)
def test_signature_never_holds_the_environment(fn, monkeypatch):
    # A default of os.environ would be kept in the signature, so help() or
    # inspect.signature() would print every variable, secrets included.
    import inspect

    monkeypatch.setenv("SL_TEST_SECRET", "do-not-print-0b1c")
    assert inspect.signature(fn).parameters["env"].default is None
    assert "do-not-print-0b1c" not in str(inspect.signature(fn))


def test_env_none_reads_the_live_environment(monkeypatch):
    monkeypatch.setenv("SONDALAB_ACCESSIBLE", "1")
    assert t.accessible() is True
    monkeypatch.delenv("SONDALAB_ACCESSIBLE")
    monkeypatch.delenv("ACCESSIBLE", raising=False)
    assert t.accessible() is False


# --- header ---------------------------------------------------------------

SGR = re.compile(r"\x1b\[[0-9;]*m")
TTY = {"LANG": "en_US.UTF-8", "TERM": "xterm-256color", "COLUMNS": "120"}
DESC = "Manage Claude Code loadouts."


def _plain(s):
    return SGR.sub("", s)


def _header(env=None, isatty=True, **kw):
    return t.header("cld", "0.9.0", DESC, env=TTY if env is None else env, isatty=isatty, **kw)


def test_header_is_public():
    assert "header" in t.__all__


def test_header_machine_prints_nothing():
    assert _header(machine=True) == ""
    assert _header(machine=True, compact=True) == ""


@pytest.mark.parametrize(
    "env,isatty",
    [
        (TTY, False),
        ({**TTY, "TERM": "dumb"}, True),
        ({**TTY, "SONDALAB_ACCESSIBLE": "1"}, True),
        ({**TTY, "ACCESSIBLE": ""}, True),
        ({**TTY, "SONDALAB_ASCII": "1"}, True),
        ({**TTY, "LANG": "C"}, True),
        ({**TTY, "COLUMNS": "12"}, True),
    ],
)
@pytest.mark.parametrize("compact", [False, True])
def test_header_falls_back_to_the_lockup(env, isatty, compact):
    out = _header(env, isatty, compact=compact)
    assert _plain(out) == "sonda/lab cld 0.9.0\n"


def test_header_full_is_three_lines_mark_then_text():
    out = _plain(_header({**TTY, "NO_COLOR": "1"}))
    assert out == (
        "▄█▄ ▄▄  sonda/lab\n"
        "▀█▀ ▀▀  cld 0.9.0\n"
        "▄▄▄▄▄▄  Manage Claude Code loadouts.\n"
    )


def test_header_compact_is_one_line_then_a_blank_line():
    assert _plain(_header({**TTY, "NO_COLOR": "1"}, compact=True)) == "●■ sonda/lab cld\n\n"


def test_header_mark_is_at_most_six_columns_with_one_accent_shape():
    mark = p.HEADER["mark"]
    assert len(mark) == 3
    assert all(len(row) == len(mark[0]) <= 6 for row in mark)
    accent = [(r, c) for r, row in enumerate(p.HEADER["markAccent"]) for c, ch in enumerate(row) if ch == "a"]
    assert accent, "no accent cell"
    # one shape: the accent cells form a single 4-connected region
    seen, todo = set(), [accent[0]]
    while todo:
        r, c = todo.pop()
        if (r, c) in seen or (r, c) not in accent:
            continue
        seen.add((r, c))
        todo += [(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)]
    assert seen == set(accent)
    assert len(p.HEADER["compact"]) == 2 and p.HEADER["compactAccent"].count("a") == 1


def test_header_paints_accent_slash_and_dim():
    out = _header()
    accent = "\x1b[%dm" % p.ROLES[p.HEADER["accentRole"]][0]
    prompt = "\x1b[%dm" % p.ROLES["prompt"][0]
    dim = "\x1b[%dm" % p.ROLES["dim"][0]
    lines = out.split("\n")
    assert lines[0].startswith(accent + "▄█▄\x1b[0m ▄▄  sonda")
    assert lines[1].startswith(accent + "▀█▀\x1b[0m ▀▀  cld 0.9.0")
    assert "sonda" + prompt + "/\x1b[0m" + "lab" in lines[0]
    assert lines[2].endswith(dim + DESC + "\x1b[0m")
    assert out.count(accent) == 2 + (accent == prompt)


def test_header_compact_paints_accent_and_dim():
    out = _header(compact=True)
    accent = "\x1b[%dm" % p.ROLES[p.HEADER["accentRole"]][0]
    dim = "\x1b[%dm" % p.ROLES["dim"][0]
    assert out == accent + "●\x1b[0m■ " + dim + "sonda/lab cld\x1b[0m\n\n"


@pytest.mark.parametrize("compact", [False, True])
def test_header_no_color_keeps_the_shapes(compact):
    painted = _header(compact=compact)
    plain = _header({**TTY, "NO_COLOR": "1"}, compact=compact)
    assert SGR.search(painted) and not SGR.search(plain)
    assert plain == _plain(painted)


def test_header_lockup_paints_the_slash_when_colour_is_forced():
    out = _header({**TTY, "FORCE_COLOR": "1"}, isatty=False)
    assert out == "sonda\x1b[%dm/\x1b[0mlab cld 0.9.0\n" % p.ROLES["prompt"][0]


def test_header_cuts_a_long_description_at_the_cap_never_wraps():
    long = "x" * 300
    out = _plain(t.header("cld", "0.9.0", long, env={**TTY, "COLUMNS": "200"}, isatty=True))
    lines = out.rstrip("\n").split("\n")
    assert len(lines) == 3
    assert len(lines[2]) == p.LAYOUT["maxWidth"]
    assert lines[2].endswith("x")


def test_header_reads_the_cap_when_the_width_is_unknown(monkeypatch):
    def no_size(*_):
        raise OSError

    monkeypatch.setattr(t.os, "get_terminal_size", no_size)
    env = {k: v for k, v in TTY.items() if k != "COLUMNS"}
    room = p.LAYOUT["maxWidth"] - len(p.HEADER["mark"][0]) - p.HEADER["gap"]
    out = _plain(t.header("cld", "0.9.0", "z" * room, env=env, isatty=True))
    assert out.count("\n") == 3
    assert len(out.split("\n")[2]) == p.LAYOUT["maxWidth"]
    assert _plain(t.header("cld", "0.9.0", "z" * room, env={**env, "COLUMNS": "99"}, isatty=True)).count("\n") == 1


@pytest.mark.parametrize("cols,lines", [("36", 3), ("35", 1)])
def test_header_needs_mark_gap_and_longest_line(cols, lines):
    # mark 6 + gap 2 + "Manage Claude Code loadouts." (28) = 36
    assert _plain(_header({**TTY, "COLUMNS": cols})).count("\n") == lines


def test_header_in_40_columns_is_whole_or_the_lockup():
    env = {**TTY, "COLUMNS": "40"}
    assert _plain(_header(env)).count("\n") == 3
    wide = t.header("cld", "0.9.0", "Manage Claude Code loadouts and profiles.", env=env, isatty=True)
    assert _plain(wide) == "sonda/lab cld 0.9.0\n"


@pytest.mark.parametrize("cols,lines", [("16", 2), ("15", 1)])
def test_header_compact_needs_mark_space_and_text(cols, lines):
    # mark 2 + space 1 + "sonda/lab cld" (13) = 16
    assert _plain(_header({**TTY, "COLUMNS": cols}, compact=True)).count("\n") == lines


@pytest.mark.parametrize("compact", [False, True])
@pytest.mark.parametrize("desc", [DESC, "y" * 400, ""], ids=["short", "long", "empty"])
def test_header_lines_fit_the_cap_and_every_glyph_is_one_column(compact, desc):
    for env in (TTY, {**TTY, "COLUMNS": "40"}, {**TTY, "LANG": "C"}):
        for isatty in (True, False):
            out = _plain(t.header("smartctx" * 20, "0.14.2", desc, compact=compact, env=env, isatty=isatty))
            for line in out.split("\n"):
                assert len(line) <= p.LAYOUT["maxWidth"]
                for ch in line:
                    assert unicodedata.east_asian_width(ch) not in ("W", "F"), ch
                    assert not unicodedata.combining(ch) and unicodedata.category(ch) not in ("Cc", "Cf", "Mn", "Me"), ch


def test_header_help_prints_no_environment_value(monkeypatch):
    import pydoc

    monkeypatch.setenv("SL_TEST_SECRET", "do-not-print-7e4a")
    leaked = "do-not-print-7e4a" in pydoc.render_doc(t.header)
    assert not leaked
