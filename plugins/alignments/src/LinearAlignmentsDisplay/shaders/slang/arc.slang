// Paired-read arc pass. Each instance is a stroked path drawn as a
// triangle-strip that inflates the curve by a half-width on each side — but the
// strip is only a HULL. The fragment measures the true perpendicular distance to
// the analytic curve and shades from that, so the hull's facets never reach the
// picture and it only has to cover.
//
// That split is the point of the pass. The strip used to carry a `dist` varying
// interpolated between its own ±half-width offsets, which is a true distance
// only where the curve is locally straight. At the FEET of a height-clamped dome
// — a 1500px pair in the default 25px band turns from vertical to horizontal
// inside a 0.3px radius of curvature — the ribbon parameter and the real
// distance part company by 0.49px, the whole half-width of a 1px stroke, and no
// amount of tessellation closes it: the error is 0.52px at 64 segments and
// 0.49px at 128, converging to the corner rather than to zero. Since destY is
// clamped to the band, every arc wider than 2·availH has those feet.
//
// shapeType encodes the curve form:
//   0 = paired arc, drawn as a half-ellipse rising from the two real bp
//       endpoints. rx is the pair's on-screen half-width; ry is
//       ARC_APEX_FRACTION of the Y the insert size maps to. Once the pair spans
//       more than ARC_FAR_SCREEN_WIDTHS the ellipse becomes a true circle
//       (ry = rx), so big the band clips the apex away and only near-vertical
//       legs rising from each endpoint remain.
//   1 = flat horizontal line at Y = destY (read cloud paired, solid)
//   2 = flat horizontal line at Y = destY (read cloud split read, dashed)
// Both flat forms draw black at ARC_FLAT_ALPHA; see the note by that constant.
//
// yBp is the target Y position in genomic bp — for the arc this is the apex
// height; for flat it is the line's Y. Read cloud sets yBp = |tlen|; arc mode
// sets yBp = |x2-x1|/2 (the genomic radius).
//! targets: wgsl, glsl
//! export-consts: ARC_HEIGHT_MARGIN, ARC_FAR_SCREEN_WIDTHS, ARC_FLAT_MIN_PX, ARC_FLAT_ALPHA, ARC_APEX_FRACTION, ARC_COLOR_SHORT_INSERT

import alignmentsUniforms;


// The hull needs enough segments that its ±(lineWidth/2 + STROKE_AA_PX) offsets
// still contain every pixel the analytic distance inks. Swept against the exact
// SDF over the band's aspect-ratio range, 64 is the first power of two that
// misses nothing; 48 leaves a couple of pixels short on the flattest domes.
// (The old 128 was chosen to fight facet kinks that the analytic fragment has
// since made invisible — the strip's centreline was already within 0.06px of the
// curve at 128, and the visible error was never the tessellation.)
public static const uint ARC_CURVE_SEGMENTS = 64u;
public static const uint VERTS_PER_INSTANCE = (ARC_CURVE_SEGMENTS + 1u) * 2u;
static const float PI = 3.14159265359;
// Fraction of destY the dome's apex reaches. The cubic bezier this replaced had
// control points at (x1, apexY) / (x2, apexY), whose peak is 3·(1/2)·(1/2) =
// 0.75 of the way up; carrying the same number keeps arc heights — and their
// correspondence with the insert-size scalebar — untouched by the shape change.
// Mirrored in drawCanvas.ts.
static const float ARC_APEX_FRACTION = 0.75;
// Once a pair spans more than this many screen widths — i.e. its endpoints no
// longer both fit on screen — a paired arc's ellipse becomes a true circle, so
// the band clips it down to near-vertical lines at each real endpoint. Mirrored
// in drawCanvas.ts.
static const float ARC_FAR_SCREEN_WIDTHS = 1.0;
// Minimum drawn width (CSS px) of a flat read-cloud line. Short-insert pairs span
// far less than a pixel, so without a floor the line collapses to an invisible
// zero-length stroke. Mirrored in drawCanvas.ts.
static const float ARC_FLAT_MIN_PX = 2.5;
// Opacity of a flat read-cloud connector. Translucent so dense overlapping pairs
// read as a band (cf. samplot.py's alpha), but kept well above samplot.py's 0.25:
// an isolated short-insert pair is a single thin line, and at 0.25-0.4 it all but
// vanishes into the background. Exported so drawCanvas.ts strokes the same value.
static const float ARC_FLAT_ALPHA = 0.7;

