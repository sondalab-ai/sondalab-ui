/* @sondalab/ui-kit — effects-shader.js
   The WGSL for the Tier 2 metal, as an inline template string. No bundler
   plugin: a template string keeps every consumer's build config untouched.

   WHAT THIS DRAWS — the glass family only. One thing, at the scale of the
   reference (libraries.dev/metal): a CHROME HAIRLINE exactly on the element's
   own border, a wandering HALO of soft light outside it, a bright CURSOR
   REFLECTION where the pointer is (on a glass pane, wider and dispersed into
   colour at its ends), and — on liquid elements — the same SWELL
   the liquid's skin gives the silhouette, so the ring follows the surface
   instead of sitting rigid around a deforming shape.

   The aurora is NOT drawn here. It is light, and it is CSS at every tier
   (effects.css, the border-beam recipe). The liquid's swell is not drawn
   here either — effects.js draws it as a gooey skin under the content; this
   shader only agrees with it about the shape of the silhouette.

   THE LOOK. Chrome is not a lit bevel. A bevel has a light side and a dark
   side; chrome has a mirror's environment sliding along it — bright and dark
   bands at high contrast, with pastel flecks of colour where the environment
   is coloured, changing as the environment moves. So the hairline is a thin
   band filled from a moving one-dimensional "plasma" (bands of sines warped by
   each other, mapped through a five-stop palette, gamma-punched), the way the
   reference fills its ring from a WebGL environment texture. A directional key
   light and a thin dark outer rim are the only shading on top of it; both are
   subtle multipliers, never the structure.

   Every colour arrives as a uniform read from a design token. Nothing is
   hardcoded; scripts/effects-gpu.test.mjs enforces that. */

