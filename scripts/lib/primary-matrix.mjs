/* The labelled accent fill through the cascade (ui-kit 0.32.1): every
   registered product, wired the three ways a product wires its accent, on
   both themes, in every context a primary is painted in, at rest, hovered
   and pressed. Each cell is read off the kit's own stylesheets by
   cascade.mjs and css-color.mjs -- the label the button declares, the
   surface it sits on (an opaque fill, or the glass pane composited layer by
   layer over the page), its edge and its foot -- so a rule or a token that
   moves any of them moves the matrix.

   Wirings
     tier A        the product overrides --sl-accent-default on its theme
                   (README, "Per-product accent"), its registered steps if it
                   has any, and its registered fill as --slc-accent-fill on
                   the root (README, "An accent that cannot carry its label"),
                   with its own neutrals through data-sl-product.
     site subtree  sondalab-site's product page: the default page, and a
                   section that re-binds the accent and sets the fill
                   (registered fill, else the accent) as --slc-accent-fill
                   (sondalab-site f2c55e9, src/pages/products/[slug].astro,
                   verbatim, single quotes included).
     tier B        a value-pinned page with no data-sl-theme, mapping only
                   the accent, its label, its registered fill, the status
                   roles and its neutrals (README, "Tier B"), so the accent's
                   steps are the
                   kit's own :root fallbacks, and the glass tint has no
                   --sl-bg-canvas to read.
   Contexts
     opaque        a plain primary.
     no script     the glass classes with no layers built: the opaque key.
     fx off        a built glass primary inside [data-sl-fx="off"]: since
                   0.32.1 the layers are hidden and the host keeps its own
                   fill, so it is the opaque key (asserted, not assumed).
     glass         a built glass pane: the label is picked from the
                   composite, the fill is the tint stack over the page.
     glass, lensed the same pane once glass-lens.js has lensed it (what
                   mount() does to a pane wherever url() backdrop filters
                   work): the lens floor's denser tint (glass.css) over the
                   host's own backdrop chain (glass-lens.js, flat ground).
   High contrast owns its accent and is not a cell. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluate, substitute, toSrgb, fromSrgb } from "./css-color.mjs";
import { parseSheet, el, cascaded, customs, longhand, splitList } from "./cascade.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../../packages/ui-kit");
const read = (p) => readFileSync(resolve(KIT, p), "utf8");
export const REGISTRY = JSON.parse(read("agent/accent-registry.json")).products;
const NEUTRALS = JSON.parse(read("neutrals.json")).products;
// The order the showcase's effects page loads them in.
const KIT_SHEETS = ["tokens.css", "components.css", "glass.css", "effects.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css", "themes/products.css"].map(read);

export const THEMES = ["light", "dark"];
export const STATES = { rest: [], hover: ["hover"], press: ["active", "hover"] };
const GLASS = ["sl-fx-glass", "sl-fx-glass--pane", "sl-fx-press"];
export const CONTEXTS = {
  opaque: { classes: [] },
  "no script": { classes: GLASS },
  "fx off": { classes: [...GLASS, "sl-glass"], off: true },
  glass: { classes: [...GLASS, "sl-glass"] },
  "glass, lensed": { classes: [...GLASS, "sl-glass", "is-lensed"], lensed: true },
};
const layered = (context) => CONTEXTS[context].classes.includes("sl-glass");

/** The lensed host's own backdrop chain, read off glass-lens.js: the default
 *  look's saturate and brightness, and the calmer backdrop's contrast. The
 *  displacement and the blur leave a flat ground as it is. */
const LENS = (() => {
  const js = read("glass-lens.js");
  const look = js.match(/const \{[^}]*\} = look;/)[0];
  const num = (k) => Number(look.match(new RegExp(`${k} = ([0-9.]+)`))[1]);
  return { saturate: num("saturate"), brightness: num("brightness"), contrast: Number(js.match(/contrast\(var\(--slg-lens-contrast, ([0-9.]+)\)\)/)[1]) };
})();

/** A registry entry with `inherits` followed (daos is the default's). */
export function product(id) {
  const { inherits, ...own } = REGISTRY[id];
  return inherits ? { ...product(inherits), ...own } : own;
}

/** The kit's sheets, then a consumer's, in that order. */
function sheets(consumer) {
  const out = [];
  let order = 0;
  for (const css of [...KIT_SHEETS, consumer]) {
    const rules = parseSheet(css, {}, order);
    order += rules.length + 1;
    out.push(...rules);
  }
  return out;
}

