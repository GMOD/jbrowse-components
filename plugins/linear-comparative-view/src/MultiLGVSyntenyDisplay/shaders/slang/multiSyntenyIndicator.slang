// Multi-synteny insertion indicator pass. 3 verts per instance → a single
// triangle flagging an insertion site, drawn at the top of the coverage
// area in a fixed purple color.
//! targets: wgsl, glsl

import hpmath;
import multiSyntenyUniforms;


public static const uint VERTS_PER_INSTANCE = 3u;
struct Indicator {
  uint position : ATTR0;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Indicator ind, uint vid : SV_VertexID) {
  VsOut o;

  float3 bpRange = float3(u.bpRangeHi, u.bpRangeLo, u.bpRangeLen);
  float t = hpScaleLinear(hpSplitUint(ind.position), bpRange, u.hpZero);
  float cx = u.regionScreenLeft + t * u.regionScreenWidth;

  if (cx < -4.0 || cx > u.resolutionX + 4.0) {
    o.position = float4(0.0);
    return o;
  }

  float hw = 3.5;
  float th = 4.5;
  uint v = vid % 3u;
  float sx, sy;
  if (v == 0u)      { sx = cx - hw; sy = 0.0; }
  else if (v == 1u) { sx = cx + hw; sy = 0.0; }
  else              { sx = cx;      sy = th;  }

  float2 clipPos = float2(sx, sy) / float2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  o.position = float4(clipPos.x, -clipPos.y, 0.0, 1.0);
  o.color = float4(0.71, 0.0, 0.71, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
