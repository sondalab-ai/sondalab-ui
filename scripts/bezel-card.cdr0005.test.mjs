// CDR-0005 — the bezel card ships as sl-card--bezel.
//
// The CSS checks resolve the cascade of components.css at rest on a small
// modelled tree, per theme, so they hold for any way of writing the selectors
// or private custom properties.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { auditCss, allowlistForProduct, resolveAccentEntry } from "../packages/ui-kit/agent/sl-audit.mjs";
import { buildDesignMd } from "./gen-design-md.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(REPO, p), "utf8");
const readJson = (p) => JSON.parse(read(p));

const CSS = read("packages/ui-kit/components.css");
const TOKENS = readJson("sondalab.tokens.json");

// ---- a small CSS reader ----

/** Index of the first of `stops` at depth 0, outside strings and brackets. */
function scan(text, from, stops) {
  let depth = 0;
  let quote = "";
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && stops.includes(c)) return i;
  }
  return text.length;
}

function split(text, sep) {
  const out = [];
  let from = 0;
  while (from <= text.length) {
    const i = scan(text, from, sep);
    out.push(text.slice(from, i).trim());
    from = i + 1;
  }
  return out.filter(Boolean);
}

function closing(text, open) {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    i = scan(text, i, "{}");
    if (text[i] === "{") depth++;
    else if (--depth === 0) return i;
    i++;
  }
  return text.length;
}

