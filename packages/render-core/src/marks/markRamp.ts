import { SCALE_TYPE_LOG, rampMidNorm, scaleTypeCode } from '../scoreScale.ts'
import { rampMidT } from '../shaders/colorRampLut.js.generated.ts'
import {
  MAX_COLOR_BANDS,
  MAX_COLOR_CUTS,
  RAMP_LINEAR,
  RAMP_LOG,
  RAMP_NONE,
  RAMP_NOT_A_NUMBER_COLOR,
  RAMP_NO_VALUE_BITS,
  RAMP_NO_VALUE_COLOR,
  RAMP_THRESHOLD,
} from '../shaders/markColor.generated.ts'
import { normalizeScore } from '../shaders/scoreScale.js.generated.ts'

import type { MarkColorScale, MarkRamp, MarkThreshold } from './types.ts'

/**
 * A colour channel as a shape reads it: `color`, the packed ABGR the worker
 * resolved — one per instance, or one number for all of them — or
 * `colorValue`, the raw values a frame's {@link MarkColorScale} turns into
 * colours here. A shape reading a scale declares both optional and asks
 * {@link colorBits} for the GPU and {@link paintColors} for Canvas2D.
 */
export interface ColorChannel {
  color?: Uint32Array | number
  colorValue?: Float32Array
  /** The Canvas2D bake, memoized on the payload; nothing else writes it. */
  rampBake?: RampBake
  /** A constant `color` as Canvas2D paints it, memoized as `rampBake` is. */
  constantBake?: Uint32Array
}

interface RampBake {
  values: Float32Array
  scale: MarkColorScale
  colors: Uint32Array
}

const NO_COLORS = new Uint32Array(0)

/** Whether a colour scale is a threshold rather than a ramp. */
export function isThreshold(scale: MarkColorScale): scale is MarkThreshold {
  return 'cuts' in scale
}

function midNormOf({ domain, scale, mid }: MarkRamp) {
  return rampMidNorm(domain[0], domain[1], scaleTypeCode(scale), mid)
}

type Rgba = [number, number, number, number]
type Bands = [Rgba, Rgba, Rgba, Rgba, Rgba, Rgba, Rgba, Rgba, Rgba]

const NO_RGBA: Rgba = [0, 0, 0, 0]

function bandsOf(colorAt: (i: number) => Rgba) {
  return Array.from({ length: MAX_COLOR_BANDS }, (_, i) => colorAt(i)) as Bands
}

function rgbaOf(abgr: number): Rgba {
  return [
    (abgr & 255) / 255,
    ((abgr >>> 8) & 255) / 255,
    ((abgr >>> 16) & 255) / 255,
    ((abgr >>> 24) & 255) / 255,
  ]
}

function quad(values: readonly number[], from: number): Rgba {
  return [
    values[from] ?? 0,
    values[from + 1] ?? 0,
    values[from + 2] ?? 0,
    values[from + 3] ?? 0,
  ]
}

/**
 * `markColor.slang`'s uniforms for a frame's colour scale, or for none: the
 * mode, a ramp's domain and middle, and a threshold's cuts and band colours.
 * Every valued shape's uniform block carries the set.
 */
export function rampUniforms(scale: MarkColorScale | undefined) {
  const none = {
    rampMode: RAMP_NONE,
    rampMin: 0,
    rampMax: 1,
    rampMidNorm: 0.5,
    colorCutCount: 0,
    colorCuts: [quad([], 0), quad([], 0)] as [Rgba, Rgba],
    colorBands: bandsOf(() => NO_RGBA),
  }
  if (!scale) {
    return none
  }
  if (isThreshold(scale)) {
    const cuts = scale.cuts.slice(0, MAX_COLOR_CUTS)
    return {
      ...none,
      rampMode: RAMP_THRESHOLD,
      colorCutCount: cuts.length,
      colorCuts: [quad(cuts, 0), quad(cuts, 4)] as [Rgba, Rgba],
      colorBands: bandsOf(i =>
        i <= cuts.length ? rgbaOf(scale.colors[i] ?? 0) : NO_RGBA,
      ),
    }
  }
  return {
    ...none,
    rampMode: scale.scale === 'log' ? RAMP_LOG : RAMP_LINEAR,
    rampMin: scale.domain[0],
    rampMax: scale.domain[1],
    rampMidNorm: midNormOf(scale),
  }
}

/**
 * The 4-byte instance lane, for the packer. Under a scale it is the value's
 * float32 bits viewed as the `uint` the attribute declares — the reinterpret
 * `markColor.slang`'s `asfloat` undoes, and the reason a quantitative colour
 * adds no lane. A constant colour fills a lane for the pack alone, which the
 * payload never holds.
 */
