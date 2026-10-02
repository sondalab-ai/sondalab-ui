/* The neutral ladder: one lightness/chroma pair per role per theme, tinted
   with each product's accent hue and baked to literal hex at build time.

   Pure: no file I/O, so gen-css.mjs writes what this returns and the tests
   rebuild the same thing in memory to compare with what is committed. Monaco,
   xterm, Electron's backgroundColor, spexr's preload.html, the site's asset
   scripts and sl-audit all read neutrals as hex, which is why the tint is not
   a runtime `oklch(from var(--sl-accent-default) L C h)`. */

import { fromHex, fromOklch, toOklch, toHex, gamutExcess, linToOklab } from "./css-color.mjs";

/** colour.js isChromatic(): an oklch chroma above this is a hue, not a grey. */
export const CHROMA_LIMIT = 0.04;
/** colour.js isChromatic(): a computed hex serialises as rgb(), and there a
 *  red-green-blue spread above this is a hue. This branch is the one the ink
 *  effect actually runs on a neutral fill. */
export const RGB_SPREAD_LIMIT = 24;
/** Float noise, not clipping: oklch(1 0 h) lands a hair outside the cube. */
const GAMUT_EPSILON = 1e-6;
/** Two accents whose hues differ by less than this share a hue. */
const SAME_HUE_DEG = 0.05;
/** An accent below this oklch chroma is a grey: its hue is noise (a pure grey
 *  has none, and CSS reads it as 0, a pink), so its neutrals are untinted. */
export const ACHROMATIC_C = 0.002;

export const THEMES = ["light", "dark"];

export const PRODUCTS_CSS_HEADER =
  "/* GENERATED from sondalab.tokens.json (neutrals) + agent/accent-registry.json — do not edit. Run `npm run gen:tokens`.\n" +
  "   Each product's neutrals, tinted with its accent hue. Put data-sl-product on the element that carries\n" +
  "   data-sl-theme, or on an ancestor of it; load after the theme files or before, the selector outranks them.\n" +
  "   One product per theme subtree: every block here weighs the same, so with two products nested the later\n" +
  "   block in this file wins, not the nearer ancestor. */\n";
export const NEUTRALS_JSON_NOTE =
  "GENERATED from sondalab.tokens.json (neutrals) + agent/accent-registry.json — do not edit. Run `npm run gen:tokens`. " +
  "products.<id>.<theme>.<role> is the literal value of --sl-<role> for that product; ladder is [oklch L, C] per role, tinted with the product's accent hue.";

/** The product's own registry entry after following `inherits`.
 *  Throws on a cycle or a dangling name, so a registry typo fails the build. */
export function resolveRegistryEntry(registry, id) {
  const seen = new Set();
  let name = id;
  for (;;) {
    if (seen.has(name)) throw new Error(`accent-registry: circular inherits at "${name}"`);
    seen.add(name);
    const entry = registry.products?.[name];
    if (!entry) throw new Error(`accent-registry: "${id}" resolves to unknown product "${name}"`);
    if (!entry.inherits) return { name, entry };
    name = entry.inherits;
  }
}

/** The accent a product's neutrals take their hue from on one theme: the
 *  token accent for the default product (and anything inheriting it), the
 *  registry's light/dark value for every other product. */
