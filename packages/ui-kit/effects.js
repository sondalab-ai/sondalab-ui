/* @sondalab/ui-kit — effects.js
   Hand-authored Tier 1 driver for effects.css: the liquid's silhouette, the
   glitch's timing, the aurora's one-per-document grant, and the hand-off to
   the GPU chrome.
   Contract: docs/specs/2026-09-08-effects-layer-design.md

   Importing this module does nothing. mount() is explicit, which is what makes
   the IDE opt-in possible: a Theia surface that never calls it pays nothing.

   COLOUR: sl-audit reads CSS only, so a literal in this file would pass the gate
   while breaking the design-system contract. Every hue is read from a token with
   getComputedStyle and re-read on theme change. scripts/effects-js.test.mjs
   enforces the absence of literals. */

import { cornerPx, roundedRectPath, GOO_CONTRAST, GOO_INTERCEPT } from "./geom.js";

const REDUCE = "(prefers-reduced-motion: reduce)";
const CAP_MS = 1500;                      // hard ceiling on any single burst
const rand = (a, b) => a + Math.random() * (b - a);

/* ── coordinator state (spec §Decision 5) ─────────────────────────────────────
   One ambient aurora and one glitch burst at a time. Busy auroras are exempt:
   they are bound to real work and several can legitimately run at once. */
let liveEl = null;
let armed = false;

/** How many glitch bursts may run at once, and how many are running.
 *
 *  The budget was a single boolean until 2026-09-12, when the only consumer
 *  was the showcase and one burst at a time was plainly right there. A real
 *  page can want more: sondalab.eu runs an ambient burst on its hero claim,
 *  another on each interlude marker and a hover burst on every product row,
 *  and with a ceiling of one most of them are simply dropped — the effect
 *  thins out rather than reading as restraint.
 *
 *  So the ceiling is the consumer's, and the DEFAULT IS STILL ONE: a surface
 *  that says nothing behaves exactly as before, and raising it is a decision
 *  someone made on purpose. A burst over the ceiling is still dropped, never
 *  queued — a queue produces a stutter train, which reads as breakage. */
let burstBudget = 1;
let burstsRunning = 0;

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

/* ── liquid: the silhouette goes gooey ──────────────────────────────────────
   The reference (libraries.dev/gooey, liquid-gooey) never filters the UI: a
   SILHOUETTE layer below the content carries the goo — one plain shape per
   item, run through blur + alpha-contrast so touching pieces merge with a
   rounded neck — and "your real DOM rides crisp on top". Its Metal entry does
   the same by default (metal-fx v2 `applyTo: "ring"`: the bend is a vector
   outline; "button content and glow stay rigid"). The displacement filter
   this replaced was a lens: it refracted the glyphs and re-rasterised the
   element, which is the text distortion and the pixelated edge the owner saw.

   So the liquid here is a shape, not a filter over pixels. effects.js keeps
   ONE hidden <svg class="sl-fx-liquid__skin"> and, while the pointer shapes
   an element, parents it into that element at z-index -2: above the host's
   own background and border (a negative z-index child paints over both, and
   under the content — the aurora's bloom already relies on this), below the
   text. The skin draws the host's silhouette — its rounded box, with the
   radii read from its own computed style — plus a DROP: a circle whose
   centre sits just inside the outline at the point nearest the pointer, so
   it protrudes by a few pixels. Box and drop go through the goo filter
   (Gaussian blur, then an alpha slope of 18 about 0.5 — the reference's own
   pair), which welds the drop to the box with a soft neck; the crisp box is
   drawn again unfiltered on top of that, so the goo can only ADD the swell
   and never rounds a corner the component declared. A second filter turns
   the merged alpha into paint: a flood of the host's own background inside
   it, and a band one border-width wide in the host's own border colour along
   its outline, so the ring bends with the swell. Both colours are the host's
   computed values, re-read every frame — hover and active states are the
   host's, and the skin follows them. Meanwhile the host's own border is
   hidden by a transparent border-image (effects.css), never by border-color:
   the computed border colour stays the truth for the skin to read.

   Nothing inside the element is ever filtered, the host's border-radius is
   never written, and the skin is removed the moment the spring settles. */

const NS = "http://www.w3.org/2000/svg";
/** What the pointer may shape. The gooey belongs to a ROUND silhouette:
 *  welded onto the long side of a text button the drop reads as a blister on
 *  a box, and the owner said so. The gate is an explicit modifier written in
 *  the markup — `--drop` for a round icon-only button (the full swell),
 *  and nothing else — never a measured radius: a
 *  geometric heuristic misfires the moment a component re-parametrises its
 *  own --sl-radius-*, and not breaking under that is a promise this layer
 *  has made twice. A bare .sl-fx-liquid is inert at this tier. */
const LIQUID_HOSTS = ".sl-fx-liquid.sl-fx-liquid--drop";
/** The goo: blur sigma and alpha slope. liquid-gooey's defaults are 6 and
 *  18; the sigma is smaller here because the swell is a few pixels and its
 *  neck has to stay in proportion — "molto leggero". The slope itself is
 *  geom.js's: one house goo, shared with the field family, whose weld
 *  arithmetic is derived from the same pair. */
const GOO_BLUR = 4;
/** The chrome's smooth-union radius (effects-shader.js, `smin`) that matches
 *  this goo's neck; passed to the GPU tier so the two silhouettes agree. */
let skin = null;
let skinParts = null;

function buildSkin() {
  if (skin) return;
  skin = document.createElementNS(NS, "svg");
  skin.setAttribute("class", "sl-fx-liquid__skin");
  skin.setAttribute("aria-hidden", "true");
  // sRGB on both filters: under the default linearRGB the alpha slope would
  // be applied to a gamma-decoded alpha, moving the goo's edge.
  const srgb = 'color-interpolation-filters="sRGB"';
  // Shapes are drawn in currentColor — only their ALPHA is used: the second
  // filter floods the merged silhouette with the host's own colours.
  skin.innerHTML = `
    <defs>
      <filter id="slfx-goo" filterUnits="userSpaceOnUse" ${srgb}>
        <feGaussianBlur in="SourceGraphic" stdDeviation="${GOO_BLUR}" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${GOO_CONTRAST} ${GOO_INTERCEPT}" />
      </filter>
      <filter id="slfx-skin" filterUnits="userSpaceOnUse" ${srgb}>
        <feMorphology in="SourceAlpha" operator="erode" radius="1" result="inner" />
        <feComposite in="SourceAlpha" in2="inner" operator="out" result="band" />
        <feFlood result="fill-colour" />
        <feComposite in="fill-colour" in2="SourceAlpha" operator="in" result="fill" />
        <feFlood result="ring-colour" />
        <feComposite in="ring-colour" in2="band" operator="in" result="ring" />
        <feMerge><feMergeNode in="fill" /><feMergeNode in="ring" /></feMerge>
      </filter>
    </defs>
    <g filter="url(#slfx-skin)">
      <g filter="url(#slfx-goo)"><path fill="currentColor" /><circle fill="currentColor" r="0" /></g>
      <path fill="currentColor" />
    </g>`;
  const floods = skin.querySelectorAll("feFlood");
  const paths = skin.querySelectorAll("path");
  skinParts = {
    filters: skin.querySelectorAll("filter"),
    erode: skin.querySelector("feMorphology"),
    fill: floods[0],
    ring: floods[1],
    gooBox: paths[0],
    box: paths[1],
    drop: skin.querySelector("circle"),
  };
}

/** The point on the rounded box's outline nearest to p (p inside the box),
 *  with the outward normal there and the distance to it. On a corner arc the
 *  normal points away from the arc's centre; on a side it is the axis. */
