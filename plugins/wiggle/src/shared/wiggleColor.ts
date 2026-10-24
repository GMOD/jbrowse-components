import {
  MISCONFIGURED_COLOR,
  NO_CATEGORY_COLOR,
} from '@jbrowse/core/util/color'
import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { withImpliedField } from '@jbrowse/core/util/colorScale'
import { thresholdCuts } from '@jbrowse/core/util/thresholdScale'
import {
  colorEncodingOf,
  colorSnapshotOf,
} from '@jbrowse/display-kit/colorConfigSchema'
import { MAX_WIGGLE_CUTS } from '@jbrowse/wiggle-core'

import { WIGGLE_NEG_COLOR_DEFAULT, WIGGLE_POS_COLOR_DEFAULT } from '../util.ts'
import {
  WIGGLE_FIELD_PRESETS,
  WIGGLE_IMPLIED_FIELD,
} from './wiggleColorConfigSchema.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * The `encoding.color` channel as written, the key's `scale.names` and
 * `legend.title` with it. The channel names no field, so `field` is `''`
 * until `paintedWiggleColor` implies `score`.
 */
export function wiggleColorSettingOf(color: AnyConfigurationModel) {
  return { ...colorSnapshotOf(color), field: '' } as ColorSetting
}

function lutColor(lut: Uint8Array, entry: number) {
  return `rgb(${lut[entry * 4]},${lut[entry * 4 + 1]},${lut[entry * 4 + 2]})`
}

/**
 * The color object as the encoder and both backends take it: the pair every
 * mode already partitions by, the value they part at, and the density LUT.
 * One shape for every encoding, so a rendering asks what to paint rather than
 * which spelling the config used.
 */
export interface ResolvedWiggleColor {
  /** At or above the last cut, and the whole plot where nothing parts. */
  posColor: string
  /** Below `pivot`. */
  negColor: string
  /** The lowest cut, or a gradient's middle stop. */
  pivot: number
  /** Where the color changes, ascending, `pivot` first; at most `MAX_WIGGLE_CUTS`. */
  cuts: number[]
  /** The colors between `negColor` and `posColor`, one per band between two cuts. */
  innerColors: string[]
  /** A ramp's 256 entries, or null where no gradient paints. */
  rampLut: Uint8Array | null
  /** The score at the ramp's middle stop; unset runs the ramp straight across the domain. */
  rampMid: number | undefined
}

/** Whether color is spent on the score: a gradient, on every mark. */
export function scoreGradientPaints(wiggleColor: ResolvedWiggleColor) {
  return wiggleColor.rampLut !== null
}

/**
 * Whether `encoding.color` says what paints: a `value`, or a scale member
 * other than the key's `names`.
 */
export function wiggleColorWritten({
  value,
  scale: { names: _names, ...painted },
}: ColorSetting) {
  return (
    value !== undefined ||
    Object.values(painted).some(v =>
      Array.isArray(v) ? v.length > 0 : v !== undefined,
    )
  )
}

/**
 * How a plot spends color, for the model and `wiggleTables` alike. A written
 * `encoding.color` paints every mark, and so does a gradient. Unset, a
 * source's marks take its row color.
 */
export function wiggleMarkColoring({
  colorSetting,
  wiggleColor,
}: {
  colorSetting: ColorSetting
  wiggleColor: ResolvedWiggleColor
}) {
  const gradientPaints = scoreGradientPaints(wiggleColor)
  const written = wiggleColorWritten(colorSetting)
  return { gradientPaints, rowColorPaintsMarks: !written && !gradientPaints }
}

/** Whether several sources share one plot box, where only color tells them apart. */
export function wiggleSharesPanel(rowLayout: boolean, sourceCount: number) {
  return !rowLayout && sourceCount > 1
}

/**
 * The grey a source with no color paints in beside dealt ones in one panel,
 * as ggplot's `na.value`: the default plot color would read as a dealt one.
 */
export const UNCOLORED_ROW = '#999'

/**
 * Each source and the color its marks paint in, for the model and
 * `wiggleTables` alike: its row color while row colors paint the marks, else
 * none, the plot's own. Where the palette deals a shared panel and some row
 * took a color, a row left without one paints `UNCOLORED_ROW`.
 */
export function wiggleMarkSources(
  sources: readonly { name: string; rowColor?: string }[],
  {
    rowColorPaintsMarks,
    paletteDeals,
    anyRowColored,
  }: {
    rowColorPaintsMarks: boolean
    paletteDeals: boolean
    anyRowColored: boolean
  },
): { name: string; color?: string }[] {
  const uncolored = paletteDeals && anyRowColored ? UNCOLORED_ROW : undefined
  return sources.map(s => ({
    name: s.name,
    color: (rowColorPaintsMarks ? s.rowColor : undefined) ?? uncolored,
  }))
}

/** A wiggle color as it paints. Unset beside `score`, the scale is the bicolor cut. */
export function wiggleColorEncoding(color: ColorSetting) {
  return colorEncodingOf(color, WIGGLE_FIELD_PRESETS)
}

/** The white a heatmap fades from at the `origin`. */
export const WIGGLE_SPAN_MIDDLE = '#ffffff'

