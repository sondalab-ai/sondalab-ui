/* @sondalab/ui-kit — signal.js
   The signal strip: every canvas[data-sl-signal] under a root becomes a
   dithered ramp, empty at the left and solid at the right, drawn in 3px cells
   (dither-core.js: CELL_PX, rampFrame).

     <canvas class="sl-signal" data-sl-signal data-sl-signal-level="0.6"
             aria-hidden="true"></canvas>

   SIZE: the canvas's CSS box, at device resolution (devicePixelRatio, capped
   at 2). Each lit cell is one CELL_PX-square rect, snapped to device pixels.
   LEVEL: data-sl-signal-level, 0..1, default 1: how much of the width the
   ramp fills (a bad value falls back to 1).
   COLOUR: the canvas's own computed `color`, read with getComputedStyle; this
   file holds no colour. Cells that are off stay transparent: no ground is
   ever painted, so the strip sits on whatever is behind it. A theme change
   (data-sl-theme on <html>, or a class or data-sl-theme on an ancestor
   inside the root) repaints it.
   MOTION: none. The strip never animates, so prefers-reduced-motion and
   data-sl-fx-still have nothing to hold and are not read.
   FORCED COLOURS: nothing is drawn; components.css paints the strip as a
   solid CanvasText bar instead. */

import { CELL_PX, rampFrame } from "./dither-core.js";

const SEL = "canvas[data-sl-signal]";
const MAX_DPR = 2;
const FORCED = "(forced-colors: active)";

/** The ramp level of a canvas: data-sl-signal-level clamped to 0..1, else 1. */
function levelOf(canvas) {
  const raw = canvas.getAttribute("data-sl-signal-level");
  const n = raw === null || raw.trim() === "" ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
}

/**
 * Draws one strip: sizes the backing store from the CSS box at DPR (capped at
 * 2), clears it, and fills each lit ramp cell with the element's own colour.
 * Draws nothing when `forced` is true or the box has no size.
 */
function draw(canvas, forced) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(MAX_DPR, globalThis.devicePixelRatio || 1);
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, pw, ph);
  if (forced) return;
  const cols = Math.ceil(w / CELL_PX);
  const rows = Math.ceil(h / CELL_PX);
  const on = rampFrame({ cols, rows }, levelOf(canvas));
  const cell = CELL_PX * dpr;
  g.fillStyle = getComputedStyle(canvas).color;
  for (let j = 0; j < rows; j++) {
    const y0 = Math.round(j * cell);
    const y1 = Math.min(ph, Math.round((j + 1) * cell));
    for (let i = 0; i < cols; i++) {
      if (!on[j * cols + i]) continue;
      const x0 = Math.round(i * cell);
      g.fillRect(x0, y0, Math.min(pw, Math.round((i + 1) * cell)) - x0, y1 - y0);
    }
  }
}

/**
 * Arms every `canvas[data-sl-signal]` under `root` (`data-sl-signal-level`
 * 0..1, default 1) and follows canvases added later, resizes, theme changes
 * and forced colours. `mount()` does not call this; call it yourself.
 * @param {Document|Element} [root]
 * @returns {{stop(): void}}
 */
export function mountSignals(root = document) {
  const doc = root.ownerDocument || root;
  const html = doc.documentElement;
  const strips = new Set();
  const forced = globalThis.matchMedia?.(FORCED) ?? { matches: false };
  let stopped = false;

  const paint = (c) => draw(c, forced.matches);
  const repaintAll = () => { for (const c of strips) paint(c); };

  const size = typeof ResizeObserver === "function" && new ResizeObserver((entries) => {
    for (const e of entries) if (strips.has(e.target)) paint(e.target);
  });

  function adopt(c) {
    if (stopped || strips.has(c)) return;
    strips.add(c);
    if (size) size.observe(c);
    paint(c);
  }

  function scan(n) {
    if (n.matches?.(SEL)) adopt(n);
    for (const c of n.querySelectorAll?.(SEL) ?? []) adopt(c);
  }

  scan(root);

  const changed = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") {
        if (r.target === html && r.attributeName === "data-sl-theme") continue;
        if (r.target === html || r.attributeName === "data-sl-signal-level") repaintAll();
        else for (const c of strips) if (r.target.contains(c)) paint(c);
        continue;
      }
      for (const n of r.addedNodes) if (n instanceof Element) scan(n);
      for (const c of strips) if (!c.isConnected) { strips.delete(c); size?.unobserve(c); }
    }
  });
  changed.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-sl-theme", "class", "data-sl-signal-level"] });
  // `theme` owns data-sl-theme on <html>; `changed` skips it so a root that
  // contains <html> (the document) does not repaint twice for one change.
  const theme = new MutationObserver(repaintAll);
  theme.observe(html, { attributes: true, attributeFilter: ["data-sl-theme"] });

  const faded = (e) => { if (e.propertyName === "color") for (const c of strips) if (e.target.contains(c)) paint(c); };
  root.addEventListener("transitionend", faded);
  forced.addEventListener?.("change", repaintAll);

  return {
    stop() {
      stopped = true;
      size?.disconnect();
      changed.disconnect();
      theme.disconnect();
      root.removeEventListener("transitionend", faded);
      forced.removeEventListener?.("change", repaintAll);
    },
  };
}
