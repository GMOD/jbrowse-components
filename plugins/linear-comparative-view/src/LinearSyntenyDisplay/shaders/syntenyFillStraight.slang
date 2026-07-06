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
  // 1.0 if this instance is a CIGAR indel tile. Indel tiles share the analytic
  // edge + smoothstep AA path with BASE ribbons (smooth curve, antialiased
  // edges); the flag only switches shading — the white pre-blend in shadeFill
  // and skipping the density width-fade in fillCoverage. 0.0 for whole-feature
  // BASE instances.
  nointerpolation float isCigar : COLOR4;
  // 1.0 for a KIND_MARKER tick (zero-width context line). Skips the sub-pixel
  // width fade and global-alpha shading so it stays a crisp fixed-alpha line.
  nointerpolation float isMarker : COLOR5;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  o.color = unpackRGBA(inst.color);
  o.featureId = inst.featureId;
  o.corners = float4(0.0);
  o.localPos = float2(0.0);
  o.isCigar = isCigarKind(inst.kind) ? 1.0 : 0.0;
  o.isMarker = isMarkerKind(inst.kind) ? 1.0 : 0.0;

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
  // CIGAR indel tiles use the same padded polygon as BASE — they share the
  // analytic edge + smoothstep AA path (fillCoverage), so their perpendicular
  // edges antialiase against the base block instead of stair-stepping.
  float slope = abs((c.x3 + c.x4 - c.x1 - c.x2) * 0.5) / h;
  float perpFactor = sqrt(1.0 + slope * slope);
  float pad = perpFactor * 0.5 + 1.0;

  float y = isTop ? -1.0 : h + 1.0;

  float vx = isRight ? (xR + pad) : (xL - pad);
  o.localPos = float2(vx, y);

  o.position = screenToClip(float2(vx, u.yTop + y), u.resolution);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float yLocal = fragIn.localPos.y;
  float h = max(u.height, 1.0);
  float t = clamp(yLocal / h, 0.0, 1.0);

  // Straight ribbon: X-blend is linear (s=t), y is linear (dydt=h, sd=1), so
  // each edge's slope is just its constant top-to-bottom dx over h. fillEdges
  // handles the min/max-free edge lerp + per-edge foreshortening (see
  // perpCoverage) uniformly for forward and crossed/inverted (bowtie) ribbons.
  FillEdges e = fillEdges(fragIn.corners, t, 1.0, h);

  float coverage = fillCoverage(fragIn.localPos, e.edge0, e.edge1, e.pf0, e.pf1,
                                fragIn.isCigar, fragIn.isMarker, h,
                                u.fadeThinAlignments);
  if (coverage <= 0.0) { discard; }
  return shadeFill(fragIn.color, fragIn.featureId, coverage, fragIn.isCigar,
                   fragIn.isMarker, u);
}