function parseCss(css) {
  const rules = [];
  const walk = (text, context) => {
    let i = 0;
    while (i < text.length) {
      const j = scan(text, i, "{;}");
      if (j >= text.length) break;
      if (text[j] !== "{") {
        i = j + 1;
        continue;
      }
      const head = text.slice(i, j).trim().replace(/\s+/g, " ");
      const end = closing(text, j);
      const body = text.slice(j + 1, end);
      if (/^@(media|supports|layer|container|starting-style)\b/.test(head)) walk(body, [...context, head]);
      else if (!head.startsWith("@")) {
        const decls = split(body, ";").flatMap((d) => {
          const c = d.indexOf(":");
          if (c < 0) return [];
          return [[d.slice(0, c).trim(), d.slice(c + 1).trim().replace(/\s+/g, " ")]];
        });
        rules.push({ context, selectors: split(head, ","), decls, order: rules.length });
      }
      i = end + 1;
    }
  };
  walk(css.replace(/\/\*[\s\S]*?\*\//g, " "), []);
  return rules;
}

const RULES = parseCss(CSS);

// ---- selector matching at rest ----

function compounds(selector) {
  const parts = [];
  let current = "";
  let combinator = null;
  let depth = 0;
  for (const c of selector.trim()) {
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (depth === 0 && /[\s>+~]/.test(c)) {
      if (current) {
        parts.push({ combinator, text: current });
        current = "";
        combinator = " ";
      }
      if (c.trim()) combinator = c;
    } else current += c;
  }
  if (current) parts.push({ combinator, text: current });
  return parts;
}

function simples(compound) {
  const out = [];
  let i = 0;
  while (i < compound.length) {
    let j = i + 1;
    if (compound[i] === "[") {
      j = compound.indexOf("]", i) + 1;
    } else {
      if (compound[i] === ":" && compound[j] === ":") j++;
      while (j < compound.length && /[\w-]/.test(compound[j])) j++;
      if (compound[j] === "(") {
        let depth = 0;
        do {
          if (compound[j] === "(") depth++;
          if (compound[j] === ")") depth--;
          j++;
        } while (depth && j < compound.length);
      }
    }
    out.push(compound.slice(i, j));
    i = j;
  }
  return out;
}

const PSEUDO_ELEMENT = /^(::[\w-]+|:(before|after))/;
const add = (a, b) => a.map((v, i) => v + b[i]);
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

function matchCompound(simple, node) {
  let spec = [0, 0, 0];
  for (const s of simple) {
    if (s === "*") continue;
    if (s[0] === ".") {
      if (!node.classes.includes(s.slice(1))) return null;
      spec = add(spec, [0, 1, 0]);
    } else if (s[0] === "#") return null;
    else if (s[0] === "[") {
      const m = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(s);
      if (!m || !(m[1] in node.attrs) || (m[2] !== undefined && node.attrs[m[1]] !== m[2])) return null;
      spec = add(spec, [0, 1, 0]);
    } else if (s[0] === ":") {
      if (s === ":root") {
        if (node.parent) return null;
        spec = add(spec, [0, 1, 0]);
        continue;
      }
      const m = /^:(where|is|not)\(([\s\S]*)\)$/.exec(s);
      if (!m) return null; // a state pseudo-class does not apply at rest
      const hits = split(m[2], ",").map((a) => matchComplex(compounds(a), node)).filter(Boolean);
      if (m[1] === "not" ? hits.length : !hits.length) return null;
      if (m[1] !== "where") {
        const specs = m[1] === "not" ? split(m[2], ",").map(rawSpecificity) : hits;
        spec = add(spec, specs.sort(cmp).at(-1));
      }
    } else {
      if (node.tag !== s) return null;
      spec = add(spec, [0, 0, 1]);
    }
  }
  return spec;
}

function rawSpecificity(selector) {
  let spec = [0, 0, 0];
  for (const { text } of compounds(selector)) {
    for (const s of simples(text)) spec = add(spec, /^[.[:]/.test(s) ? [0, 1, 0] : s === "*" ? [0, 0, 0] : [0, 0, 1]);
  }
  return spec;
}

function matchComplex(parts, node) {
  if (!parts.length) return null;
  const last = parts.at(-1);
  const own = matchCompound(simples(last.text), node);
  if (!own) return null;
  if (parts.length === 1) return own;
  const rest = parts.slice(0, -1);
  const candidates = [];
  if (last.combinator === ">") candidates.push(node.parent);
  else if (last.combinator === " ") for (let p = node.parent; p; p = p.parent) candidates.push(p);
  else candidates.push(node.prev);
  for (const c of candidates) {
    const spec = c && matchComplex(rest, c);
    if (spec) return add(own, spec);
  }
  return null;
}

function matchSelector(selector, node, pseudo = "") {
  const parts = compounds(selector);
  if (!parts.length) return null;
  const list = simples(parts.at(-1).text);
  const found = list.find((s) => PSEUDO_ELEMENT.test(s)) ?? "";
  if (found.replace(/^:+/, "") !== pseudo) return null;
  const kept = list.filter((s) => s !== found);
  parts[parts.length - 1] = { ...parts.at(-1), text: kept.join("") || "*" };
  return matchComplex(parts, node);
}

/** The declarations that apply to a node at rest, weakest first. */
function applied(node, pseudo = "") {
  const hits = [];
  for (const rule of RULES) {
    if (rule.context.length) continue;
    const specs = rule.selectors.map((s) => matchSelector(s, node, pseudo)).filter(Boolean);
    if (specs.length) hits.push({ rule, spec: specs.sort(cmp).at(-1) });
  }
  hits.sort((a, b) => cmp(a.spec, b.spec) || a.rule.order - b.rule.order);
  const decls = hits.flatMap((h) => h.rule.decls);
  const important = (d) => /!\s*important$/.test(d[1]);
  return [...decls.filter((d) => !important(d)), ...decls.filter(important)].map(([p, v]) => [p, v.replace(/\s*!\s*important$/, "")]);
}

const last = (decls, ...props) => decls.filter(([p]) => props.includes(p)).at(-1)?.[1];

/** value with var() expanded as seen from node; `stop` names stay symbolic. */
function expand(value, node, stop, depth = 0) {
  assert.ok(depth < 20, `var() cycle in ${value}`);
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("var(", i);
    if (at < 0) return out + value.slice(i);
    let open = 0;
    let end = at + 3;
    for (; end < value.length; end++) {
      if (value[end] === "(") open++;
      if (value[end] === ")" && --open === 0) break;
    }
    const inner = value.slice(at + 4, end);
    const comma = scan(inner, 0, ",");
    const name = inner.slice(0, comma).trim();
    const fallback = comma < inner.length ? inner.slice(comma + 1).trim() : null;
    let replacement = `var(${name})`;
    if (!stop(name)) {
      let from = node;
      let found;
      for (; from; from = from.parent) {
        found = last(applied(from), name);
        if (found !== undefined) break;
      }
      if (found !== undefined && found !== "initial") replacement = expand(found, from, stop, depth + 1);
      else if (fallback !== null) replacement = expand(fallback, node, stop, depth + 1);
    }
    out += value.slice(i, at) + replacement;
    i = end + 1;
  }
  return out;
}

const isSlToken = (name) => name.startsWith("--sl-");

function tree(theme, frameClasses = ["sl-card", "sl-card--bezel"]) {
  const node = (tag, classes, parent, attrs = {}) => ({ tag, classes, parent, attrs, prev: null });
  const root = node("html", [], null, { "data-sl-theme": theme });
  const body = node("body", [], root);
  const frame = node("article", frameClasses, body);
  const stage = node("div", ["sl-card__stage"], frame);
  const caption = node("div", ["sl-card__caption"], frame);
  caption.prev = stage;
  return { root, body, frame, stage, caption };
}

const NEW_CLASS = /\.(sl-card--bezel|sl-card__stage|sl-card__caption)(?![\w-])/;
const newRules = () => RULES.filter((r) => r.selectors.some((s) => NEW_CLASS.test(s)));

function requireBezelRules() {
  for (const cls of ["sl-card--bezel", "sl-card__stage", "sl-card__caption"]) {
    const re = new RegExp(`\\.${cls}(?![\\w-])`);
    assert.ok(
      RULES.some((r) => r.decls.length && r.selectors.some((s) => re.test(s))),
      `components.css has no rule for .${cls}`,
    );
  }
}

// ---- lengths, borders, shadows ----

function px(value, node) {
  const scales = { space: TOKENS.shared.space, radius: TOKENS.shared.radius };
  let v = expand(value, node, isSlToken).replace(/var\(--sl-(space|radius)-([\w-]+)\)/g, (all, kind, step) => scales[kind][step] ?? all);
  v = v.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${Number(n) * 16}px`);
  v = v.replace(/calc/g, "").replace(/px\b/g, "");
  assert.ok(/^[\d\s.+\-*/()]+$/.test(v), `cannot read "${value}" as a length`);
  return Function(`"use strict"; return (${v});`)();
}

/** The computed top, right and left of `padding` or `margin`, in px. */
function box(node, prop) {
  const sides = { top: "0", right: "0", left: "0" };
  const set = (keys, values) => keys.forEach((k, i) => (sides[k] = values[i] ?? values[0]));
  for (const [p, v] of applied(node)) {
    const parts = split(v, " ");
    if (p === prop) {
      sides.top = parts[0];
      sides.right = parts[1] ?? parts[0];
      sides.left = parts[3] ?? sides.right;
    } else if (p === `${prop}-inline`) set(["left", "right"], parts);
    else if (p === `${prop}-block` || p === `${prop}-block-start` || p === `${prop}-top`) sides.top = parts[0];
    else if (p === `${prop}-inline-start` || p === `${prop}-left`) sides.left = parts[0];
    else if (p === `${prop}-inline-end` || p === `${prop}-right`) sides.right = parts[0];
  }
  return Object.fromEntries(Object.entries(sides).map(([k, v]) => [k, px(v, node)]));
}

const SIDES = ["top", "right", "bottom", "left"];
const STYLE = /^(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/;
const WIDTH = /^(0|-?\d*\.?\d+(px|rem|em)|thin|medium|thick)$/;

function borders(node) {
  const state = Object.fromEntries(SIDES.map((s) => [s, { width: "medium", style: "none", color: "currentcolor" }]));
  const logical = { block: ["top", "bottom"], inline: ["left", "right"], "block-start": ["top"], "block-end": ["bottom"], "inline-start": ["left"], "inline-end": ["right"] };
  for (const [prop, raw] of applied(node)) {
    const m = /^border(?:-(top|right|bottom|left|block-start|block-end|inline-start|inline-end|block|inline))?(?:-(width|style|color))?$/.exec(prop);
    if (!m) continue;
    const sides = m[1] ? logical[m[1]] ?? [m[1]] : SIDES;
    const value = expand(raw, node, isSlToken);
    const parts = split(value, " ");
    sides.forEach((side) => {
      const target = state[side];
      if (m[2]) {
        const index = m[1] ? 0 : SIDES.indexOf(side);
        target[m[2]] = m[2] === "color" ? value : parts[index] ?? parts[index % 2] ?? parts[0];
      } else if (value === "none" || value === "0") {
        Object.assign(target, { width: "0", style: "none" });
      } else {
        target.width = parts.find((p) => WIDTH.test(p)) ?? "medium";
        target.style = parts.find((p) => STYLE.test(p)) ?? "none";
        target.color = parts.find((p) => !WIDTH.test(p) && !STYLE.test(p)) ?? "currentcolor";
      }
    });
  }
  return state;
}

const drawn = (b) => b.style !== "none" && b.style !== "hidden" && !/^0(px|rem|em)?$/.test(b.width);

const ALPHA_ROLES = ["--slc-lit", "--slc-border", "--slc-border-subtle", "--slc-border-strong", "--slc-edge-hairline"];
const keepInShadow = (name) => isSlToken(name) || ALPHA_ROLES.includes(name);

/** The visible box-shadow layers of the frame and its two pseudo-elements. */
function shadowLayers(node) {
  const layers = [];
  for (const pseudo of ["", "before", "after"]) {
    const decls = applied(node, pseudo);
    if (pseudo && last(decls, "content") === undefined) continue;
    let value = last(decls, "box-shadow");
    if (value === undefined) continue;
    // custom properties declared for a pseudo-element resolve on it first
    value = value.replace(/var\((--[\w-]+)\)/g, (all, name) => (pseudo ? last(decls, name) ?? all : all));
    for (const layer of split(expand(value, node, keepInShadow), ",")) {
      const tokens = split(layer, " ");
      const lengths = tokens.filter((t) => /^-?\d*\.?\d+(px)?$/.test(t)).map((t) => parseFloat(t));
      if (lengths.length < 2) continue;
      const [x, y, blur = 0, spread = 0] = lengths;
      if (!x && !y && !blur && !spread) continue; // an empty shadow
      const colour = tokens.filter((t) => t !== "inset" && !/^-?\d*\.?\d+(px)?$/.test(t)).join(" ");
      layers.push({ x, y, blur, spread, inset: tokens.includes("inset"), colour, text: layer });
    }
  }
  return layers;
}

/** An alpha written into the colour expression itself. */
function hasOwnAlpha(colour) {
  if (/^color-mix\(.*\btransparent\b.*\)$/.test(colour)) return true;
  return /\/\s*(0?\.\d+|\d{1,2}(\.\d+)?%|calc\(|var\()[^/]*\)$/.test(colour);
}

/** Translucent in light and dark, where the line and lit roles are alpha values. */
function isAlpha(colour) {
  if (!colour || colour === "transparent") return false;
  if (/^var\((--sl-border-[\w-]+|--slc-lit|--slc-border(-subtle|-strong)?|--slc-edge-hairline)\)$/.test(colour)) return true;
  return hasOwnAlpha(colour);
}

// ---- 1. the rules exist ----

test("components.css has rules for the bezel card, its stage and its caption", () => {
  requireBezelRules();
});

// ---- 2. concentric radii ----

test("the bezel frame is radius lg, the stage radius sm, and the inset is 8px", () => {
  requireBezelRules();
  for (const theme of ["light", "dark"]) {
    const { frame, stage } = tree(theme);
    const radius = (node) => expand(last(applied(node), "border-radius") ?? "0", node, isSlToken);
    assert.equal(radius(frame), "var(--sl-radius-lg)", `${theme}: frame radius`);
    assert.equal(radius(stage), "var(--sl-radius-sm)", `${theme}: stage radius`);
    const padding = box(frame, "padding");
    const margin = box(stage, "margin");
    for (const side of ["top", "left", "right"]) {
      assert.equal(padding[side] + margin[side], 8, `${theme}: ${side} inset between frame and stage`);
    }
  }
});

// ---- 3. rungs ----

test("the frame is painted from the surface rung and the stage from a darker rung", () => {
  requireBezelRules();
  const rungs = /^--slc-(surface|canvas|sunken|raised|tile)$/;
  const stop = (name) => isSlToken(name) || rungs.test(name);
  for (const theme of ["light", "dark"]) {
    const { frame, stage } = tree(theme);
    const fill = (node) => {
      const value = last(applied(node), "background", "background-color");
      assert.ok(value, `${theme}: .${node.classes.at(-1)} paints no background`);
      return expand(value, node, stop).replace(/\s+(padding|border|content)-box/g, "");
    };
    assert.match(fill(frame), /^var\(--(slc-surface|sl-bg-surface)\)$/, `${theme}: frame fill`);
    assert.match(fill(stage), /^var\(--(slc-canvas|slc-sunken|sl-bg-canvas|sl-bg-sunken)\)$/, `${theme}: stage fill`);
  }
});

// ---- 4. alpha hairlines in light and dark ----

test("light and dark: no CSS border, and alpha hairlines for a lit top, a ring and a shaded bottom", () => {
  requireBezelRules();
  for (const theme of ["light", "dark"]) {
    const nodes = tree(theme);
    for (const name of ["frame", "stage", "caption"]) {
      const state = borders(nodes[name]);
      for (const side of SIDES) assert.ok(!drawn(state[side]), `${theme}: ${name} draws a CSS border on its ${side}`);
    }
    const layers = shadowLayers(nodes.frame);
    const hair = (l) => l.x === 0 && l.blur === 0 && Math.abs(l.y) <= 2;
    const edges = {
      "lit top": layers.find((l) => hair(l) && l.inset && l.y > 0),
      "ring": layers.find((l) => hair(l) && l.y === 0 && l.spread === 1),
      "shaded bottom": layers.find((l) => hair(l) && (l.inset ? l.y < 0 : l.y > 0)),
    };
    for (const [what, layer] of Object.entries(edges)) {
      assert.ok(layer, `${theme}: no ${what} hairline among ${JSON.stringify(layers.map((l) => l.text))}`);
      assert.ok(isAlpha(layer.colour), `${theme}: the ${what} hairline is not translucent: ${layer.text}`);
    }
  }
});

// ---- 5. high contrast ----

test("high contrast: a solid 1px edge replaces the alpha hairlines", () => {
  requireBezelRules();
  const { frame } = tree("high-contrast");
  const state = borders(frame);
  const layers = shadowLayers(frame);
  if (SIDES.some((s) => drawn(state[s]))) {
    for (const side of SIDES) {
      assert.equal(state[side].style, "solid", `${side} border style`);
      assert.equal(state[side].width, "1px", `${side} border width`);
      assert.notEqual(state[side].color, "transparent", `${side} border colour`);
    }
    assert.deepEqual(layers.map((l) => l.text), [], "the hairlines must be gone beside the solid border");
  } else {
    assert.equal(layers.length, 1, `expected one solid ring, got ${JSON.stringify(layers.map((l) => l.text))}`);
    const [ring] = layers;
    assert.deepEqual([ring.x, ring.y, ring.blur, ring.spread], [0, 0, 0, 1], ring.text);
    // the line roles are opaque in high contrast, so only a written alpha counts
    assert.ok(!hasOwnAlpha(ring.colour) && ring.colour !== "transparent", `the high contrast edge is not solid: ${ring.text}`);
  }
});

// ---- 6. no literal colour, no new token ----

const NAMED =
  /(?<![\w-])(black|white|gray|grey|silver|red|green|blue|yellow|orange|purple|pink|brown|cyan|magenta|teal|navy|maroon|olive|lime|aqua|fuchsia|indigo|violet|gold|beige|ivory|whitesmoke|gainsboro|dimgray|darkgray|lightgray|slategray)(?![\w-])/i;

test("the bezel rules use no literal colour and no new --sl- token", () => {
  requireBezelRules();
  const decls = [
    ...newRules().flatMap((r) => r.decls),
    ...RULES.flatMap((r) => r.decls).filter(([p]) => p.startsWith("--") && p.includes("bezel")),
  ];
  const tokenCss = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"]
    .map((f) => read(`packages/ui-kit/${f}`))
    .join("\n");
  const existing = new Set([...tokenCss.matchAll(/(--sl-[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const [prop, value] of decls) {
    const at = `${prop}: ${value}`;
    const bare = value.replace(/--[\w-]+/g, "");
    assert.doesNotMatch(bare, /#[0-9a-f]{3,8}\b/i, `hex colour in "${at}"`);
    assert.doesNotMatch(bare, /(?<![\w-])(rgba?|hsla?|hwb|color)\(/i, `colour function literal in "${at}"`);
    assert.doesNotMatch(bare, /(?<![\w-])(ok)?(lab|lch)\(\s*(?!from\b)/i, `absolute lab or lch colour in "${at}"`);
    assert.doesNotMatch(bare, NAMED, `named colour in "${at}"`);
    assert.ok(!prop.startsWith("--sl-"), `the bezel rules declare a --sl- token: ${at}`);
    for (const [, name] of value.matchAll(/var\(\s*(--sl-[\w-]+)/g)) {
      assert.ok(existing.has(name), `"${at}" reads ${name}, which the token CSS does not declare`);
    }
  }
  assert.doesNotMatch(read("sondalab.tokens.json"), /bezel/i, "sondalab.tokens.json gained a bezel entry");
});

// ---- 7. the plain card ----

const PLAIN_CARD = {
  ".sl-card": [
    ["background", "var(--slc-surface)"],
    ["border", "1px solid var(--slc-edge-surface)"],
    ["border-radius", "var(--sl-radius-lg, 14px)"],
    ["padding", "var(--sl-space-5, 1.5rem)"],
  ],
  ".sl-card__title": [
    ["font-family", "var(--sl-font-display, system-ui, sans-serif)"],
    ["font-size", "var(--sl-text-lg, 1.125rem)"],
    ["font-weight", "600"],
    ["letter-spacing", "-0.02em"],
    ["color", "var(--slc-text)"],
    ["margin", "0 0 var(--sl-space-2, 0.5rem)"],
  ],
  ".sl-card__body": [
    ["font-family", "var(--sl-font-sans, system-ui, sans-serif)"],
    ["font-size", "var(--sl-text-sm, 0.875rem)"],
    ["line-height", "var(--sl-line-normal, 1.5)"],
    ["color", "var(--slc-text-secondary)"],
    ["margin", "0"],
  ],
};

test("adding the bezel variant leaves every declaration of the plain card as it was", () => {
  requireBezelRules();
  for (const [selector, decls] of Object.entries(PLAIN_CARD)) {
    const own = RULES.filter((r) => !r.context.length && r.selectors.includes(selector));
    assert.deepEqual(own.map((r) => r.decls), [decls], `the ${selector} rule changed or was repeated`);
  }
  assert.ok(
    !RULES.some((r) => r.selectors.some((s) => /^\.sl-card(__title|__body)?::?(before|after)$/.test(s))),
    "a rule now styles a pseudo-element of the plain card",
  );
  for (const theme of ["light", "dark", "high-contrast"]) {
    const { frame } = tree(theme, ["sl-card"]);
    const title = { tag: "h3", classes: ["sl-card__title"], attrs: {}, parent: frame, prev: null };
    const body = { tag: "div", classes: ["sl-card__body"], attrs: {}, parent: frame, prev: title };
    for (const node of [frame, title, body]) {
      const selector = `.${node.classes[0]}`;
      for (const pseudo of ["", "before", "after"]) {
        for (const rule of newRules()) {
          assert.ok(
            !rule.selectors.some((s) => matchSelector(s, node, pseudo)),
            `${theme}: a bezel rule reaches a plain card: ${rule.selectors.join(", ")}`,
          );
        }
      }
      for (const [prop, value] of PLAIN_CARD[selector]) {
        assert.equal(last(applied(node), prop), value, `${theme}: ${selector} ${prop}`);
      }
    }
  }
});

// ---- 8. catalog ----

const htmlFences = (md) => [...md.matchAll(/```html\n([\s\S]*?)```/g)].map((m) => m[1]);
const hasClass = (html, cls) => [...html.matchAll(/class="([^"]*)"/g)].some((m) => m[1].split(/\s+/).includes(cls));
const BEZEL_CLASSES = ["sl-card--bezel", "sl-card__stage", "sl-card__caption"];

function audit(css, file) {
  const cssTexts = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"].map((f) =>
    read(`packages/ui-kit/${f}`),
  );
  return auditCss({
    css,
    allowlistBases: allowlistForProduct({ cssTexts, neutrals: readJson("packages/ui-kit/neutrals.json"), product: "default" }),
    accentEntry: resolveAccentEntry(readJson("packages/ui-kit/agent/accent-registry.json"), "default"),
    substrate: "Page",
    matrix: readJson("packages/ui-kit/agent/substrate-matrix.json"),
    file,
  }).findings;
}

test("the catalog documents sl-card--bezel with one clean html example and indexes its classes", () => {
  const examples = htmlFences(read("packages/ui-kit/agent/catalog.md")).filter((f) => hasClass(f, "sl-card--bezel"));
  assert.equal(examples.length, 1, "catalog.md must have exactly one html example with sl-card--bezel");
  for (const cls of BEZEL_CLASSES) assert.ok(hasClass(examples[0], cls), `the example does not use ${cls}`);
  assert.ok(hasClass(examples[0], "sl-card"), "the variant is built on sl-card");
  assert.deepEqual(audit(examples[0], "catalog.md"), []);
  const listed = readJson("packages/ui-kit/agent/catalog.json").components.flatMap((c) => c.classes);
  for (const cls of BEZEL_CLASSES) assert.ok(listed.includes(cls), `catalog.json does not list ${cls}`);
  const card = buildDesignMd().split("#### `card`\n")[1]?.split("\n#### ")[0] ?? "";
  assert.equal(
    card.trim(),
    [
      "```html",
      '<article class="sl-card">',
      '  <h3 class="sl-card__title">Migration report</h3>',
      '  <div class="sl-card__body">2 R-violations resolved, 1 blessed.</div>',
      "</article>",
      "```",
    ].join("\n"),
    "DESIGN.md's card example must stay the plain card",
  );
});

