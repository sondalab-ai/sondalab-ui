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
 *  neck has to stay in proportion — "molto leggero". The intercept places
 *  the slope's midpoint at alpha 0.5, so a straight edge of the goo lands
 *  exactly on the source edge (the reference's 5/12 formula puts it at
 *  0.42, a dilation of a fraction of a pixel that would pop on hover). */
const GOO_BLUR = 4;
const GOO_CONTRAST = 18;
const GOO_INTERCEPT = -(GOO_CONTRAST / 2 - 0.5);
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

/** A corner radius from its computed string, resolved against the box the way
 *  CSS does: a percentage is of the shorter side (right for a pill or a
 *  circle, the two shapes a percentage is written for), and the result is
 *  CLAMPED to half that side.
 *
 *  The clamp is not a safety net, it is the rule. CSS reduces every radius
 *  proportionally when two on the same side would overlap, so a uniform
 *  `border-radius: 9999px` on a 40px button paints a 20px circle. Without the
 *  clamp the skin traced its outline against 9999px, `nearestEdge` returned a
 *  point on that imaginary shape, and the drop was written thousands of pixels
 *  from the element — which is why the gooey read as absent on exactly the
 *  round buttons it is meant for: `--sl-radius-pill` is 9999px.
 *  @param {string} raw the computed border-*-radius string
 *  @param {number} w the box width in CSS pixels
 *  @param {number} h the box height in CSS pixels
 *  @returns {number} the radius the browser actually paints, in CSS pixels */
function cornerPx(raw, w, h) {
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return 0;
  const shortest = Math.min(w, h);
  return Math.min(raw.trimEnd().endsWith("%") ? (v / 100) * shortest : v, shortest / 2);
}

/** The rounded box as a path, radii scaled down together when they would
 *  overlap — the same clamp CSS applies to border-radius. */
function roundedRectPath(w, h, [tl, tr, br, bl]) {
  const f = Math.min(1, w / Math.max(1e-6, tl + tr), w / Math.max(1e-6, bl + br), h / Math.max(1e-6, tl + bl), h / Math.max(1e-6, tr + br));
  tl *= f; tr *= f; br *= f; bl *= f;
  return `M ${tl} 0 H ${w - tr} A ${tr} ${tr} 0 0 1 ${w} ${tr} V ${h - br} A ${br} ${br} 0 0 1 ${w - br} ${h} H ${bl} A ${bl} ${bl} 0 0 1 0 ${h - bl} V ${tl} A ${tl} ${tl} 0 0 1 ${tl} 0 Z`;
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
const PANE_TAU_IN = 0.08;
const PANE_TAU_OUT = 0.14;
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
}

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

  // Before data-sl-fx="on" goes up: the arc's sweep and its bloom's sweep
  // start on the same frame, so the two stay in phase. Elements that arrive
  // later get theirs as they arrive.
  injectGlassLayers(root);
  armLenses(root);
  watchLensTheme(root);
  injectGlows(root);
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) {
      injectGlassLayers(n);
      armLenses(n);
      injectGlows(n);
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
    }, { rootMargin: "200px" });
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
