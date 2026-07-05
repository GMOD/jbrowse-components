// Arc-line pass: 2 verts per instance, drawn as line-list. A vertical tick at
// an interchromosomal mate's breakpoint, spanning the full arc band. The pass
// runs inside the arc-band viewport (see drawArcsPass), so the band fills the
// viewport and the tick is just the two opposite clip-space edges (±1) — no
// per-instance Y is needed. Colored from the shared arc palette (arcColor0..8).
//! targets: wgsl, glsl

import alignmentsUniforms;


public static const uint VERTS_PER_INSTANCE = 2u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float colorType : ATTR1;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  uint v = vid % 2u;

  float norm = bpToLinear(inst.position, u);
  float screenX = u.blockStartPx + norm * u.blockWidth;
  float sx = (screenX / u.canvasW) * 2.0 - 1.0;
  float sy = (v == 0u) ? -1.0 : 1.0;

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  uint idx = uint(inst.colorType + 0.5);
  o.color = float4(arcColorByIndex(idx, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