// Which distance function the fragment measures with. Ordered so the fragment
// can compare rather than test equality on an interpolated float.
static const float KIND_ELLIPSE = 0.0;
static const float KIND_CIRCLE  = 1.0;
static const float KIND_FLAT    = 2.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  x1        : ATTR0;
  uint  x2        : ATTR1;
  float colorType : ATTR2;
  float shapeType : ATTR3;
  uint  yBp       : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Fragment position in whichever frame its curve is measured in (band-local
  // CSS px — see evalArcVertex), and the radii to measure against. `radii` is
  // constant per instance, so it interpolates back to itself.
  float2 local    : COLOR1;
  float2 radii    : COLOR2;
  float  kind     : COLOR3;
  float  dashed   : COLOR4;
  // Screen x in CSS px (interpolated) — drives the dash pattern. Deliberately
  // NOT fragIn.position.x (physical px), which would halve the dash period on a
  // dpr=2 display and diverge from the Canvas2D setLineDash([3,3]) mirror.
  float  screenPx : COLOR5;
};

// arcColorByIndex is shared from alignmentsUniforms (also used by arcLine), and
// clamps out-of-range slots itself (arcColorSlot).
//
// This used to fall through to `hueRampHalfSat(u.gradientHue)` above a bare
// `9u` — a hand-spelled ARC_COLOR_SLOTS — for a "colorType >= NUM_ARC_COLORS"
// that no longer exists under that name or any other. `arcColorTypes` is
// written in exactly one place (getArcColorType in features/arcs/compute.ts),
// whose widest value is COLOR_SPLIT_DELETION = 8; interchrom ticks are a
// constant 3. So the ramp was unreachable, and it was the third distinct
// answer — after the shader's clamp and Canvas2D's wrap — to an input none of
// the three can receive.
// The analytic curve, in band-local CSS px. `radii` and `kind` say which
// distance function measures it; `c` is the centre an ellipse or flat line is
// measured from, `ends` the two endpoints' screen x a far circle's legs are.
struct Curve { float2 c; float2 ends; float2 radii; float kind; float yDir; };

Curve arcCurve(Instance inst, Uniforms u) {
  float availH = u.arcBandH - ARC_HEIGHT_MARGIN;
  float yDir = (u.pairedArcsDown > 0.5) ? 1.0 : -1.0;
  // Y the insert size maps to: availH px spans arcsYDomainBp bp, the CPU-chosen
  // domain (zoom-proportional for arcs, autoscaled |tlen| for read cloud).
  // arcBandDestY (alignmentsUniforms) is the shared formula — the same one
  // arcMarker.slang uses so the endpoint squares land on the flat line.
  float destY = arcBandDestY(inst.yBp, availH, u);
  float x1Px = u.blockStartPx + bpToLinear(inst.x1, u) * u.blockWidth;
  float x2Px = u.blockStartPx + bpToLinear(inst.x2, u) * u.blockWidth;
  float halfWidthPx = abs(x2Px - x1Px) * 0.5;

  Curve cv;
  cv.yDir = yDir;
  cv.ends = float2(min(x1Px, x2Px), max(x1Px, x2Px));
  if (inst.shapeType > 0.5) {
    // Flat line (read cloud). Clamp the span to ARC_FLAT_MIN_PX (centred on the
    // midpoint); the line is horizontal, so the span's sign is moot.
    cv.kind = KIND_FLAT;
    cv.c = float2((x1Px + x2Px) * 0.5, destY * yDir);
    cv.radii = float2(max(abs(x2Px - x1Px), ARC_FLAT_MIN_PX) * 0.5, 0.0);
  } else {
    // `far` is purely a function of on-screen span — no bp limit.
    bool far = 2.0 * halfWidthPx > ARC_FAR_SCREEN_WIDTHS * u.canvasW;
    cv.kind = far ? KIND_CIRCLE : KIND_ELLIPSE;
    cv.c = float2((x1Px + x2Px) * 0.5, 0.0);
    cv.radii = float2(halfWidthPx,
                      far ? halfWidthPx : ARC_APEX_FRACTION * destY);
  }
  return cv;
}

// One hull vertex: the spine point at t ∈ [0,1] pushed `side` × half-width
// along its normal, given both in the frame the fragment measures distance in
// and in band-local screen px. Uniform t is uniform in angle, which is
// equal-arc-length on the circle and close enough on the ellipse for a hull.
struct ArcVertex { float2 screen; float2 local; };

