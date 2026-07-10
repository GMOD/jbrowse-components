import { GRADIENT_LEGEND_WIDTH } from '@jbrowse/core/ui'

import LDColorLegendContent from './LDColorLegendContent.tsx'

export default function LDSVGColorLegend({
  ldMetric,
  width,
  signedLD = false,
}: {
  ldMetric: string
  width: number
  signedLD?: boolean
}) {
  const x = width - GRADIENT_LEGEND_WIDTH - 10
  const y = 10
  return (
    <LDColorLegendContent ldMetric={ldMetric} signedLD={signedLD} x={x} y={y} />
  )
}
