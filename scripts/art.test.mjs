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
import { ART_CELL_PX, VOID, PITCH, TONES, GLYPH, GLYPHS, FIELDS, POSTERS, POSTER_COLS, POSTER_ROWS, HORIZONS, HORIZON_ROWS, HORIZON_TILE, DISSOLVE, SHAPE_CELLS, glyph, field, shapes, dissolve, posterPng, horizonPng, horizonInkPng, horizonStripPng, voidImage, voidThreshold, START, END } from "./gen-art.mjs";
import { renderPoster, renderHorizon, renderHorizonStrip, seedOf, toRgba } from "../packages/ui-kit/art-core.js";
import { existsSync } from "node:fs";
import { deflate, png } from "./lib/png.mjs";
import { inflateSync } from "node:zlib";
import { CELL_PX, bayerAt } from "../packages/ui-kit/dither-core.js";

// The Bauhaus pixel art (ui-kit 0.41.0, 0.42.0): masks drawn on the art cell
// (2px since 0.45) by scripts/gen-art.mjs, painted from role vars by hand rules beside the
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
  "sl-art-poster": { host: ["sl-art-poster"], pseudo: "before" },
  "sl-art-horizon": { host: ["sl-art-horizon"], pseudo: "after", also: "before" },
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
/** The poster's variants (the dawn is the bare poster), each worn with
 *  sl-art-poster; and the horizon's (the hills are the bare horizon). */
const POSTER_MODIFIERS = Object.keys(POSTERS).filter((k) => k !== "dawn").map((k) => `sl-art-poster--${k}`);
const HORIZON_MODIFIERS = Object.keys(HORIZONS).filter((k) => k !== "hills").map((k) => `sl-art-horizon--${k}`);
/** The layers that are a generated colour image, not a mask. */
const IMAGE_LAYERS = ["sl-art-poster::before", "sl-art-horizon::before"];
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

test("the art cell is 2px, and it is not the dither hover's cell", () => {
  // Owner, 2026-11-11 (lab/art-2px, pick B): every piece drawn again on 1.5
  // times the cells, so it keeps its size and its edges and grain are finer.
  assert.equal(ART_CELL_PX, 2);
  assert.equal(CELL_PX, 3, "the dither hover and the signal strip keep their 3px cell");
});

test("the generated block stays within the 66 KB payload budget", () => {
  // 24 KB in 0.41; 32 KB for the 0.42 variants (marks, fields, poster);
  // 44 KB in 0.44, when the four posters became paintings (two images
  // each, about 14 KB of the block) on the owner's choice, 2026-11-11;
  // 66 KB in 0.45, when every other piece went to the 2px cell (2.25 times
  // the cells in the same box) on the owner's choice, 2026-11-11.
  const bytes = Buffer.byteLength(block, "utf8");
  assert.ok(bytes <= 67584, `generated block is ${bytes} bytes`);
});

