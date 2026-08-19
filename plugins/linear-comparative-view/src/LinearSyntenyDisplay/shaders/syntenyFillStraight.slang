// Linear-synteny fill pass — straight-line (parallelogram) mode.
//
// One quad per instance snapping to the trapezoid (x1,yTop)-(x2,yTop)-
// (x3,yBottom)-(x4,yBottom); no tessellation, no Newton — the four corners are
// the ribbon. Geometry and fragment both come from syntenyTypes: X-blend is
// linear (s=t) and so is y (sd=1, dydt=height), so each edge's slope is just
// its constant top-to-bottom dx over the height.
//! targets: wgsl, glsl

import syntenyTypes;

public static const uint VERTS_PER_INSTANCE = 6u;
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

[shader("vertex")]
FillVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  FillVsOut o;
  float4 c;
  if (fillVsBegin(inst, u, o, c)) {
    straightGeometry(o, c, vid, 0.0, u);
  }
  return o;
}

[shader("fragment")]
float4 fs_main(FillVsOut fragIn) : SV_Target {
  // NOT clamped: straightGeometry extrapolates the quad's two rows to the
  // blend at their own y, so the ribbon's edges continue past both ends and
  // the polygon bounds them there too. vertCoverage is what ends the ribbon.
  float t = fragIn.localPos.y / u.height;
  return fillFs(fragIn, t, 1.0, u.height, u);
}
