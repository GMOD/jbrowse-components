// What the two `line` shapes agree on: the uniform block, the sentinels the
// packer writes for a neighbour that is not there, and where a value lands
// in its band. `lineStepMark.slang` and `lineCenterMark.slang` are separate
// entry modules because a module reflects one instance struct and the two read
// different neighbours: the step line the previous and next values, the centre
// line the previous instance's span and value. One record carrying both would
// cost every instance the fields the other variant reads.
//
// Each consumer declares its OWN `[[vk::binding(1, 0)]] ConstantBuffer<Uniforms>
// u;` — the struct is shared, the binding is not — and imports `hpmath`,
// `markColor` and `rowTable` for itself, since Slang does not re-export through
// an import.
//! export-consts: GAP_Y, NO_PREV_X
module lineCommon;

import hpmath;
import valueScale;

// A step neighbour that is not adjacent, which the shader reads as the
// `origin`: the line drops to the baseline across a gap and rises again.
public static const float GAP_Y = -3.0e38;
// A centre instance with no previous point on its run, which draws as a dot.
public static const uint NO_PREV_X = 0xffffffffu;

public struct Uniforms {
  public float3 bpRangeX;
  public float  canvasHeight;
  public float  domainMin;
  public float  domainMax;
  // `scoreScale`'s scale-type vocabulary, for the declared y scale.
  public int    valueScaleType;
  // Already resolved from the domain (`resolveSymlogConstant`); read by symlog alone.
  public float  valueSymlogConstant;
  // `markColor`'s: 0 packs the instance's colour, 1 and 2 read its slot as a
  // value through the ramp.
  public int    rampMode;
  public float  rampMin;
  public float  rampMax;
  public float  rampMidNorm;
  // CSS px per row band; the canvas height where every instance is on row 0.
  public float  rowHeight;
  // CSS px the value scale runs over inside a row, and how far below the
  // row's top it starts.
  public float  rowBandPx;
  public float  rowOffsetPx;
  // The value a step drops to across a gap, on the same scale as `y`.
  public float  origin;
  public float  lineWidth;
  public float  zero;
  public float  viewportWidth;
  public float  devicePixelRatio;
  public int    rowTableKeys;
};

public float lineBpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

// A value's CSS px down the canvas in the band starting at `bandTop`: the
// shared value scale over the band, the anchor this shape's own (ADR-097).
public float lineValueYPx(float value, float bandTop, Uniforms u) {
  return bandTop + valueToYPxScaled(value, u.domainMin, u.domainMax, u.rowBandPx, u.valueScaleType, u.valueSymlogConstant);
}
