/* A numeric evaluator for the colour vocabulary effects.css and the themes use:
   hex and rgba() literals, the transparent/white/black keywords, oklch() and
   oklab() absolute and relative (`from`), color(from … srgb-linear …),
   rgb(from …), color-mix() in srgb / srgb-linear / oklab / oklch, and the
   math functions (calc, min, max, clamp, pow) with the channel keywords bound the
   way CSS Color 5 binds them. var() is substituted textually before parsing,
   as the cascade does, so a custom property holding a bare expression over
   channel keywords works as a macro inside a relative colour.

   Conversions follow CSS Color 4: OKLab per Ottosson, the sRGB transfer
   extended symmetrically below zero and above one, no gamut clipping at any
   step — a colour outside sRGB keeps its out-of-range components, which is
   exactly what the gamut test needs to see. */

const toLin = (v) => { const a = Math.abs(v), s = Math.sign(v); return s * (a <= 0.04045 ? a / 12.92 : ((a + 0.055) / 1.055) ** 2.4); };
const toGam = (v) => { const a = Math.abs(v), s = Math.sign(v); return s * (a <= 0.0031308 ? 12.92 * a : 1.055 * a ** (1 / 2.4) - 0.055); };

export function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
export function oklabToLin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
const labToLch = ([L, a, b]) => { let h = (Math.atan2(b, a) * 180) / Math.PI; if (h < 0) h += 360; return [L, Math.hypot(a, b), h]; };
const lchToLab = ([L, C, h]) => { const r = (h * Math.PI) / 180; return [L, C * Math.cos(r), C * Math.sin(r)]; };

/** A colour is linear sRGB (unbounded) plus alpha. */
export const fromOklch = (lch, alpha = 1) => ({ lin: oklabToLin(lchToLab(lch)), alpha });
export const toOklch = (col) => labToLch(linToOklab(col.lin));
export const toSrgb = (col) => col.lin.map(toGam);
export const fromSrgb = (rgb, alpha = 1) => ({ lin: rgb.map(toLin), alpha });
export const fromHex = (hex) => {
  let s = hex.slice(1);
  if (s.length === 3 || s.length === 4) s = [...s].map((ch) => ch + ch).join("");
  const n = parseInt(s.slice(0, 6), 16);
  const alpha = s.length === 8 ? parseInt(s.slice(6), 16) / 255 : 1;
  return fromSrgb([(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255), alpha);
};
export const toHex = (col) => "#" + toSrgb(col).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");

/** How far outside the sRGB cube a colour lies, in linear light: 0 inside. */
export const gamutExcess = (col) => Math.max(0, -Math.min(...col.lin), Math.max(...col.lin) - 1);

/** Largest OKLCH chroma at (L, h) whose sRGB conversion stays inside the cube. */
export function maxChroma(L, h) {
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (gamutExcess(fromOklch([L, mid, h])) === 0) lo = mid; else hi = mid;
  }
  return lo;
}

// ── var() substitution ───────────────────────────────────────────────────────

/** Expands every var() in `text` against `env` (a Map name → declared value),
 *  fallbacks included, the way the cascade substitutes before parsing. */
export function substitute(text, env, seen = new Set()) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf("var(", i);
    if (at < 0) { out += text.slice(i); break; }
    out += text.slice(i, at);
    let depth = 1, j = at + 4;
    while (j < text.length && depth > 0) { if (text[j] === "(") depth++; else if (text[j] === ")") depth--; j++; }
    const inner = text.slice(at + 4, j - 1);
    const comma = inner.indexOf(",");
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
    if (seen.has(name)) throw new Error(`var() cycle through ${name}`);
    // `initial` on a custom property is the guaranteed-invalid value: var()
    // takes its fallback exactly as if the property were never declared.
    const declared = env.get(name);
    const value = declared?.trim() === "initial" ? undefined : declared;
    // A custom property whose own value reaches an unresolved var() with no
    // fallback is invalid at computed-value time, which makes it the
    // guaranteed-invalid value too: a var() naming it with a fallback takes
    // the fallback (the kit's --slc-accent-fill derivations rely on this).
    let expanded;
    if (value !== undefined) {
      try { expanded = substitute(value, env, new Set([...seen, name])); }
      catch (e) { if (fallback === null || !/^unresolved /.test(e.message)) throw e; }
    }
    if (expanded === undefined) {
      if (fallback === null) throw new Error(`unresolved ${name}`);
      out += substitute(fallback, env, seen);
    } else {
      out += expanded;
    }
    i = j;
  }
  return out;
}

