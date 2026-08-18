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
// Every instance is one shape: a half-ellipse rising from the two real bp
// endpoints. rx is the pair's on-screen half-width; ry is ARC_APEX_FRACTION of
// the Y the insert size maps to. Once the pair spans more than
// ARC_FAR_SCREEN_WIDTHS the ellipse becomes a true circle (ry = rx), so big the
// band clips the apex away and only near-vertical legs rising from each
// endpoint remain.
//
// THE DOME'S APEX IS CLAMPED TO THE BAND, and that is deliberate: it is what
// makes a pair with both endpoints on screen draw a complete arc BETWEEN those
// two endpoints. Unclamping it was tried (98dd82120b) and reverted, and the
// reason is worth keeping, because the mistake is easy to repeat.
//
// A wide pair's clamped dome is flat-topped — destY reduces to the pair's
// on-screen half-width in arc mode, so once that passes availH every such pair
// draws the same 0.75*availH depth on its own rx, and rx >> ry is a plateau.
// That LOOKS like the elbow this pass really did have, and it was mistaken for
// it. The real elbow was the triangle strip's seam quad between a far circle's
// two legs (see VsOut.legSide) — a horizontal bar joined to a leg at a right
// angle, which is the shape that was actually being reported.
//
// Unclamping cured nothing and cost the arc: ry became 0.75*rx, so any pair
// wider than about 1.3*availH put its apex below the band and drew as two
// clipped flanks, indistinguishable from the far case, with no arc between the
// endpoints at all. A flat-topped dome is still an arc between two endpoints; a
// clipped one is not.
//
// The tension is geometric and has no third shape: a dome spanning 2*rx whose
// apex is held to availH has aspect >= rx/availH, so a wide pair in a short band
// is either flat-topped (clamped) or has no top at all (unclamped). Only a
// taller band buys a rounder curve. Don't re-derive this by removing the clamp.
//
// There is no `shapeType` attribute. It used to select between this curve and
// the read cloud's flat connector (values 1 and 2), which meant a 130-vertex
// curve hull rasterizing a straight line, plus a second distance function, a
// dash pattern and a second color rule in here to serve it. Flat lines are
// arcFlat.slang now — a 6-vertex quad — and the two never appear in one draw
// anyway, since computeArcShape emits a flat shape iff `cloud`.
//
// yBp is the apex height in genomic bp; arc mode sets it to |x2-x1|/2 (the
// genomic radius).
//! targets: wgsl, glsl
//! topology: triangle-strip
//! export-consts: ARC_HEIGHT_MARGIN, ARC_FAR_SCREEN_WIDTHS, ARC_APEX_FRACTION, ARC_COLOR_SHORT_INSERT
//! js-export: arcRadiiPx
//! js-skip: arcIsFar — reached as a private helper inside the generated arcRadiiPx, so the predicate is already shared without being public; exporting it too would let a consumer ask the question separately from the pair it decides

import alignmentsUniforms;


// The hull needs enough segments that its ±(lineWidth/2 + STROKE_AA_PX) offsets
// still contain every pixel the analytic distance inks. Swept against the exact
// SDF over the band's aspect-ratio range, 64 is the first power of two that
// misses nothing; 48 leaves a couple of pixels short on the flattest domes.
// (The old 128 was chosen to fight facet kinks that the analytic fragment has
// since made invisible — the strip's centreline was already within 0.06px of the
// curve at 128, and the visible error was never the tessellation.)
//
// That sweep covered the DOME. It says nothing about a far pair's legs, which
// are the same 64 segments spread over a circle whose radius reaches millions of
// px — see `legSweepAngle` for what that cost and why more segments were never
// the answer.
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

