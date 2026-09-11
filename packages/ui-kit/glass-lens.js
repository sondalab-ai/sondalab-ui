/* @sondalab/ui-kit — glass-lens.js
   A real refraction on an element that already exists.

   ADAPTED FROM shuding/liquid-glass, and the adaptation is deliberately thin:

     liquid-glass — https://github.com/shuding/liquid-glass
     MIT License · Copyright (c) 2025 Shu Ding
     Permission is hereby granted, free of charge, to any person obtaining a
     copy of this software and associated documentation files (the "Software"),
     to deal in the Software without restriction, including without limitation
     the rights to use, copy, modify, merge, publish, distribute, sublicense,
     and/or sell copies of the Software, and to permit persons to whom the
     Software is furnished to do so, subject to the following conditions:
     The above copyright notice and this permission notice shall be included in
     all copies or substantial portions of the Software.
     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
     FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
     DEALINGS IN THE SOFTWARE.

   WHAT IS HIS, VERBATIM: smoothStep, the rounded-rect SDF, the fragment, and
   the map builder — the normalisation (`maxScale *= 0.5`), the `scale` derived
   from the measured maximum displacement, and the SDF's own half-extents and
   radius. Those are load-bearing: a hand rewrite of the same idea (lab/1p)
   produced a filter that applied but never displaced, at any scale.

   WHAT IS OURS: the target. His file builds one fixed, draggable panel and
   puts the filter on that; this binds the filter to an element the consumer
   already wrote. The difference matters twice over —
     - his panel sits OVER a button, so the button's label refracts with the
       backdrop. Filtering the element itself leaves its content untouched,
       because backdrop-filter reaches only what is behind an element. AC-25
       holds by construction rather than by rule.
     - his drag reads getBoundingClientRect() and writes style.left/top, which
       are different coordinate spaces the moment the container is re-parented;
       moving it makes it jump on the first pointer movement. Never taking his
       container means never meeting that.

   WHY NOT THE GPU. This slice spent a day on a WebGPU lens and a capture-plate
   before it, on the strength of a ruling that said backdrop-filter displacement
   was inert in Chrome 152. It is not: that measurement was of liqui.design's
   filter, not of the browser. This costs nothing per frame — the map is built
   once per size, backdrop-filter is continuous, and the browser reapplies it
   itself. No render loop, no canvas per frame, no device to lose. */

/** @type {number} distinguishes one element's filter from another's */
let serial = 0;

/* ── his, verbatim ─────────────────────────────────────────────────────────── */

function smoothStep(a, b, t) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function length(x, y) {
  return Math.sqrt(x * x + y * y);
}

function roundedRectSDF(x, y, width, height, radius) {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/** His default fragment: how far each point of the backdrop is pulled toward
 *  the middle. The numbers are his and are not guesses to re-derive.
 *  @param {{x: number, y: number}} uv a point in the element, 0..1
 *  @returns {{x: number, y: number}} where that point samples from */
function fragment(uv) {
  const ix = uv.x - 0.5;
  const iy = uv.y - 0.5;
  const distanceToEdge = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
  const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15);
  const scaled = smoothStep(0, 1, displacement);
  return { x: ix * scaled + 0.5, y: iy * scaled + 0.5 };
}

/* ── ours: bind it to an element ───────────────────────────────────────────── */

/** Build the displacement map for a box, as a data: URI.
 *
 *  A data: URI and not an element reference: `feImage href="#id"` is silently
 *  ignored in Chrome, which is why an earlier attempt at this rendered nothing
 *  at all. Only the inline form displaces.
 *  @param {number} w width in CSS pixels
 *  @param {number} h height in CSS pixels
 *  @returns {{href: string, scale: number}} the map and the scale it implies */
function buildMap(w, h) {
  const data = new Uint8ClampedArray(w * h * 4);
  const raw = [];
  let maxScale = 0;

  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % w;
    const y = Math.floor(i / 4 / w);
    const pos = fragment({ x: x / w, y: y / h });
    const dx = pos.x * w - x;
    const dy = pos.y * h - y;
    maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
    raw.push(dx, dy);
  }
  maxScale *= 0.5;

  let index = 0;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (raw[index++] / maxScale + 0.5) * 255;
    data[i + 1] = (raw[index++] / maxScale + 0.5) * 255;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").putImageData(new ImageData(data, w, h), 0, 0);
  return { href: canvas.toDataURL(), scale: maxScale };
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Give an element a lens: what is behind it bends, what is inside it does not.
 *
 * @param {Element} el the element to filter. Its content is untouched. Its
 *   own background is cleared by glass.css's `.sl-glass.is-lensed` rule, not
 *   here — a stylesheet the consumer can read and override beats an inline
 *   style they cannot.
 * @param {{blur?: number, saturate?: number, brightness?: number, disperse?: number, reach?: number}} [look]
 *   the rest of the backdrop-filter chain, in his own proportions; `disperse`
 *   amplifies the IOR triple's ±0.02 — 18 puts a visible fringe on a button,
 *   0 is a lens with no glass in it; `reach` caps the bend in CSS pixels, so a
 *   card does not bend six times harder than a button just for being wider.
 * @returns {{refresh(): void, destroy(): void}|null} null where the browser
 *   cannot do it, in which case the element keeps the material glass.css gives
 *   it and nothing else changes.
 */
