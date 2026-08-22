# sondalab-ui

Shared design system for the Sondalab suite. One canonical token source generates a web CSS kit and a terminal palette; every tool consumes them instead of hand-rolling its own.

```
sondalab.tokens.json          canonical source — edit here only
scripts/
  gen-css.mjs                 -> packages/ui-kit/{tokens.css, themes/*.css}
  gen-py.mjs                  -> packages/palette-py/sondalab_palette/__init__.py
  lib/tokens.mjs              shared loader
packages/
  ui-kit/                     @sondalab/ui-kit   — CSS custom properties (--sl-*), 3 themes
  palette-py/                 sondalab-palette   — terminal color roles (named ANSI + truecolor)
docs/                         design-system spec + implementation plan
```

## Regenerate after editing tokens

```sh
npm run gen:tokens
```

Generated files are committed; never hand-edit them.

## Design principles

- **Shared grammar, per-product accent.** Tools share token architecture, type (Fraunces / Instrument Sans / Martian Mono), spacing, motion, neutrals, and the 3-theme machinery; each product keeps its own signature accent by overriding `--sl-accent-*`. The bundled default is Sondalab amber + teal.
- **Terminal color = semantic roles + truecolor opt-in.** Color applies to roles (`prompt`/`ok`/`warn`/`err`/`dim`/`accent`), never decoration. Named-ANSI floor resolves through the user's theme; `COLORTERM=truecolor` upgrades to brand hex; `NO_COLOR` disables.
- **No CSS→Python bridge exists**, so there is one canonical source and two generated distributions, not one shared package.

## Publishing

- **`sondalab-palette` (PyPI)** — via **Trusted Publishing (OIDC)**, no API token stored. The workflow `.github/workflows/publish-palette.yml` builds + publishes on merge to `main` when the version in `packages/palette-py/pyproject.toml` is not yet on PyPI (bump it to release). **One-time setup:** add a *pending* trusted publisher at https://pypi.org/manage/account/publishing/ — Project `sondalab-palette`, Owner `sondalab-ai`, Repository `sondalab-ui`, Workflow `publish-palette.yml`. After that, re-run the workflow (Actions tab → "Run workflow") to release the current version.
- **`@sondalab/ui-kit` (npm)** — `cd packages/ui-kit && npm publish --access public` (needs a real npm token in `~/.npmrc`, not the GitHub PAT).

## Consumers

- **spexr**, **introspect** — web, consume `@sondalab/ui-kit` (in-place migration pending a visual review).
- **smartctx** (claude-loadout) — terminal, adopted (vendored palette interim until `sondalab-palette` is on PyPI).
- **daos**, **introspect** CLI — terminal, trivial adopters (pending).
