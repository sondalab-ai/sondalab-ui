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

// Exported: effects.js's trackLiquid() caller and the shader's own array
// binding must agree on this, or a future bump in one file and not the
// others writes past the declared WGSL array length — the packer does not
// bound the index for you.
export const MAX_RECTS = 8;

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
 * On-screen `.sl-fx-liquid` elements, kept by observation rather than by
 * measuring everything every frame. getBoundingClientRect forces layout, so a
 * full-document querySelectorAll + getBoundingClientRect sweep — done once
 * per rendered frame, sixty times a second — cost one forced reflow per
 * matching element per frame, most of them off-screen and discarded.
 *
 * The live set is NEVER cleared wholesale. An IntersectionObserver redelivers
 * asynchronously, so disconnecting everything and re-observing on every
 * mutation batch (the first version of this function did exactly that) would
 * empty the set ahead of the redelivery — rectCount reads 0 for that stretch,
 * and the field paints nothing. On a framework-rendered page, where the
 * MutationObserver's childList+subtree on document.body fires on *any* DOM
 * change anywhere, that is a recurring, visible flicker to blank, invisible
 * to every test here since nothing in this repo renders a frame. Instead:
 * observe only elements not already observed (tracked in a WeakSet so a
 * removed-and-regarbage-collected element doesn't leak an entry), and drop
 * elements that left the document as they are read, one at a time — never by
 * clearing the whole set.
 * @returns {{rects: () => DOMRect[], stop(): void}}
 */
export function trackLiquid() {
  const onScreen = new Set();
  const observed = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target);
  });
  const scan = () => {
    for (const el of document.querySelectorAll(".sl-fx-liquid")) {
      if (observed.has(el)) continue;
      observed.add(el);
      io.observe(el);
    }
  };
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });
  return {
    rects: () => {
      // Deleting the Set's current entry mid-iteration is well-defined by the
      // spec (ECMA-262 %SetIteratorPrototype%.next / Set-object internal
      // methods: a `for...of` over a Set uses a live iterator keyed to the
      // set's own insertion-ordered internal list, and removing the entry the
      // iterator just yielded does not disturb the entries after it or cause
      // any to be skipped or revisited) — verified against the spec here
      // rather than assumed, since "works today" and "well-defined" are not
      // the same claim. Elements after the MAX_RECTS cutoff are simply left
      // for the next call to check, not scanned early.
      const out = [];
      for (const el of onScreen) {
        if (!el.isConnected) {
          onScreen.delete(el);
          continue;
        }
        out.push(el.getBoundingClientRect());
        if (out.length === MAX_RECTS) break;
      }
      return out;
    },
    stop: () => {
      io.disconnect();
      mo.disconnect();
    },
  };
}

/**
 * Bring the field up, or leave the page exactly as it is.
 * @param {{canvas: HTMLCanvasElement, rects: () => DOMRect[], stopTracking?: () => void, tokens: {accent: string, depth: string}}} opts
 * @returns {Promise<{stop(): void}|null>} null when the GPU path is unavailable
 */
