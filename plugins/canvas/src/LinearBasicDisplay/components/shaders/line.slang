// Thin 1px horizontal line connecting rects within a feature (introns).
// Instance data shared with chevron.slang — see lineInstance.slang.
//! targets: wgsl, glsl

import hpmath;
import colorPack;
import lineInstance;
import canvasUniforms;


public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<CanvasUniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

[shader("vertex")]
VsOut vs_main(LineInstance inst, uint vid : SV_VertexID) {
  float sx1 = hpToClipX(hpSplitUint(inst.startEnd.x), u.bpRangeX, u.zero);
  float sx2 = hpToClipX(hpSplitUint(inst.startEnd.y), u.bpRangeX, u.zero);

  float yPx = floor(inst.y - u.scrollY + 0.5) + 0.5;
  float cy = yPxToClipY(yPx, u.canvasHeight);
  float halfPx = 1.0 / u.canvasHeight;

  float2 q = quadLocal(vid);
  float sx = lerp(sx1, sx2, q.x);
  float sy = lerp(cy - halfPx, cy + halfPx, q.y);

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = unpackRGBA(inst.color);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return fragIn.color;
}
