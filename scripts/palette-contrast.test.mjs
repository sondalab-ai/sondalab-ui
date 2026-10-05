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
/** The inversion band, read off components.css (.sl-invert > *): its text
 *  inks and its card and raised grounds are each its foreground (the page's
 *  canvas) at a fraction over its own ground (the page's primary text). */
const BAND = (() => {
  const band = readFileSync(resolve(KIT, "components.css"), "utf8").match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  const pct = (role) => Number(band.match(new RegExp(`--slc-${role}:\\s*color-mix\\(in srgb, currentColor (\\d+)%, transparent\\)`))?.[1]) / 100;
  return { inks: { muted: pct("text-muted"), secondary: pct("text-secondary") }, grounds: { band: 0, card: pct("surface"), raised: pct("raised") } };
})();
/** Every band ink on every band ground (the bare band, a card on it, a raised
 *  surface on it) as ["ink on ground", ratio]; the ink composites over the
 *  ground it sits on, so a card's muted text is the canvas over the card. */
const bandReadings = (ground, ink) => Object.entries(BAND.grounds).flatMap(([g, gp]) => {
  const under = lerp(ground, ink, gp);
  return Object.entries(BAND.inks).map(([n, a]) => [`${n} on ${g}`, ratio(lerp(under, ink, a), under)]);
});
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
  // page's primary text, and muted and secondary text are its canvas at the
  // fractions the CSS declares -- on the bare band, on a card and on a raised
  // surface placed in it (the band's own 7% and 12% washes of its canvas).
  test(`${theme} ${product}: muted text reads inside the inversion band, bare and on a card or raised surface in it (4.5:1)`, () => {
    const bad = bandReadings(hex("--sl-text-primary"), hex("--sl-bg-canvas"))
      .filter(([, r]) => r < 4.5).map(([n, r]) => `${n} ${r.toFixed(2)}`);
    assert.deepEqual(bad, []);
  });
}

