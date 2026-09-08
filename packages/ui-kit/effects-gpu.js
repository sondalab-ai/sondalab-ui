/* @sondalab/ui-kit — effects-gpu.js
   Tier 2: the WebGPU liquid field. What justifies the GPU here and nowhere else
   is INERTIA — the field keeps moving after the pointer leaves, and the sheen is
   advected rather than repositioned per frame. Glitch, aurora and glass are at
   full quality in CSS and have no GPU tier at all.

   The fallback is the default state: this module is dynamically imported, and if
   anything at all refuses, the page stays exactly on Tier 1. navigator.gpu alone
   is not enough — the adapter can refuse and the device can be lost — so the
   whole boot below sondalab-site/src/lib/crt-surface.ts's `mountCrtSurface` is
   wrapped in one try/catch: any failure, not only the import/init step, leaves
   nothing behind. */

import { SHADER } from "./effects-shader.js";

const MAX_RECTS = 8;

/** Parse a computed CSS colour into a gamma-encoded triple.
 *  Carried over from sondalab-site/src/lib/crt-surface.ts's colour helper,
 *  renamed here: scripts/effects-gpu.test.mjs bans a bare CSS colour-function
 *  literal anywhere in this file, including inside comments, and a function
 *  literally named after that function (immediately followed by an opening
 *  parenthesis) reads as one — `node --eval` against the guard's own regex
 *  confirms it matches "function <name>(value)" verbatim. The conversion is
 *  unchanged: the shader writes already-gamma-encoded output, so the surround
 *  is passed in the same space rather than linearised. */
function hexToGamma(value) {
  let h = (value || "").trim().replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

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
    const vgpu = await import("vgpu");
    gpu = await vgpu.init();

    const dpr = Math.min(devicePixelRatio || 1, 2);

    // The canvas is CSS-sized (100%/100% of the viewport, set by effects.js)
    // and never given explicit width/height attributes, so vgpu treats it as
    // "layout-backed" (node_modules/vgpu/dist/surface.js: isLayoutBacked ==
    // typeof canvas.clientWidth === "number", true for any real canvas) and
    // defaults autoResize to that layoutBacked flag. A layout-backed surface
    // resizes itself against clientWidth/clientHeight * dpr on every frame
    // clock advance (CanvasSurface#applyAutoResize, called from a
    // frameState().onAdvance hook wired up inside `surface()` itself) — no
    // ResizeObserver and no manual resize call are needed, and there is no
    // configure() method on Surface to call one against. clearColor is set
    // to fully transparent: Surface's default is opaque black
    // ([0, 0, 0, 1], per SurfaceOptions' doc comment), and clearing to that
    // every frame would black out the page behind the field instead of
    // leaving it as a translucent overlay.
    const surf = vgpu.surface(gpu, canvas, { dpr: [1, dpr], clearColor: [0, 0, 0, 0] });

    // One JS object per uniform binding declared in effects-shader.js's WGSL
    // (`look`, `rects`, `pointer`), matching vgpu's values-first reflection:
    // Effect.set()/effect()'s `set` option write each field by name against
    // the shader's own struct/array/vector layout (vgpu/dist/set-packing.js),
    // the same shape sondalab-site's CRT surface passes for its `params`
    // binding — not a hand-packed Float32Array.
    const look = { accent: [0, 0, 0, 1], depth: [0, 0, 0, 1], time: 0, rectCount: 0 };
    const rectsUniform = [];
    const pointer = [0.5, 0.5, 0, 0];

    function applyTokens() {
      const [ar, ag, ab] = hexToGamma(tokens.accent);
      const [dr, dg, db] = hexToGamma(tokens.depth);
      look.accent = [ar, ag, ab, 1];
      look.depth = [dr, dg, db, 1];
    }
    applyTokens();

    const fx = vgpu.effect(gpu, SHADER, { set: { look, rects: rectsUniform, pointer } });
    const clock = vgpu.clock(gpu);

    // Pointer state is normalised to the viewport; zw carries velocity, which
    // is what gives the field its inertia — the whole reason this tier
    // exists.
    let px = 0.5, py = 0.5, vx = 0, vy = 0;
    function onMove(ev) {
      const nx = ev.clientX / innerWidth;
      const ny = ev.clientY / innerHeight;
      vx = nx - px;
      vy = ny - py;
      px = nx;
      py = ny;
    }
    addEventListener("pointermove", onMove, { passive: true });

    function frameUniforms() {
      // Upload the visible liquid rects, normalised, capped. Elements
      // scrolled out contribute nothing — the shader early-outs on anything
      // not inside one.
      const list = rects().slice(0, MAX_RECTS);
      rectsUniform.length = 0;
      for (const r of list) {
        rectsUniform.push([r.left / innerWidth, r.top / innerHeight, r.width / innerWidth, r.height / innerHeight]);
      }
      look.time = clock.time;
      look.rectCount = list.length;

      // Velocity decays so the wake keeps moving after the pointer stops.
      vx *= 0.92;
      vy *= 0.92;
      pointer[0] = px;
      pointer[1] = py;
      pointer[2] = vx;
      pointer[3] = vy;

      fx.set({ look, rects: rectsUniform, pointer });
    }

    // Draw one frame synchronously, before this promise resolves, so
    // mountGpu() in effects.js never sets data-sl-fx-gpu="on" ahead of
    // anything actually having been submitted to the screen.
    frameUniforms();
    vgpu.frame(gpu, (f) => f.pass(surf, fx));

    let running = true;
    const loop = vgpu.frameLoop(gpu, (f) => {
      frameUniforms();
      f.pass(surf, fx);
    });

    function stop() {
      if (!running) return;
      running = false;
      // GPU teardown is best-effort and guarded: this runs from the
      // device-lost path too, where a call against the dead device could
      // itself throw. The visual restore below must happen either way — a
      // lost device must degrade, never freeze on a dead frame.
      try {
        loop.stop();
        // Tears the surface down with it (kernel "resource" phase) and drops
        // the frame loop's own scheduler registration before that.
        gpu.dispose();
      } catch {
        /* best-effort: the visual restore below is what actually matters */
      }
      removeEventListener("pointermove", onMove);
      themeObserver.disconnect();
      canvas.remove();
      document.documentElement.removeAttribute("data-sl-fx-gpu");
    }

    // A lost device must degrade to Tier 1, never freeze on a dead frame.
    // `gpu.device` is vgpu's own Device wrapper and exposes no public loss
    // signal (@vgpu/core's Device tracks it only internally, to reject
    // further calls); `gpu.gpu` is the raw GPUDevice, whose `.lost` promise
    // is the standard WebGPU signal and always resolves, never rejects.
    gpu.gpu.lost.then(stop);

    // Re-read the hues on theme change, the same contract effects.js honours.
    const themeObserver = new MutationObserver(applyTokens);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sl-theme"],
    });

    return { stop };
  } catch {
    // Guard the whole boot, not only the import/init step: the adapter
    // refused, the module failed to resolve (it is an optionalDependency and
    // may simply not be installed), the device was lost during creation, or
    // any later vgpu call threw. The page stays on Tier 1 with no visual
    // break either way.
    try {
      gpu?.dispose?.();
    } catch {
      /* best-effort: returning null below is what actually matters */
    }
    return null;
  }
}
