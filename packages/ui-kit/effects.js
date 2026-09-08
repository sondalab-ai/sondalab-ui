/* @sondalab/ui-kit — effects.js
   Hand-authored Tier 1 driver for effects.css: the liquid's deformation, the
   glitch's timing, the aurora's one-per-document grant, and the hand-off to
   the GPU chrome.
   Contract: docs/specs/2026-09-08-effects-layer-design.md

   Importing this module does nothing. mount() is explicit, which is what makes
   the IDE opt-in possible: a Theia surface that never calls it pays nothing.

   COLOUR: sl-audit reads CSS only, so a literal in this file would pass the gate
   while breaking the design-system contract. Every hue is read from a token with
   getComputedStyle and re-read on theme change. scripts/effects-js.test.mjs
   enforces the absence of literals. */

const REDUCE = "(prefers-reduced-motion: reduce)";
const CAP_MS = 1500;                      // hard ceiling on any single burst
const rand = (a, b) => a + Math.random() * (b - a);

/* ── coordinator state (spec §Decision 5) ─────────────────────────────────────
   One ambient aurora and one glitch burst at a time. Busy auroras are exempt:
   they are bound to real work and several can legitimately run at once. */
let liveEl = null;
let burstActive = false;
let armed = false;

/** The document's live token values, re-read whenever the theme changes.
 *  Nothing in Tier 1 reads these — the CSS owns every colour it paints. They
 *  exist for the GPU tier, whose shader needs real values as uniforms and
 *  cannot resolve a custom property. Kept here so there is exactly one place
 *  that reads a hue from the token layer, and one observer keeping it live. */
const tokens = { accent: "", depth: "", text: "", canvas: "" };

function readTokens(root = document.documentElement) {
  const cs = getComputedStyle(root);
  tokens.accent = cs.getPropertyValue("--sl-accent-default").trim();
  tokens.depth = cs.getPropertyValue("--sl-accent-depth").trim();
  tokens.text = cs.getPropertyValue("--sl-text-primary").trim();
  tokens.canvas = cs.getPropertyValue("--sl-bg-canvas").trim();
}

/* ── liquid: the element itself deforms ─────────────────────────────────────
   The reference (libraries.dev/metal, useMetalBend) bends the element with an
   SVG feDisplacementMap on the element ITSELF, and so does this: the host's
   own fill, border, text and pseudo-elements all move together, so a crisp
   ring never sits rigid around a deforming box. The filter is on for exactly
   as long as the pointer shapes the element and its spring is settling, and
   is removed afterwards — non-destructive: nothing about the element changes
   once the pointer has gone. (Filtered text is rasterised with greyscale
   antialiasing; the kit's surfaces already set that, and it is what the
   reference does.)

   THE DENT. A Gaussian push AWAY from the pointer: points between the pointer
   and the edge sample from beyond the edge, so the edge recedes toward the
   pointer, and text near the pointer flees it. The map covers the whole
   filter region and is re-rasterised each frame at a quarter of the
   resolution — the reference's own approach. A static map moved under the
   pointer with feImage's x/y was tried first and abandoned: Chrome placed the
   raster unpredictably and read the area it covered as a constant offset,
   translating everything under it. A map that IS the region has nothing to
   place and no outside.

   The chrome tier evaluates the same Gaussian (effects-shader.js, dentAt) so
   the ring bends where the surface does; liquidState() is how it learns
   which element, how deep and how wide. */

const NS = "http://www.w3.org/2000/svg";
const MAP_RES = 0.25;                 // map texels per CSS px
let liquidDisplacementEl = null;
let liquidImageEl = null;
let liquidFilterEl = null;
let liquidMapCanvas = null;
let liquidMap = null;                 // ImageData for the live element's region
let liquidRegion = { x: 0, y: 0, w: 0, h: 0 };

function injectFilterDefs() {
  if (document.getElementById("slfx-defs")) return;
  const svg = document.createElementNS(NS, "svg");
  svg.id = "slfx-defs";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  // sRGB on EVERY primitive, not only on the filter: the default is
  // linearRGB, under which the map's 128 decodes to 0.22 and the element
  // slides by a third of the scale — and the filter element's own attribute
  // does not reach a feImage's raster. The region is set per live element,
  // in px (setLiquidLive).
  const srgb = 'color-interpolation-filters="sRGB"';
  svg.innerHTML = `
    <filter id="slfx-liquid" filterUnits="userSpaceOnUse" x="0" y="0" width="1" height="1" ${srgb}>
      <feImage result="map" preserveAspectRatio="none" x="0" y="0" width="1" height="1" ${srgb} />
      <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" ${srgb} />
    </filter>`;
  document.body.appendChild(svg);
  liquidDisplacementEl = svg.querySelector("feDisplacementMap");
  liquidImageEl = svg.querySelector("feImage");
  liquidFilterEl = svg.querySelector("filter");
}

