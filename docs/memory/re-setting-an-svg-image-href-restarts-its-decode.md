---
name: re-setting-an-svg-image-href-restarts-its-decode
description: Writing the same href back to an SVG <image> makes Chrome reload and re-decode it; done per frame it froze the renderer for seconds while the JS measured 4-10ms.
metadata:
  type: reference
---

`picture.setAttribute("href", sameValue)` on an SVG `<image>` is **not** a
no-op in Chrome: it restarts the load and the decode. Inside a per-frame paint
this decodes the bitmap every frame. A 220×132 PNG did it and blocked the main
thread for seconds at a time.

Guard every such write:

```js
if (picture.getAttribute("href") !== href) picture.setAttribute("href", href);
```

**Why it was hard to find:** every symptom pointed at a JavaScript loop — a
`setTimeout(800)` returning after 9990 ms, `Runtime.evaluate` timing out, the
renderer unresponsive. The measurements that redirected the search:

- time the entry point alone → **4–10 ms**, so the JS is not the cost;
- wrap `ResizeObserver`/`MutationObserver` in counting subclasses → **0 and 1**,
  so there is no observer loop either.

With both ruled out, the remaining suspect is rendering, and the only thing the
frame was doing differently was re-writing an attribute. A minimal page with
those two counters is worth building before theorising — `lab/z-goo-min.html`.

Related: [[an-svg-image-inside-a-pattern-is-placed-in-the-tiles-space]].
