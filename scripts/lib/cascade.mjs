/* A small CSS cascade for the kit's tests: which declarations reach a mock
   element, at what weight, and what its custom properties compute to. It
   stands in for a browser where a test needs the cascade itself -- a
   consumer's override against the kit's rules, a state rule against the
   focus rule, a role re-bound on a subtree -- and not one rule read alone.

   Covered: flat style rules inside @media / @supports blocks (conditions
   evaluated from flags), compound selectors of type, class, attribute,
   :root, the state pseudo-classes, :not / :is / :where (:has never
   matches), descendant and child combinators (sibling combinators match a
   declared previous sibling only), specificity, !important, source order,
   and custom-property inheritance through scope() in css-color.mjs.
   Not covered: pseudo-elements (a part naming one never matches an
   element), @layer, shadow DOM, and anything a layout engine decides. */
import { scope, substitute } from "./css-color.mjs";

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Top-level comma split of a selector list. */
export function splitList(list) {
  const out = [];
  let d = 0, f = 0;
  for (let i = 0; i <= list.length; i++) {
    const ch = list[i];
    if (ch === "(" || ch === "[") d++;
    else if (ch === ")" || ch === "]") d--;
    else if ((ch === "," && d === 0) || i === list.length) { out.push(list.slice(f, i).trim()); f = i + 1; }
  }
  return out.filter(Boolean);
}

/** Specificity [a, b, c] of one complex selector. */
export function specificity(sel) {
  const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  let a = 0, b = 0, c = 0, i = 0;
  const word = () => { while (i < sel.length && /[\w-]/.test(sel[i])) i++; };
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === "#") { a++; i++; word(); }
    else if (ch === ".") { b++; i++; word(); }
    else if (ch === "[") { b++; i = sel.indexOf("]", i) + 1; }
    else if (ch === ":" && sel[i + 1] === ":") { c++; i += 2; word(); }
    else if (ch === ":") {
      i++; const start = i; word(); const name = sel.slice(start, i);
      if (sel[i] === "(") {
        let d = 1, j = i + 1; while (d) { if (sel[j] === "(") d++; else if (sel[j] === ")") d--; j++; }
        const inner = sel.slice(i + 1, j - 1); i = j;
        if (name === "where") continue;
        if (["is", "not", "has"].includes(name)) { const best = splitList(inner).map(specificity).sort(cmp).pop(); a += best[0]; b += best[1]; c += best[2]; continue; }
      }
      b++;
    }
    else if (/[a-zA-Z*]/.test(ch)) { if (ch !== "*") c++; i++; word(); }
    else i++;
  }
  return [a, b, c];
}

/** The style rules of a stylesheet, flattened: [{ parts, decls, order }].
 *  `flags` decides the conditional blocks: forcedColors, reducedMotion,
 *  hover (default true), backdrop (@supports backdrop-filter, default true). */
export function parseSheet(css, flags = {}, orderBase = 0) {
  const f = { forcedColors: false, reducedMotion: false, hover: true, backdrop: true, ...flags };
  const src = strip(css);
  const rules = [];
  let order = orderBase;
  const cond = (prelude) => {
    if (/^@media/.test(prelude)) {
      if (/forced-colors:\s*active/.test(prelude)) return f.forcedColors;
      if (/prefers-reduced-motion:\s*reduce/.test(prelude)) return f.reducedMotion;
      if (/prefers-reduced-motion:\s*no-preference/.test(prelude)) return !f.reducedMotion;
      if (/hover:\s*hover/.test(prelude)) return f.hover;
      return true;
    }
    if (/^@supports/.test(prelude)) {
      const neg = /^@supports\s+not\b/.test(prelude);
      const yes = /backdrop-filter/.test(prelude) ? f.backdrop : true;
      return neg ? !yes : yes;
    }
    return null;
  };
  const walk = (from, to) => {
    let i = from;
    while (i < to) {
      const open = src.indexOf("{", i);
      if (open < 0 || open >= to) break;
      const semi = src.indexOf(";", i);
      if (semi > -1 && semi < open && /^\s*@/.test(src.slice(i, semi))) { i = semi + 1; continue; }
      const prelude = src.slice(i, open).trim();
      let d = 1, j = open + 1;
      while (d && j < to) { if (src[j] === "{") d++; else if (src[j] === "}") d--; j++; }
      const body = src.slice(open + 1, j - 1);
      if (prelude.startsWith("@")) {
        const c = cond(prelude);
        if (c) walk(open + 1, j - 1);
      } else if (!body.includes("{")) {
        const decls = [];
        for (const raw of body.split(/;(?![^(]*\))/)) {
          const m = raw.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/);
          if (!m) continue;
          const important = /!important\s*$/.test(m[2]);
          decls.push([m[1], m[2].replace(/\s*!important\s*$/, "").replace(/\s+/g, " "), important]);
        }
        rules.push({ parts: splitList(prelude.replace(/\s+/g, " ")), decls, order: order++ });
      }
      i = j;
    }
  };
  walk(0, src.length);
  return rules;
}

