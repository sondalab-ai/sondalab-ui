import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate, fromSrgb, gamutExcess, substitute, toHex, toSrgb } from "./lib/css-color.mjs";
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
/** The numbers a Tier B layer cannot read off its colours, taken from the
 *  README's light- and dark-layer recipes, so a recipe that drops one fails here. */
const README_TEXT = readFileSync(resolve(KIT, "README.md"), "utf8");
const LAYER_NUMBERS = Object.fromEntries(["light", "dark"].map((t) => {
  const block = README_TEXT.match(new RegExp(`\`\`\`css\\n:root\\[data-theme="${t}"\\] \\{\\n([\\s\\S]*?)\\}\\n\`\`\``));
  assert.ok(block, `the README's ${t}-layer recipe`);
  return [t, Object.fromEntries([...block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))];
}));
const tierB = () => PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
  const n = NEUTRALS[p][t];
  const map = {
    "--slc-accent": REGISTRY[p][t], "--slc-canvas": n["bg-canvas"], "--slc-surface": n["bg-surface"], "--slc-raised": n["bg-surface-raised"],
    "--slc-overlay": n["bg-overlay"], "--slc-text": n["text-primary"], "--slc-text-secondary": n["text-secondary"], "--slc-text-muted": n["text-muted"],
    "--slc-border": n["border-default"], "--slc-border-subtle": n["border-subtle"], "--slc-border-strong": n["border-strong"], "--slc-focus": REGISTRY[p][t],
    ...Object.fromEntries(["success", "warning", "danger", "info"].map((s) => [`--slc-${s}`, STATUS[t][s]])),
    ...LAYER_NUMBERS[t],
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
    { name: `${t} ${p} Tier B band`, rules: RULES_B, attrs: { "data-theme": t, "data-product": p }, band: true },
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
  const raw = won.get("background-image")?.value ?? won.get("background")?.value;
  const img = raw && substitute(raw, customs(rules, p));
  const first = img && /gradient\(/.test(img) ? splitTop(img)[0] : null;
  const stops = first
    ? splitTop(first.slice(first.indexOf("(") + 1, first.lastIndexOf(")"))).filter((s) => !/^-?[\d.]+deg$|^to /.test(s)).map((s) => s.replace(/\s+-?[\d.]+%$/, ""))
    : [won.get("background-color")?.value ?? raw];
  return Math.max(...stops.map((s) => ratio(over(value(rules, p, s, colorOf(rules, p)), g), g)));
}
/** The seam of a selected or current tile (components.css, THE SEAM): its
 *  ink, evaluated on the tile (currentColor its own colour), against the
 *  tile's fill composited on its ground. The rule must be the shared one. */
function seamContrast(rules, e) {
  const img = cascaded(rules, e).get("background-image")?.value;
  assert.equal(img, "linear-gradient(var(--_sl-seam-ink), var(--_sl-seam-ink)), var(--_sl-layer)", "the shared seam");
  const g = groundOf(rules, e), around = groundOf(rules, e.parent);
  const ink = value(rules, e, "var(--_sl-seam-ink)", colorOf(rules, e));
  // against the tile it sits in, and against the ground around the tile
  return Math.min(ratio(over(ink, g), g), ratio(over(ink, around), around));
}
/** A value's top-level words (spaces inside parentheses do not split). */
function words(v) {
  const out = []; let d = 0, cur = "";
  for (const ch of v) { if (ch === "(") d++; if (ch === ")") d--; if (ch === " " && d === 0) { if (cur) out.push(cur); cur = ""; } else cur += ch; }
  if (cur) out.push(cur);
  return out;
}
/** Tags of an HTML snippet: [{ tag, classes, attrs, ancestors }], in order. */
function parseTags(html) {
  const VOID = new Set(["input", "br", "img", "meta", "link", "hr", "path", "circle", "rect"]);
  const out = [], stack = [];
  for (const m of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*?)(\/?)>/gi)) {
    const [, close, tag, rest, self] = m;
    if (close) { const i = stack.map((t) => t.tag).lastIndexOf(tag); if (i > -1) stack.length = i; continue; }
    const attrs = {};
    for (const a of rest.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? "";
    const t = { tag, attrs, classes: (attrs.class ?? "").split(/\s+/).filter(Boolean), ancestors: [...stack] };
    out.push(t);
    if (!self && !VOID.has(tag)) stack.push(t);
  }
  return out;
}
function splitTop(t) {
  const out = []; let d = 0, f = 0;
  for (let i = 0; i <= t.length; i++) { const ch = t[i]; if (ch === "(") d++; else if (ch === ")") d--; else if ((ch === "," && d === 0) || i === t.length) { out.push(t.slice(f, i).trim()); f = i + 1; } }
  return out;
}

// ── the pieces ─────────────────────────────────────────────────────────────

/** Each primitive mounted where it lives, as the mock tree a consumer's
 *  markup makes. Returns { name: element } for the pieces read below. */
const TERM_ROLES = ["prompt", "ok", "warn", "err", "dim", "accent"];
const EXITS = [["running", {}], ["exit 0", { "data-exit": "0" }], ["exit 1", { "data-exit": "1" }], ["exit 127", { "data-exit": "127" }], ["cancelled", { "data-exit": "cancelled" }], ["unknown", { "data-exit": "" }]];
const BUILD = {
  pane(at) {
    const pane = el({ tag: "section", classes: ["sl-pane"], parent: at });
    const lit = el({ tag: "section", classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: at });
    return { pane, lit, seam: el({ pseudo: "before", parent: lit }), "text in a pane": el({ tag: "p", parent: pane }), "text in the lit pane": el({ tag: "p", parent: lit }) };
  },
  statusbar(at) {
    const bar = el({ tag: "footer", classes: ["sl-statusbar"], parent: at });
    const item = el({ tag: "span", classes: ["sl-statusbar__item"], parent: bar });
    return { bar, "status item": item, "status value": el({ tag: "span", classes: ["sl-statusbar__value"], parent: item }), dot: el({ tag: "span", classes: ["sl-statusbar__dot"], parent: item }), sep: el({ tag: "span", classes: ["sl-statusbar__sep"], parent: bar }) };
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
      palette: pal, "palette seam": el({ pseudo: "before", parent: pal }), "palette head": head,
      "palette input": el({ tag: "input", classes: ["sl-field__input", "sl-palette__input"], attrs: { role: "combobox" }, parent: head }),
      "palette group": el({ tag: "p", classes: ["sl-palette__group"], parent: group }),
      "palette row": row, "palette label": label, "palette match": el({ tag: "mark", parent: label }), "palette meta": el({ tag: "span", classes: ["sl-palette__meta"], parent: row }), "palette icon": el({ tag: "svg", parent: row }),
      "palette selected": sel, "palette selected label": selLabel, "palette selected match": el({ tag: "mark", parent: selLabel }), "palette selected meta": el({ tag: "span", classes: ["sl-palette__meta"], parent: sel }), "palette selected icon": el({ tag: "svg", parent: sel }),
      "palette key": el({ tag: "kbd", classes: ["sl-kbd"], parent: el({ tag: "span", classes: ["sl-palette__keys"], parent: row }) }),
      "palette foot": foot, "palette foot match": el({ tag: "mark", parent: foot }),
    };
  },
  term(at, ctx) {
    const out = {};
    for (const [exit, attrs] of EXITS) {
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
        // The terminal roles (0.40), read inside the output of one block per
        // place: the six role spans, the inverse title, and a selected row
        // with its seam, its plain cells and a glyph in it.
        if (exit !== "running") continue;
        const output = out[`term ${k} output`];
        for (const role of TERM_ROLES) out[`term role ${role}${where}`] = el({ tag: "span", classes: [`sl-term-block__${role}`], parent: output });
        out[`term inverse${where}`] = el({ tag: "span", classes: ["sl-term-block__inverse"], parent: output });
        const sel = el({ tag: "span", classes: ["sl-term-block__sel"], parent: output });
        Object.assign(out, {
          [`term sel cells${where}`]: el({ tag: "span", parent: sel }),
          [`term sel seam${where}`]: el({ tag: "span", classes: ["sl-term-block__prompt"], parent: sel }),
          [`term sel glyph${where}`]: el({ tag: "span", classes: ["sl-term-block__ok"], parent: sel }),
          [`term spinner${where}`]: el({ tag: "span", classes: ["sl-term-block__spin"], attrs: { "aria-hidden": "true" }, parent: output }),
        });
      }
    }
    return out;
  },
  toast(at) {
    const stack = el({ classes: ["sl-toast-stack"], parent: at });
    const polite = el({ classes: ["sl-toast-stack__live"], attrs: { "aria-live": "polite" }, parent: stack });
    const out = { "toast stack": stack };
    for (const tone of [null, "info", "success", "warning", "danger"]) {
      const t = el({ classes: ["sl-toast", ...(tone ? [`sl-toast--${tone}`] : [])], parent: polite });
      const content = el({ classes: ["sl-toast__content"], parent: t });
      const key = tone ?? "neutral";
      out[`toast ${key}`] = t;
      out[`toast ${key} title`] = el({ tag: "p", classes: ["sl-toast__title"], parent: content });
      out[`toast ${key} body`] = el({ tag: "p", classes: ["sl-toast__body"], parent: content });
      out[`toast ${key} mark`] = el({ tag: "span", classes: ["sl-toast__mark"], parent: t });
      out[`toast ${key} tick`] = el({ pseudo: "before", parent: t });
      out[`toast ${key} dismiss`] = el({ tag: "button", classes: ["sl-icon-btn", "sl-toast__dismiss"], parent: t });
      const timer = el({ classes: ["sl-progress", "sl-toast__timer"], attrs: { role: "progressbar" }, parent: t });
      out[`toast ${key} timer`] = timer;
      out[`toast ${key} timer bar`] = el({ tag: "span", classes: ["sl-progress__bar"], parent: timer });
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
  ["status value", 4.5, "text"],
  ["dot", 3, "fill"],
  ["activity glyph", 3, "text"],
  ["activity hovered", 3, "text"],
  ["activity current glyph", 3, "text"],
  ["activity current", 3, "seam"],
  ["activity tab", 3, "seam"],
  ["activity tab glyph", 3, "text"],
  ...["", " in the lit pane"].flatMap((w) => ["", ", focused"].flatMap((f) => [
    [`tree label${w}${f}`, 4.5, "text"],
    [`tree twisty${w}${f}`, 3, "text"],
    [`tree icon${w}${f}`, 3, "text"],
    [`tree selected label${w}${f}`, 4.5, "text"],
    [`tree selected icon${w}${f}`, 3, "text"],
  ])),
  ["tree chevron", 3, "border"],
  ["palette seam", 3, "mark"],
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
  ["palette foot match", 4.5, "text"],
  ...EXITS.map(([x]) => x).flatMap((x) => ["", " in the lit pane"].flatMap((w) => [
    [`term ${x}${w} command`, 4.5, "text"],
    [`term ${x}${w} prompt`, 4.5, "text"],
    [`term ${x}${w} meta`, 4.5, "text"],
    [`term ${x}${w} exit`, 4.5, "text"],
    [`term ${x}${w} output`, 4.5, "text"],
    ...(x === "running" || x === "unknown" ? [] : [[`term ${x}${w} mark`, 3, "mark"]]),
  ])),
  // Every terminal role is text, dim included: 4.5:1 on the block's own fill
  // (raised, sunken in a lit pane, the band's ground in a band).
  ...["", " in the lit pane"].flatMap((w) => [
    ...TERM_ROLES.map((r) => [`term role ${r}${w}`, 4.5, "text"]),
    [`term inverse${w}`, 4.5, "text"],
    [`term sel cells${w}`, 4.5, "text"],
    [`term sel seam${w}`, 4.5, "text"],
    [`term sel glyph${w}`, 4.5, "text"],
    [`term spinner${w}`, 4.5, "text"],
  ]),
  ...["neutral", "info", "success", "warning", "danger"].flatMap((t) => [
    [`toast ${t} title`, 4.5, "text"],
    [`toast ${t} body`, 4.5, "text"],
    [`toast ${t} mark`, 4.5, "text"],
    [`toast ${t} tick`, 3, "mark"],
    [`toast ${t} timer bar`, 3, "fill"],
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
      const r = how === "text" ? textContrast(ctx.rules, e) : how === "mark" ? markContrast(ctx.rules, e) : how === "border" ? borderContrast(ctx.rules, e) : how === "layer" ? markContrast(ctx.rules, e, e) : how === "seam" ? seamContrast(ctx.rules, e) : fillContrast(ctx.rules, e);
      if (!(r >= min)) low.push(`${name} ${r.toFixed(2)} < ${min}`);
    }
    assert.deepEqual(low, []);
  });
}

test("terminal dim in a band is the band's muted share of the band's ink", () => {
  const band = COMPONENTS.match(/\.sl-invert > \*\s*\{([^}]*)\}/)[1];
  const share = band.match(/--slc-text-muted:\s*color-mix\(in srgb, currentColor (\d+)%, transparent\)/)[1];
  assert.equal(decl(rule(WB, ".sl-invert .sl-term-block__dim"), "color"), `color-mix(in srgb, var(--slc-text) ${share}%, transparent)`);
});

