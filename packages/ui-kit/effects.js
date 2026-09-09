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
 *  `--calm` for a container (a fraction of it) — never a measured radius: a
 *  geometric heuristic misfires the moment a component re-parametrises its
 *  own --sl-radius-*, and not breaking under that is a promise this layer
 *  has made twice. A bare .sl-fx-liquid is inert at this tier. */
const LIQUID_HOSTS = ".sl-fx-liquid:is(.sl-fx-liquid--drop, .sl-fx-liquid--calm)";
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
const GOO_BLEND = GOO_BLUR * 1.5;
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

/** A corner radius from its computed string, resolved against the box the
 *  way CSS does: a percentage is of the shorter side (right for a pill or a
 *  circle, the two shapes a percentage is written for). */
function cornerPx(raw, w, h) {
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return 0;
  return raw.trimEnd().endsWith("%") ? (v / 100) * Math.min(w, h) : v;
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
 *  still across the middle. A calm element takes a fraction of the swell. */
const DROP_K = 0.35;
const DROP_MIN = 10;
const DROP_MAX = 16;
const BULGE_K = 0.24;
const REACH_K = 1.5;
const DROP_CALM = 0.4;

let amp = 0, ampV = 0, target = 0;
let lagX = 0, lagY = 0;              // CSS px, within the live element's own box
let pointerX = 0, pointerY = 0;
let liquidLiveEl = null;
let liquidBox = null;                // { w, h, radii, border, drop, bulge, reach }
let liquidDrop = { x: 0, y: 0, r: 0 };
let liquidRafId = 0;
let liquidPrevT = 0;

/** What the pointer is currently shaping, for the chrome tier: the element,
 *  the drop's centre in viewport px, its radius (0 while it is not
 *  protruding), and the smooth-union radius that matches the goo's neck —
 *  the shader welds the same circle onto the same box (effects-shader.js,
 *  `edgeAt`), so the hairline follows the silhouette. */
function liquidState() {
  if (!liquidLiveEl) return { el: null, radius: 0, blend: 0, x: 0, y: 0 };
  const r = liquidLiveEl.getBoundingClientRect();
  return { el: liquidLiveEl, radius: liquidDrop.r, blend: GOO_BLEND, x: r.left + liquidDrop.x, y: r.top + liquidDrop.y };
}

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
  const bulge = drop * BULGE_K * (el.classList.contains("sl-fx-liquid--calm") ? DROP_CALM : 1);
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

function setPaneLive(el) {
  if (paneEl === el) return;
  if (paneEl) {
    paneEl.classList.remove("is-glass-lit");
    for (const k of ["--slfx-px", "--slfx-py", "--slfx-ptr", "--slfx-lit"]) paneEl.style.removeProperty(k);
    // Leave no empty style="" behind on an element that had none.
    if (!paneEl.getAttribute("style")) paneEl.removeAttribute("style");
  }
  paneEl = el;
  paneLit = 0;
  if (el) el.classList.add("is-glass-lit");
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
  paneTarget = 1;
  ensurePaneLoop();
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
const GLOW_HOSTS = ".sl-fx-aurora:not(.sl-fx-aurora--linear)";

function injectGlow(el) {
  for (const child of el.children) {
    if (child.classList.contains("sl-fx-aurora__glow")) return;
  }
  const glow = document.createElement("span");
  glow.className = "sl-fx-aurora__glow";
  glow.setAttribute("aria-hidden", "true");
  el.appendChild(glow);
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
  injectGlows(root);
  new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) injectGlows(n);
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
  // stays true once set. bootField() additionally tears the field down if the
  // switch happens while it is already live.
  if (typeof document === "undefined") return false;
  if (document.documentElement.getAttribute("data-sl-theme") === "high-contrast") return false;

  // Dynamic import, so a consumer that never calls mountGpu() never loads
  // the GPU module or the shader. This import only ever pulls in
  // ./effects-gpu.js and ./effects-shader.js — vgpu itself (an optional
  // PEER dependency, installed only if the consumer asks for it) is
  // imported inside bootField()'s own try/catch, which is where a missing
  // peer degrades to Tier 1. The catch here covers a bundler that fails to
  // resolve the kit's own module, nothing else.
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
  // down. liquidState is how the chrome learns where the silhouette swells.
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
