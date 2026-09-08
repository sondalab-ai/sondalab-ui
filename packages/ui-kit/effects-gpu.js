/* @sondalab/ui-kit — effects-gpu.js
   Tier 2: the WebGPU liquid field. What justifies the GPU here and nowhere else
   is INERTIA — the field keeps moving after the pointer leaves, and the sheen is
   advected rather than repositioned per frame. Glitch, aurora and glass are at
   full quality in CSS and have no GPU tier at all.

   The fallback is the default state: this module is dynamically imported, and if
   anything at all refuses, the page stays exactly on Tier 1. navigator.gpu alone
   is not enough — the adapter can refuse and the device can be lost — so the
   boot is guarded twice, the way sondalab-site/src/lib/crt-surface.ts does it. */

import { SHADER } from "./effects-shader.js";

const MAX_RECTS = 8;

/**
 * Bring the field up, or leave the page exactly as it is.
 * @param {{canvas: HTMLCanvasElement, rects: () => DOMRect[], tokens: {accent: string, depth: string}}} opts
 * @returns {Promise<{stop(): void}|null>} null when the GPU path is unavailable
 */
export async function bootField({ canvas, rects, tokens }) {
  // `typeof navigator` first: a consumer server-rendering its page has no
  // navigator at all, and a bare `in` check would throw there rather than
  // degrade. This is also what makes the guard executable in a test.
  if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) return null;
  let gpu;
  try {
    gpu = await (await import("vgpu")).init();
  } catch {
    return null;
  }
  // The device answered. Task 13 replaces this whole function body with the
  // real field; until then the boot is proven and the page stays on Tier 1,
  // because returning null is what mountGpu() reads as "unavailable".
  void [canvas, rects, tokens, SHADER, MAX_RECTS];
  return null;
}
