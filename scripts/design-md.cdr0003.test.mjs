// CDR-0003: the content of packages/ui-kit/agent/DESIGN.md, checked against
// its sources. Expected values are read from the sources, not typed here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(REPO, p), "utf8");
const json = (p) => JSON.parse(read(p));

const tokens = json("sondalab.tokens.json");
const neutrals = json("packages/ui-kit/neutrals.json");
const registry = json("packages/ui-kit/agent/accent-registry.json");
const language = read("docs/design-language.md");
const flavour = read("packages/ui-kit/agent/flavour.md");

const designMd = () => read("packages/ui-kit/agent/DESIGN.md");

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Lower case, no backticks or emphasis marks, single spaces. */
const plain = (s) => s.replace(/[`*]/g, "").replace(/\s+/g, " ").toLowerCase();
/** Lower case, no backticks and no whitespace: for comparing values. */
const tight = (s) => s.replace(/[`\s]/g, "").toLowerCase();

/** `value` stands in `line` as a whole value, not as part of a longer one. */
function hasValue(line, value) {
  const re = new RegExp(`(?<![\\w.#-])${escapeRe(value.toLowerCase())}(?![\\w%]|\\.\\d)`);
  return re.test(line.replace(/[`*]/g, "").toLowerCase());
}

function assertTokenLine(body, name, value) {
  const named = new RegExp(`${escapeRe(name)}(?![\\w-])`);
  const lines = body.split("\n").filter((l) => named.test(l));
  assert.ok(lines.length, `no line names ${name}`);
  assert.ok(lines.some((l) => hasValue(l, value)), `no line gives ${name} the value ${value}; got:\n${lines.join("\n")}`);
}

// ---- sections ----

const SECTIONS = [
  ["brand", /brand|voice/i],
  ["colour", /colou?r/i],
  ["typography", /typograph/i],
  ["spacing", /spacing/i],
  ["depth", /depth/i],
  ["components", /signature|component/i],
  ["motion", /motion/i],
  ["effects", /effect/i],
  ["dos", /^(\d+[.)]\s*)?do\b|\bdo[ -]not\b|\bdon['’]ts?\b/i],
];

/** The nine sections, found as `## ` headings in the required order. */
function sections(md) {
  const lines = md.split("\n");
  const heads = [];
  let fenced = false;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) fenced = !fenced;
    else if (!fenced && /^## /.test(l)) heads.push({ i, title: l.slice(3).trim() });
  });
  const found = [];
  let from = 0;
  for (const [key, re] of SECTIONS) {
    const at = heads.findIndex((h, n) => n >= from && re.test(h.title));
    assert.ok(at >= 0, `missing or out of order: the "${key}" section (## headings: ${heads.map((h) => h.title).join(" / ")})`);
    found.push({ key, i: heads[at].i });
    from = at + 1;
  }
  return Object.fromEntries(found.map((s, n) => [s.key, lines.slice(s.i, found[n + 1]?.i ?? lines.length).join("\n")]));
}
const section = (key) => sections(designMd())[key];

/** A line that opens an entry called `name`: a sub-heading, a list item, a
 *  table row or a paragraph that starts with the name. */
const labelRe = (name) =>
  new RegExp(`^\\s*(?:#{3,6}\\s+|[-*+]\\s+|\\d+\\.\\s+|\\|\\s*)?(?:\\*\\*)?(?:the\\s+)?\`?${name}(?:e?s)?(?![\\w-])`, "i");

/** Each named entry's text, from its label line to the next entry's label. */
function entries(body, names) {
  const lines = body.split("\n").slice(1);
  const starts = Object.entries(names).map(([key, name]) => {
    const i = lines.findIndex((l) => labelRe(name).test(l));
    assert.ok(i >= 0, `no entry for "${key}" (a line that starts with the name)`);
    return { key, i };
  });
  starts.sort((a, b) => a.i - b.i);
  return Object.fromEntries(starts.map((s, n) => [s.key, lines.slice(s.i, starts[n + 1]?.i ?? lines.length).join("\n")]));
}

// ---- criteria ----

test("DESIGN.md has the nine sections in order", () => {
  const s = sections(designMd());
  for (const [key, body] of Object.entries(s)) {
    assert.ok(body.split("\n").slice(1).join("").trim().length > 0, `section "${key}" is empty`);
  }
});

/** The rows of every table that has Light, Dark, High contrast and Purpose columns. */
function roleRows(body) {
  const rows = [];
  let cols = null;
  let inTable = false;
  for (const line of body.split("\n")) {
    if (!line.trim().startsWith("|")) { inTable = false; cols = null; continue; }
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (!inTable) {
      inTable = true;
      const at = (re) => cells.findIndex((c) => re.test(c));
      const c = { light: at(/light/i), dark: at(/dark/i), "high-contrast": at(/high[ -]?contrast/i), purpose: at(/purpose|used? for|\buse\b/i) };
      cols = Object.values(c).every((n) => n >= 0) ? c : null;
      continue;
    }
    if (!cols || cells.every((c) => /^:?-+:?$/.test(c))) continue;
    rows.push({ name: cells[0], ...Object.fromEntries(Object.entries(cols).map(([k, n]) => [k, cells[n] ?? ""])) });
  }
  return rows;
}

test("colour roles carry the light, dark and high-contrast values and a purpose", () => {
  const rows = roleRows(section("colour"));
  assert.ok(rows.length, "no table with Light, Dark, High contrast and Purpose columns");

  const themes = ["light", "dark", "high-contrast"];
  const expected = {};
  for (const theme of themes) {
    const generated = theme === "high-contrast" ? {} : neutrals.products.default[theme];
    const values = { ...generated, ...tokens.themes[theme], "accent-default": tokens.accent[theme].default };
    for (const [role, value] of Object.entries(values)) {
      if (role.startsWith("code-")) continue;
      (expected[role] ??= {})[theme] = value;
    }
  }

  for (const [role, byTheme] of Object.entries(expected)) {
    const re = new RegExp(`--sl-${escapeRe(role)}(?![\\w-])`);
    const row = rows.find((r) => re.test(r.name));
    assert.ok(row, `no colour role row for --sl-${role}`);
    for (const [theme, value] of Object.entries(byTheme)) {
      // A source value over a private var() is printed resolved; design-md.cdr0004.test.mjs checks it.
      if (/var\(--_/.test(value)) continue;
      assert.ok(tight(row[theme]).includes(tight(value)), `--sl-${role} ${theme}: expected ${value}, got "${row[theme]}"`);
    }
    assert.match(row.purpose, /[A-Za-z]{3,}/, `--sl-${role} has no purpose`);
  }
});

test("every product of the accent registry appears with its accent", () => {
  const lines = section("colour").split("\n");
  for (const [id, entry] of Object.entries(registry.products)) {
    let source = entry;
    let name = id;
    while (source.inherits) { name = source.inherits; source = registry.products[name]; }
    const accent = name === "default"
      ? { light: tokens.accent.light.default, dark: tokens.accent.dark.default }
      : source;
    const re = new RegExp(`(?<![\\w-])${escapeRe(id)}(?![\\w-])`, "i");
    assert.ok(
      lines.some((l) => re.test(l) && hasValue(l, accent.light) && hasValue(l, accent.dark)),
      `no line gives product ${id} its accent ${accent.light} / ${accent.dark}`,
    );
  }
});

test("typography lists the five font roles and the type scale", () => {
  const body = section("typography");
  const roles = Object.entries(tokens.shared.font);
  assert.equal(roles.length, 5);
  for (const [k, v] of roles) assertTokenLine(body, `--sl-font-${k}`, v);
  for (const [k, v] of Object.entries(tokens.shared.text)) assertTokenLine(body, `--sl-text-${k}`, v);
});

test("spacing lists the space scale, the radii and the control height", () => {
  const body = section("spacing");
  for (const [k, v] of Object.entries(tokens.shared.space)) assertTokenLine(body, `--sl-space-${k}`, v);
  for (const [k, v] of Object.entries(tokens.shared.radius)) assertTokenLine(body, `--sl-radius-${k}`, v);
  const height = language.match(/are all \*\*(\d+px)\*\*/)?.[1];
  assert.ok(height, "design-language.md no longer states the control height");
  assert.ok(
    body.split("\n").some((l) => /control|height/i.test(l) && hasValue(l, height)),
    `no line gives the control height ${height}`,
  );
});

test("depth covers the seven recipes", () => {
  entries(section("depth"), {
    tile: "tile", flatTile: "flat tile", island: "island", key: "key",
    sunk: "sunk", float: "float", cast: "cast",
  });
});

test("signature components are covered, the bezel card as shipped only once the catalog ships it", () => {
  const found = entries(section("components"), {
    wordmark: "wordmark", eyebrow: "eyebrow", tag: "tag", band: "inversion band",
    keycap: "keycap", tile: "tile", bezel: "bezel card",
  });
  const catalog = JSON.parse(readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.json"), "utf8"));
  const shipped = catalog.components.some((c) => c.classes.some((cls) => /bezel/.test(cls)));
  if (shipped) {
    assert.doesNotMatch(plain(found.bezel), /not (yet )?(been )?shipped/, "the bezel card ships but reads as not shipped");
  } else {
    assert.match(found.bezel, /chosen/i);
    assert.match(plain(found.bezel), /not (yet )?(been )?shipped/);
  }
  for (const [key, text] of Object.entries(found)) {
    if (key !== "bezel") assert.doesNotMatch(plain(text), /not (yet )?(been )?shipped/, `${key} is shipped`);
  }
});

test("motion gives the durations and curves, with the rules", () => {
  const body = section("motion");
  for (const [k, v] of Object.entries(tokens.shared.motion)) assertTokenLine(body, `--sl-motion-${k}`, v);
  const text = plain(body);
  assert.match(text, /reduced[ -]motion/, "reduced-motion rule");
  assert.match(text, /page-load/, "page-load choreography rule");
  assert.match(text, /dither/, "dither hover rule");
});

test("effects list the four families, each with its one meaning", () => {
  const meanings = Object.fromEntries(
    [...language.matchAll(/(Glitch|Aurora|Glass|Goo) means \*([^*]+)\*/g)].map((m) => [m[1].toLowerCase(), plain(m[2])]),
  );
  assert.deepEqual(Object.keys(meanings).sort(), ["aurora", "glass", "glitch", "goo"]);
  const found = entries(section("effects"), { glitch: "glitch", aurora: "aurora", glass: "glass", goo: "goo" });
  for (const [family, meaning] of Object.entries(meanings)) {
    assert.ok(plain(found[family]).includes(meaning), `${family} must carry its meaning "${meaning}"`);
  }
});

/** The text under the `Do` and the `Do not` headings of the last section. */
function doLists() {
  const lines = section("dos").split("\n");
  const doRe = /^#{2,4}\s+do(\s+list)?\s*$/i;
  const notRe = /^#{2,4}\s+(do[ -]not|don['’]t)(\s+list)?\s*$/i;
  const under = (re, label) => {
    const at = lines.findIndex((l) => re.test(l));
    assert.ok(at >= 0, `no "${label}" heading`);
    const end = lines.findIndex((l, i) => i > at && /^#{1,4}\s/.test(l));
    return plain(lines.slice(at + 1, end < 0 ? lines.length : end).join("\n"));
  };
  return { yes: under(doRe, "Do"), no: under(notRe, "Do not") };
}

/** The first column of the table under a flavour.md heading. */
function flavourColumn(heading, column) {
  const body = flavour.split(/^## /m).find((s) => heading.test(s.split("\n")[0]));
  assert.ok(body, `flavour.md has no section ${heading}`);
  return body.split("\n").filter((l) => l.startsWith("|")).slice(2).map((l) => l.split("|")[column].trim());
}

test("the do-not list has every do-not-converge trait of flavour.md", () => {
  const traits = flavourColumn(/do not converge/i, 1);
  assert.ok(traits.length > 0);
  const { no } = doLists();
  for (const trait of traits) assert.ok(no.includes(plain(trait)), `do-not list misses "${trait}"`);
});

test("the do list reflects the brand traits of flavour.md", () => {
  assert.equal(flavourColumn(/the traits/i, 2).length, 12, "the markers below follow flavour.md's 12 traits");
  const { yes } = doLists();
  const markers = [
    [/wordmark/, /fraunces/],
    [/mono/, /uppercase/, /micro[ -]label/],
    [/geist mono/, /geist pixel/],
    [/hairline/],
    [/lightness/],
    [/inversion band/],
    [/dither/],
    [/disabled/, /checkerboard/],
    [/pixel/, /check/, /radio/, /switch/],
    [/glitch/, /aurora/, /glass/, /goo/],
    [/one accent/],
    [/precise/, /marketing/],
  ];
  markers.forEach((all, n) => {
    for (const re of all) assert.match(yes, re, `do list does not reflect trait ${n + 1} (${re})`);
  });
});

test("DESIGN.md has no date, owner annotation or version history", () => {
  const md = designMd();
  const text = plain(md);
  assert.doesNotMatch(md, /\d{4}-\d{2}-\d{2}/, "date");
  assert.doesNotMatch(text, /\bowner(['’]s)? (ruling|amendment|decision|override|approval|pick)/, "owner annotation");
  assert.doesNotMatch(text, /\(owner\b|\bowner[,:] |owner-(approved|ruling|amendment)|\bruled by the owner/, "owner annotation");
  assert.doesNotMatch(text, /\bamend(ed|ment)\b/, "amendment note");
  assert.doesNotMatch(text, /\b(until|since) (ui-kit )?v?\d+\.\d+/, "version history");
});

test("the agent README file table has a DESIGN.md row", () => {
  assert.match(read("packages/ui-kit/agent/README.md"), /^\|\s*`DESIGN\.md`\s*\|[^|\n]*\S[^|\n]*\|\s*$/m);
});

test("the ui-kit files list covers the DESIGN.md that is there", () => {
  assert.ok(designMd().trim().length > 0);
  const { files } = json("packages/ui-kit/package.json");
  assert.ok(files.some((f) => ["agent", "agent/", "agent/**", "agent/DESIGN.md"].includes(f)), "files must cover agent/DESIGN.md");
});
