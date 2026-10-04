import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate, fromSrgb, substitute, toHex, toSrgb } from "./lib/css-color.mjs";
import { parseSheet, el, cascaded, customs as rawCustoms, declaredHeight, box, px } from "./lib/cascade.mjs";

// The workbench (ui-kit 0.33, Lumen): the lit pane, the status bar, the
// activity bar, the tree, the palette and the terminal block (workbench.css),
// and the toast stack (components.css). Every piece is read through the test
// cascade (scripts/lib/cascade.mjs) over the kit's real sheets, on every
// registered product, light, dark and high contrast, on the page, inside the
// inversion band and on a Tier B page. Custom properties compute where they
// are declared (scope() in css-color.mjs), so a :root role is never resolved
// against an element's own declarations.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const WORKBENCH = bare(read("workbench.css"));
const COMPONENTS = bare(read("components.css"));
const NEUTRALS = JSON.parse(read("neutrals.json")).products;
const REGISTRY = JSON.parse(read("agent/accent-registry.json")).products;
const PRODUCTS = Object.keys(NEUTRALS).filter((p) => !NEUTRALS[p].inherits);

// ── the cascade ────────────────────────────────────────────────────────────

const TIER_A = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css", "themes/products.css", "components.css", "workbench.css"].map(read);
const TIER_B = ["tokens.css", "components.css", "workbench.css"].map(read);

/** A product applies its own accent (products.css carries only neutrals):
 *  the registered hue per theme, the dark ring re-bound to it as the dark
 *  theme pins its ring, and its registered labelled fill as the one role. */
const accents = () => PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
  const fill = REGISTRY[p].fill?.[t];
  return `:root[data-sl-product="${p}"][data-sl-theme="${t}"] { --sl-accent-default: ${REGISTRY[p][t]};${t === "dark" ? ` --sl-focus-ring: ${REGISTRY[p][t]};` : ""}${fill ? ` --slc-accent-fill: ${fill};` : ""} }`;
})).join("\n");
/** A Tier B page: no theme file; its own [data-theme] layer maps the
 *  README's role-vars from the product's neutrals (status from the shared
 *  status values, as a Tier B layer copies them) and sets the light numbers. */
const STATUS = Object.fromEntries(["light", "dark"].map((t) => [t, Object.fromEntries([...bare(read(`themes/${t}.css`)).matchAll(/--sl-status-(\w+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))]));
const tierB = () => PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
  const n = NEUTRALS[p][t];
  const map = {
    "--slc-accent": REGISTRY[p][t], "--slc-canvas": n["bg-canvas"], "--slc-surface": n["bg-surface"], "--slc-raised": n["bg-surface-raised"],
    "--slc-overlay": n["bg-overlay"], "--slc-text": n["text-primary"], "--slc-text-secondary": n["text-secondary"], "--slc-text-muted": n["text-muted"],
    "--slc-border": n["border-default"], "--slc-border-subtle": n["border-subtle"], "--slc-border-strong": n["border-strong"], "--slc-focus": REGISTRY[p][t],
    ...Object.fromEntries(["success", "warning", "danger", "info"].map((s) => [`--slc-${s}`, STATUS[t][s]])),
    ...(t === "light" ? { "--sl-accent-text-lmax": "0.46", "--slc-edge-accent-lmax": "0.59", "--slc-glow": "0.35" } : {}),
  };
  return `:root[data-product="${p}"][data-theme="${t}"] { ${Object.entries(map).map(([k, v]) => `${k}: ${v};`).join(" ")} }`;
})).join("\n");
const PAGE = "html, body { background-color: var(--slc-canvas); color: var(--slc-text); }";

let order = 0;
const parse = (texts) => texts.flatMap((css) => { const r = parseSheet(css, {}, order); order += r.length + 1; return r; });
const RULES_A = parse([...TIER_A, accents(), PAGE]);
const RULES_B = parse([...TIER_B, tierB(), PAGE]);

/** Every context a piece is read in: product × theme × where. */
const CONTEXTS = [
  ...PRODUCTS.flatMap((p) => ["light", "dark"].flatMap((t) => [
    { name: `${t} ${p}`, rules: RULES_A, attrs: { "data-sl-theme": t, "data-sl-product": p } },
    { name: `${t} ${p} band`, rules: RULES_A, attrs: { "data-sl-theme": t, "data-sl-product": p }, band: true },
    { name: `${t} ${p} Tier B`, rules: RULES_B, attrs: { "data-theme": t, "data-product": p } },
  ])),
  { name: "high-contrast", rules: RULES_A, attrs: { "data-sl-theme": "high-contrast" } },
  { name: "high-contrast band", rules: RULES_A, attrs: { "data-sl-theme": "high-contrast" }, band: true },
];

/** The mount point of a context: body, or a child of the inversion band. */
function mount(ctx) {
  const html = el({ tag: "html", attrs: ctx.attrs });
  const body = el({ tag: "body", parent: html });
  if (!ctx.band) return body;
  return el({ parent: el({ tag: "section", classes: ["sl-invert"], parent: body }) });
}

// customs() recomputes every ancestor; an element is immutable here, so memoise.
const memo = new WeakMap();
const customs = (rules, e) => {
  let byRules = memo.get(e);
  if (!byRules) memo.set(e, (byRules = new Map()));
  if (!byRules.has(rules)) byRules.set(rules, rawCustoms(rules, e));
  return byRules.get(rules);
};

const BLACK = fromSrgb([0, 0, 0]);
const cssOf = (c) => { const [r, g, b] = toSrgb(c); return `rgb(${r * 255}, ${g * 255}, ${b * 255}, ${c.alpha})`; };
/** A declared value evaluated on an element, `currentColor` bound to `current`. */
const value = (rules, e, v, current) => evaluate(substitute(v, customs(rules, e)).replace(/currentColor/gi, cssOf(current)), new Map());

