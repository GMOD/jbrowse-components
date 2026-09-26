// Exact distances to the two curves a stroked arc is measured against - an
// axis-aligned ellipse, and a circle whose radius dwarfs the band it is
// clipped to - and the hull vertices that have to clear them. Shared by the
// alignments arc band and the link mark, which draw the same half-ellipse and
// degenerate it to the same circle.
//
// The fragment ramps its alpha to zero at `halfWidth + aaHalfPx`, so the hull
// has to cover everything nearer the curve than that. Both flanks of a hull
// sampled from the offset curve fall short of it at a clamped dome's feet.
//! js-export: distToWideCirclePx, wideCircleLeg, wideCircleLegStep, ellipseHullPoint, wideCircleHullPoint
//! js-skip: nearCircleDistancePx — a float32 remedy with no float64 caller. The hit tests' copy of this file's solve (marks/ellipseDistance.ts) holds the ellipse at every aspect, so nothing outside the shader has an approximation to want.

module curveDistance;

// How near a circle an ellipse has to be before `sdEllipse` stops solving and
// measures instead: radii within ~2.5%, as |ay² - ax²| against ay². The two
// formulas' worst errors over a 6px stroke meet here at ~0.01px — below it the
// solve degrades with radius (0.10px at r=4000), above it the measure degrades
// with curvature (0.01px at r=4).
static const float ELLIPSE_CIRCLE_TOL = 0.05;

// The distance to an ellipse the solve cannot reach. Every term in it divides
// by `l = ay² - ax²`, a difference of two nearly equal squares, so float32 has
// lost the ellipse before the quartic is assembled: at 250px radii 1e-5 apart
// the solve is 3.6px out and 36% of the stroke's samples flip. Not a corner —
// a clamped dome pins ry to the band while rx tracks the pair's width, so a
// zoom walks rx through ry and through every ratio on the way.
//
// The implicit field |p/ab| - 1 over its own gradient instead: exact on a true
// circle, which is why it replaces the exact-circle branch rather than sitting
// beside it, and first-order elsewhere.
float nearCircleDistancePx(float qx, float qy, float ax, float ay) {
  float kx = qx / ax;
  float ky = qy / ay;
  float k = sqrt(kx * kx + ky * ky);
  float gx = qx / (ax * ax);
  float gy = qy / (ay * ay);
  return abs(k * (k - 1.0) / max(sqrt(gx * gx + gy * gy), 1e-20));
}

