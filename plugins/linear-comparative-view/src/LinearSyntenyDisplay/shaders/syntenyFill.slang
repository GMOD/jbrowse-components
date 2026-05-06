// Linear-synteny fill pass. Each instance is a parallelogram (or Hermite-
// curve quad) between two assemblies; tessellation + Hermite math lives in
// syntenyTypes.slang (shared with syntenyPicking.slang).
//! targets: wgsl, glsl

import colorPack;
import syntenyTypes;


// SYNC: 16 must equal BEZIER_SEGMENTS in syntenyTypes.slang (not resolved via
// codegen — cross-module import resolution in build-shaders.ts adds complexity
// disproportionate to the benefit)
public static const uint VERTS_PER_INSTANCE = 16u * 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Ribbons thinner than this in screen-perpendicular pixels switch to line mode:
// collapse to centerline + expand ±1px along normal + SDF AA in fragment.
// Canvas2D gets equivalent quality from its built-in path AA.
static const float LINE_PERP_THRESHOLD = 2.0;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float featureId : COLOR1;
  // lineMode: 0 = fill, 1 = line. lineDist is the signed perp dist from
  // centerline (±1px); fragment uses it for SDF AA only in line mode.
  float                 lineDist : COLOR2;
  nointerpolation float lineMode : COLOR3;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;
  o.lineDist  = 0.0;
  o.lineMode = 0.0;

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.queryTotalLength, u)) {
    o.position = float4(0.0);
    return o;
  }

  float t, side;
  computeFillSegmentT(vid, c, t, side);
  float3 e = hermiteEdges(c, t, u);
  float edge0 = e.x, edge1 = e.y, y = e.z;

  float centerDx = (c.x3 + c.x4 - c.x1 - c.x2) * 0.5;
  float edgeLen  = length(float2(centerDx, u.height));

  // Perpendicular width = horizontal_width × cos(edge_angle) = w × height / edgeLen.
  float w        = abs(edge0 - edge1);
  float perpWidth = w * u.height / max(edgeLen, 1.0);

  if (perpWidth < LINE_PERP_THRESHOLD) {
    // Line mode: collapse to centerline and expand ±1px along the edge normal.
    // The fragment clips to halfW=0.5 with SDF AA, matching how syntenyEdge
    // draws its click outline — Canvas2D path fill gives equivalent quality
    // for thin ribbons via its built-in coverage AA.
    float centerX = (edge0 + edge1) * 0.5;
    float2 tangent = edgeTangent(centerDx, t, u);
    float tangentLen = length(tangent);
    float2 normal = tangentLen > 0.001
      ? float2(-tangent.y, tangent.x) / tangentLen
      : float2(0.0, 1.0);
    float lineSide = side > 0.5 ? 1.0 : -1.0;
    float2 pos = float2(centerX, y) + normal * lineSide;
    o.lineDist  = lineSide;
    o.lineMode = 1.0;
    float2 clipSpace = pos / u.resolution * 2.0 - 1.0;
    o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
    return o;
  }

  // Fill mode: standard ribbon geometry.
  // SYNC: matches widenCorners() in syntenyPickEngine.ts. Both must stay in
  // step so Canvas2D/SVG pick outlines and GPU fills look identical.
  float slope = abs(centerDx) / max(u.height, 1.0);
  float minW  = min(1.0 + max(0.0, slope - 1.0) * 0.25, 3.0);
  if (w < minW) {
    float mid  = (edge0 + edge1) * 0.5;
    float half = edge0 < edge1 ? -minW * 0.5 : minW * 0.5;
    edge0 = mid + half;
    edge1 = mid - half;
  }
  float edgeX = side > 0.5 ? edge1 : edge0;
  float2 clipSpace = float2(edgeX, y) / u.resolution * 2.0 - 1.0;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float3 rgb = fragIn.color.rgb;
  // SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
  // Canvas2DSyntenyRenderer.ts's hover branch so the highlight looks
  // identical across all backends.
  bool isHovered = u.hoveredFeatureId > 0.0 && abs(fragIn.featureId - u.hoveredFeatureId) < 0.5;
  float baseAlpha = fragIn.color.a * u.alpha;
  rgb *= isHovered ? 0.7 : 1.0;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  if (fragIn.lineMode > 0.0) {
    float d  = abs(fragIn.lineDist);
    float aa = fwidth(fragIn.lineDist);
    finalAlpha *= 1.0 - smoothstep(0.5 - aa * 0.5, 0.5 + aa, d);
  }
  return float4(rgb, finalAlpha);
}
