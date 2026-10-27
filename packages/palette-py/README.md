# sondalab-palette

Sondalab terminal palette: semantic color **roles** with a named-ANSI floor and a truecolor opt-in.

Color is applied to roles, never to decoration — a hue mismatch is never a legibility failure. On any terminal you get the named-ANSI floor (resolves through the user's theme); when `COLORTERM=truecolor`, roles upgrade to the exact brand hues. `NO_COLOR` disables color.

```python
from sondalab_palette import paint, supports_truecolor

print(paint("done", "ok"))          # green floor / #62D094 on truecolor
print(paint("careful", "warn"))     # yellow floor / amber on truecolor
print(paint("failed", "err"))       # red floor / soft-red on truecolor
```

Roles: `prompt`, `ok`, `warn`, `err`, `dim`, `accent`.

This top-level `paint()` is the legacy one. A CLI that follows the Term spec (`docs/tui-patterns.md`) uses `term.paint(text, role, term.color_mode())`: see [Terminal helpers](#terminal-helpers-090).

## Term tokens and the reference helper (0.6.0)

The Term spec's numbers are constants, so a CLI never re-derives them: `GLYPHS`, `LAYOUT`, `RAMP`, `SPINNER`, `DECODE`, `PROGRESS`, `MOTION`, `BOX`, `KEYS`, `ROBUSTNESS`, `ENV` and `HEADER` (0.8.0).

`sondalab_palette.term` builds the spec's strings and reads its environment rules. It writes nothing and keeps no time: redraw and timing are the caller's (`SPINNER["intervalMs"]`, `DECODE["frameMs"]`, `MOTION["maxFps"]`).

```python
import random, sys
from sondalab_palette import term

motion = term.motion_enabled()                 # off for non-TTY, CI, TERM=dumb, reduced motion, accessible
ascii = term.ascii_mode(override=args.ascii or None)
term.color_mode(flag=args.color, truecolor=True)   # 'none' | 'ansi16' | 'truecolor'

term.step_line("done", "Resolved 128 probes", "2.1s", ascii=ascii)
# '  ✓ Resolved 128 probes         2.1s'
term.progress_bar(61, 128, ascii=ascii)
# '    ███████████▓▒░             61/128   48%'
term.spinner_frame(i, ascii=ascii)             # the glyph-column frame at tick i
term.decode_frames("sha 9c41e0b", random.Random(), ascii=ascii)  # 4 frames, last is the value
```

The helper returns uncoloured text; since 0.9.0 `step_line(..., mode=mode)` paints the glyph with its `GLYPHS` role.

The environment rules are public, so a consumer never re-derives them (0.7.0):

```python
term.accessible()                # SONDALAB_ACCESSIBLE=1, or ACCESSIBLE set (even empty)
term.reduced_motion()            # SONDALAB_REDUCED_MOTION=1, or accessible()
term.switch_on("ci")             # any switch purpose in ENV: reducedMotion, accessible, ci, ascii
```

`switch_on` reads `SONDALAB_*` as on only when it equals `1`, and `CI`/`ACCESSIBLE` as on whenever set; a purpose that is not a switch raises `KeyError`. `motion_enabled` and `ascii_mode` are built on these.

The header an interactive launch opens with (0.8.0), on stdout:

```python
sys.stdout.write(term.header("cld", "0.9.0", "Manage Claude Code loadouts.", machine=args.json or args.plain))
# ▄█▄ ▄▄  sonda/lab
# ▀█▀ ▀▀  cld 0.9.0
# ▄▄▄▄▄▄  Manage Claude Code loadouts.
sys.stdout.write(term.header("cld", "0.9.0", "", compact=True))   # a one-shot subcommand
# ●■ sonda/lab cld
#
```

It returns `""` for `machine=True`, a non-TTY stdout and accessible mode, so piped output stays byte-identical (0.9.0). On a TTY it returns the one-line lockup `sonda/lab cld 0.9.0` with `TERM=dumb`, in ASCII mode and on a terminal narrower than the header. The mark's cells are `HEADER`. Unlike the other helpers it paints its own colour, following `color_mode()`.

## Terminal helpers (0.9.0)

The patterns a CLI used to re-implement. Every helper returns text and writes nothing, except `confirm`/`choose` (through injectable `read`/`write`) and `enable_vt`. Those that colour take `mode`, a `color_mode()` result, and default to uncoloured. Every `env` parameter defaults to `None` and reads `os.environ` at call time.

```python
from sondalab_palette import term

mode = term.color_mode(flag=args.color, truecolor=True)       # stdout; prompts use stderr's TTY state
err_mode = term.color_mode(isatty=sys.stderr.isatty())

term.paint("done", "ok", mode)                 # spec colour: 'none' | 'ansi16' floor | 'truecolor' on opt-in
term.lockup("cld", "0.9.0", mode)              # --version: 'sonda/lab cld 0.9.0', slash in prompt
term.step_line("done", "Installed hook", ".git/hooks/pre-commit", mode=mode)   # glyph painted
term.next_line("smartctx doctor --fix", mode=mode)    # '    Next: smartctx doctor --fix'
term.summary(1, 1, 1, 1, mode=mode, ascii=ascii)      # 'Summary  1 ok · 1 fixed · 1 warn · 1 failed'
term.error_block("Could not reach origin", "git ls-remote timed out after 10s (exit 128)",
                 "git remote -v", link="sondalab.eu/e/T102", mode=err_mode)
term.heading("Config", mode=mode)              # 'CONFIG' in dim
term.kv_line("Profile", "work")                # '    Profile                     work'
term.key_hints([(term.arrows(ascii=ascii), "move"), ("q", "back")], ascii=ascii, mode=mode)
term.width()                                   # terminal columns, capped at LAYOUT["maxWidth"]
term.wrap(text, indent=4)                      # prose wrapped at width() (stdout's), words kept whole
```

Prompts go to stderr and never run without a terminal:

```python
try:
    if term.needs_prompt("--yes", given=args.yes, what="Could not install the hook", command="cld hook install"):
        if not term.confirm("Install the hook into ~/.config/git?"):        # '? … [y/N] '
            return
    install()
except term.TermError as e:            # MissingFlag or NoValidAnswer
    print(e.block(mode=err_mode), file=sys.stderr)
    sys.exit(2)

i = term.choose("Open which probe?", ["q-8f2a  ok", "q-71c0  live"])     # accessible numbered list
```

`parse_yes_no(answer, default)` and `parse_choice(answer, count)` are the pure parsers behind them: `None` means the answer was not recognised. An unrecognised answer asks again, `ROBUSTNESS["promptRetries"]` times in all, then raises `NoValidAnswer`; end of input raises at once and never takes the default.

`needs_prompt` returns `True` when the caller must ask and `False` when the flag already answered; off a TTY without the flag it raises `MissingFlag`. `TermError` and its subclasses pickle and copy. `error_block` cuts the what line at `LAYOUT["maxWidth"]`, wraps the why at `width()`, and never cuts or wraps the fix.

`mode` is keyword-only everywhere except `paint(text, role, mode)` and `lockup(name, version, mode)`; `ascii` is keyword-only on the 0.9.0 helpers.

`term.enable_vt(stream)` turns on VT processing on a Windows console; pass the stream you draw on (`sys.stderr` for spinners and prompts). It returns `False` when it cannot; the caller then writes plain text (no colour, no motion, ASCII glyphs). Off Windows it returns `True` and does nothing.

There is no spinner runner: one needs a thread and a clock, and the palette stays pure. The caller draws `step_line(spinner_frame(i), …)` and `progress_bar()` on its own timer.

### The top-level `paint()` is legacy

`sondalab_palette.paint()` predates the Term spec and is kept unchanged for existing callers. It does not follow the spec: it ignores the `--color` flag, `FORCE_COLOR`, TTY detection and `TERM=dumb`, and upgrades to truecolor whenever `COLORTERM` allows, without an opt-in. Use `term.paint(text, role, term.color_mode())`, the spec-compliant one. `term.paint` is left out of `term.__all__`, so `from sondalab_palette.term import *` never shadows the legacy `paint`; reach it as `term.paint`.

### Changelog

- **0.9.0:** the terminal helpers: `term.paint` (spec colour precedence, ANSI 16 floor, truecolor on opt-in), `term.lockup`, `term.confirm`/`term.choose` with `parse_yes_no`/`parse_choice` and the retry cap, `term.needs_prompt` with `MissingFlag`/`NoValidAnswer` (both `TermError`), `term.summary`, `term.width`/`term.wrap`, `term.error_block`, `term.next_line`, `term.key_hints`/`term.arrows`, `term.heading`/`term.kv_line` (the spec's new Report lines pattern) and `term.enable_vt`; `step_line` takes `mode=` to paint its glyph. **Behaviour change:** `term.header()` returns `""` on a non-TTY stdout and in accessible mode, where it returned the lockup; use `term.lockup()` for `--version`.
- **0.8.0:** `term.header()`, the Term spec's header pattern, and the `HEADER` tokens (the mark, its accent mask, the compact mark and the gap).
- **0.7.1:** every `term` helper defaults to `env=None` and reads `os.environ` at call time. Before, the default was `os.environ` itself, kept in the signature, so `help()` or `inspect.signature()` printed the whole environment, secrets included. No call changes.
- **0.7.0:** public `term.accessible()`, `term.reduced_motion()` and `term.switch_on(name)`, the spec's environment switch rule; `motion_enabled` and `ascii_mode` now use them.
- **0.6.0:** Term tokens (`RAMP`, `SPINNER`, `DECODE`, `PROGRESS`, `MOTION`, `BOX`, `KEYS`, `ROBUSTNESS`, `ENV`) and the `term` reference helper.

Generated from the canonical `sondalab.tokens.json` — do not hand-edit `sondalab_palette/__init__.py`.
