import { GRADIENT_LEGEND_WIDTH } from '@jbrowse/core/ui'

import LDColorLegendContent from './LDColorLegendContent.tsx'

export default function LDSVGColorLegend({
  ldMetric,
  width,
  signedLD = false,
  idSuffix,
  // when true, the legend sits in a dedicated area to the right of the plot;
  // otherwise it floats over the top-right corner of the plot
  positionOutside,
}: {
  ldMetric: string
  width: number
  signedLD?: boolean
  idSuffix: string
  positionOutside?: boolean
}) {
  return (
    <LDColorLegendContent
      ldMetric={ldMetric}
      signedLD={signedLD}
      idSuffix={idSuffix}
      x={positionOutside ? width + 10 : width - GRADIENT_LEGEND_WIDTH - 10}
      y={10}
    />
  )
}
