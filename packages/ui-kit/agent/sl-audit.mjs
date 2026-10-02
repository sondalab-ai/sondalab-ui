#!/usr/bin/env node
// sl-audit — deterministic Sondalab design-system compliance audit.
// Checks only what is decidable from CSS text (colour value-equality, tier
// consistency). Judgement-level rules (missing labels, editorial voice,
// layout composition) are out of scope by design — they belong to the
// sl-ds-auditor subagent. See design-system-agentic-spec.md.
//
// Ships inside @sondalab/ui-kit as the `sl-audit` bin. It resolves the colour
// allowlist from the package's own token CSS (tokens.css + themes/*.css) plus
// the audited product's generated neutrals (neutrals.json), so it works
// identically in-repo and when installed in a consumer's node_modules.
// Surface globs resolve against the caller's cwd.

import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url)); // packages/ui-kit/agent
const PKG_DIR = resolve(HERE, ".."); // packages/ui-kit — holds tokens.css + themes/
const TOKEN_CSS = ["tokens.css", "themes/light.css", "themes/dark.css", "themes/high-contrast.css"];

// --- colour normalization -------------------------------------------------

/** Canonicalize a CSS colour literal to lowercase `#rrggbb` or `#rrggbbaa`.
 * Returns null for anything that is not a hex/rgb literal (var(), keywords). */
export function normalizeColor(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();

  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) return "#" + [...h].map((c) => c + c).join("");
    if (h.length === 4) return "#" + [...h].map((c) => c + c).join("");
    if (h.length === 6) return "#" + h;
    if (h.length === 8) return "#" + h;
    return null; // 5 or 7 digits: not a valid colour
  }

  const rgb = /^rgba?\(([^)]*)\)$/.exec(s);
  if (rgb) {
    const body = rgb[1].trim();
    let rgbPart = body;
    let alpha = null;
    if (body.includes("/")) {
      const [lhs, rhs] = body.split("/");
      rgbPart = lhs.trim();
      alpha = rhs.trim();
    }
    const parts = rgbPart.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 3) return null;
    if (alpha === null && parts.length >= 4) alpha = parts[3];
    const [r, g, b] = parts.slice(0, 3).map((n) => channelToHex(n));
    if (r === null || g === null || b === null) return null;
    let out = "#" + r + g + b;
    if (alpha !== null) {
      const a = alphaToHex(alpha);
      if (a !== null && a !== "ff") out += a;
    }
    return out;
  }

  return null;
}

function channelToHex(n) {
  let v;
  if (n.endsWith("%")) v = Math.round((parseFloat(n) / 100) * 255);
  else v = Math.round(parseFloat(n));
  if (!Number.isFinite(v)) return null;
  v = Math.max(0, Math.min(255, v));
  return v.toString(16).padStart(2, "0");
}

function alphaToHex(a) {
  const v = parseFloat(a);
  if (!Number.isFinite(v)) return null;
  return Math.round(Math.max(0, Math.min(1, v)) * 255)
    .toString(16)
    .padStart(2, "0");
}

/** The opaque base (`#rrggbb`) of a normalized colour, dropping any alpha. */
export function colorBase(normalized) {
  return normalized.slice(0, 7);
}

// --- extraction -----------------------------------------------------------

const COLOR_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\([^)]*\)/g;

/** Every hex/rgb literal in a CSS string, with 1-based line numbers.
 * var() references are intentionally ignored — they resolve to tokens. */
export function extractColors(css) {
  const out = [];
  for (const m of css.matchAll(COLOR_RE)) {
    const line = css.slice(0, m.index).split("\n").length;
    out.push({ value: m[0], line });
  }
  return out;
}

function collectStrings(node, acc) {
  if (typeof node === "string") acc.push(node);
  else if (Array.isArray(node)) for (const v of node) collectStrings(v, acc);
  else if (node && typeof node === "object")
    for (const v of Object.values(node)) collectStrings(v, acc);
  return acc;
}

/** Set of opaque colour bases (`#rrggbb`) appearing anywhere in a tokens.json
 * object. Kept for unit tests and callers that hold the token object. */
export function buildAllowlistBases(tokens) {
  const bases = new Set();
  for (const s of collectStrings(tokens, [])) {
    for (const { value } of extractColors(s)) {
      const norm = normalizeColor(value);
      if (norm) bases.add(colorBase(norm));
    }
  }
  return bases;
}

