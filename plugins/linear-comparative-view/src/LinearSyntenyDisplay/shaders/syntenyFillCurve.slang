// Linear-synteny fill pass — curved (bezier ribbon) mode.
//
// The ribbon is the exact cubic bezier from (xTop, 0) to (xBot, h) with both
// control points at mid-height — the classic S-connector. Its two components
// are `sBlend` (= the bezier basis 3t²-2t³) and `yCurve`; see syntenyTypes.
//
// Geometry: CURVE_SEGMENTS trapezoids hugging the local bezier strip, padded so
// the fragment can clip to the true curve. This keeps the rasterized fragment
// count proportional to ribbon area + boundary AA — roughly the same budget as
// a Canvas2D path fill — rather than the `corner_bbox × h` overdraw a
// single-quad bound suffered for slanted ribbons.
//
// Fragment: invert y(t) for this row, then hand the bezier basis to the shared
// fillFs, which evaluates the two edge x-curves, takes each edge's signed
// perpendicular distance, and outputs analytic coverage. BASE ribbons and CIGAR
// indel tiles run the identical path.
//
// References:
//   developer.nvidia.com/gpugems/gpugems3 chapter 25 (Loop-Blinn)
//   drewcassidy.me/2020/06/26/sdf-antialiasing/  (SDF AA)
//! targets: wgsl, glsl

import syntenyTypes;

// SYNC: CURVE_SEGMENTS (8) * 6 verts. The codegen parses this constant out of
// the source and cannot resolve an imported identifier, so the segment count is
// spelled literally here; syntenyCurveSegments.test.ts pins the two together.
public static const uint VERTS_PER_INSTANCE = 48u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

[shader("vertex")]
FillVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  FillVsOut o;
  Corners c;
  if (fillVsBegin(inst, u, o, c)) {
    curveGeometry(o, c, vid, 0.0, u);
  }
  return o;
}

[shader("fragment")]
float4 fs_main(FillVsOut fragIn) : SV_Target {
  float t = curveParamAtY(fragIn.localPos.y, u);
  return fillFs(fragIn, sBlend(t), sBlendDeriv(t),
                u.height * yCurveDeriv(t), u);
}
