import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { REGISTRY, THEMES, ratio, rulesFor } from "./lib/primary-matrix.mjs";
import { parseSheet, el, cascaded, customs, longhand, splitList, px } from "./lib/cascade.mjs";
import { evaluate, substitute, toSrgb, fromSrgb, toHex } from "./lib/css-color.mjs";
import { createHash } from "node:crypto";
import { VOID, PITCH, TONES, GLYPHS, FIELDS, POSTERS, POSTER_COLS, POSTER_ROWS, POSTER_INK, PRINT_PALETTE, DISSOLVE, SHAPE_CELLS, glyph, field, shapes, dissolve, posterCells, posterPng, posterInkPng, voidImage, voidThreshold, START, END } from "./gen-art.mjs";
import { deflate, png } from "./lib/png.mjs";
import { inflateSync } from "node:zlib";
import { CELL_PX, bayerAt } from "../packages/ui-kit/dither-core.js";

// The Bauhaus pixel art (ui-kit 0.41.0, 0.42.0): masks drawn on the dither cell by
// scripts/gen-art.mjs, painted from role vars by hand rules beside the
// elements they decorate. Each test below reads the committed CSS, so a
// hand edit to a rule or a stale generated block fails here.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const CSS_PATH = resolve(REPO, "packages/ui-kit/components.css");
const raw = readFileSync(CSS_PATH, "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every piece: its host classes and the pseudo-element that paints it;
 *  `also` names the second one of a piece painted on both. */
const PIECES = {
  "sl-eyebrow--mark": { host: ["sl-eyebrow", "sl-eyebrow--mark"], pseudo: "before" },
  "sl-rule--shapes": { host: ["sl-rule", "sl-rule--shapes"], pseudo: "before", tag: "hr" },
  "sl-rule--weave": { host: ["sl-rule", "sl-rule--weave"], pseudo: "before", tag: "hr" },
  "sl-art-corner": { host: ["sl-card", "sl-art-corner"], pseudo: "after" },
  "sl-art-field": { host: ["sl-art-field"], pseudo: "before" },
  "sl-empty--void": { host: ["sl-empty", "sl-empty--void"], pseudo: "after" },
  "sl-empty--shapes": { host: ["sl-empty", "sl-empty--shapes"], pseudo: "before" },
  "sl-art-poster": { host: ["sl-art-poster"], pseudo: "after", also: "before" },
};
/** Every pseudo-element a piece paints on. */
const pseudosOf = (p) => [p.pseudo, p.also].filter(Boolean);
const PAINTS = ["--_sl-art-paint", "--_sl-art-accent"];
/** The pieces that can sit under text: the contrast test binds these. */
const UNDERLAY = ["sl-art-field", "sl-art-corner", "sl-empty--void"];
/** The in-flow marks: they take space, so where they paint nothing they go. */
const IN_FLOW = ["sl-eyebrow--mark", "sl-empty--shapes"];
/** The eyebrow glyph modifiers, each worn with sl-eyebrow--mark. */
const GLYPH_MODIFIERS = Object.keys(GLYPHS).filter((k) => k !== "mark").map((k) => `sl-eyebrow--mark-${k}`);
/** The field modifiers (the truchet is the bare field) and the fades, each
 *  worn with sl-art-field. */
const FIELD_MODIFIERS = Object.keys(FIELDS).filter((k) => k !== "truchet").map((k) => `sl-art-field--${k}`);
const FADES = ["sl-art-field--fade-start", "sl-art-field--fade-end", "sl-art-field--fade-down"];
/** The poster's variants (Composition 8 is the bare poster), each worn
 *  with sl-art-poster. */
const POSTER_MODIFIERS = Object.keys(POSTERS).filter((k) => k !== "composition").map((k) => `sl-art-poster--${k}`);
/** Every field and fade as a host of its own, for the tests that bind each. */
const FIELD_HOSTS = Object.fromEntries([...FIELD_MODIFIERS, ...FADES].map((m) => [m, { host: ["sl-art-field", m], pseudo: "before" }]));

const block = (() => {
  const a = raw.indexOf(START), b = raw.indexOf(END);
  return a > -1 && b > a ? raw.slice(a, b + END.length) : "";
})();
const uris = [...block.matchAll(/url\('data:image\/svg\+xml,([^']*)'\)/g)].map((m) => decodeURIComponent(m[1]));

/** Every top-level rule body whose selector list names `cls` with `pseudo`,
 *  or the host itself when `pseudo` is null, outside any at-rule. */
function rulesNaming(cls, pseudo) {
  const out = [];
  const re = /(?<=^|\})\s*([^{}@]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const sels = splitList(m[1]);
    const hit = sels.some((s) => {
      if (!new RegExp(`\\.${cls}(?![\\w-])`).test(s)) return false;
      return pseudo ? s.endsWith(`::${pseudo}`) : !/::/.test(s);
    });
    if (hit) out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

test("gen-art --check finds the committed block current", () => {
  const r = spawnSync(process.execPath, [resolve(HERE, "gen-art.mjs"), "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});

test("the generated block exists and carries every mask", () => {
  assert.ok(block, `${START} … ${END} missing from components.css`);
  assert.ok(uris.length >= 8, `expected at least 8 masks, found ${uris.length}`);
});

test("every mask is drawn on whole cells and renders crisp", () => {
  for (const svg of uris) {
    assert.match(svg, /shape-rendering="crispEdges"/, svg.slice(0, 120));
    const nums = [...svg.matchAll(/\b(?:viewBox|width|height|x|y)="([^"]*)"/g)].flatMap((m) => m[1].split(/[\s,]+/));
    for (const d of svg.matchAll(/\bd="([^"]*)"/g)) nums.push(...d[1].split(/[^\d.-]+/).filter(Boolean));
    assert.ok(nums.length > 0, "a mask with no coordinates");
    const bad = nums.filter((n) => !/^-?\d+$/.test(n));
    assert.deepEqual(bad, [], `fractional cell coordinates in ${svg.slice(0, 120)}`);
  }
});

test("no mask carries a colour: alpha only, from the default black fill", () => {
  for (const svg of uris) {
    assert.doesNotMatch(svg, /#|rgb\(|rgba\(|hsl\(|hsla\(|oklch\(|oklab\(|color-mix\(/i, svg.slice(0, 120));
    for (const m of svg.matchAll(/\bfill="([^"]*)"/g)) assert.match(m[1], /^(black|white)$/, `fill="${m[1]}"`);
  }
});

test("the generated block stays within the 44 KB payload budget", () => {
  // 24 KB in 0.41; 32 KB for the 0.42 variants (marks, fields, poster);
  // 44 KB in 0.44, when the four posters became paintings (two images
  // each, about 14 KB of the block) on the owner's choice, 2026-11-11.
  const bytes = Buffer.byteLength(block, "utf8");
  assert.ok(bytes <= 45056, `generated block is ${bytes} bytes`);
});

test("every piece paints through a static, inert pseudo-element", () => {
  for (const [cls, p] of Object.entries(PIECES)) for (const pseudo of pseudosOf(p)) {
    const rules = rulesNaming(cls, pseudo);
    assert.ok(rules.length, `${cls}::${pseudo} has no rule`);
    const all = rules.map((r) => r.body).join(";");
    assert.match(all, /pointer-events:\s*none/, `${cls}::${pseudo} takes pointer events`);
    // a poster's colour layer is a generated image, every other layer a generated mask
    const paint = cls === "sl-art-poster" && pseudo === "before" ? /background:[^;]*var\(--sl-art-poster-/ : /mask(-image)?:[^;]*var\(--sl-art-/;
    assert.match(all, paint, `${cls}::${pseudo} is not painted from a generated mask or image`);
    for (const r of [...rules, ...rulesNaming(cls, null)]) {
      assert.doesNotMatch(r.body, /(^|;)\s*(animation|transition)(-[\w-]+)?\s*:/, `${r.selector} animates`);
    }
  }
});

test("a modifier leaves its host's box alone (review focus 5)", () => {
  for (const cls of Object.keys(PIECES)) {
    for (const r of rulesNaming(cls, null)) {
      const props = [...r.body.matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)].map((m) => m[1]);
      const bad = props.filter((p) => /^(padding|margin|display|width|height|min-width|min-height|max-width|max-height|inline-size|block-size)(-|$)/.test(p));
      assert.deepEqual(bad, [], `${r.selector} sets ${bad}`);
    }
  }
});

test("each piece's paint reads only roles the inversion band re-derives (review focus 1)", () => {
  const band = css.match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  const rebound = new Set([...band.matchAll(/(--slc-[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const [cls, p] of Object.entries(PIECES)) for (const pseudo of pseudosOf(p)) {
    for (const r of rulesNaming(cls, pseudo)) {
      for (const m of r.body.matchAll(/(--_sl-art-(?:paint|accent))\s*:\s*([^;]+)/g)) {
        const reads = [...m[2].matchAll(/var\(\s*(--[\w-]+)/g)].map((v) => v[1]);
        assert.ok(reads.length, `${cls} ${m[1]} reads no role`);
        for (const v of reads) assert.ok(rebound.has(v), `${cls} ${m[1]} reads ${v}, which .sl-invert > * does not re-derive`);
      }
    }
  }
});

/** `top` composited over an opaque `under`, in sRGB, as a browser paints. */
const over = (top, under) => {
  const t = toSrgb(top), u = toSrgb(under);
  return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha)));
};

// Only the pieces that can sit under text are bound: the marks beside text
// (eyebrow mark, rules, the composition) keep the probe's tones, pinned below.
// The cell is the paint over the host's own fill (the empty box's wash, a
// card's surface) over the ground: the darkest cell text can sit on.
// Tier A and the site's product subtree resolve --slc-text-secondary from the
// theme. Tier B is left out: its mock maps the neutrals but not the secondary
// text, which falls back to the light literal on a dark page, so its bare
// canvas already fails before any art is painted.
for (const wiring of ["tier A", "site subtree"]) for (const id of Object.keys(REGISTRY)) for (const theme of THEMES) {
  test(`${wiring} / ${id} / ${theme}: secondary text reads 4.5:1 on a solid cell of every underlay`, () => {
    const w = rulesFor(wiring, id);
    const low = [];
    for (const [cls, p] of [...UNDERLAY.map((c) => [c, PIECES[c]]), ...Object.entries(FIELD_HOSTS)]) {
      const html = el({ tag: "html", attrs: { [w.themeAttr ?? "data-sl-theme"]: theme, ...w.root } });
      let parent = el({ tag: "body", parent: html });
      if (w.section) parent = el({ tag: "section", parent, attrs: w.section });
      const host = el({ tag: p.tag ?? "div", classes: p.host, parent });
      const pseudo = el({ pseudo: p.pseudo, parent: host });
      const env = customs(w.rules, pseudo);
      const page = customs(w.rules, parent);
      const text = evaluate("var(--slc-text-secondary)", customs(w.rules, host));
      const hostEnv = customs(w.rules, host);
      const won = longhand(cascaded(w.rules, host), "background-color");
      const fill = won ? evaluate(won.value, hostEnv) : null;
      const paints = PAINTS.filter((v) => env.has(v));
      assert.ok(paints.includes("--_sl-art-paint"), `${cls}: --_sl-art-paint does not resolve`);
      for (const v of paints) for (const g of ["canvas", "surface"]) {
        const ground = evaluate(`var(--slc-${g})`, page);
        const cell = over(evaluate(`var(${v})`, env), fill ? over(fill, ground) : ground);
        const r = ratio(text, cell);
        if (r < 4.5) low.push(`${cls} ${v} on ${g}: ${r.toFixed(2)} (${toHex(text)} on ${toHex(cell)})`);
      }
    }
    assert.deepEqual(low, []);
  });
}

test("the marks beside text keep the probe's tones, from role vars only", () => {
  assert.deepEqual(TONES, {
    mark: { disc: 1, bar: 1 },
    shapes: 1,
    weave: [0.75, 0.45, 0.2, 0.45],
    empty: { circle: 0.5, square: 1, triangle: 0.25 },
  });
  const rules = parseSheet(raw);
  const paintOf = (cls) => {
    const p = PIECES[cls];
    const host = el({ tag: p.tag ?? "div", classes: p.host, parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "light" } }) }) });
    const won = cascaded(rules, el({ pseudo: p.pseudo, parent: host }));
    return Object.fromEntries([...PAINTS, "background"].map((k) => [k, won.get(k)?.value]));
  };
  const solid = { "--_sl-art-paint": "var(--slc-text)", "--_sl-art-accent": "var(--slc-accent-text)" };
  for (const cls of ["sl-eyebrow--mark", "sl-rule--shapes", "sl-empty--shapes"]) {
    const got = paintOf(cls);
    assert.deepEqual({ "--_sl-art-paint": got["--_sl-art-paint"], "--_sl-art-accent": got["--_sl-art-accent"] }, solid, cls);
    const at = cls === "sl-eyebrow--mark" ? "calc\\(4 \\* var\\(--_sl-art-cell\\)\\)" : "\\d+px";
    assert.match(got.background, new RegExp(`var\\(--_sl-art-accent\\) ${at}, var\\(--_sl-art-paint\\) 0`), `${cls} splits accent and ink`);
  }
  const weave = paintOf("sl-rule--weave");
  assert.equal(weave["--_sl-art-paint"], "color-mix(in srgb, var(--slc-text) 45%, transparent)");
  assert.equal(weave["--_sl-art-accent"], "var(--slc-accent-text)");
  assert.match(weave.background, /var\(--_sl-art-accent\) 72px, var\(--_sl-art-paint\) 0/, "one accent band of 24 cells");

});

test("the poster is a painting beside text: its colours are its own, its ink is the page's", () => {
  // It never sits under text (the hero-field is out, design-language.md),
  // so the underlay contrast test does not bind it. Since 0.44 it is a
  // painting (owner, 2026-11-11): ::before is the colour, a fixed palette
  // that reads no role; ::after is the ink, a mask painted from --slc-text,
  // which the inversion band re-derives, so a dark line follows the ground.
  assert.ok(!UNDERLAY.includes("sl-art-poster"));
  const rules = parseSheet(raw);
  const host = el({ classes: ["sl-art-poster"], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "light" } }) }) });
  const colour = cascaded(rules, el({ pseudo: "before", parent: host }));
  const ink = cascaded(rules, el({ pseudo: "after", parent: host }));
  assert.equal(colour.get("background").value, "var(--_sl-art-poster, var(--sl-art-poster-composition)) 0 0 / 100% 100% no-repeat");
  assert.equal(colour.get("mask"), undefined, "the colour layer is not masked");
  assert.equal(ink.get("--_sl-art-paint").value, "var(--slc-text)");
  assert.equal(ink.get("background").value, "var(--_sl-art-paint)");
  for (const prop of ["mask", "-webkit-mask"]) assert.equal(ink.get(prop).value, "var(--_sl-art-poster-ink, var(--sl-art-poster-composition-ink)) 0 0 / 100% 100% no-repeat", prop);
});

/** The cascaded declarations of a piece's pseudo-element and its host
 *  under one condition of the kit sheet. */
function painted(cls, p, { flags = {}, theme = "dark" } = {}) {
  const rules = parseSheet(raw, flags);
  const html = el({ tag: "html", attrs: { "data-sl-theme": theme } });
  const host = el({ tag: p.tag ?? "div", classes: p.host, parent: el({ tag: "body", parent: html }) });
  const won = cascaded(rules, el({ pseudo: p.pseudo, parent: host }));
  const hostWon = cascaded(rules, host);
  return {
    background: (won.get("background")?.value ?? won.get("background-color")?.value ?? "").trim(),
    display: won.get("display")?.value,
    hairline: (hostWon.get("border-top-color")?.value ?? "").trim(),
  };
}

for (const [name, opts] of [["the high-contrast theme", { theme: "high-contrast" }], ["forced colours", { flags: { forcedColors: true } }]]) {
  test(`every piece paints nothing under ${name}, and an in-flow mark leaves no box`, () => {
    for (const [cls, piece] of Object.entries(PIECES)) for (const pseudo of pseudosOf(piece)) {
      const p = { ...piece, pseudo };
      assert.match(painted(cls, p).background, /var\(--_sl-art-/, `${cls}::${pseudo} paints nothing even on dark: the probe is broken`);
      const got = painted(cls, p, opts);
      if (IN_FLOW.includes(cls)) assert.equal(got.display, "none", cls);
      else assert.equal(got.background, "none", `${cls}::${pseudo}`);
    }
    for (const mod of POSTER_MODIFIERS) for (const pseudo of ["before", "after"]) {
      const p = { host: ["sl-art-poster", mod], pseudo };
      assert.match(painted(mod, p).background, /var\(--_sl-art-/, `${mod}::${pseudo} paints nothing even on dark: the probe is broken`);
      assert.equal(painted(mod, p, opts).background, "none", `${mod}::${pseudo}`);
    }
    for (const [mod, p] of Object.entries(FIELD_HOSTS)) {
      assert.match(painted(mod, p).background, /var\(--_sl-art-/, `${mod} paints nothing even on dark: the probe is broken`);
      assert.equal(painted(mod, p, opts).background, "none", mod);
    }
    for (const mod of GLYPH_MODIFIERS) {
      const p = { host: ["sl-eyebrow", "sl-eyebrow--mark", mod], pseudo: "before" };
      assert.match(painted(mod, p).background, /var\(--_sl-art-/, `${mod} paints nothing even on dark: the probe is broken`);
      assert.equal(painted(mod, p, opts).display, "none", mod);
    }
  });
}

test("a rule with a strip gets its hairline back where the strip paints nothing", () => {
  for (const cls of ["sl-rule--shapes", "sl-rule--weave"]) {
    assert.equal(painted(cls, PIECES[cls]).hairline, "transparent", `${cls} hides the hairline under its strip`);
    assert.equal(painted(cls, PIECES[cls], { theme: "high-contrast" }).hairline, "var(--slc-border)", `${cls} under high contrast`);
    assert.equal(painted(cls, PIECES[cls], { flags: { forcedColors: true } }).hairline, "CanvasText", `${cls} under forced colours`);
  }
});

test("the void's container steps are the generator's S/M/L sizes (review focus 2)", () => {
  const steps = [...css.matchAll(/@container\s*\(\s*(?:min-)?width\s*(?:>=|:)\s*(\d+)px\s*\)\s*\{\s*\.sl-empty--void::after\s*\{([^}]*)\}/g)]
    .map((m) => ({ px: Number(m[1]), body: m[2] }));
  assert.deepEqual(steps.map((s) => s.px), [voidThreshold(VOID.m), voidThreshold(VOID.l)], "M and L take over where their void fits with a stroke column each side");
  assert.match(steps[0].body, /--sl-art-void-m/);
  assert.match(steps[1].body, /--sl-art-void-l/);
  const base = rulesNaming("sl-empty--void", "after").map((r) => r.body).join(";");
  assert.match(base, /--sl-art-void-s/);
  for (const [k, v] of Object.entries(VOID)) {
    const img = voidImage(v), size = `${img.w * CELL_PX}px ${img.h * CELL_PX}px`;
    const where = k === "s" ? base : steps[k === "m" ? 0 : 1].body;
    assert.ok(where.includes(size), `void ${k} is not drawn at ${size}`);
    assert.ok(img.w >= v.w * 1.25 && img.h >= v.h * 1.25, `void ${k}'s image cuts its dithered edge`);
    assert.equal((img.w / PITCH) % 2 + (img.h / PITCH) % 2, 0, `void ${k} is not an even number of slots, so centred it cuts strokes`);
  }
  assert.ok(VOID.s.h >= VOID.m.h && VOID.m.h >= VOID.l.h, "a narrower box wraps more lines: its zone is no shorter");
});

test("the void is centred on the box, strokes on all four sides, the message in it", () => {
  const base = rulesNaming("sl-empty--void", "after").map((r) => r.body).join(";");
  assert.match(base, /(?:^|;)\s*mask-position:\s*center\s*(;|$)/);
  const tile = base.match(/(?:^|;)\s*mask-size:\s*(\d+)px (\d+)px,/);
  assert.ok(tile, "the stroke tile has a size");
  for (const n of [tile[1], tile[2]]) assert.equal((Number(n) / CELL_PX / PITCH) % 2, 0, "the stroke tile is an even number of slots");
  const host = rulesNaming("sl-empty--void", null).map((r) => r.body).join(";");
  assert.match(host, /container-type:\s*inline-size/);
  for (const d of [/align-items:\s*center/, /justify-content:\s*center/, /text-align:\s*center/]) assert.match(host, d);
});

test("the showcase applies every piece on flat ground, over the field and in a band", () => {
  // Applied in a class attribute, not named: the page's captions name classes
  // in prose. Flat ground alone has hidden defects before, so each ground is
  // checked on its own.
  const html = readFileSync(resolve(REPO, "showcase/index.html"), "utf8");
  const section = html.match(/<section id="art">([\s\S]*?)<\/section>/)?.[1] ?? "";
  assert.ok(section, "showcase/index.html has no <section id=\"art\">");
  const grounds = Object.fromEntries(
    section.split(/(?=<[^<>]*data-art-ground=")/).slice(1)
      .map((chunk) => [chunk.match(/data-art-ground="([\w-]+)"/)[1], chunk]),
  );
  assert.deepEqual(Object.keys(grounds).sort(), ["band", "field", "flat"]);
  assert.match(grounds.band, /^<[^>]*class="sl-invert\b/, "the band is the shipped .sl-invert");
  assert.match(grounds.field, /<canvas\b/, "the field ground is a painted canvas");
  const applied = (chunk) => new Set([...chunk.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)));
  for (const [ground, chunk] of Object.entries(grounds)) {
    const classes = applied(chunk);
    for (const cls of [...Object.keys(PIECES), ...GLYPH_MODIFIERS]) assert.ok(classes.has(cls), `${ground}: .${cls} is not applied`);
    assert.match(chunk, /class="[^"]*\bsl-eyebrow--mark\b[^"]*\bart-marks__big\b/, `${ground}: no glyph at a larger cell`);
  }
  assert.match(html, /\.art-marks__big\s*\{[^}]*--sl-art-mark-cell:\s*4px/, "the larger glyph is not at a 4px cell");
});

test("the showcase shows every field, and a field under each fade", () => {
  const html = readFileSync(resolve(REPO, "showcase/index.html"), "utf8");
  const cell = html.match(/<div class="[^"]*" data-art-fields>([\s\S]*?)(?=<div class="[^"]*" data-art-ground=)/)?.[1] ?? "";
  assert.ok(cell, "the Art section has no fields cell before its grounds");
  const hosts = [...cell.matchAll(/class="([^"]*\bsl-art-field\b[^"]*)"/g)].map((m) => m[1].split(/\s+/));
  assert.ok(hosts.some((c) => c.length === 1), "the bare field is not shown");
  for (const mod of FIELD_MODIFIERS) assert.ok(hosts.some((c) => c.includes(mod) && !c.some((x) => FADES.includes(x))), `${mod} is not shown unfaded`);
  for (const fade of FADES) assert.ok(hosts.some((c) => c.includes(fade)), `${fade} is not shown`);
});

test("the catalog lists every new class", () => {
  const index = JSON.parse(readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.json"), "utf8"));
  const listed = new Set(index.components.flatMap((c) => c.classes));
  const md = readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.md"), "utf8");
  for (const cls of [...Object.keys(PIECES), ...GLYPH_MODIFIERS, ...FIELD_MODIFIERS, ...FADES, ...POSTER_MODIFIERS]) {
    assert.ok(listed.has(cls), `catalog.json misses ${cls}`);
    assert.ok(md.includes(cls), `catalog.md misses ${cls}`);
  }
});

/** A glyph's grid as rows of "#" and ".", for a readable failure. */
const ascii = (g) => Array.from({ length: g.rows }, (_, j) => Array.from({ length: g.cols }, (_, i) => (g.on[j * g.cols + i] ? "#" : ".")).join("")).join("/");

test("every eyebrow glyph is generated on the 6 × 4 frame, and no two read alike", () => {
  const names = Object.keys(GLYPHS);
  assert.deepEqual(names, ["mark", "square", "tri", "circle", "half", "stair"]);
  for (const k of names) {
    const prop = k === "mark" ? "--sl-art-mark" : `--sl-art-mark-${k}`;
    const m = block.match(new RegExp(`${prop}:\\s*url\\('data:image\\/svg\\+xml,([^']*)'\\)`));
    assert.ok(m, `${prop} is not generated`);
    assert.match(decodeURIComponent(m[1]), /viewBox="0 0 6 4"/, `${prop} is not on the 6 × 4 frame`);
  }
  // At 18 × 12px a glyph is 24 cells: two that differ in a cell or two read
  // as the same mark, so every pair differs in at least four.
  for (const [i, a] of names.entries()) for (const b of names.slice(i + 1)) {
    const A = glyph(a), B = glyph(b);
    const d = A.on.reduce((n, v, c) => n + (v !== B.on[c]), 0);
    assert.ok(d >= 4, `${a} (${ascii(A)}) and ${b} (${ascii(B)}) differ in ${d} cells`);
  }
});

test("every glyph keeps its accent in cells 0-3 and its ink in cells 4-5", () => {
  // The hand rule paints the first 4 cells in the accent and the rest in the
  // ink, for every glyph: a cell on the wrong side takes the wrong colour.
  for (const [k, { accent, ink }] of Object.entries(GLYPHS)) {
    const g = glyph(k);
    let a = 0, b = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
      const x = i + 0.5, y = j + 0.5;
      if (accent(x, y)) { assert.ok(i < 4, `${k}: accent cell (${i},${j}) past cell 3`); a += g.on[j * 6 + i]; }
      if (ink(x, y)) { assert.ok(i >= 4, `${k}: ink cell (${i},${j}) inside the accent's cells`); b += g.on[j * 6 + i]; }
      if (g.on[j * 6 + i]) assert.ok(accent(x, y) || ink(x, y), `${k}: stray cell (${i},${j})`);
    }
    assert.ok(a > 0 && b > 0, `${k} has no accent or no ink: ${ascii(g)}`);
  }
});

test("a glyph modifier only names its mask; the --mark rule keeps the box", () => {
  const base = rulesNaming("sl-eyebrow--mark", "before").map((r) => r.body).join(";");
  assert.match(base, /(?:^|;)\s*mask:\s*var\(--_sl-art-glyph, var\(--sl-art-mark\)\)/, "the base reads the glyph var, the default mark as its fallback");
  assert.doesNotMatch(base, /(?:^|;)\s*--_sl-art-glyph\s*:/, "the base declares the glyph var");
  for (const mod of GLYPH_MODIFIERS) {
    assert.deepEqual(rulesNaming(mod, null), [], `${mod} styles its host`);
    const rules = rulesNaming(mod, "before");
    assert.equal(rules.length, 1, `${mod}::before has ${rules.length} rules`);
    const decls = rules[0].body.split(";").map((d) => d.trim()).filter(Boolean);
    assert.deepEqual(decls, [`--_sl-art-glyph: var(--sl-art-${mod.slice("sl-eyebrow--".length)})`], mod);
    assert.equal(css.split(`.${mod}`).length - 1, 1, `${mod} is named outside its one rule`);
  }
});

test("--sl-art-mark-cell drives the glyph's box from an ancestor, in whole cells", () => {
  assert.doesNotMatch(raw, /@property\s+--sl-art-mark-cell\b/, "the cell is a plain custom property");
  for (const cell of [3, 4, 5]) {
    const rules = parseSheet(`${raw}\n.probe-cell { --sl-art-mark-cell: ${cell}px; }`);
    const section = el({ tag: "section", classes: cell === 3 ? [] : ["probe-cell"], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) }) });
    const host = el({ classes: ["sl-eyebrow", "sl-eyebrow--mark", "sl-eyebrow--mark-tri"], parent: section });
    const pseudo = el({ pseudo: "before", parent: host });
    const won = cascaded(rules, pseudo), env = customs(rules, pseudo);
    const len = (prop) => px(won.get(prop).value, env);
    assert.deepEqual([len("width"), len("height"), len("margin-inline-end")], [6 * cell, 4 * cell, 3 * cell], `${cell}px cell`);
    const split = won.get("background").value.match(/var\(--_sl-art-accent\) (calc\([^)]*\)\)),/)[1];
    assert.equal(px(split, env), 4 * cell, `${cell}px cell: the gradient splits at 4 cells`);
    for (const prop of ["mask", "-webkit-mask"]) {
      const size = won.get(prop).value.match(/\/\s*(calc\([^)]*\)\))\s+(calc\([^)]*\)\))/);
      assert.ok(size, `${prop} has no size`);
      assert.deepEqual([px(size[1], env), px(size[2], env)], [6 * cell, 4 * cell], `${cell}px cell: ${prop} size`);
    }
    assert.equal(won.get("vertical-align").value, "round(calc(var(--_sl-art-cell) / -3), 1px)", "the offset is a third of a cell, on a whole px");
  }
});