// ---- 9. flavour.md ----

const NOT_SHIPPED = /not(\s+yet)?\s+(been\s+)?shipped|chosen,\s+not|it\s+is\s+not\s+in|until\s+it\s+ships|shipped\s+card\s+(stays|is)\s+the\s+one/i;

test("flavour.md section 2 says the bezel card ships as sl-card--bezel", () => {
  const section = read("packages/ui-kit/agent/flavour.md").split(/^## /m).find((s) => s.startsWith("2 "));
  assert.ok(section, "flavour.md has no section 2");
  const [heading, ...rest] = section.split("\n");
  const paragraph = rest.join("\n").trim().split(/\n\s*\n/)[0];
  assert.match(heading, /bezel card/i);
  assert.match(heading, /ship|sl-card--bezel/i, "the heading does not say the card ships");
  assert.doesNotMatch(heading, NOT_SHIPPED);
  assert.match(paragraph, /\bship(s|ped)\b/i, "the first paragraph does not say the card ships");
  assert.match(paragraph, /sl-card--bezel/);
  assert.doesNotMatch(paragraph, NOT_SHIPPED);
});

// ---- 10 and 11. DESIGN.md ----

function bezelEntry(designMd) {
  const lines = designMd.split("\n");
  const from = lines.findIndex((l) => /^- \*\*Bezel card\*\*/.test(l));
  assert.ok(from >= 0, "DESIGN.md has no bezel card entry");
  let to = from + 1;
  while (to < lines.length && /^\s+\S/.test(lines[to])) to++;
  return lines.slice(from, to).join("\n");
}

test("the generated DESIGN.md bezel card entry names sl-card--bezel as shipped", () => {
  const entry = bezelEntry(buildDesignMd());
  assert.match(entry, /sl-card--bezel/);
  assert.doesNotMatch(entry, NOT_SHIPPED);
});

test("the committed DESIGN.md is the generator's output and carries the shipped bezel card", () => {
  const committed = read("packages/ui-kit/agent/DESIGN.md");
  assert.equal(committed, buildDesignMd(), "run npm run gen:tokens");
  assert.match(bezelEntry(committed), /sl-card--bezel/);
});

// ---- 12. showcase ----

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

function parseHtml(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  const root = { tag: "#root", classes: [], parent: null };
  const elements = [];
  let current = root;
  for (const m of clean.matchAll(/<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g)) {
    const [, close, name, attrs] = m;
    const tag = name.toLowerCase();
    if (close) {
      let n = current;
      while (n !== root && n.tag !== tag) n = n.parent;
      if (n !== root) current = n.parent;
      continue;
    }
    const cls = /(?:^|\s)class\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attrs);
    const element = { tag, classes: (cls?.[1] ?? cls?.[2] ?? "").split(/\s+/).filter(Boolean), parent: current };
    elements.push(element);
    if (!VOID.has(tag) && !attrs.trim().endsWith("/")) current = element;
  }
  return elements;
}

