// LD heatmap — GENOMIC mode. One instance per cell; each cell carries its
// own screen-space position + cellSize (variants are laid out along the
// genome, not at uniform pitch). Rendered as a 45°-rotated square above the
// x-axis; fragment shader samples the color ramp by `ldValue`.
//! targets: wgsl, glsl

import ldUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
static const float ROT_45 = 0.7071067811865476;

struct LDInstance {
  float2 position : ATTR0;
  float2 cellSize : ATTR1;
  float  ldValue  : ATTR2;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float  ldValue  : COLOR0;
};

[shader("vertex")]
VsOut vs_main(LDInstance inst, uint vid : SV_VertexID) {
  float2 pos = inst.position + quadLocal(vid) * inst.cellSize;

  float rx = (pos.x + pos.y) * ROT_45;
  float ry = (-pos.x + pos.y) * ROT_45;
  float sx = rx * u.viewScale + u.viewOffsetX;
  float sy = ry * u.viewScale * u.yScalar;

  VsOut o;
  o.position = float4(
    (sx / u.canvasSize.x) * 2.0 - 1.0,
    1.0 - (sy / u.canvasSize.y) * 2.0,
    0.0, 1.0);
  o.ldValue = inst.ldValue;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float t = (u.signedLd == 1u) ? (fragIn.ldValue + 1.0) * 0.5 : fragIn.ldValue;
  t = clamp(t, 0.0, 1.0);
  float4 c = colorRamp.SampleLevel(float2(t, 0.5), 0.0);
  return float4(c.rgb * c.a, c.a);
}