/** The computed `color`: the element's own value (currentColor is its
 *  parent's colour there), or its parent's. */
function colorOf(rules, e) {
  const parent = e.parent ? colorOf(rules, e.parent) : BLACK;
  const v = cascaded(rules, e).get("color")?.value;
  if (!v || v === "inherit") return parent;
  return value(rules, e, v, parent);
}
const cmp = (x, y) => (x.important - y.important) || x.spec[0] - y.spec[0] || x.spec[1] - y.spec[1] || x.spec[2] - y.spec[2] || x.order - y.order;
/** The background colour an element paints (transparent if none): the
 *  winner of `background` and `background-color`. A shorthand carrying an
 *  image is not read, it throws: a ground is a colour here. */
function bgOf(rules, e) {
  const won = cascaded(rules, e);
  const [d] = [won.get("background"), won.get("background-color")].filter(Boolean).sort((a, b) => cmp(b, a));
  if (!d) return { lin: [0, 0, 0], alpha: 0 };
  const v = d.value.trim();
  if (v === "none" || v === "transparent") return { lin: [0, 0, 0], alpha: 0 };
  if (/gradient\(|url\(/.test(v)) throw new Error(`a background image is not a ground: ${v}`);
  return value(rules, e, v, colorOf(rules, e));
}
const over = (top, under) => {
  const t = toSrgb(top), u = toSrgb(under);
  return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha)));
};
/** What an element's content sits on: every background up its tree, composited. */
function groundOf(rules, e) {
  const chain = [];
  for (let n = e; n; n = n.parent) if (!n.pseudo) chain.unshift(n);
  return chain.reduce((acc, n) => over(bgOf(rules, n), acc), fromSrgb([1, 1, 1]));
}
const Y = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
/** Text contrast of an element on its own composited ground. */
const textContrast = (rules, e) => { const g = groundOf(rules, e); return ratio(over(colorOf(rules, e), g), g); };
/** The strongest colour stop of a pseudo-element's paint (a gradient's
 *  peak, or its background colour), against the ground under its origin --
 *  or, for a seam drawn as an element's own background layer, against that
 *  element's own composited fill. */
