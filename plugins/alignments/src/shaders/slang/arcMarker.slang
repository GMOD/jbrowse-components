// Read-cloud endpoint markers: a small colored square at each flat arc
// endpoint. The connector line between them is arcFlat.slang, which draws a
// theme neutral; the squares carry the insert-size / orientation color,
// mirroring samplot.py's per-read colored markers joined by a neutral line.
//
// Runs in the arc-band viewport (drawArcsPass) alongside the other band passes,
// so it shares their Y-scale uniforms (arcsYLog / arcsYDomainBp / covOffset /
// pairedArcsDown) and reaches its Y through the same `arcBandDestY` arcFlat.slang
// does — a square that resolved its own would land off the line it marks.
//! targets: wgsl, glsl
//! export-consts: ARC_MARKER_PX

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
// Side length (CSS px) of an endpoint square. Mirrored in drawCanvas.ts.
static const float ARC_MARKER_PX = 5.0;
// ARC_HEIGHT_MARGIN comes from alignmentsUniforms, alongside the arcBandDestY
// formula that consumes it — the same declaration arc.slang subtracts, so a
// marker cannot land off its flat line.

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float colorType : ATTR1;
  uint  yBp       : ATTR2;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  // Y of the flat line at this insert size — arcFlat.slang's own formula.
  float cy = arcBandY(inst.yBp, u);
  float screenX = arcBandX(inst.position, u);

  float2 corner = quadLocal(vid) * 2.0 - 1.0;
  o.position = arcBandClipPos(
    float2(screenX, cy) + corner * (ARC_MARKER_PX * 0.5), u);
  // The arc palette itself — the squares and the curves paint one meaning in
  // one colour. A second `arcMarkerColor` table existed for a short-insert
  // substitution that no longer exists; see arcColor in alignmentsUniforms.
  uint idx = uint(inst.colorType + 0.5);
  o.color = float4(arcColorByIndex(idx, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
