---
name: electron-macos-hiddeninset-titlebar-facts
description: "Electron macOS hiddenInset title bar: drag-region mouse events never reach the page (Electron 23+); trafficLightPosition.y = (H-16)/2 sizes the AppKit title-bar area to H; Theia has no full-screen event"
metadata:
  node_type: memory
  type: reference
  originSessionId: b9ea86eb-ce13-4386-86e5-7ca5123da200
  modified: 2026-10-05T16:58:07.657Z
---

Three facts that shaped spexr S5b-2 (https://github.com/sondalab-ai/spexr-ide/pull/95), measured on the macos-14 CI runner:

- **Double-click:** since Electron 23, mouse events from a `-webkit-app-region: drag` area never reach the page on macOS (https://github.com/electron/electron/issues/37789), so a page-side double-click handler cannot work. The system zoom/minimize on double-click comes only from AppKit's own title-bar area.
- **Bar height:** Electron grows the AppKit title-bar area to `16 + 2·y` for `trafficLightPosition {x, y}`. For an in-page bar of height H, `y = (H − 16) / 2` (H 44 → y 14) makes the system title-bar area exactly the bar, so double-click works across all of it and the lights centre at H/2. Each light is a 14×16 button on a 20px pitch with a 12px circle; with x 15 the first circle starts at x 16.
- **Full screen:** Theia has no full-screen window event, and `isFullScreen()` is only a flag whose timing on exit is undefined. Forward Electron's enter/leave full-screen events through Theia's window-event channel; its preload passes any event name through `onWindowEvent`. Subscribe first, then read `isFullScreen()` once.

**Why:** working these out took a CI round trip each, since spexr can't run locally ([[spexr-no-local-tests]]).

**How to apply:** any Electron/Theia app with a custom in-page bar on macOS. The lights stay at a fixed size when the page zooms, so the room reserved for them drifts at non-100% zoom.
