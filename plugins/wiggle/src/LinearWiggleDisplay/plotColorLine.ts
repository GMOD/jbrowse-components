import type { ResolvedWiggleColor } from '../shared/wiggleColor.ts'
import type { ColorSetting } from '@jbrowse/display-kit/colorConfigSchema'

/**
 * How much of the picture two swatches can say: `edit` offers them, `read`
 * shows what paints beside the reason they cannot replace it, and `hide` is
 * where a colour per subtrack paints and the grid below is already the control.
 */
export type PlotColorMode = 'edit' | 'read' | 'hide'

/**
 * The two colours the arrangement dialog offers on one line, above the rows:
 * what the plot is drawn in, either side of where it parts. Read off the
 * resolved colour rather than the written one, so an unset `color` shows the
 * pair the layout paints.
 */
export interface PlotColorLine {
  above: string
  below: string
  /** Where the colour parts: the declared cut, or the `origin`. */
  cut: number
  mode: PlotColorMode
  /** Under `read`, what paints instead. */
  reason?: string
}

export function plotColorLine(resolved: ResolvedWiggleColor): PlotColorLine {
  const line = {
    above: resolved.posColor,
    below: resolved.negColor,
    cut: resolved.pivot,
  }
  if (resolved.perSource) {
    return { ...line, mode: 'hide' }
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
      reason: `${resolved.cuts.length} cuts, a colour each`,
    }
  }
  return { ...line, mode: 'edit' }
}

/**
 * What a swatch writes. One colour on both sides is a flat plot, which the
 * string form already says, so the line needs no solid-versus-two-sided
 * choice.
 *
 * A channel replaces its setting whole, and the members this drops are the
 * ones the threshold scale does not read: `scheme`, `reverse` and `domainMid`
 * belong to a ramp, and a ramp is where the line is not editable. A declared
 * cut survives, and an undeclared one stays undeclared — writing `domain`
 * here would pin at the `origin` every config that had been following it.
 */
export function plotColorEdit(
  color: ColorSetting,
  { above, below }: { above: string; below: string },
): string | Partial<ColorSetting> {
  return above === below
    ? above
    : {
        field: 'score',
        scale: 'threshold',
        ...(color.domain.length ? { domain: [...color.domain] } : {}),
        range: [below, above],
      }
}
