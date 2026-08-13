// MAF alignment renderer. One pass renders colored quads for each base
// rectangle (matches, mismatches, gaps). Text rendering is handled by the
// Canvas2D backend.
//
// Colors are baked into the instance (one packed ABGR per run) so the
// main-thread encoder (`buildInstanceBuffer`, called from
// the per-region encode autorun in `LinearMafDisplay`) can run-merge consecutive
// same-colored cells — keeping the per-region quad count proportional to
// the number of color transitions, not the number of bases. Theme /
// setting changes re-encode on the main thread; no RPC roundtrip.
//
// The geometry itself lives in the shared `rowRect` module (render-core), which
// the canvas plugin's multi-row painter draws from too — this file is just the
// MAF-named entry points over it. rowIndex is stored in the instance so row
// layout can be adjusted purely via uniforms — no refetch on rowHeight change.
//! targets: wgsl, glsl
//! instance-writer

import rowRect;

public static const uint VERTS_PER_INSTANCE = 6u;

[[vk::binding(1, 0)]] ConstantBuffer<RowRectUniforms> u;

[shader("vertex")]
RowRectVsOut vs_main(RowRectInstance inst, uint vid : SV_VertexID) {
  return rowRectVertex(inst, vid, u);
}

[shader("fragment")]
float4 fs_main(RowRectVsOut v) : SV_Target {
  return v.color;
}
