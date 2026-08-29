import { SvgGradientLegend } from '@jbrowse/core/ui'
import { stopsFromRampLut } from '@jbrowse/core/util/colorRamp'

import {
  generateLDColorRamp,
  ldColorStops,
  ldMetricLabel,
} from './ldColorRamp.ts'

// The gradient, read out of the same 256-entry LUT the cells are painted
// through (and the GPU samples as its ramp texture), one stop per source-table
// knot. Derived rather than restated: the legend used to carry its own five
// hand-picked colors per metric, which is a second place to edit a palette and
// a key that can quietly stop describing the plot beside it.
function gradientStops(ldMetric: string, signedLD: boolean) {
  return stopsFromRampLut(
    generateLDColorRamp(ldMetric, signedLD),
    ldColorStops(ldMetric, signedLD).length,
  )
}

export default function LDColorLegendContent({
  ldMetric,
  signedLD = false,
  idSuffix,
  x = 0,
  y = 0,
}: {
  ldMetric: string
  signedLD?: boolean
  // the display id, so the gradient def stays unique when two LD tracks share
  // one document. The stops happen to be a pure function of ldMetric/signedLD
  // today, so a collision would be harmless — but that is an undocumented
  // coupling that a future color-scheme option would silently break, and Hi-C's
  // legend already scopes its def this way.
  idSuffix: string
  x?: number
  y?: number
}) {
  return (
    <SvgGradientLegend
      gradientId={`ld-gradient-${ldMetric}-${signedLD ? 'signed' : 'unsigned'}-${idSuffix}`}
      stops={gradientStops(ldMetric, signedLD)}
      // signed ramps run -1..1 through white at zero; unsigned ones 0..1
      labels={[
        { text: signedLD ? '-1' : '0', position: 'start' },
        { text: ldMetricLabel(ldMetric, signedLD), position: 'middle' },
        { text: '1', position: 'end' },
      ]}
      x={x}
      y={y}
    />
  )
}
