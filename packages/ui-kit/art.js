/* @sondalab/ui-kit — art.js
   The procedural art in the browser: a poster with a seed gets its own
   picture, and every horizon is drawn at its real width, so it never repeats.

     <div class="sl-art-poster sl-art-poster--hills" data-sl-art-seed="7" aria-hidden="true"></div>
     <section class="sl-art-horizon" data-sl-art-seed="blog"> … </section>

   WITHOUT THIS FILE the art still shows: components.css ships seed 0 of every
   poster and a repeating tile of every horizon. mountArt() only replaces
   those pictures; it adds no element and changes no box.
   SEED: data-sl-art-seed. A whole number is itself; any other text is hashed
   to one (art-core.js: seedOf); 0, empty or absent is the canonical picture.
   A poster with no seed is left to the stylesheet.
   HOW: the picture is drawn by art-core.js, encoded with a canvas that never
   enters the document, and set on the host as a custom property the
   stylesheet's pseudo-element reads first (--_sl-art-live and, on a horizon,
   --_sl-art-live-bg and --_sl-art-live-ink).
   COLOUR: this file holds none. The pictures' colours are art-core.js's fixed
   palettes; a horizon's ink is a mask the stylesheet paints from --slc-text,
   so a theme change needs no redraw.
   MOTION: none. HIGH CONTRAST AND FORCED COLOURS: the stylesheet removes the
   art there; what this file set is not painted. */

import { ART_CELL_PX, POSTERS, HORIZONS, renderPoster, renderHorizon, seedOf, toRgba } from "./art-core.js";

const POSTER = ".sl-art-poster", HORIZON = ".sl-art-horizon", SEED = "data-sl-art-seed";
/** A horizon is redrawn when its width crosses a step of this many cells. */
const STEP = 16;

/** The scene an element wears: the first `prefix--name` class of `scenes`, else the first scene. */
function sceneOf(el, scenes, prefix) {
  const names = Object.keys(scenes);
  return names.find((n) => el.classList.contains(`${prefix}--${n}`)) ?? names[0];
}

/** A picture's layer as a CSS url() of a PNG, or null where no canvas can encode one. */
function urlOf(doc, picture, layer) {
  const canvas = doc.createElement("canvas");
  canvas.width = picture.cols;
  canvas.height = picture.rows;
  const g = canvas.getContext?.("2d");
  if (!g) return null;
  const image = g.createImageData(picture.cols, picture.rows);
  image.data.set(toRgba(picture, layer));
  g.putImageData(image, 0, 0);
  return `url("${canvas.toDataURL("image/png")}")`;
}

/**
 * Draws the art under `root` and follows elements added later, seed and
 * class changes, and a horizon's width. A poster needs `data-sl-art-seed`;
 * a horizon is always drawn. `mount()` does not call this; call it yourself.
 * @param {Document|Element} [root]
 * @returns {{stop(): void}}
 */
export function mountArt(root = document) {
  const doc = root.ownerDocument || root;
  const drawn = new Map(); // element -> the key of the picture it shows
  let stopped = false;

  function poster(el) {
    const raw = el.getAttribute(SEED), seed = seedOf(raw), name = sceneOf(el, POSTERS, "sl-art-poster");
    const key = raw === null ? "" : `${name}:${seed}`;
    if (drawn.get(el) === key) return;
    drawn.set(el, key);
    const url = key && urlOf(doc, renderPoster(name, seed), "colour");
    if (url) el.style.setProperty("--_sl-art-live", url);
    else el.style.removeProperty("--_sl-art-live");
  }

  function horizon(el) {
    const width = el.clientWidth;
    if (!width) return;
    const cols = Math.ceil(width / ART_CELL_PX / STEP) * STEP, seed = seedOf(el.getAttribute(SEED)), name = sceneOf(el, HORIZONS, "sl-art-horizon");
    const key = `${name}:${seed}:${cols}`;
    if (drawn.get(el) === key) return;
    drawn.set(el, key);
    const picture = renderHorizon(name, cols, seed), place = `0 100% / ${cols * ART_CELL_PX}px ${picture.rows * ART_CELL_PX}px no-repeat`;
    const colour = urlOf(doc, picture, "colour");
    if (!colour) return;
    el.style.setProperty("--_sl-art-live-bg", `${colour} ${place}`);
    if (picture.ink >= 0) el.style.setProperty("--_sl-art-live-ink", `${urlOf(doc, picture, "ink")} ${place}`);
    else el.style.removeProperty("--_sl-art-live-ink");
  }

  const size = typeof ResizeObserver === "function" && new ResizeObserver((entries) => {
    for (const e of entries) if (drawn.has(e.target)) horizon(e.target);
  });

  function adopt(el) {
    if (stopped) return;
    if (el.matches(HORIZON)) { if (!drawn.has(el)) { drawn.set(el, ""); size?.observe(el); } horizon(el); }
    else if (el.matches(POSTER)) poster(el);
  }

  function scan(n) {
    if (n.matches?.(`${POSTER}, ${HORIZON}`)) adopt(n);
    for (const el of n.querySelectorAll?.(`${POSTER}, ${HORIZON}`) ?? []) adopt(el);
  }

  scan(root);

  const changed = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") { if (r.target.matches?.(`${POSTER}, ${HORIZON}`)) adopt(r.target); continue; }
      for (const n of r.addedNodes) if (n instanceof Element) scan(n);
      for (const el of drawn.keys()) if (!el.isConnected) { drawn.delete(el); size?.unobserve(el); }
    }
  });
  changed.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [SEED, "class"] });

  return {
    stop() {
      stopped = true;
      size?.disconnect();
      changed.disconnect();
    },
  };
}