function markContrast(rules, p, groundEl = p.parent) {
  const won = cascaded(rules, p);
  const g = groundOf(rules, groundEl);
  const img = won.get("background-image")?.value ?? won.get("background")?.value;
  const stops = img && /gradient\(/.test(img)
    ? splitTop(img.slice(img.indexOf("(") + 1, img.lastIndexOf(")"))).filter((s) => !/^-?[\d.]+deg$|^to /.test(s)).map((s) => s.replace(/\s+-?[\d.]+%$/, ""))
    : [won.get("background-color")?.value ?? img];
  return Math.max(...stops.map((s) => ratio(over(value(rules, p, s, colorOf(rules, p)), g), g)));
}
function splitTop(t) {
  const out = []; let d = 0, f = 0;
  for (let i = 0; i <= t.length; i++) { const ch = t[i]; if (ch === "(") d++; else if (ch === ")") d--; else if ((ch === "," && d === 0) || i === t.length) { out.push(t.slice(f, i).trim()); f = i + 1; } }
  return out;
}

// ── the pieces ─────────────────────────────────────────────────────────────

/** Each primitive mounted where it lives, as the mock tree a consumer's
 *  markup makes. Returns { name: element } for the pieces read below. */
const BUILD = {
  pane(at) {
    const pane = el({ tag: "section", classes: ["sl-pane"], parent: at });
    const lit = el({ tag: "section", classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: at });
    return { pane, lit, seam: el({ pseudo: "before", parent: lit }), "text in a pane": el({ tag: "p", parent: pane }), "text in the lit pane": el({ tag: "p", parent: lit }) };
  },
  statusbar(at) {
    const bar = el({ tag: "footer", classes: ["sl-statusbar"], parent: at });
    const item = el({ tag: "span", classes: ["sl-statusbar__item"], parent: bar });
    return { bar, "status item": item, dot: el({ tag: "span", classes: ["sl-statusbar__dot"], parent: item }), sep: el({ tag: "span", classes: ["sl-statusbar__sep"], parent: bar }) };
  },
  activitybar(at) {
    const bar = el({ tag: "nav", classes: ["sl-activitybar"], parent: at });
    const item = el({ tag: "button", classes: ["sl-activitybar__item"], parent: bar });
    const current = el({ tag: "button", classes: ["sl-activitybar__item"], attrs: { "aria-current": "true" }, parent: bar });
    const tab = el({ tag: "button", classes: ["sl-activitybar__item"], attrs: { role: "tab", "aria-selected": "true" }, parent: bar });
    return { "activity item": item, "activity hovered": el({ tag: "button", classes: ["sl-activitybar__item"], states: ["hover"], parent: bar }), "activity current": current, "activity tab": tab,
      "activity glyph": el({ tag: "svg", parent: item }), "activity current glyph": el({ tag: "svg", parent: current }), "activity tab glyph": el({ tag: "svg", parent: tab }) };
  },
  tree(at) {
    const out = {};
    for (const [where, lit] of [["", false], [" in the lit pane", true]]) {
      const pane = el({ tag: "section", classes: ["sl-pane"], attrs: lit ? { "data-lit": "" } : {}, parent: at });
      for (const [focus, states] of [["", []], [", focused", ["focus-within"]]]) {
        const tree = el({ tag: "ul", classes: ["sl-tree"], attrs: { role: "tree" }, states, parent: pane });
        const row = el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": "2", "aria-expanded": "true", "aria-selected": "false" }, parent: tree });
        const sel = el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": "3", "aria-selected": "true" }, parent: tree });
        const k = `${where}${focus}`;
        Object.assign(out, {
          [`tree${k}`]: tree, [`tree row${k}`]: row, [`tree label${k}`]: el({ tag: "span", classes: ["sl-tree__label"], parent: row }),
          [`tree twisty${k}`]: el({ tag: "span", classes: ["sl-tree__twisty"], parent: row }), [`tree icon${k}`]: el({ tag: "svg", parent: row }),
          [`tree selected${k}`]: sel, [`tree selected label${k}`]: el({ tag: "span", classes: ["sl-tree__label"], parent: sel }), [`tree selected icon${k}`]: el({ tag: "svg", parent: sel }),
        });
      }
    }
    out["tree chevron"] = el({ pseudo: "before", parent: out["tree twisty"] });
    return out;
  },
  palette(at) {
    const pal = el({ attrs: { role: "dialog" }, classes: ["sl-palette"], parent: at });
    const head = el({ classes: ["sl-palette__head"], parent: pal });
    const list = el({ classes: ["sl-palette__list"], attrs: { role: "listbox" }, parent: pal });
    const group = el({ attrs: { role: "group" }, parent: list });
    const row = el({ classes: ["sl-palette__row"], attrs: { role: "option", "aria-selected": "false" }, parent: group });
    const sel = el({ classes: ["sl-palette__row"], attrs: { role: "option", "aria-selected": "true" }, parent: group });
    const label = el({ tag: "span", classes: ["sl-palette__label"], parent: row });
    const selLabel = el({ tag: "span", classes: ["sl-palette__label"], parent: sel });
    const foot = el({ classes: ["sl-palette__foot"], parent: pal });
    return {
      palette: pal, "palette seam": el({ pseudo: "before", parent: pal }),
      "palette input": el({ tag: "input", classes: ["sl-field__input", "sl-palette__input"], attrs: { role: "combobox" }, parent: head }),
      "palette group": el({ tag: "p", classes: ["sl-palette__group"], parent: group }),
      "palette row": row, "palette label": label, "palette match": el({ tag: "mark", parent: label }), "palette meta": el({ tag: "span", classes: ["sl-palette__meta"], parent: row }), "palette icon": el({ tag: "svg", parent: row }),
      "palette selected": sel, "palette selected label": selLabel, "palette selected match": el({ tag: "mark", parent: selLabel }), "palette selected meta": el({ tag: "span", classes: ["sl-palette__meta"], parent: sel }), "palette selected icon": el({ tag: "svg", parent: sel }),
      "palette key": el({ tag: "kbd", classes: ["sl-kbd"], parent: el({ tag: "span", classes: ["sl-palette__keys"], parent: row }) }),
      "palette foot": foot,
    };
  },
  term(at, ctx) {
    const out = {};
    for (const [exit, attrs] of [["running", {}], ["exit 0", { "data-exit": "0" }], ["exit 1", { "data-exit": "1" }], ["exit 127", { "data-exit": "127" }]]) {
      for (const [where, lit] of [["", false], [" in the lit pane", true]]) {
        const pane = ctx.band ? at : el({ tag: "section", classes: ["sl-pane"], attrs: lit ? { "data-lit": "" } : {}, parent: at });
        const block = el({ tag: "article", classes: ["sl-term-block"], attrs, parent: pane });
        const head = el({ tag: "header", classes: ["sl-term-block__head"], parent: block });
        const cmd = el({ tag: "span", classes: ["sl-term-block__cmd"], parent: head });
        const meta = el({ tag: "span", classes: ["sl-term-block__meta"], parent: head });
        const k = `${exit}${where}`;
        Object.assign(out, {
          [`term ${k}`]: block, [`term ${k} mark`]: el({ pseudo: "before", parent: block }),
          [`term ${k} command`]: cmd, [`term ${k} prompt`]: el({ tag: "span", classes: ["sl-term-block__prompt"], parent: cmd }),
          [`term ${k} meta`]: meta, [`term ${k} exit`]: el({ tag: "span", classes: ["sl-term-block__exit"], parent: meta }),
          [`term ${k} output`]: el({ tag: "pre", classes: ["sl-term-block__out"], parent: block }),
        });
      }
    }
    return out;
  },
  toast(at) {
    const stack = el({ tag: "section", classes: ["sl-toast-stack"], parent: at });
    const out = {};
    for (const tone of [null, "info", "success", "warning", "danger"]) {
      const t = el({ classes: ["sl-toast", ...(tone ? [`sl-toast--${tone}`] : [])], attrs: { role: "status" }, parent: stack });
      const content = el({ classes: ["sl-toast__content"], parent: t });
      const key = tone ?? "neutral";
      out[`toast ${key}`] = t;
      out[`toast ${key} title`] = el({ tag: "p", classes: ["sl-toast__title"], parent: content });
      out[`toast ${key} body`] = el({ tag: "p", classes: ["sl-toast__body"], parent: content });
      out[`toast ${key} mark`] = el({ tag: "span", classes: ["sl-toast__mark"], parent: t });
      out[`toast ${key} tick`] = el({ pseudo: "before", parent: t });
      out[`toast ${key} dismiss`] = el({ tag: "button", classes: ["sl-icon-btn", "sl-toast__dismiss"], parent: t });
    }
    return out;
  },
};
/** Inside an inversion band only the terminal block is read, set straight on
 *  the band: it is a real-content block (L3), which a page shows on the ink
 *  surface. The rest is a workbench's chrome, which lives on the workbench's
 *  frame, and the overlays (the toast, the palette) are children of the body
 *  or the top layer: the band's roles are washes of its own ground, so a pane
 *  or an overlay mounted in one would stack washes or float translucent. */
const IN_BAND = new Set(["term"]);
const build = (ctx) => { const at = mount(ctx); return Object.assign({}, ...Object.entries(BUILD).filter(([k]) => !ctx.band || IN_BAND.has(k)).map(([k, f]) => f(at, ctx))); };

/** [piece, minimum, how it is read]: "text" on its own ground, "mark" a
 *  pseudo-element's paint against its origin's ground (3:1, a graphical
 *  object), "fill" an element's own fill against its parent's ground. */
const READINGS = [
  ["text in a pane", 4.5, "text"],
  ["text in the lit pane", 4.5, "text"],
  ["seam", 3, "mark"],
  ["status item", 4.5, "text"],
  ["dot", 3, "fill"],
  ["activity glyph", 3, "text"],
  ["activity hovered", 3, "text"],
  ["activity current glyph", 3, "text"],
  ["activity current", 3, "layer"],
  ["activity tab", 3, "layer"],
  ["activity tab glyph", 3, "text"],
  ...["", " in the lit pane"].flatMap((w) => ["", ", focused"].flatMap((f) => [
    [`tree label${w}${f}`, 4.5, "text"],
    [`tree twisty${w}${f}`, 3, "text"],
    [`tree icon${w}${f}`, 3, "text"],
    [`tree selected label${w}${f}`, 4.5, "text"],
    [`tree selected icon${w}${f}`, 3, "text"],
  ])),
  ["tree chevron", 3, "border"],
  ["palette input", 4.5, "text"],
  ["palette group", 4.5, "text"],
  ["palette label", 4.5, "text"],
  ["palette match", 4.5, "text"],
  ["palette meta", 4.5, "text"],
  ["palette icon", 3, "text"],
  ["palette selected label", 4.5, "text"],
  ["palette selected match", 4.5, "text"],
  ["palette selected meta", 4.5, "text"],
  ["palette selected icon", 3, "text"],
  ["palette key", 4.5, "text"],
  ["palette foot", 4.5, "text"],
  ...["running", "exit 0", "exit 1", "exit 127"].flatMap((x) => ["", " in the lit pane"].flatMap((w) => [
    [`term ${x}${w} command`, 4.5, "text"],
    [`term ${x}${w} prompt`, 4.5, "text"],
    [`term ${x}${w} meta`, 4.5, "text"],
    [`term ${x}${w} exit`, 4.5, "text"],
    [`term ${x}${w} output`, 4.5, "text"],
    ...(x === "running" ? [] : [[`term ${x}${w} mark`, 3, "mark"]]),
  ])),
  ...["neutral", "info", "success", "warning", "danger"].flatMap((t) => [
    [`toast ${t} title`, 4.5, "text"],
    [`toast ${t} body`, 4.5, "text"],
    [`toast ${t} mark`, 4.5, "text"],
  ]),
];

const fillContrast = (rules, e) => { const g = groundOf(rules, e.parent); return ratio(over(bgOf(rules, e), g), g); };
/** A glyph drawn in currentColor borders (the twisty's chevron) on its ground. */
const borderContrast = (rules, e) => {
  const won = cascaded(rules, e);
  assert.match(won.get("border-right")?.value ?? "", /currentColor/, "the chevron is drawn in currentColor");
  const g = groundOf(rules, e.parent);
  return ratio(over(colorOf(rules, e), g), g);
};

for (const ctx of CONTEXTS) {
  test(`${ctx.name}: every text-carrying piece reads at 4.5:1 and every mark at 3:1`, () => {
    const pieces = build(ctx);
    const low = [];
    for (const [name, min, how] of READINGS) {
      const e = pieces[name];
      if (!e && ctx.band && !name.startsWith("term")) continue;
      assert.ok(e, `no piece ${name}`);
      const r = how === "text" ? textContrast(ctx.rules, e) : how === "mark" ? markContrast(ctx.rules, e) : how === "border" ? borderContrast(ctx.rules, e) : how === "layer" ? markContrast(ctx.rules, e, e) : fillContrast(ctx.rules, e);
      if (!(r >= min)) low.push(`${name} ${r.toFixed(2)} < ${min}`);
    }
    assert.deepEqual(low, []);
  });
}

// ── the reader itself ───────────────────────────────────────────────────────

test("the reader composites grounds up the tree and binds currentColor where CSS does", () => {
  const rules = parse([".a { background-color: #000000; color: #ffffff; } .b { background-color: color-mix(in srgb, currentColor 50%, transparent); }"]);
  const a = el({ classes: ["a"], parent: el({ tag: "html" }) });
  const b = el({ classes: ["b"], parent: a });
  assert.equal(toHex(colorOf(rules, b)), "#ffffff", "color inherits");
  for (const ch of toSrgb(groundOf(rules, b))) assert.ok(Math.abs(ch - 0.5) < 1e-6, `a 50% wash of white over black: ${ch}`);
  assert.throws(() => bgOf(parse([".a { background: linear-gradient(red, blue); }"]), a), /not a ground/);
});

// ── the pane ────────────────────────────────────────────────────────────────

const RULES = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim().replace(/\s+/g, " "), body: m[2] }));
const WB = RULES(WORKBENCH);
const CO = RULES(COMPONENTS);
const rule = (list, sel) => { const r = list.find((x) => x.selector === sel); assert.ok(r, `no rule ${sel}`); return r.body; };
const decl = (body, prop) => body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1].trim().replace(/\s+/g, " ");
const dark = CONTEXTS.find((c) => c.name === "dark default");
const hc = CONTEXTS.find((c) => c.name === "high-contrast");