ArcVertex evalArcVertex(float t, float side, Curve cv, Uniforms u) {
  float hw = u.lineWidthPx * 0.5 + STROKE_AA_PX;
  float2 p;
  float2 tang;
  float2 origin;
  // Mirrors local x into screen x, so a far circle's two legs can share one
  // outward-positive frame.
  float legDir = 1.0;

  if (cv.kind >= KIND_FLAT) {
    // Overshoot the line's real ends by a half-width: the flat form is the one
    // shape whose caps are not cut by the band scissor, and the fragment's box
    // distance needs somewhere to ramp them down.
    p = float2((2.0 * t - 1.0) * (cv.radii.x + hw), 0.0);
    tang = float2(1.0, 0.0);
    origin = cv.c;
  } else if (cv.kind >= KIND_CIRCLE) {
    // Two legs, each built from ITS OWN real endpoint outward. Reconstructing a
    // leg as `centre + cos(a)·r` cancels catastrophically once r passes ~1e6 px
    // (a mate a few thousand screen widths away): both terms are huge and their
    // difference is the handful of pixels actually on screen. `1 - cos b` is
    // the same trap one level down, hence the half-angle identity.
    bool rightLeg = t <= 0.5;
    float b = (rightLeg ? t : 1.0 - t) * PI;
    float sh = sin(b * 0.5);
    p = float2(-2.0 * cv.radii.x * sh * sh, sin(b) * cv.radii.x * cv.yDir);
    tang = float2(-sin(b), cos(b) * cv.yDir);
    origin = float2(rightLeg ? cv.ends.y : cv.ends.x, 0.0);
    legDir = rightLeg ? 1.0 : -1.0;
  } else {
    float a = t * PI;
    p = float2(cos(a) * cv.radii.x, sin(a) * cv.radii.y * cv.yDir);
    tang = float2(-sin(a) * cv.radii.x, cos(a) * cv.radii.y * cv.yDir);
    origin = cv.c;
  }

  float tlen = length(tang);
  float2 tn = (tlen > 0.001) ? tang / tlen : float2(1.0, 0.0);

  ArcVertex av;
  av.local = p + float2(-tn.y, tn.x) * hw * side;
  av.screen = origin + float2(legDir * av.local.x, av.local.y);
  return av;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  Curve cv = arcCurve(inst, u);
  uint seg = vid / 2u;
  float side = (vid % 2u == 0u) ? -1.0 : 1.0;
  float t = float(seg) / float(ARC_CURVE_SEGMENTS);

  ArcVertex av = evalArcVertex(t, side, cv, u);
  o.screenPx = av.screen.x;
  o.local = av.local;
  o.radii = cv.radii;
  o.kind = cv.kind;
  float clipX = (av.screen.x / u.canvasW) * 2.0 - 1.0;
  float clipY = 1.0 - ((av.screen.y + u.covOffset) / u.canvasH) * 2.0;
  o.position = float4(flipX(clipX, u), clipY, 0.0, 1.0);
  // Read cloud flat shapes (1, 2): the connector line itself is neutral black —
  // the insert-size / orientation color lives in the endpoint squares drawn by
  // the arcMarker pass (mirrors samplot.py's per-read colored markers joined by
  // a plain line).
  bool flat = inst.shapeType > 0.5;
  float arcAlpha = flat ? ARC_FLAT_ALPHA : 1.0;
  float3 rgb = flat ? float3(0.0, 0.0, 0.0)
                    : arcColorByIndex(uint(inst.colorType + 0.5), u);
  o.color = float4(rgb, arcAlpha);
  // Split-read flat shape (2) renders dashed.
  o.dashed = (inst.shapeType > 1.5) ? 1.0 : 0.0;
  return o;
}

// Perpendicular distance in CSS px from this fragment to its analytic curve.
// `local` is whatever frame that curve's measurement wants: the ellipse's
// centre, a far circle's leg endpoint, or the flat line itself — where the
// normal is constant, so |local.y| already is the distance.
float arcDistance(VsOut i) {
  if (i.kind >= KIND_FLAT) {
    // Distance to a butt-capped horizontal segment: the y-extent-zero box SDF.
    float2 q = float2(abs(i.local.x) - i.radii.x, abs(i.local.y));
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  }
  if (i.kind >= KIND_CIRCLE) { return distToWideCircle(i.local, i.radii.x); }
  return sdEllipse(i.local, i.radii);
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // |∇d| is analytically 1 per CSS px, so the AA ramp is a constant number of
  // device pixels, not a derivative — see STROKE_AA_PX.
  float alpha = strokeCoverage(arcDistance(fragIn), u.lineWidthPx * 0.5, u);
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
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
