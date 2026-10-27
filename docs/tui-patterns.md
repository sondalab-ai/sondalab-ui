# TUI patterns

Interaction patterns for command-line surfaces (the Term substrate). The six colour roles live in `terminal` in `sondalab.tokens.json`; the glyphs and layout numbers below are the `tui` section beside it (Python: `sondalab_palette.GLYPHS`, `sondalab_palette.LAYOUT`). This file is the grammar; the tokens are the values.

Since 0.40 this file is the full Term spec, in six parts: Voice, Motion, Effects, Patterns (line output), Patterns (full screen) and Robustness. It applies `design-language.md` L4, L5 and L6 to a grid of character cells. Every number it cites is a `tui` token, named beside the number; a test fails if a token and this text disagree.

## Voice

L5 applies as written: precise and technical, never marketing. A measured figure replaces an adjective: `1.2s`, `3 probes`, never "fast".

- **A running step is a present participle; a finished step is past tense.** "Resolving q-8f2a…" while it runs, "Resolved 3 probes" when it ends. Sentence case, one line, no trailing period.
- **An error takes three lines: what, why, fix.** What failed, after the `failed` glyph. Why, in `dim`, with the exit code or the timeout. The fix, after `Try:`: a command, optionally followed by a docs link carrying an error code. The fix comes last, so it is the last thing on screen. See [Error block](#error-block).
- **"Did you mean" suggests and never runs.** The program exits with an error and prints the suggestion; the user runs it.
- **Success states what changed and the next step.** A command that changes something and prints nothing is a defect.
- **Banned:** emoji, "Oops", "Successfully", exclamation marks in prose, and "we". The ban on `!` covers sentence punctuation; the `warn` glyph `!` in the glyph column stays.
- **Address the user only in prompts.** "Install the hook?" is a prompt; a status line names the thing, not the reader.
- **Stack traces only with `--debug`.** Without it, an unexpected failure is the three-line error, and its fix line names `--debug`.

## Motion

L4 adapted to a terminal: the only motion is the spinner, the progress bar and the decode ([Effects](#effects)). All three are text redrawn in place, and all three are off in the cases under [When motion is off](#when-motion-is-off).

### Response time

The first line of output appears within 100ms (`motion.firstOutputMs`) of the command starting, before any network call. A step that cannot finish in that time prints its running line, or starts its spinner timer.

### Spinner

The spinner is the primary button's dither hover drawn in one cell: the glyph cell fills through the ramp and drains back.

- **Frames:** ` ░▒▓█▓▒░` (`spinner.frames`), 8 frames, a space first.
- **Interval:** 100ms per frame (`spinner.intervalMs`), 0.8s per cycle.
- **Role:** `prompt` (`spinner.role`).
- **Place:** the glyph column of the step line, so the label grid holds. It is one column wide, like every glyph.
- **Delay:** the spinner appears only after the step has run for 300ms (`spinner.delayMs`). A step that ends sooner prints its final line directly, with no spinner.
- **End:** a spinner always ends in a persisted step line (`done`, `fixed`, `warn` or `failed`). Nothing animated stays on screen.
- **ASCII:** on a non-UTF-8 locale the frames are `spinner.ascii`, each frame mapped through `ramp.ascii`; the space stays a space.

```
  ▒ Resolving 128 probes…
```

then, on the same line:

```
  ✓ Resolved 128 probes         2.1s
```

The ellipsis `…` marks a running label; its ASCII form is `...`.

### Redraw

At most 10 frames per second (`motion.maxFps`) for everything that redraws. Rewrite only the cells that changed, never the whole screen. Wrap each frame in synchronized output (DEC private mode 2026, `CSI ? 2026 h` … `CSI ? 2026 l`) where the terminal supports it, so a frame is never shown half drawn.

### When motion is off

Motion is off when any of these holds:

- the stream it draws on (stderr) is not a TTY;
- `CI` is set;
- `TERM=dumb`;
- `SONDALAB_REDUCED_MOTION=1`;
- accessible mode is on (`SONDALAB_ACCESSIBLE=1`, or `ACCESSIBLE` set; see [Robustness](#robustness)).

Static text replaces the motion. A step that passes `spinner.delayMs` prints its running line once, with the `active` glyph, and its final line below it when it ends. No spinner, no progress bar, no decode: the final value prints directly.

```
  ● Resolving 128 probes…
  ✓ Resolved 128 probes         2.1s
```

A step that ends within `spinner.delayMs` prints no running line, only its final line, with motion on or off:

```
  ✓ Fetched manifest            0.1s
```

## Effects

L6 adapted to a terminal. The glitch becomes a decode; glass, aurora and goo have no terminal form. Pixel graphics are for data only.

### Decode

The decode carries the glitch's meaning: something re-resolved. A value changed, a destructive action was confirmed, or validation failed. It never runs on idle output or on a banner.

- **Scope:** only the changed token decodes, never a whole line.
- **Frames:** 4 frames (`decode.frames`) of 60ms each (`decode.frameMs`), 240ms in all, under 300ms. Frames 1 to 3 scramble and frame 4 settles, so the token is visibly scrambled for about 180ms. Once, never looping.
- **Order:** left to right. Frame *n* settles the first ⌊*n* / 4 × length⌋ characters; frame 4 is the final value.
- **Glyphs:** each unsettled character is drawn from `░▒▓█▚▞` (`decode.glyphs`) plus random printable ASCII, code points 33 to 126 (`decode.randomAscii`). A space in the value stays a space, so the token keeps its shape. In ASCII mode ([Rules](#rules)) only the ASCII set is used.
- **Colour:** the unsettled characters are painted in `prompt`; the settled value takes its own role.
- **No flash:** the line never inverts or blinks, so luminance does not change between frames and WCAG 2.3.1 (three flashes) is never in play.
- **Off** in every case where motion is off: the final value prints directly.

```
  ! Value changed               sh▓ ▞#░▒%█▚
  ! Value changed               sha 9▒▚░@▞▓
  ! Value changed               sha 9c41▞%░
  ! Value changed               sha 9c41e0b
    was sha 3f02a7d · re-resolved after cache miss
```

The four frames are drawn on one line; they are stacked here to show them.

### Pixel text

- **The dither ramp** is `░▒▓█` (`ramp.unicode`), lightest to darkest, with the ASCII fallback `. : # #` (`ramp.ascii`; `▓` and `█` both fall back to `#`). Only the signal strip and the progress bar use it.
- **The lockup is text:** `sonda/lab`, with the slash in `prompt`. `--version` prints the one-line lockup. No ASCII-art banner, with one exception: the [Header](#header), on interactive launch only.
- **Pixel graphics** (half blocks `▀▄`, sextants, braille, sixel, kitty images) are for data only, such as a sparkline, and only behind a capability check, with a text fallback. The header's mark is the one exception, and it falls back to the lockup.
- **Every glyph is one column wide.** No emoji. See [Width](#width).

```
sonda/lab smartctx 0.14.2
ui-kit 0.39.0 · palette 0.6.0 · darwin arm64
```

## Patterns (line output)

### Glyphs

Each glyph has a Unicode form, an ASCII form and the colour role it is painted with.

| Name | Unicode | ASCII | Role |
|---|---|---|---|
| `done` | ✓ | `+` | `ok` |
| `fixed` | ✓ | `+` | `ok` |
| `failed` | ✗ | `x` | `err` |
| `warn` | ! | `!` | `warn` |
| `active` | ● | `*` | `prompt` |
| `pending` | ○ | `.` | `dim` |
| `skipped` | ↷ | `-` | `dim` |
| `question` | ? | `?` | `prompt` |
| `separator` | · | `\|` | `dim` |

### Layout

`indent` 2 columns, `labelWidth` 28 columns, `blankBeforeSummary` 1 line, `maxWidth` 100 columns.

### Header

An interactive launch (a TUI screen, a prompt loop, an installer, a bare launch, `--help`) opens with the header: the mark on the left, then `sonda/lab` with the slash in `prompt`, the name and version, and the description in `dim`. The mark is `header.mark`: 3 lines, 6 columns, `header.gap` 2 columns from the text. Its circle is the one accent shape, painted `prompt` (`header.accentRole`), the accent as text like the slash; the square and the bar stay in the default ink.

```
▄█▄ ▄▄  sonda/lab
▀█▀ ▀▀  cld 0.9.0
▄▄▄▄▄▄  Manage Claude Code loadouts.
```

A one-shot subcommand that prints a result and exits opens with the compact header instead: the 2-column mark `header.compact`, its circle in `prompt`, a space, `sonda/lab <name>` in `dim`, then one blank line before the result.

```
●■ sonda/lab cld
```

- **Never wrapped.** Each text line is cut at `layout.maxWidth` columns, so a long description is cut, never carried under the mark.
- **Nothing off a terminal.** When stdout is not a TTY, or in accessible mode, the header prints nothing, in either size, so piped output stays byte-identical to the result alone. The one-line lockup belongs to `--version`. (Owner amendment, 2026-10-27: before, both cases printed the lockup.)
- **Falls back to the lockup** `sonda/lab <name> <version>` on one line, in either size, on a terminal that cannot draw the mark: with `TERM=dumb`, in ASCII mode (`SONDALAB_ASCII=1`, `--ascii` or a non-UTF-8 locale), and when the terminal is narrower than the mark, the gap and the longest text line.
- **Nothing in machine output.** `--json` and `--plain` print no header and no lockup.
- **`NO_COLOR` keeps the shapes** and drops the colour; colour otherwise follows [Colour](#colour).
- The header goes to stdout. Python: `term.header(name, version, description, compact=…, machine=…)` in `sondalab_palette` 0.8.0, printing nothing off a TTY and in accessible mode since 0.9.0; `term.lockup(name, version, mode)` (0.9.0) is the `--version` line.

### Step list

One line per step: the indent, the glyph, the label padded to `labelWidth`, then the detail.

```
  ✓ Check git repository        clean, on main
  ✓ Install pre-commit hook     fixed
  ! Check signing key           not loaded
  ✗ Verify remote               origin unreachable
```

The label is padded with spaces to `labelWidth`; a longer label is cut, never wrapped. When a detail follows, the label is cut at `labelWidth` − 1 columns, so at least one space always separates it from the detail; a line with no detail cuts at `labelWidth`. The detail is one short phrase and takes the rest of the line. The glyph is painted with its role; the label and detail stay in the default ink, and a detail that explains a skipped or pending step may use `dim`.

A line under a step (an error's why and fix, a next step, a progress bar) is a continuation line: it starts in the label column, `indent` + 2 columns from the left.

### Confirmation

```
? Install the hook into ~/.config/git? [y/N]
```

`? <question> [Y/n]`. The capital letter marks the default, which Enter accepts. The default is no (`[y/N]`) for any action outside the working directory; inside it, the default may be yes (`[Y/n]`). The `?` is the `question` glyph in the `prompt` role. An empty answer takes the default. Any other unrecognised input is never read as a choice: the prompt asks again, at most 3 times in all (`robustness.promptRetries`), and then fails with "no valid answer". End of input is not an answer: it fails at once and never takes the default. Python: `term.confirm()`, and `term.choose()` for the numbered list of [Accessible mode](#accessible-mode) (0.9.0).

### Summary

After `blankBeforeSummary` blank line, one line:

```
Summary  1 ok · 1 fixed · 1 warn · 1 failed
```

`Summary`, two spaces, then four counts in the order ok, fixed, warn, failed, joined by the `separator` glyph (` · `, or ` | ` in ASCII). Each count is painted with its role (`ok`, `ok`, `warn`, `err`); a zero count is painted `dim`. The four counts are always all present.

### Report lines

A command that reports state rather than running checks (a status, an info or a config dump) prints key-value lines, grouped under section headings.

```
CHECKS
  ✓ Check git repository        clean, on main
  ! Check signing key           not loaded

CONFIG
    Profile                     work
    Hooks                       3 installed
```

- **A key-value line is a fact, not a check:** it has no glyph. The key starts in the label column, `indent` + 2 columns from the left, and is padded to `labelWidth` like a step label, so values line up with step details. A long key is cut at `labelWidth` − 1 columns, never wrapped. Key and value stay in the default ink; a value that says something is absent ("none", "not set") may use `dim`.
- **A section heading** is the micro label (L1): uppercase, in `dim`, from column 0, with no colon and no rule under it. It names the group of step lines or key-value lines below it. One blank line comes before every heading but the first.
- A value that is a state with a glyph (ok, failed) is a step line, not a key-value line.
- Python: `term.kv_line(key, value)` and `term.heading(text, mode=…)` (0.9.0).

### Error block

Three lines: what, why, fix.

```
  ✗ Could not reach origin
    git ls-remote timed out after 10s (exit 128)
    Try: git remote -v · sondalab.eu/e/T102
```

- **What:** the step line, with the `failed` glyph and a past-tense or "Could not" label. No detail column.
- **Why:** a continuation line in `dim`, naming the cause and the exit code or the timeout.
- **Fix:** a continuation line: `Try:` in `prompt`, then a command in the default ink. An optional docs link with an error code follows the `separator` glyph, in `dim`.

The process exits non-zero. An unexpected failure prints the same three lines; its fix is `Try: <command> --debug`.

### Did you mean

```
  ✗ Unknown flag --versoin
    Did you mean --version?
```

The step line names the input that was not recognised. The continuation line offers the nearest valid input, `Did you mean` and the `?` in `prompt`. The program exits non-zero and runs nothing.

This is the one error shape exempt from the three lines: two lines, with the suggestion in place of the why and the `Try:` line.

### Success with next step

```
  ✓ Installed hook              .git/hooks/pre-commit
    Next: smartctx doctor --fix
```

The step line says what changed and where. When a follow-up exists, a continuation line names it: `Next:` in `dim`, then the command. A command that changed nothing says so ("Hook already installed").

### Progress

A determinate step draws a bar on the continuation line under its running step line.

```
  ▒ Resolving 128 probes…
    ███████████▓▒░             61/128   48%
```

- **Bar:** 24 cells (`progress.cells`) in `prompt` (`progress.role`). The filled cells are `█`, ⌊done / total × 24⌋ of them. The leading edge, right after the filled cells, dithers through `▓▒░` (the ramp, darkest first), cut where the bar ends. The remaining cells are spaces.
- **After the bar:** two spaces, the count `done/total` with `done` right-aligned to the width of `total`, two spaces, then the percentage right-aligned to 4 columns (`progress.percentWidth`) in `dim`. The percentage rounds half up and is capped at 99% until `done` equals `total`, so 100% only ever shows beside a full bar. A `total` of 0 or less is a caller error: a step with nothing to count draws no bar.
- **Ends:** at 0% the bar is the edge alone (`▓▒░`), so a step that has started but counted nothing still shows it is alive; at 100% it is 24 `█`. When the step ends, the bar line is cleared and the step line persists.
- **Redraw:** at most `motion.maxFps`, and only when a cell or the count changes.
- **ASCII:** each cell is mapped through `ramp.ascii`. `▓` and `█` both become `#`, so the filled run and the edge differ only at `:` and `.`; that is accepted.
- **Motion off:** no bar. The final step line carries the count ("Resolved 128 probes").

```
    ▓▒░                         0/128    0%
    ████████████████████████  128/128  100%
```

### Rules

- **A failure never uses a success glyph.** `failed` is `✗` in `err`; `✓` is only for `done` and `fixed`. A step that did not do its job is `failed` or `warn`, never `done`.
- **Non-TTY: no prompts.** Without a TTY on stdin the program never asks a question. It never takes a default on its own: an action runs without a prompt only when the caller passed an explicit flag (for example `--yes`); otherwise it stops with an error naming the missing flag, as an [error block](#error-block) whose fix is the command with that flag. Python: `term.require_tty_or_flag()` (0.9.0).
- **`NO_COLOR`: glyphs stay, color goes.** With `NO_COLOR` set the output is the same text with no escape sequences, unless a `--color` flag overrides it ([Colour](#colour)). Meaning is carried by the glyph and the word, never by colour alone.
- **ASCII fallback.** When the locale is not UTF-8, `TERM=dumb`, the `--ascii` flag is passed or `SONDALAB_ASCII=1` is set, use the `ascii` form of every glyph, including the summary separator. Layout widths are unchanged: every Unicode glyph is one column wide, as is its ASCII form.

## Patterns (full screen)

A full-screen view (an alternate-screen program with a key reader) uses the same roles and glyphs, plus the box set in `tui.box`.

```
╭─ PROBES ─────────────────────╮╭─ DETAIL ────────────╮
│ ID       STATE    AGE        ││ q-8f2a              │
│▌q-8f2a   ✓ ok     2m         ││ resolved in  1.2s   │
│ q-71c0   ● live   12s        ││ cache        hit    │
│ q-0d9e   ✗ err    5m         ││                     │
╰──────────────────────────────╯╰─────────────────────╯
↑↓ move · enter open · / filter · : command · ? help · q back · ctrl-c quit
```

### Panes

- **Borders are rounded light box drawing:** `╭ ╮ ╰ ╯` for the corners, `─` and `│` for the sides (`box.topLeft`, `box.topRight`, `box.bottomLeft`, `box.bottomRight`, `box.horizontal`, `box.vertical`). ASCII: `+ + + + - |`.
- **The focused pane** has its border in `prompt` and its title in inverse video (the inversion band, L3). **Other panes** have a `dim` border and a `dim` title.
- **The title** sits in the top border after `╭─ `, in uppercase.

### Selection

The selected row is a row tint plus a seam: `▌` (`box.seam`, ASCII `>`) in `prompt` in the row's first cell. The tint is a background a step off the pane's ground; with no colour, the seam alone marks the row.

### Tables

- No vertical rules between columns; columns are separated by spaces.
- Headers in `dim` uppercase (the micro label, L1).
- The identifier is the first column; one record per row.

### Key hints

One footer line, at the bottom of the screen: keys in `accent`, verbs in `dim`, pairs joined by the `separator` glyph. The shared keys:

| Key | Action |
|---|---|
| `/` | filter |
| `:` | command |
| `?` | help |
| `q`, `esc` | back |
| `ctrl-c` | quit |

The arrows `↑` and `↓` (`keys.up`, `keys.down`) name the movement keys; in ASCII the pair is written `up/dn`.

### Destructive actions

```
? Delete probe q-8f2a? [y/N]
? Type q-8f2a to delete it permanently:
```

A destructive action asks `[y/N]`, default no. An irreversible delete asks the user to type the name of what it deletes; anything else cancels.

### Empty states

One line: what is missing and the command that fills it.

```
No probes · add one with smartctx probe add <url>
```

### Plain mode

Every full-screen view also has `--plain`: the same content as line output, with no alternate screen, no key reader and no redraw. Accessible mode implies it. The probes view above, with `--plain`:

```
ID       STATE    AGE
q-8f2a   ✓ ok     2m
q-71c0   ● live   12s
q-0d9e   ✗ err    5m
```

## Robustness

### Environment

| Variable | Token (`tui.env`) | Effect |
|---|---|---|
| `SONDALAB_REDUCED_MOTION` | `reducedMotion` | `1` turns motion off. |
| `SONDALAB_ACCESSIBLE` | `accessible` | `1` turns accessible mode on. |
| `ACCESSIBLE` | `accessible` | Set, the same as `SONDALAB_ACCESSIBLE=1` (Charm's name). |
| `NO_COLOR` | `noColor` | Set and non-empty, no colour. |
| `FORCE_COLOR` | `forceColor` | Set to anything but an empty string or `0`, colour even without a TTY (force-color.org). |
| `CI` | `ci` | Set, motion off. |
| `TERM` | `term` | `dumb`: no colour, no motion, ASCII glyphs. |
| `COLORTERM` | `colorTerm` | `truecolor` or `24bit` allows truecolor. |
| `SONDALAB_ASCII` | `ascii` | `1` uses the ASCII form of every glyph, like `--ascii`. |

### Colour

Colour is decided in this order; the first rule that applies wins:

1. the `--color` or `--no-color` flag;
2. `NO_COLOR`;
3. `FORCE_COLOR`; set to an empty string or `0`, it does not apply;
4. TTY detection on the stream being written, and `TERM=dumb`.

The roles are painted as ANSI 16 by default (`terminal.*.ansi`), so the user's terminal theme controls contrast. The truecolor values (`terminal.*.true`) are used only when `COLORTERM` is `truecolor` or `24bit` **and** the program opts in.

### Light or dark

To learn the background, query it with OSC 11 (`OSC 11 ; ? ST`) with a 100ms timeout (`robustness.osc11TimeoutMs`), before any key reader starts. No reply within the timeout means dark.

### Accessible mode

`SONDALAB_ACCESSIBLE=1`, or `ACCESSIBLE` set, turns on accessible mode: plain prompts (a numbered list answered by typing, no arrow-key menu), no redraw, every state written as a word next to its glyph, and full-screen views in `--plain`. It implies reduced motion. `SONDALAB_REDUCED_MOTION=1` alone turns the motion off and changes nothing else.

```
? Open which probe? Type a number, then Enter
  1  q-8f2a  ok
  2  q-71c0  live
  3  q-0d9e  err
> 2
```

### Width

- Wrap prose at the terminal width, capped at 100 columns (`layout.maxWidth`). When the width is unknown, use the cap.
- Cut labels at `labelWidth`; never wrap them.
- **Every glyph in `tui` is one column wide:** one code point, East Asian Width neither W nor F, not an emoji, no combining mark. Several glyphs are East Asian Width A, ambiguous: `▒▓█`, `▌`, `▀▄` and `■` (the header mark), `●○·`, the box set, `…` and `↑↓`. The spec assumes the terminal renders ambiguous width as narrow, its default outside CJK locales. On a terminal set to render ambiguous width as wide (a CJK setup), `--ascii` or `SONDALAB_ASCII=1` is the override: every glyph takes its ASCII form.

### Windows

Enable `ENABLE_VIRTUAL_TERMINAL_PROCESSING` on the console handle. If that fails, fall back to plain text: no escape sequences, no motion, ASCII glyphs.

### Streams and machine output

- `--json` writes machine-readable results for scripts, with no glyphs, colour or motion.
- Progress, spinners and prompts go to stderr; results go to stdout. A pipe on stdout leaves the spinner on a TTY stderr intact.

### Text for machines and sessions

Text a program writes for an AI session or another program to read back is not human output. Recall bodies, context injected into a model and hook payloads are examples. This spec's terminal rules do not apply to it:

- **Byte-stable in every locale and environment.** The same input gives the same bytes whatever `LANG`, `TERM`, `SONDALAB_ASCII`, `SONDALAB_ACCESSIBLE` or `NO_COLOR` say.
- **No ASCII fallback, no colour, no width-dependent wrapping.** The reader is not a terminal, so `--ascii`, the colour precedence and `layout.maxWidth` do not reach it.
- **Existing glyphs stay.** A glyph such text already carries is kept even where the Voice rules would not pick it, for example the `⚠` (U+26A0) that cld puts on anchored-code lines. Changing it changes what the reader matches on.

## Sources

- [Command Line Interface Guidelines (clig.dev)](https://clig.dev/)
- [Heroku CLI style guide](https://devcenter.heroku.com/articles/cli-style-guide)
- [Atlassian, 10 design principles for delightful CLIs](https://www.atlassian.com/blog/it-teams/10-design-principles-for-delightful-clis)
- [12 Factor CLI Apps](https://charlesreid1.com/wiki/12_Factor_CLI_Apps)
- [PatternFly CLI handbook](https://www.patternfly.org/content-design/writing-guides/cli-handbook/writing-guidelines)
- [GitHub, building a more accessible GitHub CLI](https://github.blog/engineering/user-experience/building-a-more-accessible-github-cli/)
- [gh environment variables](https://cli.github.com/manual/gh_help_environment)
- [cli-spinners](https://github.com/sindresorhus/cli-spinners)
- [ora](https://github.com/sindresorhus/ora)
- Charm: [Bubbles](https://github.com/charmbracelet/bubbles), [Lip Gloss](https://github.com/charmbracelet/lipgloss), [Huh](https://github.com/charmbracelet/huh), [Harmonica](https://github.com/charmbracelet/harmonica), [Gum](https://github.com/charmbracelet/gum)
- [k9s](https://github.com/derailed/k9s)
- [lazygit](https://github.com/jesseduffield/lazygit)
- [btop](https://github.com/aristocratos/btop)
- [chafa](https://hpjansson.org/chafa/)
- [timg](https://github.com/hzeller/timg)
- [NO_COLOR](https://no-color.org/)
- [FORCE_COLOR](https://force-color.org/)
- [CLICOLOR](https://bixense.com/clicolors/)
- [termstandard/colors](https://github.com/termstandard/colors)
- [Are we sixel yet](https://www.arewesixelyet.com/)
- [kitty graphics protocol](https://sw.kovidgoyal.net/kitty/graphics-protocol/)
- [Mitchell Hashimoto, grapheme clusters in terminals](https://mitchellh.com/writing/grapheme-clusters-in-terminals)
- [Microsoft, console virtual terminal sequences](https://learn.microsoft.com/en-us/windows/console/console-virtual-terminal-sequences)
- [WCAG 2.3.1, three flashes or below threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
