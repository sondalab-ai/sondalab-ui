import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate, fromSrgb, substitute, toHex, toSrgb } from "./lib/css-color.mjs";
import { parseSheet, el, cascaded, customs as rawCustoms, declaredHeight, px } from "./lib/cascade.mjs";

// The title bar (ui-kit 0.34, workbench.css): Lumen's IDE screen measured at
// 1440x900 -- a 44px grid of three tracks on the canvas, the product's mark
// with its accent dot and a crumb on the left, a 30px command field in the
// 512px centre track, a cluster of icon buttons on the right. Read through
// the test cascade over the kit's real sheets, on every registered product,
// light and dark, Tier A and Tier B, and high contrast. Never in a band: it
// is a workbench's frame.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const NEUTRALS = JSON.parse(read("neutrals.json")).products;
const REGISTRY = JSON.parse(read("agent/accent-registry.json")).products;
const PRODUCTS = Object.keys(NEUTRALS).filter((p) => !NEUTRALS[p].inherits);
const README = readFileSync(resolve(KIT, "README.md"), "utf8");

const TIER_A = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css", "themes/products.css", "components.css", "workbench.css"].map(read);
const TIER_B = ["tokens.css", "components.css", "workbench.css"].map(read);
const accents = () => PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
  const fill = REGISTRY[p].fill?.[t];
  return `:root[data-sl-product="${p}"][data-sl-theme="${t}"] { --sl-accent-default: ${REGISTRY[p][t]};${t === "dark" ? ` --sl-focus-ring: ${REGISTRY[p][t]};` : ""}${fill ? ` --slc-accent-fill: ${fill};` : ""} }`;
})).join("\n");
const STATUS = Object.fromEntries(["light", "dark"].map((t) => [t, Object.fromEntries([...bare(read(`themes/${t}.css`)).matchAll(/--sl-status-(\w+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))]));
const LAYER = Object.fromEntries(["light", "dark"].map((t) => {
  const block = README.match(new RegExp(`\`\`\`css\\n:root\\[data-theme="${t}"\\] \\{\\n([\\s\\S]*?)\\}\\n\`\`\``));
  return [t, Object.fromEntries([...block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))];
}));
const tierB = () => PRODUCTS.flatMap((p) => ["light", "dark"].map((t) => {
  const n = NEUTRALS[p][t];
  const map = {
    "--slc-accent": REGISTRY[p][t], "--slc-canvas": n["bg-canvas"], "--slc-surface": n["bg-surface"], "--slc-raised": n["bg-surface-raised"],
    "--slc-text": n["text-primary"], "--slc-text-secondary": n["text-secondary"], "--slc-text-muted": n["text-muted"],
    "--slc-border": n["border-default"], "--slc-border-subtle": n["border-subtle"], "--slc-border-strong": n["border-strong"], "--slc-focus": REGISTRY[p][t],
    ...Object.fromEntries(["success", "warning", "danger", "info"].map((s) => [`--slc-${s}`, STATUS[t][s]])),
    ...LAYER[t],
  };
  return `:root[data-product="${p}"][data-theme="${t}"] { ${Object.entries(map).map(([k, v]) => `${k}: ${v};`).join(" ")} }`;
})).join("\n");
const PAGE = "html, body { background-color: var(--slc-canvas); color: var(--slc-text); }";
let order = 0;
const parse = (texts, flags = {}) => texts.flatMap((css) => { const r = parseSheet(css, flags, order); order += r.length + 1; return r; });
const RULES_A = parse([...TIER_A, accents(), PAGE]);
const RULES_B = parse([...TIER_B, tierB(), PAGE]);
const CONTEXTS = [
  ...PRODUCTS.flatMap((p) => ["light", "dark"].flatMap((t) => [
    { name: `${t} ${p}`, rules: RULES_A, attrs: { "data-sl-theme": t, "data-sl-product": p } },
    { name: `${t} ${p} Tier B`, rules: RULES_B, attrs: { "data-theme": t, "data-product": p } },
  ])),
  { name: "high-contrast", rules: RULES_A, attrs: { "data-sl-theme": "high-contrast" } },
];
const dark = CONTEXTS.find((c) => c.name === "dark default");
const hc = CONTEXTS.find((c) => c.name === "high-contrast");

const memo = new WeakMap();
const customs = (rules, e) => {
  let m = memo.get(e);
  if (!m) memo.set(e, (m = new Map()));
  if (!m.has(rules)) m.set(rules, rawCustoms(rules, e));
  return m.get(rules);
};
const BLACK = fromSrgb([0, 0, 0]);
const cssOf = (c) => { const [r, g, b] = toSrgb(c); return `rgb(${r * 255}, ${g * 255}, ${b * 255}, ${c.alpha})`; };
const value = (rules, e, v, current) => evaluate(substitute(v, customs(rules, e)).replace(/currentColor/gi, cssOf(current)), new Map());
function colorOf(rules, e) {
  const parent = e.parent ? colorOf(rules, e.parent) : BLACK;
  const v = cascaded(rules, e).get("color")?.value;
  if (!v || v === "inherit") return parent;
  return value(rules, e, v, parent);
}
const cmp = (x, y) => (x.important - y.important) || x.spec[0] - y.spec[0] || x.spec[1] - y.spec[1] || x.spec[2] - y.spec[2] || x.order - y.order;
function bgOf(rules, e) {
  const won = cascaded(rules, e);
  const [d] = [won.get("background"), won.get("background-color")].filter(Boolean).sort((a, b) => cmp(b, a));
  if (!d) return { lin: [0, 0, 0], alpha: 0 };
  const v = d.value.trim();
  if (v === "none" || v === "transparent") return { lin: [0, 0, 0], alpha: 0 };
  return value(rules, e, v, colorOf(rules, e));
}
const over = (top, under) => { const t = toSrgb(top), u = toSrgb(under); return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha))); };
function groundOf(rules, e) {
  const chain = [];
  for (let n = e; n; n = n.parent) chain.unshift(n);
  return chain.reduce((acc, n) => over(bgOf(rules, n), acc), fromSrgb([1, 1, 1]));
}
const Y = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
const textContrast = (rules, e) => { const g = groundOf(rules, e); return ratio(over(colorOf(rules, e), g), g); };
const words = (v) => { const out = []; let d = 0, cur = ""; for (const ch of v) { if (ch === "(") d++; if (ch === ")") d--; if (ch === " " && d === 0) { if (cur) out.push(cur); cur = ""; } else cur += ch; } if (cur) out.push(cur); return out; };