test("every field is generated as a tile of whole Bayer periods, on a whole px", () => {
  assert.deepEqual(Object.keys(FIELDS), ["truchet", "grid", "albers", "stripes"]);
  for (const [k, { cells }] of Object.entries(FIELDS)) {
    const prop = k === "truchet" ? "--sl-art-truchet" : `--sl-art-field-${k}`;
    const m = block.match(new RegExp(`${prop}:\\s*url\\('data:image\\/svg\\+xml,([^']*)'\\)`));
    assert.ok(m, `${prop} is not generated`);
    assert.match(decodeURIComponent(m[1]), new RegExp(`viewBox="0 0 ${cells} ${cells}"`), `${prop} is not ${cells} cells square`);
    assert.equal(cells % 8, 0, `${k}: ${cells} cells is not a whole number of Bayer periods, so the matrix breaks at the seam`);
    const g = field(k), lit = g.on.reduce((n, v) => n + v, 0);
    assert.ok(lit > 0 && lit < g.on.length, `${k} is empty or solid`);
  }
});

test("every field tiles seamlessly: past each edge the draw goes on as the tile's opposite edge", () => {
  // The draw reads absolute cells, so a wider grid shows what continues past
  // the tile's right and bottom edges. A shape cut by an edge, a hash not
  // seeded by the slot's place in the tile, or a period the matrix does not
  // share each leave a seam.
  for (const k of Object.keys(FIELDS)) {
    const t = field(k), N = t.cols, W = 2 * N + 1, wide = field(k, W, W);
    const at = (g, i, j) => g.on[j * g.cols + i];
    const col = (g, i) => Array.from({ length: N }, (_, j) => at(g, i, j));
    const row = (g, j) => Array.from({ length: N }, (_, i) => at(g, i, j));
    assert.deepEqual(col(wide, N), col(t, 0), `${k}: the column past the right edge is not the left column`);
    assert.deepEqual(row(wide, N), row(t, 0), `${k}: the row past the bottom edge is not the top row`);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      assert.equal(at(wide, i, j), at(t, i % N, j % N), `${k}: cell (${i},${j}) of a 2 × 2 repeat differs from the tile`);
    }
  }
});

