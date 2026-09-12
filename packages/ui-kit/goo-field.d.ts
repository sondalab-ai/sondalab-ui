/* Type declarations for goo-field.js. See effects.d.ts for why these are
   hand-written. */

/** Give a container one shared gooey field: its marked members read as one
 *  substance, welding where they come within `--slfx-goo-weld` of each other.
 *  Form controls and links are refused membership. Returns null if the
 *  container is not eligible.
 *
 *  A container marked `.sl-fx-goo--drift` also wanders: its members move on
 *  their own while the field is on screen, and the field re-derives its
 *  silhouettes per frame to follow them. Refused under
 *  `prefers-reduced-motion: reduce`, where the field is laid out and welded
 *  but still. */
export function gooField(container: Element): {
  /** Re-derive every silhouette. Pass true for a TRUE colour read, which hands
   *  each welded member its own paint back before reading it. */
  measure(restore?: boolean): void;
  /** Remove the field and everything it wrote onto a member. */
  destroy(): void;
} | null;