/** Size the filter region and the map to the live element's box plus room
 *  for the overshoot's outward bulge, in the element's own user space (its
 *  border box, for a CSS filter on an HTML element). */
function sizeDentRegion(width, height, depth) {
  const m = Math.ceil(depth * 1.6 + 2);
  liquidRegion = { x: -m, y: -m, w: Math.ceil(width) + 2 * m, h: Math.ceil(height) + 2 * m };
  const { x, y, w, h } = liquidRegion;
  for (const el of [liquidFilterEl, liquidImageEl]) {
    if (!el) continue;
    el.setAttribute("x", String(x));
    el.setAttribute("y", String(y));
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
  }
  if (!liquidMapCanvas) liquidMapCanvas = document.createElement("canvas");
  const tw = Math.max(2, Math.round(w * MAP_RES));
  const th = Math.max(2, Math.round(h * MAP_RES));
  liquidMapCanvas.width = tw;
  liquidMapCanvas.height = th;
  liquidMap = liquidMapCanvas.getContext("2d").createImageData(tw, th);
}

/** Rasterise the push for this frame: 128 everywhere, the Gaussian within
 *  three sigma of the dent's centre. R and G hold the x and y push,
 *  normalised so the peak (one sigma out) is exactly ±127. */
function renderDentMap(cx, cy, sigma) {
  if (!liquidMap || !liquidImageEl) return;
  const { x: rx, y: ry } = liquidRegion;
  const tw = liquidMap.width;
  const th = liquidMap.height;
  const d = liquidMap.data;
  const reach = sigma * 3;
  const x0 = Math.max(0, Math.floor((cx - reach - rx) * MAP_RES));
  const x1 = Math.min(tw - 1, Math.ceil((cx + reach - rx) * MAP_RES));
  const y0 = Math.max(0, Math.floor((cy - reach - ry) * MAP_RES));
  const y1 = Math.min(th - 1, Math.ceil((cy + reach - ry) * MAP_RES));
  for (let i = 0; i < d.length; i += 4) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 0; d[i + 3] = 255; }
  for (let ty = y0; ty <= y1; ty++) {
    const vy = (ry + (ty + 0.5) / MAP_RES - cy) / sigma;
    for (let tx = x0; tx <= x1; tx++) {
      const vx = (rx + (tx + 0.5) / MAP_RES - cx) / sigma;
      const g = Math.exp(-0.5 * (vx * vx + vy * vy)) / 0.60653;
      const i = (ty * tw + tx) * 4;
      d[i] = Math.round(128 + 127 * Math.max(-1, Math.min(1, vx * g)));
      d[i + 1] = Math.round(128 + 127 * Math.max(-1, Math.min(1, vy * g)));
    }
  }
  liquidMapCanvas.getContext("2d").putImageData(liquidMap, 0, 0);
  liquidImageEl.setAttribute("href", liquidMapCanvas.toDataURL("image/png"));
}

/* Critically underdamped: the shape overshoots and settles rather than easing
   to a stop. Stiffness and damping are tuned so a flick reads as elastic and
   a slow drag as viscous — the same spring, different input. Tuned against
   the rendered page, not against a guess. */
const LIQUID_K = 170;
const LIQUID_DAMP = 14;
const LIQUID_SETTLE_EPS = 0.002;
/** Dent radius and depth, from the element's own size: sigma is a share of
 *  its short side, clamped so a keycap still dents visibly and a card does
 *  not swallow the pointer; depth is a share of sigma. A calm element takes
 *  a fraction of the depth — a card is not a button. */
const DENT_SIGMA_K = 0.42;
const DENT_SIGMA_MIN = 12;
const DENT_SIGMA_MAX = 30;
const DENT_DEPTH_K = 0.30;
const DENT_CALM = 0.4;

let amp = 0, ampV = 0, target = 0;
let lagX = 0, lagY = 0;              // CSS px, within the live element's own box
let pointerX = 0, pointerY = 0;
let liquidLiveEl = null;
let liquidSigma = 0;
let liquidDepth = 0;
let liquidRafId = 0;
let liquidPrevT = 0;