function nearestEdge(px, py, { w, h, radii }) {
  const [tl, tr, br, bl] = radii;
  // Each corner: its arc centre, radius, and which way is "outside" it.
  const corners = [
    [tl, tl, tl, -1, -1], [w - tr, tr, tr, 1, -1], [w - br, h - br, br, 1, 1], [bl, h - bl, bl, -1, 1],
  ];
  for (const [cx, cy, r, sx, sy] of corners) {
    if (r <= 0) continue;
    const inX = sx < 0 ? px < cx : px > cx;
    const inY = sy < 0 ? py < cy : py > cy;
    if (inX && inY) {
      const dx = px - cx, dy = py - cy;
      const len = Math.hypot(dx, dy) || 1e-6;
      return { qx: cx + (dx / len) * r, qy: cy + (dy / len) * r, nx: dx / len, ny: dy / len, d: r - len };
    }
  }
  const sides = [
    { d: px, nx: -1, ny: 0, qx: 0, qy: py },
    { d: w - px, nx: 1, ny: 0, qx: w, qy: py },
    { d: py, nx: 0, ny: -1, qx: px, qy: 0 },
    { d: h - py, nx: 0, ny: 1, qx: px, qy: h },
  ];
  return sides.reduce((a, b) => (b.d < a.d ? b : a));
}

/* Critically underdamped: the swell overshoots and settles rather than easing
   to a stop. Stiffness and damping are tuned so a flick reads as elastic and
   a slow drag as viscous — the same spring, different input. */
const LIQUID_K = 170;
const LIQUID_DAMP = 14;
const LIQUID_SETTLE_EPS = 0.002;
/** The drop's radius from the element's own size, clamped so a keycap still
 *  swells visibly and a card does not grow a blister; how far it protrudes
 *  at full amplitude, as a share of that radius (≈3px on a 40px button);
 *  how far from an edge the pointer is felt, as a multiple of the radius —
 *  a Gaussian, so a card's edge answers the pointer approaching it and is
 *  still across the middle.
 *
 *  The owner called the swell "quasi inesistente" on round buttons. The cause
 *  was not the amplitude but cornerPx: --sl-radius-pill is 9999px, and without
 *  the clamp the drop was placed thousands of pixels away. With the outline
 *  correct, 0.24 was still slight and 0.5 read as a blob rather than a button
 *  giving; 0.34 gives 4.8px on a 2.5rem button — the shape yields, and stays a
 *  shape. Checked in Chrome at all three. */
const DROP_K = 0.35;
const DROP_MIN = 10;
const DROP_MAX = 16;
const BULGE_K = 0.34;
const REACH_K = 1.5;

let amp = 0, ampV = 0, target = 0;
let lagX = 0, lagY = 0;              // CSS px, within the live element's own box
let pointerX = 0, pointerY = 0;
let liquidLiveEl = null;
let liquidBox = null;                // { w, h, radii, border, drop, bulge, reach }
let liquidDrop = { x: 0, y: 0, r: 0 };
let liquidRafId = 0;
let liquidPrevT = 0;


function setLiquidLive(el) {
  if (liquidLiveEl === el) return;
  if (liquidLiveEl) {
    liquidLiveEl.classList.remove("is-liquid-live");
    skin?.remove();
  }
  liquidLiveEl = el;
  liquidBox = null;
  liquidDrop = { x: 0, y: 0, r: 0 };
  if (!el) return;
  buildSkin();
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const w = rect.width, h = rect.height;
  const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius]
    .map((raw) => cornerPx(raw, w, h));
  const border = Math.max(parseFloat(cs.borderTopWidth) || 0, 0);
  const drop = Math.max(DROP_MIN, Math.min(DROP_MAX, Math.min(w, h) * DROP_K));
  const bulge = drop * BULGE_K;
  liquidBox = { w, h, radii, border, drop, bulge, reach: drop * REACH_K };

  const d = roundedRectPath(w, h, radii);
  skinParts.gooBox.setAttribute("d", d);
  skinParts.box.setAttribute("d", d);
  skinParts.erode.setAttribute("radius", String(border));
  // Both filter regions: the box plus room for the drop and the blur's tail.
  const pad = Math.ceil(GOO_BLUR * 3 + drop + border + 2);
  for (const f of skinParts.filters) {
    f.setAttribute("x", String(-pad));
    f.setAttribute("y", String(-pad));
    f.setAttribute("width", String(Math.ceil(w) + 2 * pad));
    f.setAttribute("height", String(Math.ceil(h) + 2 * pad));
  }
  // The skin's box is the host's BORDER box: an absolutely positioned child
  // resolves inset: 0 against the padding box, so it steps out by the
  // border's width (effects.css reads --slfx-bw).
  skin.style.setProperty("--slfx-bw", `${border}px`);
  el.appendChild(skin);
  el.classList.add("is-liquid-live");
}

/** Rebuild the silhouette for this frame: the drop at the outline point
 *  nearest the lagged pointer, protruding by the spring's amplitude scaled
 *  by how near the pointer is to that edge; the floods in the host's own
 *  colours as they are right now. */
function paintSkin() {
  const el = liquidLiveEl;
  const b = liquidBox;
  if (!el || !b || !skinParts) return;
  const px = Math.max(0, Math.min(b.w, lagX));
  const py = Math.max(0, Math.min(b.h, lagY));
  const e = nearestEdge(px, py, b);
  const near = Math.exp(-0.5 * (Math.max(e.d, 0) / b.reach) ** 2);
  const out = amp * b.bulge * near;
  // Below a quarter pixel the drop is entirely inside the box and adds
  // nothing; report radius 0 so the chrome does not weld an invisible circle.
  const visible = out > 0.25;
  liquidDrop = {
    x: e.qx + e.nx * (out - b.drop),
    y: e.qy + e.ny * (out - b.drop),
    r: visible ? b.drop : 0,
  };
  skinParts.drop.setAttribute("cx", liquidDrop.x.toFixed(2));
  skinParts.drop.setAttribute("cy", liquidDrop.y.toFixed(2));
  skinParts.drop.setAttribute("r", visible ? b.drop.toFixed(2) : "0");

  const cs = getComputedStyle(el);
  if (skinParts.fill.style.floodColor !== cs.backgroundColor) skinParts.fill.style.floodColor = cs.backgroundColor;
  if (skinParts.ring.style.floodColor !== cs.borderTopColor) skinParts.ring.style.floodColor = cs.borderTopColor;
}

