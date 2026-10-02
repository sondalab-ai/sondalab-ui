import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const css = readFileSync(resolve(REPO, "packages/ui-kit/components.css"), "utf8");
const index = JSON.parse(
  readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.json"), "utf8"),
);

// The shared focus ring is ONE rule, and its selector list is enumerated by
// hand. A new interactive class that never gets a line here loses the house
// ring and nothing else fails — which is exactly why this test exists.
// Anchored on the declaration rather than on a comment, so re-wording the
// comment above the rule cannot silently empty the list.
function focusRingSelector() {
  const decl = css.indexOf("outline: var(--sl-focus-ring-width");
  assert.notEqual(decl, -1, "components.css has no shared focus-ring rule");
  const open = css.lastIndexOf("{", decl);
  const prevClose = Math.max(css.lastIndexOf("}", open), css.lastIndexOf("*/", open) + 1);
  return css.slice(prevClose + 1, open);
}

const selector = focusRingSelector();

test("the focus-ring rule names at least one selector", () => {
  assert.match(selector, /\.sl-/, `focus-ring selector list looks empty: ${selector}`);
});

for (const c of index.components.filter((c) => c.interactive)) {
  test(`focus ring covers "${c.id}"`, () => {
    const hit = c.classes.some((cls) => selector.includes(`.${cls}`))
      // A native range input draws its focus on the thumb, in a rule of its
      // own per engine: an engine pseudo-element cannot join the shared list
      // without dropping the whole list in the other engine.
      || c.classes.some((cls) => /\.sl-slider:focus-visible::-webkit-slider-thumb\s*\{[^}]*box-shadow/.test(css) && css.includes(`.${cls}:focus-visible::-moz-range-thumb`));
    assert.ok(
      hit,
      `"${c.id}" is marked interactive but none of ${JSON.stringify(c.classes)} ` +
        `appears in the focus-ring selector list:\n${selector}`,
    );
  });
}

// Regression (spexr migration, 2026-09-30): the shared ring set border-radius:
// 6px, so a 10px field or row snapped its corners on keyboard focus.
test("the shared focus ring sets no radius; the outline follows the element's own", () => {
  const decl = css.indexOf("outline: var(--sl-focus-ring-width");
  const body = css.slice(css.lastIndexOf("{", decl), css.indexOf("}", decl));
  assert.doesNotMatch(body, /border-radius/);
});

// Regression (introspect migration, 2026-09-30): a <button class="sl-nav__item">
// kept the native button chrome.
test("a nav item resets native button chrome", () => {
  const rule = css.match(/\.sl-nav__item \{([^}]*)\}/)[1];
  for (const d of [/appearance:\s*none/, /background:\s*none/, /border:\s*0/, /font:\s*inherit/, /text-align:\s*left/]) {
    assert.match(rule, d);
  }
});

