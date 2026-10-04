import { test } from "node:test";
import assert from "node:assert/strict";
import { cells, marks, worst, ratio, REGISTRY, THEMES, WIRINGS, CONTEXTS, product } from "./lib/primary-matrix.mjs";
import { evaluate, toHex, toOklch } from "./lib/css-color.mjs";

// The primary's label holds 4.5:1 for every product, theme and state
// (ui-kit 0.32.1). sondalab-site's composited sweep measured it under 4.5 on
// 0.32.0: spexr's glass at rest on paper (4.34), introspect's press on paper
// (3.71 opaque, 4.04 glass), local-agents' press on ink (4.45) and its glass
// at rest on paper (4.45). Each cell is read through the cascade
// (scripts/lib/primary-matrix.mjs), so the label, the fill, the glass stack
// and the backdrop it composites over all come from the kit's own rules.

const ALL = cells();
const DANGER = cells({ danger: true });
const key = (c) => `${c.wiring} / ${c.id} / ${c.theme}`;
const groups = new Map();
for (const c of [...ALL, ...DANGER]) {
  const k = `${c.danger ? "danger " : ""}${key(c)}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(c);
}

test("the matrix covers every registered product, inherited ones included, on both themes, in every wiring and context", () => {
  for (const wiring of Object.keys(WIRINGS)) for (const id of Object.keys(REGISTRY)) for (const theme of THEMES) {
    const mine = ALL.filter((c) => c.wiring === wiring && c.id === id && c.theme === theme);
    const contexts = new Set(mine.map((c) => c.context));
    assert.ok(contexts.has("opaque"), `${wiring} ${id} ${theme}`);
    if (wiring !== "tier B") assert.deepEqual([...contexts].sort(), Object.keys(CONTEXTS).sort(), `${wiring} ${id} ${theme}`);
    assert.equal(mine.length, contexts.size * 3, "rest, hover and press");
  }
  // a glass cell is the pane over the canvas, a surface and a raised surface
  const glass = ALL.find((c) => c.context === "glass");
  for (const g of ["canvas", "surface", "raised"]) assert.ok(glass.surfaces.some((s) => s.where.startsWith(g)), g);
  // daos inherits the default's accent and is measured as its own product
  assert.ok(ALL.some((c) => c.id === "daos"));
});

for (const [k, group] of groups) {
  test(`${k}: the primary's label reads 4.5:1 at rest, hovered and pressed, opaque, in an opt-out region and on glass`, () => {
    const low = group.map((c) => ({ c, w: worst(c) })).filter(({ w }) => w.r < 4.5)
      .map(({ c, w }) => `${c.context} ${c.state}: ${w.r.toFixed(2)} (${toHex(c.label)}, ${w.where})`);
    assert.deepEqual(low, []);
  });

  // Hover and press step AWAY from the label's pole, as the danger tone's
  // do: lighter under a dark label, darker under a white one, so the label
  // never reads weaker than at rest. On glass it is the composite that must
  // move away, over every ground.
  test(`${k}: hover and press step away from the label`, () => {
    const toward = [];
    for (const context of Object.keys(CONTEXTS)) {
      const at = (state) => group.find((c) => c.context === context && c.state === state);
      const rest = at("rest");
      if (!rest) continue;
      for (const state of ["hover", "press"]) {
        const s = at(state);
        assert.equal(toHex(s.label), toHex(rest.label), `${context}: the label does not change with the state`);
        s.surfaces.forEach((surf, i) => {
          const before = ratio(rest.label, rest.surfaces[i].colour), after = ratio(s.label, surf.colour);
          if (!(after > before)) toward.push(`${context} ${state} ${surf.where}: ${before.toFixed(2)} -> ${after.toFixed(2)}`);
        });
      }
    }
    assert.deepEqual(toward, []);
  });
}

