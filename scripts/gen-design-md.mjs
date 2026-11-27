#!/usr/bin/env node
// gen-design-md — build packages/ui-kit/agent/DESIGN.md, the agent-readable
// design system in one file: each token beside its rule and the reason for it.
//
// Values are read at build time from sondalab.tokens.json, the generated
// packages/ui-kit/neutrals.json (the default product's baked neutrals), the
// accent registry, the component catalog (agent/catalog.json, and the first
// html example of each component in agent/catalog.md), the kit README
// (the stylesheets and their import order), docs/design-language.md (the
// control height, the measure, the effect meanings and the settings screen
// rule) and packages/ui-kit/agent/flavour.md (the traits, the bezel card and
// the do-not-converge list). Nothing here repeats a value; the prose holds the
// rules in their current form only. Every value is printed final: the light
// label on the accent is resolved from the label derivation, and a value that
// still holds var() of a private (--_*) property makes the build throw. When a
// source the generator relies on is missing, it throws instead of writing.
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
const CATALOG = "packages/ui-kit/agent/catalog.json";
const CATALOG_MD = "packages/ui-kit/agent/catalog.md";
const README = "packages/ui-kit/README.md";

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
    catalog: readJson(CATALOG),
    catalogMd: readText(CATALOG_MD),
    readme: readText(README),
  };
}

function controlHeight(language) {
  const m = language.match(/are all \*\*(\d+(?:\.\d+)?px)\*\*/);
  if (!m) fail(`${LANGUAGE} no longer states the control height ("are all **<n>px**")`);
  return m[1];
}

function measure(language) {
  const m = language.match(/--sl-measure:\s*(\d+(?:\.\d+)?ch)/);
  if (!m) fail(`${LANGUAGE} no longer states the body measure ("--sl-measure: <n>ch")`);
  return m[1];
}

/** The settings and form screen rule of L2, without its approval note. */
function settingsRule(language) {
  const from = language.indexOf("### L2");
  const to = language.indexOf("### L3");
  if (from < 0 || to < from) fail(`${LANGUAGE} has no L2 part`);
  const m = language.slice(from, to).match(/^- \*\*(Settings and form screens)\*\*(?: \([^)]*\))?\.\s+(\S.*)$/m);
  if (!m) fail(`${LANGUAGE} L2 no longer states the settings and form screen rule ("- **Settings and form screens** ...")`);
  return `- **${m[1]}.** ${m[2].trim()}`;
}

// ---- colour arithmetic: the label derivation, resolved to a final value ----

function hexChannels(hex, what) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) fail(`${what} is not a hex colour: ${hex}`);
  const full = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

