import { GRADIENT_LEGEND_WIDTH, SvgGradientLegend } from '@jbrowse/core/ui'

import {
  DEFAULT_HIC_COLOR_SCHEME,
  type HicColorScheme,
  getLegendSvgStops,
} from './colorRamp.ts'
import { getHicScaleLabels } from './scaleLabels.ts'

export default function HicSVGColorLegend({
  maxScore,
  colorScheme,
  useLogScale,
  width,
  // when true, the legend sits in a dedicated area to the right of the plot;
  // otherwise it floats over the top-right corner of the plot
  positionOutside,
  idSuffix,
}: {
  maxScore: number
  colorScheme?: HicColorScheme
  useLogScale?: boolean
  width: number
  positionOutside?: boolean
  idSuffix: string
}) {
  const resolvedScheme = colorScheme ?? DEFAULT_HIC_COLOR_SCHEME
  const { minLabel, maxLabel } = getHicScaleLabels(maxScore, useLogScale)
  return (
    <SvgGradientLegend
      // idSuffix (the display id) keeps the gradient def unique when two Hi-C
      // tracks export into one SVG document.
      gradientId={`hic-gradient-${resolvedScheme}-${idSuffix}`}
      stops={getLegendSvgStops(resolvedScheme)}
      labels={[
        { text: minLabel, position: 'start' },
        { text: maxLabel, position: 'end' },
      ]}
      x={positionOutside ? width + 10 : width - GRADIENT_LEGEND_WIDTH - 10}
      y={10}
    />
  )
}
