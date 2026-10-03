import { abgrAlpha, withAbgrAlpha } from '@jbrowse/core/util/colorBits'
import {
  thresholdCuts,
  thresholdIndex,
} from '@jbrowse/core/util/thresholdScale'

import {
  isAttributeLabels,
  presetRamp,
  rampNorm,
  resolveContinuousMode,
} from './colorRamps.ts'

import type { AttributeRange } from './colorRamps.ts'
import type { SyntenyOpacitySnapshot } from './syntenyOpacityConfigSchema.ts'

/**
 * The opacity channel, read the way the colour channel is (`colorFunctions`):
 * the view's `opacity` object plus a fetch's lanes in, a per-feature answer
 * out. Two numbers come out of it, because opacity is drawn in two places.
 *
 * The LEVEL is a shader uniform every alignment is multiplied by: the
 * constant `value`, or under a field the most opaque its `range` reaches.
 * Dragging the slider moves only the uniform, so it recolours nothing.
 *
 * The FADE is each feature's share of that level, baked into the alpha byte
 * of its packed colour by the colour pass. A field mapped through
 * `range: [0.15, 0.8]` draws a feature at 0.15 as level 0.8 times fade
 * 0.1875.
 *
 * Example, an odp ortholog table whose rows carry Fisher's exact test p-value
 * for their chromosome pair:
 * `{ field: 'break_FET', scale: 'threshold', domain: [0.05], range: [0.8, 0.15] }`
 * draws rows under 0.05 at 0.8 and the rest at 0.15.
 */

/** A number column's opacities at `domainMin` and `domainMax` where `range` names none. */
export const DEFAULT_NUMERIC_OPACITY_RANGE = [0.3, 1] as const

/** Whether `opacity` reads a field, rather than drawing its constant. */
export function opacityMapsField(setting: SyntenyOpacitySnapshot) {
  return !!setting.field && setting.scale !== 'none'
}

function rangeOf(setting: SyntenyOpacitySnapshot, numeric: boolean) {
  const written = (setting.range ?? []).map(Number).filter(Number.isFinite)
  return written.length === 0 && numeric
    ? [...DEFAULT_NUMERIC_OPACITY_RANGE]
    : written
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * #api
 * The opacity every alignment is drawn at before its own fade: the constant,
 * `defaultValue` while it is unset, or under a field the most opaque value
 * its range reaches.
 */
export function opacityLevel(
  setting: SyntenyOpacitySnapshot,
  defaultValue: number,
  ranges?: Record<string, AttributeRange>,
) {
  if (!opacityMapsField(setting)) {
    return clamp01(setting.value ?? defaultValue)
  }
  const range = rangeOf(setting, isNumericField(setting, ranges))
  return range.length > 0 ? clamp01(Math.max(...range)) : 1
}

function isNumericField(
  setting: SyntenyOpacitySnapshot,
  ranges?: Record<string, AttributeRange>,
) {
  const observed = setting.field ? ranges?.[setting.field] : undefined
  return (
    setting.scale !== 'threshold' &&
    !(observed !== undefined && isAttributeLabels(observed))
  )
}

/**
 * #api
 * Each feature's fade, 0 to 1, as a share of `opacityLevel`; undefined while
 * `opacity` draws its constant. A feature with no value for the field draws
 * at the level.
 *
 * `viewRanges` is the domain a number column fades across, the view's
 * accumulated one as the colour ramp's is, and `fetchRanges` the fetch's own,
 * whose label lists a text column's values index.
 */
export function createOpacityFunction({
  setting,
  attributes,
  viewRanges,
  fetchRanges,
}: {
  setting: SyntenyOpacitySnapshot
  attributes: Record<string, Float32Array>
  viewRanges: Record<string, AttributeRange>
  fetchRanges: Record<string, AttributeRange>
}): ((index: number) => number) | undefined {
  if (!opacityMapsField(setting)) {
    return undefined
  }
  const field = setting.field!
  const level = opacityLevel(setting, 1, viewRanges)
  if (level === 0) {
    return () => 0
  }
  const share = (opacity: number | undefined) =>
    opacity === undefined ? 1 : clamp01(opacity / level)
  // a preset reads its own lane: `mapq` is the adapters' `mappingQual`
  const values = attributes[presetRamp(field)?.attribute ?? field]

  if (setting.scale === 'threshold') {
    const cuts = thresholdCuts(setting.domain ?? [])
    const range = rangeOf(setting, false)
    return index => {
      const bin = thresholdIndex(values?.[index], cuts)
      return bin < 0 ? 1 : share(range[bin])
    }
  }

  const fetched = fetchRanges[field]
  if (fetched && isAttributeLabels(fetched)) {
    const range = rangeOf(setting, false)
    const domain = setting.domain ?? []
    const lut = Float32Array.from(fetched.labels, label => {
      const i = domain.indexOf(label)
      return i < 0 ? 1 : share(range[i])
    })
    return index => {
      const value = values?.[index]
      return value === undefined || Number.isNaN(value) ? 1 : (lut[value] ?? 1)
    }
  }

  const mode = resolveContinuousMode(field, viewRanges, {
    domainMin: setting.domainMin,
    domainMax: setting.domainMax,
  })
  if (!mode) {
    return undefined
  }
  const [lo, hi] = rangeOf(setting, true)
  return index => {
    const value = values?.[index]
    if (value === undefined || !Number.isFinite(value)) {
      return 1
    }
    return share(lo! + rampNorm(mode, value) * (hi! - lo!))
  }
}

/**
 * #api
 * The part of `opacity` the colour pass reads: undefined for the constant,
 * else the mapping with `range` as shares of its most opaque entry, so a
 * mapping scaled alike at both ends answers the same.
 */
export function opacityFadeOf(
  setting: SyntenyOpacitySnapshot,
): SyntenyOpacitySnapshot | undefined {
  if (!opacityMapsField(setting)) {
    return undefined
  }
  const range = (setting.range ?? []).map(Number).filter(Number.isFinite)
  const top = range.length > 0 ? Math.max(...range) : 0
  const { value: _value, ...mapping } = setting
  return {
    ...mapping,
    domain: [...(setting.domain ?? [])],
    range: top > 0 ? range.map(n => String(n / top)) : [],
  }
}

/** `color` with its alpha byte scaled by `fade`. */
export function fadedColor(color: number, fade: number) {
  return fade === 1
    ? color
    : withAbgrAlpha(color, Math.round(abgrAlpha(color) * fade))
}
