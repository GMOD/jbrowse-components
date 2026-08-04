// Hi-C contact map renderer. One instance = one binned contact (square)
// rendered at 45° into a triangle above the axis. Color comes from sampling
// a 256×1 palette texture with `t = normalized count (optionally log)`.
//! targets: wgsl, glsl
//! js-export: mapHicCount

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

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float t = mapHicCount(fragIn.count, u.colorMaxScore, u.useLogScale == 1u);
  float4 c = colorRamp.SampleLevel(float2(t, 0.5), 0.0);
  return float4(c.rgb * c.a, c.a);
}
