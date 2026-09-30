import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Prism (light theme): a 1px spectrum hairline on cards, the primary button and
// text fields. It is painted through the host's own border box, and every part
// of it is built from a property that is invalid where a theme resets the
// spectrum — so there the host falls back to exactly what it painted before.
const HERE = dirname(fileURLToPath(import.meta.url));
const strip = (f) => readFileSync(resolve(HERE, `../packages/ui-kit/${f}`), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const css = strip("components.css");
const effects = strip("effects.css");
const role = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const rule = (sel) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
const HOSTS = [".sl-card", ".sl-btn--primary", ".sl-field__input"];

test("the rim and its edge switch are built from the spectrum ink in the role block", () => {
  assert.match(role, /--slc-rim:\s*linear-gradient\([^;]*var\(--sl-spectrum-ink-0\)[^;]*var\(--sl-spectrum-ink-4\)/);
  assert.match(role, /--slc-rim-edge:\s*color-mix\(in srgb,\s*var\(--sl-spectrum-ink-0\)\s*0%,\s*transparent\)/);
});

for (const host of HOSTS) {
  test(`${host}: the rim layers are none and the border is today's where the spectrum is reset`, () => {
    const r = rule(host);
    assert.match(r, /--slc-rim-layers:\s*linear-gradient\([^;]*\),\s*var\(--slc-rim\)/, "fill layer over the rim");
    assert.match(r, /background-image:\s*var\(--slc-rim-layers,\s*none,\s*none\)/);
    assert.match(r, /background-clip:\s*padding-box,\s*border-box/);
    assert.match(r, /background-origin:\s*padding-box,\s*border-box/);
    assert.match(r, /border(?:-color)?:[^;]*var\(--slc-rim-edge,/, "the border hides only where the rim shows");
  });
}

test("a primary button's states move the rim's fill with its background", () => {
  for (const state of [":hover:not(:disabled)", ":active:not(:disabled)"]) {
    const r = rule(`.sl-btn--primary${state}`);
    assert.match(r, /--slc-rim-fill:/, state);
  }
});

test("an effect host keeps its own edge: effects.css turns the rim off on it", () => {
  const r = effects.match(/:is\(([^)]*)\)\s*\{[^}]*--slc-rim:\s*initial[^}]*\}/);
  assert.ok(r, "effects.css resets the rim on its hosts");
  for (const fx of [".sl-fx-glass", ".sl-fx-aurora", ".sl-fx-press", ".sl-fx-glitch", ".sl-fx-liquid", ".sl-fx-goo__member"]) assert.ok(r[1].includes(fx), fx);
  assert.match(r[0], /--slc-rim-edge:\s*initial/);
});

test("inside an inversion band the rim and spectral text stand down", () => {
  // The band makes surfaces translucent (currentColor at 7-12%), so a rim
  // painted under the padding box would show through the whole body, and the
  // spectrum ink does not clear 3:1 on the band's ink. Both reset there.
  const band = rule(".sl-invert > *");
  for (const p of ["--slc-rim", "--slc-rim-edge", "--slc-spectral-ink", "--slc-spectral-fill"]) {
    assert.match(band, new RegExp(`${p}:\\s*initial`), p);
  }
});
