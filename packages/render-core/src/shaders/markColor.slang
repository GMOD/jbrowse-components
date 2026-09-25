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
// axis reads y's and as the Canvas2D twin reads both.
//! export-consts: RAMP_NONE, RAMP_LINEAR, RAMP_LOG, RAMP_NOT_FINITE_COLOR
//! js-skip: rampValueFinite — reads the lane's bits, which only the GPU holds; the Canvas2D bake reads the Float32Array and asks Number.isFinite
module markColor;

import colorPack;
import colorRampLut;
import scoreScale;

// What `rampMode` is compared against. `RAMP_NONE` is the packed arm.
public static const int RAMP_NONE = 0;
public static const int RAMP_LINEAR = 1;
public static const int RAMP_LOG = 2;

// The misconfiguration grey, packed, which a value that is no finite number
// paints, as `continuousColorScale` paints one on the per-region path. Read
// off the lane's bits rather than the float, since a NaN need not survive a
// vertex attribute through every driver's fast math.
public static const uint RAMP_NOT_FINITE_COLOR = 0xFF808080u;

public bool rampValueFinite(uint bits) {
  return (bits & 0x7F800000u) != 0x7F800000u;
}

public float4 markInstanceColor(
  Sampler2D<float4> ramp,
  uint packed,
  int rampMode,
  float rampMin,
  float rampMax,
) {
  if (rampMode == RAMP_NONE) {
    return unpackRGBA(packed);
  }
  if (!rampValueFinite(packed)) {
    return unpackRGBA(RAMP_NOT_FINITE_COLOR);
  }
  int scaleType = rampMode == RAMP_LOG ? SCALE_TYPE_LOG : 0;
  return rampColor(
    ramp,
    normalizeScore(asfloat(packed), rampMin, rampMax, scaleType, 1.0),
  );
}