test("a pane is an island: the surface rung, the island recipe, the pane radius, no border", () => {
  const { pane, lit } = build(dark);
  const won = cascaded(RULES_A, pane);
  assert.equal(won.get("box-shadow").value, "var(--slc-depth-island)");
  assert.equal(won.get("background-color").value, "var(--slc-surface)");
  assert.equal(won.get("border-radius").value, "var(--sl-radius-pane, 10px)");
  assert.equal(won.get("border").value, "0", "a recipe host carries no border: the lit line sits flush under the ring");
  const l = cascaded(RULES_A, lit);
  assert.equal(l.get("background-color").value, "var(--slc-raised)", "the lit pane is the lighter rung");
  assert.match(l.get("box-shadow").value, /^var\(--slc-depth-island\), 0 0 24px -6px color-mix\(in srgb, var\(--slc-seam\) calc\(var\(--slc-glow\) \* 40%\), transparent\)$/);
});

test("the lit pane's seam and glow spend --slc-glow, which is 0 in high contrast", () => {
  const glowAlpha = (ctx) => {
    const { lit } = build(ctx);
    const v = cascaded(RULES_A, lit).get("box-shadow").value;
    return value(RULES_A, lit, v.slice(v.indexOf("color-mix(")), BLACK).alpha;
  };
  assert.ok(Math.abs(glowAlpha(dark) - 0.2) < 1e-9, `dark ${glowAlpha(dark)}`);
  assert.ok(Math.abs(glowAlpha(CONTEXTS.find((c) => c.name === "light default")) - 0.14) < 1e-9);
  assert.equal(glowAlpha(hc), 0);
  // in high contrast the island is a drawn ring in the theme's own line
  const { lit } = build(hc);
  const env = customs(RULES_A, lit);
  assert.equal(env.get("--slc-depth-island"), `0 0 0 1px ${env.get("--slc-border")}`);
});

