/* @sondalab/ui-kit — geom.js
   The pure geometry the effects layer shares: resolving a computed radius the
   way the browser paints it, tracing a rounded box, and the arithmetic of the
   goo's weld. No DOM, no colour, no state — every function here is a value in
   and a value out, which is what lets scripts/effects-goo.test.mjs assert the
   shapes directly instead of scraping them out of a module's source.

   Contract: docs/specs/2026-09-08-effects-layer-design.md */

/** A corner radius from its computed string, resolved against the box the way
 *  CSS does: a percentage is of the shorter side (right for a pill or a
 *  circle, the two shapes a percentage is written for), and the result is
 *  CLAMPED to half that side.
 *
 *  The clamp is not a safety net, it is the rule. CSS reduces every radius
 *  proportionally when two on the same side would overlap, so a uniform
 *  `border-radius: 9999px` on a 40px button paints a 20px circle. Without the
 *  clamp a silhouette traced against 9999px lands thousands of pixels from the
 *  element — which is why the gooey once read as absent on exactly the round
 *  buttons it exists for: `--sl-radius-pill` is 9999px.
 *  @param {string} raw the computed border-*-radius string
 *  @param {number} w the box width in CSS pixels
 *  @param {number} h the box height in CSS pixels
 *  @returns {number} the radius the browser actually paints, in CSS pixels */
export function cornerPx(raw, w, h) {
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return 0;
  const shortest = Math.min(w, h);
  return Math.min(raw.trimEnd().endsWith("%") ? (v / 100) * shortest : v, shortest / 2);
}

/** The rounded box as a path at an offset, radii scaled down together when
 *  they would overlap — the same one shared factor CSS applies, never a
 *  per-corner clamp, which would change the shape rather than its size.
 *  @param {number} x left edge in the caller's coordinate space (may be negative)
 *  @param {number} y top edge
 *  @param {number} w width
 *  @param {number} h height
 *  @param {number[]} radii the four radii, clockwise from top-left
 *  @returns {string} an SVG path `d` */
export function roundedRectPathAt(x, y, w, h, [tl, tr, br, bl]) {
  const f = Math.min(
    1,
    w / Math.max(1e-6, tl + tr), w / Math.max(1e-6, bl + br),
    h / Math.max(1e-6, tl + bl), h / Math.max(1e-6, tr + br),
  );
  tl *= f; tr *= f; br *= f; bl *= f;
  const r = x + w;
  const b = y + h;
  return `M ${x + tl} ${y} H ${r - tr} A ${tr} ${tr} 0 0 1 ${r} ${y + tr} V ${b - br} A ${br} ${br} 0 0 1 ${r - br} ${b} H ${x + bl} A ${bl} ${bl} 0 0 1 ${x} ${b - bl} V ${y + tl} A ${tl} ${tl} 0 0 1 ${x + tl} ${y} Z`;
}

/** Where the shared field's coordinate origin sits in viewport coordinates.
 *
 *  The field is an absolutely positioned child with `inset: 0`, which resolves
 *  against the container's PADDING box, while `getBoundingClientRect()` returns
 *  its BORDER box. Conflating the two shifts every member by the container's
 *  border width — visible immediately on a bordered card, and invisible on the
 *  borderless one you happen to test with.
 *  @param {{left: number, top: number}} containerRect the container's border box
 *  @param {number} borderLeft computed border-left-width in CSS pixels
 *  @param {number} borderTop computed border-top-width
 *  @returns {{x: number, y: number}} the field's (0, 0) in viewport coordinates */
export function fieldOrigin(containerRect, borderLeft, borderTop) {
  return { x: containerRect.left + borderLeft, y: containerRect.top + borderTop };
}

/** One member's silhouette in field coordinates, dilated by `reach`.
 *
 *  The dilation is what makes the substance visible at all: the real element
 *  rides crisp on top of its own silhouette, so a silhouette the same size as
 *  the element would be entirely hidden behind it. `reach` is how far the
 *  substance peeks out as a rim — and, doubled, how much closer two members
 *  are to welding than their laid-out gap suggests.
 *
 *  Offsetting a rounded rectangle outward grows each radius by the offset, so a
 *  pill stays a pill and a circle stays a circle.
 *  @param {{left: number, top: number, width: number, height: number}} rect the member's border box
 *  @param {{x: number, y: number}} origin the field's origin, from fieldOrigin
 *  @param {number[]} radii the four painted radii, from cornerPx
 *  @param {number} reach how far the silhouette peeks out, in CSS pixels
 *  @returns {{x: number, y: number, w: number, h: number, radii: number[]}} */
export function memberShape(rect, origin, radii, reach) {
  return {
    x: rect.left - origin.x - reach,
    y: rect.top - origin.y - reach,
    w: rect.width + 2 * reach,
    h: rect.height + 2 * reach,
    radii: radii.map((r) => r + reach),
  };
}

