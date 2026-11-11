export interface ArtHandle {
  /** Disconnect every observer. Elements keep the picture they show. */
  stop(): void;
}

/**
 * Draw the procedural art under `root`: every `.sl-art-poster` that has a
 * `data-sl-art-seed` gets its own picture of its scene, and every
 * `.sl-art-horizon` is drawn at its real width. Follows elements added
 * later, seed and class changes, and a horizon's width. Without this call
 * the stylesheet's static pictures show. It never animates.
 */
export declare function mountArt(root?: Document | Element): ArtHandle;
