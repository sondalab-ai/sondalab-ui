/** A grid of cells. */
export interface Grid {
  cols: number;
  rows: number;
}

/** A point in cell units; it may lie outside the grid. */
export interface Origin {
  x: number;
  y: number;
}

/** The kit's pixel unit in CSS px (3). */
export const CELL_PX: number;

/** The 8×8 Bayer thresholds, each in (0,1), frozen. */
export const BAYER: readonly (readonly number[])[];

/** The Bayer threshold at cell (i, j); the matrix tiles. */
export function bayerAt(i: number, j: number): number;

/** Is cell (i, j) covered by the wipe at `t` (0..1)? Default spread 0.7. */
export function wipeCovered(i: number, j: number, origin: Origin, t: number, grid: Grid, spread?: number): boolean;

/** The wipe frame, row-major, 1 where covered. Default spread 0.7. */
export function wipeFrame(grid: Grid, origin: Origin, t: number, spread?: number): Uint8Array;

/** The signal-strip ramp, row-major, 1 where on. `level` 0..1 is how much of the strip is filled. Default 1. */
export function rampFrame(grid: Grid, level?: number): Uint8Array;
