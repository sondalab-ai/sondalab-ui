/* @sondalab/ui-kit — effects-shader.js
   The WGSL for the Tier 2 light, as an inline template string. No bundler
   plugin: a template string keeps every consumer's build config untouched.

   WHAT THIS DRAWS. One element at a time, in that element's own box: the
   pointer as a LIGHT SOURCE on the inside face of a pane of glass. A soft
   pool of light where the cursor is, a specular that tightens along the inner
   edge the light happens to face, and a colour fringe on that edge — the
   channels separated by a fraction of a pixel, which is what refraction looks
   like on a piece of glass and what the reference's material calls
   shiftRed/shiftBlue.

   The owner's ruling that shapes all of it: nothing may leave the element's
   box. The old field drew a halo around everything it tracked, from a canvas
   above the whole page, and read as a permanent glow on every element. This
   draws inside one silhouette and stops at its edge — the SDF that gives the
   corners their curve is the same one that zeroes the alpha outside them, so
   there is no clip to escape and no container to be truncated by.

   WHAT THIS DOES NOT DRAW. The aurora: it is light, and it is CSS at every
   tier (effects.css, the border-beam recipe). The liquid's swell: effects.js
   draws that as a gooey skin under the content. The blur of the page behind
   the glass: a canvas cannot read the DOM beneath it, so translucency is
   backdrop-filter on the host, and this shader composites over the result.

   Every colour arrives as a uniform read from a design token. Nothing is
   hardcoded; scripts/effects-gpu.test.mjs enforces that. */

