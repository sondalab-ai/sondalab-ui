/** One dot of a halftone, in unit coordinates of the square picture. */
export interface Dot {
  x: number;
  y: number;
  /** Light, 0..1, after the stretch, the S-curve and the edge fade. */
  L: number;
  /** Where it starts before it gathers, inside the circle. */
  sx: number;
  sy: number;
  /** Seconds before it starts moving to its place. */
  delay: number;
  phase: number;
}

export interface SampleOptions {
  /** Cells per side. Default 96. */
  grid?: number;
  /** Print the picture's dark (ink on a light ground). Default false. */
  invert?: boolean;
  /** Seed for reproducible dots. Omitted: Math.random. */
  seed?: number;
  /** Cells below this light draw nothing. Default 0.03. */
  floor?: number;
}

export interface Motion {
  /** Seconds one dot takes to reach its place. Default 1.1. */
  assemble?: number;
  /** Float orbit, in cells. Default 0.15. */
  drift?: number;
  /** Light breath, as a fraction. Default 0.075. */
  shimmer?: number;
  /** Seconds between two scan bands. Default 6. */
  scanPeriod?: number;
}

export interface DotFrame {
  x: number;
  y: number;
  r: number;
}

export declare function sampleDots(pixels: ArrayLike<number>, size: number, options?: SampleOptions): Dot[];
export declare function dotFrame(dot: Dot, t: number, width: number, grid: number, motion?: Motion): DotFrame;
export declare function settledFrame(dot: Dot, width: number, grid: number): DotFrame;
export declare function cover(width: number, height: number): { sx: number; sy: number; s: number };
