import { measureText } from '@jbrowse/core/util'

export default function ScoreLegend({
  ticks,
  scaleType,
  canvasWidth,
}: {
  ticks: { values: number[] }
  scaleType: string
  canvasWidth: number
}) {
  const legend = `[${ticks.values[0]?.toFixed(0)}-${ticks.values[1]?.toFixed(0)}]${scaleType === 'log' ? ' (log)' : ''}`
  const len = measureText(legend, 12)
  const xpos = canvasWidth - len - 60
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
