import { categoricalColorScale } from '@jbrowse/core/ui/colors'
import { tagColorPalette } from '@jbrowse/core/ui/palette'
import {
  buildColorRampLut,
  colorRampStops,
  rampDomain,
  stopsFromRampLut,
} from '@jbrowse/core/util/colorRamp'
import { quantileExtent } from '@jbrowse/core/util/quantileExtent'
import {
  thresholdCuts,
  thresholdIndex,
  thresholdLabels,
  thresholdPalette,
} from '@jbrowse/core/util/thresholdScale'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'

import { bakedValueColor } from './colorTagUtils.ts'

import type { AlignmentsColorEncoding } from '../shared/alignmentsColor.ts'
import type { ColorBy } from '../shared/types.ts'
import type { RefNamePosition } from './colorTagUtils.ts'
import type { RampStop } from '@jbrowse/core/ui'
import type {
  ContinuousRef,
  ThresholdRef,
} from '@jbrowse/core/util/markEncoding'

export type NumericExtent = readonly [number, number]

interface CategoricalBakedScale {
  kind: 'categorical'
  /** false while a value's color is its own function and the config says nothing */
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

function flattenOntoWhite(lut: Uint8Array) {
  for (let o = 0; o < lut.length; o += 4) {
    const a = lut[o + 3]! / 255
    for (let c = o; c < o + 3; c++) {
      lut[c] = Math.round(255 + (lut[c]! - 255) * a)
    }
    lut[o + 3] = 255
  }
  return lut
}

function linearScale(
  encoding: ContinuousRef,
  [min, max]: NumericExtent,
): LinearBakedScale {
  const span = max - min
  const norm = (v: number) => (span > 0 ? (v - min) / span : 0.5)
  const { domainMid } = encoding
  const midNorm =
    domainMid === undefined ? 0.5 : Math.max(0, Math.min(1, norm(domainMid)))
  const lut = flattenOntoWhite(buildColorRampLut(colorRampStops(encoding)))
  const last = lut.length / 4 - 1
  const css = new Map<number, string>()
  return {
    kind: 'linear',
    declared: true,
    domain: [min, max],
    stops: stopsFromRampLut(lut, LEGEND_RAMP_STOPS, midNorm),
    color: value => {
      const v = Number(value)
      if (value === '' || !Number.isFinite(v)) {
        return undefined
      }
      const i = Math.round(
        rampMidT(Math.max(0, Math.min(1, norm(v))), midNorm) * last,
      )
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
  domain = [],
  range,
}: ThresholdRef): ThresholdBakedScale {
  const cuts = thresholdCuts(domain)
  const colors = thresholdPalette(cuts.length + 1, range)
  const labels = thresholdLabels(cuts)
  return {
    kind: 'threshold',
    declared: true,
    bins: colors.map((color, i) => ({ color, label: labels[i]! })),
    color: value =>
      value === '' ? undefined : colors[thresholdIndex(value, cuts)],
  }
}

function withoutNoValue(
  domain: readonly string[],
  range: readonly string[] | undefined,
) {
  const i = domain.indexOf('')
  return i === -1
    ? { domain, range }
    : { domain: domain.toSpliced(i, 1), range: range?.toSpliced(i, 1) }
}

/**
 * The scale the tag, attribute and mate-reference fields bake through, read
 * off the resolved `color`. With nothing declared a value's color is a
 * function of the value alone (`bakedValueColor`); a `domain` or `range` hands
 * the listed values their colors in order, over the same tag palette. `''`
 * in `domain` names a read with no value, which the category table colors
 * (`declaredReadCategoryColors`), so it and its `range` entry leave the list.
 * A linear or threshold scale reads a tag or attribute, and waits unread
 * beside a mate reference, whose values are sequence names.
 */
export function bakedColorScale(
  colorBy: ColorBy,
  encoding: AlignmentsColorEncoding,
  refNamePosition: RefNamePosition | undefined,
  extent: NumericExtent | undefined,
): BakedColorScale {
  const scaled = typeof encoding === 'object' ? encoding : undefined
  if (colorBy.type === 'tag' && scaled?.scale === 'linear') {
    return linearScale(
      scaled,
      rampDomain(
        scaled.domainMin,
        scaled.domainMax,
        extent ?? [Infinity, -Infinity],
      ),
    )
  }
  if (colorBy.type === 'tag' && scaled?.scale === 'threshold') {
    return thresholdScale(scaled)
  }
  const { domain, range } =
    scaled?.scale === 'categorical'
      ? withoutNoValue(scaled.domain?.map(String) ?? [], scaled.range)
      : { domain: [], range: undefined }
  if (domain.length > 0 || range?.length) {
    return {
      kind: 'categorical',
      declared: true,
      domain,
      color: categoricalColorScale(domain, range ?? tagColorPalette),
    }
  }
  return {
    kind: 'categorical',
    declared: false,
    domain,
    color: value => bakedValueColor(colorBy, value, refNamePosition),
  }
}

/**
 * The span a ramp's open ends follow below a `domainQuantile` of 1: that
 * quantile of each sign over every loaded read's value, so a read counts once
 * per read rather than once per distinct value.
 */
export function quantileExtentAcrossGroups<D>(
  byGroup: ReadonlyMap<string, ReadonlyMap<number, D>>,
  pick: (data: D) => readonly string[] | undefined,
  quantile: number,
): NumericExtent | undefined {
  const values: number[] = []
  for (const map of byGroup.values()) {
    for (const data of map.values()) {
      for (const value of pick(data) ?? []) {
        if (value !== '') {
          values.push(Number(value))
        }
      }
    }
  }
  const [min, max] = quantileExtent(values, values.length, quantile)
  return min <= max ? [min, max] : undefined
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
