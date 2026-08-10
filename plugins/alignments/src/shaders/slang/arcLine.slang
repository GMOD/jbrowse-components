// Arc-line pass: a vertical tick at an interchromosomal mate's breakpoint,
// spanning the full arc band. The pass runs in the full-canvas viewport (see
// drawArcsPass), so it places the tick's two ends at the band's top and bottom
// in absolute canvas px — the same band the dome/flat passes anchor to
// (`covOffset` = the arc baseline, band bottom in up mode / top in down mode;
// `arcBandH` = band height). The devBand scissor clips the tick to the visible
// slice. Colored from the shared arc palette (u.arcColor).
//
// Drawn as an antialiased quad, not a line-list. Native lines are one DEVICE
// pixel wide with no width control in WebGPU (and effectively none in WebGL2),
// so the tick came out half the Canvas2D mirror's width on a dpr=2 display,
// ignored `readConnectionsLineWidth` entirely, and snapped to a whole pixel
// column — visibly stepping between columns as the view panned.
//! targets: wgsl, glsl
//! export-consts: ARC_COLOR_INTERCHROM

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Position only. A `colorType : ATTR1` used to ride along, but `resolveArcs`
// assigns every tick ARC_COLOR_INTERCHROM and nothing else can — so the
// attribute, the `arcLineColorTypes` array behind it and the legend scan over
// that array were all carrying one constant.
struct Instance {
  uint position : ATTR0;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Signed horizontal offset from the tick's centre, in CSS px. The quad is
  // expanded by exactly this much, so |∇dx| is 1 and the AA ramp is a constant
  // (see STROKE_AA_PX).
  float  dx       : COLOR1;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;

  float norm = bpToLinear(inst.position, u);
  float screenX = u.blockStartPx + norm * u.blockWidth;

  // covOffset is the arc baseline in absolute canvas px (band bottom in up mode,
  // band top in down mode); the band spans arcBandH px from it.
  float bandTopPx = (u.pairedArcsDown > 0.5) ? u.covOffset : (u.covOffset - u.arcBandH);

  float2 local = quadLocal(vid);
  float hw = u.lineWidthPx * 0.5 + STROKE_AA_PX;
  o.dx = (local.x * 2.0 - 1.0) * hw;
  float yPx = bandTopPx + local.y * u.arcBandH;

  float sx = ((screenX + o.dx) / u.canvasW) * 2.0 - 1.0;
  float sy = 1.0 - (yPx / u.canvasH) * 2.0;
  o.position = float4(flipX(sx, u), sy, 0.0, 1.0);
  o.color = float4(arcColorByIndex(ARC_COLOR_INTERCHROM, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = strokeCoverage(abs(fragIn.dx), u.lineWidthPx * 0.5, u);
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
