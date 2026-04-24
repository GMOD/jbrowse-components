// Linear-synteny fill pass. Each instance is a parallelogram (or Hermite-
// curve quad) between two assemblies; tessellation + Hermite math lives in
// syntenyTypes.slang (shared with syntenyPicking.slang).
//! targets: wgsl, glsl

import colorPack;
import syntenyTypes;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float featureId : COLOR1;
  // side interpolates 0 at the left edge to 1 at the right edge of the
  // trapezoid, continuously across the 16 stacked segments (left/right
  // align between adjacent segments). Used for analytic edge AA in the
  // fragment — MSAA alone misses shallow diagonals on steep trapezoids.
  float side : COLOR2;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.queryTotalLength, u)) {
    o.position = float4(0.0);
    o.side = 0.0;
    return o;
  }

  float t, side;
  computeFillSegmentT(vid, c, t, side);
  float3 e = hermiteEdges(c, t, u);
  // SYNC: matches widenCorners() in Canvas2DSyntenyRenderer.ts. Both
  // backends enforce the same slope-aware minimum horizontal width so
  // sub-pixel trapezoids render at consistent visual density. If you change
  // this formula, change it there too — there's no shared source.
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
  o.side = side;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float3 rgb = fragIn.color.rgb;
  bool isHovered = u.hoveredFeatureId > 0.0 && abs(fragIn.featureId - u.hoveredFeatureId) < 0.5;
  float baseAlpha = fragIn.color.a * u.alpha;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  if (isHovered) {
    rgb = rgb * 0.7;
  }
  return float4(rgb, finalAlpha);
}
