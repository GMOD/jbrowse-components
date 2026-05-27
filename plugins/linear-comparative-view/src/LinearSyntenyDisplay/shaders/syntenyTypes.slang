// Shared per-instance layout + uniform block for fill/edge synteny shaders.
// Each instance is one parallelogram (or one curved ribbon strip): four
// corner positions in cumulative-bp space (split hi/lo for hp-math precision)
// plus the inter-region padding pixels accumulated before the corner's
// region. Corners 1/2 belong to the top view (view 0), corners 3/4 to the
// bottom view (view 1).
//
// Curve mode and straight-line mode live in separate shader files
// (syntenyFill{Curve,Straight}.slang, syntenyEdge{Curve,Straight}.slang) so
// there are no `isCurve` branches anywhere; `GpuSyntenyRenderer.render`
// dispatches the appropriate pass per track. This module is mode-agnostic.
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
  // Per-instance KIND tag (KIND_BASE/KIND_CIGAR_*/etc from syntenyColors.ts).
  // Used by the fill fragment to decide whether perpendicular AA should be
  // smooth (BASE — outer feature silhouette) or hard-cut (CIGAR — tiles a
  // feature, so smoothstep at shared edges with sibling CIGAR instances
  // bleeds background through the seam under standard alpha blend).
  public float kind              : ATTR13;
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
  public float  overdrawPx;
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
  float mOff = u.overdrawPx;
  float rW = u.resolution.x;
  return max(c.x1, c.x2) < -mOff || min(c.x1, c.x2) > rW + mOff
      || max(c.x3, c.x4) < -mOff || min(c.x3, c.x4) > rW + mOff;
}

// Tessellation count for the curve-mode edge pass. Fill-curve hard-codes 8
// segments inline.
public static const uint BEZIER_SEGMENTS = 16u;
