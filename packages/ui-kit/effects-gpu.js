/* @sondalab/ui-kit — effects-gpu.js
   Tier 2: the WebGPU chrome. What justifies the GPU is that the glass EDGE is
   a mirror rather than a stroke: a hairline reflecting a moving environment,
   a halo wandering around it, a reflection where the cursor is, and a swell
   that follows the liquid's own gooey skin — none of which a conic
   gradient can express. Only the glass family is drawn here; the aurora is
   CSS at every tier and the liquid is a skin under the content (effects.js).

   The CSS ring is the genuine fallback, not a lesser version of the intent: a
   browser without WebGPU, a visitor under reduced motion and a visitor in high
   contrast all get the conic hairline, and it stays correct on its own.

   The fallback is the default state: this module is dynamically imported, and if
   anything at all refuses, the page stays exactly on Tier 1. navigator.gpu alone
   is not enough — the adapter can refuse and the device can be lost — so the
   whole boot below sondalab-site/src/lib/crt-surface.ts's `mountCrtSurface` is
   wrapped in one try/catch: any failure, not only the import/init step, leaves
   nothing behind. */

import { SHADER } from "./effects-shader.js";

// Exported: the uniform arrays built here and every `array<vec4f, N>` in
// effects-shader.js (rects, params, kinds), plus the shader's two "no
// element" sentinels (`16u`), must all agree on this number — the packer
// does not bound the index for you, and a bump in one file and not the
// others writes past the declared WGSL array length or turns a sentinel into
// a valid index. scripts/effects-gpu.test.mjs extracts the shader and checks
// every one of them against this constant.
export const MAX_RECTS = 16;

/** Every element the chrome draws on or reflects into. The chrome itself is
 *  drawn on glass only — the aurora is CSS at every tier, and a liquid
 *  element without glass has no edge to draw — but every effect element is
 *  a surface the chrome's environment can fall onto, the way the reference
 *  reflects its ring onto the controls beside it. */
const TRACKED = ".sl-fx-glass, .sl-fx-aurora, .sl-fx-liquid";

/** Whether the aurora currently holds this element's edge. While attention
 *  lives on an element the edge belongs to the light, and the chrome stands
 *  down there — the canvas sits above the DOM, so it would otherwise paint
 *  over the arc. Read from attributes and pseudo-class state only, never from
 *  getComputedStyle, which would force a style flush per element per frame. */
function auroraLit(el) {
  if (!el.classList.contains("sl-fx-aurora")) return false;
  const live = el.getAttribute("data-sl-fx-live");
  return live === "on" || live === "busy" || el.matches(":focus-visible, :focus-within");
}

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

/** The element's own corner radius, in CSS pixels, resolved against the rect it
 *  currently occupies. The RAW computed string is what gets cached, never a
 *  pixel value: a `%` or a `clamp()` radius resolves differently the moment the
 *  element is re-laid-out, and a cached pixel figure would go stale on every
 *  reflow that does not happen to fire a resize event. Parsing the string
 *  against the rect this frame already measured costs nothing.
 *  @param {string} raw computed borderTopLeftRadius, e.g. "6px" or "50%"
 *  @param {{width: number, height: number}} rect the element's current box
 *  @returns {number} radius in CSS pixels, clamped to what the box can hold */
function radiusPx(raw, rect) {
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return 0;
  const shortest = Math.min(rect.width, rect.height);
  // A percentage radius is per-axis in CSS; the shader's SDF takes one scalar,
  // so the shorter axis is used — which is exactly right for the pill and the
  // circle, the two shapes a percentage radius is actually written for.
  const px = raw.trimEnd().endsWith("%") ? (v / 100) * shortest : v;
  return Math.max(0, Math.min(px, shortest / 2));
}

/**
 * On-screen glass elements, kept by observation rather than by measuring
 * everything every frame. getBoundingClientRect forces layout, so a full-document
 * querySelectorAll + getBoundingClientRect sweep — done once per rendered frame,
 * sixty times a second — cost one forced reflow per matching element per frame,
 * most of them off-screen and discarded.
 *
 * The live set is NEVER cleared wholesale. An IntersectionObserver redelivers
 * asynchronously, so disconnecting everything and re-observing on every
 * mutation batch would empty the set ahead of the redelivery — rectCount reads
 * 0 for that stretch, and the field paints nothing. Instead: observe only
 * elements not already observed (tracked in a WeakSet), and drop elements that
 * left the document as they are read, one at a time.
 *
 * @param {{liquid?: () => {el: Element|null, radius: number, blend: number, x: number, y: number}}} opts
 *   `liquid` reports which element the pointer is currently shaping, the
 *   radius of the drop its skin draws, where the drop sits and how wide the
 *   goo's neck is — the SAME circle effects.js welds onto the box, so the
 *   chrome follows exactly the silhouette the skin has.
 * @returns {{rects: () => {rect: DOMRect, radius: string, border: string, metal: number, pane: number, blend: number, dropR: number, dropX: number, dropY: number}[], refresh(): void, stop(): void}}
 */
