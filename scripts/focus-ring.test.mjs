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
      || c.classes.some((cls) => /\.sl-slider:focus-visible::-webkit-slider-thumb\s*\{[^}]*box-shadow/.test(css) && css.includes(`.${cls}:focus-visible::-moz-range-thumb`));
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

// Regression, 2026-10-01 (owner: "no gaps between borders in any case"): the
// ring sits flush on the border. A positive offset opens a band of page
// between the control's edge and the ring.
test("the focus ring sits flush on the border, no gap", () => {
  const tokens = readFileSync(resolve(REPO, "packages/ui-kit/tokens.css"), "utf8");
  assert.match(tokens, /--sl-focus-ring-offset:\s*0px;/);
  assert.match(css, /outline-offset:\s*var\(--sl-focus-ring-offset, 0px\);/);
  assert.doesNotMatch(css, /--sl-focus-ring-offset, [1-9]/, "no fallback may reopen the gap");
  const ring = css.slice(css.indexOf("outline: var(--sl-focus-ring-width"), css.indexOf("}", css.indexOf("outline: var(--sl-focus-ring-width")));
  assert.match(ring, /border-color:\s*var\(--slc-focus\)/, "the border joins the ring");
  assert.match(css, /\.sl-icon-btn\[aria-pressed="true"\]:focus-visible,\s*\.sl-chip:hover:focus-visible\s*\{\s*border-color:\s*var\(--slc-focus\);/, "a pressed or hovered border joins the ring too");
  const effects = readFileSync(resolve(REPO, "packages/ui-kit/effects.css"), "utf8");
  assert.match(effects, /:is\(\.sl-btn, \.sl-icon-btn\)\.sl-fx-glass\.sl-fx-glass:focus-visible\s*\{\s*--slfx-control-edge:\s*var\(--slc-focus\);/, "a glass control's edge joins the ring");
});