// The edge is the resting fill in shade, which this patch does not move. It
// read under 3:1 on the canvas on 0.32.0 in one place, spexr's indigo one
// step down on ink; that is recorded here, not changed, and must not fall.
const EDGE_UNDER_3_ON_0_32_0 = { "spexr/dark": 2.65 };

for (const wiring of Object.keys(WIRINGS)) for (const id of Object.keys(REGISTRY)) for (const theme of THEMES) {
  const mine = ALL.filter((c) => c.wiring === wiring && c.id === id && c.theme === theme && c.context === "opaque");
  test(`${wiring} / ${id} / ${theme}: the primary's edge finds it on the canvas (3:1 where it did), and its foot is no harder to see hovered or pressed than at rest`, () => {
    const rest = mine.find((c) => c.state === "rest");
    const r = ratio(rest.edge, rest.grounds.canvas);
    assert.ok(r >= (EDGE_UNDER_3_ON_0_32_0[`${id}/${theme}`] ?? 3) - 0.005, `edge on canvas ${r.toFixed(2)}`);
    for (const c of mine) assert.equal(toHex(c.foot), toHex(rest.edge), `${c.state}: the foot is the fill in shade`);
    // The foot is the resting fill in shade. Under a dark label the states
    // now lighten, away from it; under a white one they darken exactly as
    // they did on 0.32.0 (the step pins below), so the foot is as visible as
    // it was. Either way a state never sits closer to the foot than rest
    // does, unless it has crossed it (the white label's press, darker than
    // its own shade, as before).
    const dark = toOklch(rest.label)[0] < 0.5;
    if (dark) for (const c of mine) assert.ok(ratio(c.foot, c.host) >= ratio(rest.foot, rest.host) - 1e-9, `${c.state}: the foot loses ground`);
  });
  test(`${wiring} / ${id} / ${theme}: the tick, the dot and the knob read on a checked control's fill (4.5:1)`, () => {
    const low = marks({ wiring, id, theme }).map((m) => [m.name, ratio(m.mark, m.fill)]).filter(([, r]) => r < 4.5).map(([n, r]) => `${n} ${r.toFixed(2)}`);
    assert.deepEqual(low, []);
  });
}

// ── what the direction rule does not change ─────────────────────────────────

test("a fill under a white label steps as it did on 0.32.0: color-mix(in srgb, <fill> 89% / 76%, black)", () => {
  for (const c of ALL.filter((c) => c.context === "opaque" && c.state !== "rest" && c.wiring !== "tier B")) {
    const rest = ALL.find((r) => r.wiring === c.wiring && r.id === c.id && r.theme === c.theme && r.context === "opaque" && r.state === "rest");
    if (toOklch(rest.label)[0] < 0.5) continue;
    const want = evaluate(`color-mix(in srgb, ${toHex(rest.host)} ${c.state === "hover" ? 89 : 76}%, black)`, new Map());
    assert.equal(toHex(c.host), toHex(want), `${key(c)} ${c.state}`);
  }
  // spexr's registered fill, by name: 6.47 / 8.03 under its white label
  const spexr = ALL.filter((c) => c.wiring === "tier A" && c.id === "spexr" && c.context === "opaque");
  assert.deepEqual(spexr.filter((c) => c.theme === "light").map((c) => toHex(c.host)), ["#4c58e9", "#444ecf", "#3a43b1"]);
  assert.deepEqual(spexr.filter((c) => c.theme === "dark").map((c) => toHex(c.host)), ["#4c58e9", "#444ecf", "#3a43b1"]);
});

test("the dark theme's hover is the same 20% of white it was", () => {
  for (const id of Object.keys(REGISTRY)) {
    const p = product(id);
    if (p.fill?.dark || p.steps?.dark) continue;
    const hover = ALL.find((c) => c.wiring === "tier A" && c.id === id && c.theme === "dark" && c.context === "opaque" && c.state === "hover");
    assert.equal(toHex(hover.host), toHex(evaluate(`color-mix(in srgb, ${p.dark} 80%, white)`, new Map())), id);
  }
});
