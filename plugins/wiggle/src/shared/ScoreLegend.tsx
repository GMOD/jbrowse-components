import { formatScore } from '../util.ts'
import { measureLegendText } from './measureLegendText.ts'

export default function ScoreLegend({
  domain,
  scaleType,
  canvasWidth,
}: {
  domain: [number, number]
  scaleType: string
  canvasWidth: number
}) {
  const legend = `[${formatScore(domain[0])}, ${formatScore(domain[1])}]${scaleType === 'log' ? ' (log)' : ''}`
  const len = measureLegendText(legend, 12)
  const xpos = Math.max(0, canvasWidth - len - 10)
  return (
    <g>
      <rect
        x={xpos - 3}
        y={0}
        width={len + 6}
        height={16}
        fill="rgba(255,255,255,0.8)"
      />
      <text y={12} x={xpos} fontSize={12}>
        {legend}
      </text>
    </g>
  )
}
