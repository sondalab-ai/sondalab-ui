import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { fromHex, fromOklch, linToOklab, maxChroma, toHex, toOklch } from "./lib/css-color.mjs";

// Reads the GENERATED css, so it follows a token wherever gen-css emits it
// (the viz ramp may live in tokens.css or in the theme files). Status text sits
// directly on the ground (the badge has no fill), so the grounds are the pair.

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const vars = (f) => Object.fromEntries(
  [...readFileSync(resolve(KIT, f), "utf8").matchAll(/(--sl-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)]
    .map((m) => [m[1], m[2]]),
);
const shared = vars("tokens.css");
const lin2g = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const Y = (hex) => { const [r, g, b] = fromHex(hex).lin; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };

const STATUS = ["success", "warning", "danger", "info"].map((s) => `--sl-status-${s}`);
const CODE_TEXT = ["fg", "keyword", "string", "number", "boolean", "function", "tag", "builtin"].map((s) => `--sl-code-${s}`);
const CODE_QUIET = ["--sl-code-comment", "--sl-code-null"];
const VIZ = [...Array(8).keys()].map((i) => `--sl-viz-${i}`);
const lerp = (a, b, p) => { const x = fromHex(a).lin.map(lin2g), y = fromHex(b).lin.map(lin2g);
  return "#" + x.map((v, i) => Math.round((v + (y[i] - v) * p) * 255).toString(16).padStart(2, "0")).join(""); };

// Since 0.29 every product has its own neutrals (its accent hue, baked to hex
// in neutrals.json), so every floor below is held on EVERY product's grounds,
// the new tile and sunken grounds included. A product that inherits another's
// accent bakes the same values (neutrals-ladder.test.mjs), so it is skipped.
const NEUTRALS = JSON.parse(readFileSync(resolve(KIT, "neutrals.json"), "utf8"));
const PRODUCTS = Object.entries(NEUTRALS.products).filter(([, p]) => !p.inherits);
const GROUNDS = ["bg-canvas", "bg-surface", "bg-surface-raised", "bg-tile", "bg-sunken"].map((r) => `--sl-${r}`);
/** The inversion band's text inks, as fractions of its foreground (its page's
 *  canvas) over its ground (its page's primary text), read off components.css. */
const BAND_INKS = (() => {
  const band = readFileSync(resolve(KIT, "components.css"), "utf8").match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  const pct = (role) => Number(band.match(new RegExp(`--slc-${role}:\\s*color-mix\\(in srgb, currentColor (\\d+)%, transparent\\)`))?.[1]) / 100;
  return { muted: pct("text-muted"), secondary: pct("text-secondary") };
})();
/** The theme's generated tokens with one product's neutrals in place. */
const productTokens = (theme, p) => ({
  ...shared,
  ...vars(`themes/${theme}.css`),
  ...Object.fromEntries(Object.entries(p[theme]).filter(([, v]) => v.startsWith("#")).map(([k, v]) => [`--sl-${k}`, v])),
});

test("the default product's neutrals are the ones the theme files ship", () => {
  for (const theme of ["light", "dark"]) {
    const t = vars(`themes/${theme}.css`);
    for (const [role, v] of Object.entries(NEUTRALS.products.default[theme])) {
      if (v.startsWith("#")) assert.equal(t[`--sl-${role}`], v, `${theme} ${role}`);
    }
  }
});

for (const theme of ["light", "dark"]) for (const [product, p] of PRODUCTS) {
  const t = productTokens(theme, p);
  const hex = (n) => {
    assert.ok(t[n], `${n} is not a 6-digit hex in the generated ${theme} css`);
    return t[n];
  };
  const below = (names, min, over = (bg) => hex(bg)) => GROUNDS.flatMap((bg) => names
    .map((n) => [n, ratio(hex(n), over(bg, n))])
    .filter(([, r]) => r < min)
    .map(([n, r]) => `${n} on ${bg} ${r.toFixed(2)}`));

  test(`${theme} ${product}: status reads as text on every ground (4.5:1)`, () =>
    assert.deepEqual(below(STATUS, 4.5), []));
  // The badge fills itself with a wash of its own status colour
  // (components.css: color-mix(in srgb, currentColor 12%, transparent)),
  // so the text's real ground is that wash over the page.
  test(`${theme} ${product}: status reads on its own 12% badge wash on every ground (4.5:1)`, () =>
    assert.deepEqual(below(STATUS, 4.5, (bg, n) => lerp(hex(bg), hex(n), 0.12)), []));
  test(`${theme} ${product}: code reads on every ground (4.5:1, comment 3:1)`, () =>
    assert.deepEqual([...below(CODE_TEXT, 4.5), ...below(CODE_QUIET, 3)], []));
  test(`${theme} ${product}: viz marks are visible on every ground (3:1)`, () =>
    assert.deepEqual(below(VIZ, 3), []));
  // Muted text is text: it reads at 4.5:1 on every ground of every product.
  test(`${theme} ${product}: muted text reads on every ground (4.5:1)`, () =>
    assert.deepEqual(below(["--sl-text-muted", "--sl-text-secondary", "--sl-text-primary"], 4.5), []));
  // ...and on the two ink washes the kit lays over a ground: 4% (a table
  // head, a field, an empty state) and 6% (a segmented track, a ghost or an
  // icon button). Since 0.30 the micro labels are 10.5px muted text, so the
  // muted ink carries more of the page than it did.
  for (const wash of [0.04, 0.06]) {
    test(`${theme} ${product}: muted text reads on a ${wash * 100}% ink wash over every ground (4.5:1)`, () =>
      assert.deepEqual(below(["--sl-text-muted", "--sl-text-secondary"], 4.5, (bg) => lerp(hex(bg), hex("--sl-text-primary"), wash)), []));
  }
  // Inside an inversion band (components.css .sl-invert > *) the ground is the
  // page's primary text and the band's inks are its canvas at 58% (muted) and
  // 78% (secondary), read off the CSS.
  test(`${theme} ${product}: muted text reads inside the inversion band (4.5:1)`, () => {
    const ground = hex("--sl-text-primary"), ink = hex("--sl-bg-canvas");
    const bad = Object.entries(BAND_INKS).map(([n, a]) => [n, ratio(lerp(ground, ink, a), ground)])
      .filter(([, r]) => r < 4.5).map(([n, r]) => `${n} ${r.toFixed(2)}`);
    assert.deepEqual(bad, []);
  });
}

test("the band's muted and secondary inks are read off components.css", () => {
  for (const [n, a] of Object.entries(BAND_INKS)) assert.ok(a > 0 && a < 1, `band ${n} ink not found: ${a}`);
});

// High contrast keeps literal neutrals: its muted ink is held to the same 4.5
// on its grounds, on the 4% and 6% washes and inside the band.
{
  const t = { ...shared, ...vars("themes/high-contrast.css") };
  const lines = [];
  for (const bg of GROUNDS) for (const wash of [0, 0.04, 0.06]) {
    const ground = lerp(t[bg], t["--sl-text-primary"], wash);
    for (const n of ["--sl-text-muted", "--sl-text-secondary"]) {
      const r = ratio(t[n], ground);
      if (r < 4.5) lines.push(`${n} on ${bg} +${wash * 100}% ${r.toFixed(2)}`);
    }
  }
  for (const [n, a] of Object.entries(BAND_INKS)) {
    const r = ratio(lerp(t["--sl-text-primary"], t["--sl-bg-canvas"], a), t["--sl-text-primary"]);
    if (r < 4.5) lines.push(`band ${n} ${r.toFixed(2)}`);
  }
  test("high contrast: muted text reads on every ground, on the 4% and 6% washes and inside the band (4.5:1)", () => {
    for (const bg of GROUNDS) assert.ok(t[bg], `${bg} is not a hex literal in high-contrast.css`);
    assert.deepEqual(lines, []);
  });
}

for (const theme of ["light", "dark"]) {
  const t = { ...shared, ...vars(`themes/${theme}.css`) };
  const hex = (n) => {
    assert.ok(t[n], `${n} is not a 6-digit hex in the generated ${theme} css`);
    return t[n];
  };

  test(`${theme}: viz series are pairwise distinct (OKLab >= 0.08)`, () => {
    const labs = VIZ.map((n) => linToOklab(fromHex(hex(n)).lin));
    const close = [];
    for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) {
      const d = Math.hypot(...labs[i].map((v, k) => v - labs[j][k]));
      if (d < 0.08) close.push(`viz-${i}/viz-${j} ${d.toFixed(3)}`);
    }
    assert.deepEqual(close, []);
  });
}

