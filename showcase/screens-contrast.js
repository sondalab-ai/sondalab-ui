/* Contrast maths for the screens stage (screens.js), its frames and their
   tests. Pure functions on colours as [r, g, b, a] (channels 0–255, alpha
   0–1); no DOM. A classic script that also loads as an ES module, because it
   has no import or export: either way it publishes globalThis.slContrast. */
(function (root) {
  /** WCAG 2 relative luminance of an sRGB colour [r, g, b], channels 0–255.
   *  Alpha is ignored: composite with over() first. */
  function luminance(c) {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }

  /** WCAG 2 contrast ratio of two opaque colours, from 1 to 21, at full
   *  precision. Compare this against a threshold; round only to display it. */
  function ratio(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /** Colour t painted over the opaque colour u (source-over), as an opaque
   *  colour. A missing alpha on t counts as 1. */
  function over(t, u) {
    const a = t[3] == null ? 1 : t[3];
    return [t[0] * a + u[0] * (1 - a), t[1] * a + u[1] * (1 - a), t[2] * a + u[2] * (1 - a), 1];
  }

  /** The rings in a computed box-shadow: outer shadows with no offset and no
   *  blur and a positive spread, which paint a solid band around the box.
   *  Returns [{ color, spread }], color as the serialised CSS colour. Any
   *  colour function is accepted (rgb, oklch, color(srgb …)); insets are not. */
  function rings(boxShadow) {
    if (!boxShadow || boxShadow === "none") return [];
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i <= boxShadow.length; i++) {
      const ch = boxShadow[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if ((ch === "," && depth === 0) || i === boxShadow.length) { parts.push(boxShadow.slice(start, i).trim()); start = i + 1; }
    }
    const out = [];
    for (const part of parts) {
      if (/\binset\b/.test(part)) continue;
      const color = part.match(/[a-z-]+\([^()]*\)|#[0-9a-f]{3,8}\b/i);
      if (!color) continue;
      const lengths = part.replace(color[0], " ").match(/-?\d*\.?\d+(?:px)?/g) || [];
      const [x = 0, y = 0, blur = 0, spread = 0] = lengths.map(parseFloat);
      if (x === 0 && y === 0 && blur === 0 && spread > 0) out.push({ color: color[0], spread });
    }
    return out;
  }

  /** A ratio for display, floored to two decimals, so a value below a
   *  threshold never reads as one that meets it (4.499 shows 4.49, not 4.50). */
  function display(v) {
    // the epsilon keeps a float like 4.35 * 100 = 434.999… from flooring a step low
    return (Math.floor(v * 100 + 1e-9) / 100).toFixed(2);
  }

  root.slContrast = { luminance, ratio, over, rings, display };
})(globalThis);
