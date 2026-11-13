---
name: sondalab-ui-npm-test-takes-13-5-min-locally-because-scripts
description: sondalab-ui: npm test takes ~13.5 min locally because scripts/lumen-controls.test.mjs and scripts/workbench.test.mjs are slow (807 s for the two, 2026-11-11); run the other files first with node --test 'scripts/[a-k]*.test.mjs' 'scripts/[m-v]*.test.mjs' scripts/live-light.test.mjs (about 1 min, 2406 tests) and the two long ones in the background.
metadata:
  node_type: memory
  loadout_kind: memory
  scope: repo
  created: 2026-11-11
---
