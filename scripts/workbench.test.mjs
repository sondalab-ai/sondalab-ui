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
 *  peak, or its background colour), against the ground under its origin. */
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
/** Overlays (the toast, the palette) are children of the body or the top
 *  layer, never of an inversion band: the band's roles are washes of its own
 *  ground, so an overlay mounted in one would float translucent over the
 *  page. They are read on the page and on Tier B only. */
const OVERLAYS = new Set(["toast", "palette"]);
const build = (ctx) => { const at = mount(ctx); return Object.assign({}, ...Object.entries(BUILD).filter(([k]) => !(ctx.band && OVERLAYS.has(k))).map(([, f]) => f(at))); };

/** [piece, minimum, how it is read]: "text" on its own ground, "mark" a
 *  pseudo-element's paint against its origin's ground (3:1, a graphical
 *  object), "fill" an element's own fill against its parent's ground. */
const READINGS = [
  ["text in a pane", 4.5, "text"],
  ["text in the lit pane", 4.5, "text"],
  ["seam", 3, "mark"],
  ["status item", 4.5, "text"],
  ["dot", 3, "fill"],
  ...["neutral", "info", "success", "warning", "danger"].flatMap((t) => [
    [`toast ${t} title`, 4.5, "text"],
    [`toast ${t} body`, 4.5, "text"],
    [`toast ${t} mark`, 4.5, "text"],
  ]),
];

const fillContrast = (rules, e) => { const g = groundOf(rules, e.parent); return ratio(over(bgOf(rules, e), g), g); };

for (const ctx of CONTEXTS) {
  test(`${ctx.name}: every text-carrying piece reads at 4.5:1 and every mark at 3:1`, () => {
    const pieces = build(ctx);
    const low = [];
    for (const [name, min, how] of READINGS) {
      const e = pieces[name];
      if (!e && ctx.band && [...OVERLAYS].some((o) => name.startsWith(o))) continue;
      assert.ok(e, `no piece ${name}`);
      const r = how === "text" ? textContrast(ctx.rules, e) : how === "mark" ? markContrast(ctx.rules, e) : fillContrast(ctx.rules, e);
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
    assert.equal(cascaded(ctx.rules, p.bar).get("overflow").value, "hidden", "nothing it holds can grow it");
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
