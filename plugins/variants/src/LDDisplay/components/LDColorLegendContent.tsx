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
  const labels = getLabels(ldMetric, signedLD)
  return (
    <SvgGradientLegend
      gradientId={`ld-gradient-${ldMetric}-${signedLD ? 'signed' : 'unsigned'}-${idSuffix}`}
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