// Prism (light only): the spectrum ink must be seen at 1px and as display
// text on every product's light grounds. The accent is a FILL on light since
// 0.24; what reads as text is its derivation, checked below.
for (const [product, p] of PRODUCTS) {
  const t = productTokens("light", p);
  const INK = [...Array(5).keys()].map((i) => `--sl-spectrum-ink-${i}`);
  test(`light ${product}: spectrum ink is visible at 1px and as display text on every ground (3:1)`, () => {
    const bad = GROUNDS.flatMap((bg) => INK.filter((n) => !t[n] || ratio(t[n], t[bg]) < 3)
      .map((n) => `${n} on ${bg} ${t[n] && ratio(t[n], t[bg]).toFixed(2)}`));
    assert.deepEqual(bad, []);
  });
}

// The light accent split (0.24): every registered product's light accent is a
// fill, its text is re-derived from it with the theme's lightness cap, and its
// label is the pole its lightness picks. These mirror the CSS formulas:
//   --slc-accent-text   oklch(from accent min(l, lmax) c h)   (gamut-mapped, or clipped as Chrome does)
//   --sl-text-on-accent oklch(from accent clamp(0.22, (0.61 - l) * 1000, 1) 0 h)
{
  const light = readFileSync(resolve(KIT, "themes/light.css"), "utf8");
  const lmax = Number(light.match(/--sl-accent-text-lmax:\s*([0-9.]+)/)[1]);
  const onAccent = light.match(/--sl-text-on-accent:\s*([^;]+);/)[1];
  const registry = JSON.parse(readFileSync(resolve(KIT, "agent/accent-registry.json"), "utf8"));
  const t = { ...shared, ...vars("themes/light.css") };
  // Two readings of an out-of-gamut text colour: CSS Color 4 gamut mapping
  // (chroma reduced at fixed L and h) and what Chrome 154 paints, measured
  // from pixels in K2 -- each channel clipped, which also moves the hue
  // (amber at the cap: #933a00, h 45, not #7e4a00, h 66). Both must read.
  const textsOf = (hex) => {
    const [L, C, h] = toOklch(fromHex(hex));
    const l = Math.min(L, lmax);
    return [toHex(fromOklch([l, Math.min(C, maxChroma(l, h)), h])), toHex(fromOklch([l, C, h]))];
  };
  const labelOf = (hex) => {
    const [L, , h] = toOklch(fromHex(hex));
    return toHex(fromOklch([Math.min(1, Math.max(0.22, (0.61 - L) * 1000)), 0, h]));
  };
  const accents = Object.entries(registry.products)
    .map(([name, p]) => [name, p.light ?? registry.products[p.inherits]?.light ?? t["--sl-accent-default"]]);

  test("light: the theme's own accent is the bright fill, and derives both pole and text", () => {
    assert.equal(t["--sl-accent-default"], "#FF9F1C");
    assert.match(onAccent, /oklch\(from var\(--sl-accent-default\) clamp\(0\.22, \(0\.61 - l\) \* 1000, 1\) 0 h\)/);
    assert.match(light, /--sl-focus-ring: oklch\(from var\(--sl-accent-default\) min\(l, var\(--sl-accent-text-lmax\)\) c h\)/);
  });
  for (const [name, hex] of accents) {
    // Its own product's grounds (an inheriting product shares its parent's).
    const own = NEUTRALS.products[name] ?? NEUTRALS.products.default;
    test(`light ${name}: accent text reads on its own grounds and on its own 12% wash (4.5:1)`, () => {
      const grounds = GROUNDS.map((n) => own.light[n.slice(5)]);
      const bad = textsOf(hex).flatMap((text) => [...grounds, lerp(own.light["bg-canvas"], hex, 0.12)]
        .map((bg) => [bg, ratio(text, bg)]).filter(([, r]) => r < 4.5).map(([bg, r]) => `${text} on ${bg} ${r.toFixed(2)}`));
      assert.deepEqual(bad, []);
    });
    test(`light ${name}: the derived label is the better pole on the fill`, () => {
      const label = labelOf(hex);
      const other = label === "#ffffff" ? toHex(fromOklch([0.22, 0, 0])) : "#ffffff";
      assert.ok(ratio(label, hex) >= ratio(other, hex), `${label} ${ratio(label, hex).toFixed(2)} < ${other} ${ratio(other, hex).toFixed(2)} on ${hex}`);
    });
  }
  test("light default: the label on the primary fill reads (4.5:1)", () => {
    const r = ratio(labelOf(t["--sl-accent-default"]), t["--sl-accent-default"]);
    assert.ok(r >= 4.5, r.toFixed(2));
  });
}

