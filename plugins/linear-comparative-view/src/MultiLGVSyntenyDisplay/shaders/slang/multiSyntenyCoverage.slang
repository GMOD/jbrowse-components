// Multi-synteny coverage pass. One instance per bin (min/max band bar) in
// the coverage area above the main synteny rows.
//! targets: wgsl, glsl

import multiSyntenyUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
struct CovBin {
  float position  : ATTR0;
  float minDepth  : ATTR1;
  float maxDepth  : ATTR2;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(CovBin bin, uint vid : SV_VertexID) {
  VsOut o;
  o.color = float4(u.coverageR, u.coverageG, u.coverageB, 1.0);

  uint v = vid % 6u;
  float localX = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float localY = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;

  float blockStart = u.bpRangeHi + u.bpRangeLo;
  float t1 = (bin.position - blockStart) / u.bpRangeLen;
  float t2 = (bin.position + 1.0 - blockStart) / u.bpRangeLen;
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
  float bandBottom = coverageBottom - bin.minDepth * u.depthScale * effectiveHeight;
  float bandTop = coverageBottom - bin.maxDepth * u.depthScale * effectiveHeight;
  float sy = lerp(bandBottom, bandTop, localY);

  float2 clipPos = float2(sx, sy) / float2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  o.position = float4(clipPos.x, -clipPos.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
