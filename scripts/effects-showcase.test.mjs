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

test("the showcase applies all five families to real elements", () => {
  // Assert the class is APPLIED, not merely mentioned. The page's own captions
  // name these classes as documentation text, so a bare substring match passes
  // on a page where every class attribute had been deleted.
  for (const cls of ["sl-fx-glass", "sl-fx-aurora", "sl-fx-liquid", "sl-fx-goo", "sl-fx-glitch"]) {
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

test("every text button is a glass pane; only a round icon-only button goes gooey", () => {
  // The owner's rule, held mechanically on the reference page: the gooey
  // belongs to round icon-only buttons (--drop, an aria-label because there
  // is no text), and every other button is made of glass (--pane), whatever
  // its variant. A bare .sl-fx-liquid on a button is a mistake either way.
  const buttons = [...html.matchAll(/<button class="([^"]*\bsl-btn\b[^"]*)"([^>]*)>/g)];
  assert.ok(buttons.length >= 8, "the showcase must show its buttons");
  let drops = 0;
  for (const [tag, cls, attrs] of buttons) {
    if (/\bsl-fx-liquid\b/.test(cls)) {
      assert.match(cls, /\bsl-fx-liquid--drop\b/, `a liquid button must be --drop: ${tag}`);
      assert.match(attrs, /aria-label=/, `a --drop button is icon-only and needs an aria-label: ${tag}`);
      assert.doesNotMatch(cls, /\bsl-fx-glass--pane\b/, `a round button is gooey, not a pane: ${tag}`);
      drops++;
    } else {
      assert.match(cls, /\bsl-fx-glass--pane\b/, `a text button must be a glass pane: ${tag}`);
      assert.match(cls, /\bsl-fx-glass\b/, `--pane requires .sl-fx-glass: ${tag}`);
    }
  }
  assert.ok(drops >= 1, "the gooey must have somewhere to demonstrate: a round icon-only button");
});

test("the showcase imports compositions.css, after effects.css", () => {
  const links = [...html.matchAll(/<link[^>]*href="([^"]*\.css)"/g)].map((m) => m[1]);
  const fx = links.findIndex((h) => h.endsWith("effects.css"));
  const comp = links.findIndex((h) => h.endsWith("compositions.css"));
  assert.ok(comp > -1, "the page must import compositions.css, or nothing on it tests that file");
  assert.ok(fx > -1 && comp > fx, "compositions.css binds properties effects.css reads: it must come after");
});

test("the showcase declares none of the bindings compositions.css owns", () => {
  // The page is only a test of that file while it does not hand-roll the same
  // values: a page-local copy makes a working shipped stylesheet and a shadowed
  // one indistinguishable. The property list is read OUT of the stylesheet, so
  // a binding added or dropped there is covered without editing this test.
  // Scoped to the page's own <style>, because the prose below the demos
  // legitimately names these properties.
  const comp = readFileSync(resolve(REPO, "packages/ui-kit/compositions.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const owned = [...new Set([...comp.matchAll(/(--slfx-[a-z0-9-]+)\s*:/g)].map((m) => m[1]))];
  assert.ok(owned.length > 0, "compositions.css must declare at least one binding");
  const style = html.slice(html.indexOf("<style"), html.indexOf("</style>"));
  for (const prop of owned) {
    assert.doesNotMatch(
      style, new RegExp(`${prop}\\s*:`),
      `${prop} ships in compositions.css — a page-local declaration hides whether it works`,
    );
  }
});

test("every binding compositions.css owns has something on the page to act on", () => {
  // A binding whose selector matches nothing is inert whether it works or not.
  const comp = readFileSync(resolve(REPO, "packages/ui-kit/compositions.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [...comp.matchAll(/^([.][a-z0-9_ ,.\-\n]*?)\s*\{/gm)]
    .flatMap((m) => m[1].split(","))
    .map((s) => s.trim().replace(/^\./, ""))
    .filter(Boolean);
  assert.ok(selectors.length > 0, "compositions.css must declare at least one rule");
  for (const cls of selectors) {
    assert.match(
      html, new RegExp(`class="[^"]*\\b${cls.replace(/[-]/g, "[-]")}\\b`),
      `compositions.css binds .${cls}, and the showcase renders no such element`,
    );
  }
});

test("the showcase uses the shipped inversion band, not a hand-rolled one", () => {
  // .sl-invert carries the three-role remap the glass fallback needs
  // (--slfx-edge-hi/mid read --slc-border-strong). The page hand-rolled it
  // until 0.10.0; a re-introduced local band would silently take over.
  assert.match(html, /class="sl-invert\b/, "the band must be the shipped class");
  // `-` is a word boundary, so \binvert\b matches sl-invert too: exclude a
  // preceding hyphen or word character explicitly.
  assert.doesNotMatch(html, /class="[^"]*(?<![\w-])invert(?![\w-])/, "no hand-rolled .invert band");
});