export function lens(el, look = {}) {
  if (typeof document === "undefined") return null;
  // Feature-detected, not assumed: Safari supports backdrop-filter but not an
  // SVG filter reference in one, and must fall through to the CSS material.
  if (!CSS.supports("backdrop-filter", "url(#x)")) return null;

  const { blur = 0.25, saturate = 1.1, brightness = 1.05, disperse = 18, reach = 6 } = look;
  const id = `sl-lens-${serial++}`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";

  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", `${id}_filter`);
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");

  const feImage = document.createElementNS(SVG_NS, "feImage");
  feImage.setAttribute("id", `${id}_map`);
  feImage.setAttribute("result", "map");

  /* ── DISPERSION: the prism ─────────────────────────────────────────────────
     One displacement moves every colour by the same amount, and that is a
     lens with no glass in it. Glass bends red less than blue, so a white light
     crossing an edge opens into a spectrum — the fringe the owner means when
     he says "prism". So: split the backdrop into its three channels, displace
     each with the SAME map at a DIFFERENT scale, and add them back.

     The ratio is glass-studio's IOR triple, N_R 0.98 / N_G 1.00 / N_B 1.02 —
     but amplified. On a 96x40 button the map's own scale is four or five
     pixels, and ±2% of that is a tenth of a pixel: physically faithful and
     invisible. `disperse` is the amplification, and it is a parameter rather
     than a constant because the right amount depends on how large the pane
     is, the way glass-studio's own "dispersion" knob does. */
  const channel = (name, r, g, b) => {
    const m = document.createElementNS(SVG_NS, "feColorMatrix");
    m.setAttribute("in", "SourceGraphic");
    m.setAttribute("type", "matrix");
    m.setAttribute("values", `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`);
    m.setAttribute("result", name);
    return m;
  };
  const displace = (input, result) => {
    const d = document.createElementNS(SVG_NS, "feDisplacementMap");
    d.setAttribute("in", input);
    d.setAttribute("in2", "map");
    d.setAttribute("xChannelSelector", "R");
    d.setAttribute("yChannelSelector", "G");
    d.setAttribute("result", result);
    return d;
  };
  const add = (a, b, result) => {
    const c = document.createElementNS(SVG_NS, "feComposite");
    c.setAttribute("in", a);
    c.setAttribute("in2", b);
    c.setAttribute("operator", "arithmetic");
    c.setAttribute("k1", "0"); c.setAttribute("k2", "1"); c.setAttribute("k3", "1"); c.setAttribute("k4", "0");
    c.setAttribute("result", result);
    return c;
  };
  const dispR = displace("chR", "dR");
  const dispG = displace("chG", "dG");
  const dispB = displace("chB", "dB");

  filter.append(
    feImage,
    channel("chR", 1, 0, 0), dispR,
    channel("chG", 0, 1, 0), dispG,
    channel("chB", 0, 0, 1), dispB,
    add("dR", "dG", "dRG"),
    add("dRG", "dB", "out"),
  );
  const defs = document.createElementNS(SVG_NS, "defs");
  defs.append(filter);
  svg.append(defs);
  document.body.append(svg);

  let last = "";

  /** Rebuild the map for the element's current size. Cheap to call: it returns
   *  immediately unless the box actually changed, and the box only changes on
   *  layout, never on scroll — an element and its backdrop scroll together, so
   *  there is nothing new behind it to bend.
   *  @returns {void} */
  function refresh() {
    const r = el.getBoundingClientRect();
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    if (!w || !h) return;
    const key = `${w}x${h}`;
    if (key === last) return;
    last = key;

    const { href, scale } = buildMap(w, h);
    filter.setAttribute("width", String(w));
    filter.setAttribute("height", String(h));
    feImage.setAttribute("width", String(w));
    feImage.setAttribute("height", String(h));
    feImage.setAttribute("href", href);
    // THE SCALE IS CAPPED. His map's displacement is a fraction of the box, so
    // it grows with the element: about 5px on a 96px button and about 30px on
    // a 500px card. A prism on a button is a wave on a card — the showcase's
    // live card bent the letters behind it as if under water, and nothing
    // about the light could be judged through that. Glass does not bend
    // more because the pane is larger; a real slab bends at its edge by a
    // fixed few pixels whatever its width. `reach` is that cap, in pixels.
    const capped = Math.min(scale, reach);
    // N_R 0.98 / N_G 1.00 / N_B 1.02, with the ±0.02 scaled up by `disperse`.
    dispR.setAttribute("scale", String(capped * (1 - 0.02 * disperse)));
    dispG.setAttribute("scale", String(capped));
    dispB.setAttribute("scale", String(capped * (1 + 0.02 * disperse)));
  }

  refresh();
  const watch = typeof ResizeObserver === "function" ? new ResizeObserver(refresh) : null;
  watch?.observe(el);

  el.classList.add("is-lensed");
  // The chain's numbers are var() fallbacks, not literals, so a surface can
  // ANIMATE them — a lens whose frost breathes is the difference between glass
  // and a photograph of glass. glass.css registers both with @property so a
  // transition or keyframe interpolates them instead of snapping.
  el.style.backdropFilter =
    `url(#${id}_filter) blur(var(--slg-lens-blur, ${blur}px)) ` +
    `saturate(var(--slg-lens-sat, ${saturate})) brightness(${brightness})`;

  return {
    refresh,
    destroy() {
      watch?.disconnect();
      svg.remove();
      el.classList.remove("is-lensed");
      el.style.removeProperty("backdrop-filter");
      if (!el.getAttribute("style")) el.removeAttribute("style");
    },
  };
}
