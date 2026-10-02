import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

// showcase/screens.html — the harness every Lumen-adoption slice is judged on
// (docs/plans/2026-10-02-lumen-adoption.md): real product screens built with
// the kit, one theme per iframe (screens-stage.html), and an in-place overlay
// of the target direction (lab/directions-2/dir-lumen.css).
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(REPO, p), "utf8");
const registry = JSON.parse(read("packages/ui-kit/agent/accent-registry.json")).products;
const accentOf = (id, theme) => registry[id][theme] ?? registry[registry[id].inherits]?.[theme];

await import(pathToFileURL(resolve(REPO, "showcase/screens-contrast.js")).href);
const { ratio, over, rings, display } = globalThis.slContrast;

test("every showcase page links the other two in its top nav", () => {
  const pages = ["index.html", "effects.html", "screens.html"];
  for (const page of pages) {
    const nav = read(`showcase/${page}`).match(/<nav class="pages"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
    for (const other of pages) {
      const current = other === page ? ' aria-current="page"' : "";
      assert.match(nav, new RegExp(`<a href="${other.replace(".", "\\.")}"${current}>`), `${page} nav → ${other}`);
    }
  }
});

test("the stage applies each swatch's registered product, the way a product does", () => {
  const stage = read("showcase/screens-stage.html");
  assert.match(stage, /<link rel="stylesheet" href="\.\.\/packages\/ui-kit\/themes\/products\.css">/);
  assert.match(stage, /setAttribute\("data-sl-product", ACCENTS\[accent\]\.product\)/);
  const rows = [...stage.matchAll(/(\w+):\s*\{ light: "(#[0-9a-fA-F]{6})", dark: "(#[0-9a-fA-F]{6})", product: "([\w-]+)" \}/g)];
  assert.deepEqual(rows.map((r) => [r[1], r[4]]), [["amber", "default"], ["indigo", "spexr"], ["cyan", "introspect"]]);
  for (const [, swatch, light, dark, product] of rows) {
    assert.equal(light.toLowerCase(), accentOf(product, "light").toLowerCase(), `${swatch} light`);
    assert.equal(dark.toLowerCase(), accentOf(product, "dark").toLowerCase(), `${swatch} dark`);
  }
  // the hue only: the steps re-derive in the theme layer
  assert.doesNotMatch(stage, /setProperty\(\s*["']--sl-accent-(?:hover|active|subtle)["']/);
  // and so does the light ring, capped at --sl-accent-text-lmax: pinning it to
  // the raw hue reads amber's ring at 1.97:1 on paper, a defect the kit does
  // not have. Only dark pins its ring as a literal, so only dark re-binds it.
  const ringLines = [...stage.matchAll(/^.*setProperty\(\s*["']--sl-focus-ring["'].*$/gm)].map((m) => m[0]);
  assert.equal(ringLines.length, 1, "one ring binding");
  assert.match(ringLines[0], /if \(theme === "dark"\)/, "the ring is re-bound on dark only");
});

test("each hero card's product colour is that product's registered dark accent", () => {
  const css = read("showcase/screens.css");
  const cards = [...css.matchAll(/\.web-card\[data-product="([\w-]+)"\] \{ --p: (#[0-9a-fA-F]{6}); \}/g)];
  assert.deepEqual(cards.map((c) => c[1]), ["spexr", "introspect", "daos"]);
  for (const [, product, hex] of cards) assert.equal(hex.toLowerCase(), accentOf(product, "dark").toLowerCase(), product);
  const markup = read("showcase/screens.js");
  for (const [, product] of cards) assert.match(markup, new RegExp(`<article class="web-card" data-product="${product}">`));
});

test("the kit view loads the kit's own faces, never a font CDN", () => {
  const stage = read("showcase/screens-stage.html");
  assert.match(stage, /<link rel="stylesheet" href="\.\.\/packages\/ui-kit\/fonts\.css">/);
  assert.doesNotMatch(stage, /fonts\.googleapis|fonts\.gstatic|jsdelivr/);
  // the CDN face belongs to the target alone, added by setTarget()
  const js = read("showcase/screens.js");
  const target = js.slice(js.indexOf("async function setTarget"));
  assert.match(js, /TARGET_FONTS = "https:\/\/fonts\.googleapis\.com/);
  assert.match(target, /sheet\(TARGET_FONTS\)/);
});

test("setTarget re-checks that it is still wanted after waiting for its sheets", () => {
  // setTarget(true) then setTarget(false) in the same tick must end on the kit:
  // the stale call resumes after the await and must not flip back to Lumen.
  const js = read("showcase/screens.js");
  const fn = js.slice(js.indexOf("async function setTarget"), js.indexOf("const health"));
  const wait = fn.indexOf("await Promise.all([sheet(TARGET_FONTS), sheet(TARGET_CSS)]);");
  const flip = fn.indexOf('H.setAttribute("data-dir", "lumen")');
  assert.ok(wait > -1 && flip > wait, "the sheets are awaited before the flip");
  assert.match(fn.slice(0, wait), /wanted = on;/, "the call records what is wanted first");
  assert.match(fn.slice(wait, flip), /if \(wanted !== on\) return/, "and bails out after the await if superseded");
});

test("no measurement samples an element whose lab state class forces its colour", () => {
  // Regression: the settings "Secondary" rows read the focused Preview button,
  // whose .lab-focus border is the focus ring, and passed on the ring's colour.
  const js = read("showcase/screens.js");
  assert.match(js, /const FORCED = "[^"]*\.lab-focus[^"]*";/);
  assert.match(js, /const FORCED = "[^"]*\.lab-hover[^"]*";/);
  const body = js.slice(js.indexOf("function measure()"), js.indexOf("// fixed design width"));
  assert.ok(body.length > 500, "measure() found");
  assert.doesNotMatch(body, /stage\.querySelector\(sel\)/, "every lookup by row selector goes through pick()");
  for (const row of [...js.matchAll(/\["Secondary(?: label)?", "([^"]+)"\]/g)]) assert.doesNotMatch(row[1], /set-bar/, `${row[0]} samples the focused Preview`);
});

/** The selectors of every style rule in a sheet. Comments and statement
 *  at-rules (@import, @layer a, b;) are dropped; @media, @supports, @layer and
 *  @container blocks are unwrapped; @keyframes and @font-face are skipped.
 *  @scope and nested style rules change what a selector means, so they throw. */
function selectors(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@(?:import|layer|charset|namespace)\b[^{};]*;/g, "");
  const out = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    const prelude = src.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (depth && j < src.length) { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; j++; }
    const body = src.slice(open + 1, j - 1);
    if (/^@(media|supports|layer|container)\b/.test(prelude)) out.push(...selectors(body));
    else if (/^@scope\b/.test(prelude)) throw new Error(`@scope is not handled: ${prelude}`);
    else if (/^@/.test(prelude)) { /* @keyframes, @font-face, @property: no selectors */ }
    else {
      if (body.includes("{")) throw new Error(`nested rules are not handled: ${prelude}`);
      let level = 0, start = 0;
      for (let k = 0; k <= prelude.length; k++) {
        const c = prelude[k];
        if (c === "(") level++;
        else if (c === ")") level--;
        else if ((c === "," && level === 0) || k === prelude.length) { out.push(prelude.slice(start, k).trim()); start = k + 1; }
      }
    }
    i = j;
  }
  return out;
}

test("selectors() unwraps grouping at-rules and refuses what it cannot scope-check", () => {
  assert.deepEqual(selectors("@layer a, b; @layer a { @container (min-width: 1px) { .x, .y:is(.p, .q) { c: 1 } } } @media screen { .z { c: 1 } } @keyframes k { from { c: 1 } }"), [".x", ".y:is(.p, .q)", ".z"]);
  assert.throws(() => selectors("@scope (.a) { .b { c: 1 } }"), /@scope/);
  assert.throws(() => selectors(".a { c: 1; .b { c: 2 } }"), /nested/);
});

test("the target overlay is scoped by html[data-dir=lumen], so flipping the attribute is the toggle", () => {
  const path = "lab/directions-2/dir-lumen.css";
  assert.ok(existsSync(resolve(REPO, path)), `${path} is the committed reference target`);
  assert.match(read("showcase/screens.js"), /TARGET_CSS = "\.\.\/lab\/directions-2\/dir-lumen\.css"/);
  const sels = selectors(read(path));
  assert.ok(sels.length > 100, `parsed ${sels.length} selectors`);
  for (const s of sels) assert.match(s, /^(html)?\[data-dir="lumen"\]/, `unscoped selector in ${path}: ${s}`);
});

test(".gitignore fences off the design round's local material", () => {
  const lines = new Set(read(".gitignore").split("\n").map((l) => l.trim()));
  for (const entry of ["refs/", "shots/", "data/", "research.html", "signal.html", "dir-signal.css", "_stage2.html", "_stage2.css", "_screens.js", "_frame2.js"]) {
    assert.ok(lines.has(`lab/directions-2/${entry}`), `.gitignore lacks lab/directions-2/${entry}`);
  }
});

/** What a commit of lab/directions-2 would contain: tracked files plus
 *  untracked ones that are not ignored. Null when git is unavailable. */
function committableLabFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "lab/directions-2"], { cwd: REPO, encoding: "utf8" });
    // a staged deletion is still listed by --cached: keep only what is on disk
    return out.split("\n").filter(Boolean).filter((f) => existsSync(resolve(REPO, f)));
  } catch {
    return null;
  }
}

test("the committed lab reference points at nothing that stays local", (t) => {
  // refs/, shots/, data/, the research board, the second direction and the
  // round's own stage are git-ignored: a committed page that loads or links
  // them is broken in every clone.
  const files = committableLabFiles();
  if (files === null) return t.skip("git is not available");
  assert.ok(files.includes("lab/directions-2/dir-lumen.css"), "dir-lumen.css is committed");
  for (const f of files) {
    assert.doesNotMatch(f, /\/(refs|shots|data)\//, `${f} should stay local`);
    assert.doesNotMatch(read(f), /(?:refs|shots|data)\/|research\.html|signal\.html|dir-signal|_stage2\.|_screens\.js|_frame2\.js/i, f);
  }
});

test("contrast maths: WCAG 2 ratios on known pairs, at full precision", () => {
  const white = [255, 255, 255], black = [0, 0, 0];
  assert.equal(ratio(black, white), 21);
  assert.equal(ratio(white, white), 1);
  assert.equal(display(ratio([0x76, 0x76, 0x76], white)), "4.54");
  assert.equal(ratio(white, black), ratio(black, white), "symmetric");
  // #777 is the classic near miss: 4.48, which must neither round nor display to 4.50
  const r = ratio([0x77, 0x77, 0x77], white);
  assert.ok(r < 4.5, `${r}`);
  assert.equal(display(r), "4.47");
  assert.equal(display(4.4999), "4.49");
  assert.equal(display(4.35), "4.35");
});

test("contrast maths: compositing and rings", () => {
  assert.deepEqual(over([0, 0, 0, 0.5], [255, 255, 255, 1]), [127.5, 127.5, 127.5, 1]);
  assert.deepEqual(over([10, 20, 30], [255, 255, 255, 1]), [10, 20, 30, 1], "no alpha is opaque");
  assert.deepEqual(rings("rgb(1, 2, 3) 0px 0px 0px 1px"), [{ color: "rgb(1, 2, 3)", spread: 1 }]);
  assert.deepEqual(rings("color(srgb 0.5 0.5 0.5 / 0.4) 0px 0px 0px 2px, rgba(0, 0, 0, 0.3) 0px 4px 10px -4px"), [{ color: "color(srgb 0.5 0.5 0.5 / 0.4)", spread: 2 }]);
  assert.deepEqual(rings("oklch(0.7 0.1 60) 0px 0px 0px 1.5px"), [{ color: "oklch(0.7 0.1 60)", spread: 1.5 }]);
  assert.deepEqual(rings("rgb(0, 0, 0) 0px 0px 0px 0px"), [], "a zero spread paints nothing");
  assert.deepEqual(rings("rgb(0, 0, 0) 0px 0px 0px 1px inset"), [], "an inset is not an outer ring");
  assert.deepEqual(rings("rgb(0, 0, 0) 0px 0px 4px 1px"), [], "a blurred shadow is not a ring");
  assert.deepEqual(rings("none"), []);
});
