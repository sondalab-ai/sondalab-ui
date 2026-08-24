import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, flattenShared } from "./lib/tokens.mjs";

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
 *   { mix: [ratio, anchor] }        -> color-mix() (Baseline)
 *   { oklch: [L, C, H], fallback }  -> relative color (tighter floor); the
 *                                      fallback literal is emitted first so a
 *                                      browser without relative-color syntax
 *                                      keeps the hand-tuned value.
 * Returns an array of [name, value] declarations (usually one, two when a
 * relative-color step carries a fallback). */
function accentDecls(name, v) {
  if (v && typeof v === "object" && Array.isArray(v.mix)) {
    const [ratio, anchor] = v.mix;
    return [[name, `color-mix(in srgb, var(--sl-accent-default) ${ratio}%, ${anchor})`]];
  }
  if (v && typeof v === "object" && Array.isArray(v.oklch)) {
    const [L, C, H] = v.oklch;
    const derived = `oklch(from var(--sl-accent-default) ${L} ${C} ${H})`;
    return v.fallback ? [[name, v.fallback], [name, derived]] : [[name, derived]];
  }
  return [[name, v]];
}

function main() {
  const t = loadTokens();

  // tokens.css — shared role tokens + reduced-motion
  const shared = [...flattenShared(t.shared)];
  let tokensCss = HEADER + block(":root", shared);
  tokensCss += `\n@media (prefers-reduced-motion: reduce) {\n  :root {\n` +
    `    --sl-motion-fast: 0ms;\n    --sl-motion-mid: 0ms;\n    --sl-motion-slow: 0ms;\n  }\n}\n`;
  mkdirSync(resolve(OUT, "themes"), { recursive: true });
  writeFileSync(resolve(OUT, "tokens.css"), tokensCss);

  // theme files
  for (const id of ["light", "dark", "high-contrast"]) {
    const theme = t.themes[id];
    const accent = t.accent[id];
    const code = t.code?.[id];
    const entries = [
      ...Object.entries(theme).map(([k, v]) => [`--sl-${k}`, v]),
      ...Object.entries(accent).flatMap(([k, v]) => accentDecls(`--sl-accent-${k}`, v)),
      ["--sl-focus-ring", accent.default],
      // Syntax palette (--sl-code-*): per-theme, atom-one. Omitted where the
      // token file has no entry for the theme (e.g. high-contrast).
      ...(code ? Object.entries(code).map(([k, v]) => [`--sl-code-${k}`, v]) : []),
    ];
    const css = HEADER + block(`[data-sl-theme="${id}"]`, entries);
    writeFileSync(resolve(OUT, `themes/${id}.css`), css);
  }
  console.log("gen-css: wrote @sondalab/ui-kit tokens.css + 3 themes");
}

main();
