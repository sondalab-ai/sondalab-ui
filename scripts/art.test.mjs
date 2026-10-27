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
import { VOID, PITCH, TONES, GLYPHS, FIELDS, POSTER, glyph, field, posterPrimitive, voidImage, voidThreshold, START, END } from "./gen-art.mjs";
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
/** The poster's variants (the horizon is the bare poster), each worn with
 *  sl-art-poster. */
const POSTER_MODIFIERS = ["sl-art-poster--orbit", "sl-art-poster--stair", "sl-art-poster--bleed"];
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

test("the generated block stays within the 32 KB payload budget", () => {
  // 24 KB in 0.41; raised to 32 KB for the 0.42 variants (marks, fields,
  // poster), see the bauhaus-art spec.
  const bytes = Buffer.byteLength(block, "utf8");
  assert.ok(bytes <= 32768, `generated block is ${bytes} bytes`);
});

test("every piece paints through a static, inert pseudo-element", () => {
  for (const [cls, p] of Object.entries(PIECES)) for (const pseudo of pseudosOf(p)) {
    const rules = rulesNaming(cls, pseudo);
    assert.ok(rules.length, `${cls}::${pseudo} has no rule`);
    const all = rules.map((r) => r.body).join(";");
    assert.match(all, /pointer-events:\s*none/, `${cls}::${pseudo} takes pointer events`);
    assert.match(all, /mask(-image)?:[^;]*var\(--sl-art-/, `${cls}::${pseudo} is not masked by a generated mask`);
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
    shapes: { first: 1, rest: 0.5, fade: 0.8 },
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

test("the poster is a mark beside text: the accent in full, the ink at 75%, on two layers", () => {
  // It never sits under text (the hero-field is out, design-language.md),
  // so the underlay contrast test does not bind it; its paints are pinned
  // here instead, from role vars only.
  assert.ok(!UNDERLAY.includes("sl-art-poster"));
  const rules = parseSheet(raw);
  const host = el({ classes: ["sl-art-poster"], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "light" } }) }) });
  const accent = cascaded(rules, el({ pseudo: "before", parent: host }));
  const ink = cascaded(rules, el({ pseudo: "after", parent: host }));
  assert.equal(accent.get("--_sl-art-accent").value, "var(--slc-accent-text)");
  assert.equal(accent.get("background").value, "var(--_sl-art-accent)");
  assert.equal(ink.get("--_sl-art-paint").value, "color-mix(in srgb, var(--slc-text) 75%, transparent)");
  assert.equal(ink.get("background").value, "var(--_sl-art-paint)");
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
    assert.match(decls["--_sl-art-fade"], /^linear-gradient\(.*\btransparent\b.*\)$/, `${mod} is not a ramp to nothing`);
  }
  const base = rulesNaming("sl-art-field", "before").filter((r) => r.selector === ".sl-art-field::before").map((r) => r.body).join(";");
  for (const v of ["--_sl-art-tile", "--_sl-art-size", "--_sl-art-fade", "--_sl-art-end"]) {
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
    "sl-art-field--fade-start": "linear-gradient(to right, black, transparent)",
    "sl-art-field--fade-end": "linear-gradient(to right, transparent, black)",
    "sl-art-field--fade-down": "linear-gradient(black, transparent)",
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

test("start and end are logical: a right-to-left field turns its ramp", () => {
  // The cascade lib does not evaluate :dir(), so the rule is read as text.
  assert.match(css, /\.sl-art-field:dir\(rtl\)::before\s*\{\s*--_sl-art-end:\s*left;\s*\}/);
  for (const fade of ["sl-art-field--fade-start", "sl-art-field--fade-end"]) {
    assert.match(ownDecls(fade, "before")["--_sl-art-fade"], /^linear-gradient\(to var\(--_sl-art-end, right\),/, fade);
  }
});

test("every poster primitive is generated, and each tone tile is the matrix's own level", () => {
  assert.deepEqual(Object.keys(POSTER), ["disc", "dot", "quarter", "tri", "tone", "tone-light"]);
  let bytes = 0;
  for (const [k, { cols, rows }] of Object.entries(POSTER)) {
    const line = block.match(new RegExp(`  --sl-art-poster-${k}: url\\('data:image\\/svg\\+xml,([^']*)'\\);`));
    assert.ok(line, `--sl-art-poster-${k} is not generated`);
    assert.match(decodeURIComponent(line[1]), new RegExp(`viewBox="0 0 ${cols} ${rows}"`), k);
    bytes += Buffer.byteLength(line[0]) + 1;
    const g = posterPrimitive(k), lit = g.on.reduce((n, v) => n + v, 0);
    assert.ok(lit > 0 && lit < g.on.length, `${k} is empty or solid`);
  }
  // A composition is layers over these few masks, not an image per variant.
  assert.ok(bytes <= 2048, `the poster's primitives cost ${bytes} bytes`);
  // The 50% and 25% levels of the 8 × 8 matrix repeat every two cells, so a
  // 2 × 2 tile repeated is the matrix at that level, phase included.
  for (const k of ["tone", "tone-light"]) {
    const g = posterPrimitive(k);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      assert.equal(g.on[(j % 2) * 2 + (i % 2)], Number(POSTER[k].tone > bayerAt(i, j)), `${k}: cell (${i},${j})`);
    }
  }
});

/** The poster's design, in poster cells. */
const FRAME = { w: 48, h: 32 };
/** A poster cell count as the CSS writes it: 0 or calc(n * var(--_sl-art-u)). */
const cells = (v) => {
  if (v === "0") return 0;
  const m = v.match(/^calc\((-?\d+) \* var\(--_sl-art-u\)\)$/);
  assert.ok(m, `${v} is not a whole number of poster cells`);
  return Number(m[1]);
};
/** Splits on the separator at paren depth 0. */
const topSplit = (str, sep) => {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  return [...out, cur.trim()].filter(Boolean);
};
const HATCH = "repeating-linear-gradient(black 0 var(--_sl-art-u), transparent 0 calc(2 * var(--_sl-art-u)))";

/** One mask layer list of the poster, parsed: every layer's image and its
 *  place and size in poster cells, and its compositing operator. */
function layers(list) {
  return topSplit(list.replace(/\s+/g, " "), ",").map((layer) => {
    const t = topSplit(layer, " ");
    const [image, x, y, slash, w, h, repeat, op = "add"] = t;
    assert.equal(slash, "/", layer);
    assert.ok(t.length <= 8, layer);
    const prim = image.match(/^var\(--sl-art-poster-([\w-]+)\)$/)?.[1];
    assert.ok(prim ? prim in POSTER : ["linear-gradient(black 0 0)", HATCH].includes(image), `${image} is not a primitive, a bar or the hatch`);
    assert.match(repeat, /^(no-repeat|repeat)$/, layer);
    assert.match(op, /^(add|intersect)$/, layer);
    return { prim: prim ?? (image === HATCH ? "hatch" : "bar"), x: cells(x), y: cells(y), w: cells(w), h: cells(h), repeat, op };
  });
}

/** The cells of the 48 × 32 frame a layer list covers, composited bottom up
 *  as a browser does: 1 where the mask is opaque. */
function cover(list) {
  const L = layers(list);
  const draw = ({ prim, x, y, w, h, repeat }) => {
    const out = new Uint8Array(FRAME.w * FRAME.h);
    for (let j = 0; j < FRAME.h; j++) for (let i = 0; i < FRAME.w; i++) {
      let u = i - x, v = j - y;
      if (repeat === "repeat") { u = ((u % w) + w) % w; v = ((v % h) + h) % h; } else if (u < 0 || v < 0 || u >= w || v >= h) continue;
      if (prim === "bar") out[j * FRAME.w + i] = 1;
      else if (prim === "hatch") out[j * FRAME.w + i] = v % 2 === 0 ? 1 : 0;
      else {
        const g = posterPrimitive(prim);
        out[j * FRAME.w + i] = g.on[Math.floor((v * g.rows) / h) * g.cols + Math.floor((u * g.cols) / w)];
      }
    }
    return out;
  };
  let acc = draw(L.at(-1));
  for (const l of L.slice(0, -1).reverse()) {
    const d = draw(l);
    acc = acc.map((a, k) => (l.op === "intersect" ? a & d[k] : a | d[k]));
  }
  return acc;
}

/** Every composition's two layer lists: the bare poster's from the base
 *  rules' fallbacks, each variant's from its one rule. */
function compositions() {
  const fallback = (pseudo, v) => {
    const body = rulesNaming("sl-art-poster", pseudo).filter((r) => r.selector === `.sl-art-poster::${pseudo}`).map((r) => r.body).join(";");
    const m = body.match(new RegExp(`(?:^|;)\\s*mask:\\s*var\\(${v},([\\s\\S]*)\\)\\s*(;|$)`));
    assert.ok(m, `.sl-art-poster::${pseudo} does not read ${v} with the bare composition as its fallback`);
    return m[1];
  };
  const out = { "sl-art-poster": { accent: fallback("before", "--_sl-art-poster-accent"), ink: fallback("after", "--_sl-art-poster-ink") } };
  for (const mod of POSTER_MODIFIERS) {
    const d = Object.fromEntries(rulesNaming(mod, "before")[0].body.split(";").map((x) => x.trim()).filter(Boolean).map((x) => [x.slice(0, x.indexOf(":")).trim(), x.slice(x.indexOf(":") + 1).trim()]));
    out[mod] = { accent: d["--_sl-art-poster-accent"], ink: d["--_sl-art-poster-ink"] };
  }
  return out;
}

test("a poster variant only names its two layer lists, on both pseudo-elements", () => {
  for (const mod of POSTER_MODIFIERS) {
    assert.deepEqual(rulesNaming(mod, null), [], `${mod} styles its host`);
    const rules = rulesNaming(mod, "before");
    assert.equal(rules.length, 1, `${mod} has ${rules.length} rules`);
    assert.deepEqual(splitList(rules[0].selector), [`.${mod}::before`, `.${mod}::after`], mod);
    assert.equal(css.split(`.${mod}`).length - 1, 2, `${mod} is named outside its one rule`);
    const decls = rules[0].body.split(";").map((d) => d.trim()).filter(Boolean).map((d) => d.slice(0, d.indexOf(":")).trim());
    assert.deepEqual(decls, ["--_sl-art-poster-accent", "--_sl-art-poster-ink"], mod);
  }
  const base = rulesNaming("sl-art-poster", null).concat(rulesNaming("sl-art-poster", "before"), rulesNaming("sl-art-poster", "after")).map((r) => r.body).join(";");
  assert.doesNotMatch(base, /(?:^|;)\s*--_sl-art-poster-(accent|ink)\s*:/, "the base declares a variant's list");
});

test("the poster's cell is the box's width over 48, a whole px, and the frame is 48 × 32 cells on whole px", () => {
  const shared = rulesNaming("sl-art-poster", "before").find((r) => /::after/.test(r.selector) && /::before/.test(r.selector));
  assert.ok(shared, "no rule shared by both pseudo-elements");
  const d = Object.fromEntries(shared.body.split(";").map((x) => x.trim()).filter(Boolean).map((x) => [x.slice(0, x.indexOf(":")).trim(), x.slice(x.indexOf(":") + 1).trim()]));
  assert.equal(d["--_sl-art-u"], `max(${CELL_PX}px, round(down, 100cqi / ${FRAME.w}, 1px))`);
  assert.equal(d.width, `calc(${FRAME.w} * var(--_sl-art-u))`);
  assert.equal(d.height, `calc(${FRAME.h} * var(--_sl-art-u))`);
  assert.equal(d.left, `round(down, (100% - ${FRAME.w} * var(--_sl-art-u)) / 2, 1px)`);
  assert.equal(d.top, `round(down, (100% - ${FRAME.h} * var(--_sl-art-u)) / 2, 1px)`);
  assert.equal(d["pointer-events"], "none");
  const host = rulesNaming("sl-art-poster", null).map((r) => r.body).join(";");
  for (const decl of [/position:\s*relative/, /isolation:\s*isolate/, /container-type:\s*inline-size/, /pointer-events:\s*none/]) assert.match(host, decl);
  assert.ok(rulesNaming("sl-art-poster", null).every((r) => r.selector.startsWith(":where(")), "the host's rules are not at zero specificity");
});

test("every poster layer lands on whole cells, and every primitive keeps whole cells", () => {
  for (const [name, comp] of Object.entries(compositions())) for (const [side, list] of Object.entries(comp)) {
    const L = layers(list);
    const tones = L.filter((l) => l.op === "intersect");
    assert.ok(tones.length <= 1, `${name} ${side}: more than one tone`);
    for (const l of L) {
      if (l.op === "intersect") {
        assert.deepEqual([l.prim.startsWith("tone"), l.x, l.y, l.w, l.h, l.repeat], [true, 0, 0, 2, 2, "repeat"], `${name} ${side}: a tone is a 2 × 2 tile from the frame's origin`);
        assert.equal(L.indexOf(l), L.length - 2, `${name} ${side}: a tone must sit on its region, the last layer`);
        continue;
      }
      assert.equal(l.repeat, "no-repeat", `${name} ${side}: ${l.prim} repeats`);
      assert.ok(!l.prim.startsWith("tone"), `${name} ${side}: a tone outside an intersect`);
      if (l.prim in POSTER) {
        const { cols, rows } = POSTER[l.prim];
        assert.ok(l.w % cols === 0 && l.h % rows === 0 && l.w / cols === l.h / rows, `${name} ${side}: ${l.prim} at ${l.w} × ${l.h} is not a whole multiple of its ${cols} × ${rows} cells`);
      }
    }
    assert.ok(L.some((l) => l.x < FRAME.w && l.y < FRAME.h && l.x + l.w > 0 && l.y + l.h > 0), `${name} ${side}: nothing in the frame`);
  }
});

test("the poster's compositions differ, each asymmetric, its accent and ink apart", () => {
  const all = Object.entries(compositions()).map(([name, c]) => ({ name, accent: cover(c.accent), ink: cover(c.ink) }));
  assert.equal(all.length, 4);
  const n = FRAME.w * FRAME.h;
  for (const c of all) {
    const lit = (g) => g.reduce((a, v) => a + v, 0);
    assert.ok(lit(c.accent) >= n * 0.05, `${c.name}: the accent covers ${lit(c.accent)} cells`);
    assert.ok(lit(c.ink) >= n * 0.1, `${c.name}: the ink covers ${lit(c.ink)} cells`);
    // Ink at 75% over the accent tints it: the two never overlap.
    assert.equal(c.accent.reduce((a, v, k) => a + (v & c.ink[k]), 0), 0, `${c.name}: accent and ink overlap`);
    // Bauhaus balance is asymmetric: the mirror of a composition is another.
    const both = c.accent.map((v, k) => v * 2 + c.ink[k]);
    const flip = (g, f) => g.reduce((a, v, k) => a + (v !== g[f(k)]), 0);
    const lr = flip(both, (k) => Math.floor(k / FRAME.w) * FRAME.w + (FRAME.w - 1 - (k % FRAME.w)));
    const tb = flip(both, (k) => (FRAME.h - 1 - Math.floor(k / FRAME.w)) * FRAME.w + (k % FRAME.w));
    assert.ok(lr >= n * 0.2 && tb >= n * 0.2, `${c.name} is near symmetric: ${lr} and ${tb} cells change in a mirror`);
  }
  for (const [i, a] of all.entries()) for (const b of all.slice(i + 1)) {
    const d = a.accent.reduce((s, v, k) => s + (v !== b.accent[k]) + (a.ink[k] !== b.ink[k]), 0);
    assert.ok(d >= n * 0.3, `${a.name} and ${b.name} differ in ${d} of ${n} cells`);
  }
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

