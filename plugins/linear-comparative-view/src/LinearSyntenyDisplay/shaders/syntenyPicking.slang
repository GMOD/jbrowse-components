// Linear-synteny picking pass. Same tessellation as the fill pass (shared in
// syntenyTypes.slang); fragment encodes featureId as RGB bytes so the CPU
// can read it back from the picking framebuffer. Rendered with blend off
// and `picking: true`.
//! targets: wgsl, glsl

import syntenyTypes;

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
  float3 e = hermiteEdges(c, t, inst.isCurve, u);
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
