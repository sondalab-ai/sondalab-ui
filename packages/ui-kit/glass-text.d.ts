/* Type declarations for glass-text.js. See effects.d.ts for why these are
   hand-written. */

/** Cut a glass host to its own letterforms, so the text IS the glass rather
 *  than a box containing it, and seat an unmasked copy before it to carry the
 *  light. The face, the size and the tracking are read off the element, so a
 *  surface changes them in CSS alone.
 *
 *  One line only: the mask is a single SVG `<text>` run and SVG text does not
 *  wrap. Returns null if the host is refused (not an element, or under
 *  `data-sl-fx="off"`). */
export function glassText(el: Element): {
  /** Re-cut the mask to the text and the box the host has now. Called for you
   *  on resize, on a text change, and once the webfont has arrived. */
  cut(): void;
  /** Take the mask, the observers and the seated glow away. */
  destroy(): void;
} | null;
