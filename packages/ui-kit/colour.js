/* @sondalab/ui-kit — colour.js (internal, not an export)
   The kit's one way to turn a CSS colour into sRGB numbers, shared by
   live-light.js and halftone.js. A computed colour is not always sRGB bytes:
   a colour mix or a relative colour serialises in Oklab or as a colour
   function, and reading its numbers as bytes gave black (spexr, 0.15.0). So
   it is painted on a one-pixel 2D canvas, which converts any CSS colour to
   sRGB, and the pixel is read back. One canvas per document. */

const swatches = new WeakMap();

/**
 * Any CSS colour string, as sRGB 0–1, painted and read back. `[0, 0, 0]`
 * where a 2D context is unavailable.
 * @param {Document} doc @param {string} css
 * @returns {[number, number, number]}
 */
export function toSrgb(doc, css) {
  let g = swatches.get(doc);
  if (g === undefined) {
    g = doc.createElement("canvas").getContext("2d", { willReadFrequently: true });
    swatches.set(doc, g);
  }
  if (!g) return [0, 0, 0];
  g.clearRect(0, 0, 1, 1);
  g.fillStyle = css;
  g.fillRect(0, 0, 1, 1);
  const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
  return [r / 255, gr / 255, b / 255];
}

/**
 * A role variable's resolved sRGB, read through a probe element on `host`,
 * so a band or a product override that remaps the role is followed.
 * @param {Element} host @param {string} prop e.g. "--slc-accent"
 * @returns {[number, number, number]}
 */
export function roleColour(host, prop) {
  const doc = host.ownerDocument;
  const probe = doc.createElement("span");
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${prop})`;
  host.append(probe);
  const css = getComputedStyle(probe).color;
  probe.remove();
  return toSrgb(doc, css);
}
