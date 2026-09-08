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

/** The turbulence filter the liquid sheen references. Injected once. */
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
    <filter id="slfx-liquid" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="2" seed="7" result="n">
        <animate attributeName="baseFrequency" dur="9s" repeatCount="indefinite"
                 values="0.012 0.028; 0.019 0.017; 0.012 0.028" />
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" />
    </filter>`;
  document.body.appendChild(svg);
}

/* ── liquid: one delegated listener, one shared rAF ──────────────────────────
   Pointer coordinates are written as custom properties on the hovered element
   only. Elements outside the viewport never receive a write. */
let pending = null;
let rafId = 0;

function flush() {
  rafId = 0;
  if (!pending) return;
  const { el, x, y, w, h } = pending;
  pending = null;
  el.style.setProperty("--slfx-px", `${((x / w) * 100).toFixed(1)}%`);
  el.style.setProperty("--slfx-py", `${((y / h) * 100).toFixed(1)}%`);
  el.style.setProperty("--slfx-d", "1");
  // Per-corner bulge: the near corners soften, the far ones stay crisp. The
  // box never grows — only its radii change, so nothing reflows around it.
  const corners = [[0, 0], [w, 0], [w, h], [0, h]];
  corners.forEach(([cx, cy], i) => {
    const d = Math.hypot(x - cx, y - cy) / Math.hypot(w, h);
    el.style.setProperty(`--slfx-c${i}`, `${(10 * (1 - d)).toFixed(1)}px`);
  });
}

function onPointerMove(ev) {
  const el = ev.target instanceof Element ? ev.target.closest(".sl-fx-liquid") : null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  pending = { el, x: ev.clientX - r.left, y: ev.clientY - r.top, w: r.width, h: r.height };
  if (!rafId) rafId = requestAnimationFrame(flush);
}

function onPointerLeave(ev) {
  const el = ev.target instanceof Element ? ev.target.closest(".sl-fx-liquid") : null;
  if (!el) return;
  el.style.setProperty("--slfx-d", "0");
  for (let i = 0; i < 4; i++) el.style.setProperty(`--slfx-c${i}`, "0px");
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
  new MutationObserver(() => readTokens(html)).observe(html, {
    attributes: true,
    attributeFilter: ["data-sl-theme"],
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
  // where it exists because of a real defect.
  if (!armed || burstActive || !el?.isConnected) return;
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
 * glitch, and safe under reduced motion because it is a text change, not motion.
 * Reads its target from data-num so repeats stay correct.
 * @param {HTMLElement} el
 */
export function scramble(el, { duration = 520, tick = 45 } = {}) {
  if (!el || el.dataset.scrambling === "1") return;
  const final = el.dataset.num ?? el.textContent ?? "";
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
 * Tier 2 — the WebGPU liquid field. A documented no-op until Slice 3 lands, so
 * consumers can call it today and get the honest answer rather than a crash.
 * @returns {Promise<boolean>} whether the GPU tier came up
 */
export async function mountGpu() {
  return false;
}
