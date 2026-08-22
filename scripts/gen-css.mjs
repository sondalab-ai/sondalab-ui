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
    const entries = [
      ...Object.entries(theme).map(([k, v]) => [`--sl-${k}`, v]),
      ...Object.entries(accent).map(([k, v]) => [`--sl-accent-${k}`, v]),
      ["--sl-focus-ring", accent.default],
    ];
    const css = HEADER + block(`[data-sl-theme="${id}"]`, entries);
    writeFileSync(resolve(OUT, `themes/${id}.css`), css);
  }
  console.log("gen-css: wrote @sondalab/ui-kit tokens.css + 3 themes");
}

main();