// ── the status bar ─────────────────────────────────────────────────────────

test("the status bar keeps its own height: the items, a dot and a separator fit inside it", () => {
  for (const ctx of [dark, hc]) {
    const p = build(ctx);
    const bar = declaredHeight(ctx.rules, p.bar);
    assert.equal(bar, 28, "28px, the kit's 4px grid");
    assert.equal(bar % 4, 0);
    // the declared height holds it; it clips only across, so a small button's halo in it still shows
    assert.equal(cascaded(ctx.rules, p.bar).get("overflow-x").value, "clip");
    assert.equal(cascaded(ctx.rules, p.bar).get("overflow"), undefined, "no clip up and down");
    assert.equal(cascaded(ctx.rules, p.bar).get("align-items").value, "center");
    for (const name of ["status item", "dot", "sep"]) {
      const h = declaredHeight(ctx.rules, p[name]);
      assert.ok(h !== null && h <= bar, `${name} ${h}px in a ${bar}px bar`);
    }
    // the bar's line (it sets the type) fits an item's height
    assert.ok(box(ctx.rules, p.bar).line <= declaredHeight(ctx.rules, p["status item"]));
  }
});

test("the status bar speaks in the micro register and paints no ground of its own", () => {
  const { bar } = build(dark);
  const won = cascaded(RULES_A, bar);
  for (const [p, v] of [["font-family", "var(--sl-font-mono, ui-monospace, monospace)"], ["font-size", "var(--sl-text-micro, 0.65625rem)"], ["font-weight", "500"], ["letter-spacing", "0.06em"], ["text-transform", "uppercase"], ["color", "var(--slc-text-muted)"], ["background-color", "transparent"]]) {
    assert.equal(won.get(p)?.value, v, p);
  }
  // a separator is a border, which forced colours keep; a fill they repaint
  assert.equal(cascaded(RULES_A, build(dark).sep).get("border-inline-start").value, "1px solid var(--slc-border)");
});

// ── the toast ──────────────────────────────────────────────────────────────

test("the toast floats: its border in shade is the ring, the float recipe the cast", () => {
  const p = build(dark);
  const won = cascaded(RULES_A, p["toast success"]);
  assert.equal(won.get("border").value, "1px solid var(--slc-edge-raised)");
  assert.equal(won.get("box-shadow").value, "var(--slc-depth-float)");
  assert.equal(won.get("background-color").value, "var(--slc-raised)");
  // the stack lets the pointer through, a toast takes it
  assert.equal(cascaded(RULES_A, p["toast success"].parent).get("pointer-events").value, "none");
  assert.equal(cascaded(RULES_A, p["toast success"]).get("pointer-events")?.value, "auto");
  assert.equal(cascaded(RULES_A, p["toast success"].parent).get("z-index").value, "var(--sl-z-toast, 200)");
});

test("each tone is the kit's status role, as text in a band and the role itself on the page", () => {
  for (const tone of ["info", "success", "warning", "danger"]) {
    assert.equal(decl(rule(CO, `.sl-toast--${tone}`), "--_sl-tone"), `var(--slc-${tone}-text, var(--slc-${tone}))`, tone);
  }
  const p = build(dark);
  for (const tone of ["success", "danger"]) {
    const mark = colorOf(RULES_A, p[`toast ${tone} mark`]);
    assert.equal(toHex(mark), toHex(value(RULES_A, p[`toast ${tone}`], `var(--slc-${tone})`, BLACK)), `${tone}: the page reads the status role`);
  }
});

test("the dismiss keeps the one control edge, at the small button's 24px", () => {
  const p = build(dark);
  const d = p["toast success dismiss"];
  const won = cascaded(RULES_A, d);
  assert.equal(won.get("border").value, "1px solid var(--slc-edge-control)", "only the tab's close and the activity bar are borderless chrome");
  assert.equal(declaredHeight(RULES_A, d), 24);
});

// ── pseudo-elements: ::before is the component's, ::after the aurora's ───────

test("the workbench and the toast draw on ::before only: ::after stays free for the aurora", () => {
  const sels = [...WB, ...CO.filter((r) => /\.sl-toast/.test(r.selector))].map((r) => r.selector);
  assert.deepEqual(sels.filter((s) => /::after/.test(s)), []);
  for (const host of [".sl-pane", ".sl-toast"]) {
    assert.ok(sels.some((s) => s.startsWith(host) && s.endsWith("::before")), `${host} owns its ::before`);
  }
});

// ── forced colours ─────────────────────────────────────────────────────────

