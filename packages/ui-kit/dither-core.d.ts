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

/** A check or radio box holds this many cells per side (15px). */
export const CHECK_CELLS: 5;

/** The tick's cells as [column, row], in plotting order. */
export const TICK_CELLS: readonly (readonly [number, number])[];

/** The mixed state's dash, as [column, row]. */
export const DASH_CELLS: readonly (readonly [number, number])[];

/** The radio dot: frame 0 is one cell, frame 1 the plus. */
export const DOT_FRAMES: readonly (readonly (readonly [number, number])[])[];

/** The switch track in cells, the knob's width and inset, and its steps() count. */
export const SWITCH_CELLS: Readonly<{ cols: number; rows: number; knob: number; inset: number; steps: number }>;

/** Share of a check's motion before the tick starts to be plotted. */
export const TICK_START: number;

/** How many tick cells are plotted at progress `t` (0..1). */
export function tickCount(t: number): number;

/** The radio frame at progress `t`: 0 none, 1 one cell, 2 the plus. */
export function dotFrame(t: number): 0 | 1 | 2;

/** The knob's offset in cells after `p` of a steps(N) transition from `from` to `to` (0 or 1). */
export function knobCells(p: number, from: number, to: number): number;