/** Set of opaque colour bases extracted from token CSS text (tokens.css +
 * themes/*.css). This is the shipped, drift-proof allowlist source — the CSS is
 * generated from sondalab.tokens.json and always ships with the package. */
export function buildAllowlistBasesFromCss(cssTexts) {
  const bases = new Set();
  for (const css of cssTexts) {
    for (const { value } of extractColors(css)) {
      const norm = normalizeColor(value);
      if (norm) bases.add(colorBase(norm));
    }
  }
  return bases;
}

/** Opaque colour bases of ONE product's generated neutrals (neutrals.json,
 * `products.<id>.{light,dark}`), following `inherits` when an entry carries
 * no values of its own. Each product's neutrals are tinted with its own accent
 * hue, so a spexr ground is a value-equal token on spexr and a free-floating
 * colour anywhere else. The default product's neutrals need no entry here:
 * they ship in themes/*.css and are allowed for every product. */
export function productNeutralBases(neutrals, product) {
  const bases = new Set();
  const seen = new Set();
  let name = product;
  while (name && neutrals?.products?.[name]) {
    if (seen.has(name)) throw new Error(`neutrals.json: circular inherits at "${name}"`);
    seen.add(name);
    const entry = neutrals.products[name];
    if (entry.light || entry.dark) {
      for (const s of collectStrings([entry.light, entry.dark], [])) {
        const norm = normalizeColor(s);
        if (norm) bases.add(colorBase(norm));
      }
      break;
    }
    name = entry.inherits;
  }
  return bases;
}

/** The allowlist one audit runs against: every colour in the shipped token
 * CSS (the default product's neutrals among them), plus the audited product's
 * own generated neutrals. */
export function allowlistForProduct({ cssTexts, neutrals, product }) {
  const bases = buildAllowlistBasesFromCss(cssTexts);
  for (const b of productNeutralBases(neutrals, product)) bases.add(b);
  return bases;
}

function accentColorStrings(accentEntry) {
  return collectStrings(accentEntry, []).filter((s) => normalizeColor(s));
}

// --- tier detection -------------------------------------------------------

/** 'A' (data-sl-theme), 'B' (data-theme), or null if neither appears. */
/** The text with every block and HTML comment blanked to spaces, newlines
 * kept, so offsets and line numbers still point into the original. A comment
 * that names a selector convention is prose, not a selector. */
function blankComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, " "));
}

export function detectTier(source) {
  const css = blankComments(source);
  if (/\[data-sl-theme[\]=~|^$*\s]/.test(css)) return "A";
  // A DELIMITER after the name, not a bare prefix. `[data-theme-toggle]` is a
  // JavaScript hook, not a theme selector, and matching the prefix reported a
  // Tier A surface as Tier B on the strength of its own toggle's markup —
  // found on sondalab-site, whose header carries both data-sl-theme and
  // data-theme-toggle.
  if (/\[data-theme[\]=~|^$*\s]/.test(css)) return "B";
  return null;
}

// --- selector context -----------------------------------------------------

/** For each 1-based line, a context string = the enclosing selector plus the
 * current declaration (property + value accumulated across lines, reset at
 * `;`/`{`/`}`). The declaration part carries the property name onto every line
 * of a multi-line value, so blessed suppression keyed on a custom-property name
 * (e.g. `--bg-grad`) reaches its continuation lines. Not a full CSS parser. */
function contextByLine(css) {
  const lines = css.split("\n");
  const map = new Array(lines.length + 1).fill("");
  let selector = "";
  let selPending = "";
  let decl = "";
  lines.forEach((line, i) => {
    // snapshot the state entering this line, then include the raw line so a
    // selector or property declared on this same line is matchable too.
    map[i + 1] = selector + " " + decl + " " + line;
    for (const ch of line) {
      if (ch === "{") {
        selector = selPending.trim();
        selPending = "";
        decl = "";
      } else if (ch === "}") {
        selector = "";
        selPending = "";
        decl = "";
      } else if (ch === ";") {
        decl = "";
        selPending += ch;
      } else {
        selPending += ch;
        decl += ch;
      }
    }
  });
  return map;
}

/** Whether a blessed selector appears in a context string, delimited so a
 * short name does not match a longer one (`--rule` must not match `--rule-2`
 * or `--ruler`). Empty selectors never match. */