/** The oklch lightness of a hex colour. */
function oklchL(hex, what) {
  const [r, g, b] = hexChannels(hex, what).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

const num = (n) => String(Number(n.toFixed(4)));

function labelPoles(tokens) {
  const poleL = need(tokens, "label.pole-l", TOKENS);
  const poleDark = need(tokens, "label.pole-dark", TOKENS);
  if (typeof poleL !== "number" || typeof poleDark !== "number") fail(`${TOKENS} label.pole-l and label.pole-dark must be numbers`);
  return { poleL, poleDark };
}

/**
 * The label on a fill, as the kit's on-fill macro computes it:
 * oklch(clamp(pole-dark, (pole-l - l) * 1000, 1) 0 h), white at the top.
 */
function labelOn(fill, tokens, what) {
  const { poleL, poleDark } = labelPoles(tokens);
  const L = Math.min(1, Math.max(poleDark, (poleL - oklchL(fill, what)) * 1000));
  return L >= 1 ? "#ffffff" : `oklch(${num(L)} 0 0)`;
}

/** The label derivation as the tokens write it on a theme. */
const ON_ACCENT = /^oklch\(\s*from\s+var\(\s*--sl-accent-default\s*\)\s+var\(\s*--_sl-on\s*\)\s*\)$/;

/** A theme's value with the label derivation resolved; anything else as written. */
function finalColour(value, theme, tokens, what) {
  if (ON_ACCENT.test(value.trim())) return labelOn(need(tokens, `accent.${theme}.default`, TOKENS), tokens, `${what} (${theme} accent)`);
  return value;
}

const PRIVATE_VAR = /var\(\s*--_[\w-]*/;

const THEME_NAME = { light: "light", dark: "dark", "high-contrast": "high contrast" };

function listing(items) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// ---- 1. use the kit ----

/** The kit's stylesheets in their import order, from the README's first css block. */
function kitImports(readme) {
  const block = readme.match(/```css\n([\s\S]*?)```/);
  if (!block) fail(`${README} has no css block of imports`);
  const files = [];
  for (const line of block[1].split("\n")) {
    const m = line.match(/^@import "(@sondalab\/ui-kit\/[^"]+)";\s*(?:\/\*\s*(.*?)\s*\*\/)?\s*$/);
    if (m) files.push({ file: m[1], optional: /^optional\b/i.test(m[2] ?? "") });
  }
  for (const name of ["tokens.css", "components.css"]) {
    if (!files.some((f) => f.file.endsWith(`/${name}`))) fail(`${README} no longer imports ${name}`);
  }
  return files;
}

/** What each catalog component is for, keyed by its catalog id. */
const COMPONENT_PURPOSE = {
  eyebrow: "The mono uppercase micro label above a heading.",
  tag: "An inline mono mark for a status or a classification, in sentence case.",
  chip: "A mono filter or reference control that toggles on, with an optional count.",
  button: "The text button: primary, secondary (ghost), small, and the danger tone.",
  link: "An inline link in the accent.",
  badge: "A small status mark in a line of text; `--live` breathes while its state lasts.",
  card: "A bounded surface with a title and a body.",
  field: "A labelled input with its hint and its error line.",
  callout: "A block note in a status tone, with a title and a body.",
  rule: "A 1px structural divider, optionally labelled.",
  table: "A data table; `--numeric` aligns figures.",
  tabs: "Tabs over panels, and the IDE's tile tab strip with an unsaved dot and a close glyph.",
  tooltip: "A short label that floats beside its trigger.",
  kbd: "A keycap for a shortcut, and inline code.",
  dialog: "A modal overlay on the float recipe, with a title, a body and actions.",
  toast: "A transient message in a stack at the bottom right, with a tone and an optional timer.",
  "fx-glass": "Effect: glass chrome on the element's own border, for a physical surface.",
  "fx-aurora": "Effect: a 1px arc of light on an existing edge, where attention lives.",
  "fx-goo": "Effect: welds the members of a set into one substance.",
  "fx-press": "Effect: the light of a press on a control.",
  "fx-glitch": "Effect: a burst when something re-resolves (a value change, a confirmed destructive action, a failed validation).",
  "fx-halftone": "Effect: a halftone ornament, opted into by its data attributes rather than a class.",
  "sticky-header": "The sticky translucent page header: the lockup on the left, meta and controls on the right, a 1px bottom rule.",
  "inversion-band": "A full-width band flipped to the strongest neutral, for the thesis or the primary call to action.",
  "hairline-grid": "A card grid ruled by a 1px gap over the line colour.",
  "section-index": "A section with its mono index label, its heading and a 1px top rule.",
  "oversized-anchor": "The one oversized display heading of a screen, set solid.",
  haze: "A soft glow of the light theme's spectrum behind a block, as an opt-in ornament.",
  "spectral-text": "Text in the light theme's spectrum ink, as an opt-in ornament.",
  checkbox: "The pixel check box with its label.",
  radio: "The pixel radio with its label.",
  switch: "The pixel switch with its label.",
  select: "A native select, sunken like a field.",
  wrap: "The max-width content wrap with the fluid gutter.",
  prose: "Running text capped at the body measure.",
  breadcrumb: "A path of links to the current page.",
  "button-group": "Buttons joined into one outlined group with 1px rules between them.",
  segmented: "A segmented control: a sunk track whose chosen segment is a raised tile.",
  progress: "A determinate progress bar, in the accent or a status tone.",
  slider: "A range input on the kit's track and thumb.",
  "icon-button": "A square or round button holding a glyph, with the danger tone.",
  pagination: "Page links; the current page is a tile with the seam.",
  "empty-state": "The message of an empty panel: a title and a body.",
  skeleton: "A placeholder block while content loads.",
  stat: "A figure with its micro label; the value is set in the pixel face.",
  nav: "A sidebar navigation of grouped items with counts; the current item is a tile with the seam.",
  list: "Rows of items with meta; the selected row is a tile with the seam, and `--dense` tightens the rows.",
  disclosure: "A details and summary block that opens and closes.",
  kv: "A key-value list of facts.",
  resizer: "A drag handle between two panes, vertical or horizontal.",
  titlebar: "Workbench: the top frame with the product's mark, a crumb, the command field and icon buttons.",
  pane: "Workbench: an island pane on the frame; the pane that holds the focus is lit.",
  statusbar: "Workbench: the meta line of facts at the foot of the window.",
  activitybar: "Workbench: the column of view glyphs with count badges; the current view is a flat tile with the seam.",
  tree: "Workbench: an indented tree of rows with twisties and optional guides.",
  palette: "Workbench: the command palette overlay with its field, grouped results and keycaps.",
  "term-block": "Workbench: one command and its output as a small island, with its exit status.",
  "term-output": "Workbench: the terminal role spans inside a terminal block's output, and its full-screen mode.",
  wordmark: "The `sondalab.` wordmark in the brand face, its period in the accent.",
  lockup: "The compact `sonda/lab` lockup in the pixel face.",
  "pixel-word": "One emphasised word in a heading, set in the pixel face.",
  monogram: "The `s.` monogram on a square avatar tile.",
  figure: "An image or media block with a caption.",
  avatar: "The picture of a person or an agent, in three sizes.",
  compositions: "Page compositions shipped in `compositions.css`, with no class listed in the catalog.",
  signal: "A decorative dithered signal strip, drawn by `mountSignals()`.",
  art: "Opt-in static art on the pixel cell: eyebrow marks, rule strips, a card corner, fields, empty-state pieces, posters and horizons.",
};

function componentRows(catalog) {
  const list = need(catalog, "components", CATALOG);
  if (!Array.isArray(list) || !list.length) fail(`${CATALOG} lists no component`);
  const ids = new Set();
  for (const c of list) {
    if (!c || typeof c.id !== "string" || !c.id) fail(`${CATALOG} has a component with no id`);
    if (ids.has(c.id)) fail(`${CATALOG} lists ${c.id} twice`);
    ids.add(c.id);
    if (!Array.isArray(c.classes)) fail(`${CATALOG} ${c.id} has no classes list`);
  }
  for (const id of ids) if (!(id in COMPONENT_PURPOSE)) fail(`no purpose is written for catalog component ${id}`);
  for (const id of Object.keys(COMPONENT_PURPOSE)) if (!ids.has(id)) fail(`catalog component ${id} is gone from ${CATALOG}`);
  return list.map((c) => {
    const purpose = typeof c.purpose === "string" ? c.purpose : COMPONENT_PURPOSE[c.id];
    if (!purpose.trim()) fail(`catalog component ${c.id} has a blank purpose`);
    const classes = c.classes.length ? c.classes.map((cls) => code(`.${cls}`)).join(", ") : "—";
    return [code(c.id), c.kind ?? "—", classes, purpose.trim()];
  });
}

// Catalog components that ship no markup of their own: halftone is a script
// mount, and compositions are page layouts with no class in the catalog.
const NO_MARKUP = new Set(["fx-halftone", "compositions"]);
const FENCE = "```";

/**
 * The first `html` example under each catalog.md heading, keyed by every
 * `sl-*` class the heading names. A component's markup is the example of the
 * first heading that names its first class. Throws when a component outside
 * NO_MARKUP has no example, so a catalog edit cannot drop one silently.
 */
function componentMarkup(catalog, catalogMd) {
  const heads = [...catalogMd.matchAll(/^### (.*)$/gm)];
  const byClass = new Map();
  heads.forEach((h, i) => {
    const body = catalogMd.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : catalogMd.length);
    const m = body.match(new RegExp(`${FENCE}html\\n([\\s\\S]*?)${FENCE}`));
    for (const [, cls] of h[1].matchAll(/`(sl-[\w-]+)`/g)) if (!byClass.has(cls)) byClass.set(cls, m ? m[1].trimEnd() : null);
  });
  const out = [];
  for (const c of need(catalog, "components", CATALOG)) {
    if (NO_MARKUP.has(c.id)) continue;
    const html = c.classes.length ? byClass.get(c.classes[0]) : null;
    if (!html) fail(`${CATALOG_MD} has no html example for catalog component ${c.id}`);
    out.push(`#### ${code(c.id)}`, "", `${FENCE}html`, html, FENCE, "");
  }
  for (const id of NO_MARKUP) if (!need(catalog, "components", CATALOG).some((c) => c.id === id)) fail(`catalog component ${id} is gone from ${CATALOG}`);
  return out.slice(0, -1);
}

function useKit(src) {
  const imports = kitImports(src.readme);
  return [
    "## 1. Use the kit",
    "",
    "Build every surface on `@sondalab/ui-kit`, the CSS kit that ships these tokens and components. Import its stylesheets in this order, as the kit's `README.md` does:",
    "",
    ...imports.map((f, n) => `${n + 1}. ${code(f.file)}${f.optional ? " (optional)" : ""}`),
    "",
    "- **Theme on the root.** Set `data-sl-theme` on the root element (`light`, `dark` or `high-contrast`). A product other than the default also loads `themes/products.css` and sets `data-sl-product=\"<id>\"` on the same root, its id from the accent registry. Why: every role resolves under these two attributes, and without `data-sl-product` the page gets the default product's neutrals.",
    "- **A product sets its accent on the root.** `themes/products.css` gives a product its neutrals and, where the registry names one, its labelled fill; it does not set the accent. The product sets `--sl-accent-default` on the root to its registry accent, one value per theme (under `[data-sl-theme=\"light\"]` and `[data-sl-theme=\"dark\"]`), and the kit derives hover, subtle, the text reading and the label on the fill from it. Why: every accent step is derived from that one property, so setting it alone re-colours the whole family.",
    "- **Never rebuild a shipped component; use its class.** Every part in the table below ships in the kit's stylesheets: write its markup as in the examples under Markup, with its `.sl-*` classes on the same elements, and put an `.sl-fx-*` effect class on top of it, never in its place. Why: a hand-built copy drifts from the tokens, the states and the themes the class already carries.",
    "",
    "### Components",
    "",
    ...table(["Component", "Kind", "Classes", "Purpose"], componentRows(src.catalog)),
    "",
    "### Markup",
    "",
    "One example per component, the first in `agent/catalog.md`; that file holds the variants and states. Copy the element structure and the classes, and replace the text.",
    "",
    ...componentMarkup(src.catalog, src.catalogMd),
  ];
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

// ---- 2. brand and voice ----

function brand() {
  return [
    "## 2. Brand and voice",
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

// ---- 3. colour ----

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
      const final = finalColour(value, theme, src.tokens, `--sl-${role}`);
      if (PRIVATE_VAR.test(final)) fail(`colour role ${role} ${theme} still holds a private property: ${final}`);
      return code(final);
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

/** One sentence per product with a labelled fill: what the fill is for. */
function fillNotes(src) {
  const products = need(src.registry, "products", REGISTRY);
  return Object.entries(products)
    .filter(([, entry]) => !entry.inherits && entry.fill)
    .map(([id, entry]) => {
      const light = need(entry, "fill.light", `${REGISTRY} ${id}`);
      const dark = need(entry, "fill.dark", `${REGISTRY} ${id}`);
      const where = light === dark ? `${code(light)} on both themes` : `${code(light)} on light and ${code(dark)} on dark`;
      const poles = [...new Set([light, dark].map((f) => (labelOn(f, src.tokens, `${REGISTRY} ${id} fill`) === "#ffffff" ? "white" : "dark")))];
      return `${code(id)}'s labelled fill is ${where}: its filled controls (the primary, a checked check, radio or switch, a count badge) take it instead of the accent so their ${poles.join(" or ")} label reads, and links, tags and the focus ring stay on the accent.`;
    });
}

function colour(src) {
  const { poleL, poleDark } = labelPoles(src.tokens);
  const notes = fillNotes(src);
  return [
    "## 3. Colour",
    "",
    "Roles are `--sl-*` custom properties set per theme by `data-sl-theme` on the root (light, dark or high-contrast). The light and dark neutrals below are the default product's, from `neutrals.json`; every other product's are generated from the same ladder tinted with its accent hue (`themes/products.css` under `data-sl-product`, or `neutrals.json` for a hex-only consumer). High contrast keeps its literal values. Why: one temperature per product, and a neutral copied by hand drifts.",
    "",
    "### Colour roles",
    "",
    ...table(["Role", "Light", "Dark", "High contrast", "Purpose"], colourRoles(src)),
    "",
    "- **Depth is lightness.** What is nearer the viewer is lighter: canvas, then surface, then raised, then tile. Why: depth reads without lines or drop shadows.",
    "- **One accent per product.** A product picks one accent hue and derives hover, active and subtle from it; it never adds a second chromatic accent. Why: the accent is the product's identity and the carrier of selection and focus.",
    "- **Fill and text are one accent, two readings.** `--slc-accent` is what a control fills with; `--slc-accent-text` is the same hue capped in lightness for text and thin lines, and `--sl-text-on-accent` is the label on the fill. " +
      `On light that label follows the fill: white where the fill's oklch lightness is below ${num(poleL)}, ${code(`oklch(${num(poleDark)} 0 0)`)} above it; the table gives it for the default accent. ` +
      "Why: an accent bright enough to fill can be too light to read as text.",
    "- **Status is not the accent.** `--sl-status-*` are shared across products and tuned for the canvas; on an inverted surface derive an on-ink pair locally. Why: the canvas inks lose contrast on ink.",
    "- **No free colour value.** Every colour resolves to a token, a registry accent or the product's generated neutral, and neutrals are never hand-tuned. Why: value equality is the invariant `sl-audit` checks.",
    "- **Viz, code and spectrum palettes are not accents** (`--sl-viz-*`, `--sl-code-*`, `--sl-spectrum-*`). They never track the product hue and never carry state. Why: a series colour must not read as selection or focus.",
    "",
    "### Accent registry",
    "",
    "One accent per product, from `agent/accent-registry.json`; the default's comes from `sondalab.tokens.json`. A product other than the default loads `themes/products.css` and sets `data-sl-product=\"<id>\"` beside `data-sl-theme`, so its neutrals take its hue, and sets `--sl-accent-default` on the root to the accent below for each theme. Changing an accent re-tints the product's neutrals, so it is a token change.",
    "",
    ...table(
      ["Product (`data-sl-product`)", "Accent, light theme", "Accent, dark theme", "Depth companion, labelled fill or inheritance"],
      accentRows(src),
    ),
    ...(notes.length ? ["", ...notes] : []),
  ];
}

// ---- 4. typography ----

const FONT_USE = {
  display: "Headings and the oversized anchor, semibold with negative tracking.",
  sans: "Body, controls and the labels read with a control.",
  mono: "Identifiers, figures, tags, chips, counts, meta and micro labels.",
  brand: "The wordmark and the monogram, nothing else.",
  pixel: "The display accent: a section index, a card's folio, a step number, a stat's value, the compact lockup and one emphasised word in a heading, at the `--sl-text-px-*` sizes only.",
};

function typography(src) {
  const fonts = scale(src.tokens, "shared.font", TOKENS);
  described(fonts, FONT_USE, "font role");
  const text = scale(src.tokens, "shared.text", TOKENS);
  const line = scale(src.tokens, "shared.line", TOKENS);
  const measureValue = measure(src.language);
  return [
    "## 4. Typography",
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
    "- **The pixel face marks six display roles, only at whole cells.** A section index, a card's folio, a step number, a stat's value, the compact lockup and one emphasised word in a heading take `--sl-font-pixel`, at `--sl-text-px-1` to `--sl-text-px-4` only, untracked, never uppercase; body and UI text stay in Geist, code in Geist Mono, and a figure that changes in place keeps `--sl-font-mono`. The rule is about role, not size: a micro section index is a micro label and stays mono. Why: any other size smears its pixel cells, and the face is proportional with no tabular figures.",
    `- **Body measure.** Running text is capped by ${code(`--sl-measure: ${measureValue}`)}, a local convention rather than a token, and never runs full-bleed. Why: long lines are hard to read.`,
  ];
}

// ---- 5. spacing, radii, control height and screen layout ----

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
  const settings = settingsRule(src.language);
  return [
    "## 5. Spacing, radii, control height and screen layout",
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
    settings,
  ];
}

// ---- 6. depth recipes ----

/** --sl-shadow-inset per theme, themes with the same value named together. */
function insetLine(src) {
  const groups = [];
  for (const theme of THEMES) {
    const value = need(src.tokens, `shadow.${theme}.inset`, TOKENS);
    if (typeof value !== "string" || !value.trim()) fail(`${TOKENS} shadow.${theme}.inset has no value`);
    const group = groups.find((g) => g.value === value);
    if (group) group.themes.push(THEME_NAME[theme]);
    else groups.push({ value, themes: [THEME_NAME[theme]] });
  }
  return `The well's cast, \`--sl-shadow-inset\`: ${groups.map((g) => `${listing(g.themes)} ${code(g.value)}`).join("; ")}.`;
}

function depth(src) {
  return [
    "## 6. Depth recipes",
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
    "",
    insetLine(src),
  ];
}

// ---- 7. signature components ----

function components(src) {
  const bezel = flavourSection(src.flavour, /bezel card/i);
  const parts = bezel.split("\n").filter((l) => /^- \S/.test(l));
  if (!parts.length) fail(`${FLAVOUR} describes no part of the bezel card`);
  return [
    "## 7. Signature components",
    "",
    "These recurring parts carry the family look. A surface need not use all of them, but any it uses matches.",
    "",
    "- **Wordmark** — the brand is typographic, with no pictorial mark: `sondalab.` in `--sl-font-brand` with the trailing period in the accent. The compact lockup is `sonda/lab`, lowercase, in `--sl-font-pixel` at `--sl-text-px-1`, untracked, with the `/` in the accent ink (`.sl-lockup`). Why: the brand face is the wordmark's and the monogram's alone, so a wordmark in the display role is a defect.",
    "- **Product name** — a product's name in a header or title bar is set in the display face (`--sl-font-display`) at weight 700 with an accent dot after it (`.sl-titlebar__mark`); the `sondalab.` wordmark in the brand face (`--sl-font-brand`) stays the brand alone. Why: the product's name is UI type, and the brand face belongs to the brand.",
    "- **Eyebrow** — the micro label above a heading: `--sl-font-mono`, uppercase, `--sl-text-micro`, medium weight, lightly tracked, in the muted ink. Why: it is the strongest family signal, and it names structure only.",
    "- **Tag** — an inline mono mark at `--sl-radius-sm`, in sentence case: a 1px border in a soft accent tint, a small dot before the label, accent text. Why: mono because it carries an identifier, sentence case because it is read, not shouted.",
    "- **Inversion band** — a full-width block flipped to the strongest neutral (ink ground, paper text) that punctuates the rhythm and marks the thesis or the primary call to action; at least one per long page (`.sl-invert`). A control in a band rests on the band's own hairline and takes the band's control edge on hover. Why: the recurring inversion is a core motif.",
    "- **Keycap** — every shortcut is a small physical key, `.sl-kbd`, in `--sl-font-mono`, one cap per key, wearing the key recipe. Inside a button it is a child `<kbd class=\"sl-kbd\" aria-hidden=\"true\">` and the button names the shortcut with `aria-keyshortcuts`. Why: `::after` belongs to glass, and the cap never reads weaker than the label beside it.",
    "- **Tile** — selection is a raised tile plus a seam: a short line inside its leading edge, or above its bottom edge in a tab or a segment, in the accent while its container holds the focus and in the muted ink otherwise. Why: the tile alone barely separates from its ground, and the seam carries the state at 3:1.",
    "- **Bezel card** — chosen, not yet shipped: it is not in `components.css` or `catalog.md`, so until it ships the shipped card is the one to use.",
    ...parts.map((l) => `  ${l}`),
  ];
}

// ---- 8. motion ----

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
    "## 8. Motion",
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

// ---- 9. effect families ----

function effects(src) {
  const meaning = effectMeanings(src.language);
  return [
    "## 9. Effect families",
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

// ---- 10. do and do not ----

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
    "## 10. Do and do not",
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
    "> **Generated** by `scripts/gen-design-md.mjs` from `sondalab.tokens.json`, `neutrals.json`, `agent/accent-registry.json`, `agent/catalog.json`, `agent/catalog.md`, the kit's `README.md`, `design-language.md` and `agent/flavour.md`. Do not edit it by hand; run `npm run gen:design-md`.",
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
    useKit(src),
    brand(),
    colour(src),
    typography(src),
    spacing(src),
    depth(src),
    components(src),
    motion(src),
    effects(src),
    dos(src),
  ]
    .map((lines) => lines.join("\n"))
    .join("\n\n") + "\n";
  const unresolved = text.match(PRIVATE_VAR) ?? text.match(/--_sl-[\w-]*/);
  if (unresolved) fail(`a printed value still holds a private custom property ("${unresolved[0]}"); print its final value`);
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
