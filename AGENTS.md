# Agent instructions — sondalab-ui

Guidance for AI coding agents working in this repo. Human contributors: the release rules apply to you too.

This repo is the single source of truth for the Sondalab design system. `sondalab.tokens.json` is the canonical input; the generators emit two published artifacts:

- `packages/ui-kit/` → **`@sondalab/ui-kit`** (npm) — CSS custom properties + themes.
- `packages/palette-py/sondalab_palette/__init__.py` → **`sondalab-palette`** (PyPI) — terminal color roles.

## Never hand-edit generated files

`packages/ui-kit/tokens.css`, `packages/ui-kit/themes/*.css`, and `packages/palette-py/sondalab_palette/__init__.py` are **generated**. Edit `sondalab.tokens.json`, then regenerate:

```sh
npm run gen:tokens
```

Commit the regenerated outputs together with the token change. CI fails if committed outputs drift from a fresh regeneration (see `.github/workflows/check-drift.yml`).

## Release / version bump (MANDATORY — two packages, two registries)

Both publish workflows gate on "version not already on the registry": a merge to `main` publishes a package **only if** its version in the manifest is not yet live. A merge without a bump is a silent no-op — nothing publishes.

**One change to `sondalab.tokens.json` regenerates BOTH packages. So any PR that changes generated output MUST bump BOTH versions in the same PR:**

1. `packages/ui-kit/package.json` → `version`
2. `packages/palette-py/pyproject.toml` → `version`

Miss either one and that package silently fails to publish while the other ships — leaving the two distributions out of sync at different versions. Bump both, every time the tokens change.

Semver for each package independently:

- **patch** — a color/value tweak with no structural change to the token set.
- **minor** — a new token, role, or theme (backward compatible).
- **major** — a removed/renamed token or role (breaking for consumers).

Changes that touch only one package's packaging (e.g. `ui-kit`'s `exports`, `palette-py`'s build backend) bump only that package. Docs/CI-only changes bump neither.

### Pre-PR checklist

1. Edit `sondalab.tokens.json`; run `npm run gen:tokens`.
2. Bump **both** `packages/ui-kit/package.json` and `packages/palette-py/pyproject.toml`.
3. Confirm neither new version is already live:
   - `curl -fsS https://registry.npmjs.org/@sondalab%2Fui-kit/<version>` → 404
   - `curl -fsS https://pypi.org/pypi/sondalab-palette/<version>/json` → 404
4. On merge to `main`, watch both publish workflows go green.

## Cross-repo coupling — terminal role values

`sondalab-palette`'s `ROLES` table is consumed by **smartctx** (repo `claude-loadout`), whose contract test `tests/test_sondalab_palette.py` pins **exact** values:

- named-ANSI floor byte-identical to legacy codes (`green=32`, `yellow=33`, `cyan=36`, `red=31`);
- truecolor upgrades to exact hex (e.g. `ok` → `38;2;98;208;148`, `accent` → `38;2;53;160;180`).

**Changing any `terminal.*` value in `sondalab.tokens.json` will break smartctx's tests** on its next install. If you change a terminal role value, update `claude-loadout`'s contract test in the same change set (and bump smartctx per its own `AGENTS.md`).

## Publishing mechanics (reference)

- Both registries use **Trusted Publishing (OIDC)** — no API tokens stored.
- This repo is **private**: any workflow `permissions:` block must include `contents: read` explicitly, or `actions/checkout` fails "Repository not found" (a permissions block defaults unlisted scopes to `none`).
- Default branch is `main`.
- Publishing itself is performed by CI on merge; do not run `npm publish` / `twine upload` locally.