test("forced colours: a pane gets a drawn edge, the lit seam and the live dot are system colours", () => {
  const fc = parseSheet(read("workbench.css"), { forcedColors: true });
  const at = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) });
  const pane = el({ classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: at });
  assert.equal(cascaded(fc, pane).get("outline").value, "1px solid CanvasText");
  assert.ok(cascaded(fc, pane).get("outline").important);
  const seam = cascaded(fc, el({ pseudo: "before", parent: pane }));
  assert.equal(seam.get("background").value, "Highlight");
  assert.equal(seam.get("forced-color-adjust").value, "none");
  const dot = cascaded(fc, el({ classes: ["sl-statusbar__dot"], parent: at }));
  assert.equal(dot.get("background").value, "CanvasText");
  // the island's recipe is off there (components.css), so the outline is the edge
  const fcKit = parseSheet(read("components.css"), { forcedColors: true });
  assert.equal(customs(fcKit, el({ tag: "html", attrs: { "data-sl-theme": "dark" } })).get("--slc-depth-island"), "0 0 transparent");
});

// ── focus: the shared flush ring and its halo, on every focusable piece ────

/** The halo's colour alpha on an element (its private --_sl-halo). */
const haloAlpha = (rules, e) => { const v = customs(rules, e).get("--_sl-halo"); return value(rules, e, v.slice(v.indexOf("color-mix(")), BLACK).alpha; };

test("every focusable workbench piece takes the shared flush ring and its halo, with no !important", () => {
  for (const ctx of [dark, hc]) {
    const at = mount(ctx);
    const tree = el({ tag: "ul", classes: ["sl-tree"], states: ["focus-within"], parent: at });
    const cases = {
      "activity item": el({ tag: "button", classes: ["sl-activitybar__item"], states: ["focus-visible"], parent: at }),
      "current activity item": el({ tag: "button", classes: ["sl-activitybar__item"], attrs: { "aria-current": "true" }, states: ["focus-visible"], parent: at }),
      "tree row": el({ tag: "li", classes: ["sl-tree__row"], states: ["focus-visible"], parent: tree }),
      "selected tree row": el({ tag: "li", classes: ["sl-tree__row"], attrs: { "aria-selected": "true" }, states: ["focus-visible"], parent: tree }),
      "palette input": el({ tag: "input", classes: ["sl-field__input", "sl-palette__input"], states: ["focus", "focus-visible"], parent: at }),
      "toast dismiss": el({ tag: "button", classes: ["sl-icon-btn", "sl-toast__dismiss"], states: ["focus-visible"], parent: at }),
    };
    for (const [name, e] of Object.entries(cases)) {
      const won = cascaded(ctx.rules, e);
      const env = customs(ctx.rules, e);
      assert.equal(won.get("outline").value, "var(--sl-focus-ring-width, 2px) solid var(--slc-focus)", `${ctx.name} ${name}: the shared ring`);
      assert.equal(px(won.get("outline-offset").value, env), 0, `${ctx.name} ${name}: flush, no gap`);
      assert.equal(won.get("box-shadow").value, "var(--_sl-depth, 0 0 transparent), var(--_sl-halo, 0 0 transparent)", `${ctx.name} ${name}: depth, then the halo`);
      assert.ok(!won.get("box-shadow").important && !won.get("outline").important, `${ctx.name} ${name}: no !important`);
      if (won.has("border-color")) assert.equal(won.get("border-color").value, "var(--slc-focus)", `${ctx.name} ${name}: the border joins the ring`);
      const a = haloAlpha(ctx.rules, e);
      assert.ok(Math.abs(a - (ctx === hc ? 0 : 0.22)) < 1e-9, `${ctx.name} ${name}: halo ${a}`);
    }
    // a selected row keeps its tile under the ring: the depth is the row's own
    assert.equal(customs(ctx.rules, cases["selected tree row"]).get("--_sl-depth"), customs(ctx.rules, cases["selected tree row"]).get("--slc-depth-tile"));
    assert.equal(customs(ctx.rules, cases["current activity item"]).get("--_sl-depth"), customs(ctx.rules, cases["current activity item"]).get("--slc-depth-flat"));
  }
});

// ── heights on the 4px grid ─────────────────────────────────────────────────

test("a tree row, a palette row and an activity item sit on the 4px grid, and their line fits", () => {
  const p = build(dark);
  for (const [name, e, want] of [["tree row", p["tree row"], 24], ["selected tree row", p["tree selected"], 24], ["palette row", p["palette row"], 36], ["selected palette row", p["palette selected"], 36], ["activity item", p["activity item"], 36]]) {
    const h = declaredHeight(RULES_A, e);
    assert.equal(h, want, name);
    assert.equal(h % 4, 0, `${name} on the 4px grid`);
    assert.equal(cascaded(RULES_A, e).get("box-sizing").value, "border-box", `${name}: the height is the whole row`);
  }
  // the tree row's line inside its own height
  const row = box(RULES_A, p["tree row"]);
  assert.ok(row.line <= 24, `tree line ${row.line}`);
  // the palette input is the kit's field: 32px
  assert.equal(box(RULES_A, p["palette input"]).height, 32);
});

// ── the activity bar ────────────────────────────────────────────────────────

test("the activity bar's glyphs are borderless chrome, the current one a flat tile with the nav item's seam", () => {
  const p = build(dark);
  const item = cascaded(RULES_A, p["activity item"]);
  assert.equal(item.get("border").value, "0", "the owner-approved exception to the one control edge");
  assert.equal(item.get("background-color").value, "transparent");
  for (const name of ["activity current", "activity tab"]) {
    const won = cascaded(RULES_A, p[name]);
    assert.equal(won.get("background-color").value, "var(--slc-tile)", name);
    assert.equal(won.get("background-image").value, "linear-gradient(var(--slc-seam), var(--slc-seam))", name);
    assert.equal(won.get("background-size").value, "2px 50%", name);
    assert.equal(won.get("background-position").value, "3px 50%", name);
    assert.equal(customs(RULES_A, p[name]).get("--_sl-depth"), customs(RULES_A, p[name]).get("--slc-depth-flat"), `${name}: a flat tile`);
  }
  // the seam is the nav item's own (components.css), not a second recipe
  const nav = rule(CO, ".sl-nav__item[aria-current]");
  for (const prop of ["background-image", "background-size", "background-position"]) {
    assert.equal(decl(nav, prop), cascaded(RULES_A, p["activity current"]).get(prop).value, prop);
  }
  // hover is a flat wash and keeps the seam's layer
  assert.equal(cascaded(RULES_A, p["activity hovered"]).get("background-color").value, "color-mix(in srgb, var(--slc-text) 5%, transparent)");
  assert.equal(cascaded(RULES_A, p["activity hovered"]).get("box-shadow").value, "var(--_sl-depth)");
});

