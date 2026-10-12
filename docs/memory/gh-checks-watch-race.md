---
name: gh-checks-watch-race
description: "`gh pr checks --watch` right after `gh pr create` exits non-zero before CI registers — never chain a merge on it"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c5277838-ea42-4f87-8a16-fa1a5be8ef7e
  modified: 2026-09-29T20:34:36.603Z
---

Right after `gh pr create`, `gh pr checks <n> --watch` can exit immediately (non-zero, "no checks reported") because the workflow run hasn't registered yet. Chaining `gh pr merge` after it merged spexr-ide PR #71 before its E2E run finished (2026-09-29; E2E later passed).

**Why:** the merge gate silently became a no-op.
**How to apply:** before merging, wait until `gh pr checks <n>` lists at least one check, then watch; and gate the merge on the watch's exit status (`&& gh pr merge`), never run it unconditionally after.
