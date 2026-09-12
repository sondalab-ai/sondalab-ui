/* @sondalab/ui-kit — goo-field.js
   The shared gooey field: several elements read as ONE SUBSTANCE.

   Contract: docs/specs/2026-09-08-effects-layer-design.md

   WHY THIS IS NOT sl-fx-liquid. The liquid parents one <svg> INTO its host,
   aligned to that host's border box, and deforms it under the pointer — "you
   are recognised". It is structurally incapable of merging with a neighbour,
   because two silhouettes can only weld if they are in the SAME filter
   coordinate space. So this family inverts the ownership: a declared
   CONTAINER owns one field, every member contributes its silhouette to it in
   the container's coordinates, and one goo filter runs over the group. The
   meaning is different too — not "you are recognised" but "these belong to
   one another" — which is why it is a family and not a looser gate on the
   liquid.

   WHAT IS UNCHANGED. The goo is on a SILHOUETTE LAYER BELOW THE CONTENT, the
   way libraries.dev/gooey does it and the way the spec has required twice:
   the real DOM rides crisp on top and is never filtered. A member contributes
   its rounded box, dilated by a few pixels so the substance peeks out as a
   rim; its text, its border and its own background are untouched.

   COLOUR. Each member's silhouette is painted in that member's own computed
   background colour, so hover and active states stay the component's. The goo
   chain blurs premultiplied RGBA and then steepens ONLY the alpha, so where
   two members weld their colours blend across the neck on their own — no GPU,
   no gradient, no second pass. A member with no fill of its own (a ghost
   button, a field) falls back to the field's declared --slfx-goo-fill.
   sl-audit reads CSS only, so there is no colour literal in this file:
   every value is read from a computed style or from a --slfx-* binding. */

import { cornerPx, roundedRectPathAt, fieldOrigin, memberShape, weldSigma, filterRegion } from "./geom.js";

const NS = "http://www.w3.org/2000/svg";

/** What contributes a silhouette. A member is MARKED IN THE MARKUP, never
 *  inferred from "every child of the container": the same ruling that made the
 *  liquid's --drop a class rather than a measured radius. A heuristic — every
 *  child, or every child above some size — misfires the moment a consumer
 *  wraps two members in a layout div, and the author loses the ability to keep
 *  one control out of the substance. */
const MEMBERS = ".sl-fx-goo__member";

/** The goo: the alpha slope's steepness and the intercept that puts its
 *  midpoint at alpha 0.5. libraries.dev/gooey's own numbers, and the same pair
 *  the liquid's skin uses — one house goo, so a round button that is both a
 *  liquid host and a field member necks the same way in both. */
const GOO_CONTRAST = 18;
const GOO_INTERCEPT = -(GOO_CONTRAST / 2 - 0.5);

/** Conservative defaults, so a container that opts in without binding anything
 *  renders the most restrained version of the effect rather than a broken one.
 *  effects.css declares both; these exist for a caller that reaches for the
 *  module directly. */
const REACH_FALLBACK = 3;
const WELD_FALLBACK = 14;

let fieldSeq = 0;

/** Read a length binding off the container, in CSS pixels.
 *  @param {CSSStyleDeclaration} cs the container's computed style
 *  @param {string} name the custom property
 *  @param {number} fallback used when the property is unset or unparseable
 *  @returns {number} */
function lengthVar(cs, name, fallback) {
  const v = parseFloat(cs.getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
}

/** Whether a computed colour has zero alpha, without naming a colour syntax.
 *  getComputedStyle returns either a comma form ending in the alpha or a
 *  slash form; both are matched by position rather than by function name, so
 *  this keeps working as Chrome moves its serialisation to color().
 *  @param {string} c a computed colour string
 *  @returns {boolean} */
function isClear(c) {
  const m = /\/\s*([\d.]+)%?\s*\)\s*$/.exec(c) || /,\s*([\d.]+)\s*\)\s*$/.exec(c);
  return m ? parseFloat(m[1]) === 0 : false;
}

/** The four painted radii of an element, clockwise from top-left.
 *  @param {CSSStyleDeclaration} cs the element's computed style
 *  @param {number} w its border-box width
 *  @param {number} h its border-box height
 *  @returns {number[]} */
function radiiOf(cs, w, h) {
  return [
    cornerPx(cs.borderTopLeftRadius, w, h),
    cornerPx(cs.borderTopRightRadius, w, h),
    cornerPx(cs.borderBottomRightRadius, w, h),
    cornerPx(cs.borderBottomLeftRadius, w, h),
  ];
}

/**
 * Give a container one shared gooey field: its marked members stop reading as
 * separate boxes and start reading as one substance, welding where they come
 * within the declared gap of each other.
 *
 * Nothing is written to a member. The field is an injected first child that
 * takes no pointer, holds no text, and is removed entirely by destroy().
 *
 * @param {Element} container an element carrying .sl-fx-goo
 * @returns {{measure: () => void, destroy: () => void} | null} a handle, or
 *   null if the container is not eligible (already has a field, or sits under
 *   the subtree opt-out)
 */