// Inside an inversion band the ground is the theme's text colour — LIGHT on the
// dark and high-contrast themes — so the band caps the accent text with its own
// number (--sl-accent-band-text-lmax). Every registered accent must read there.
{
  const registry = JSON.parse(readFileSync(resolve(KIT, "agent/accent-registry.json"), "utf8"));
  for (const theme of ["dark", "high-contrast"]) {
    const css = readFileSync(resolve(KIT, `themes/${theme}.css`), "utf8");
    const t = { ...shared, ...vars(`themes/${theme}.css`) };
    const cap = Number(css.match(/--sl-accent-band-text-lmax:\s*([0-9.]+)/)?.[1]);
    const accents = theme === "dark"
      ? Object.entries(registry.products).map(([n, p]) => [n, p.dark ?? registry.products[p.inherits]?.dark])
      : [["default", t["--sl-accent-default"]]];
    for (const [name, hex] of accents) {
      // The band's ground is the product's own primary text.
      const band = theme === "dark" ? NEUTRALS.products[name].dark["text-primary"] : t["--sl-text-primary"];
      test(`${theme} ${name}: accent text inside the inversion band reads (4.5:1)`, () => {
        assert.ok(cap > 0 && cap < 1, `${theme} declares no band cap`);
        const [L, C, h] = toOklch(fromHex(hex));
        const l = Math.min(L, cap);
        const text = toHex(fromOklch([l, Math.min(C, maxChroma(l, h)), h]));
        const r = ratio(text, band);
        assert.ok(r >= 4.5, `${text} on ${band} ${r.toFixed(2)}`);
      });
    }
  }
}

