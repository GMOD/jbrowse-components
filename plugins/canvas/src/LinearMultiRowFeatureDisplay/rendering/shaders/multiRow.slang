// Multi-row feature painter ("chromosome painting"). One instance per feature:
// a colored rectangle spanning [startBp,endBp) in absolute genomic coords, on
// the row given by rowIndex, with `rowProportion` shrinking the rect within its
// row to leave inter-row gaps.
//
// That is exactly the MAF renderer's primitive, so both draw from the shared
// `rowRect` module (render-core) and this file is just the multi-row entry
// points over it. The only difference upstream: features here are already
// intervals (no per-base run-merging).
//! targets: wgsl, glsl

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
