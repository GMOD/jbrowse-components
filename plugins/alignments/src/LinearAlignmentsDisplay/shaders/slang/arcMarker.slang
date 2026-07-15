// Read-cloud endpoint markers: a small colored square at each flat
// arc endpoint. The flat connector line itself draws black (see arc.slang); the
// squares carry the insert-size / orientation color, mirroring samplot.py's
// per-read colored markers joined by a neutral line. Runs in the arc-band
// viewport (drawArcsPass) right after the arc pass, so it shares the same
// Y-scale uniforms (arcsYLog / arcsYDomainBp / covOffset / pairedArcsDown) and
// the |tlen| → destY formula must stay byte-identical to arc.slang's flat path.
//! targets: wgsl, glsl
//! export-consts: ARC_MARKER_PX, ARC_MARKER_HEIGHT_MARGIN

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
// Side length (CSS px) of an endpoint square. Mirrored in drawCanvas.ts.
static const float ARC_MARKER_PX = 5.0;
// Must equal arc.slang's ARC_HEIGHT_MARGIN so a marker lands exactly on the
// flat line's Y.
static const float ARC_MARKER_HEIGHT_MARGIN = 8.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  position  : ATTR0;
  float colorType : ATTR1;
  uint  yBp       : ATTR2;
};

[shader("vertex")]
ColorVsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  ColorVsOut o;
  // Y of the flat line at this insert size — shared arcBandDestY formula, so it
  // stays byte-identical to arc.slang's flat path and the square lands on the line.
  float availH = u.arcBandH - ARC_MARKER_HEIGHT_MARGIN;
  float destY = arcBandDestY(inst.yBp, availH, u);
  float yDir = (u.pairedArcsDown > 0.5) ? 1.0 : -1.0;
  float cy = destY * yDir;

  float norm = bpToLinear(inst.position, u);
  float screenX = u.blockStartPx + norm * u.blockWidth;

  float2 local = quadLocal(vid);
  float h = ARC_MARKER_PX * 0.5;
  float px = screenX + (local.x * 2.0 - 1.0) * h;
  float py = cy + (local.y * 2.0 - 1.0) * h;

  float clipX = (px / u.canvasW) * 2.0 - 1.0;
  float clipY = 1.0 - ((py + u.covOffset) / u.canvasH) * 2.0;
  o.position = float4(flipX(clipX, u), clipY, 0.0, 1.0);
  uint idx = uint(inst.colorType + 0.5);
  o.color = float4(arcMarkerColorByIndex(idx, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(ColorVsOut fragIn) : SV_Target {
  return fragIn.color;
}
