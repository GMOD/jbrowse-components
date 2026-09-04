// The read pass's strand arrowhead: how far it reaches, which edge it caps and
// its geometry. A module rather than part of read.slang because slangc drops
// what no entry point reaches, and the hit test's `chevronContains` is exactly
// that — a question the draw path never asks. Here every export is probed.
//! export-consts: CHEVRON_PX
//! js-export: chevronCapsEdge, chevronContains
//! js-skip: chevronEdgeDistPx — reached as a private helper inside the generated chevronContains, so the edge geometry is already shared without being public; the shader calls it for its cap vertices, the hit test only ever wants the containment it decides
module readChevron;

// Arrowhead size in CSS px: how far the apex protrudes past the read edge.
public static const float CHEVRON_PX = 8.0;

// Which edge of a segment the arrowhead caps, as a GENOMIC sign: +1 its end
// (forward strand, and this is the read's last segment), -1 its start (reverse,
// first segment), 0 none. `flipX` turns the sign into a screen direction, which
// is why the hit test can ask this in bp and never see a reversed region.
public int chevronCapsEdge(int strand, uint edgeFlags) {
  if (strand > 0 && (edgeFlags & 2u) != 0u) { return 1; }
  if (strand < 0 && (edgeFlags & 1u) != 0u) { return -1; }
  return 0;
}

// The arrowhead is the triangle from the segment's two corners on the capped
// edge to an apex CHEVRON_PX beyond it at mid-row. This is the signed CSS-px
// distance from a point to one of its slanted edges, positive inside: `dxPx`
// beyond the capped edge, `dyPx` from mid-row toward the corner that edge
// leaves from — the other edge is the same function at -dyPx. The vertex stage
// seeds `localPos` from it (the outline reads the min of the two), and
// `chevronContains` is built on it, so the tip a hover lands on is the tip the
// fragment inked.
public float chevronEdgeDistPx(float dxPx, float dyPx, float featHeight) {
  float halfH = featHeight * 0.5;
  return (CHEVRON_PX * halfH - halfH * dxPx - CHEVRON_PX * dyPx)
      / sqrt(halfH * halfH + CHEVRON_PX * CHEVRON_PX);
}

// Whether a point (`dxPx` beyond the capped edge, `dyPx` either side of
// mid-row) is inside the arrowhead. `dxPx >= 0` is what stops the two
// half-planes from also admitting the body side, which the body answers for.
public bool chevronContains(float dxPx, float dyPx, float featHeight) {
  return dxPx >= 0.0
      && min(chevronEdgeDistPx(dxPx, dyPx, featHeight),
             chevronEdgeDistPx(dxPx, -dyPx, featHeight)) >= 0.0;
}