export function accentFor(tokens, registry, id, theme) {
  const { name, entry } = resolveRegistryEntry(registry, id);
  const hex = name === "default" ? tokens.accent[theme].default : entry[theme];
  if (!/^#[0-9a-fA-F]{6}$/.test(hex ?? "")) throw new Error(`accent-registry: "${id}" has no ${theme} accent hex`);
  return hex;
}

/** OKLCH hue of a hex in degrees, or null for a grey accent (chroma below
 *  ACHROMATIC_C): a grey has no hue to tint with, and the neutrals it gets
 *  are untinted rather than the pink that CSS's powerless hue 0 would give. */
export function hueOf(hex) {
  const [, C, h] = toOklch(fromHex(hex));
  return C < ACHROMATIC_C ? null : h;
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

/** Every neutral role for one theme at hue `h` (null: untinted), in
 *  declaration order: the ladder roles as hex, then the colours cast in the
 *  generated primary text (the borders at the theme's alphas, and the overlay
 *  where the theme casts it in its ink), the white lit edge, then aliases. */
export function rolesFor(spec, theme, h) {
  const out = {};
  const info = {};
  for (const [role, [L, ladderC]] of Object.entries(spec.ladder[theme])) {
    const C = h === null ? 0 : ladderC;
    const col = fromOklch([L, C, h ?? 0]);
    out[role] = toHex(col);
    info[role] = { L, C, excess: gamutExcess(col) };
  }
  const ink = rgbOf(out["text-primary"]);
  for (const [k, a] of Object.entries(spec.border[theme])) out[`border-${k}`] = rgba(ink, a);
  if (spec.overlay?.[theme] !== undefined) out["bg-overlay"] = rgba(ink, spec.overlay[theme]);
  out["border-lit"] = rgba([255, 255, 255], spec["border-lit"][theme]);
  for (const [alias, role] of Object.entries(spec.alias ?? {})) out[alias] = out[role];
  return { roles: out, info };
}

/** The whole build: the ladder as given plus every registered product's
 *  roles on both themes. `info` (per-role L, C, gamut excess) is for the
 *  validator and is not written to neutrals.json. */
export function buildNeutrals(tokens, registry) {
  const spec = tokens.neutrals;
  const products = {};
  for (const id of Object.keys(registry.products)) {
    const p = { hue: {}, accent: {}, info: {} };
    const inherits = registry.products[id].inherits;
    if (inherits) p.inherits = inherits;
    for (const theme of THEMES) {
      const accent = accentFor(tokens, registry, id, theme);
      const h = hueOf(accent);
      const { roles, info } = rolesFor(spec, theme, h);
      p.accent[theme] = accent;
      p.hue[theme] = h;
      p[theme] = roles;
      p.info[theme] = info;
    }
    products[id] = p;
  }
  return { spec, products };
}

const isHex = (v) => /^#[0-9a-f]{6}$/.test(v);
const spread = (hex) => { const c = rgbOf(hex); return Math.max(...c) - Math.min(...c); };

/** Every reason the build must not ship, as strings (empty when it may):
 *  a ladder chroma at or above the isChromatic threshold, a role that leaves
 *  the sRGB cube, a generated hex the ink effect would read as a hue, and two
 *  products with different hues that bake to the same neutrals on a theme. */
export function validateNeutrals(build) {
  const errors = [];
  for (const theme of THEMES) {
    for (const [role, [L, C]] of Object.entries(build.spec.ladder[theme])) {
      if (!(C >= 0 && C < CHROMA_LIMIT)) errors.push(`ladder ${theme} ${role}: chroma ${C} must be >= 0 and < ${CHROMA_LIMIT}`);
      if (!(L >= 0 && L <= 1)) errors.push(`ladder ${theme} ${role}: lightness ${L} outside 0..1`);
    }
  }
  for (const [id, p] of Object.entries(build.products)) {
    for (const theme of THEMES) {
      for (const [role, { excess }] of Object.entries(p.info[theme])) {
        if (excess > GAMUT_EPSILON) errors.push(`${id} ${theme} ${role}: outside sRGB by ${excess.toFixed(5)} (clipped to ${p[theme][role]})`);
        const hex = p[theme][role];
        if (!isHex(hex)) { errors.push(`${id} ${theme} ${role}: not a 6-digit hex (${hex})`); continue; }
        const C = toOklch(fromHex(hex))[1];
        if (C >= CHROMA_LIMIT) errors.push(`${id} ${theme} ${role}: ${hex} has chroma ${C.toFixed(4)} >= ${CHROMA_LIMIT}`);
        if (spread(hex) > RGB_SPREAD_LIMIT) errors.push(`${id} ${theme} ${role}: ${hex} has an rgb spread of ${spread(hex)} > ${RGB_SPREAD_LIMIT}`);
      }
    }
  }
  // The glass glint is the primary text's lightness mirrored, at the same
  // chroma and hue (effects.css --slfx-glint: max(l, 1.2 - l)). Paper ink
  // darker than ~L 0.22 asks for a near-white that sRGB cannot tint, and
  // Chrome clips it -- so the ink has a floor that depends on its hue.
  for (const [id, p] of Object.entries(build.products)) {
    for (const theme of THEMES) {
      const ink = p.info[theme]["text-primary"];
      if (!ink) continue;
      const glint = fromOklch([Math.max(ink.L, 1.2 - ink.L), ink.C, p.hue[theme] ?? 0]);
      const excess = gamutExcess(glint);
      if (excess > GAMUT_EPSILON) errors.push(`${id} ${theme} text-primary: its glass glint (L ${Math.max(ink.L, 1.2 - ink.L).toFixed(3)}, C ${ink.C}) is outside sRGB by ${excess.toFixed(5)}`);
    }
  }
  for (const theme of THEMES) {
    for (const { a, b, identical, sameHue } of productPairs(build, theme)) {
      if (identical && !sameHue) errors.push(`${theme}: ${a} and ${b} have different accent hues but identical neutrals`);
    }
  }
  return errors;
}

/** Every pair of products on one theme: whether they share a hue, whether
 *  their roles are identical, and how close they are (largest per-channel
 *  difference, largest OKLab distance, how many roles bake to the same hex). */
export function productPairs(build, theme) {
  const ids = Object.keys(build.products);
  const out = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [a, b] = [ids[i], ids[j]];
      const pa = build.products[a], pb = build.products[b];
      const [ha, hb] = [pa.hue[theme], pb.hue[theme]];
      const dh = ha === null || hb === null ? null : Math.abs(ha - hb);
      const sameHue = dh === null ? ha === hb : Math.min(dh, 360 - dh) < SAME_HUE_DEG;
      let maxChannel = 0, maxDE = 0, sameRoles = 0, roles = 0;
      for (const role of Object.keys(pa.info[theme])) {
        const [x, y] = [pa[theme][role], pb[theme][role]];
        roles++;
        if (x === y) sameRoles++;
        const [cx, cy] = [rgbOf(x), rgbOf(y)];
        maxChannel = Math.max(maxChannel, ...cx.map((v, k) => Math.abs(v - cy[k])));
        const [lx, ly] = [linToOklab(fromHex(x).lin), linToOklab(fromHex(y).lin)];
        maxDE = Math.max(maxDE, Math.hypot(lx[0] - ly[0], lx[1] - ly[1], lx[2] - ly[2]));
      }
      const identical = JSON.stringify(pa[theme]) === JSON.stringify(pb[theme]);
      out.push({ a, b, sameHue, identical, maxChannel, maxDE, sameRoles, roles });
    }
  }
  return out;
}