// ── the tree ────────────────────────────────────────────────────────────────

test("tree selection: a raised tile while the tree has the focus, a flat tile while it does not", () => {
  const p = build(dark);
  const sel = p["tree selected"], focused = p["tree selected, focused"];
  assert.equal(customs(RULES_A, sel).get("--_sl-depth"), customs(RULES_A, sel).get("--slc-depth-flat"), "unfocused: flat, no cast");
  assert.equal(customs(RULES_A, focused).get("--_sl-depth"), customs(RULES_A, focused).get("--slc-depth-tile"), "focused: the tile, cast and all");
  for (const e of [sel, focused]) assert.equal(cascaded(RULES_A, e).get("background-color").value, "var(--slc-tile)");
  assert.equal(cascaded(RULES_A, p["tree selected icon, focused"]).get("color").value, "var(--slc-accent-text)", "focused: the icon in the accent");
  assert.equal(cascaded(RULES_A, p["tree selected icon"]).get("color").value, "var(--slc-text-muted)", "unfocused: the icon keeps the muted ink");
  // high contrast rings either in the accent
  const h = build(hc);
  assert.equal(customs(RULES_A, h["tree selected"]).get("--_sl-depth"), `0 0 0 1px ${customs(RULES_A, h["tree selected"]).get("--slc-accent")}`);
});

test("tree rows indent by their level, a guide under each ancestor's twisty, and the twisty turns with aria-expanded", () => {
  const at = mount(dark);
  const tree = el({ tag: "ul", classes: ["sl-tree"], parent: at });
  const row = (level, attrs = {}) => el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": String(level), ...attrs }, parent: tree });
  // the level the CSS reads is the custom property the row writes beside aria-level
  const withLevel = (level, attrs) => { const r = row(level, attrs); r.attrs.set("style", `--sl-tree-level: ${level}`); return r; };
  const sheet = (level) => parse([`.sl-tree__row[aria-level="${level}"] { --sl-tree-level: ${level}; }`]);
  for (const level of [1, 2, 4]) {
    const r = withLevel(level);
    const rules = [...RULES_A, ...sheet(level)];
    const env = customs(rules, r);
    const won = cascaded(rules, r);
    const pad = px(won.get("padding-inline").value.match(/^calc\((.*)\) var/)[0].replace(/ var$/, ""), env);
    assert.equal(pad, 4 + (level - 1) * 16, `level ${level}: indent`);
    const [w] = won.get("background-size").value.split(/ (?![^(]*\))/);
    assert.equal(px(w, env), (level - 1) * 16, `level ${level}: one guide per ancestor`);
    assert.equal(px(won.get("background-position").value.split(/ (?![^(]*\))/)[0], env), 4 + 8, `level ${level}: the first guide under the first twisty's centre`);
    assert.match(won.get("background-image").value, /^repeating-linear-gradient\(90deg, var\(--slc-border-subtle\) 0 1px, transparent 1px 1rem\)$/);
  }
  const collapsed = el({ pseudo: "before", parent: el({ tag: "span", classes: ["sl-tree__twisty"], parent: row(1, { "aria-expanded": "false" }) }) });
  const expanded = el({ pseudo: "before", parent: el({ tag: "span", classes: ["sl-tree__twisty"], parent: row(1, { "aria-expanded": "true" }) }) });
  const leaf = el({ pseudo: "before", parent: el({ tag: "span", classes: ["sl-tree__twisty"], parent: row(2) }) });
  assert.equal(cascaded(RULES_A, collapsed).get("transform").value, "translateX(-1px) rotate(-45deg)", "points at the hidden children");
  assert.equal(cascaded(RULES_A, expanded).get("transform").value, "translateY(-1px) rotate(45deg)", "points down at the shown ones");
  assert.equal(cascaded(RULES_A, leaf).get("content"), undefined, "a leaf draws no chevron");
});

// ── the palette ─────────────────────────────────────────────────────────────

test("the palette floats, holds a seam on its top edge and never animates", () => {
  const p = build(dark);
  const won = cascaded(RULES_A, p.palette);
  assert.equal(won.get("border").value, "1px solid var(--slc-edge-raised)");
  assert.equal(won.get("box-shadow").value, "var(--slc-depth-float)");
  const seam = cascaded(RULES_A, p["palette seam"]);
  assert.equal(px(seam.get("inset-block-start").value, customs(RULES_A, p["palette seam"])), -1, "on the border, as the callout's tick is: no band between them");
  assert.equal(px(seam.get("height").value, customs(RULES_A, p["palette seam"])), 1);
  assert.equal(cascaded(RULES_A, p["palette selected"]).get("box-shadow").value, "var(--slc-depth-tile)");
  // no transition and no animation anywhere in the palette
  const pal = WB.filter((r) => /\.sl-palette/.test(r.selector));
  assert.ok(pal.length > 8);
  for (const r of pal) assert.doesNotMatch(r.body, /(?:^|;)\s*(transition|animation)[\w-]*\s*:(?!\s*none\s*(?:;|$))/, r.selector);
  for (const name of ["palette", "palette row", "palette selected"]) assert.equal(cascaded(RULES_A, p[name]).get("transition"), undefined, `${name} transitions`);
  // the field's own colour transitions stand down too: its ring must not fade in as the palette appears
  assert.equal(cascaded(RULES_A, p["palette input"]).get("transition").value, "none");
  // the input is the kit's sunken field
  const input = cascaded(RULES_A, p["palette input"]);
  assert.equal(input.get("background").value, "var(--slc-sunken)");
  assert.equal(customs(RULES_A, p["palette input"]).get("--_sl-depth"), customs(RULES_A, p["palette input"]).get("--slc-depth-sunk"));
});