// The terminal roles' floor over every context, reported as a diagnostic so a
// release note quotes measured figures (node --test prints it).
test("terminal roles: the lowest reading of each over every context", (t) => {
  const pieces = [...TERM_ROLES.map((r) => `term role ${r}`), "term inverse", "term sel cells", "term sel seam", "term sel glyph"];
  const low = Object.fromEntries(pieces.map((p) => [p, [Infinity, ""]]));
  for (const ctx of CONTEXTS) {
    const built = build(ctx);
    for (const p of pieces) for (const w of ["", " in the lit pane"]) {
      const r = textContrast(ctx.rules, built[`${p}${w}`]);
      if (r < low[p][0]) low[p] = [r, `${ctx.name}${w}`];
    }
  }
  for (const [p, [r, where]] of Object.entries(low)) {
    t.diagnostic(`${p}: ${r.toFixed(2)} (${where})`);
    assert.ok(r >= 4.5, `${p} ${r.toFixed(2)} in ${where}`);
  }
});

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
  // 0.34, as Lumen renders it: the seam's light falls below the pane (the
  // drop), not round it; no accent rim (owner, 2026-10-05)
  assert.equal(l.get("box-shadow").value, "var(--slc-depth-island), var(--slc-lit-drop)");
});

test("the lit pane's seam and glow spend --slc-glow, which is 0 in high contrast", () => {
  const glowAlpha = (ctx) => {
    const { lit } = build(ctx);
    const v = substitute(cascaded(RULES_A, lit).get("box-shadow").value, customs(RULES_A, lit));
    const at = v.indexOf("color-mix(");
    return at < 0 ? 0 : value(RULES_A, lit, v.slice(at), BLACK).alpha;
  };
  assert.ok(Math.abs(glowAlpha(dark) - 0.2) < 1e-9, `dark ${glowAlpha(dark)}`);
  assert.ok(Math.abs(glowAlpha(CONTEXTS.find((c) => c.name === "light default")) - 0.14) < 1e-9);
  assert.equal(glowAlpha(hc), 0);
  // in high contrast the island is a drawn ring in the theme's own line
  const { lit } = build(hc);
  const env = customs(RULES_A, lit);
  assert.equal(env.get("--slc-depth-island"), `0 0 0 1px ${env.get("--slc-border")}`);
});

// ── the lit pane as it renders (0.34) ─────────────────────────────────────

// Lumen's IDE screen, rendered (owner, 2026-10-05: "as rendered", no 46%
// rim): the seam along the top edge, a radial wash on the tab strip or head,
// a 7% tint on the breadcrumbs row and a glow that falls below the pane.
// Three roles carry the last three, so a product spends them on its own
// chrome without a literal; each reads --slc-glow (0 in high contrast and
// under forced colours, where they are also remapped to nothing).
const LIT = {
  "--slc-lit-wash": { kind: "image", peak: 0.416 },
  "--slc-lit-tint": { kind: "image", peak: 0.07 },
  "--slc-lit-drop": { kind: "shadow", peak: 0.4 },
};
/** The colour stops of a role's first gradient, or its shadow's colour. */
function litColours(rules, e, role) {
  const v = substitute(`var(${role})`, customs(rules, e)).trim();
  if (v === "none" || v === "0 0 transparent") return [];
  if (LIT[role].kind === "shadow") return [value(rules, e, v.slice(v.indexOf("color-mix(")), BLACK)];
  const inner = v.slice(v.indexOf("(") + 1, v.lastIndexOf(")"));
  return splitTop(inner).filter((s) => /^(color-mix|transparent)/.test(s)).map((s) => value(rules, e, s.replace(/\s+[\d.]+%$/, ""), BLACK));
}

test("the lit roles are the rendered recipes, on every theme, at --slc-glow's strength", () => {
  for (const [ctx, glow] of [[dark, 0.5], [CONTEXTS.find((c) => c.name === "light default"), 0.35], [CONTEXTS.find((c) => c.name === "light spexr"), 0.35]]) {
    const { lit } = build(ctx);
    for (const [role, { peak }] of Object.entries(LIT)) {
      const cols = litColours(RULES_A, lit, role);
      assert.ok(cols.length > 0, `${ctx.name} ${role}`);
      const top = Math.max(...cols.map((c) => c.alpha));
      assert.ok(Math.abs(top - glow * peak) < 1e-9, `${ctx.name} ${role}: peak ${top}, want ${glow * peak}`);
      // the seam's own colour at the peak; the wash's is capped at oklch L
      // 0.65 at 80% of Lumen's strength, so no seam can lift the ground under
      // a muted label in the strip below 4.5:1, wherever the label sits
      const seam = toHex(value(RULES_A, lit, role === "--slc-lit-wash" ? "oklch(from var(--slc-seam) min(l, 0.65) calc(c * min(1, 0.65 / l)) h)" : "var(--slc-seam)", BLACK));
      assert.equal(toHex({ ...cols.find((c) => c.alpha === top), alpha: 1 }), seam, `${ctx.name} ${role}: the seam's hue`);
    }
  }
  // on paper the seam is the accent as text (L <= 0.46), which the cap leaves alone
  const { lit: paper } = build(CONTEXTS.find((c) => c.name === "light spexr"));
  const peak = litColours(RULES_A, paper, "--slc-lit-wash").reduce((a, b) => (b.alpha > a.alpha ? b : a));
  assert.equal(toHex({ ...peak, alpha: 1 }), toHex(value(RULES_A, paper, "var(--slc-seam)", BLACK)), "light spexr: the seam's own colour");
  // the wash is radial, peaking toward the seam's leading end, gone by 78%
  const env = customs(RULES_A, build(dark).lit);
  assert.match(substitute("var(--slc-lit-wash)", env), /^radial-gradient\(80% 100% at 30% 0%, color-mix\(in srgb, oklch\(from .+ min\(l, 0\.65\) calc\(c \* min\(1, 0\.65 \/ l\)\) h\) .+\), transparent 78%\)$/);
  assert.match(substitute("var(--slc-lit-tint)", env), /^linear-gradient\(color-mix\(.+\), transparent\)$/);
});

test("the drop is one shadow a product can wear outward on the pane or inward below it", () => {
  const { lit } = build(dark);
  const drop = substitute("var(--slc-lit-drop)", customs(RULES_A, lit));
  assert.equal(splitTop(drop).length, 1, "one shadow, so `inset var(--slc-lit-drop)` is one shadow too");
  const [x, y, blur, spread] = words(drop).slice(0, 4).map((w) => px(w, new Map()));
  assert.deepEqual([x, y, blur, spread], [0, 18, 30, -18], "Lumen's 0 18px 30px -18px");
  // Worn outward the shadow's shape ends at the pane's bottom edge (offset +
  // spread = 0), so the glow starts at that edge and falls 30px below it.
  // Worn inward (inset) by the element right under the pane, the shape's
  // outside starts at that element's top edge: the same falloff, from the
  // same line, inside a box a clipping parent cannot cut (spexr's split
  // handle, under Lumino's contain: strict).
  assert.equal(y + spread, 0);
});

test("the lit roles are nothing in high contrast and under forced colours, and the band re-derives them", () => {
  const { lit } = build(hc);
  for (const role of Object.keys(LIT)) assert.deepEqual(litColours(RULES_A, lit, role).filter((c) => c.alpha > 0), [], `high contrast ${role}`);
  const env = customs(RULES_A, el({ tag: "html", attrs: { "data-sl-theme": "high-contrast" } }));
  assert.equal(env.get("--slc-lit-wash"), "none");
  assert.equal(env.get("--slc-lit-tint"), "none");
  assert.equal(env.get("--slc-lit-drop"), "0 0 transparent", "never none: it joins a box-shadow list");
  const fc = parseSheet(read("components.css"), { forcedColors: true });
  for (const [name, e] of [["root", el({ tag: "html", attrs: { "data-sl-theme": "dark" } })], ["pane", el({ classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) }) })]]) {
    const v = customs(fc, e);
    assert.equal(v.get("--slc-lit-wash"), "none", `forced colours ${name}`);
    assert.equal(v.get("--slc-lit-drop"), "0 0 transparent", `forced colours ${name}`);
  }
  // in the band each role reads the band's own seam
  for (const ctx of CONTEXTS.filter((c) => c.band && !c.name.startsWith("high"))) {
    const at = mount(ctx);
    for (const role of Object.keys(LIT)) {
      const want = toHex(value(ctx.rules, at, role === "--slc-lit-wash" ? "oklch(from var(--slc-seam) min(l, 0.65) calc(c * min(1, 0.65 / l)) h)" : "var(--slc-seam)", BLACK));
      const cols = litColours(ctx.rules, at, role).filter((c) => c.alpha > 0);
      assert.ok(cols.length, `${ctx.name} ${role}`);
      assert.equal(toHex({ ...cols[0], alpha: 1 }), want, `${ctx.name} ${role}: the band's seam`);
    }
  }
});

test("the lit pane's seam stays 12px in, on the grid (Lumen's 10)", () => {
  const { lit } = build(dark);
  const env = customs(RULES_A, lit);
  const seam = cascaded(RULES_A, el({ pseudo: "before", parent: lit }));
  assert.equal(px(seam.get("inset-inline").value, env), 12);
});

// Chrome clips an out-of-gamut colour per channel, the test reader does not:
// the capped wash keeps the seam's chroma at a lower lightness, so every
// product's capped stop must lie in sRGB for the contrast below to be the
// one Chrome paints.
// The cap lowers the lightness and the chroma with it, toward black, as the
// kit's own steps do: a seam inside sRGB stays inside it (a light seam's own
// excess, the accent text a theme caps on paper or the band's floor lifts,
// is the seam's, documented with it, and the cap adds none).
test("the wash's capped colour adds no gamut excess to the seam's, and is in sRGB on ink", () => {
  const out = [];
  for (const ctx of CONTEXTS.filter((c) => c !== hc && !c.name.startsWith("high"))) {
    const at = mount(ctx);
    const e = ctx.band ? at : build(ctx).lit;
    const capped = gamutExcess(value(ctx.rules, e, "oklch(from var(--slc-seam) min(l, 0.65) calc(c * min(1, 0.65 / l)) h)", BLACK));
    const seam = gamutExcess(value(ctx.rules, e, "var(--slc-seam)", BLACK));
    if (capped > seam + 1e-4) out.push(`${ctx.name}: ${capped.toFixed(4)} over the seam's ${seam.toFixed(4)}`);
    if (ctx.name.startsWith("dark") && !ctx.band && capped > 1e-4) out.push(`${ctx.name}: ${capped.toFixed(4)} out of sRGB on ink`);
  }
  assert.deepEqual(out, []);
});