export async function bootField({ canvas, rects, stopTracking, tokens }) {
  // `typeof navigator` first: a consumer server-rendering its page has no
  // navigator at all, and a bare `in` check would throw there rather than
  // degrade. This is also what makes the guard executable in a test.
  if (typeof navigator === "undefined" || !("gpu" in navigator) || !navigator.gpu) return null;

  // Every piece `stop()` touches is declared here, outside the try block, so
  // `stop` itself can be defined once — before anything that can fail — and
  // reused verbatim as the catch's cleanup. Every reference inside it is
  // optional-chained or existence-checked, so calling it after zero, some or
  // all of the setup below ran is always safe: there is exactly one teardown
  // path, not a "happy path stop()" and a separate "boot failed" cleanup that
  // could silently drift apart from each other.
  let gpu;
  let onMove;
  let themeObserver;
  let loop;
  let running = true;
  // Tracks whether THIS handle is the one that set the attribute, so stop()
  // never strips it on a handle that never actually set it (a failed boot
  // calling stop() must not strip a live field's attribute) and so a
  // synchronously-delivered error (gpu.onError is registered before the
  // attribute is set) can't leave it set on an already-dead field, without
  // relying on vgpu's async-delivery premise to hold.
  let attributeSet = false;

  function stop() {
    if (!running) return;
    running = false;
    // GPU teardown is best-effort and individually guarded: this runs from
    // the device-lost and async-error paths too, where a call against the
    // dead device could itself throw, and from the boot catch, where some of
    // these were never created. Either way, the visual restore below must
    // still happen — a lost or never-booted device must degrade, never
    // freeze on a dead frame.
    try {
      loop?.stop();
    } catch {
      /* best-effort: the visual restore below is what actually matters */
    }
    try {
      gpu?.dispose?.();
    } catch {
      /* best-effort: the visual restore below is what actually matters */
    }
    if (onMove) removeEventListener("pointermove", onMove);
    themeObserver?.disconnect();
    stopTracking?.();
    // Optional-chained/guarded rather than assumed: the guard-path tests in
    // scripts/effects-gpu.test.mjs call bootField() with a bare `{}` as
    // `canvas` and no global `document` at all, to exercise the capability
    // and import/init guards without a DOM — exactly the environment this
    // function must also degrade cleanly through, same as the `typeof
    // navigator === "undefined"` check above.
    canvas?.remove?.();
    if (attributeSet && typeof document !== "undefined") {
      document.documentElement.removeAttribute("data-sl-fx-gpu");
    }
  }

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
    // binding — not a hand-packed Float32Array. Every channel starts at zero,
    // not at an opaque-black placeholder: applyTokens() below overwrites
    // accent/depth before any GPU call reads them, so there is no reason for
    // a colour-shaped value to sit here even transiently.
    const look = { accent: [0, 0, 0, 0], depth: [0, 0, 0, 0], time: 0, rectCount: 0 };
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

    // Re-read the hues on theme change, the same contract effects.js honours.
    themeObserver = new MutationObserver(applyTokens);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sl-theme"],
    });

    // Pointer state is normalised to the viewport; zw carries velocity, which
    // is what gives the field its inertia — the whole reason this tier
    // exists. Velocity is per-second, not per-event: a per-event delta
    // (`nx - px`) is event-rate dependent, so a higher-frequency pointer
    // would report a *smaller* speed for the same physical motion — dividing
    // by the wall-clock gap between events fixes that.
    let px = 0.5, py = 0.5, vx = 0, vy = 0;
    let lastMove = 0;
    onMove = function (ev) {
      const now = ev.timeStamp || performance.now();
      // The floor guards a zero dt when two events share a timestamp.
      const dt = Math.max((now - lastMove) / 1000, 1 / 240);
      lastMove = now;
      const nx = ev.clientX / innerWidth;
      const ny = ev.clientY / innerHeight;
      vx = (nx - px) / dt;
      vy = (ny - py) / dt;
      // Cap the flick at 1.0 so the shader's `0.6 + 0.4 * length(pointer.zw)`
      // tops out at exactly 1.0 — the band its own comment claims, not 1.2.
      // A zero-size viewport (innerWidth/innerHeight of 0) makes the deltas
      // above non-finite; zero the velocity rather than letting a NaN reach
      // a uniform.
      const speed = Math.hypot(vx, vy);
      if (!Number.isFinite(speed)) {
        vx = 0;
        vy = 0;
      } else if (speed > 1) {
        vx /= speed;
        vy /= speed;
      }
      px = nx;
      py = ny;
    };
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

      // Velocity decays so the wake keeps moving after the pointer stops. A
      // fresh pointermove event overwrites vx/vy outright before this can
      // meaningfully erode it, so during continuous motion the field reads
      // close to the true current speed; once the pointer stops, this is the
      // only thing still touching vx/vy, and it carries the wake down.
      vx *= 0.92;
      vy *= 0.92;
      pointer[0] = px;
      pointer[1] = py;
      pointer[2] = vx;
      pointer[3] = vy;

      fx.set({ look, rects: rectsUniform, pointer });
    }

    // Validation and WGSL compilation errors are delivered asynchronously and
    // never throw out of effect() or frame() — without this, a shader defect
    // leaves a live handle, the attribute set, the CSS sheen switched off
    // (Tier 2 owns it once data-sl-fx-gpu="on") and nothing painted, with no
    // path back to Tier 1. Registered before the first frame, after stop is
    // defined.
    gpu.onError?.((err) => {
      console.error("[sondalab] GPU effects tier stopped:", err);
      stop();
    });

    // Draw one frame synchronously, then set the attribute — ownership of
    // data-sl-fx-gpu lives entirely in this module now, set the moment the
    // frame that justifies it exists and cleared by the same stop() that
    // removes the canvas, so mountGpu() in effects.js never has to race it:
    // it only reports whether bootField() returned a handle at all. Gated on
    // `running`: gpu.onError was registered above this, so if an error were
    // ever delivered synchronously rather than asynchronously, stop() would
    // already have run by the time execution reaches here, and this must not
    // set the attribute on a field that is already dead.
    frameUniforms();
    vgpu.frame(gpu, (f) => f.pass(surf, fx));
    if (running) {
      document.documentElement.setAttribute("data-sl-fx-gpu", "on");
      attributeSet = true;
    }

    loop = vgpu.frameLoop(gpu, (f) => {
      frameUniforms();
      f.pass(surf, fx);
    });

    // A lost device must degrade to Tier 1, never freeze on a dead frame.
    // `gpu.device` is vgpu's own Device wrapper and exposes no public loss
    // signal (@vgpu/core's Device tracks it only internally, to reject
    // further calls); `gpu.gpu` is the raw GPUDevice, whose `.lost` promise
    // is the standard WebGPU signal and always resolves, never rejects.
    gpu.gpu.lost.then(stop);

    return { stop };
  } catch {
    // One teardown path, not a second hand-rolled one: whatever ran before
    // the throw — nothing, the pointer listener, the theme observer, the
    // frame loop, the attribute — stop() unwinds all of it, guarded piece by
    // piece. The adapter refused, the module failed to resolve (it is an
    // optionalDependency and may simply not be installed), the device was
    // lost during creation, or any later vgpu call threw: the page stays on
    // Tier 1 with no visual break either way.
    stop();
    return null;
  }
}