/** What the pointer is currently shaping, for the chrome tier: the element,
 *  its dent depth right now (signed, CSS px), its dent radius, and the dent's
 *  centre in viewport px — the LAGGED centre, which trails the pointer, so
 *  the ring and the surface dent in the same place. */
function liquidState() {
  if (!liquidLiveEl) return { el: null, depth: 0, sigma: 0, x: 0, y: 0 };
  const r = liquidLiveEl.getBoundingClientRect();
  return { el: liquidLiveEl, depth: liquidDepth * amp, sigma: liquidSigma, x: r.left + lagX, y: r.top + lagY };
}

function setLiquidLive(el) {
  if (liquidLiveEl === el) return;
  if (liquidLiveEl) {
    liquidLiveEl.classList.remove("is-liquid-live");
  }
  liquidLiveEl = el;
  if (!el) return;
  const r = el.getBoundingClientRect();
  liquidSigma = Math.max(DENT_SIGMA_MIN, Math.min(DENT_SIGMA_MAX, Math.min(r.width, r.height) * DENT_SIGMA_K));
  liquidDepth = liquidSigma * DENT_DEPTH_K * (el.classList.contains("sl-fx-liquid--calm") ? DENT_CALM : 1);
  sizeDentRegion(r.width, r.height, liquidDepth);
  el.classList.add("is-liquid-live");
}

function integrateLiquid(now) {
  const dt = Math.min((now - liquidPrevT) / 1000 || 0, 1 / 30);
  liquidPrevT = now;
  const a = LIQUID_K * (target - amp) - LIQUID_DAMP * ampV;
  ampV += a * dt;
  amp += ampV * dt;
  // The dent chases the pointer with its own lag, so it arrives after the
  // cursor rather than under it — that trail IS the mass.
  lagX += (pointerX - lagX) * Math.min(dt * 11, 1);
  lagY += (pointerY - lagY) * Math.min(dt * 11, 1);

  if (liquidLiveEl && liquidDisplacementEl) {
    renderDentMap(lagX, lagY, liquidSigma);
    // feDisplacementMap samples at scale·(map − 0.5), and the map's peak is
    // 0.5 out, so a scale of twice the depth moves the edge by exactly the
    // depth. Left unclamped: a negative scale is valid SVG and IS the release
    // overshoot — the surface bulging back past rest before it settles.
    liquidDisplacementEl.setAttribute("scale", (2 * liquidDepth * amp).toFixed(2));
  }

  const settled = target === 0 && Math.abs(amp) < LIQUID_SETTLE_EPS && Math.abs(ampV) < LIQUID_SETTLE_EPS;
  if (settled) {
    liquidRafId = 0;
    amp = 0; ampV = 0;
    if (liquidDisplacementEl) liquidDisplacementEl.setAttribute("scale", "0");
    setLiquidLive(null);
    return; // idle page costs nothing: the loop does not reschedule itself
  }
  liquidRafId = requestAnimationFrame(integrateLiquid);
}

function ensureLiquidLoop() {
  if (liquidRafId) return;
  liquidPrevT = performance.now();
  liquidRafId = requestAnimationFrame(integrateLiquid);
}

function onPointerMove(ev) {
  const el = ev.target instanceof Element ? ev.target.closest(".sl-fx-liquid") : null;
  if (!el || el.closest('[data-sl-fx="off"]')) return;
  const r = el.getBoundingClientRect();
  pointerX = ev.clientX - r.left;
  pointerY = ev.clientY - r.top;
  if (liquidLiveEl !== el) {
    // A fresh target starts its lag from its own entry point, not the
    // previous element's leftover coordinates.
    lagX = pointerX;
    lagY = pointerY;
    setLiquidLive(el);
  }
  target = 1;
  ensureLiquidLoop();
}

function onPointerLeave(ev) {
  const el = ev.target instanceof Element ? ev.target.closest(".sl-fx-liquid") : null;
  if (!el || el !== liquidLiveEl) return;
  target = 0;
  ensureLiquidLoop(); // keep the loop running so the overshoot plays out
}

/* ── glitch ──────────────────────────────────────────────────────────────────
   Re-roll the two ghost channels for this burst: each gets its own pulse
   duration and a negative phase delay (so they start mid-cycle and drift
   apart), plus a shared amplitude multiplier. */
