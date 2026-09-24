// Exact distances to the two curves a stroked arc is measured against: an
// axis-aligned ellipse, and a circle whose radius dwarfs the band it is
// clipped to. Shared by the alignments arc band and the link mark, which
// draw the same half-ellipse and degenerate it to the same circle.
//! js-export: distToWideCirclePx

module curveDistance;

// Inigo Quilez's closed-form solve of the quartic. Chosen over the iterative
// alternatives because the arc band produces very flat ellipses (a 25px band
// under a 1500px pair is 44:1, and it goes past 88:1): measured against an
// fp64 reference at fp32 precision, this stays within 0.031px out to 88:1,
// where a seeded Newton on the parametric angle runs away entirely.
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
  float l = ab.y * ab.y - ab.x * ab.x;
  // Circle: `l` is the solver's divisor, so hand those back the exact answer
  // rather than a division by ~0. Reachable — a clamped dome's ry is pinned to
  // the band while rx tracks the pair's width, so they cross.
  if (abs(l) < 1e-6 * ab.y * ab.y) { return abs(length(q) - ab.x); }
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
    float s = sign(qq + h) * pow(abs(qq + h), 1.0 / 3.0);
    float t = sign(qq - h) * pow(abs(qq - h), 1.0 / 3.0);
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
