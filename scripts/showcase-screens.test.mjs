import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// showcase/screens.html — the harness every Lumen-adoption slice is judged on:
// real product screens built with the kit, one theme per iframe
// (screens-stage.html), and an in-place overlay of the target direction
// (lab/directions-2/dir-lumen.css).
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(REPO, p), "utf8");
const registry = JSON.parse(read("packages/ui-kit/agent/accent-registry.json")).products;

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

test("the stage applies the registry's accents the way a product does", () => {
  const stage = read("showcase/screens-stage.html");
  const pick = (name) => stage.match(new RegExp(`${name}:\\s*\\{ light: "(#[0-9a-fA-F]{6})", dark: "(#[0-9a-fA-F]{6})" \\}`))?.slice(1).map((v) => v.toLowerCase());
  for (const [name, product] of [["amber", "default"], ["indigo", "spexr"], ["cyan", "introspect"]]) {
    assert.deepEqual(pick(name), [registry[product].light.toLowerCase(), registry[product].dark.toLowerCase()], name);
  }
  // the hue only: the steps re-derive in the theme layer
  assert.doesNotMatch(stage, /setProperty\(\s*["']--sl-accent-(?:hover|active|subtle)["']/);
  // and so does the light ring, capped at --sl-accent-text-lmax: pinning it to
  // the raw hue reads amber's ring at 1.97:1 on paper, a defect the kit does
  // not have. Only dark pins its ring as a literal, so only dark re-binds it.
  const rings = [...stage.matchAll(/^.*setProperty\(\s*["']--sl-focus-ring["'].*$/gm)].map((m) => m[0]);
  assert.equal(rings.length, 1, "one ring binding");
  assert.match(rings[0], /if \(theme === "dark"\)/, "the ring is re-bound on dark only");
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

/** The selectors of every style rule in a sheet, with @media/@supports
 *  unwrapped and @keyframes skipped. Comments are stripped first. */
function selectors(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open < 0) break;
    const prelude = src.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (depth && j < src.length) { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; j++; }
    const body = src.slice(open + 1, j - 1);
    if (/^@(media|supports)/.test(prelude)) out.push(...selectors(body));
    else if (!prelude.startsWith("@")) {
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

test("the target overlay is scoped by html[data-dir=lumen], so flipping the attribute is the toggle", () => {
  const path = "lab/directions-2/dir-lumen.css";
  assert.ok(existsSync(resolve(REPO, path)), `${path} is the committed reference target`);
  assert.match(read("showcase/screens.js"), /TARGET_CSS = "\.\.\/lab\/directions-2\/dir-lumen\.css"/);
  const sels = selectors(read(path));
  assert.ok(sels.length > 100, `parsed ${sels.length} selectors`);
  for (const s of sels) assert.match(s, /^(html)?\[data-dir="lumen"\]/, `unscoped selector in ${path}: ${s}`);
});

test("the committed lab reference points at nothing that stays local", () => {
  // refs/, shots/, data/, the research board and the second direction are
  // git-ignored: a committed page that links them is broken in every clone.
  const committed = ["index.html", "lumen.html", "compare.html", "_stage2.html", "_stage2.css", "_screens.js", "_frame2.css", "_frame2.js", "dir-lumen.css"];
  for (const f of committed) {
    const src = read(`lab/directions-2/${f}`);
    assert.doesNotMatch(src, /(?:refs|shots|data)\/|research\.html|signal\.html|dir-signal/i, `lab/directions-2/${f}`);
  }
});
