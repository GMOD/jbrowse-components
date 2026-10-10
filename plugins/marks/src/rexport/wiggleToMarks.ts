import type { ColorSpec, DisplaySpec, MarkConfig } from './markToPlot.ts'

const POS_COLOR = '#0068d1'
const NEG_COLOR = '#e01e26'

type WiggleColor = string | (ColorSpec & { value?: string })

/** The slice of a `LinearWiggleDisplay` config this reads. */
export interface WiggleSettings {
  mark?: 'bar' | 'point' | 'line' | 'heatmap'
  interpolate?: 'step' | 'linear'
  color?: WiggleColor
  scales?: DisplaySpec['scales']
  origin?: number
  showLegend?: boolean
}

function colorOf(
  color: WiggleColor | undefined,
  mark: string,
  origin: number,
): ColorSpec {
  if (typeof color === 'string') {
    return { value: color }
  }
  if (color?.field) {
    return { scale: 'threshold', ...color }
  }
  if (color?.value) {
    return { value: color.value }
  }
  return mark === 'heatmap'
    ? { field: 'score', scale: 'linear' }
    : {
        field: 'score',
        scale: 'threshold',
        domain: [String(origin)],
        range: [NEG_COLOR, POS_COLOR],
      }
}

/**
 * A wiggle display as the mark display that draws the same plot: the score
 * plotted as a bar, point or line, or a strip colored by it.
 */
export function wiggleDisplaySpec(w: WiggleSettings): DisplaySpec {
  const mark = w.mark ?? 'bar'
  const color = colorOf(w.color, mark, w.origin ?? 0)
  const marks: MarkConfig[] =
    mark === 'heatmap'
      ? [{ mark: 'span', encoding: { color } }]
      : mark === 'line'
        ? [
            {
              mark: 'line',
              interpolate: w.interpolate ?? 'step',
              encoding: { y: 'score', size: 2, color },
            },
          ]
        : [{ mark, encoding: { y: 'score', color } }]
  return {
    marks,
    scales: w.scales,
    origin: w.origin,
    showLegend: w.showLegend,
  }
}
