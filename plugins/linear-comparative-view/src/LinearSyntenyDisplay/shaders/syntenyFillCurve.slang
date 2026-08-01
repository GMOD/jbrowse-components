// Linear-synteny fill pass — curved (bezier ribbon) mode.
//
// Geometry: 8 segments × 6 verts = 48 verts/instance. Each segment is a
// trapezoid (TL, TR, BR, BL) hugging the local bezier strip with a small
// perpendicular pad to allow stroke widening for thin features, bezier
// bulge within the segment, and AA fade at boundaries. This keeps the
// rasterized fragment count proportional to ribbon area + boundary AA —
// roughly the same fragment budget as Canvas2D path fill — rather than the
// `corner_bbox × h` overdraw a single-quad bound suffered for slanted
// ribbons.
//
// Fragment: inverts y(t) = h·(1.5t(1-t) + t³) via 2 Newton iterations
// (cubic convergence — sub-pixel accuracy from t₀ = y/h), then hands the
// resulting bezier basis to the shared fillFs (syntenyTypes), which evaluates
// the two edge x-curves, takes each edge's signed perpendicular distance, and
// outputs analytic coverage. BASE ribbons and CIGAR indel tiles run the
// identical path.
//
// References:
//   developer.nvidia.com/gpugems/gpugems3 chapter 25 (Loop-Blinn)
//   drewcassidy.me/2020/06/26/sdf-antialiasing/  (SDF AA)
//! targets: wgsl, glsl

import syntenyTypes;

// Tessellation count: 8 segments × 6 verts each. Both BASE ribbons and CIGAR
// indel tiles pad the polygon by the per-segment bezier bulge and clip to the
// true bezier analytically in the fragment (fillCoverage), so the visible edge
// is the smooth curve regardless of N — 8 is plenty. (An earlier attempt drew
// indel tiles from the raw chord geometry to get MSAA seam-tiling, but the
// chords visibly faceted slanted ribbons, so indels went back on the analytic
// curve.) Bezier bulge within one segment is bounded by max|s''|·(dt²/8) =
// 6·(1/8)²/8 ≈ 0.012 in s-units, i.e. ~2.3px for a ribbon spanning 200px
// horizontally — the pad's bulgeX term covers it. Halving to 4 makes the bulge
// term dominate the pad; doubling to 16 gives diminishing returns.
public static const uint NUM_SEGMENTS = 8u;
public static const uint VERTS_PER_INSTANCE = NUM_SEGMENTS * 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

[shader("vertex")]
FillVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  FillVsOut o;
  Corners c;
  if (!fillVsBegin(inst, u, o, c)) {
    return o;
  }

  uint seg = vid / 6u;
  uint vertInSeg = vid % 6u;
  // Vert layout per segment: 0=TL, 1=TR, 2=BL, 3=BL, 4=TR, 5=BR.
  // Triangles (TL, TR, BL) and (BL, TR, BR).
  bool isTop = (vertInSeg == 0u || vertInSeg == 1u || vertInSeg == 4u);
  bool isRight = (vertInSeg == 1u || vertInSeg == 4u || vertInSeg == 5u);

  float invN = 1.0 / float(NUM_SEGMENTS);
  float t0 = float(seg) * invN;
  float t1 = float(seg + 1u) * invN;
  float t = isTop ? t0 : t1;

  float2 span = edgeSpan(c, sBlend(t));
  float y = u.height * yCurve(t);

  // Perpendicular pad (in horizontal pixels). Accommodates:
  //   (1) the AA ramp's perpendicular half-pixel: perpFactor·0.5, at THIS
  //       segment's steepest slope.
  //   (2) perpCoverage's sub-pixel `expand`, via thinRibbonPad — zero for any
  //       ribbon wider than perpFactor px, so it costs the common case nothing.
  //   (3) bezier bulge within the segment: max|s''|·dt²/8 in s-units, scaled
  //       by max edge Δ.
  //   (4) AA fade at the boundary: 1 px.
  //
  // Term (1) is per-segment. It used to use the ribbon-wide maximum, which
  // over-pads every segment but the middle one: local dx/dy peaks at 2× the
  // chord slope only near t=0.5, and falls to 0 at the ends where the x-curve
  // is momentarily vertical. Bounding it per segment is exact (the ratio below
  // is unimodal, so its max over the segment is a single evaluation) and cuts
  // the rasterized-then-discarded area of a thin steep ribbon by a measured
  // 10-17% (`syntenyFillPad.test.ts` computes both).
  //
  // Term (3) is deliberately still the ribbon-wide bound. Do NOT try to make it
  // per-segment via |s''(t)| = |6-12t| (which is 0 at t=0.5, so it looks like
  // free savings): that bounds the curve's deviation from its chord in *t*, but
  // this quad interpolates x linearly in *screen y*, and y(t) is itself
  // nonlinear, so the y-reparameterization adds deviation the t-chord bound
  // misses. It under-pads for real — corners (0, 300, 1400, 1500) at h=400
  // clip the analytic edge by 0.27px. The test pins that counterexample.
  //
  // CIGAR indel tiles use the same pad as BASE — they clip to the smooth
  // analytic curve in the fragment, not to this trapezoid geometry.
  //
  // The pad protects the EDGES, so it scales with the larger edge Δ, not the
  // centerline's (they differ on a width-changing ribbon, where the centerline
  // average under-pads the wider edge).
  float maxEdgeDx = max(abs(c.x4 - c.x1), abs(c.x3 - c.x2));
  // dx/dy = (Δ/h)·sBlendDeriv(t)/yCurveDeriv(t). That ratio is unimodal with
  // its peak of 2.0 at t=0.5, so its maximum over the segment is at whichever
  // in-range t sits closest to 0.5.
  float tPeak = clamp(0.5, t0, t1);
  float segSlope = maxEdgeDx / u.height * sBlendDeriv(tPeak)
                 / yCurveDeriv(tPeak);
  float perpFactor = sqrt(1.0 + segSlope * segSlope);
  float bulgeX = maxEdgeDx * invN * invN * 0.75;
  float pad = perpFactor * 0.5 + thinRibbonPad(perpFactor, c) + bulgeX + 1.0;

  // AA y-pad only at the first segment's top and last segment's bottom; the
  // shared boundaries between adjacent segments must match exactly.
  if (seg == 0u && isTop) { y -= 1.0; }
  if (seg == NUM_SEGMENTS - 1u && !isTop) { y += 1.0; }

  fillVsEmit(o, isRight ? span.y + pad : span.x - pad, y, u);
  return o;
}

[shader("fragment")]
float4 fs_main(FillVsOut fragIn) : SV_Target {
  float yFrac = clamp(fragIn.localPos.y / u.height, 0.0, 1.0);

  // Recover bezier parameter t from the fragment's y position. 2 Newton
  // iterations on the strictly-monotonic y(t) = h·(t³ − 1.5t² + 1.5t)
  // converge to sub-pixel accuracy from t₀ = yFrac (f' ≥ 0.75 on [0,1]).
  float t = yFrac;
  for (int i = 0; i < 2; i++) {
    t = t - (yCurve(t) - yFrac) / yCurveDeriv(t);
  }
  t = clamp(t, 0.0, 1.0);

  // Curved ribbon: X-blend is the cubic smoothstep and y traces the
  // ease-in-out, so each edge gets its OWN dx/dy from those analytic
  // derivatives — per-edge rather than a shared centerline slope, which is what
  // keeps a width-changing / bent ribbon's coverage transition crisp (see
  // perpCoverage).
  return fillFs(fragIn, sBlend(t), sBlendDeriv(t),
                u.height * yCurveDeriv(t), u);
}