export function matchesSelector(context, selector) {
  const sel = selector.trim();
  if (!sel) return false;
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${esc}(?![\\w-])`).test(context);
}

// --- accent-step derivation (check 7) -------------------------------------

/** An accent-step value is "derived" if it re-derives off --sl-accent-default
 * via a hue-relative expression (color-mix / relative-colour oklch) or a plain
 * var() reference — i.e. it is not a bare literal that could leak a hue. */
export function isDerivedAccentValue(value) {
  const v = String(value).trim().toLowerCase();
  return v.includes("color-mix(") || v.includes("oklch(") || v.startsWith("var(");
}

/** Accent-step declarations (--sl-accent-hover/active/subtle) grouped per `{}`
 * block, so a graceful-fallback sibling (the same property redeclared with an
 * expression) is scoped to its own rule. Not a full CSS parser — theme files
 * are flat, one declaration per line. */
function accentStepBlocks(css) {
  const lines = css.split("\n");
  const blocks = [];
  let current = null;
  let depth = 0;
  lines.forEach((line, idx) => {
    for (const ch of line) {
      if (ch === "{") {
        if (depth === 0) current = { decls: [] };
        depth++;
      } else if (ch === "}") {
        if (depth > 0) depth--;
        if (depth === 0 && current) {
          blocks.push(current);
          current = null;
        }
      }
    }
    for (const m of line.matchAll(/(--sl-accent-(?:hover|active|subtle))\s*:\s*([^;]+);/g)) {
      if (current) current.decls.push({ prop: m[1], value: m[2], line: idx + 1 });
    }
  });
  return blocks;
}

/** Check 7 — accent-step derivation. Every --sl-accent-hover/active/subtle must
 * be a hue-relative expression off --sl-accent-default, so overriding only the
 * default re-derives the family (the one-var contract). A bare hex/rgb literal
 * is a defect UNLESS it is (a) a graceful fallback — the same property is
 * redeclared with an expression later in the same block — or (b) an
 * intentionally tuned step registered in the product's accent entry
 * (`accentBases`). Returns findings shaped like auditCss's. */
export function auditAccentDerivation(css, { accentBases = new Set(), file = "" } = {}) {
  const findings = [];
  for (const block of accentStepBlocks(css)) {
    block.decls.forEach((d, i) => {
      if (isDerivedAccentValue(d.value)) return;
      const norm = normalizeColor(d.value);
      if (!norm) return; // keyword / non-literal — not this check's concern
      if (accentBases.has(colorBase(norm))) return; // (b) registered tuned step
      const hasExprSibling = block.decls
        .slice(i + 1)
        .some((s) => s.prop === d.prop && isDerivedAccentValue(s.value));
      if (hasExprSibling) return; // (a) graceful fallback before its expression
      findings.push({
        rule: "accent-derivation",
        level: "R",
        file,
        line: d.line,
        message: `accent step ${d.prop} is a bare literal (${d.value.trim()}) — must derive off --sl-accent-default (color-mix/oklch) or be a registered tuned step`,
      });
    });
  }
  return findings;
}

// --- audit ----------------------------------------------------------------

function levelFor(matrix, rule, substrate) {
  if (!matrix || !substrate) return "R";
  const row = matrix.rules?.[rule];
  return row?.[substrate] ?? "R";
}

/** Audit one CSS string. Pure — no I/O. Provide either `allowlistBases` (a Set
 * of `#rrggbb` bases, the shipped path) or `tokens` (a tokens.json object, the
 * test path); `allowlistBases` wins when both are given. */
