import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { auditCss } from "../packages/ui-kit/agent/sl-audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const AGENT = resolve(REPO, "packages/ui-kit/agent");

const md = readFileSync(resolve(AGENT, "catalog.md"), "utf8");
const index = JSON.parse(readFileSync(resolve(AGENT, "catalog.json"), "utf8"));
const tokens = JSON.parse(readFileSync(resolve(REPO, "sondalab.tokens.json"), "utf8"));
const registry = JSON.parse(readFileSync(resolve(AGENT, "accent-registry.json"), "utf8"));
const matrix = JSON.parse(readFileSync(resolve(AGENT, "substrate-matrix.json"), "utf8"));
const blessed = JSON.parse(readFileSync(resolve(AGENT, "blessed/default.json"), "utf8"));

// Extract every fenced html/css block from the catalog.
function extractFences(text) {
  const blocks = [];
  const re = /```(html|css)\n([\s\S]*?)```/g;
  for (const m of text.matchAll(re)) blocks.push(m[2]);
  return blocks;
}

const fences = extractFences(md);

test("catalog has a healthy number of snippets (extraction not broken)", () => {
  assert.ok(fences.length >= 15, `expected >=15 snippets, got ${fences.length}`);
});

test("every catalog snippet audits clean (no colour literal, tier-agnostic)", () => {
  const css = fences.join("\n");
  const r = auditCss({
    css,
    tokens,
    accentEntry: registry.products.default,
    blessed,
    declaredTier: null, // snippets are markup/CSS fragments, not a full themed surface
    substrate: "Page",
    matrix,
    file: "catalog.md",
  });
  const colour = r.findings.filter((f) => f.rule === "accent-one-hue");
  assert.equal(colour.length, 0, `catalog snippets must use role-vars only, found: ${JSON.stringify(colour)}`);
});

// A class is documented when it appears in a snippet or in a section BODY —
// never when it is only named in a heading. `sl-fx-glass--field` sat in the
// Glass heading for two releases while nothing said the wrapper it needs is
// mandatory, and the shorthand match counted that as documented.
const bodies = md.replace(/^#{1,6} .*$/gm, "");

/** The section of catalog.md whose heading names `cls` (or its `--mod`
 *  shorthand), from that heading to the next one of the same or higher level. */
function sectionFor(cls) {
  const mod = cls.includes("--") ? "--" + cls.split("--")[1] : null;
  const re = /^(#{2,3}) (.*)$/gm;
  const heads = [...md.matchAll(re)];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    if (!h[2].includes(cls) && !(mod && h[2].includes(mod))) continue;
    const end = heads.slice(i + 1).find((n) => n[1].length <= h[1].length);
    return md.slice(h.index, end ? end.index : md.length);
  }
  return null;
}

// json <-> md parity: every documented class/component appears in the prose.
for (const c of index.components) {
  test(`catalog.md documents "${c.id}"`, () => {
    if (c.classes.length > 0) {
      for (const cls of c.classes) {
        // A modifier may be written in full anywhere below a heading, or as
        // its `--mod` shorthand INSIDE the body of the section whose heading
        // lists it (e.g. "`--numeric` for tabular figures") — a heading alone
        // is a table of contents, not documentation.
        const mod = cls.includes("--") ? "--" + cls.split("--")[1] : null;
        const section = mod ? sectionFor(cls) : null;
        const sectionBody = section ? section.replace(/^#{1,6} .*$/gm, "") : "";
        const ok = bodies.includes(cls) || (mod && sectionBody.includes(mod));
        assert.ok(ok, `class "${cls}" (${c.id}) is not documented in catalog.md outside a heading`);
      }
    } else {
      // signatures: match on the id words appearing in a heading
      const words = c.id.split("-");
      assert.ok(words.every((w) => new RegExp(w, "i").test(md)), `signature "${c.id}" missing from catalog.md`);
    }
  });
}

// json <-> md parity for role-vars: the `Consumes:` line of a component's
// section must name every --slc-* role-var the index lists, and vice versa.
// Nothing compared the two before, and fx-glitch drifted (--slc-accent-hover
// in the prose and in effects.css, absent from the index).
for (const c of index.components) {
  if (c.classes.length === 0) continue;
  test(`catalog.json roleVars match the Consumes line for "${c.id}"`, () => {
    const section = sectionFor(c.classes[0]);
    assert.ok(section, `no section heading names ${c.classes[0]}`);
    const line = section.split("\n").find((l) => l.startsWith("Consumes:"));
    assert.ok(line, `section for ${c.id} has no Consumes: line`);
    const prose = new Set((line.match(/--slc-[a-z-]+/g) || []));
    const listed = new Set(c.roleVars.filter((v) => v.startsWith("--slc-")));
    assert.deepEqual([...listed].sort(), [...prose].sort(),
      `${c.id}: catalog.json lists ${[...listed]} but Consumes: says ${[...prose]}`);
  });
}
