// How a mark shape's colour channel resolves: a packed ABGR the worker already
// decided, or a raw value the frame's ramp turns into one here.
//
// The two arms are the two places a scale can resolve, and the choice is the
// channel's cardinality rather than the shape's (ADR-094). A categorical or
// constant colour is data and travels packed with the instance; a quantitative
// one is a value through a domain that moves with the loaded regions, so it
// rides one uniform pair and a 256-entry LUT, and a pan that widens the domain
// uploads no instance bytes — the property `valueScale` already gives y.
//
// The value arrives in the instance's colour slot, reinterpreted: one 4-byte
// lane carries either the packed colour or the value's float32 bits, and
// `rampMode` says which. The packer's side of that is `colorBits`
// (marks/colorFill.ts), which views the encoder's `Float32Array` as the
// `Uint32Array` the attribute is declared as, so a ramp adds no lane to an
// instance and costs no bytes.
//
// `normalizeScore` is `scoreScale`'s, so a ramp's domain is read exactly as the
// axis reads y's and as the Canvas2D twin reads both. A diverging ramp's middle
// stop is `rampMidNorm`, read through `colorRampLut`'s `rampMidT` over a
// straight table, so a domain that moves under a pinned middle moves uniforms
// and uploads no table.
//! export-consts: RAMP_NONE, RAMP_LINEAR, RAMP_LOG, RAMP_NO_VALUE_BITS, RAMP_NO_VALUE_COLOR, RAMP_NOT_A_NUMBER_COLOR
module markColor;

import colorPack;
import colorRampLut;
import scoreScale;

// What `rampMode` is compared against. `RAMP_NONE` is the packed arm.
public static const int RAMP_NONE = 0;
public static const int RAMP_LINEAR = 1;
public static const int RAMP_LOG = 2;

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

public float4 markInstanceColor(
  Sampler2D<float4> ramp,
  uint packed,
  int rampMode,
  float rampMin,
  float rampMax,
  float rampMidNorm,
) {
  if (rampMode == RAMP_NONE) {
    return unpackRGBA(packed);
  }
  if (packed == RAMP_NO_VALUE_BITS) {
    return unpackRGBA(RAMP_NO_VALUE_COLOR);
  }
  if ((packed & 0x7F800000u) == 0x7F800000u) {
    // an infinity takes the ramp's end on its side, as a threshold places it
    return (packed & 0x007FFFFFu) != 0u
      ? unpackRGBA(RAMP_NOT_A_NUMBER_COLOR)
      : rampColor(
          ramp, rampMidT((packed & 0x80000000u) != 0u ? 0.0 : 1.0, rampMidNorm));
  }
  int scaleType = rampMode == RAMP_LOG ? SCALE_TYPE_LOG : 0;
  return rampColor(
    ramp,
    rampMidT(
      normalizeScore(asfloat(packed), rampMin, rampMax, scaleType, 1.0),
      rampMidNorm,
    ),
  );
}