export function auditCss({
  css,
  tokens,
  allowlistBases,
  accentEntry = {},
  blessed = { deviations: [] },
  declaredTier = null,
  substrate = null,
  matrix = null,
  file = "",
}) {
  const findings = [];
  const bases = allowlistBases ? new Set(allowlistBases) : buildAllowlistBases(tokens);
  for (const s of accentColorStrings(accentEntry)) bases.add(colorBase(normalizeColor(s)));

  const colorDeviations = (blessed.deviations || []).filter((d) => d.kind === "color");
  const blessedColorSelectors = colorDeviations
    .flatMap((d) => d.selectors || [])
    .map((s) => s.trim())
    .filter(Boolean); // an empty selector would match every context — drop it
  // value-based blessing — the honest mechanism for demo data / literals that
  // do not live under a distinctive selector (e.g. a JS swatch object).
  const blessedValueBases = new Set(
    colorDeviations
      .flatMap((d) => d.values || [])
      .map((v) => normalizeColor(v))
      .filter(Boolean)
      .map(colorBase),
  );

  // check 2 — tier consistency
  const detected = detectTier(css);
  if (declaredTier && detected && detected !== declaredTier) {
    const level = levelFor(matrix, "theme-selector", substrate);
    if (level !== "N/A")
      findings.push({
        rule: "theme-selector",
        level,
        file,
        line: css.slice(0, blankComments(css).search(detected === "A" ? /\[data-sl-theme[\]=~|^$*\s]/ : /\[data-theme[\]=~|^$*\s]/)).split("\n").length,
        message: `selector implies Tier ${detected} but product declared Tier ${declaredTier}`,
      });
  }

  // check 1 — colour value-equality
  const ctxMap = contextByLine(css);
  for (const { value, line } of extractColors(css)) {
    const norm = normalizeColor(value);
    if (!norm) continue;
    if (bases.has(colorBase(norm))) continue;
    if (blessedValueBases.has(colorBase(norm))) continue;
    const context = ctxMap[line] || "";
    const blessedHit = blessedColorSelectors.some((sel) => matchesSelector(context, sel));
    if (blessedHit) continue;
    const level = levelFor(matrix, "accent-one-hue", substrate);
    if (level === "N/A") continue;
    findings.push({
      rule: "accent-one-hue",
      level,
      file,
      line,
      message: `colour ${value} does not resolve to a token, product accent, or blessed value`,
    });
  }

  // check 7 — accent-step derivation (one-var contract). Registered tuned steps
  // (the product's own accent family) are exempt, as is a graceful fallback.
  const accentBases = new Set(
    accentColorStrings(accentEntry).map((s) => colorBase(normalizeColor(s))),
  );
  findings.push(...auditAccentDerivation(css, { accentBases, file }));

  return {
    file,
    substrate,
    tier: { declared: declaredTier, detected },
    findings,
  };
}

// --- registry / config resolution ----------------------------------------

