import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { REGISTRY, THEMES, ratio, rulesFor } from "./lib/primary-matrix.mjs";
import { parseSheet, el, cascaded, customs, longhand, splitList, px } from "./lib/cascade.mjs";
import { evaluate, toSrgb, fromSrgb, toHex } from "./lib/css-color.mjs";
import { VOID, PITCH, TONES, GLYPHS, glyph, voidImage, voidThreshold, START, END } from "./gen-art.mjs";
import { CELL_PX } from "../packages/ui-kit/dither-core.js";

// The Bauhaus pixel art (ui-kit 0.41.0): masks drawn on the dither cell by
// scripts/gen-art.mjs, painted from role vars by hand rules beside the
// elements they decorate. Each test below reads the committed CSS, so a
// hand edit to a rule or a stale generated block fails here.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const CSS_PATH = resolve(REPO, "packages/ui-kit/components.css");
const raw = readFileSync(CSS_PATH, "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every piece: its host classes and the pseudo-element that paints it. */
const PIECES = {
  "sl-eyebrow--mark": { host: ["sl-eyebrow", "sl-eyebrow--mark"], pseudo: "before" },
  "sl-rule--shapes": { host: ["sl-rule", "sl-rule--shapes"], pseudo: "before", tag: "hr" },
  "sl-rule--weave": { host: ["sl-rule", "sl-rule--weave"], pseudo: "before", tag: "hr" },
  "sl-art-corner": { host: ["sl-card", "sl-art-corner"], pseudo: "after" },
  "sl-art-field": { host: ["sl-art-field"], pseudo: "before" },
  "sl-empty--void": { host: ["sl-empty", "sl-empty--void"], pseudo: "after" },
  "sl-empty--shapes": { host: ["sl-empty", "sl-empty--shapes"], pseudo: "before" },
};
const PAINTS = ["--_sl-art-paint", "--_sl-art-accent"];
/** The pieces that can sit under text: the contrast test binds these. */
const UNDERLAY = ["sl-art-field", "sl-art-corner", "sl-empty--void"];
/** The in-flow marks: they take space, so where they paint nothing they go. */
const IN_FLOW = ["sl-eyebrow--mark", "sl-empty--shapes"];
/** The eyebrow glyph modifiers, each worn with sl-eyebrow--mark. */
const GLYPH_MODIFIERS = Object.keys(GLYPHS).filter((k) => k !== "mark").map((k) => `sl-eyebrow--mark-${k}`);

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

test("the generated block stays within the 24 KB payload budget", () => {
  const bytes = Buffer.byteLength(block, "utf8");
  assert.ok(bytes <= 24576, `generated block is ${bytes} bytes`);
});

test("every piece paints through a static, inert pseudo-element", () => {
  for (const [cls, p] of Object.entries(PIECES)) {
    const rules = rulesNaming(cls, p.pseudo);
    assert.ok(rules.length, `${cls}::${p.pseudo} has no rule`);
    const all = rules.map((r) => r.body).join(";");
    assert.match(all, /pointer-events:\s*none/, `${cls}::${p.pseudo} takes pointer events`);
    assert.match(all, /mask(-image)?:[^;]*var\(--sl-art-/, `${cls}::${p.pseudo} is not masked by a generated mask`);
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
  for (const [cls, p] of Object.entries(PIECES)) {
    for (const r of rulesNaming(cls, p.pseudo)) {
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
    for (const cls of UNDERLAY) {
      const p = PIECES[cls];
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
    for (const [cls, p] of Object.entries(PIECES)) {
      assert.match(painted(cls, p).background, /var\(--_sl-art-/, `${cls} paints nothing even on dark: the probe is broken`);
      const got = painted(cls, p, opts);
      if (IN_FLOW.includes(cls)) assert.equal(got.display, "none", cls);
      else assert.equal(got.background, "none", cls);
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

test("the catalog lists every new class", () => {
  const index = JSON.parse(readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.json"), "utf8"));
  const listed = new Set(index.components.flatMap((c) => c.classes));
  const md = readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.md"), "utf8");
  for (const cls of [...Object.keys(PIECES), ...GLYPH_MODIFIERS]) {
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
