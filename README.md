# sondalab-ui

Shared design system for the Sondalab suite. One canonical token source generates a web CSS kit and a terminal palette; every tool consumes them instead of hand-rolling its own.

```
sondalab.tokens.json          canonical source — edit here only
scripts/
  gen-css.mjs                 -> packages/ui-kit/{tokens.css, themes/*.css, themes/products.css, neutrals.json}
                                 (reads agent/accent-registry.json for each product's neutral tint)
  gen-py.mjs                  -> packages/palette-py/sondalab_palette/__init__.py
  lib/tokens.mjs              shared loader (tokens + accent registry)
  lib/neutrals.mjs            the neutral ladder: per-product tint, hex, build guards
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

- **Shared grammar, per-product accent.** Tools share token architecture, type (Geist / Geist Mono for the UI, Fraunces for the brand marks only, since ui-kit 0.30), spacing, motion, the neutral ladder, and the 3-theme machinery; each product keeps its own signature accent by overriding `--sl-accent-*`, and its neutrals take that accent's hue (generated as hex per product, `themes/products.css` + `neutrals.json`). The bundled default is Sondalab amber + teal.
- **Terminal color = semantic roles + truecolor opt-in.** Color applies to roles (`prompt`/`ok`/`warn`/`err`/`dim`/`accent`), never decoration. Named-ANSI floor resolves through the user's theme; `COLORTERM=truecolor` upgrades to brand hex; `NO_COLOR` disables.
- **No CSS→Python bridge exists**, so there is one canonical source and two generated distributions, not one shared package.

## Publishing

- **`sondalab-palette` (PyPI)** — via **Trusted Publishing (OIDC)**, no API token stored. The workflow `.github/workflows/publish-palette.yml` builds + publishes on merge to `main` when the version in `packages/palette-py/pyproject.toml` is not yet on PyPI (bump it to release). **One-time setup:** add a *pending* trusted publisher at https://pypi.org/manage/account/publishing/ — Project `sondalab-palette`, Owner `sondalab-ai`, Repository `sondalab-ui`, Workflow `publish-palette.yml`. After that, re-run the workflow (Actions tab → "Run workflow") to release the current version.
- **`@sondalab/ui-kit` (npm)** — via **Trusted Publishing (OIDC) + provenance**, no token stored. Workflow `.github/workflows/publish-ui-kit.yml` builds + publishes on merge to `main` when the version in `packages/ui-kit/package.json` is not yet on npm. **One-time setup:** (1) own the `@sondalab` scope — create the org at https://www.npmjs.com/org/create (name `sondalab`, free for public packages); (2) configure the trusted publisher (npmjs.com → package or org **Settings → Trusted Publisher / Connect a repository** → GitHub Actions, Repository `sondalab-ai/sondalab-ui`, Workflow `publish-ui-kit.yml`); (3) Actions tab → "Run workflow". Note: npm configures trusted publishing per **existing** package — if the UI won't pre-register `@sondalab/ui-kit` before it exists, do one bootstrap `npm publish --access public` (with a temporary granular token or `npm login`), then switch to OIDC and remove the token.

## Consumers

- **spexr**, **introspect** — web, consume `@sondalab/ui-kit` (in-place migration pending a visual review).
- **smartctx** (claude-loadout) — terminal, adopted (vendored palette interim until `sondalab-palette` is on PyPI).
- **daos**, **introspect** CLI — terminal, trivial adopters (pending).
