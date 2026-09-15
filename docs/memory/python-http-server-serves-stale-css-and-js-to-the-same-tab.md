---
name: python-http-server-serves-stale-css-and-js-to-the-same-tab
description: an edit to a kit CSS or JS file reads stale in an already-open tab under `python3 -m http.server`; cache-bust the ASSET's own URL, and do not blame @property — it re-registers in a live document.
metadata:
  type: reference
---

`python3 -m http.server` sends no `Cache-Control`, so Chrome caches by
heuristic. After editing `glass.css` a reload, `location.reload(true)` and a
`?bust=` query on the PAGE all still computed the old value: the page was new,
the stylesheet was not. A fresh tab picked it up.

The natural conclusion — that `@property` is registered once per document and
its `initial-value` is therefore baked — is **wrong**, and was tested
2026-09-15: injecting the new stylesheet into the live document with a
cache-busted href moved `--slg-lens-blur` from `0.25px` to `5.9px` in place.
Registered properties re-register.

**How to apply:** bust the asset, not the page. Either append a query to the
stylesheet's own href, or read the file with `fetch(url, {cache:'reload'})`
first to confirm what is actually on disk before concluding a change did not
work. For a module, `await import(url + '?v=' + Date.now())` gets the current
source. Verifying in a brand-new tab also works and is the cheapest check when
the whole document is disposable. Related: [[a-registered-property-is-for-values-javascript-parses]].