/** The one rule body a modifier owns, as its declarations. */
const ownDecls = (mod, pseudo) => {
  assert.deepEqual(rulesNaming(mod, null), [], `${mod} styles its host`);
  const rules = rulesNaming(mod, pseudo);
  assert.equal(rules.length, 1, `${mod}::${pseudo} has ${rules.length} rules`);
  assert.equal(css.split(`.${mod}`).length - 1, 1, `${mod} is named outside its one rule`);
  return Object.fromEntries(rules[0].body.split(";").map((d) => d.trim()).filter(Boolean).map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]));
};

test("a field modifier only names its tile and size; a fade only names its ramp", () => {
  for (const mod of FIELD_MODIFIERS) {
    const k = mod.slice("sl-art-field--".length), px = `${FIELDS[k].cells * CELL_PX}px`;
    assert.deepEqual(ownDecls(mod, "before"), { "--_sl-art-tile": `var(--sl-art-field-${k})`, "--_sl-art-size": `${px} ${px}` }, mod);
  }
  for (const mod of FADES) {
    const decls = ownDecls(mod, "before");
    assert.deepEqual(Object.keys(decls), ["--_sl-art-fade"], mod);
    assert.match(decls["--_sl-art-fade"], /--sl-art-dissolve-(?:in|out|down)\b/, `${mod} is not a dissolve`);
    assert.doesNotMatch(decls["--_sl-art-fade"], /gradient/, `${mod} fades by alpha, so its cells turn grey instead of off`);
  }
  const base = rulesNaming("sl-art-field", "before").filter((r) => r.selector === ".sl-art-field::before").map((r) => r.body).join(";");
  for (const v of ["--_sl-art-tile", "--_sl-art-size", "--_sl-art-fade", "--_sl-art-ramp-start", "--_sl-art-ramp-end", "--_sl-art-at-start", "--_sl-art-at-end"]) {
    assert.doesNotMatch(base, new RegExp(`(?:^|;)\\s*${v}\\s*:`), `the base declares ${v}, so a modifier on an ancestor cannot reach it`);
  }
});

