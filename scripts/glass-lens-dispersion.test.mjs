import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = resolve(HERE, "../packages/ui-kit");
const { channelScales, PX_PER_DISPERSE } = await import(resolve(KIT, "glass-lens.js"));

/* The bend the box allows, which is what refresh() computes before it splits
   the channels: a sixth of the shorter side, never more than `reach`. */
const cappedFor = (shorter, reach = 18) => Math.min(reach, shorter / 6);

test("red is never displaced backwards, at any disperse on any box", () => {
  // The defect this guard exists for. `scale` on an feDisplacementMap takes a
  // negative, and a negative does not error — it moves the channel the OTHER
  // WAY. The model is glass-studio's IOR triple, N_R 0.98 / N_G 1.00 /
  // N_B 1.02: red bent LEAST. Red bent backwards is not that model at a lower
  // amplitude, it is a different optical claim, and it reads as a colour
  // fringe that leans the wrong side of every edge.
  for (const shorter of [16, 24, 32, 40, 44, 64, 65, 96, 139, 494]) {
    for (const disperse of [0, 18, 48, 90, 240]) {
      const { r, g, b } = channelScales(cappedFor(shorter), disperse);
      assert.ok(r >= 0, `red went backwards at ${shorter}px / disperse ${disperse}: ${r}`);
      assert.ok(r <= g && g <= b, `IOR order broken at ${shorter}px / disperse ${disperse}`);
    }
  }
});

test("a panel large enough for the full prism still gets all of it", () => {
  // The owner asked for sondalab.eu's prism — disperse 90, 21.6px of
  // red-to-blue — and the clamp must not quietly take it away where it fits.
  // .pillar and .prow are the surfaces it was measured on: large, capped at
  // reach's own 18, so 10.8 either side of centre stays non-negative.
  const { r, g, b } = channelScales(cappedFor(494), 90);
  assert.equal(+(b - r).toFixed(2), 21.6, "the site's prism, intact on a large panel");
  assert.equal(g, 18, "and the bend is still reach's own cap");
  assert.equal(+r.toFixed(2), 7.2);
});

test("a small host degrades to the widest prism it can hold, not to a broken one", () => {
  // A 40px button caps at 6.67, so the widest symmetric split it can carry
  // without sending red backwards is twice that. It is less prism than 90
  // asked for; it is the most prism the box has room for.
  const capped = cappedFor(40);
  const { r, g, b } = channelScales(capped, 90);
  assert.equal(r, 0, "red floors rather than inverting");
  assert.equal(+(b - r).toFixed(2), +(2 * capped).toFixed(2));
  assert.equal(g, capped, "and the bend itself is untouched by the clamp");
});

test("the clamp is inert wherever the prism already fitted", () => {
  // The fitted default and every value under it must come through unchanged,
  // or this is a re-fit of the material rather than a bound on a defect.
  for (const shorter of [40, 44, 96, 494]) {
    const capped = cappedFor(shorter);
    const { r, b } = channelScales(capped, 18);
    assert.equal(+(b - r).toFixed(2), 4.32, `disperse 18 is untouched at ${shorter}px`);
  }
});

test("disperse is still read as a pixel budget, not as a fraction of the bend", () => {
  // 0.24px of red-to-blue per unit is the constant the prism was fitted at on
  // lab/1t and lab/1v. It is exported so this figure lives in one place.
  assert.equal(PX_PER_DISPERSE, 0.24);
  const { r, b } = channelScales(18, 18);
  assert.equal(+(b - r).toFixed(2), +(18 * PX_PER_DISPERSE).toFixed(2));
});

test("the 90 default degrades silently on a small host, and that is what makes it safe", () => {
  // 90 is the default for every lensed surface, so the bound is not a safety
  // net for an unusual class — it is the thing that lets the default exist at
  // all. A 37px field asks for 21.6px of prism and cannot hold it; what it
  // must never do is take the shortfall out of the red channel's direction.
  const asked = 90 * PX_PER_DISPERSE;
  for (const shorter of [32, 40, 44, 64]) {
    const capped = cappedFor(shorter);
    const { r, b } = channelScales(capped, 90);
    assert.ok(b - r < asked, `the 90 default should not deliver its full prism at ${shorter}px`);
    assert.equal(r, 0, "and what it costs is the red channel's own displacement, floored");
  }
  // 64.8px is where a box first has room for the whole 21.6 — the boundary
  // between a host that gets the prism it asked for and one that is bounded.
  const { r, b } = channelScales(cappedFor(64.8), 90);
  assert.equal(+(b - r).toFixed(2), 21.6, "and at 64.8px it fits exactly, red landing on zero");
  assert.equal(r, 0);
});
