import { withImpliedField } from '@jbrowse/core/util/colorScale'
import { definedColor } from '@jbrowse/display-kit/colorConfigSchema'

import { wigglePairOf, wiggleColorWritten } from '../shared/wiggleColor.ts'
import { WIGGLE_IMPLIED_FIELD } from '../shared/wiggleColorConfigSchema.ts'

import type { ResolvedWiggleColor } from '../shared/wiggleColor.ts'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * How much of the picture two swatches can say: `edit` offers them, `read`
 * shows what paints beside the reason they cannot replace it, and `hide` is
 * where a color per subtrack paints and the grid below is already the control.
 */
export type PlotColorMode = 'edit' | 'read' | 'hide'

/**
 * The two colors the arrangement dialog offers on one line, above the rows:
 * what the plot is drawn in, either side of where it parts. Read off the
 * resolved color rather than the written one, so an unset `color` shows the
 * pair the layout paints.
 */
export interface PlotColorLine {
  above: string
  below: string
  /** Where the color parts: the declared cut, or the `origin`. */
  cut: number
  mode: PlotColorMode
  /** Under `read`, what paints instead. */
  reason?: string
}

export function plotColorLine(
  resolved: ResolvedWiggleColor,
  perSource: boolean,
  heatmapPair = false,
): PlotColorLine {
  const line = {
    above: resolved.posColor,
    below: resolved.negColor,
    cut: resolved.pivot,
  }
  if (perSource) {
    return { ...line, mode: 'hide' }
  }
  if (heatmapPair) {
    return { ...line, mode: 'edit' }
  }
  if (resolved.rampLut !== null) {
    return { ...line, mode: 'read', reason: 'a gradient paints this plot' }
  }
  // Two swatches cannot say four bands, and writing them would drop the ones
  // in between.
  if (resolved.cuts.length > 1) {
    return {
      ...line,
      mode: 'read',
      reason: `${resolved.cuts.length} cuts, a color each`,
    }
  }
  return { ...line, mode: 'edit' }
}

/**
 * What a swatch writes: the pair about the `origin` (`wigglePairOf`). A
 * written threshold stays a threshold, and an unset `scale.type` stays the
 * pair every mark draws in its own idiom. On bars, one color on both sides is
 * a flat plot, `{ value }`, and a pair written over it takes back the cut,
 * names and title `parked` holds. On a heatmap the pair stays a pair, fading
 * from white to the one color.
 *
 * A channel replaces its setting whole, and the members this drops are the
 * ones a pair does not read: `scale.scheme` and `scale.reverse`, and a ramp
 * is where the line is not editable. A declared cut and `scale.domainMid`
 * survive, and an undeclared one stays undeclared — writing either here would
 * pin at the `origin` every config that had been following it.
 */
export function plotColorEdit(
  written: ColorSetting,
  { above, below }: { above: string; below: string },
  heatmapPair = false,
  parked?: ColorSlots,
): ColorSlots {
  if (above === below && !heatmapPair) {
    return { value: above }
  }
  const scaleWritten =
    written.value === undefined && wiggleColorWritten(written)
  const { scale = {}, legend = {} }: ColorSlots =
    scaleWritten || !parked ? written : { ...written, ...parked }
  return definedColor({
    scale: {
      type: scale.type === 'threshold' ? 'threshold' : undefined,
      domain: scale.domain?.length ? scale.domain : undefined,
      domainMid: scale.domainMid,
      range: [below, above],
      names: scale.names?.length ? scale.names : undefined,
    },
    legend: { title: legend.title },
  })
}

/**
 * The line a display shows and the write a swatch edit makes, together, so
 * the dialog and anything else reading the line agree on what a heatmap's
 * two swatches mean.
 */
export function plotColorOf(model: {
  wiggleColor: ResolvedWiggleColor
  rowPaletteDeals: boolean
  isDensityMode: boolean
  colorSetting: ColorSetting
  parkedColor?: ColorSlots
}) {
  const heatmapPair =
    model.isDensityMode && wigglePairOf(model.colorSetting) !== undefined
  const line = plotColorLine(
    model.wiggleColor,
    model.rowPaletteDeals,
    heatmapPair,
  )
  return {
    line,
    edit: (next: { above: string; below: string }) =>
      plotColorEdit(model.colorSetting, next, heatmapPair, model.parkedColor),
    /** The channel as `parkColor` holds it, its implied `score` named. */
    parkable: withImpliedField(model.colorSetting, WIGGLE_IMPLIED_FIELD),
  }
}