// Inigo Quilez's closed-form solve of the quartic. Chosen over the iterative
// alternatives because the arc band produces very flat ellipses (a 25px band
// under a 1500px pair is 44:1, and it goes past 88:1): measured against an
// fp64 reference at fp32 precision, this stays within 0.031px out to 88:1,
// where a seeded Newton on the parametric angle runs away entirely.
//
// THAT MEASUREMENT IS THE FLAT END, and the solve fails at the round one, in
// float32 alone — the same source in float64 is exact to 1e-9. It breaks the
// picture rather than nudging it, because the stroke reads this through a
// half-pixel ramp: a dome at 380x249px drew as scattered dots on WebGL where
// Canvas2D drew a line. Two guards below, each where its failure arises.
//
// NOT `//! js-export`ed, and the hit tests carry a float64 copy of this formula
// (render-core marks/ellipseDistance.ts) BECAUSE of that. The reasoning is
// worth keeping, since "lift it like arcRadiiPx" is the obvious first move and
// it was tried:
//
//   - The emitter refuses float2 params, so lifting means splitting a scalar
//     core out (the ADR-051 step-1 pattern). Necessary but NOT sufficient, and
//     the shortfall is SILENT: the core still calls acos/cos/sin, none of which
//     are in the emitter's MATH_BUILTINS, so the emitter refuses it — and
//     check-oracle's `emittableOf` DROPS a refused candidate from the sweep
//     rather than failing on it. Do the split alone and the oracle stays green
//     on an unchanged comparison count, which reads as "the problem went away".
//     It has not; nothing has been checked.
//   - Add those three builtins and it does enter the sweep — which takes every
//     declared function with an emittable scalar signature, not only the
//     `//! js-export`ed ones, and `//! js-skip` does not exempt one either. Then
//     it fails, at the oracle's 1e-5 relative: 90 of the 400 tuples, 42 of them
//     on inputs with both radii positive (the sweep also generates negative
//     radii, which `arcRadiiPx` does not produce).
//   - And NOT because the twin is wrong. On every one of those 42 the float64
//     twin matches a brute-force minimum over the parametric angle to 1.1e-6
//     relative — inside the oracle's own tolerance — and slangc's float32 is the
//     side that has drifted: `(1.5, 0, 65536, 3)` is 3.0, where the C++ answers
//     3.3541019. float32 loses the solver, float64 does not.
//   - So the oracle cannot referee this function at any tolerance it could keep
//     for the rest of the tree, the same way it cannot referee `mix`/`step`
//     (SHADER_JS_CODEGEN.md). Exporting it would have meant a suppression in
//     the strongest gate here, to share a NUMERICAL METHOD rather than a
//     decision.
//
// What actually has to agree is WHICH ELLIPSE, and that is the radii pair each
// consumer `//! js-export`s (`arcRadiiPx`, `linkRadiiPx`), which is what its hit
// test reads. Given the same two radii, the distance to them is geometry with
// one right answer, and the copy is pinned against a brute-force reference
// rather than against this (see ellipseDistance.test.ts), which is the
// stronger check of the two.
public float sdEllipse(float2 p, float2 radii) {
  float2 q = abs(p);
  float2 ab = radii;
  if (q.x > q.y) { q = q.yx; ab = ab.yx; }
  // Both radii zero is the one shape the near-circle test below cannot catch:
  // its own threshold is `ab.y * ab.y`, so it reads `abs(l) < 0` and lets a
  // zero `l` through to divide. A link pair whose two ends land on the same
  // pixel reaches it (`linkRadiiPx` of a zero half-width), and the ellipse is
  // then the point at the origin.
  if (dot(ab, ab) <= 0.0) { return length(q); }
  float l = ab.y * ab.y - ab.x * ab.x;
  if (abs(l) < ELLIPSE_CIRCLE_TOL * ab.y * ab.y) {
    return nearCircleDistancePx(q.x, q.y, ab.x, ab.y);
  }
  float m = ab.x * q.x / l; float m2 = m * m;
  float n = ab.y * q.y / l; float n2 = n * n;
  float c = (m2 + n2 - 1.0) / 3.0;
  float c3 = c * c * c;
  float d = c3 + m2 * n2;
  float g = m + m * n2;
  float co;
  if (d < 0.0) {
    float h = acos(clamp((c3 + m2 * n2 * 2.0) / c3, -1.0, 1.0)) / 3.0;
    float s = cos(h);
    float t = sin(h) * sqrt(3.0);
    float rx = sqrt(max(-c * (s + t + 2.0) + m2, 0.0));
    float ry = sqrt(max(-c * (s - t + 2.0) + m2, 0.0));
    co = (ry + sign(l) * rx + abs(g) / max(rx * ry, 1e-20) - m) / 2.0;
  } else {
    float qq = c3 + m2 * n2 * 2.0;
    float h = 2.0 * m * n * sqrt(d);
    // The two cube roots are of `qq + h` and `qq - h`, whose product is c3*c3
    // identically. So the lower one comes from that quotient rather than from
    // the subtraction, which cancels to nothing exactly where the dome lives:
    // at 380x249px the two agree to every float32 digit they have, `qq - h`
    // rounds to zero, and the distance lands up to 3px off the curve.
    float w = qq + h;
    float aw = abs(w);
    float s = sign(w) * pow(aw, 1.0 / 3.0);
    float t = aw > 0.0 ? sign(w) * pow(c3 * (c3 / aw), 1.0 / 3.0) : 0.0;
    float rx = -s - t - c * 4.0 + 2.0 * m2;
    float ry = (s - t) * sqrt(3.0);
    float rm = sqrt(rx * rx + ry * ry);
    co = (ry / sqrt(max(rm - rx, 1e-20)) + 2.0 * g / max(rm, 1e-20) - m) / 2.0;
  }
  co = clamp(co, -1.0, 1.0);
  float2 r = ab * float2(co, sqrt(max(1.0 - co * co, 0.0)));
  return length(r - q);
}

// Distance from a point to a circle whose radius dwarfs the band it is clipped
// to — the far-pair case, where r reaches millions of px. `legLocal` is the
// point relative to the endpoint the circle meets the baseline at, x positive
// pointing AWAY from the circle.
//
// Exact, but written so nothing cancels: the centre sits at (-r, 0) in that
// frame, so |p-c|² = r² + 2r·x + x² + y² identically and
// |p-c| - r = rk / (sqrt(1+k) + 1) with both `rk` and `k` assembled from small
// terms. Evaluating `length(p - c) - r`, or even recovering x as
// `abs(p.x) - r` from a centre-relative point, loses every significant digit
// past r ≈ 1e6 px.
//
// Scalar core, `//! js-export`ed for the hit tests — and for the same reason
// it is written this way at all: a hit test asking "is the cursor on this leg"
// from `length(p - c) - r` would lose every significant digit exactly where
// far pairs live.
public float distToWideCirclePx(float x, float y, float r) {
  float rk = 2.0 * x + (x * x + y * y) / r;
  return abs(rk / (sqrt(max(1.0 + rk / r, 0.0)) + 1.0));
}

public float distToWideCircle(float2 legLocal, float r) {
  return distToWideCirclePx(legLocal.x, legLocal.y, r);
}

// How far around a far circle each leg's hull sweeps, in radians from its foot:
// to the band's edge and no further. Sweeping the whole quarter spends nearly
// every segment off-screen, and at r = 3e6 px the whole band then falls inside
// the first chord, which recedes from the near-vertical curve at a rate set by
// the angle per segment — so the leg draws as a tapering triangle however many
// segments there are. Clamped, so a circle small enough to apex inside the band
// still gets its full quarter and draws as a dome.
public float legSweepAngle(float radiusPx, float yReachPx) {
  return asin(clamp(yReachPx / max(radiusPx, 1e-6), 0.0, 1.0));
}