/** A mock element: { tag, classes, attrs, states, parent, prev }. */
export function el({ tag = "div", classes = [], attrs = {}, states = [], parent = null, prev = null } = {}) {
  return { tag, classes: new Set(classes), attrs: new Map(Object.entries(attrs)), states: new Set(states), parent, prev };
}

/** Splits a complex selector into [combinator, compound] pairs, right to left. */
function compounds(sel) {
  const out = [];
  let d = 0, cur = "", comb = " ";
  const push = () => { if (cur.trim()) out.push([comb, cur.trim()]); cur = ""; };
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === "(" || ch === "[") d++;
    else if (ch === ")" || ch === "]") d--;
    if (d === 0 && /[\s>+~]/.test(ch)) {
      if (cur.trim()) { push(); comb = " "; }
      if (ch !== " ") comb = ch;
      continue;
    }
    cur += ch;
  }
  push();
  return out;
}

/** Does one compound selector match the element? */
function matchCompound(c, e) {
  if (/::/.test(c)) return false;
  let i = 0;
  const word = () => { const s = i; while (i < c.length && /[\w-]/.test(c[i])) i++; return c.slice(s, i); };
  while (i < c.length) {
    const ch = c[i];
    if (ch === "*") { i++; continue; }
    if (/[a-zA-Z]/.test(ch)) { if (word() !== e.tag) return false; continue; }
    if (ch === ".") { i++; if (!e.classes.has(word())) return false; continue; }
    if (ch === "[") {
      const end = c.indexOf("]", i);
      const m = c.slice(i + 1, end).match(/^([\w-]+)(?:([*^$~|]?=)"?([^"]*)"?)?$/);
      i = end + 1;
      if (!m || !e.attrs.has(m[1])) return false;
      const v = e.attrs.get(m[1]);
      if (m[2] === "=" && v !== m[3]) return false;
      if (m[2] === "*=" && !v.includes(m[3])) return false;
      continue;
    }
    if (ch === ":") {
      i++; const name = word();
      if (c[i] === "(") {
        let d = 1, j = i + 1; while (d) { if (c[j] === "(") d++; else if (c[j] === ")") d--; j++; }
        const inner = c.slice(i + 1, j - 1); i = j;
        if (name === "not") { if (splitList(inner).some((s) => matches(s, e))) return false; continue; }
        if (name === "is" || name === "where") { if (!splitList(inner).some((s) => matches(s, e))) return false; continue; }
        return false; // :has() and the rest
      }
      if (name === "root") { if (e.parent) return false; continue; }
      if (!e.states.has(name)) return false;
      continue;
    }
    i++;
  }
  return true;
}

/** Does a complex selector match the element? */
export function matches(sel, e) {
  const cs = compounds(sel);
  const step = (k, node) => {
    if (k < 0) return true;
    const c = cs[k][1];
    if (!matchCompound(c, node)) return false;
    if (k === 0) return true;
    const via = cs[k][0];
    if (via === ">") return node.parent ? step(k - 1, node.parent) : false;
    if (via === "+") return node.prev ? step(k - 1, node.prev) : false;
    if (via === "~") { for (let p = node.prev; p; p = p.prev) if (step(k - 1, p)) return true; return false; }
    for (let p = node.parent; p; p = p.parent) if (step(k - 1, p)) return true;
    return false;
  };
  return step(cs.length - 1, e);
}

const cmpSpec = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

/** Every declaration that reaches the element, winners first per property:
 *  Map prop -> { value, important, spec, order }. Custom properties too. */
export function cascaded(rules, e) {
  const won = new Map();
  for (const r of rules) {
    let best = null;
    for (const p of r.parts) if (matches(p, e)) { const s = specificity(p); if (!best || cmpSpec(s, best) > 0) best = s; }
    if (!best) continue;
    for (const [prop, value, important] of r.decls) {
      const cur = won.get(prop);
      const beats = !cur || (important !== cur.important ? important : (cmpSpec(best, cur.spec) || r.order - cur.order) > 0);
      if (beats) won.set(prop, { value, important, spec: best, order: r.order });
    }
  }
  return won;
}