test("every piece paints through a static, inert pseudo-element", () => {
  for (const [cls, p] of Object.entries(PIECES)) for (const pseudo of pseudosOf(p)) {
    const rules = rulesNaming(cls, pseudo);
    assert.ok(rules.length, `${cls}::${pseudo} has no rule`);
    const all = rules.map((r) => r.body).join(";");
    assert.match(all, /pointer-events:\s*none/, `${cls}::${pseudo} takes pointer events`);
    // a poster's and a horizon's colour layer is a generated image, every other layer a generated mask
    const paint = IMAGE_LAYERS.includes(`${cls}::${pseudo}`) ? /background:[^;]*var\(--sl-art-(?:poster|horizon)-/ : /mask(-image)?:[^;]*var\(--sl-art-/;
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
    const at = cls === "sl-eyebrow--mark" ? `calc\\(${GLYPH.accent} \\* var\\(--_sl-art-cell\\)\\)` : "\\d+px";
    assert.match(got.background, new RegExp(`var\\(--_sl-art-accent\\) ${at}, var\\(--_sl-art-paint\\) 0`), `${cls} splits accent and ink`);
  }
  const weave = paintOf("sl-rule--weave");
  assert.equal(weave["--_sl-art-paint"], "color-mix(in srgb, var(--slc-text) 45%, transparent)");
  assert.equal(weave["--_sl-art-accent"], "var(--slc-accent-text)");
  assert.match(weave.background, /var\(--_sl-art-accent\) 72px, var\(--_sl-art-paint\) 0/, "one accent band of 36 cells");

});

test("the poster is a print beside text: one layer, in colours of its own", () => {
  // It never sits under text (the hero-field is out, design-language.md),
  // so the underlay contrast test does not bind it. Since 0.45 it is a
  // procedural print on its own paper (owner, 2026-11-11): one image in a
  // fixed palette that reads no role, the live picture first.
  assert.ok(!UNDERLAY.includes("sl-art-poster"));
  const rules = parseSheet(raw);
  const host = el({ classes: ["sl-art-poster"], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "light" } }) }) });
  const colour = cascaded(rules, el({ pseudo: "before", parent: host }));
  assert.equal(colour.get("background").value, "var(--_sl-art-live, var(--_sl-art-poster, var(--sl-art-poster-dawn))) 0 0 / 100% 100% no-repeat");
  assert.equal(colour.get("mask"), undefined, "the print is not masked");
  assert.equal(colour.get("--_sl-art-paint"), undefined, "the print reads no role");
  assert.deepEqual(rulesNaming("sl-art-poster", "after"), [], "a poster has one layer");
});

test("the horizon is behind a section, not under its text: colour in its own palette, ink from the page", () => {
  assert.ok(!UNDERLAY.includes("sl-art-horizon"));
  const rules = parseSheet(raw);
  const host = el({ classes: ["sl-art-horizon"], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "light" } }) }) });
  const colour = cascaded(rules, el({ pseudo: "before", parent: host })), ink = cascaded(rules, el({ pseudo: "after", parent: host }));
  const tile = `${HORIZON_TILE.hills * ART_CELL_PX}px ${HORIZON_ROWS * ART_CELL_PX}px`;
  assert.equal(colour.get("background").value, `var(--_sl-art-live-bg, var(--_sl-art-horizon-bg, var(--sl-art-horizon-hills) 0 100% / ${tile} repeat-x))`);
  assert.equal(ink.get("--_sl-art-paint").value, "var(--slc-text)");
  assert.equal(ink.get("background").value, "var(--_sl-art-paint)");
  for (const prop of ["mask", "-webkit-mask"]) assert.equal(ink.get(prop).value, `var(--_sl-art-live-ink, var(--_sl-art-horizon-ink, var(--sl-art-horizon-hills-ink) 0 100% / ${tile} repeat-x))`, prop);
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
    for (const [base, mod, pseudo] of [...POSTER_MODIFIERS.map((m) => ["sl-art-poster", m, "before"]), ...HORIZON_MODIFIERS.flatMap((m) => [["sl-art-horizon", m, "before"], ["sl-art-horizon", m, "after"]])]) {
      const p = { host: [base, mod], pseudo };
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
    const img = voidImage(v), size = `${img.w * ART_CELL_PX}px ${img.h * ART_CELL_PX}px`;
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
  for (const n of [tile[1], tile[2]]) assert.equal((Number(n) / ART_CELL_PX / PITCH) % 2, 0, "the stroke tile is an even number of slots");
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
  assert.match(html, /\.art-marks__big\s*\{[^}]*--sl-art-mark-cell:\s*3px/, "the larger glyph is not at a 3px cell");
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
  for (const cls of [...Object.keys(PIECES), ...GLYPH_MODIFIERS, ...FIELD_MODIFIERS, ...FADES, ...POSTER_MODIFIERS, ...HORIZON_MODIFIERS]) {
    assert.ok(listed.has(cls), `catalog.json misses ${cls}`);
    assert.ok(md.includes(cls), `catalog.md misses ${cls}`);
  }
});

/** A glyph's grid as rows of "#" and ".", for a readable failure. */
const ascii = (g) => Array.from({ length: g.rows }, (_, j) => Array.from({ length: g.cols }, (_, i) => (g.on[j * g.cols + i] ? "#" : ".")).join("")).join("/");

