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

The helper returns uncoloured text; paint the glyph with its `GLYPHS` role.

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

It returns the one-line lockup `sonda/lab cld 0.9.0` on a non-TTY stdout, `TERM=dumb`, accessible or ASCII mode and a terminal narrower than the header, and `""` for `machine=True`. The mark's cells are `HEADER`. Unlike the other helpers it paints its own colour, following `color_mode()`.

`paint()` predates the Term spec and does not consult `color_mode`: it ignores the flag, `FORCE_COLOR` and TTY detection, and upgrades to truecolor whenever `COLORTERM` allows it. A caller that follows the spec's colour precedence builds the SGR itself from `ROLES`, based on the mode.

### Changelog

- **0.8.0:** `term.header()`, the Term spec's header pattern, and the `HEADER` tokens (the mark, its accent mask, the compact mark and the gap).
- **0.7.1:** every `term` helper defaults to `env=None` and reads `os.environ` at call time. Before, the default was `os.environ` itself, kept in the signature, so `help()` or `inspect.signature()` printed the whole environment, secrets included. No call changes.
- **0.7.0:** public `term.accessible()`, `term.reduced_motion()` and `term.switch_on(name)`, the spec's environment switch rule; `motion_enabled` and `ascii_mode` now use them.
- **0.6.0:** Term tokens (`RAMP`, `SPINNER`, `DECODE`, `PROGRESS`, `MOTION`, `BOX`, `KEYS`, `ROBUSTNESS`, `ENV`) and the `term` reference helper.

Generated from the canonical `sondalab.tokens.json` — do not hand-edit `sondalab_palette/__init__.py`.
