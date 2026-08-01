// Linear-synteny fill pass — straight-line (parallelogram) mode.
//
// Geometry: one quad (6 verts) per instance, snapping to the trapezoid
// (x1,yTop)-(x2,yTop)-(x3,yBottom)-(x4,yBottom) with a small perpendicular
// pad to accommodate stroke widening for sub-pixel-thin features and a 1px
// AA fade at top/bottom. No tessellation, no Newton — the four corners are
// the ribbon.
//
// The varyings and the whole fragment come from syntenyTypes (shared with the
// curve pass): analytic per-edge SDF coverage, geometrically correct at any
// slope, including near-horizontal strokes that would otherwise sub-pixel-beat
// into dashes with per-x-axis AA.
//! targets: wgsl, glsl

import syntenyTypes;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

[shader("vertex")]
FillVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  FillVsOut o;
  Corners c;
  if (!fillVsBegin(inst, u, o, c)) {
    return o;
  }

  // Vert layout: 0=TL, 1=TR, 2=BL, 3=BL, 4=TR, 5=BR.
  // Triangles (TL, TR, BL) and (BL, TR, BR).
  bool isTop = (vid == 0u || vid == 1u || vid == 4u);
  bool isRight = (vid == 1u || vid == 4u || vid == 5u);

  // The ribbon's left/right x at this end of the trapezoid (s=0 top, s=1
  // bottom), ordered so a crossed ribbon still gets a forward-facing quad.
  float2 span = edgeSpan(c, isTop ? 0.0 : 1.0);

  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) the AA ramp's perpendicular half-pixel: perpFactor·0.5.
  //   (2) perpCoverage's sub-pixel `expand`, via thinRibbonPad — zero for any
  //       ribbon wider than perpFactor px.
  //   (3) AA fade at the boundary: 1 px.
  //
  // Term (1) scales with the slope of the STEEPER edge, not the centerline
  // average. The average under-pads whichever edge travels further on a
  // width-changing ribbon (measured: 0.94px of the AA ramp cropped on corners
  // (100, 900, 1200, 1180) at h=100, 4.5px on a crossed steep one), which is
  // the same reasoning that put maxEdgeDx in syntenyFillCurve's pad.
  //
  // CIGAR indel tiles use the same padded polygon as BASE — they share the
  // analytic edge + smoothstep AA path (fillCoverage), so their perpendicular
  // edges antialiase against the base block instead of stair-stepping.
  float slope = max(abs(c.x4 - c.x1), abs(c.x3 - c.x2)) / u.height;
  float perpFactor = sqrt(1.0 + slope * slope);
  float pad = perpFactor * 0.5 + thinRibbonPad(perpFactor, c) + 1.0;

  fillVsEmit(o,
             isRight ? span.y + pad : span.x - pad,
             isTop ? -1.0 : u.height + 1.0,
             u);
  return o;
}

[shader("fragment")]
float4 fs_main(FillVsOut fragIn) : SV_Target {
  // Straight ribbon: X-blend is linear (s=t) and so is y (sd=1, dydt=height),
  // so each edge's slope is just its constant top-to-bottom dx over the height.
  float t = clamp(fragIn.localPos.y / u.height, 0.0, 1.0);
  return fillFs(fragIn, t, 1.0, u.height, u);
}
