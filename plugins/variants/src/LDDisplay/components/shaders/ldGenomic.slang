// LD heatmap — GENOMIC mode. One instance per cell; each cell carries its
// own screen-space position + cellSize (variants are laid out along the
// genome, not at uniform pitch). Rendered as a 45°-rotated square above the
// x-axis; fragment shader samples the color ramp by `ldValue`.
//! targets: wgsl, glsl

import ldUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

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

  VsOut o;
  o.position = ldCellToClip(pos, u);
  o.ldValue = inst.ldValue;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return ldRampColor(fragIn.ldValue, u, colorRamp);
}
