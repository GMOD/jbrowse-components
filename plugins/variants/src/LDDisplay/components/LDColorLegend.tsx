import LDColorLegendContent from './LDColorLegendContent.tsx'
import { LEGEND_HEIGHT, LEGEND_WIDTH } from './const.ts'

export default function LDColorLegend({
  ldMetric,
  signedLD = false,
}: {
  ldMetric: string
  signedLD?: boolean
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: LEGEND_WIDTH,
        height: LEGEND_HEIGHT,
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      <LDColorLegendContent ldMetric={ldMetric} signedLD={signedLD} />
    </svg>
  )
}
