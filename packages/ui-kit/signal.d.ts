export interface SignalHandle {
  /** Disconnect every observer and listener. Canvases keep their last frame. */
  stop(): void;
}

/**
 * Draw every `canvas[data-sl-signal]` under `root` as a dithered ramp in 3px
 * cells, in the canvas's own computed `color` on a transparent ground
 * (`data-sl-signal-level` 0..1, default 1, is how much of the width the ramp
 * fills). Follows canvases added later, resizes, theme changes and forced
 * colours (nothing is drawn there). It never animates.
 */
export declare function mountSignals(root?: Document | Element): SignalHandle;
