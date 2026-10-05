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
 *   { step: "hover" | "press" } -> the kit's own step, oklch(from
 *                                  var(--sl-accent-default)
 *                                  var(--_sl-step-<name>)): toward black
 *                                  unless the dark label would read under
 *                                  5.4:1 pressed, then toward white; one
 *                                  macro in components.css :root, shared
 *                                  with the accent fill, the danger tone
 *                                  and the role-var fallbacks (0.32.1).
 *   { mix: [ratio, anchor] }    -> color-mix() toward a colour keyword
 *                                  (high contrast's literal pair).
 * Returns [name, value] declarations. */
function accentDecls(name, v) {
  if (v && typeof v === "object" && typeof v.step === "string") {
    if (!["hover", "press"].includes(v.step)) throw new Error(`${name}: unknown step ${v.step}`);
    return [[name, `oklch(from var(--sl-accent-default) var(--_sl-step-${v.step}))`]];
  }
  if (v && typeof v === "object" && Array.isArray(v.mix)) {
    const [ratio, anchor] = v.mix;
    return [[name, `color-mix(in srgb, var(--sl-accent-default) ${ratio}%, ${anchor})`]];
  }
  if (v && typeof v === "object") throw new Error(`${name}: unknown accent recipe ${JSON.stringify(v)}`);
  return [[name, v]];
}

/** The label on a fill and its hover and press step, as private macros
 * (--_sl-*) for tokens.css :root, built from the `label` block's numbers.
 * Channel expressions, not colours: a relative colour substitutes them, so
 * `l`, `c` and `h` bind to the colour they are used in. --_sl-lum is the
 * fill's WCAG luminance from its own oklch channels (OKLab to linear sRGB,
 * weighted by the luminance coefficients), so the step rule can ask what a
 * dark label would read on the fill pressed toward black. */
function labelMacros(label) {
  const { "pole-l": poleL, "pole-dark": poleDark, hold, step } = label;
  for (const [k, v] of Object.entries({ poleL, poleDark, hold, hover: step?.hover, press: step?.press })) {
    if (typeof v !== "number") throw new Error(`label.${k} must be a number`);
  }
  // OKLab -> LMS' (Ottosson), cubed, then linear sRGB weighted to luminance.
  const M = [[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965], [-0.0041960863, -0.7034186147, 1.7076147010]];
  const W = [0.2126, 0.7152, 0.0722];
  const y = [0, 1, 2].map((j) => W.reduce((sum, w, i) => sum + w * M[i][j], 0));
  const LMS = [[0.3963377774, 0.2158037573], [-0.1055613458, -0.0638541728], [-0.0894841775, -1.2914855480]];
  const rad = "0.017453292519943295";
  const arm = ([ka, kb]) => `pow(l ${ka < 0 ? "-" : "+"} ${Math.abs(ka)} * c * cos(h * ${rad}) ${kb < 0 ? "-" : "+"} ${Math.abs(kb)} * c * sin(h * ${rad}), 3)`;
  const lum = "calc(" + LMS.map((k, i) => `${i ? (y[i] < 0 ? " - " : " + ") : (y[i] < 0 ? "-" : "")}${Math.abs(y[i]).toPrecision(10)} * ${arm(k)}`).join("") + ")";
  const stepOf = (d) => `clamp(0, l + ${d} * (2 * var(--_sl-lighter) - 1), 1) calc(c * (var(--_sl-lighter) * pow(max(0, 1 - ${d} / max(1 - l, 0.001)), 1.5) + (1 - var(--_sl-lighter)) * max(0, 1 - ${d} / max(l, 0.001)))) h`;
  return [
    ["--_sl-pole-l", String(poleL)],
    ["--_sl-pole-dark", String(poleDark)],
    ["--_sl-hold", String(hold)],
    ["--_sl-on", "clamp(var(--_sl-pole-dark), (var(--_sl-pole-l) - l) * 1000, 1) 0 h"],
    ["--_sl-lum", lum],
    // the fill pressed toward black is dimmed in linear light by ((l - press) / l)^3
    ["--_sl-lighter", `calc(clamp(0, (l - var(--_sl-pole-l)) * 1000, 1) * clamp(0, (var(--_sl-hold) - (var(--_sl-lum) * pow((l - ${step.press}) / l, 3) + 0.05) / (pow(var(--_sl-pole-dark), 3) + 0.05)) * 1000, 1))`],
    ["--_sl-step-hover", stepOf(step.hover)],
    ["--_sl-step-press", stepOf(step.press)],
  ];
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
  const shared = [...flattenShared(t.shared), ...labelMacros(t.label)];
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
    // The syntax hues are baked from their oklch triples (neutrals.code),
    // fixed for every product; fg, comment and null are ladder rungs.
    const code = own ? mergeAuthored(split.code, neutrals.code[id], CODE_SLOTS, `code.${id}`) : neutrals.code[id];
    const entries = [
      ...Object.entries(theme).map(([k, v]) => [`--sl-${k}`, v]),
      ...Object.entries(accent).flatMap(([k, v]) => accentDecls(`--sl-accent-${k}`, v)),
      // A theme whose accent is a fill (it caps the text lightness) focuses in
      // the accent's text-safe derivation: a ring must clear 3:1, and the
      // bright fill does not on its own ground.
      ["--sl-focus-ring", accent["text-lmax"] === undefined
        ? accent.default
        : "oklch(from var(--sl-accent-default) min(l, var(--sl-accent-text-lmax)) c h)"],
      // Syntax palette (--sl-code-*): per theme, Lumen's hues since 0.35.
      // Omitted where the token file has no entry for the theme
      // (high-contrast, which resets them below).
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
  for (const { theme, role, asked: [L, C, h], held } of neutrals.code.reduced) {
    console.log(`gen-css: code ${theme} ${role}: oklch(${L} ${C} ${h}) is outside sRGB; held at chroma ${held.toFixed(4)} (${neutrals.code[theme][role]}), lightness and hue kept`);
  }
  for (const theme of ["light", "dark"]) {
    const p = closestDistinctPair(neutrals, theme);
    if (p) console.log(`gen-css: closest distinct-hue products on ${theme}: ${p.a} / ${p.b} — max channel delta ${p.maxChannel}, max OKLab distance ${p.maxDE.toFixed(4)}, ${p.sameRoles}/${p.roles} roles identical`);
  }
}

main();
