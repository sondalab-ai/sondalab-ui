#!/usr/bin/env node
// sl-audit — deterministic Sondalab design-system compliance audit.
// Checks only what is decidable from CSS text (colour value-equality, tier
// consistency). Judgement-level rules (missing labels, editorial voice,
// layout composition) are out of scope by design — they belong to the
// sl-ds-auditor subagent. See docs/design-system-agentic-spec.md.

import { readFileSync, globSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const AGENT_DIR = resolve(REPO_ROOT, "packages/ui-kit/agent");

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

/** Set of opaque colour bases (`#rrggbb`) that appear anywhere in the token set. */
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

function accentColorStrings(accentEntry) {
  return collectStrings(accentEntry, []).filter((s) => normalizeColor(s));
}

// --- tier detection -------------------------------------------------------

/** 'A' (data-sl-theme), 'B' (data-theme), or null if neither appears. */
export function detectTier(css) {
  if (/\[data-sl-theme/.test(css)) return "A";
  if (/\[data-theme/.test(css)) return "B";
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

// --- audit ----------------------------------------------------------------

function levelFor(matrix, rule, substrate) {
  if (!matrix || !substrate) return "R";
  const row = matrix.rules?.[rule];
  return row?.[substrate] ?? "R";
}

/** Audit one CSS string. Pure — no I/O. */
export function auditCss({
  css,
  tokens,
  accentEntry = {},
  blessed = { deviations: [] },
  declaredTier = null,
  substrate = null,
  matrix = null,
  file = "",
}) {
  const findings = [];
  const bases = buildAllowlistBases(tokens);
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
        line: css.slice(0, css.indexOf(detected === "A" ? "[data-sl-theme" : "[data-theme")).split("\n").length,
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

// --- CLI ------------------------------------------------------------------

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
    console.error("usage: node scripts/sl-audit.mjs --surface <glob> --product <name> [--substrate IDE|App|Page|Term] [--fail-on R]");
    process.exit(2);
  }

  const tokens = loadJson(resolve(REPO_ROOT, "sondalab.tokens.json"));
  const registry = loadJson(resolve(AGENT_DIR, "accent-registry.json"));
  const matrix = loadJson(resolve(AGENT_DIR, "substrate-matrix.json"));
  let blessed = { deviations: [] };
  try {
    blessed = loadJson(resolve(AGENT_DIR, `blessed/${args.product}.json`));
  } catch {
    /* no blessed file yet — treat as none */
  }

  const substrate = args.substrate || matrix.products?.[args.product] || blessed.substrate || null;
  const declaredTier = args.tier || matrix.tiers?.[args.product] || blessed.tier || null;
  if (!declaredTier && substrate && substrate !== "Term")
    console.warn(`warning: no tier declared for "${args.product}" (add it to substrate-matrix.json "tiers") — tier-consistency check disabled`);
  const accentEntry = resolveAccentEntry(registry, args.product);

  const files = globSync(args.surface, { cwd: REPO_ROOT }).map((f) => resolve(REPO_ROOT, f));
  const all = [];
  for (const file of files) {
    const css = readFileSync(file, "utf8");
    const res = auditCss({
      css,
      tokens,
      accentEntry,
      blessed,
      declaredTier,
      substrate,
      matrix,
      file: relative(REPO_ROOT, file),
    });
    all.push(...res.findings);
  }

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