export function trackEdges({ liquid } = {}) {
  const onScreen = new Set();
  const observed = new WeakSet();
  // The computed radius and border-width strings, read once per element rather
  // than per frame. Refreshed wholesale by refresh() when the theme changes,
  // since a theme can re-parametrise --sl-radius-*.
  const shape = new WeakMap();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target);
  });
  const readShape = (el) => {
    const cs = getComputedStyle(el);
    shape.set(el, { radius: cs.borderTopLeftRadius, border: cs.borderTopWidth });
  };
  const scan = () => {
    for (const el of document.querySelectorAll(TRACKED)) {
      if (observed.has(el)) continue;
      observed.add(el);
      readShape(el);
      io.observe(el);
    }
  };
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });
  return {
    rects: () => {
      // Deleting the Set's current entry mid-iteration is well-defined by the
      // spec (a `for...of` over a Set uses a live iterator keyed to the set's
      // own insertion-ordered internal list, and removing the entry the
      // iterator just yielded does not disturb the entries after it).
      const out = [];
      const live = liquid ? liquid() : null;
      for (const el of onScreen) {
        if (!el.isConnected) {
          // The observer holds a strong reference the Set's delete does not
          // release: on a long-lived surface that re-renders, every removed
          // element would otherwise stay observed until teardown.
          io.unobserve(el);
          onScreen.delete(el);
          continue;
        }
        // The subtree opt-out is a hard requirement and must reach this tier
        // too: an element inside a data-sl-fx="off" region contributes no
        // geometry at all, so the chrome never draws on it. closest() reads
        // the tree, not style, so it costs no flush.
        if (el.closest('[data-sl-fx="off"]')) continue;
        // While the aurora holds an element's edge the chrome stands down
        // there, but the element still catches its neighbours' reflections.
        const metal = el.classList.contains("sl-fx-glass") && !auroraLit(el) ? 1 : 0;
        // A pane's cursor reflection reaches further and disperses
        // (effects-shader.js, PANE_REACH / DISPERSE).
        const pane = el.classList.contains("sl-fx-glass--pane") ? 1 : 0;
        const sh = shape.get(el) || { radius: "0px", border: "0px" };
        const swelling = live && live.el === el;
        out.push({
          rect: el.getBoundingClientRect(),
          radius: sh.radius,
          border: sh.border,
          metal,
          pane,
          blend: swelling ? live.blend : 0,
          dropR: swelling ? live.radius : 0,
          dropX: swelling ? live.x : 0,
          dropY: swelling ? live.y : 0,
        });
        if (out.length === MAX_RECTS) break;
      }
      return out;
    },
    /** Re-read every observed element's radius and border. A theme switch can
     *  move --sl-radius-*, and the cached string would otherwise describe the
     *  old geometry until the element happened to be re-inserted. */
    refresh: () => {
      for (const el of document.querySelectorAll(TRACKED)) if (observed.has(el)) readShape(el);
    },
    stop: () => {
      io.disconnect();
      mo.disconnect();
    },
  };
}

/**
 * Bring the material up, or leave the page exactly as it is.
 * @param {{canvas: HTMLCanvasElement, rects: () => object[], refresh?: () => void, stopTracking?: () => void, tokens: {accent: string, depth: string, text: string, canvas: string}}} opts
 *   `rects` is trackEdges().rects, or anything with the same shape.
 * @returns {Promise<{stop(): void}|null>} null when the GPU path is unavailable
 */
