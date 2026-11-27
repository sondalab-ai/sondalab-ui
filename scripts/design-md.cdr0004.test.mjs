// CDR-0004: DESIGN.md tells design agents to use the kit, prints final values,
// and carries the product-name, settings-screen and pixel-face rules.
//
// The mutation tests run the generator in a throwaway copy of the repo, so the
// working tree is never written.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDesignMd } from "./gen-design-md.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = "packages/ui-kit/agent/DESIGN.md";
const TOKENS = "sondalab.tokens.json";
const CATALOG = "packages/ui-kit/agent/catalog.json";
const LANGUAGE = "docs/design-language.md";

const read = (rel) => readFileSync(join(REPO, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let built;
const doc = () => (built ??= buildDesignMd());

/** The `## ` sections of a markdown text, in order. */
const sections = (text) =>
  text.split(/^(?=## )/m).filter((s) => s.startsWith("## "))
    .map((body) => ({ title: body.split("\n")[0], body }));

function section(text, title) {
  const found = sections(text).find((s) => title.test(s.title));
  assert.ok(found, `no "## " section matching ${title}`);
  return found.body;
}

/** Every markdown table as { head, rows } of trimmed cells. */
function tables(text) {
  const out = [];
  let block = [];
  for (const line of [...text.split("\n"), ""]) {
    if (line.startsWith("|")) {
      block.push(line.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim()));
    } else if (block.length) {
      out.push({ head: block[0], rows: block.slice(2) });
      block = [];
    }
  }
  return out;
}

// ---- a throwaway copy of the repo ----

const SKIP = new Set(["node_modules", ".git", ".ads", ".venv", "__pycache__"]);

function withCopy(fn) {
  const dir = mkdtempSync(join(tmpdir(), "design-md-cdr0004-"));
  try {
    for (const entry of readdirSync(REPO, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      if (entry.isFile() || ["scripts", "docs", "packages"].includes(entry.name)) {
        cpSync(join(REPO, entry.name), join(dir, entry.name), {
          recursive: true,
          filter: (src) => !SKIP.has(basename(src)),
        });
      }
    }
    const copy = {
      read: (rel) => readFileSync(join(dir, rel), "utf8"),
      write: (rel, text) => writeFileSync(join(dir, rel), text),
      remove: (rel) => rmSync(join(dir, rel)),
      json(rel, mutate) {
        const value = JSON.parse(this.read(rel));
        mutate(value);
        this.write(rel, JSON.stringify(value, null, 2) + "\n");
      },
      /** Replace in a file that may or may not hold the text (a mirror of a source). */
      replace(rel, from, to) {
        if (existsSync(join(dir, rel))) this.write(rel, this.read(rel).split(from).join(to));
      },
      /** Run the generator; DESIGN.md starts as a sentinel, so a write shows. */
      generate() {
        this.write(OUT, "SENTINEL\n");
        const run = spawnSync(process.execPath, [join(dir, "scripts/gen-design-md.mjs")], {
          cwd: dir,
          encoding: "utf8",
        });
        return { status: run.status, stderr: run.stderr, text: this.read(OUT) };
      },
    };
    return fn(copy);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertRefused(run, why) {
  assert.notEqual(run.status, 0, `the generator must throw ${why}`);
  assert.equal(run.text, "SENTINEL\n", `the generator must write nothing ${why}`);
}

function assertWrote(run) {
  assert.equal(run.status, 0, run.stderr);
  assert.notEqual(run.text, "SENTINEL\n");
}

// ---- colour parsing, so any final notation is accepted ----

const gamma = (v) => {
  const c = Math.min(1, Math.max(0, v));
  return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
};

function rgbOf(value) {
  const s = value.replace(/`/g, "").trim().toLowerCase();
  if (s === "white") return [255, 255, 255];
  if (s === "black") return [0, 0, 0];
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (m) {
    const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  m = s.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/);
  if (m) return m.slice(1, 4).map(Number);
  m = s.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+(?:[\d.]+(?:deg)?|none)\s*\)$/);
  if (m) {
    const L = Number(m[1]) / (m[2] ? 100 : 1);
    const C = Number(m[3]);
    assert.ok(C < 0.0005, `the derived label has no chroma, got ${value}`);
    return [gamma(L ** 3), gamma(L ** 3), gamma(L ** 3)];
  }
  return assert.fail(`not a final colour: ${value}`);
}

function assertColour(cell, expected, what) {
  const got = rgbOf(cell);
  const want = rgbOf(expected);
  assert.ok(got.every((v, i) => Math.abs(v - want[i]) <= 1), `${what}: ${cell} is not ${expected}`);
}

function onAccentCells(text) {
  const line = text.split("\n").find((l) => l.startsWith("| `--sl-text-on-accent`"));
  assert.ok(line, "no --sl-text-on-accent row");
  assert.doesNotMatch(line, /oklch\(\s*from/i);
  assert.doesNotMatch(line, /var\(/);
  const [, light, dark, highContrast] = line.split("|").slice(1, -1).map((c) => c.trim());
  return { light, dark, highContrast };
}

// ---- criterion 1: use the kit ----

test("a section before the colour section says how to use the kit", () => {
  const all = sections(doc());
  const colourAt = all.findIndex((s) => /colour/i.test(s.title));
  assert.ok(colourAt >= 0, "no colour section");
  const use = all.slice(0, colourAt).find((s) => s.body.includes("@sondalab/ui-kit"));
  assert.ok(use, "no section before the colour section names @sondalab/ui-kit");

  const files = [
    "tokens.css", "components.css", "themes/light.css", "themes/dark.css",
    "themes/high-contrast.css", "themes/products.css", "fonts.css",
  ];
  for (const file of files) assert.ok(use.body.includes(file), `the section does not name ${file}`);
  const at = (file) => use.body.indexOf(file);
  assert.ok(at("tokens.css") < at("components.css"), "tokens.css is imported before components.css");
  assert.ok(at("components.css") < at("themes/light.css"), "components.css is listed before the themes, as in the kit README");
  assert.match(use.body, /order/i);

  assert.match(use.body, /data-sl-theme/);
  assert.match(use.body, /data-sl-product/);
  assert.match(use.body, /\broot\b/i);
  assert.match(use.body, /(never|do not)\s+re-?build/i);
  assert.match(use.body, /\bclass\b/i);
});

// ---- criterion 2: the component table ----

function componentTable(text) {
  const found = tables(text).find(
    (t) => t.head.some((h) => /class/i.test(h)) && t.head.some((h) => /purpose/i.test(h)),
  );
  assert.ok(found, "no component table (a table with a Class column and a Purpose column)");
  return found;
}

const hasClass = (cells, cls) =>
  new RegExp(`(?<![\\w-])${escapeRe(cls)}(?![\\w-])`).test(cells.join(" "));

test("the component table lists every catalog class, each entry with a purpose", () => {
  const table = componentTable(doc());
  const purposeAt = table.head.findIndex((h) => /purpose/i.test(h));
  for (const row of table.rows) {
    assert.match(row[purposeAt] ?? "", /[A-Za-z]{3}/, `no purpose in row: ${row.join(" | ")}`);
  }
  const classes = readJson(CATALOG).components.flatMap((c) => c.classes);
  const missing = classes.filter((cls) => !table.rows.some((row) => hasClass(row, cls)));
  assert.deepEqual(missing, [], "catalog classes missing from the component table");
});

test("the component table follows catalog.json", () => {
  withCopy((copy) => {
    copy.json(CATALOG, (catalog) => {
      catalog.components.find((c) => c.id === "button").classes.push("sl-btn--cdr0004");
    });
    const run = copy.generate();
    assertWrote(run);
    assert.ok(
      componentTable(run.text).rows.some((row) => hasClass(row, "sl-btn--cdr0004")),
      "a class added to catalog.json does not reach the table",
    );
  });
});

test("the generator refuses a component with no purpose, a stale purpose id, and a missing catalog", () => {
  withCopy((copy) => {
    copy.json(CATALOG, (catalog) => {
      catalog.components.push({ id: "cdr0004-extra", kind: "primitive", classes: ["sl-cdr0004-extra"], roleVars: [] });
    });
    assertRefused(copy.generate(), "when a component has no purpose");
  });

  const inCatalog = readJson(CATALOG).components.every((c) => typeof c.purpose === "string");
  withCopy((copy) => {
    copy.json(CATALOG, (catalog) => {
      if (inCatalog) catalog.components.find((c) => c.id === "button").purpose = "  ";
      else catalog.components = catalog.components.filter((c) => c.id !== "button");
    });
    assertRefused(copy.generate(), inCatalog ? "when a purpose is blank" : "when a purpose id is stale");
  });

  withCopy((copy) => {
    copy.remove(CATALOG);
    assertRefused(copy.generate(), "when catalog.json is missing");
  });
});

// ---- criterion 3: the label on the accent ----

test("--sl-text-on-accent holds a final colour in all three themes", () => {
  const tokens = readJson(TOKENS);
  const cells = onAccentCells(doc());
  // The default light accent (#FF9F1C) is above the threshold: the dark pole.
  assertColour(cells.light, `oklch(${tokens.label["pole-dark"]} 0 0)`, "light");
  assertColour(cells.dark, tokens.themes.dark["text-on-accent"], "dark");
  assertColour(cells.highContrast, tokens.themes["high-contrast"]["text-on-accent"], "high contrast");
});

test("the light label follows the accent, the threshold and the dark pole in the sources", () => {
  const { label, accent } = readJson(TOKENS);

  // An accent below the threshold takes white.
  withCopy((copy) => {
    copy.json(TOKENS, (t) => { t.accent.light.default = "#1d63d8"; });
    copy.replace("packages/ui-kit/themes/light.css", accent.light.default, "#1d63d8");
    const run = copy.generate();
    assertWrote(run);
    assertColour(onAccentCells(run.text).light, "#ffffff", "blue accent");
  });

  // A raised threshold turns the amber label white.
  withCopy((copy) => {
    copy.json(TOKENS, (t) => { t.label["pole-l"] = 0.99; });
    copy.replace("packages/ui-kit/tokens.css", `--_sl-pole-l: ${label["pole-l"]};`, "--_sl-pole-l: 0.99;");
    const run = copy.generate();
    assertWrote(run);
    assertColour(onAccentCells(run.text).light, "#ffffff", "raised threshold");
  });

  // Another dark pole changes the amber label.
  withCopy((copy) => {
    copy.json(TOKENS, (t) => { t.label["pole-dark"] = 0.3; });
    copy.replace("packages/ui-kit/tokens.css", `--_sl-pole-dark: ${label["pole-dark"]};`, "--_sl-pole-dark: 0.3;");
    const run = copy.generate();
    assertWrote(run);
    assertColour(onAccentCells(run.text).light, "oklch(0.3 0 0)", "changed dark pole");
  });
});

// ---- criteria 4 and 5: nothing private is printed ----

test("DESIGN.md holds no private custom property", () => {
  assert.doesNotMatch(doc(), /var\(\s*--_/);
  assert.doesNotMatch(doc(), /--_sl-/);
});

test("the generator throws and writes nothing when a printed value holds a private var()", () => {
  withCopy((copy) => assertWrote(copy.generate()));
  const mutations = [
    (t) => { t.themes.dark["status-info"] = "var(--_sl-lum)"; },
    (t) => { t.shared.motion.fast = "calc(var(--_cdr0004) * 1ms)"; },
  ];
  for (const mutate of mutations) {
    withCopy((copy) => {
      copy.json(TOKENS, mutate);
      assertRefused(copy.generate(), "on a private var() in a printed value");
    });
  }
});

// ---- criterion 6: the inset shadow and the measure ----

function insetValues() {
  const { shadow } = readJson(TOKENS);
  return ["light", "dark", "high-contrast"].map((theme) => shadow[theme].inset);
}

function measureValue() {
  const m = read(LANGUAGE).match(/--sl-measure:\s*(\d+ch)/);
  assert.ok(m, "design-language.md states no --sl-measure");
  return m[1];
}

const measureLine = (text, value) =>
  text.split("\n").some((l) => l.includes("--sl-measure") && l.includes(value));

test("DESIGN.md prints the values of --sl-shadow-inset and --sl-measure", () => {
  const holder = sections(doc()).find(
    (s) => s.body.includes("--sl-shadow-inset") && insetValues().every((v) => s.body.includes(v)),
  );
  assert.ok(holder, "no section names --sl-shadow-inset and prints each theme's value");
  assert.match(holder.body, /light/i);
  assert.match(holder.body, /dark/i);
  assert.ok(measureLine(doc(), measureValue()), "no line gives the --sl-measure value");
});

test("the inset shadow and the measure are read from the sources", () => {
  const [, dark] = insetValues();
  const changed = "inset 0 3px 7px rgba(0,0,0,0.33)";
  const measure = measureValue();
  withCopy((copy) => {
    copy.json(TOKENS, (t) => {
      t.shadow.dark.inset = changed;
      t.shadow["high-contrast"].inset = changed;
    });
    for (const css of ["packages/ui-kit/themes/dark.css", "packages/ui-kit/themes/high-contrast.css"]) {
      copy.replace(css, dark, changed);
    }
    copy.replace(LANGUAGE, measure, "57ch");
    copy.replace("packages/ui-kit/components.css", measure, "57ch");
    const run = copy.generate();
    assertWrote(run);
    assert.ok(run.text.includes(changed), "the changed dark inset shadow is not printed");
    assert.ok(measureLine(run.text, "57ch"), "the changed measure is not printed");
  });
});

// ---- criterion 7: the product name in a header ----

test("a product name in a header: display face, 700, accent dot; the wordmark stays the brand's", () => {
  const rule = doc().split("\n").find(
    (l) => /product(?:'s)?\s+(?:name|mark)/i.test(l) && /header|title bar/i.test(l) && /\b700\b/.test(l),
  );
  assert.ok(rule, "no one-line rule for a product name in a header at weight 700");
  assert.match(rule, /--sl-font-display|display (?:face|font)/i);
  assert.match(rule, /accent dot|dot (?:of|in) the accent/i);
  assert.match(rule, /wordmark/i);
  assert.match(rule, /brand[- ](?:face|font)|--sl-font-brand/i);
  assert.match(rule, /brand(?:'s)? alone|only (?:for )?the (?:Sondalab )?brand/i);
});

// ---- criterion 8: the accent registry table ----

test("the accent registry table has descriptive headers and explains spexr's labelled fill", () => {
  const colour = section(doc(), /colour/i);
  const from = colour.indexOf("### Accent registry");
  assert.ok(from >= 0, "no accent registry subsection");
  const registry = colour.slice(from);
  const [table] = tables(registry);
  assert.ok(table, "no accent registry table");
  for (const header of table.head) {
    assert.ok(header, "an empty column header");
    assert.doesNotMatch(header, /^(?:light|dark|notes?|other|info|values?)$/i, `"${header}" does not say what it holds`);
  }
  assert.ok(table.head.some((h) => /accent/i.test(h) && /light/i.test(h)), "no light accent column header");
  assert.ok(table.head.some((h) => /accent/i.test(h) && /dark/i.test(h)), "no dark accent column header");

  const sentences = registry.split("\n")
    .filter((l) => !l.startsWith("|"))
    .flatMap((l) => l.split(/(?<=\.)\s+/));
  assert.ok(
    sentences.some((s) => /spexr/i.test(s) && /fill/i.test(s) && /white/i.test(s) && /label/i.test(s)),
    "no sentence explains that spexr's fill is there so its white label reads",
  );
});

// ---- criterion 9: settings and form screens ----

const SETTINGS_PARTS = [
  /sidebar/i, /sl-nav/, /(?:one|single) main pane/i,
  /eyebrow/i, /title/i, /lede/i, /scope switch/i,
  /two[- ]column|two columns/i, /two control columns/i,
  /1px/, /hairline/i, /(?:never|no) cards/i,
  /action bar/i, /foot/i, /chang/i, /Discard/, /primary\W+(?:\S+\W+)?Save|Save\W+(?:\S+\W+)?primary/,
];

/** From the settings rule's opening words to the next heading of its level or above. */
function settingsRule(text, where) {
  const start = text.search(/settings (?:and|&) form/i);
  assert.ok(start >= 0, `${where} has no settings and form screen rule`);
  const rest = text.slice(start);
  const end = rest.search(/\n##+ /);
  return end < 0 ? rest : rest.slice(0, end);
}

function layoutPart() {
  const language = read(LANGUAGE);
  const from = language.indexOf("### L2");
  const to = language.indexOf("### L3");
  assert.ok(from >= 0 && to > from, "design-language.md has no L2 part");
  return language.slice(from, to);
}

function assertApprovedRule() {
  const rule = settingsRule(layoutPart(), "design-language.md L2");
  for (const part of SETTINGS_PARTS) assert.match(rule, part, `design-language.md L2 rule lacks ${part}`);
  const marked = layoutPart().split("\n").some(
    (l) => /settings/i.test(l) && /owner/i.test(l) && /approv/i.test(l) && l.includes("2026-11-27"),
  );
  assert.ok(marked, "the L2 settings rule is not marked owner-approved on 2026-11-27");
}

test("the settings and form screen rule is in L2, owner-approved, and DESIGN.md carries all of it", () => {
  assertApprovedRule();
  const rule = settingsRule(doc(), "DESIGN.md");
  for (const part of SETTINGS_PARTS) assert.match(rule, part, `DESIGN.md rule lacks ${part}`);
});

// ---- criterion 10: the pixel face ----

test("DESIGN.md lists all six pixel face uses and says the rule is about role, not size", () => {
  const type = section(doc(), /typography/i);
  const uses = [
    /section index/i, /card(?:'s)? folio/i, /step number/i, /stat(?:'s)? value/i,
    /compact lockup/i, /emphasi[sz]ed (?:heading word|word in a heading)/i,
  ];
  for (const use of uses) assert.match(type, use, `the pixel face uses lack ${use}`);
  assert.match(type, /about (?:the )?role, not (?:about )?size/i);
  assert.match(type, /micro section index[^.\n]*\bmono\b/i);
});

// ---- criterion 11: committed, deterministic, current form ----

test("the committed DESIGN.md is the deterministic build, and only design-language.md records the approval", () => {
  assertApprovedRule();
  const first = buildDesignMd();
  assert.equal(buildDesignMd(), first, "two builds differ");
  assert.equal(read(OUT), first, "DESIGN.md is stale: run npm run gen:design-md");
  assert.match(first, /settings (?:and|&) form/i);
  assert.doesNotMatch(first, /\d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(first, /\bowner\b/i);
  assert.doesNotMatch(first, /\bamend(?:ed|ment)\b/i);
  assert.doesNotMatch(first, /\b(?:until|since) (?:ui-kit )?v?\d+\.\d+/i);
});
