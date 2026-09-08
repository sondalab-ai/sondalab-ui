import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const html = readFileSync(resolve(REPO, "showcase/effects.html"), "utf8");
const pkg = JSON.parse(readFileSync(resolve(REPO, "packages/ui-kit/package.json"), "utf8"));

test("the package exports and ships the effects layer", () => {
  assert.equal(pkg.exports["./effects.css"], "./effects.css");
  assert.equal(pkg.exports["./effects.js"], "./effects.js");
  assert.ok(pkg.files.includes("effects.css"));
  assert.ok(pkg.files.includes("effects.js"));
});

test("the showcase demonstrates all four families", () => {
  for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
    assert.ok(html.includes(cls), `showcase must demonstrate .${cls}`);
  }
});

test("every busy aurora in the showcase carries its ARIA", () => {
  // The aurora renders state; it never is the state.
  const busy = html.match(/data-sl-fx-live="busy"[^>]*/g) || [];
  assert.ok(busy.length > 0, "the showcase must demonstrate the busy mode");
  for (const tag of busy) {
    assert.ok(
      /aria-busy="true"|role="progressbar"/.test(tag),
      `busy aurora without ARIA: ${tag}`,
    );
  }
});

test("the glitch is a child span, never the component itself", () => {
  assert.doesNotMatch(html, /class="[^"]*sl-btn[^"]*sl-fx-glitch/);
  assert.match(html, /<span class="sl-fx-glitch" data-text=/);
});
