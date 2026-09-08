/* @sondalab/ui-kit — effects-shader.js
   The WGSL for the Tier 2 material, as an inline template string. No bundler
   plugin: @vgpu/wgsl has a Vite loader, but a template string keeps every
   consumer's build config untouched — the same call sondalab-site made.

   WHAT THIS DRAWS — two different phenomena, not two temperaments of one.

   GLASS is a shaded metal bezel ON the element's boundary: a signed distance
   field of its rounded rectangle gives the edge, the outward in-plane normal
   dotted with a fixed key light gives the brightness AROUND the ring, and a
   shallow profile gives the relief ACROSS it. Reflective, specular, dispersive.

   AURORA is emissive light AROUND the boundary: broad coloured ribbons running
   along the perimeter, blurred perpendicular to it, bleeding tens of pixels
   outside the element and drifting on their own clock. Additive, not
   reflective — no bezel, no specular, no environment. It is aurora borealis,
   which is why it is soft, coloured and moving where the metal is hard, silver
   and still.

   An element carrying both classes shows both: the bezel with the light around
   it. Under Tier 0/1 they necessarily share one conic ring, because a single
   pseudo-element is all CSS gives; that is a limit of the medium, not a claim
   that they are the same thing. Do not re-unify them here.

   Every colour arrives as a uniform read from a design token. Nothing is
   hardcoded; scripts/effects-gpu.test.mjs enforces that. */

