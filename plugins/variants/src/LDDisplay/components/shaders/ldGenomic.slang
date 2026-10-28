// LD heatmap — GENOMIC mode. One instance per computed cell, carrying its own
// position + cellSize in bp/√2 relative to the payload's origin, as
// `packGenomicCells` (ldMarks.ts) reads them off `boundaries`. Rendered as a
// 45°-rotated square above the x-axis; the fragment shader samples the color
// ramp by `ldValue`.
//! targets: wgsl, glsl
//! blend: premultiplied

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
  nointerpolation float ldValue : COLOR0;
};

[shader("vertex")]
VsOut vs_main(LDInstance inst, uint vid : SV_VertexID) {
  float2 pos = inst.position + quadLocal(vid) * inst.cellSize;

  VsOut o;
  o.position = ldCornerToClip(pos, inst.ldValue, u);
  o.ldValue = inst.ldValue;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return ldRampColor(fragIn.ldValue, u, colorRamp);
}
