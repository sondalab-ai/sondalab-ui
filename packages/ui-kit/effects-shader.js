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
  // The glass parameters, every one of them a CSS custom property the surface
  // can rebind per variant rather than a constant in here.
  // x: thickness, as a FRACTION of the pane's short side. glass-studio's own
  //    value is 20 on a 200x200 shape, so 0.10 — a ratio is the only unit that
  //    survives a 34px button, a 400px card and a 2x display unretuned.
  // y: the MATERIAL's share of the pane, 0..1, toward the dark pole. The
  //    card's own figure is 0.5125.
  // z: the Fresnel factor on the card's own 0..100 scale.
  // w: 1 when a backdrop has been declared and bound, 0 otherwise. At 0 this
  //    shader behaves exactly as it did before refraction existed.
  glass  : vec4f,
  // x: the VARIANT's accent share, 0..1 and small — a primary says which
  //    button it is without hiding what is behind it.
  // y: how top-weighted the rim highlight is, 0 uniform and 1 only at the top.
  // zw: unused.
  tone   : vec4f,
  // Where this pane sits inside its backdrop anchor, in the anchor's own 0..1
  // space — which is the image's space, because the image covers the anchor's
  // box. xy is the origin, zw the scale. Without it the whole image is
  // squeezed into every pane, which reads as a texture rather than as glass.
  backRect : vec4f,
};
@group(0) @binding(0) var<uniform> look : Look;
// The declared backdrop. A surface says what lies behind a region with
// --slfx-backdrop and the pane bends THAT; this layer never reads the document.
// Always bound, so the pipeline layout does not change with the mode — a 1x1
// transparent texture stands in when nothing is declared.
@group(0) @binding(1) var backSampler : sampler;
@group(0) @binding(2) var backTex : texture_2d<f32>;

// Index of refraction per channel, from the glass-studio card: blue bends more
// than red, which is what puts a colour fringe on a glass edge.
const N_R : f32 = 0.98;
const N_G : f32 = 1.00;
const N_B : f32 = 1.02;

// How far the pool of light reaches, as a share of the element's short side,
// and the floor under it so a tall thin control is still lit end to end.
const REACH_K   : f32 = 0.85;

