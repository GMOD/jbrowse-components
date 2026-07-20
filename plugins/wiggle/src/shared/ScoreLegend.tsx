import { formatScore } from '../util.ts'
import { measureLegendText } from './measureLegendText.ts'

export default function ScoreLegend({
  domain,
  dataRange,
  scaleType,
  canvasWidth,
}: {
  domain: [number, number]
  dataRange?: [number, number]
  scaleType: string
  canvasWidth: number
}) {
  // Flag when the displayed domain clips real signal. localpercentile/localsd
  // autoscale or a fixed score bound can pin the domain inside the true data
  // extent, silently saturating everything past it to the edge color. The
  // arrow names the true extent so the reader knows the scale is clipped (e.g.
  // copy-number gains sitting above the diploid baseline the percentile clips).
  const tol = Math.max(Math.abs(domain[1] - domain[0]) * 1e-3, Number.EPSILON)
  const clip = dataRange
    ? {
        high: dataRange[1] > domain[1] + tol ? dataRange[1] : undefined,
        low: dataRange[0] < domain[0] - tol ? dataRange[0] : undefined,
      }
    : { high: undefined, low: undefined }
  const legend =
    `[${formatScore(domain[0])}, ${formatScore(domain[1])}]` +
    (scaleType === 'log' ? ' (log)' : '') +
    (clip.high === undefined ? '' : ` ↑${formatScore(clip.high)}`) +
    (clip.low === undefined ? '' : ` ↓${formatScore(clip.low)}`)
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