/** The title bar as the catalog writes it, mounted on the page. */
function build(ctx, { states = {} } = {}) {
  const html = el({ tag: "html", attrs: ctx.attrs });
  const body = el({ tag: "body", parent: html });
  const bar = el({ tag: "header", classes: ["sl-titlebar"], parent: body });
  const l = el({ classes: ["sl-titlebar__l"], parent: bar });
  const menu = el({ tag: "button", classes: ["sl-icon-btn", "sl-titlebar__btn", "sl-titlebar__menu"], parent: l });
  const mark = el({ tag: "span", classes: ["sl-titlebar__mark"], parent: l });
  const crumb = el({ tag: "span", classes: ["sl-titlebar__crumb"], parent: l });
  const cmd = el({ tag: "button", classes: ["sl-titlebar__cmd"], states: states.cmd ?? [], parent: bar });
  const keys = el({ tag: "span", classes: ["sl-titlebar__keys"], parent: cmd });
  const r = el({ classes: ["sl-titlebar__r"], parent: bar });
  const btn = el({ tag: "button", classes: ["sl-icon-btn", "sl-titlebar__btn"], states: states.btn ?? [], parent: r });
  const bell = el({ tag: "button", classes: ["sl-icon-btn", "sl-titlebar__btn", "sl-titlebar__btn--dot"], states: states.bell ?? [], parent: r });
  return {
    html, bar, l, r, menu, mark, crumb, cmd, keys, btn, bell,
    dot: el({ tag: "span", classes: ["sl-titlebar__dot"], parent: mark }),
    sep: el({ tag: "span", classes: ["sl-titlebar__sep"], parent: crumb }),
    "cmd text": el({ tag: "span", classes: ["sl-titlebar__cmd-text"], parent: cmd }),
    kbd: el({ tag: "kbd", classes: ["sl-kbd"], parent: keys }),
    "btn glyph": el({ tag: "svg", parent: btn }),
  };
}

// ── the frame ──────────────────────────────────────────────────────────────

test("the title bar is Lumen's: a 44px grid of three tracks on the canvas, the centre 32rem", () => {
  const p = build(dark);
  const env = customs(RULES_A, p.bar);
  const won = cascaded(RULES_A, p.bar);
  assert.equal(won.get("display").value, "grid");
  assert.equal(won.get("grid-template-columns").value, "1fr minmax(0, 32rem) 1fr", "the command field holds the 512px centre track");
  assert.equal(declaredHeight(RULES_A, p.bar), 44);
  assert.equal(won.get("box-sizing").value, "border-box");
  assert.equal(won.get("align-items").value, "center");
  assert.equal(px(won.get("gap").value, env), 16);
  assert.deepEqual(words(won.get("padding-inline").value).map((w) => px(w, env)), [14.4, 9.6]);
  assert.equal(won.get("background-color").value, "transparent", "it sits on the canvas, as the status bar does");
  assert.equal(px(cascaded(RULES_A, p.l).get("gap").value, env), 12);
  const r = cascaded(RULES_A, p.r);
  assert.equal(px(r.get("gap").value, env), 8);
  assert.equal(r.get("justify-content").value, "flex-end");
  for (const side of [p.l, p.r]) assert.equal(cascaded(RULES_A, side).get("min-width").value, "0", "a side may shrink past its content");
});

