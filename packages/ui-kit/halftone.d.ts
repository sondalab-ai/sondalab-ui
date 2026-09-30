export interface HalftoneHandle {
  /** Settles once the canvases present at the call have loaded; a failed picture is skipped. */
  ready: Promise<void>;
  /** Cancel the frame and disconnect every observer. Canvases keep their last frame. */
  stop(): void;
}

/**
 * Arm every `canvas[data-sl-halftone]` under `root` (`data-sl-src` required;
 * `data-sl-grid` 16–256, default 96; `data-sl-seed` optional;
 * `data-sl-ink="mono"` keeps one ink where the light theme's spectrum would
 * colour the dots) and follow
 * canvases added later. `mount()` calls this; call it yourself only without `mount()`.
 */
export declare function halftone(root?: Document | Element): HalftoneHandle;
