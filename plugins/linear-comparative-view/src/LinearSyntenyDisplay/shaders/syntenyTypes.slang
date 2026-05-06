// Shared per-instance layout + uniform block for fill/edge synteny shaders.
// Each instance is one parallelogram (or one tessellated curve segment): four
// corner positions in cumulative-bp space (split hi/lo for hp-math precision)
// plus the inter-region padding pixels accumulated before the corner's
// region. Corners 1/2 belong to the top view (view 0), corners 3/4 to the
// bottom view (view 1).
module syntenyTypes;

import hpmath;

public struct Instance {
  public float bp1Hi : ATTR0;
  public float bp1Lo : ATTR1;
  public float bp2Hi : ATTR2;
  public float bp2Lo : ATTR3;
  public float bp3Hi : ATTR4;
  public float bp3Lo : ATTR5;
  public float bp4Hi : ATTR6;
  public float bp4Lo : ATTR7;
  public uint  color             : ATTR8;
  public float featureId         : ATTR9;
  public float queryTotalLength  : ATTR10;
  public float padTop            : ATTR11;
  public float padBottom         : ATTR12;
};

// Per-view hp-math origin (`viewBp = offsetPx * bpPerPx`, hi/lo split) +
// `bpPerPxInv`. The padded-bp encoding of the view origin lets the shader
// reconstruct LGV-aligned screen positions with just the per-instance `pad`
// field — no companion viewPad uniform is needed (math derivation in
// hpCornerScreenX). `hpZero` is the sentinel passed through to hpmath
// helpers (always 0 from JS).
public struct Uniforms {
  public float2 resolution;
  public float  height;
  public float  viewBp0Hi;
  public float  viewBp0Lo;
  public float  bpPerPxInv0;
  public float  viewBp1Hi;
  public float  viewBp1Lo;
  public float  bpPerPxInv1;
  public float  hpZero;
  public float  maxOffScreenPx;
  public float  minAlignmentLength;
  public float  alpha;
  public float  hoveredFeatureId;
  public float  clickedFeatureId;
  public float  yTop;
  public float  isCurve;
};

public struct Corners {
  public float x1, x2, x3, x4;
};

// hp-math screen-x for one corner. With `viewBp = offsetPx * bpPerPx`
// (padded-bp), `(cumBp - viewBp)/bpPerPx + pad = cumBp/bpPerPx + pad -
// offsetPx = featurePx_padded - offsetPx`, which is the LGV's render
// position. The `max(..., -inf)` pattern (lifted from hpmath.slang)
// prevents the compiler from combining the hi/lo terms before the multiply,
// which is what preserves the extra mantissa bits.
float hpCornerScreenX(
  float bpHi, float bpLo,
  float originHi, float originLo,
  float bpPerPxInv, float pad, float hpZero,
) {
  float inf = 1.0 / hpZero;
  float hi = max(bpHi - originHi, -inf);
  float lo = max(bpLo - originLo, -inf);
  return dot(float2(hi, lo), float2(bpPerPxInv, bpPerPxInv)) + pad;
}

public Corners computeCorners(Instance inst, Uniforms u) {
  Corners c;
  c.x1 = hpCornerScreenX(inst.bp1Hi, inst.bp1Lo, u.viewBp0Hi, u.viewBp0Lo,
                         u.bpPerPxInv0, inst.padTop, u.hpZero);
  c.x2 = hpCornerScreenX(inst.bp2Hi, inst.bp2Lo, u.viewBp0Hi, u.viewBp0Lo,
                         u.bpPerPxInv0, inst.padTop, u.hpZero);
  c.x3 = hpCornerScreenX(inst.bp3Hi, inst.bp3Lo, u.viewBp1Hi, u.viewBp1Lo,
                         u.bpPerPxInv1, inst.padBottom, u.hpZero);
  c.x4 = hpCornerScreenX(inst.bp4Hi, inst.bp4Lo, u.viewBp1Hi, u.viewBp1Lo,
                         u.bpPerPxInv1, inst.padBottom, u.hpZero);
  return c;
}

public bool isCulled(Corners c, float queryTotalLength, Uniforms u) {
  if (u.minAlignmentLength > 0.0 && queryTotalLength < u.minAlignmentLength) {
    return true;
  }
  float mOff = u.maxOffScreenPx;
  float rW = u.resolution.x;
  return max(c.x1, c.x2) < -mOff || min(c.x1, c.x2) > rW + mOff
      || max(c.x3, c.x4) < -mOff || min(c.x3, c.x4) > rW + mOff;
}

// SYNC: must match BEZIER_SEGMENTS in drawSyntenyUtils.ts
public static const uint BEZIER_SEGMENTS = 16u;

// (edge0, edge1, y) at parameter t along the parallelogram. When isCurve is
// on, uses a cubic Hermite ease-in-out so synteny ribbons don't kink at the
// endpoints.
public float3 hermiteEdges(Corners c, float t, Uniforms u) {
  float edge0, edge1, y;
  if (u.isCurve > 0.5) {
    float s = t * t * (3.0 - 2.0 * t);
    edge0 = lerp(c.x1, c.x4, s);
    edge1 = lerp(c.x2, c.x3, s);
    y = u.yTop + u.height * (1.5 * t * (1.0 - t) + t * t * t);
  } else {
    edge0 = lerp(c.x1, c.x4, t);
    edge1 = lerp(c.x2, c.x3, t);
    y = u.yTop + t * u.height;
  }
  return float3(edge0, edge1, y);
}

// Two-triangle fan tessellation of one parallelogram: vid maps to (segment,
// vertex-in-segment), which decides the parameter t and which edge (side).
// When top/bottom diffs have opposite signs the parallelogram crosses itself
// (inversion pinch), so we bias tessellation density toward the crossing.
public void computeFillSegmentT(uint vid, Corners c, out float t, out float side) {
  uint seg = vid / 6u;
  uint vertInSeg = vid % 6u;
  float topDiff = c.x1 - c.x2;
  float botDiff = c.x4 - c.x3;

  float t0, t1;
  if (topDiff * botDiff < 0.0) {
    float tCross = clamp(topDiff / (topDiff - botDiff), 0.01, 0.99);
    uint nUpper = clamp(uint(round(float(BEZIER_SEGMENTS) * tCross)), 1u, BEZIER_SEGMENTS - 1u);
    if (seg < nUpper) {
      t0 = float(seg) / float(nUpper) * tCross;
      t1 = float(seg + 1u) / float(nUpper) * tCross;
    } else {
      uint lSeg = seg - nUpper;
      uint nLower = BEZIER_SEGMENTS - nUpper;
      t0 = tCross + float(lSeg) / float(nLower) * (1.0 - tCross);
      t1 = tCross + float(lSeg + 1u) / float(nLower) * (1.0 - tCross);
    }
  } else {
    t0 = float(seg) / float(BEZIER_SEGMENTS);
    t1 = float(seg + 1u) / float(BEZIER_SEGMENTS);
  }

  switch (vertInSeg) {
    case 0u: { t = t0; side = 0.0; break; }
    case 1u: { t = t0; side = 1.0; break; }
    case 2u: { t = t1; side = 0.0; break; }
    case 3u: { t = t1; side = 0.0; break; }
    case 4u: { t = t0; side = 1.0; break; }
    case 5u: { t = t1; side = 1.0; break; }
    default: { t = 0.0; side = 0.0; break; }
  }
}