/** The field's mask on a host wearing `classes`, its vars substituted, and
 *  `want`: an expected value substituted alike (the tiles are data URIs). */
function fieldMask(classes) {
  const rules = parseSheet(raw);
  const host = el({ classes: ["sl-art-field", ...classes], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) }) });
  const pseudo = el({ pseudo: "before", parent: host });
  const won = cascaded(rules, pseudo), env = customs(rules, pseudo);
  const out = {};
  const flat = (v) => substitute(v, env).replace(/\s+/g, " ").trim();
  for (const prop of ["mask", "-webkit-mask", "mask-composite", "-webkit-mask-composite"]) out[prop] = flat(won.get(prop).value);
  out.want = flat;
  return out;
}

test("the bare field is the truchet as before: the same tile, size and paint, the fade a solid layer", () => {
  const truchet = block.match(/--sl-art-truchet:[^;]*;/)[0];
  assert.equal(createHash("sha256").update(truchet).digest("hex").slice(0, 16), "6ea301c6ef566eb6", "the truchet tile's markup changed");
  const m = fieldMask([]);
  for (const prop of ["mask", "-webkit-mask"]) {
    assert.equal(m[prop], m.want("var(--sl-art-truchet) 0 0 / 144px 144px repeat, linear-gradient(black 0 0)"), prop);
  }
  assert.equal(m["mask-composite"], "intersect");
  assert.equal(m["-webkit-mask-composite"], "source-in");
  const paint = rulesNaming("sl-art-field", "before").map((r) => r.body).join(";");
  assert.match(paint, /--_sl-art-paint:\s*color-mix\(in srgb, var\(--slc-text\) 7%, transparent\)/);
});

