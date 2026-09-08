/* @sondalab/ui-kit — effects-gpu.js
   Tier 2: the WebGPU material. What justifies the GPU is that the EDGE is a
   shaded surface rather than a stroke — a signed distance field with a real
   normal, an environment reflection, a specular lobe and chromatic dispersion,
   none of which CSS can express. The liquid's inertia rides along on the same
   pass: the wake keeps moving after the pointer leaves.

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

// Exported: effects.js's trackLiquid() caller and the shader's own array
// bindings must agree on this, or a future bump in one file and not the
// others writes past the declared WGSL array length — the packer does not
// bound the index for you. `rects`, `params` and `glow` are all declared at
// this length in effects-shader.js.
export const MAX_RECTS = 16;

/** Every element the material may draw on. The edge families are the point of
 *  this tier; the liquid is here because its sheen is drawn in the same pass. */
const TRACKED = ".sl-fx-glass, .sl-fx-aurora, .sl-fx-liquid";

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

const TAU = Math.PI * 2;

/** Angular drift of the two CSS keyframe animations, in radians per second, so
 *  a visitor switching tiers never sees the sweep or the orbit change speed.
 *  effects.css: slfx-sweep is 3.2s per revolution, slfx-orbit is 1.1s. */
const SWEEP_RATE = TAU / 3.2;
const ORBIT_RATE = TAU / 1.1;

/**
 * The aurora this element is currently showing, or null. Read from classes,
 * attributes and INLINE style only — never from getComputedStyle, which would
 * force a style flush once per element per frame.
 *
 * Glass and aurora are read separately, because under Tier 2 they are two
 * different phenomena: a metal bezel and an emissive glow. An element carrying
 * both classes gets both. Under Tier 0/1 they necessarily share one conic ring,
 * since a single ::after is all CSS gives — that is a limit of the medium, not
 * a claim that they are the same thing.
 *
 * The four readings and the fraction of the perimeter each occupies are the
 * ones effects.css already fixed, so the two tiers agree about what a given
 * state looks like: static/sweep ~70%, busy ~18%, determinate = the value.
 * @param {Element} el
 * @returns {{state: number, arc: number, spin: number}|null}
 */
function auroraOf(el) {
  const cl = el.classList;
  // A linear aurora is a segment, not a perimeter: an underline, a tab's active
  // bar, an inversion band's top rule. Both Tier 2 phenomena are perimeter
  // shapes, so a linear aurora keeps its CSS gradient at every tier.
  if (!cl.contains("sl-fx-aurora") || cl.contains("sl-fx-aurora--linear")) return null;
  const live = el.getAttribute("data-sl-fx-live");
  if (live === "busy") {
    // The determinate contract is an INLINE --slfx-progress, the same thing
    // effects.css detects with [style*="--slfx-progress"]. Its arc length is
    // the value and it never rotates.
    const raw = el.style.getPropertyValue("--slfx-progress");
    const value = parseFloat(raw);
    if (raw !== "" && Number.isFinite(value)) {
      return { state: 2, arc: Math.max(0, Math.min(1, value)), spin: 0 };
    }
    return { state: 2, arc: 65 / 360, spin: ORBIT_RATE };
  }
  if (live === "on") return { state: 1, arc: 0.7, spin: SWEEP_RATE };
  // A focus ring is static: it marks where focus is, and a travelling arc would
  // read as work in progress instead.
  if (el.matches(":focus-visible, :focus-within")) return { state: 1, arc: 0.7, spin: 0 };
  return null;
}

/**
 * On-screen effect elements, kept by observation rather than by measuring
 * everything every frame. getBoundingClientRect forces layout, so a full-document
 * querySelectorAll + getBoundingClientRect sweep — done once per rendered frame,
 * sixty times a second — cost one forced reflow per matching element per frame,
 * most of them off-screen and discarded.
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
 *
 * WIDER THAN ITS NAME'S ANCESTOR. This began as `trackLiquid` and followed
 * `.sl-fx-liquid` alone, because Tier 2 began as a liquid-only field. The
 * material draws the EDGE, so glass and aurora need geometry too; the export
 * keeps its `{ rects, stop }` shape, and each entry now carries the element's
 * radius and temperament alongside its rect.
 * @returns {{rects: () => {rect: DOMRect, radius: string, metal: number, bend: number, wake: number, aurora: object|null}[], stop(): void}}
 */
