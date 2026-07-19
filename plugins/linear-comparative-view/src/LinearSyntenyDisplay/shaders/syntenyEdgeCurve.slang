// Linear-synteny edge pass — curved (bezier ribbon) mode. Draws a 1px
// antialiased outline around the currently-clicked alignment, tessellating
// each top/bottom edge into NUM_SEGMENTS pieces and expanding along the
// edge normal by STROKE_WIDTH/2.
//! targets: wgsl, glsl

import syntenyTypes;

// Higher than fill-curve's 8 segments: a thin stroke exposes bezier-vs-chord
// deviation that the fill pass's perpendicular pad otherwise absorbs.
public static const uint NUM_SEGMENTS = 16u;
public static const uint VERTS_PER_INSTANCE = 2u * NUM_SEGMENTS * 6u;
static const float STROKE_WIDTH = 1.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float  dist     : COLOR0;
};

// Hermite ease-in-out: (edge0, edge1, y) at parameter t along the ribbon.
float3 hermiteEdges(Corners c, float t) {
  float s = sBlend(t);
  return float3(
    lerp(c.x1, c.x4, s),
    lerp(c.x2, c.x3, s),
    u.yTop + u.height * yCurve(t)
  );
}

// Tangent at t for an edge whose top-to-bottom horizontal delta is `dx`.
// sBlendDeriv scales dx; dy comes from the y-curve derivative.
float2 edgeTangent(float dx, float t) {
  return float2(sBlendDeriv(t) * dx, u.height * yCurveDeriv(t));
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.dist = 0.0;

  // Only outline the clicked feature's BASE silhouette — never per-CIGAR-tile
  // instances (kind >= 3.0, would outline every M/I/D/N tile) nor KIND_MARKER
  // context ticks (interior lines, not part of the silhouette).
  bool isClicked = u.clickedFeatureId > 0.0 && abs(inst.featureId - u.clickedFeatureId) < 0.5;
  if (!isClicked || isCigarKind(inst.kind) || isMarkerKind(inst.kind)) {
    o.position = float4(0.0);
    return o;
  }

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.alignmentLength, u)) {
    o.position = float4(0.0);
    return o;
  }

  uint vertsPerEdge = NUM_SEGMENTS * 6u;
  uint edgeIdx = vid / vertsPerEdge;
  uint vidInEdge = vid % vertsPerEdge;
  uint seg = vidInEdge / 6u;
  uint vertInSeg = vidInEdge % 6u;
  float t0 = float(seg) / float(NUM_SEGMENTS);
  float t1 = float(seg + 1u) / float(NUM_SEGMENTS);

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
  float2 normal = edgeNormal(edgeTangent(rawDx, t));

  float2 pos = float2(edgeX, e.z) + normal * side * STROKE_WIDTH;
  o.dist = side * STROKE_WIDTH;
  o.position = screenToClip(pos, u.resolution);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  return edgeStrokeColor(fragIn.dist);
}
