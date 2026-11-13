---
name: sondalab-site-is-public-so-its-actions-run-despite-billing
description: sondalab-site was made public on 2026-11-13 because Actions on private sondalab-ai repos fail on billing; its deploy workflow runs again. The live server rewrites HTML and image names (PageSpeed), so live checks must match loosely.
metadata:
  type: reference
---

- GitHub Actions on **private** `sondalab-ai` repos do not start: "recent account payments have failed or your spending limit needs to be increased" (seen 2026-11-11 on sondalab-ui, 2026-11-13 on sondalab-site). Public repos in the org run normally (spexr-ide, roboemot, claude-loadout).
- The owner made `sondalab-ai/sondalab-site` public on 2026-11-13. The deploy workflow (`.github/workflows/deploy.yml`, push to `main`, rsync over SSH from repo secrets) then ran green and https://sondalab.eu/ took the new build. `sondalab-ui` is still private, so its CI and npm publish workflows still fail on billing.
- Before that change I scanned all 255 revisions: no tokens or keys; two private LAN addresses in old docs; commit author emails (work and personal) are public now.
- https://sondalab.eu/ runs mod_pagespeed: it strips attribute quotes and renames images to `/_astro/x<name>...webp.pagespeed.ic.<hash>.webp`. A check that greps the live HTML for `class="..."` or an exact asset name reports a false failure. Match `ph__print`-style class names without quotes, and take image URLs up to the next quote.