/**
 * The two colors a score color with no `scale.type` names, below and above
 * the `origin`: its two-color `scale.range`, else the defaults. Undefined
 * where it names a `scale.scheme` or more stops, which only a ramp can paint.
 */
export function wigglePairOf({ value, scale }: ColorSetting) {
  return value !== undefined || scale.type || scale.scheme
    ? undefined
    : scale.range.length === 2
      ? { below: scale.range[0]!, above: scale.range[1]! }
      : scale.range.length === 0
        ? { below: WIGGLE_NEG_COLOR_DEFAULT, above: WIGGLE_POS_COLOR_DEFAULT }
        : undefined
}

/**
 * The `encoding.color` channel as it paints. A score color with no
 * `scale.type` is the pair about the `origin` (`wigglePairOf`), which every
 * mark draws in its own idiom: bars, points and lines paint it solid either
 * side of the cut, a threshold, and a heatmap (`rect`) fades to it from white
 * at the origin, a `linear` ramp with its middle stop there
 * (`scale.domainMid` moves it). A written `threshold` paints solid bands and
 * a written `linear` a ramp on every mark.
 */
export function paintedWiggleColor<C extends ColorSetting>(
  color: C,
  { span, origin }: { span: boolean; origin: number },
): C {
  const implied = withImpliedField(color, WIGGLE_IMPLIED_FIELD)
  if (!span || color.value !== undefined || color.scale.type) {
    return implied
  }
  const pair = wigglePairOf(color)
  return {
    ...implied,
    scale: {
      ...color.scale,
      type: 'linear',
      ...(pair
        ? {
            range: [pair.below, WIGGLE_SPAN_MIDDLE, pair.above],
            domainMid: color.scale.domainMid ?? origin,
          }
        : {}),
    },
  }
}

/**
 * What `encoding.color` says beside the schema's rules that the plot cannot
 * paint as written: threshold cuts past the ones the shader reads, and one
 * color on a heatmap, which paints it flat.
 */
export function wiggleColorProblems(color: ColorSetting, rendering: string) {
  const encoding = wiggleColorEncoding(
    paintedWiggleColor(color, { span: rendering === 'density', origin: 0 }),
  )
  const cuts = thresholdCutsOf(encoding).length
  return [
    ...(cuts > MAX_WIGGLE_CUTS
      ? [
          `encoding.color.scale.domain: a wiggle threshold reads at most ${MAX_WIGGLE_CUTS} cuts, and the ${cuts - MAX_WIGGLE_CUTS} past them draw no band`,
        ]
      : []),
    ...(rendering === 'density' && typeof encoding !== 'object'
      ? [
          'encoding.color: one color paints a heatmap flat; a two-color scale.range fades to it from white at the origin',
        ]
      : []),
  ]
}

function thresholdCutsOf(encoding: ReturnType<typeof wiggleColorEncoding>) {
  return typeof encoding === 'object' && encoding.scale === 'threshold'
    ? thresholdCuts(encoding.domain ?? [])
    : []
}

/**
 * The cuts a threshold over `score` declares, ascending, at most
 * `MAX_WIGGLE_CUTS`. Empty for any other encoding, and for a threshold naming
 * no cut, which parts at the `origin`.
 */
export function declaredCuts(encoding: ReturnType<typeof wiggleColorEncoding>) {
  return thresholdCutsOf(encoding).slice(0, MAX_WIGGLE_CUTS)
}

function solid(color: string, pivot: number): ResolvedWiggleColor {
  return {
    posColor: color,
    negColor: color,
    pivot,
    cuts: [pivot],
    innerColors: [],
    rampLut: null,
    rampMid: undefined,
  }
}

export function resolveWiggleColor(
  encoding: ReturnType<typeof wiggleColorEncoding>,
  origin: number,
): ResolvedWiggleColor {
  if (typeof encoding !== 'object') {
    return solid(encoding ?? WIGGLE_POS_COLOR_DEFAULT, origin)
  }
  switch (encoding.scale) {
    case 'ordinal':
      return solid(MISCONFIGURED_COLOR, origin)
    case 'threshold': {
      const declared = declaredCuts(encoding)
      const cuts = declared.length > 0 ? declared : [origin]
      const range = encoding.range ?? []
      return {
        negColor: range[0] ?? WIGGLE_NEG_COLOR_DEFAULT,
        posColor: range[cuts.length] ?? WIGGLE_POS_COLOR_DEFAULT,
        pivot: cuts[0]!,
        cuts,
        innerColors: cuts
          .slice(1)
          .map((_, i) => range[i + 1] ?? NO_CATEGORY_COLOR),
        rampLut: null,
        rampMid: undefined,
      }
    }
    case 'linear':
    case 'log':
    case 'symlog': {
      const { range = [], scheme, reverse = false, domainMid } = encoding
      const rampLut = rampLutOf({ range, scheme, reverse })
      const ends = range.length
        ? reverse
          ? range.toReversed()
          : range
        : [lutColor(rampLut, 0), lutColor(rampLut, rampLut.length / 4 - 1)]
      return {
        negColor: ends[0]!,
        posColor: ends.at(-1)!,
        pivot: domainMid ?? origin,
        cuts: [domainMid ?? origin],
        innerColors: [],
        rampLut,
        rampMid: domainMid,
      }
    }
  }
}