// sondalab-site f2c55e9, src/pages/products/[slug].astro, the product rule.
export const SITE = `
  [data-product] {
    --sl-accent-default: var(--acc-dark);
    --slc-accent: var(--acc-dark);
    --slc-accent-fill: var(--acc-fill-dark);
    --slc-accent-subtle: color-mix(in srgb, var(--slc-accent) 12%, transparent);
    --slc-accent-text: oklch(from var(--slc-accent) min(l, var(--sl-accent-text-lmax, 1)) c h);
    --slc-edge-pressed: oklch(from color-mix(in srgb, var(--slc-accent) 12%, var(--slc-canvas)) calc(l - var(--slc-shade-step)) c h);
    --slc-focus: var(--slc-accent-text);
  }
  :root[data-sl-theme='light'] [data-product] {
    --sl-accent-default: var(--acc-light);
    --slc-accent: var(--acc-light);
    --slc-accent-fill: var(--acc-fill-light);
  }`;

/** The light layer's numbers, read where the kit sets them, for a Tier B page. */
const LIGHT_NUMBERS = (() => {
  const light = read("themes/light.css");
  const comp = read("components.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const block = comp.match(/:root\[data-sl-theme="light"\]\s*\{([^}]*)\}/)[1];
  const num = (src, name) => src.match(new RegExp(`${name}:\\s*([0-9.]+)`))[1];
  return { "--sl-accent-text-lmax": num(light, "--sl-accent-text-lmax"), "--slc-edge-accent-lmax": num(block, "--slc-edge-accent-lmax"), "--slc-glow": num(block, "--slc-glow") };
})();
/** A Tier B page maps the status roles to its own palette (README, "Tier B");
 *  the mock maps the theme's own, read off the generated theme file. */
const STATUS = Object.fromEntries(THEMES.map((t) => [t, Object.fromEntries(["success", "warning", "danger", "info"]
  .map((s) => [s, read(`themes/${t}.css`).match(new RegExp(`--sl-status-${s}:\\s*(#[0-9a-fA-F]{6});`))[1]]))]));
/** The light theme's own label rule, re-pointed at a Tier B page's accent. */
const TIER_B_LABEL = read("themes/light.css").match(/--sl-text-on-accent:\s*([^;]+);/)[1].replace(/var\(--sl-accent-default\)/g, "var(--slc-accent)");

export const WIRINGS = {
  "tier A": (id) => {
    const p = product(id);
    const css = THEMES.map((t) => {
      const steps = p.steps?.[t] ? Object.entries(p.steps[t]).map(([k, v]) => ` --sl-accent-${k}: ${v};`).join("") : "";
      const ring = t === "dark" ? ` --sl-focus-ring: ${p.dark};` : "";
      const fill = p.fill?.[t] ? `\n:root[data-sl-theme="${t}"] { --slc-accent-fill: ${p.fill[t]}; }` : "";
      return `[data-sl-theme="${t}"] { --sl-accent-default: ${p[t]};${ring}${steps} }${fill}`;
    }).join("\n");
    return { css, root: { "data-sl-product": id }, section: null };
  },
  "site subtree": (id) => {
    const p = product(id);
    const acc = `[data-product] { --acc-light: ${p.light}; --acc-dark: ${p.dark}; --acc-fill-light: ${p.fill?.light ?? p.light}; --acc-fill-dark: ${p.fill?.dark ?? p.dark}; }`;
    return { css: `${SITE}\n${acc}`, root: {}, section: { "data-product": "" } };
  },
  "tier B": (id) => {
    const p = product(id);
    const css = THEMES.map((t) => {
      const n = (NEUTRALS[id].inherits ? NEUTRALS[NEUTRALS[id].inherits] : NEUTRALS[id])[t];
      const numbers = t === "light" ? Object.entries(LIGHT_NUMBERS).map(([k, v]) => ` ${k}: ${v};`).join("") : "";
      const fill = p.fill?.[t] ? ` --slc-accent-fill: ${p.fill[t]};` : "";
      const status = Object.entries(STATUS[t]).map(([k, v]) => ` --slc-${k}: ${v};`).join("");
      return `:root[data-theme="${t}"] { --slc-accent: ${p[t]}; --slc-on-accent: ${TIER_B_LABEL};${fill} --slc-canvas: ${n["bg-canvas"]}; --slc-surface: ${n["bg-surface"]}; --slc-raised: ${n["bg-surface-raised"]}; --slc-text: ${n["text-primary"]};${status}${numbers} }`;
    }).join("\n");
    return { css, root: {}, section: null, themeAttr: "data-theme" };
  },
};

const Y = (c) => { const [r, g, b] = c.lin.map((v) => Math.min(1, Math.max(0, v))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** WCAG 2 contrast ratio of two opaque colours. */
export const ratio = (a, b) => { const [hi, lo] = [Y(a), Y(b)].sort((p, q) => q - p); return (hi + 0.05) / (lo + 0.05); };
/** `top` composited over an opaque `under`, in sRGB, as a browser paints. */
const over = (top, under) => {
  const t = toSrgb(top), u = toSrgb(under);
  return fromSrgb(t.map((v, i) => v * top.alpha + u[i] * (1 - top.alpha)));
};
/** saturate(), brightness() then contrast(), per Filter Effects 1, on gamma
 *  sRGB, clamped. */
function filtered(c, { saturate = 1, brightness = 1, contrast = 1 }) {
  const [r, g, b] = toSrgb(c), s = saturate;
  const sat = [
    (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
  ];
  return fromSrgb(sat.map((v) => Math.min(1, Math.max(0, (Math.min(1, Math.max(0, v)) * brightness - 0.5) * contrast + 0.5))));
}
/** The two stop colours of each layer of a background-image of linear
 *  gradients, top layer first: [[stop, stop], ...]. Anything else throws. */
function gradientStops(value, env) {
  return splitList(value).map((layer) => {
    const m = layer.match(/^linear-gradient\(([\s\S]*)\)$/);
    if (!m) throw new Error(`not a linear gradient: ${layer}`);
    const args = splitList(m[1]);
    const stops = /^-?[\d.]+deg$|^to /.test(args[0]) ? args.slice(1) : args;
    if (stops.length !== 2) throw new Error(`expected two stops: ${layer}`);
    return stops.map((s) => evaluate(s, env));
  });
}

/** One wiring's rules, built once per product. */
const ruleCache = new Map();
function rulesFor(wiring, id) {
  const key = `${wiring}/${id}`;
  if (!ruleCache.has(key)) ruleCache.set(key, { ...WIRINGS[wiring](id), rules: sheets(WIRINGS[wiring](id).css) });
  return ruleCache.get(key);
}

/** html > body > [section] > [opt-out] > control, for one cell. */
export function tree(w, theme, context, classes, states) {
  const html = el({ tag: "html", attrs: { [w.themeAttr ?? "data-sl-theme"]: theme, ...w.root } });
  let parent = el({ tag: "body", parent: html });
  if (w.section) parent = el({ tag: "section", parent, attrs: w.section });
  if (CONTEXTS[context].off) parent = el({ tag: "div", parent, attrs: { "data-sl-fx": "off" } });
  return { parent, control: el({ tag: "button", classes: [...classes, ...CONTEXTS[context].classes], states, parent }) };
}

/** One primary, measured: its label, every surface the label can sit on
 *  (one opaque fill, or the pane over each ground, its backdrop raw and
 *  filtered, at each gradient stop), its edge and its foot. A layer the
 *  cascade hides (display: none) paints nothing, and a tint whose
 *  background-image cannot compute (an unresolved var()) is `none`, as in a
 *  browser: the label then sits on whatever is behind it. */
export function measure({ wiring, id, theme, context, state, danger = false, backdrops = null }) {
  const w = rulesFor(wiring, id);
  const { parent, control } = tree(w, theme, context, ["sl-btn", "sl-btn--primary", ...(danger ? ["sl-btn--danger"] : [])], STATES[state]);
  const env = customs(w.rules, control);
  const won = cascaded(w.rules, control);
  const label = evaluate(won.get("color").value, env);
  const host = evaluate(longhand(won, "background-color").value, env);
  const edge = evaluate(longhand(won, "border-color").value, env);
  const page = customs(w.rules, parent);
  // `backdrops` (a stress sweep) replaces the page's three grounds with any
  // flat colours behind the pane; the tint is still the page's canvas.
  const grounds = backdrops ? Object.fromEntries(backdrops.map((b) => [b, evaluate(b, new Map())]))
    : Object.fromEntries(["canvas", "surface", "raised"].map((g) => [g, evaluate(`var(--slc-${g})`, page)]));
  const surfaces = [];
  const tint = layered(context) ? el({ tag: "span", classes: ["sl-glass__tint"], parent: control }) : null;
  const shown = tint && cascaded(w.rules, tint).get("display")?.value.replace(/\s*!important$/, "") !== "none";
  if (shown) {
    const backdrop = el({ tag: "span", classes: ["sl-glass__backdrop"], parent: control });
    let layers;
    try { layers = gradientStops(cascaded(w.rules, tint).get("background-image").value, customs(w.rules, tint)); }
    catch (e) { if (!/^unresolved /.test(e.message)) throw e; layers = []; }
    const bf = substitute(cascaded(w.rules, backdrop).get("backdrop-filter")?.value ?? "none", customs(w.rules, backdrop));
    const fn = (name) => Number(bf.match(new RegExp(`${name}\\(([0-9.]+)\\)`))?.[1] ?? 1);
    const filter = { saturate: fn("saturate"), brightness: fn("brightness"), contrast: fn("contrast") };
    if (CONTEXTS[context].lensed && bf !== "none") throw new Error(`a lensed pane's backdrop layer still filters: ${bf}`);
    for (const [g, ground] of Object.entries(grounds)) {
      // Unlensed, the host's own fill (transparent at rest on a built pane,
      // the state's fill where a state rule outranks that) is behind the
      // backdrop layer, which filters both. Lensed, the host filters the
      // page behind it and its own fill paints over that.
      const raw = over(host, ground);
      const cooked = CONTEXTS[context].lensed ? over(host, filtered(ground, LENS)) : filtered(raw, filter);
      for (const [mode, under] of [["raw", raw], ["filtered", cooked]]) {
        for (const k of [0, 1]) {
          const colour = layers.slice().reverse().reduce((acc, stops) => over(stops[k], acc), under);
          surfaces.push({ where: `${g}, backdrop ${mode}, stop ${k + 1}`, colour });
        }
      }
    }
  } else {
    if (host.alpha < 1) throw new Error(`${wiring} ${id} ${theme} ${context} ${state}: an opaque primary with a translucent fill`);
    surfaces.push({ where: "fill", colour: host });
  }
  const foot = shown ? null : evaluate("var(--_sl-foot-color, var(--_sl-fill-edge))", env);
  return { label, surfaces, edge, foot, host, grounds, env, layers: shown };
}

/** The tick, the dot and the knob on a checked check, radio and switch,
 *  each against its own fill (the pseudo-element's colour, read off the
 *  rule that paints it, in the box's computed values). */
export function marks({ wiring, id, theme, states = [] }) {
  const w = rulesFor(wiring, id);
  const css = read("components.css");
  const values = {
    check: css.match(/\.sl-check__box::after \{[^}]*border: solid ([^;]+);/)[1],
    radio: css.match(/\.sl-radio__box::after \{[^}]*background: ([^;]+);/)[1],
    switch: css.match(/\.sl-switch__input:checked \+ \.sl-switch__track::after \{[^}]*background: ([^;]+);/)[1],
  };
  const html = el({ tag: "html", attrs: { [w.themeAttr ?? "data-sl-theme"]: theme, ...w.root } });
  let parent = el({ tag: "body", parent: html });
  if (w.section) parent = el({ tag: "section", parent, attrs: w.section });
  const box = (input, cls) => el({ tag: "span", classes: [cls], states, parent, prev: el({ tag: "input", classes: [input], states: ["checked", ...states], parent }) });
  return Object.entries({ check: box("sl-check__input", "sl-check__box"), radio: box("sl-radio__input", "sl-radio__box"), switch: box("sl-switch__input", "sl-switch__track") })
    .map(([name, host]) => {
      const env = customs(w.rules, host);
      return { name, mark: evaluate(values[name], env), fill: evaluate(longhand(cascaded(w.rules, host), "background-color").value, env) };
    });
}

/** Every cell: { wiring, id, theme, context, state, danger, label, surfaces, edge, foot, host }. */
export function cells({ danger = false } = {}) {
  const out = [];
  for (const wiring of Object.keys(WIRINGS)) for (const id of Object.keys(REGISTRY)) for (const theme of THEMES) {
    for (const context of Object.keys(CONTEXTS)) {
      for (const state of Object.keys(STATES)) {
        out.push({ wiring, id, theme, context, state, danger, ...measure({ wiring, id, theme, context, state, danger }) });
      }
    }
  }
  return out;
}

/** The lowest label contrast of a cell, and where it is. */
export function worst(cell) {
  return cell.surfaces.map((s) => ({ where: s.where, r: ratio(cell.label, s.colour) })).sort((a, b) => a.r - b.r)[0];
}