// Regression, 2026-10-01 (owner: "no gaps between borders in any case"): the
// ring sits flush on the border. A positive offset opens a band of page
// between the control's edge and the ring.
test("the focus ring sits flush on the border, no gap", () => {
  const tokens = readFileSync(resolve(REPO, "packages/ui-kit/tokens.css"), "utf8");
  assert.match(tokens, /--sl-focus-ring-offset:\s*0px;/);
  assert.match(css, /outline-offset:\s*var\(--sl-focus-ring-offset, 0px\);/);
  assert.doesNotMatch(css, /--sl-focus-ring-offset, [1-9]/, "no fallback may reopen the gap");
  const ring = css.slice(css.indexOf("outline: var(--sl-focus-ring-width"), css.indexOf("}", css.indexOf("outline: var(--sl-focus-ring-width")));
  assert.match(ring, /border-color:\s*var\(--slc-focus\)/, "the border joins the ring");
  assert.match(css, /\.sl-icon-btn\[aria-pressed="true"\]:focus-visible,\s*\.sl-chip:hover:focus-visible\s*\{\s*border-color:\s*var\(--slc-focus\);/, "a pressed or hovered border joins the ring too");
  const effects = readFileSync(resolve(REPO, "packages/ui-kit/effects.css"), "utf8");
  assert.match(effects, /:is\(\.sl-btn, \.sl-icon-btn\)\.sl-fx-glass\.sl-fx-glass:focus-visible\s*\{\s*--slfx-control-edge:\s*var\(--slc-focus\);/, "a glass control's edge joins the ring");
});

// Regression, 2026-10-01: a solid danger button labelled with --slc-on-accent
// went dark on dark red on the light theme (the accent's partner is dark when
// the accent is light). Each status fill has its own contrast-picked label.
test("each solid status fill has its own contrast-picked label", () => {
  for (const s of ["success", "warning", "danger", "info"]) {
    assert.match(css, new RegExp(`--slc-on-${s}:\\s*oklch\\(from var\\(--slc-${s}\\)\\s*clamp\\(0\\.16, \\(0\\.61 - l\\) \\* 1000, 1\\) 0 h\\);`), s);
  }
});

// Regression, 2026-10-01: the checkbox/radio edge was the surface three steps
// darker, which on the dark theme is near-black on near-black (1.06:1). It
// steps away from the surface toward contrast, five steps: >= 3:1 on both.
// 0.29: a light surface takes half a step more -- the Lumen canvas sits
// further from the surface, and five read 3.02:1 on it. Read from the
// surface's own lightness, like the sign, so a Tier B layer on its own
// [data-theme] gets it too: no theme block may set the step count. Hover stays
// two steps further.
test("a form control's edge steps toward contrast, not always into shade", () => {
  const STEPS = "\\(var\\(--slc-edge-control-steps\\) \\+ 0\\.5 \\* clamp\\(0, \\(l - 0\\.5\\) \\* 1000, 1\\)";
  const SIGN = "\\* clamp\\(-1, \\(0\\.5 - l\\) \\* 1000, 1\\)\\) c h\\);";
  assert.match(css, /--slc-edge-control-steps:\s*5;/);
  assert.match(css, new RegExp(`--slc-edge-control:\\s*oklch\\(from var\\(--slc-surface\\) calc\\(l \\+ var\\(--slc-shade-step\\) \\* ${STEPS}\\) ${SIGN}`));
  assert.match(css, new RegExp(`--slc-edge-control-hover:\\s*oklch\\(from var\\(--slc-surface\\) calc\\(l \\+ var\\(--slc-shade-step\\) \\* ${STEPS} \\+ 2\\) ${SIGN}`));
  assert.equal(css.match(/--slc-edge-control-steps\s*:/g).length, 1, "declared once, on :root, never per theme");
  const box = css.match(/\.sl-check__box,\s*\.sl-radio__box\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(box, /border:\s*1px solid var\(--slc-edge-control\)/);
  const track = css.match(/\.sl-switch__track\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(track, /border:\s*1px solid var\(--slc-edge-control\)/, "the switch track is found by its edge");
  const knob = css.match(/\.sl-switch__track::after\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(knob, /background:\s*var\(--slc-edge-control\)/, "the off knob reads on its track");
  const field = css.match(/\.sl-field__input\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(field, /border:\s*1px solid var\(--slc-edge-control\)/, "a field is found by its edge");
});

// Owner, 2026-10-01: fields were outlined in the bright control edge and
// buttons in a darker one -- "they should all be consistent". Every neutral
// control takes --slc-edge-control, glass included.
test("every neutral control is outlined in the one control edge", () => {
  const rule = (sel) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.[\]()]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  for (const sel of [".sl-chip", ".sl-segmented", ".sl-icon-btn"]) {
    assert.match(rule(sel), /border:\s*1px solid var\(--slc-edge-control\)/, sel);
  }
  assert.match(css, /\.sl-btn--ghost \{[^}]*border-color:\s*var\(--slc-edge-control\)/, ".sl-btn--ghost");
  const effects = readFileSync(resolve(REPO, "packages/ui-kit/effects.css"), "utf8");
  assert.match(effects, /\.sl-icon-btn\.sl-fx-glass \{\s*--slfx-control-edge:\s*var\(--slc-edge-control\);/, "glass buttons");
});

// An invalid field (aria-invalid="true") turns its edge, its focus ring and its
// halo to the danger ink together: a red edge inside an accent ring is two
// colours on one edge (owner, 2026-10-01). There is no spectrum rim left to
// stand down (owner, 2026-10-02), so the rule carries no rim reset.
test("an invalid field is red at rest, on hover and inside its own focus ring", () => {
  const rest = css.match(/\.sl-field__input\[aria-invalid="true"\] \{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(rest, /--slc-rim/);
  for (const d of [/--slc-focus:\s*var\(--slc-danger-text, var\(--slc-danger\)\)/, /border-color:\s*var\(--slc-danger-text, var\(--slc-danger\)\)/]) {
    assert.match(rest, d);
  }
  assert.match(css, /\.sl-field__input\[aria-invalid="true"\]:hover:not\(:disabled\) \{ border-color: var\(--slc-danger-text, var\(--slc-danger\)\); \}/);
  // Focused, the border is the danger and the halo is drawn in --slc-focus,
  // which the field re-binds to the danger (0.32): one colour on the edge.
  const focus = css.match(/\.sl-field__input\[aria-invalid="true"\]:focus \{([^}]*)\}/)?.[1] ?? "";
  assert.match(focus, /border-color:\s*var\(--slc-danger-text, var\(--slc-danger\)\)/);
  assert.doesNotMatch(focus, /box-shadow/, "the halo comes from the field's own focus rule, in --slc-focus");
  assert.match(css, /\n\.sl-field__input:focus \{\s*border-color:\s*var\(--slc-focus\);\s*box-shadow:\s*var\(--_sl-depth, 0 0 transparent\), var\(--_sl-halo, 0 0 transparent\);/);
  const effects = readFileSync(resolve(REPO, "packages/ui-kit/effects.css"), "utf8");
  assert.match(effects, /\.sl-field__input\[aria-invalid="true"\]:is\(:hover, :focus, :not\(:focus\)\) \{\s*border-color: var\(--slc-danger-text, var\(--slc-danger\)\);/, "the glass field edge yields too");
  assert.match(css, /\.sl-field__error::before \{/, "the error line carries a mark, not colour alone");
  assert.match(effects, /\.sl-field__control:is\(\.sl-fx-glass, \.sl-fx-aurora\):has\(\.sl-field__input\[aria-invalid="true"\]\)::after \{\s*display: none;/, "the ring and the arc stand down on an invalid field");
});

// Mixed is the DOM's indeterminate flag only. ARIA in HTML forbids
// aria-checked on a native checkbox and a screen reader announces the native
// state, so an aria-checked="mixed" hook styled a state nobody hears
// (review, 2026-10-01).
test("a mixed checkbox reads from :indeterminate alone, never aria-checked", () => {
  assert.match(css, /\n\.sl-check__input:indeterminate \+ \.sl-check__box \{/);
  assert.match(css, /\n\.sl-check__input:indeterminate \+ \.sl-check__box::after \{[^}]*opacity: 1/);
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(code, /aria-checked/, "no selector reads aria-checked");
  for (const f of ["packages/ui-kit/README.md", "packages/ui-kit/agent/catalog.md", "docs/design-language.md", "showcase/index.html"]) {
    assert.doesNotMatch(readFileSync(resolve(REPO, f), "utf8"), /aria-checked="mixed"/, `${f} documents aria-checked="mixed"`);
  }
});

// Forced colours drop box shadows and repaint backgrounds as Canvas, so a state
// carried only by a fill or a shadow vanishes: the radio dot, the switch knob,
// the progress bar, the selected segment.
test("forced colours keep every fill-only state visible", () => {
  const block = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  assert.ok(block.length > 30, "no forced-colors block in components.css");
  for (const sel of [".sl-radio__box::after", ".sl-switch__track::after", ".sl-progress__bar", '.sl-segmented__item[aria-selected="true"]', '.sl-chip[aria-pressed="true"]']) {
    const at = block.indexOf(sel);
    assert.notEqual(at, -1, `${sel} is not handled under forced colours`);
    assert.match(block.slice(at, block.indexOf("}", at)), /forced-color-adjust:\s*none/, sel);
  }
  // Opting out stops the forced outline colour too: the ring is handed back.
  assert.match(block, /\.sl-radio__input:focus-visible \+ \.sl-radio__box,[\s\S]*?\{\s*outline-color:\s*CanvasText !important;/);
});

// An opted-out element is no longer repainted by the browser, so a consumer
// rule of equal weight loaded later (introspect's pressed-chip colour) put the
// page's colour back on it. Every system colour in the block is !important
// (review, 2026-10-01).
test("forced colours: every system colour wins over a consumer's equal rule", () => {
  const block = css.slice(css.lastIndexOf("@media (forced-colors: active)")).replace(/\/\*[\s\S]*?\*\//g, "");
  const decls = [...block.matchAll(/([a-z-]+)\s*:\s*([^;{}]*\b(?:Canvas|CanvasText|Highlight|HighlightText|GrayText|ButtonText|ButtonFace)\b[^;{}]*);/g)];
  assert.ok(decls.length >= 20, `found only ${decls.length} system-colour declarations`);
  const weak = decls.filter((m) => !/!important\s*$/.test(m[2])).map((m) => `${m[1]}: ${m[2]}`);
  assert.deepEqual(weak, []);
});

// The slider's value is a gradient image on the WebKit track, and forced
// colours remove gradient images: the fill was gone in Chromium and Safari.
test("forced colours: the slider keeps its value, its thumb and its focus ring", () => {
  const block = css.slice(css.lastIndexOf("@media (forced-colors: active)"));
  const rule = (sel) => block.match(new RegExp(`\\n\\s*${sel.replace(/[.:()]/g, "\\$&")} \\{([^}]*)\\}`))?.[1] ?? "";
  assert.match(rule(".sl-slider"), /forced-color-adjust:\s*none/);
  assert.match(rule(".sl-slider::-webkit-slider-runnable-track"), /background:\s*linear-gradient\(Highlight 0 0\) 0 \/ var\(--sl-slider-value, 0%\) 100% no-repeat, GrayText !important/);
  assert.match(rule(".sl-slider::-moz-range-track"), /background:\s*GrayText !important/);
  assert.match(rule(".sl-slider::-moz-range-progress"), /background:\s*Highlight !important/);
  for (const thumb of ["::-webkit-slider-thumb", "::-moz-range-thumb"]) {
    assert.match(rule(`.sl-slider${thumb}`), /background:\s*ButtonText !important/, thumb);
    assert.match(rule(`.sl-slider:focus-visible${thumb}`), /box-shadow:[^;]*CanvasText !important/, `${thumb} focus`);
  }
});

// On a selected row the ground is the accent wash; the muted ink fell to
// 3.77-4.16:1 there on dark.
test("a selected row lifts its muted meta to the secondary ink", () => {
  assert.match(css, /\.sl-list__row:is\(\[aria-selected="true"\], \[aria-current\]\) \.sl-list__meta,\s*\.sl-nav__item\[aria-current\] \.sl-nav__count \{ color: var\(--slc-text-secondary\); \}/);
});

test("a button group wears the one control edge, outline and inner rules alike", () => {
  const rule = css.match(/\.sl-btn-group \{([^}]*)\}/)?.[1] ?? "";
  assert.match(rule, /background:\s*var\(--slc-edge-control\)/);
  assert.match(rule, /border:\s*1px solid var\(--slc-edge-control\)/);
});

// One row, one height: button, field, select, segmented and icon button were
// 33.6 / 36.6 / 36.1 / 36.5 / 32px. Each now sums to 32 (line + padding + 1px
// border each side); the small button to 24.
test("controls in a row share the 32px height", () => {
  const remPx = (v) => parseFloat(v) * (v.endsWith("rem") ? 16 : 1);
  const pad = (body) => remPx(body.match(/padding:\s*([0-9.]+rem)/)[1]);
  const btn = css.match(/\n\.sl-btn \{([^}]*)\}/)[1];
  assert.match(btn, /line-height:\s*1;/);
  assert.equal(14 + 2 * pad(btn) + 2, 32, "button");
  const sm = css.match(/\.sl-btn--sm \{([^}]*)\}/)[1];
  assert.equal(12 + 2 * pad(sm) + 2, 24, "small button");
  const field = css.match(/\n\.sl-field__input \{([^}]*)\}/)[1];
  const lh = remPx(field.match(/line-height:\s*([0-9.]+rem)/)[1]);
  assert.equal(lh + 2 * pad(field) + 2, 32, "field and select");
  const item = css.match(/\n\.sl-segmented__item \{([^}]*)\}/)[1];
  assert.match(item, /line-height:\s*1;/);
  assert.equal(12 + 2 * pad(item) + 2 * 2 + 2, 32, "segmented");
  assert.match(css, /\n\.sl-icon-btn \{[^}]*height:\s*2rem/, "icon button");
});

// High contrast draws every edge in its border colour. It remapped the control
// edge but not its hover, which stayed on :root's derivation: a mid grey, so a
// hovered field or chip was fainter than at rest (review, 2026-10-01).
test("high contrast remaps the hovered control edge with the resting one", () => {
  const hc = css.match(/:root\[data-sl-theme="high-contrast"\] \{([^}]*)\}/)?.[1] ?? "";
  assert.match(hc, /--slc-edge-control:\s*var\(--slc-border\);/);
  assert.match(hc, /--slc-edge-control-hover:\s*var\(--slc-border-strong\);/);
});

// Inside a wrapping <label> every descendant is part of the input's accessible
// name, so a hint or error there was read as the name and again through
// aria-describedby. With a line, the documented host is a <div> whose label
// names the input by `for`, and every reference resolves (review, 2026-10-01).
for (const f of ["packages/ui-kit/agent/catalog.md", "showcase/index.html"]) {
  test(`${f}: a field's hint and error sit outside its label, and every reference resolves`, () => {
    const src = readFileSync(resolve(REPO, f), "utf8");
    for (const m of src.matchAll(/<label class="sl-field"[^>]*>\s*\n([\s\S]*?)<\/label>/g)) {
      assert.doesNotMatch(m[1], /sl-field__(?:hint|error)/, `a hint or error inside a wrapping label:\n${m[0]}`);
    }
    const ids = new Set([...src.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const lines = [...src.matchAll(/class="sl-field__(?:hint|error)" id="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(lines.length >= 2, "the example shows a hint and an error");
    for (const m of src.matchAll(/aria-describedby="([^"]+)"/g)) {
      for (const id of m[1].split(/\s+/)) assert.ok(ids.has(id), `aria-describedby="${id}" has no element`);
    }
    for (const id of lines) assert.match(src, new RegExp(`aria-describedby="[^"]*\\b${id}\\b`), `${id} is described by nothing`);
    for (const m of src.matchAll(/<label class="sl-field__label" for="([^"]+)"/g)) {
      assert.match(src, new RegExp(`<(?:input|select|textarea)[^>]*\\bid="${m[1]}"`), `label for="${m[1]}" names no control`);
    }
  });
}

// 0.27.0 sizing: a fixed line plus padding plus the edge. border-box keeps the
// declared size the whole control on a content-box page, and the README tells
// a consumer whose padding or font override now lands differently.
test("sizing: icon button and pagination item are border-box, and the README says what changed", () => {
  for (const sel of ["sl-icon-btn", "sl-pagination__item"]) {
    const body = css.match(new RegExp(`\\n\\.${sel} \\{([^}]*)\\}`))?.[1] ?? "";
    assert.match(body, /box-sizing:\s*border-box/, sel);
  }
  assert.match(css, /\/\*[^*]*border-box: the 1\.75rem height[\s\S]*?\*\/\s*box-sizing: border-box;\s*min-width: 1\.75rem;/, "the pagination border-box says why");
  const readme = readFileSync(resolve(REPO, "packages/ui-kit/README.md"), "utf8");
  const note = readme.slice(readme.indexOf("**0.27.0 — sizing.**"));
  assert.ok(note.length > 20, "README has no 0.27.0 sizing note");
  for (const term of ["32px", "24px", "`line-height: 1.25rem`", "`.sl-segmented__item`", "`line-height: 1`", "`padding` on `.sl-segmented__item`", "`font-size` on `.sl-field__input`", "set your own `line-height`"]) {
    assert.ok(note.slice(0, 2000).includes(term), `the sizing note names ${term}`);
  }
});

// The pagination item's hover drew the one control edge's hover step from
// 0.27.1 (it had drawn the old --slc-border line). Since 0.31 (Lumen) hover
// is a flat wash and only the current page lifts, as a tile: the item is
// borderless, so no edge can sit between a ring and its fill.
test("a hovered pagination item is a flat wash; the current one a tile", () => {
  const item = css.match(/\n\.sl-pagination__item \{([^}]*)\}/)?.[1] ?? "";
  assert.match(item, /\n\s*border:\s*0;/, "borderless");
  const hover = css.match(/\n\.sl-pagination__item:hover \{([^}]*)\}/)?.[1] ?? "";
  assert.match(hover, /background:\s*color-mix\(in srgb, var\(--slc-text\) 5%, transparent\)/);
  assert.doesNotMatch(hover, /border|box-shadow/, "hover never lifts");
  const current = css.match(/\n\.sl-pagination__item\[aria-current\] \{([^}]*)\}/)?.[1] ?? "";
  assert.match(current, /background:\s*var\(--slc-tile\)/);
  assert.match(current, /--_sl-depth:\s*var\(--slc-depth-tile\)/);
});

// Fields have been 32px since 0.27.0. The glass lens comments and the catalog
// still argued from a 37px field as if it were today's, which sent a reader
// computing the bend cap to the wrong number. 37px may only appear as history.
test("no lens note measures a field at 37px as a current fact", () => {
  for (const f of ["packages/ui-kit/glass.css", "packages/ui-kit/glass-lens.js", "packages/ui-kit/agent/catalog.md"]) {
    const text = readFileSync(resolve(REPO, f), "utf8");
    for (const m of text.matchAll(/[^\n]*37px[^\n]*/g)) {
      assert.match(m[0], /were (still )?37px/, `${f}: "${m[0].trim()}"`);
    }
    if (f !== "packages/ui-kit/agent/catalog.md") assert.match(text, /5\.3px on a 32px field|32px field bends at most ~5\.3px/, f);
  }
  assert.match(readFileSync(resolve(REPO, "packages/ui-kit/agent/catalog.md"), "utf8"), /`--slg-lens-blur` is \*\*2\.5px\*\*/, "the catalog's frost matches its table");
});
