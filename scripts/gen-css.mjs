import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, loadRegistry, flattenShared } from "./lib/tokens.mjs";
import {
  buildNeutrals, validateNeutrals, closestDistinctPair, splitRoles, mergeAuthored,
  THEME_SLOTS, CODE_SLOTS, neutralsJson, productsCss,
} from "./lib/neutrals.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../packages/ui-kit");
const HEADER = "/* GENERATED from sondalab.tokens.json — do not edit. Run `npm run gen:tokens`. */\n";

function block(selector, entries) {
  const body = entries.map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `${selector} {\n${body}\n}\n`;
}

/** An accent step is a literal colour string or a hue-relative derivation
 * recipe, so that overriding only --sl-accent-default re-derives the family
 * (the one-var contract). Two recipe shapes:
 *   { mix: [ratio, anchor] }        -> color-mix() (Baseline). The anchor is a
 *                                      colour keyword, or `away`: the pole
 *                                      opposite the theme's own label
 *                                      (--sl-text-on-accent), white under a
 *                                      dark label and black under a white
 *                                      one, so a hover or press step never
 *                                      moves the fill toward its label.
 *   { oklch: [L, C, H], fallback }  -> relative color (tighter floor); the
 *                                      fallback literal is emitted first so a
 *                                      browser without relative-color syntax
 *                                      keeps the hand-tuned value.
 * Returns an array of [name, value] declarations (usually one, two when a
 * relative-color step carries a fallback). */
const AWAY_FROM_LABEL = "oklch(from var(--sl-text-on-accent) clamp(0, (0.5 - l) * 1000, 1) 0 h)";
function accentDecls(name, v) {
  if (v && typeof v === "object" && Array.isArray(v.mix)) {
    const [ratio, anchor] = v.mix;
    const to = anchor === "away" ? AWAY_FROM_LABEL : anchor;
    return [[name, `color-mix(in srgb, var(--sl-accent-default) ${ratio}%, ${to})`]];
  }
  if (v && typeof v === "object" && Array.isArray(v.oklch)) {
    const [L, C, H] = v.oklch;
    const derived = `oklch(from var(--sl-accent-default) ${L} ${C} ${H})`;
    return v.fallback ? [[name, v.fallback], [name, derived]] : [[name, derived]];
  }
  return [[name, v]];
}

/** --sl-spectrum-N / --sl-spectrum-ink-N: the theme's own values, or an
 * `initial` reset for each name the light theme declares when this theme has
 * none. Returns [name, value] declarations. */
function spectrumDecls(own, light) {
  const names = (s) => [
    ...(s?.light ?? []).map((v, i) => [`--sl-spectrum-${i}`, v]),
    ...(s?.ink ?? []).map((v, i) => [`--sl-spectrum-ink-${i}`, v]),
  ];
  return own ? names(own) : names(light).map(([n]) => [n, "initial"]);
}

function main() {
  const t = loadTokens();
  const registry = loadRegistry();

  // The neutral ladder, baked per product. Any reason not to ship stops the
  // build before a file is written.
  const neutrals = buildNeutrals(t, registry);
  const errors = validateNeutrals(neutrals);
  if (errors.length) {
    console.error(`gen-css: the neutral ladder does not build:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }

  // tokens.css — shared role tokens + reduced-motion
  const shared = [...flattenShared(t.shared)];
  let tokensCss = HEADER + block(":root", shared);
  tokensCss += `\n@media (prefers-reduced-motion: reduce) {\n  :root {\n` +
    `    --sl-motion-fast: 0ms;\n    --sl-motion-mid: 0ms;\n    --sl-motion-slow: 0ms;\n  }\n}\n`;
  mkdirSync(resolve(OUT, "themes"), { recursive: true });
  writeFileSync(resolve(OUT, "tokens.css"), tokensCss);

  // theme files
  const declaredByLightDark = new Set();
  for (const id of ["light", "dark", "high-contrast"]) {
    // The default product's baked neutrals take their slots among the theme's
    // own entries (a hand-written duplicate fails the build); a theme without
    // a ladder (high contrast) is emitted as authored.
    const own = neutrals.products.default[id];
    const split = own ? splitRoles(own) : null;
    const theme = own ? mergeAuthored(split.theme, t.themes[id], THEME_SLOTS, `themes.${id}`) : t.themes[id];
    const accent = t.accent[id];
    const code = own ? mergeAuthored(split.code, t.code?.[id], CODE_SLOTS, `code.${id}`) : t.code?.[id];
    const entries = [
      ...Object.entries(theme).map(([k, v]) => [`--sl-${k}`, v]),
      ...Object.entries(accent).flatMap(([k, v]) => accentDecls(`--sl-accent-${k}`, v)),
      // A theme whose accent is a fill (it caps the text lightness) focuses in
      // the accent's text-safe derivation: a ring must clear 3:1, and the
      // bright fill does not on its own ground.
      ["--sl-focus-ring", accent["text-lmax"] === undefined
        ? accent.default
        : "oklch(from var(--sl-accent-default) min(l, var(--sl-accent-text-lmax)) c h)"],
      // Syntax palette (--sl-code-*): per-theme, atom-one. Omitted where the
      // token file has no entry for the theme (e.g. high-contrast).
      ...(code ? Object.entries(code).map(([k, v]) => [`--sl-code-${k}`, v]) : []),
      // Categorical ramp at the lightness this theme's grounds need; the
      // shared ramp on :root stays as the default for a page with no theme.
      ...(t.viz?.[id] ?? []).map((v, i) => [`--sl-viz-${i}`, v]),
      // Shadows cast in the ground's own ink, so they are per theme too.
      ...Object.entries(t.shadow?.[id] ?? {}).map(([k, v]) => [`--sl-shadow-${k}`, v]),
      // Prism: the spectrum is the light theme's own. Every other theme resets
      // it to `initial`, so a consumer's var() fallback wins there and a nested
      // island of that theme does not inherit the light theme's value.
      ...spectrumDecls(t.spectrum?.[id], t.spectrum?.light),
    ];
    // High contrast owns or resets every name light or dark declares: what it
    // has no value for (the code palette, the light text cap) is `initial`,
    // so a high-contrast island inherits nothing from the page around it and
    // a consumer's var() fallback wins there.
    if (id === "high-contrast") {
      const own = new Set(entries.map(([n]) => n));
      for (const n of declaredByLightDark) if (!own.has(n)) entries.push([n, "initial"]);
    } else {
      for (const [n] of entries) declaredByLightDark.add(n);
    }
    const css = HEADER + block(`[data-sl-theme="${id}"]`, entries);
    writeFileSync(resolve(OUT, `themes/${id}.css`), css);
  }

  // Every registered product's neutrals: a CSS layer for Tier A hosts, and
  // the same values as JSON for consumers that need hex outside CSS.
  writeFileSync(resolve(OUT, "themes/products.css"), productsCss(neutrals));
  writeFileSync(resolve(OUT, "neutrals.json"), neutralsJson(neutrals));

  console.log("gen-css: wrote @sondalab/ui-kit tokens.css + 3 themes + themes/products.css + neutrals.json");
  for (const theme of ["light", "dark"]) {
    const p = closestDistinctPair(neutrals, theme);
    if (p) console.log(`gen-css: closest distinct-hue products on ${theme}: ${p.a} / ${p.b} — max channel delta ${p.maxChannel}, max OKLab distance ${p.maxDE.toFixed(4)}, ${p.sameRoles}/${p.roles} roles identical`);
  }
}

main();
