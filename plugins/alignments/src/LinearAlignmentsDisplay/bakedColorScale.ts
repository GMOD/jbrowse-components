import { categoricalColorScale } from '@jbrowse/core/ui/colors'
import { tagColorPalette } from '@jbrowse/core/ui/palette'
import { cssColorToRgba } from '@jbrowse/core/util/colorBits'
import {
  VIRIDIS_STOPS,
  buildColorRampLut,
  stopsFromRampLut,
} from '@jbrowse/core/util/colorRamp'
import {
  numericDomain,
  thresholdIndex,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'

import { bakedValueColor } from './colorTagUtils.ts'

import type { AlignmentsColorSetting } from '../shared/alignmentsColor.ts'
import type { ColorBy } from '../shared/types.ts'
import type { RefNamePosition } from './colorTagUtils.ts'
import type { RampStop } from '@jbrowse/core/ui'

export type NumericExtent = readonly [number, number]

interface CategoricalBakedScale {
  kind: 'categorical'
  /** false while a value's colour is its own function and the config says nothing */
  declared: boolean
  domain: readonly string[]
  color: (value: string) => string
}

interface ThresholdBakedScale {
  kind: 'threshold'
  declared: true
  bins: { label: string; color: string }[]
  color: (value: string) => string | undefined
}

interface LinearBakedScale {
  kind: 'linear'
  declared: true
  domain: NumericExtent
  stops: RampStop[]
  color: (value: string) => string | undefined
}

/**
 * The scale a baked field paints through, read by the per-read bake and the
 * key alike. `undefined` from `color` is a read the scale has no bin for,
 * which takes the plain fill.
 */
export type BakedColorScale =
  | CategoricalBakedScale
  | ThresholdBakedScale
  | LinearBakedScale

const LEGEND_RAMP_STOPS = 8

function rampLut({ ramp }: Pick<AlignmentsColorSetting, 'ramp'>, mid: number) {
  const named =
    ramp.length === 0 || (ramp.length === 1 && ramp[0] === 'viridis')
  return buildColorRampLut(
    named ? VIRIDIS_STOPS : ramp.map(c => cssColorToRgba(c)),
    mid,
  )
}

/** A linear scale's two ends as `domain` pins them, undefined while it does not. */
export function pinnedLinearDomain(
  domain: readonly string[],
): NumericExtent | undefined {
  const [min, max] = numericDomain(domain)
  return domain.length === 2 &&
    min !== undefined &&
    max !== undefined &&
    min < max
    ? [min, max]
    : undefined
}

function linearScale(
  setting: AlignmentsColorSetting,
  [min, max]: NumericExtent,
): LinearBakedScale {
  const span = max - min
  const norm = (v: number) => (span > 0 ? (v - min) / span : 0.5)
  const { domainMid } = setting
  const lut = rampLut(setting, domainMid === undefined ? 0.5 : norm(domainMid))
  const last = lut.length / 4 - 1
  const css = new Map<number, string>()
  return {
    kind: 'linear',
    declared: true,
    domain: [min, max],
    stops: stopsFromRampLut(lut, LEGEND_RAMP_STOPS),
    color: value => {
      const v = Number(value)
      if (value === '' || !Number.isFinite(v)) {
        return undefined
      }
      const i = Math.round(Math.max(0, Math.min(1, norm(v))) * last)
      let color = css.get(i)
      if (color === undefined) {
        const o = i * 4
        color = `rgb(${lut[o]},${lut[o + 1]},${lut[o + 2]})`
        css.set(i, color)
      }
      return color
    },
  }
}

function thresholdScale({
  domain,
  palette,
}: AlignmentsColorSetting): ThresholdBakedScale {
  const cuts = numericDomain(domain)
  const colors = thresholdPalette(cuts.length + 1, palette)
  const labels = thresholdLabels(cuts)
  return {
    kind: 'threshold',
    declared: true,
    bins: colors.map((color, i) => ({ color, label: labels[i]! })),
    color: value =>
      value === '' ? undefined : colors[thresholdIndex(value, cuts)],
  }
}

/**
 * The scale the tag, attribute and mate-reference fields bake through. With
 * nothing declared a value's colour is a function of the value alone
 * (`bakedValueColor`); a `domain` or `palette` hands the listed values their
 * colours in order, over the same tag palette.
 */
export function bakedColorScale(
  colorBy: ColorBy,
  setting: AlignmentsColorSetting,
  refNamePosition: RefNamePosition | undefined,
  extent: NumericExtent | undefined,
): BakedColorScale {
  const { scale, domain, palette } = setting
  if (colorBy.type === 'tag' && scale === 'linear') {
    return linearScale(setting, pinnedLinearDomain(domain) ?? extent ?? [0, 1])
  }
  if (colorBy.type === 'tag' && scale === 'threshold') {
    return thresholdScale(setting)
  }
  if (colorBy.type === 'tag' && (domain.length > 0 || palette.length > 0)) {
    return {
      kind: 'categorical',
      declared: true,
      domain,
      color: categoricalColorScale(
        domain,
        palette.length > 0 ? palette : tagColorPalette,
      ),
    }
  }
  return {
    kind: 'categorical',
    declared: false,
    domain,
    color: value => bakedValueColor(colorBy, value, refNamePosition),
  }
}

/** The finite span of a per-read value over every loaded region of every lane. */
export function numericExtentAcrossGroups<D>(
  byGroup: ReadonlyMap<string, ReadonlyMap<number, D>>,
  pick: (data: D) => readonly string[] | undefined,
): NumericExtent | undefined {
  const seen = new Set<string>()
  let min = Infinity
  let max = -Infinity
  for (const map of byGroup.values()) {
    for (const data of map.values()) {
      for (const value of pick(data) ?? []) {
        if (value !== '' && !seen.has(value)) {
          seen.add(value)
          const v = Number(value)
          if (Number.isFinite(v)) {
            min = Math.min(min, v)
            max = Math.max(max, v)
          }
        }
      }
    }
  }
  return min <= max ? [min, max] : undefined
}