function integrateLiquid(now) {
  // A live host taken out of the document fires no pointerleave, so nothing
  // would ever clear `target` and the loop would run forever for nothing.
  // Same guard burst() carries, for the same reason: a timer or a loop
  // mutating something nothing can see.
  if (liquidLiveEl && !liquidLiveEl.isConnected) target = 0;
  const dt = Math.min((now - liquidPrevT) / 1000 || 0, 1 / 30);
  liquidPrevT = now;
  const a = LIQUID_K * (target - amp) - LIQUID_DAMP * ampV;
  ampV += a * dt;
  amp += ampV * dt;
  // The drop chases the pointer with its own lag, so it arrives after the
  // cursor rather than under it — that trail IS the mass.
  lagX += (pointerX - lagX) * Math.min(dt * 11, 1);
  lagY += (pointerY - lagY) * Math.min(dt * 11, 1);

  paintSkin();

  const settled = target === 0 && Math.abs(amp) < LIQUID_SETTLE_EPS && Math.abs(ampV) < LIQUID_SETTLE_EPS;
  if (settled) {
    liquidRafId = 0;
    amp = 0; ampV = 0;
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
  if (!(ev.target instanceof Element)) return;
  onPanePointer(ev);
  const el = ev.target.closest(LIQUID_HOSTS);
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
  if (!(ev.target instanceof Element)) return;
  onPaneLeave(ev);
  const el = ev.target.closest(LIQUID_HOSTS);
  // pointerleave does not bubble, but the listener is on the root in the
  // capture phase, so it also fires for every CHILD the pointer leaves — an
  // icon inside the button. Only the host's own leave releases the host.
  if (!el || el !== liquidLiveEl || ev.target !== el) return;
  target = 0;
  ensureLiquidLoop(); // keep the loop running so the overshoot plays out
}

/* ── glass pane: the light answers the pointer ──────────────────────────────
   The glass family's pointer-reactive mode (effects.css, .sl-fx-glass--pane):
   the button is made of glass, and the interaction is light. This driver
   writes NOTHING but custom properties onto the host — where the pointer is,
   its bearing from the centre, and how lit the pane is — and the CSS draws
   from them: a radial glint on the body at the pointer (the reference's
   cursor "spill": 48px radius, peak 0.55), and the hairline's hot stop turned
   to face the pointer with a fringe of colour either side of it. No filter,
   no colour, no geometry is ever written; a pane the pointer has left is
   left exactly as it was. The lit amount eases, so the light arrives and
   goes the way light does (the reference fades its cursor light over 200ms
   and its bend out over 350ms), and the loop stops itself once dark. */
const PANE_HOSTS = ".sl-fx-glass--pane";
/** Where the pane's conic puts its hot stop (effects.css, the lit ring):
 *  the bearing written to the host is the pointer's bearing minus this, so
 *  the hot stop lands under the pointer. */
const PANE_HOT_DEG = 20;
/** The pane's light eases in and out on an exponential, and the loop runs
 *  until the value falls under PANE_SETTLE — which is 5.3 time constants, not
 *  three. At the original 0.14 that made a mouse-out take about 740ms to
 *  finish and roughly 420ms to become invisible, and the owner's word for it
 *  was clunky.
 *
 *  OUT IS NOW FASTER THAN IN, which inverts the original pair. The intuition
 *  behind a slower fade — light lingers — is about a light that is still
 *  there. This one is a response to a pointer: on the way in the pointer is
 *  present and the light is chasing it, so a little ease reads as weight; on
 *  the way out the pointer is gone and there is nothing left to justify the
 *  wait, so the same ease reads as lag. ~180ms to invisible. */
const PANE_TAU_IN = 0.08;
const PANE_TAU_OUT = 0.06;
const PANE_SETTLE = 0.005;
let paneEl = null;
let paneLit = 0;
let paneTarget = 0;
let paneBearing = 0;      // degrees, continuous — never wrapped, so it never turns the long way
let paneRafId = 0;
let panePrevT = 0;
/** The lit pane's geometry, in its own CSS pixels, refreshed on every pointer
 *  move and read once per frame by the Tier 2 light. It exists so the GPU
 *  module forces no layout of its own: onPanePointer already has the rect and
 *  the computed style, because it needs both to place the CSS spot. */
// `host` rides along with the geometry so the GPU tier can read the element's
// own --slfx-backdrop and glass parameters. It is the only reference this
// module hands over; the shader still never touches the document.
const paneGeom = { w: 0, h: 0, radius: 0, border: 0, x: 0, y: 0, lit: 0, host: null };
/** The Tier 2 handle and its single canvas, moved between hosts exactly the
 *  way the liquid's single skin is. One device, one surface, one pipeline,
 *  created once in mountGpu() and never per element. */
let light = null;
let lightCanvas = null;
/** The panes the GPU tier gave a canvas of their own, so setPaneLive knows not
 *  to hand them the shared one as well. */
const ownsLight = new Set();

function setPaneLive(el) {
  if (paneEl === el) return;
  if (paneEl) {
    paneEl.classList.remove("is-glass-lit");
    for (const k of ["--slfx-px", "--slfx-py", "--slfx-ptr", "--slfx-lit"]) paneEl.style.removeProperty(k);
    // Leave no empty style="" behind on an element that had none.
    if (!paneEl.getAttribute("style")) paneEl.removeAttribute("style");
    // Detach the shared light before it can be attached anywhere else: exactly
    // one of it exists, so moving it IS the release. A pane that owns a canvas
    // never held this one.
    if (lightCanvas?.parentElement === paneEl) lightCanvas.remove();
  }
  paneEl = el;
  paneLit = 0;
  if (el) {
    el.classList.add("is-glass-lit");
    // A pane with a declared backdrop has a canvas of its own, holding a
    // material that exists at rest; handing it the shared one too would stack
    // two lights on one element.
    if (lightCanvas && !ownsLight.has(el)) el.appendChild(lightCanvas);
  }
}

function onPanePointer(ev) {
  const el = ev.target.closest(PANE_HOSTS);
  if (!el || el.closest('[data-sl-fx="off"]')) return;
  if (paneEl !== el) {
    setPaneLive(el);
    paneBearing = 0;
  }
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  // The body (::before) is inset: 0, which resolves against the padding
  // box; the pointer is measured from the same origin.
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const bt = parseFloat(cs.borderTopWidth) || 0;
  el.style.setProperty("--slfx-px", `${(ev.clientX - r.left - bl).toFixed(1)}px`);
  el.style.setProperty("--slfx-py", `${(ev.clientY - r.top - bt).toFixed(1)}px`);
  // Bearing as a conic angle: 0 straight up, clockwise. Unwrapped against
  // the previous value so a pointer crossing the top goes 359 → 361, not
  // 359 → 1 — the CSS transition on the angle would otherwise spin the ring
  // the long way round.
  const dx = ev.clientX - (r.left + r.width / 2);
  const dy = ev.clientY - (r.top + r.height / 2);
  const raw = (Math.atan2(dx, -dy) * 180) / Math.PI - PANE_HOT_DEG;
  let d = (raw - paneBearing) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  paneBearing += d;
  el.style.setProperty("--slfx-ptr", `${paneBearing.toFixed(1)}deg`);
  // The same measurement, in the host's own pixels, for the Tier 2 light.
  // The light is drawn on the BORDER box — the canvas is inset: 0 against it —
  // so the pointer is measured from that origin, not the padding box's.
  paneGeom.host = el;
  paneGeom.w = r.width;
  paneGeom.h = r.height;
  paneGeom.radius = cornerPx(cs.borderTopLeftRadius, r.width, r.height);
  paneGeom.border = parseFloat(cs.borderTopWidth) || 0;
  paneGeom.x = ev.clientX - r.left;
  paneGeom.y = ev.clientY - r.top;
  paneTarget = 1;
  ensurePaneLoop();
}

/** One pane's border box at rest, in the shape the GPU tier draws from. The
 *  pointer is put far outside the pane, so nothing but the material is left.
 *  @param {Element} el the pane
 *  @returns {{w: number, h: number, radius: number, border: number, x: number, y: number, lit: number}} */
function paneRestGeom(el) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    w: r.width,
    h: r.height,
    radius: cornerPx(cs.borderTopLeftRadius, r.width, r.height),
    border: parseFloat(cs.borderTopWidth) || 0,
    x: -r.width,
    y: -r.height,
    lit: 0,
  };
}

function onPaneLeave(ev) {
  const el = ev.target.closest(PANE_HOSTS);
  if (!el || el !== paneEl || ev.target !== el) return;
  paneTarget = 0;
  ensurePaneLoop();
}

