// Shared per-instance layout + uniform block for fill/edge synteny shaders.
// Both read the same instance buffer (fill draws all CIGAR ops, edge only
// outlines the clicked alignment) and use an identical uniform layout.
module syntenyTypes;

public struct Instance {
  public float x1                : ATTR0;
  public float x2                : ATTR1;
  public float x3                : ATTR2;
  public float x4                : ATTR3;
  public uint  color             : ATTR4;
  public float featureId         : ATTR5;
  public float isCurve           : ATTR6;
  public float queryTotalLength  : ATTR7;
  public float padTop            : ATTR8;
  public float padBottom         : ATTR9;
};

public struct Uniforms {
  public float2 resolution;
  public float  height;
  public float  adjOff0;
  public float  adjOff1;
  public float  scale0;
  public float  scale1;
  public float  maxOffScreenPx;
  public float  minAlignmentLength;
  public float  alpha;
  public float  hoveredFeatureId;
  public float  clickedFeatureId;
  public float  yTop;
};

public struct Corners {
  public float x1, x2, x3, x4;
};

public Corners computeCorners(Instance inst, Uniforms u) {
  Corners c;
  c.x1 = (inst.x1 - u.adjOff0) * u.scale0 - inst.padTop * (u.scale0 - 1.0);
  c.x2 = (inst.x2 - u.adjOff0) * u.scale0 - inst.padTop * (u.scale0 - 1.0);
  c.x3 = (inst.x3 - u.adjOff1) * u.scale1 - inst.padBottom * (u.scale1 - 1.0);
  c.x4 = (inst.x4 - u.adjOff1) * u.scale1 - inst.padBottom * (u.scale1 - 1.0);
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

// SYNC: must match FILL_SEGMENTS in instanceInterleave.ts.
public static const uint FILL_SEGS = 16u;

// (edge0, edge1, y) at parameter t along the parallelogram. When isCurve is
// on, uses a cubic Hermite ease-in-out so synteny ribbons don't kink at the
// endpoints.
public float3 hermiteEdges(Corners c, float t, float isCurve, Uniforms u) {
  float edge0, edge1, y;
  if (isCurve > 0.5) {
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
    uint nUpper = clamp(uint(round(float(FILL_SEGS) * tCross)), 1u, FILL_SEGS - 1u);
    if (seg < nUpper) {
      t0 = float(seg) / float(nUpper) * tCross;
      t1 = float(seg + 1u) / float(nUpper) * tCross;
    } else {
      uint lSeg = seg - nUpper;
      uint nLower = FILL_SEGS - nUpper;
      t0 = tCross + float(lSeg) / float(nLower) * (1.0 - tCross);
      t1 = tCross + float(lSeg + 1u) / float(nLower) * (1.0 - tCross);
    }
  } else {
    t0 = float(seg) / float(FILL_SEGS);
    t1 = float(seg + 1u) / float(FILL_SEGS);
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
