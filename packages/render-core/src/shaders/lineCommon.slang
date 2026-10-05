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
//! js-export: lineColorAlongY
module lineCommon;

import hpmath;
import markColor;
import scoreScale;
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
  // `markColor`'s threshold: how many cuts are in use, the cuts four to a
  // vector, and the colour of each interval between them.
  public int    colorCutCount;
  public float4 colorCuts[2];
  public float4 colorBands[MAX_COLOR_BANDS];
  // 1 where the colour field is the plotted `y`, so a threshold's cuts sit on
  // the y scale and the line changes colour where it crosses one.
  public int    colorFromY;
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

// A value's y in the band for the colour test, placed UNCLAMPED where
// `lineValueYPx` clamps it to draw: the cuts go through it, and so does the
// line a threshold colours along. Clamped, a cut outside the domain landed on
// the band edge out-of-domain values are clamped onto too, and a value past
// the domain took the side of that edge rather than its own.
public float lineColorYPx(float value, float bandTop, Uniforms u) {
  float norm = normalizeScoreUnclamped(value, u.domainMin, u.domainMax, u.valueScaleType, u.valueSymlogConstant);
  return bandTop + (1.0 - norm) * u.rowBandPx;
}

// Each cut's y in the band, four to a vector: placed once per vertex and
// handed to the fragment flat, so a pixel only compares. Slots past the count
// are 0.
public float4 lineCutYsPx(int from, float bandTop, Uniforms u) {
  float4 ys = float4(0.0);
  for (int k = 0; k < 4; k++) {
    if (from + k < u.colorCutCount) {
      ys[k] = lineColorYPx(colorCutAt(from + k, u.colorCuts[0], u.colorCuts[1]), bandTop, u);
    }
  }
  return ys;
}

// Whether a line reads its colour along y: under a threshold over the plotted
// value, on a row the table does not recolour. The painter asks it too.
public bool lineColorAlongY(int rampMode, int colorFromY, bool overridden) {
  return rampMode == RAMP_THRESHOLD && colorFromY != 0 && !overridden;
}

// A line fragment's colour: along y, the interval the colour y it is read at
// falls in; otherwise the colour its vertex resolved.
public float4 lineFragmentColor(float colorYPx, float4 cutYsLo, float4 cutYsHi, float4 own, float alongY, Uniforms u) {
  if (alongY < 0.5) {
    return own;
  }
  return u.colorBands[thresholdBandAtYPx(colorYPx, u.colorCutCount, cutYsLo, cutYsHi)];
}
