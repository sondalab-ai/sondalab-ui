import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";
import { readWoff2, codepoints, axes, parseUnicodeRange, WOFF2_MAGIC } from "./lib/woff2.mjs";

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
for (const page of ["showcase/index.html", "showcase/effects.html", "showcase/screens.html", "showcase/screens-stage.html"]) {
  test(`${page} loads the kit's fonts.css, no font CDN, no retired UI face`, () => {
    const html = readFileSync(resolve(REPO, page), "utf8");
    assert.match(html, /<link rel="stylesheet" href="\.\.\/packages\/ui-kit\/fonts\.css">/);
    assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
    assert.doesNotMatch(html, /Instrument|Martian/, "the UI faces are Geist and Geist Mono since 0.30");
  });
}

// ── the files themselves ──────────────────────────────────────────────────
// The checks above trust fonts.css; these read each file's own tables, so a
// renamed TTF, a face that claims a weight its axis cannot draw, or a range
// that claims glyphs the file lacks all fail here.

/** The latin range every face shares (the Google Fonts latin subset's). */
const LATIN = parseUnicodeRange(
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, " +
  "U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD");
/** The IDE blocks a face may add (owner, 2026-10-02): arrows, math operators,
 *  miscellaneous technical, box drawing, block elements, geometric shapes. */
const IDE = parseUnicodeRange("U+2190-21FF, U+2200-22FF, U+2300-23FF, U+2500-257F, U+2580-259F, U+25A0-25FF");
const prop = (body, name) => body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
const fontOf = (file) => readWoff2(readFileSync(resolve(KIT, file)));

for (const face of faces()) {
  const file = face.files[0];
  test(`${file} is a WOFF2 file`, () => {
    assert.equal(readFileSync(resolve(KIT, file)).toString("latin1", 0, 4), WOFF2_MAGIC);
  });

  test(`"${face.family}" claims no weight its wght axis cannot draw`, () => {
    const wght = axes(fontOf(file)).find((a) => a.tag === "wght");
    assert.ok(wght, `${file} has no wght axis`);
    const [lo, hi = lo] = prop(face.body, "font-weight").split(/\s+/).map(Number);
    assert.ok(lo >= wght.min && hi <= wght.max, `font-weight ${lo} ${hi} outside the axis ${wght.min}–${wght.max}`);
  });

  test(`"${face.family}" follows the range policy: the shared latin range, plus exactly the IDE glyphs its file has`, () => {
    const declared = parseUnicodeRange(prop(face.body, "unicode-range"));
    const cmap = codepoints(fontOf(file));
    for (const cp of LATIN) assert.ok(declared.has(cp), `U+${cp.toString(16).toUpperCase()} of the latin range is missing`);
    const extra = [...declared].filter((cp) => !LATIN.has(cp));
    const hex = (cps) => cps.map((cp) => "U+" + cp.toString(16).toUpperCase()).join(" ");
    const outside = extra.filter((cp) => !IDE.has(cp));
    assert.deepEqual(outside, [], `claims outside the latin range and the IDE blocks: ${hex(outside)}`);
    const lacking = extra.filter((cp) => !cmap.has(cp));
    assert.deepEqual(lacking, [], `claims code points the file has no glyph for: ${hex(lacking)}`);
    const unclaimed = [...cmap].filter((cp) => IDE.has(cp) && !declared.has(cp));
    assert.deepEqual(unclaimed, [], `has IDE glyphs its range does not claim: ${hex(unclaimed)}`);
  });
}

test("Geist Mono draws the IDE glyphs a terminal and an editor reach for", () => {
  const cmap = codepoints(fontOf("assets/fonts/geist-mono-latin.woff2"));
  for (const ch of "→⇧↵⏎⌫─│┌┐└┘├┤═║█░≠≤≥●▶") assert.ok(cmap.has(ch.codePointAt(0)), `${ch} is not in the file`);
});

// Instrument Sans and Martian Mono are deprecated in 0.30 and kept for one
// release window: a product that names them by hand keeps rendering until
// 1.0.0, and 1.0.0 removes them.
test("the deprecated faces stay declared and shipped until 1.0.0, and go at 1.0.0", () => {
  const major = Number(pkg.version.split(".")[0]);
  const declared = new Set(faces().map((f) => f.family));
  for (const [family, file] of [["Instrument Sans", "assets/fonts/instrument-sans-latin.woff2"], ["Martian Mono", "assets/fonts/martian-mono-latin.woff2"]]) {
    if (major < 1) {
      assert.ok(declared.has(family), `${family} must stay declared until 1.0.0`);
      assert.ok(listed(file), `${file} must stay packed until 1.0.0`);
    } else {
      assert.ok(!declared.has(family), `${family} is removed in 1.0.0`);
      assert.ok(!listed(file), `${file} is removed in 1.0.0`);
    }
  }
});
