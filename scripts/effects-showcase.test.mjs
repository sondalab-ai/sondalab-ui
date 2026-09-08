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

test("the showcase applies all four families to real elements", () => {
  // Assert the class is APPLIED, not merely mentioned. The page's own captions
  // name these classes as documentation text, so a bare substring match passes
  // on a page where every class attribute had been deleted.
  for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-glitch"]) {
    assert.match(
      html, new RegExp(`class="[^"]*\\b${cls}\\b`),
      `showcase must apply .${cls} to an element, not just name it in prose`,
    );
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

/** The body of a top-level function in the page's boot script, so an assertion
 *  can be about where a claim LIVES rather than whether a string exists. */
function fnBody(name) {
  const start = html.search(new RegExp(`function ${name}\\b`));
  assert.ok(start > -1, `missing function: ${name}`);
  const open = html.indexOf("{", start);
  let depth = 0;
  let i = open;
  do {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") depth--;
    i++;
  } while (depth > 0 && i < html.length);
  return html.slice(open + 1, i - 1);
}

test("the showcase reports which tier actually resolved", () => {
  assert.match(html, /mountGpu\(\)/, "the page must attempt the GPU tier");

  // The Tier 2 claim must be derived from the attribute bootField owns, in the
  // same function that reads it. A bare substring check would pass on a page
  // that hardcoded the label, or set it from mountGpu()'s return value — which
  // is the one thing the design forbids, because the field can tear itself down
  // after resolving, on a lost device or an async validation error.
  const label = fnBody("updateTierLabel");
  assert.match(label, /data-sl-fx-gpu/, "the label must read the attribute, not the return value");
  assert.match(label, /TIER 2/, "the Tier 2 claim must live where the attribute is read");

  // And the observer must actually watch that attribute, or a torn-down field
  // leaves the label frozen on TIER 2 until an unrelated theme toggle.
  assert.match(
    html, /attributeFilter:\s*\[[^\]]*data-sl-fx-gpu/,
    "the MutationObserver must watch data-sl-fx-gpu, not only data-sl-theme",
  );
});