/** The closest pair of products with DIFFERENT hues on a theme, for the
 *  generator's report line. */
export function closestDistinctPair(build, theme) {
  return productPairs(build, theme)
    .filter((p) => !p.sameHue)
    .sort((x, y) => x.maxDE - y.maxDE || x.maxChannel - y.maxChannel)[0];
}

/** Declaration order of the neutral roles inside a theme block: the slots
 *  the hand-written literals held before 0.29, the new roles beside their
 *  kin. Roles not listed keep their own order after these. */
export const THEME_SLOTS = [
  "bg-canvas", "bg-surface", "bg-surface-raised", "bg-tile", "bg-sunken", "bg-overlay",
  "border-subtle", "border-default", "border-strong", "border-lit",
  "text-primary", "text-secondary", "text-muted",
];
/** Declaration order of the syntax roles; fg, comment and null are neutrals. */
export const CODE_SLOTS = ["fg", "comment", "keyword", "string", "number", "boolean", "function", "tag", "builtin", "null"];

/** The generated roles merged with the hand-written theme entries, in slot
 *  order. A key in both is an error: the ladder owns that role, and a literal
 *  beside it would silently win or lose by merge order. */
export function mergeAuthored(generated, authored, slots, where) {
  const clash = Object.keys(authored ?? {}).filter((k) => k in generated);
  if (clash.length) throw new Error(`${where}: ${clash.join(", ")} generated by the neutral ladder and also written by hand — remove the literal`);
  return Object.fromEntries(slotted({ ...generated, ...authored }, slots));
}

/** `map`'s entries with the keys in `slots` first, in slot order, then the
 *  rest in their own order. */
export function slotted(map, slots) {
  const keys = Object.keys(map);
  const first = slots.filter((k) => keys.includes(k));
  return [...first, ...keys.filter((k) => !slots.includes(k))].map((k) => [k, map[k]]);
}

/** The neutral roles split the way the theme files declare them: the
 *  `--sl-<role>` theme roles and the `--sl-code-<role>` syntax roles. */
export function splitRoles(roles) {
  const theme = {}, code = {};
  for (const [k, v] of Object.entries(roles)) {
    if (k.startsWith("code-")) code[k.slice(5)] = v; else theme[k] = v;
  }
  return { theme, code };
}

/** The declarations a product block carries, `--sl-<role>`, in slot order. */
export function declarationsFor(roles) {
  const { theme, code } = splitRoles(roles);
  return [
    ...slotted(theme, THEME_SLOTS).map(([k, v]) => [`--sl-${k}`, v]),
    ...slotted(code, CODE_SLOTS).map(([k, v]) => [`--sl-code-${k}`, v]),
  ];
}

/** neutrals.json: the ladder as authored plus every product's baked roles.
 *  Hue is rounded for reading; the hex is what consumers copy. */
export function neutralsJson(build, header = NEUTRALS_JSON_NOTE) {
  const products = {};
  for (const [id, p] of Object.entries(build.products)) {
    products[id] = {
      ...(p.inherits ? { inherits: p.inherits } : {}),
      accent: p.accent,
      hue: Object.fromEntries(THEMES.map((t) => [t, p.hue[t] === null ? null : Math.round(p.hue[t] * 100) / 100])),
      light: p.light,
      dark: p.dark,
    };
  }
  const { ladder, border, alias } = build.spec;
  const text = JSON.stringify({ $note: header, ladder, border, "border-lit": build.spec["border-lit"], alias, products }, null, 2);
  // One [L, C] pair per line, so the ladder reads as a table.
  return text.replace(/\[\s+(-?[\d.e-]+),\s+(-?[\d.e-]+)\s+\]/g, "[$1, $2]") + "\n";
}

/** themes/products.css: one neutral-only block per product per theme. The
 *  product attribute sits on the theme element or an ancestor of it; the
 *  two-attribute selector outranks the theme file's own (0,1,0) block
 *  whatever the load order. */
export function productsCss(build, header = PRODUCTS_CSS_HEADER) {
  let css = header;
  for (const [id, p] of Object.entries(build.products)) {
    for (const theme of THEMES) {
      const sel = `[data-sl-product="${id}"][data-sl-theme="${theme}"],\n[data-sl-product="${id}"] [data-sl-theme="${theme}"]`;
      css += `${sel} {\n${declarationsFor(p[theme]).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`;
    }
  }
  return css;
}
