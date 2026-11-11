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
   A poster at seed 0 is left to the stylesheet, which already shows it.
   SCENE: the element's class (sl-art-poster--hills, sl-art-horizon--dawn);
   the seed only varies the picture of that scene. With two scene classes
   on one element the first in art-core.js's order wins.
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
/** Every custom property this file sets on a host. */
const LIVE = ["--_sl-art-live", "--_sl-art-live-bg", "--_sl-art-live-ink"];

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
  const drawn = new Map(); // element -> { kind: "poster" | "horizon", key: the picture it shows }
  let stopped = false;

  function poster(el, state) {
    const seed = seedOf(el.getAttribute(SEED)), name = sceneOf(el, POSTERS, "sl-art-poster");
    const key = seed ? `${name}:${seed}` : "";
    if (state.key === key) return;
    state.key = key;
    const url = key && urlOf(doc, renderPoster(name, seed), "colour");
    if (url) el.style.setProperty("--_sl-art-live", url);
    else el.style.removeProperty("--_sl-art-live");
  }

  function horizon(el, state) {
    const width = el.clientWidth;
    if (!width) return;
    const cols = Math.ceil(width / ART_CELL_PX / STEP) * STEP, seed = seedOf(el.getAttribute(SEED)), name = sceneOf(el, HORIZONS, "sl-art-horizon");
    const key = `${name}:${seed}:${cols}`;
    if (state.key === key) return;
    state.key = key;
    const picture = renderHorizon(name, cols, seed), place = `0 100% / ${cols * ART_CELL_PX}px ${picture.rows * ART_CELL_PX}px no-repeat`;
    const colour = urlOf(doc, picture, "colour");
    if (!colour) return;
    el.style.setProperty("--_sl-art-live-bg", `${colour} ${place}`);
    if (picture.ink >= 0) el.style.setProperty("--_sl-art-live-ink", `${urlOf(doc, picture, "ink")} ${place}`);
    else el.style.removeProperty("--_sl-art-live-ink");
  }

  const size = typeof ResizeObserver === "function" && new ResizeObserver((entries) => {
    for (const e of entries) if (drawn.get(e.target)?.kind === "horizon") horizon(e.target, drawn.get(e.target));
  });

  /** Forgets an element: its observer and every picture this file set on it. */
  function release(el) {
    if (drawn.get(el)?.kind === "horizon") size?.unobserve(el);
    drawn.delete(el);
    for (const v of LIVE) el.style.removeProperty(v);
  }

  /** Draws an element as what its class says it is now; an element that
   *  changed kind, or lost its class, first gives back what it held. */
  function adopt(el) {
    if (stopped) return;
    const kind = el.matches(HORIZON) ? "horizon" : el.matches(POSTER) ? "poster" : null;
    if (drawn.has(el) && drawn.get(el).kind !== kind) release(el);
    if (!kind) return;
    if (!drawn.has(el)) { drawn.set(el, { kind, key: null }); if (kind === "horizon") size?.observe(el); }
    (kind === "horizon" ? horizon : poster)(el, drawn.get(el));
  }

  function scan(n) {
    if (n.matches?.(`${POSTER}, ${HORIZON}`)) adopt(n);
    for (const el of n.querySelectorAll?.(`${POSTER}, ${HORIZON}`) ?? []) adopt(el);
  }

  scan(root);

  const changed = new MutationObserver((records) => {
    let removed = false;
    for (const r of records) {
      if (r.type === "attributes") { if (drawn.has(r.target) || r.target.matches?.(`${POSTER}, ${HORIZON}`)) adopt(r.target); continue; }
      for (const n of r.addedNodes) if (n.nodeType === 1) scan(n);
      removed ||= r.removedNodes?.length > 0;
    }
    if (removed) for (const el of [...drawn.keys()]) if (!el.isConnected) release(el);
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