function randomizeGhosts(el) {
  const dur = () => `${(0.11 + Math.random() * 0.12).toFixed(3)}s`;
  const phase = () => `-${(Math.random() * 0.22).toFixed(3)}s`;
  el.style.setProperty("--slfx-gda", dur());
  el.style.setProperty("--slfx-gdb", dur());
  el.style.setProperty("--slfx-gdj", dur());
  el.style.setProperty("--slfx-gpha", phase());
  el.style.setProperty("--slfx-gphb", phase());
  el.style.setProperty("--slfx-gmul", (0.75 + Math.random() * 0.7).toFixed(2));
  for (const s of el.querySelectorAll(".sl-fx-glitch__shard")) {
    const px = (5 + Math.random() * 13) * (Math.random() < 0.5 ? -1 : 1);
    s.style.setProperty("--slfx-sx", `${px.toFixed(1)}px`);
  }
}

/** The conditions under which no effect may run, re-read at call time rather
 *  than sampled at mount: a visitor can switch theme, or turn on reduced
 *  motion, long after the page loaded. */
function suppressed() {
  if (typeof document === "undefined") return true;
  if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") return true;
  return window.matchMedia(REDUCE).matches;
}

/* ── public API ──────────────────────────────────────────────────────────────*/

/**
 * Arm Tier 1: pointer-driven liquid, finite glitch bursts, animated aurora.
 * Refuses under reduced motion and under high contrast — Tier 0 is the default
 * state and stays correct on its own.
 * @param {Document|Element} root
 * @returns {boolean} whether Tier 1 was armed
 */
export function mount(root = document) {
  if (armed) return true;
  if (typeof window === "undefined") return false;
  if (window.matchMedia(REDUCE).matches) return false;
  const html = document.documentElement;
  if (html.getAttribute("data-sl-theme") === "high-contrast") return false;

  readTokens(html);
  // data-sl-theme and style both matter: a theme switch changes the former,
  // a per-product accent override (root.style.setProperty("--sl-accent-..."))
  // changes only the latter. The GPU tier reads the shared `tokens` object,
  // and this is the one observer that keeps it live.
  new MutationObserver(() => readTokens(html)).observe(html, {
    attributes: true,
    attributeFilter: ["data-sl-theme", "style"],
  });

  injectFilterDefs();

  // One delegated listener for the whole subtree, not one per element.
  root.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("pointerleave", onPointerLeave, { capture: true, passive: true });

  html.setAttribute("data-sl-fx", "on");
  armed = true;
  return true;
}

/**
 * One finite glitch burst of randomised length. A burst requested while another
 * runs is dropped, not queued: a queue produces a stutter train, which reads as
 * breakage rather than as signal. A detached element is refused.
 * @param {Element} el an element carrying .sl-fx-glitch, still in the document
 */
export function burst(el, { burstMin = 200, burstMax = 500 } = {}) {
  // isConnected: a caller may take the element out of the document between the
  // event and the burst, and a timer toggling a class on a detached node would
  // otherwise run for nothing. The guard is carried over from the prior art,
  // where it exists because of a real defect. blocked is read into a local
  // rather than called inline so the guard clause stays a single paren-free
  // condition — scripts/effects-js.test.mjs locates it by that shape.
  const blocked = suppressed();
  if (!armed || burstActive || blocked || !el?.isConnected) return;
  burstActive = true;
  randomizeGhosts(el);
  el.classList.add("is-glitching");
  setTimeout(() => {
    el.classList.remove("is-glitching");
    burstActive = false;
  }, Math.min(CAP_MS, rand(burstMin, burstMax)));
}

/**
 * Decode-scramble a short label: cycle random glyphs and lock the real
 * characters in left to right, terminal-readout style. Distinct from the ghost
 * glitch. Under high contrast or reduced motion the cycling is suppressed, but
 * the final value still lands immediately — dropping it would replace absent
 * motion with absent information, the same failure the aurora fix closes.
 * Reads its target from data-num so repeats stay correct.
 * @param {HTMLElement} el
 */
export function scramble(el, { duration = 520, tick = 45 } = {}) {
  if (!el || el.dataset.scrambling === "1") return;
  const final = el.dataset.num ?? el.textContent ?? "";
  if (suppressed()) {
    el.textContent = final;
    return;
  }
  const n = final.length;
  const glyphs = "0123456789#/\\<>";
  el.dataset.scrambling = "1";
  const start = performance.now();
  const iv = setInterval(() => {
    const t = performance.now() - start;
    if (t >= duration) {
      clearInterval(iv);
      el.textContent = final;
      delete el.dataset.scrambling;
      return;
    }
    const locked = Math.floor((t / duration) * n);
    let out = "";
    for (let i = 0; i < n; i++) out += i < locked ? final[i] : glyphs[(Math.random() * glyphs.length) | 0];
    el.textContent = out;
  }, tick);
}

