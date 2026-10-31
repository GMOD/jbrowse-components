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
 * `legend.title` with it. `field` is `''` while unwritten, until
 * `paintedWiggleColor` implies `score`.
 */
export function wiggleColorSettingOf(color: AnyConfigurationModel) {
  const setting = colorSnapshotOf(color)
  return { ...setting, field: setting.field ?? '' } as ColorSetting
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
  /** Below the first cut. */
  negColor: string
  /**
   * Where the color changes, ascending, at most `MAX_WIGGLE_CUTS`: the first
   * is the lowest threshold cut, or a gradient's middle stop.
   */
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
 * Whether the plot colors by `source`, each subtrack in its row color on both
 * sides of the cut: as written, or where `encoding.color` writes nothing on
 * bars, points and lines. A heatmap writing nothing ramps the score.
 */
export function wiggleColorsBySource(color: ColorSetting, rect: boolean) {
  return (
    color.field === 'source' ||
    (!color.field && !rect && !wiggleColorWritten(color))
  )
}

/**
 * How a plot spends color, for the model and `wiggleTables` alike: whether a
 * gradient paints the score, and whether each source's marks take its row
 * color (`wiggleColorsBySource`).
 */
export function wiggleMarkColoring({
  colorSetting,
  wiggleColor,
  rect,
}: {
  colorSetting: ColorSetting
  wiggleColor: ResolvedWiggleColor
  rect: boolean
}) {
  return {
    gradientPaints: scoreGradientPaints(wiggleColor),
    rowColorPaintsMarks: wiggleColorsBySource(colorSetting, rect),
  }
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
export const WIGGLE_RECT_MIDDLE = '#ffffff'

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
 * a written `linear` a ramp on every mark. Over `source` it is the pair a
 * subtrack with no row color paints, solid on every mark.
 */
export function paintedWiggleColor<C extends ColorSetting>(
  color: C,
  { rect, origin }: { rect: boolean; origin: number },
): C {
  if (color.field === 'source') {
    return paintedWiggleColor(
      {
        ...color,
        field: '',
        value: undefined,
        scale: {
          type: undefined,
          domain: [],
          range: [],
          names: color.scale.names,
        },
      },
      { rect: false, origin },
    )
  }
  const implied = withImpliedField(color, WIGGLE_IMPLIED_FIELD)
  if (!rect || color.value !== undefined || color.scale.type) {
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
            range: [pair.below, WIGGLE_RECT_MIDDLE, pair.above],
            domainMid: color.scale.domainMid ?? origin,
          }
        : {}),
    },
  }
}

/**
 * What `encoding.color` says beside the schema's rules that the plot cannot
 * paint as written: threshold cuts past the ones the shader reads, one color
 * on a heatmap, which paints it flat, and a `source` color's own scale, which
 * the row colors replace.
 */
export function wiggleColorProblems(color: ColorSetting, rendering: string) {
  if (color.field === 'source') {
    return [
      ...(wiggleColorWritten(color)
        ? [
            'encoding.color: a color over source paints each subtrack its row color, so its value and scale paint nothing; set the colors in rowColor',
          ]
        : []),
      ...(rendering === 'density'
        ? [
            'encoding.color.field: a heatmap over source paints each subtrack one flat color, leaving the score unencoded',
          ]
        : []),
    ]
  }
  const encoding = wiggleColorEncoding(
    paintedWiggleColor(color, { rect: rendering === 'density', origin: 0 }),
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

function solid(color: string, cut: number): ResolvedWiggleColor {
  return {
    posColor: color,
    negColor: color,
    cuts: [cut],
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
        cuts: [domainMid ?? origin],
        innerColors: [],
        rampLut,
        rampMid: domainMid,
      }
    }
  }
}
