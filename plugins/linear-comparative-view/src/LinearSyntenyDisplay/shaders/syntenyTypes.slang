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
