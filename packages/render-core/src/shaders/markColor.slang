// How a mark shape's colour channel resolves: a packed ABGR the worker already
// decided, or a raw value the frame's colour scale turns into one here.
//
// The two arms are the two places a scale can resolve, and the choice is the
// channel's cardinality rather than the shape's (ADR-094). A categorical or
// constant colour is data and travels packed with the instance; a quantitative
// one is a value through a scale that moves with the loaded regions or with an
// edit, so it rides uniforms — a domain pair and a 256-entry LUT for a ramp,
// up to MAX_COLOR_CUTS cut points and a colour per interval for a threshold —
// and a pan that widens the domain or an edit that moves a cut uploads no
// instance bytes, the property `valueScale` already gives y.
//
// The value arrives in the instance's colour slot, reinterpreted: one 4-byte
// lane carries either the packed colour or the value's float32 bits, and
// `rampMode` says which. The packer's side of that is `colorBits`
// (marks/markRamp.ts), which views the encoder's `Float32Array` as the
// `Uint32Array` the attribute is declared as, so a quantitative colour adds no
// lane to an instance and costs no bytes; a colour over the plotted value
// itself is the `y` lane's bits, so it costs no lane in the payload either.
//
// `normalizeScore` is `scoreScale`'s, so a ramp's domain is read exactly as the
// axis reads y's and as the Canvas2D twin reads both. A diverging ramp's middle
// stop is `rampMidNorm`, read through `colorRampLut`'s `rampMidT` over a
// straight table, so a domain that moves under a pinned middle moves uniforms
// and uploads no table. A threshold's interval is `thresholdBand`, the count of
// ascending cuts a value is at or past, which is `thresholdIndex`'s rule in
// `@jbrowse/core/util/thresholdScale` and the painter's.
//! export-consts: RAMP_NONE, RAMP_LINEAR, RAMP_LOG, RAMP_THRESHOLD, MAX_COLOR_CUTS, MAX_COLOR_BANDS, RAMP_NO_VALUE_BITS, RAMP_NO_VALUE_COLOR, RAMP_NOT_A_NUMBER_COLOR
module markColor;

import colorPack;
import colorRampLut;
import scoreScale;

// What `rampMode` is compared against. `RAMP_NONE` is the packed arm.
public static const int RAMP_NONE = 0;
public static const int RAMP_LINEAR = 1;
public static const int RAMP_LOG = 2;
public static const int RAMP_THRESHOLD = 3;

// The most cuts a threshold parts a plot at, and the intervals between them:
// the uniform block holds this many.
public static const int MAX_COLOR_CUTS = 8;
public static const int MAX_COLOR_BANDS = 9;

// What the lane carries for a feature with no value in the field: a NaN whose
// payload no arithmetic produces, so it stays apart from text that is no
// number, which the encoder writes as an ordinary NaN. The lane is tested as
// bits, since a NaN need not survive a vertex attribute through every driver's
// fast math.
public static const uint RAMP_NO_VALUE_BITS = 0x7FC00001u;
// The no-value grey and the misconfiguration grey, packed, as every other
// scale paints the two.
public static const uint RAMP_NO_VALUE_COLOR = 0xFFAFAFAFu;
public static const uint RAMP_NOT_A_NUMBER_COLOR = 0xFF808080u;

// The `cuts` slot `i` names, four to a vector.
public float colorCutAt(int i, float4 cutsLo, float4 cutsHi) {
  return i < 4 ? cutsLo[i] : cutsHi[i - 4];
}

// The interval a value is in: how many of the ascending cuts it is at or past.
public int thresholdBand(float value, int cutCount, float4 cutsLo, float4 cutsHi) {
  int band = 0;
  for (int i = 0; i < cutCount; i++) {
    if (value >= colorCutAt(i, cutsLo, cutsHi)) {
      band = i + 1;
    }
  }
  return band;
}

// The interval a fragment at `yPx` is in, given each cut's y in the band:
// screen y grows downward, so a value at or past a cut is at or above that
// cut's y. A line reads its colour this way, so a rise across a cut changes
// colour at the cut.
public int thresholdBandAtYPx(float yPx, int cutCount, float4 cutYsLo, float4 cutYsHi) {
  int band = 0;
  for (int i = 0; i < cutCount; i++) {
    if (yPx <= colorCutAt(i, cutYsLo, cutYsHi)) {
      band = i + 1;
    }
  }
  return band;
}

public float4 markScaleColor(
  Sampler2D<float4> ramp,
  uint packed,
  int rampMode,
  float rampMin,
  float rampMax,
  float rampMidNorm,
  int cutCount,
  float4 cutsLo,
  float4 cutsHi,
  float4 bands[MAX_COLOR_BANDS],
) {
  if (rampMode == RAMP_NONE) {
    return unpackRGBA(packed);
  }
  if (packed == RAMP_NO_VALUE_BITS) {
    return unpackRGBA(RAMP_NO_VALUE_COLOR);
  }
  if ((packed & 0x7F800000u) == 0x7F800000u) {
    if ((packed & 0x007FFFFFu) != 0u) {
      return unpackRGBA(RAMP_NOT_A_NUMBER_COLOR);
    }
    // an infinity takes the end on its side, as a threshold places it
    bool negative = (packed & 0x80000000u) != 0u;
    if (rampMode == RAMP_THRESHOLD) {
      return bands[negative ? 0 : cutCount];
    }
    return rampColor(ramp, rampMidT(negative ? 0.0 : 1.0, rampMidNorm));
  }
  float value = asfloat(packed);
  if (rampMode == RAMP_THRESHOLD) {
    return bands[thresholdBand(value, cutCount, cutsLo, cutsHi)];
  }
  int scaleType = rampMode == RAMP_LOG ? SCALE_TYPE_LOG : 0;
  return rampColor(
    ramp,
    rampMidT(
      normalizeScore(value, rampMin, rampMax, scaleType, 1.0),
      rampMidNorm,
    ),
  );
}