export function gooField(container) {
  if (!(container instanceof Element) || !container.isConnected) return null;
  if (container.querySelector(":scope > .sl-fx-goo__field")) return null;
  if (container.closest('[data-sl-fx="off"]')) return null;

  const id = `slfx-goo-${++fieldSeq}`;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "sl-fx-goo__field");
  svg.setAttribute("aria-hidden", "true");
  // sRGB, not the SVG default of linearRGB: the alpha slope would otherwise be
  // applied after a gamma decode that also shifts every blended colour in the
  // neck away from what the CSS around it paints.
  svg.innerHTML = `
    <defs>
      <filter id="${id}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${GOO_CONTRAST} ${GOO_INTERCEPT}" />
      </filter>
    </defs>
    <g filter="url(#${id})"></g>`;
  const filter = svg.querySelector("filter");
  const blur = svg.querySelector("feGaussianBlur");
  const group = svg.querySelector("g");
  container.prepend(svg);

  let members = [];
  let paths = [];
  let alive = true;

  /** Match the pool of <path> elements to the number of members. */
  function resize(n) {
    while (paths.length < n) {
      const p = document.createElementNS(NS, "path");
      group.append(p);
      paths.push(p);
    }
    while (paths.length > n) paths.pop().remove();
  }

  /** Read every member's own computed background and write it as its
   *  silhouette's fill. Geometry is untouched, so this is what a hover or an
   *  active state costs. */
  function paint(fallback) {
    for (let i = 0; i < members.length; i++) {
      const own = getComputedStyle(members[i]).backgroundColor;
      paths[i].setAttribute("fill", isClear(own) ? fallback : own);
    }
  }

  /** Re-read the layout and rebuild every silhouette. Called on mount, on a
   *  resize of the container or any member, and whenever members are added or
   *  removed. Not called per frame: a laid-out field is static. */
  function measure() {
    if (!alive) return;
    members = [...container.querySelectorAll(MEMBERS)];
    resize(members.length);
    if (!members.length) return;

    const cs = getComputedStyle(container);
    const reach = lengthVar(cs, "--slfx-goo-reach", REACH_FALLBACK);
    const weld = lengthVar(cs, "--slfx-goo-weld", WELD_FALLBACK);
    const fallback = cs.getPropertyValue("--slfx-goo-fill").trim() || cs.backgroundColor;
    const sigma = weldSigma(weld);

    const origin = fieldOrigin(
      container.getBoundingClientRect(),
      parseFloat(cs.borderLeftWidth) || 0,
      parseFloat(cs.borderTopWidth) || 0,
    );

    const shapes = members.map((el) => {
      const rect = el.getBoundingClientRect();
      const radii = radiiOf(getComputedStyle(el), rect.width, rect.height);
      return memberShape(rect, origin, radii, reach);
    });

    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      paths[i].setAttribute("d", roundedRectPathAt(s.x, s.y, s.w, s.h, s.radii));
    }
    blur.setAttribute("stdDeviation", sigma.toFixed(3));

    const region = filterRegion(shapes, sigma);
    filter.setAttribute("x", region.x.toFixed(2));
    filter.setAttribute("y", region.y.toFixed(2));
    filter.setAttribute("width", region.width.toFixed(2));
    filter.setAttribute("height", region.height.toFixed(2));

    paint(fallback);
  }

  // The substance is static once laid out, so there is no animation frame at
  // rest. The one thing that does change without a layout change is a member's
  // own colour — a hover or an active state, usually through a transition, and
  // a rim still painted in the resting colour reads as a misprint. So colours
  // are re-read per frame WHILE THE POINTER IS IN THE CONTAINER, and not
  // otherwise. Geometry is not touched by this loop.
  let raf = 0;
  const tick = () => {
    if (!alive) return;
    const cs = getComputedStyle(container);
    paint(cs.getPropertyValue("--slfx-goo-fill").trim() || cs.backgroundColor);
    raf = requestAnimationFrame(tick);
  };
  const onEnter = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const onLeave = (e) => {
    // Delegated: pointerleave fires for every descendant as the pointer moves
    // between members. Only the container's own leave ends the substance's
    // colour tracking — the same guard the liquid and the pane both carry.
    if (e.target !== container) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };
  container.addEventListener("pointerenter", onEnter, { passive: true });
  container.addEventListener("pointerleave", onLeave, { capture: true, passive: true });

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : null;
  // measure() adds and removes <path> elements, which are themselves childList
  // mutations inside the container — so a callback that did not exclude the
  // field's own subtree would re-enter itself forever. The field is the one
  // subtree its own observer must not see.
  const mo = typeof MutationObserver === "function"
    ? new MutationObserver((records) => {
        if (!records.some((r) => r.target !== svg && !svg.contains(r.target))) return;
        observeMembers();
        measure();
      })
    : null;

  /** Watch every member's box, not only the container's: a member can change
   *  size on its own (a button whose label loads, an image that decodes) with
   *  the container's own box never moving. */
  function observeMembers() {
    if (!ro) return;
    ro.disconnect();
    ro.observe(container);
    for (const el of container.querySelectorAll(MEMBERS)) ro.observe(el);
  }

  observeMembers();
  mo?.observe(container, { childList: true, subtree: true });
  measure();
  container.classList.add("is-goo-live");

  return {
    measure,
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mo?.disconnect();
      container.removeEventListener("pointerenter", onEnter);
      container.removeEventListener("pointerleave", onLeave, { capture: true });
      container.classList.remove("is-goo-live");
      svg.remove();
    },
  };
}