function integratePane(now) {
  if (paneEl && !paneEl.isConnected) paneTarget = 0;
  const dt = Math.min((now - panePrevT) / 1000 || 0, 1 / 30);
  panePrevT = now;
  const tau = paneTarget > paneLit ? PANE_TAU_IN : PANE_TAU_OUT;
  paneLit += (paneTarget - paneLit) * (1 - Math.exp(-dt / tau));
  if (paneTarget === 0 && paneLit < PANE_SETTLE) {
    paneRafId = 0;
    setPaneLive(null);
    return;
  }
  paneEl?.style.setProperty("--slfx-lit", paneLit.toFixed(3));
  // Tier 2 rides the pane's own loop rather than running a frame loop of its
  // own: that loop already starts on pointer entry and stops itself once the
  // light has eased to nothing, which is exactly when the GPU should be idle.
  paneGeom.lit = paneLit;
  light?.draw();
  paneRafId = requestAnimationFrame(integratePane);
}

function ensurePaneLoop() {
  if (paneRafId) return;
  panePrevT = performance.now();
  paneRafId = requestAnimationFrame(integratePane);
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

/* ── aurora: the bloom's child ──────────────────────────────────────────────
   The bloom is a Gaussian blur of a thicker copy of the arc, and CSS applies
   a filter before a mask, so the masked band and the blur need two boxes:
   a child of the host, whose ::before is the band. The host's own two
   pseudo-elements stay what they are (::after the edge). Injected here, so
   a consumer who never calls mount() keeps the CSS-only ring and never sees
   an element it did not write; aria-hidden, and CSS makes it inert to the
   pointer and to selection. A linear aurora has no ring and gets none. */
/* ── the lens: removed 2026-09-11 ─────────────────────────────────────────────
   Four hundred lines went here: a plate rasterised from a body clone, one
   cropped canvas per pane, and an SVG displacement run over it. It is gone,
   and not because it was unfinished — because the route it serves was
   replaced.

   The owner chose the DECLARED BACKDROP: a surface says what lies behind a
   region and the pane bends that, which is how both implementations in the
   knowledge base work — glass-studio hands its shader images and videos,
   glass-vue is a demo over a backdrop, and neither has ever refracted a live
   document. That route needs no capture, no plate, and nothing to go stale.

   The lens's own record, kept because it cost a day to learn and would cost
   another to relearn:
     - the plate can never become a GPU texture. A foreignObject raster is
       marked origin-unclean for good, proven against a single variable: the
       same blob-URL SVG uploads WITHOUT foreignObject and throws SecurityError
       WITH it. So the lens could never have fed the shader this layer is
       heading toward.
     - its plate rendered every string in a fallback face, because a page
       cannot read @font-face rules out of a cross-origin stylesheet; fixed by
       vendoring the faces and inlining them as data URIs.
     - it removed glass elements from the clone, which took their boxes out of
       flow and drifted every crop below them by hundreds of pixels.
     - and after both fixes a filled pane still cropped an opaque black
       rectangle that nine measurements could not explain.
   docs/memory/the-lens-plate-misaligns-because-webfonts-do-not-load.md carries
   all of it. */

const GLOW_HOSTS = ".sl-fx-aurora:not(.sl-fx-aurora--linear)";
const GLASS_HOSTS = ".sl-fx-glass";

/** How far the glow reaches past its host, in CSS pixels. Read once from the
 *  host rather than hard-coded: --slfx-glow and --slfx-rim-out are the two
 *  properties the glow's own inset used before it became a sibling.
 *  @param {Element} el the aurora host
 *  @returns {number} the spread in pixels */
function glowSpread(el) {
  const cs = getComputedStyle(el);
  const px = (name) => parseFloat(cs.getPropertyValue(name)) || 0;
  return 1 + px("--slfx-rim-out") + px("--slfx-glow");
}

/** Put the glow where the lens can see it.
 *
 *  A child is painted as part of its element, AFTER backdrop-filter has
 *  sampled what is behind it — so a lensed pane cannot refract its own aurora,
 *  and the light lies on the glass rather than in it. As a sibling painted
 *  just before the host it is part of the backdrop, and the lens bends it:
 *  measured on lab/1r, it pools along the inner edges and squeezes into a band
 *  at the bottom.
 *
 *  The host's PARENT is the seat, not an injected wrapper. A wrapper around an
 *  element a consumer wrote is the more robust shape on paper and the more
 *  invasive one in practice — an inline-flex box around a button moves layout.
 *  The parent is already there; it only has to be positioned, which is one
 *  reversible declaration, and then the glow's box is a single rect
 *  subtraction rather than the viewport-versus-offset-parent arithmetic that
 *  made the reference implementation's panel jump on its first drag.
 *  @param {Element} el the aurora host
 *  @param {HTMLElement} glow the glow to place
 *  @returns {void} */
/** Everything the glow's ring is made of, and every one of them is declared on
 *  the AURORA HOST. As a child the glow inherited them; as a sibling it
 *  inherits from the host's parent instead, where none of them exist — so the
 *  ::before that paints the ring collapsed and the glow rendered nothing at
 *  all. Measured: one differing pixel in 404 096 between the glow shown and
 *  the glow display:none'd. Copied across explicitly rather than re-declared,
 *  so the values still come from the host and a component that re-parametrises
 *  its own aurora is still followed. */
const GLOW_VARS = [
  "--slfx-angle", "--slfx-arc", "--slfx-bloom-hi", "--slfx-bloom-lo",
  "--slfx-bloom-out", "--slfx-bloom-w", "--slfx-glow", "--slfx-rim-out",
  "--slfx-soft",
  // the band's inward reach: read on the glow's ::before, declared on the host
  "--slfx-bleed",
  // and the light pole itself: the beam is MADE of it, and a background of an
  // undefined var() is no background at all — the beam was lit, drifting,
  // rotated and invisible until this line existed
  "--slfx-glint",
  "--slfx-bloom-hi",
  // the pillars' palette root: accent, vivid tier, gamut-fitted
  "--slfx-accent-vivid",
];

function seatGlow(el, glow) {
  const parent = glow.parentElement;
  if (!parent) return;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  const r = el.getBoundingClientRect();
  const p = parent.getBoundingClientRect();
  // Pillars stay inside the element: no spread, the box IS the host's box.
  // effects.css depends on exactly this — it excludes the pillars from the
  // clip written from --slfx-glow (which would eat a box that never had that
  // spread) and gives them their own at inset 0. One decision, two files.
  const spread = glow.hasAttribute("data-sl-fx-pillars") ? 0 : glowSpread(el);
  glow.style.left = `${r.left - p.left - spread}px`;
  glow.style.top = `${r.top - p.top - spread}px`;
  glow.style.width = `${r.width + spread * 2}px`;
  glow.style.height = `${r.height + spread * 2}px`;
  const hostStyle = getComputedStyle(el);
  glow.style.setProperty("--slfx-seat-radius", hostStyle.borderTopLeftRadius);
  for (const name of GLOW_VARS) {
    const v = hostStyle.getPropertyValue(name);
    if (v) glow.style.setProperty(name, v);
  }

  // HOW MANY CURTAINS, not how wide one is. The pattern was fitted at 104px on
  // a 320px card — three across the pane — and left at that length it does not
  // scale: a 1104px row showed nine ribs where the card it was measured on
  // showed three, and the owner read the difference as stripes rather than as
  // light. So the author binds a count and the width follows the host, which
  // is why this belongs here: seatGlow() is already what runs on every resize.
  //
  // effects.css carries 104px as its own fallback, so a page that never mounts
  // keeps exactly the pattern it has today.
  const count = parseFloat(hostStyle.getPropertyValue("--slfx-pillar-count")) || PILLAR_COUNT;
  if (r.width > 0) glow.style.setProperty("--slfx-pillar-pitch", `${r.width / count}px`);

  // And a phase of its own. Every animation starts when its rule begins to
  // match, so a surface that lights all its cards at once starts all of them
  // on the same instant and they drift in formation — one pattern printed as
  // many times as there are panes. The offset is derived from the host's
  // ordinal rather than rolled, so it is stable across a re-render: a curtain
  // that jumped to a new phase on every navigation would flicker for nothing.
  // The golden ratio is the usual way to spread a small integer over [0, 1)
  // without two neighbours landing close together.
  glow.style.setProperty("--slfx-pillar-phase", String((glowOrdinal(el) * PHI) % 1));
}

/** The golden ratio's fractional part, for spreading ordinals over [0, 1). */
const PHI = 0.618033988749895;

/** How many curtains hang across a pane when the author binds no count. Three
 *  is what the pattern was fitted at, on the card it was fitted on. */
const PILLAR_COUNT = 3;

/** A stable small integer per host, assigned in the order hosts are first
 *  seated. Read off the id seatGlow's caller already gives them, so two calls
 *  for the same host return the same number and a resize does not reshuffle
 *  the page.
 *  @param {Element} el the aurora host
 *  @returns {number} */
function glowOrdinal(el) {
  const id = el.dataset.slFxId;
  if (!id) return 0;
  if (!ordinals.has(id)) ordinals.set(id, ordinals.size);
  return ordinals.get(id);
}
const ordinals = new Map();

function injectGlow(el) {
  const parent = el.parentElement;
  // Without a parent there is nowhere to seat it, and a host that is its own
  // root keeps the old shape rather than losing its aurora entirely.
  const seat = parent || el;
  for (const child of seat.children) {
    if (child.classList.contains("sl-fx-aurora__glow") && child.dataset.slFxFor === el.dataset.slFxId) return;
  }
  const glow = document.createElement("span");
  glow.className = "sl-fx-aurora__glow";
  glow.setAttribute("aria-hidden", "true");
  if (!parent) {
    el.appendChild(glow);
    return;
  }
  el.dataset.slFxId = el.dataset.slFxId || `g${glowSerial++}`;
  glow.dataset.slFxFor = el.dataset.slFxId;
  glow.setAttribute("data-sl-fx-seated", "");
  // --beam: the glow paints a beam through the pane instead of a ring around
  // it. Carried as an attribute on the glow, since the CSS that draws it
  // cannot see the host's class from a previous sibling.
  if (el.classList.contains("sl-fx-aurora--beam")) glow.setAttribute("data-sl-fx-beam", "");
  // PILLARS ARE THE AURORA'S LIGHT BY DEFAULT (2026-09-12). Curtains clipped
  // to the host's own box, in the accent and its complement, sitting where the
  // lens can bend them. The reason is a measurement, not a preference: the
  // conic wash follows the edge it hugs, so displacing it maps it onto very
  // nearly itself — 0.93% of pixels moved, against 5.00% for the curtains
  // under the same lens. A light a lens cannot be seen to bend is not light in
  // glass. The rotation is --sweep, opt-in; --beam is the line through the
  // pane; --rim's light lies OUTSIDE a filled control, where curtains clipped
  // to the box would never show. --pillars stays honoured so existing markup
  // keeps its meaning.
  // --linear is not in this list because a linear aurora never reaches here:
  // GLOW_HOSTS excludes it, so it has no seated glow to give curtains to.
  const OWN_LIGHT = ["sweep", "beam", "rim"];
  const wantsPillars = el.classList.contains("sl-fx-aurora--pillars")
    || OWN_LIGHT.every((mode) => !el.classList.contains(`sl-fx-aurora--${mode}`));
  if (wantsPillars) glow.setAttribute("data-sl-fx-pillars", "");
  parent.insertBefore(glow, el);
  seatGlow(el, glow);
  // Again once the page has settled. A ResizeObserver fires when a box CHANGES
  // size, not when it moves, so a host pushed sideways by a webfont arriving
  // above it leaves its glow a couple of pixels behind — measured at up to 2px
  // on the showcase before this second pass.
  document.fonts?.ready.then(() => seatGlow(el, glow));
  if (typeof ResizeObserver === "function") {
    const watch = new ResizeObserver(() => seatGlow(el, glow));
    watch.observe(el);
    watch.observe(parent);
  }
}

/** @type {number} pairs a seated glow with the host it belongs to */
let glowSerial = 0;

/* ── the glass anatomy ──────────────────────────────────────────────────────
   glass.css paints the material in three stacked layers — frost, tint, rim —
   and they have to be elements: a host has two pseudo-elements and the aurora
   already owns ::after. They are injected rather than written by the consumer
   for the same reason the aurora's glow is: a surface asks for glass with one
   class, and forgetting a span is not a failure mode a design system should
   have. The layers sit at negative z-index, so the element's own label paints
   over them and nothing wraps the consumer's content. */
const GLASS_LAYERS = ["backdrop", "tint", "specular", "shine"];

function injectGlass(el) {
  // glass.css:76 declares border-radius: var(--slg-radius, var(--sl-radius-md))
  // on .sl-glass, the class classList.add below is about to stamp on el — so
  // unless --slg-radius is already bound, the component's OWN radius (.sl-btn
  // at 10px, say) is about to be overwritten by the family default the moment
  // it joins the anatomy: catalog.md's canonical-strings table measured
  // exactly that on .sl-btn, 10px → 6px. L6: "a surface stays free to
  // re-parametrise its own radius without touching the effect" — the glass
  // layer keeps that contract by reading the host's OWN computed radius
  // before it becomes a glass host, and writing it back as the property
  // glass.css already resolves through, so the layer's own declaration
  // resolves back to what the component declared.
  //
  // Read BEFORE classList.add, not after: once .sl-glass is on the element,
  // getComputedStyle(el) already reflects glass.css's own fallback — the
  // very value this exists to preserve — so reading here is the only reading
  // that still sees the component's own declaration.
  //
  // Two cases need no rebind and get none, because both already compute a
  // non-empty --slg-radius at this point: glass-text sets it to 0
  // deliberately, and the round icon button's 50% binding
  // (.sl-icon-btn--round.sl-fx-glass) is keyed off .sl-fx-glass, already in
  // the markup before injectGlass ever runs — neither waits on .sl-glass.
  const cs = getComputedStyle(el);
  const ownRadius = cs.borderTopLeftRadius;
  if (!cs.getPropertyValue("--slg-radius").trim() && ownRadius) {
    el.style.setProperty("--slg-radius", ownRadius);
  }
  // The host joins the anatomy too, not just its layers. glass.css declares the
  // stacking context, the radius and the derived light pole on .sl-glass, and
  // an element carrying only .sl-fx-glass got the layers with none of that —
  // which read as a material that had lost its highlight colour. One class is
  // what makes .sl-fx-glass and .sl-glass the same road rather than two.
  el.classList.add("sl-glass");
  for (const child of el.children) {
    if (child.classList.contains("sl-glass__backdrop")) return;
  }
  // Prepended in reverse, so the three land ahead of any content in DOM order
  // while keeping their own order among themselves. Among negative z-indexes
  // the declared value orders them anyway; DOM order only decides ties.
  for (const name of [...GLASS_LAYERS].reverse()) {
    const layer = document.createElement("span");
    layer.className = `sl-glass__${name}`;
    layer.setAttribute("aria-hidden", "true");
    el.prepend(layer);
  }
}

/** The lenses currently bound, so mount() can be called twice without giving
 *  an element two filters, and so a theme change can take them all away. */
const lensed = new Map();

/** High contrast, and ONLY high contrast.
 *
 *  Not suppressed(): that also refuses under prefers-reduced-motion, and a lens
 *  is not motion — it is a static property of a surface, it does not animate,
 *  and it does not redraw on scroll. A visitor who asked for less movement did
 *  not ask for less material. High contrast is different in kind: it exists so
 *  that what is behind a surface does not interfere with what is on it, and a
 *  lens deforming the text behind a button is exactly that interference.
 *  @returns {boolean} whether a lens may not run */
function lensRefused() {
  if (typeof document === "undefined") return true;
  return document.documentElement.getAttribute("data-sl-theme") === "high-contrast";
}

/** Give every glass host a real refraction of whatever is behind it.
 *
 *  Dynamically imported, like the GPU tier was, so a consumer who never mounts
 *  pays nothing for it — and so a browser that cannot do it degrades to the CSS
 *  material in glass.css with no branch here.
 *  @param {ParentNode} root the subtree to arm
 *  @returns {Promise<void>} */
async function armLenses(root) {
  if (lensRefused()) return;
  let lens;
  try { ({ lens } = await import("./glass-lens.js")); } catch { return; }
  const hosts = [];
  if (root instanceof Element && root.matches(GLASS_HOSTS)) hosts.push(root);
  hosts.push(...root.querySelectorAll(GLASS_HOSTS));
  for (const el of hosts) {
    if (lensed.has(el) || el.closest('[data-sl-fx="off"]')) continue;
    const handle = lens(el);
    if (handle) lensed.set(el, handle);
  }
}

/** The goo fields currently bound, for the same two reasons as `lensed`:
 *  mount() may be called twice, and a container may leave the document. */
const gooFields = new Map();
const GOO_HOSTS = ".sl-fx-goo";

/** Give every declared container its one shared gooey field.
 *
 *  Dynamically imported, like the lens and the GPU tier: a consumer whose
 *  surface has no field pays nothing for the module existing. Tier 0 — the
 *  members laid out and unmerged — is what a browser sees if this never runs.
 *  @param {ParentNode} root the subtree to arm
 *  @returns {Promise<void>} */
async function armGooFields(root) {
  let gooField;
  try { ({ gooField } = await import("./goo-field.js")); } catch { return; }
  const hosts = [];
  if (root instanceof Element && root.matches(GOO_HOSTS)) hosts.push(root);
  hosts.push(...root.querySelectorAll(GOO_HOSTS));
  for (const el of hosts) {
    if (gooFields.has(el)) continue;
    const handle = gooField(el);
    if (handle) gooFields.set(el, handle);
  }
}

/** Whether the goo has been armed on this document already. Its own flag, not
 *  `armed`: the goo is armed before Tier 1's motion guard and outlives its
 *  refusal, so the two are not the same question. */
let gooArmed = false;

/** Arm the goo, and keep it armed.
 *
 *  Separate from the rest of `mount()` because of the motion preference. The
 *  goo ANIMATES NOTHING — it is laid out, not played, and the spec's own
 *  reduced-motion clause is "nothing animates; static material survives". So
 *  it refuses on high contrast (where the point is that nothing behind a
 *  surface may interfere with what is on it) and runs under
 *  prefers-reduced-motion, on the same reasoning `lensRefused()` carries: a
 *  visitor who asked for less movement did not ask for less material. Its CSS
 *  is not gated on `data-sl-fx="on"` either, so nothing about it depends on
 *  Tier 1 having armed.
 *
 *  Two observers, both owned here so there is one place that keeps a field
 *  live: containers arriving later get a field, and a theme change repaints
 *  every field's colours.
 *  @param {ParentNode} root the subtree to arm
 *  @returns {boolean} whether the goo is armed on this document */
function mountGoo(root) {
  if (typeof window === "undefined") return false;
  if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") return false;
  if (gooArmed) return true;
  gooArmed = true;
  armGooFields(root);
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) armGooFields(n);
  }).observe(root, { childList: true, subtree: true });
  new MutationObserver(repaintGooFields).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-sl-theme", "style"],
  });
  return true;
}

