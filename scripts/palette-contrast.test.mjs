import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { fromHex, linToOklab } from "./lib/css-color.mjs";

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

for (const theme of ["light", "dark"]) {
  const t = { ...shared, ...vars(`themes/${theme}.css`) };
  const hex = (n) => {
    assert.ok(t[n], `${n} is not a 6-digit hex in the generated ${theme} css`);
    return t[n];
  };
  const below = (names, bg, min) => names
    .filter((n) => ratio(hex(n), hex(bg)) < min)
    .map((n) => `${n} ${ratio(t[n], t[bg]).toFixed(2)}`);

  for (const bg of ["--sl-bg-canvas", "--sl-bg-surface", "--sl-bg-surface-raised"]) {
    test(`${theme} ${bg}: status reads as text (4.5:1)`, () =>
      assert.deepEqual(below(STATUS, bg, 4.5), []));
    // The badge fills itself with a wash of its own status colour
    // (components.css: color-mix(in srgb, currentColor 12%, transparent)),
    // so the text's real ground is that wash over the page.
    test(`${theme} ${bg}: status reads on its own 12% badge wash (4.5:1)`, () => {
      const lerp = (a, b, p) => { const x = fromHex(a).lin.map(lin2g), y = fromHex(b).lin.map(lin2g);
        return "#" + x.map((v, i) => Math.round((v + (y[i] - v) * p) * 255).toString(16).padStart(2, "0")).join(""); };
      const bad = STATUS.map((n) => [n, ratio(hex(n), lerp(hex(bg), hex(n), 0.12))])
        .filter(([, r]) => r < 4.5).map(([n, r]) => `${n} ${r.toFixed(2)}`);
      assert.deepEqual(bad, []);
    });
    test(`${theme} ${bg}: code reads (4.5:1, comment 3:1)`, () =>
      assert.deepEqual([...below(CODE_TEXT, bg, 4.5), ...below(CODE_QUIET, bg, 3)], []));
    test(`${theme} ${bg}: viz marks are visible (3:1)`, () =>
      assert.deepEqual(below(VIZ, bg, 3), []));
  }

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
