import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { loadTokens, loadRegistry } from "./lib/tokens.mjs";
import { accentFor } from "./lib/neutrals.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const read = (path) => readFileSync(resolve(REPO, path), "utf8");
const doc = () => read("packages/ui-kit/agent/DESIGN.md");
const loadBuild = async () =>
  (await import(pathToFileURL(resolve(HERE, "gen-design-md.mjs")).href)).buildDesignMd;

const SECTIONS = {
  brand: [/brand/i, /voice/i],
  colour: [/colou?r/i],
  typography: [/typography/i],
  spacing: [/spacing/i, /radi/i, /control height/i],
  depth: [/depth/i],
  signature: [/signature components/i],
  motion: [/motion/i],
  effects: [/effect famil/i],
  dos: [/\bdo\b.*\bdo[- ]not\b/i],
};

/** The `## ` sections of a markdown text (fenced code ignored), in order. */
function sectionsOf(md) {
  const out = [];
  let fenced = false;
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (!fenced && /^## /.test(line)) out.push({ title: line.slice(3).trim(), lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out;
}

/** The nine required sections, each found after the one before it. */
function required(md) {
  const all = sectionsOf(md);
  const out = {};
  let from = 0;
  for (const [key, patterns] of Object.entries(SECTIONS)) {
    const i = all.findIndex((s, n) => n >= from && patterns.every((p) => p.test(s.title)));
    assert.ok(i >= 0, `no "## " section for "${key}" (${patterns.join(" ")}) after the previous one; found: ${all.map((s) => s.title).join(" / ")}`);
    out[key] = { title: all[i].title, lines: all[i].lines, text: all[i].lines.join("\n") };
    from = i + 1;
  }
  return out;
}

const norm = (s) => String(s).replace(/`|\*\*/g, "").replace(/,\s+/g, ",").replace(/\s+/g, " ").toLowerCase();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A token or role name, bare or with --sl-, never a prefix of a longer name. */
const nameRe = (name) => new RegExp(`(?:--sl-|(?<![\\w-]))${escape(name)}(?![\\w-])`, "g");
const linesNaming = (lines, name) => lines.map(norm).filter((l) => nameRe(name).test(l));
const hasValue = (line, value) =>
  new RegExp(`(?<![\\w.#-])${escape(norm(value))}(?![\\w%]|\\.\\d)`).test(line);

function assertToken(lines, name, value) {
  const named = linesNaming(lines, name);
  assert.ok(named.length, `no line names ${name}`);
  assert.ok(
    named.some((l) => hasValue(l.replace(nameRe(name), " "), value)),
    `no line naming ${name} gives its value ${value}`,
  );
}

const words = (s) => s.match(/[a-z]{3,}/gi) ?? [];

test("DESIGN.md has the nine sections in order", () => {
  const found = required(doc());
  for (const [key, s] of Object.entries(found)) {
    assert.ok(s.text.trim().length > 0, `section "${key}" is empty`);
  }
});

test("the colour section gives every role's value on light, dark and high contrast", () => {
  const { colour } = required(doc());
  assert.match(colour.text, /\blight\b/i);
  assert.match(colour.text, /\bdark\b/i);
  assert.match(colour.text, /high[- ]contrast/i);
  const roles = new Set();
  for (const theme of ["light", "dark", "high-contrast"]) {
    const css = read(`packages/ui-kit/themes/${theme}.css`);
    const decls = [...css.matchAll(/--sl-((?:bg|border|text|status)-[a-z-]+|accent-default):\s*([^;]+);/g)];
    assert.ok(decls.length > 10, `could not read the ${theme} roles`);
    for (const [, role, value] of decls) {
      if (!/^(#|rgba?\()/.test(value)) continue;
      assertToken(colour.lines, role, value);
      roles.add(role);
    }
  }
  for (const role of roles) {
    const explained = linesNaming(colour.lines, role).some((line) => {
      const prose = line
        .replace(nameRe(role), " ")
        .replace(/#[0-9a-f]{3,8}\b|(?:rgba?|oklch|var)\([^|]*?\)+/g, " ")
        .replace(/\b(light|dark|high[- ]contrast)\b/g, " ");
      return words(prose).length >= 2;
    });
    assert.ok(explained, `the colour section does not say what ${role} is for, on a line naming it`);
  }
});

test("the colour section lists every registry product with its accent", () => {
  const { colour } = required(doc());
  const tokens = loadTokens();
  const registry = loadRegistry();
  for (const id of Object.keys(registry.products)) {
    const accents = ["light", "dark"].map((theme) => accentFor(tokens, registry, id, theme).toLowerCase());
    const own = new RegExp(`(?<![\\w-])${escape(id)}(?![\\w-])`);
    assert.ok(
      colour.lines.map(norm).some((l) => own.test(l) && accents.every((hex) => l.includes(hex))),
      `no line lists product ${id} with its accent ${accents.join(" / ")}`,
    );
  }
});

const SCALES = [
  ["typography", "font"],
  ["typography", "text"],
  ["spacing", "space"],
  ["spacing", "radius"],
  ["motion", "motion"],
];

test("typography, spacing, radius and motion values equal sondalab.tokens.json", () => {
  const found = required(doc());
  const { shared } = loadTokens();
  for (const [section, group] of SCALES) {
    for (const [key, value] of Object.entries(shared[group])) {
      assertToken(found[section].lines, `${group}-${key}`, value);
    }
  }
});

test("changing a token in the build input changes the output", async () => {
  const build = await loadBuild();
  const base = build();
  assert.equal(build({ tokens: loadTokens() }), base, "passing the real tokens must give the default build");
  const changes = [
    ["typography", "font", "sans", "\"Probe Sans\", sans-serif"],
    ["typography", "text", "md", "1.0731rem"],
    ["spacing", "space", "4", "1.0937rem"],
    ["spacing", "radius", "md", "9.37px"],
    ["motion", "motion", "fast", "137ms"],
  ];
  for (const [section, group, key, probe] of changes) {
    const tokens = structuredClone(loadTokens());
    tokens.shared[group][key] = probe;
    const out = build({ tokens });
    assert.notEqual(out, base, `changing shared.${group}.${key} did not change the output`);
    assertToken(required(out)[section].lines, `${group}-${key}`, probe);
  }
  assert.equal(build(), base, "a build with changed input must not leak into the next build");
});

test("signature components are all there, and the bezel card is chosen but not shipped", () => {
  const { signature } = required(doc());
  for (const part of [/wordmark/i, /eyebrow/i, /\btags?\b/i, /inversion band/i, /keycap/i, /\btiles?\b/i, /bezel card/i]) {
    assert.match(signature.text, part);
  }
  const first = signature.lines.findIndex((l) => /bezel card/i.test(l));
  let end = first + 1;
  while (end < signature.lines.length && !/^###+ /.test(signature.lines[end])) end++;
  const bezel = signature.lines.slice(first, end).join(" ");
  const unshipped = /not\s+(?:yet\s+)?shipped/i;
  assert.match(bezel, /chosen/i);
  assert.match(bezel, unshipped);
  assert.doesNotMatch(signature.lines.slice(0, first).join(" "), unshipped, "only the bezel card is unshipped");
});

test("the effect families are glitch, aurora, glass and goo, each with its one meaning", () => {
  const { effects } = required(doc());
  const meanings = [...read("docs/design-language.md").matchAll(/\b(Glitch|Aurora|Glass|Goo) means \*([^*]+)\*/g)];
  assert.equal(meanings.length, 4, "could not read the four meanings from design-language.md");
  const plain = effects.lines.map((l) => norm(l).replace(/[*_]/g, ""));
  for (const [, family, meaning] of meanings) {
    // The meaning sits on a line naming its family, or under that family's heading.
    const ok = plain.some((line, i) => {
      if (!line.includes(norm(meaning))) return false;
      const heading = plain.slice(0, i).findLast((l) => l.startsWith("### ")) ?? "";
      return new RegExp(`\\b${family}\\b`, "i").test(`${heading} ${line}`);
    });
    assert.ok(ok, `${family} does not carry its meaning "${meaning}"`);
  }
  for (const line of plain) {
    const carried = meanings.filter(([, , m]) => line.includes(norm(m)));
    assert.ok(carried.length <= 1, `one line carries several family meanings: ${line}`);
  }
});

/** The lines under the `### ` heading whose title matches. */
function subsection(section, title) {
  const start = section.lines.findIndex((l) => /^### /.test(l) && title.test(l.slice(4).trim()));
  assert.ok(start >= 0, `no "### " subsection matching ${title} in "${section.title}"`);
  const rest = section.lines.slice(start + 1);
  const end = rest.findIndex((l) => /^### /.test(l));
  return end < 0 ? rest : rest.slice(0, end);
}

/** List items and table body rows. */
function entries(lines) {
  return lines.filter((l, i) => {
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(l)) return true;
    const separator = (s) => /^\s*\|[\s:|-]+\|\s*$/.test(s ?? "");
    return /^\s*\|/.test(l) && !separator(l) && !separator(lines[i + 1]);
  });
}

test("the do-not list has every do-not-converge row of flavour.md, each with a reason", () => {
  const { dos } = required(doc());
  const flavour = sectionsOf(read("packages/ui-kit/agent/flavour.md")).find((s) => /do not converge/i.test(s.title));
  const traits = entries(flavour.lines).map((row) => row.split("|")[1].trim());
  assert.ok(traits.length > 0, "could not read the do-not-converge table");
  const list = entries(subsection(dos, /^do[- ]not\b/i)).map(norm);
  for (const trait of traits) {
    const row = list.find((l) => l.includes(norm(trait)));
    assert.ok(row, `the do-not list lacks "${trait}"`);
    assert.ok(words(row.replace(norm(trait), " ")).length >= 3, `"${trait}" has no reason beside it`);
  }
});

test("DESIGN.md has no date, owner annotation or version history, and each do rule has a reason", () => {
  const md = doc();
  const banned = {
    "ISO date": /\b(?:19|20)\d{2}-\d{2}(?:-\d{2})?\b/,
    "owner annotation": /\bowner(?:['’]s)?\b|\bruling\b/i,
    "ui-kit version": /\bui-kit\s+v?\d+\.\d+/i,
    "since/until a version": /\b(?:since|until|before)\s+v?0\.\d+/i,
    "version tag": /(?<![\w(])\(0\.[234]\d(?:\.\d+)?(?:\)|,\s*(?:Lumen|owner))/i,
  };
  for (const [what, pattern] of Object.entries(banned)) {
    assert.doesNotMatch(md, pattern, `DESIGN.md carries an ${what}`);
  }
  const { dos } = required(md);
  for (const title of [/^do(?![- ]not)\b/i, /^do[- ]not\b/i]) {
    const rules = entries(subsection(dos, title));
    assert.ok(rules.length > 0, `the ${title} list is empty`);
    for (const rule of rules) {
      assert.ok(words(rule).length >= 5, `too short to hold a rule and its reason: ${rule}`);
    }
  }
});

test("the agent README lists DESIGN.md and the package ships it", () => {
  const readme = read("packages/ui-kit/agent/README.md");
  assert.match(readme, /^\|\s*`DESIGN\.md`\s*\|[^|\n]*\w[^|\n]*\|\s*$/m, "the file table has no DESIGN.md row");
  const { files } = JSON.parse(read("packages/ui-kit/package.json"));
  assert.ok(
    ["agent", "agent/", "agent/DESIGN.md"].some((f) => files.includes(f)),
    "package.json `files` does not cover agent/DESIGN.md",
  );
});
