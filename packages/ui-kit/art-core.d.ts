/** The art's cell, in CSS px. */
export declare const ART_CELL_PX: 2;
/** The poster frame, in cells: a golden rectangle. */
export declare const POSTER_COLS: 126;
export declare const POSTER_ROWS: 78;
/** A horizon's height, in cells. */
export declare const HORIZON_ROWS: 100;

/** Sets the cells inside a shape whose tone beats the Bayer threshold. */
export type ArtPut = (
  colour: number,
  inside: (x: number, y: number) => boolean,
  tone?: number | ((x: number, y: number) => number),
  over?: Record<number, number> | null,
) => void;

/** What a scene varies by: a seeded value in a range, a cell hash. */
export interface ArtVary {
  pick(lo: number, hi: number, canon: number): number;
  h(i: number, j: number): number;
}

export interface ArtScene {
  /** Hex colours by index; null is a cell the colour layer leaves clear. */
  palette: (string | null)[];
  draw(put: ArtPut, cols: number, rows: number, vary: ArtVary): void;
  /** The index the page's text colour paints; absent or -1 for none. */
  ink?: number;
  /** Colour indices a horizon's dissolve leaves whole, as it leaves the ink. */
  whole?: number[];
  /** What continues past the picture's sides, when the scene does not repeat. */
  strip?(put: ArtPut, cols: number, rows: number): void;
}

/** One palette index per cell. */
export interface ArtPicture {
  cols: number;
  rows: number;
  cells: Uint8Array;
  palette: (string | null)[];
  ink: number;
}

/** The posters, by name: dawn, overprint, hills, orbit. */
export declare const POSTERS: Record<"dawn" | "overprint" | "hills" | "orbit", ArtScene>;
/** The horizons, by name: hills, dawn. */
export declare const HORIZONS: Record<"hills" | "dawn", ArtScene>;

/** A seed from an attribute value: a whole number, a hash of other text, 0 for none. */
export declare function seedOf(value: string | number | null | undefined): number;
/** One poster; seed 0 is the picture components.css ships. */
export declare function renderPoster(name: keyof typeof POSTERS, seed?: number, clip?: boolean): ArtPicture;
/** One horizon of `cols` cells; its left edge continues its right one. */
export declare function renderHorizon(name: keyof typeof HORIZONS, cols: number, seed?: number, clip?: boolean): ArtPicture;
/** The 8-cell strip a horizon continues with past its sides, or null. */
export declare function renderHorizonStrip(name: keyof typeof HORIZONS): ArtPicture | null;
/** A picture's colour layer, or its ink as an opaque mask, as RGBA bytes. */
export declare function toRgba(picture: ArtPicture, layer?: "colour" | "ink"): Uint8ClampedArray;