// The band's text is also FLOORED (components.css .sl-invert > *): on light the
// band's ground is the page's dark ink, where spexr's indigo read 3.54:1 and
// introspect's teal 4.22 uncapped. The floor is read off the CSS, so the test
// follows it. Status inks in the band take the same floor and cap
// (--slc-<status>-text): a success badge read 2.25 / 1.61 / 1.28 before.
{
  const comp = readFileSync(resolve(KIT, "components.css"), "utf8");
  const band = comp.match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  const floor = Number(band.match(/--slc-accent-text:\s*oklch\(from var\(--slc-accent\) min\(max\(l, ([0-9.]+)\)/)?.[1]);
  const registry = JSON.parse(readFileSync(resolve(KIT, "agent/accent-registry.json"), "utf8"));
  const inBand = (hex, cap) => {
    const [L, C, h] = toOklch(fromHex(hex));
    const l = Math.min(Math.max(L, floor), cap);
    return toHex(fromOklch([l, Math.min(C, maxChroma(l, h)), h]));
  };

  test("the band floors the accent text and the status inks with one number", () => {
    assert.ok(floor > 0.5 && floor < 1, `no floor on --slc-accent-text in .sl-invert > *: ${floor}`);
    for (const s of ["success", "warning", "danger", "info"]) {
      assert.match(band, new RegExp(`--slc-${s}-text:\\s*oklch\\(from var\\(--slc-${s}\\)\\s*min\\(max\\(l, ${floor}\\), var\\(--sl-accent-band-text-lmax, 1\\)\\) c h\\)`), s);
      assert.match(comp, new RegExp(`\\.sl-badge--${s}\\s*\\{ color: var\\(--slc-${s}-text, var\\(--slc-${s}\\)\\)`), `badge ${s}`);
    }
    assert.match(band, /--slc-accent-subtle:\s*color-mix\(in srgb, var\(--slc-accent\) 12%, transparent\)/);
  });

  for (const theme of ["light", "dark", "high-contrast"]) {
    const css = readFileSync(resolve(KIT, `themes/${theme}.css`), "utf8");
    const t = { ...shared, ...vars(`themes/${theme}.css`) };
    const cap = Number(css.match(/--sl-accent-band-text-lmax:\s*([0-9.]+)/)?.[1] ?? 1);
    // Each product's band is its own primary text; its accent and the status
    // inks are read there. High contrast has one ground.
    const cases = theme === "high-contrast"
      ? [...STATUS.map((n) => [n, t[n], t["--sl-text-primary"]]), ["accent", t["--sl-accent-default"], t["--sl-text-primary"]]]
      : Object.entries(registry.products).flatMap(([n, p]) => {
        const ground = NEUTRALS.products[n][theme]["text-primary"];
        const accent = p[theme] ?? registry.products[p.inherits]?.[theme];
        return [[n, accent, ground], ...STATUS.map((s) => [`${n} ${s}`, t[s], ground])];
      });
    for (const [name, hex, ground] of cases) {
      test(`${theme} ${name}: reads inside the inversion band, on the band and on its own 12% wash (4.5:1)`, () => {
        const text = inBand(hex, cap);
        const bad = [ground, lerp(ground, text, 0.12)]
          .map((bg) => [bg, ratio(text, bg)]).filter(([, r]) => r < 4.5).map(([bg, r]) => `${text} on ${bg} ${r.toFixed(2)}`);
        assert.deepEqual(bad, []);
      });
    }
  }
}