test("every fade composes with every field, the truchet included", () => {
  const ramps = {
    "sl-art-field--fade-start": "var(--sl-art-dissolve-out) 0 0 / 240px 24px repeat-y",
    "sl-art-field--fade-end": "var(--sl-art-dissolve-in) round(down, 100%, 3px) 0 / 240px 24px repeat-y",
    "sl-art-field--fade-down": "var(--sl-art-dissolve-down) 0 0 / 24px 144px repeat-x",
  };
  assert.deepEqual(Object.keys(ramps), FADES);
  for (const k of Object.keys(FIELDS)) for (const fade of [null, ...FADES]) {
    const mod = k === "truchet" ? [] : [`sl-art-field--${k}`];
    const tile = k === "truchet" ? "--sl-art-truchet" : `--sl-art-field-${k}`, px = `${FIELDS[k].cells * CELL_PX}px`;
    const m = fieldMask(fade ? [...mod, fade] : mod);
    const want = `var(${tile}) 0 0 / ${px} ${px} repeat, ${fade ? ramps[fade] : "linear-gradient(black 0 0)"}`;
    for (const prop of ["mask", "-webkit-mask"]) assert.equal(m[prop], m.want(want), `${k} + ${fade}: ${prop}`);
    assert.equal(m["mask-composite"], "intersect", `${k} + ${fade}`);
    assert.equal(m["-webkit-mask-composite"], "source-in", `${k} + ${fade}`);
  }
});

