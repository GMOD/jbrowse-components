// Linear-synteny edge pass — curved (bezier ribbon) mode. Draws a 1px
// antialiased outline around the currently-clicked alignment, tessellating
// each top/bottom edge into BEZIER_SEGMENTS pieces and expanding along the
// edge normal by STROKE_WIDTH/2.
//! targets: wgsl, glsl

import syntenyTypes;

public static const uint VERTS_PER_INSTANCE = 2u * 16u * 6u;
static const float STROKE_WIDTH = 1.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float  dist     : COLOR0;
};

// Hermite ease-in-out: (edge0, edge1, y) at parameter t along the ribbon.
float3 hermiteEdges(Corners c, float t) {
  float s = t * t * (3.0 - 2.0 * t);
  return float3(
    lerp(c.x1, c.x4, s),
    lerp(c.x2, c.x3, s),
    u.yTop + u.height * (1.5 * t * (1.0 - t) + t * t * t)
  );
}

// Tangent at t for an edge whose top-to-bottom horizontal delta is `dx`.
// sPrime scales dx; dy comes from the y-curve derivative.
float2 edgeTangent(float dx, float t) {
  float sPrime = 6.0 * t * (1.0 - t);
  float dy = u.height * 1.5 * (1.0 - 2.0 * t * (1.0 - t));
  return float2(sPrime * dx, dy);
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.dist = 0.0;

  // Only outline the clicked feature, and only its BASE/BASE_HIDDEN/MARKER
  // instances — never the per-CIGAR-tile instances (kind >= 3.0), which
  // would otherwise outline every M/I/D/N tile inside the feature.
  bool isClicked = u.clickedFeatureId > 0.0 && abs(inst.featureId - u.clickedFeatureId) < 0.5;
  if (!isClicked || inst.kind >= 3.0) {
    o.position = float4(0.0);
    return o;
  }

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.alignmentLength, u)) {
    o.position = float4(0.0);
    return o;
  }

  uint vertsPerEdge = BEZIER_SEGMENTS * 6u;
  uint edgeIdx = vid / vertsPerEdge;
  uint vidInEdge = vid % vertsPerEdge;
  uint seg = vidInEdge / 6u;
  uint vertInSeg = vidInEdge % 6u;
  float t0 = float(seg) / float(BEZIER_SEGMENTS);
  float t1 = float(seg + 1u) / float(BEZIER_SEGMENTS);

  float t, side;
  switch (vertInSeg) {
    case 0u: { t = t0; side = -1.0; break; }
    case 1u: { t = t0; side =  1.0; break; }
    case 2u: { t = t1; side = -1.0; break; }
    case 3u: { t = t1; side = -1.0; break; }
    case 4u: { t = t0; side =  1.0; break; }
    case 5u: { t = t1; side =  1.0; break; }
    default: { t = 0.0; side = 0.0; break; }
  }

  float3 e = hermiteEdges(c, t);
  float edgeX = edgeIdx == 1u ? e.y : e.x;
  float rawDx = edgeIdx == 1u ? c.x3 - c.x2 : c.x4 - c.x1;
  float2 tangent = edgeTangent(rawDx, t);
  float tangentLen = length(tangent);
  float2 normal;
  if (tangentLen > 0.001) {
    float2 rawNormal = float2(-tangent.y, tangent.x) / tangentLen;
    float outwardSign = (edgeIdx == 0u ? -1.0 : 1.0) * (c.x1 >= c.x2 ? 1.0 : -1.0);
    normal = rawNormal * outwardSign;
  } else {
    normal = float2(0.0, 1.0);
  }

  float2 pos = float2(edgeX, e.z) + normal * side * STROKE_WIDTH;
  o.dist = side * STROKE_WIDTH;
  float2 clipSpace = pos / u.resolution * 2.0 - 1.0;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float d = abs(fragIn.dist);
  float aa = fwidth(fragIn.dist);
  float halfW = STROKE_WIDTH * 0.5;
  float edgeAlpha = 1.0 - smoothstep(halfW - aa * 0.5, halfW + aa, d);
  return float4(0.0, 0.0, 0.0, edgeAlpha * 0.4);
}
