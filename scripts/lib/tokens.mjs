import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const TOKENS_PATH = resolve(HERE, "../../sondalab.tokens.json");
/** The per-product accent table. Since ui-kit 0.29 it feeds generated output
 *  (each product's tinted neutrals), so an edit to it is a token change. */
export const REGISTRY_PATH = resolve(HERE, "../../packages/ui-kit/agent/accent-registry.json");

export function loadTokens() {
  return JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
}

export function loadRegistry() {
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
}

// Emit --sl-<group>-<key> for every shared scale.
export function flattenShared(shared) {
  const out = new Map();
  const groups = {
    font: "font", space: "space", radius: "radius", text: "text",
    line: "line", z: "z", motion: "motion", shadow: "shadow", focus: "focus",
    viz: "viz",
  };
  for (const [group, prefix] of Object.entries(groups)) {
    for (const [key, value] of Object.entries(shared[group] ?? {})) {
      out.set(`--sl-${prefix}-${key}`, value);
    }
  }
  return out;
}