export function colorBits(c: ColorChannel, count: number): ArrayLike<number> {
  const { colorValue, color } = c
  return colorValue
    ? rampValueBits(colorValue)
    : typeof color === 'number'
      ? new Uint32Array(count).fill(color)
      : (color ?? NO_COLORS)
}

/** Instance `i`'s `color` alone, as a one-instance channel carries it. */
export function instanceColor(color: ColorChannel['color'], i: number) {
  return typeof color === 'number' ? color : color?.subarray(i, i + 1)
}

/** A value lane's float32 values viewed as their bits. */
export function rampValueBits(values: Float32Array) {
  return new Uint32Array(values.buffer, values.byteOffset, values.length)
}

/**
 * A value lane's values kept where `keep` says, copied as bits: a JS number
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
 * The interval a value is in on a threshold: how many of the ascending cuts it
 * is at or past, `thresholdIndex`'s rule and the shader's `thresholdBand`.
 */
export function thresholdBandOf(value: number, cuts: readonly number[]) {
  let band = 0
  for (const cut of cuts) {
    if (value >= cut) {
      band++
    }
  }
  return band
}

function sameScale(a: MarkColorScale, b: MarkColorScale) {
  if (isThreshold(a) || isThreshold(b)) {
    return (
      isThreshold(a) &&
      isThreshold(b) &&
      a.cuts.length === b.cuts.length &&
      a.cuts.every((cut, i) => cut === b.cuts[i]) &&
      a.colors.length === b.colors.length &&
      a.colors.every((color, i) => color === b.colors[i])
    )
  }
  return (
    a.domain[0] === b.domain[0] &&
    a.domain[1] === b.domain[1] &&
    a.scale === b.scale &&
    a.lut === b.lut &&
    midNormOf(a) === midNormOf(b)
  )
}

/**
 * The packed colours a painter fills with. Under a scale the values are baked
 * against it once and kept on the payload, so a repaint at an unchanged scale
 * — every pan and every hover — walks no values and the painters' fill
 * batching still sees runs of one colour. The bake reruns when the domain, the
 * scale type, the ramp's bytes or a threshold's cuts or colours move. A
 * constant colour expands once and is kept the same way.
 */
export function paintColors(
  c: ColorChannel,
  count: number,
  scale: MarkColorScale | undefined,
): ArrayLike<number> {
  const { colorValue, color } = c
  if (!scale || !colorValue) {
    return typeof color === 'number'
      ? constantColors(c, color, count)
      : (color ?? NO_COLORS)
  }
  const bake = c.rampBake
  if (
    bake?.values === colorValue &&
    bake.colors.length === count &&
    sameScale(bake.scale, scale)
  ) {
    return bake.colors
  }
  const colors = new Uint32Array(count)
  const bits = rampValueBits(colorValue)
  const colorOf = isThreshold(scale)
    ? (value: number) =>
        Number.isFinite(value)
          ? scale.colors[thresholdBandOf(value, scale.cuts)]!
          : scale.colors[value > 0 ? scale.cuts.length : 0]!
    : rampColorOf(scale)
  for (let i = 0; i < count; i++) {
    const value = colorValue[i]!
    colors[i] =
      bits[i] === RAMP_NO_VALUE_BITS
        ? RAMP_NO_VALUE_COLOR
        : Number.isNaN(value)
          ? RAMP_NOT_A_NUMBER_COLOR
          : colorOf(value)
  }
  c.rampBake = { values: colorValue, scale, colors }
  return colors
}

function constantColors(c: ColorChannel, color: number, count: number) {
  const bake = c.constantBake
  if (bake?.length === count && (count === 0 || bake[0] === color)) {
    return bake
  }
  const colors = new Uint32Array(count).fill(color)
  c.constantBake = colors
  return colors
}

function rampColorOf(ramp: MarkRamp) {
  const [min, max] = ramp.domain
  const log = ramp.scale === 'log'
  const midNorm = midNormOf(ramp)
  const { lut } = ramp
  const entries = lut.length / 4
  return (value: number) => {
    const t = rampMidT(
      Number.isFinite(value)
        ? normalizeScore(value, min, max, log ? SCALE_TYPE_LOG : 0, 1)
        : value > 0
          ? 1
          : 0,
      midNorm,
    )
    const o = Math.round(t * (entries - 1)) * 4
    return (
      ((lut[o + 3]! << 24) |
        (lut[o + 2]! << 16) |
        (lut[o + 1]! << 8) |
        lut[o]!) >>>
      0
    )
  }
}
