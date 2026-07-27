import { GRADIENT_LEGEND_HEIGHT, GRADIENT_LEGEND_WIDTH } from '@jbrowse/core/ui'

import LDColorLegendContent from './LDColorLegendContent.tsx'

export default function LDColorLegend({
  ldMetric,
  signedLD = false,
  idSuffix,
}: {
  ldMetric: string
  signedLD?: boolean
  idSuffix: string
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: GRADIENT_LEGEND_WIDTH,
        height: GRADIENT_LEGEND_HEIGHT,
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      <LDColorLegendContent
        ldMetric={ldMetric}
        signedLD={signedLD}
        idSuffix={idSuffix}
      />
    </svg>
  )
}
