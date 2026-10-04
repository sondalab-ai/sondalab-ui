import { test } from "node:test";
import assert from "node:assert/strict";
import { cells, marks, measure, worst, ratio, REGISTRY, THEMES, WIRINGS, CONTEXTS, STATES } from "./lib/primary-matrix.mjs";
import { evaluate, toHex, toOklch, linToOklab } from "./lib/css-color.mjs";

// The primary's label holds 4.5:1 for every product, theme and state
// (ui-kit 0.32.1). sondalab-site's composited sweep measured it under 4.5 on
// 0.32.0: spexr's glass at rest on paper (4.34), introspect's press on paper
// (3.71 opaque, 4.04 glass), local-agents' press on ink (4.45) and its glass
// at rest on paper (4.45). Each cell is read through the cascade
// (scripts/lib/primary-matrix.mjs), so the label, the fill, the glass stack
// and the backdrop it composites over all come from the kit's own rules.

const dE = (a, b) => { const x = linToOklab(a.lin), y = linToOklab(b.lin); return Math.hypot(...x.map((v, i) => v - y[i])) * 100; };
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
    assert.deepEqual([...contexts].sort(), Object.keys(CONTEXTS).sort(), `${wiring} ${id} ${theme}`);
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

  // ...and far enough to be seen (0.32.1 review: mixing toward white at
  // 89% / 76% moved a dark theme's hover to its press by ΔE 0.7-1.3, where
  // the darkening side moved 5-11). ΔE is OKLab distance x 100; 3 is about
  // three just-noticeable differences. Every surface, every context.
  test(`${k}: rest to hover and hover to press each move at least ΔE 3`, () => {
    const faint = [];
    for (const context of Object.keys(CONTEXTS)) {
      const [rest, hover, press] = Object.keys(STATES).map((state) => group.find((c) => c.context === context && c.state === state));
      rest.surfaces.forEach((surf, i) => {
        for (const [from, to, name] of [[surf.colour, hover.surfaces[i].colour, "rest -> hover"], [hover.surfaces[i].colour, press.surfaces[i].colour, "hover -> press"]]) {
          const d = dE(from, to);
          if (d < 3) faint.push(`${context} ${surf.where} ${name}: ΔE ${d.toFixed(1)}`);
        }
      });
    }
    assert.deepEqual(faint, []);
  });

  // An opt-out region keeps the shipped control (L6): a built glass primary
  // in [data-sl-fx="off"] is the opaque key -- its own fill, its own label,
  // no layer between them -- in every state.
  test(`${k}: in an opt-out region a glass primary is the opaque key`, () => {
    for (const state of Object.keys(STATES)) {
      const off = group.find((c) => c.context === "fx off" && c.state === state);
      const opaque = group.find((c) => c.context === "opaque" && c.state === state);
      assert.equal(off.layers, false, `${state}: the glass layers are hidden`);
      assert.deepEqual(off.surfaces.map((s) => toHex(s.colour)), [toHex(opaque.host)], `${state}: the host keeps its own fill`);
      assert.equal(toHex(off.label), toHex(opaque.label), `${state}: the opaque label`);
    }
  });
}

// THE BOUNDARY AND THE FOOT, in every state (0.32.1). The edge and the foot
// are the STATE's fill in shade, capped on paper like the resting edge, so a
// pale pressed fill (amber's, 1.1:1 on the light canvas) is found by its
// edge, and the foot never sits within ΔE 3 of the fill it stands under (it
// did on 0.32.0 in 90 cells, the resting edge under a darker state).
// The boundary is whichever of the edge and the fill (the pane, on glass)
// reads better against the ground, and it holds 3:1 on the canvas, a
// surface and a raised surface.
// KNOWN, AN OWNER CALL, NOT THIS PATCH: spexr's dark primary. Its edge
// (#3b3ecf at rest, its #4c58e9 fill one shade step down) reads 2.65 /
// 2.50 / 2.33:1 on the dark canvas, surface and raised surface, and the fill
// carries the boundary at rest (3.70 / 3.49 / 3.25); its white label's
// states darken toward the dark ground, so hovered and pressed neither does
// (0.32.0: 2.72 / 2.33 opaque, 2.63 / 2.33 glass). A lighter edge on ink
// would break "edges in shade", so its floors are pinned by name here.
const SPEXR_DARK_BOUNDARY = { opaque: { rest: 3, hover: 2.63, press: 2.13 }, glass: { rest: 2.83, hover: 2.34, press: 1.93 } };
const SHADE = (fill, theme) => `oklch(from ${fill} min(calc(l - 0.075), ${theme === "light" ? 0.59 : 1}) c h)`;