// ── parsing ──────────────────────────────────────────────────────────────────

function tokenize(src) {
  const tokens = [];
  const re = /\s*(?:(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)(%|deg)?|(#[0-9a-fA-F]{3,8})|((?:--|-?[A-Za-z_])[A-Za-z0-9_-]*)(\()?|([(),/*+-]))/y;
  let m;
  re.lastIndex = 0;
  while (re.lastIndex < src.length) {
    const start = re.lastIndex;
    m = re.exec(src);
    if (!m) {
      if (/^\s*$/.test(src.slice(start))) break;
      throw new Error(`bad token near "${src.slice(start, start + 20)}"`);
    }
    if (m[1] !== undefined) tokens.push({ t: "num", v: parseFloat(m[1]), unit: m[2] || "" });
    else if (m[3]) tokens.push({ t: "hex", v: m[3] });
    else if (m[4]) tokens.push({ t: m[5] ? "fn" : "ident", v: m[4].toLowerCase() });
    else tokens.push({ t: "punct", v: m[6] });
  }
  return tokens;
}

const NAMED = { transparent: { lin: [0, 0, 0], alpha: 0 }, white: { lin: [1, 1, 1], alpha: 1 }, black: { lin: [0, 0, 0], alpha: 1 } };

class Parser {
  constructor(tokens) { this.tk = tokens; this.i = 0; }
  peek() { return this.tk[this.i]; }
  next() { return this.tk[this.i++]; }
  expect(t, v) {
    const tok = this.next();
    if (!tok || tok.t !== t || (v !== undefined && tok.v !== v)) throw new Error(`expected ${v ?? t}, got ${JSON.stringify(tok)}`);
    return tok;
  }
  isPunct(v) { const p = this.peek(); return p && p.t === "punct" && p.v === v; }

  /** A colour value. `env` binds channel keywords for a relative colour. */
  color(env = null) {
    const tok = this.next();
    if (!tok) throw new Error("expected a colour");
    if (tok.t === "hex") return fromHex(tok.v);
    if (tok.t === "ident") {
      if (NAMED[tok.v]) return NAMED[tok.v];
      throw new Error(`unknown colour keyword ${tok.v}`);
    }
    if (tok.t !== "fn") throw new Error(`expected a colour, got ${JSON.stringify(tok)}`);
    switch (tok.v) {
      case "oklch": return this.polar("oklch", env);
      case "oklab": return this.polar("oklab", env);
      case "color": return this.colorFn(env);
      case "rgb": case "rgba": return this.rgbFn(env);
      case "color-mix": return this.colorMix(env);
      default: throw new Error(`unsupported colour function ${tok.v}`);
    }
  }

  /** `from X` prefix: returns the channel environment for X, or null. */
  relative(env, channels) {
    const p = this.peek();
    if (!(p && p.t === "ident" && p.v === "from")) return null;
    this.next();
    const origin = this.color(env);
    return { origin, env: channels(origin) };
  }

  polar(kind, env) {
    const rel = this.relative(env, (o) => {
      const [L, a, b] = linToOklab(o.lin);
      const [, C, h] = labToLch([L, a, b]);
      return kind === "oklch" ? { l: L, c: C, h, alpha: o.alpha } : { l: L, a, b, alpha: o.alpha };
    });
    const local = rel ? rel.env : {};
    const c1 = this.number(local), c2 = this.number(local), c3 = this.number(local);
    let alpha = rel ? rel.origin.alpha : 1;
    if (this.isPunct("/")) { this.next(); alpha = this.number(local); }
    this.expect("punct", ")");
    alpha = Math.min(1, Math.max(0, alpha));
    const lab = kind === "oklch" ? lchToLab([c1, c2, c3]) : [c1, c2, c3];
    return { lin: oklabToLin(lab), alpha };
  }

  colorFn(env) {
    const rel = this.relative(env, () => ({}));
    const space = this.expect("ident").v;
    if (space !== "srgb" && space !== "srgb-linear") throw new Error(`unsupported color() space ${space}`);
    const local = rel ? this.spaceChannels(rel.origin, space) : {};
    const r = this.number(local), g = this.number(local), b = this.number(local);
    let alpha = rel ? rel.origin.alpha : 1;
    if (this.isPunct("/")) { this.next(); alpha = this.number(local); }
    this.expect("punct", ")");
    alpha = Math.min(1, Math.max(0, alpha));
    return space === "srgb" ? fromSrgb([r, g, b], alpha) : { lin: [r, g, b], alpha };
  }

  spaceChannels(origin, space) {
    const [r, g, b] = space === "srgb" ? toSrgb(origin) : origin.lin;
    return { r, g, b, alpha: origin.alpha };
  }

  rgbFn(env) {
    const rel = this.relative(env, (o) => { const [r, g, b] = toSrgb(o); return { r: r * 255, g: g * 255, b: b * 255, alpha: o.alpha }; });
    const local = rel ? rel.env : {};
    const chan = () => { const n = this.number(local); return n / 255; };
    const r = chan(); if (this.isPunct(",")) this.next();
    const g = chan(); if (this.isPunct(",")) this.next();
    const b = chan();
    let alpha = rel ? rel.origin.alpha : 1;
    if (this.isPunct("/") || this.isPunct(",")) { this.next(); alpha = this.number(local); }
    this.expect("punct", ")");
    return fromSrgb([r, g, b], Math.min(1, Math.max(0, alpha)));
  }

  colorMix(env) {
    this.expect("ident", "in");
    const space = this.expect("ident").v;
    this.expect("punct", ",");
    // A percentage is a literal, 0% to 100% (anything else voids the mix),
    // or a math function whose result is a percentage, clamped to that
    // range as CSS clamps a calculated one (calc(22% * min(1, 0.5 * 1000))).
    // A bare number is not a percentage here, in either form: browsers
    // reject color-mix(in srgb, red 0.22, …) and calc(0.22) alike.
    const pct = () => {
      const p = this.peek();
      if (p?.t === "num") {
        const tok = this.expect("num");
        if (tok.unit !== "%") throw new Error(`a color-mix weight must be a percentage, got ${tok.v}${tok.unit}`);
        if (tok.v < 0 || tok.v > 100) throw new Error(`a color-mix weight must be 0% to 100%, got ${tok.v}%`);
        return tok.v / 100;
      }
      if (p?.t === "fn" && ["calc", "min", "max", "clamp"].includes(p.v)) {
        const r = this.typed();
        if (!r.pct) throw new Error(`a color-mix weight must be a percentage, got the number ${r.v}`);
        return Math.min(1, Math.max(0, r.v));
      }
      return null;
    };
    const a = this.color(env);
    let pa = pct();
    this.expect("punct", ",");
    const b = this.color(env);
    let pb = pct();
    this.expect("punct", ")");
    if (pa === null && pb === null) { pa = pb = 0.5; }
    else if (pa === null) pa = 1 - pb;
    else if (pb === null) pb = 1 - pa;
    const sum = pa + pb;
    if (sum !== 1) { pa /= sum; pb /= sum; }
    return mix(space, a, pa, b, pb);
  }

  /** A math expression with its type: { v, pct } -- pct when the result is a
   *  percentage (v then a fraction). CSS typing: a sum's terms share a type,
   *  a product takes at most one percentage, a divisor is a number, and
   *  min/max/clamp take one type throughout. */
  typed() {
    const tok = this.next();
    if (!tok) throw new Error("expected a number");
    if (tok.t === "num") return tok.unit === "%" ? { v: tok.v / 100, pct: true } : { v: tok.v, pct: false };
    if (tok.t === "punct" && tok.v === "(") { const r = this.typedSum(); this.expect("punct", ")"); return r; }
    if (tok.t === "fn" && ["calc", "min", "max", "clamp"].includes(tok.v)) {
      const args = [];
      do { args.push(this.typedSum()); } while (this.isPunct(",") && this.next());
      this.expect("punct", ")");
      if (args.some((a) => a.pct !== args[0].pct)) throw new Error(`${tok.v}() mixes a percentage with a number`);
      const vs = args.map((a) => a.v);
      const v = tok.v === "calc" ? vs[0] : tok.v === "min" ? Math.min(...vs) : tok.v === "max" ? Math.max(...vs) : Math.min(Math.max(vs[1], vs[0]), vs[2]);
      return { v, pct: args[0].pct };
    }
    throw new Error(`unexpected ${JSON.stringify(tok)} in a typed expression`);
  }
  typedSum() {
    let a = this.typedProduct();
    while (this.isPunct("+") || this.isPunct("-")) {
      const op = this.next().v, b = this.typedProduct();
      if (a.pct !== b.pct) throw new Error("a sum mixes a percentage with a number");
      a = { v: op === "+" ? a.v + b.v : a.v - b.v, pct: a.pct };
    }
    return a;
  }
  typedProduct() {
    let a = this.typedUnary();
    while (this.isPunct("*") || this.isPunct("/")) {
      const op = this.next().v, b = this.typedUnary();
      if (op === "*") {
        if (a.pct && b.pct) throw new Error("a product of two percentages");
        a = { v: a.v * b.v, pct: a.pct || b.pct };
      } else {
        if (b.pct) throw new Error("a division by a percentage");
        a = { v: a.v / b.v, pct: a.pct };
      }
    }
    return a;
  }
  typedUnary() {
    if (this.isPunct("-")) { this.next(); const r = this.typedUnary(); return { v: -r.v, pct: r.pct }; }
    if (this.isPunct("+")) { this.next(); return this.typedUnary(); }
    return this.typed();
  }

  /** One channel value: a number, a channel keyword, or a math function.
   *  Bare arithmetic lives only inside calc()/min()/max()/clamp(); outside
   *  them a `/` is the alpha separator, not a division. */
  number(local) {
    return this.primary(local);
  }
  sum(local) {
    let v = this.product(local);
    while (this.isPunct("+") || this.isPunct("-")) {
      const op = this.next().v;
      const rhs = this.product(local);
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }
  product(local) {
    let v = this.unary(local);
    while (this.isPunct("*") || this.isPunct("/")) {
      const op = this.next().v;
      const rhs = this.unary(local);
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  }
  unary(local) {
    if (this.isPunct("-")) { this.next(); return -this.unary(local); }
    if (this.isPunct("+")) { this.next(); return this.unary(local); }
    return this.primary(local);
  }
  primary(local) {
    const tok = this.next();
    if (!tok) throw new Error("expected a number");
    if (tok.t === "num") {
      if (tok.unit === "%") return tok.v / 100;
      return tok.v;
    }
    if (tok.t === "punct" && tok.v === "(") { const v = this.sum(local); this.expect("punct", ")"); return v; }
    if (tok.t === "ident") {
      if (tok.v in local) return local[tok.v];
      throw new Error(`unbound keyword ${tok.v}`);
    }
    if (tok.t === "fn") {
      const args = [];
      do { args.push(this.sum(local)); } while (this.isPunct(",") && this.next());
      this.expect("punct", ")");
      switch (tok.v) {
        case "calc": return args[0];
        case "min": return Math.min(...args);
        case "max": return Math.max(...args);
        case "clamp": return Math.min(Math.max(args[1], args[0]), args[2]);
        case "pow": return Math.pow(args[0], args[1]);
        default: throw new Error(`unsupported math function ${tok.v}`);
      }
    }
    throw new Error(`unexpected ${JSON.stringify(tok)}`);
  }
}

/** Premultiplied interpolation in the given space (CSS Color 5 §2.2). */
function mix(space, a, pa, b, pb) {
  const alpha = a.alpha * pa + b.alpha * pb;
  const coords = (col) => {
    if (space === "srgb") return toSrgb(col);
    if (space === "srgb-linear") return col.lin;
    if (space === "oklab") return linToOklab(col.lin);
    if (space === "oklch") return toOklch(col);
    throw new Error(`unsupported color-mix space ${space}`);
  };
  let ca = coords(a), cb = coords(b);
  if (space === "oklch") {
    // A transparent side carries no hue: the other side's hue is kept.
    if (a.alpha === 0 || ca[1] < 1e-9) ca = [ca[0], ca[1], cb[2]];
    if (b.alpha === 0 || cb[1] < 1e-9) cb = [cb[0], cb[1], ca[2]];
    let d = cb[2] - ca[2];
    if (d > 180) ca = [ca[0], ca[1], ca[2] + 360]; else if (d < -180) cb = [cb[0], cb[1], cb[2] + 360];
  }
  const out = ca.map((va, i) => {
    const vb = cb[i];
    if (alpha === 0) return va * pa + vb * pb;
    return (va * a.alpha * pa + vb * b.alpha * pb) / alpha;
  });
  const lin = space === "srgb" ? out.map(toLin)
    : space === "srgb-linear" ? out
    : space === "oklab" ? oklabToLin(out)
    : oklabToLin(lchToLab([out[0], out[1], out[2] % 360]));
  return { lin, alpha };
}

// ── scopes: custom properties compute where they are declared ───────────────

/** The computed custom properties of an element, the way the cascade gives
 *  them: `decls` (the element's own declarations, a Map or [name, value]
 *  pairs, in cascade order) are var()-substituted against themselves and
 *  the parent's COMPUTED values, which they then inherit alongside. A value
 *  that is `initial` or reaches an unresolved var() without a fallback is
 *  the guaranteed-invalid value: the property is absent. Pass `parent` as
 *  `null` for the root.
 *  This is the difference a flat Map gets wrong: a role declared on :root
 *  as var(--x) is computed THERE, so re-binding --x on a descendant does not
 *  change what the descendant inherits, while a role declared on the
 *  descendant itself does follow it. */
export function scope(parent, decls) {
  const base = parent ? new Map(parent) : new Map();
  const own = new Map(decls instanceof Map ? decls : decls);
  const merged = new Map([...base, ...own]);
  const out = new Map(base);
  for (const name of own.keys()) {
    const value = merged.get(name);
    if (value.trim() === "initial") { out.delete(name); continue; }
    try { out.set(name, substitute(value, merged)); }
    catch (e) {
      if (!/^unresolved |^var\(\) cycle/.test(e.message)) throw e;
      out.delete(name);
    }
  }
  out.computed = true;
  return out;
}

/** An element under `env`: `env` is either a computed scope (a descendant)
 *  or a flat Map of the root's own declarations, which is computed first. */
export const within = (env, decls) => scope(env.computed ? env : scope(null, env), decls);

/** Evaluates one colour expression after var() substitution against `env`. */
export function evaluate(text, env) {
  const expanded = substitute(text, env);
  const p = new Parser(tokenize(expanded));
  const col = p.color(null);
  if (p.peek()) throw new Error(`trailing tokens in ${expanded}`);
  return col;
}

/** Custom-property declarations from every rule whose selector is in
 *  `selectors` (whitespace-normalised exact match), in source order — the
 *  cascade for an element matching all of them. Comments are stripped and
 *  nested at-rules descended. */
export function declarations(css, selectors) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const wanted = new Set(selectors.map((s) => s.replace(/\s+/g, " ").trim()));
  const found = new Set();
  const out = [];
  const walk = (from, to) => {
    let selStart = from, j = from;
    while (j < to) {
      if (src[j] === "}") { selStart = ++j; continue; }
      if (src[j] !== "{") { j++; continue; }
      let depth = 1, k = j + 1;
      while (k < to && depth > 0) { if (src[k] === "{") depth++; else if (src[k] === "}") depth--; k++; }
      const body = src.slice(j + 1, k - 1);
      if (body.includes("{")) walk(j + 1, k - 1);
      else {
        const selector = src.slice(selStart, j).trim().replace(/\s+/g, " ");
        if (wanted.has(selector)) {
          found.add(selector);
          for (const decl of body.split(";")) {
            const m = decl.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
            if (m) out.push([m[1], m[2]]);
          }
        }
      }
      selStart = k; j = k;
    }
  };
  walk(0, src.length);
  const missing = [...wanted].filter((s) => !found.has(s));
  if (missing.length) throw new Error(`selectors not found: ${missing.join(" | ")}`);
  return out;
}
