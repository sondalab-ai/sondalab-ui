import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { auditCss, buildAllowlistBasesFromCss } from "../packages/ui-kit/agent/sl-audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const KIT = resolve(REPO, "packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");

const effects = read("effects.css");
const tokens = JSON.parse(readFileSync(resolve(REPO, "sondalab.tokens.json"), "utf8"));
const registry = JSON.parse(read("agent/accent-registry.json"));
const matrix = JSON.parse(read("agent/substrate-matrix.json"));
const blessed = JSON.parse(read("agent/blessed/default.json"));

// The allowlist is resolved the way the shipped audit resolves it: from the
// generated CSS, so effects.css is held to exactly the consumer-visible values.
const allowlistBases = buildAllowlistBasesFromCss([
  read("tokens.css"),
  read("themes/light.css"),
  read("themes/dark.css"),
  read("themes/high-contrast.css"),
]);

test("effects.css carries no colour literal", () => {
  const r = auditCss({
    css: effects,
    tokens,
    allowlistBases,
    accentEntry: registry.products.default,
    blessed,
    declaredTier: null,
    substrate: "Page",
    matrix,
    file: "effects.css",
  });
  const colour = r.findings.filter((f) => f.rule === "accent-one-hue");
  assert.equal(colour.length, 0, `effects.css must use role-vars only, found: ${JSON.stringify(colour)}`);
});

test("effects.css declares no accent step (it derives, never redefines)", () => {
  const r = auditCss({
    css: effects,
    tokens,
    allowlistBases,
    accentEntry: registry.products.default,
    blessed,
    substrate: "Page",
    matrix,
    file: "effects.css",
  });
  const derivation = r.findings.filter((f) => f.rule === "accent-derivation");
  assert.equal(derivation.length, 0, JSON.stringify(derivation));
});

test("effects.css uses the black keyword for masks, never a hex literal", () => {
  assert.doesNotMatch(effects, /mask[^;]*#[0-9a-fA-F]{3,8}/, "mask colours must be the `black` keyword");
});
