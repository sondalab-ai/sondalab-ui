import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { REGISTRY, THEMES, ratio, rulesFor } from "./lib/primary-matrix.mjs";
import { parseSheet, el, cascaded, customs, longhand, splitList } from "./lib/cascade.mjs";
import { evaluate, toSrgb, fromSrgb, toHex } from "./lib/css-color.mjs";
import { VOID, PITCH, TONES, voidImage, voidThreshold, START, END } from "./gen-art.mjs";
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
    assert.match(got.background, /var\(--_sl-art-accent\) \d+px, var\(--_sl-art-paint\) 0/, `${cls} splits accent and ink`);
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

test("the catalog lists every new class", () => {
  const index = JSON.parse(readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.json"), "utf8"));
  const listed = new Set(index.components.flatMap((c) => c.classes));
  const md = readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.md"), "utf8");
  for (const cls of Object.keys(PIECES)) {
    assert.ok(listed.has(cls), `catalog.json misses ${cls}`);
    assert.ok(md.includes(cls), `catalog.md misses ${cls}`);
  }
});