/** The computed custom properties of an element (inherited down its parents). */
export function customs(rules, e) {
  const parent = e.parent ? customs(rules, e.parent) : null;
  const own = [...cascaded(rules, e)].filter(([k]) => k.startsWith("--")).map(([k, v]) => [k, v.value]);
  return scope(parent, own);
}

/** A length in px from a declared value (px, rem at 16px, calc/min/max). */
export function px(value, env, fontPx = 16) {
  const text = substitute(value, env).trim();
  const expr = text.replace(/(-?\d*\.?\d+)(px|rem|em)\b/g, (_, n, u) => String(parseFloat(n) * (u === "px" ? 1 : u === "rem" ? 16 : fontPx)))
    .replace(/\bcalc\(/g, "(").replace(/\bmin\(/g, "Math.min(").replace(/\bmax\(/g, "Math.max(");
  if (!/^[\d.\s+\-*/(),Mathinax]*$/.test(expr)) throw new Error(`not a length: ${text}`);
  return Function(`"use strict"; return (${expr});`)();
}

/** The four sides of a box property from its shorthand and longhands. */
function sides(won, short, longs, env, fontPx, parse) {
  const out = { top: 0, right: 0, bottom: 0, left: 0 };
  const entries = [];
  if (won.has(short)) entries.push([won.get(short), "all"]);
  for (const [side, prop] of Object.entries(longs)) if (won.has(prop)) entries.push([won.get(prop), side]);
  entries.sort((a, b) => (a[0].important - b[0].important) || cmpSpec(a[0].spec, b[0].spec) || a[0].order - b[0].order);
  for (const [d, which] of entries) {
    if (which === "all") {
      const v = parse(d.value);
      const [t, r = t, b = t, l = r] = v.map((x) => px(x, env, fontPx));
      Object.assign(out, { top: t, right: r, bottom: b, left: l });
    } else {
      const v = parse(d.value);
      which.split(",").forEach((s, k) => { out[s] = px(v[Math.min(k, v.length - 1)], env, fontPx); });
    }
  }
  return out;
}
const tokensOf = (v) => { const out = []; let d = 0, cur = ""; for (const ch of v) { if (ch === "(") d++; if (ch === ")") d--; if (ch === " " && d === 0) { if (cur) out.push(cur); cur = ""; } else cur += ch; } if (cur) out.push(cur); return out; };

/** The rendered border-box height of a single-line, line-height-driven box
 *  (a button, a field): borders + padding + line, read off the cascade. */
export function box(rules, e) {
  const won = cascaded(rules, e);
  const env = customs(rules, e);
  const fs = won.has("font-size") ? px(won.get("font-size").value, env) : 16;
  const lhRaw = won.get("line-height")?.value ?? "normal";
  const lhText = substitute(lhRaw, env).trim();
  const line = /^[\d.]+$/.test(lhText) ? parseFloat(lhText) * fs : px(lhText, env, fs);
  const padding = sides(won, "padding", { top: "padding-top", bottom: "padding-bottom", "top,bottom": "padding-block", left: "padding-left", right: "padding-right" }, env, fs, tokensOf);
  const width = (v) => {
    const t = tokensOf(substitute(v, env).trim());
    if (t.some((x) => x === "none" || x === "hidden")) return ["0"];
    const len = t.find((x) => /^(-?\d|calc\(|min\(|max\()/.test(x));
    return [len ?? "0"];
  };
  const border = sides(won, "border", { top: "border-top-width", bottom: "border-bottom-width", "top,bottom": "border-block-width" }, env, fs, width);
  if (won.has("border-width")) {
    const bw = won.get("border-width");
    const later = ["border", "border-top-width", "border-bottom-width"].every((p) => !won.has(p) || cmpSpec(won.get(p).spec, bw.spec) < 0 || (cmpSpec(won.get(p).spec, bw.spec) === 0 && won.get(p).order < bw.order));
    if (later) { const [t, , b = t] = tokensOf(substitute(bw.value, env)).map((x) => px(x, env, fs)); border.top = t; border.bottom = b; }
  }
  return { height: border.top + padding.top + line + padding.bottom + border.bottom, border, padding, line, fontSize: fs, won, env };
}
