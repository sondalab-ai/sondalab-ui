/* @sondalab/ui-kit — effects-shader.js
   The WGSL for the liquid field, as an inline template string. No bundler
   plugin: @vgpu/wgsl has a Vite loader, but a template string keeps every
   consumer's build config untouched — the same call sondalab-site made.

   Every colour arrives as a uniform read from a design token. Nothing is
   hardcoded here; scripts/effects-gpu.test.mjs enforces that. */

export const SHADER = `
struct Look {
  accent   : vec4f,
  depth    : vec4f,
  time     : f32,
  rectCount: f32,
  _pad     : vec2f,
};
@group(0) @binding(0) var<uniform> look : Look;
// x, y, w, h in normalised device space, one per registered element (cap 8)
@group(0) @binding(1) var<uniform> rects : array<vec4f, 8>;
// pointer position and velocity, normalised
@group(0) @binding(2) var<uniform> pointer : vec4f;

fn field(p: vec2f, t: f32) -> f32 {
  let d = distance(p, pointer.xy);
  let wake = exp(-d * 6.0) * (0.6 + 0.4 * length(pointer.zw));
  let ripple = sin(d * 34.0 - t * 3.4) * exp(-d * 4.5);
  return clamp(wake + ripple * 0.35, 0.0, 1.0);
}

@fragment
fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  var inside = 0.0;
  for (var i = 0u; i < u32(look.rectCount); i = i + 1u) {
    let r = rects[i];
    let hit = step(r.x, uv.x) * step(uv.x, r.x + r.z)
            * step(r.y, uv.y) * step(uv.y, r.y + r.w);
    inside = max(inside, hit);
  }
  if (inside < 0.5) { return vec4f(0.0); }
  let a = field(uv, look.time);
  let hue = mix(look.depth.rgb, look.accent.rgb, a);
  return vec4f(hue * a, a * 0.42);
}
`;
