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
//! export-consts: ARC_COLOR_INTERCHROM, ARC_LINE_DASH_PX, ARC_LINE_GAP_PX

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

// DASHED, which is the one thing about a tick that is not a drawing preference.
//
// A tick and a cross-region arc's FOOT land on the same x whenever a breakpoint
// has both — the same donor reaching one acceptor this view shows and another it
// does not. Both are ARC_COLOR_INTERCHROM, both run the height of the band
// there, so solid they read as one mark and the tick's whole claim ("there is
// more, off screen") is invisible: on the K562 BCR donor that hid a junction
// carrying six times the arc's support behind what looked like the arc's own
// leg. Support cannot separate them either, since `arcLineWidth` caps at 4x
// around 44 reads and both marks were already past it.
//
// Longer than arcFlat.slang's [3, 3] split-line dash on purpose. That is the
// other dashed mark in this band, and in read-cloud mode both can be on screen
// at once; a tick is vertical and a cloud line horizontal, but two marks a
// glance apart should not also share a period.
public static const float ARC_LINE_DASH_PX = 5.0;
public static const float ARC_LINE_GAP_PX = 4.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// Position and width. A `colorType : ATTR1` used to ride along, but
// `resolveArcs` assigns every tick ARC_COLOR_INTERCHROM and nothing else can —
// so the attribute, the `arcLineColorTypes` array behind it and the legend scan
// over that array were all carrying one constant.
//
// `lineWidthPx` is the opposite case, and is why the two are not the same
// story: a tick IS one breakpoint rather than one read since `resolveArcs`
// coalesced them, so its weight says how many reads stand behind it. Resolved
// on the CPU by `arcLineWidth` (packGpu), the one implementation of that curve,
// shared with Canvas2D and the SVG export — exactly as arc.slang and
// arcFlat.slang take theirs.
struct Instance {
  uint  position    : ATTR0;
  float lineWidthPx : ATTR1;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Signed horizontal offset from the tick's centre, in CSS px. The quad is
  // expanded by exactly this much, so |∇dx| is 1 and the AA ramp is a constant
  // (see STROKE_AA_PX).
  float  dx       : COLOR1;
  // The resolved half stroke width, carried rather than recomputed in the
  // fragment so the quad the vertex stage expanded and the ink the fragment
  // measures cannot be sized from two different widths — the same pairing
  // arcFlat.slang makes.
  nointerpolation float halfWidthPx : COLOR2;
  // Distance DOWN the band from its top edge, in CSS px, so the fragment can
  // cut the dash. Band-relative rather than canvas-absolute: the pattern then
  // starts at the band's own edge and every tick in a lane phases alike, where
  // off the canvas y two lanes at different offsets would interleave.
  float  bandY    : COLOR3;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;

  float screenX = arcBandX(inst.position, u);

  // covOffset is the arc baseline in absolute canvas px (band bottom in up mode,
  // band top in down mode); the band spans arcBandH px from it. This is the one
  // band question with no clean signed form, so it asks the predicate rather
  // than `arcYDir` — the tick spans the whole band either way, so which end the
  // anchor is at is all it needs.
  float bandTopPx = arcsPointDown(u) ? u.covOffset : (u.covOffset - u.arcBandH);

  float2 local = quadLocal(vid);
  o.halfWidthPx = arcStrokeHalfPx(inst.lineWidthPx, u);
  float hw = o.halfWidthPx + STROKE_AA_PX;
  o.dx = (local.x * 2.0 - 1.0) * hw;
  o.bandY = local.y * u.arcBandH;

  // Absolute canvas px already (bandTopPx came off the anchor), so this does NOT
  // go through arcBandClipPos, which adds the anchor itself.
  o.position = float4(
    flipX(pxToClipX(screenX + o.dx, u.canvasW), u),
    yPxToClipY(bandTopPx + o.bandY, u.canvasH), 0.0, 1.0);
  o.color = float4(arcColorByIndex(ARC_COLOR_INTERCHROM, u), 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  float alpha = strokeCoverage(abs(fragIn.dx), fragIn.halfWidthPx, u.dpr);
  // `dashCoverage` (alignmentsUniforms) is arcFlat.slang's pattern too. This
  // pass had its own, which measured the ON run straight off the wrap: a dash's
  // trailing edge ramped and its leading edge did not, so half of every dash
  // boundary in the band was the hard cut the quad expansion above exists to
  // avoid on the other axis.
  alpha *= dashCoverage(fragIn.bandY, ARC_LINE_DASH_PX, ARC_LINE_GAP_PX, u.dpr);
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