test("the title bar drags the window, and nothing in it that takes the pointer does", () => {
  const p = build(dark);
  const won = cascaded(RULES_A, p.bar);
  assert.equal(won.get("-webkit-app-region").value, "drag", "Electron");
  assert.equal(won.get("app-region").value, "drag", "a web app's window-controls overlay");
  for (const [name, e] of [["command field", p.cmd], ["icon button", p.btn], ["menu", p.menu],
    ["link", el({ tag: "a", parent: p.l })], ["input", el({ tag: "input", parent: p.r })], ["a tab stop", el({ attrs: { tabindex: "0" }, parent: p.r })], ["a role=button", el({ attrs: { role: "button" }, parent: p.r })]]) {
    const w = cascaded(RULES_A, e);
    assert.equal(w.get("-webkit-app-region")?.value, "no-drag", name);
    assert.equal(w.get("app-region")?.value, "no-drag", name);
  }
});

// ── the left: mark and crumb ───────────────────────────────────────────────

test("the mark is Geist 700 at 15px, tracked -0.04em, with a 5px dot of the accent; the crumb 13px", () => {
  const p = build(dark);
  const env = customs(RULES_A, p.mark);
  const mark = cascaded(RULES_A, p.mark);
  assert.equal(mark.get("font-family").value, "var(--sl-font-display, system-ui, sans-serif)", "the display face, never the brand's (L1)");
  assert.equal(mark.get("font-weight").value, "700");
  assert.equal(px(mark.get("font-size").value, env), 15);
  assert.equal(mark.get("letter-spacing").value, "-0.04em");
  assert.equal(mark.get("color").value, "var(--slc-text)");
  const dot = cascaded(RULES_A, p.dot);
  for (const [prop, want] of [["width", 5], ["height", 5], ["margin-inline-start", 2], ["vertical-align", 1]]) assert.equal(px(dot.get(prop).value, env), want, prop);
  assert.equal(dot.get("display").value, "inline-block");
  assert.equal(dot.get("border-radius").value, "50%");
  assert.equal(dot.get("background-color").value, "var(--slc-accent)", "the accent itself, as the wordmark's dot is");
  const crumb = cascaded(RULES_A, p.crumb);
  assert.equal(px(crumb.get("font-size").value, env), 13);
  assert.equal(crumb.get("color").value, "var(--slc-text-secondary)");
  for (const [prop, v] of [["white-space", "nowrap"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["min-width", "0"]]) assert.equal(crumb.get(prop)?.value, v, prop);
  const sep = cascaded(RULES_A, p.sep);
  assert.equal(sep.get("color").value, "var(--slc-text-muted)");
  assert.equal(px(sep.get("margin-inline").value, env), 2.4);
});

test("no part of the title bar takes a pseudo-element: an effect may own any of them", () => {
  const wb = bare(read("workbench.css"));
  const sels = [...wb.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1]).filter((s) => /sl-titlebar/.test(s));
  assert.ok(sels.length > 8);
  assert.deepEqual(sels.filter((s) => /::(before|after)/.test(s)), []);
});

// ── the command field ──────────────────────────────────────────────────────

