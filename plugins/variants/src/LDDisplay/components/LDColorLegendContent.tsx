import { SvgGradientLegend } from '@jbrowse/core/ui'

import { getColorStops } from './getColorStops.ts'

function getLabels(ldMetric: string, signedLD: boolean) {
  if (signedLD) {
    return {
      min: '-1',
      max: '1',
      metric: ldMetric === 'dprime' ? "D'" : 'R',
    }
  }
  return {
    min: '0',
    max: '1',
    metric: ldMetric === 'dprime' ? "D'" : 'R²',
  }
}

export default function LDColorLegendContent({
  ldMetric,
  signedLD = false,
  x = 0,
  y = 0,
}: {
  ldMetric: string
  signedLD?: boolean
  x?: number
  y?: number
}) {
  const labels = getLabels(ldMetric, signedLD)
  return (
    <SvgGradientLegend
      gradientId={`ld-gradient-${ldMetric}-${signedLD ? 'signed' : 'unsigned'}`}
      stops={getColorStops(ldMetric, signedLD)}
      labels={[
        { text: labels.min, position: 'start' },
        { text: labels.metric, position: 'middle' },
        { text: labels.max, position: 'end' },
      ]}
      x={x}
      y={y}
    />
  )
}
