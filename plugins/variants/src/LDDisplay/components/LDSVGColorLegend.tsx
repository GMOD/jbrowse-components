import LDColorLegendContent from './LDColorLegendContent.tsx'
import { LEGEND_WIDTH } from './const.ts'

export default function LDSVGColorLegend({
  ldMetric,
  width,
  signedLD = false,
}: {
  ldMetric: string
  width: number
  signedLD?: boolean
}) {
  const x = width - LEGEND_WIDTH - 10
  const y = 10
  return (
    <LDColorLegendContent ldMetric={ldMetric} signedLD={signedLD} x={x} y={y} />
  )
}