export const SHADER = `
// Fragment stage only. \`vgpu.effect()\` supplies the full-screen vertex stage.
// Its generated uv is (0,0) at the top-left and (1,1) at the bottom-right of
// the canvas, which is the element's own border box — so +y points DOWN, and
// uv * box.xy is a position in the element's own CSS pixels.
struct Look {
  accent : vec4f,   // --sl-accent-default
  depth  : vec4f,   // --sl-accent-depth
  sheen  : vec4f,   // --sl-text-primary
  ground : vec4f,   // --sl-bg-canvas
  // x: 1 when motion is allowed, 0 under prefers-reduced-motion. The light
  //    still renders at 0 — it is a surface property, not motion — but it
  //    stops breathing.
  // y: 1 when the canvas token is the light one (paper). On paper the light
  //    has to darken and saturate rather than add white, the way the
  //    reference's own light preset composites with multiply and saturate.
  // z: seconds since boot.
  flags  : vec4f,
  // xy: the element's border box in CSS pixels
  // z:  its corner radius in CSS pixels, read from its own border-radius
  // w:  its border width in CSS pixels, read from its own border
  box    : vec4f,
  // xy: the pointer in the element's own CSS pixels
  // z:  presence, eased 0..1 — light arrives and leaves, it never snaps
  // w:  unused
  ptr    : vec4f,
};
@group(0) @binding(0) var<uniform> look : Look;

// How far the pool of light reaches, as a share of the element's short side,
// and the floor under it so a tall thin control is still lit end to end.
const REACH_K   : f32 = 0.85;
const REACH_MIN : f32 = 44.0;
// The specular band, in multiples of the element's own border width. Read
// from the border rather than fixed, so a control that re-parametrises its
// own edge keeps the light on that edge. Narrow: on glass the highlight is a
// line along the rim, not a wash inside it.
const EDGE_K    : f32 = 1.8;
const EDGE_MIN  : f32 = 1.6;
// How sharply the rim highlight falls away from the part of the edge facing
// the pointer. A lamp lights half a shape; a lens catches light on a short
// arc of its rim, so the term is raised rather than used flat.
const EDGE_TIGHT: f32 = 4.0;
// Channel separation on the edge band, in CSS pixels. Refraction, not a
// rainbow: at this scale it reads as a warm side and a cool side to the rim,
// which is what the reference's one colour-separation knob does.
const DISPERSE  : f32 = 1.8;
// How much of the surface the pool lights, and how much brighter the rim goes
// where the light meets it. The first pass had these the other way round and
// read as a lamp behind a panel: the material IS the translucency, and what
// the pointer adds is a highlight on the rim, not a glow in the middle.
const POOL_GAIN : f32 = 0.09;
const EDGE_GAIN : f32 = 1.15;
// The rim's own brightness, independent of where the pointer is along it. An
// edge is brighter than a face at every angle, and that is most of what
// separates a pane of glass from a hole cut in the page.
const RIM_GAIN  : f32 = 0.26;

/** Signed distance to a rounded box centred on the origin. Negative inside.
 *  b is the half-extent, r the corner radius. */
fn sdRoundBox(p: vec2f, b: vec2f, r: f32) -> f32 {
  let q = abs(p) - b + vec2f(r, r);
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0, 0.0))) - r;
}

/** The pool of light the pointer casts on the surface, sampled at p. A
 *  Gaussian rather than a linear falloff: a lamp has no edge. */
fn pool(p: vec2f, reach: f32) -> f32 {
  let r = distance(p, look.ptr.xy);
  return exp(-(r * r) / (2.0 * reach * reach * 0.25));
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  let size = look.box.xy;
  if (size.x <= 0.0 || size.y <= 0.0) { return vec4f(0.0); }

  let p = uv * size;
  let half = size * 0.5;
  let radius = clamp(look.box.z, 0.0, min(half.x, half.y));
  let d = sdRoundBox(p - half, half, radius);

  // The silhouette is the mask. One expression gives the corners their curve
  // AND stops the light at the edge, so nothing has to clip this canvas.
  let inside = 1.0 - smoothstep(-1.0, 0.0, d);
  if (inside <= 0.001) { return vec4f(0.0); }

  let presence = clamp(look.ptr.z, 0.0, 1.0);
  if (presence <= 0.001) { return vec4f(0.0); }

  // A slow breath, so a pane held under the cursor is alive rather than
  // frozen. Off under reduced motion, where the light is simply steady.
  let breath = 1.0 + 0.05 * look.flags.x * sin(look.flags.z * 1.7);

  let reach = max(min(size.x, size.y) * REACH_K, REACH_MIN);
  let hw = max(look.box.w * EDGE_K, EDGE_MIN);

  // The inner edge, and the direction that leaves it. The SDF's gradient is
  // the surface normal of the silhouette; the light picks out the part of the
  // edge it faces, the way a bevel catches a lamp.
  let e = vec2f(0.75, 0.0);
  let grad = normalize(vec2f(
    sdRoundBox(p - half + e.xy, half, radius) - sdRoundBox(p - half - e.xy, half, radius),
    sdRoundBox(p - half + e.yx, half, radius) - sdRoundBox(p - half - e.yx, half, radius),
  ) + vec2f(1e-6, 0.0));
  let band = 1.0 - smoothstep(0.0, hw, abs(d));
  let facing = clamp(dot(normalize(look.ptr.xy - p + vec2f(1e-6, 0.0)), -grad), 0.0, 1.0);
  let toward = pow(facing, EDGE_TIGHT);

  // Refraction: the three channels leave the glass at slightly different
  // angles, so each samples the pool from a slightly different place. Only on
  // the edge band — the middle of a pane bends nothing.
  let sep = DISPERSE * band;
  let lr = pool(p + grad * sep, reach);
  let lg = pool(p, reach);
  let lb = pool(p - grad * sep, reach);

  let surface = vec3f(lr, lg, lb) * POOL_GAIN;
  let specular = vec3f(lr, lg, lb) * band * toward * EDGE_GAIN;
  // The rim along its whole length, not only where it faces the pointer.
  let rim = vec3f(band * RIM_GAIN, band * RIM_GAIN, band * RIM_GAIN);
  let lit = (surface + specular + rim) * inside * presence * breath;

  // The colour of the light. On ink it is the sheen — the text colour is the
  // page's own light pole — warmed toward the accent where it is strongest,
  // so the pool has a hue and does not read as grey haze. On paper white is
  // invisible, so the same light is carried by the depth companion instead
  // and composited as a tint rather than as a glow.
  let paper = look.flags.y;
  let cool = mix(look.sheen.rgb, look.depth.rgb, paper);
  let hue = mix(cool, look.accent.rgb, 0.22 + 0.30 * clamp(lg, 0.0, 1.0));

  let alpha = clamp(max(lit.r, max(lit.g, lit.b)), 0.0, 1.0);
  if (alpha <= 0.001) { return vec4f(0.0); }

  // Premultiplied: the surface is configured "premultiplied" and the effect
  // writes the colour target directly, with no blend state of its own. The
  // per-channel light is folded in here, which is what makes the dispersion
  // visible at all — a single luminance would average the three back to one.
  let col = clamp(hue * lit / max(alpha, 0.001), vec3f(0.0), vec3f(1.0));
  return vec4f(col * alpha, alpha);
}
`;
