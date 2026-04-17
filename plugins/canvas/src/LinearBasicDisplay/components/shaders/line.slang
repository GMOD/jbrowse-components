// Thin 1px horizontal line connecting rects within a feature (introns).
// Instance data shared with chevron.slang — see lineInstance.slang.
//! targets: wgsl, glsl

import hpmath;
import lineInstance;

float4 unpackRGBA(uint c) {
  return float4(
    float((c >>  0u) & 0xFFu),
    float((c >>  8u) & 0xFFu),
    float((c >> 16u) & 0xFFu),
    float((c >> 24u) & 0xFFu)) / 255.0;
}

struct Uniforms {
  float3 bpRangeX;
  uint   regionStart;
  float  canvasHeight;
  float  canvasWidth;
  float  scrollY;
  float  bpPerPx;
  float  zero;
  float  reversed;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  uint absStart = inst.startEnd.x + u.regionStart;
  uint absEnd   = inst.startEnd.y + u.regionStart;
  float sx1 = hpToClipX(hpSplitUint(absStart), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(absEnd),   u.bpRangeX, u.zero);

  float yPx = floor(inst.y - u.scrollY + 0.5) + 0.5;
  float cy = 1.0 - (yPx / u.canvasHeight) * 2.0;
  float halfPx = 1.0 / u.canvasHeight;

  float localX = (v == 0u || v == 2u || v == 3u) ? 0.0 : 1.0;
  float localY = (v == 0u || v == 1u || v == 4u) ? 0.0 : 1.0;
  float sx = lerp(sx1, sx2, localX);
  float sy = lerp(cy - halfPx, cy + halfPx, localY);

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