export const SHADER = `
// Fragment stage only. \`vgpu.effect()\` supplies the full-screen vertex stage.
// Its generated uv is (0,0) at the top-left and (1,1) at the bottom-right, so
// +y points DOWN the page.
struct Look {
  accent   : vec4f,   // --sl-accent-default
  depth    : vec4f,   // --sl-accent-depth
  sheen    : vec4f,   // --sl-text-primary
  ground   : vec4f,   // --sl-bg-canvas
  // x: 1 when motion is allowed, 0 under prefers-reduced-motion. The chrome
  // still renders at 0 — it is material, not motion — but its environment
  // stops sliding, the halo stops wandering and the liquid stops swelling.
  flags    : vec4f,
  res      : vec2f,   // viewport, CSS pixels
  time     : f32,
  rectCount: f32,
};
@group(0) @binding(0) var<uniform> look : Look;
// x, y, w, h in normalised viewport space, one per registered element
@group(0) @binding(1) var<uniform> rects : array<vec4f, 16>;
// xy: pointer position, normalised; z: 1 while the pointer is on the page
@group(0) @binding(2) var<uniform> pointer : vec4f;
// x: corner radius in CSS pixels, read from the element's own border-radius
// y: hairline width in CSS pixels, read from the element's own border width
// z: the liquid's smooth-union radius in CSS pixels — the width of the neck
//    the goo filter welds between the box and its drop (effects.js, GOO_BLEND)
// w: the liquid's drop radius in CSS pixels; 0 on every element the pointer
//    is not currently shaping, and while the drop is still inside the box
@group(0) @binding(3) var<uniform> params : array<vec4f, 16>;
// xy: the centre of the liquid's drop, normalised — the LAGGED point
// effects.js places the drop at, which trails the pointer; the silhouette has
// to be welded about the same point or the ring and the skin disagree.
@group(0) @binding(4) var<uniform> drop : vec4f;
// x: 1 when the element carries the chrome; 0 when it is only a surface the
// chrome's environment falls onto — every registered element is one.
// y: 1 on a glass PANE (effects.css, .sl-fx-glass--pane): the cursor's
//    reflection reaches further and disperses into colour at its ends.
@group(0) @binding(5) var<uniform> kinds : array<vec4f, 16>;

// ── tuning ──────────────────────────────────────────────────────────────────
// Every one of these was moved against the rendered showcase beside the
// reference, not derived.
const AA        : f32 = 0.60;  // coverage feather either side of the hairline
const RIM_PAD   : f32 = 0.30;  // how far past the element's own border the chrome reaches
const KEY_GAIN  : f32 = 0.26;  // directional key light, as a fraction of brightness
const OUTER_DIM : f32 = 0.28;  // how much darker the outer half of the band is
const CONTRAST  : f32 = 1.30;  // gamma punch on the environment, as the reference
const FLECK     : f32 = 0.38;  // how coloured the pastel stops are (0 silver, 1 accent)
const ENV_BIAS  : f32 = 0.0;   // shifts the environment along the palette

const ENV_RATE  : f32 = 0.55;  // how fast the environment slides along the ring
const ENV_SCALE : f32 = 0.009; // spatial frequency of the environment, per CSS px

const HALO_REACH: f32 = 14.0;  // outward falloff of the halo, CSS px
const HALO_SIZE : f32 = 30.0;  // radius of the halo along the edge, CSS px
const HALO_GAIN : f32 = 0.30;  // peak alpha of the halo
const HALO_WANDER: f32 = 0.22; // radians per second the halo drifts around the ring

const CUR_REACH : f32 = 34.0;  // radius of the cursor's reflection, CSS px
const CUR_GAIN  : f32 = 0.85;  // how far toward the bright pole it pushes the chrome

// On a pane the cursor's reflection is the glass answering the hand: wider
// (the reference's cursor "spill" is 48px), a little stronger, and DISPERSED —
// red and blue sample the environment either side of green, by an angle that
// grows with the cursor's presence. That is the reference's shiftRed /
// shiftBlue (0.3, 0.75 in its chromatic preset), the one colour-separation
// knob its material has, and it is what refraction looks like on an edge:
// the hot spot fringes into colour at its ends. Only on the hairline, only
// near the cursor; the content under the ring is never touched.
const PANE_REACH: f32 = 48.0;  // radius of the reflection on a pane, CSS px
const PANE_GAIN : f32 = 0.95;
const DISPERSE  : f32 = 0.45;  // channel split at the cursor, radians of perimeter angle

// Reflections on neighbours: the chrome's environment falling onto the
// near edge of another element, the way the reference reflects its ring
// onto the controls beside it. Reaches only across a small gap, and fades
// into the neighbour so its text is never sat on.
const REF_GAP   : f32 = 14.0;  // how far the light carries across the gap, CSS px
const REF_DEPTH : f32 = 12.0;  // how far it falls into the neighbour, CSS px
const REF_GAIN  : f32 = 0.34;  // peak alpha, at zero gap on the neighbour's edge

// The key light, in page space. uv y points DOWN, so negative y is above:
// this light is up and to the left, where a reader expects one.
const KEY_DIR : vec2f = vec2f(-0.6157, -0.7880);

// ── geometry ────────────────────────────────────────────────────────────────

fn sdRoundBox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

fn halfOf(i: u32) -> vec2f { return rects[i].zw * look.res * 0.5; }
fn centreOf(i: u32) -> vec2f { return rects[i].xy * look.res + halfOf(i); }

/**
 * The smooth minimum of two distances: the union of two shapes with a
 * rounded neck where they meet, \`k\` wide. This is what the goo filter in
 * effects.js does to the same box and drop — a blur then an alpha slope
 * welds two touching pieces with a fillet about as wide as the blur — and
 * GOO_BLEND there is the k that matches it. Outside the neck it is an exact
 * min, so an element without a live drop is its own rounded box.
 */
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/**
 * Signed distance to element i's edge, through its swell: the rounded box
 * the element declared, welded to the liquid's drop while one is live. The
 * drop is the circle the skin draws, at the point the skin places it, so
 * the chrome and the skin describe one silhouette. Anything that changes
 * here must change in effects.js's skin too, or the two disagree about
 * where the edge is.
 */
fn edgeAt(i: u32, p: vec2f) -> f32 {
  let half = halfOf(i);
  let rad = clamp(params[i].x, 0.0, min(half.x, half.y));
  let box = sdRoundBox(p - centreOf(i), half, rad);
  let r = params[i].w * look.flags.x;
  if (r <= 0.0) { return box; }
  let blob = length(p - drop.xy * look.res) - r;
  return smin(box, blob, max(params[i].z, 0.001));
}

/** The chrome's half-width for element i, in CSS px: half its own border
 *  (a borderless element gets a 1px line), plus a hair so the chrome covers
 *  the border's own antialiasing instead of leaving a dark seam. */
fn halfWidthOf(i: u32) -> f32 {
  return max(params[i].y, 1.0) * 0.5 + RIM_PAD;
}

// ── colour ──────────────────────────────────────────────────────────────────

fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }

/** The same colour rescaled to a target luminance, hue intact.
 *  The parameter is \`want\`: \`target\` is a reserved keyword in WGSL. */
fn atLuma(c: vec3f, want: f32) -> vec3f {
  return clamp(c * (want / max(luma(c), 0.001)), vec3f(0.0), vec3f(1.0));
}

// Which token is the brighter of the pair is decided at runtime from their
// own luminance, never assumed: in the dark theme the text token is the
// bright one, in the light theme the ground is. Both are page-level uniforms
// read once from <html>; an inversion band inside the page is not seen here
// (the same page values are used on it), which is why the poles are placed
// around the ground rather than taken from the pair directly.
fn brightToken() -> vec3f {
  return select(look.ground.rgb, look.sheen.rgb, luma(look.sheen.rgb) > luma(look.ground.rgb));
}
fn darkToken() -> vec3f {
  return select(look.sheen.rgb, look.ground.rgb, luma(look.sheen.rgb) > luma(look.ground.rgb));
}

/** 0 on ink, 1 on paper. */
fn paperness() -> f32 { return smoothstep(0.42, 0.88, luma(look.ground.rgb)); }

// The chrome's two poles are placed around the page's own ground. On ink the
// bright pole is the theme's brightest neutral and the dark pole is near the
// page. On paper the bright pole goes ABOVE the page — a highlight has to be
// lighter than what it lies on — carrying the page's own hue rather than
// bleaching to white, and the dark pole is a mid grey, never near-black: a
// black trough on a light page reads as dirt, not as chrome. (The reference's
// own light preset is white and mid-grey, not white and black.)
fn poleHi() -> vec3f {
  return mix(brightToken(), atLuma(look.ground.rgb, 0.985), paperness());
}
fn poleLo() -> vec3f {
  // Not the page itself: a trough at the page's own value is a gap in the
  // ring, and a ring with gaps reads as dashed. Dim silver, distinguishable.
  let ink = mix(look.ground.rgb, brightToken(), 0.20);
  let paper = atLuma(look.ground.rgb, 0.60);
  return mix(ink, paper, paperness());
}

/**
 * Five-stop palette, the reference's shape: Gaussian weights around
 * t = 0, .25, .5, .75, 1 with k = 64, so the stops are sharp and a slow
 * traverse of t reads as bands rather than a wash. The stops are
 *   dark · pastel accent · bright · pastel depth · dark
 * so the ring is silver where the environment is calm, goes dark in bands,
 * and the product's hue appears as flecks on the way between — never as a
 * tint over the whole ring.
 */
fn palette(t0: f32) -> vec3f {
  let t = clamp(t0, 0.0, 1.0);
  let lo = poleLo();
  let hi = poleHi();
  let c3 = mix(hi, look.accent.rgb, FLECK);
  let c5 = mix(hi, look.depth.rgb, FLECK);
  let k = 64.0;
  let w1 = exp(-k * t * t);
  let w2 = exp(-k * (t - 0.25) * (t - 0.25));
  let w3 = exp(-k * (t - 0.5) * (t - 0.5));
  let w4 = exp(-k * (t - 0.75) * (t - 0.75));
  let w5 = exp(-k * (t - 1.0) * (t - 1.0));
  return (lo * w1 + c3 * w2 + hi * w3 + c5 * w4 + lo * w5) / (w1 + w2 + w3 + w4 + w5);
}

/**
 * The environment the chrome reflects, as a scalar in [0,1] at a point on
 * the ring. Bands of sines along the perimeter angle and across page space,
 * warped by one another, sliding in time — a cheap plasma, the reference's
 * recipe without its noise octaves. Angle terms keep a small ring varied;
 * page-space terms keep a long straight run from being one flat value.
 */
fn environment(a: f32, p: vec2f, t: f32) -> f32 {
  let s = p * ENV_SCALE;
  var v = sin(a * 2.0 + t * 0.90) * 0.45;
  v = v + sin(a * 5.0 - t * 1.30 + 1.0) * 0.22;
  v = v + sin(s.x * 6.0 + s.y * 2.0 + t * 0.70) * 0.40;
  v = v + sin(s.y * 5.0 - s.x * 3.0 - t * 0.55 + 2.0) * 0.30;
  v = v + sin(v * 3.0 + t * 0.40) * 0.30;
  return clamp(0.5 + ENV_BIAS + 0.5 * v * 0.85, 0.0, 1.0);
}

/** Where the halo sits: the point on element i's boundary in direction
 *  \`ang\` from its centre — a ray/box intersection, so a wide card and a
 *  small button both get a halo of the same size in pixels. */
fn haloPoint(i: u32, ang: f32) -> vec2f {
  let half = halfOf(i);
  let dir = vec2f(cos(ang), sin(ang));
  let s = 1.0 / max(abs(dir.x) / half.x, abs(dir.y) / half.y);
  return centreOf(i) + dir * s;
}

/** The angle at which the halo currently sits, drifting on its own clock. */
fn haloAngle(t: f32) -> f32 {
  return 2.2 + t * HALO_WANDER + 0.9 * sin(t * 0.17);
}

/** Source-over of a (colour, alpha) pair onto another. */
fn over(topC: vec3f, topA: f32, botC: vec3f, botA: f32) -> vec4f {
  let a = topA + botA * (1.0 - topA);
  if (a <= 0.0) { return vec4f(0.0); }
  return vec4f((topC * topA + botC * botA * (1.0 - topA)) / a, a);
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = uv * look.res;
  let n = u32(look.rectCount);
  let motion = look.flags.x;
  let t = look.time * mix(0.0, ENV_RATE, motion) + 1.0;

  // The nearest chrome edge wins: chrome is a surface, and two surfaces
  // cannot occupy one pixel. Separately, note whether this pixel lies
  // inside some OTHER registered element — a surface a reflection can land on.
  var best = 1.0e9;
  var hit = 0u;
  var inside = 1.0e9;   // signed distance to the edge of the element p is inside
  var host = 16u;
  var refD = 1.0e9;     // nearest chrome edge OUTSIDE of which p lies
  var refHit = 16u;
  for (var i = 0u; i < n; i = i + 1u) {
    let d = edgeAt(i, p);
    if (kinds[i].x > 0.5 && abs(d) < abs(best)) { best = d; hit = i; }
    if (kinds[i].x > 0.5 && d > 0.0 && d < refD) { refD = d; refHit = i; }
    if (d < 0.0 && d < inside) { inside = d; host = i; }
  }
  if (n == 0u || best > 1.0e8) { return vec4f(0.0); }

  let hw = halfWidthOf(hit);
  if (best > hw + HALO_REACH * 4.0 || best < -(hw + 1.5)) { return vec4f(0.0); }

  let c = centreOf(hit);
  let a = atan2(p.y - c.y, p.x - c.x);

  var col = vec3f(0.0);
  var alpha = 0.0;

  // ── reflection: the chrome's environment on a neighbour's near edge ──────
  // The neighbour may itself be chrome: a keycap beside a keycap catches the
  // other's light on the facing edge, so the source is the nearest chrome
  // edge p is OUTSIDE of, not the nearest edge overall.
  if (host < n && refHit < n && refHit != host && refD < REF_GAP * 2.0) {
    let rc = centreOf(refHit);
    let ra = atan2(p.y - rc.y, p.x - rc.x);
    let across = exp(-refD / REF_GAP);                         // fades across the gap
    let into = exp(max(inside, -REF_DEPTH * 4.0) / REF_DEPTH); // fades into the neighbour
    let env = pow(palette(environment(ra, p, t)), vec3f(CONTRAST));
    col = mix(poleHi(), env, 0.6);
    alpha = across * into * REF_GAIN * luma(env) / max(luma(poleHi()), 0.05);
  }

  // ── the halo: soft light outside the ring at one wandering place ──────────
  {
    let hp = haloPoint(hit, haloAngle(look.time * motion));
    let along = exp(-0.5 * pow(distance(p, hp) / HALO_SIZE, 2.0));
    let out = exp(-max(best, 0.0) / HALO_REACH) * smoothstep(-2.0, 0.5, best);
    let breathe = mix(1.0, 0.72 + 0.28 * sin(look.time * 0.6), motion);
    let amt = along * out * HALO_GAIN * breathe;
    let o = over(mix(poleHi(), look.accent.rgb, 0.30), amt, col, alpha);
    col = o.xyz;
    alpha = o.w;
  }

  // ── the hairline: chrome on the element's own border ──────────────────────
  let cover = 1.0 - smoothstep(hw - AA, hw + AA, abs(best));
  if (cover > 0.0) {
    // Outward normal through the swell, by central differences: the analytic
    // gradient of a rounded box would miss the drop entirely.
    let e = 0.75;
    let gx = edgeAt(hit, p + vec2f(e, 0.0)) - edgeAt(hit, p - vec2f(e, 0.0));
    let gy = edgeAt(hit, p + vec2f(0.0, e)) - edgeAt(hit, p - vec2f(0.0, e));
    let g = normalize(vec2f(gx, gy) + vec2f(1.0e-6, 0.0));

    // The cursor's presence on this pixel, and — on a pane — the dispersion
    // it brings: outside its reach the split is zero and the three channels
    // are one sample of the environment.
    let ptr = pointer.xy * look.res;
    let pane = kinds[hit].y;
    let reach = mix(CUR_REACH, PANE_REACH, pane);
    let cur = exp(-0.5 * pow(distance(p, ptr) / reach, 2.0)) * pointer.z * motion;
    let split = DISPERSE * cur * pane;
    var env = palette(environment(a, p, t));
    if (split > 0.001) {
      env = vec3f(
        palette(environment(a + split, p, t)).r,
        env.g,
        palette(environment(a - split, p, t)).b);
    }
    // The environment, gamma-punched for the contrast that makes it chrome.
    var m = pow(env, vec3f(CONTRAST));

    // A directional key: brighter where the ring faces up-left. A multiplier
    // on the environment, not a light/dark split of the ring.
    let key = 1.0 - KEY_GAIN + KEY_GAIN * (0.5 + 0.5 * dot(g, KEY_DIR));
    // Across the band: the outer half sits a little darker, which is the thin
    // dark rim every chrome edge has against its ground.
    let across = 1.0 - OUTER_DIM * smoothstep(0.0, hw, best);
    m = m * key * across;

    // The cursor's reflection: the ring goes bright and slightly coloured
    // where the pointer is, and only there.
    let hot = mix(poleHi(), look.accent.rgb, 0.18 + 0.22 * (0.5 + 0.5 * sin(a * 9.0 + t * 2.0)));
    m = mix(m, hot, cur * mix(CUR_GAIN, PANE_GAIN, pane));

    let o = over(clamp(m, vec3f(0.0), vec3f(1.0)), cover, col, alpha);
    col = o.xyz;
    alpha = o.w;
  }

  if (alpha <= 0.0) { return vec4f(0.0); }
  // Premultiplied: the surface is configured "premultiplied" and the effect
  // writes the colour target directly, with no blend state of its own.
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)) * alpha, alpha);
}
`;