// Which distance function the fragment measures with. Ordered so the fragment
// can compare rather than test equality on an interpolated float.
static const float KIND_ELLIPSE = 0.0;
static const float KIND_CIRCLE  = 1.0;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  x1        : ATTR0;
  uint  x2        : ATTR1;
  float colorType : ATTR2;
  uint  yBp       : ATTR3;
  // This arc's own stroke width in CSS px. An instance is a junction rather than
  // a read — resolveArcs coalesces identical connections and counts them — so
  // the weight is what says how many reads stand behind it. The count becomes a
  // width through `arcLineWidth`, evaluated once per arc on the CPU (packGpu):
  // that log curve has exactly one implementation, shared with Canvas2D and the
  // SVG export, and re-deriving it here would be a second one. u.lineWidthPx is
  // still read, as the floor every arc gets — see vs_main.
  float lineWidthPx : ATTR4;
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
  // The resolved half stroke width, also constant per instance. Carried rather
  // than recomputed in the fragment so the hull the vertex stage inflated and
  // the ink the fragment measures can only ever be the same width.
  float  halfWidthPx : COLOR4;
  // WHICH LEG a far circle's vertex belongs to: +1 right, -1 left (and +1
  // throughout for an ellipse, which is one connected curve). It exists to kill
  // the SEAM.
  //
  // Both legs are one triangle strip, and a strip has no break in it: the quad
  // between vertex pair SEG/2 (the right leg's tip) and pair SEG/2+1 (the left
  // leg's tip) is a real, rasterized quad spanning the whole pair. Worse, the
  // fragment cannot see that it is spurious — each tip carries the SAME `local`,
  // because the two legs are measured in their own mirrored frames and both end
  // at the same point of the same circle. So `local` interpolates to a constant
  // across that quad, the distance comes out ~0, and it inks: a horizontal bar
  // at the sweep's end depth, joined to the leg at a right angle. An elbow.
  //
  // It only became visible when `legSweepAngle` started ending the sweep at the
  // band edge. At the old full quarter sweep the tips met at the circle's apex,
  // depth r — thousands of px below a band tens of px tall — so the seam quad
  // was always scissored away. The bar was always being drawn; the band just
  // never contained it.
  //
  // A varying rather than degenerate vertices because the strip length is a
  // compile-time constant shared with the ellipse branch: splitting it would
  // grow VERTS_PER_INSTANCE for every instance to add a break only one branch
  // needs. Both vertices of every quad WITHIN a leg carry the same value, so it
  // interpolates to exactly ±1 there and only the seam quad ramps between them.
  float  legSide : COLOR5;
};

// Whether a pair is wide enough that its dome degenerates to a circle. Its own
// function because the radii below and the fragment's `kind` are two readings of
// one predicate, and spelling it twice is how they would come to disagree about
// which shape an arc at exactly the threshold is.
bool arcIsFar(float halfWidthPx, float canvasWidthPx) {
  return 2.0 * halfWidthPx > ARC_FAR_SCREEN_WIDTHS * canvasWidthPx;
}

// The two radii of the half-ellipse an arc draws, in CSS px: the pair's own
// on-screen half-width, and the height its insert size earns — except once the
// pair is `arcIsFar`, when the ellipse becomes a true circle so the band clips
// the apex away and only near-vertical legs at each real endpoint remain.
//
// `//! js-export`ed as a PAIR — adr-051's float2-in-return-position case, and the
// second function to meet its test after `rectSpanPx`:
//
//   - The decision IS the pair. `ry` is defined in terms of `rx` (both through
//     `arcIsFar` and as its far-branch value), so splitting it into two scalar
//     exports makes each recompute the other's branch.
//   - There is no packaging to leave behind. Both lanes are CSS px on both
//     backends; the only per-backend step is choosing a sweep direction, which
//     is Canvas2D's alone.
//   - The pair is the consumer's argument list: `ctx.ellipse(cx, cy, rx, ry, …)`
//     takes them adjacently. That is the honest limit of "generate canvas
//     drawing commands" — the extent a mark occupies, with each backend keeping
//     its own paint and culling.
//
// It was stated twice, and the two copies did not look alike: this pass wrote
// the gate as `2*halfWidthPx > k*canvasW` while drawCanvas.ts's `strokeArcMark`
// wrote `|sx2-sx1| > k*screenWidthPx` and took the answer as a `far` boolean
// parameter. That is the shape the chevron layout drifted in (adr-051, "the
// blind spot the survey had") — stated in different units on the two sides, so
// comment-syncing holds while the arithmetic diverges. A disagreement here is
// not sub-pixel: an ellipse and a circle are different marks.
public float2 arcRadiiPx(float halfWidthPx, float destYPx, float canvasWidthPx) {
  if (arcIsFar(halfWidthPx, canvasWidthPx)) {
    return float2(halfWidthPx, halfWidthPx);
  }
  return float2(halfWidthPx, ARC_APEX_FRACTION * destYPx);
}