// Which leg vertex pair `seg` of a `segments`-long strip builds (x: +1 the right
// leg, -1 the left), and its angle from that leg's foot (y). The strip has
// `segments + 1` pairs, one more than either leg needs, and at an even
// `segments` the right leg takes it. Each leg is spread over ITS OWN count, so
// both reach `legSweep` — and both do so in equal angular steps, which is what
// puts a chord's sagitta below a pixel everywhere the band can show. The quad
// between the two tips is the seam the fragment discards.
//
// `segments` is at least 3; below that the left leg is a single pair and has no
// span to spread. Both callers pass a compile-time 64.
public float2 wideCircleLeg(uint seg, uint segments, float legSweep) {
  uint half = segments / 2u;
  if (seg <= half) {
    return float2(1.0, float(seg) / float(half) * legSweep);
  }
  return float2(-1.0,
                float(segments - seg) / float(segments - half - 1u) * legSweep);
}

// The angle between neighbouring vertex pairs on `seg`'s leg, which is not the
// same on both legs.
public float wideCircleLegStep(uint seg, uint segments, float legSweep) {
  uint half = segments / 2u;
  return legSweep / float(seg <= half ? half : segments - half - 1u);
}

// One hull vertex at parametric angle `a` for a hull stepping `2 * halfStep`,
// `padPx` from the half-ellipse: positive on the outer flank, negative on the
// inner.
//
// Outside, the offset region is convex, so the vertex is where the offset
// tangent lines at `a` +/- the half step meet: `p(a) * sec(halfStep)` plus the
// miter `padPx * (n1 + n2) / (1 + n1 . n2)`. Chords through points on the
// offset curve would sag inside it. The divisor's floor keeps a collapsed band
// (ry 0, the foot's normals opposed) finite.
//
// Inside, a chord between offset points already stays clear of the ink, until
// the curve turns tighter than the pad and the offset folds past an axis. A
// folded vertex moves to where the fold crosses that axis, the one point there
// exactly the pad from the curve.
public float2 ellipseHullPoint(float cosA, float sinA, float cosHalf,
                               float sinHalf, float rx, float ry, float padPx) {
  float px = cosA * rx;
  float py = sinA * ry;
  if (padPx <= 0.0) {
    float d = -padPx;
    float gx = ry * cosA;
    float gy = rx * sinA;
    float glen = sqrt(gx * gx + gy * gy);
    bool acrossX = ry * glen < d * rx;
    bool acrossY = rx * glen < d * ry;
    if (acrossX && acrossY) { return float2(0.0, 0.0); }
    if (acrossX) {
      float foldX = sqrt(max(ry * ry - d * d, 0.0) * max(rx * rx - ry * ry, 0.0));
      return float2(sign(cosA) * foldX / max(ry, 1e-6), 0.0);
    }
    if (acrossY) {
      float foldY = sqrt(max(rx * rx - d * d, 0.0) * max(ry * ry - rx * rx, 0.0));
      return float2(0.0, sign(sinA) * foldY / max(rx, 1e-6));
    }
    float k = d / max(glen, 1e-6);
    return float2(px - gx * k, py - gy * k);
  }
  float ax = ry * (cosA * cosHalf + sinA * sinHalf);
  float ay = rx * (sinA * cosHalf - cosA * sinHalf);
  float bx = ry * (cosA * cosHalf - sinA * sinHalf);
  float by = rx * (sinA * cosHalf + cosA * sinHalf);
  float al = max(sqrt(ax * ax + ay * ay), 1e-20);
  float bl = max(sqrt(bx * bx + by * by), 1e-20);
  float nx = ax / al + bx / bl;
  float ny = ay / al + by / bl;
  float m = 2.0 * padPx / max(nx * nx + ny * ny, 2e-4);
  return float2(px / cosHalf + nx * m, py / cosHalf + ny * m);
}

// The same vertex for a far pair's leg, in the foot-relative frame
// `distToWideCirclePx` measures in. A circle's normals are radial, so the outer
// flank scales the offset radius by `sec(halfStep)` and the inner one takes the
// offset point as it is. The vertex's standoff from the circle is carried as
// `grow` rather than recovered from `r * cos(b) - r`, which cancels at the radii
// far pairs reach.
public float2 wideCircleHullPoint(float sinB, float sinHalfB, float cosHalf,
                                  float radiusPx, float padPx) {
  float sec = padPx > 0.0 ? 1.0 / max(cosHalf, 1e-6) : 1.0;
  float grow = radiusPx * (sec - 1.0) + sec * padPx;
  float sh2 = sinHalfB * sinHalfB;
  return float2(grow * (1.0 - 2.0 * sh2) - 2.0 * radiusPx * sh2,
                (radiusPx + grow) * sinB);
}
