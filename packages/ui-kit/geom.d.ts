/* Type declarations for geom.js — the pure geometry both gooey families share.
   See effects.d.ts for why these are hand-written. */

/** A radius from its computed string, resolved and clamped the way the browser
 *  paints it: a percentage is of the shorter side, and the result is at most
 *  half that side. */
export function cornerPx(raw: string, w: number, h: number): number;

/** The rounded box as an SVG path at the origin. */
export function roundedRectPath(w: number, h: number, radii: number[]): string;

/** The rounded box as an SVG path at an offset, which may be negative. */
export function roundedRectPathAt(x: number, y: number, w: number, h: number, radii: number[]): string;

/** Where a field's coordinate origin sits in viewport coordinates: the
 *  container's PADDING box, not the border box getBoundingClientRect returns. */
export function fieldOrigin(
  containerRect: { left: number; top: number },
  borderLeft: number,
  borderTop: number,
): { x: number; y: number };

/** One member's silhouette in field coordinates, dilated by `reach`. */
export function memberShape(
  rect: { left: number; top: number; width: number; height: number },
  origin: { x: number; y: number },
  radii: number[],
  reach: number,
): { x: number; y: number; w: number; h: number; radii: number[] };

/** The blur sigma that welds two SILHOUETTES exactly `weld` pixels apart.
 *  Callers usually want weldPlan(). */
export function weldSigma(weld: number): number;

/** The gap a given sigma welds across. */
export function weldGap(sigma: number): number;

/** How to spend a weld distance: as little blur as the neck needs, dilation
 *  for the rest. Dilation preserves an outline where blur melts it. */
export function weldPlan(weld: number, reachMin: number, softMax: number): { sigma: number; reach: number };

/** The shortest distance between two silhouettes, 0 if they overlap. */
export function shapeGap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): number;

/** Which members have welded to at least one other, in the same order. */
export function weldedMembers(shapes: { x: number; y: number; w: number; h: number }[], sigma: number): boolean[];

/** The filter region covering every shape plus three sigmas of blur. */
export function filterRegion(
  shapes: { x: number; y: number; w: number; h: number }[],
  sigma: number,
): { x: number; y: number; width: number; height: number };

/** The goo chain's alpha slope. WELD_K is derived from this pair. */
export const GOO_CONTRAST: number;
export const GOO_INTERCEPT: number;