/** The hosts whose glass is cut to their own letterforms, guarded the way
 *  `lensed` and `gooFields` are: mount() may be called twice, and a host may
 *  leave the document. */
const glassTexts = new Map();
const GLASS_TEXT_HOSTS = ".sl-fx-glass--text";

/** Cut every declared host's glass to its own text.
 *
 *  Dynamically imported, like the lens and the goo: a surface with no glass
 *  text pays nothing for the module existing. There is no Tier 0 for this one
 *  — an uncut host is a rectangle of glass with an invisible label in it — so
 *  the modifier's CSS keeps the host transparent and lets its paired glow
 *  carry the text until the mask arrives.
 *  @param {ParentNode} root the subtree to arm
 *  @returns {Promise<void>} */
async function armGlassText(root) {
  if (typeof window === "undefined") return;
  let glassText;
  try { ({ glassText } = await import("./glass-text.js")); } catch { return; }
  const hosts = [];
  if (root instanceof Element && root.matches(GLASS_TEXT_HOSTS)) hosts.push(root);
  hosts.push(...root.querySelectorAll(GLASS_TEXT_HOSTS));
  for (const el of hosts) {
    if (glassTexts.has(el)) continue;
    const handle = glassText(el);
    if (handle) glassTexts.set(el, handle);
  }
}