export function trackLiquid() {
  const onScreen = new Set();
  const observed = new WeakSet();
  // The computed radius string, read once per element rather than per frame.
  // Refreshed wholesale by refresh() when the theme changes, since a theme can
  // re-parametrise --sl-radius-*.
  const radii = new WeakMap();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target);
  });
  const readRadius = (el) => radii.set(el, getComputedStyle(el).borderTopLeftRadius);
  const scan = () => {
    for (const el of document.querySelectorAll(TRACKED)) {
      if (observed.has(el)) continue;
      observed.add(el);
      readRadius(el);
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
        // The subtree opt-out is a hard requirement and must reach this tier
        // too: an element inside a data-sl-fx="off" region contributes no
        // geometry at all, so the material never draws on it. closest() reads
        // the tree, not style, so it costs no flush.
        if (el.closest('[data-sl-fx="off"]')) continue;
        const cl = el.classList;
        const liquid = cl.contains("sl-fx-liquid");
        const calm = cl.contains("sl-fx-liquid--calm");
        const metal = cl.contains("sl-fx-glass") ? 1 : 0;
        const aurora = auroraOf(el);
        // Nothing to draw: no bezel, no light, no sheen. Skipping frees a slot
        // for an element that does have something to paint.
        if (!metal && !aurora && !liquid) continue;
        out.push({
          rect: el.getBoundingClientRect(),
          radius: radii.get(el) || "0px",
          metal,
          aurora,
          // A card is not a button: the calm variant takes a fraction of the
          // dent, the same relation Tier 1's --slfx-d gives it.
          bend: liquid ? (calm ? 0.3 : 1) : 0.45,
          wake: liquid ? (calm ? 0.35 : 1) : 0,
        });
        if (out.length === MAX_RECTS) break;
      }
      return out;
    },
    /** Re-read every observed element's radius. A theme switch can move
     *  --sl-radius-*, and the cached string would otherwise describe the old
     *  geometry until the element happened to be re-inserted. */
    refresh: () => {
      for (const el of document.querySelectorAll(TRACKED)) if (observed.has(el)) readRadius(el);
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
    const glowUniform = Array.from({ length: MAX_RECTS }, () => [0, 0, 0, 0]);
    const pointer = [0.5, 0.5, 0, 0];

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
      set: { look, rects: rectsUniform, pointer, params: paramsUniform, glow: glowUniform },
    });
    const clock = vgpu.clock(gpu);

    // Reduced motion reaches Tier 2 as well: the metal still renders — it is
    // material, not motion — but the halo stops wandering and the pointer stops
    // bending the ring. Read live, not sampled at boot, so a visitor who turns
    // the preference on mid-session is honoured without a reload.
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

    // Pointer state is normalised to the viewport; zw carries velocity, which
    // is what gives the wake its inertia. Velocity is per-second, not
    // per-event: a per-event delta (`nx - px`) is event-rate dependent, so a
    // higher-frequency pointer would report a *smaller* speed for the same
    // physical motion — dividing by the wall-clock gap between events fixes
    // that.
    //
    // documentElement.clientWidth, not innerWidth: innerWidth includes a
    // classic scrollbar and the fixed canvas at inset:0 does not, so
    // normalising by innerWidth drifts the whole field to the left of where
    // the elements actually are — invisible on a diffuse blob, up to a
    // scrollbar's width of visible detachment on a band that has to sit
    // exactly on a 1px border.
    let px = 0.5, py = 0.5, vx = 0, vy = 0;
    let lastMove = 0;
    onMove = function (ev) {
      const now = ev.timeStamp || performance.now();
      // The floor guards a zero dt when two events share a timestamp.
      const dt = Math.max((now - lastMove) / 1000, 1 / 240);
      lastMove = now;
      const view = viewport();
      const nx = ev.clientX / view[0];
      const ny = ev.clientY / view[1];
      vx = (nx - px) / dt;
      vy = (ny - py) / dt;
      // Cap the flick at 1.0 so the shader's `0.6 + 0.4 * length(pointer.zw)`
      // tops out at exactly 1.0 — the band its own comment claims, not 1.2.
      // A zero-size viewport makes the deltas above non-finite; zero the
      // velocity rather than letting a NaN reach a uniform.
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
      for (let i = 0; i < MAX_RECTS; i++) {
        const r = rectsUniform[i];
        const q = paramsUniform[i];
        const a = glowUniform[i];
        const e = list[i];
        if (!e) {
          r[0] = 0; r[1] = 0; r[2] = 0; r[3] = 0;
          q[0] = 0; q[1] = 0; q[2] = 0; q[3] = 0;
          a[0] = 0; a[1] = 0; a[2] = 0; a[3] = 0;
          continue;
        }
        r[0] = e.rect.left / view[0];
        r[1] = e.rect.top / view[1];
        r[2] = e.rect.width / view[0];
        r[3] = e.rect.height / view[1];
        q[0] = radiusPx(e.radius, e.rect);
        q[1] = e.bend;
        q[2] = e.metal;
        q[3] = e.wake;
        a[0] = e.aurora ? e.aurora.state : 0;
        a[1] = e.aurora ? e.aurora.arc : 0;
        a[2] = e.aurora ? e.aurora.spin : 0;
        a[3] = 0;
      }
      look.time = clock.time;
      look.rectCount = list.length;
      look.res = view;

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

      fx.set({ look, rects: rectsUniform, pointer, params: paramsUniform, glow: glowUniform });
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
