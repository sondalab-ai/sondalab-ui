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

Generated from the canonical `sondalab.tokens.json` — do not hand-edit `sondalab_palette/__init__.py`.
