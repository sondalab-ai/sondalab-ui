---
name: env-os-environ-default-leaks-secrets
description: "A Python default `env=os.environ` makes help()/inspect.signature() print the whole environment, secrets included; sondalab_palette.term 0.6–0.7 has it."
metadata:
  node_type: memory
  type: project
  originSessionId: dd0a84bd-f725-4153-bf6b-bc38f444c79e
  modified: 2026-10-26T18:48:49.694Z
---

`sondalab_palette.term` helpers (0.6.0, 0.7.0) default to `env: Mapping = os.environ`. Python evaluates the default once, so `inspect.signature(fn)`, `help(fn)` or any repr of the signature prints every environment variable.

On 2026-10-26 this put live `NPM_TOKEN` and `CAMUNDA_NPM_TOKEN` values into an agent's tool output while it checked the cld migration. Nothing was committed, but the values reached the model context.

**Why:** the leak happens without a bug in the caller. Introspecting the API is enough.

**How to apply:**
- Default to `env=None`, and read `os.environ` inside the function.
- Never print a signature or a `help()` of these helpers until palette ships that fix (fixed in 0.7.1).
- Tell the owner to rotate any token that leaked.

Related: [[geist-pixel-cell-is-0-08em]].