// Text on the lit chrome: a tab strip under the wash, a breadcrumbs row under
// the tint, every product and theme, read at each role's peak over the lit
// pane's fill -- the strip's top edge under the seam's leading end -- so a
// label reads wherever the product sets it in the strip.
test("text on the lit chrome reads at 4.5:1 where the wash and the tint peak", () => {
  const low = [];
  for (const ctx of CONTEXTS.filter((c) => !c.band)) {
    const { lit } = build(ctx);
    const fill = groundOf(ctx.rules, lit);
    for (const role of ["--slc-lit-wash", "--slc-lit-tint"]) {
      const cols = litColours(ctx.rules, lit, role);
      const peak = cols.length ? cols.reduce((a, b) => (b.alpha > a.alpha ? b : a)) : { lin: [0, 0, 0], alpha: 0 };
      const g = over(peak, fill);
      for (const ink of ["--slc-text", "--slc-text-secondary", "--slc-text-muted"]) {
        const r = ratio(over(value(ctx.rules, lit, `var(${ink})`, BLACK), g), g);
        if (!(r >= 4.5)) low.push(`${ctx.name} ${role} ${ink} ${r.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(low, []);
});

test("a section's accent reaches the lit roles of a pane in it", () => {
  const rules = [...RULES_A, ...parse(['[data-section] { --slc-accent: #1d63d8; }'])];
  const at = mount(dark);
  const lit = el({ tag: "section", classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: el({ tag: "section", attrs: { "data-section": "" }, parent: at }) });
  const want = toHex(value(rules, lit, "var(--slc-seam)", BLACK));
  assert.equal(want, toHex(evaluate("#1d63d8", new Map())));
  for (const role of Object.keys(LIT)) {
    const c = litColours(rules, lit, role).reduce((a, b) => (b.alpha > a.alpha ? b : a));
    assert.equal(toHex({ ...c, alpha: 1 }), want, role);
  }
});

// ── the status bar ─────────────────────────────────────────────────────────

test("the status bar keeps its own height: the items, a dot and a separator fit inside it", () => {
  for (const ctx of [dark, hc]) {
    const p = build(ctx);
    const bar = declaredHeight(ctx.rules, p.bar);
    assert.equal(bar, 28, "28px: Lumen's 30 on the 4px grid, the 0.33 height");
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

test("the status bar speaks as Lumen draws it: sentence case in the sans, data in the mono as written, no ground of its own", () => {
  const p = build(dark);
  const won = cascaded(RULES_A, p.bar);
  for (const [prop, v] of [["font-family", "var(--sl-font-sans, system-ui, sans-serif)"], ["font-size", "var(--sl-text-xs, 0.75rem)"], ["color", "var(--slc-text-muted)"], ["background-color", "transparent"]]) {
    assert.equal(won.get(prop)?.value, v, prop);
  }
  assert.equal(won.get("text-transform"), undefined, "never upper-cased: a branch is case-sensitive");
  assert.equal(won.get("letter-spacing"), undefined, "never tracked open");
  const value = cascaded(RULES_A, p["status value"]);
  assert.equal(value.get("font-family").value, "var(--sl-font-mono, ui-monospace, monospace)");
  assert.equal(value.get("color").value, "var(--slc-text)");
  assert.equal(value.get("text-transform"), undefined);
  // a fact that does not fit ends in an ellipsis: the item is a block, never a flex box
  const item = cascaded(RULES_A, p["status item"]);
  for (const [prop, v] of [["display", "block"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["min-width", "0"], ["flex", "0 1 auto"]]) assert.equal(item.get(prop)?.value, v, prop);
  // a separator is a border, which forced colours keep; a fill they repaint
  assert.equal(cascaded(RULES_A, p.sep).get("border-inline-start").value, "1px solid var(--slc-border)");
});

test("status items are 20px pills (Lumen's 22 on the grid, 4px above and below as in the demo): r6, a surface under the pointer where they do something, the bar 4px in at the start", () => {
  const ctxs = [dark, CONTEXTS.find((c) => c.name === "light default")];
  for (const ctx of ctxs) {
    const p = build(ctx);
    const env = customs(ctx.rules, p["status item"]);
    const bar = cascaded(ctx.rules, p.bar);
    assert.deepEqual(words(bar.get("padding-inline").value).map((w) => px(w, env)), [4, 8], "Lumen's 0 8 0 4");
    const item = cascaded(ctx.rules, p["status item"]);
    assert.equal(declaredHeight(ctx.rules, p["status item"]), 20);
    assert.equal(px(item.get("line-height").value, env), 20, "one line, centred in the pill");
    assert.equal(px(item.get("border-radius").value, env), 6);
    assert.equal(px(item.get("padding-inline").value, env), 8);
    // hovered, an item that does something (a button, a link) brings the
    // surface rung up under it in the primary ink, at 4.5:1; a fact does not
    // answer the pointer, so it promises nothing
    for (const [tag, attrs] of [["button", {}], ["a", { href: "#" }], ["span", { role: "button" }]]) {
      const hovered = el({ tag, attrs, classes: ["sl-statusbar__item"], states: ["hover"], parent: p.bar });
      const h = cascaded(ctx.rules, hovered);
      assert.equal(h.get("background-color").value, "var(--slc-surface)", `${tag}`);
      assert.equal(h.get("color").value, "var(--slc-text)");
      assert.equal(h.get("cursor")?.value, "pointer", `${tag}: a pointer`);
      assert.ok(textContrast(ctx.rules, hovered) >= 4.5, `${ctx.name} hovered item ${textContrast(ctx.rules, hovered).toFixed(2)}`);
    }
    const fact = cascaded(ctx.rules, el({ tag: "span", classes: ["sl-statusbar__item"], states: ["hover"], parent: p.bar }));
    assert.equal(fact.get("background-color").value, "transparent", "a fact under the pointer stays on the canvas");
    assert.equal(fact.get("cursor"), undefined);
    assert.equal(cascaded(ctx.rules, el({ tag: "a", attrs: { href: "#" }, classes: ["sl-statusbar__item"], parent: p.bar })).get("text-decoration")?.value, "none", "a link item is not underlined");
    assert.match(item.get("transition").value, /^color var\(--sl-motion-fast/);
  }
});

test("status separators are off unless the bar asks for them", () => {
  const at = mount(dark);
  const plain = el({ tag: "footer", classes: ["sl-statusbar"], parent: at });
  assert.equal(cascaded(RULES_A, el({ tag: "span", classes: ["sl-statusbar__sep"], parent: plain })).get("display").value, "none", "Lumen draws none");
  const ruled = el({ tag: "footer", classes: ["sl-statusbar", "sl-statusbar--separators"], parent: at });
  const sep = el({ tag: "span", classes: ["sl-statusbar__sep"], parent: ruled });
  assert.equal(cascaded(RULES_A, sep).get("display").value, "block");
  assert.equal(cascaded(RULES_A, sep).get("border-inline-start").value, "1px solid var(--slc-border)", "still a border, which forced colours keep");
});

test("the live dot breathes on the motion tokens, only where motion is wanted, never under forced colours", () => {
  const css = bare(read("workbench.css"));
  const dot = (flags) => cascaded(parseSheet(read("workbench.css"), flags), el({ classes: ["sl-statusbar__dot"], parent: el({ tag: "body", parent: el({ tag: "html" }) }) }));
  const on = dot({});
  assert.match(on.get("animation").value, /^sl-statusbar-breathe calc\(var\(--sl-motion-fast, 120ms\) \* 20\) var\(--sl-motion-enter, ease\) infinite$/, "2.4s, the arrival curve, as Lumen breathes it");
  assert.equal(dot({ reducedMotion: true }).get("animation"), undefined, "reduced motion: still");
  assert.equal(dot({ forcedColors: true }).get("animation").value, "none", "forced colours: the dot opts out, so a page-colour ring would paint");
  const frames = css.match(/@keyframes sl-statusbar-breathe \{([\s\S]*?\})\s*\}/)?.[1] ?? "";
  assert.match(frames, /0%, 100% \{ box-shadow: 0 0 0 0 color-mix\(in srgb, var\(--slc-accent-text\) 45%, transparent\); \}/);
  assert.match(frames, /50% \{ box-shadow: 0 0 0 4px color-mix\(in srgb, var\(--slc-accent-text\) 0%, transparent\); \}/);
  // the dot's own fill stays the accent as text: on paper the amber accent
  // itself reads 1.6:1, too faint for a state's mark
  assert.equal(on.get("background-color").value, "var(--slc-accent-text)");
  // the effects layer's switches hold it too: an opt-out region stops it,
  // and the app's pause (data-sl-fx-still on <html>) freezes it where it is
  const FX = parse([read("workbench.css"), read("effects.css")]);
  const html = (attrs) => el({ tag: "html", attrs });
  const off = el({ classes: ["sl-statusbar__dot"], parent: el({ attrs: { "data-sl-fx": "off" }, parent: el({ tag: "body", parent: html({}) }) }) });
  assert.equal(cascaded(FX, off).get("animation").value, "none", "in an opt-out region");
  assert.ok(cascaded(FX, off).get("animation").important);
  const self = el({ classes: ["sl-statusbar__dot"], attrs: { "data-sl-fx": "off" }, parent: el({ tag: "body", parent: html({}) }) });
  assert.equal(cascaded(FX, self).get("animation").value, "none", "opted out itself");
  const still = cascaded(FX, el({ classes: ["sl-statusbar__dot"], parent: el({ tag: "body", parent: html({ "data-sl-fx-still": "" }) }) }));
  assert.equal(still.get("animation-play-state").value, "paused", "held where it is");
  assert.ok(still.get("animation-play-state").important);
});

test("a status item that is a button takes the shared flush ring and its halo", () => {
  for (const ctx of [dark, hc]) {
    const at = mount(ctx);
    const item = el({ tag: "button", classes: ["sl-statusbar__item"], states: ["focus-visible"], parent: el({ tag: "footer", classes: ["sl-statusbar"], parent: at }) });
    const won = cascaded(ctx.rules, item);
    assert.equal(won.get("outline").value, "var(--sl-focus-ring-width, 2px) solid var(--slc-focus)");
    assert.equal(won.get("box-shadow").value, "var(--_sl-depth, 0 0 transparent), var(--_sl-halo, 0 0 transparent)");
    const rest = cascaded(ctx.rules, el({ tag: "button", classes: ["sl-statusbar__item"], parent: at }));
    for (const [prop, v] of [["appearance", "none"], ["border", "0"], ["font", "inherit"], ["color", "inherit"]]) assert.equal(rest.get(prop)?.value, v, `${ctx.name} ${prop}`);
  }
});

// ── the toast ──────────────────────────────────────────────────────────────

test("the toast floats on Lumen's cast, whose ring is its edge: no border, r12, Lumen's padding", () => {
  const p = build(dark);
  const won = cascaded(RULES_A, p["toast success"]);
  const env = customs(RULES_A, p["toast success"]);
  assert.equal(won.get("border").value, "0");
  assert.equal(won.get("box-shadow").value, "var(--slc-depth-cast)");
  assert.equal(won.get("background-color").value, "var(--slc-raised)");
  assert.equal(px(won.get("border-radius").value, env), 12);
  assert.deepEqual(words(won.get("padding-block").value).map((w) => px(w, env)), [12, 16], "Lumen's 12.8 / 14.4 on the grid");
  assert.deepEqual(words(won.get("padding-inline").value).map((w) => px(w, env)), [16, 12], "Lumen's 16 / 12.8 on the grid");
  // the stack lets the pointer through, a toast takes it
  assert.equal(cascaded(RULES_A, p["toast stack"]).get("pointer-events").value, "none");
  assert.equal(cascaded(RULES_A, p["toast success"]).get("pointer-events")?.value, "auto");
  assert.equal(cascaded(RULES_A, p["toast stack"]).get("z-index").value, "var(--sl-z-toast, 200)");
});

test("a toast stack can be a manual popover: the UA's popover box is undone, and a closed one stays hidden", () => {
  const at = mount(dark);
  for (const [name, attrs, states, display] of [["plain", {}, [], "flex"], ["popover, open", { popover: "manual" }, ["popover-open"], "flex"], ["popover, closed", { popover: "manual" }, [], "none"]]) {
    const stack = el({ classes: ["sl-toast-stack"], attrs, states, parent: at });
    const won = cascaded(RULES_A, stack);
    assert.equal(won.get("display").value, display, `${name}: display`);
    for (const [prop, v] of [["position", "fixed"], ["inset", "auto"], ["margin", "0"], ["padding", "0"], ["border", "0"], ["background", "transparent"], ["overflow", "visible"], ["color", "inherit"], ["height", "auto"]]) {
      assert.equal(won.get(prop)?.value, v, `${name}: ${prop}`);
    }
    assert.match(won.get("inset-block-end").value, /--sl-space-5/, `${name}: the corner, after the inset reset`);
    assert.ok(won.get("inset-block-end").order === won.get("inset").order, `${name}: in the same rule as the reset, so it follows it`);
  }
  // the reset follows the inset shorthand inside its own rule
  const body = rule(CO, ".sl-toast-stack");
  assert.ok(body.indexOf("inset: auto") < body.indexOf("inset-block-end"), "the shorthand first, the corner after it");
});

test("the toast stack holds two live regions side by side, and the toasts in them carry no role", () => {
  const md = readFileSync(resolve(KIT, "agent/catalog.md"), "utf8");
  const section = md.slice(md.indexOf("### Toast — `sl-toast-stack`"), md.indexOf("\n### ", md.indexOf("### Toast — `sl-toast-stack`") + 1));
  const html = section.match(/```html\n([\s\S]*?)```/)[1];
  const tags = parseTags(html);
  const live = tags.filter((t) => t.attrs["aria-live"] || ["alert", "status", "log"].includes(t.attrs.role));
  assert.deepEqual(live.map((t) => t.attrs["aria-live"] ?? t.attrs.role).sort(), ["alert", "polite"], "one polite region, one alert region");
  for (const t of live) {
    assert.ok(t.classes.includes("sl-toast-stack__live"), "each is a region of the stack");
    assert.ok(!t.ancestors.some((a) => a.attrs["aria-live"] || ["alert", "status", "log"].includes(a.attrs.role)), "no live region inside another");
  }
  for (const t of tags.filter((x) => x.classes.includes("sl-toast"))) assert.equal(t.attrs.role, undefined, "a toast carries no role: its region speaks");
  assert.ok(!tags.some((t) => ["section", "aside", "nav"].includes(t.tag) || t.attrs.role === "region"), "no landmark");
  const stack = tags.find((t) => t.classes.includes("sl-toast-stack"));
  assert.equal(stack.attrs.role, undefined);
  assert.equal(stack.attrs.popover, undefined, "the default stack shows without a script: a popover is the opt-in for a modal dialog");
  assert.match(section, /add `popover="manual"` to the stack and call `showPopover\(\)` once\. Without that call the popover stack stays hidden/);
});

test("a region is spaced only when it holds a toast, never hidden, and a re-shown popover takes its toast a frame later", () => {
  const regionRules = CO.filter((r) => r.selector.includes("sl-toast-stack__live"));
  for (const r of regionRules) {
    assert.doesNotMatch(r.body, /display:\s*(none|contents)/, `${r.selector}: a hidden region is not heard`);
    assert.doesNotMatch(r.selector, /:not\(:empty\)/, `${r.selector}: whitespace is content to :empty`);
  }
  assert.ok(regionRules.some((r) => r.selector === ".sl-toast-stack__live:has(> *) ~ .sl-toast-stack__live:has(> *)" && /margin-block-start/.test(r.body)));
  for (const doc of [readFileSync(resolve(KIT, "agent/catalog.md"), "utf8"), readFileSync(resolve(KIT, "README.md"), "utf8")]) {
    assert.match(doc, /Add the toast a frame later \(`requestAnimationFrame`\)/);
    assert.match(doc, /hidden live regions?/);
  }
});

test("each tone is the kit's status role: its band-safe ink where a band derives one, the role itself on the page", () => {
  for (const tone of ["info", "success", "warning", "danger"]) {
    assert.equal(decl(rule(CO, `.sl-toast--${tone}`), "--_sl-tone"), `var(--slc-${tone}-text, var(--slc-${tone}))`, tone);
  }
  const p = build(dark);
  for (const tone of ["success", "danger"]) {
    const mark = colorOf(RULES_A, p[`toast ${tone} mark`]);
    assert.equal(toHex(mark), toHex(value(RULES_A, p[`toast ${tone}`], `var(--slc-${tone})`, BLACK)), `${tone}: the page reads the status role`);
  }
});

test("the dismiss keeps the one control edge, at the icon button's 32px", () => {
  const p = build(dark);
  const d = p["toast success dismiss"];
  const won = cascaded(RULES_A, d);
  assert.equal(won.get("border").value, "1px solid var(--slc-edge-hairline)", "only the tab's close and the activity bar are borderless chrome");
  assert.equal(declaredHeight(RULES_A, d), 32, "Lumen's 32px (0.34; 24 before)");
  assert.equal(px(won.get("border-radius").value, customs(RULES_A, d)), 8);
});

test("the toast's tick is Lumen's: a 1px line of its tone from 16px in (Lumen's 14) to the middle, glowing", () => {
  for (const [ctx, glow] of [[dark, 0.5], [CONTEXTS.find((c) => c.name === "light default"), 0.5], [hc, 0]]) {
    const p = build(ctx);
    const tick = cascaded(ctx.rules, p["toast success tick"]);
    const env = customs(ctx.rules, p["toast success tick"]);
    assert.equal(px(tick.get("inset-block-start").value, env), 0, "on the top edge: there is no border to sit over");
    assert.deepEqual(words(tick.get("inset-inline").value).map((w) => (w.endsWith("%") ? w : px(w, env))), [16, "50%"]);
    assert.equal(px(tick.get("height").value, env), 1);
    assert.equal(tick.get("background-image").value, "linear-gradient(var(--_sl-seam-dir, 90deg), var(--_sl-tone), transparent)");
    const shadow = substitute(tick.get("box-shadow").value, env);
    const a = value(ctx.rules, p["toast success tick"], shadow.slice(shadow.indexOf("color-mix(")), BLACK).alpha;
    assert.ok(Math.abs(a - glow) < 1e-9, `${ctx.name}: glow ${a}, Lumen's 50% on both themes, none in high contrast`);
  }
});

test("the toast's mark is 24px (Lumen's 26) on a 16% wash of its tone, and its timer a 2px bar along the bottom", () => {
  const p = build(dark);
  const env = customs(RULES_A, p["toast success mark"]);
  const mark = cascaded(RULES_A, p["toast success mark"]);
  assert.equal(px(mark.get("width").value, env), 24);
  assert.equal(px(mark.get("height").value, env), 24);
  assert.equal(mark.get("background-color").value, "color-mix(in srgb, currentColor 16%, transparent)");
  const timer = cascaded(RULES_A, p["toast success timer"]);
  assert.equal(timer.get("position").value, "absolute");
  assert.equal(px(timer.get("inset-inline").value, env), 16);
  assert.equal(px(timer.get("inset-block-end").value, env), 0, "inside the edge: the toast has no border to sit on");
  assert.equal(timer.get("width").value, "auto", "between its insets, never past the toast");
  assert.equal(px(timer.get("height").value, env), 2);
  assert.equal(timer.get("background-color").value, "transparent", "no track: the bar alone");
  assert.equal(timer.get("border-radius").value, "0");
  assert.equal(cascaded(RULES_A, p["toast success timer bar"]).get("background-color").value, "color-mix(in srgb, var(--_sl-tone) 70%, transparent)");
});

test("forced colours: a toast keeps a drawn edge, its cast being gone", () => {
  const fc = parseSheet(read("components.css"), { forcedColors: true });
  const won = cascaded(fc, el({ classes: ["sl-toast"], parent: el({ tag: "body", parent: el({ tag: "html" }) }) }));
  assert.equal(won.get("outline").value, "1px solid CanvasText");
  assert.ok(won.get("outline").important);
});

// ── pseudo-elements: ::before is the component's, ::after the aurora's ───────

test("pseudo-elements: a tile's seam is a background layer; the lit pane's and the palette's seams, the toast's tick and the exit mark are a ::before; nothing takes ::after", () => {
  const sels = [...WB, ...CO.filter((r) => /\.sl-toast/.test(r.selector))].map((r) => r.selector);
  assert.deepEqual(sels.filter((s) => /::after/.test(s)), [], "::after stays free for the aurora");
  const before = sels.filter((s) => /::before/.test(s) && !/sl-tree__twisty/.test(s)).map((s) => s.replace(/^.*?(\.sl-[\w-]+)[^,]*$/, "$1"));
  assert.deepEqual([...new Set(before)].sort(), [".sl-palette", ".sl-pane", ".sl-term-block", ".sl-term-block__spin", ".sl-toast"], "the four marks and the spinner's frame, and nothing else");
  // the spinner's frame is the ::before of its own cell, a span in the
  // output, never of an effect host
  assert.deepEqual(sels.filter((s) => /__spin::before/.test(s)), [".sl-term-block__spin::before", ".sl-term-block__spin::before"]);
  // the lit pane's seam is a pseudo-element (it paints over the pane's children), and the palette's since 0.34 (Lumen's line with its glow)
  assert.match(rule(WB, ".sl-pane[data-lit]::before"), /background-image:\s*linear-gradient\(var\(--_sl-seam-dir, 90deg\), transparent, var\(--slc-seam\) 18%/);
  assert.doesNotMatch(rule(WB, ".sl-pane[data-lit]"), /background-image/);
  assert.match(rule(WB, ".sl-palette::before"), /background-image:\s*linear-gradient\(var\(--_sl-seam-dir, 90deg\), var\(--slc-seam\), transparent\)/);
  // mirrored right to left
  assert.equal(decl(rule(WB, ":where(.sl-pane, .sl-palette):dir(rtl)"), "--_sl-seam-dir"), "270deg");
});

// ── forced colours ─────────────────────────────────────────────────────────

test("forced colours: a pane and a terminal block get a drawn edge, the lit pane a heavier one, and the marks are system colours", () => {
  const fc = parseSheet(read("workbench.css"), { forcedColors: true });
  const fcKit = parseSheet(read("components.css"), { forcedColors: true });
  const at = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) });
  for (const [name, e, outline] of [["pane", el({ classes: ["sl-pane"], parent: at }), "1px solid CanvasText"], ["lit pane", el({ classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: at }), "2px solid Highlight"], ["terminal block", el({ classes: ["sl-term-block"], parent: at }), "1px solid CanvasText"]]) {
    const won = cascaded(fc, e);
    assert.equal(won.get("outline").value, outline, name);
    assert.ok(won.get("outline").important, name);
  }
  for (const [name, sheet, origin, colour] of [["exit mark", fc, el({ classes: ["sl-term-block"], attrs: { "data-exit": "1" }, parent: at }), "CanvasText"], ["toast tick", fcKit, el({ classes: ["sl-toast"], parent: at }), "CanvasText"], ["lit pane seam", fc, el({ classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: at }), "Highlight"]]) {
    const won = cascaded(sheet, el({ pseudo: "before", parent: origin }));
    assert.equal(won.get("forced-color-adjust").value, "none", name);
    assert.equal(won.get("background").value, colour, name);
    assert.ok(won.get("background").important, name);
  }
  assert.equal(cascaded(fc, el({ classes: ["sl-statusbar__dot"], parent: at })).get("background").value, "CanvasText");
  // the island's recipe is off there (components.css), so the outline is the edge
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

// ── heights: Lumen's rendered geometry (0.34) ──────────────────────────────

// The workbench chrome takes the geometry the Lumen IDE screen renders at
// 1440x900 (owner, 2026-10-05: "almost pixel by pixel"), which steps off the
// kit's 4px grid: a 26px tree row, a 38px palette row, a 38px activity item.
test("a tree row, a palette row and an activity item sit on the 4px grid, within 2px of Lumen's, and their line fits", () => {
  const p = build(dark);
  // Lumen renders 26 / 38 / 38; the kit keeps its grid (owner, 2026-10-05),
  // and where both neighbours are 2px off it keeps the 0.33 height
  for (const [name, e, want] of [["tree row", p["tree row"], 24], ["selected tree row", p["tree selected"], 24], ["palette row", p["palette row"], 36], ["selected palette row", p["palette selected"], 36], ["activity item", p["activity item"], 36]]) {
    const h = declaredHeight(RULES_A, e);
    assert.equal(h, want, name);
    assert.equal(h % 4, 0, `${name} on the 4px grid`);
    assert.equal(cascaded(RULES_A, e).get("box-sizing").value, "border-box", `${name}: the height is the whole row`);
  }
  // the tree row's line inside its own height
  const row = box(RULES_A, p["tree row"]);
  assert.ok(row.line <= 24, `tree line ${row.line}`);
  assert.equal(px(cascaded(RULES_A, p["tree row"]).get("font-size").value, row.env), 13, "Lumen's 13px rows");
  // the palette input is the kit's field, the one control height: 32px (Lumen's 34)
  assert.equal(box(RULES_A, p["palette input"]).height, 32);
});

// ── the activity bar ────────────────────────────────────────────────────────

test("the activity bar's glyphs are borderless chrome, the current one a flat tile with the kit's seam", () => {
  const p = build(dark);
  const item = cascaded(RULES_A, p["activity item"]);
  assert.equal(item.get("border").value, "0", "the owner-approved exception to the one control edge");
  assert.equal(item.get("background-color").value, "transparent");
  for (const name of ["activity current", "activity tab"]) {
    const won = cascaded(RULES_A, p[name]);
    // 0.34, Lumen: the current view rests on the surface rung (the tile is
    // a selection lifted out of a pane; the bar sits on the canvas)
    assert.equal(won.get("background-color").value, "var(--slc-surface)", name);
    assert.equal(won.get("background-image").value, "linear-gradient(var(--_sl-seam-ink), var(--_sl-seam-ink)), var(--_sl-layer)", `${name}: the shared seam`);
    assert.equal(customs(RULES_A, p[name]).get("--_sl-depth"), customs(RULES_A, p[name]).get("--slc-depth-flat"), `${name}: a flat tile`);
  }
  // hover is a flat wash and keeps the seam's layer
  assert.equal(cascaded(RULES_A, p["activity hovered"]).get("background-color").value, "color-mix(in srgb, var(--slc-text) 5%, transparent)");
  assert.equal(cascaded(RULES_A, p["activity hovered"]).get("box-shadow").value, "var(--_sl-depth)");
});

test("the activity bar keeps Lumen's 52px column and 44px pitch on the grid: 36px items at r9, 8px apart, 4px from the top", () => {
  const at = mount(dark);
  const bar = el({ tag: "nav", classes: ["sl-activitybar"], parent: at });
  const item = el({ tag: "button", classes: ["sl-activitybar__item"], parent: bar });
  const env = customs(RULES_A, item);
  const b = cascaded(RULES_A, bar);
  assert.equal(px(b.get("width").value, env), 52);
  assert.equal(b.get("box-sizing").value, "border-box");
  assert.equal(px(b.get("gap").value, env), 8);
  assert.deepEqual(words(b.get("padding-block").value).map((w) => px(w, env)), [4, 8]);
  const i = cascaded(RULES_A, item);
  assert.equal(px(i.get("width").value, env), 36);
  assert.equal(px(i.get("height").value, env), 36);
  assert.equal(px(i.get("height").value, env) + px(b.get("gap").value, env), 44, "Lumen's pitch, 38 + 6");
  assert.equal(px(i.get("border-radius").value, env), 9);
  assert.equal(i.get("position").value, "relative", "the count badge's containing block");
  assert.equal(cascaded(RULES_A, el({ pseudo: "after", parent: el({ tag: "button", classes: ["sl-activitybar__item"], attrs: { "data-count": "3" }, parent: bar }) })).get("content"), undefined, "a data-count draws nothing: the badge is a child");
});

test("a count badge: a child of the item, mono 9px on the accent fill, ringed in the canvas", () => {
  const at = mount(dark);
  const bar = el({ tag: "nav", classes: ["sl-activitybar"], parent: at });
  const counted = el({ tag: "button", classes: ["sl-activitybar__item"], parent: bar });
  const badge = el({ tag: "span", classes: ["sl-activitybar__badge"], attrs: { "aria-hidden": "true" }, parent: counted });
  const won = cascaded(RULES_A, badge);
  const env = customs(RULES_A, badge);
  assert.equal(won.get("position").value, "absolute");
  assert.equal(px(won.get("inset-block-start").value, env), 4);
  assert.equal(px(won.get("inset-inline-end").value, env), 4, "mirrored right to left");
  // Lumen renders 20 x 14 (a 14px content box and 3px padding); on the grid, 20 x 16, a full pill
  assert.equal(won.get("box-sizing").value, "border-box");
  assert.equal(px(won.get("min-width").value, env), 20);
  assert.equal(px(won.get("height").value, env), 16);
  assert.equal(px(won.get("padding").value.split(" ")[1], env), 4);
  assert.match(won.get("font").value, /^600 9px\/1rem var\(--sl-font-mono/);
  assert.equal(won.get("background-color").value, "var(--slc-accent-fill, var(--slc-accent))");
  assert.equal(won.get("box-shadow").value, "0 0 0 2px var(--slc-canvas)");
  assert.equal(won.get("pointer-events").value, "none");
  // the label is picked on the fill itself, as the primary's is, so a Tier B
  // page and a subtree fill get it too
  assert.equal(won.get("color").value, "oklch(from var(--slc-accent-fill, var(--slc-accent)) var(--_sl-on))");
});

// The item is an effect host (effects.css restores its depth and halo), and
// the aurora owns its ::after: a badge drawn there lost its count to the
// aurora's opacity and mask. A child keeps both.
test("a count badge survives the aurora on its item: neither takes the other's paint", () => {
  const FX = parse([...TIER_A, read("effects.css")]);
  const at = mount(dark);
  const item = el({ tag: "button", classes: ["sl-activitybar__item", "sl-fx-aurora"], attrs: { "aria-current": "true" }, parent: el({ tag: "nav", classes: ["sl-activitybar"], parent: at }) });
  const badge = el({ tag: "span", classes: ["sl-activitybar__badge"], parent: item });
  const b = cascaded(FX, badge);
  for (const prop of ["opacity", "mask", "mask-image", "-webkit-mask", "visibility", "display", "content"]) {
    assert.ok(!b.has(prop) || !/^(0|none|hidden)$/.test(b.get(prop).value) || prop === "content", `${prop}: ${b.get(prop)?.value}`);
  }
  assert.equal(b.get("background-color").value, "var(--slc-accent-fill, var(--slc-accent))", "the badge keeps its fill");
  // and nothing in the workbench writes into the item's ::after, the aurora's
  const after = cascaded(RULES_A, el({ pseudo: "after", parent: item }));
  assert.equal(after.get("content"), undefined, "the item's ::after is left to the aurora");
});

test("a count badge's label reads at 4.5:1 on its fill, every product, theme and tier", () => {
  const low = [];
  for (const ctx of CONTEXTS.filter((c) => !c.band)) {
    const at = mount(ctx);
    const item = el({ tag: "button", classes: ["sl-activitybar__item"], parent: el({ tag: "nav", classes: ["sl-activitybar"], parent: at }) });
    const badge = el({ tag: "span", classes: ["sl-activitybar__badge"], parent: item });
    const r = textContrast(ctx.rules, badge);
    if (!(r >= 4.5)) low.push(`${ctx.name} ${r.toFixed(2)}`);
  }
  assert.deepEqual(low, []);
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

test("tree rows indent by aria-level, a guide under each ancestor's twisty, and the twisty turns with aria-expanded", () => {
  const at = mount(dark);
  // the guides are opt-in since 0.34 (Lumen draws none)
  const tree = el({ tag: "ul", classes: ["sl-tree", "sl-tree--guides"], parent: at });
  const row = (level, attrs = {}) => el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": String(level), ...attrs }, parent: tree });
  for (const level of [1, 2, 4, 8]) {
    const r = row(level);
    const env = customs(RULES_A, r);
    assert.equal(env.get("--sl-tree-level"), String(level), `level ${level}: read from aria-level, no inline value needed`);
    const won = cascaded(RULES_A, r);
    const pad = px(won.get("padding-inline").value.match(/^calc\((.*)\) var/)[0].replace(/ var$/, ""), env);
    assert.equal(pad, 4 + (level - 1) * 16, `level ${level}: indent`);
    for (const [prop, v] of [["background-image", "var(--_sl-layer)"], ["background-size", "var(--_sl-layer-size)"], ["background-position", "var(--_sl-layer-position)"], ["background-repeat", "var(--_sl-layer-repeat)"]]) assert.equal(won.get(prop).value, v, prop);
    assert.equal(px(words(substitute("var(--_sl-layer-size)", env))[0], env), (level - 1) * 16, `level ${level}: one guide per ancestor`);
    assert.equal(px(words(substitute("var(--_sl-layer-position)", env))[0], env), 4 + 8, `level ${level}: the first guide under the first twisty's centre`);
    assert.match(env.get("--_sl-layer"), /^repeating-linear-gradient\(90deg, .+ 0 1px, transparent 1px 1rem\)$/);
  }
  // past the ladder, the level is written again inline; a written value wins at any weight
  const deep = row(12);
  assert.equal(customs(RULES_A, deep).get("--sl-tree-level"), "8", "past the ladder, a row holds at 8");
  const written = [...RULES_A, ...parse(['.sl-tree__row[aria-level="2"] { --sl-tree-level: 5; }'])];
  assert.equal(customs(written, row(2)).get("--sl-tree-level"), "5", "the ladder weighs nothing");
  // selected, the row keeps its guides under the seam, with paired lists
  const sel = row(3, { "aria-selected": "true" });
  const won = cascaded(RULES_A, sel);
  assert.equal(won.get("background-image").value, "linear-gradient(var(--_sl-seam-ink), var(--_sl-seam-ink)), var(--_sl-layer)");
  const env = customs(RULES_A, sel);
  for (const prop of ["background-image", "background-size", "background-position", "background-repeat"]) {
    assert.equal(splitTop(substitute(won.get(prop).value, env)).length, 2, `${prop}: two layers, paired`);
  }
  assert.match(splitTop(substitute(won.get("background-image").value, env))[1], /^repeating-linear-gradient/, "the guides under the seam");
  // the chevron: two independent properties, so it turns as a rotation
  const collapsed = el({ pseudo: "before", parent: el({ tag: "span", classes: ["sl-tree__twisty"], parent: row(1, { "aria-expanded": "false" }) }) });
  const expanded = el({ pseudo: "before", parent: el({ tag: "span", classes: ["sl-tree__twisty"], parent: row(1, { "aria-expanded": "true" }) }) });
  const leaf = el({ pseudo: "before", parent: el({ tag: "span", classes: ["sl-tree__twisty"], parent: row(2) }) });
  assert.equal(cascaded(RULES_A, collapsed).get("rotate").value, "-45deg", "points at the hidden children");
  assert.equal(cascaded(RULES_A, expanded).get("rotate").value, "45deg", "points down at the shown ones");
  assert.equal(cascaded(RULES_A, collapsed).get("transform"), undefined, "no transform list to interpolate through a matrix");
  assert.match(cascaded(RULES_A, collapsed).get("transition").value, /^rotate var\(--sl-motion-fast/);
  assert.equal(cascaded(RULES_A, leaf).get("content"), undefined, "a leaf draws no chevron");
});

test("a tree draws no guides unless it asks for them, and a selected row then carries the seam alone", () => {
  const at = mount(dark);
  const tree = el({ tag: "ul", classes: ["sl-tree"], parent: at });
  const row = el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": "3" }, parent: tree });
  assert.equal(customs(RULES_A, row).get("--_sl-layer"), "none", "no guides by default, as Lumen draws the tree");
  const sel = el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": "3", "aria-selected": "true" }, parent: tree });
  const layers = splitTop(substitute(cascaded(RULES_A, sel).get("background-image").value, customs(RULES_A, sel)));
  assert.equal(layers.length, 2);
  assert.equal(layers[1], "none", "the seam over no guide layer");
});

test("the twisty is a 16px box holding a chevron the size of Lumen's 12px glyph", () => {
  const at = mount(dark);
  const tree = el({ tag: "ul", classes: ["sl-tree"], parent: at });
  const twisty = (expanded) => el({ tag: "span", classes: ["sl-tree__twisty"], parent: el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": "1", "aria-expanded": expanded }, parent: tree }) });
  const box = twisty("false");
  const env = customs(RULES_A, box);
  const t = cascaded(RULES_A, box);
  assert.equal(px(t.get("width").value, env), 16);
  assert.equal(px(t.get("height").value, env), 16);
  // Lumen's chevron: the path m6 4 4 4-4 4 in a 16-unit box at 12px, so 6px
  // tall and 3px deep. Two borders of a square of side 6/sqrt(2), turned
  // 45deg, draw it; the tip sits s/sqrt(2) from the square's centre and the
  // open side on it, so it is shifted back by half that to sit centred.
  const closed = cascaded(RULES_A, el({ pseudo: "before", parent: box }));
  const side = px(closed.get("width").value, env);
  assert.equal(px(closed.get("height").value, env), side);
  assert.ok(Math.abs(side * Math.SQRT2 - 6) < 0.02, `6px tall: ${side * Math.SQRT2}`);
  assert.equal(closed.get("border-right").value, "1.25px solid currentColor", "the 12px glyph's 1.05px stroke, rounded to what a border paints");
  assert.equal(closed.get("translate").value, "-1.5px 0", "centred: back by half its 3px depth");
  const open = cascaded(RULES_A, el({ pseudo: "before", parent: twisty("true") }));
  assert.equal(open.get("translate").value, "0 -1.5px");
});

// ── the palette ─────────────────────────────────────────────────────────────

test("the palette floats on Lumen's cast, keeps no border, and never animates", () => {
  const p = build(dark);
  const won = cascaded(RULES_A, p.palette);
  assert.equal(won.get("border").value, "0", "the cast's ring is its edge (0.34)");
  assert.equal(won.get("box-shadow").value, "var(--slc-depth-cast)");
  assert.equal(won.get("background-image"), undefined, "the seam is its ::before now, not a layer");
  assert.equal(cascaded(RULES_A, p["palette selected"]).get("box-shadow").value, "var(--slc-depth-tile)");
  // no transition and no animation anywhere in the palette, the field included
  const pal = WB.filter((r) => /\.sl-palette/.test(r.selector));
  assert.ok(pal.length > 8);
  for (const r of pal) assert.doesNotMatch(r.body, /(?:^|;)\s*(transition|animation)[\w-]*\s*:(?!\s*none\s*(?:;|$))/, r.selector);
  for (const name of ["palette", "palette row", "palette selected"]) assert.equal(cascaded(RULES_A, p[name]).get("transition"), undefined, `${name} transitions`);
  assert.equal(cascaded(RULES_A, p["palette input"]).get("transition").value, "none");
  // ...at two classes, so it holds whatever order the sheets load in
  const reversed = parse([read("workbench.css"), read("components.css")]);
  assert.equal(cascaded(reversed, p["palette input"]).get("transition").value, "none", "workbench.css loaded first");
});

test("the palette is Lumen's on the grid: 580 wide, a 52px head, a 16px input with no fill or well, 36px rows, a foot on the surface", () => {
  const p = build(dark);
  const env = customs(RULES_A, p.palette);
  const pal = cascaded(RULES_A, p.palette);
  assert.equal(pal.get("width").value, "min(580px, 100%)");
  assert.equal(pal.get("border-radius").value, "var(--sl-radius-lg, 14px)");
  const head = cascaded(RULES_A, p["palette head"]);
  assert.equal(declaredHeight(RULES_A, p["palette head"]), 52, "Lumen's 54, keeping its 10px round a 32px field");
  assert.equal(px(head.get("padding-inline").value, env), 16);
  assert.equal(px(head.get("gap").value, env), 8);
  assert.equal(head.get("border-bottom").value, "1px solid var(--slc-border-subtle)", "a hairline");
  const input = cascaded(RULES_A, p["palette input"]);
  assert.equal(px(input.get("font-size").value, env), 16);
  assert.equal(input.get("letter-spacing").value, "-0.01em");
  assert.equal(px(input.get("padding-inline").value, env), 8);
  assert.equal(input.get("padding").value, "0.3125rem 0.75rem", "the field's own padding round its 20px line: 32px");
  assert.equal(input.get("background-color").value, "transparent", "no fill: the palette is its ground");
  assert.equal(customs(RULES_A, p["palette input"]).get("--_sl-depth"), "0 0 transparent", "no well");
  // the one control edge stays (Lumen draws none): a field is found by its
  // boundary, >= 3:1, which the screens report checks
  assert.equal(input.get("border").value, "1px solid var(--slc-edge-hairline)");
  assert.equal(input.get("border-color"), undefined, "nothing hides it at rest");
  const hovered = el({ tag: "input", classes: ["sl-field__input", "sl-palette__input"], states: ["hover"], parent: p["palette head"] });
  assert.equal(cascaded(RULES_A, hovered).get("border-color").value, "var(--slc-edge-control-hover)", "the kit's hover step");
  const focused = el({ tag: "input", classes: ["sl-field__input", "sl-palette__input"], states: ["focus", "focus-visible"], parent: p["palette head"] });
  assert.equal(cascaded(RULES_A, focused).get("border-color").value, "var(--slc-focus)", "focused, the kit's flush ring and its border");
  const list = cascaded(RULES_A, p["palette row"].parent.parent);
  assert.deepEqual(words(list.get("padding").value).map((w) => px(w, env)), [4, 8, 8]);
  const row = cascaded(RULES_A, p["palette row"]);
  assert.equal(px(row.get("gap").value, env), 12);
  assert.equal(px(row.get("border-radius").value, env), 8);
  const foot = cascaded(RULES_A, p["palette foot"]);
  assert.equal(foot.get("border-top").value, "1px solid var(--slc-border-subtle)");
  assert.equal(foot.get("background-color").value, "color-mix(in srgb, var(--slc-surface) 70%, transparent)");
  assert.deepEqual(words(foot.get("padding").value).map((w) => px(w, env)), [8, 16]);
  assert.equal(foot.get("border-radius").value, "0 0 var(--sl-radius-lg, 14px) var(--sl-radius-lg, 14px)", "its fill keeps to the palette's corners");
});

test("the palette is translucent only where the backdrop blurs: opaque without it, in high contrast and under forced colours", () => {
  const at = mount(dark);
  const pal = (rules) => cascaded(rules, el({ classes: ["sl-palette"], attrs: { role: "dialog" }, parent: at }));
  const glass = pal(RULES_A);
  assert.equal(glass.get("background-color").value, "color-mix(in srgb, var(--slc-raised) 94%, transparent)");
  assert.equal(glass.get("backdrop-filter").value, "blur(24px) saturate(1.3)");
  assert.equal(glass.get("-webkit-backdrop-filter").value, "blur(24px) saturate(1.3)");
  const plainRules = (() => { let o = 1e6; return [...TIER_A, accents(), PAGE].flatMap((css) => { const r = parseSheet(css, { backdrop: false }, o); o += r.length + 1; return r; }); })();
  const opaque = cascaded(plainRules, el({ classes: ["sl-palette"], parent: mount(dark) }));
  assert.equal(opaque.get("background-color").value, "var(--slc-raised)", "no backdrop-filter: the raised rung, opaque");
  assert.equal(opaque.get("backdrop-filter"), undefined);
  const h = cascaded(RULES_A, el({ classes: ["sl-palette"], parent: mount(hc) }));
  assert.equal(h.get("background-color").value, "var(--slc-raised)", "high contrast: opaque");
  assert.equal(h.get("backdrop-filter").value, "none");
  const fc = cascaded(parseSheet(read("workbench.css"), { forcedColors: true }), el({ classes: ["sl-palette"], parent: el({ tag: "body", parent: el({ tag: "html" }) }) }));
  assert.equal(fc.get("outline").value, "1px solid CanvasText", "forced colours: its drawn edge, as a pane's");
  assert.equal(fc.get("background-color").value, "Canvas");
  assert.equal(fc.get("backdrop-filter").value, "none");
});

test("the palette's seam is Lumen's: a 1px line from 16px in, gone by 40% from the end, glowing", () => {
  for (const [ctx, glow] of [[dark, 0.55], [CONTEXTS.find((c) => c.name === "light default"), 0.55], [hc, 0]]) {
    const p = build(ctx);
    const seam = cascaded(ctx.rules, p["palette seam"]);
    const env = customs(ctx.rules, p["palette seam"]);
    assert.equal(seam.get("content").value, '""');
    assert.equal(seam.get("position").value, "absolute");
    assert.equal(px(seam.get("inset-block-start").value, env), 0);
    assert.equal(seam.get("inset-inline").value, "16px 40%");
    assert.equal(px(seam.get("height").value, env), 1);
    assert.equal(seam.get("background-image").value, "linear-gradient(var(--_sl-seam-dir, 90deg), var(--slc-seam), transparent)");
    const shadow = substitute(seam.get("box-shadow").value, env);
    const a = value(ctx.rules, p["palette seam"], shadow.slice(shadow.indexOf("color-mix(")), BLACK).alpha;
    assert.ok(Math.abs(a - glow) < 1e-9, `${ctx.name}: glow ${a}, Lumen's 55% on both themes, none in high contrast`);
  }
  const fc = cascaded(parseSheet(read("workbench.css"), { forcedColors: true }), el({ pseudo: "before", parent: el({ classes: ["sl-palette"], parent: el({ tag: "body", parent: el({ tag: "html" }) }) }) }));
  assert.equal(fc.get("background").value, "Highlight");
  assert.equal(fc.get("forced-color-adjust").value, "none");
});

// The palette floats over the workbench, and a blur shows what is under it
// at 6%: its text is read over a ground of the palette composited on the
// canvas (above) and on the page's own ink, the opposite pole, so a bright
// line of code behind it cannot take a label under 4.5:1.
test("every text in the palette reads at 4.5:1 with the page's ink behind it", () => {
  const low = [];
  for (const ctx of CONTEXTS.filter((c) => !c.band)) {
    const rules = [...ctx.rules, ...parse([".under-ink { background-color: var(--slc-text); }"])];
    const at = el({ classes: ["under-ink"], parent: mount(ctx) });
    const p = BUILD.palette(at);
    for (const name of ["palette input", "palette group", "palette label", "palette match", "palette meta", "palette selected label", "palette selected meta", "palette key", "palette foot"]) {
      const r = textContrast(rules, p[name]);
      if (!(r >= 4.5)) low.push(`${ctx.name} ${name} ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(low, []);
});

test("a palette match is never only a colour: heavier and underlined in the accent, anywhere in the palette", () => {
  const p = build(dark);
  const foot = cascaded(RULES_A, p["palette foot match"]);
  assert.equal(foot.get("font-weight")?.value, "600", "a <mark> outside a result is styled too, never the UA's yellow");
  assert.equal(foot.get("background-color")?.value, "transparent");
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

test("the catalog's workbench markup puts each role and state on the element that must carry it", () => {
  const md = readFileSync(resolve(KIT, "agent/catalog.md"), "utf8");
  const tagsOf = (h) => { const at = md.indexOf(h); assert.ok(at > -1, h); const section = md.slice(at, md.indexOf("\n### ", at + 1)); return parseTags(section.match(/```html\n([\s\S]*?)```/)[1]); };
  const has = (t, ...attrs) => attrs.every((a) => a in t.attrs);
  // tree: a tree of treeitems, each with its level, set size and place, its selection and a roving tab stop
  const tree = tagsOf("### Tree — `sl-tree`");
  assert.equal(tree.find((t) => t.classes.includes("sl-tree")).attrs.role, "tree");
  const rows = tree.filter((t) => t.classes.includes("sl-tree__row"));
  assert.ok(rows.length >= 3);
  for (const r of rows) {
    assert.equal(r.attrs.role, "treeitem");
    assert.ok(has(r, "aria-level", "aria-setsize", "aria-posinset", "aria-selected", "tabindex"), JSON.stringify(r.attrs));
    assert.ok(+r.attrs["aria-posinset"] <= +r.attrs["aria-setsize"], "its place lies within its set");
  }
  assert.equal(rows.filter((r) => r.attrs.tabindex === "0").length, 1, "one tab stop");
  assert.ok(rows.some((r) => "aria-expanded" in r.attrs), "a parent says it is open");
  // palette: the input is a combobox that points at the active option; the list takes no tab stop
  const pal = tagsOf("### Palette — `sl-palette`");
  const input = pal.find((t) => t.classes.includes("sl-palette__input"));
  assert.equal(input.attrs.role, "combobox");
  assert.equal(input.attrs["aria-autocomplete"], "list");
  const list = pal.find((t) => t.classes.includes("sl-palette__list"));
  assert.equal(list.attrs.role, "listbox");
  assert.equal(list.attrs.tabindex, "-1");
  assert.equal(input.attrs["aria-controls"], list.attrs.id);
  const active = pal.find((t) => t.attrs.id === input.attrs["aria-activedescendant"]);
  assert.ok(active && active.attrs.role === "option" && active.attrs["aria-selected"] === "true", "the active descendant is the selected option");
  for (const o of pal.filter((t) => t.attrs.role === "option")) {
    assert.equal(o.ancestors.at(-1).attrs.role, "group", "an option sits in a group of the listbox");
    assert.ok(!("tabindex" in o.attrs), "options are not focusable");
  }
  // activity bar: each item is named, the current one says so
  const act = tagsOf("### Activity bar — `sl-activitybar`").filter((t) => t.classes.includes("sl-activitybar__item"));
  for (const a of act) assert.ok(a.attrs["aria-label"], "named");
  assert.equal(act.filter((a) => a.attrs["aria-current"] === "true").length, 1);
  // status bar: never a live region as a whole
  const bar = tagsOf("### Status bar — `sl-statusbar`").find((t) => t.classes.includes("sl-statusbar"));
  assert.ok(!bar.attrs.role && !bar.attrs["aria-live"], "the bar is no live region");
  assert.match(md, /Don't: put `role="status"` on the bar/);
});

// ── forced colours: selection is the system's ──────────────────────────────

test("forced colours: a current activity item and a selected row are the system's selection", () => {
  const fc = parseSheet(read("workbench.css"), { forcedColors: true });
  const at = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) });
  for (const e of [el({ classes: ["sl-activitybar__item"], attrs: { "aria-current": "true" }, parent: at }), el({ classes: ["sl-tree__row"], attrs: { "aria-selected": "true" }, parent: at }), el({ classes: ["sl-palette__row"], attrs: { "aria-selected": "true" }, parent: at })]) {
    const won = cascaded(fc, e);
    assert.equal(won.get("background").value, "Highlight", "a shorthand: it resets the seam's layer too");
    assert.equal(won.get("color").value, "HighlightText");
    assert.ok(won.get("background").important && won.get("color").important);
    assert.equal(won.get("forced-color-adjust").value, "none");
  }
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

// ── the seam: every selected or current tile carries a cue of 3:1 ────────────

// The tile is depth, not a state cue (1.00-1.34:1 against its ground, 1.42
// before the 0.35 hairlines; 1.00 on
// a light lit pane or palette, where the tile is the raised rung). Every
// selected or current tile carries the shared seam (components.css): the
// accent while its container holds the focus, the muted ink while it does
// not. Read on the tile, against the tile composited on its ground, in a
// pane, a lit pane, on the canvas, in the band (the kit components that can
// sit there), on Tier B and in high contrast.
const SURFACES = {
  "nav item": (at, focus) => el({ tag: "a", classes: ["sl-nav__item"], attrs: { "aria-current": "page" }, parent: el({ tag: "nav", classes: ["sl-nav"], states: focus, parent: at }) }),
  "list row": (at, focus) => el({ tag: "button", classes: ["sl-list__row"], attrs: { role: "option", "aria-selected": "true" }, parent: el({ classes: ["sl-list"], attrs: { role: "listbox" }, states: focus, parent: at }) }),
  "current list row": (at, focus) => el({ tag: "a", classes: ["sl-list__row"], attrs: { "aria-current": "page" }, parent: el({ classes: ["sl-list"], states: focus, parent: at }) }),
  "tile tab": (at, focus) => el({ tag: "button", classes: ["sl-tabs__tab"], attrs: { role: "tab", "aria-selected": "true" }, parent: el({ classes: ["sl-tabs__list", "sl-tabs--tile"], attrs: { role: "tablist" }, states: focus, parent: at }) }),
  "segment": (at, focus) => el({ tag: "button", classes: ["sl-segmented__item"], attrs: { role: "tab", "aria-selected": "true" }, parent: el({ classes: ["sl-segmented"], states: focus, parent: at }) }),
  "pressed segment": (at, focus) => el({ tag: "button", classes: ["sl-segmented__item"], attrs: { "aria-pressed": "true" }, parent: el({ classes: ["sl-segmented"], states: focus, parent: at }) }),
  "current page": (at, focus) => el({ tag: "a", classes: ["sl-pagination__item"], attrs: { "aria-current": "page" }, parent: el({ tag: "nav", classes: ["sl-pagination"], states: focus, parent: at }) }),
  "hovered current page": (at, focus) => el({ tag: "a", classes: ["sl-pagination__item"], attrs: { "aria-current": "page" }, states: ["hover"], parent: el({ tag: "nav", classes: ["sl-pagination"], states: focus, parent: at }) }),
  "activity item": (at, focus) => el({ tag: "button", classes: ["sl-activitybar__item"], attrs: { "aria-current": "true" }, parent: el({ tag: "nav", classes: ["sl-activitybar"], states: focus, parent: at }) }),
  "tree row": (at, focus) => el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": "2", "aria-selected": "true" }, parent: el({ tag: "ul", classes: ["sl-tree"], states: focus, parent: at }) }),
  "palette row": (at) => el({ classes: ["sl-palette__row"], attrs: { role: "option", "aria-selected": "true" }, parent: el({ classes: ["sl-palette__list"], parent: el({ classes: ["sl-palette"], parent: at }) }) }),
};
const KIT_SURFACES = ["nav item", "list row", "current list row", "tile tab", "segment", "pressed segment", "current page", "hovered current page"];
const WHERE = {
  "in a pane": (at) => el({ tag: "section", classes: ["sl-pane"], parent: at }),
  "in a lit pane": (at) => el({ tag: "section", classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: at }),
  "on the canvas": (at) => at,
};

// The floors the docs state: 5.24:1 on the page, 3.4 in the band (whose seam
// is floored at oklch L 0.72 for a hue the light band clips).
for (const ctx of CONTEXTS) {
  const floor = ctx.band ? 3.4 : 5.24;
  test(`${ctx.name}: every selected or current tile carries a seam of ${floor}:1 against the tile and its ground, focused and not`, () => {
    const low = [];
    const at = mount(ctx);
    for (const [surface, make] of Object.entries(SURFACES)) {
      if (ctx.band && !KIT_SURFACES.includes(surface)) continue;
      for (const [where, host] of Object.entries(ctx.band ? { "in the band": (a) => a } : WHERE)) {
        if (surface === "palette row" && where !== "on the canvas") continue;
        for (const [focus, states] of [["focused", ["focus-within"]], ["unfocused", []]]) {
          const e = make(host(at), states);
          const r = seamContrast(ctx.rules, e);
          if (!(r >= floor)) low.push(`${surface} ${where}, ${focus}: ${r.toFixed(3)}`);
          // the ink is the accent while the container holds the focus, the muted ink while it does not
          const ink = toHex(value(ctx.rules, e, "var(--_sl-seam-ink)", colorOf(ctx.rules, e)));
          const want = toHex(value(ctx.rules, e, surface === "palette row" || focus === "focused" ? "var(--slc-seam)" : "var(--slc-text-muted)", colorOf(ctx.rules, e)));
          if (ink !== want) low.push(`${surface} ${where}, ${focus}: ink ${ink}, want ${want}`);
        }
      }
    }
    assert.deepEqual(low, []);
  });
}

test("the tile alone is no cue: on the light theme a palette's active row and a lit pane's selected row are white on white", () => {
  // the reason the seam exists, measured: tile against its ground
  const ctx = CONTEXTS.find((c) => c.name === "light default");
  const at = mount(ctx);
  for (const e of [SURFACES["palette row"](at), SURFACES["tree row"](WHERE["in a lit pane"](at), [])]) {
    const tile = groundOf(ctx.rules, e), under = groundOf(ctx.rules, e.parent);
    assert.ok(ratio(tile, under) < 1.05, `${ratio(tile, under).toFixed(2)}`);
  }
});

test("the tile tab's wrapper (a :has() selector) carries the shared seam in a rule of its own, and the tab inside it none", () => {
  // the test cascade never matches :has(), so the rule is read as written
  const seams = CO.filter((r) => /background-image:\s*linear-gradient\(var\(--_sl-seam-ink\)/.test(r.body));
  assert.equal(seams.length, 2, "the shared list, and the wrapper on its own");
  assert.ok(!seams[0].selector.includes(":has("), "no :has() in the shared list: a browser without it would drop all nine surfaces");
  assert.equal(seams[1].selector, '.sl-tabs--tile .sl-tabs__item:has(> .sl-tabs__tab[aria-selected="true"])');
  assert.equal(seams[1].body.replace(/\s+/g, " "), seams[0].body.replace(/\s+/g, " "), "the same four declarations");
  assert.equal(decl(rule(CO, '.sl-tabs--tile .sl-tabs__item > .sl-tabs__tab[aria-selected="true"]'), "background-image"), "none");
  assert.equal(decl(rule(CO, '.sl-tabs--tile .sl-tabs__item:has(> .sl-tabs__tab[aria-selected="true"])'), "background-color"), "var(--slc-tile)");
});

test('aria-current="false" is not current: no tile, no seam, no depth', () => {
  const at = mount(dark);
  for (const [name, e] of [
    ["nav item", el({ tag: "a", classes: ["sl-nav__item"], attrs: { "aria-current": "false" }, parent: el({ tag: "nav", classes: ["sl-nav"], parent: at }) })],
    ["list row", el({ tag: "a", classes: ["sl-list__row"], attrs: { "aria-current": "false" }, parent: el({ classes: ["sl-list"], parent: at }) })],
    ["page", el({ tag: "a", classes: ["sl-pagination__item"], attrs: { "aria-current": "false" }, parent: el({ tag: "nav", classes: ["sl-pagination"], parent: at }) })],
    ["activity item", el({ tag: "button", classes: ["sl-activitybar__item"], attrs: { "aria-current": "false" }, parent: el({ tag: "nav", classes: ["sl-activitybar"], parent: at }) })],
  ]) {
    const won = cascaded(RULES_A, e);
    assert.notEqual(won.get("background-color")?.value, "var(--slc-tile)", name);
    assert.ok(!/--_sl-seam-ink/.test(won.get("background-image")?.value ?? ""), `${name}: no seam`);
    assert.equal(customs(RULES_A, e).get("--_sl-depth"), "0 0 transparent", `${name}: no depth`);
  }
});

// ── a subtree accent reaches every mark ─────────────────────────────────────

test("an accent re-bound on a subtree reaches the seams, the accent text, the live dot, a match's underline and the prompt", () => {
  for (const ctx of [dark, CONTEXTS.find((c) => c.name === "light default")]) {
    const rules = [...RULES_A, ...parse(['[data-section] { --slc-accent: #1d63d8; }'])];
    const at = mount(ctx);
    const section = el({ tag: "section", attrs: { "data-section": "" }, parent: at });
    const want = (e, v) => toHex(value(rules, e, v, colorOf(rules, e)));
    const derived = (e) => toHex(evaluate(`oklch(from #1d63d8 min(l, ${customs(rules, e).get("--_sl-accent-text-lmax") ?? 1}) c h)`, new Map()));
    const root = toHex(value(rules, at, "var(--slc-accent-text)", BLACK));
    const lit = el({ tag: "section", classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: section });
    const marks = {
      "lit pane seam": [lit, "var(--slc-seam)"],
      "nav seam": [SURFACES["nav item"](section, ["focus-within"]), "var(--_sl-seam-ink)"],
      "tree seam": [SURFACES["tree row"](section, ["focus-within"]), "var(--_sl-seam-ink)"],
      "palette seam": [SURFACES["palette row"](section), "var(--_sl-seam-ink)"],
      "link": [el({ tag: "a", classes: ["sl-link"], parent: section }), "var(--slc-accent-text)"],
      "live dot": [el({ classes: ["sl-statusbar__dot"], parent: el({ classes: ["sl-statusbar__item"], parent: el({ classes: ["sl-statusbar"], parent: section }) }) }), cascaded(rules, el({ classes: ["sl-statusbar__dot"], parent: at })).get("background-color").value],
      "match underline": [el({ tag: "mark", parent: el({ classes: ["sl-palette__label"], parent: el({ classes: ["sl-palette"], parent: section }) }) }), "var(--slc-accent-text)"],
      "term prompt": [el({ classes: ["sl-term-block__prompt"], parent: el({ classes: ["sl-term-block__cmd"], parent: el({ classes: ["sl-term-block"], parent: section }) }) }), cascaded(rules, el({ classes: ["sl-term-block__prompt"], parent: at })).get("color").value],
    };
    for (const [name, [e, v]] of Object.entries(marks)) {
      const got = want(e, v);
      assert.equal(got, derived(e), `${ctx.name} ${name}: the section's accent`);
      assert.notEqual(got, root, `${ctx.name} ${name}: not the root's`);
    }
    // what they paint with reads those very values
    assert.equal(cascaded(rules, marks["match underline"][0]).get("text-decoration-color").value, "var(--slc-accent-text)");
    assert.equal(cascaded(rules, marks["term prompt"][0]).get("color").value, "var(--slc-accent-text)");
  }
});

test("a host deep in an inversion band takes the band's formula, not the page's", () => {
  for (const ctx of CONTEXTS.filter((c) => c.band)) {
    const at = mount(ctx); // a child of the band
    const nested = el({ classes: ["sl-nav"], parent: el({ tag: "div", parent: at }) });
    const item = el({ tag: "a", classes: ["sl-nav__item"], attrs: { "aria-current": "page" }, parent: nested });
    const env = customs(ctx.rules, item);
    const band = customs(ctx.rules, at);
    for (const role of ["--slc-accent-text", "--slc-seam"]) {
      assert.equal(toHex(value(ctx.rules, item, `var(${role})`, BLACK)), toHex(value(ctx.rules, at, `var(${role})`, BLACK)), `${ctx.name} ${role}: the band child's value`);
    }
    assert.match(substitute("var(--slc-accent-text)", env), /min\(max\(l, 0\.68\)/, `${ctx.name}: the band's floor`);
    assert.ok(band.has("--slc-accent-text"));
  }
});

// ── the terminal block's exit codes ────────────────────────────────────────

test("exit codes: 0 success, cancelled neutral, any other code the danger, an empty or absent exit no mark", () => {
  for (const ctx of [dark, hc]) {
    const p = build(ctx);
    const tone = (role) => toHex(value(ctx.rules, p["term exit 0"], `var(${role})`, BLACK));
    const markOf = (name) => { const won = cascaded(ctx.rules, p[`term ${name} mark`]); return won.get("content") ? toHex(value(ctx.rules, p[`term ${name} mark`], won.get("background-color").value, colorOf(ctx.rules, p[`term ${name}`]))) : null; };
    assert.equal(markOf("exit 0"), tone("--slc-success"));
    assert.equal(markOf("exit 1"), tone("--slc-danger"));
    assert.equal(markOf("exit 127"), tone("--slc-danger"));
    assert.equal(markOf("cancelled"), toHex(value(ctx.rules, p["term cancelled"], "var(--slc-text-muted)", colorOf(ctx.rules, p["term cancelled"]))), "cancelled: the muted ink");
    assert.equal(markOf("unknown"), null, 'data-exit="": no mark');
    assert.equal(markOf("running"), null, "running: no mark");
    // the exit text says it in the same ink, and keeps the meta's where nothing is known or it was a stop
    const ink = (name) => toHex(colorOf(ctx.rules, p[`term ${name} exit`]));
    assert.equal(ink("exit 0"), tone("--slc-success"));
    assert.equal(ink("exit 1"), tone("--slc-danger"));
    for (const n of ["cancelled", "unknown", "running"]) assert.equal(ink(n), toHex(colorOf(ctx.rules, p[`term ${n} meta`])), `${n}: the meta's ink`);
  }
});

test("a terminal block in a lit pane steps down to the sunken rung, so its fill still bounds it", () => {
  for (const ctx of CONTEXTS.filter((c) => !c.band)) {
    const p = build(ctx);
    const block = toHex(bgOf(ctx.rules, p["term exit 0 in the lit pane"]));
    const pane = toHex(bgOf(ctx.rules, p["term exit 0 in the lit pane"].parent));
    assert.notEqual(block, pane, `${ctx.name}: the block's fill differs from the lit pane's`);
    assert.equal(cascaded(ctx.rules, p["term exit 0 in the lit pane"]).get("background-color").value, "var(--slc-sunken)", ctx.name);
  }
});

// ── the kill switches: each restore outranks its kill ──────────────────────

test("the effects kill switches never outrank a restore: an island, a float and the workbench's rows keep their own", () => {
  const FX = parse([...TIER_A, read("effects.css")]);
  for (const [theme, region] of [["high-contrast", {}], ["dark", { "data-sl-fx": "off" }]]) {
    const html = el({ tag: "html", attrs: { "data-sl-theme": theme } });
    const at = el({ attrs: region, parent: el({ tag: "body", parent: html }) });
    for (const [name, classes, attrs, want] of [
      ["pane", ["sl-pane"], {}, "var(--slc-depth-island)"],
      ["lit pane", ["sl-pane"], { "data-lit": "" }, "var(--slc-depth-island)"],
      ["terminal block", ["sl-term-block"], {}, "var(--slc-depth-island)"],
      ["toast", ["sl-toast"], {}, "var(--slc-depth-cast)"],
      ["palette", ["sl-palette"], {}, "var(--slc-depth-cast)"],
      ["activity item", ["sl-activitybar__item"], { "aria-current": "true" }, "var(--_sl-depth, 0 0 transparent)"],
      ["tree row", ["sl-tree__row"], { "aria-selected": "true" }, "var(--_sl-depth, 0 0 transparent)"],
    ]) {
      for (const fx of ["sl-fx-aurora", "sl-fx-glass", "sl-fx-press", "sl-fx-glitch"]) {
        const won = cascaded(FX, el({ classes: [...classes, fx], attrs, parent: at }));
        assert.equal(won.get("box-shadow").value, want, `${theme} ${JSON.stringify(region)} ${name} + ${fx}`);
        assert.ok(won.get("box-shadow").important, `${name} + ${fx}: the restore is !important, as the kill is`);
      }
    }
  }
});

// ── the review's second round (N1-N5) ──────────────────────────────────────

test("a lit pane's seam paints over a child that has a ground of its own", () => {
  const rules = [...RULES_A, ...parse([".pane-head { background-color: var(--slc-surface); position: relative; }"])];
  const lit = el({ tag: "section", classes: ["sl-pane"], attrs: { "data-lit": "" }, parent: mount(dark) });
  el({ tag: "header", classes: ["pane-head"], parent: lit });
  const seam = cascaded(rules, el({ pseudo: "before", parent: lit }));
  assert.equal(seam.get("content").value, '""');
  assert.equal(seam.get("position").value, "absolute");
  assert.ok(+seam.get("z-index").value >= 1, "above a child that is positioned too (z-index auto), in the pane's own layer");
  assert.equal(px(seam.get("inset-block-start").value, customs(rules, lit)), 0, "on the pane's top edge");
  assert.equal(cascaded(rules, lit).get("position").value, "relative", "the pane is its containing block");
  assert.equal(cascaded(rules, lit).get("isolation"), undefined, "no stacking context of its own: an overlay with a z-index still paints over the seam");
  assert.equal(cascaded(rules, lit).get("background-image"), undefined, "not a layer a child's ground would cover");
});

test("a host outside a kit container opts into the focused seam with --sl-seam-focus", () => {
  const ctx = CONTEXTS.find((c) => c.name === "light default");
  const rules = [...ctx.rules, ...parse(['.my-tree:focus-within { --sl-seam-focus: 1; }', '.my-nav { --sl-seam-focus: 1; }'])];
  const at = mount(ctx);
  const ink = (e) => toHex(value(rules, e, "var(--_sl-seam-ink)", colorOf(rules, e)));
  const want = (e, v) => toHex(value(rules, e, v, colorOf(rules, e)));
  const row = (parent) => el({ classes: ["sl-list__row"], attrs: { "aria-selected": "true" }, parent });
  const bare = row(el({ classes: ["my-tree"], parent: at }));
  assert.equal(ink(bare), want(bare, "var(--slc-text-muted)"), "a container-less row: muted");
  const focused = row(el({ classes: ["my-tree"], states: ["focus-within"], parent: at }));
  assert.equal(ink(focused), want(focused, "var(--slc-seam)"), "its own container under :focus-within: the accent");
  assert.ok(seamContrast(rules, focused) >= 3);
  // a kit container honours the hook at rest
  const nav = el({ tag: "a", classes: ["sl-nav__item"], attrs: { "aria-current": "page" }, parent: el({ tag: "nav", classes: ["sl-nav", "my-nav"], parent: at }) });
  assert.equal(ink(nav), want(nav, "var(--slc-seam)"), "a kit container set to 1 at rest");
});

test("a tree row past level 8 holds at 8, without an inline level", () => {
  const tree = el({ tag: "ul", classes: ["sl-tree"], parent: mount(dark) });
  for (const [level, want] of [["9", "8"], ["14", "8"], ["8", "8"], ["3", "3"]]) {
    const r = el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem", "aria-level": level }, parent: tree });
    assert.equal(customs(RULES_A, r).get("--sl-tree-level"), want, `aria-level ${level}`);
  }
  const none = el({ tag: "li", classes: ["sl-tree__row"], attrs: { role: "treeitem" }, parent: tree });
  assert.equal(customs(RULES_A, none).get("--sl-tree-level"), undefined, "no aria-level: the fallback, level 1");
});

test("a Tier B layer's numbers come from the README's recipes, and the dark one caps the accent in a band", () => {
  assert.deepEqual(Object.keys(LAYER_NUMBERS.light).sort(), ["--sl-accent-text-lmax", "--slc-edge-accent-lmax", "--slc-glow"]);
  assert.deepEqual(LAYER_NUMBERS.dark, { "--sl-accent-band-text-lmax": "0.45" });
  const kitDark = bare(read("themes/dark.css"));
  assert.match(kitDark, /--sl-accent-band-text-lmax:\s*0\.45;/, "the number the kit's own dark theme sets");
});

// ── the 4px grid (owner, 2026-10-05: the kit keeps it) ──────────────────────

// The workbench follows the Lumen demo within a pixel or two, on the kit's
// grid (design-language L2): every gap, padding, margin and inset in
// workbench.css, and in the components.css rules 0.34 touched (the tile tab,
// the toast), is a whole number of 4px steps, and so is every row, bar and
// control height or width named below. Radii, type, line weights, shadows,
// glyph sizes, translate and vertical-align are not spacing and are not read.
// A value here that predates 0.34 and steps off the grid is listed by
// selector, property and value, so a change to it trips the sweep too.
const GRID_PROPS = /^(?:padding|margin|gap|row-gap|column-gap|inset|top|right|bottom|left)(?:-|$)/;
const SPACE = Object.fromEntries([...bare(read("tokens.css")).matchAll(/(--sl-space-\d+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const GRID_ENV = new Map([...Object.entries(SPACE), ["--sl-tree-level", "1"], ["--sl-radius-pane", "10px"], ["--sl-radius-lg", "14px"]]);
// off the grid on purpose (design-language L2, its two exceptions), each
// pinned by its value
const GRID_LEGACY = new Set([
  ".sl-tabs--tile::gap=2px", // 2px between tile tabs, since 0.31
  // the in-button key's overflow, not spacing: an 18px cap gives 2 x 2px
  // back to the button's 14px line (16px and 12 in --sm), since 0.31
  ".sl-btn > .sl-kbd::margin-block=-2px",
  // the pixel tick's first cell: the check box's marks sit on a 2px lattice
  // (6 x 6 cells, 2px in), not a 4px one, since 0.39 (pixel direction D)
  ".sl-check__box::after::top=6px",
  ".sl-check__box::after::left=2px",
  // the pixel dot's first cell, on the same lattice (the dash, a rule on the
  // input's sibling, is not swept)
  ".sl-radio__box::after::left=6px",
]);
const GRID_WORDS = /^(?:auto|0|inherit|initial|unset|-?[\d.]+%)$/;
/** The off-grid or unreadable spacing declarations among `rules`. A word is a
 *  keyword, a bare percentage, or a length the reader evaluates; a % inside a
 *  calc() counts as 0, so the rest of the sum must sit on the grid on its own
 *  (calc(100% - 3px) is off). min(), max(), clamp() and a var() left without
 *  a value cannot be read on a grid, and say so. */
function gridOff(rules) {
  const off = [];
  for (const r of rules) {
    for (const d of r.body.split(";")) {
      const m = d.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/);
      if (!m || !GRID_PROPS.test(m[1])) continue;
      const raw = m[2].replace(/\s*!important$/, "");
      if (GRID_LEGACY.has(`${r.selector}::${m[1]}=${raw}`)) continue;
      let text;
      try { text = substitute(raw, GRID_ENV).trim(); } catch { off.push(`${r.selector} { ${m[1]}: ${raw} }: cannot be read on the grid (an unresolved var())`); continue; }
      for (const w of words(text)) {
        if (GRID_WORDS.test(w)) continue;
        if (/\b(?:min|max|clamp)\(|var\(/.test(w)) { off.push(`${r.selector} { ${m[1]}: ${raw} }: cannot be read on the grid (${w})`); continue; }
        let v;
        try { v = px(w.replace(/-?[\d.]+%/g, "0"), GRID_ENV); } catch { off.push(`${r.selector} { ${m[1]}: ${raw} }: cannot be read on the grid (${w})`); continue; }
        if (Math.abs(v / 4 - Math.round(v / 4)) > 1e-9) off.push(`${r.selector} { ${m[1]}: ${raw} } = ${v}px`);
      }
    }
  }
  return off;
}
test("the workbench's spacing sits on the 4px grid", () => {
  const co = RULES(COMPONENTS).filter((r) => /\.sl-tabs--tile|\.sl-toast/.test(r.selector));
  assert.deepEqual(gridOff([...RULES(WORKBENCH), ...co]), []);
});

// 0.36 (K10): the controls Lumen parity moved -- the button, the badge, the
// tag, the chip, the keycap and the check box -- sit on the grid too. A
// button group's 1px rule (the hairline technique) and the check input's
// visually-hidden -1px are not spacing and are not read.
const K10_CONTROLS = /\.sl-(?:btn|badge|tag|chips?|kbd|check)(?![\w-])|\.sl-(?:btn|badge|tag|chip)--[\w-]+|\.sl-(?:chip|check)__(?:box|label|count)/;
const k10Rules = () => RULES(COMPONENTS).filter((r) => K10_CONTROLS.test(r.selector) && !/sl-btn-group|__input/.test(r.selector));
test("the controls 0.36 moved to Lumen's shape sit on the 4px grid", () => {
  const rules = k10Rules();
  for (const sel of [".sl-btn", ".sl-btn--sm", ".sl-badge", ".sl-tag", ".sl-chip", ".sl-chips", ".sl-kbd", ".sl-btn > .sl-kbd", ".sl-check, .sl-radio, .sl-switch"]) {
    assert.ok(rules.some((r) => r.selector === sel), `the sweep reads ${sel}`);
  }
  assert.deepEqual(gridOff(rules), []);
});

test("the grid sweep reads a sum, refuses what it cannot read, and pins its exceptions by value", () => {
  const sweep = (css) => gridOff(RULES(css));
  assert.deepEqual(sweep(".a { inset-inline: calc(100% - 4px) 40%; padding: 0 var(--sl-space-3); }"), [], "on the grid");
  assert.equal(sweep(".a { inset-inline: calc(100% - 3px); }").length, 1, "the length beside a % is read");
  for (const v of ["min(8px, 1rem)", "clamp(4px, 1vw, 8px)", "var(--nope)"]) assert.match(sweep(`.a { gap: ${v}; }`)[0] ?? "", /cannot be read/, v);
  assert.deepEqual(sweep(".sl-tabs--tile { gap: 2px; }"), [], "the exception at its value");
  assert.equal(sweep(".sl-tabs--tile { gap: 3px; }").length, 1, "an exception that moves is off again");
  assert.deepEqual(sweep(".sl-btn > .sl-kbd { margin-block: -2px; }"), [], "the in-button key's overflow at its value");
  assert.equal(sweep(".sl-btn > .sl-kbd { margin-block: -3px; }").length, 1, "and off again if it moves");
  assert.equal(sweep(".sl-btn > .sl-kbd { margin-inline-end: -2px; }").length, 1, "only on the property it is pinned to");
  // the values 0.36 rounded, at their old Lumen-ish values, are off the grid
  for (const d of ["padding: 0.5rem 0.9rem", "gap: 0.4rem", "padding: 0.3125rem 0.6rem", "padding: 0 0.3125rem", "margin-inline-end: -0.3rem"]) {
    assert.ok(sweep(`.sl-btn { ${d}; }`).length >= 1, d);
  }
});

test("the workbench's rows, bars and controls are whole 4px steps tall and wide", () => {
  const p = build(dark);
  const at = mount(dark);
  const sizes = [
    ["title bar", el({ tag: "header", classes: ["sl-titlebar"], parent: at }), "height"],
    ["command field", el({ tag: "button", classes: ["sl-titlebar__cmd"], parent: at }), "height"],
    ["activity bar", el({ tag: "nav", classes: ["sl-activitybar"], parent: at }), "width"],
    ["activity item", p["activity item"], "height"], ["activity item", p["activity item"], "width"],
    ["count badge", el({ tag: "span", classes: ["sl-activitybar__badge"], parent: p["activity item"] }), "height"],
    ["count badge", el({ tag: "span", classes: ["sl-activitybar__badge"], parent: p["activity item"] }), "min-width"],
    ["status bar", p.bar, "height"], ["status item", p["status item"], "height"],
    ["tree row", p["tree row"], "height"],
    ["palette", p.palette, "width"], ["palette head", p["palette head"], "height"], ["palette row", p["palette row"], "height"],
    ["toast mark", p["toast success mark"], "height"], ["toast dismiss", p["toast success dismiss"], "height"],
    ["tile tab", el({ tag: "button", classes: ["sl-tabs__tab"], parent: el({ classes: ["sl-tabs__list", "sl-tabs--tile"], parent: at }) }), "height"],
  ];
  const off = [];
  for (const [name, e, prop] of sizes) {
    const v = cascaded(RULES_A, e).get(prop)?.value;
    assert.ok(v, `${name} declares its ${prop}`);
    const n = px(v.replace(/^min\((.+), 100%\)$/, "$1"), customs(RULES_A, e));
    if (n % 4 !== 0) off.push(`${name} ${prop} ${n}`);
  }
  // the palette's field is the kit's one control height, 32px
  if (box(RULES_A, p["palette input"]).height !== 32) off.push(`palette input ${box(RULES_A, p["palette input"]).height}`);
  assert.deepEqual(off, []);
});

// ── forced colours and high contrast: the marks 0.34 added keep their shape ──

test("forced colours: the bell's unread dot becomes a Highlight edge, and a count badge keeps its shape on a current item", () => {
  const wb = parseSheet(read("workbench.css"), { forcedColors: true });
  const at = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) });
  // the dot is an image, which forced colours drop: the button says it with its edge
  const bell = cascaded(wb, el({ tag: "button", classes: ["sl-icon-btn", "sl-titlebar__btn", "sl-titlebar__btn--dot"], parent: at }));
  assert.equal(bell.get("border").value, "2px solid Highlight");
  assert.ok(bell.get("border").important);
  // the badge opts out and is drawn in the selection's colours, ringed in
  // their text colour, so on a current item (Highlight itself) it keeps a shape
  const current = el({ tag: "button", classes: ["sl-activitybar__item"], attrs: { "aria-current": "true" }, parent: at });
  const badge = cascaded(wb, el({ tag: "span", classes: ["sl-activitybar__badge"], parent: current }));
  assert.equal(badge.get("forced-color-adjust").value, "none");
  assert.equal(badge.get("background").value, "Highlight");
  assert.equal(badge.get("color").value, "HighlightText");
  assert.equal(badge.get("outline").value, "1px solid HighlightText");
  assert.ok(badge.get("outline").important);
  assert.equal(cascaded(wb, current).get("background").value, "Highlight", "the item it sits on");
});

test("a toast's timer stays a 2px bar under high contrast and forced colours, never a bordered box", () => {
  const timer = (rules) => cascaded(rules, el({ classes: ["sl-progress", "sl-toast__timer"], parent: el({ classes: ["sl-toast"], parent: el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "high-contrast" } }) }) }) }));
  const h = timer(RULES_A);
  assert.equal(h.get("border").value, "0", "high contrast draws the progress track's edge; the timer has no track");
  const fc = timer(parseSheet(read("components.css"), { forcedColors: true }));
  assert.equal(fc.get("border").value, "0");
  assert.ok(fc.get("border").important, "outranks forced colours' drawn progress edge");
  const bar = cascaded(parseSheet(read("components.css"), { forcedColors: true }), el({ tag: "span", classes: ["sl-progress__bar"], parent: el({ classes: ["sl-progress", "sl-toast__timer"], parent: el({ tag: "body", parent: el({ tag: "html" }) }) }) }));
  assert.equal(bar.get("background").value, "Highlight", "the bar itself in the system's colour");
});

test("the palette is opaque where the user asks for less transparency", () => {
  let o = 2e6;
  const rules = [...TIER_A, accents(), PAGE].flatMap((css) => { const r = parseSheet(css, { reducedTransparency: true }, o); o += r.length + 1; return r; });
  const pal = cascaded(rules, el({ classes: ["sl-palette"], parent: mount(dark) }));
  assert.equal(pal.get("background-color").value, "var(--slc-raised)");
  assert.equal(pal.get("backdrop-filter").value, "none");
  assert.equal(pal.get("-webkit-backdrop-filter").value, "none");
});

// The field keeps an edge (Lumen draws it borderless, 1.00:1), the hairline at rest:
// 1.5-2.2:1 against the palette it sits in (3:1 on hover),
// with the canvas or the page's own ink under the palette's 6%.
test("the palette's field rests on the hairline, 1.5-2.2:1, every product, theme and tier", () => {
  const low = [];
  for (const ctx of CONTEXTS.filter((c) => !c.band)) {
    for (const under of ["", "under-ink"]) {
      const rules = under ? [...ctx.rules, ...parse([".under-ink { background-color: var(--slc-text); }"])] : ctx.rules;
      const at = under ? el({ classes: [under], parent: mount(ctx) }) : mount(ctx);
      const p = BUILD.palette(at);
      const input = p["palette input"];
      const won = cascaded(rules, input);
      // the border colour that wins: a longhand of the palette's over the field's shorthand, or the shorthand's colour
      const bc = won.get("border-color"), b = won.get("border");
      const text = bc && (!b || cmp(bc, b) > 0) ? bc.value : words(b.value).slice(2).join(" ");
      const edge = value(rules, input, text, colorOf(rules, input));
      const g = groundOf(rules, input.parent);
      const r = ratio(over(edge, g), g);
      // owner amendment, 2026-10-26: at rest the field is the translucent
      // hairline, 1.5-2.2:1 on the ground over which it is drawn (high contrast keeps the strong edge)
      if (ctx.name === "high-contrast" ? !(r >= 3) : !(r >= 1.5 && r <= 2.2)) low.push(`${ctx.name}${under ? " over ink" : ""} ${r.toFixed(2)}`);
    }
  }
  assert.deepEqual(low, []);
});

test("forced colours: a focused bell takes the focus ring alone, with no Highlight edge inside it", () => {
  const wb = parseSheet(read("workbench.css"), { forcedColors: true });
  const at = el({ tag: "body", parent: el({ tag: "html", attrs: { "data-sl-theme": "dark" } }) });
  const focused = cascaded(wb, el({ tag: "button", classes: ["sl-icon-btn", "sl-titlebar__btn", "sl-titlebar__btn--dot"], states: ["focus-visible"], parent: at }));
  assert.equal(focused.get("border"), undefined, "the edge stands down under the ring");
});