test("the command field is Lumen's: 30px, r8, the one control edge, the surface lit along its top", () => {
  const p = build(dark);
  const env = customs(RULES_A, p.cmd);
  const won = cascaded(RULES_A, p.cmd);
  assert.equal(declaredHeight(RULES_A, p.cmd), 30);
  assert.equal(won.get("box-sizing").value, "border-box");
  assert.equal(px(won.get("border-radius").value, env), 8);
  assert.equal(won.get("border").value, "1px solid var(--slc-edge-control)");
  assert.equal(won.get("background-color").value, "var(--slc-surface)");
  assert.equal(env.get("--_sl-depth"), env.get("--slc-lit") ? `inset 0 1px 0 ${env.get("--slc-lit")}` : undefined, "lit along its top, as the depth the kit paints");
  assert.equal(won.get("color").value, "var(--slc-text-muted)");
  assert.equal(px(won.get("font-size").value, env), 13);
  assert.equal(px(won.get("gap").value, env), 8);
  assert.deepEqual(words(won.get("padding-inline").value).map((w) => px(w, env)), [10.4, 6.4]);
  assert.equal(won.get("width").value, "100%", "it fills the centre track");
  for (const [prop, v] of [["appearance", "none"], ["font", "inherit"], ["margin", "0"]]) assert.equal(won.get(prop)?.value, v, prop);
  assert.match(won.get("transition").value, /^background-color var\(--sl-motion-fast/);
  assert.equal(px(cascaded(RULES_A, p.keys).get("gap").value, env), 3);
  const text = cascaded(RULES_A, p["cmd text"]);
  for (const [prop, v] of [["flex", "1"], ["min-width", "0"], ["text-align", "start"], ["overflow", "hidden"], ["text-overflow", "ellipsis"], ["white-space", "nowrap"]]) assert.equal(text.get(prop)?.value, v, prop);
});

test("the command field lifts to the raised rung under the pointer, and focus is the shared flush ring", () => {
  for (const ctx of [dark, hc]) {
    const hovered = build(ctx, { states: { cmd: ["hover"] } });
    const h = cascaded(ctx.rules, hovered.cmd);
    assert.equal(h.get("background-color").value, "var(--slc-raised)");
    assert.equal(h.get("border-color").value, "var(--slc-edge-control-hover)");
    const focused = build(ctx, { states: { cmd: ["hover", "focus-visible"] } });
    const f = cascaded(ctx.rules, focused.cmd);
    assert.equal(f.get("outline").value, "var(--sl-focus-ring-width, 2px) solid var(--slc-focus)");
    assert.equal(f.get("border-color").value, "var(--slc-focus)", "hovered and focused, the border is the ring's: no band inside it");
    assert.equal(f.get("box-shadow").value, "var(--_sl-depth, 0 0 transparent), var(--_sl-halo, 0 0 transparent)", "its lit line, then the halo");
    assert.ok(!f.get("outline").important && !f.get("box-shadow").important);
  }
  const fc = parseSheet(read("components.css"), { forcedColors: true });
  const at = el({ tag: "body", parent: el({ tag: "html" }) });
  assert.equal(cascaded(fc, el({ tag: "button", classes: ["sl-titlebar__cmd"], states: ["focus-visible"], parent: at })).get("outline-color")?.value, "CanvasText", "forced colours: the ring in the palette's ink");
  assert.equal(rawCustoms(fc, el({ tag: "button", classes: ["sl-titlebar__cmd"], parent: at })).get("--_sl-halo"), "0 0 transparent");
});

// ── the right: icon buttons and the bell's dot ─────────────────────────────

test("a title-bar icon button rests on the surface in the one control edge; the bell's dot is a layer, kept under the pointer", () => {
  const p = build(dark);
  const btn = cascaded(RULES_A, p.btn);
  assert.equal(btn.get("background-color").value, "var(--slc-surface)");
  assert.equal(btn.get("border").value, "1px solid var(--slc-edge-control)", "the icon button's own edge");
  assert.equal(declaredHeight(RULES_A, p.btn), 32);
  for (const states of [[], ["hover"]]) {
    const b = build(dark, { states: { bell: states } });
    const won = cascaded(RULES_A, b.bell);
    const img = won.get("background-image")?.value ?? "";
    assert.match(img, /^radial-gradient\(circle at calc\(100% - 8px\) 8px, var\(--_sl-titlebar-dot\) 2\.75px, var\(--slc-surface\) 3\.25px 4\.75px, transparent 5\.25px\)$/, `${states.join() || "rest"}: Lumen's 6px dot, 5px from the corner, ringed in the surface`);
    assert.equal(won.get("background-repeat")?.value, "no-repeat");
  }
  assert.equal(customs(RULES_A, p.bell).get("--_sl-titlebar-dot") !== undefined, true);
  assert.equal(cascaded(RULES_A, p.bell).get("--_sl-titlebar-dot")?.value, "var(--slc-accent-fill, var(--slc-accent-text))", "the labelled fill where a product sets one (spexr's #4c58e9), the accent as a mark otherwise");
});

// ── contrast: every text and mark, every product, theme and tier ────────────

test("every text in the title bar reads at 4.5:1, its marks and boundaries at 3:1", () => {
  const low = [];
  for (const ctx of CONTEXTS) {
    const p = build(ctx);
    for (const name of ["mark", "crumb", "sep", "cmd text", "kbd"]) {
      const r = textContrast(ctx.rules, p[name]);
      if (!(r >= 4.5)) low.push(`${ctx.name} ${name} ${r.toFixed(2)}`);
    }
    const hovered = build(ctx, { states: { cmd: ["hover"] } });
    const rh = textContrast(ctx.rules, hovered["cmd text"]);
    if (!(rh >= 4.5)) low.push(`${ctx.name} cmd text, hovered ${rh.toFixed(2)}`);
    // the glyph of an icon button (a graphical object, 3:1)
    const rg = textContrast(ctx.rules, p["btn glyph"]);
    if (!(rg >= 3)) low.push(`${ctx.name} button glyph ${rg.toFixed(2)}`);
    // boundaries: the field's and the button's edge against the canvas
    for (const name of ["cmd", "btn"]) {
      const e = p[name];
      const ground = groundOf(ctx.rules, e.parent);
      const won = cascaded(ctx.rules, e);
      const edge = value(ctx.rules, e, words(won.get("border").value).slice(2).join(" "), colorOf(ctx.rules, e));
      const r = ratio(over(edge, ground), ground);
      if (!(r >= 3)) low.push(`${ctx.name} ${name} edge ${r.toFixed(2)}`);
    }
    // the bell's dot, a state's mark: against the button's own fill
    const dot = value(ctx.rules, p.bell, "var(--_sl-titlebar-dot)", BLACK);
    const fill = groundOf(ctx.rules, p.bell);
    const rd = ratio(over(dot, fill), fill);
    if (!(rd >= 3)) low.push(`${ctx.name} bell dot ${rd.toFixed(2)}`);
  }
  assert.deepEqual(low, []);
});

test("spexr's bell dot is its registered fill, the demo's #4c58e9", () => {
  for (const t of ["light", "dark"]) {
    const ctx = CONTEXTS.find((c) => c.name === `${t} spexr`);
    const p = build(ctx);
    assert.equal(toHex(value(ctx.rules, p.bell, "var(--_sl-titlebar-dot)", BLACK)), REGISTRY.spexr.fill[t].toLowerCase());
  }
});

// A section painted in another product's accent (a product page) re-binds
// --slc-accent on a subtree. Every dot in the frame follows it: the mark's
// dot reads the accent itself, the bell's reads the accent as a mark, which
// is derived again on the title bar (THE ACCENT, WHERE IT IS READ), and the
// activity bar's count badge reads the accent (or the product's fill).
test("a section's accent reaches the title bar's dots and the activity bar's badge", () => {
  for (const ctx of [dark, CONTEXTS.find((c) => c.name === "light default")]) {
    const rules = [...ctx.rules, ...parse(["[data-section] { --slc-accent: #1d63d8; }"])];
    const html = el({ tag: "html", attrs: ctx.attrs });
    const section = el({ tag: "section", attrs: { "data-section": "" }, parent: el({ tag: "body", parent: html }) });
    const bar = el({ tag: "header", classes: ["sl-titlebar"], parent: section });
    const mark = el({ tag: "span", classes: ["sl-titlebar__mark"], parent: el({ classes: ["sl-titlebar__l"], parent: bar }) });
    const dot = el({ tag: "span", classes: ["sl-titlebar__dot"], parent: mark });
    const bell = el({ tag: "button", classes: ["sl-icon-btn", "sl-titlebar__btn", "sl-titlebar__btn--dot"], parent: el({ classes: ["sl-titlebar__r"], parent: bar }) });
    const badge = el({ tag: "span", classes: ["sl-activitybar__badge"], parent: el({ tag: "button", classes: ["sl-activitybar__item"], parent: el({ tag: "nav", classes: ["sl-activitybar"], parent: section }) }) });
    const lmax = rawCustoms(rules, bell).get("--_sl-accent-text-lmax") ?? "1";
    const asText = toHex(evaluate(`oklch(from #1d63d8 min(l, ${lmax}) c h)`, new Map()));
    const root = toHex(value(rules, html, "var(--slc-accent-text)", BLACK));
    assert.equal(toHex(value(rules, dot, cascaded(rules, dot).get("background-color").value, BLACK)), "#1d63d8", `${ctx.name}: the mark's dot`);
    const bellDot = toHex(value(rules, bell, "var(--_sl-titlebar-dot)", BLACK));
    assert.equal(bellDot, asText, `${ctx.name}: the bell's dot, the section's accent as a mark`);
    assert.notEqual(bellDot, root, `${ctx.name}: not the root's`);
    assert.equal(toHex(value(rules, badge, cascaded(rules, badge).get("background-color").value, BLACK)), "#1d63d8", `${ctx.name}: the badge`);
  }
});