/**
 * Grant the one ambient aurora. Most recent request wins; the previous element
 * falls back to its resting ring. Busy auroras do not go through here — they are
 * bound to real work and are exempt from the cap.
 * @param {Element} el
 */
export function grantLive(el) {
  if (liveEl && liveEl !== el) liveEl.removeAttribute("data-sl-fx-live");
  liveEl = el;
  el.setAttribute("data-sl-fx-live", "on");
}

/** Revoke the ambient aurora from `el` if it currently holds it. */
export function revokeLive(el) {
  if (liveEl !== el) return;
  el.removeAttribute("data-sl-fx-live");
  liveEl = null;
}

/**
 * Tier 2 — the WebGPU chrome on the glass family: a hairline reflecting a
 * moving environment, a wandering halo, the cursor's reflection, and the
 * liquid's dent carried into the ring. Additive: everything
 * already works without it, and it is only attached once the device has
 * actually answered. Refuses under high contrast, the same way mount() does —
 * a CSS kill switch cannot silence a canvas, so the refusal has to live here.
 * @returns {Promise<boolean>} whether the GPU tier came up
 */
export async function mountGpu() {
  if (!armed) return false;
  // Re-read at call time rather than relying on mount()'s own guard: a visitor
  // can switch to high contrast between mount() and this call, and `armed`
  // stays true once set. bootField() additionally tears the field down if the
  // switch happens while it is already live.
  if (typeof document === "undefined") return false;
  if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") return false;

  // Dynamic import is the one path in this tier that can reject at the
  // caller rather than degrade through bootField()'s own guard: vgpu is an
  // optionalDependency, and a consumer without it (or a bundler that fails
  // to resolve it) throws here, before bootField ever runs.
  let mod;
  try {
    mod = await import("./effects-gpu.js");
  } catch {
    return false;
  }
  const { bootField, trackEdges } = mod;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // Below --sl-z-overlay so the sticky translucent header stays above the
  // chrome. Composited normally, NOT with plus-lighter: an additive canvas
  // can only brighten, and chrome needs values below the ground it sits on as
  // much as above it — the dark bands are what make the bright bands read as
  // a reflection. The chrome writes alpha only on the hairline and in the
  // halo, so nothing else on the page is touched, and no text is ever
  // painted over.
  //
  // ABSOLUTE, NOT FIXED, and re-topped to the scroll offset every frame by
  // bootField(). A fixed overlay is repainted from the main thread while the
  // page itself scrolls on the compositor, so during a scroll the bands are
  // composited at the offset they were MEASURED at while the elements have
  // already moved — bands visibly detached from their elements by a hundred
  // pixels or more, on any ordinary wheel scroll. An absolutely positioned
  // canvas is scrolled by the compositor along with the content it is drawing
  // on, so the two stay glued together whether or not the main thread has
  // committed; what lags instead is the canvas's own coverage window, and the
  // worst case is a band missing at the leading edge for a frame rather than a
  // band in the wrong place. `top`, `width` and `height` are all written in
  // pixels by bootField() every frame — a percentage size would resolve against
  // whatever containing block the consumer's page happens to give this canvas,
  // and `body { position: relative }` would make that the body's full content
  // height.
  // Sized once here as well, so the surface is not created against a 0x0 box;
  // bootField() keeps it in step from the first frame onward.
  const root = document.documentElement;
  canvas.style.cssText =
    `position:absolute;left:0;top:0;width:${Math.max(root.clientWidth, 1)}px;` +
    `height:${Math.max(root.clientHeight, 1)}px;pointer-events:none;z-index:1`;
  document.body.appendChild(canvas);

  // Kept by observation, not by measuring every glass element on the page
  // every rendered frame — see trackEdges()'s own doc comment. bootField()
  // is handed the read side, the shape refresh and the teardown, so its own
  // stop() also stops this: nothing is left observing once the field is torn
  // down. liquidState is how the chrome learns where the surface is dented.
  const tracker = trackEdges({ liquid: liquidState });

  const handle = await bootField({
    canvas,
    rects: tracker.rects,
    refresh: tracker.refresh,
    stopTracking: tracker.stop,
    tokens,
  });
  if (!handle) {
    tracker.stop();
    canvas.remove();
    return false;
  }
  // data-sl-fx-gpu="on" is set inside bootField() itself, right after the
  // first frame is actually on screen — not here, and not before. This
  // function only reports whether that happened.
  return true;
}