// Refraction, from the glass-studio card: its refraction factor is 1.4, its
// glare angle -45 degrees and its opposite-side lobe 80% of the near one.
const REFRACT_FACTOR : f32 = 1.4;
const GLARE_ANGLE    : f32 = -0.7853981634;
const GLARE_OPPOSITE : f32 = 0.8;
const GLARE_GAIN     : f32 = 0.5;
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

  // The inner edge, and the direction that leaves it. The SDF's gradient is
  // the surface normal of the silhouette; the light picks out the part of the
  // edge it faces, the way a bevel catches a lamp.
  let e = vec2f(0.75, 0.0);
  let grad = normalize(vec2f(
    sdRoundBox(p - half + e.xy, half, radius) - sdRoundBox(p - half - e.xy, half, radius),
    sdRoundBox(p - half + e.yx, half, radius) - sdRoundBox(p - half - e.yx, half, radius),
  ) + vec2f(1e-6, 0.0));

  // ── refraction of the declared backdrop ────────────────────────────────────
  // Sampled UNCONDITIONALLY and mixed by the flag, never inside a branch. Two
  // reasons, and both matter: textureSample in non-uniform control flow is
  // undefined in WGSL, and vgpu's reflection is usage-based — a binding only
  // reached from inside a branch is not seen at all, which fails as
  // "Binding 'backSampler' does not exist" long before any pixel is drawn.
  // With nothing declared the placeholder texel is transparent and the flag is 0,
  // so the cost is three reads of a 1x1 texture and the result is unchanged.
  let paper = look.flags.y;
  let has = clamp(look.glass.w, 0.0, 1.0);
  let thick = max(look.glass.x * min(size.x, size.y), 1.0);

  // How deep inside the rim, 0 at the edge and 1 once past the thickness.
  let t = clamp(-d / thick, 0.0, 1.0);
  // The slope of a lens section. Its vertical tangent at the rim bends a
  // straight line into a curve; pushing along the normal by a flat amount
  // instead gives four faces meeting on a diagonal, which is a bevel.
  let u = 1.0 - t;
  let slope = u / sqrt(max(1.0 - u * u, 1e-4));
  let bendAmt = clamp(slope, 0.0, 6.0) / 6.0;

  let push = grad * bendAmt * thick * REFRACT_FACTOR;
  let fringe = grad * bendAmt * DISPERSE;
  // The pane's uv, carried into the image's space, and one host pixel
  // expressed there too — so the same bend in CSS pixels displaces the same
  // distance whatever the anchor's size.
  let base = look.backRect.xy + uv * look.backRect.zw;
  let texel = look.backRect.zw / size;

  let cr = textureSample(backTex, backSampler, base + (push * (2.0 - N_R) + fringe) * texel).r;
  let cg = textureSample(backTex, backSampler, base + (push * (2.0 - N_G)) * texel).g;
  let cb = textureSample(backTex, backSampler, base + (push * (2.0 - N_B) - fringe) * texel).b;

  var glass = vec3f(cr, cg, cb);

  // TWO tints, because they are two different quantities and one knob doing
  // both is what made this read as coloured plastic.
  //
  //  - The MATERIAL's tint is dark and desaturated, near the page's own ink:
  //    liqui-glass uses a near-black blue-grey at 0.5125 and glass-studio
  //    defaults its tint to fully transparent. Glass darkens what is behind it; a tint
  //    toward the accent paints over it. The dark pole is the mirror of the
  //    light pole below — the ground on ink, the text colour on paper, so a
  //    light theme darkens too instead of turning into a white frost, which
  //    is the od-glassmorphism look the non-goals reject by name.
  //  - The VARIANT's tint is the accent, and it is SMALL. liqui's own rule:
  //    "Variants don't paint over the glass — they override --lg-tint, so the
  //    lens keeps refracting the background through the accent colour instead
  //    of hiding it."
  glass = mix(glass, look.ground.rgb, clamp(look.glass.y, 0.0, 1.0));
  glass = mix(glass, look.accent.rgb, clamp(look.tone.x, 0.0, 1.0));

  // Fresnel: grazing angles reflect, so the rim brightens and the middle does
  // not. Lifted toward the page's own light pole by a share of the remaining
  // headroom rather than added, so a bright backdrop cannot clip — which is
  // what working in LCH and clamping buys the reference.
  let pole = mix(look.sheen.rgb, look.depth.rgb, paper);
  // Top-weighted, not a ring. liqui-glass's rim is an inset shadow, white at
  // half alpha, on the TOP edge plus a weaker 1px side pair, and nothing
  // along the bottom — light arriving from above. A Fresnel term
  // applied evenly round the perimeter reads as a border instead, which is
  // what this used to do.
  let up = clamp(-grad.y, 0.0, 1.0);
  let facing_up = mix(1.0, up, clamp(look.tone.y, 0.0, 1.0));
  let fres = pow(1.0 - t, 3.0) * clamp(look.glass.z / 100.0, 0.0, 1.0) * facing_up;
  glass = mix(glass, pole, clamp(fres * 0.55, 0.0, 1.0));

  // Glare: a fixed light direction, never the pointer. In the reference the
  // angle is a setting; the pointer moves the specular spot, not the direction
  // the light comes from, and a light that chases the cursor reads as unreal.
  let lightDir = vec2f(cos(GLARE_ANGLE), sin(GLARE_ANGLE));
  let face = dot(grad, lightDir);
  let lobe = pow(max(face, 0.0), 8.0) + GLARE_OPPOSITE * pow(max(-face, 0.0), 14.0);
  glass = mix(glass, pole, clamp(lobe * pow(1.0 - t, 1.6) * GLARE_GAIN, 0.0, 1.0));

  // The silhouette is the mask. One expression gives the corners their curve
  // AND stops the light at the edge, so nothing has to clip this canvas.
  let inside = 1.0 - smoothstep(-1.0, 0.0, d);
  if (inside <= 0.001) { return vec4f(0.0); }

  // Presence gates the LIGHT, not the material. A refraction is a property of
  // the glass and is there whether or not a pointer is: AC-33 asks an element
  // at rest to carry no light, and a bend is not light. So a pane with a
  // declared backdrop keeps rendering at presence 0 — the light terms below
  // are all multiplied by it and contribute nothing — while a pane with
  // nothing declared has no material to show and leaves the canvas empty.
  let presence = clamp(look.ptr.z, 0.0, 1.0);
  if (presence <= 0.001 && has < 0.5) { return vec4f(0.0); }

  // A slow breath, so a pane held under the cursor is alive rather than
  // frozen. Off under reduced motion, where the light is simply steady.
  let breath = 1.0 + 0.05 * look.flags.x * sin(look.flags.z * 1.7);

  let reach = max(min(size.x, size.y) * REACH_K, REACH_MIN);
  let hw = max(look.box.w * EDGE_K, EDGE_MIN);

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
  let cool = mix(look.sheen.rgb, look.depth.rgb, paper);
  let hue = mix(cool, look.accent.rgb, 0.22 + 0.30 * clamp(lg, 0.0, 1.0));

  if (has > 0.5 && inside > 0.001) {
    let over = clamp(hue * lit, vec3f(0.0), vec3f(1.0));
    let out = clamp(glass + over, vec3f(0.0), vec3f(1.0));
    return vec4f(out * inside, inside);
  }

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
