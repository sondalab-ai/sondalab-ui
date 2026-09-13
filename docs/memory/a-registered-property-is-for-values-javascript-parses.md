---
name: a-registered-property-is-for-values-javascript-parses
description: transform: scale(calc(1 - (var(--x, 1.03) - 1) / 3)) resolves correctly with --x unregistered; @property is needed when JavaScript parseFloat()s the value or when a keyframe must interpolate it, not merely because a calc() reads a custom property.
metadata:
  type: reference
---

The effects spec's trap list says *"a `calc()` custom property computes to text
unless registered"*, and `parseFloat("calc(14px * 3 + 12px)")` really is `NaN`.
Read one step too far, that becomes "any `calc()` over a custom property needs
`@property`", and it does not.

Verified in Chrome 152 on a four-case probe, with `--slfx-pane-swell`
unregistered:

| declared | `scale(var(--x, 1.03))` | `scale(calc(1 - (var(--x, 1.03) - 1) / 3))` |
|---|---|---|
| nothing (fallback) | `matrix(1.03, …)` | `matrix(0.99, …)` |
| `--x: 1` on an ancestor | `matrix(1, …)` | `matrix(1, …)` |

An unregistered custom property substitutes as a token stream, and the CSS
engine then parses it in the context it lands in. `scale()` takes a `<number>`,
`calc()` is valid there, and the arithmetic is done at computed-value time.

**How to apply:** register a property when **JavaScript reads it** and has to
get a number, or when a **keyframe or transition must interpolate** it (an
unregistered property snaps). A value only CSS consumes needs nothing — and
registering it would add an initial value that the `var(…, fallback)` form is
deliberately avoiding, since the whole point of a fallback at the point of use
is that an ancestor's declaration stays reachable.
