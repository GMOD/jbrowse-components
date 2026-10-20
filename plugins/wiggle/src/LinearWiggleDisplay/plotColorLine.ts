import { colorForValue } from '@jbrowse/display-kit/colorConfigSchema'

import { WIGGLE_SPAN_MIDDLE } from '../shared/wiggleColor.ts'

import type { ResolvedWiggleColor } from '../shared/wiggleColor.ts'
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

/**
 * Whether a color is a heatmap's two-sided ramp, white in the middle, which
 * two swatches say whole: its two ends.
 */
export function isWhiteMiddleRamp(color: {
  scale?: string
  range: readonly string[]
  scheme?: string
}) {
  return (
    color.scale === 'linear' &&
    !color.scheme &&
    color.range.length === 3 &&
    color.range[1]!.toLowerCase() === WIGGLE_SPAN_MIDDLE
  )
}

export function plotColorLine(
  resolved: ResolvedWiggleColor,
  perSource: boolean,
  heatmapRamp = false,
): PlotColorLine {
  const line = {
    above: resolved.posColor,
    below: resolved.negColor,
    cut: resolved.pivot,
  }
  if (perSource) {
    return { ...line, mode: 'hide' }
  }
  if (heatmapRamp) {
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
 * What a swatch writes. On a heatmap it is the ramp through white at the cut,
 * one color on both sides fading from white to it, and the cut written as
 * `domainMid`. Elsewhere one color on both sides is a flat plot: the string
 * form, or over a written field that field parked under `scale: 'none'`, so
 * its cut, labels and title come back when the sides part again.
 *
 * A channel replaces its setting whole, and the members this drops are the
 * ones a threshold writing its `range` does not read: `scheme`, `reverse` and
 * `domainMid`, and a ramp is where the line is not editable. A declared
 * cut survives, and an undeclared one stays undeclared — writing `domain`
 * here would pin at the `origin` every config that had been following it.
 */
export function plotColorEdit(
  color: ColorSetting,
  { above, below }: { above: string; below: string },
  heatmap?: { cut: number },
): string | Partial<ColorSetting> {
  if (heatmap) {
    return {
      field: 'score',
      scale: 'linear',
      range: [below, WIGGLE_SPAN_MIDDLE, above],
      domainMid: color.domainMid ?? heatmap.cut,
      ...(color.title === undefined ? {} : { title: color.title }),
    }
  }
  if (above === below) {
    return color.field ? colorForValue(color, above) : above
  }
  return {
    field: 'score',
    scale: 'threshold',
    ...(color.domain.length ? { domain: [...color.domain] } : {}),
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
  effectiveColor: ColorSetting
  colorSetting: ColorSetting
}) {
  const heatmap = model.isDensityMode && isWhiteMiddleRamp(model.effectiveColor)
  const line = plotColorLine(model.wiggleColor, model.rowPaletteDeals, heatmap)
  return {
    line,
    edit: (next: { above: string; below: string }) =>
      plotColorEdit(
        model.colorSetting,
        next,
        heatmap ? { cut: line.cut } : undefined,
      ),
  }
}
