import {
  RAMP_LINEAR,
  RAMP_LOG,
  RAMP_NONE,
} from '../shaders/markColor.generated.ts'
import { SCALE_TYPE_LOG } from '../shaders/scoreScale.generated.ts'
import { normalizeScore } from '../shaders/scoreScale.js.generated.ts'

import type { MarkRamp, MarkValueScaleType } from './types.ts'

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

/** `scoreScale`'s scale-type code for a declared value scale. */
export function valueScaleTypeCode(scale: MarkValueScaleType | undefined) {
  return scale === 'log' ? SCALE_TYPE_LOG : 0
}

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
  return colorValue
    ? new Uint32Array(
        colorValue.buffer,
        colorValue.byteOffset,
        colorValue.length,
      )
    : (c.color ?? NO_COLORS)
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
  for (let i = 0; i < count; i++) {
    const t = normalizeScore(
      colorValue[i]!,
      min,
      max,
      log ? SCALE_TYPE_LOG : 0,
      1,
    )
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
