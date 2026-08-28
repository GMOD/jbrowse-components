// Hi-C contact map renderer. One instance = one binned contact (square)
// rendered at 45° into a triangle above the axis. Color comes from sampling
// a 256×1 palette texture with `t = normalized count (optionally log)`.
//! targets: wgsl, glsl
//! blend: premultiplied
//! js-export: mapHicCount
//! export-consts: MIN_VISIBLE_ALPHA

import colorRampLut;
import diagonalGrid;
import hpmath;

public static const uint VERTS_PER_INSTANCE = 6u;

struct HicInstance {
  float2 position : ATTR0;
  float  count    : ATTR1;
};

struct Uniforms {
  float2 canvasSize;
  float  binWidth;
  float  yScalar;
  float  colorMaxScore;
  float  viewScale;
  float  viewOffsetX;
  uint   useLogScale;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Combined sampler — slangc emits `sampler2D` for GLSL and separate
// texture+sampler for WGSL. Per ADR-005 §"Authoring conventions", dual-target
// shaders must use Sampler2D (not Texture2D + SamplerState) so the GLSL path
// gets a real combined sampler.
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  // The contact's raw count, constant per instance — all six vertices of the
  // quad carry the same value, so interpolating it is a no-op the rasterizer
  // would still set up. The count→color mapping deliberately stays in the
  // fragment shader rather than moving to the vertex shader: bins are ~1.4 px at
  // the auto binsize, so a full-width triangle emits several times more vertices
  // than fragments and the math is cheaper per fragment.
  nointerpolation float count : COLOR0;
};

[shader("vertex")]
VsOut vs_main(HicInstance inst, uint vid : SV_VertexID) {
  float2 pos = inst.position + quadLocal(vid) * u.binWidth;

  VsOut o;
  // 45° rotation + Y-axis projection into the triangular Hi-C view — the same
  // transform the LD heatmap uses (diagonalGrid).
  o.position = diagonalCellToClip(
    pos, u.canvasSize, u.viewScale, u.viewOffsetX, u.yScalar);
  o.count = inst.count;
  return o;
}

// Contact count -> the [0,1] point on the ramp that colors it. Split out of
// fs_main so `//! js-export` can lift it: the Canvas2D and SVG paths sample the
// same 256-entry ramp and have to land on the same entry the GPU does.
//
// Both floors are load-bearing and mirrored in countStats.ts. log2(1) is 0, so
// a colorMaxScore at or below 1 would divide by zero; a zero colorMaxScore
// would make the linear branch 0/0 = NaN. Neither is hypothetical — an empty
// or single-contact block produces both.
float mapHicCount(float count, float colorMaxScore, bool useLogScale) {
  float t;
  if (useLogScale) {
    t = log2(max(count, 1.0)) / log2(max(colorMaxScore, 2.0));
  } else {
    t = count / max(colorMaxScore, 0.001);
  }
  return clamp(t, 0.0, 1.0);
}

// Below this the ramp is effectively transparent and the bin is not painted at
// all. Not an edge case: `juicebox` is the default scheme and fades alpha from 0
// across its low counts, so on a typical frame a large share of contacts land
// here — and a frame is 300k-4.5M of them (see hicTransform.ts).
//
// Exported so `makeHicFillStyleLut` gates on the shader's own number instead of
// its own copy of it. That LUT already skips these bins entirely, which is what
// makes this a boundary rather than an optimization: the GPU was painting bins
// the Canvas2D and SVG paths omit (adr-051, and the same "drawn and exported are
// one boundary" rule as synteny's isInstanceInvisible).
public static const float MIN_VISIBLE_ALPHA = 0.01;

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float t = mapHicCount(fragIn.count, u.colorMaxScore, u.useLogScale == 1u);
  // Sampling and premultiplication are the shared ramp module's
  // (render-core colorRampLut.slang); the count→t scale above and the discard
  // below stay this shader's own. Alpha is unchanged by the premultiply, so the
  // test reads the ramp's own alpha.
  float4 c = rampColorPremultiplied(colorRamp, t);
  // Nothing to composite. The blend is `one / one-minus-src-alpha`, so a zero
  // alpha is already a no-op on the framebuffer — it just wasn't a free one, and
  // at these contact counts the read-modify-write it skips is the whole cost of
  // the fragment. Costs the opaque schemes (fall, viridis) nothing: their ramps
  // are alpha 255 throughout, so this is never taken.
  if (c.a < MIN_VISIBLE_ALPHA) {
    discard;
  }
  return c;
}
