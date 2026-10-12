---
name: solo-epics-land-as-one-merge
description: "Owner works alone: land a multi-slice epic as one merge of the tested integration branch, not as stacked per-slice PRs squash-merged in order"
metadata:
  type: feedback
---

On 2026-10-11 the owner approved landing the Lumen epic as **one merge of the integration PR** (spexr #99). They also asked whether very granular stacked PRs are needed at all, given that they work alone with agents.

**Why:**
- Two lanes stacked about 25 PRs on a shared base. Each integration merge re-resolved the same `tests/visual` conflicts.
- Fixes found by the real CI on the integration branch had to be mirrored back by hand.
- Slice PRs targeting feature branches ran no unit-test CI. Only the integration PR did, so several bugs surfaced only there.

**How to apply:**
- For a solo epic, keep one long-lived integration branch.
- Open each slice as a short-lived PR **into that branch**. Do not stack slices on one another.
- Keep the independent review per slice. It caught real bugs every round.
- Make sure the full CI, unit tests included, runs on PRs into the integration branch.
- Land the epic with one merge commit into `main`.

Related: [[owner-tests-only-when-development-is-done]].
