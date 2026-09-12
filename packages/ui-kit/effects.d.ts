/* Type declarations for effects.js.
   Hand-written: the sources are plain JavaScript with JSDoc, and a build step
   to emit these would put a compiler between the kit and a one-file change.
   scripts/types-drift.test.mjs fails if a module's exports and its declarations
   fall out of step. */

/** Arm Tier 1: pointer-driven liquid, finite glitch bursts, animated aurora.
 *  Refuses under high contrast, and under reduced motion unless the caller
 *  takes the derogation. */
export function mount(
  root?: Document | Element,
  options?: {
    /** Animate for a visitor reporting `prefers-reduced-motion: reduce`. A
     *  derogation, not a convenience: it reaches the GLITCH alone, and high
     *  contrast refuses regardless. Take it only with a documented reason. */
    ignoreReducedMotion?: boolean;
    /** How many ambient glitch bursts may run at once. Default 1; never less.
     *  A burst over the ceiling is dropped, never queued. */
    bursts?: number;
  },
): boolean;

/** Arm Tier 2 where WebGPU answers: the pointer as a light source inside the
 *  glass. Resolves false otherwise. */
export function mountGpu(): Promise<boolean>;

/** One finite glitch burst of randomised length, capped at 1500ms. Dropped if
 *  the budget is full, if a kill switch is on, or if the element is detached. */
export function burst(el: Element, options?: { burstMin?: number; burstMax?: number }): void;

/** Burst, wait, burst again — an ambient glitch. Returns a stop function; the
 *  loop also lets itself go when the element leaves the document. */
export function autoBurst(
  el: Element,
  options?: { waitMin?: number; waitMax?: number; burstMin?: number; burstMax?: number },
): () => void;

/** While the pointer is over one element, glitch another. The one path past
 *  the burst budget, bounded by the pointer being there. Returns a stop
 *  function, which also releases the listeners. */
export function hoverBurst(
  hoverEl: Element,
  targetEl: Element,
  options?: { burstMin?: number; burstMax?: number; pauseMin?: number; pauseMax?: number },
): () => void;

/** Decode-scramble a short label, terminal-readout style. Under a kill switch
 *  the final value still lands immediately. */
export function scramble(el: HTMLElement, options?: { duration?: number; tick?: number }): void;

/** Grant this document's single ambient aurora to one element. */
export function grantLive(el: Element): void;

/** Take it back. */
export function revokeLive(el: Element): void;