// How far around a far circle each leg's HULL has to sweep, in radians from the
// endpoint. The pass is scissored to the arc band, so a leg is only ever seen
// between its endpoint and the band's far edge; sweeping the whole quarter
// circle regardless spends nearly every segment off-screen, and THAT is what
// drew far arcs as triangles rather than as lines.
//
// The failure is worth spelling out, because it looks like a tessellation
// problem and is not. At r = 3e6 px the first of the 32 chords per leg already
// reaches y = 49,000 px, so the entire band lies inside chord one — and a chord
// leaves its circle at tan(halfAngle) px of x per px of y, here tan(PI/128) ≈
// 0.0245, a rate set by the ANGLE PER SEGMENT and so identical at every large
// radius. The fragment measures the true, near-vertical curve, so the ink is
// whatever that receding chord still covers: full width at the foot, tapering to
// nothing at y ≈ 2·(halfWidth + STROKE_AA_PX)/0.0245 — about 100px for a hairline
// in a 200px band, which is why the thicker (better-supported) arcs were also the
// longer triangles. Doubling ARC_CURVE_SEGMENTS only halves the taper rate; it
// converges to a truncated leg, not to a correct one.
//
// Sweeping to the band edge instead puts all 64 segments where they can be seen.
// The chord sagitta is then r·(1 - cos(sweep/64)) ≈ yReach²/(8192·r) at large r —
// under a thousandth of a px — so the hull contains the curve everywhere the
// scissor keeps.
//
// Clamped, so a circle small enough to apex inside the band (a narrow block, where
// `arcIsFar`'s canvasW-relative threshold can fire on a modest radius) still gets
// its full half-sweep and draws as the rounded dome it is.
float legSweepAngle(float radiusPx, float yReachPx) {
  return asin(clamp(yReachPx / max(radiusPx, 1e-6), 0.0, 1.0));
}

// The analytic curve, in band-local CSS px. `radii` and `kind` say which
// distance function measures it; `c` is the centre an ellipse is measured from,
// `ends` the two endpoints' screen x a far circle's legs rise from, `legSweep`
// how far around those legs the hull runs. Like `c` and `ends`, `legSweep` is
// read by one branch only — the circle's; an ellipse always sweeps its full half.
//
// arcColorByIndex is shared from alignmentsUniforms (also used by arcLine), and
// clamps out-of-range slots itself (arcColorSlot).
struct Curve { float2 c; float2 ends; float2 radii; float kind; float yDir; float legSweep; };

// `strokeHalfPx` is the instance's resolved half STROKE width, and it is here
// only to pad the sweep: the hull's butt cut has to land outside the scissor,
// not on the last row of the band. Not to be confused with the `halfWidthPx`
// below, which is the PAIR's on-screen half-width — the radius question, not the
// ink question.
Curve arcCurve(Instance inst, Uniforms u, float strokeHalfPx) {
  float availH = arcAvailH(u.arcBandH);
  float yDir = arcYDir(u);
  // Y the insert size maps to: availH px spans arcsYDomainBp bp, the CPU-chosen
  // domain (zoom-proportional for arcs, autoscaled |tlen| for read cloud).
  // arcBandDestY (alignmentsUniforms) is the shared formula — the same one
  // arcFlat.slang and arcMarker.slang use. CLAMPED to the band, which is what
  // keeps a pair with both endpoints on screen drawing a complete arc BETWEEN
  // those endpoints instead of a curve that leaves through the band edge.
  float destY = arcBandDestY(inst.yBp, availH, u);
  float x1Px = arcBandX(inst.x1, u);
  float x2Px = arcBandX(inst.x2, u);
  float halfWidthPx = abs(x2Px - x1Px) * 0.5;

  Curve cv;
  cv.yDir = yDir;
  cv.ends = float2(min(x1Px, x2Px), max(x1Px, x2Px));
  // `far` is purely a function of on-screen span — no bp limit.
  cv.kind = arcIsFar(halfWidthPx, u.canvasW) ? KIND_CIRCLE : KIND_ELLIPSE;
  cv.c = float2((x1Px + x2Px) * 0.5, 0.0);
  cv.radii = arcRadiiPx(halfWidthPx, destY, u.canvasW);
  // The band the pass is scissored to is u.arcBandH tall measured from the
  // anchor, so that — plus the stroke, so the cut is outside the band rather
  // than on its last row — is the whole of a leg that can be seen.
  cv.legSweep = legSweepAngle(cv.radii.x, u.arcBandH + strokeHalfPx + STROKE_AA_PX);
  return cv;
}

