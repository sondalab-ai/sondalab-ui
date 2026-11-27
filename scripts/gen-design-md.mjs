#!/usr/bin/env node
// gen-design-md — build packages/ui-kit/agent/DESIGN.md, the agent-readable
// design system in one file: each token beside its rule and the reason for it.
//
// Values are read at build time from sondalab.tokens.json, the generated
// packages/ui-kit/neutrals.json (the default product's baked neutrals), the
// accent registry, docs/design-language.md (the control height and the effect
// meanings) and packages/ui-kit/agent/flavour.md (the traits, the bezel card
// and the do-not-converge list). Nothing here repeats a value; the prose holds
// the rules in their current form only. When a source the generator relies on
// is missing, it throws instead of writing.
//
// buildDesignMd() returns the text and writes nothing; the file is written only
// when this script runs directly (`npm run gen:design-md`, or `npm run gen:tokens`).

import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT_REL = "packages/ui-kit/agent/DESIGN.md";

const TOKENS = "sondalab.tokens.json";
const NEUTRALS = "packages/ui-kit/neutrals.json";
const REGISTRY = "packages/ui-kit/agent/accent-registry.json";
const LANGUAGE = "docs/design-language.md";
const FLAVOUR = "packages/ui-kit/agent/flavour.md";

function fail(message) {
  throw new Error(`gen-design-md: ${message}`);
}

const readText = (p) => readFileSync(resolve(REPO, p), "utf8");
const readJson = (p) => JSON.parse(readText(p));

/** obj at a dotted path, or a failure naming the source. */
function need(obj, path, where) {
  let value = obj;
  for (const key of path.split(".")) {
    if (value === null || typeof value !== "object" || !(key in value)) fail(`${where} has no ${path}`);
    value = value[key];
  }
  return value;
}

/** A non-empty object of string values at a dotted path. */
function scale(obj, path, where) {
  const value = need(obj, path, where);
  if (value === null || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) {
    fail(`${where} ${path} is empty`);
  }
  for (const [k, v] of Object.entries(value)) {
    if (typeof v !== "string" || !v.trim()) fail(`${where} ${path}.${k} has no value`);
  }
  return value;
}

/** Every key of `values` has a written use, and every written use a value. */
function described(values, uses, what) {
  for (const k of Object.keys(values)) if (!(k in uses)) fail(`no use is written for ${what} ${k}`);
  for (const k of Object.keys(uses)) if (!(k in values)) fail(`${what} ${k} is gone from the sources`);
}

const code = (s) => `\`${s}\``;
const row = (cells) => `| ${cells.join(" | ")} |`;
const table = (head, rows) => [row(head), row(head.map(() => "---")), ...rows.map(row)];

// ---- sources ----

function loadSources() {
  return {
    tokens: readJson(TOKENS),
    neutrals: readJson(NEUTRALS),
    registry: readJson(REGISTRY),
    language: readText(LANGUAGE),
    flavour: readText(FLAVOUR),
  };
}

function controlHeight(language) {
  const m = language.match(/are all \*\*(\d+(?:\.\d+)?px)\*\*/);
  if (!m) fail(`${LANGUAGE} no longer states the control height ("are all **<n>px**")`);
  return m[1];
}

const FAMILIES = ["Glitch", "Aurora", "Glass", "Goo"];

function effectMeanings(language) {
  const out = {};
  for (const family of FAMILIES) {
    const m = language.match(new RegExp(`${family} means \\*([^*]+)\\*`));
    if (!m) fail(`${LANGUAGE} no longer states what ${family} means ("${family} means *...*")`);
    out[family] = m[1].trim();
  }
  return out;
}