test("a palette match is never only a colour: heavier and underlined in the accent", () => {
  const p = build(dark);
  const m = cascaded(RULES_A, p["palette match"]);
  assert.equal(m.get("font-weight").value, "600");
  assert.equal(m.get("text-decoration-line").value, "underline");
  assert.equal(m.get("text-decoration-color").value, "var(--slc-accent-text)");
  assert.equal(m.get("color").value, "inherit");
  assert.equal(m.get("background-color").value, "transparent");
});

// ── the terminal block ──────────────────────────────────────────────────────

test("the exit mark: success at 0, the danger at any other code, nothing while running", () => {
  const p = build(dark);
  const ink = (name) => toHex(colorOf(RULES_A, p[name]));
  const tone = (role) => toHex(value(RULES_A, p["term exit 0"], `var(${role})`, BLACK));
  assert.equal(cascaded(RULES_A, p["term running mark"]).get("content"), undefined, "a running block has no mark");
  for (const [exit, role] of [["exit 0", "--slc-success"], ["exit 1", "--slc-danger"], ["exit 127", "--slc-danger"]]) {
    const won = cascaded(RULES_A, p[`term ${exit} mark`]);
    assert.equal(won.get("content").value, '""', exit);
    assert.equal(toHex(value(RULES_A, p[`term ${exit} mark`], won.get("background-color").value, BLACK)), tone(role), `${exit}: the mark`);
    assert.equal(ink(`term ${exit} exit`), tone(role), `${exit}: the exit text says it in the same ink`);
  }
  assert.equal(ink("term running exit"), ink("term running meta"), "a running block's exit text keeps the meta's ink");
  // the product's coding mono where it sets one, the kit's otherwise
  assert.equal(cascaded(RULES_A, p["term exit 0"]).get("font-family").value, "var(--sl-font-code, var(--sl-font-mono, ui-monospace, monospace))");
  assert.equal(cascaded(RULES_A, p["term exit 0"]).get("box-shadow").value, "var(--slc-depth-island)");
});

// ── ARIA, as the catalog writes it ───────────────────────────────────────────

test("the catalog's workbench markup carries its roles and states", () => {
  const md = readFileSync(resolve(KIT, "agent/catalog.md"), "utf8");
  const section = (h) => { const at = md.indexOf(h); assert.ok(at > -1, h); return md.slice(at, md.indexOf("\n### ", at + 1)); };
  const tree = section("### Tree — `sl-tree`");
  for (const a of ['role="tree"', 'role="treeitem"', "aria-level=", "aria-expanded=", "aria-selected=", 'tabindex="0"', 'tabindex="-1"', "--sl-tree-level"]) assert.ok(tree.includes(a), `tree: ${a}`);
  const pal = section("### Palette — `sl-palette`");
  for (const a of ['role="combobox"', "aria-activedescendant=", 'role="listbox"', 'role="option"', 'aria-selected="true"', 'role="group"']) assert.ok(pal.includes(a), `palette: ${a}`);
  const act = section("### Activity bar — `sl-activitybar`");
  for (const a of ["aria-label=", "aria-current="]) assert.ok(act.includes(a), `activity bar: ${a}`);
  const toast = section("### Toast — `sl-toast-stack`");
  for (const a of ['aria-live="polite"', 'role="status"', 'role="alert"']) assert.ok(toast.includes(a), `toast: ${a}`);
  assert.match(section("### Status bar — `sl-statusbar`"), /Don't: put `role="status"` on the bar/);
});

// ── forced colours: selection is the system's ──────────────────────────────

test("forced colours: a current activity item, a selected row and the palette's seam are system colours", () => {
  const fc = parseSheet(read("workbench.css"), { forcedColors: true });
  const at = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) });
  for (const e of [el({ classes: ["sl-activitybar__item"], attrs: { "aria-current": "true" }, parent: at }), el({ classes: ["sl-tree__row"], attrs: { "aria-selected": "true" }, parent: at }), el({ classes: ["sl-palette__row"], attrs: { "aria-selected": "true" }, parent: at })]) {
    const won = cascaded(fc, e);
    assert.equal(won.get("background").value, "Highlight");
    assert.equal(won.get("color").value, "HighlightText");
    assert.ok(won.get("background").important && won.get("color").important);
    assert.equal(won.get("forced-color-adjust").value, "none");
  }
  assert.equal(cascaded(fc, el({ pseudo: "before", parent: el({ classes: ["sl-palette"], parent: at }) })).get("background").value, "Highlight");
  // opting out is inherited: what a selected result holds in page colours takes the system's back
  const row = el({ classes: ["sl-palette__row"], attrs: { "aria-selected": "true" }, parent: at });
  assert.equal(cascaded(fc, el({ tag: "kbd", classes: ["sl-kbd"], parent: el({ classes: ["sl-palette__keys"], parent: row }) })).get("forced-color-adjust").value, "auto", "a keycap in it is forced again");
  const mark = cascaded(fc, el({ tag: "mark", parent: el({ classes: ["sl-palette__label"], parent: row }) }));
  assert.equal(mark.get("text-decoration-color").value, "HighlightText");
  assert.ok(mark.get("text-decoration-color").important);
  for (const child of ["svg", "sl-tree__twisty", "sl-palette__meta"]) {
    const e = child === "svg" ? el({ tag: "svg", parent: row }) : el({ classes: [child], parent: row });
    assert.equal(cascaded(fc, e).get("color").value, "HighlightText", child);
  }
});
