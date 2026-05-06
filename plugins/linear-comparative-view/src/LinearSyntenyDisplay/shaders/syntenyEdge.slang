// Linear-synteny edge pass. Draws a 1px antialiased outline around the
// currently-clicked alignment (skips all other instances via early-out).
// Tessellates each top/bottom edge into BEZIER_SEGMENTS pieces and expands along
// the edge normal by STROKE_WIDTH/2 to get a screen-space thickness.
//! targets: wgsl, glsl

import syntenyTypes;


public static const uint VERTS_PER_INSTANCE = 2u * 16u * 6u; // 2 edges * BEZIER_SEGMENTS * 6 verts
static const float STROKE_WIDTH = 1.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float  dist     : COLOR0;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.dist = 0.0;

  bool isClicked = u.clickedFeatureId > 0.0 && abs(inst.featureId - u.clickedFeatureId) < 0.5;
  if (!isClicked) {
    o.position = float4(0.0);
    return o;
  }

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.queryTotalLength, u)) {
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

  float edge0_x, edge1_x, y;
  float2 tangent;

  if (u.isCurve > 0.5) {
    float s = t * t * (3.0 - 2.0 * t);
    edge0_x = lerp(c.x1, c.x4, s);
    edge1_x = lerp(c.x2, c.x3, s);
    y = u.yTop + u.height * (1.5 * t * (1.0 - t) + t * t * t);
    float sPrime = 6.0 * t * (1.0 - t);
    float dy = u.height * 1.5 * (1.0 - 2.0 * t * (1.0 - t));
    float dx = edgeIdx == 1u ? sPrime * (c.x3 - c.x2) : sPrime * (c.x4 - c.x1);
    tangent = float2(dx, dy);
  } else {
    edge0_x = lerp(c.x1, c.x4, t);
    edge1_x = lerp(c.x2, c.x3, t);
    y = u.yTop + t * u.height;
    float dx = edgeIdx == 1u ? c.x3 - c.x2 : c.x4 - c.x1;
    tangent = float2(dx, u.height);
  }

  float edgeX = edgeIdx == 1u ? edge1_x : edge0_x;
  float tangentLen = length(tangent);
  float2 normal;
  if (tangentLen > 0.001) {
    float2 rawNormal = float2(-tangent.y, tangent.x) / tangentLen;
    float outwardSign = (edgeIdx == 0u ? -1.0 : 1.0) * sign(c.x1 - c.x2);
    normal = rawNormal * outwardSign;
  } else {
    normal = float2(0.0, 1.0);
  }

  float2 pos = float2(edgeX, y) + normal * side * STROKE_WIDTH;
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
