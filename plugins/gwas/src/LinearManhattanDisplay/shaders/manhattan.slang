// Manhattan plot scatter point renderer.
// Each feature is a filled circle (disc) rendered as a quad of 6 vertices.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;
static const int SCALE_TYPE_LOG = 1;

struct ManhattanInstance {
  uint  absPosition : ATTR0;
  float score       : ATTR1;
  uint  color       : ATTR2;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  int    scaleType;
  float  domainYMin;
  float  domainYMax;
  float  zero;
  float  viewportWidth;
  float  reversed;
  float  pointRadius;
  float  _pad;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
};

float normalizeScore(float score, float domainMin, float domainMax, int scaleType) {
  if (scaleType == SCALE_TYPE_LOG) {
    float logMin = log2(max(domainMin, 1.0));
    float logMax = log2(max(domainMax, 1.0));
    float logScore = log2(max(score, 1.0));
    return clamp((logScore - logMin) / (logMax - logMin), 0.0, 1.0);
  }
  return clamp((score - domainMin) / (domainMax - domainMin), 0.0, 1.0);
}

[shader("vertex")]
VsOut vs_main(ManhattanInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  // Two-triangle quad: x=0 when v in {0,2,3}, y=0 when v in {0,1,4}
  bool xZero = (v == 0u || v == 2u || v == 3u);
  bool yZero = (v == 0u || v == 1u || v == 4u);
  float qx = xZero ? 0.0 : 1.0;
  float qy = yZero ? 0.0 : 1.0;
  float2 local = float2(qx, qy) * 2.0 - float2(1.0, 1.0);

  float centerClipX = hpToClipX(hpSplitUint(inst.absPosition), u.bpRangeX, u.zero);
  float scoreNorm = normalizeScore(inst.score, u.domainYMin, u.domainYMax, u.scaleType);
  float scoreYPx = (1.0 - scoreNorm) * u.canvasHeight;
  float centerClipY = yPxToClipY(scoreYPx, u.canvasHeight);

  float dx = local.x * u.pointRadius * 2.0 / u.viewportWidth;
  float dy = local.y * u.pointRadius * 2.0 / u.canvasHeight;

  VsOut o;
  o.position = float4(lerp(centerClipX, -centerClipX, u.reversed) + dx, centerClipY + dy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  o.localPos = local;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (length(fragIn.localPos) > 1.0) discard;
  return fragIn.color;
}
