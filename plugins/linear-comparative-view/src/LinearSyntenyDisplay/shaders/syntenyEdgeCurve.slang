// Linear-synteny clicked-outline pass — curved (bezier ribbon) mode. Draws a
// 1px antialiased outline on both edges of the currently-clicked alignment
// (every other instance early-outs to a degenerate vertex).
//
// Same geometry as syntenyFillCurve, widened by STROKE_PERP_PX so the stroke's
// outer half isn't cropped; only the fragment differs. That is the whole point:
// this pass used to tessellate each edge into 16 chords and stroke those, which
// sat up to 11.7px off the analytic bezier the fill draws (see strokeFs).
// Sharing the fill's polygon and clipping analytically makes the outline exact
// at any segment count — and costs 48 verts/instance instead of 192.
//! targets: wgsl, glsl

import syntenyTypes;

// One trapezoid per curve segment, 6 verts each. The codegen resolves
// CURVE_SEGMENTS through the import, so the count follows syntenyTypes.
public static const uint VERTS_PER_INSTANCE = CURVE_SEGMENTS * 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

[shader("vertex")]
FillVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  FillVsOut o;
  Corners c;
  if (fillVsBegin(inst, u, o, c) && isClickedSilhouette(inst, u)) {
    curveGeometry(o, c, vid, STROKE_PERP_PX, u);
  }
  return o;
}

[shader("fragment")]
float4 fs_main(FillVsOut fragIn) : SV_Target {
  float t = curveParamAtY(fragIn.localPos.y, u);
  return strokeFs(fragIn, sBlend(t), sBlendDeriv(t),
                  u.height * yCurveDeriv(t), u);
}
