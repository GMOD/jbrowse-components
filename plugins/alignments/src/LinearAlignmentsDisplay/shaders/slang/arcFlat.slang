// Read-cloud flat connector pass: the horizontal line joining a discordant
// pair's two reads, drawn at the Y its insert size maps to. The colored squares
// at each end are arcMarker.slang; this is the neutral line between them.
//
// These used to ride in arc.slang as `shapeType` 1 and 2. That pass draws a
// stroked CURVE, so its instance is a 65-segment triangle strip — 130 vertices,
// sized so the hull always contains the analytic dome the fragment measures. A
// flat line needs four. Read cloud is the mode that emits thousands of these and
// no domes at all (computeArcShape returns a flat shape iff `cloud`), so the one
// visualization built for density was paying 32x its vertex cost for a
// tessellation of a straight line, and arc.slang carried a whole second
// distance function, a dash pattern and two color rules to serve it.
//
// The two shapes are disjoint per draw, so splitting costs nothing: in arc mode
// this pass has zero instances, in read cloud the curve pass does.
//! targets: wgsl, glsl
//! export-consts: ARC_FLAT_MIN_PX, ARC_FLAT_ALPHA

import alignmentsUniforms;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;
// Minimum drawn width (CSS px) of a flat read-cloud line. Short-insert pairs
// span far less than a pixel, so without a floor the line collapses to an
// invisible zero-length stroke. Mirrored in drawCanvas.ts.
static const float ARC_FLAT_MIN_PX = 2.5;
// Opacity of a flat read-cloud connector. Translucent so dense overlapping pairs
// read as a band (cf. samplot.py's alpha), but kept well above samplot.py's 0.25:
// an isolated short-insert pair is a single thin line, and at 0.25-0.4 it all but
// vanishes into the background. Exported so drawCanvas.ts strokes the same value.
static const float ARC_FLAT_ALPHA = 0.7;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// No colorType: the line is neutral black, and the insert-size / orientation
// color lives in the endpoint squares (mirrors samplot.py's colored markers
// joined by a plain line). `dashed` is the split-read variant — the two flat
// forms coexist in one draw, so this is a real per-instance bit, unlike the
// connector tick's color.
struct Instance {
  uint  x1     : ATTR0;
  uint  x2     : ATTR1;
  uint  yBp    : ATTR2;
  float dashed : ATTR3;
};

struct VsOut {
  float4 position : SV_Position;
  // Offset from the line's centre in CSS px. The quad is expanded by exactly
  // the padded half-extents, so |grad| is 1 per CSS px in both axes and the AA
  // ramp is a constant (see STROKE_AA_PX).
  float2 local    : COLOR0;
  // Half-length of the drawn line, so the fragment can measure the butt caps.
  float  halfLen  : COLOR1;
  float  dashed   : COLOR2;
  // Screen x in CSS px (interpolated) — drives the dash pattern. Deliberately
  // NOT fragIn.position.x (physical px), which would halve the dash period on a
  // dpr=2 display and diverge from the Canvas2D setLineDash([3,3]) mirror.
  float  screenPx : COLOR3;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float availH = u.arcBandH - ARC_HEIGHT_MARGIN;
  // arcBandDestY (alignmentsUniforms) is the shared |tlen| -> Y formula, the
  // same one arcMarker.slang uses, so the endpoint squares land on this line.
  float destY = arcBandDestY(inst.yBp, availH, u);
  float yDir = (u.pairedArcsDown > 0.5) ? 1.0 : -1.0;

  float x1Px = u.blockStartPx + bpToLinear(inst.x1, u) * u.blockWidth;
  float x2Px = u.blockStartPx + bpToLinear(inst.x2, u) * u.blockWidth;
  // Clamp the span to ARC_FLAT_MIN_PX about the midpoint; the line is
  // horizontal, so the span's sign is moot.
  float halfLen = max(abs(x2Px - x1Px), ARC_FLAT_MIN_PX) * 0.5;
  float2 c = float2((x1Px + x2Px) * 0.5, destY * yDir);

  // Overshoot both ends by a half-width: the flat form's caps are not cut by
  // the band scissor, so the fragment's box distance needs somewhere to ramp
  // them down.
  float hw = u.lineWidthPx * 0.5 + STROKE_AA_PX;
  float2 q = quadLocal(vid) * 2.0 - 1.0;
  o.local = float2(q.x * (halfLen + hw), q.y * hw);
  o.halfLen = halfLen;
  o.dashed = inst.dashed;

  float px = c.x + o.local.x;
  float py = c.y + o.local.y;
  o.screenPx = px;
  float clipX = (px / u.canvasW) * 2.0 - 1.0;
  float clipY = 1.0 - ((py + u.covOffset) / u.canvasH) * 2.0;
  o.position = float4(flipX(clipX, u), clipY, 0.0, 1.0);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Distance to a butt-capped horizontal segment: the y-extent-zero box SDF.
  float2 q = float2(abs(fragIn.local.x) - fragIn.halfLen, abs(fragIn.local.y));
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  // |grad d| is analytically 1 per CSS px, so the AA ramp is a constant number
  // of device pixels, not a derivative — see STROKE_AA_PX.
  float alpha = strokeCoverage(d, u.lineWidthPx * 0.5, u);
  // Split-read flat arcs render dashed (samplot.py's dotted style, and
  // Canvas2D's setLineDash([3,3])): 3px on, 3px off, with the same STROKE_AA_PX
  // ramp on the dash ends that the stroke's sides get. The +0.25 rotates the
  // period so the ON segment is centred at phase 3 rather than straddling the
  // wrap — measuring `abs(phase - centre)` across the wrap would leave one end
  // of every dash hard-edged.
  if (fragIn.dashed > 0.5) {
    float phase = frac(fragIn.screenPx / 6.0 + 0.25) * 6.0;
    alpha *= clamp(2.0 - abs(phase - 3.0), 0.0, 1.0);
  }
  // Output straight alpha — the HAL blend func does the premultiply.
  return float4(0.0, 0.0, 0.0, ARC_FLAT_ALPHA * alpha);
}
