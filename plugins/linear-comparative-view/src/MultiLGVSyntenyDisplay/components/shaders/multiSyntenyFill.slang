// Multi-synteny fill pass. Per-instance: startBp/endBp (u32 HP-genome
// positions), genomeRow, featureId, and packed ABGR color. Uses hpmath to
// compute clip-space x with subpixel accuracy when zoomed far in.
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import multiSyntenyUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
struct Instance {
  uint startBp    : ATTR0;
  uint endBp      : ATTR1;
  uint genomeRow  : ATTR2;
  uint featureId  : ATTR3;
  uint color      : ATTR4;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float featureId : COLOR1;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = float(inst.featureId);

  float2 splitStart = hpSplitUint(inst.startBp);
  float2 splitEnd = hpSplitUint(inst.endBp);
  float3 bpRange = float3(u.bpRangeHi, u.bpRangeLo, u.bpRangeLen);
  float t1 = hpScaleLinear(splitStart, bpRange, u.hpZero);
  float t2 = hpScaleLinear(splitEnd, bpRange, u.hpZero);

  float px1 = u.regionScreenLeft + t1 * u.regionScreenWidth;
  float px2 = u.regionScreenLeft + t2 * u.regionScreenWidth;
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > u.resolutionX) {
    o.position = float4(0.0);
    return o;
  }

  px1 = max(px1, 0.0);

  float pad = u.rowPadding;
  float y1 = u.coverageHeight + float(inst.genomeRow) * u.rowHeight + pad;
  float y2 = y1 + u.rowHeight - pad * 2.0;

  uint v = vid % 6u;
  float x = (v == 0u || v == 2u || v == 3u) ? px1 : px2;
  float y = (v == 0u || v == 1u || v == 4u) ? y1 : y2;

  float2 clipPos = float2(x, y) / float2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  o.position = float4(clipPos.x, -clipPos.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
