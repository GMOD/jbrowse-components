// Arc-line pass: 2 verts per instance, drawn as line-list. A vertical tick at
// an interchromosomal mate's breakpoint, spanning the full arc band. The pass
// runs in the full-canvas viewport (see drawArcsPass), so it places the tick's
// two endpoints at the band's top and bottom in absolute canvas px — the same
// band the dome/flat passes anchor to (`covOffset` = the arc baseline, band
// bottom in up mode / top in down mode; `arcBandH` = band height). The devBand
// scissor clips the tick to the visible slice. Colored from the shared arc
// palette (arcColor0..8).
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

  // covOffset is the arc baseline in absolute canvas px (band bottom in up mode,
  // band top in down mode); the band spans arcBandH px from it. Endpoint v0 sits
  // at the band bottom, v1 at the band top — matching the prior ±1 span.
  float bandTopPx = (u.pairedArcsDown > 0.5) ? u.covOffset : (u.covOffset - u.arcBandH);
  float yPx = (v == 0u) ? (bandTopPx + u.arcBandH) : bandTopPx;
  float sy = 1.0 - (yPx / u.canvasH) * 2.0;

  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  uint idx = uint(inst.colorType + 0.5);
  o.color = float4(arcColorByIndex(idx, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
