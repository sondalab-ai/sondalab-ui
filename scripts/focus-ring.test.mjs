import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const css = readFileSync(resolve(REPO, "packages/ui-kit/components.css"), "utf8");
const index = JSON.parse(
  readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.json"), "utf8"),
);

// The shared focus ring is ONE rule, and its selector list is enumerated by
// hand. A new interactive class that never gets a line here loses the house
// ring and nothing else fails — which is exactly why this test exists.
// Anchored on the declaration rather than on a comment, so re-wording the
// comment above the rule cannot silently empty the list.
function focusRingSelector() {
  const decl = css.indexOf("outline: var(--sl-focus-ring-width");
  assert.notEqual(decl, -1, "components.css has no shared focus-ring rule");
  const open = css.lastIndexOf("{", decl);
  const prevClose = Math.max(css.lastIndexOf("}", open), css.lastIndexOf("*/", open) + 1);
  return css.slice(prevClose + 1, open);
}

const selector = focusRingSelector();

test("the focus-ring rule names at least one selector", () => {
  assert.match(selector, /\.sl-/, `focus-ring selector list looks empty: ${selector}`);
});

for (const c of index.components.filter((c) => c.interactive)) {
  test(`focus ring covers "${c.id}"`, () => {
    const hit = c.classes.some((cls) => selector.includes(`.${cls}`))
      // A native range input draws its focus on the thumb, in a rule of its
      // own per engine: an engine pseudo-element cannot join the shared list
      // without dropping the whole list in the other engine.
      || c.classes.some((cls) => css.includes(`.${cls}:focus-visible::-webkit-slider-thumb`));
    assert.ok(
      hit,
      `"${c.id}" is marked interactive but none of ${JSON.stringify(c.classes)} ` +
        `appears in the focus-ring selector list:\n${selector}`,
    );
  });
}

// Regression (spexr migration, 2026-09-30): the shared ring set border-radius:
// 6px, so a 10px field or row snapped its corners on keyboard focus.
test("the shared focus ring sets no radius; the outline follows the element's own", () => {
  const decl = css.indexOf("outline: var(--sl-focus-ring-width");
  const body = css.slice(css.lastIndexOf("{", decl), css.indexOf("}", decl));
  assert.doesNotMatch(body, /border-radius/);
});

// Regression (introspect migration, 2026-09-30): a <button class="sl-nav__item">
// kept the native button chrome.
test("a nav item resets native button chrome", () => {
  const rule = css.match(/\.sl-nav__item \{([^}]*)\}/)[1];
  for (const d of [/appearance:\s*none/, /background:\s*none/, /border:\s*0/, /font:\s*inherit/, /text-align:\s*left/]) {
    assert.match(rule, d);
  }
});
