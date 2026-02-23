import { measureText } from '@jbrowse/core/util'

function formatScore(n: number) {
  if (n === 0) {
    return '0'
  }
  const abs = Math.abs(n)
  if (abs >= 1) {
    return abs >= 100 ? n.toFixed(0) : n.toPrecision(3).replace(/\.?0+$/, '')
  }
  return n.toPrecision(3).replace(/\.?0+$/, '')
}

function DensityLegend({
  domain,
  scaleType,
  canvasWidth,
}: {
  domain: [number, number]
  scaleType: string
  canvasWidth: number
}) {
  const [minScore, maxScore] = domain
  const legend = `[${formatScore(minScore)}-${formatScore(maxScore)}]${scaleType === 'log' ? ' (log)' : ''}`
  const len = measureText(legend, 12)
  const x = canvasWidth - len - 10
  return (
    <g>
      <rect x={x - 3} y={0} width={len + 6} height={16} fill="rgba(255,255,255,0.8)" />
      <text y={12} x={x} fontSize={12}>
        {legend}
      </text>
    </g>
  )
}

export default DensityLegend
