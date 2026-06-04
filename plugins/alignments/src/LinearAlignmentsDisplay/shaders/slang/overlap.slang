// Chain overlap overlay: a full-row-height quad over the genomic interval where
// two reads in the same chain (same row) overlap. Paints a semi-transparent
// dark tint so the overlapped span is visually distinct from normal reads.
// Hidden under ~3px rows (mirrors the read-pass chevron gate).
//! targets: wgsl, glsl

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  startOff : ATTR0;
  uint  endOff   : ATTR1;
  float y        : ATTR2;
};

struct VsOut {
  float4 position : SV_Position;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float2 local = quadLocal(vid);

  float sx1 = bpToClipX(inst.startOff, u);
  float sx2 = bpToClipX(inst.endOff, u);

  float2 yy = pileupY(inst.y, u);
  float syTop = yy.x;
  float syBot = yy.y;

  o.position = float4(
    flipX(lerp(sx1, sx2, local.x), u),
    lerp(syBot, syTop, local.y),
    0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return float4(0.0, 0.0, 0.0, 1.0);
}
