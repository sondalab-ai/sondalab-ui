---
name: fresh-release-lag-npm-and-uv-cache
description: "Right after a kit/palette publish, npm serves the new version ~1 min late and `uv lock` resolves from a stale cache; wait, then `uv lock --refresh`."
metadata:
  node_type: memory
  type: reference
  originSessionId: f2cab8ad-74c2-4e93-a09d-4d4ee31efed5
  modified: 2026-10-27T07:55:33.404Z
---

After the publish workflows succeed on the merge to main (2026-10-27, ui-kit 0.41.0 / palette 0.8.0):

- npm Trusted Publishing logs "being processed and may take a few minutes"; `npm view @sondalab/ui-kit version` showed the old version for ~1 minute. Re-query with `--prefer-online` before deciding the publish failed.
- `uv lock` in a consumer (MxM) failed with "only sondalab-palette<=0.7.1 is available" although PyPI already had 0.8.0. `uv lock --refresh` (or `--refresh-package` in another repo) fixed it.

**How to apply:** consumer bumps run after the publish; build them against `npm pack` tarballs / editable palette meanwhile, never commit locks until the registry serves the version. Related: [[solo-epics-land-as-one-merge]].