test("every eyebrow glyph is generated on the 9 × 6 frame, and no two read alike", () => {
  assert.deepEqual(GLYPH, { cols: 9, rows: 6, accent: 6, ink: 7 });
  const names = Object.keys(GLYPHS);
  assert.deepEqual(names, ["mark", "square", "tri", "circle", "half", "stair"]);
  for (const k of names) {
    const prop = k === "mark" ? "--sl-art-mark" : `--sl-art-mark-${k}`;
    const m = block.match(new RegExp(`${prop}:\\s*url\\('data:image\\/svg\\+xml,([^']*)'\\)`));
    assert.ok(m, `${prop} is not generated`);
    assert.match(decodeURIComponent(m[1]), new RegExp(`viewBox="0 0 ${GLYPH.cols} ${GLYPH.rows}"`), `${prop} is not on the 9 × 6 frame`);
  }
  // At 18 × 12px a glyph is 54 cells of 2px: two that differ in a few cells
  // read as the same mark, so every pair differs in at least eight (32 px²;
  // it was four 3px cells, 36 px², until 0.45).
  for (const [i, a] of names.entries()) for (const b of names.slice(i + 1)) {
    const A = glyph(a), B = glyph(b);
    const d = A.on.reduce((n, v, c) => n + (v !== B.on[c]), 0);
    assert.ok(d >= 8, `${a} (${ascii(A)}) and ${b} (${ascii(B)}) differ in ${d} cells`);
  }
});

test("every glyph keeps its accent in cells 0-5 and its ink in cells 7-8", () => {
  // The hand rule paints the first 6 cells in the accent and the rest in the
  // ink, for every glyph: a cell on the wrong side takes the wrong colour.
  for (const [k, { accent, ink }] of Object.entries(GLYPHS)) {
    const g = glyph(k);
    let a = 0, b = 0;
    for (let j = 0; j < GLYPH.rows; j++) for (let i = 0; i < GLYPH.cols; i++) {
      const x = i + 0.5, y = j + 0.5, on = g.on[j * GLYPH.cols + i];
      if (accent(x, y)) { assert.ok(i < GLYPH.accent, `${k}: accent cell (${i},${j}) past cell ${GLYPH.accent - 1}`); a += on; }
      if (ink(x, y)) { assert.ok(i >= GLYPH.ink, `${k}: ink cell (${i},${j}) before cell ${GLYPH.ink}`); b += on; }
      if (on) assert.ok(accent(x, y) || ink(x, y), `${k}: stray cell (${i},${j})`);
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
  for (const cell of [2, 3, 4]) {
    const rules = parseSheet(`${raw}\n.probe-cell { --sl-art-mark-cell: ${cell}px; }`);
    const section = el({ tag: "section", classes: cell === 2 ? [] : ["probe-cell"], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) }) });
    const host = el({ classes: ["sl-eyebrow", "sl-eyebrow--mark", "sl-eyebrow--mark-tri"], parent: section });
    const pseudo = el({ pseudo: "before", parent: host });
    const won = cascaded(rules, pseudo), env = customs(rules, pseudo);
    const len = (prop) => px(won.get(prop).value, env);
    assert.deepEqual([len("width"), len("height"), len("margin-inline-end")], [GLYPH.cols * cell, GLYPH.rows * cell, 4.5 * cell], `${cell}px cell`);
    const split = won.get("background").value.match(/var\(--_sl-art-accent\) (calc\([^)]*\)\)),/)[1];
    assert.equal(px(split, env), GLYPH.accent * cell, `${cell}px cell: the gradient splits at ${GLYPH.accent} cells`);
    for (const prop of ["mask", "-webkit-mask"]) {
      const size = won.get(prop).value.match(/\/\s*(calc\([^)]*\)\))\s+(calc\([^)]*\)\))/);
      assert.ok(size, `${prop} has no size`);
      assert.deepEqual([px(size[1], env), px(size[2], env)], [GLYPH.cols * cell, GLYPH.rows * cell], `${cell}px cell: ${prop} size`);
    }
    assert.equal(won.get("vertical-align").value, "round(calc(var(--_sl-art-cell) / -2), 1px)", "the offset is half a cell, on a whole px");
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
    const k = mod.slice("sl-art-field--".length), px = `${FIELDS[k].cells * ART_CELL_PX}px`;
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