// One hull vertex: the spine point at t ∈ [0,1] pushed `side` × half-width
// along its normal, given both in the frame the fragment measures distance in
// and in band-local screen px. Uniform t is uniform in angle, which is
// equal-arc-length on the circle and close enough on the ellipse for a hull.
// The ellipse spends that angle on its whole half; a far circle's legs spend it
// over `cv.legSweep` each, which is the part of them the band can show.
//
// `halfWidthPx` is the instance's own, not the uniform's: since coalescing,
// each arc is drawn at the width its read support earns (see Instance).
struct ArcVertex { float2 screen; float2 local; float legSide; };

ArcVertex evalArcVertex(float t, float side, float halfWidthPx, Curve cv) {
  float hw = halfWidthPx + STROKE_AA_PX;
  float2 p;
  float2 tang;
  float2 origin;
  // Mirrors local x into screen x, so a far circle's two legs can share one
  // outward-positive frame.
  float legDir = 1.0;
  // An ellipse is one connected curve, so every vertex is on the same "leg".
  float legSide = 1.0;

  if (cv.kind >= KIND_CIRCLE) {
    // Two legs, each built from ITS OWN real endpoint outward. Reconstructing a
    // leg as `centre + cos(a)·r` cancels catastrophically once r passes ~1e6 px
    // (a mate a few thousand screen widths away): both terms are huge and their
    // difference is the handful of pixels actually on screen. `1 - cos b` is
    // the same trap one level down, hence the half-angle identity.
    bool rightLeg = t <= 0.5;
    // Each leg gets half the strip, so its own parameter runs over [0, 0.5] and
    // 2·legSweep is what turns that into the angle it should cover.
    float b = (rightLeg ? t : 1.0 - t) * 2.0 * cv.legSweep;
    float sh = sin(b * 0.5);
    p = float2(-2.0 * cv.radii.x * sh * sh, sin(b) * cv.radii.x * cv.yDir);
    tang = float2(-sin(b), cos(b) * cv.yDir);
    origin = float2(rightLeg ? cv.ends.y : cv.ends.x, 0.0);
    legDir = rightLeg ? 1.0 : -1.0;
    // Constant within a leg, opposite between them — see VsOut.legSide.
    legSide = legDir;
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
  av.legSide = legSide;
  return av;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint seg = vid / 2u;
  float side = (vid % 2u == 0u) ? -1.0 : 1.0;
  float t = float(seg) / float(ARC_CURVE_SEGMENTS);

  // Resolved before the curve, because the curve's leg sweep is padded by it.
  // `arcLineWidth` never returns less than the configured width, so a support-1
  // arc still resolves to exactly what this pass drew before coalescing existed.
  o.halfWidthPx = arcStrokeHalfPx(inst.lineWidthPx, u);

  Curve cv = arcCurve(inst, u, o.halfWidthPx);
  ArcVertex av = evalArcVertex(t, side, o.halfWidthPx, cv);
  o.local = av.local;
  o.legSide = av.legSide;
  o.radii = cv.radii;
  o.kind = cv.kind;
  o.position = arcBandClipPos(av.screen, u);
  o.color = float4(arcColorByIndex(uint(inst.colorType + 0.5), u), 1.0);
  return o;
}

// Perpendicular distance in CSS px from this fragment to its analytic curve.
// `local` is whichever frame that curve's measurement wants: the ellipse's
// centre, or a far circle's leg endpoint.
float arcDistance(VsOut i) {
  if (i.kind >= KIND_CIRCLE) { return distToWideCircle(i.local, i.radii.x); }
  return sdEllipse(i.local, i.radii);
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Drop the seam quad joining a far circle's two legs — see VsOut.legSide.
  // Every vertex WITHIN a leg carries the same value, so a leg interpolates to
  // exactly +/-1 and only the seam ramps between them; 0.999 therefore spares
  // the legs entirely while leaving under a pixel of the bar at each tip.
  if (abs(fragIn.legSide) < 0.999) { discard; }
  // |∇d| is analytically 1 per CSS px, so the AA ramp is a constant number of
  // device pixels, not a derivative — see STROKE_AA_PX.
  float alpha = strokeCoverage(arcDistance(fragIn), fragIn.halfWidthPx, u);
  // Output straight alpha — the HAL blend func does the premultiply.
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