export async function bootField({ canvas, rects, refresh, stopTracking, tokens }) {
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
  let onLeave;
  let themeObserver;
  let motionQuery;
  let onMotion;
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
    if (onLeave && typeof document !== "undefined") document.documentElement.removeEventListener("pointerleave", onLeave);
    if (motionQuery && onMotion) motionQuery.removeEventListener?.("change", onMotion);
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
    // leaving it as a translucent overlay. The context's alphaMode defaults
    // to "premultiplied" (surface.js), which is why the fragment stage writes
    // premultiplied output and no blend state is declared on the effect.
    const surf = vgpu.surface(gpu, canvas, { dpr: [1, dpr], clearColor: [0, 0, 0, 0] });

    // One JS object per uniform binding declared in effects-shader.js's WGSL
    // (`look`, `rects`, `pointer`, `params`), matching vgpu's values-first
    // reflection: Effect.set()/effect()'s `set` option write each field by name
    // against the shader's own struct/array/vector layout
    // (vgpu/dist/set-packing.js), the same shape sondalab-site's CRT surface
    // passes for its `params` binding — not a hand-packed Float32Array. Every
    // channel starts at zero, not at an opaque-black placeholder: applyTokens()
    // below overwrites the four hues before any GPU call reads them, so there
    // is no reason for a colour-shaped value to sit here even transiently.
    const look = {
      accent: [0, 0, 0, 0],
      depth: [0, 0, 0, 0],
      sheen: [0, 0, 0, 0],
      ground: [0, 0, 0, 0],
      flags: [1, 0, 0, 0],
      res: [1, 1],
      time: 0,
      rectCount: 0,
    };
    // Fixed length, mutated in place: the WGSL arrays are declared at
    // MAX_RECTS, and handing the packer a short array leaves whatever the
    // previous frame wrote in the tail. Zeroed slots past rectCount are
    // skipped by the shader's own loop bound, but they are still zeroed rather
    // than stale, so a slot that comes back into use never flashes an old rect.
    const rectsUniform = Array.from({ length: MAX_RECTS }, () => [0, 0, 0, 0]);
    const paramsUniform = Array.from({ length: MAX_RECTS }, () => [0, 0, 0, 0]);
    // x: 1 when the element carries the chrome, 0 when it only catches
    // reflections of its neighbours' chrome. y: 1 on a glass pane.
    const kindsUniform = Array.from({ length: MAX_RECTS }, () => [0, 0, 0, 0]);
    // xy: position, normalised. z: the pointer's PRESENCE, eased toward 1
    // while it is on the page and toward 0 after it left — the cursor
    // reflection must neither sit at a stale spot nor pop in and out; a
    // reflection arrives the way light does. ~160ms time constant.
    const pointer = [0.5, 0.5, 0, 0];
    let presence = 0;
    let presenceT = -1;
    const PRESENCE_TAU = 0.16;
    // xy: where the liquid's drop is centred, normalised — the lagged point
    // effects.js's own skin places it at, not the raw pointer.
    const drop = [0, 0, 0, 0];

    function applyTokens() {
      const [ar, ag, ab] = hexToGamma(tokens.accent);
      const [dr, dg, db] = hexToGamma(tokens.depth);
      const [sr, sg, sb] = hexToGamma(tokens.text);
      const [gr, gg, gb] = hexToGamma(tokens.canvas);
      look.accent = [ar, ag, ab, 1];
      look.depth = [dr, dg, db, 1];
      look.sheen = [sr, sg, sb, 1];
      look.ground = [gr, gg, gb, 1];
    }
    applyTokens();

    const fx = vgpu.effect(gpu, SHADER, {
      set: { look, rects: rectsUniform, pointer, params: paramsUniform, drop, kinds: kindsUniform },
    });
    const clock = vgpu.clock(gpu);

    // Reduced motion reaches Tier 2 as well: the chrome still renders — it is
    // material, not motion — but its environment stops sliding, the halo stops
    // wandering and the liquid stops swelling it. Read live, not sampled
    // at boot, so a visitor who turns the preference on mid-session is
    // honoured without a reload.
    motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    look.flags = [motionQuery.matches ? 0 : 1, 0, 0, 0];
    onMotion = () => { look.flags = [motionQuery.matches ? 0 : 1, 0, 0, 0]; };
    motionQuery.addEventListener?.("change", onMotion);

    // Re-read the hues on theme change, the same contract effects.js honours,
    // and on a per-product accent override, which lands on <html>'s inline
    // style rather than on the theme attribute. effects.js's own observer is
    // registered first (in mount(), before mountGpu() can run) and refreshes
    // the shared `tokens` object, and MutationObserver callbacks run in
    // registration order — so by the time this one reads them they are current.
    //
    // High contrast is a hard kill switch and it must reach this tier: the CSS
    // switch cannot silence a canvas, so the field tears itself down outright,
    // which also restores the CSS ring by removing data-sl-fx-gpu.
    themeObserver = new MutationObserver(() => {
      if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") {
        stop();
        return;
      }
      applyTokens();
      refresh?.();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-sl-theme", "style"],
    });

    // Pointer state is normalised to the viewport. documentElement.clientWidth,
    // not innerWidth: innerWidth includes a classic scrollbar and the canvas
    // does not, so normalising by innerWidth drifts the whole field to the
    // left of where the elements actually are — up to a scrollbar's width of
    // visible detachment on a hairline that has to sit on a 1px border.
    let px = 0.5, py = 0.5, onPage = 0;
    onMove = function (ev) {
      const view = viewport();
      px = ev.clientX / view[0];
      py = ev.clientY / view[1];
      onPage = 1;
    };
    onLeave = function () { onPage = 0; };
    addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave, { passive: true });

    /** The canvas's own box, in CSS pixels. Floored at 1 so a zero-size
     *  viewport (a hidden tab on some engines) can never divide by zero. */
    function viewport() {
      const el = document.documentElement;
      return [Math.max(el.clientWidth, 1), Math.max(el.clientHeight, 1)];
    }

    // The canvas is absolutely positioned in the document (see effects.js) and
    // rides down with the page as it scrolls, so it has to be re-topped to the
    // current scroll offset once per frame. Written only when it actually
    // changed: an unchanged style write is still a style invalidation.
    //
    // FLOOR, never round. An absolutely positioned element contributes to the
    // document's scrollable overflow, and at maximum scroll the canvas's bottom
    // lands exactly on scrollHeight — there is no slack. scrollY is fractional
    // on a trackpad, at a fractional dpr and under page zoom, so rounding can
    // put the canvas half a pixel PAST the bottom, which grows scrollHeight,
    // which raises the maximum scroll, which grows it again: a creep where the
    // bottom of a long page never settles. Flooring keeps top <= scrollY, so
    // top + height <= scrollHeight always.
    //
    // Size in pixels, not at 100%. A percentage would resolve against the
    // containing block, and `body { position: relative }` — a very common
    // declaration — makes that the body's own content box: on a 7200px page at
    // dpr 2 the backing texture would be 14400px, past WebGPU's 8192 limit, and
    // the surface would fail. It would fail SAFELY (onError -> stop() -> Tier
    // 1) but invisibly, so the size is stated outright instead.
    let canvasTop = -1;
    let canvasW = -1;
    let canvasH = -1;
    function followViewport(view) {
      const y = Math.floor(scrollY);
      if (y !== canvasTop) {
        canvasTop = y;
        canvas.style.top = `${y}px`;
      }
      if (view[0] !== canvasW || view[1] !== canvasH) {
        canvasW = view[0];
        canvasH = view[1];
        canvas.style.width = `${canvasW}px`;
        canvas.style.height = `${canvasH}px`;
      }
    }

    function frameUniforms() {
      const view = viewport();
      // Upload the visible elements, normalised, capped. Elements scrolled out
      // contribute nothing — the shader early-outs on anything whose band the
      // pixel is not near.
      const list = rects().slice(0, MAX_RECTS);
      drop[0] = 0; drop[1] = 0;
      for (let i = 0; i < MAX_RECTS; i++) {
        const r = rectsUniform[i];
        const q = paramsUniform[i];
        const k = kindsUniform[i];
        const e = list[i];
        if (!e) {
          r[0] = 0; r[1] = 0; r[2] = 0; r[3] = 0;
          q[0] = 0; q[1] = 0; q[2] = 0; q[3] = 0;
          k[0] = 0; k[1] = 0; k[2] = 0; k[3] = 0;
          continue;
        }
        k[0] = e.metal || 0;
        k[1] = e.pane || 0;
        r[0] = e.rect.left / view[0];
        r[1] = e.rect.top / view[1];
        r[2] = e.rect.width / view[0];
        r[3] = e.rect.height / view[1];
        q[0] = radiusPx(e.radius, e.rect);
        q[1] = Math.max(parseFloat(e.border) || 0, 0);
        q[2] = e.blend || 0;
        q[3] = e.dropR || 0;
        if (q[3] !== 0) {
          drop[0] = e.dropX / view[0];
          drop[1] = e.dropY / view[1];
        }
      }
      look.time = clock.time;
      look.rectCount = list.length;
      look.res = view;

      const dt = presenceT < 0 ? 0 : Math.min(Math.max(clock.time - presenceT, 0), 0.05);
      presenceT = clock.time;
      presence += (onPage - presence) * (1 - Math.exp(-dt / PRESENCE_TAU));
      pointer[0] = px;
      pointer[1] = py;
      pointer[2] = presence;
      pointer[3] = 0;

      fx.set({ look, rects: rectsUniform, pointer, params: paramsUniform, drop, kinds: kindsUniform });
      // After the reads above, never before: rects() forces layout, and moving
      // the canvas first would make that a second forced layout per frame.
      followViewport(view);
    }

    // Validation and WGSL compilation errors are delivered asynchronously and
    // never throw out of effect() or frame() — without this, a shader defect
    // leaves a live handle, the attribute set, the CSS ring switched off
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
    // optional peer dependency and may simply not be installed), the device
    // was lost during creation, or any later vgpu call threw: the page stays
    // on Tier 1 with no visual break either way.
    stop();
    return null;
  }
}