test("the bare field is the truchet: its pinned tile, size and paint, the fade a solid layer", () => {
  const truchet = block.match(/--sl-art-truchet:[^;]*;/)[0];
  assert.equal(createHash("sha256").update(truchet).digest("hex").slice(0, 16), "b8dae2969a004c44", "the truchet tile's markup changed");
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
    "sl-art-field--fade-start": "var(--sl-art-dissolve-out) 0 0 / 240px 16px repeat-y",
    "sl-art-field--fade-end": "var(--sl-art-dissolve-in) round(down, 100%, 2px) 0 / 240px 16px repeat-y",
    "sl-art-field--fade-down": "var(--sl-art-dissolve-down) 0 0 / 16px 144px repeat-x",
  };
  assert.deepEqual(Object.keys(ramps), FADES);
  for (const k of Object.keys(FIELDS)) for (const fade of [null, ...FADES]) {
    const mod = k === "truchet" ? [] : [`sl-art-field--${k}`];
    const tile = k === "truchet" ? "--sl-art-truchet" : `--sl-art-field-${k}`, px = `${FIELDS[k].cells * ART_CELL_PX}px`;
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
    "--_sl-art-at-start": "round(down, 100%, 2px)",
    "--_sl-art-ramp-end": "var(--sl-art-dissolve-out)",
    "--_sl-art-at-end": "0",
  });
  assert.match(ownDecls("sl-art-field--fade-start", "before")["--_sl-art-fade"], /^var\(--_sl-art-ramp-start, var\(--sl-art-dissolve-out\)\) var\(--_sl-art-at-start, 0\) 0 \//);
  assert.match(ownDecls("sl-art-field--fade-end", "before")["--_sl-art-fade"], /^var\(--_sl-art-ramp-end, var\(--sl-art-dissolve-in\)\) var\(--_sl-art-at-end, round\(down, 100%, 2px\)\) 0 \//);
});

