/* @sondalab/ui-kit — effects.js
   Hand-authored Tier 1 driver for effects.css.
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

/** The turbulence + goo filter the liquid skin references. Injected once.
 *  scale starts at 0 — a resting element is undeformed; the spring below
 *  drives it. The blur-then-alpha-contrast pass (feGaussianBlur into
 *  feColorMatrix, composited back over the raw displacement) is what makes
 *  an edge read as a liquid meniscus rather than a wobbling, noisy rectangle. */
function injectFilterDefs() {
  if (document.getElementById("slfx-defs")) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = "slfx-defs";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.innerHTML = `
    <filter id="slfx-liquid" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.008 0.014" numOctaves="2" seed="7" result="n">
        <animate attributeName="baseFrequency" dur="11s" repeatCount="indefinite"
                 values="0.008 0.014; 0.013 0.009; 0.008 0.014" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feGaussianBlur in="d" stdDeviation="6" result="b" />
      <feColorMatrix in="b" type="matrix" result="goo"
        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" />
      <feComposite in="d" in2="goo" operator="atop" />
    </filter>`;
  document.body.appendChild(svg);
  liquidDisplacementEl = svg.querySelector("feDisplacementMap");
}

/** The host's own background, captured once so the skin can take it over.
 *  Read, never invented — this file declares no colour.
 *
 *  Timing is load-bearing in two ways. First: effects.css only makes the
 *  host transparent when --slfx-ground is actually SET
 *  (`[style*="--slfx-ground"]`), specifically so capturing late reads the
 *  host's own real background rather than the transparent it would
 *  otherwise have become. Second: most components.css controls transition
 *  `background`, so a plain getComputedStyle() read right after a theme or
 *  accent change (see recaptureGrounds) can catch the interpolation
 *  mid-flight rather than the target colour — the transition is suppressed
 *  for one synchronous style flush so the read always lands on the real
 *  target. Idempotent, so a node matched by more than one call site below is
 *  a no-op after the first. */
function captureGround(el) {
  if (el.style.getPropertyValue("--slfx-ground")) return;
  const prevTransition = el.style.transition;
  el.style.transition = "none";
  void el.offsetHeight; // force the recalc before reading, not after
  const ground = getComputedStyle(el).backgroundColor;
  el.style.transition = prevTransition;
  el.style.setProperty("--slfx-ground", ground);
}

/** Re-reads every liquid element's ground after something that can change
 *  the resolved colour — a theme or accent switch. --slfx-ground is a frozen
 *  literal, not a live var() reference (an SVG filter can't resolve a custom
 *  property), so nothing keeps it in sync on its own. Clearing before
 *  re-capturing (rather than overwriting) is what makes the read correct:
 *  clearing drops the CSS gate above, which makes the host briefly opaque
 *  again at its OWN cascaded colour — the very thing captureGround needs to
 *  read — and both steps run in the same synchronous pass, before the
 *  browser paints, so nothing is visibly transparent in between. */
function recaptureGrounds(root) {
  const els = root.querySelectorAll(".sl-fx-liquid");
  for (const el of els) el.style.removeProperty("--slfx-ground");
  for (const el of els) captureGround(el);
}

/* ── liquid: one delegated listener, one shared spring ───────────────────────
   Only one .sl-fx-liquid element deforms at a time. The filter above is a
   single shared SVG resource, so its feDisplacementMap `scale` is necessarily
   shared too — driving it from every hovered element independently would
   distort every OTHER liquid element on the page in lockstep with whichever
   one the pointer actually touched. effects.js instead tracks one "live"
   element and toggles the class effects.css scopes the filter to; the spring
   itself stays the single set of module-level values below, matching the
   shared-rAF pattern used everywhere in this file.

   Critically underdamped: the shape overshoots and settles rather than easing
   to a stop. Stiffness and damping are tuned so a flick reads as elastic and
   a slow drag as viscous — the same spring, different input. Tuned against
   the rendered page (see task-16-report.md), not against a guess. */
const LIQUID_K = 170;
const LIQUID_DAMP = 14;
const LIQUID_SCALE_MULT = 26;
const LIQUID_SETTLE_EPS = 0.002;

let amp = 0, ampV = 0, target = 0;
let lagX = 50, lagY = 50;        // percent, within the live element's own box
let pointerXPct = 50, pointerYPct = 50;
let liquidLiveEl = null;
let liquidDisplacementEl = null;
let liquidRafId = 0;
let liquidPrevT = 0;

function setLiquidLive(el) {
  if (liquidLiveEl === el) return;
  if (liquidLiveEl) liquidLiveEl.classList.remove("is-liquid-live");
  liquidLiveEl = el;
  if (liquidLiveEl) liquidLiveEl.classList.add("is-liquid-live");
}