for (const wiring of Object.keys(WIRINGS)) for (const id of Object.keys(REGISTRY)) for (const theme of THEMES) {
  const mine = [...ALL, ...DANGER].filter((c) => c.wiring === wiring && c.id === id && c.theme === theme);
  test(`${wiring} / ${id} / ${theme}: hovered and pressed, the edge and the foot are the state's fill in shade`, () => {
    for (const c of mine.filter((c) => c.state !== "rest" || !c.danger)) {
      const want = toHex(evaluate(SHADE(`var(${{ rest: "--_sl-fill", hover: "--_sl-fill-hover", press: "--_sl-fill-active" }[c.state]})`, theme), c.env));
      assert.equal(toHex(c.edge), want, `${c.danger ? "danger " : ""}${c.context} ${c.state}: the edge`);
      if (c.foot) assert.equal(toHex(c.foot), want, `${c.danger ? "danger " : ""}${c.context} ${c.state}: the foot`);
    }
  });
  test(`${wiring} / ${id} / ${theme}: the boundary holds 3:1 on every ground, and the foot stands ΔE 3 off its fill, in every state`, () => {
    const low = [];
    for (const c of mine) {
      for (const [g, G] of Object.entries(c.grounds)) {
        const fill = Math.min(...c.surfaces.filter((s) => s.where === "fill" || s.where.startsWith(g)).map((s) => ratio(s.colour, G)));
        const b = Math.max(ratio(c.edge, G), fill);
        const kind = c.context.startsWith("glass") ? "glass" : "opaque";
        const floor = id === "spexr" && theme === "dark" && !c.danger ? SPEXR_DARK_BOUNDARY[kind][c.state] : 3;
        if (b < floor - 0.005) low.push(`${c.danger ? "danger " : ""}${c.context} ${c.state} on ${g}: ${b.toFixed(2)}`);
      }
      if (c.foot && dE(c.foot, c.host) < 3) low.push(`${c.danger ? "danger " : ""}${c.context} ${c.state}: foot ΔE ${dE(c.foot, c.host).toFixed(1)}`);
    }
    assert.deepEqual(low, []);
  });
  test(`${wiring} / ${id} / ${theme}: the tick, the dot and the knob read on a checked control's fill (4.5:1), at rest, hovered and pressed`, () => {
    const low = Object.entries(STATES).flatMap(([state, states]) => marks({ wiring, id, theme, states })
      .map((m) => [`${state} ${m.name}`, ratio(m.mark, m.fill)])).filter(([, r]) => r < 4.5).map(([n, r]) => `${n} ${r.toFixed(2)}`);
    assert.deepEqual(low, []);
  });
}

// ── the step, spelled out ───────────────────────────────────────────────────

// The danger tone's pattern, size included (0.32.1): 0.05 of oklch lightness
// hovered and 0.10 pressed, away from the label, along the line to the pole
// it moves toward, so it stays inside sRGB. Darkening keeps chroma in
// proportion to lightness (a linear-light dim: exactly in gamut); lightening
// eases chroma by (1 - step / (1 - l))^1.5, the least that keeps every sRGB
// colour inside the gamut (1.4 leaves it on the sRGB cube's surface). The
// colour tested is the colour Chrome paints: nothing is left for it to clip.
const SPELLED = (hex, d, lighter) => lighter
  ? `oklch(from ${hex} calc(l + ${d}) calc(c * pow(max(0, 1 - ${d} / (1 - l)), 1.5)) h)`
  : `oklch(from ${hex} calc(l - ${d}) calc(c * (l - ${d}) / l) h)`;

