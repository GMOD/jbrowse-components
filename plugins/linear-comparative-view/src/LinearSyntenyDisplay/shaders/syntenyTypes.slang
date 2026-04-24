// Shared per-instance layout + uniform block for fill/edge synteny shaders.
// Both read the same instance buffer (fill draws all CIGAR ops, edge only
// outlines the clicked alignment) and use an identical uniform layout.
//
// Coordinate convention (post bp-coordinate refactor): x1..x4 are bp-offset
// within the corner's `(top|bot)RegionIdx`-th displayedRegion. The shader
// projects them to screen pixels via `regionOffsetA/B[idx] + bp / bpPerPx`
// with the hpmath technique so deep-zoom precision holds past 32-bit float.
module syntenyTypes;

import hpmath;

public struct Instance {
  public uint x1              : ATTR0;
  public uint x2              : ATTR1;
  public uint x3              : ATTR2;
  public uint x4              : ATTR3;
  public uint topRegionIdx    : ATTR4;
  public uint botRegionIdx    : ATTR5;
  public uint color           : ATTR6;
  public float featureId         : ATTR7;
  public float queryTotalLength  : ATTR8;
};

// MAX_REGIONS = 16. If a view has more than that we fall back to per-region
// draw calls (not yet wired — warn + clamp for now).
public struct Uniforms {
  public float2 resolution;
  public float  height;
  public float  bpPerPx0;
  public float  bpPerPx1;
  public float  maxOffScreenPx;
  public float  minAlignmentLength;
  public float  alpha;
  public float  hoveredFeatureId;
  public float  clickedFeatureId;
  public float  yTop;
  public float  isCurve;
  public float  hpZero;
  // regionOffsetA[0..15] = screen pixel where bp=0 of view[level].displayedRegions[i] lands
  public float  regionOffsetA0;
  public float  regionOffsetA1;
  public float  regionOffsetA2;
  public float  regionOffsetA3;
  public float  regionOffsetA4;
  public float  regionOffsetA5;
  public float  regionOffsetA6;
  public float  regionOffsetA7;
  public float  regionOffsetA8;
  public float  regionOffsetA9;
  public float  regionOffsetA10;
  public float  regionOffsetA11;
  public float  regionOffsetA12;
  public float  regionOffsetA13;
  public float  regionOffsetA14;
  public float  regionOffsetA15;
  // regionOffsetB[0..15] = same, for view[level + 1]
  public float  regionOffsetB0;
  public float  regionOffsetB1;
  public float  regionOffsetB2;
  public float  regionOffsetB3;
  public float  regionOffsetB4;
  public float  regionOffsetB5;
  public float  regionOffsetB6;
  public float  regionOffsetB7;
  public float  regionOffsetB8;
  public float  regionOffsetB9;
  public float  regionOffsetB10;
  public float  regionOffsetB11;
  public float  regionOffsetB12;
  public float  regionOffsetB13;
  public float  regionOffsetB14;
  public float  regionOffsetB15;
};

public struct Corners {
  public float x1, x2, x3, x4;
};

float regionOffsetA(Uniforms u, uint idx) {
  switch (idx) {
    case 0u:  return u.regionOffsetA0;
    case 1u:  return u.regionOffsetA1;
    case 2u:  return u.regionOffsetA2;
    case 3u:  return u.regionOffsetA3;
    case 4u:  return u.regionOffsetA4;
    case 5u:  return u.regionOffsetA5;
    case 6u:  return u.regionOffsetA6;
    case 7u:  return u.regionOffsetA7;
    case 8u:  return u.regionOffsetA8;
    case 9u:  return u.regionOffsetA9;
    case 10u: return u.regionOffsetA10;
    case 11u: return u.regionOffsetA11;
    case 12u: return u.regionOffsetA12;
    case 13u: return u.regionOffsetA13;
    case 14u: return u.regionOffsetA14;
    case 15u: return u.regionOffsetA15;
    default:  return 0.0;
  }
}

float regionOffsetB(Uniforms u, uint idx) {
  switch (idx) {
    case 0u:  return u.regionOffsetB0;
    case 1u:  return u.regionOffsetB1;
    case 2u:  return u.regionOffsetB2;
    case 3u:  return u.regionOffsetB3;
    case 4u:  return u.regionOffsetB4;
    case 5u:  return u.regionOffsetB5;
    case 6u:  return u.regionOffsetB6;
    case 7u:  return u.regionOffsetB7;
    case 8u:  return u.regionOffsetB8;
    case 9u:  return u.regionOffsetB9;
    case 10u: return u.regionOffsetB10;
    case 11u: return u.regionOffsetB11;
    case 12u: return u.regionOffsetB12;
    case 13u: return u.regionOffsetB13;
    case 14u: return u.regionOffsetB14;
    case 15u: return u.regionOffsetB15;
    default:  return 0.0;
  }
}

public Corners computeCorners(Instance inst, Uniforms u) {
  Corners c;
  float3 bpRangeA = float3(0.0, 0.0, u.bpPerPx0);
  float3 bpRangeB = float3(0.0, 0.0, u.bpPerPx1);
  float topBase = regionOffsetA(u, inst.topRegionIdx);
  float botBase = regionOffsetB(u, inst.botRegionIdx);
  c.x1 = topBase + hpScaleLinear(hpSplitUint(inst.x1), bpRangeA, u.hpZero);
  c.x2 = topBase + hpScaleLinear(hpSplitUint(inst.x2), bpRangeA, u.hpZero);
  c.x3 = botBase + hpScaleLinear(hpSplitUint(inst.x3), bpRangeB, u.hpZero);
  c.x4 = botBase + hpScaleLinear(hpSplitUint(inst.x4), bpRangeB, u.hpZero);
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