function flavourSection(flavour, heading) {
  const body = flavour.split(/^## /m).slice(1).find((s) => heading.test(s.split("\n")[0]));
  if (!body) fail(`${FLAVOUR} has no section matching ${heading}`);
  return body;
}

function tableRows(body, columns, where) {
  const rows = body
    .split("\n")
    .filter((l) => l.startsWith("|"))
    .slice(2)
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
  if (!rows.length) fail(`${where} has no table rows`);
  for (const r of rows) {
    if (r.length !== columns || r.some((c) => !c)) fail(`${where} has a malformed row: ${r.join(" | ")}`);
  }
  return rows;
}

// ---- 1. brand and voice ----

function brand() {
  return [
    "## 1. Brand and voice",
    "",
    "Sondalab is a family of developer tools that read as one suite. The look is editorial modernism for an IDE: hairline structure, mono micro labels, oversized display type, inversion bands and real content over marketing copy. Products share the whole grammar and differ only in their accent hue.",
    "",
    "The grammar fixes the materials (type roles, spacing scale, rule weight, motifs, motion, voice); surprise is spent on composition, with at least one intentional layout decision per screen. Why: family resemblance comes from the shared materials, distinctiveness from each screen's composition.",
    "",
    "Voice:",
    "",
    "- **Precise and technical, never marketing.** Name things by what they are and do; prefer a real measured figure or executed output to an adjective. Why: these are tools, and real output is the proof.",
    "- **Active voice; controls state their effect.** A button says what happens; its confirmation says it happened. Why: the label is the contract for the action.",
    "- **Controls speak in sentence case.** Write \"Run checks\" in the markup; nothing upper-cases a label for you. Why: uppercase belongs to micro labels, which name structure.",
    "- **Structure encodes truth.** Numbered markers, eyebrows and dividers appear only where they reflect a real sequence or classification. Why: decoration dressed as structure misleads the reader.",
    "- **Real content.** Where a surface shows output (JSON, a terminal, code, data rows), show actual content in mono, not illustrative filler. Why: it is both the voice and the look.",
    "- **English** for product copy and all identifiers. Why: it matches the suite.",
  ];
}

// ---- 2. colour ----

const THEMES = ["light", "dark", "high-contrast"];

const COLOUR_USE = {
  "bg-canvas": "The page ground: the farthest rung, so everything nearer is lighter.",
  "bg-surface": "Panes, cards and chrome on the canvas.",
  "bg-surface-raised": "A raised key, an overlay, a lit pane.",
  "bg-tile": "A raised selection (the tile recipe).",
  "bg-sunken": "A field's fill and a control's track (the sunk recipe).",
  "bg-overlay": "The scrim behind a modal overlay.",
  "text-primary": "Body text and headings; the borders are this ink at an alpha.",
  "text-secondary": "Supporting text and an icon button's glyph.",
  "text-muted": "Meta, micro labels and captions.",
  "text-on-accent": "The label on an accent fill.",
  "border-subtle": "The quietest hairline.",
  "border-default": "The structural 1px hairline.",
  "border-strong": "A strong edge where a hairline would not read.",
  "border-lit": "The lit top line of a tile, key or island.",
  "accent-default": "The product accent: primary fill, focus ring, links, tags, the seam.",
  "status-success": "Success, on the canvas; never a second accent.",
  "status-warning": "Warning, on the canvas; never a second accent.",
  "status-danger": "Danger and errors, on the canvas; never a second accent.",
  "status-info": "Information, on the canvas; never a second accent.",
};

function colourRoles(src) {
  const generated = need(src.neutrals, "products.default", NEUTRALS);
  const byTheme = {};
  for (const theme of THEMES) {
    const base = theme === "high-contrast" ? {} : need(generated, theme, `${NEUTRALS} products.default`);
    const values = {
      ...base,
      ...need(src.tokens, `themes.${theme}`, TOKENS),
      "accent-default": need(src.tokens, `accent.${theme}.default`, TOKENS),
    };
    for (const role of Object.keys(values)) if (role.startsWith("code-")) delete values[role];
    byTheme[theme] = values;
  }
  const all = Object.assign({}, ...THEMES.map((t) => byTheme[t]));
  described(all, COLOUR_USE, "colour role");
  return Object.entries(COLOUR_USE).map(([role, use]) => {
    const cells = THEMES.map((theme) => {
      const value = byTheme[theme][role];
      if (typeof value !== "string" || !value.trim()) fail(`colour role ${role} has no ${theme} value`);
      return code(value);
    });
    return [code(`--sl-${role}`), ...cells, use];
  });
}

function accentRows(src) {
  const products = need(src.registry, "products", REGISTRY);
  const ids = Object.keys(products);
  if (!ids.length) fail(`${REGISTRY} lists no product`);
  return ids.map((id) => {
    const entry = products[id];
    let name = id;
    let source = entry;
    for (let hops = 0; source.inherits; hops += 1) {
      if (hops > ids.length) fail(`${REGISTRY}: ${id} inherits in a cycle`);
      name = source.inherits;
      source = products[name];
      if (!source) fail(`${REGISTRY}: ${id} inherits a missing product ${name}`);
    }
    const accent = (theme) =>
      name === "default" ? need(src.tokens, `accent.${theme}.default`, TOKENS) : need(source, theme, `${REGISTRY} ${name}`);
    const notes = [];
    if (entry.inherits) {
      notes.push(`inherits ${code(entry.inherits)}`);
    } else {
      if (entry.depth) notes.push(`depth ${code(need(entry, "depth.light", REGISTRY))} / ${code(need(entry, "depth.dark", REGISTRY))}`);
      if (entry.fill) notes.push(`labelled fill ${code(need(entry, "fill.light", REGISTRY))} / ${code(need(entry, "fill.dark", REGISTRY))}`);
    }
    return [code(id), code(accent("light")), code(accent("dark")), notes.length ? notes.join("; ") : "—"];
  });
}

function colour(src) {
  return [
    "## 2. Colour",
    "",
    "Roles are `--sl-*` custom properties set per theme by `data-sl-theme` on the root (light, dark or high-contrast). The light and dark neutrals below are the default product's, from `neutrals.json`; every other product's are generated from the same ladder tinted with its accent hue (`themes/products.css` under `data-sl-product`, or `neutrals.json` for a hex-only consumer). High contrast keeps its literal values. Why: one temperature per product, and a neutral copied by hand drifts.",
    "",
    "### Colour roles",
    "",
    ...table(["Role", "Light", "Dark", "High contrast", "Purpose"], colourRoles(src)),
    "",
    "- **Depth is lightness.** What is nearer the viewer is lighter: canvas, then surface, then raised, then tile. Why: depth reads without lines or drop shadows.",
    "- **One accent per product.** A product picks one accent hue and derives hover, active and subtle from it; it never adds a second chromatic accent. Why: the accent is the product's identity and the carrier of selection and focus.",
    "- **Fill and text are one accent, two readings.** `--slc-accent` is what a control fills with; `--slc-accent-text` is the same hue capped in lightness for text and thin lines, and `--sl-text-on-accent` is the label on the fill. Why: an accent bright enough to fill can be too light to read as text.",
    "- **Status is not the accent.** `--sl-status-*` are shared across products and tuned for the canvas; on an inverted surface derive an on-ink pair locally. Why: the canvas inks lose contrast on ink.",
    "- **No free colour value.** Every colour resolves to a token, a registry accent or the product's generated neutral, and neutrals are never hand-tuned. Why: value equality is the invariant `sl-audit` checks.",
    "- **Viz, code and spectrum palettes are not accents** (`--sl-viz-*`, `--sl-code-*`, `--sl-spectrum-*`). They never track the product hue and never carry state. Why: a series colour must not read as selection or focus.",
    "",
    "### Accent registry",
    "",
    "One accent per product, from `agent/accent-registry.json`; the default's comes from `sondalab.tokens.json`. A product other than the default loads `themes/products.css` and sets `data-sl-product=\"<id>\"` beside `data-sl-theme`, so its neutrals take its hue. Changing an accent re-tints the product's neutrals, so it is a token change.",
    "",
    ...table(["Product", "Light", "Dark", "Note"], accentRows(src)),
  ];
}

// ---- 3. typography ----

const FONT_USE = {
  display: "Headings and the oversized anchor, semibold with negative tracking.",
  sans: "Body, controls and the labels read with a control.",
  mono: "Identifiers, figures, tags, chips, counts, meta and micro labels.",
  brand: "The wordmark and the monogram, nothing else.",
  pixel: "Display numerals, the lockup and one display word, at the `--sl-text-px-*` sizes only.",
};

function typography(src) {
  const fonts = scale(src.tokens, "shared.font", TOKENS);
  described(fonts, FONT_USE, "font role");
  const text = scale(src.tokens, "shared.text", TOKENS);
  const line = scale(src.tokens, "shared.line", TOKENS);
  return [
    "## 3. Typography",
    "",
    "Five font roles with a fixed pairing. The kit ships the faces in `fonts.css`.",
    "",
    ...table(["Role", "Stack", "Use"], Object.entries(fonts).map(([k, v]) => [code(`--sl-font-${k}`), code(v), FONT_USE[k]])),
    "",
    "Type scale:",
    "",
    ...table(["Token", "Value"], Object.entries(text).map(([k, v]) => [code(`--sl-text-${k}`), code(v)])),
    "",
    "Line heights:",
    "",
    ...table(["Token", "Value"], Object.entries(line).map(([k, v]) => [code(`--sl-line-${k}`), code(v)])),
    "",
    "- **Five roles, fixed pairing.** UI text is `--sl-font-sans`, headings `--sl-font-display`, identifiers and figures `--sl-font-mono`, the wordmark `--sl-font-brand`, the display accent `--sl-font-pixel`. There is no serif anywhere in the UI; a heading or numeral in the brand face is a defect. Why: the pairing is a family signal.",
    "- **Micro labels are mono, uppercase, lightly tracked, and only micro labels.** Eyebrows, section indices, stat labels and captions take `--sl-font-mono` at `--sl-text-micro`, uppercase, in the muted ink; uppercase anywhere else is a defect. Why: a micro label names a region, never an action.",
    "- **Headings** take `--sl-font-display`, semibold, `--sl-line-tight`, balanced, with negative tracking that tightens as the size grows. Why: tight display type carries the editorial look.",
    "- **Oversized display is structure, used sparingly:** at most one fluid anchor per screen, set solid. Why: an anchor only anchors when it is alone.",
    "- **The pixel face only at whole cells.** `--sl-font-pixel` is set at `--sl-text-px-1` to `--sl-text-px-4` only, untracked, never uppercase; a figure that changes in place keeps `--sl-font-mono`. Why: any other size smears its pixel cells, and the face is proportional with no tabular figures.",
    "- **Body measure.** Running text is capped by `--sl-measure`, a local convention, and never runs full-bleed. Why: long lines are hard to read.",
  ];
}

// ---- 4. spacing, radii and control height ----

const RADIUS_USE = {
  sm: "Rows, tiles, small chrome, tags, badges and chips.",
  md: "Controls, fields and callouts.",
  lg: "Cards, dialogs and overlays.",
  pane: "An island pane.",
  pill: "A fully rounded end; never a tag or a chip.",
};

function spacing(src) {
  const space = scale(src.tokens, "shared.space", TOKENS);
  const radius = scale(src.tokens, "shared.radius", TOKENS);
  described(radius, RADIUS_USE, "radius");
  const height = controlHeight(src.language);
  return [
    "## 4. Spacing, radii and control height",
    "",
    "Space scale:",
    "",
    ...table(["Token", "Value"], Object.entries(space).map(([k, v]) => [code(`--sl-space-${k}`), code(v)])),
    "",
    "Radii:",
    "",
    ...table(["Token", "Value", "Use"], Object.entries(radius).map(([k, v]) => [code(`--sl-radius-${k}`), code(v), RADIUS_USE[k]])),
    "",
    `- **One control height.** Button, field, select, segmented control and icon button are all ${code(height)}, each summing a fixed line, padding and a 1px edge; a product that needs a taller control scales the row, not one member of it. Why: controls that share a row share a height, so a field and its submit button align.`,
    "- **Spacing off the scale.** Every gap and padding steps off `--sl-space-*`; no arbitrary values in new work. Why: one rhythm across products.",
    "- **Radii are shape.** Controls, fields and callouts are `--sl-radius-md`, cards and dialogs `--sl-radius-lg`, tags, badges and chips `--sl-radius-sm`. Why: one corner per kind of part.",
    "- **Hairline structure.** Structural separation is a single 1px rule in the theme's line colour; no heavy borders, no drop shadow as a separator. Why: casts are reserved for what is lifted or floating.",
    "- **Hairline grid.** Card grids are a 1px `gap` over the line colour, each cell painting its own surface. Why: crisp shared rules instead of doubled borders.",
    "- **Sections lead with an index.** A section opens with a mono index label beside its heading and a 1px top rule. Why: the index is real structure, numbered only for a real sequence.",
  ];
}

// ---- 5. depth recipes ----

function depth() {
  return [
    "## 5. Depth recipes",
    "",
    "Depth is lightness, not lines: canvas, surface, raised and tile are the rungs of the neutral ladder. Seven recipes spend them as role-vars in `components.css` (`--slc-depth-*`), so no product re-derives a shadow.",
    "",
    "- **Tile** — a selection lifted out of its pane: the tile fill (`--sl-bg-tile`), a lit top hairline (`--sl-border-lit`), a 1px ring and a short cast. Hover never lifts; only selection lifts, and a selected tile carries the seam. Why: the tile is depth, not a state cue, so the seam carries the state.",
    "- **Flat tile** — a tile that does not leave its row: lit and ringed, no cast (an active tile tab). Why: it marks selection without lifting out of a strip.",
    "- **Island** — a pane on a darker frame: lit, with the quieter ring (`.sl-pane`); the pane that holds the focus is lit, with no accent rim. Why: the focused pane is the bright one at a glance.",
    "- **Key** — a keycap: a fill that steps from raised to surface, a ring, a lit top line and a base of its own fill in shade. Why: every shortcut reads as a physical key.",
    "- **Sunk** — a well, an inset cast on the sunken rung: a field, a select, a textarea, the switch and segmented tracks. Why: what you type into sits below the surface.",
    "- **Float** — an overlay: three layers of cast under the overlay's own border in shade, which is the ring (a dialog). Why: a floating surface carries its own edge.",
    "- **Cast** — an overlay that keeps no border (the palette, the toast): the float with the ring folded in, lit along its top (`--slc-depth-cast`). Why: a borderless overlay still needs an edge in shade.",
    "",
    "A host that wears a recipe carries no border of its own, so the lit line sits flush under the ring. Shadows are black at each theme's alpha (`--sl-shadow-sm`, `--sl-shadow-md`, `--sl-shadow-lg`, `--sl-shadow-inset`). High contrast trades every recipe for a drawn ring; a theme that turns a recipe off sets an empty shadow (`0 0 transparent`), never `none`, which would void the box-shadow list. Why: keys stand, tiles lift, wells sink, focus glows, one physical vocabulary across the kit.",
  ];
}

// ---- 6. signature components ----

function components(src) {
  const bezel = flavourSection(src.flavour, /bezel card/i);
  const parts = bezel.split("\n").filter((l) => /^- \S/.test(l));
  if (!parts.length) fail(`${FLAVOUR} describes no part of the bezel card`);
  return [
    "## 6. Signature components",
    "",
    "These recurring parts carry the family look. A surface need not use all of them, but any it uses matches.",
    "",
    "- **Wordmark** — the brand is typographic, with no pictorial mark: `sondalab.` in `--sl-font-brand` with the trailing period in the accent. The compact lockup is `sonda/lab`, lowercase, in `--sl-font-pixel` at `--sl-text-px-1`, untracked, with the `/` in the accent ink (`.sl-lockup`). Why: the brand face is the wordmark's and the monogram's alone, so a wordmark in the display role is a defect.",
    "- **Eyebrow** — the micro label above a heading: `--sl-font-mono`, uppercase, `--sl-text-micro`, medium weight, lightly tracked, in the muted ink. Why: it is the strongest family signal, and it names structure only.",
    "- **Tag** — an inline mono mark at `--sl-radius-sm`, in sentence case: a 1px border in a soft accent tint, a small dot before the label, accent text. Why: mono because it carries an identifier, sentence case because it is read, not shouted.",
    "- **Inversion band** — a full-width block flipped to the strongest neutral (ink ground, paper text) that punctuates the rhythm and marks the thesis or the primary call to action; at least one per long page (`.sl-invert`). A control in a band rests on the band's own hairline and takes the band's control edge on hover. Why: the recurring inversion is a core motif.",
    "- **Keycap** — every shortcut is a small physical key, `.sl-kbd`, in `--sl-font-mono`, one cap per key, wearing the key recipe. Inside a button it is a child `<kbd class=\"sl-kbd\" aria-hidden=\"true\">` and the button names the shortcut with `aria-keyshortcuts`. Why: `::after` belongs to glass, and the cap never reads weaker than the label beside it.",
    "- **Tile** — selection is a raised tile plus a seam: a short line inside its leading edge, or above its bottom edge in a tab or a segment, in the accent while its container holds the focus and in the muted ink otherwise. Why: the tile alone barely separates from its ground, and the seam carries the state at 3:1.",
    "- **Bezel card** — chosen, not yet shipped: it is not in `components.css` or `catalog.md`, so until it ships the shipped card is the one to use.",
    ...parts.map((l) => `  ${l}`),
  ];
}

// ---- 7. motion ----

const MOTION_USE = {
  fast: "Short state changes; reduced motion zeroes it.",
  mid: "Entrance reveals and most transitions; reduced motion zeroes it.",
  slow: "Longer entrances; reduced motion zeroes it.",
  ease: "Every state change.",
  enter: "What arrives (a dialog, a tooltip, a toast): moves at once, settles long.",
  "dither-in": "The hover dither wipe filling a control.",
  "dither-out": "The hover dither wipe draining from a control.",
  check: "The pixel check's fill and tick.",
  radio: "The pixel radio's dot.",
  switch: "The pixel switch's knob and fill, which end together.",
  spring: "A control returning from a press: one small overshoot, transforms only.",
};

function motion(src) {
  const tokens = scale(src.tokens, "shared.motion", TOKENS);
  described(tokens, MOTION_USE, "motion token");
  return [
    "## 7. Motion",
    "",
    ...table(["Token", "Value", "Use"], Object.entries(tokens).map(([k, v]) => [code(`--sl-motion-${k}`), code(v), MOTION_USE[k]])),
    "",
    "- **Durations come from the tokens, never a literal.** Why: reduced motion zeroes the duration tokens, which stops everything at once.",
    "- **Respect reduced motion.** Under `prefers-reduced-motion: reduce` nothing animates; never add motion that bypasses the tokens. The dither wipe and the pixel-control frames are never armed there, so their durations are not zeroed. Why: motion must stay optional.",
    "- **No page-load choreography in the kit.** The kit animates what arrives, never the page itself; a page that wants an entrance stagger owns it, on the motion tokens. Why: the page is content, not a show.",
    "- **Stagger related entrances** rather than fading the whole screen at once. Why: a stagger shows order, a whole-screen fade shows nothing.",
    "- **Entrances rise a little.** A small rise plus opacity on `--sl-motion-mid` or `--sl-motion-slow`, as transitions, never keyframes. Why: a browser without `@starting-style` simply shows the element.",
    "- **The hover is a dither wipe.** On a button or icon button the pointer's answer is a fill that grows through an 8x8 Bayer threshold on the kit's pixel cell from where the pointer entered and drains toward where it left, clipped to the control's radius; once half the control is covered its label flips to the on-fill pole. Why: the pixel cell is the kit's unit, and the silhouette stays smooth.",
    "- **Controls give under the finger.** Held, a text button sinks a little and returns on `--sl-motion-spring`; tabs, rows, fields and cards do not move. Transitions only. Why: a keyframe would also play when a page loads with a box already checked.",
    "- **Pixel controls.** The check, radio and switch draw their final frames in CSS on the pixel lattice; the motion (`--sl-motion-check`, `--sl-motion-radio`, `--sl-motion-switch`) only plays the way there. Why: with reduced motion, high contrast or no script they show the same shapes.",
  ];
}

// ---- 8. effect families ----

function effects(src) {
  const meaning = effectMeanings(src.language);
  return [
    "## 8. Effect families",
    "",
    "Effects are an opt-in import (`effects.css`, plus `effects.js`). Classes are additive (`.sl-fx-*` on a shipped `.sl-*` class), and every hue is derived from a role-var, never a literal.",
    "",
    `- **Glitch** means *${meaning.Glitch}*: a value changes, a destructive action is confirmed, validation fails. It is never ambient on a control.`,
    `- **Aurora** means *${meaning.Aurora}*: focus, an active tab, a running operation, the primary call to action. It is a 1px arc of light on an edge that already exists, and it renders state without being the state (\`aria-busy\`, \`role="progressbar"\`).`,
    `- **Glass** means *${meaning.Glass}*, a state rather than an event: a card edge, a field, a keycap. It is chrome on the element's own border and never animates on its own.`,
    `- **Goo** means *${meaning.Goo}*: it marks a set and answers the layout, not the pointer. A form control or a link is never a member.`,
    "",
    "- **One meaning each.** A family never fires outside the meaning it owns, and an effect that means nothing is switched off. Why: structure encodes truth, in motion too.",
    "- **The effect budget.** At most one ambient aurora and one glitch burst per document at a time; busy auroras are exempt. Why: two competing lights mean nothing.",
    "- **Three kill switches.** `prefers-reduced-motion: reduce`, `[data-sl-theme=\"high-contrast\"]` and `data-sl-fx=\"off\"` on any element; no effect replaces or removes the focus outline. Why: an effect is decoration on top of the state.",
    "- **Disabled is a checkerboard, not a dimming.** A disabled control is greyed by a checker of 1px cells drawn as a `mask-image` on the control itself. Why: the control stays legible as a shape and plainly unavailable.",
    "- **Light and shape, never weight.** An effect is a pixel or two wide and fades within a few tens of pixels; a separator stays 1px whatever an effect does, and no effect rewrites a declared value. Why: the surface under an effect stays free to set its own radius and edges.",
  ];
}

// ---- 9. do and do not ----

const OWNER_PREFIX = /^Owner (?:decision|ruling)(?:,\s*\d{4}-\d{2}-\d{2})?:\s*/i;

/** The reason for a do-not item, where the rule in flavour.md is only an attribution. */
const DO_NOT_REASON = {
  "Figurative art": "The brand is typographic, with no pictorial mark.",
};

function currentRule(text) {
  const rule = text.replace(OWNER_PREFIX, "").trim();
  if (!rule) fail(`${FLAVOUR} has a do-not-converge row with no rule`);
  return rule.charAt(0).toUpperCase() + rule.slice(1);
}

function dos(src) {
  const traits = tableRows(flavourSection(src.flavour, /the traits/i), 3, `${FLAVOUR} traits`);
  const avoid = tableRows(flavourSection(src.flavour, /do not converge/i), 2, `${FLAVOUR} do-not-converge`);
  return [
    "## 9. Do and do not",
    "",
    "From `agent/flavour.md`. A pattern borrowed from an external reference may add to the do list; it never replaces an item of it and never brings in an item of the do-not list.",
    "",
    "### Do",
    "",
    ...traits.map(([, trait, source]) => `- ${trait} See ${source}.`),
    "",
    "### Do not",
    "",
    ...avoid.map(([trait, rule]) => `- **${trait}.** ${DO_NOT_REASON[trait] ?? currentRule(rule)}`),
  ];
}

// ---- assembly ----

function header() {
  return [
    "# Sondalab DESIGN.md",
    "",
    "> **What this file is:** the Sondalab design system in one file for design agents: each token with its rule and the reason for it, so a new surface is on-system from its first line.",
    "> **Generated** by `scripts/gen-design-md.mjs` from `sondalab.tokens.json`, `neutrals.json`, `agent/accent-registry.json`, `design-language.md` and `agent/flavour.md`. Do not edit it by hand; run `npm run gen:design-md`.",
    "> **Authority:** `design-language.md` holds the full rules; L1 to L6 and Decision 2 name its sections.",
  ];
}

const BANNED = [
  [/\d{4}-\d{2}-\d{2}/, "a date"],
  [/\bowner\b/i, "an owner annotation"],
  [/\bamend(?:ed|ment)\b/i, "an amendment note"],
  [/\b(?:until|since) (?:ui-kit )?v?\d+\.\d+/i, "version history"],
];

export function buildDesignMd() {
  const src = loadSources();
  const text = [
    header(),
    brand(),
    colour(src),
    typography(src),
    spacing(src),
    depth(),
    components(src),
    motion(src),
    effects(src),
    dos(src),
  ]
    .map((lines) => lines.join("\n"))
    .join("\n\n") + "\n";
  for (const [re, what] of BANNED) {
    const m = text.match(re);
    if (m) fail(`the output carries ${what} ("${m[0]}"); state the rule in its current form`);
  }
  return text;
}

function runDirectly() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch {
    return false;
  }
}

if (runDirectly()) {
  const text = buildDesignMd();
  writeFileSync(resolve(REPO, OUT_REL), text);
  console.log(`gen-design-md: wrote ${OUT_REL}`);
}
