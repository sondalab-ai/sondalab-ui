# TUI patterns

Interaction patterns for command-line surfaces (the Term substrate). The six colour roles live in `terminal` in `sondalab.tokens.json`; the glyphs and layout numbers below are the `tui` section beside it (Python: `sondalab_palette.GLYPHS`, `sondalab_palette.LAYOUT`). This file is the grammar; the tokens are the values.

## Glyphs

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

## Layout

`indent` 2 columns, `labelWidth` 28 columns, `blankBeforeSummary` 1 line.

## Step list

One line per step: the indent, the glyph, the label padded to `labelWidth`, then the detail.

```
  ✓ Check git repository        clean, on main
  ✓ Install pre-commit hook     fixed
  ! Check signing key           not loaded
  ✗ Verify remote               origin unreachable
```

The label is padded with spaces to `labelWidth`; a longer label is cut, never wrapped. The detail is one short phrase and takes the rest of the line. The glyph is painted with its role; the label and detail stay in the default ink, and a detail that explains a skipped or pending step may use `dim`.

## Confirmation

```
? Install the hook into ~/.config/git? [y/N]
```

`? <question> [Y/n]`. The capital letter marks the default, which Enter accepts. The default is no (`[y/N]`) for any action outside the working directory; inside it, the default may be yes (`[Y/n]`). The `?` is the `question` glyph in the `prompt` role. An empty answer takes the default. Any other unrecognised input is never read as a choice: the prompt asks again, at most 3 times in all, and then fails with "no valid answer".

## Summary

After `blankBeforeSummary` blank line, one line:

```
Summary  3 ok · 1 fixed · 1 warn · 1 failed
```

`Summary`, two spaces, then four counts in the order ok, fixed, warn, failed, joined by the `separator` glyph (` · `, or ` | ` in ASCII). Each count is painted with its role (`ok`, `ok`, `warn`, `err`); a zero count is painted `dim`. The four counts are always all present.

## Rules

- **A failure never uses a success glyph.** `failed` is `✗` in `err`; `✓` is only for `done` and `fixed`. A step that did not do its job is `failed` or `warn`, never `done`.
- **Non-TTY: no prompts.** Without a TTY on stdin the program never asks a question. It never takes a default on its own: an action runs without a prompt only when the caller passed an explicit flag (for example `--yes`); otherwise it stops with an error naming the missing flag.
- **`NO_COLOR`: glyphs stay, color goes.** With `NO_COLOR` set the output is the same text with no escape sequences. Meaning is carried by the glyph and the word, never by colour alone.
- **ASCII fallback.** When the locale is not UTF-8, or `TERM=dumb`, use the `ascii` form of every glyph, including the summary separator. Layout widths are unchanged: every Unicode glyph is one column wide, as is its ASCII form.