/** Re-read every field's colours after a theme change.
 *
 *  A field is static once laid out, so nothing else would ever repaint it: a
 *  theme switch changes no box, fires no resize and moves no node. Its members'
 *  fills went on being the previous theme's, and on the light theme that put a
 *  ghost button's dark label on a substance still painted in the dark theme's
 *  raised surface — the label vanished. The observer that already watches
 *  data-sl-theme for the GPU tier's uniforms is the right place: one attribute,
 *  one read, every consumer of a token value updated from it.
 *  @returns {void} */
function repaintGooFields() {
  for (const handle of gooFields.values()) handle.measure(true);
}

/** Take every lens away, leaving the CSS material that glass.css paints.
 *  @returns {void} */
function dropLenses() {
  for (const handle of lensed.values()) handle.destroy();
  lensed.clear();
}

/** Follow the theme for as long as the page lives: a visitor can switch to
 *  high contrast — or away from it — long after mount() ran, and a kill switch
 *  that only reads its condition once is not a kill switch.
 *  @param {ParentNode} root the subtree mount() armed
 *  @returns {void} */
function watchLensTheme(root) {
  if (typeof MutationObserver !== "function") return;
  new MutationObserver(() => {
    if (lensRefused()) dropLenses();
    else armLenses(root);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-sl-theme"] });
}

function injectGlassLayers(root) {
  if (root instanceof Element && root.matches(GLASS_HOSTS)) injectGlass(root);
  for (const el of root.querySelectorAll(GLASS_HOSTS)) injectGlass(el);
}

function injectGlows(root) {
  if (root instanceof Element && root.matches(GLOW_HOSTS)) injectGlow(root);
  for (const el of root.querySelectorAll(GLOW_HOSTS)) injectGlow(el);
}

/** The conditions under which no effect may run, re-read at call time rather
 *  than sampled at mount: a visitor can switch theme, or turn on reduced
 *  motion, long after the page loaded. */
/* ── near the viewport ───────────────────────────────────────────────────────
   An effect on an element nobody can see is work nobody asked for, and on a
   long page most elements are that. The expensive ones are the glass's
   backdrop-filter — a blur of whatever is behind it, recomputed as the page
   moves — and every running animation, which keeps ticking off-screen.

   So Tier 1 marks what is near enough to matter and effects.css stands the
   rest down. `near` rather than `visible`: the margin arms an element before
   it arrives, because a pane that blurs in as it crosses the fold is worse
   than one that was always blurred.

   SUBTRACTIVE, and that is the whole design. Tier 0 has no JavaScript to write
   the attribute, so the stand-down rules key on `[data-sl-fx="on"]` too — a
   page that never mounts keeps its full material, and only a page that armed
   Tier 1 gets the economy. The alternative (require the attribute to paint)
   would have turned the glass off entirely wherever this module is absent. */
const NEAR_MARGIN = "200px";
const NEAR_HOSTS = ".sl-fx-glass, .sl-fx-aurora";
let nearObserver = null;

/** Watch an element and mark it while it is near the viewport.
 *  @param {ParentNode} root the subtree to watch
 *  @returns {void} */
function watchNear(root) {
  if (typeof IntersectionObserver !== "function") return;
  if (!nearObserver) {
    nearObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.toggleAttribute("data-sl-fx-near", e.isIntersecting);
      },
      { rootMargin: NEAR_MARGIN },
    );
  }
  const hosts = [];
  if (root instanceof Element && root.matches(NEAR_HOSTS)) hosts.push(root);
  hosts.push(...root.querySelectorAll(NEAR_HOSTS));
  for (const el of hosts) {
    // FAIL OPEN. Marked near before it is observed, so the observer's job is
    // only ever to TAKE the mark away. Where the API is absent, or present and
    // never delivering — a background tab, a headless capture, a harness that
    // suppresses it — every host keeps its full material, which is the state
    // this layer promises is correct on its own. The economy is an
    // improvement on that state, never a precondition for it.
    el.toggleAttribute("data-sl-fx-near", true);
    nearObserver.observe(el);
  }
}