test("the band's inks and grounds are read off components.css, and secondary stays above muted", () => {
  for (const [n, a] of Object.entries({ ...BAND.inks, card: BAND.grounds.card, raised: BAND.grounds.raised })) {
    assert.ok(a > 0 && a < 1, `band ${n} not found: ${a}`);
  }
  assert.ok(BAND.inks.secondary > BAND.inks.muted, "secondary must read stronger than muted");
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
  for (const [n, r] of bandReadings(t["--sl-text-primary"], t["--sl-bg-canvas"])) {
    if (r < 4.5) lines.push(`band ${n} ${r.toFixed(2)}`);
  }
  test("high contrast: muted text reads on every ground, on the 4% and 6% washes and inside the band, bare and on a card or raised surface (4.5:1)", () => {
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
//   --sl-text-on-accent oklch(from accent var(--_sl-on)), the kit's one label
//                       macro: clamp(var(--_sl-pole-dark), (var(--_sl-pole-l) - l) * 1000, 1) 0 h
// The dark pole is L 0.16, the kit's own on every other labelled fill
// (--slc-on-accent-fill, --slc-on-<status>); it was 0.22 until 0.32.1, which
// read 5.03:1 at worst under a dark label across the registry where 0.16
// reads 5.64 (primary-label.test.mjs measures every product and state).
{
  const light = readFileSync(resolve(KIT, "themes/light.css"), "utf8");
  const COMPONENTS = readFileSync(resolve(KIT, "components.css"), "utf8");
  const TOKENS = readFileSync(resolve(KIT, "tokens.css"), "utf8");
  const POLE_L = Number(TOKENS.match(/--_sl-pole-l:\s*([0-9.]+);/)?.[1]);
  const POLE_DARK = Number(TOKENS.match(/--_sl-pole-dark:\s*([0-9.]+);/)?.[1]);
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
    return toHex(fromOklch([Math.min(1, Math.max(POLE_DARK, (POLE_L - L) * 1000)), 0, h]));
  };
  const accents = Object.entries(registry.products)
    .map(([name, p]) => [name, p.light ?? registry.products[p.inherits]?.light ?? t["--sl-accent-default"]]);

  test("light: the theme's own accent is the bright fill, and derives both pole and text", () => {
    assert.equal(t["--sl-accent-default"], "#FF9F1C");
    // one label rule: the theme's and every labelled fill's read the kit's macro
    assert.equal(onAccent, "oklch(from var(--sl-accent-default) var(--_sl-on))");
    assert.match(TOKENS, /--_sl-on:\s*clamp\(var\(--_sl-pole-dark\), \(var\(--_sl-pole-l\) - l\) \* 1000, 1\) 0 h;/);
    assert.equal(POLE_DARK, 0.16);
    assert.match(COMPONENTS, /--_sl-on-accent-fill:\s*oklch\(from var\(--slc-accent-fill\) var\(--_sl-on\)\);/);
    for (const s of ["success", "warning", "danger", "info"]) assert.match(COMPONENTS, new RegExp(`--slc-on-${s}:\\s*oklch\\(from var\\(--slc-${s}\\)\\s*var\\(--_sl-on\\)\\);`), s);
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
    // The derived label is the better pole on the accent itself and on the
    // product's registered fill. With the dark pole at 0.16 the two poles
    // meet near oklch L 0.56-0.59 for the registered hues, so the threshold
    // is 0.59 (0.32.1; 0.61 left spexr's bare #5b6cff, L 0.6015, to white at
    // 4.17:1 where the dark pole reads 4.65).
    for (const fill of new Set([hex, registry.products[name].fill?.light ?? hex])) {
      test(`light ${name}: the derived label is the better pole on ${fill === hex ? "the accent" : "its registered fill"} ${fill}`, () => {
        const label = labelOf(fill);
        const other = label === "#ffffff" ? toHex(fromOklch([0.16, 0, 0])) : "#ffffff";
        assert.ok(ratio(label, fill) >= ratio(other, fill), `${label} ${ratio(label, fill).toFixed(2)} < ${other} ${ratio(other, fill).toFixed(2)} on ${fill}`);
      });
    }
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
  // The danger is floored higher than the rest (0.32): the danger tone sets
  // it as text on cards inside the band (controls.test.mjs measures those).
  const floorOf = (s) => Number(band.match(new RegExp(`--slc-${s}-text:\\s*oklch\\(from var\\(--slc-${s}\\)\\s*min\\(max\\(l, ([0-9.]+)\\)`))?.[1]);
  const inBand = (hex, cap, f = floor) => {
    const [L, C, h] = toOklch(fromHex(hex));
    const l = Math.min(Math.max(L, f), cap);
    return toHex(fromOklch([l, Math.min(C, maxChroma(l, h)), h]));
  };

  test("the band floors the accent text and the status inks with one number, and the danger higher", () => {
    assert.ok(floor > 0.5 && floor < 1, `no floor on --slc-accent-text in .sl-invert > *: ${floor}`);
    assert.ok(floorOf("danger") > floor, "the danger's floor is the higher one");
    for (const s of ["success", "warning", "danger", "info"]) {
      const f = s === "danger" ? floorOf("danger") : floor;
      assert.match(band, new RegExp(`--slc-${s}-text:\\s*oklch\\(from var\\(--slc-${s}\\)\\s*min\\(max\\(l, ${f}\\), var\\(--sl-accent-band-text-lmax, 1\\)\\) c h\\)`), s);
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
        const text = inBand(hex, cap, /danger/.test(name) ? floorOf("danger") : floor);
        const bad = [ground, lerp(ground, text, 0.12)]
          .map((bg) => [bg, ratio(text, bg)]).filter(([, r]) => r < 4.5).map(([bg, r]) => `${text} on ${bg} ${r.toFixed(2)}`);
        assert.deepEqual(bad, []);
      });
    }
  }
}

// ── the code palette in an editor (0.35, Lumen parity) ──────────────────────
// An editor paints code on the surface or the raised rung, under the current
// line (the primary ink at 4.5% over raised) and under the selection (the
// product's accent at 18% over raised): the grounds spexr's Monaco theme
// draws (its colour registry). Read from neutrals.json, the values that
// theme is built from, for every product and both themes.
const TOKENS = JSON.parse(readFileSync(resolve(HERE, "../sondalab.tokens.json"), "utf8"));
const LUMEN_HUES = ["keyword", "string", "function", "number", "builtin"];
for (const theme of ["light", "dark"]) for (const [product, p] of PRODUCTS) {
  test(`${theme} ${product}: code reads in an editor -- on the surface, raised, the current line (4.5% ink) and the selection (18% accent) (4.5:1, comment 3:1)`, () => {
    const n = p[theme];
    const grounds = {
      surface: n["bg-surface"],
      raised: n["bg-surface-raised"],
      "current line": lerp(n["bg-surface-raised"], n["text-primary"], 0.045),
      selection: lerp(n["bg-surface-raised"], p.accent[theme], 0.18),
    };
    const bad = [];
    for (const [g, bg] of Object.entries(grounds)) {
      for (const role of ["fg", "keyword", "string", "number", "boolean", "function", "tag", "builtin", "comment", "null"]) {
        const ink = n[`code-${role}`];
        const min = role === "comment" || role === "null" ? 3 : 4.5;
        if (!ink) { bad.push(`code-${role} missing from neutrals.json`); continue; }
        const r = ratio(ink, bg);
        if (r < min) bad.push(`code-${role} ${ink} on ${g} ${bg} ${r.toFixed(2)}`);
      }
    }
    assert.deepEqual(bad, []);
  });
}

// The hues are authored as oklch and baked to hex by the generator: a triple
// outside sRGB gives up chroma at its own lightness and hue (CSS Color 4 gamut
// mapping), never a per-channel clip, which would move both.
test("the code hues are the token triples baked into sRGB by chroma alone", () => {
  for (const theme of ["light", "dark"]) {
    const t = vars(`themes/${theme}.css`);
    for (const role of LUMEN_HUES) {
      const v = TOKENS.code[theme][role];
      assert.ok(Array.isArray(v) && v.length === 3, `code.${theme}.${role} is an oklch triple, not ${JSON.stringify(v)}`);
      const [L, C, h] = v;
      const held = Math.min(C, maxChroma(L, h));
      assert.equal(t[`--sl-code-${role}`], toHex(fromOklch([L, held, h])), `${theme} ${role}`);
      const [l2, c2, h2] = toOklch(fromHex(t[`--sl-code-${role}`]));
      assert.ok(Math.abs(l2 - L) < 0.004 && Math.abs(h2 - h) < 1.5 && c2 <= C + 0.004, `${theme} ${role}: oklch(${l2.toFixed(3)} ${c2.toFixed(3)} ${h2.toFixed(1)}) for oklch(${L} ${C} ${h})`);
    }
    assert.equal(t["--sl-code-boolean"], t["--sl-code-number"], `${theme}: boolean reads as number`);
    assert.equal(t["--sl-code-tag"], t["--sl-code-keyword"], `${theme}: tag reads as keyword`);
    // five hues, no more: every chromatic role is one of the target's
    const hues = new Set(["keyword", "string", "number", "boolean", "function", "tag", "builtin"].map((r) => t[`--sl-code-${r}`]));
    assert.equal(hues.size, LUMEN_HUES.length, `${theme}: ${[...hues].join(" ")}`);
  }
});

// The target's hues, frozen in scripts/fixtures/lumen-target-colour.json (the
// lab file is checked against it while it exists, neutrals-ladder.test.mjs),
// so this keeps running once K7 removes lab/.
test("the code hues are the Lumen target's", () => {
  const target = JSON.parse(readFileSync(resolve(HERE, "fixtures/lumen-target-colour.json"), "utf8")).code;
  for (const theme of ["light", "dark"]) {
    assert.deepEqual(Object.keys(target[theme]).sort(), [...LUMEN_HUES].sort(), `${theme}: the target's five hues`);
    for (const role of LUMEN_HUES) assert.deepEqual(TOKENS.code[theme][role], target[theme][role], `${theme} ${role}`);
  }
});