function integrateLiquid(now) {
  const dt = Math.min((now - liquidPrevT) / 1000 || 0, 1 / 30);
  liquidPrevT = now;
  const a = LIQUID_K * (target - amp) - LIQUID_DAMP * ampV;
  ampV += a * dt;
  amp += ampV * dt;
  // The centre chases the pointer with its own lag, so the deformation
  // arrives after the cursor rather than under it — that trail IS the mass.
  lagX += (pointerXPct - lagX) * Math.min(dt * 9, 1);
  lagY += (pointerYPct - lagY) * Math.min(dt * 9, 1);

  if (liquidLiveEl) {
    liquidLiveEl.style.setProperty("--slfx-px", `${lagX.toFixed(1)}%`);
    liquidLiveEl.style.setProperty("--slfx-py", `${lagY.toFixed(1)}%`);
    liquidLiveEl.style.setProperty("--slfx-d", Math.max(0, Math.min(1, amp)).toFixed(3));
  }
  // feDisplacementMap's scale is an SVG attribute, not a CSS property.
  // Left unclamped, unlike --slfx-d below: a negative scale is valid SVG (it
  // mirrors the displacement rather than erasing it), and clamping it at 0
  // would silently flatten the release overshoot — the spring crossing back
  // past rest is exactly the elastic motion this tier exists to show.
  if (liquidDisplacementEl) liquidDisplacementEl.setAttribute("scale", (amp * LIQUID_SCALE_MULT).toFixed(2));

  const settled = target === 0 && Math.abs(amp) < LIQUID_SETTLE_EPS && Math.abs(ampV) < LIQUID_SETTLE_EPS;
  if (settled) {
    liquidRafId = 0;
    amp = 0; ampV = 0;
    if (liquidLiveEl) liquidLiveEl.style.setProperty("--slfx-d", "0");
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
  if (!el) return;
  const r = el.getBoundingClientRect();
  pointerXPct = ((ev.clientX - r.left) / r.width) * 100;
  pointerYPct = ((ev.clientY - r.top) / r.height) * 100;
  if (liquidLiveEl !== el) {
    // A fresh target starts its lag from its own entry point, not the
    // previous element's leftover coordinates — those are meaningless in a
    // different box, and would read as a jump-cut trail rather than a clean
    // arrival.
    lagX = pointerXPct;
    lagY = pointerYPct;
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
  // changes only the latter, and either can change what --slfx-ground should
  // now hold — a captured background literal, unlike the tokens above, is
  // never a live var() reference (an SVG filter cannot resolve a custom
  // property), so nothing keeps it in sync without this.
  //
  // recaptureGrounds forces one synchronous style flush per liquid element,
  // so it only runs when readTokens actually observed one of the four hues
  // change — not on every `style` mutation. A consumer that writes something
  // else to <html>'s inline style on scroll or resize (a --vh custom
  // property, a sticky-header offset) would otherwise turn every such event
  // into a reflow storm across the whole page. This is a heuristic, not a
  // guarantee: a consumer that remaps --slc-accent directly without moving
  // --sl-accent-default would slip past it — better than never recapturing
  // at all, not a substitute for a real dependency graph.
  new MutationObserver(() => {
    const prev = { ...tokens };
    readTokens(html);
    if (Object.keys(tokens).some((k) => tokens[k] !== prev[k])) recaptureGrounds(document);
  }).observe(html, {
    attributes: true,
    attributeFilter: ["data-sl-theme", "style"],
  });

  injectFilterDefs();

  // Capture every existing liquid element's ground before the attribute
  // below makes it transparent, then keep capturing for elements a framework
  // inserts afterwards — the observer fires at a microtask checkpoint, ahead
  // of the browser's next paint, so it still runs before that element's own
  // background would otherwise read back as transparent. A node that gains
  // the class after insertion (rather than arriving with it) is not covered;
  // that is a real limitation, not exercised by anything this kit ships.
  const captureGrounds = (scope) => {
    for (const el of scope.querySelectorAll(".sl-fx-liquid")) captureGround(el);
  };
  captureGrounds(root instanceof Document ? document : root);
  new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(".sl-fx-liquid")) captureGround(node);
        captureGrounds(node);
      }
    }
  }).observe(root, { childList: true, subtree: true });

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
 * Tier 2 — the WebGPU liquid field. Additive: everything already works without
 * it, and it is only attached once the device has actually answered.
 * @returns {Promise<boolean>} whether the GPU tier came up
 */
export async function mountGpu() {
  if (!armed) return false;

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
  const { bootField, trackLiquid } = mod;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  // Below --sl-z-overlay so the sticky translucent header stays above the field.
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;mix-blend-mode:plus-lighter";
  document.body.appendChild(canvas);

  // Kept by observation, not by measuring every .sl-fx-liquid on the page
  // every rendered frame — see trackLiquid()'s own doc comment. bootField()
  // is handed both the read side and the teardown, so its own stop() also
  // stops this: nothing is left observing once the field is torn down.
  const tracker = trackLiquid();

  const handle = await bootField({ canvas, rects: tracker.rects, stopTracking: tracker.stop, tokens });
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