const ancestors = (e) => (e.parent ? [e.parent, ...ancestors(e.parent)] : []);

test("the showcase has a bezel card with a stage and a caption next to a plain card", () => {
  const elements = parseHtml(read("showcase/index.html"));
  const inside = (parent, cls) => elements.filter((e) => e.classes.includes(cls) && ancestors(e).includes(parent));
  const complete = elements.filter((e) => {
    if (!e.classes.includes("sl-card") || !e.classes.includes("sl-card--bezel")) return false;
    const stages = inside(e, "sl-card__stage");
    return stages.length > 0 && inside(e, "sl-card__caption").some((c) => !ancestors(c).some((a) => stages.includes(a)));
  });
  assert.ok(complete.length, "no showcase card has sl-card sl-card--bezel with a stage and a caption outside the stage");
  const plain = elements.filter((e) => e.classes.includes("sl-card") && !e.classes.includes("sl-card--bezel"));
  const page = new Set(["#root", "html", "body", "main"]);
  const neighbours = complete.some((bezel) =>
    plain.some((card) => {
      const shared = ancestors(bezel).find((a) => ancestors(card).includes(a));
      return shared && !page.has(shared.tag);
    }),
  );
  assert.ok(neighbours, "no plain sl-card shares a section or wrapper with the bezel card");
});

// ---- 13. sl-audit ----

test("sl-audit reports no findings on the shipped bezel styles and catalog example", () => {
  requireBezelRules();
  const css = newRules()
    .map((r) => `${r.selectors.join(", ")} {\n${r.decls.map(([p, v]) => `  ${p}: ${v};`).join("\n")}\n}`)
    .join("\n");
  assert.deepEqual(audit(css, "components.css"), []);
  const examples = htmlFences(read("packages/ui-kit/agent/catalog.md")).filter((f) => hasClass(f, "sl-card--bezel"));
  assert.ok(examples.length, "catalog.md has no bezel example");
  assert.deepEqual(audit(examples.join("\n"), "catalog.md"), []);
});
