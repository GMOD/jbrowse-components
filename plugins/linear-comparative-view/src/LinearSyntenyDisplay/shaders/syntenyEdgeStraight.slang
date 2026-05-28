// Linear-synteny edge pass — straight-line mode. Draws a 1px antialiased
// outline around the currently-clicked alignment (skips all other instances
// via early-out). Each edge is a single straight line from
// (top-corner, yTop) to (bottom-corner, yBottom), expanded along the edge
// normal by STROKE_WIDTH/2 — no tessellation needed.
//! targets: wgsl, glsl

import syntenyTypes;

// 2 edges × 6 verts each (single line-quad per edge).
public static const uint VERTS_PER_INSTANCE = 12u;
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

  uint edgeIdx = vid / 6u;
  uint vertInQuad = vid % 6u;
  // Quad layout: (t0,-) (t0,+) (t1,-) (t1,-) (t0,+) (t1,+).
  bool atBottom = (vertInQuad == 2u || vertInQuad == 3u || vertInQuad == 5u);
  bool sidePos  = (vertInQuad == 1u || vertInQuad == 4u || vertInQuad == 5u);
  float side = sidePos ? 1.0 : -1.0;

  // Edge 0: c.x1 (top) → c.x4 (bottom). Edge 1: c.x2 → c.x3.
  float xTop = edgeIdx == 1u ? c.x2 : c.x1;
  float xBot = edgeIdx == 1u ? c.x3 : c.x4;
  float edgeX = atBottom ? xBot : xTop;
  float edgeY = u.yTop + (atBottom ? u.height : 0.0);

  // Outward normal to the line (xTop, yTop) → (xBot, yBottom). Edge 0
  // points to the left of the ribbon, edge 1 to the right; flip if the
  // top corners are crossed.
  float2 tangent = float2(xBot - xTop, u.height);
  float tangentLen = length(tangent);
  float2 normal = tangentLen > 0.001
    ? float2(-tangent.y, tangent.x) / tangentLen
    : float2(0.0, 1.0);
  float outwardSign = (edgeIdx == 0u ? -1.0 : 1.0) * (c.x1 >= c.x2 ? 1.0 : -1.0);
  normal *= outwardSign;

  float2 pos = float2(edgeX, edgeY) + normal * side * STROKE_WIDTH;
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
