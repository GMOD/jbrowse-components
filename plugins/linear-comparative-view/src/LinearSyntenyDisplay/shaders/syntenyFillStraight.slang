// Linear-synteny fill pass — straight-line (parallelogram) mode.
//
// Geometry: one quad (6 verts) per instance, snapping to the trapezoid
// (x1,yTop)-(x2,yTop)-(x3,yBottom)-(x4,yBottom) with a small perpendicular
// pad to accommodate stroke widening for sub-pixel-thin features and a 1px
// AA fade at top/bottom. No tessellation, no Newton — the four corners are
// the ribbon.
//
// Fragment: linear lerp of the two edges by yFrac, signed perpendicular
// distance to the centerline, SDF antialiasing via fwidth(perpDist).
// Geometrically correct AA at any slope (including near-horizontal strokes
// that would otherwise sub-pixel-beat into dashes with per-x-axis AA).
//! targets: wgsl, glsl

import colorPack;
import syntenyTypes;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  nointerpolation float featureId : COLOR1;
  // Per-instance corner positions in CSS-pixel screen X.
  // (x1, x2) belong to the top view; (x3, x4) to the bottom.
  nointerpolation float4 corners : COLOR2;
  // Local position within the instance: localPos.x = screen X (CSS px),
  // localPos.y = vertical offset from yTop in CSS px (≈[0, height], slightly
  // extended at top/bottom for AA fade).
  float2 localPos : COLOR3;
  // 1.0 if this instance is a CIGAR tile (shares slanted edges with sibling
  // CIGAR instances of the same feature, so perpendicular smoothstep AA
  // double-fades the seam and bleeds bg through); 0.0 for whole-feature BASE
  // instances whose perpendicular edges are silhouette and need full AA.
  nointerpolation float isCigar : COLOR4;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;
  o.corners = float4(0.0);
  o.localPos = float2(0.0);
  // KIND_BASE=0, KIND_BASE_HIDDEN=1, KIND_MARKER=2, KIND_CIGAR_*=3..7. Anything
  // >= 3 is a CIGAR tile that needs hard-cut perpendicular coverage.
  o.isCigar = inst.kind >= 3.0 ? 1.0 : 0.0;

  Corners c = computeCorners(inst, u);
  if (isCulled(c, inst.alignmentLength, u)) {
    o.position = float4(0.0);
    return o;
  }
  o.corners = float4(c.x1, c.x2, c.x3, c.x4);

  // Vert layout: 0=TL, 1=TR, 2=BL, 3=BL, 4=TR, 5=BR.
  // Triangles (TL, TR, BL) and (BL, TR, BR).
  bool isTop = (vid == 0u || vid == 1u || vid == 4u);
  bool isRight = (vid == 1u || vid == 4u || vid == 5u);

  float h = max(u.height, 1.0);
  // x at this end of the ribbon (top or bottom edge of the trapezoid).
  float xL = isTop ? min(c.x1, c.x2) : min(c.x4, c.x3);
  float xR = isTop ? max(c.x1, c.x2) : max(c.x4, c.x3);

  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) thin-feature stroke widening: perpFactor·0.5 (1-px perpendicular
  //       stroke projected onto the x-axis at this slope).
  //   (2) AA fade at the boundary: 1 px.
  // CIGAR tiles skip these so adjacent CIGAR polygons tile cleanly via the
  // rasterizer top-left rule with no smoothstep double-fade bleed.
  float slope = abs((c.x3 + c.x4 - c.x1 - c.x2) * 0.5) / h;
  float perpFactor = sqrt(1.0 + slope * slope);
  float pad = inst.kind >= 3.0 ? 0.0 : perpFactor * 0.5 + 1.0;

  float y = isTop ? -1.0 : h + 1.0;
  if (inst.kind >= 3.0) { y = isTop ? 0.0 : h; }

  float vx = isRight ? (xR + pad) : (xL - pad);
  o.localPos = float2(vx, y);

  float2 screen = float2(vx, u.yTop + y);
  float2 clipSpace = screen / u.resolution * 2.0 - 1.0;
  o.position = float4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float yLocal = fragIn.localPos.y;
  float h = max(u.height, 1.0);
  float t = clamp(yLocal / h, 0.0, 1.0);

  // Two edge x's at this y. Min/max handles forward + crossed/inverted
  // (bowtie) ribbons uniformly.
  float edge0 = lerp(fragIn.corners.x, fragIn.corners.w, t);  // c.x1 → c.x4
  float edge1 = lerp(fragIn.corners.y, fragIn.corners.z, t);  // c.x2 → c.x3
  float xL = min(edge0, edge1);
  float xR = max(edge0, edge1);
  float xC = (xL + xR) * 0.5;

  // Centerline slope dx/dy — constant across the instance for straight lines.
  float topMid = (fragIn.corners.x + fragIn.corners.y) * 0.5;
  float botMid = (fragIn.corners.z + fragIn.corners.w) * 0.5;
  float slope = (botMid - topMid) / h;
  float perpFactor = sqrt(1.0 + slope * slope);

  // SDF-based coverage. For thin features, clamp halfPerpW to 0.5 so the
  // rendered perpendicular width is at least 1 px. CIGAR tiles use a hard
  // step (no smoothstep) so adjacent tiles meet cleanly via the top-left
  // rule with no background bleed at shared seams.
  float perpDist = (fragIn.localPos.x - xC) / perpFactor;
  float halfPerpW = max((xR - xL) / (2.0 * perpFactor), 0.5);
  float cx;
  if (fragIn.isCigar > 0.5) {
    cx = abs(perpDist) <= halfPerpW ? 1.0 : 0.0;
  } else {
    float aaPerp = max(fwidth(perpDist), 1e-4);
    cx = 1.0 - smoothstep(halfPerpW - aaPerp * 0.5,
                          halfPerpW + aaPerp * 0.5,
                          abs(perpDist));
  }
  float ay = max(fwidth(yLocal), 1e-4) * 0.5;
  float cy = smoothstep(-ay, ay, yLocal)
           - smoothstep(h - ay, h + ay, yLocal);
  float coverage = cx * cy;
  if (coverage <= 0.0) { discard; }

  float3 rgb = fragIn.color.rgb;
  // SYNC: 0.7 darkening + 5x alpha boost capped at 0.35 must match
  // Canvas2DSyntenyRenderer.ts's hover branch.
  bool isHovered = u.hoveredFeatureId > 0.0 && abs(fragIn.featureId - u.hoveredFeatureId) < 0.5;
  float baseAlpha = fragIn.color.a * u.alpha;
  rgb *= isHovered ? 0.7 : 1.0;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  return float4(rgb, finalAlpha * coverage);
}