export const SHADER = `
// Fragment stage only. \`vgpu.effect()\` supplies the full-screen vertex stage —
// the same arrangement sondalab-site's CRT surface uses. Its generated uv is
// (0,0) at the top-left and (1,1) at the bottom-right, so +y points DOWN the
// page: every "up" below is therefore a negative y.
struct Look {
  accent   : vec4f,   // --sl-accent-default
  depth    : vec4f,   // --sl-accent-depth
  sheen    : vec4f,   // --sl-text-primary
  ground   : vec4f,   // --sl-bg-canvas
  // x: 1 when motion is allowed, 0 under prefers-reduced-motion. The metal
  // still renders at 0 — it is material, not motion; the aurora still glows,
  // but stops drifting, and the pointer stops bending the field.
  flags    : vec4f,
  res      : vec2f,   // viewport, CSS pixels
  time     : f32,
  rectCount: f32,
};
@group(0) @binding(0) var<uniform> look : Look;
// x, y, w, h in normalised viewport space, one per registered element
@group(0) @binding(1) var<uniform> rects : array<vec4f, 16>;
// pointer position and velocity, normalised
@group(0) @binding(2) var<uniform> pointer : vec4f;
// x: corner radius in CSS pixels, read from the element's own border-radius
// y: bend strength — how far the pointer pulls this element's field
// z: metal — 1 when the element carries .sl-fx-glass, 0 otherwise
// w: wake amount — the liquid sheen inside the element, 0 when it has none
@group(0) @binding(3) var<uniform> params : array<vec4f, 16>;
// The aurora, which is a SEPARATE phenomenon from the metal and can sit on the
// same element at the same time:
// x: 0 none · 1 lit (focus or the ambient sweep) · 2 busy
// y: the fraction of the perimeter it occupies — for a determinate aurora this
//    IS the value, so the glow stays angularly bounded however soft it gets
// z: angular drift, radians per second; 0 for a focus ring and for determinate
// w: reserved
@group(0) @binding(4) var<uniform> glow : array<vec4f, 16>;

// ── tuning ──────────────────────────────────────────────────────────────────
// Every one of these was moved against the rendered showcase, not derived.
//
// The band's half-width SCALES with the element rather than being one global
// constant. A single width cannot serve both: the same absolute bezel that
// reads correctly on a 40px control reads as a heavy stamped edge on a
// full-width card. It grows sub-linearly and clamps at both ends, so a keycap
// keeps a proportionally visible bezel and a card gets a fine one.
const BAND_K  : f32 = 0.16;  // half-width as a fraction of the element's short half
const BAND_MIN: f32 = 0.85;  // CSS px
const BAND_MAX: f32 = 1.70;  // CSS px
// How much stamped relief the bezel carries across its width: 0 is an even
// bright bezel, 1 is the full dark-lip/bright-core emboss. Named so it can be
// moved without going through the shading maths.
const RELIEF  : f32 = 0.30;

const AA    : f32 = 0.55;  // coverage feather either side of the band, CSS px
const BLOOM : f32 = 9.0;   // outward falloff of the metal's own spill, CSS px
const GRAD_E: f32 = 1.0;   // central-difference step for the field gradient, CSS px
const AMBIENT: f32 = 0.03; // floor, so the unlit side is dark metal not a hole
const DISP  : f32 = 0.20;  // per-channel angular displacement, radians
const DISP_T: f32 = 0.30;  // per-channel displacement ACROSS the band, in t
const KEY_TIGHT: f32 = 1.9;// how decisively the lit arc falls off around the ring
const CORE_T: f32 = 0.06;  // where the bright core sits across the band
const CORE_W: f32 = 0.56;  // how wide that core is
const SPEC_P: f32 = 26.0;  // how tight the accent kiss at the arc's peak is
const SPEC_G: f32 = 1.10;  // gain of that kiss

// The aurora. Wide on purpose: this has to read as light in the air around the
// edge, not as an outline on it.
const GLOW_OUT: f32 = 30.0;  // outward falloff, CSS px — the visible reach is
                             // several times this through the exponential tail
const GLOW_IN : f32 = 7.0;   // inward falloff — the interior is not washed
const GLOW_LIT: f32 = 0.85;  // gain for focus and the ambient sweep
const GLOW_BUSY: f32 = 1.05; // gain while real work runs
const GLOW_A  : f32 = 0.85;  // how much of the accumulated light becomes alpha

const TAU : f32 = 6.2831853;
// Where an arc begins, in atan2 terms. effects.css starts its conic gradient at
// 210deg, measured clockwise from straight up; atan2 measures from the +x axis
// with y pointing down, so the same place is 210deg - 90deg. Matching it means
// a determinate arc covers the same sweep at Tier 1 and Tier 2 and the two
// never disagree about where 62% starts.
const ARC_START : f32 = 2.0944;

// The key light, in page space, as an in-plane direction. uv y points DOWN, so
// a negative y is above: this light is up and to the left, which is where the
// reference's arc sits and where a reader expects a light to be.
const KEY_DIR : vec2f = vec2f(-0.6157, -0.7880);

// ── geometry ────────────────────────────────────────────────────────────────

fn sdRoundBox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

// The cursor bends the ring: the field is pulled toward the pointer, so the
// edge dents rather than the element moving. Falloff is exponential, so the
// dent is local and the rest of the ring stays exactly where the component put
// it. Under reduced motion the pull is zero and the ring is the plain SDF.
fn bendField(d: f32, p: vec2f, strength: f32) -> f32 {
  let ptr = pointer.xy * look.res;
  let pull = exp(-distance(p, ptr) / 30.0) * strength * look.flags.x;
  return d + pull * 4.5;
}

fn halfOf(i: u32) -> vec2f { return rects[i].zw * look.res * 0.5; }
fn centreOf(i: u32) -> vec2f { return rects[i].xy * look.res + halfOf(i); }

fn edgeAt(i: u32, p: vec2f) -> f32 {
  let half = halfOf(i);
  let rad = clamp(params[i].x, 0.0, min(half.x, half.y));
  return bendField(sdRoundBox(p - centreOf(i), half, rad), p, params[i].y);
}

/** The bezel's half-width for this element, in CSS pixels. */
fn bandOf(i: u32) -> f32 {
  let half = halfOf(i);
  return clamp(min(half.x, half.y) * BAND_K, BAND_MIN, BAND_MAX);
}

// ── the metal ───────────────────────────────────────────────────────────────

fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

/** The same colour rescaled to a target luminance, hue intact.
 *  The parameter is \`want\`, not \`target\`: \`target\` is a reserved keyword in
 *  WGSL and the module fails to compile with it. */
fn atLuma(c: vec3f, want: f32) -> vec3f {
  return clamp(c * (want / max(luma(c), 0.001)), vec3f(0.0), vec3f(1.0));
}

// Which token is the brighter of the pair is decided at runtime from their own
// luminance, never assumed: on canvas the text token is the bright one, on an
// inversion band it is the ground token.
fn brightToken() -> vec3f {
  return select(look.ground.rgb, look.sheen.rgb, luma(look.sheen.rgb) > luma(look.ground.rgb));
}
fn darkToken() -> vec3f {
  return select(look.sheen.rgb, look.ground.rgb, luma(look.sheen.rgb) > luma(look.ground.rgb));
}

/** 0 on ink, 1 on paper. Drives where the metal's two ends are placed. */
fn paperness() -> f32 { return smoothstep(0.42, 0.88, luma(look.ground.rgb)); }

// The metal's two ends are placed AROUND the page's own ground rather than
// taken from the token pair directly. Reusing one pair for both themes is what
// left the light theme with a dirty dark smear along its edges: on paper the
// darker token is near-black, and a near-black trough on a light page reads as
// dirt, not as an unlit bezel.
fn poleHi() -> vec3f {
  // On ink the bright end is the theme's own brightest neutral. On paper it has
  // to go ABOVE the page, or the lit half of the bezel cannot be lighter than
  // the paper it lies on — so the ground's own hue is pushed up in luminance,
  // which keeps the page's warmth instead of bleaching it.
  return mix(brightToken(), atLuma(look.ground.rgb, 0.97), paperness());
}
fn poleLo() -> vec3f {
  // On ink the unlit end may go deep: the page is already dark, so a deep
  // trough reads as an absence of light, which is what it is.
  //
  // On paper it must not go dark AT ALL — and a mid tone is not enough either.
  // Simulating a symmetric environment is the mistake: a metal reflecting one
  // has a dark half, and a dark half on a light page reads as dirt however far
  // it is lifted. So on paper the bright pole carries the whole contrast and
  // the unlit end sits at the page's own value, fading INTO the ground rather
  // than away from it. Squint at it: a bright edge that fades out is right; a
  // dark edge that brightens in one place is the failure.
  let ink = mix(look.ground.rgb, brightToken(), 0.09);
  let paper = look.ground.rgb * 0.97;
  return mix(ink, paper, paperness());
}

/**
 * How much of the bezel's coverage survives where it is not lit.
 *
 * On ink, all of it: the dark trough is a real feature of the material there.
 * On paper the unlit band goes transparent instead, so it disappears against
 * whatever is actually behind it — a card surface, an inversion band, an image
 * — rather than painting the canvas's colour over something that is not the
 * canvas. Fading into the ground only works if it is the ground you fade into.
 */
fn opacityFor(v: f32) -> f32 {
  return mix(1.0, smoothstep(0.015, 0.34, v), paperness());
}

/** A soft-edged strip centred on \`centre\`, \`width\` wide. */
fn slab(x: f32, centre: f32, width: f32) -> f32 {
  return 1.0 - smoothstep(0.0, width, abs(x - centre));
}

/** Rotate an in-plane direction. Used by the dispersion, which displaces the
 *  shading's ANGULAR position per channel rather than its colour. */
fn spin(v: vec2f, a: f32) -> vec2f {
  let c = cos(a);
  let s = sin(a);
  return vec2f(v.x * c - v.y * s, v.x * s + v.y * c);
}

/**
 * How brightly one facet of the bezel is lit — a scalar, not a colour.
 *
 * Two separable terms, and the first is the one that matters.
 *
 * AROUND the ring: the outward in-plane normal g dotted with a fixed key light.
 * This is what makes it a LIT ring rather than a coloured one — bright where
 * the ring faces the light, falling to the ambient floor where it faces away.
 * A ring that is equally bright the whole way round cannot be metal, and no
 * amount of hue fixes that.
 *
 * ACROSS the band: the bezel's relief, blended by RELIEF between an even bright
 * bezel and a stamped profile (dark inner lip where the band meets the
 * element's own fill, bright core just outside centre, falloff to the outer
 * rim). Full relief reads as a heavy stamped edge on anything larger than a
 * control, which is why the amount is a named constant rather than baked in.
 *
 * Deliberately NOT a Lambert term on the full 3D torus normal. That was tried:
 * because the cross-section sweeps a half-turn of directions at every point of
 * the perimeter, some sliver of the band faces the light everywhere, so the
 * ring never actually goes dark — it comes out uniformly lit, which is exactly
 * the failure this function exists to avoid.
 *
 * Achromatic on purpose. The metal is silver; the product's hue rides the
 * specular kiss, and the aurora is a different phenomenon entirely.
 */
fn litness(g: vec2f, t: f32) -> f32 {
  let around = pow(clamp(0.5 + 0.5 * dot(g, KEY_DIR), 0.0, 1.0), KEY_TIGHT);
  let even = 1.0 - smoothstep(0.45, 1.0, abs(t));
  let lip = smoothstep(-1.0, -0.32, t);
  let core = slab(t, CORE_T, CORE_W);
  let fall = 1.0 - smoothstep(0.30, 1.0, t);
  let stamped = lip * (0.22 * fall + 0.86 * core);
  let across = mix(even * 0.80, stamped, RELIEF);
  return AMBIENT + around * across;
}

/** The tight bright flash at the peak of the lit arc, where the accent lands. */
fn kissAt(g: vec2f, t: f32) -> f32 {
  let around = clamp(0.5 + 0.5 * dot(g, KEY_DIR), 0.0, 1.0);
  return pow(around, SPEC_P) * slab(t, CORE_T, 0.42);
}

// ── the aurora ──────────────────────────────────────────────────────────────

/**
 * Ribbon structure along the perimeter. Three octaves, each drifting on its own
 * clock, so the light is uneven and moves — that unevenness is what separates
 * an aurora from a halo. Every frequency is an integer so the sum is continuous
 * across atan2's wrap at ±pi.
 */
fn ribbon(a: f32, t: f32) -> f32 {
  let o1 = sin(a * 5.0 + t * 1.10);
  let o2 = sin(a * 11.0 - t * 0.80 + 1.7);
  let o3 = sin(a * 19.0 + t * 1.70 + 4.1);
  // Deliberately high amplitude, and clamped: the troughs bottom out at zero
  // and the peaks saturate, so the light breaks into distinct bands instead of
  // modulating a smooth wash. That unevenness is the single thing that makes it
  // read as an aurora rather than as a glow, so it is not a subtle term.
  return clamp(0.30 + 0.46 * o1 + 0.24 * o2 + 0.13 * o3, 0.0, 1.0);
}

/**
 * The arc the aurora occupies, as a mask on the perimeter angle.
 *
 * BOUNDED, however soft the light gets. A determinate aurora's arc LENGTH is
 * its value, so a glow that faded out without ends would make a 62% operation
 * unreadable. The ends are feathered by a fraction of the span, never by a
 * fixed amount, so a short arc keeps hard-enough ends to be measured and a long
 * one still reads as light rather than as a stroke.
 */
fn arcMask(a: f32, start: f32, span: f32, far: f32) -> f32 {
  if (span >= TAU - 0.001) { return 1.0; }
  var x = a - start;
  x = x - TAU * floor(x / TAU);
  // The ends widen with distance from the edge. Without that the angular
  // bound stays a hard radial line however far out the light goes, and the
  // arc reads as a searchlight wedge instead of light hugging the perimeter.
  // Capped below half the span, so even a short determinate arc keeps ends.
  let fade = min(min(0.30, span * 0.30) * (1.0 + far * 1.8), span * 0.48);
  return smoothstep(0.0, fade, x) * (1.0 - smoothstep(span - fade, span, x));
}

/**
 * One element's contribution to the aurora, as premultiplied light.
 * Returns rgb * amount in xyz and the amount in w, so several elements can be
 * summed: this is emissive light, and light adds.
 */
fn auroraAt(i: u32, p: vec2f, d: f32) -> vec4f {
  let q = glow[i];
  let busy = step(1.5, q.x);

  // Angular position around the element. atan2 about the centre is exactly
  // what the CSS tier's conic-gradient uses, so a determinate arc covers the
  // same sweep at both tiers and the two never disagree about what 62% is.
  let c = centreOf(i);
  let a = atan2(p.y - c.y, p.x - c.x);

  // Under reduced motion a rotating arc becomes a full static ring at lower
  // intensity — the same answer effects.css gives — while a determinate arc
  // (which never rotates) keeps its length, because its length is the value.
  let rotates = step(0.0001, q.z);
  let motion = look.flags.x;
  let span = clamp(mix(mix(q.y, 1.0, rotates), q.y, motion), 0.02, 1.0) * TAU;
  let start = ARC_START + look.time * q.z * motion;

  // Across the edge: blurred perpendicular to it, and reaching much further
  // outward than inward. This is light in the air, not a stroke on the box.
  //
  // One exponent, not max() of two. The two terms are mutually exclusive — only
  // one of them is non-zero for a given sign of d — and combining them with
  // max() was a real defect: outside the element the inward term was exp(0),
  // and INSIDE it the outward term was exp(0), so the glow flooded the whole
  // interior of every aurora element at full strength instead of hugging its
  // edge. Both peak at exactly 1 at d = 0, so the sum is continuous there.
  let across = exp(-max(d, 0.0) / GLOW_OUT - max(-d, 0.0) / GLOW_IN);

  let far = clamp(max(d, 0.0) / GLOW_OUT, 0.0, 1.0);
  // The ribbon is sheared by distance from the edge, not read at a constant
  // angle: a pure function of the angle is constant along every ray out of the
  // centre, so the bands come out as a starburst of straight spokes. Shearing
  // makes them lean as they travel, which is what a curtain of light does.
  let rib = mix(0.78, ribbon(a + far * 0.9, look.time), motion);
  let gain = mix(GLOW_LIT, GLOW_BUSY, busy) * mix(0.62, 1.0, motion);
  let amt = across * arcMask(a, start, span, far) * rib * gain;

  // A real aurora runs one hue into another across its depth — green into
  // violet. Here the accent sits against the element's edge and gives way
  // completely to its depth companion by the outer reach, across the whole
  // width of the light rather than as a tint on top of it.
  let travel = clamp((d + GLOW_IN) / (GLOW_OUT * 0.62 + GLOW_IN), 0.0, 1.0);
  let hue = mix(look.accent.rgb, look.depth.rgb, travel);
  return vec4f(hue * amt, amt);
}

// ── the liquid wake, unchanged in intent from the field this tier began as ──
// Normalised space, not pixels: its constants were tuned against uv and the
// pointer uniform is normalised too.
fn wake(p: vec2f, t: f32) -> f32 {
  let d = distance(p, pointer.xy);
  let pull = exp(-d * 6.0) * (0.6 + 0.4 * length(pointer.zw));
  let ripple = sin(d * 34.0 - t * 3.4) * exp(-d * 4.5);
  return clamp(pull + ripple * 0.35, 0.0, 1.0);
}

/** Source-over of a premultiplied-free (colour, alpha) pair onto another. */
fn over(topC: vec3f, topA: f32, botC: vec3f, botA: f32) -> vec4f {
  let a = topA + botA * (1.0 - topA);
  if (a <= 0.0) { return vec4f(0.0); }
  return vec4f((topC * topA + botC * botA * (1.0 - topA)) / a, a);
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = uv * look.res;
  let n = u32(look.rectCount);

  // One pass over the elements. The metal keeps only the NEAREST edge, because
  // a bezel is a surface and two of them cannot occupy the same pixel; the
  // aurora ACCUMULATES across every element, because it is light and light
  // adds. That difference is the clearest statement in this file that they are
  // two phenomena and not two settings of one.
  var best = 1.0e9;
  var hit = 0u;
  var wakeAmt = 0.0;
  var gSum = vec3f(0.0);
  var gAmt = 0.0;
  for (var i = 0u; i < n; i = i + 1u) {
    let d = edgeAt(i, p);
    if (params[i].z > 0.5 && abs(d) < abs(best)) { best = d; hit = i; }
    if (glow[i].x > 0.5 && d < GLOW_OUT * 3.0 && d > -GLOW_IN * 4.0) {
      let g4 = auroraAt(i, p, d);
      gSum = gSum + g4.xyz;
      gAmt = gAmt + g4.w;
    }
    let w = params[i].w;
    if (w > 0.0 && d < 0.0) {
      // Faded out under the band itself: smoothstep's edges must be given
      // low-to-high or the result is undefined, so the fade is written as the
      // complement rather than as a reversed pair.
      wakeAmt = max(wakeAmt, w * wake(uv, look.time) * (1.0 - smoothstep(-3.0, 0.0, d)));
    }
  }

  // ── bottom layer: the liquid sheen ────────────────────────────────────────
  var col = vec3f(0.0);
  var alpha = 0.0;
  if (wakeAmt > 0.0) {
    col = mix(poleHi(), look.accent.rgb, 0.22);
    alpha = wakeAmt * 0.30;
  }

  // ── middle layer: the aurora ──────────────────────────────────────────────
  if (gAmt > 0.0) {
    let lit = over(gSum / gAmt, clamp(gAmt * GLOW_A, 0.0, 1.0), col, alpha);
    col = lit.xyz;
    alpha = lit.w;
  }

  // ── top layer: the metal bezel ────────────────────────────────────────────
  let band = bandOf(hit);
  if (params[hit].z > 0.5 && n > 0u && best < band + BLOOM && best > -(band + 1.0)) {
    // Central differences on the bent field. The analytic gradient of a
    // rounded box would miss the pointer's dent entirely, which is the whole
    // reason the dent is visible on the normal and not only on the silhouette.
    let gx = edgeAt(hit, p + vec2f(GRAD_E, 0.0)) - edgeAt(hit, p - vec2f(GRAD_E, 0.0));
    let gy = edgeAt(hit, p + vec2f(0.0, GRAD_E)) - edgeAt(hit, p - vec2f(0.0, GRAD_E));
    let g = normalize(vec2f(gx, gy) + vec2f(1.0e-6, 0.0));

    // s is the facet's position ACROSS the band: -1 inner rim, +1 outer rim.
    let s = clamp(best / band, -1.0, 1.0);

    // Chromatic dispersion. Not three tints of one colour: the same SHADING is
    // evaluated three times, one per channel, at slightly different positions
    // both around the ring and across the band, so the channels disagree about
    // where the lit arc begins and ends and about where its bright core sits.
    // That is what a real dispersive reflection does, and it is why the
    // fringing appears on the arc's flanks and at the corners — where the
    // gradient is steepest — rather than everywhere at once.
    let vR = litness(spin(g, -DISP), s - DISP_T);
    let vG = litness(g, s);
    let vB = litness(spin(g, DISP), s + DISP_T);
    let lo = poleLo();
    let hi = poleHi();
    var m = vec3f(
      mix(lo, hi, clamp(vR, 0.0, 1.0)).r,
      mix(lo, hi, clamp(vG, 0.0, 1.0)).g,
      mix(lo, hi, clamp(vB, 0.0, 1.0)).b,
    );

    // The specular kiss, and the one place the product's hue touches the metal.
    // The reference's ring is silver with a coloured flash at the highlight,
    // not a coloured ring: a flat tint over the whole band is what makes a
    // shader read as a neon outline.
    let spec = kissAt(g, s);
    let kiss = mix(look.depth.rgb, look.accent.rgb, 0.5 + 0.5 * g.x);
    m = m + mix(hi, kiss, 0.72) * spec * SPEC_G;

    // Coverage, plus a narrow spill outside the band driven by how brightly
    // THIS part of the ring is lit — light bleeds off a bright arc and off
    // nothing else. The aurora's own reach is a separate, much wider thing.
    let cover = (1.0 - smoothstep(band - AA, band + AA, abs(best))) * opacityFor(vG);
    let arcLit = litness(g, CORE_T);
    let spill = exp(-max(best - band, 0.0) / BLOOM) * step(band, best)
              * clamp(arcLit * 0.75 + spec * 0.55, 0.0, 1.0);
    let out = over(m, clamp(cover + spill, 0.0, 1.0), col, alpha);
    col = out.xyz;
    alpha = out.w;
  }

  if (alpha <= 0.0) { return vec4f(0.0); }
  // Premultiplied: the surface is configured "premultiplied" and the effect
  // writes the colour target directly, with no blend state of its own.
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)) * alpha, alpha);
}
`;
