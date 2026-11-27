---
name: solo-epics-land-as-one-merge
description: "Since 2026-11-27 sondalab-ui uses ads: no integration branch, each slice is its own ads change on main. Before that: one merge of a tested integration branch, no stacked PRs"
metadata:
  type: feedback
---

**Status 2026-11-27:** sondalab-ui uses `ads` (`fd19da4 chore(ads): initialize ads`). `ads work` has no base-branch option and always lands on `main`, so slice PRs into an epic branch cannot run through `ads` (owner, 2026-11-27). Do not open an integration branch. Run each slice as its own `ads` change. Each change lands on `main` alone. The rest of this note is history from before `ads`.

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
