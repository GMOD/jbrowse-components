import { wigglePairOf } from '../shared/wiggleColor.ts'

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
 * written threshold stays a threshold, and an unset scale stays the pair every
 * mark draws in its own idiom. On bars, one color on both sides is a flat
 * plot, the string form, and a pair written over it takes back the cut, labels
 * and title `parked` holds. On a heatmap the pair stays a pair, fading from
 * white to the one color.
 *
 * A channel replaces its setting whole, and the members this drops are the
 * ones a pair does not read: `scheme` and `reverse`, and a ramp is where the
 * line is not editable. A declared cut and `domainMid` survive, and an
 * undeclared one stays undeclared — writing either here would pin at the
 * `origin` every config that had been following it.
 */
export function plotColorEdit(
  written: ColorSetting,
  { above, below }: { above: string; below: string },
  heatmapPair = false,
  parked?: Partial<ColorSetting>,
): string | Partial<ColorSetting> {
  if (above === below && !heatmapPair) {
    return above
  }
  const color = written.field || !parked ? written : { ...written, ...parked }
  return {
    field: 'score',
    ...(color.scale === 'threshold' ? { scale: 'threshold' } : {}),
    ...(color.domain.length ? { domain: [...color.domain] } : {}),
    ...(color.domainMid === undefined ? {} : { domainMid: color.domainMid }),
    range: [below, above],
    ...(color.labels?.length ? { labels: [...color.labels] } : {}),
    ...(color.title === undefined ? {} : { title: color.title }),
  }
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
      plotColorEdit(
        model.colorSetting,
        next,
        heatmapPair,
        model.parkedColor as Partial<ColorSetting> | undefined,
      ),
  }
}
