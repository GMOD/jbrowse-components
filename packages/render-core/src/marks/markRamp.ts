import { SCALE_TYPE_LOG } from '../scoreScale.ts'
import {
  RAMP_LINEAR,
  RAMP_LOG,
  RAMP_NONE,
  RAMP_NOT_A_NUMBER_COLOR,
  RAMP_NO_VALUE_BITS,
  RAMP_NO_VALUE_COLOR,
} from '../shaders/markColor.generated.ts'
import { normalizeScore } from '../shaders/scoreScale.js.generated.ts'

import type { MarkRamp } from './types.ts'

/**
 * A colour channel as a shape reads it: `color`, the packed ABGR the worker
 * resolved, or `colorValue`, the raw values a frame's {@link MarkRamp} turns
 * into colours here. A shape reading a ramp declares both optional and asks
 * {@link colorBits} for the GPU and {@link paintColors} for Canvas2D.
 */
export interface ColorChannel {
  color?: Uint32Array
  colorValue?: Float32Array
  /** The Canvas2D bake, memoized on the payload; nothing else writes it. */
  rampBake?: RampBake
}

interface RampBake {
  min: number
  max: number
  log: boolean
  lut: Uint8Array
  colors: Uint32Array
}

const NO_COLORS = new Uint32Array(0)

/** `markColor.slang`'s three uniforms for a frame's ramp, or for none. */
export function rampUniforms(ramp: MarkRamp | undefined) {
  return ramp
    ? {
        rampMode: ramp.scale === 'log' ? RAMP_LOG : RAMP_LINEAR,
        rampMin: ramp.domain[0],
        rampMax: ramp.domain[1],
      }
    : { rampMode: RAMP_NONE, rampMin: 0, rampMax: 1 }
}

/**
 * The 4-byte instance lane, for the packer. Under a ramp it is the value's
 * float32 bits viewed as the `uint` the attribute declares — the reinterpret
 * `markColor.slang`'s `asfloat` undoes, and the reason a ramp adds no lane.
 */
export function colorBits(c: ColorChannel): ArrayLike<number> {
  const { colorValue } = c
  return colorValue ? rampValueBits(colorValue) : (c.color ?? NO_COLORS)
}

/** A ramp lane's float32 values viewed as their bits. */
export function rampValueBits(values: Float32Array) {
  return new Uint32Array(values.buffer, values.byteOffset, values.length)
}

/**
 * A ramp lane's values kept where `keep` says, copied as bits: a JS number
 * read out of the lane may lose the payload `RAMP_NO_VALUE_BITS` marks a
 * feature with no value by.
 */
export function keepRampValues(
  values: Float32Array,
  keep: (value: number, index: number) => boolean,
) {
  const kept = rampValueBits(values).filter((_, i) => keep(values[i]!, i))
  return new Float32Array(kept.buffer, kept.byteOffset, kept.length)
}

/**
 * The packed colours a painter fills with. Under a ramp the values are baked
 * against the domain once and kept on the payload, so a repaint at an
 * unchanged domain — every pan and every hover — walks no values and the
 * painters' fill batching still sees runs of one colour. The bake reruns when
 * the domain, the scale type or the ramp's bytes move.
 */
export function paintColors(
  c: ColorChannel,
  count: number,
  ramp: MarkRamp | undefined,
): ArrayLike<number> {
  const { colorValue } = c
  if (!ramp || !colorValue) {
    return c.color ?? NO_COLORS
  }
  const [min, max] = ramp.domain
  const log = ramp.scale === 'log'
  const { lut } = ramp
  const bake = c.rampBake
  if (
    bake &&
    bake.min === min &&
    bake.max === max &&
    bake.log === log &&
    bake.lut === lut &&
    bake.colors.length >= count
  ) {
    return bake.colors
  }
  const entries = lut.length / 4
  const colors = new Uint32Array(count)
  const bits = rampValueBits(colorValue)
  for (let i = 0; i < count; i++) {
    const value = colorValue[i]!
    if (bits[i] === RAMP_NO_VALUE_BITS) {
      colors[i] = RAMP_NO_VALUE_COLOR
      continue
    }
    if (Number.isNaN(value)) {
      colors[i] = RAMP_NOT_A_NUMBER_COLOR
      continue
    }
    const t = Number.isFinite(value)
      ? normalizeScore(value, min, max, log ? SCALE_TYPE_LOG : 0, 1)
      : value > 0
        ? 1
        : 0
    const o = Math.round(t * (entries - 1)) * 4
    colors[i] =
      ((lut[o + 3]! << 24) |
        (lut[o + 2]! << 16) |
        (lut[o + 1]! << 8) |
        lut[o]!) >>>
      0
  }
  c.rampBake = { min, max, log, lut, colors }
  return colors
}
