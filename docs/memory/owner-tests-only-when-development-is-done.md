---
name: owner-tests-only-when-development-is-done
description: "Lumen parity rollout: the owner tests in-app only once all development has converged on the integration branch; don't ask for checks or decisions mid-way, take the recommended default"
metadata:
  type: feedback
---

The owner said (2026-10-09): "don't waste my time. Implement what you have to, then let's everything converge to the implementation branch. I'll test it only when no more development is needed, so that we can focus on polishing it."

**Why:** the owner tried an in-app check mid-way, hit an old build (Electron single-instance handoff to the main checkout's spexr) and a composition gap with the demo; partial checks cost them time.

**How to apply:** for spexr Lumen parity, build every slice → independent review → merge into `integration/lumen` (draft PR, full CI), with no owner checkpoints in between. For ambiguous choices, take the recommended option and log it in the plan and the PR body instead of asking. Hand over only when parity work is complete, with the clean-profile launch command (`THEIA_CONFIG_DIR=$(mktemp -d) … --electronUserData=$(mktemp -d)`).
