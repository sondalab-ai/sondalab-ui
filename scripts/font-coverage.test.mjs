import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

// Every face a --sl-font-* token names first must ship with the kit: declared
// in fonts.css, its file on disk, the file in package.json `files` (npm only
// packs what is listed), and its OFL licence beside it. A token that names a
// face nothing serves renders every surface in the fallback stack, silently.
// Only the FIRST family of a stack is the kit's: the rest ("SF Mono",
// "Segoe UI", Georgia, …) are the platform's own fallbacks.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const KIT = resolve(REPO, "packages/ui-kit");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokens = bare(readFileSync(resolve(KIT, "tokens.css"), "utf8"));
const fontsCss = bare(readFileSync(resolve(KIT, "fonts.css"), "utf8"));
const pkg = JSON.parse(readFileSync(resolve(KIT, "package.json"), "utf8"));

/** --sl-font-<role> → its first family, unquoted. */
function tokenFaces() {
  const out = new Map();
  for (const m of tokens.matchAll(/(--sl-font-[a-z]+):\s*([^;]+);/g)) {
    out.set(m[1], m[2].split(",")[0].trim().replace(/^["']|["']$/g, ""));
  }
  return out;
}

/** Every @font-face in fonts.css: { family, files } with files relative to the kit. */
function faces() {
  return [...fontsCss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
    const family = m[1].match(/font-family:\s*["']?([^"';]+)["']?\s*;/)?.[1];
    const files = [...m[1].matchAll(/url\(["']?([^"')]+)["']?\)/g)]
      .map((u) => relative(KIT, resolve(KIT, u[1])));
    return { family, files, body: m[1] };
  });
}

const listed = (path) => pkg.files.some((f) => f === path || (f.endsWith("/") && path.startsWith(f)));

test("the token layer names the faces it is meant to (0.30: Geist UI, Fraunces brand)", () => {
  const t = tokenFaces();
  assert.equal(t.get("--sl-font-sans"), "Geist");
  assert.equal(t.get("--sl-font-display"), "Geist");
  assert.equal(t.get("--sl-font-mono"), "Geist Mono");
  assert.equal(t.get("--sl-font-brand"), "Fraunces");
});

for (const [token, family] of tokenFaces()) {
  test(`${token} (${family}) is declared in fonts.css, on disk, and packed`, () => {
    const face = faces().find((f) => f.family === family);
    assert.ok(face, `fonts.css declares no @font-face for "${family}"`);
    assert.ok(face.files.length > 0, `the "${family}" face has no src url`);
    for (const file of face.files) {
      assert.ok(existsSync(resolve(KIT, file)), `${file} (${family}) is not on disk`);
      assert.ok(listed(file), `${file} (${family}) is not in package.json "files"`);
    }
  });
}

for (const face of faces()) {
  test(`fonts.css "${face.family}": file packed, licence beside it, swap`, () => {
    for (const file of face.files) {
      assert.ok(existsSync(resolve(KIT, file)), `${file} is not on disk`);
      assert.ok(listed(file), `${file} is not in package.json "files"`);
    }
    // OFL 1.1 requires the licence to travel with the font files.
    const licence = `assets/fonts/OFL-${face.family.replace(/\s+/g, "")}.txt`;
    assert.ok(existsSync(resolve(KIT, licence)), `${licence} is not on disk`);
    assert.match(readFileSync(resolve(KIT, licence), "utf8"), /SIL Open Font License, Version 1\.1/, licence);
    assert.ok(listed(licence), `${licence} is not in package.json "files"`);
    assert.match(face.body, /font-display:\s*swap/, `${face.family} must not block text while it loads`);
  });
}

test("fonts.css and its files are reachable through the package exports", () => {
  assert.equal(pkg.exports["./fonts.css"], "./fonts.css");
  assert.equal(pkg.exports["./assets/fonts/*"], "./assets/fonts/*");
  assert.ok(listed("fonts.css"));
});

// The showcase is the kit's reference page: it renders in the kit's own files,
// so what it shows is what a consumer of fonts.css gets — never a CDN copy of
// a face the tokens no longer name.
for (const page of ["showcase/index.html", "showcase/effects.html"]) {
  test(`${page} loads the kit's fonts.css, no font CDN, no retired UI face`, () => {
    const html = readFileSync(resolve(REPO, page), "utf8");
    assert.match(html, /<link rel="stylesheet" href="\.\.\/packages\/ui-kit\/fonts\.css">/);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
    assert.doesNotMatch(html, /Instrument|Martian/, "the UI faces are Geist and Geist Mono since 0.30");
  });
}
