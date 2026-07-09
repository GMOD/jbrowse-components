import { measureText } from '@jbrowse/core/util'

import { formatScore } from '../util.ts'

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
  // measureText uses a Helvetica width table, but this text has no font-family
  // and renders in the wider app font (Roboto), so scale the estimate up before
  // sizing the paper or it clips the label.
  const len = measureText(legend, 12) * 1.1
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