test("start and end are logical: a right-to-left field swaps the two dissolves and their edges", () => {
  // The cascade lib does not evaluate :dir(), so the rule is read as text.
  const rtl = css.match(/\.sl-art-field:dir\(rtl\)::before\s*\{([^}]*)\}/)?.[1] ?? "";
  const decls = Object.fromEntries([...rtl.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  assert.deepEqual(decls, {
    "--_sl-art-ramp-start": "var(--sl-art-dissolve-in)",
    "--_sl-art-at-start": "round(down, 100%, 3px)",
    "--_sl-art-ramp-end": "var(--sl-art-dissolve-out)",
    "--_sl-art-at-end": "0",
  });
  assert.match(ownDecls("sl-art-field--fade-start", "before")["--_sl-art-fade"], /^var\(--_sl-art-ramp-start, var\(--sl-art-dissolve-out\)\) var\(--_sl-art-at-start, 0\) 0 \//);
  assert.match(ownDecls("sl-art-field--fade-end", "before")["--_sl-art-fade"], /^var\(--_sl-art-ramp-end, var\(--sl-art-dissolve-in\)\) var\(--_sl-art-at-end, round\(down, 100%, 3px\)\) 0 \//);
});

// Owner, 2026-11-11 (lab/art-next, pick A). A fade was a smooth alpha ramp
// over the tile, so its cells turned grey instead of off: the one place the
// art was not pixel art. A fade is now a dissolve through the Bayer matrix.
test("every dissolve is generated on whole Bayer periods, solid at one edge and empty at the other", () => {
  assert.deepEqual(DISSOLVE, { in: { cols: 80, rows: 8 }, out: { cols: 80, rows: 8 }, down: { cols: 8, rows: 48 } });
  for (const [k, { cols, rows }] of Object.entries(DISSOLVE)) {
    const m = block.match(new RegExp(`--sl-art-dissolve-${k}:\\s*url\\('data:image\\/svg\\+xml,([^']*)'\\)`));
    assert.ok(m, `--sl-art-dissolve-${k} is not generated`);
    assert.match(decodeURIComponent(m[1]), new RegExp(`viewBox="0 0 ${cols} ${rows}"`), k);
    const g = dissolve(k);
    // The share of cells on, per step along the dissolve, from its empty end.
    const along = k === "down" ? rows : cols, across = k === "down" ? cols : rows;
    assert.equal(across % 8, 0, `${k} repeats across on a whole Bayer period`);
    const share = Array.from({ length: along }, (_, a) => {
      const at = k === "in" ? a : along - 1 - a;
      let n = 0;
      for (let c = 0; c < across; c++) n += k === "down" ? g.on[at * cols + c] : g.on[c * cols + at];
      return n / across;
    });
    assert.equal(share[0], 0, `${k} starts empty`);
    assert.equal(share[along - 1], 1, `${k} ends solid`);
    // One column holds 8 of the matrix's 64 levels, so the share is read per
    // whole period of 8 steps, where every level is present once.
    const period = Array.from({ length: along / 8 }, (_, b) => share.slice(b * 8, b * 8 + 8).reduce((x, y) => x + y, 0) / 8);
    for (let b = 1; b < period.length; b++) assert.ok(period[b] >= period[b - 1], `${k} thins at period ${b}`);
    const third = period.slice(0, Math.floor(period.length * 0.3));
    assert.ok(third.every((v) => v <= 0.1), `${k} keeps its first third almost clear, for the copy: ${third}`);
  }
});

test("a dissolve is sized in whole cells, and the trailing one lands on the tile's grid", () => {
  for (const [mod, size] of [["sl-art-field--fade-start", "240px 24px repeat-y"], ["sl-art-field--fade-end", "240px 24px repeat-y"], ["sl-art-field--fade-down", "24px 144px repeat-x"]]) {
    assert.ok(ownDecls(mod, "before")["--_sl-art-fade"].endsWith(`/ ${size}`), mod);
  }
  assert.equal(DISSOLVE.in.cols * CELL_PX, 240);
  assert.equal(DISSOLVE.down.rows * CELL_PX, 144);
  // The tile starts at 0; an image at a bare 100% would start off the 3px grid
  // on a box whose width is not a multiple of it, and cut every cell it crosses.
  assert.doesNotMatch(css.match(/\.sl-art-field[^{]*\{[^}]*--_sl-art-(?:fade|at-)[^}]*\}/g).join(""), /[\s,(]100%\s+0 \//, "a dissolve is placed at a bare 100%");
});

// Owner, 2026-11-11 (lab/art-next, pick B). The strip was twelve forms, each
// later one dithered thinner, and its tail read as stray pixels.
test("the shapes rule is three whole forms, then the hairline", () => {
  // 6 cells, 18px: at 4 cells (12px) the owner found the forms too small.
  const S = SHAPE_CELLS, g = shapes();
  assert.equal(S, 6);
  assert.deepEqual([g.cols, g.rows], [5 * S, S]);
  assert.match(decodeURIComponent(block.match(/--sl-art-shapes:\s*url\('data:image\/svg\+xml,([^']*)'\)/)[1]), new RegExp(`viewBox="0 0 ${5 * S} ${S}"`));
  const col = (x) => Array.from({ length: S }, (_, y) => g.on[y * g.cols + x]).reduce((n, v) => n + v, 0);
  for (let x = 0; x < g.cols; x++) {
    if (x % (2 * S) >= S) assert.equal(col(x), 0, `cell column ${x} is a gap`);
  }
  // Whole forms: a quarter disc, a full square, a triangle. No dither holes.
  const area = (x0) => Array.from({ length: S }, (_, dx) => col(x0 + dx)).reduce((n, v) => n + v, 0);
  assert.equal(area(2 * S), S * S, "the square is solid");
  assert.ok(area(0) > (S * S) / 2 && area(0) < S * S, `the quarter disc holds ${area(0)} cells`);
  assert.equal(area(4 * S), (S * (S + 1)) / 2, "the triangle is solid under its diagonal");
  const px = (cells) => `${cells * CELL_PX}px`;
  const rules = rulesNaming("sl-rule--shapes", "before").map((r) => r.body).join(";");
  assert.ok(rules.includes(`mask: var(--sl-art-shapes) 0 0 / ${px(5 * S)} ${px(S)} no-repeat, linear-gradient(black 0 0) ${px(6 * S)} 10px / 100% 1px no-repeat;`), "the strip, then a 1px line on the rule's own row");
  assert.ok(rules.includes(`background: linear-gradient(90deg, var(--_sl-art-accent) ${px(S)}, var(--_sl-art-paint) 0 ${px(6 * S)}, var(--slc-border) 0);`), "accent, ink, then the hairline's colour");
  assert.match(rules, /top:\s*-10px;\s*height:\s*18px;/, "centred on the rule: the line is 10px down an 18px box");
});

// THE POSTERS (0.44, owner 2026-11-11). Four paintings by Kandinsky from
// his Bauhaus years, each made to blend into the page: its own ground is
// transparent and its edges dissolve. A form keeps its colour, in a fixed
// house palette; the darkest cells are a mask the page's text colour paints.
// A poster is the art's exception to two rules: a 2px cell at the design
// size (126 cells across 252px) and colours of its own. Every cell is on or
// off.
const PHI = (1 + Math.sqrt(5)) / 2;
const names = Object.keys(POSTERS);
const N = POSTER_COLS * POSTER_ROWS;
const pngOf = (k) => {
  const m = block.match(new RegExp(`  --sl-art-poster-${k}: url\\('data:image\\/png;base64,([A-Za-z0-9+/=]*)'\\);`));
  assert.ok(m, `--sl-art-poster-${k} is not generated as a PNG`);
  return Buffer.from(m[1], "base64");
};
/** The chunks of a PNG, by type. */
const chunks = (file) => {
  const out = {};
  for (let at = 8; at < file.length;) { const len = file.readUInt32BE(at); out[file.subarray(at + 4, at + 8).toString()] = file.subarray(at + 8, at + 8 + len); at += 12 + len; }
  return out;
};

test("the frame is a golden rectangle of 126 × 78 cells", () => {
  assert.deepEqual([POSTER_COLS, POSTER_ROWS], [126, 78]);
  assert.ok(Math.abs(POSTER_COLS / POSTER_ROWS - PHI) < 0.005, `126 / 78 is ${POSTER_COLS / POSTER_ROWS}`);
  assert.deepEqual(names, ["composition", "circles", "primary", "orbit"]);
});

test("every poster is two generated images of the frame, and both regenerate to the same bytes", () => {
  for (const k of names) {
    for (const [prop, file, want, depth, colours] of [[k, pngOf(k), posterPng(k), 4, PRINT_PALETTE.length + 1], [`${k}-ink`, pngOf(`${k}-ink`), posterInkPng(k), 1, 2]]) {
      const c = chunks(file);
      assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${prop}: not a PNG`);
      assert.deepEqual([c.IHDR.readUInt32BE(0), c.IHDR.readUInt32BE(4)], [POSTER_COLS, POSTER_ROWS], `${prop}: size`);
      assert.deepEqual([c.IHDR[8], c.IHDR[9]], [depth, 3], `${prop}: bit depth and colour type`);
      assert.equal(c.PLTE.length / 3, colours, `${prop}: palette`);
      assert.deepEqual([...c.tRNS], [0], `${prop}: entry 0 is not the transparent ground`);
      assert.deepEqual([...file], [...want], `${prop}: the committed image is not what the generator draws`);
    }
    assert.ok(pngOf(k).length <= 3072, `${k} is ${pngOf(k).length} bytes`);
    assert.ok(pngOf(`${k}-ink`).length <= 1024, `${k}'s ink is ${pngOf(`${k}-ink`).length} bytes`);
  }
  assert.doesNotMatch(block, /--sl-art-poster-(disc|dot|quarter|tri|tone)/, "a primitive of the pre-0.44 posters is still generated");
});

test("a poster's colours are the house palette's, and its darkest cells are the ink", () => {
  assert.equal(PRINT_PALETTE.length, 12);
  for (const hex of PRINT_PALETTE) assert.match(hex, /^#[0-9A-F]{6}$/);
  assert.equal(POSTER_INK, PRINT_PALETTE.length);
  for (const k of names) {
    const cells = posterCells(k), seen = new Set(cells);
    for (const v of seen) assert.ok(v >= -1 && v <= POSTER_INK, `${k}: cell value ${v}`);
    // A drawing with too few colours cannot be read (owner, 2026-11-11).
    assert.ok([...seen].filter((v) => v >= 0 && v < POSTER_INK).length >= 6, `${k} uses ${seen.size} values`);
    assert.ok(seen.has(POSTER_INK), `${k} has no ink`);
  }
});

test("a poster blends into the page: its ground is clear and its edges dissolve", () => {
  for (const k of names) {
    const cells = posterCells(k), at = (i, j) => cells[j * POSTER_COLS + i];
    let clear = 0;
    for (const v of cells) if (v < 0) clear++;
    // The painting's own ground is gone, so the page shows through most of it.
    assert.ok(clear >= N * 0.45 && clear <= N * 0.85, `${k}: ${clear} of ${N} cells are clear`);
    // The outermost cells are all clear: the piece has no frame.
    for (let i = 0; i < POSTER_COLS; i++) assert.ok(at(i, 0) < 0 && at(i, POSTER_ROWS - 1) < 0, `${k}: column ${i} touches the top or the bottom`);
    for (let j = 0; j < POSTER_ROWS; j++) assert.ok(at(0, j) < 0 && at(POSTER_COLS - 1, j) < 0, `${k}: row ${j} touches a side`);
    // And the picture thins toward its border: a ring 6 cells deep holds
    // fewer painted cells, by area, than the middle does.
    let rim = 0, rimN = 0, mid = 0, midN = 0;
    for (let j = 0; j < POSTER_ROWS; j++) for (let i = 0; i < POSTER_COLS; i++) {
      const edge = Math.min(i, j, POSTER_COLS - 1 - i, POSTER_ROWS - 1 - j);
      if (edge < 6) { rimN++; if (at(i, j) >= 0) rim++; } else if (edge >= 16) { midN++; if (at(i, j) >= 0) mid++; }
    }
    assert.ok(rim / rimN < (mid / midN) * 0.5, `${k}: the rim is ${(rim / rimN).toFixed(2)} full, the middle ${(mid / midN).toFixed(2)}`);
  }
});

test("the four posters differ", () => {
  for (const [i, a] of names.entries()) for (const b of names.slice(i + 1)) {
    const A = posterCells(a), B = posterCells(b);
    let d = 0;
    for (let c = 0; c < N; c++) if (A[c] !== B[c]) d++;
    assert.ok(d >= N * 0.25, `${a} and ${b} differ in ${d} of ${N} cells`);
  }
});

test("every poster's source is vendored at the frame's size, with its origin and its public-domain statement", () => {
  const readme = readFileSync(resolve(REPO, "scripts/art-sources/README.md"), "utf8");
  for (const [k, { source, title }] of Object.entries(POSTERS)) {
    const file = readFileSync(resolve(REPO, `scripts/art-sources/${source}.bmp`));
    assert.equal(file.subarray(0, 2).toString(), "BM", `${source}.bmp`);
    assert.deepEqual([file.readInt32LE(18), file.readInt32LE(22), file.readUInt16LE(28)], [POSTER_COLS, POSTER_ROWS, 24], `${source}.bmp is not 126 × 78 at 24 bits`);
    assert.ok(readme.includes(`${source}.bmp`) && readme.includes(title), `the README does not list ${k}`);
  }
  assert.equal((readme.match(/https:\/\/commons\.wikimedia\.org\/wiki\/File:/g) ?? []).length, names.length, "one Commons page per source");
  assert.match(readme, /public domain/i);
});

test("the PNG encoder is plain JavaScript: it inflates back, and its bytes are pinned", () => {
  // node:zlib picks matches with CPU-specific code, so its output differs
  // between a Mac and the CI runner. This encoder must not.
  const data = Uint8Array.from({ length: 4000 }, (_, k) => (k * k + (k >> 3)) % 13);
  assert.deepEqual([...inflateSync(Buffer.from(deflate(data)))], [...data]);
  assert.deepEqual([...inflateSync(Buffer.from(deflate(new Uint8Array(0))))], []);
  const index = Uint8Array.from({ length: 64 }, (_, k) => (k + (k >> 3)) % 5), palette = [[0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255]];
  const file = png(index, palette, 8, 8);
  assert.equal(file[24], 4, "five colours fit 4 bits");
  assert.equal(createHash("sha256").update(file).digest("hex").slice(0, 16), "77f72e2ccaa50071", "the encoder's output changed");
  assert.deepEqual([...chunks(Buffer.from(png(index, palette, 8, 8, true))).tRNS], [0], "a clear image marks entry 0 transparent");
  assert.equal(chunks(Buffer.from(file)).tRNS, undefined);
  assert.throws(() => png(new Uint8Array(1), Array.from({ length: 257 }, () => [0, 0, 0]), 1, 1), /do not fit/);
});

test("a poster variant only names its two layers, on both pseudo-elements", () => {
  for (const mod of POSTER_MODIFIERS) {
    const k = mod.slice("sl-art-poster--".length);
    assert.deepEqual(rulesNaming(mod, null), [], `${mod} styles its host`);
    const rules = rulesNaming(mod, "before");
    assert.equal(rules.length, 1, `${mod} has ${rules.length} rules`);
    assert.deepEqual(splitList(rules[0].selector), [`.${mod}::before`, `.${mod}::after`], mod);
    assert.equal(rules[0].body.replace(/\s+/g, " ").trim(), `--_sl-art-poster: var(--sl-art-poster-${k}); --_sl-art-poster-ink: var(--sl-art-poster-${k}-ink);`, mod);
    assert.equal(css.split(`.${mod}`).length - 1, 2, `${mod} is named outside its one rule`);
  }
  const base = rulesNaming("sl-art-poster", null).concat(rulesNaming("sl-art-poster", "before"), rulesNaming("sl-art-poster", "after")).map((r) => r.body).join(";");
  assert.doesNotMatch(base, /(?:^|;)\s*--_sl-art-poster(-ink)?\s*:/, "the base declares a variant's layer");
  for (const old of ["stair", "bleed", "night", "touch", "board"]) assert.ok(!css.includes(`sl-art-poster--${old}`), `--${old} is not a 0.44 poster`);
});

test("a poster cell is a whole px, the box's width over 126, and neither layer is resampled", () => {
  const shared = rulesNaming("sl-art-poster", "before").find((r) => /::after/.test(r.selector) && /::before/.test(r.selector));
  assert.ok(shared, "no rule shared by both pseudo-elements");
  const d = Object.fromEntries(shared.body.replace(/\/\*[\s\S]*?\*\//g, "").split(";").map((x) => x.trim()).filter(Boolean).map((x) => [x.slice(0, x.indexOf(":")).trim(), x.slice(x.indexOf(":") + 1).trim()]));
  // 1px per cell below 252px, 2px from 252px (the design size), 3px from 378px.
  assert.equal(d["--_sl-art-u"], `max(1px, round(down, 100cqi / ${POSTER_COLS}, 1px))`);
  assert.equal(d.width, `calc(${POSTER_COLS} * var(--_sl-art-u))`);
  assert.equal(d.height, `calc(${POSTER_ROWS} * var(--_sl-art-u))`);
  assert.equal(d.left, `round(down, (100% - ${POSTER_COLS} * var(--_sl-art-u)) / 2, 1px)`);
  assert.equal(d.top, `round(down, (100% - ${POSTER_ROWS} * var(--_sl-art-u)) / 2, 1px)`);
  assert.equal(d["image-rendering"], "pixelated");
  assert.equal(d["pointer-events"], "none");
  const host = rulesNaming("sl-art-poster", null).map((r) => r.body).join(";");
  for (const decl of [/position:\s*relative/, /isolation:\s*isolate/, /container-type:\s*inline-size/, /pointer-events:\s*none/, new RegExp(`aspect-ratio:\\s*${POSTER_COLS} / ${POSTER_ROWS}`)]) assert.match(host, decl);
  assert.ok(rulesNaming("sl-art-poster", null).every((r) => r.selector.startsWith(":where(")), "the host's rules are not at zero specificity");
});

test("the showcase shows every poster beside a head", () => {
  const html = readFileSync(resolve(REPO, "showcase/index.html"), "utf8");
  const cell = html.match(/<div class="[^"]*" data-art-posters>([\s\S]*?)(?=<div class="[^"]*" data-art-ground=)/)?.[1] ?? "";
  assert.ok(cell, "the Art section has no posters cell before its grounds");
  const posters = [...cell.matchAll(/<div class="([^"]*\bsl-art-poster\b[^"]*)" aria-hidden="true"><\/div>/g)].map((m) => m[1].split(/\s+/));
  assert.ok(posters.some((c) => c.length === 1), "the bare poster is not shown");
  for (const mod of POSTER_MODIFIERS) assert.ok(posters.some((c) => c.includes(mod)), `${mod} is not shown`);
  assert.match(cell, /<h[12]\b/, "no head beside the posters");
});

