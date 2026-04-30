// Multi-synteny SNP coverage pass. Colored segments layered on top of the
// grey coverage bars — colorType encodes A/C/G/T (1-4), looked up from the
// uniform's baseA..T RGB triplets.
//! targets: wgsl, glsl

import hpmath;
import multiSyntenyUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
struct SnpSegment {
  uint  position   : ATTR0;
  float yOffset    : ATTR1;
  float segHeight  : ATTR2;
  float colorType  : ATTR3;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

float3 snpColor(float ct, Uniforms u) {
  int ci = int(ct);
  if (ci == 1) { return float3(u.baseAR, u.baseAG, u.baseAB); }
  if (ci == 2) { return float3(u.baseCR, u.baseCG, u.baseCB); }
  if (ci == 3) { return float3(u.baseGR, u.baseGG, u.baseGB); }
  return float3(u.baseTR, u.baseTG, u.baseTB);
}

[shader("vertex")]
VsOut vs_main(SnpSegment seg, uint vid : SV_VertexID) {
  VsOut o;

  uint v = vid % 6u;
  float localX = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float localY = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;

  float3 bpRange = float3(u.bpRangeHi, u.bpRangeLo, u.bpRangeLen);
  float t1 = hpScaleLinear(hpSplitUint(seg.position), bpRange, u.hpZero);
  float t2 = hpScaleLinear(hpSplitUint(seg.position + 1u), bpRange, u.hpZero);
  float px1 = u.regionScreenLeft + t1 * u.regionScreenWidth;
  float px2 = u.regionScreenLeft + t2 * u.regionScreenWidth;
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > u.resolutionX) {
    o.position = float4(0.0);
    return o;
  }

  float sx = lerp(px1, px2, localX);
  float effectiveHeight = u.coverageHeight - 2.0 * u.coverageYOffset;
  float coverageBottom = u.coverageHeight - u.coverageYOffset;
  float segBottom = coverageBottom - seg.yOffset * u.depthScale * effectiveHeight;
  float segTop = segBottom - seg.segHeight * u.depthScale * effectiveHeight;
  float sy = lerp(segBottom, segTop, localY);

  float2 clipPos = float2(sx, sy) / float2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  o.position = float4(clipPos.x, -clipPos.y, 0.0, 1.0);
  o.color = float4(snpColor(seg.colorType, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
