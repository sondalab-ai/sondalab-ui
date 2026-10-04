import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// The type register (design-language L1, rewritten for Lumen in 0.30):
//   - MICRO labels (structure, never a control) are the only uppercase text:
//     mono, --sl-text-micro (10.5px), 500, +0.06em, muted.
//   - Controls, badges, chips, segmented, table heads, callout titles, field
//     labels and breadcrumbs speak in sentence case in the sans, never
//     tracked open.
//   - Tags stay mono for the tier marker, sentence case, +0.02em.
//   - Headings and display are Geist 600 with negative tracking, tighter as
//     they grow; Fraunces (--sl-font-brand) is the wordmark and monogram only.
const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const bare = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
// workbench.css (0.33) speaks the same register: its palette's group title
// is a micro label; its status bar speaks in sentence case.
const css = bare(readFileSync(resolve(KIT, "components.css"), "utf8")) + "\n" + bare(readFileSync(resolve(KIT, "workbench.css"), "utf8"));
const tokens = bare(readFileSync(resolve(KIT, "tokens.css"), "utf8"));

/** Every style rule as [{ selectors, body, nested }] in source order; `nested`
 *  marks one inside an at-rule (@media, @supports), which applies only some of
 *  the time and so never decides the register. */
function rules(text) {
  const out = [];
  let depth = 0, start = 0;
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      stack.push(text.slice(start, i).trim());
      depth++; start = i + 1;
    } else if (text[i] === "}") {
      const prelude = stack.pop();
      depth--;
      if (!prelude.startsWith("@")) {
        out.push({ selectors: prelude.split(",").map((x) => x.trim()), body: text.slice(start, i), nested: stack.some((p) => p.startsWith("@")) });
      }
      start = i + 1;
    }
  }
  return out;
}
const RULES = rules(css);
/** The declarations that apply to `sel`: every top-level rule whose selector
 *  list names it exactly, in source order, so the LAST value of a property is
 *  the one the cascade keeps (same selector, same specificity, later wins). */
const decls = (sel) => RULES.filter((r) => !r.nested && r.selectors.includes(sel)).map((r) => r.body).join(";\n");
const prop = (body, name) => {
  const all = [...body.matchAll(new RegExp(`(?:^|[;{\\s])${name}:\\s*([^;]+);`, "g"))];
  return all.length ? all[all.length - 1][1].trim() : undefined;
};
const em = (v) => (v === undefined ? 0 : v === "0" ? 0 : parseFloat(v));

const MICRO = [".sl-eyebrow", ".sl-nav__group", ".sl-stat__label", ".sl-section__idx", ".sl-figure__caption", ".sl-rule--labeled", ".sl-palette__group"];
// The status bar (0.33) is read, not shouted: the Lumen target's 12px
// sentence case, its data values as written (a branch is case-sensitive).
const SENTENCE = [".sl-btn", ".sl-chip", ".sl-badge", ".sl-segmented__item", ".sl-table thead th", ".sl-callout__title", ".sl-field__label", ".sl-breadcrumb", ".sl-statusbar"];
const HEADINGS = [".sl-card__title", ".sl-dialog__title", ".sl-empty__title"];

test("the reader keeps the cascade: a later rule for the same selector wins, an @media rule does not", () => {
  const r = rules(".a { color: red; }\n.a, .b { color: blue; }\n@media (x) { .a { color: green; } }");
  const body = r.filter((x) => !x.nested && x.selectors.includes(".a")).map((x) => x.body).join(";\n");
  assert.equal(prop(body, "color"), "blue");
  assert.equal(r.find((x) => x.nested)?.selectors[0], ".a");
});

test("--sl-text-micro is 10.5px, and the 32px row's two steps did not move", () => {
  assert.match(tokens, /--sl-text-micro:\s*0\.65625rem;/);
  // focus-ring.test does the row arithmetic from 14px and 12px lines.
  assert.match(tokens, /--sl-text-sm:\s*0\.875rem;/);
  assert.match(tokens, /--sl-text-xs:\s*0\.75rem;/);
});

