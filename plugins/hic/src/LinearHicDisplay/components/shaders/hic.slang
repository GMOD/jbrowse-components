// Hi-C contact map renderer. One instance = one binned contact (square)
// rendered at 45° into a triangle above the axis. Color comes from sampling
// a 256×1 palette texture with `t = normalized count (optionally log)`.
//! targets: wgsl, glsl

// cos(45°) = sin(45°) — shared rotation factor for the 45° projection.
static const float ROT_45 = 0.7071067811865476;

struct HicInstance {
  float2 position : ATTR0;
  float  count    : ATTR1;
};

struct Uniforms {
  float2 canvasSize;
  float  binWidth;
  float  yScalar;
  float  maxScore;
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
  float  count    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(HicInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;
  float lx = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float ly = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;
  float2 pos = inst.position + float2(lx, ly) * u.binWidth;

  // 45° rotation + Y-axis projection into the triangular Hi-C view.
  float rx = (pos.x + pos.y) * ROT_45;
  float ry = (-pos.x + pos.y) * ROT_45;

  float sx = rx * u.viewScale + u.viewOffsetX;
  float sy = ry * u.viewScale * u.yScalar;

  float clipX = (sx / u.canvasSize.x) * 2.0 - 1.0;
  float clipY = 1.0 - (sy / u.canvasSize.y) * 2.0;

  VsOut o;
  o.position = float4(clipX, clipY, 0.0, 1.0);
  o.count = inst.count;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float m = (u.useLogScale == 1u) ? u.maxScore : u.maxScore / 20.0;
  float t;
  if (u.useLogScale == 1u) {
    t = log2(max(fragIn.count, 1.0)) / log2(max(m, 1.0));
  } else {
    t = fragIn.count / max(m, 0.001);
  }
  t = clamp(t, 0.0, 1.0);
  float4 c = colorRamp.SampleLevel(float2(t, 0.5), 0.0);
  return float4(c.rgb * c.a, c.a);
}
