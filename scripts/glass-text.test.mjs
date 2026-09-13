import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const js = readFileSync(resolve(KIT, "glass-text.js"), "utf8");
const effects = readFileSync(resolve(KIT, "effects.js"), "utf8");
const css = readFileSync(resolve(KIT, "effects.css"), "utf8");

test("the mask is measured in page pixels, not in bounding-box units", () => {
  // objectBoundingBox was tried and is a trap: an SVG font-size in bounding-box
  // units scales by the NORMALISED DIAGONAL, not by the height, so on a box
  // that is not square the glyphs come out stretched and the mask renders as a
  // slab. The failure looks like a styling choice, which is why it is asserted
  // rather than left to a comment.
  assert.match(js, /maskUnits", "userSpaceOnUse"/);
  assert.match(js, /maskContentUnits", "userSpaceOnUse"/);
  assert.ok(!/objectBoundingBox/.test(js.replace(/\/\*[\s\S]*?\*\//g, "")),
    "and nothing outside the comments reaches for the other units");
});

test("the mask lives in the document, so it can see the page's webfonts", () => {
  // A data: URI has no access to a webfont and silently falls back to a system
  // face -- a different shape from the one the element measured itself from,
  // so the mask sits beside the glyphs instead of on them.
  assert.match(js, /createElementNS\("http:\/\/www\.w3\.org\/2000\/svg", "mask"\)/);
  assert.match(js, /function defsHost\(\)/, "and the module owns the <defs> it needs");
  assert.match(js, /document\.body\.append\(svg\)/,
    "a consumer is never asked to hand-author an empty <svg> first");
});

test("the run is centred by the renderer, not by a measured advance", () => {
  // A canvas advance ignores letter-spacing unless ctx.letterSpacing is set,
  // so centring on it is right for a numeral at -0.02em and visibly wrong for
  // a label tracked at 0.2em. text-anchor: middle lets SVG lay the run out
  // with the real advance. Verified in Chrome on the showcase: with the host
  // at width: max-content the run lands at exactly padding-left on both, at
  // -0.02em and at +0.06em.
  assert.match(js, /setAttribute\("text-anchor", "middle"\)/);
  assert.match(js, /setAttribute\("x", String\(box\.width \/ 2\)\)/);
  assert.match(css, /\.sl-fx-glass--text \{[\s\S]*?width: max-content;/,
    "which only holds while the host's box IS the run");
});

test("the baseline comes off the face, never off a guessed ratio", () => {
  assert.match(js, /actualBoundingBoxAscent/);
  assert.match(js, /actualBoundingBoxDescent/);
  assert.match(js, /document\.fonts\?\.ready\.then\(recut\)/,
    "and it is re-cut once the webfont has arrived, or the ascent is a fallback's");
});

test("the glow is a sibling, carries the host's type, and keeps its string", () => {
  // Three defects this closes, each seen on sondalab-site first:
  //   inside the host  -> masked away with everything else;
  //   own type         -> a 14px halo under an 88px figure;
  //   own string       -> a glitch scramble decoded in the glass while the
  //                       halo stayed still, reading as the text changing
  //                       BEHIND its own light.
  assert.match(js, /el\.before\(glow\)/);
  assert.match(js, /glow\.className = "sl-fx-glass__glow"/);
  assert.match(js, /glow\.setAttribute\("aria-hidden", "true"\)/,
    "it is a second copy of text already in the document");
  assert.match(js, /if \(glow\.textContent !== el\.textContent\) glow\.textContent = el\.textContent;/);
  for (const prop of ["font-family", "font-size", "letter-spacing", "padding-left"]) {
    assert.ok(js.includes(`"${prop}"`), `the glow borrows ${prop}`);
  }
  assert.match(js, /characterData: true/,
    "and a scramble rewrites a text node in place, so characterData is what sees it");
});

test("a box rim is meaningless on a letterform", () => {
  // glass.css's __shine gives a pane its thickness with an inset line along the
  // top of its BOX; masked to a letterform that survives as a white bar across
  // the text. The radius goes for the same reason: a rounded rect under a mask
  // rounds corners nobody can see.
  const block = css.slice(css.indexOf(".sl-fx-glass--text {"));
  const decls = block.slice(0, block.indexOf("}"));
  assert.match(decls, /--slg-radius: 0;/);
  assert.match(decls, /--slg-rim-hi: transparent;/);
  assert.match(decls, /--slg-rim-lo: transparent;/);
  assert.match(decls, /padding: 0\.09em 0\.07em;/,
    "and the ink gets room: measured, 92.6px of it in an 89.6px box at the 7rem cap");
  // A mask changes what is PAINTED, never what is hit: the host's box is the
  // whole run, so an oversized word over a card swallowed every click inside
  // its rectangle. Measured on the showcase before the line existed --
  // elementFromPoint at the centre of the figure returned the figure.
  assert.match(decls, /pointer-events: none;/);
});

test("the glow's light is read with a fallback, never declared on the element", () => {
  // A custom property declared on the element beats the same property inherited
  // from an ancestor, so a default written here would put an inversion band's
  // rebinding out of reach -- and inside a band --slc-text is the band's own
  // GROUND, which makes a glow built from it invisible.
  const block = css.slice(css.indexOf(".sl-fx-glass__glow {"));
  const decls = block.slice(0, block.indexOf("}"));
  assert.ok(!/--slfx-text-light:/.test(decls), "no declaration");
  assert.match(decls, /var\(--slfx-text-light, var\(--slc-text, var\(--sl-text-primary\)\)\)/);
  assert.match(decls, /var\(--slfx-text-core-a, 46%\)/);
  assert.match(decls, /var\(--slfx-text-halo-a, 26%\)/);
});

test("the cut is armed with the material, not with the motion", () => {
  // A mask is not motion: it is the shape the material has. The same argument
  // the goo and the lens already won -- arm before mount()'s reduced-motion
  // guard, refuse high contrast separately.
  const guard = effects.indexOf("if (window.matchMedia(REDUCE).matches");
  const armed = effects.indexOf("armGlassText(root);");
  assert.ok(armed > -1 && guard > -1 && armed < guard,
    "armGlassText runs before the reduced-motion guard");
  assert.match(effects, /const GLASS_TEXT_HOSTS = "\.sl-fx-glass--text";/);
  assert.match(effects, /if \(glassTexts\.has\(el\)\) continue;/,
    "and a second mount() does not cut the same host twice");
  assert.match(effects, /await import\("\.\/glass-text\.js"\)/,
    "dynamically imported, so a surface with no glass text pays nothing");
  assert.match(effects, /armGlassText\(n\);/,
    "late arrivals are cut too");
});

test("a host under data-sl-fx=\"off\" is refused", () => {
  assert.match(js, /el\.closest\('\[data-sl-fx="off"\]'\)\) return null;/);
});
