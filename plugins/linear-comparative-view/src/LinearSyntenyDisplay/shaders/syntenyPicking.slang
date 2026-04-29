// Linear-synteny picking pass. Same tessellation as the fill pass (shared in
// syntenyTypes.slang); fragment encodes featureId as RGB bytes so the CPU
// can read it back from the picking framebuffer. Rendered with blend off
// and `picking: true`.
//! targets: wgsl, glsl

import syntenyTypes;


public static const uint VERTS_PER_INSTANCE = 16u * 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  nointerpolation float featureId : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.featureId = inst.featureId;

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.queryTotalLength, u)) {
    o.position = float4(0.0);
    return o;
  }

  float t, side;
  computeFillSegmentT(vid, c, t, side);
  float3 e = hermiteEdges(c, t, u);
  // SYNC: identical to syntenyFill.slang and widenCorners() in
  // Canvas2DSyntenyRenderer.ts — picking geometry must match visible geometry
  // so widened sub-pixel features remain GPU-pickable.
  float w = abs(e.x - e.y);
  float topMid = (c.x1 + c.x2) * 0.5;
  float botMid = (c.x3 + c.x4) * 0.5;
  float slope = abs(botMid - topMid) / max(u.height, 1.0);
  float minW = min(1.0 + max(0.0, slope - 1.0) * 0.25, 3.0);
  if (w < minW) {
    float mid = (e.x + e.y) * 0.5;
    float half = e.x < e.y ? -minW * 0.5 : minW * 0.5;
    e.x = mid + half;
    e.y = mid - half;
  }
  float edgeX = side > 0.5 ? e.y : e.x;
  float2 clipSpace = float2(edgeX, e.z) / u.resolution * 2.0 - 1.0;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  uint id = uint(fragIn.featureId);
  return float4(
    float(id & 0xFFu) / 255.0,
    float((id >> 8u) & 0xFFu) / 255.0,
    float((id >> 16u) & 0xFFu) / 255.0,
    1.0);
}