/** Whether this document has taken the reduced-motion derogation.
 *
 *  A product may have a documented reason to animate for a visitor reporting
 *  the preference. sondalab.eu is the case this exists for: Windows reports
 *  `reduce` by default under "adjust for best performance", and that site's
 *  owner ruled its glitch is brand rather than decoration. The derogation is
 *  the consumer's to take and to justify — mount() only takes it when asked,
 *  by a name a reader cannot mistake for anything else.
 *
 *  It reaches the GLITCH alone (effects.css keeps every other family's motion
 *  inside the media query, where nothing can overrule it), and it never
 *  reaches high contrast, which is a different requirement with a different
 *  reason: there the point is that what is behind a surface must not interfere
 *  with what is on it.
 *  @returns {boolean} */
function motionDerogated() {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-sl-fx-motion") === "always";
}

function suppressed() {
  if (typeof document === "undefined") return true;
  if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") return true;
  return window.matchMedia(REDUCE).matches && !motionDerogated();
}

/* ── public API ──────────────────────────────────────────────────────────────*/

/**
 * Arm Tier 1: pointer-driven liquid, finite glitch bursts, animated aurora.
 * Refuses under reduced motion and under high contrast — Tier 0 is the default
 * state and stays correct on its own.
 *
 * `ignoreReducedMotion` is a derogation, not a convenience, and a consumer
 * takes it on their own evidence. It arms Tier 1 for a visitor reporting
 * `prefers-reduced-motion: reduce` and lets the GLITCH animate for them; every
 * other family's motion stays inside the media query in effects.css, where
 * nothing can overrule it. It has no effect on high contrast, which refuses
 * regardless. The case it exists for: sondalab.eu, where Windows reports the
 * preference by default under "adjust for best performance" and the owner
 * ruled the glitch is brand rather than decoration.
 *
 * @param {Document|Element} root
 * @param {{ignoreReducedMotion?: boolean}} [options]
 * @returns {boolean} whether Tier 1 was armed
 */
export function mount(root = document, { ignoreReducedMotion = false, bursts = 1 } = {}) {
  if (armed) return true;
  if (typeof window === "undefined") return false;
  const html = document.documentElement;
  if (html.getAttribute("data-sl-theme") === "high-contrast") return false;
  // Written before anything reads it, and written by the caller's request
  // alone: effects.css keys the glitch's reduced-motion removal off this
  // attribute, so the CSS and the JavaScript decline together or not at all.
  if (ignoreReducedMotion) html.setAttribute("data-sl-fx-motion", "always");
  burstBudget = Math.max(1, Math.floor(bursts));
  // Before the motion guard, and deliberately: the goo animates nothing, so
  // refusing it for a motion preference would take away material rather than
  // movement. mountGoo() owns its own observers and its own armed flag.
  mountGoo(root);
  // The lens goes with it, and for the reason lensRefused() has argued in its
  // own comment since it was written: a lens is not motion. It is a static
  // property of a surface — it does not animate, and it does not redraw on
  // scroll — and a visitor who asked for less movement did not ask for less
  // material. The comment said so; the call site said otherwise, because it
  // sat after this guard. armLenses() still refuses high contrast on its own,
  // which is a different requirement: there the point is that what is behind a
  // surface must not interfere with what is on it.
  //
  // injectGlassLayers goes with it, and it is the larger half of the same
  // defect: those children ARE the glass material — glass.css puts the
  // backdrop-filter on .sl-glass__backdrop, split from the tint because
  // opacity on the filtering element throttles it — so a visitor reporting a
  // motion preference was getting no glass at all, not merely no lens. The
  // layers carry no animation of their own; what animates on a pane is in
  // effects.css, inside the media query, where it stays.
  //
  // Late arrivals need the material too, so the observer that gives it to them
  // is set up here rather than with Tier 1's: a page that refuses below still
  // has to dress a card rendered after mount().
  injectGlassLayers(root);
  armLenses(root);
  // And the letterform cut goes with them, for the third time in the same
  // argument: a mask is not motion. It is the shape the material has.
  armGlassText(root);
  watchLensTheme(root);
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) {
      injectGlassLayers(n);
      armLenses(n);
      armGlassText(n);
    }
  }).observe(root, { childList: true, subtree: true });
  if (window.matchMedia(REDUCE).matches && !ignoreReducedMotion) return false;

  readTokens(html);
  // data-sl-theme and style both matter: a theme switch changes the former,
  // a per-product accent override (root.style.setProperty("--sl-accent-..."))
  // changes only the latter. The GPU tier reads the shared `tokens` object,
  // and this is the one observer that keeps it live.
  new MutationObserver(() => readTokens(html)).observe(html, {
    attributes: true,
    attributeFilter: ["data-sl-theme", "style"],
  });

  // Before data-sl-fx="on" goes up: the arc's sweep and its bloom's sweep
  // start on the same frame, so the two stay in phase. Elements that arrive
  // later get theirs as they arrive.
  injectGlows(root);
  watchNear(root);
  // Tier 1's own late arrivals: the glow is a moving layer and the viewport
  // gate only matters where something is running, so both belong on this side
  // of the guard. The material's observer is above.
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) {
      injectGlows(n);
      watchNear(n);
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
  if (!armed || burstsRunning >= burstBudget || blocked || !el?.isConnected) return;
  burstsRunning++;
  randomizeGhosts(el);
  el.classList.add("is-glitching");
  setTimeout(() => {
    el.classList.remove("is-glitching");
    burstsRunning--;
  }, Math.min(CAP_MS, rand(burstMin, burstMax)));
}

