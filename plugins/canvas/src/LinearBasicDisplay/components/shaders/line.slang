// Thin 1px horizontal line connecting rects within a feature (introns).
// Instance data shared with chevron.slang — see lineInstance.slang.
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import lineInstance;
import canvasUniforms;

[[vk::binding(1, 0)]] ConstantBuffer<CanvasUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  float sx1 = hpToClipX(hpSplitUint(inst.startEnd.x), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(inst.startEnd.y), u.bpRangeX, u.zero);

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
