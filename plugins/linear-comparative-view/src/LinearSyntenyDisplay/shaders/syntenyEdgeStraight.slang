// Linear-synteny clicked-outline pass — straight-line mode. Draws a 1px
// antialiased outline on both edges of the currently-clicked alignment (every
// other instance early-outs to a degenerate vertex).
//
// Same geometry as syntenyFillStraight, widened by STROKE_PERP_PX so the
// stroke's outer half isn't cropped; only the fragment differs. Drawing the
// ribbon polygon rather than two per-edge line quads is what lets strokeFs
// measure against the same analytic edges the fill clips to.
//! targets: wgsl, glsl

import syntenyTypes;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

[shader("vertex")]
FillVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  FillVsOut o;
  float4 c;
  if (fillVsBegin(inst, u, o, c) && isClickedSilhouette(inst, u)) {
    straightGeometry(o, c, vid, STROKE_PERP_PX, u);
  }
  return o;
}

[shader("fragment")]
float4 fs_main(FillVsOut fragIn) : SV_Target {
  // NOT clamped: straightGeometry extrapolates the quad's two rows to the
  // blend at their own y, so the ribbon's edges continue past both ends and
  // the polygon bounds them there too. vertCoverage is what ends the ribbon.
  float t = fragIn.localPos.y / u.height;
  return strokeFs(fragIn, t, 1.0, u.height, u);
}