/**
 * Burst, wait, burst again — an ambient glitch on one element, with a random
 * pause between each. The element re-resolving every so often is a different
 * statement from one that glitches once: it says the thing is live, not that
 * something just happened.
 *
 * Returns a stop function. Callers who never call it are not leaking a timer
 * for the life of the page: the loop checks `isConnected` and lets itself go
 * when the element leaves the document, which is the case that actually bites
 * (a scene field drops its fallback picture once its tube is up).
 *
 * @param {Element} el an element carrying .sl-fx-glitch
 * @param {{waitMin?: number, waitMax?: number, burstMin?: number, burstMax?: number}} [options]
 * @returns {() => void} stop
 */
export function autoBurst(el, { waitMin = 6000, waitMax = 11000, burstMin = 200, burstMax = 500 } = {}) {
  let timer = 0;
  let stopped = false;
  const loop = () => {
    timer = setTimeout(() => {
      if (stopped || !el?.isConnected) return;
      burst(el, { burstMin, burstMax });
      loop();
    }, rand(waitMin, waitMax));
  };
  loop();
  return () => { stopped = true; clearTimeout(timer); };
}

/**
 * While the pointer is over one element, glitch another in bursts separated by
 * random pauses; stop the moment it leaves.
 *
 * The two elements are separate on purpose: what the pointer is over is often
 * a whole row or a link, and what should re-resolve is the name inside it.
 *
 * This does NOT go through burst(): a hover is a direct answer to the pointer,
 * and dropping it because something ambient happens to be mid-burst would make
 * the surface feel unresponsive at exactly the moment the visitor asked it for
 * something. It is the one path allowed past the budget, and it is bounded by
 * the pointer being there.
 *
 * @param {Element} hoverEl what the pointer is over
 * @param {Element} targetEl what re-resolves — may be the same element
 * @param {{burstMin?: number, burstMax?: number, pauseMin?: number, pauseMax?: number}} [options]
 * @returns {() => void} stop, which also releases the listeners
 */
export function hoverBurst(hoverEl, targetEl, { burstMin = 200, burstMax = 500, pauseMin = 500, pauseMax = 1600 } = {}) {
  let active = false;
  const timers = [];
  const clear = () => { while (timers.length) clearTimeout(timers.pop()); };
  const cycle = () => {
    if (!active || suppressed() || !targetEl?.isConnected) return;
    randomizeGhosts(targetEl);
    targetEl.classList.add("is-glitching");
    timers.push(setTimeout(() => {
      targetEl.classList.remove("is-glitching");
      if (active) timers.push(setTimeout(cycle, rand(pauseMin, pauseMax)));
    }, Math.min(CAP_MS, rand(burstMin, burstMax))));
  };
  const enter = () => { if (active || !armed) return; active = true; cycle(); };
  const leave = () => { active = false; clear(); targetEl.classList.remove("is-glitching"); };
  hoverEl.addEventListener("pointerenter", enter, { passive: true });
  hoverEl.addEventListener("pointerleave", leave, { passive: true });
  return () => {
    leave();
    hoverEl.removeEventListener("pointerenter", enter);
    hoverEl.removeEventListener("pointerleave", leave);
  };
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
  // liveEl only remembers a grant THIS function handed out. A page can also
  // write data-sl-fx-live="on" straight into its markup — a grant this
  // function never issued and so cannot know about through liveEl alone — so
  // the query is needed IN ADDITION: it finds every element currently
  // holding the attribute, wherever it came from, and revokes all but `el`.
  if (typeof document !== "undefined") {
    for (const prior of document.querySelectorAll('[data-sl-fx-live="on"]')) {
      // A grant inside a data-sl-fx="off" subtree is switched off, not
      // competing for the one-per-document budget — the ambient-budget fence
      // (scripts/effects-showcase.test.mjs, offRegionExtents) excludes
      // off-region grants from the count for exactly that reason. Revoking
      // it would be taking something from a page that was not asking.
      if (prior !== el && !prior.closest('[data-sl-fx="off"]')) prior.removeAttribute("data-sl-fx-live");
    }
  }
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
 * liquid's swell carried into the ring. Additive: everything
 * already works without it, and it is only attached once the device has
 * actually answered. Refuses under high contrast, the same way mount() does —
 * a CSS kill switch cannot silence a canvas, so the refusal has to live here.
 * @returns {Promise<boolean>} whether the GPU tier came up
 */
export async function mountGpu() {
  if (!armed) return false;
  // Re-read at call time rather than relying on mount()'s own guard: a visitor
  // can switch to high contrast between mount() and this call, and `armed`
  // stays true once set. bootLight() additionally tears the light down if the
  // switch happens while it is already live.
  if (typeof document === "undefined") return false;
  if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") return false;

  // Dynamic import, so a consumer that never calls mountGpu() never loads
  // the GPU module or the shader. This import only ever pulls in
  // ./effects-gpu.js and ./effects-shader.js — vgpu itself (an optional
  // PEER dependency, installed only if the consumer asks for it) is
  // imported inside bootLight()'s own try/catch, which is where a missing
  // peer degrades to Tier 1. The catch here covers a bundler that fails to
  // resolve the kit's own module, nothing else.
  let mod;
  try {
    mod = await import("./effects-gpu.js");
  } catch {
    return false;
  }
  const { bootLight } = mod;

  // ONE canvas, for the whole page, moved between hosts by the pane driver —
  // the same single-instance discipline the liquid's skin has. Its box is
  // pure CSS (.sl-fx-glass__lit: inset 0 on the host, below the label), so
  // nothing here writes geometry: vgpu's surface is layout-backed and picks
  // up each new host's size on the next frame clock advance by itself.
  //
  // A child of the host, not an overlay on the page. The host carries
  // backdrop-filter, which makes it a backdrop root, so only a child
  // composites over the blurred result — and a canvas above the DOM would
  // paint its light over the label, which is what the old field did and what
  // the owner objected to.
  lightCanvas = document.createElement("canvas");
  lightCanvas.className = "sl-fx-glass__lit";
  lightCanvas.setAttribute("aria-hidden", "true");

  const handle = await bootLight({ canvas: lightCanvas, state: () => paneGeom, geom: paneRestGeom, tokens });
  if (!handle) {
    lightCanvas.remove();
    lightCanvas = null;
    return false;
  }
  light = handle;

  // Every pane that sits inside a declared backdrop gets a canvas of its own,
  // because its material — the bend, the Fresnel rim, the glare — is there
  // whether or not a pointer is. The rest keep the single shared canvas: with
  // nothing declared they have nothing to refract, so a canvas at rest would
  // hold an empty frame. track() refuses those on its own; the set below
  // records only the ones it took.
  //
  // Painted lazily, as each pane comes into view. A sweep of every pane at
  // mount is a measurable stall — 30 surfaces took roughly 0.6s in one go —
  // and most of them are below the fold at the time.
  const backdropPanes = [...document.querySelectorAll(PANE_HOSTS)]
    .filter((el) => el.closest("[data-sl-fx-backdrop]") && !el.closest('[data-sl-fx="off"]'));
  if (backdropPanes.length && typeof IntersectionObserver === "function") {
    const seen = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        light?.track(e.target).then((took) => { if (took) ownsLight.add(e.target); });
      }
    }, { rootMargin: NEAR_MARGIN });
    for (const el of backdropPanes) seen.observe(el);
  } else {
    for (const el of backdropPanes) {
      // eslint-disable-next-line no-await-in-loop -- one upload at a time is
      // the point: a parallel burst is the stall this avoids.
      if (await handle.track(el)) ownsLight.add(el);
    }
  }

  // data-sl-fx-gpu="on" is set inside the GPU module itself, on the first
  // frame it actually draws. This function only reports that the device and
  // pipeline came up.
  return true;
}