// Owner, 2026-11-11 (lab/art-next, pick A). A fade was a smooth alpha ramp
// over the tile, so its cells turned grey instead of off: the one place the
// art was not pixel art. A fade is now a dissolve through the Bayer matrix.
test("every dissolve is generated on whole Bayer periods, solid at one edge and empty at the other", () => {
  assert.deepEqual(DISSOLVE, { in: { cols: 120, rows: 8 }, out: { cols: 120, rows: 8 }, down: { cols: 8, rows: 72 } });
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
  for (const [mod, size] of [["sl-art-field--fade-start", "240px 16px repeat-y"], ["sl-art-field--fade-end", "240px 16px repeat-y"], ["sl-art-field--fade-down", "16px 144px repeat-x"]]) {
    assert.ok(ownDecls(mod, "before")["--_sl-art-fade"].endsWith(`/ ${size}`), mod);
  }
  assert.equal(DISSOLVE.in.cols * ART_CELL_PX, 240);
  assert.equal(DISSOLVE.down.rows * ART_CELL_PX, 144);
  // The tile starts at 0; an image at a bare 100% would start off the 2px grid
  // on a box whose width is not a multiple of it, and cut every cell it crosses.
  assert.doesNotMatch(css.match(/\.sl-art-field[^{]*\{[^}]*--_sl-art-(?:fade|at-)[^}]*\}/g).join(""), /[\s,(]100%\s+0 \//, "a dissolve is placed at a bare 100%");
});

// Owner, 2026-11-11 (lab/art-next, pick B). The strip was twelve forms, each
// later one dithered thinner, and its tail read as stray pixels.
test("the shapes rule is three whole forms, then the hairline", () => {
  // 9 cells, 18px: at 12px the owner found the forms too small.
  const S = SHAPE_CELLS, g = shapes();
  assert.equal(S * ART_CELL_PX, 18);
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
  const px = (cells) => `${cells * ART_CELL_PX}px`;
  const rules = rulesNaming("sl-rule--shapes", "before").map((r) => r.body).join(";");
  assert.ok(rules.includes(`mask: var(--sl-art-shapes) 0 0 / ${px(5 * S)} ${px(S)} no-repeat, linear-gradient(black 0 0) ${px(6 * S)} 10px / 100% 1px no-repeat;`), "the strip, then a 1px line on the rule's own row");
  assert.ok(rules.includes(`background: linear-gradient(90deg, var(--_sl-art-accent) ${px(S)}, var(--_sl-art-paint) 0 ${px(6 * S)}, var(--slc-border) 0);`), "accent, ink, then the hairline's colour");
  assert.match(rules, /top:\s*-10px;\s*height:\s*18px;/, "centred on the rule: the line is 10px down an 18px box");
});

// THE POSTERS AND THE HORIZONS (0.45, owner 2026-11-11). Procedural
// pictures: art-core.js draws each from shapes and a seed. components.css
// ships seed 0 of each as a PNG; art.js draws any seed in the browser. A
// poster is a print on its own paper; a horizon is a scene at a section's
// foot with the page as its sky. Their colours are fixed palettes of their
// own; every cell is on or off, on the art's 2px cell.
const PHI = (1 + Math.sqrt(5)) / 2;
const names = Object.keys(POSTERS), horizons = Object.keys(HORIZONS);
const N = POSTER_COLS * POSTER_ROWS;
const pngOf = (k) => {
  const m = block.match(new RegExp(`  --sl-art-${k}: url\\('data:image\\/png;base64,([A-Za-z0-9+/=]*)'\\);`));
  return m ? Buffer.from(m[1], "base64") : null;
};
/** The chunks of a PNG, by type. */
const chunks = (file) => {
  const out = {};
  for (let at = 8; at < file.length;) { const len = file.readUInt32BE(at); out[file.subarray(at + 4, at + 8).toString()] = file.subarray(at + 8, at + 8 + len); at += 12 + len; }
  return out;
};
const differ = (a, b) => a.cells.reduce((n, v, k) => n + (v !== b.cells[k]), 0);
const digest = (cells) => createHash("sha256").update(cells).digest("hex").slice(0, 16);

test("the frame is a golden rectangle of 126 × 78 cells", () => {
  assert.deepEqual([POSTER_COLS, POSTER_ROWS], [126, 78]);
  assert.ok(Math.abs(POSTER_COLS / POSTER_ROWS - PHI) < 0.005, `126 / 78 is ${POSTER_COLS / POSTER_ROWS}`);
  assert.deepEqual(names, ["dawn", "overprint", "hills", "orbit"]);
});

test("every poster is one generated image of the frame, seed 0 of its scene", () => {
  for (const k of names) {
    const file = pngOf(`poster-${k}`);
    assert.ok(file, `--sl-art-poster-${k} is not generated as a PNG`);
    const c = chunks(file);
    assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${k}: not a PNG`);
    assert.deepEqual([c.IHDR.readUInt32BE(0), c.IHDR.readUInt32BE(4)], [POSTER_COLS, POSTER_ROWS], `${k}: size`);
    assert.deepEqual([c.IHDR[8], c.IHDR[9]], [4, 3], `${k}: bit depth and colour type`);
    assert.equal(c.PLTE.length / 3, POSTERS[k].palette.length, `${k}: palette`);
    assert.equal(c.tRNS, undefined, `${k}: a print has its own paper, no clear cell`);
    assert.deepEqual([...file], [...posterPng(k)], `${k}: the committed image is not what the generator draws`);
    assert.ok(file.length <= 2048, `${k} is ${file.length} bytes`);
    assert.equal(pngOf(`poster-${k}-ink`), null, `${k}: a print has no ink layer`);
  }
  assert.doesNotMatch(block, /--sl-art-poster-(composition|circles|primary|disc|dot|quarter|tri|tone)/, "a picture of an earlier poster set is still generated");
  assert.ok(!existsSync(resolve(REPO, "scripts/art-sources")), "the 0.44 bitmap sources are still vendored");
});

test("a poster's colours are its scene's own palette", () => {
  for (const k of names) {
    const { palette } = POSTERS[k], picture = renderPoster(k), seen = new Set(picture.cells);
    for (const hex of palette) assert.match(hex, /^#[0-9A-F]{6}$/, `${k}: ${hex}`);
    assert.ok(palette.length <= 16, `${k}: ${palette.length} colours do not fit 4 bits`);
    for (const v of seen) assert.ok(v < palette.length, `${k}: cell value ${v}`);
    // A drawing with too few colours cannot be read (owner, 2026-11-11).
    assert.ok(seen.size >= 6, `${k} uses ${seen.size} colours`);
    assert.equal(picture.ink, -1, `${k}: a print has no ink`);
  }
});

test("the four posters differ", () => {
  for (const [i, a] of names.entries()) for (const b of names.slice(i + 1)) {
    const d = differ(renderPoster(a), renderPoster(b));
    assert.ok(d >= N * 0.25, `${a} and ${b} differ in ${d} of ${N} cells`);
  }
});

test("a seed gives its own picture, and the same one every time", () => {
  for (const k of names) {
    const canon = renderPoster(k);
    assert.equal(differ(canon, renderPoster(k, 0)), 0, `${k}: seed 0 is not the default`);
    const seen = new Set([digest(canon.cells)]);
    for (let seed = 1; seed <= 8; seed++) {
      const a = renderPoster(k, seed);
      assert.equal(differ(a, renderPoster(k, seed)), 0, `${k}: seed ${seed} drew two pictures`);
      assert.ok(differ(a, canon) >= N * 0.05, `${k}: seed ${seed} differs from seed 0 in ${differ(a, canon)} cells`);
      seen.add(digest(a.cells));
    }
    assert.equal(seen.size, 9, `${k}: two seeds drew the same picture`);
  }
  // One seeded picture is pinned: a change in the generator, the hash or the
  // maths under them moves every seeded picture a site already shows.
  assert.equal(digest(renderPoster("hills", 7).cells), "ae4345c1994e755e", "seed 7 of the hills changed");
});

test("seedOf reads a whole number as itself, hashes other text, and takes nothing as 0", () => {
  assert.deepEqual([seedOf(null), seedOf(undefined), seedOf(""), seedOf("  "), seedOf("0")], [0, 0, 0, 0, 0]);
  assert.deepEqual([seedOf("12"), seedOf(12), seedOf(" 7 ")], [12, 12, 7]);
  const blog = seedOf("blog");
  assert.ok(Number.isInteger(blog) && blog > 0 && blog <= 0xffffffff, `"blog" hashed to ${blog}`);
  assert.equal(seedOf("blog"), blog);
  assert.notEqual(seedOf("docs"), blog);
});

test("every horizon is generated: a picture with a clear ground, its ink as a mask, its strip", () => {
  assert.deepEqual(horizons, ["hills", "dawn"]);
  assert.equal(HORIZON_ROWS * ART_CELL_PX, 200);
  assert.deepEqual(HORIZON_TILE, { hills: 400, dawn: 480 });
  for (const k of horizons) {
    assert.equal(HORIZON_TILE[k] % 8, 0, `${k}: its picture is not a whole number of Bayer periods wide`);
    for (const [prop, want, cols, depth] of [[`horizon-${k}`, horizonPng(k), HORIZON_TILE[k], 4], [`horizon-${k}-ink`, horizonInkPng(k), HORIZON_TILE[k], 1], [`horizon-${k}-strip`, horizonStripPng(k), 8, 4]]) {
      const file = pngOf(prop);
      if (!want) { assert.equal(file, null, `--sl-art-${prop} is generated for a scene that has none`); continue; }
      assert.ok(file, `--sl-art-${prop} is not generated`);
      const c = chunks(file);
      assert.deepEqual([c.IHDR.readUInt32BE(0), c.IHDR.readUInt32BE(4)], [cols, HORIZON_ROWS], `${prop}: size`);
      assert.deepEqual([c.IHDR[8], c.IHDR[9]], [depth, 3], `${prop}: bit depth and colour type`);
      assert.deepEqual([...c.tRNS], [0], `${prop}: entry 0 is not the clear page`);
      assert.deepEqual([...file], [...want], `${prop}: the committed image is not what the generator draws`);
      assert.ok(file.length <= 3072, `${prop} is ${file.length} bytes`);
    }
  }
  assert.ok(horizonInkPng("hills") && !horizonInkPng("dawn"), "the hills have ink (the plants), the dawn has none");
  assert.ok(horizonStripPng("dawn") && !horizonStripPng("hills"), "the dawn continues with a strip, the hills repeat");
});

test("a horizon dissolves into the page at its top and is solid at its foot", () => {
  for (const k of horizons) for (const seed of [0, 5]) {
    const p = renderHorizon(k, HORIZON_TILE[k], seed), row = (j) => p.cells.subarray(j * p.cols, (j + 1) * p.cols);
    const whole = new Set([0, p.ink, ...(HORIZONS[k].whole ?? [])]);
    assert.ok(row(0).every((v) => whole.has(v)), `${k} seed ${seed}: the top row holds a colour the dissolve should clear`);
    assert.ok(row(p.rows - 1).every((v) => v !== 0 && v !== p.ink), `${k} seed ${seed}: the foot has a clear or an ink cell`);
    const full = (j) => row(j).reduce((n, v) => n + (v !== 0), 0) / p.cols;
    assert.ok(full(10) < full(p.rows - 20), `${k} seed ${seed}: the scene is not thinner near its top`);
    for (const v of p.cells) assert.ok(v < p.palette.length, `${k}: cell value ${v}`);
  }
});

test("the hills repeat with no seam, and the dawn's strip continues its sides", () => {
  const col = (p, i) => Array.from({ length: p.rows }, (_, j) => p.cells[j * p.cols + i]);
  const diff = (a, b) => a.reduce((n, v, k) => n + (v !== b[k]), 0);
  const hills = renderHorizon("hills", HORIZON_TILE.hills);
  let worst = 0;
  for (let i = 0; i + 1 < hills.cols; i++) worst = Math.max(worst, diff(col(hills, i), col(hills, i + 1)));
  const seam = diff(col(hills, hills.cols - 1), col(hills, 0));
  assert.ok(seam <= worst, `the seam differs in ${seam} cells, the worst neighbours inside the tile in ${worst}`);
  const dawn = renderHorizon("dawn", HORIZON_TILE.dawn), strip = renderHorizonStrip("dawn");
  assert.equal(strip.cols, 8);
  assert.deepEqual(col(dawn, 0), col(strip, 0), "the dawn's first column is not the strip's");
  assert.deepEqual(col(dawn, dawn.cols - 1), col(strip, 7), "the dawn's last column is not the strip's");
  assert.equal(renderHorizonStrip("hills"), null);
});

test("toRgba keeps the clear page and the ink out of the colour layer, and only the ink in the mask", () => {
  const p = renderHorizon("hills", HORIZON_TILE.hills), colour = toRgba(p), ink = toRgba(p, "ink");
  assert.ok(p.cells.includes(p.ink), "the probe has no ink cell");
  for (let k = 0; k < p.cells.length; k++) {
    const v = p.cells[k];
    assert.equal(colour[k * 4 + 3], v === 0 || v === p.ink ? 0 : 255, `colour alpha of cell ${k}`);
    assert.equal(ink[k * 4 + 3], v === p.ink ? 255 : 0, `ink alpha of cell ${k}`);
  }
  const print = renderPoster("overprint"), rgba = toRgba(print);
  assert.deepEqual([...rgba.subarray(0, 4)], [0xea, 0xe4, 0xff, 255], "the overprint's first cell is not its paper");
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

test("a variant only names its layers", () => {
  for (const mod of POSTER_MODIFIERS) {
    const k = mod.slice("sl-art-poster--".length);
    assert.deepEqual(ownDecls(mod, "before"), { "--_sl-art-poster": `var(--sl-art-poster-${k})` }, mod);
  }
  const base = rulesNaming("sl-art-poster", null).concat(rulesNaming("sl-art-poster", "before")).map((r) => r.body).join(";");
  assert.doesNotMatch(base, /(?:^|;)\s*--_sl-art-(poster|live)\s*:/, "the base declares a variant's or the live picture");
  for (const old of ["circles", "primary", "composition", "stair", "bleed", "night", "touch", "board"]) assert.ok(!css.includes(`sl-art-poster--${old}`), `--${old} is not a 0.45 poster`);
  // The dawn is one picture, centred on a whole Bayer period (16px), so its
  // dither meets the strip's; the strip is one period wide.
  const size = `${HORIZON_TILE.dawn * ART_CELL_PX}px ${HORIZON_ROWS * ART_CELL_PX}px`;
  assert.deepEqual(rulesNaming("sl-art-horizon--dawn", null), []);
  const dawn = Object.fromEntries(["before", "after"].map((ps) => { const r = rulesNaming("sl-art-horizon--dawn", ps); assert.equal(r.length, 1, `--dawn::${ps}`); return [ps, r[0].body.replace(/\s+/g, " ").trim()]; }));
  assert.equal(dawn.before, `--_sl-art-horizon-bg: var(--sl-art-horizon-dawn) round(down, 50%, ${8 * ART_CELL_PX}px) 100% / ${size} no-repeat, var(--sl-art-horizon-dawn-strip) 0 100% / ${8 * ART_CELL_PX}px ${HORIZON_ROWS * ART_CELL_PX}px repeat-x;`);
  assert.equal(dawn.after, "--_sl-art-horizon-ink: linear-gradient(transparent 0 0);", "the dawn has no ink, so its mask holds nothing");
});

test("a poster cell is a whole px, the box's width over 126, and the picture is not resampled", () => {
  const rules = rulesNaming("sl-art-poster", "before").filter((r) => r.selector === ".sl-art-poster::before");
  assert.equal(rules.length, 1);
  const d = Object.fromEntries(rules[0].body.replace(/\/\*[\s\S]*?\*\//g, "").split(";").map((x) => x.trim()).filter(Boolean).map((x) => [x.slice(0, x.indexOf(":")).trim(), x.slice(x.indexOf(":") + 1).trim()]));
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

test("a horizon sits at its section's foot, behind the content, and is not resampled", () => {
  const shared = rulesNaming("sl-art-horizon", "before").find((r) => /::after/.test(r.selector) && /::before/.test(r.selector));
  assert.ok(shared, "no rule shared by both pseudo-elements");
  const body = shared.body.replace(/\s+/g, " ");
  for (const decl of [/position: absolute/, /inset-inline: 0/, /bottom: 0/, new RegExp(`height: min\\(${HORIZON_ROWS * ART_CELL_PX}px, 100%\\)`), /z-index: -1/, /image-rendering: pixelated/, /pointer-events: none/]) assert.match(body, decl);
  const host = rulesNaming("sl-art-horizon", null);
  assert.ok(host.length && host.every((r) => r.selector.startsWith(":where(")), "the host's rules are not at zero specificity");
  assert.match(host.map((r) => r.body).join(";"), /position:\s*relative;\s*isolation:\s*isolate/);
});

test("the showcase shows every horizon behind a section, and mounts the art", () => {
  const html = readFileSync(resolve(REPO, "showcase/index.html"), "utf8");
  const cell = html.match(/<div class="[^"]*" data-art-horizons>([\s\S]*?)(?=<div class="[^"]*" data-art-ground=)/)?.[1] ?? "";
  assert.ok(cell, "the Art section has no horizons cell before its grounds");
  const hosts = [...cell.matchAll(/class="([^"]*\bsl-art-horizon\b[^"]*)"/g)].map((m) => m[1].split(/\s+/));
  assert.ok(hosts.some((c) => !c.some((x) => HORIZON_MODIFIERS.includes(x))), "the bare horizon is not shown");
  for (const mod of HORIZON_MODIFIERS) assert.ok(hosts.some((c) => c.includes(mod)), `${mod} is not shown`);
  assert.match(html, /import\s*\{\s*mountArt\s*\}\s*from\s*"\.\.\/packages\/ui-kit\/art\.js"/, "the showcase does not import mountArt");
  assert.match(html, /\bmountArt\(\)/, "the showcase does not call mountArt()");
  assert.match(html, /class="[^"]*\bsl-art-poster\b[^"]*"[^>]*data-sl-art-seed="/, "no poster with a seed is shown");
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