test("every step is the spelled-out lightness step from its own fill, inside sRGB", () => {
  for (const c of [...ALL, ...DANGER].filter((c) => c.context === "opaque" && c.state !== "rest")) {
    const rest = [...ALL, ...DANGER].find((r) => r.wiring === c.wiring && r.id === c.id && r.theme === c.theme && r.danger === c.danger && r.context === "opaque" && r.state === "rest");
    const want = evaluate(SPELLED(toHex(rest.host), c.state === "hover" ? 0.05 : 0.1, toOklch(rest.label)[0] < 0.5), new Map());
    assert.equal(toHex(c.host), toHex(want), `${key(c)}${c.danger ? " danger" : ""} ${c.state}`);
    const out = Math.max(0, -Math.min(...c.host.lin), Math.max(...c.host.lin) - 1);
    assert.ok(out < 1e-9, `${key(c)} ${c.state}: outside sRGB by ${out}`);
  }
  // spexr's registered fill, by name (it was #444ecf / #3a43b1 on 0.32.0)
  const spexr = ALL.filter((c) => c.wiring === "tier A" && c.id === "spexr" && c.context === "opaque");
  for (const theme of THEMES) assert.deepEqual(spexr.filter((c) => c.theme === theme).map((c) => toHex(c.host)), SPEXR_STEPS, theme);
});
const SPEXR_STEPS = ["#4c58e9", "#424ccd", "#3841b1"];

// ── the shade under a white label ───────────────────────────────────────────

const alphaOf = (c) => evaluate("var(--slfx-accent-t)", c.env).alpha;

test("the glass shade is zero under a dark label: the pane is the fill at 90%, as on 0.32.0", () => {
  for (const c of ALL.filter((c) => c.context.startsWith("glass") && toOklch(c.label)[0] < 0.5)) {
    assert.ok(Math.abs(alphaOf(c) - 0.9) < 1e-12, `${key(c)} ${c.context} ${c.state}: alpha ${alphaOf(c)}`);
  }
  // and it does bite where it was asked to: a white label on paper
  const spexr = ALL.find((c) => c.wiring === "tier A" && c.id === "spexr" && c.theme === "light" && c.context === "glass" && c.state === "rest");
  assert.ok(alphaOf(spexr) > 0.93, `spexr light: ${alphaOf(spexr)}`);
});

test("the glass shade is off in an opt-out region and on high contrast", () => {
  for (const wiring of ["tier A", "site subtree"]) for (const id of ["spexr", "local-agents"]) {
    const glass = measure({ wiring, id, theme: "light", context: "glass", state: "rest" });
    assert.ok(glass.env.has("--_slfx-shade"), `${wiring} ${id}: the pane declares its shade`);
    const off = measure({ wiring, id, theme: "light", context: "fx off", state: "rest" });
    assert.equal(off.env.has("--_slfx-shade"), false, `${wiring} ${id}: fx off declares no shade`);
    assert.ok(Math.abs(evaluate("var(--slfx-accent-t)", off.env).alpha - 0.9) < 1e-12, `${wiring} ${id}: fx off`);
    // high contrast's fill is yellow under a dark label, so the gate alone
    // would zero it: the declaration itself must be absent there
    const hc = measure({ wiring, id, theme: "high-contrast", context: "glass", state: "rest" });
    assert.equal(hc.env.has("--_slfx-shade"), false, `${wiring} ${id}: high contrast declares no shade`);
    assert.ok(Math.abs(evaluate("var(--slfx-accent-t)", hc.env).alpha - 0.9) < 1e-12, `${wiring} ${id}: high contrast`);
  }
});

// The light danger's white label already reads on its pane, so the shade
// leaves it, and the danger's own pane, at rest, is the 0.32.0 one exactly.
test("the danger primary's glass pane at rest is unchanged from 0.32.0", () => {
  const want = { light: ["#ae3e1b", "#af3f1d", "#af401d"], dark: ["#e6765a", "#e6765a", "#e7775b"] };
  for (const theme of THEMES) {
    const c = DANGER.find((c) => c.wiring === "tier A" && c.id === "default" && c.theme === theme && c.context === "glass" && c.state === "rest");
    assert.deepEqual(c.surfaces.filter((s) => /raw, stop 1$/.test(s.where)).map((s) => toHex(s.colour)), want[theme], theme);
  }
});