export function resolveAccentEntry(registry, product) {
  const seen = new Set();
  let name = product;
  while (name) {
    if (seen.has(name)) throw new Error(`accent-registry: circular inherits at "${name}"`);
    seen.add(name);
    const entry = registry.products?.[name];
    if (!entry) return {};
    if (entry.inherits) {
      name = entry.inherits;
      continue;
    }
    return entry;
  }
  return {};
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function loadTokenCss() {
  const texts = [];
  for (const rel of TOKEN_CSS) {
    try {
      texts.push(readFileSync(resolve(PKG_DIR, rel), "utf8"));
    } catch {
      /* a theme file may be absent in a trimmed install — skip it */
    }
  }
  return texts;
}

// --- CLI ------------------------------------------------------------------

/* ── check 8 — the effect layer's runtime ─────────────────────────────────────
   Most of the effect layer needs JavaScript. A surface that carries the classes
   without calling mount() renders Tier 0 — no error, no warning, and every
   other check here reads colour, so nothing else would ever notice. sondalab.eu
   shipped exactly that: the glass classes in place and the tier never armed.

   The class must be USED, not merely defined. `.sl-fx-glass { … }` in a
   stylesheet is the kit declaring the family; `class="sl-fx-glass"` in markup is
   a surface asking for it. Matching the selector form would fire on effects.css
   itself, so only the attribute form counts. A template literal or a clsx()
   call is missed, which is the safe direction for a Required-level check. */
const FX_CLASS_USE = /\bclass(?:Name)?\s*=\s*["'`][^"'`]*\bsl-fx-[a-z][\w-]*/;
/* A CALL, not an import: `import { mount }` wires nothing. mountGpu() does not
   match on its own, and should not — it returns false unless mount() ran. */
const MOUNT_CALL = /\bmount\s*\(/;

/** Does this surface ask for effects it never arms?
 *
 *  @param {{file: string, text: string}[]} scanned every file in the surface
 *  @param {{blessed?: {deviations?: {kind: string}[]}}} [opts]
 *  @returns {object[]} one finding at most — the omission is a property of the
 *    surface, not of a file, so a hundred markup files produce one line.
 */
export function auditEffectsRuntime(scanned, { blessed = { deviations: [] } } = {}) {
  // Tier 0 on purpose is a legitimate choice — a host that cannot run the JS
  // takes the plain component. It has to be declared, the way every other
  // deviation is, rather than being the silent default.
  if ((blessed.deviations || []).some((d) => d.kind === "effects-runtime")) return [];

  const users = scanned.filter((f) => FX_CLASS_USE.test(f.text));
  if (users.length === 0) return [];
  if (scanned.some((f) => MOUNT_CALL.test(f.text))) return [];

  const first = users[0];
  const line = first.text.slice(0, first.text.search(FX_CLASS_USE)).split("\n").length;
  const others = users.length > 1 ? ` (and ${users.length - 1} more file(s))` : "";
  return [{
    rule: "effects-runtime",
    level: "R",
    file: first.file,
    line,
    message:
      `sl-fx-* classes are used${others} but no scanned file calls mount() — ` +
      `the effect layer renders Tier 0 silently. Import effects.js and call mount() once ` +
      `(see catalog.md "Turning effects on"), widen --surface if the call lives outside it, ` +
      `or bless {"kind":"effects-runtime"} if Tier 0 is deliberate`,
  }];
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
  }
  return args;
}

function group(findings, level) {
  return findings.filter((f) => f.level === level);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.surface || !args.product) {
    console.error("usage: sl-audit --surface <glob> --product <name> [--substrate IDE|App|Page|Term] [--fail-on R]");
    process.exit(2);
  }

  let neutrals = null;
  try {
    neutrals = loadJson(resolve(PKG_DIR, "neutrals.json"));
  } catch (err) {
    // The theme CSS still applies, so the audit runs; but every product's own
    // tinted neutrals would read as free-floating, so say why.
    console.warn(`warning: could not read neutrals.json (${err.code ?? err.message}) — "${args.product}"'s generated neutrals are not allowlisted; only the default product's are`);
  }
  const allowlistBases = allowlistForProduct({ cssTexts: loadTokenCss(), neutrals, product: args.product });
  const registry = loadJson(resolve(HERE, "accent-registry.json"));
  const matrix = loadJson(resolve(HERE, "substrate-matrix.json"));
  let blessed = { deviations: [] };
  try {
    blessed = loadJson(resolve(HERE, `blessed/${args.product}.json`));
  } catch {
    /* no blessed file yet — treat as none */
  }

  const substrate = args.substrate || matrix.products?.[args.product] || blessed.substrate || null;
  const declaredTier = args.tier || matrix.tiers?.[args.product] || blessed.tier || null;
  if (!declaredTier && substrate && substrate !== "Term")
    console.warn(`warning: no tier declared for "${args.product}" (add it to substrate-matrix.json "tiers") — tier-consistency check disabled`);
  const accentEntry = resolveAccentEntry(registry, args.product);

  const cwd = process.cwd();
  const files = globSync(args.surface, { cwd }).map((f) => resolve(cwd, f));
  const all = [];
  const scanned = [];
  for (const file of files) {
    const css = readFileSync(file, "utf8");
    scanned.push({ file: relative(cwd, file), text: css });
    const res = auditCss({
      css,
      allowlistBases,
      accentEntry,
      blessed,
      declaredTier,
      substrate,
      matrix,
      file: relative(cwd, file),
    });
    all.push(...res.findings);
  }
  // Surface-level, so it runs once over everything rather than per file: the
  // mount() call almost never lives in the same file as the markup.
  all.push(...auditEffectsRuntime(scanned, { blessed }));

  const R = group(all, "R");
  const A = group(all, "A");
  const naCount = matrix.rules
    ? Object.values(matrix.rules).filter((r) => r[substrate] === "N/A").length
    : 0;

  console.log(`\n${args.product}  (${substrate}, Tier ${declaredTier ?? "?"})  —  sl-audit`);
  console.log(`  ${files.length} file(s) scanned\n`);
  printBucket("R-violation", R);
  printBucket("A-deviation", A);
  console.log(`N/A: ${naCount} rules skipped for substrate ${substrate}\n`);

  if (args["fail-on"] === "R" && R.length > 0) process.exit(1);
}

function printBucket(label, findings) {
  if (findings.length === 0) {
    console.log(`${label} (0)\n`);
    return;
  }
  console.log(`${label} (${findings.length})`);
  for (const f of findings) console.log(`  ${f.file}:${f.line}   ${f.message}`);
  console.log("");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
