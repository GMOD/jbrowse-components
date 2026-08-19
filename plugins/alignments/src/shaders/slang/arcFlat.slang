// Read-cloud flat connector pass: the horizontal line joining a discordant
// pair's two reads, drawn at the Y its insert size maps to. The colored squares
// at each end are arcMarker.slang; this is the neutral line between them —
// neutral meaning the theme's foreground (`u.colorFlatConnector`), not black.
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
//! export-consts: ARC_FLAT_MIN_PX, ARC_FLAT_ALPHA, ARC_FLAT_DASH_PX, ARC_FLAT_GAP_PX

import alignmentsUniforms;
// `unpackRGBA`, for the connector colour. Slang does not re-export through an
// import, so naming a packed colour uniform means importing this too — the same
// pair mismatch.slang and every other named-colour pass carries.
import colorPack;
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
// The split-read variant's dash, in CSS px — samplot.py's dotted style. Declared
// here and exported for the same reason arcLine.slang's tick dash is: the
// Canvas2D twin spelled it `setLineDash([3, 3])` and the SVG cross-region
// overlay would have been a third spelling, each held to the other two by a
// comment. One declaration, three consumers.
static const float ARC_FLAT_DASH_PX = 3.0;
static const float ARC_FLAT_GAP_PX = 3.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

// No colorType: the line is neutral, and the insert-size / orientation color
// lives in the endpoint squares (mirrors samplot.py's colored markers joined by
// a plain line). `dashed` is the split-read variant — the two flat forms coexist
// in one draw, so this is a real per-instance bit, unlike the connector tick's
// color.
struct Instance {
  uint  x1     : ATTR0;
  uint  x2     : ATTR1;
  uint  yBp    : ATTR2;
  float dashed : ATTR3;
  // Stroke width in CSS px for this connector, `arcLineWidth(support, …)`
  // resolved on the CPU exactly as arc.slang's is. Flat arcs coalesce on the
  // same key as curved ones, and drawCanvas widens every arc by its support
  // before it branches on shape — so a flat pass left on the bare uniform would
  // be the one place read cloud disagreed with its own Canvas2D/SVG export.
  float lineWidthPx : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  // Offset from the line's centre in CSS px. The quad is expanded by exactly
  // the padded half-extents, so |grad| is 1 per CSS px in both axes and the AA
  // ramp is a constant (see STROKE_AA_PX).
  float2 local    : COLOR0;
  // Half-length of the drawn line, so the fragment can measure the butt caps.
  nointerpolation float halfLen : COLOR1;
  nointerpolation float dashed  : COLOR2;
  // Screen x in CSS px (interpolated) — drives the dash pattern. Deliberately
  // NOT fragIn.position.x (physical px), which would halve the dash period on a
  // dpr=2 display and diverge from the Canvas2D setLineDash([3,3]) mirror.
  float  screenPx : COLOR3;
  // The resolved half stroke width, carried so the quad's pad and the
  // fragment's ramp cannot be sized from two different widths.
  nointerpolation float halfWidthPx : COLOR4;
};

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  float x1Px = arcBandX(inst.x1, u);
  float x2Px = arcBandX(inst.x2, u);
  // Clamp the span to ARC_FLAT_MIN_PX about the midpoint; the line is
  // horizontal, so the span's sign is moot.
  float halfLen = max(abs(x2Px - x1Px), ARC_FLAT_MIN_PX) * 0.5;
  // arcBandY (alignmentsUniforms) is the shared |tlen| -> Y formula, the same
  // one arcMarker.slang uses, so the endpoint squares land on this line.
  float2 c = float2((x1Px + x2Px) * 0.5, arcBandY(inst.yBp, u));

  o.halfWidthPx = arcStrokeHalfPx(inst.lineWidthPx, u);

  // Overshoot both ends by a half-width: the flat form's caps are not cut by
  // the band scissor, so the fragment's box distance needs somewhere to ramp
  // them down. segmentQuadLocal (alignmentsUniforms) owns that pad, paired with
  // the sdSegment the fragment measures with.
  o.local = segmentQuadLocal(vid, halfLen, o.halfWidthPx);
  o.halfLen = halfLen;
  o.dashed = inst.dashed;

  float2 p = c + o.local;
  o.screenPx = p.x;
  o.position = arcBandClipPos(p, u);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // |grad d| is analytically 1 per CSS px, so the AA ramp is a constant number
  // of device pixels, not a derivative — see STROKE_AA_PX.
  float d = sdSegment(fragIn.local, fragIn.halfLen);
  float alpha = strokeCoverage(d, fragIn.halfWidthPx, u);
  // Split-read flat arcs render dashed, off the two constants above rather than
  // a 3.0/6.0 pair spelled into the arithmetic — the SVG twin passes them to
  // `stroke-dasharray` and Canvas2D to `setLineDash`, so a period written here
  // in numbers is a period only a comment holds the other two to.
  //
  // `dashCoverage` (alignmentsUniforms) is the pattern arcLine.slang's tick also
  // cuts, in the one axis `sdSegment` does not measure.
  if (fragIn.dashed > 0.5) {
    alpha *= dashCoverage(
      fragIn.screenPx, ARC_FLAT_DASH_PX, ARC_FLAT_GAP_PX, u);
  }
  // Neutral, not black: `colorFlatConnector` is the theme's foreground, so the
  // line reads against a dark track background the way it does against a light
  // one. The category colour stays in the endpoint squares (arcMarker.slang).
  // Output straight alpha — the HAL blend func does the premultiply.
  return float4(unpackRGBA(u.colorFlatConnector).xyz, ARC_FLAT_ALPHA * alpha);
}