/** The gap, in units of sigma, at which two silhouettes weld.
 *
 *  The goo chain is a premultiplied Gaussian blur followed by an alpha slope
 *  whose midpoint sits at alpha 0.5 (contrast 18, intercept -8.5). Blur is
 *  linear in alpha, so at the midpoint of a gap `g` between two opaque
 *  straight edges the two blurred alphas sum to `erfc(g / (2·σ·√2))`. They
 *  cross the slope's midpoint — that is, a neck appears — when that equals
 *  0.5, i.e. at `g = 2·√2·erfc⁻¹(0.5)·σ`.
 *
 *  erfc⁻¹(0.5) = 0.4769362762…, so the constant is 1.3489796…. It is written
 *  out rather than computed because there is no erfc in the standard library
 *  and a series expansion here would be three times the code for a number that
 *  cannot change. */
const WELD_K = 1.3489795;

/** The blur sigma that welds two SILHOUETTES exactly `weld` pixels apart.
 *
 *  Note the distance is between silhouettes, after dilation — not the gap
 *  between the members as laid out, which is what `--slfx-goo-weld` binds and
 *  what weldPlan() takes. Callers want weldPlan(); this is the conversion it
 *  and weldGap() are both expressed in.
 *  @param {number} weld the gap between two dilated silhouettes, in CSS pixels
 *  @returns {number} stdDeviation for feGaussianBlur */
export function weldSigma(weld) {
  return weld > 0 ? weld / WELD_K : 0;
}

/** The inverse: the gap a given sigma welds across. Used by the tests and by
 *  anyone reasoning about a field whose sigma was pinned by hand.
 *  @param {number} sigma stdDeviation
 *  @returns {number} the weld gap in CSS pixels */
export function weldGap(sigma) {
  return sigma > 0 ? sigma * WELD_K : 0;
}

/** The filter region covering every shape plus the blur's own reach.
 *
 *  `filterUnits="userSpaceOnUse"` means this is an explicit box, not a
 *  percentage of the bounding box, and a blur clipped by its own region shows
 *  as a straight cut through the goo. Three sigma holds >99.7% of a Gaussian,
 *  which is the same budget the liquid's skin uses.
 *  @param {{x: number, y: number, w: number, h: number}[]} shapes
 *  @param {number} sigma the blur's stdDeviation
 *  @returns {{x: number, y: number, width: number, height: number}} */
export function filterRegion(shapes, sigma) {
  if (!shapes.length) return { x: 0, y: 0, width: 0, height: 0 };
  const pad = 3 * sigma;
  const left = Math.min(...shapes.map((s) => s.x));
  const top = Math.min(...shapes.map((s) => s.y));
  const right = Math.max(...shapes.map((s) => s.x + s.w));
  const bottom = Math.max(...shapes.map((s) => s.y + s.h));
  return { x: left - pad, y: top - pad, width: right - left + 2 * pad, height: bottom - top + 2 * pad };
}

/** How to spend a weld distance: as little blur as the neck needs, and
 *  dilation for the rest.
 *
 *  Both mechanisms bring two silhouettes together, and they are not equivalent.
 *  **Dilation preserves the shape**: offsetting a rounded rectangle outward
 *  grows each radius by the offset, so a 12px corner stays a 12px corner
 *  relative to the box it grew from. **Blur melts it**: the 0.5 iso-contour of
 *  a blurred corner is rounded by roughly sigma, so a sigma near the member's
 *  own radius turns a card into a lozenge, and one near half its height turns
 *  it into a pill. Spending the whole budget on sigma — which is what the first
 *  implementation did — put sigma at 10-16px against a 12px radius, and the
 *  owner's word for the result was that the edges deform badly.
 *
 *  So sigma is CAPPED and dilation absorbs the remainder. The weld distance the
 *  author bound is still honoured exactly: two silhouettes meet when
 *  `gap - 2·reach ≤ 1.3489·σ`, so `weld = 2·reach + 1.3489·σ` by construction.
 *
 *  @param {number} weld the largest gap between two members, AS LAID OUT, that
 *    still grows a neck between them
 *  @param {number} reachMin the rim the author asked for — how far the
 *    substance peeks out past a member with no neighbour
 *  @param {number} softMax the most blur allowed to round a corner
 *  @returns {{sigma: number, reach: number}} */
export function weldPlan(weld, reachMin, softMax) {
  const rim = Math.max(0, reachMin);
  const budget = Math.max(0, weld);
  // What the blur would have to cover once the rim has taken its share.
  const sigma = Math.min(Math.max(0, softMax), weldSigma(budget - 2 * rim));
  return { sigma, reach: Math.max(rim, (budget - WELD_K * sigma) / 2) };
}
