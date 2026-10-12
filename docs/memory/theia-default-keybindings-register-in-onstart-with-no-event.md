---
name: theia-default-keybindings-register-in-onstart-with-no-event
description: "Theia registers its default keybindings in KeybindingRegistry.onStart and fires no change event, so a widget built earlier reads an empty registry; read again in onAfterAttach"
metadata:
  node_type: memory
  type: project
  originSessionId: b9ea86eb-ce13-4386-86e5-7ca5123da200
  modified: 2026-10-05T16:07:11.491Z
---

Theia registers its default keybindings in `KeybindingRegistry.onStart`, and nothing fires afterwards (there's no `onKeybindingsChanged` for that first registration). A widget built before the shell attaches therefore sees an empty registry and renders no keys, with no error. In spexr S5b-1, the title bar's command field showed no keycaps in the first CI capture for exactly this reason.

**Why:** found in spexr S5b-1 (https://github.com/sondalab-ai/spexr-ide/pull/94). Fixed in `1ea4853`, which reads the keys in `onAfterAttach`; a regression guard was added in `5bd875b`. The bug only shows up in a rendered capture: unit tests with a stubbed registry pass.

**How to apply:** any spexr widget that shows a key binding should read it in `onAfterAttach` or later, never in its constructor or `@postConstruct`. If the keys must follow user keymap edits, also listen to `onKeybindingsChanged`. Related: [[spexr-no-local-tests]] (CI captures are the only way to see this).