for (const sel of MICRO) {
  test(`${sel} is a micro label: mono, --sl-text-micro, 500, uppercase, +0.06em, muted`, () => {
    const b = decls(sel);
    assert.ok(b, `no rule for ${sel}`);
    assert.match(prop(b, "font-family") ?? "", /^var\(--sl-font-mono,/);
    assert.match(prop(b, "font-size") ?? "", /^var\(--sl-text-micro,\s*0\.65625rem\)$/);
    assert.equal(prop(b, "font-weight"), "500");
    assert.equal(prop(b, "text-transform"), "uppercase");
    assert.equal(prop(b, "letter-spacing"), "0.06em");
    assert.equal(prop(b, "color"), "var(--slc-text-muted)");
  });
}

for (const sel of SENTENCE) {
  test(`${sel} speaks in sentence case, in the sans, never tracked open`, () => {
    const b = decls(sel);
    assert.ok(b, `no rule for ${sel}`);
    assert.match(prop(b, "font-family") ?? "", /^var\(--sl-font-sans,/);
    assert.notEqual(prop(b, "text-transform"), "uppercase");
    assert.ok(em(prop(b, "letter-spacing")) <= 0, `${sel} is tracked open`);
  });
}

test("uppercase is the micro register's alone (and the brand lockup's)", () => {
  const allowed = new Set([...MICRO, ".sl-lockup"]);
  for (const r of RULES.filter((r) => /text-transform:\s*uppercase/.test(r.body))) {
    for (const s of r.selectors) assert.ok(allowed.has(s), `${s} sets uppercase outside the micro register`);
  }
});

test(".sl-tag is the mono tier marker in sentence case, +0.02em", () => {
  const b = decls(".sl-tag");
  assert.match(prop(b, "font-family") ?? "", /^var\(--sl-font-mono,/);
  assert.notEqual(prop(b, "text-transform"), "uppercase");
  assert.equal(prop(b, "letter-spacing"), "0.02em");
});

for (const sel of HEADINGS) {
  test(`${sel} is Geist 600 with negative tracking`, () => {
    const b = decls(sel);
    assert.match(prop(b, "font-family") ?? "", /^var\(--sl-font-(display|sans),/);
    assert.equal(prop(b, "font-weight"), "600");
    const ls = em(prop(b, "letter-spacing"));
    assert.ok(ls <= -0.02 && ls >= -0.04, `${sel} letter-spacing ${ls}em`);
  });
}

test(".sl-anchor is display Geist 600, tracked -0.045…-0.06em, set solid", () => {
  const b = decls(".sl-anchor");
  assert.match(prop(b, "font-family") ?? "", /^var\(--sl-font-display,/);
  assert.equal(prop(b, "font-weight"), "600");
  const ls = em(prop(b, "letter-spacing"));
  assert.ok(ls <= -0.045 && ls >= -0.06, `letter-spacing ${ls}em`);
  assert.equal(prop(b, "line-height"), "1");
});

test("Fraunces is the brand's alone: --sl-font-brand on the wordmark and the monogram, nowhere else", () => {
  for (const sel of [".sl-wordmark", ".sl-monogram"]) {
    assert.match(prop(decls(sel), "font-family") ?? "", /^var\(--sl-font-brand,/, sel);
  }
  for (const r of RULES.filter((r) => r.body.includes("--sl-font-brand"))) {
    for (const s of r.selectors) assert.ok([".sl-wordmark", ".sl-monogram"].includes(s), `${s} uses the brand face`);
  }
});

test("no UI face falls back to a serif: a Tier B page without tokens.css stays in the sans", () => {
  for (const m of css.matchAll(/var\(--sl-font-(display|sans|mono),([^)]*)\)/g)) {
    // A bare `serif` or Georgia, never the `serif` inside `sans-serif`.
    assert.doesNotMatch(m[2], /(^|[\s,])(Georgia|serif)(?=$|[\s,])/, `--sl-font-${m[1]} falls back to ${m[2].trim()}`);
  }
});
