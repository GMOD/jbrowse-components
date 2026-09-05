// The `span` mark shape: one instance is a coloured rectangle spanning
// [x, x2) in absolute genomic coords, on the row band given by the `row`
// channel. The geometry — row band, hp clip-x span, min-width widening — is
// `rowRect`'s; this is the entry point that makes it a pass a mark can draw.
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
