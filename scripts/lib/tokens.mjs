import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const TOKENS_PATH = resolve(HERE, "../../sondalab.tokens.json");

export function loadTokens() {
  return JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
}

// Emit --sl-<group>-<key> for every shared scale.
export function flattenShared(shared) {
  const out = new Map();
  const groups = {
    font: "font", space: "space", radius: "radius", text: "text",
    line: "line", z: "z", motion: "motion", shadow: "shadow", focus: "focus",
  };
  for (const [group, prefix] of Object.entries(groups)) {
    for (const [key, value] of Object.entries(shared[group] ?? {})) {
      out.set(`--sl-${prefix}-${key}`, value);
    }
  }
  return out;
}
